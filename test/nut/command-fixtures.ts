import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DeploymentState } from '../../src/deployment/state-manager.js';

export type NutWorkspace = {
  tempDir: string;
  homeDir: string;
};

export async function createNutWorkspace(prefix: string): Promise<NutWorkspace> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const homeDir = path.join(tempDir, 'home');

  await mkdir(path.join(homeDir, '.sf'), { recursive: true });
  await mkdir(path.join(homeDir, '.sfdx'), { recursive: true });

  return { tempDir, homeDir };
}

export async function cleanupNutWorkspace(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}

export async function createStandardProject(rootDir: string, projectName = 'standard-project'): Promise<string> {
  const projectRoot = path.join(rootDir, projectName);
  const classesDir = path.join(projectRoot, 'force-app/main/default/classes');

  await rm(projectRoot, { recursive: true, force: true });
  await mkdir(classesDir, { recursive: true });

  await writeProjectConfig(projectRoot);
  await writeFile(path.join(projectRoot, '.forceignore'), '', 'utf8');
  await writeFile(path.join(classesDir, 'TestClass.cls'), 'public class TestClass {}', 'utf8');
  await writeFile(
    path.join(classesDir, 'TestClass.cls-meta.xml'),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
      '  <apiVersion>61.0</apiVersion>',
      '  <status>Active</status>',
      '</ApexClass>',
      '',
    ].join('\n'),
    'utf8'
  );

  return projectRoot;
}

export async function createCorruptedProject(rootDir: string, projectName = 'corrupted-project'): Promise<string> {
  const projectRoot = path.join(rootDir, projectName);
  const classesDir = path.join(projectRoot, 'force-app/main/default/classes');

  await rm(projectRoot, { recursive: true, force: true });
  await mkdir(classesDir, { recursive: true });

  await writeProjectConfig(projectRoot);
  await writeFile(path.join(projectRoot, '.forceignore'), '', 'utf8');
  await writeFile(path.join(classesDir, 'Broken.cls'), 'public class Broken {', 'utf8');
  await writeFile(
    path.join(classesDir, 'Broken.cls-meta.xml'),
    '<?xml version="1.0" encoding="UTF-8"?><ApexClass><unclosed>',
    'utf8'
  );

  return projectRoot;
}

export async function writeDeploymentState(projectRoot: string, state: DeploymentState): Promise<string> {
  const stateDir = path.join(projectRoot, '.smart-deployment');
  const stateFile = path.join(stateDir, 'deployment-state.json');

  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');

  return stateFile;
}

export async function readDeploymentState(projectRoot: string): Promise<DeploymentState> {
  const stateFile = path.join(projectRoot, '.smart-deployment', 'deployment-state.json');
  const content = await readFile(stateFile, 'utf8');
  return JSON.parse(content) as DeploymentState;
}

