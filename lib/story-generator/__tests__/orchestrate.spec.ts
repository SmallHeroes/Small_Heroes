import { describe, expect, it, vi, afterEach } from 'vitest';
import { validateStory } from '@/lib/story-validators';
import { generateStory } from '../stages/orchestrate';
import { buildValidationContext } from '../stages/validation-context';
import { MockStoryGeneratorLLM } from './mock-llm';
import { buildMockPlan, buildMockStory, MVP_MATRIX } from './fixtures';

describe('generateStory orchestration (mock LLM)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('generates 9 MVP stories that pass validators', async () => {
    vi.stubEnv('EDITORIAL_QA_ENABLED', 'true');
    for (const input of MVP_MATRIX) {
      const llm = new MockStoryGeneratorLLM(input);
      const output = await generateStory(input, { llm });
      expect(output.validationReport.verdict).toBe('PASS');
      expect(output.finalStatus).toBe('READY');
      expect(output.fallbackUsed).toBe(false);
      expect(output.repairAttempts).toBeLessThanOrEqual(2);
      expect(output.storyMarkdown).toContain('--- Page 1 ---');
    }
  });

  it('mock stories pass when validated with plan context', () => {
    for (const input of MVP_MATRIX) {
      const plan = buildMockPlan(input);
      const story = buildMockStory(input);
      const report = validateStory({
        storyMarkdown: story,
        mode: 'production',
        context: buildValidationContext(plan, input),
      });
      expect(report.verdict, JSON.stringify(report.findings.filter((f) => f.severity === 'BLOCKING'))).toBe(
        'PASS'
      );
    }
  });
});
