import {
  ProjectAnalysisService,
  type ProjectAnalysisAIContext,
  type ProjectAnalysisMessages,
} from '../analysis/project-analysis-service.js';
import type { ScanResult } from '../services/metadata-scanner-service.js';
import type { Wave } from '../waves/wave-builder.js';
import type { CommitScopeOptions, CommitScopeSummary } from './commit-scope-service.js';

export type DeploymentAIContext = ProjectAnalysisAIContext;

export type DeploymentContextMessages = ProjectAnalysisMessages;

export type DeploymentContext = {
  scanResult: ScanResult;
  orderedWaves: Wave[];
  aiContext?: DeploymentAIContext;
  commitScope?: CommitScopeSummary;
  messages: DeploymentContextMessages;
};

export type DeploymentContextBuildOptions = {
  sourcePath?: string;
  useAI?: boolean;
  orgType?: string;
  industry?: string;
  commitScope?: CommitScopeOptions;
};

type DeploymentContextServiceDependencies = ConstructorParameters<typeof ProjectAnalysisService>[0];

export class DeploymentContextService {
  private readonly projectAnalysisService: ProjectAnalysisService;

  public constructor(dependencies: DeploymentContextServiceDependencies = {}) {
    this.projectAnalysisService = new ProjectAnalysisService(dependencies);
  }

  public async buildContext(options: DeploymentContextBuildOptions = {}): Promise<DeploymentContext> {
    const analysis = await this.projectAnalysisService.buildAnalysis(options);
    return {
      scanResult: analysis.scanResult,
      orderedWaves: analysis.orderedWaves,
      aiContext: analysis.aiContext,
      commitScope: analysis.commitScope,
      messages: analysis.messages,
    };
  }
}
