import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type {
  SpecialDeploymentCommand,
  SpecialDeploymentPhase,
  SpecialDeploymentPlan,
} from './special-deployment-plan.js';

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
        const preparedCommand = await prepareCommand(command, phase, plan);
        const commandResult = await this.executeCommand(preparedCommand, phase.kind, phase.label, plan.projectRoot);
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

async function prepareCommand(
  command: SpecialDeploymentCommand,
  phase: SpecialDeploymentPhase,
  plan: SpecialDeploymentPlan
): Promise<SpecialDeploymentCommand> {
  const manifestArgIndex = command.args.findIndex((arg) => arg === '<generated-core-manifest>');
  if (manifestArgIndex >= 0) {
    const manifestPath = await writePhaseManifest(
      plan.projectRoot,
      phase,
      plan.apiVersion,
      'core-metadata-package.xml'
    );
    return replaceArg(command, manifestArgIndex, manifestPath);
  }

  const aiEvalManifestArgIndex = command.args.findIndex((arg) => arg === '<generated-ai-evaluation-manifest>');
  if (aiEvalManifestArgIndex >= 0) {
    const manifestPath = await writePhaseManifest(
      plan.projectRoot,
      phase,
      plan.apiVersion,
      'ai-evaluations-package.xml'
    );
    return replaceArg(command, aiEvalManifestArgIndex, manifestPath);
  }

  return command;
}

async function writePhaseManifest(
  projectRoot: string,
  phase: SpecialDeploymentPhase,
  apiVersion: string,
  fileName: string
): Promise<string> {
  const manifestDirectory = path.join(projectRoot, '.smart-deployment', 'ci-publish');
  const manifestPath = path.join(manifestDirectory, fileName);
  await mkdir(manifestDirectory, { recursive: true });
  await writeFile(manifestPath, buildPackageXml(phase.components, apiVersion), 'utf8');
  return manifestPath;
}

function buildPackageXml(components: string[], apiVersion: string): string {
  const byType = new Map<string, string[]>();
  for (const component of components) {
    const separator = component.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    const type = component.slice(0, separator);
    const name = component.slice(separator + 1);
    const members = byType.get(type) ?? [];
    members.push(name);
    byType.set(type, members);
  }

  const typeBlocks = [...byType.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, members]) => {
      const memberLines = [...new Set(members)]
        .sort()
        .map((member) => `    <members>${escapeXml(member)}</members>`)
        .join('\n');
      return `  <types>\n${memberLines}\n    <name>${escapeXml(type)}</name>\n  </types>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
    typeBlocks,
    `  <version>${escapeXml(apiVersion)}</version>`,
    '</Package>',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function replaceArg(command: SpecialDeploymentCommand, index: number, value: string): SpecialDeploymentCommand {
  const args = [...command.args];
  args[index] = value;
  return { ...command, args };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function toExecFileFailure(error: unknown): ExecFileFailure {
  if (error && typeof error === 'object') {
    return error as ExecFileFailure;
  }
  return { message: String(error) };
}
