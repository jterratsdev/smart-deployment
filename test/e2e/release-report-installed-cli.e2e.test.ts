import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';

const execFileAsync = promisify(execFile);

type InstalledCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type ValidateOutput = {
  success: boolean;
  releaseReport?: {
    analysisMode: string;
    enrichment: { status: string };
    outcome: string;
  };
  releaseReportPath?: string;
  releaseReportWarning?: string;
};

describe('E2E: installed CLI release reports', function () {
  this.timeout(180_000);

  let suiteRoot: string;
  let isolatedHome: string;
  let npmCache: string;
  let realSfPath: string;

  before(async function () {
    suiteRoot = await mkdtemp(path.join(os.tmpdir(), 'smart-deployment-installed-e2e-'));
    isolatedHome = path.join(suiteRoot, 'home');
    npmCache = path.join(suiteRoot, 'npm-cache');
    try {
      realSfPath = (await execFileAsync('/usr/bin/which', ['sf'])).stdout.trim();
    } catch {
      this.skip();
      return;
    }

    await execFileAsync('npm', ['run', 'build'], {
      cwd: process.cwd(),
      env: installedEnvironment(),
      maxBuffer: 10 * 1024 * 1024,
    });
    const packed = await execFileAsync('npm', ['pack', '--ignore-scripts', '--pack-destination', suiteRoot, '--json'], {
      cwd: process.cwd(),
      env: installedEnvironment(),
      maxBuffer: 10 * 1024 * 1024,
    });
    const tarballName = (JSON.parse(packed.stdout) as Array<{ filename: string }>)[0]?.filename;
    if (!tarballName) throw new Error('npm pack did not return a plugin tarball.');
    const tarballUri = `file:${path.join(suiteRoot, tarballName)}`;
    const allowList = `${JSON.stringify(['@jterrats/smart-deployment', tarballUri], null, 2)}\n`;
    await Promise.all(
      ['sf', 'sfdx'].map(async (configDirectory) => {
        const directory = path.join(isolatedHome, '.config', configDirectory);
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, 'unsignedPluginAllowList.json'), allowList, 'utf8');
      })
    );

    await execFileAsync(realSfPath, ['plugins', 'install', tarballUri, '--force', '--silent', '--json'], {
      cwd: suiteRoot,
      env: installedEnvironment(),
      maxBuffer: 10 * 1024 * 1024,
    });
  });

  after(async () => {
    await rm(suiteRoot, { recursive: true, force: true });
  });

  it('keeps unavailable AI deterministic and non-blocking', async () => {
    const projectRoot = await createProject('ai-unavailable');
    await writeFile(
      path.join(projectRoot, '.smart-deployment.json'),
      `${JSON.stringify({ llm: { provider: 'openai', model: 'gpt-4o-mini' } }, null, 2)}\n`,
      'utf8'
    );

    const result = await runInstalled([
      'smart-deployment',
      'validate',
      '--source-path',
      projectRoot,
      '--use-ai',
      '--json',
    ]);
    const output = parseSfResult<ValidateOutput>(result.stdout);

    expect(result.exitCode).to.equal(0);
    expect(output.success).to.equal(true);
    expect(output.releaseReport?.analysisMode).to.equal('deterministic');
    expect(output.releaseReport?.enrichment.status).to.be.oneOf(['unavailable', 'partial']);
    expect(output.releaseReport?.outcome).to.equal('succeeded');
    expect(await readReport(output.releaseReportPath)).to.deep.equal(output.releaseReport);
  });

  it('writes a failed report before retaining an underlying ci-publish failure', async () => {
    const projectRoot = await createProject(
      'publish-failure',
      {
        'force-app/main/default/aiAuthoringBundles/SupportAgent/SupportAgent.aiAuthoringBundle':
          '{"name":"SupportAgent"}\n',
      },
      false
    );
    const fakeBin = path.join(suiteRoot, 'fake-sf-bin');
    const fakeSfPath = path.join(fakeBin, 'sf');
    await mkdir(fakeBin, { recursive: true });
    await writeFile(
      fakeSfPath,
      ['#!/bin/sh', 'echo "simulated Agentforce publish failure" >&2', 'exit 7', ''].join('\n'),
      'utf8'
    );
    await chmod(fakeSfPath, 0o755);

    const result = await runInstalled(
      ['smart-deployment', 'ci-publish', '--source-path', projectRoot, '--no-dry-run', '--json'],
      {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}`,
      }
    );
    const report = JSON.parse(
      await readFile(path.join(projectRoot, '.smart-deployment', 'reports', 'release-report.json'), 'utf8')
    ) as { outcome: string; phases: Array<{ id: string; status: string }> };

    expect(result.exitCode).to.not.equal(0);
    expect(`${result.stdout}\n${result.stderr}`).to.include('simulated Agentforce publish failure');
    expect(report.outcome).to.equal('failed');
    expect(report.phases.find((phase) => phase.id === 'agentforce-publish')?.status).to.equal('failed');
  });

  it('warns but preserves success when report persistence is unavailable', async () => {
    const projectRoot = await createProject('report-unavailable');
    const reportsPath = path.join(projectRoot, '.smart-deployment', 'reports');
    await mkdir(path.dirname(reportsPath), { recursive: true });
    await writeFile(reportsPath, 'blocks report directory creation\n', 'utf8');

    const result = await runInstalled(['smart-deployment', 'validate', '--source-path', projectRoot, '--json']);
    const output = parseSfResult<ValidateOutput>(result.stdout);

    expect(result.exitCode).to.equal(0);
    expect(output.success).to.equal(true);
    expect(output.releaseReport?.outcome).to.equal('succeeded');
    expect(output.releaseReportPath).to.equal(undefined);
    expect(output.releaseReportWarning).to.include('persistence is unavailable');
    expect(await readFile(reportsPath, 'utf8')).to.equal('blocks report directory creation\n');
  });

  async function createProject(
    name: string,
    extraFiles: Record<string, string> = {},
    includeCoreFixture = true
  ): Promise<string> {
    const projectRoot = path.join(suiteRoot, name);
    const files: Record<string, string> = {
      ...(includeCoreFixture
        ? {
            'force-app/main/default/classes/InstalledFixture.cls': 'public class InstalledFixture {}\n',
            'force-app/main/default/classes/InstalledFixture.cls-meta.xml': [
              '<?xml version="1.0" encoding="UTF-8"?>',
              '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
              '  <apiVersion>61.0</apiVersion>',
              '  <status>Active</status>',
              '</ApexClass>',
              '',
            ].join('\n'),
          }
        : {}),
      ...extraFiles,
    };

    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      path.join(projectRoot, 'sfdx-project.json'),
      `${JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '61.0',
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await writeFile(path.join(projectRoot, '.forceignore'), '', 'utf8');
    await Promise.all(
      Object.entries(files).map(async ([relativePath, contents]) => {
        const filePath = path.join(projectRoot, relativePath);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, contents, 'utf8');
      })
    );
    return projectRoot;
  }

  async function runInstalled(
    args: string[],
    environment: Record<string, string | undefined> = {}
  ): Promise<InstalledCommandResult> {
    try {
      const result = await execFileAsync(realSfPath, args, {
        cwd: suiteRoot,
        env: installedEnvironment(environment),
        maxBuffer: 10 * 1024 * 1024,
      });
      return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      const failure = error as Error & { code?: number; stdout?: string; stderr?: string };
      return {
        exitCode: typeof failure.code === 'number' ? failure.code : 1,
        stdout: failure.stdout ?? '',
        stderr: failure.stderr ?? failure.message,
      };
    }
  }

  function installedEnvironment(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
    return {
      ...process.env,
      HOME: isolatedHome,
      ['npm_config_cache']: npmCache,
      OPENAI_API_KEY: '',
      AGENTFORCE_ACCESS_TOKEN: '',
      SF_DISABLE_TELEMETRY: 'true',
      ...overrides,
    };
  }
});

function parseSfResult<T>(stdout: string): T {
  const candidates = [0];
  for (let index = 0; index < stdout.length - 1; index += 1) {
    if (stdout[index] === '\n' && stdout[index + 1] === '{') candidates.push(index + 1);
  }

  for (const start of candidates.reverse()) {
    try {
      const parsed = JSON.parse(stdout.slice(start).trim()) as { result?: T };
      return parsed.result ?? (parsed as T);
    } catch {
      continue;
    }
  }

  throw new Error(`Installed CLI did not emit a parseable final JSON result:\n${stdout}`);
}

async function readReport(reportPath: string | undefined): Promise<unknown> {
  if (!reportPath) throw new Error('Installed CLI did not return a release report path.');
  return JSON.parse(await readFile(reportPath, 'utf8')) as unknown;
}