export async function stateFileExists(projectRoot: string): Promise<boolean> {
  try {
    await access(path.join(projectRoot, '.smart-deployment', 'deployment-state.json'), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function parseJsonStdout<T>(stdout: string): T {
  const trimmed = stdout.trim();
  const lastObjectStart = Math.max(trimmed.lastIndexOf('\n{'), trimmed.lastIndexOf('\r\n{'));

  if (lastObjectStart >= 0) {
    const jsonBlock = trimmed.slice(trimmed[lastObjectStart] === '{' ? lastObjectStart : lastObjectStart + 1);

    try {
      const parsed = JSON.parse(jsonBlock) as { result?: T };
      return parsed.result ?? (parsed as T);
    } catch {
      // Fall back to line-based parsing below.
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let fallbackLogObject: T | undefined;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]) as Record<string, unknown> & { result?: T };
      const looksLikeLogRecord =
        'timestamp' in parsed && 'level' in parsed && 'component' in parsed && 'message' in parsed;

      if (!looksLikeLogRecord) {
        return parsed.result ?? (parsed as T);
      }

      fallbackLogObject = parsed as T;
    } catch {
      continue;
    }
  }

  if (fallbackLogObject !== undefined) {
    return fallbackLogObject;
  }

  throw new Error(`No parseable JSON object found in stdout:\n${stdout}`);
}

function writeProjectConfig(projectRoot: string): Promise<void> {
  return writeFile(
    path.join(projectRoot, 'sfdx-project.json'),
    JSON.stringify(
      {
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '61.0',
      },
      null,
      2
    ),
    'utf8'
  );
}

export type FakeSfCliScenario =
  | 'success'
  | 'partial-failure'
  | 'report-in-progress'
  | 'report-failed'
  | 'resume-success';

export type FakeSfCliFixture = {
  binDir: string;
  logPath: string;
  env: Record<string, string>;
  readCalls: () => Promise<Array<{ args: string[]; cwd: string }>>;
};

export async function createFakeSfCli(rootDir: string, scenario: FakeSfCliScenario): Promise<FakeSfCliFixture> {
  const binDir = path.join(rootDir, 'fake-sf-bin');
  const logPath = path.join(rootDir, 'fake-sf-calls.jsonl');
  const executablePath = path.join(binDir, 'sf');

  await mkdir(binDir, { recursive: true });
  await writeFile(executablePath, buildFakeSfCliScript(logPath), 'utf8');
  await chmod(executablePath, 0o755);

  return {
    binDir,
    logPath,
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      SMART_DEPLOYMENT_FAKE_SF_SCENARIO: scenario,
      SMART_DEPLOYMENT_FAKE_SF_LOG: logPath,
    },
    readCalls: async () => {
      try {
        const content = await readFile(logPath, 'utf8');
        return content
          .split(/\r?\n/)
          .filter((line) => line.length > 0)
          .map((line) => JSON.parse(line) as { args: string[]; cwd: string });
      } catch {
        return [];
      }
    },
  };
}

function buildFakeSfCliScript(logPath: string): string {
  return [
    '#!/usr/bin/env node',
    "const { appendFileSync } = require('node:fs');",
    'const args = process.argv.slice(2);',
    `const logPath = process.env.SMART_DEPLOYMENT_FAKE_SF_LOG || ${JSON.stringify(logPath)};`,
    "appendFileSync(logPath, JSON.stringify({ args, cwd: process.cwd() }) + '\\n');",
    "const scenario = process.env.SMART_DEPLOYMENT_FAKE_SF_SCENARIO || 'success';",
    'function write(result, code = 0) { console.log(JSON.stringify({ status: code, result })); process.exit(code); }',
    "if (args.join(' ').startsWith('project deploy start')) {",
    "  if (scenario === 'partial-failure') {",
    "    write({ id: '0AfFakePartialFailure', status: 'Failed', numberComponentsDeployed: 1, numberComponentErrors: 1, numberTestsTotal: 0, numberTestErrors: 0, details: { componentFailures: { componentType: 'ApexClass', fullName: 'BrokenClass', problem: 'Invalid type: MissingDependency' } } }, 1);",
    '  }',
    "  write({ id: '0AfFakeStartSuccess', status: 'Succeeded', numberComponentsDeployed: 1, numberComponentErrors: 0, numberTestsTotal: 0, numberTestErrors: 0 });",
    '}',
    "if (args.join(' ').startsWith('project deploy report')) {",
    "  if (scenario === 'report-failed') {",
    "    write({ id: '0AfFakeReportFailed', status: 'Failed', numberComponentsDeployed: 1, numberComponentErrors: 1, numberTestsTotal: 0, numberTestErrors: 0, details: { componentFailures: { componentType: 'ApexClass', fullName: 'ReportFailed', problem: 'FIELD_INTEGRITY_EXCEPTION' } } }, 1);",
    '  }',
    "  write({ id: '0AfFakeReportInProgress', status: 'InProgress', numberComponentsDeployed: 0, numberComponentErrors: 0, numberTestsTotal: 0, numberTestErrors: 0 });",
    '}',
    "if (args.join(' ').startsWith('project deploy resume')) {",
    "  write({ id: '0AfFakeResumeSuccess', status: 'Succeeded', numberComponentsDeployed: 1, numberComponentErrors: 0, numberTestsTotal: 0, numberTestErrors: 0 });",
    '}',
    "console.error(`Unsupported fake sf command: ${args.join(' ')}`);",
    'process.exit(64);',
    '',
  ].join('\n');
}
