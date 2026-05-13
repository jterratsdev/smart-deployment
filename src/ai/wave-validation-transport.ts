import type { Wave } from '../waves/wave-builder.js';
import type { LLMProvider } from './llm-provider.js';
import { buildWaveValidationPrompt } from './wave-validation-prompt.js';

type ValidationTransportResponse = {
  content: string;
};

export async function sendWaveValidationRequest(
  llmProvider: LLMProvider,
  waves: Wave[]
): Promise<ValidationTransportResponse> {
  return llmProvider.sendRequest({
    model: llmProvider.getConfig().model,
    prompt: buildWaveValidationPrompt(waves),
    temperature: 0.1,
    maxTokens: 3000,
  });
}
