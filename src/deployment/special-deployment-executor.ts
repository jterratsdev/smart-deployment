import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SpecialDeploymentCommand, SpecialDeploymentPlan } from './special-deployment-plan.js';

const execFileAsync = promisify(execFile);

export type SpecialDeploymentCommandResult = {
  phaseKind: string;
  phaseLabel: string;
  command: SpecialDeploymentCommand;
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode?: number;
};

export type SpecialDeploymentExecutionResult = {
  success: boolean;
  completedPhases: string[];
  skippedPhases: string[];
  failedPhase?: string;
  exitCode?: number;
  errors: string[];
  commands: SpecialDeploymentCommandResult[];
};

export type SpecialDeploymentCommandRunner = (
  command: SpecialDeploymentCommand,
  cwd: string
) => Promise<{ stdout: string; stderr: string }>;

type ExecFileFailure = {
  code?: number | string;
  stdout?: string;
  stderr?: string;
  message?: string;
};

export class SpecialDeploymentPlanExecutor {
  private readonly runCommand: SpecialDeploymentCommandRunner;

  public constructor(runCommand: SpecialDeploymentCommandRunner = defaultCommandRunner) {
    this.runCommand = runCommand;
  }

  public async execute(plan: SpecialDeploymentPlan): Promise<SpecialDeploymentExecutionResult> {
    const result: SpecialDeploymentExecutionResult = {
      success: true,
      completedPhases: [],
      skippedPhases: [],
      errors: [],
      commands: [],
    };

    for (const phase of plan.phases) {
      if (phase.skipped) {
        result.skippedPhases.push(phase.kind);
        continue;
      }

      for (const command of phase.commands) {
        const commandResult = await this.executeCommand(command, phase.kind, phase.label, plan.projectRoot);
        result.commands.push(commandResult);

        if (!commandResult.success) {
          result.success = false;
          result.failedPhase = phase.kind;
          result.exitCode = commandResult.exitCode;
          result.errors.push(
            `${phase.label} failed with exit code ${commandResult.exitCode ?? 'unknown'}: ${
              commandResult.stderr || commandResult.stdout || 'No command output captured.'
            }`
          );
          return result;
        }
      }

      result.completedPhases.push(phase.kind);
    }

    return result;
  }

  private async executeCommand(
    command: SpecialDeploymentCommand,
    phaseKind: string,
    phaseLabel: string,
    cwd: string
  ): Promise<SpecialDeploymentCommandResult> {
    try {
      const { stdout, stderr } = await this.runCommand(command, cwd);
      return {
        phaseKind,
        phaseLabel,
        command,
        success: true,
        stdout,
        stderr,
      };
    } catch (error) {
      const failure = toExecFileFailure(error);
      return {
        phaseKind,
        phaseLabel,
        command,
        success: false,
        stdout: failure.stdout ?? '',
        stderr: failure.stderr ?? failure.message ?? String(error),
        exitCode: typeof failure.code === 'number' ? failure.code : undefined,
      };
    }
  }
}

async function defaultCommandRunner(
  command: SpecialDeploymentCommand,
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(command.tool, command.args, { cwd });
}

function toExecFileFailure(error: unknown): ExecFileFailure {
  if (error && typeof error === 'object') {
    return error as ExecFileFailure;
  }
  return { message: String(error) };
}
