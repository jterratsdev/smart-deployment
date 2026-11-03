import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { cleanupNutContexts, createNutContext, execNutCommand } from './helpers/nut-helpers.js';

describe('NUT: Smart Deployment root help', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await cleanupNutContexts(tempDirs);
  });

  it('resolves the root command and preserves subcommand help', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);

    const root = execNutCommand('smart-deployment --help', homeDir);
    expect(root.shellOutput.stdout).to.include('smart-deployment');
    expect(root.shellOutput.stdout).to.include('start');
    expect(root.shellOutput.stdout).to.include('analyze');
    expect(root.shellOutput.stderr).not.to.include('Command smart-deployment not found');

    const start = execNutCommand('smart-deployment start --help', homeDir);
    expect(start.shellOutput.stdout).to.include('--target-org');
  });
});
