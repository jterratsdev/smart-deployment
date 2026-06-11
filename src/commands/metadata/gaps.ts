import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  MetadataGapAnalysisService,
  type MetadataGapAnalysisResult,
} from '../../analysis/metadata-gap-analysis-service.js';
import { getLogger } from '../../utils/logger.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'metadata.gaps');
const logger = getLogger('MetadataGapsCommand');
const metadataGapAnalysisService = new MetadataGapAnalysisService();

export default class MetadataGaps extends SfCommand<MetadataGapAnalysisResult> {
  public static readonly aliases = ['smart-deployment metadata gaps'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'source-path': Flags.string({
      summary: messages.getMessage('flags.source-path.summary'),
      description: messages.getMessage('flags.source-path.description'),
    }),
    'ai-explain': Flags.boolean({
      summary: messages.getMessage('flags.ai-explain.summary'),
      description: messages.getMessage('flags.ai-explain.description'),
      default: false,
    }),
  };

  public async run(): Promise<MetadataGapAnalysisResult> {
    const { flags } = await this.parse(MetadataGaps);

    try {
      const result = await this.withJsonConsoleSuppressed(async () =>
        metadataGapAnalysisService.analyze({
          sourcePath: typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined,
          aiExplain: flags['ai-explain'] === true,
        })
      );

      if (!this.jsonEnabled()) {
        this.reportResult(result);
      }

      return result;
    } catch (error) {
      logger.error('Metadata gap analysis failed', { error });
      this.error(`Metadata gap analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async withJsonConsoleSuppressed<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.jsonEnabled()) {
      return operation();
    }

    // eslint-disable-next-line no-console
    const originalLog = console.log;
    // eslint-disable-next-line no-console
    const originalWarn = console.warn;
    try {
      // eslint-disable-next-line no-console
      console.log = (): void => {};
      // eslint-disable-next-line no-console
      console.warn = (): void => {};
      return await operation();
    } finally {
      // eslint-disable-next-line no-console
      console.log = originalLog;
      // eslint-disable-next-line no-console
      console.warn = originalWarn;
    }
  }

  private reportResult(result: MetadataGapAnalysisResult): void {
    this.log('Smart deployment metadata gaps');
    this.log(`Analysis mode: ${result.analysisMode}`);
    this.log(`Detected metadata types: ${result.summary.detectedTypeCount}`);
    this.log(`Supported metadata types: ${result.summary.supportedTypeCount}`);
    this.log(`Gaps: ${result.summary.gapCount}`);
    this.log(`Human review required: ${result.summary.humanReviewCount}`);

    if (result.gaps.length > 0) {
      this.log('');
      this.log('Unsupported or incomplete metadata support');
      for (const gap of result.gaps) {
        this.log(`- ${gap.metadataType}: ${gap.classification} (${gap.supportStatus})`);
      }
    }

    if (result.aiContext) {
      this.log('');
      this.log(`AI workflow context: ${result.aiContext.recommendedCommand}`);
    }
  }
}
