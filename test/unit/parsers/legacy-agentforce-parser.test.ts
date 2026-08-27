import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseLegacyAgentforce } from '../../../src/parsers/legacy-agentforce-parser.js';

describe('LegacyAgentforceParser', () => {
  it('maps a GenAiFunction Flow target', () => {
    const result = parseLegacyAgentforce(
      'genAiFunctions/CreateCase/CreateCase.genAiFunction-meta.xml',
      '<GenAiFunction><invocationTarget>CreateCaseFlow</invocationTarget><invocationTargetType>flow</invocationTargetType></GenAiFunction>',
      'GenAiFunction'
    );

    expect(result.name).to.equal('CreateCase');
    expect(result.dependencies).to.deep.equal([{ type: 'flow', name: 'CreateCaseFlow' }]);
  });

  it('maps plugin functions and planner functions/plugins', () => {
    const plugin = parseLegacyAgentforce(
      'MyPlugin.genAiPlugin-meta.xml',
      '<GenAiPlugin><genAiFunctions><functionName>CreateCase</functionName></genAiFunctions></GenAiPlugin>',
      'GenAiPlugin'
    );
    const planner = parseLegacyAgentforce(
      'MyPlanner.genAiPlannerBundle',
      '<GenAiPlannerBundle><genAiFunctions><genAiFunctionName>CreateCase</genAiFunctionName></genAiFunctions><genAiPlugins><genAiPluginName>Cases</genAiPluginName></genAiPlugins></GenAiPlannerBundle>',
      'GenAiPlannerBundle'
    );

    expect(plugin.dependencies).to.deep.equal([{ type: 'function', name: 'CreateCase' }]);
    expect(planner.dependencies).to.deep.equal([
      { type: 'function', name: 'CreateCase' },
      { type: 'plugin', name: 'Cases' },
    ]);
  });

  it('maps Apex and Prompt Template invocation targets', () => {
    const apex = parseLegacyAgentforce(
      'Lookup.genAiFunction-meta.xml',
      '<GenAiFunction><invocationTarget>Lookup.find</invocationTarget><invocationTargetType>apex</invocationTargetType></GenAiFunction>',
      'GenAiFunction'
    );
    const prompt = parseLegacyAgentforce(
      'Classify.genAiFunction-meta.xml',
      '<GenAiFunction><invocationTarget>ClassifyCase</invocationTarget><invocationTargetType>promptTemplate</invocationTargetType></GenAiFunction>',
      'GenAiFunction'
    );

    expect(apex.dependencies).to.deep.equal([{ type: 'apex', name: 'Lookup' }]);
    expect(prompt.dependencies).to.deep.equal([{ type: 'prompt', name: 'ClassifyCase' }]);
  });

  it('accepts XML namespace prefixes, alternate suffixes, and deduplicates links', () => {
    const result = parseLegacyAgentforce(
      'genAiPlugins/Plugin/Plugin.genAiPlugin-meta.xml',
      '<m:GenAiPlugin xmlns:m="urn:test"><m:genAiFunctions><m:functionName>DoThing</m:functionName></m:genAiFunctions><m:genAiFunctions><m:genAiFunctionName>DoThing</m:genAiFunctionName></m:genAiFunctions></m:GenAiPlugin>',
      'GenAiPlugin'
    );

    expect(result.dependencies).to.deep.equal([{ type: 'function', name: 'DoThing' }]);
  });
});
