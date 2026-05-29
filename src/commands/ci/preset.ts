import { appendFile } from 'node:fs/promises';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import {
  CiPresetService,
  type CiPresetResult,
  type CiPresetValidationMode,
} from '../../deployment/ci-preset-service.js';
import { getLogger } from '../../utils/logger.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'ci.preset');
const logger = getLogger('CiPresetCommand');
const ciPresetService = new CiPresetService();

export default class CiPreset extends SfCommand<CiPresetResult> {
  public static readonly aliases = ['smart-deployment ci preset'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'target-org': optionalOrgFlagWithDeprecations,
    'source-path': Flags.string({
      summary: messages.getMessage('flags.source-path.summary'),
      description: messages.getMessage('flags.source-path.description'),
    }),
    'report-dir': Flags.string({
      summary: messages.getMessage('flags.report-dir.summary'),
      description: messages.getMessage('flags.report-dir.description'),
    }),
    'validation-mode': Flags.string({
      summary: messages.getMessage('flags.validation-mode.summary'),
      description: messages.getMessage('flags.validation-mode.description'),
      options: ['strict', 'warn-only', 'local-only'],
      default: 'strict',
    }),
    'skip-tests': Flags.boolean({
      summary: messages.getMessage('flags.skip-tests.summary'),
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
  };

  public async run(): Promise<CiPresetResult> {
    const { flags } = await this.parse(CiPreset);
    const validationMode = flags['validation-mode'] as CiPresetValidationMode;
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const targetOrg = this.getTargetOrgIdentifier(flags['target-org']);
    let result: CiPresetResult;

    try {
      logger.info('Running CI preset', { sourcePath, targetOrg, validationMode });
      result = await ciPresetService.run({
        sourcePath,
        targetOrg,
        reportDir: typeof flags['report-dir'] === 'string' ? flags['report-dir'] : undefined,
        validationMode,
        skipTests: flags['skip-tests'] === true,
        useAI: flags['use-ai'] === true,
        orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
        industry: typeof flags.industry === 'string' ? flags.industry : undefined,
      });

      await this.writeGithubOutputs(result);
    } catch (error) {
      logger.error('CI preset failed', { error });
      this.error(`CI preset failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    this.reportResult(result);

    if (result.exitCode !== 0) {
      this.exit(result.exitCode);
    }

    return result;
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

  private async writeGithubOutputs(result: CiPresetResult): Promise<void> {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (!outputFile) {
      return;
    }

    const content = Object.entries(result.githubOutputs)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n');
    await appendFile(outputFile, `${content}\n`, 'utf8');
  }

  private reportResult(result: CiPresetResult): void {
    this.log('Smart deployment CI preset');
    this.log(`Mode: ${result.validationMode}`);
    this.log(`Status: ${result.summary.conclusion}`);
    this.log(`Components: ${result.summary.components}`);
    this.log(`Waves: ${result.summary.waves}`);
    this.log(`Blockers: ${result.summary.blockers}`);
    this.log(`Warnings: ${result.summary.warnings}`);
    this.log(`JSON report: ${result.artifacts.jsonPath}`);
    this.log(`HTML report: ${result.artifacts.htmlPath}`);
    this.log(`Exit code: ${result.exitCode}`);
  }
}
