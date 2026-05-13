import type { Wave } from '../waves/wave-builder.js';

type PromptWaveSummary = {
  number: number;
  componentCount: number;
  types: Wave['metadata']['types'];
  components: string[];
};

export function buildWaveValidationPrompt(waves: Wave[]): string {
  const waveSummaries = summarizeWavesForPrompt(waves);

  return `You are an expert Salesforce deployment architect. Analyze the following deployment waves and identify potential issues.

Focus on:
1. **Business Logic Issues**: Components that should/shouldn't be in same wave
2. **Risk Assessment**: High-risk combinations
3. **Performance**: Wave size and deployment time concerns
4. **Dependencies**: Missing or incorrect ordering

Waves:
${JSON.stringify(waveSummaries, null, 2)}

Return ONLY a JSON object in this format:
{
  "issues": [
    {
      "waveNumber": 1,
      "severity": "low|medium|high|critical",
      "category": "dependency|business-logic|performance|risk",
      "message": "Description of issue",
      "affectedComponents": ["Component1", "Component2"],
      "suggestion": "How to fix"
    }
  ],
  "optimizations": [
    {
      "waveNumber": 1,
      "type": "merge|split|reorder",
      "description": "What to optimize",
      "confidence": 0.0-1.0,
      "estimatedImprovement": "10% faster deployment"
    }
  ],
  "riskAssessments": [
    {
      "waveNumber": 1,
      "riskLevel": "low|medium|high|critical",
      "riskFactors": ["Large wave size", "Complex dependencies"],
      "mitigation": ["Split into 2 waves", "Add validation tests"],
      "recommendedActions": ["Review before production deploy"]
    }
  ]
}

Be conservative - only report issues with high confidence.`;
}

function summarizeWavesForPrompt(waves: Wave[]): PromptWaveSummary[] {
  return waves.map((wave) => ({
    number: wave.number,
    componentCount: wave.metadata.componentCount,
    types: wave.metadata.types,
    components: wave.components.slice(0, 20),
  }));
}
