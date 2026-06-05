import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { cleanupNutContexts, createNutContext, execNutCommand, parseJsonStdout } from './helpers/nut-helpers.js';

const execFileAsync = promisify(execFile);

type StartRollbackJson = {
  success: boolean;
  waves: number;
  reports?: {
    jsonPath: string;
    htmlPath: string;
  };
  rollback?: {
    enabled: boolean;
    from: string;
    to: string;
    destructiveComponents: string[];
    restoreComponents: string[];
  };
};

type DeploymentPlanReport = {
  command: {
    mode: string;
    destructive: boolean;
  };
};

describe('NUT: destructive rollback start CLI', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await cleanupNutContexts(tempDirs);
  });

  it('plans rollback from release tags through the start command', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createRollbackProject(tempDir);
    const reportDir = path.join(tempDir, 'rollback-report');

    const result = execNutCommand<StartRollbackJson>(
      [
        'start',
        `--source-path ${projectRoot}`,
        '--rollback-from v1.2.0',
        '--rollback-to v1.2.1',
        '--dry-run',
        `--report-dir ${reportDir}`,
        '--json',
      ].join(' '),
      homeDir
    );
    const output = parseJsonStdout<StartRollbackJson>(result.shellOutput.stdout);
    const report = JSON.parse(await readFile(output.reports?.jsonPath ?? '', 'utf8')) as DeploymentPlanReport;

    expect(output.success).to.equal(true);
    expect(output.rollback).to.deep.equal({
      enabled: true,
      from: 'v1.2.0',
      to: 'v1.2.1',
      destructiveComponents: ['ApexClass:NewRollbackService'],
      restoreComponents: ['ApexClass:ChangedRollbackService', 'ApexClass:DeletedRollbackService'],
    });
    expect(output.reports?.jsonPath).to.equal(path.join(reportDir, 'deployment-plan.json'));
    expect(report.command.mode).to.equal('dry-run');
    expect(report.command.destructive).to.equal(true);
  });
});

async function createRollbackProject(rootDir: string): Promise<string> {
  const projectRoot = path.join(rootDir, 'rollback-project');
  const classesDir = path.join(projectRoot, 'force-app/main/default/classes');

  await mkdir(classesDir, { recursive: true });
  await writeFile(
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
  await writeFile(path.join(projectRoot, '.forceignore'), '', 'utf8');

  await writeApexClass(
    classesDir,
    'ChangedRollbackService',
    `public class ChangedRollbackService { public static String value() { return 'old'; } }\n`
  );
  await writeApexClass(classesDir, 'DeletedRollbackService', 'public class DeletedRollbackService {}\n');

  await git(projectRoot, 'init');
  await git(projectRoot, 'config', 'user.email', 'qa@example.invalid');
  await git(projectRoot, 'config', 'user.name', 'Smart Deployment QA');
  await commitAll(projectRoot, 'release v1.2.0');
  await git(projectRoot, 'tag', 'v1.2.0');

  await writeApexClass(
    classesDir,
    'ChangedRollbackService',
    `public class ChangedRollbackService { public static String value() { return 'new'; } }\n`
  );
  await writeApexClass(classesDir, 'NewRollbackService', 'public class NewRollbackService {}\n');
  await git(projectRoot, 'rm', 'force-app/main/default/classes/DeletedRollbackService.cls');
  await git(projectRoot, 'rm', 'force-app/main/default/classes/DeletedRollbackService.cls-meta.xml');
  await commitAll(projectRoot, 'release v1.2.1');
  await git(projectRoot, 'tag', 'v1.2.1');
  return projectRoot;
}

async function writeApexClass(classesDir: string, name: string, body: string): Promise<void> {
  await writeFile(path.join(classesDir, `${name}.cls`), body, 'utf8');
  await writeFile(
    path.join(classesDir, `${name}.cls-meta.xml`),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
      '  <apiVersion>61.0</apiVersion>',
      '  <status>Active</status>',
      '</ApexClass>',
      '',
    ].join('\\n'),
    'utf8'
  );
}

async function commitAll(projectRoot: string, message: string): Promise<void> {
  await git(projectRoot, 'add', '.');
  await git(projectRoot, 'commit', '-m', message);
}

async function git(projectRoot: string, ...args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, { cwd: projectRoot });
}
