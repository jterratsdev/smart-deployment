import { expect } from 'chai';
import { describe, it } from 'mocha';
import { validateRepoConfig } from '../../../src/config/repo-config.js';

describe('wave action repo config', () => {
  it('accepts a project-relative anonymous Apex action', () => {
    expect(() =>
      validateRepoConfig({
        waveActions: [
          {
            id: 'seed-data',
            phase: 'after',
            when: { components: ['CustomObject:Account'] },
            action: { kind: 'apex-anonymous', script: 'scripts/apex/seed.apex' },
          },
        ],
      })
    ).to.not.throw();
  });

  it('rejects unsafe script paths and selector-free rules', () => {
    expect(() =>
      validateRepoConfig({
        waveActions: [
          {
            id: 'unsafe',
            phase: 'after',
            when: { types: ['ApexClass'] },
            action: { kind: 'apex-anonymous', script: '../outside.apex' },
          },
        ],
      })
    ).to.throw('project-relative path');

    expect(() =>
      validateRepoConfig({
        waveActions: [
          {
            id: 'no-selector',
            phase: 'before',
            when: {},
            action: { kind: 'manual', instruction: 'Do something.' },
          },
        ],
      })
    ).to.throw('select at least one component or metadata type');
  });

  it('rejects malformed script hashes', () => {
    expect(() =>
      validateRepoConfig({
        waveActions: [
          {
            id: 'bad-hash',
            phase: 'after',
            when: { types: ['ApexClass'] },
            action: { kind: 'apex-anonymous', script: 'scripts/apex/seed.apex', sha256: 'not-a-hash' },
          },
        ],
      })
    ).to.throw('64-character hexadecimal hash');
  });
});
