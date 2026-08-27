import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WavePostProcessor } from '../../../src/waves/wave-post-processor.js';
import type { NodeId } from '../../../src/types/dependency.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

function component(type: MetadataComponent['type'], name: string, dependencies: string[] = []): MetadataComponent {
  return {
    type,
    name,
    filePath: `${name}.xml`,
    dependencies: new Set(dependencies),
    dependents: new Set(),
    priorityBoost: 0,
  };
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

describe('WavePostProcessor shared component protection', () => {
  function process(flowConsumers: Array<[string, MetadataComponent['type'], string[]]>) {
    const flow = 'Flow:Shared';
    const apex = 'ApexClass:Action';
    const later = 'ApexClass:Later';
    const componentMap = new Map<NodeId, MetadataComponent>();
    componentMap.set(flow, component('Flow', 'Shared', [apex]));
    componentMap.set(apex, component('ApexClass', 'Action', [later]));
    componentMap.set(later, component('ApexClass', 'Later'));
    for (const [nodeId, type, dependencies] of flowConsumers) {
      componentMap.set(nodeId, component(type, nodeId.split(':')[1], dependencies));
    }

    const processor = new WavePostProcessor(componentMap, {
      syncPSG: false,
      syncFlows: false,
      syncFlexiPages: false,
      syncTestClasses: false,
      splitLargeWaves: false,
    });
    return processor.processWaves([
      wave(1, flow, ...flowConsumers.map(([nodeId]) => nodeId)),
      wave(2, apex),
      wave(3, later),
    ]);
  }

  it('does not mark a directly shared Flow for simplification', () => {
    const result = process([
      ['GenAiPlugin:First', 'GenAiPlugin', ['Flow:Shared']],
      ['AiAuthoringBundle:Second', 'AiAuthoringBundle', ['Flow:Shared']],
    ]);

    expect(result.componentsToSimplify.has('Flow:Shared')).to.equal(false);
  });

  it('does not mark a Flow for simplification when its consumer chain reaches a plugin', () => {
    const result = process([
      ['GenAiFunction:CreateCase', 'GenAiFunction', ['Flow:Shared']],
      ['GenAiPlugin:SupportPlugin', 'GenAiPlugin', ['GenAiFunction:CreateCase']],
    ]);

    expect(result.componentsToSimplify.has('Flow:Shared')).to.equal(false);
  });
});
