import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseLegacyAgentforce } from '../../../src/parsers/legacy-agentforce-parser.js';

describe('parseLegacyAgentforce', () => {
  it('maps function targets to typed dependencies', () => {
    const flow = parseLegacyAgentforce(
      'CreateCase.genAiFunction-meta.xml',
      '<GenAiFunction><invocationTarget>CreateCaseFlow</invocationTarget><invocationTargetType>flow</invocationTargetType></GenAiFunction>',
      'GenAiFunction'
    );
    const apex = parseLegacyAgentforce(
      'Lookup.genAiFunction-meta.xml',
      '<GenAiFunction><invocationTarget>Lookup.run</invocationTarget><invocationTargetType>apex</invocationTargetType></GenAiFunction>',
      'GenAiFunction'
    );

    expect([...flow.dependencies]).to.deep.equal(['Flow:CreateCaseFlow']);
    expect([...apex.dependencies]).to.deep.equal(['ApexClass:Lookup']);
  });

  it('deduplicates namespaced plugin function references', () => {
    const result = parseLegacyAgentforce(
      'Support.genAiPlugin-meta.xml',
      '<m:GenAiPlugin><m:functionName>CreateCase</m:functionName><m:genAiFunctionName>CreateCase</m:genAiFunctionName></m:GenAiPlugin>',
      'GenAiPlugin'
    );

    expect([...result.dependencies]).to.deep.equal(['GenAiFunction:CreateCase']);
  });
});
