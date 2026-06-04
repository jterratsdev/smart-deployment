import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import Impact from '../../../src/commands/impact.js';
import {
  ImpactAnalysisService,
  type ImpactCommandResult,
  type ImpactAnalysisOptions,
} from '../../../src/dependencies/impact-analysis-service.js';

type ParseResult = {
  flags: Record<string, unknown>;
  args: Record<string, unknown>;
  argv: string[];
  raw: unknown[];
  metadata: {
    flags: Record<string, unknown>;
    args: Record<string, unknown>;
  };
  nonExistentFlags: string[];
  _runtime: unknown;
};

type ImpactCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
};

describe('ImpactCommand', () => {
  const originalAnalyze = Object.getOwnPropertyDescriptor(ImpactAnalysisService.prototype, 'analyze')
    ?.value as typeof ImpactAnalysisService.prototype.analyze;

  afterEach(() => {
    Object.defineProperty(ImpactAnalysisService.prototype, 'analyze', {
      value: originalAnalyze,
      writable: true,
    });
  });

  it('passes ref flags to the impact service and reports a summary', async () => {
    const analyzeOptions: ImpactAnalysisOptions[] = [];
    ImpactAnalysisService.prototype.analyze = async function analyzeMock(options) {
      analyzeOptions.push(options ?? {});
      return createResult();
    };
    const command = new Impact([], {} as never);
    const logs: string[] = [];
    (command as unknown as ImpactCommandTestDouble).parse = async () => ({
      flags: {
        'source-path': 'force-app',
        base: 'origin/main',
        head: 'HEAD',
        'working-tree': false,
        'max-depth': 3,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as ImpactCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };

    const result = await command.run();

    expect(analyzeOptions[0]).to.deep.equal({
      sourcePath: 'force-app',
      base: 'origin/main',
      head: 'HEAD',
      workingTree: false,
      maxDepth: 3,
    });
    expect(result.summary.affectedComponentCount).to.equal(2);
    expect(logs.join('\n')).to.include('Smart deployment impact');
  });
});

function createResult(): ImpactCommandResult {
  return {
    success: true,
    mode: 'refs',
    base: 'origin/main',
    head: 'HEAD',
    projectRoot: '/repo',
    changedFiles: [{ status: 'changed', path: 'force-app/main/default/classes/AccountService.cls' }],
    changedComponents: [
      {
        nodeId: 'ApexClass:AccountService',
        type: 'ApexClass',
        name: 'AccountService',
        filePath: 'force-app/main/default/classes/AccountService.cls',
        status: 'changed',
        foundInScan: true,
      },
    ],
    transitiveDependents: ['ApexClass:AccountService_Test'],
    affectedComponents: ['ApexClass:AccountService', 'ApexClass:AccountService_Test'],
    plannedWaves: [
      { number: 1, components: ['ApexClass:AccountService'] },
      { number: 2, components: ['ApexClass:AccountService_Test'] },
    ],
    suggestedApexTests: {
      requiredTests: [],
      recommendedTests: ['ApexClass:AccountService_Test'],
      optionalTests: [],
      estimatedTestCount: 1,
      priority: 'low',
    },
    impact: {
      totalAffected: 1,
      overallImpactLevel: 'low',
      criticalComponents: [],
    },
    summary: {
      changedComponentCount: 1,
      transitiveDependentCount: 1,
      affectedComponentCount: 2,
      plannedWaveCount: 2,
      suggestedApexTestCount: 1,
      overallImpactLevel: 'low',
    },
  };
}
