import { expect } from 'chai';
import { describe, it } from 'mocha';
import { validateAgentforceTargets } from '../../../src/validation/agentforce-target-validator.js';
import type { Manifest } from '../../../src/types/deployment.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

function component(type: MetadataComponent['type'], name: string, dependencies: string[] = []): MetadataComponent {
  return {
    type,
    name,
    filePath: `${name}.metadata`,
    dependencies: new Set(dependencies),
    dependents: new Set(),
    priorityBoost: 0,
  };
}

function wave(number: number, ...components: string[]): Wave {
  return {
    number,
    components,
    metadata: { componentCount: components.length, types: [], maxDepth: 0, hasCircularDeps: false, estimatedTime: 0 },
  };
}

function manifest(components: Record<string, string[]>): Manifest {
  return { fileName: 'wave-package.xml', content: '', components, apiVersion: '65.0' };
}

describe('AgentforceTargetValidator', () => {
  it('accepts an Agentforce target in an earlier wave and manifest', () => {
    const flowId = 'Flow:CreateCase';
    const agentId = 'AiAuthoringBundle:SupportAgent';
    const result = validateAgentforceTargets(
      [wave(1, flowId), wave(2, agentId)],
      [manifest({ Flow: ['CreateCase'] }), manifest({ AiAuthoringBundle: ['SupportAgent'] })],
      new Map([
        [flowId, component('Flow', 'CreateCase')],
        [agentId, component('AiAuthoringBundle', 'SupportAgent', [flowId])],
      ])
    );

    expect(result.valid).to.equal(true);
    expect(result.issues).to.deep.equal([]);
  });

  it('rejects a target scheduled after its Agentforce consumer', () => {
    const flowId = 'Flow:CreateCase';
    const agentId = 'GenAiFunction:CreateCaseAction';
    const result = validateAgentforceTargets(
      [wave(1, agentId), wave(2, flowId)],
      [manifest({ GenAiFunction: ['CreateCaseAction'] }), manifest({ Flow: ['CreateCase'] })],
      new Map([
        [flowId, component('Flow', 'CreateCase')],
        [agentId, component('GenAiFunction', 'CreateCaseAction', [flowId])],
      ])
    );

    expect(result.valid).to.equal(false);
    expect(result.issues.some((issue) => issue.message.includes('not before'))).to.equal(true);
  });

  it('reports a local target missing from manifests', () => {
    const flowId = 'Flow:CreateCase';
    const agentId = 'AiAuthoringBundle:SupportAgent';
    const result = validateAgentforceTargets(
      [wave(1, flowId), wave(2, agentId)],
      [manifest({ AiAuthoringBundle: ['SupportAgent'] })],
      new Map([
        [flowId, component('Flow', 'CreateCase')],
        [agentId, component('AiAuthoringBundle', 'SupportAgent', [flowId])],
      ])
    );

    expect(result.valid).to.equal(false);
    expect(result.issues.some((issue) => issue.message.includes('absent from all generated manifests'))).to.equal(true);
  });
});
