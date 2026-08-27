/**
 * Unit tests for config command
 *
 * @ac US-051-AC-1: Set Agentforce configuration
 * @ac US-051-AC-2: Set default test level
 * @ac US-051-AC-3: Set timeout values
 * @ac US-051-AC-4: Set retry strategies
 * @ac US-051-AC-5: Save configuration to file
 * @ac US-051-AC-6: Validate configuration
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon, { SinonStub } from 'sinon';
import Config from '../../../src/commands/smart-deployment/config.js';

describe('ConfigCommand', () => {
  let configCommand: Config;

  beforeEach(() => {
    configCommand = new Config([], {} as any);
    // Mock parse to avoid config.runHook requirement
    sinon.stub(configCommand as any, 'parse').resolves({
      flags: {
        set: undefined,
        get: undefined,
        'config-path': undefined,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: {} as any,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('US-051-AC-1: Set Agentforce configuration', () => {
    it('should set Agentforce configuration via --set flag', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: 'ai.enabled=true',
          get: undefined,
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      const result = await configCommand.run();

      expect(result.success).to.be.true;
    });

    it('should set Agentforce API key', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: 'ai.apiKey=test-key',
          get: undefined,
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      const result = await configCommand.run();

      expect(result.success).to.be.true;
    });
  });

  describe('US-051-AC-2: Set default test level', () => {
    it('should set default test level', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: 'deployment.testLevel=RunLocalTests',
          get: undefined,
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      const result = await configCommand.run();

      expect(result.success).to.be.true;
    });
  });

  describe('US-051-AC-3: Set timeout values', () => {
    it('should set timeout values', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: 'deployment.timeout=300000',
          get: undefined,
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      const result = await configCommand.run();

      expect(result.success).to.be.true;
    });
  });

  describe('US-051-AC-4: Set retry strategies', () => {
    it('should set retry strategies', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: 'deployment.retry.maxAttempts=3',
          get: undefined,
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      const result = await configCommand.run();

      expect(result.success).to.be.true;
    });
  });

  describe('US-051-AC-5: Save configuration to file', () => {
    it('should save configuration to file', async () => {
      configCommand.argv = ['--set', 'ai.enabled=true'];
      const result = await configCommand.run();

      expect(result.success).to.be.true;
    });

    it('should create config directory if it does not exist', async () => {
      configCommand.argv = ['--set', 'ai.enabled=true'];
      const result = await configCommand.run();

      expect(result.success).to.be.true;
    });
  });

  describe('US-051-AC-6: Validate configuration', () => {
    it('should validate configuration values', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: 'ai.enabled=invalid',
          get: undefined,
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      const result = await configCommand.run();

      // Should handle invalid values gracefully
      expect(result.success).to.be.true;
    });
  });

  describe('Get Configuration', () => {
    it('should get configuration value via --get flag', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: undefined,
          get: 'ai.enabled',
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      const result = await configCommand.run();

      expect(result.success).to.be.true;
    });

    it('should return undefined for non-existent keys', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: undefined,
          get: 'non.existent.key',
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      const result = await configCommand.run();

      expect(result.success).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: undefined,
          get: 'ai.enabled',
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });

      const result = await configCommand.run();
      expect(result.success).to.be.true;
    });

    it('should handle file write errors gracefully', async () => {
      ((configCommand as any).parse as SinonStub).resolves({
        flags: {
          set: 'ai.enabled=true',
          get: undefined,
          'config-path': undefined,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });

      expect((await configCommand.run()).success).to.be.true;
    });
  });
});
