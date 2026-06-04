import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { ImpactAnalysisService, type ImpactCommandResult } from '../dependencies/impact-analysis-service.js';
import { getLogger } from '../utils/logger.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'impact');
const logger = getLogger('ImpactCommand');
const impactAnalysisService = new ImpactAnalysisService();

export default class Impact extends SfCommand<ImpactCommandResult> {
  public static readonly aliases = ['smart-deployment impact'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'source-path': Flags.string({
      summary: messages.getMessage('flags.source-path.summary'),
      description: messages.getMessage('flags.source-path.description'),
    }),
    base: Flags.string({
      summary: messages.getMessage('flags.base.summary'),
      description: messages.getMessage('flags.base.description'),
    }),
    head: Flags.string({
      summary: messages.getMessage('flags.head.summary'),
      description: messages.getMessage('flags.head.description'),
    }),
    'working-tree': Flags.boolean({
      summary: messages.getMessage('flags.working-tree.summary'),
      description: messages.getMessage('flags.working-tree.description'),
      default: false,
    }),
    'max-depth': Flags.integer({
      summary: messages.getMessage('flags.max-depth.summary'),
      description: messages.getMessage('flags.max-depth.description'),
    }),
  };

  public async run(): Promise<ImpactCommandResult> {
    const { flags } = await this.parse(Impact);

    try {
      const result = await this.withJsonConsoleSuppressed(async () =>
        impactAnalysisService.analyze({
          sourcePath: typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined,
          base: typeof flags.base === 'string' ? flags.base : undefined,
          head: typeof flags.head === 'string' ? flags.head : undefined,
          workingTree: flags['working-tree'] === true,
          maxDepth: typeof flags['max-depth'] === 'number' ? flags['max-depth'] : undefined,
        })
      );

      if (!this.jsonEnabled()) {
        this.reportResult(result);
      }
      return result;
    } catch (error) {
      logger.error('Impact analysis failed', { error });
      this.error(`Impact analysis failed: ${error instanceof Error ? error.message : String(error)}`);
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

  private reportResult(result: ImpactCommandResult): void {
    this.log('Smart deployment impact');
    this.log(`Mode: ${result.mode}`);
    if (result.base && result.head) {
      this.log(`Range: ${result.base}..${result.head}`);
    }
    this.log(`Changed components: ${result.summary.changedComponentCount}`);
    this.log(`Transitive dependents: ${result.summary.transitiveDependentCount}`);
    this.log(`Affected components: ${result.summary.affectedComponentCount}`);
    this.log(`Planned waves: ${result.summary.plannedWaveCount}`);
    this.log(`Suggested Apex tests: ${result.summary.suggestedApexTestCount}`);
    this.log(`Impact level: ${result.summary.overallImpactLevel}`);

    if (result.plannedWaves.length > 0) {
      this.log('');
      this.log('Planned waves');
      for (const wave of result.plannedWaves) {
        this.log(`Wave ${wave.number}: ${wave.components.join(', ')}`);
      }
    }

    const tests = [...result.suggestedApexTests.requiredTests, ...result.suggestedApexTests.recommendedTests];
    if (tests.length > 0) {
      this.log('');
      this.log(`Suggested tests: ${tests.join(', ')}`);
    }
  }
}
