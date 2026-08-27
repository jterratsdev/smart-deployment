import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyAvailabilityAnalyzer } from '../../../src/dependencies/dependency-availability-analyzer.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

function component(name: string, dependencies: string[]): MetadataComponent {
  return {
    name,
    type: name.startsWith('Flow') ? 'Flow' : 'ApexClass',
    filePath: `${name}.xml`,
    dependencies: new Set(dependencies),
    dependents: new Set(),
    priorityBoost: 0,
  } as MetadataComponent;
}

function wave(number: number, ...components: string[]): Wave {
  return {
    number,
    components,
    metadata: {
      componentCount: components.length,
      types: [],
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: 0,
    },
  };
}

describe('DependencyAvailabilityAnalyzer', () => {
  it('does not simplify a dependency in the same wave', () => {
    const apex = 'ApexClass:Action';
    const flow = 'Flow:Parent';
    const waves = [wave(1, apex, flow)];
    const analyzer = new DependencyAvailabilityAnalyzer(
      new Map([
        [apex, component('Action', [])],
        [flow, component('FlowParent', [apex])],
      ])
    );

    const assessment = analyzer.assess(flow, waves[0], waves)[0];

    expect(assessment.availability).to.equal('available-same-wave');
    expect(assessment.canSimplify).to.equal(false);
  });

  it('keeps previous-wave dependencies available', () => {
    const apex = 'ApexClass:Action';
    const subflow = 'Flow:Subflow';
    const parent = 'Flow:Parent';
    const waves = [wave(1, apex), wave(2, subflow), wave(3, parent)];
    const analyzer = new DependencyAvailabilityAnalyzer(
      new Map([
        [apex, component('Action', [])],
        [subflow, component('FlowSubflow', [])],
        [parent, component('FlowParent', [apex, subflow])],
      ])
    );

    expect(analyzer.unavailableDependencies(parent, waves[2], waves)).to.deep.equal([]);
  });

  it('marks a future dependency as unavailable without mutating component dependencies', () => {
    const apex = 'ApexClass:Action';
    const flow = 'Flow:Parent';
    const waves = [wave(1, flow), wave(2, apex)];
    const dependencies = new Set([apex]);
    const analyzer = new DependencyAvailabilityAnalyzer(
      new Map([
        [apex, component('Action', [])],
        [flow, component('FlowParent', Array.from(dependencies))],
      ])
    );

    const assessment = analyzer.assess(flow, waves[0], waves)[0];

    expect(assessment.availability).to.equal('unavailable-future-wave');
    expect(assessment.canSimplify).to.equal(true);
    expect(dependencies.has(apex)).to.equal(true);
  });

  it('identifies components with multiple consumers', () => {
    const sharedFlow = 'Flow:Shared';
    const firstAgent = 'AiAuthoringBundle:AgentOne';
    const secondAgent = 'GenAiFunction:AgentTwoAction';
    const analyzer = new DependencyAvailabilityAnalyzer(
      new Map([
        [sharedFlow, component('Shared', [])],
        [firstAgent, component('AgentOne', [sharedFlow])],
        [secondAgent, component('AgentTwoAction', [sharedFlow])],
      ])
    );

    const assessment = analyzer.assessSharedComponent(sharedFlow);

    expect(assessment.isShared).to.equal(true);
    expect(assessment.consumers).to.have.members([firstAgent, secondAgent]);
  });

  it('identifies indirect Agentforce consumers of a Flow as high-impact', () => {
    const flow = 'Flow:Shared';
    const functionId = 'GenAiFunction:CreateCase';
    const plugin = 'GenAiPlugin:SupportPlugin';
    const analyzer = new DependencyAvailabilityAnalyzer(
      new Map([
        [flow, { ...component('Shared', []), type: 'Flow' }],
        [functionId, { ...component('CreateCase', [flow]), type: 'GenAiFunction' }],
        [plugin, { ...component('SupportPlugin', [functionId]), type: 'GenAiPlugin' }],
      ])
    );

    const assessment = analyzer.assessSharedComponent(flow);

    expect(assessment.isShared).to.equal(true);
    expect(assessment.isHighImpact).to.equal(true);
    expect(assessment.consumers).to.have.members([functionId, plugin]);
  });
});
