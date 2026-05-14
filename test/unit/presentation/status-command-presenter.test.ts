import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StatusCommandPresenter } from '../../../src/presentation/status-command-presenter.js';

describe('StatusCommandPresenter', () => {
  it('renders no-state and formatted status output', () => {
    const presenter = new StatusCommandPresenter();
    const logs: string[] = [];
    const io = {
      log: (message: string) => logs.push(message),
    };

    presenter.reportStatus(
      io,
      {
        hasState: false,
        status: 'not-started',
        currentWave: 0,
        totalWaves: 0,
        completedWaves: [],
        remainingWaves: [],
        resumable: false,
        testStatus: 'unknown',
        testStatusText: 'Not started',
        stateFilePath: '.smart-deployment/deployment-state.json',
      },
      'No deployment state found.\nExpected state file: .smart-deployment/deployment-state.json'
    );
    presenter.reportStatus(
      io,
      {
        hasState: true,
        status: 'in-progress',
        deploymentId: 'deploy-456',
        targetOrg: 'test-org',
        currentWave: 3,
        totalWaves: 5,
        completedWaves: [1, 2],
        remainingWaves: [3, 4, 5],
        resumable: false,
        testStatus: 'pending',
        testStatusText: 'Tests run: 12 (1 failures)',
        waveGraph: {
          nodes: [
            {
              waveNumber: 1,
              componentCount: 1,
              components: ['CustomObject:Account'],
              status: 'completed',
            },
            {
              waveNumber: 2,
              componentCount: 1,
              components: ['ApexClass:AccountService'],
              status: 'current',
            },
          ],
          edges: [
            { fromWave: 1, toWave: 2, kind: 'sequence' },
            { fromWave: 1, toWave: 2, kind: 'dependency', dependencyCount: 1 },
          ],
          visualizations: {
            mermaid: 'graph LR',
            dot: 'digraph WaveGraph {}',
          },
        },
        stateFilePath: '.smart-deployment/deployment-state.json',
      },
      'Status: in-progress\nCurrent Wave: 3/5'
    );

    expect(logs).to.deep.equal([
      'ℹ️ No deployment state found.',
      'Status: in-progress',
      'Current Wave: 3/5',
      '',
      'Wave Graph:',
      '  Wave 1 [completed] - 1 component(s)',
      '  Wave 2 [current] - 1 component(s)',
      'Wave Dependencies:',
      '  Wave 1 -> Wave 2 (1 dependency edge(s))',
    ]);
  });
});
