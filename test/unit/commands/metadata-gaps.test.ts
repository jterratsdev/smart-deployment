import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import MetadataGaps from '../../../src/commands/metadata/gaps.js';
import {
  MetadataGapAnalysisService,
  type MetadataGapAnalysisOptions,
  type MetadataGapAnalysisResult,
} from '../../../src/analysis/metadata-gap-analysis-service.js';

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

type MetadataGapsCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
};

describe('MetadataGapsCommand', () => {
  const originalAnalyze = Object.getOwnPropertyDescriptor(MetadataGapAnalysisService.prototype, 'analyze')
    ?.value as typeof MetadataGapAnalysisService.prototype.analyze;

  afterEach(() => {
    Object.defineProperty(MetadataGapAnalysisService.prototype, 'analyze', {
      value: originalAnalyze,
      writable: true,
    });
  });

  it('passes flags to the gap analysis service and reports a summary', async () => {
    const analyzeOptions: MetadataGapAnalysisOptions[] = [];
    MetadataGapAnalysisService.prototype.analyze = async function analyzeMock(options) {
      analyzeOptions.push(options ?? {});
      return createResult();
    };

    const command = new MetadataGaps([], {} as never);
    const logs: string[] = [];
    (command as unknown as MetadataGapsCommandTestDouble).parse = async () => ({
      flags: {
        'source-path': 'force-app',
        'ai-explain': true,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as MetadataGapsCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };

    const result = await command.run();

    expect(analyzeOptions[0]).to.deep.equal({
      sourcePath: 'force-app',
      aiExplain: true,
    });
    expect(result.summary.gapCount).to.equal(1);
    expect(logs.join('\n')).to.include('Smart deployment metadata gaps');
    expect(logs.join('\n')).to.include('CustomApplication');
    expect(logs.join('\n')).to.include('AI workflow context');
  });
});

function createResult(): MetadataGapAnalysisResult {
  return {
    success: true,
    analysisMode: 'deterministic-with-ai-context',
    projectRoot: '/repo',
    apiVersion: '61.0',
    detectedTypes: [
      {
        metadataType: 'CustomApplication',
        supportStatus: 'unsupported',
        evidence: ['force-app/main/default/package.xml (1 members)'],
        detectedFrom: ['package-manifest'],
      },
    ],
    gaps: [
      {
        metadataType: 'CustomApplication',
        supportStatus: 'unsupported',
        evidence: ['force-app/main/default/package.xml (1 members)'],
        detectedFrom: ['package-manifest'],
        classification: 'dependency-rule',
        reason:
          'CustomApplication likely references other metadata and needs parser or dependency rules before it is safe.',
        suggestedImplementation: ['Add CustomApplication fixtures covering package.xml and source-path detection.'],
        requiresHumanReview: false,
      },
    ],
    aiContext: {
      mode: 'workflow-prompt',
      directProviderApiAllowed: false,
      recommendedCommand: 'sf setup-agents workflow run --story PLUGIN-AI-METADATA-GAP-DETECTION',
      prompt: 'Analyze CustomApplication.',
    },
    summary: {
      detectedTypeCount: 1,
      supportedTypeCount: 0,
      gapCount: 1,
      humanReviewCount: 0,
    },
  };
}
