import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  InitConfigGenerationService,
  type InitConfigGenerationResult,
  type InitValidationMode,
} from '../config/init-config-generation-service.js';
import { getLogger } from '../utils/logger.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'init');
const logger = getLogger('InitCommand');
const initConfigGenerationService = new InitConfigGenerationService();

export default class Init extends SfCommand<InitConfigGenerationResult> {
  public static readonly aliases = ['smart-deployment init'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      exists: true,
    }),
    force: Flags.boolean({
      summary: messages.getMessage('flags.force.summary'),
      char: 'f',
      default: false,
    }),
    'cache-enabled': Flags.boolean({
      summary: messages.getMessage('flags.cache-enabled.summary'),
      default: true,
      allowNo: true,
    }),
    'validation-mode': Flags.string({
      summary: messages.getMessage('flags.validation-mode.summary'),
      options: ['strict', 'warn-only', 'local-only'],
      default: 'strict',
    }),
    'report-dir': Flags.string({
      summary: messages.getMessage('flags.report-dir.summary'),
    }),
    'skip-tests': Flags.boolean({
      summary: messages.getMessage('flags.skip-tests.summary'),
      default: false,
    }),
    'non-interactive': Flags.boolean({
      summary: messages.getMessage('flags.non-interactive.summary'),
      default: false,
    }),
  };

  public async run(): Promise<InitConfigGenerationResult> {
    const { flags } = await this.parse(Init);

    try {
      const result = await initConfigGenerationService.generate({
        startPath: flags['source-path'],
        force: flags.force,
        cacheEnabled: flags['cache-enabled'],
        validationMode: flags['validation-mode'] as InitValidationMode,
        reportDir: flags['report-dir'],
        skipTests: flags['skip-tests'],
      });

      this.reportResult(result);
      logger.info('Smart Deployment config initialized', {
        configPath: result.configPath,
        projectRoot: result.projectRoot,
        sourcePath: result.sourcePath,
        overwritten: result.overwritten,
        nonInteractive: flags['non-interactive'],
      });
      return result;
    } catch (error) {
      logger.error('Smart Deployment init failed', { error });
      this.error('Init failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private reportResult(result: InitConfigGenerationResult): void {
    this.log(result.overwritten ? 'Smart Deployment config overwritten' : 'Smart Deployment config created');
    this.log('Config: ' + result.configPath);
    this.log('Project root: ' + result.projectRoot);
    this.log('Source path: ' + result.sourcePath);
    this.log('Packages: ' + result.packageDirectories.length);

    for (const warning of result.warnings) {
      this.warn(warning);
    }
  }
}
