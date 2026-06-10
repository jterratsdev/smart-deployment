import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import type { CommitScopeOptions } from '../../deployment/commit-scope-service.js';
import { PlanExplainService, type PlanExplainResult } from '../../deployment/plan-explain-service.js';
import { PlanExplainPresenter } from '../../presentation/plan-explain-presenter.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger('PlanExplainCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'plan.explain');
const explainService = new PlanExplainService();
const presenter = new PlanExplainPresenter();

export default class PlanExplain extends SfCommand<PlanExplainResult> {
  public static readonly aliases = ['smart-deployment plan explain'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags: Interfaces.FlagInput = {
    'target-org': optionalOrgFlagWithDeprecations,
    'source-path': Flags.string({
      summary: messages.getMessage('flags.source-path.summary'),
    }),
    'dry-run': Flags.boolean({
      summary: messages.getMessage('flags.dry-run.summary'),
      default: true,
      allowNo: true,
    }),
    'validate-only': Flags.boolean({
      summary: messages.getMessage('flags.validate-only.summary'),
      default: false,
    }),
    'skip-tests': Flags.boolean({
      summary: messages.getMessage('flags.skip-tests.summary'),
      default: false,
    }),
    'allow-cycle-remediation': Flags.boolean({
      summary: messages.getMessage('flags.allow-cycle-remediation.summary'),
      default: false,
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
    since: Flags.string({
      summary: messages.getMessage('flags.since.summary'),
    }),
    'auto-activate': Flags.boolean({
      summary: messages.getMessage('flags.auto-activate.summary'),
      default: false,
    }),
    'scope-commits': Flags.string({
      summary: messages.getMessage('flags.scope-commits.summary'),
    }),
    'scope-manifest': Flags.string({
      summary: messages.getMessage('flags.scope-manifest.summary'),
    }),
  };

  public async run(): Promise<PlanExplainResult> {
    const { flags } = await this.parse(PlanExplain);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const targetOrg = this.getTargetOrgIdentifier(flags['target-org']);
    const commitScope = this.getCommitScopeOptions(flags);

    try {
      const result = await this.withJsonConsoleSuppressed(async () => {
        logger.info('Explaining deployment plan', {
          sourcePath,
          targetOrg,
          useAI: flags['use-ai'] === true,
        });

        return explainService.explain({
          sourcePath,
          targetOrg,
          useAI: flags['use-ai'] === true,
          orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
          industry: typeof flags.industry === 'string' ? flags.industry : undefined,
          since: typeof flags.since === 'string' ? flags.since : undefined,
          autoActivate: flags['auto-activate'] === true,
          commitScope,
        });
      });

      if (!this.jsonEnabled()) {
        presenter.report(this, result);
      }

      return result;
    } catch (error) {
      logger.error('Plan explain failed', { error });
      this.error(`Plan explain failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getCommitScopeOptions(flags: Record<string, unknown>): CommitScopeOptions | undefined {
    const commits = typeof flags['scope-commits'] === 'string' ? [flags['scope-commits']] : undefined;
    const manifestPath = typeof flags['scope-manifest'] === 'string' ? flags['scope-manifest'] : undefined;

    return commits !== undefined || manifestPath !== undefined ? { commits, manifestPath } : undefined;
  }

  private getTargetOrgIdentifier(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (typeof value === 'object' && value !== null && 'getUsername' in value) {
      const getUsername = (value as { getUsername: () => string }).getUsername;
      return typeof getUsername === 'function' ? getUsername.call(value) : undefined;
    }

    return undefined;
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
}
