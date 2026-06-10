import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { DeploymentContextService } from '../../deployment/deployment-context-service.js';
import {
  GraphExportService,
  type GraphExportFormat,
  type GraphExportResult,
} from '../../reports/graph-export-service.js';
import { getLogger } from '../../utils/logger.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'graph.export');
const logger = getLogger('GraphExportCommand');
const contextService = new DeploymentContextService();
const exportService = new GraphExportService();

export default class GraphExport extends SfCommand<GraphExportResult> {
  public static readonly aliases = ['smart-deployment graph export'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'source-path': Flags.string({
      summary: messages.getMessage('flags.source-path.summary'),
      description: messages.getMessage('flags.source-path.description'),
    }),
    'report-dir': Flags.string({
      summary: messages.getMessage('flags.report-dir.summary'),
      description: messages.getMessage('flags.report-dir.description'),
    }),
    output: Flags.string({
      summary: messages.getMessage('flags.output.summary'),
      description: messages.getMessage('flags.output.description'),
    }),
    format: Flags.string({
      summary: messages.getMessage('flags.format.summary'),
      description: messages.getMessage('flags.format.description'),
      options: ['mermaid', 'dot', 'json', 'html'],
      default: 'json',
      char: 'f',
    }),
    'use-ai': Flags.boolean({
      summary: messages.getMessage('flags.use-ai.summary'),
      default: false,
    }),
    'org-type': Flags.string({
      summary: messages.getMessage('flags.org-type.summary'),
      options: ['Production', 'Sandbox', 'Developer'],
    }),
    industry: Flags.string({
      summary: messages.getMessage('flags.industry.summary'),
    }),
  };

  public async run(): Promise<GraphExportResult> {
    const { flags } = await this.parse(GraphExport);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const format = flags.format as GraphExportFormat;

    try {
      const result = await this.withJsonConsoleSuppressed(async () => {
        logger.info('Exporting dependency graph', { sourcePath, format });
        const context = await contextService.buildContext({
          sourcePath,
          useAI: flags['use-ai'] === true,
          orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
          industry: typeof flags.industry === 'string' ? flags.industry : undefined,
        });
        return exportService.generate(context, {
          format,
          outputPath: typeof flags.output === 'string' ? flags.output : undefined,
          reportDir: typeof flags['report-dir'] === 'string' ? flags['report-dir'] : undefined,
        });
      });

      if (!this.jsonEnabled()) this.reportResult(result);
      return result;
    } catch (error) {
      logger.error('Graph export failed', { error });
      this.error(`Graph export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private reportResult(result: GraphExportResult): void {
    this.log('Graph export complete');
    this.log(`Format: ${result.format}`);
    this.log(`Output: ${result.path}`);
    this.log(`Components: ${result.report.summary.components}`);
    this.log(`Dependency edges: ${result.report.summary.dependencyEdges}`);
    this.log(`Waves: ${result.report.summary.waves}`);
    this.log(`Cycles: ${result.report.summary.cycles}`);
  }

  private async withJsonConsoleSuppressed<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.jsonEnabled()) return operation();
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
}
