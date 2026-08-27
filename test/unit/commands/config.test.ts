import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sinon, { SinonStub } from 'sinon';
import Config from '../../../src/commands/smart-deployment/config.js';

describe('ConfigCommand', () => {
  let configCommand: Config;
  let directory: string;
  let parseStub: SinonStub;
  const originalCwd = process.cwd();

  const parsedFlags = (flags: Record<string, string | undefined>) => ({
    flags,
    args: {},
    argv: [],
    raw: [],
    metadata: {} as any,
  });

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-deployment-config-'));
    process.chdir(directory);
    await fs.writeFile(
      path.join(directory, '.smart-deployment.json'),
      JSON.stringify({
        $schema: './schemas/config.schema.json',
        version: '1.0',
        ai: { enabled: false, confidenceThreshold: 0.9 },
        deployment: { testLevel: 'RunLocalTests', dryRun: false },
      })
    );
    configCommand = new Config([], {} as any);
    parseStub = sinon.stub(configCommand as any, 'parse').resolves(parsedFlags({ set: undefined, get: undefined }));
  });

  afterEach(async () => {
    sinon.restore();
    process.chdir(originalCwd);
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('persists a typed value with --set', async () => {
    parseStub.resolves(parsedFlags({ set: 'deployment.dryRun=true', get: undefined }));

    const result = await configCommand.run();
    const saved = JSON.parse(await fs.readFile(path.join(directory, '.smart-deployment.json'), 'utf8')) as any;

    expect(result.success).to.equal(true);
    expect(saved.deployment.dryRun).to.equal(true);
  });

  it('supports compatible keys that are not in older config files', async () => {
    parseStub.resolves(parsedFlags({ set: 'deployment.timeout=60000', get: undefined }));

    await configCommand.run();
    const saved = JSON.parse(await fs.readFile(path.join(directory, '.smart-deployment.json'), 'utf8')) as any;

    expect(saved.deployment.timeout).to.equal(60000);
  });

  it('prints a value with --get', async () => {
    parseStub.resolves(parsedFlags({ set: undefined, get: 'deployment.testLevel' }));
    const logStub = sinon.stub(configCommand, 'log');

    const result = await configCommand.run();

    expect(result.success).to.equal(true);
    expect(logStub.calledWith('RunLocalTests')).to.equal(true);
  });

  it('rejects invalid values', async () => {
    parseStub.resolves(parsedFlags({ set: 'deployment.dryRun=invalid', get: undefined }));

    try {
      await configCommand.run();
      expect.fail('expected invalid value error');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.contain("Invalid value for 'deployment.dryRun'");
    }
  });

  it('rejects unknown keys and missing keys', async () => {
    parseStub.resolves(parsedFlags({ set: 'deployment.notConfigured=true', get: undefined }));
    await expectRejected(() => configCommand.run(), 'Unknown configuration key');

    parseStub.resolves(parsedFlags({ set: undefined, get: 'deployment.notConfigured' }));
    await expectRejected(() => configCommand.run(), 'Configuration key not found');
  });

  it('rejects removed AI configuration keys', async () => {
    parseStub.resolves(parsedFlags({ set: 'ai.enabled=true', get: undefined }));
    await expectRejected(() => configCommand.run(), "Unknown configuration key 'ai.enabled'");
  });

  it('reports malformed or unreadable configuration files', async () => {
    await fs.writeFile(path.join(directory, '.smart-deployment.json'), '{invalid');
    parseStub.resolves(parsedFlags({ set: undefined, get: 'deployment.dryRun' }));
    await expectRejected(() => configCommand.run(), 'Invalid JSON');

    await fs.rm(path.join(directory, '.smart-deployment.json'));
    await expectRejected(() => configCommand.run(), 'Configuration file not found');
  });
});

async function expectRejected(action: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await action();
    expect.fail(`expected error containing ${message}`);
  } catch (error) {
    expect((error as Error).message).to.contain(message);
  }
}
