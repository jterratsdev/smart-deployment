import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type {
  SpecialDeploymentCommand,
  SpecialDeploymentPhase,
  SpecialDeploymentPlan,
} from './special-deployment-plan.js';
import { ForceIgnoreStagingService } from './forceignore-staging-service.js';

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

export type SpecialDeploymentPlanExecutorDependencies = {
  runCommand?: SpecialDeploymentCommandRunner;
  forceIgnoreStagingService?: ForceIgnoreStagingService;
};

type ExecFileFailure = {
  code?: number | string;
  stdout?: string;
  stderr?: string;
  message?: string;
};

export class SpecialDeploymentPlanExecutor {
  private readonly runCommand: SpecialDeploymentCommandRunner;
  private readonly forceIgnoreStagingService: ForceIgnoreStagingService;
  private readonly publishedVersions = new Map<string, string>();

  public constructor(dependencies: SpecialDeploymentCommandRunner | SpecialDeploymentPlanExecutorDependencies = {}) {
    const resolved = typeof dependencies === 'function' ? { runCommand: dependencies } : dependencies;
    this.runCommand = resolved.runCommand ?? defaultCommandRunner;
    this.forceIgnoreStagingService = resolved.forceIgnoreStagingService ?? new ForceIgnoreStagingService();
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
        const workspace = await this.forceIgnoreStagingService.prepare({ projectRoot: plan.projectRoot });
        let commandResult: SpecialDeploymentCommandResult;
        try {
          const stagedPlan = { ...plan, projectRoot: workspace.projectRoot };
          const preparedCommand = await prepareCommand(command, phase, stagedPlan, this.publishedVersions);
          commandResult = await this.executeCommand(preparedCommand, phase.kind, phase.label, workspace.projectRoot);
          this.capturePublishedVersion(commandResult);
          result.commands.push(commandResult);
        } catch (error) {
          commandResult = buildFailedCommandResult(command, phase.kind, phase.label, error);
          result.commands.push(commandResult);
        } finally {
          await workspace.cleanup();
        }

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

  private capturePublishedVersion(commandResult: SpecialDeploymentCommandResult): void {
    if (!commandResult.success || commandResult.phaseKind !== 'agentforce-publish') {
      return;
    }

    const nameArgIndex = commandResult.command.args.findIndex((arg) => arg === '-n');
    const agentName = nameArgIndex >= 0 ? commandResult.command.args[nameArgIndex + 1] : undefined;
    const version = findPublishedVersion(commandResult.stdout);
    if (agentName && version) {
      this.publishedVersions.set(agentName, version);
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
  plan: SpecialDeploymentPlan,
  publishedVersions: ReadonlyMap<string, string> = new Map()
): Promise<SpecialDeploymentCommand> {
  const versionPlaceholderIndex = command.args.findIndex((arg) => /^<published-version:[^>]+>$/u.test(arg));
  if (versionPlaceholderIndex >= 0) {
    const agentName = command.args[versionPlaceholderIndex].slice('<published-version:'.length, -1);
    const version = publishedVersions.get(agentName);
    if (!version) {
      throw new Error(`Published Agentforce version for "${agentName}" is not available for activation.`);
    }
    return replaceArg(command, versionPlaceholderIndex, version);
  }

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

function buildFailedCommandResult(
  command: SpecialDeploymentCommand,
  phaseKind: string,
  phaseLabel: string,
  error: unknown
): SpecialDeploymentCommandResult {
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

function findPublishedVersion(stdout: string): string | undefined {
  const parsed = parseJson(stdout);
  if (!parsed) {
    return undefined;
  }

  return findVersionValue(parsed);
}

function parseJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    const jsonMatch = stdout.match(/\{[\s\S]*\}/u);
    if (!jsonMatch) {
      return undefined;
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return undefined;
    }
  }
}

function findVersionValue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of ['version', 'versionNumber', 'publishedVersion', 'agentVersion']) {
    const candidate = record[key];
    if (typeof candidate === 'number' || typeof candidate === 'string') {
      return String(candidate);
    }
  }

  for (const nested of Object.values(record)) {
    const found = findVersionValue(nested);
    if (found) {
      return found;
    }
  }

  return undefined;
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
