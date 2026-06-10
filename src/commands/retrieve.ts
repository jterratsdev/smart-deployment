import { Messages } from '@salesforce/core';
import { Flags, SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import {
  RetrieveForceIgnoreService,
  type RetrieveForceIgnoreOptions,
  type RetrieveForceIgnoreResult,
} from '../deployment/retrieve-forceignore-service.js';
import { getLogger } from '../utils/logger.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'retrieve');
const logger = getLogger('RetrieveCommand');
const retrieveService = new RetrieveForceIgnoreService();

export default class Retrieve extends SfCommand<RetrieveForceIgnoreResult> {
  public static readonly aliases = ['smart-deployment retrieve'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': optionalOrgFlagWithDeprecations,
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      description: messages.getMessage('flags.source-path.description'),
      exists: true,
    }),
    metadata: Flags.string({
      summary: messages.getMessage('flags.metadata.summary'),
      description: messages.getMessage('flags.metadata.description'),
      char: 'm',
    }),
    manifest: Flags.file({
      summary: messages.getMessage('flags.manifest.summary'),
      description: messages.getMessage('flags.manifest.description'),
      char: 'x',
      exists: true,
    }),
    wait: Flags.integer({
      summary: messages.getMessage('flags.wait.summary'),
      default: 33,
    }),
    'strict-ignore': Flags.boolean({
      summary: messages.getMessage('flags.strict-ignore.summary'),
      description: messages.getMessage('flags.strict-ignore.description'),
      default: false,
    }),
    'normalize-meta': Flags.boolean({
      summary: messages.getMessage('flags.normalize-meta.summary'),
      description: messages.getMessage('flags.normalize-meta.description'),
      default: false,
    }),
  };

  public async run(): Promise<RetrieveForceIgnoreResult> {
    const { flags } = await this.parse(Retrieve);
    const options: RetrieveForceIgnoreOptions = {
      projectRoot: typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined,
      targetOrg: this.getTargetOrgIdentifier(flags['target-org']),
      metadata: typeof flags.metadata === 'string' ? parseMetadataFlag(flags.metadata) : undefined,
      manifest: typeof flags.manifest === 'string' ? flags.manifest : undefined,
      wait: typeof flags.wait === 'number' ? flags.wait : undefined,
      strictIgnore: flags['strict-ignore'] === true,
      normalizeMeta: flags['normalize-meta'] === true,
    };

    logger.info('Running forceignore-safe retrieve', {
      projectRoot: options.projectRoot,
      metadata: options.metadata,
      manifest: options.manifest,
      strictIgnore: options.strictIgnore,
      normalizeMeta: options.normalizeMeta,
    });

    let result: RetrieveForceIgnoreResult;
    try {
      result = await retrieveService.retrieve(options);
    } catch (error) {
      logger.error('Retrieve failed', { error });
      this.error('Retrieve failed: ' + (error instanceof Error ? error.message : String(error)));
    }

    if (!this.jsonEnabled()) {
      this.reportResult(result);
    }

    if (!result.success) {
      this.error(messages.getMessage('errors.strict-ignore', [String(result.protectedPaths.length)]));
    }

    return result;
  }

  private reportResult(result: RetrieveForceIgnoreResult): void {
    this.log(messages.getMessage('output.title'));
    this.log(messages.getMessage('output.changed', [String(result.changedPaths.length)]));
    this.log(messages.getMessage('output.restored', [String(result.restoredPaths.length)]));
    this.log(messages.getMessage('output.normalized', [String(result.normalizedPaths.length)]));

    if (result.restoredPaths.length > 0) {
      this.log('');
      this.log(messages.getMessage('output.restoredHeader'));
      for (const restoredPath of result.restoredPaths) {
        this.log('- ' + restoredPath);
      }
    }
  }

  private getTargetOrgIdentifier(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (typeof value === 'object' && value !== null && 'getUsername' in value) {
      const getUsername = (value as { getUsername?: unknown }).getUsername;
      return typeof getUsername === 'function' ? (getUsername as () => string | undefined).call(value) : undefined;
    }

    return undefined;
  }
}

function parseMetadataFlag(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
