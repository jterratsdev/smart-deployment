import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { cleanupNutContexts, createNutContext, execNutCommand, parseJsonStdout } from './helpers/nut-helpers.js';

const execFileAsync = promisify(execFile);

type CiPresetJson = {
  success: boolean;
  artifacts: {
    jsonPath: string;
    reportDir: string;
  };
  summary: {
    components: number;
    waves: number;
  };
};

type DeploymentPlanReport = {
  summary: {
    components: number;
  };
  waves: Array<{
    components: Array<{
      id: string;
    }>;
  }>;
};

describe('NUT: commit-scoped deployments', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await cleanupNutContexts(tempDirs);
  });

  it('plans only scoped commit metadata and required dependencies from a story manifest', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const fixture = await createCommitScopedProject(tempDir);
    const reportDir = path.join(tempDir, 'reports');

    const result = execNutCommand<CiPresetJson>(
      [
        'ci preset',
        `--source-path ${fixture.projectRoot}`,
        `--scope-manifest ${fixture.manifestPath}`,
        '--validation-mode local-only',
        `--report-dir ${reportDir}`,
        '--json',
      ].join(' '),
      homeDir
    );
    const output = parseJsonStdout<CiPresetJson>(result.shellOutput.stdout);
    const report = JSON.parse(await readFile(output.artifacts.jsonPath, 'utf8')) as DeploymentPlanReport;
    const plannedComponentIds = report.waves.flatMap((wave) => wave.components.map((component) => component.id)).sort();

    expect(output.success).to.equal(true);
    expect(output.artifacts.reportDir).to.equal(reportDir);
    expect(output.summary.components).to.equal(2);
    expect(output.summary.waves).to.be.greaterThan(0);
    expect(report.summary.components).to.equal(2);
    expect(plannedComponentIds).to.deep.equal(['ApexClass:ScopedDependency', 'ApexClass:ScopedService']);
    expect(plannedComponentIds).to.include('ApexClass:ScopedDependency');
    expect(plannedComponentIds).to.not.include('ApexClass:FutureTrunkWork');
    expect(plannedComponentIds).to.not.include('ApexClass:DeletedCandidate');
    expect(await readFile(fixture.scopedServicePath, 'utf8')).to.include('ScopedDependency.touch();');

    let deletedSourceExists = true;
    try {
      await access(fixture.deletedCandidatePath, fsConstants.F_OK);
    } catch {
      deletedSourceExists = false;
    }

    expect(deletedSourceExists).to.equal(false);
  });
});

async function createCommitScopedProject(rootDir: string): Promise<{
  projectRoot: string;
  manifestPath: string;
  scopedServicePath: string;
  deletedCandidatePath: string;
}> {
  const projectRoot = path.join(rootDir, 'commit-scoped-project');
  const classesDir = path.join(projectRoot, 'force-app/main/default/classes');
  const manifestsDir = path.join(projectRoot, 'manifests');
  const scopedServicePath = path.join(classesDir, 'ScopedService.cls');
  const deletedCandidatePath = path.join(classesDir, 'DeletedCandidate.cls');
  const manifestPath = path.join(manifestsDir, 'story-scope.json');

  await mkdir(classesDir, { recursive: true });
  await mkdir(manifestsDir, { recursive: true });
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
    'ScopedDependency',
    ['public class ScopedDependency {', '  public static void touch() {}', '}', ''].join('\n')
  );

  await git(projectRoot, 'init');
  await git(projectRoot, 'config', 'user.email', 'qa@example.invalid');
  await git(projectRoot, 'config', 'user.name', 'Smart Deployment QA');
  await commitAll(projectRoot, 'baseline dependency');

  await writeApexClass(
    classesDir,
    'ScopedService',
    [
      'public class ScopedService {',
      '  public static void run() {',
      '    ScopedDependency.touch();',
      '  }',
      '}',
      '',
    ].join('\n')
  );
  const scopedCommit = await commitAll(projectRoot, 'add scoped service');

  await writeApexClass(classesDir, 'FutureTrunkWork', 'public class FutureTrunkWork {}\n');
  await commitAll(projectRoot, 'add unrelated trunk work');

  await writeApexClass(classesDir, 'DeletedCandidate', 'public class DeletedCandidate {}\n');
  await commitAll(projectRoot, 'add deleted candidate');
  await git(projectRoot, 'rm', 'force-app/main/default/classes/DeletedCandidate.cls');
  await git(projectRoot, 'rm', 'force-app/main/default/classes/DeletedCandidate.cls-meta.xml');
  const deleteCommit = await commitAll(projectRoot, 'delete candidate from scoped story');

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        stories: [
          {
            id: 'PLUGIN-COMMIT-SCOPED-DEPLOYMENTS',
            commits: [scopedCommit, deleteCommit],
          },
        ],
      },
      null,
      2
    ),
    'utf8'
  );

  return {
    projectRoot,
    manifestPath,
    scopedServicePath,
    deletedCandidatePath,
  };
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
    ].join('\n'),
    'utf8'
  );
}

async function commitAll(projectRoot: string, message: string): Promise<string> {
  await git(projectRoot, 'add', '.');
  await git(projectRoot, 'commit', '-m', message);
  const { stdout } = await git(projectRoot, 'rev-parse', 'HEAD');
  return stdout.trim();
}

async function git(projectRoot: string, ...args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, { cwd: projectRoot });
}
