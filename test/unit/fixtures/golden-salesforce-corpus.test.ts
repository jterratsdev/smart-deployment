import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyGraphBuilder } from '../../../src/dependencies/dependency-graph-builder.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';
import { WaveBuilder, type WaveResult } from '../../../src/waves/wave-builder.js';
import { GOLDEN_SALESFORCE_CORPUS, type GoldenSalesforceFixture } from '../../fixtures/golden-salesforce-corpus.js';

describe('Golden Salesforce regression corpus', () => {
  for (const fixture of GOLDEN_SALESFORCE_CORPUS) {
    it(`keeps dependency and wave snapshots stable for ${fixture.id}`, () => {
      const graph = buildDependencyGraph(fixture);
      const waves = new WaveBuilder({ dependencyEdges: graph.edges }).generateWaves(graph.graph);

      expect(snapshotFixture(fixture, graph, waves)).to.deep.equal({
        id: fixture.id,
        intent: fixture.intent,
        regressionRisk: fixture.regressionRisk,
        components: fixture.expected.components,
        dependencies: fixture.expected.dependencies,
        waves: fixture.expected.waves,
      });
    });
  }
});

function buildDependencyGraph(fixture: GoldenSalesforceFixture): DependencyAnalysisResult {
  const builder = new DependencyGraphBuilder();
  fixture.components.forEach((component) => builder.addComponent(component));
  return builder.build();
}

function snapshotFixture(
  fixture: GoldenSalesforceFixture,
  graph: DependencyAnalysisResult,
  waves: WaveResult
): GoldenSalesforceSnapshot {
  return {
    id: fixture.id,
    intent: fixture.intent,
    regressionRisk: fixture.regressionRisk,
    components: [...graph.components.keys()].sort(),
    dependencies: graph.edges
      .map((edge) => ({ from: edge.from, to: edge.to, kind: edge.type }))
      .sort((left, right) => `${left.from}->${left.to}`.localeCompare(`${right.from}->${right.to}`)),
    waves: waves.waves.map((wave) => [...wave.components].sort()),
  };
}

type GoldenSalesforceSnapshot = {
  id: string;
  intent: string;
  regressionRisk: string;
  components: string[];
  dependencies: Array<{ from: string; to: string; kind: string }>;
  waves: string[][];
};
