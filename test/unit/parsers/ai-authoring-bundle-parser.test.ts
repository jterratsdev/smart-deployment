import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseAiAuthoringBundle } from '../../../src/parsers/ai-authoring-bundle-parser.js';

describe('AiAuthoringBundleParser', () => {
  it('extracts Agent Script action targets', () => {
    const result = parseAiAuthoringBundle(
      'aiAuthoringBundles/CustomerAgent/CustomerAgent.agent',
      `
        action send_case { target: "flow://CreateCase" }
        action classify { target: "prompt://ClassifyCase" }
        action lookup { target: "apex://CaseLookup" }
        action delegate { target: "agent://SpecialistAgent" }
      `
    );

    expect(result.bundleName).to.equal('CustomerAgent');
    expect(result.flowTargets).to.deep.equal(['CreateCase']);
    expect(result.apexTargets).to.deep.equal(['CaseLookup']);
    expect(result.promptTemplates).to.deep.equal(['ClassifyCase']);
    expect(result.agentTargets).to.deep.equal(['SpecialistAgent']);
  });

  it('does not treat prose as an action target', () => {
    const result = parseAiAuthoringBundle(
      'aiAuthoringBundles/CustomerAgent/CustomerAgent.agent',
      'Tell the user that flow://NotAnAction is unavailable.\n target: "flow://RealFlow"'
    );

    expect(result.flowTargets).to.deep.equal(['RealFlow']);
  });

  it('supports unquoted and promptTemplate action targets while ignoring instruction text', () => {
    const result = parseAiAuthoringBundle(
      'aiAuthoringBundles/CustomerAgent/CustomerAgent.agent',
      `
        topic:
          reasoning: "target: flow://NotAnAction"
          actions:
            summarize: @actions.summarize
              target: promptTemplate://CaseSummary
            run_flow: @actions.run_flow
              target: flow://CreateCase
      `
    );

    expect(result.flowTargets).to.deep.equal(['CreateCase']);
    expect(result.promptTemplates).to.deep.equal(['CaseSummary']);
  });
});
