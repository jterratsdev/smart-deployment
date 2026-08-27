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

  it('validates all Agentforce component target types and Salesforce prompt mapping', () => {
    const targetIds = [
      'GenAiFunction:FunctionOne',
      'GenAiPlugin:PluginOne',
      'GenAiPlannerBundle:PlannerOne',
      'AiAuthoringBundle:AgentOne',
      'GenAiPromptTemplate:PromptOne',
    ];
    const consumerId = 'AiAuthoringBundle:Consumer';
    const components = new Map<string, MetadataComponent>([
      [consumerId, component('AiAuthoringBundle', 'Consumer', targetIds)],
      ...targetIds.map((id) => {
        const separator = id.indexOf(':');
        return [id, component(id.slice(0, separator) as MetadataComponent['type'], id.slice(separator + 1))] as const;
      }),
    ]);
    const result = validateAgentforceTargets(
      [wave(1, ...targetIds), wave(2, consumerId)],
      [
        manifest({
          GenAiFunction: ['FunctionOne'],
          GenAiPlugin: ['PluginOne'],
          GenAiPlannerBundle: ['PlannerOne'],
          AiAuthoringBundle: ['AgentOne'],
          // package.xml uses the Salesforce spelling, not the internal type.
          GenAIPromptTemplate: ['PromptOne'],
        }),
      ],
      components
    );

    expect(result.valid).to.equal(true);
    expect(result.issues).to.deep.equal([]);
  });

  it('treats a target absent from source as an external-org warning', () => {
    const consumerId = 'GenAiFunction:ExternalConsumer';
    const result = validateAgentforceTargets(
      [wave(1, consumerId)],
      [manifest({ GenAiFunction: ['ExternalConsumer'] })],
      new Map([[consumerId, component('GenAiFunction', 'ExternalConsumer', ['Flow:ManagedFlow'])]])
    );

    expect(result.valid).to.equal(true);
    expect(result.issues).to.have.length(1);
    expect(result.issues[0].severity).to.equal('warning');
  });

  it('uses the earliest wave when a target is repeated by manifest adjustments', () => {
    const targetId = 'Flow:CreateCase';
    const consumerId = 'GenAiFunction:CreateCaseAction';
    const result = validateAgentforceTargets(
      [wave(1, targetId), wave(2, consumerId), wave(3, targetId)],
      [manifest({ Flow: ['CreateCase'] }), manifest({ GenAiFunction: ['CreateCaseAction'] })],
      new Map([
        [targetId, component('Flow', 'CreateCase')],
        [consumerId, component('GenAiFunction', 'CreateCaseAction', [targetId])],
      ])
    );

    expect(result.valid).to.equal(true);
  });

  it('rejects a same-wave target because targets must be deployed first', () => {
    const targetId = 'Flow:CreateCase';
    const consumerId = 'GenAiPlugin:CasePlugin';
    const result = validateAgentforceTargets(
      [wave(1, targetId, consumerId)],
      [manifest({ Flow: ['CreateCase'], GenAiPlugin: ['CasePlugin'] })],
      new Map([
        [targetId, component('Flow', 'CreateCase')],
        [consumerId, component('GenAiPlugin', 'CasePlugin', [targetId])],
      ])
    );

    expect(result.valid).to.equal(false);
    expect(result.issues.some((issue) => issue.message.includes('not before'))).to.equal(true);
  });

  it('parses target names containing colons without losing the name', () => {
    const targetId = 'Flow:Namespace:CreateCase';
    const consumerId = 'GenAiFunction:CreateCaseAction';
    const result = validateAgentforceTargets(
      [wave(1, targetId), wave(2, consumerId)],
      [manifest({ Flow: ['Namespace:CreateCase'], GenAiFunction: ['CreateCaseAction'] })],
      new Map([
        [targetId, component('Flow', 'Namespace:CreateCase')],
        [consumerId, component('GenAiFunction', 'CreateCaseAction', [targetId])],
      ])
    );

    expect(result.valid).to.equal(true);
    expect(result.issues).to.deep.equal([]);
  });
});
