import { expect } from 'chai';
import { describe, it } from 'mocha';
import { PlanExplainPresenter } from '../../../src/presentation/plan-explain-presenter.js';
import type { PlanExplainResult } from '../../../src/deployment/plan-explain-service.js';

describe('PlanExplainPresenter', () => {
  it('warns about scanned components without deployment waves', () => {
    const logs: string[] = [];
    const warnings: string[] = [];
    const result: PlanExplainResult = {
      success: false,
      projectRoot: '/tmp/project',
      apiVersion: '61.0',
      components: [],
      dependencies: [],
      unresolvedReferences: [],
      providerDecisions: [],
      summary: {
        componentCount: 1,
        dependencyCount: 0,
        unresolvedReferenceCount: 0,
        unplacedComponentCount: 1,
        providerDecisionCount: 0,
        waves: 0,
      },
      architecturalConcerns: { inherited: [], selfImposed: [] },
    };

    new PlanExplainPresenter().report({ log: (line) => logs.push(line), warn: (line) => warnings.push(line) }, result);

    expect(logs.join('\n')).to.include('Unplaced Components: 1');
    expect(warnings).to.deep.equal(['Plan contains 1 component(s) without a deployment wave.']);
  });
});
