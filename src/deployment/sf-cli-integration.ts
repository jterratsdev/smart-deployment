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

const execAsync = promisify(exec);
const logger = getLogger('SfCliIntegration');

// Custom exec that captures stdout even on failure
async function execWithOutput(command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      resolve({
        stdout,
        stderr,
        code: error ? (error as any).code ?? 1 : 0,
      });
    });
  });
}

export type TestLevel = 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';

export interface DeploymentOptions {
  manifestPath: string;
  targetOrg: string;
  testLevel?: TestLevel; // undefined = use SF CLI default behavior
  tests?: string[];
  testClasses?: string[]; // Alias for tests (for clarity)
  checkOnly?: boolean;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  status: string;
  componentSuccesses: number;
  componentFailures: number;
  testsRun?: number;
  testFailures?: number;
  output: string;
}

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

    // Use custom exec to capture stdout even on failure
    const { stdout, stderr, code } = await execWithOutput(command);
    const output = stdout + stderr;
    const failed = code !== 0;

    // AC-6: Parse deployment results
    const result = this.parseDeploymentOutput(output, failed);

    if (failed) {
      logger.error('Deployment failed', { code, output: output.substring(0, 500) });
    } else {
      logger.info('Deployment completed', { result });
    }

    return result;
  }

  private buildDeployCommand(options: DeploymentOptions): string {
    const parts = [
      'sf project deploy start',
      `--manifest ${options.manifestPath}`,
      `--target-org ${options.targetOrg}`,
      '--json',
      '--wait 60',
    ];

    // Only specify test-level if explicitly provided
    // If undefined, SF CLI uses its default behavior (requires tests in prod)
    if (options.testLevel) {
      parts.push(`--test-level ${options.testLevel}`);
    }

    const testsToRun = options.tests || options.testClasses;
    if (testsToRun && testsToRun.length > 0) {
      parts.push(`--tests ${testsToRun.join(' ')}`);
    }

    if (options.checkOnly) {
      parts.push('--dry-run');
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
            details?: {
              componentFailures?: Array<{
                componentType?: string;
                fullName?: string;
                problem?: string;
              }>;
            };
          };
        };

        // Build detailed error output including component failures
        let detailedOutput = output;
        if (parsed.result?.details?.componentFailures && parsed.result.details.componentFailures.length > 0) {
          const failures = parsed.result.details.componentFailures
            .map(f => `${f.componentType}:${f.fullName} - ${f.problem}`)
            .join('\n');
          detailedOutput = `${output}\n\nComponent Failures:\n${failures}`;
        }

        return {
          success: !failed && (parsed.result?.status === 'Succeeded' || parsed.result?.status === 'Success'),
          deploymentId: parsed.result?.id,
          status: parsed.result?.status ?? 'Unknown',
          componentSuccesses: parsed.result?.numberComponentsDeployed ?? 0,
          componentFailures: parsed.result?.numberComponentErrors ?? 0,
          testsRun: parsed.result?.numberTestsTotal,
          testFailures: parsed.result?.numberTestErrors,
          output: detailedOutput,
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
    };
  }

  public async checkDeploymentStatus(deploymentId: string, targetOrg: string): Promise<DeploymentResult> {
    const command = `sf project deploy report --job-id ${deploymentId} --target-org ${targetOrg} --json`;

    try {
      const { stdout } = await execAsync(command);
      return this.parseDeploymentOutput(stdout);
    } catch (error) {
      logger.error('Failed to check deployment status', { error, deploymentId });
      const output = error instanceof Error ? error.message : String(error);
      return this.parseDeploymentOutput(output, true);
    }
  }
}

