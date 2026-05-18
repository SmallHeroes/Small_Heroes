import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildStoryMarkdown,
  defaultBollyPages,
} from '@/lib/story-validators/__tests__/helpers';
import { deriveVerdict } from '../editorial/derive-verdict';
import { EditorialReportSchema } from '../editorial/schemas';
import { runEditorialQA, runEditorialRevalidate } from '../stages/editorial-qa';
import { runDeterministicEditorialRepair } from '../stages/editorial-repair';
import { buildMockPlan, buildMockStory, MVP_MATRIX } from './fixtures';
import type { StoryGeneratorLLM } from '../llm';

const READY_REPORT = {
  scores: {
    naturalHebrew: 5,
    directionFit: 5,
    motifConsistency: 5,
    continuity: 5,
    readAloud: 5,
    ageFit: 5,
  },
  issues: [],
  verdict: 'READY' as const,
};

function mockEditorialLlm(): StoryGeneratorLLM {
  return {
    async call(options) {
      if (options.stage === 'editorial-qa') {
        return {
          text: JSON.stringify(READY_REPORT),
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          model: 'mock-editorial',
          modelVersion: 'mock-v1',
          costUsd: 0.0001,
        };
      }
      return {
        text: JSON.stringify({ pages: [] }),
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        model: 'mock-editorial',
        modelVersion: 'mock-v1',
        costUsd: 0.0001,
      };
    },
  };
}

describe('deriveVerdict', () => {
  it('returns NEEDS_REPAIR when blocking issues remain', () => {
    expect(
      deriveVerdict(READY_REPORT.scores, [
        {
          page: 1,
          field: 'body',
          severity: 'BLOCKING',
          reason: 'broken_hebrew',
          quote: 'x',
          suggestion: 'y',
          explanation: 'z',
        },
      ])
    ).toBe('NEEDS_REPAIR');
  });

  it('returns READY when avg >= 4 and no blocking/major thresholds', () => {
    expect(deriveVerdict(READY_REPORT.scores, [])).toBe('READY');
  });
});

describe('runEditorialQA (mock LLM)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses valid editorial JSON via Zod', async () => {
    vi.stubEnv('EDITORIAL_QA_ENABLED', 'true');
    const input = MVP_MATRIX[0];
    const story = buildMockStory(input);
    const plan = buildMockPlan(input);
    const result = await runEditorialQA(story, plan, input, mockEditorialLlm());
    expect(EditorialReportSchema.safeParse(result.report).success).toBe(true);
    expect(result.report.verdict).toBe('READY');
    expect(result.zodParseFailed).toBe(false);
  });

  it('marks REVIEW_REQUIRED path when Zod parse fails', async () => {
    vi.stubEnv('EDITORIAL_QA_ENABLED', 'true');
    const badLlm: StoryGeneratorLLM = {
      async call() {
        return {
          text: '{"scores": "not-an-object"}',
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          model: 'mock',
          modelVersion: 'mock',
          costUsd: 0,
        };
      },
    };
    const input = MVP_MATRIX[0];
    const result = await runEditorialQA(buildMockStory(input), buildMockPlan(input), input, badLlm);
    expect(result.zodParseFailed).toBe(true);
    expect(result.reviewRequired).toBe(true);
  });
});

describe('deterministic editorial repair', () => {
  it('replaces a single known-bad phrase on a page', () => {
    const pages = defaultBollyPages(10);
    const p3 = pages.find((p) => p.pageNumber === 3)!;
    p3.text = `${p3.text} קרירות בברכה של נועה.`;
    const story = buildStoryMarkdown(
      { title: 'בדיקה', companion: 'bolly_armadillo', direction: 'bedtime' },
      pages
    );
    const prescan = runEditorialRevalidate(story, 'bolly_armadillo', READY_REPORT.scores);
    expect(prescan.report.issues.length).toBeGreaterThan(0);

    const { storyMarkdown, fixedCount } = runDeterministicEditorialRepair(
      story,
      prescan.report.issues
    );
    expect(fixedCount).toBeGreaterThan(0);
    expect(storyMarkdown).toContain('הקור בברכיים');
    expect(storyMarkdown).not.toContain('קרירות בברכה');

    const after = runEditorialRevalidate(storyMarkdown, 'bolly_armadillo', READY_REPORT.scores);
    expect(
      after.report.issues.filter(
        (i) => i.reason === 'semantic_nonsense' && i.quote.includes('קרירות')
      )
    ).toHaveLength(0);
  });
});
