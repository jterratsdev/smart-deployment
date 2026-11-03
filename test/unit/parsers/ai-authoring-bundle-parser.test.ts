import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseAiAuthoringBundle } from '../../../src/parsers/ai-authoring-bundle-parser.js';

describe('parseAiAuthoringBundle', () => {
  it('extracts action targets and ignores instruction prose', () => {
    const result = parseAiAuthoringBundle(
      'aiAuthoringBundles/SupportAgent/SupportAgent.agent',
      `Tell the user that flow://NotAnAction is unavailable.
target: flow://CreateCase
action lookup { target: "apex://CaseLookup" }
target: promptTemplate://CaseSummary
target: agent://SpecialistAgent`
    );

    expect(result.bundleName).to.equal('SupportAgent');
    expect([...result.dependencies]).to.deep.equal([
      'Flow:CreateCase',
      'ApexClass:CaseLookup',
      'GenAiPromptTemplate:CaseSummary',
      'AiAuthoringBundle:SpecialistAgent',
    ]);
  });
});
