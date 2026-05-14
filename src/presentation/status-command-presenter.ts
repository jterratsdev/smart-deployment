import type { DeploymentStatusSummary } from '../deployment/deployment-status-service.js';

export type StatusPresenterIO = {
  log: (message: string) => void;
};

export class StatusCommandPresenter {
  public reportStatus(io: StatusPresenterIO, summary: DeploymentStatusSummary, formattedStatus: string): void {
    if (!summary.hasState) {
      io.log('ℹ️ No deployment state found.');
      return;
    }

    formattedStatus.split('\n').forEach((line) => {
      if (line.startsWith('Test Status: ')) {
        io.log(`Test Status: ${summary.testStatusText}`);
        return;
      }

      io.log(line);
    });

    if (summary.waveGraph) {
      this.reportWaveGraph(io, summary);
    }
  }

  private reportWaveGraph(io: StatusPresenterIO, summary: DeploymentStatusSummary): void {
    if (!summary.waveGraph) {
      return;
    }

    io.log('');
    io.log('Wave Graph:');
    for (const node of summary.waveGraph.nodes) {
      io.log(`  Wave ${node.waveNumber} [${node.status}] - ${node.componentCount} component(s)`);
    }

    const dependencyEdges = summary.waveGraph.edges.filter((edge) => edge.kind === 'dependency');
    if (dependencyEdges.length > 0) {
      io.log('Wave Dependencies:');
      for (const edge of dependencyEdges) {
        io.log(`  Wave ${edge.fromWave} -> Wave ${edge.toWave} (${edge.dependencyCount ?? 0} dependency edge(s))`);
      }
    }
  }
}
