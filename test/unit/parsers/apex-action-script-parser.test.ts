import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { discoverApexActionRules, parseApexActionScript } from '../../../src/parsers/apex-action-script-parser.js';

describe('Apex action script parser', () => {
  it('discovers action scripts and ignores ordinary scripts outside the action root', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'apex-action-parser-'));
    try {
      const scriptRoot = path.join(projectRoot, 'scripts/apex/actions/nested');
      await mkdir(scriptRoot, { recursive: true });
      await writeFile(
        path.join(scriptRoot, 'seed.apex'),
        '// smart-deployment-action: {"id":"seed-data","phase":"after","when":{"components":["CustomObject:Account"]},"description":"Seed records."}\nSystem.debug(\'seed\');\n'
      );
      await mkdir(path.join(projectRoot, 'scripts/apex/library'), { recursive: true });
      await writeFile(path.join(projectRoot, 'scripts/apex/library/ordinary.apex'), "System.debug('ordinary');\n");

      const rules = await discoverApexActionRules(projectRoot);

      expect(rules).to.deep.equal([
        {
          id: 'seed-data',
          phase: 'after',
          when: { components: ['CustomObject:Account'] },
          action: {
            kind: 'apex-anonymous',
            script: 'scripts/apex/actions/nested/seed.apex',
            description: 'Seed records.',
          },
        },
      ]);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('requires a header for every script under the action root', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'apex-action-parser-missing-'));
    try {
      const actionRoot = path.join(projectRoot, 'scripts/apex/actions');
      await mkdir(actionRoot, { recursive: true });
      await writeFile(path.join(actionRoot, 'missing.apex'), "System.debug('missing');\n");
      await expectReject(discoverApexActionRules(projectRoot), 'missing a smart-deployment-action header');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('rejects malformed and duplicate headers', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'apex-action-parser-invalid-'));
    try {
      const filePath = path.join(projectRoot, 'invalid.apex');
      await writeFile(filePath, '// smart-deployment-action: {"id":"broken",}\n');
      await expectReject(parseApexActionScript(filePath, projectRoot), 'Invalid smart-deployment-action JSON');

      await writeFile(
        filePath,
        [
          '// smart-deployment-action: {"id":"one","phase":"after","when":{"types":["Flow"]}}',
          '// smart-deployment-action: {"id":"two","phase":"after","when":{"types":["Flow"]}}',
        ].join('\n')
      );
      await expectReject(parseApexActionScript(filePath, projectRoot), 'multiple');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});

async function expectReject(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
    expect.fail(`Expected rejection containing ${message}`);
  } catch (error) {
    expect(String(error)).to.include(message);
  }
}
