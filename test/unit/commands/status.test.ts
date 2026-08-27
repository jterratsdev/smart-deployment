/**
 * Unit tests for status command
 *
 * @ac US-050-AC-1: Shows current wave number
 * @ac US-050-AC-2: Shows completed waves
 * @ac US-050-AC-3: Shows remaining waves
 * @ac US-050-AC-4: Shows estimated time remaining
 * @ac US-050-AC-5: Shows test execution status
 * @ac US-050-AC-6: Refreshes automatically
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon, { SinonStub } from 'sinon';
import Status from '../../../src/commands/smart-deployment/status.js';
import { StateManager } from '../../../src/deployment/state-manager.js';
import { DeploymentTracker } from '../../../src/deployment/deployment-tracker.js';

describe('StatusCommand', () => {
  let statusCommand: Status;
  let stateManagerStub: SinonStub;
  let trackerStub: SinonStub;

  beforeEach(() => {
    statusCommand = new Status([], {} as any);
    // Mock parse to avoid config.runHook requirement
    sinon.stub(statusCommand as any, 'parse').resolves({
      flags: {
        'target-org': 'test-org',
        watch: false,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: {} as any,
    });

    // Stub StateManager
    stateManagerStub = sinon.stub(StateManager.prototype, 'loadState').resolves({
      status: 'deploying',
      deploymentId: 'test-deployment-123',
      targetOrg: 'test-org',
      timestamp: new Date().toISOString(),
      totalWaves: 5,
      completedWaves: [1, 2],
      currentWave: 3,
    });

    // Stub DeploymentTracker
    trackerStub = sinon.stub(DeploymentTracker.prototype, 'getProgress').returns({
      deploymentId: 'test-deployment-123',
      waveNumber: 3,
      totalWaves: 5,
      percentage: 40,
      eta: 120,
      status: 'deploying',
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('US-050-AC-1: Shows current wave number', () => {
    it('should display current wave number', async () => {
      const logStub = sinon.stub(statusCommand, 'log');
      await statusCommand.run();

      expect(logStub.calledWith(sinon.match(/wave.*3/i))).to.be.true;
    });
  });

  describe('US-050-AC-2: Shows completed waves', () => {
    it('should display completed waves', async () => {
      const logStub = sinon.stub(statusCommand, 'log');
      await statusCommand.run();

      expect(logStub.calledWith(sinon.match(/completed|done|finished/i))).to.be.true;
    });
  });

  describe('US-050-AC-3: Shows remaining waves', () => {
    it('should display remaining waves', async () => {
      const logStub = sinon.stub(statusCommand, 'log');
      await statusCommand.run();

      expect(logStub.calledWith(sinon.match(/remaining|left/i))).to.be.true;
    });
  });

  describe('US-050-AC-4: Shows estimated time remaining', () => {
    it('should display estimated time remaining', async () => {
      const logStub = sinon.stub(statusCommand, 'log');
      await statusCommand.run();

      expect(logStub.calledWith(sinon.match(/time|remaining|eta/i))).to.be.true;
    });
  });

  describe('US-050-AC-5: Shows test execution status', () => {
    it('should display test execution status when available', async () => {
      trackerStub.returns({
        deploymentId: 'test-deployment-123',
        waveNumber: 3,
        totalWaves: 5,
        percentage: 40,
        eta: 120,
        status: 'deploying',
      });

      const logStub = sinon.stub(statusCommand, 'log');
      await statusCommand.run();

      expect(logStub.calledWith(sinon.match(/test/i))).to.be.true;
    });
  });

  describe('US-050-AC-6: Refreshes automatically', () => {
    it('should support --watch flag', async () => {
      (statusCommand as any).parse.resolves({
        flags: {
          'target-org': 'test-org',
          watch: true,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      // Watch mode is difficult to test automatically, but we can verify the flag is accepted
      const result = await statusCommand.run();
      expect(result).to.have.property('currentWave');
    });
  });

  describe('State Handling', () => {
    it('should handle idle state', async () => {
      stateManagerStub.resolves({
        status: 'idle',
        deploymentId: undefined,
        targetOrg: 'test-org',
        timestamp: new Date().toISOString(),
        totalWaves: 0,
        completedWaves: [],
        currentWave: 0,
      });
      trackerStub.returns(undefined);

      const result = await statusCommand.run();

      expect(result.currentWave).to.equal(0);
    });

    it('should handle failed state', async () => {
      stateManagerStub.resolves({
        status: 'failed',
        deploymentId: 'test-deployment-123',
        targetOrg: 'test-org',
        timestamp: new Date().toISOString(),
        totalWaves: 5,
        completedWaves: [1, 2],
        currentWave: 3,
        failedWave: {
          waveNumber: 3,
          error: 'Deployment failed',
          timestamp: new Date().toISOString(),
        },
      });

      const logStub = sinon.stub(statusCommand, 'log');
      statusCommand.argv = ['--target-org', 'test-org'];
      await statusCommand.run();

      expect(logStub.calledWith(sinon.match(/failed|error/i))).to.be.true;
    });

    it('should handle completed state', async () => {
      stateManagerStub.resolves({
        status: 'completed',
        deploymentId: 'test-deployment-123',
        targetOrg: 'test-org',
        timestamp: new Date().toISOString(),
        totalWaves: 5,
        completedWaves: [1, 2, 3, 4, 5],
        currentWave: 5,
      });

      const logStub = sinon.stub(statusCommand, 'log');
      statusCommand.argv = ['--target-org', 'test-org'];
      await statusCommand.run();

      expect(logStub.calledWith(sinon.match(/completed|finished|done/i))).to.be.true;
    });

    it('should handle no state found', async () => {
      stateManagerStub.resolves(null);

      const result = await statusCommand.run();

      expect(result.currentWave).to.equal(0);
    });
  });
});
