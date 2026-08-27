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
import Status, { watchDeployment } from '../../../src/commands/smart-deployment/status.js';
import type { DeploymentState } from '../../../src/deployment/state-manager.js';
import type { DeploymentResult } from '../../../src/deployment/sf-cli-integration.js';
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
      trackerStub.returns(undefined);
      stateManagerStub.onFirstCall().resolves({
        status: 'deploying',
        deploymentId: 'test-deployment-123',
        targetOrg: 'test-org',
        timestamp: new Date().toISOString(),
        totalWaves: 5,
        completedWaves: [1, 2],
        currentWave: 3,
      });
      stateManagerStub.onSecondCall().resolves({
        status: 'completed',
        deploymentId: 'test-deployment-123',
        targetOrg: 'test-org',
        timestamp: new Date().toISOString(),
        totalWaves: 5,
        completedWaves: [1, 2, 3, 4, 5],
        currentWave: 5,
      });
      const result = await statusCommand.run();
      expect(result).to.have.property('currentWave');
    });

    it('polls until Salesforce reports a terminal result', async () => {
      const states: DeploymentState[] = [
        {
          status: 'deploying',
          deploymentId: 'deployment-1',
          targetOrg: 'test-org',
          timestamp: new Date().toISOString(),
          totalWaves: 1,
          completedWaves: [],
          currentWave: 1,
        },
        {
          status: 'completed',
          deploymentId: 'deployment-1',
          targetOrg: 'test-org',
          timestamp: new Date().toISOString(),
          totalWaves: 1,
          completedWaves: [1],
          currentWave: 1,
        },
      ];
      const result: DeploymentResult = {
        success: true,
        deploymentId: 'deployment-1-wave-1',
        status: 'Succeeded',
        componentSuccesses: 2,
        componentFailures: 0,
        testsRun: 7,
        testFailures: 1,
        output: '',
      };
      const updates: Array<DeploymentResult | undefined> = [];
      const check = sinon.stub().resolves(result);
      const wait = sinon.stub().callsFake(async () => {
        states.shift();
      });

      const finalState = await watchDeployment({
        loadState: async () => states[0] ?? null,
        getProgress: () => undefined,
        checkDeploymentStatus: check,
        onUpdate: (_state, _progress, updateResult) => updates.push(updateResult),
        intervalMs: 1,
        sleep: wait,
      });

      expect(finalState?.status).to.equal('completed');
      expect(check.calledOnceWith('deployment-1-wave-1', 'test-org')).to.be.true;
      expect(updates[0]?.testsRun).to.equal(7);
    });

    it('stops cleanly when interrupted', async () => {
      const controller = new AbortController();
      const wait = sinon.stub().callsFake(async () => controller.abort());
      const state: DeploymentState = {
        status: 'deploying',
        deploymentId: 'deployment-1',
        targetOrg: 'test-org',
        timestamp: new Date().toISOString(),
        totalWaves: 1,
        completedWaves: [],
        currentWave: 1,
      };

      const finalState = await watchDeployment({
        loadState: async () => state,
        getProgress: () => undefined,
        checkDeploymentStatus: sinon.stub().resolves({
          success: true,
          status: 'InProgress',
          componentSuccesses: 0,
          componentFailures: 0,
          output: '',
        }),
        onUpdate: () => undefined,
        signal: controller.signal,
        sleep: wait,
      });

      expect(finalState).to.equal(state);
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
