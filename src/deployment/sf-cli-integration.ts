/**
 * SF CLI Integration - US-085
 * Executes deployments via official Salesforce CLI
 *
 * @ac US-085-AC-1: Execute sf project deploy start
 * @ac US-085-AC-2: Pass manifest file
 * @ac US-085-AC-3: Pass test level
 * @ac US-085-AC-4: Pass target org
 * @ac US-085-AC-5: Capture output
 * @ac US-085-AC-6: Parse deployment results
 * @issue #85
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getLogger } from '../utils/logger.js';
import { normalizeDeploymentDiagnostics, type DeploymentDiagnostic } from './deployment-error-diagnostics.js';

const execAsync = promisify(exec);
const logger = getLogger('SfCliIntegration');

export type TestLevel = 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';

export type DeploymentOptions = {
  manifestPath: string;
  targetOrg: string;
  workingDirectory?: string;
  testLevel?: TestLevel;
  tests?: string[];
  checkOnly?: boolean;
  destructiveChangesPath?: string;
  destructiveChangesTiming?: 'pre' | 'post';
};

export type DeploymentResult = {
  success: boolean;
  deploymentId?: string;
  status: string;
  componentSuccesses: number;
  componentFailures: number;
  testsRun?: number;
  testFailures?: number;
  output: string;
  diagnostics?: DeploymentDiagnostic[];
};

type ExecFailure = Error & {
  stdout?: string;
  stderr?: string;
};

/**
 * @ac US-085-AC-1: Execute sf project deploy start
 * @ac US-085-AC-2: Pass manifest file
 * @ac US-085-AC-3: Pass test level
 * @ac US-085-AC-4: Pass target org
 */
export class SfCliIntegration {
  public async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    logger.info('Starting deployment', { options });

    const command = this.buildDeployCommand(options);

    try {
      // AC-5: Capture output
      const { stdout, stderr } = await execAsync(command, { cwd: options.workingDirectory });
      const output = stdout + stderr;

      // AC-6: Parse deployment results
      const result = this.parseDeploymentOutput(output);

      logger.info('Deployment completed', { result });
      return result;
    } catch (error) {
      logger.error('Deployment failed', { error });
      const output = this.collectExecOutput(error);
      return this.parseDeploymentOutput(output, true);
    }
  }

  private buildDeployCommand(options: DeploymentOptions): string {
    const parts = [
      'sf project deploy start',
      `--manifest ${options.manifestPath}`,
      `--target-org ${options.targetOrg}`,
      '--json',
      '--wait 60',
    ];

    if (options.testLevel) {
      parts.push(`--test-level ${options.testLevel}`);
    }

    if (options.tests && options.tests.length > 0) {
      parts.push(`--tests ${options.tests.join(' ')}`);
    }

    if (options.checkOnly) {
      parts.push('--dry-run');
    }

    if (options.destructiveChangesPath) {
      parts.push(
        options.destructiveChangesTiming === 'pre' ? '--pre-destructive-changes' : '--post-destructive-changes',
        options.destructiveChangesPath
      );
    }

    return parts.join(' ');
  }

  private parseDeploymentOutput(output: string, failed = false): DeploymentResult {
    try {
      // Try to parse JSON output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          result?: {
            id?: string;
            status?: string;
            numberComponentsDeployed?: number;
            numberComponentErrors?: number;
            numberTestsTotal?: number;
            numberTestErrors?: number;
          };
        };

        const success = !failed && (parsed.result?.status === 'Succeeded' || parsed.result?.status === 'Success');
        return {
          success,
          deploymentId: parsed.result?.id,
          status: parsed.result?.status ?? 'Unknown',
          componentSuccesses: parsed.result?.numberComponentsDeployed ?? 0,
          componentFailures: parsed.result?.numberComponentErrors ?? 0,
          testsRun: parsed.result?.numberTestsTotal,
          testFailures: parsed.result?.numberTestErrors,
          output,
          diagnostics: success ? [] : normalizeDeploymentDiagnostics(output),
        };
      }
    } catch (parseError) {
      logger.warn('Failed to parse deployment output', { parseError });
    }

    // Fallback for non-JSON output
    return {
      success: !failed,
      status: failed ? 'Failed' : 'Unknown',
      componentSuccesses: 0,
      componentFailures: failed ? 1 : 0,
      output,
      diagnostics: failed ? normalizeDeploymentDiagnostics(output) : [],
    };
  }

  public async checkDeploymentStatus(deploymentId: string, targetOrg: string): Promise<DeploymentResult> {
    const command = `sf project deploy report --job-id ${deploymentId} --target-org ${targetOrg} --json`;

    try {
      const { stdout } = await execAsync(command);
      return this.parseDeploymentOutput(stdout);
    } catch (error) {
      logger.error('Failed to check deployment status', { error, deploymentId });
      const output = this.collectExecOutput(error);
      return this.parseDeploymentOutput(output, true);
    }
  }

  public async resumeDeployment(deploymentId: string, targetOrg: string): Promise<DeploymentResult> {
    const command = `sf project deploy resume --job-id ${deploymentId} --target-org ${targetOrg} --json`;

    try {
      const { stdout } = await execAsync(command);
      return this.parseDeploymentOutput(stdout);
    } catch (error) {
      logger.error('Failed to resume deployment', { error, deploymentId });
      const output = this.collectExecOutput(error);
      return this.parseDeploymentOutput(output, true);
    }
  }

  private collectExecOutput(error: unknown): string {
    if (error instanceof Error) {
      const execFailure = error as ExecFailure;
      const output = [execFailure.stdout, execFailure.stderr, execFailure.message]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join('\n');

      return output.length > 0 ? output : error.message;
    }

    return String(error);
  }
}
