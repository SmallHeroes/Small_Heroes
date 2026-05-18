import type { LLMCallOptions, LLMCallResult, StoryGeneratorLLM } from '../llm';
import { buildMockPlan, buildMockStory, type GenerateInput } from './fixtures';
import type { Plan } from '../types';

export class MockStoryGeneratorLLM implements StoryGeneratorLLM {
  private readonly stories = new Map<string, string>();
  private readonly plans = new Map<string, Plan>();

  constructor(private readonly input: GenerateInput) {}

  register(key: string, plan: Plan, story: string) {
    this.plans.set(key, plan);
    this.stories.set(key, story);
  }

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const base = {
      inputTokens: 1200,
      outputTokens: 800,
      totalTokens: 2000,
      model: 'mock-gpt-5',
      modelVersion: 'mock-gpt-5-v1',
      costUsd: 0.001,
    };

    if (options.stage === 'plan') {
      return { text: JSON.stringify(buildMockPlan(this.input)), ...base };
    }
    if (options.stage === 'draft') {
      return { text: buildMockStory(this.input), ...base };
    }
    if (options.stage.startsWith('repair')) {
      return { text: buildMockStory(this.input), ...base };
    }
    if (options.stage === 'editorial-qa') {
      return {
        text: JSON.stringify({
          scores: {
            naturalHebrew: 5,
            directionFit: 5,
            motifConsistency: 5,
            continuity: 5,
            readAloud: 5,
            ageFit: 5,
          },
          issues: [],
          verdict: 'READY',
        }),
        ...base,
      };
    }
    if (options.stage.startsWith('editorial-repair')) {
      return { text: JSON.stringify({ pages: [] }), ...base };
    }
    return { text: '{}', ...base };
  }
}
