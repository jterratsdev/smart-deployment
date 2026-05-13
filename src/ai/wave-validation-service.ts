/**
 * AI Wave Validation Service - US-056
 * Uses Agentforce to validate deployment waves for business logic issues
 *
 * @ac US-056-AC-1: Send wave structure to Agentforce
 * @ac US-056-AC-2: Receive validation feedback
 * @ac US-056-AC-3: Identify potential issues
 * @ac US-056-AC-4: Suggest optimizations
 * @ac US-056-AC-5: Risk assessment per wave
 * @ac US-056-AC-6: Apply AI suggestions (optional)
 * @issue #56
 */

import { getLogger } from '../utils/logger.js';
import type { Wave } from '../waves/wave-builder.js';
import type { LLMProvider } from './llm-provider.js';
import { createLLMProvider } from './llm-provider-factory.js';
import { formatWaveValidationReport } from './wave-validation-report.js';
import { parseWaveValidationResponse, type WaveValidationPayload } from './wave-validation-response-parser.js';
import {
  applyValidationPayload,
  completeAIAnalysis,
  completeValidationFailure,
  createDefaultWaveValidationResult,
} from './wave-validation-result-synthesis.js';
import { sendWaveValidationRequest } from './wave-validation-transport.js';

const logger = getLogger('WaveValidationService');

export type WaveValidationIssue = {
  waveNumber: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'dependency' | 'business-logic' | 'performance' | 'risk';
  message: string;
  affectedComponents: string[];
  suggestion?: string;
};

export type WaveOptimization = {
  waveNumber: number;
  type: 'merge' | 'split' | 'reorder' | 'add-component' | 'remove-component';
  description: string;
  confidence: number;
  estimatedImprovement: string;
};

export type WaveRiskAssessment = {
  waveNumber: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  mitigation: string[];
  recommendedActions: string[];
};

export type WaveValidationResult = {
  isValid: boolean;
  issues: WaveValidationIssue[];
  optimizations: WaveOptimization[];
  riskAssessments: WaveRiskAssessment[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  executionTime: number;
  aiAnalyzed: boolean;
};

export type WaveValidationServiceOptions = {
  baseDir?: string;
};

/**
 * @ac US-056-AC-1: Send wave structure to Agentforce
 * @ac US-056-AC-2: Receive validation feedback
 */
export class WaveValidationService {
  private readonly llmProvider: LLMProvider;

  public constructor(llmProviderOrOptions?: LLMProvider | WaveValidationServiceOptions) {
    this.llmProvider = this.resolveProvider(llmProviderOrOptions);
    logger.info('Wave validation service initialized');
  }

  private resolveProvider(llmProviderOrOptions?: LLMProvider | WaveValidationServiceOptions): LLMProvider {
    if (llmProviderOrOptions && 'sendRequest' in llmProviderOrOptions) {
      return llmProviderOrOptions;
    }

    return createLLMProvider({
      baseDir: llmProviderOrOptions?.baseDir,
    });
  }

  /**
   * @ac US-056-AC-1: Send wave structure to Agentforce
   * Validate a local wave plan using AI
   */
  public async validateWaves(waves: Wave[]): Promise<WaveValidationResult> {
    const startTime = Date.now();
    const result = createDefaultWaveValidationResult();

    try {
      if (this.shouldSkipAIValidation()) {
        return this.finalizeWithoutAI(result);
      }

      const validation = await this.runAIValidation(waves);
      const analyzedResult = completeAIAnalysis(
        applyValidationPayload(result, validation),
        this.calculateExecutionTime(startTime)
      );
      this.logValidationCompleted(waves, analyzedResult);

      return analyzedResult;
    } catch (error) {
      return this.handleValidationFailure(error, result, startTime);
    }
  }

  private calculateExecutionTime(startTime: number): number {
    return Date.now() - startTime;
  }

  private shouldSkipAIValidation(): boolean {
    return !this.llmProvider.isEnabled();
  }

  private finalizeWithoutAI(result: WaveValidationResult): WaveValidationResult {
    logger.info('Agentforce disabled, skipping AI validation');
    return result;
  }

  private async runAIValidation(waves: Wave[]): Promise<WaveValidationPayload> {
    const response = await sendWaveValidationRequest(this.llmProvider, waves);
    return parseWaveValidationResponse(response.content, waves);
  }

  private logValidationCompleted(waves: Wave[], result: WaveValidationResult): void {
    logger.info('Wave validation completed', {
      waves: waves.length,
      issues: result.issues.length,
      optimizations: result.optimizations.length,
      overallRisk: result.overallRisk,
    });
  }

  private handleValidationFailure(
    error: unknown,
    result: WaveValidationResult,
    startTime: number
  ): WaveValidationResult {
    logger.error('Wave validation failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return completeValidationFailure(result, this.calculateExecutionTime(startTime));
  }

  /**
   * @ac US-056-AC-6: Apply AI suggestions (optional)
   * Apply optimization suggestions to waves
   */
  public applyOptimizations(waves: Wave[], optimizations: WaveOptimization[]): Wave[] {
    // For now, just return original waves
    // Future: implement actual optimization application
    logger.info('Optimization application not yet implemented', {
      optimizations: optimizations.length,
    });

    return waves;
  }

  public getProviderConfig(): Readonly<ReturnType<LLMProvider['getConfig']>> {
    return this.llmProvider.getConfig();
  }

  /**
   * Format validation report
   */
  public formatValidationReport(result: WaveValidationResult): string {
    return formatWaveValidationReport(result);
  }
}
