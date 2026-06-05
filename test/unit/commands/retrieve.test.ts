import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import Retrieve from '../../../src/commands/retrieve.js';
import { RetrieveForceIgnoreService } from '../../../src/deployment/retrieve-forceignore-service.js';
import type { RetrieveForceIgnoreOptions } from '../../../src/deployment/retrieve-forceignore-service.js';

type ParseResult = {
  flags: Record<string, unknown>;
  args: Record<string, unknown>;
  argv: string[];
  raw: unknown[];
  metadata: {
    flags: Record<string, unknown>;
    args: Record<string, unknown>;
  };
  nonExistentFlags: string[];
  _runtime: unknown;
};

type RetrieveCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
  error: (message: string) => never;
  jsonEnabled: () => boolean;
};

describe('RetrieveCommand', () => {
  const originalRetrieve = Object.getOwnPropertyDescriptor(RetrieveForceIgnoreService.prototype, 'retrieve')
    ?.value as typeof RetrieveForceIgnoreService.prototype.retrieve;

  afterEach(() => {
    Object.defineProperty(RetrieveForceIgnoreService.prototype, 'retrieve', {
      value: originalRetrieve,
      writable: true,
    });
  });

  it('passes retrieve forceignore flags to the service', async () => {
    const receivedOptions: RetrieveForceIgnoreOptions[] = [];
    RetrieveForceIgnoreService.prototype.retrieve = async function retrieveMock(options) {
      if (options === undefined) {
        throw new Error('Expected retrieve options');
      }
      receivedOptions.push(options);
      return {
        success: true,
        projectRoot: '/project',
        retrieveOutput: '{"status":0}',
        changedPaths: ['force-app/main/default/lwc/app/app.js'],
        protectedPaths: [],
        restoredPaths: [],
        normalizedPaths: [],
        strictViolation: false,
        architecturalConcerns: { inherited: [], selfImposed: [] },
      };
    };
    const command = new Retrieve([], {} as never);
    const logs: string[] = [];
    (command as unknown as RetrieveCommandTestDouble).parse = async () => ({
      flags: {
        'source-path': '/project',
        'target-org': 'dev-org',
        metadata: 'DigitalExperienceBundle:site/PHP_Portal1,LightningComponentBundle:app',
        manifest: '/project/package.xml',
        wait: 10,
        'strict-ignore': true,
        'normalize-meta': true,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as RetrieveCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };
    (command as unknown as RetrieveCommandTestDouble).jsonEnabled = () => false;

    const result = await command.run();

    expect(result.success).to.equal(true);
    const options = receivedOptions[0];
    if (options === undefined) {
      throw new Error('Expected retrieve options to be captured');
    }
    expect(options).to.deep.equal({
      projectRoot: '/project',
      targetOrg: 'dev-org',
      metadata: ['DigitalExperienceBundle:site/PHP_Portal1', 'LightningComponentBundle:app'],
      manifest: '/project/package.xml',
      wait: 10,
      strictIgnore: true,
      normalizeMeta: true,
    });
    expect(logs.join('\n')).to.include('Smart deployment retrieve');
  });

  it('fails the command when strict ignore detects protected paths', async () => {
    RetrieveForceIgnoreService.prototype.retrieve = async function retrieveMock() {
      return {
        success: false,
        projectRoot: '/project',
        retrieveOutput: '{"status":0}',
        changedPaths: ['force-app/main/default/lwc/secret/secret.js'],
        protectedPaths: ['force-app/main/default/lwc/secret/secret.js'],
        restoredPaths: ['force-app/main/default/lwc/secret/secret.js'],
        normalizedPaths: [],
        strictViolation: true,
        architecturalConcerns: { inherited: [], selfImposed: [] },
      };
    };
    const command = new Retrieve([], {} as never);
    (command as unknown as RetrieveCommandTestDouble).parse = async () => ({
      flags: { metadata: 'LightningComponentBundle:secret', 'strict-ignore': true },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as RetrieveCommandTestDouble).log = () => undefined;
    (command as unknown as RetrieveCommandTestDouble).jsonEnabled = () => false;
    (command as unknown as RetrieveCommandTestDouble).error = (message: string): never => {
      throw new Error(message);
    };

    try {
      await command.run();
      throw new Error('Expected retrieve command to fail');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.include('forceignore-protected path');
    }
  });
});
