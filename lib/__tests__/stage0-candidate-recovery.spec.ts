import { describe, expect, it } from 'vitest';
import type { Order } from '@prisma/client';

import {
  attachPendingChildAnchorFromCandidate,
  generatedStoryAnchorHasRecoverableCandidate,
  pickStage0Candidate,
  stage0CandidateIsRecoverable,
} from '../generation-pipeline/stage0-candidate-recovery';
import type { PipelineCache } from '../generation-pipeline/types';

const order = {
  id: 'ord-stage0-recovery',
  illustrationStyle: 'soft_hand_drawn_storybook',
} as unknown as Order;

describe('Stage 0 candidate recovery provenance', () => {
  it('preserves the legacy photo candidate behavior', () => {
    const cache: PipelineCache = {
      lockedChildDescription: 'child lock',
      stage0AnchorCandidates: [
        {
          attempt: 1,
          url: 'https://example.test/photo-anchor.png',
          resemblanceScore: 0.82,
          semanticPass: true,
          createdAt: '2026-08-21T00:00:00.000Z',
        },
      ],
    };
    const row = pickStage0Candidate(cache);
    expect(row?.attempt).toBe(1);
    const recovered = attachPendingChildAnchorFromCandidate(order, cache, row!);
    expect(recovered.characterAnchorStore?.child).toMatchObject({
      source: 'uploaded_photo',
      qaStatus: 'pending_review',
      resemblanceScore: 0.82,
    });
    expect(recovered.characterAnchorStore?.child?.thresholdUsed).toBeTypeOf('number');
  });

  it('recovers only a fully passed description-template candidate with no likeness fields', () => {
    const row = {
      attempt: 2,
      url: 'https://example.test/generated-anchor.png',
      identityMode: 'description_template' as const,
      semanticPass: true,
      stylePass: true,
      passed: true,
      createdAt: '2026-08-21T00:00:00.000Z',
    };
    const cache: PipelineCache = {
      lockedChildDescription: 'short curly hair, dark eyes',
      stage0AnchorPrompt: 'description-template prompt',
      stage0AnchorCandidates: [row],
    };
    expect(stage0CandidateIsRecoverable(row)).toBe(true);
    expect(pickStage0Candidate(cache)).toEqual(row);

    const recovered = attachPendingChildAnchorFromCandidate(order, cache, row);
    const child = recovered.characterAnchorStore?.child;
    expect(child).toMatchObject({
      source: 'generated_story_anchor',
      qaStatus: 'pending_review',
      promptUsed: 'description-template prompt',
    });
    expect(child?.resemblanceScore).toBeUndefined();
    expect(child?.thresholdUsed).toBeUndefined();
    expect(child?.qaNotes).toMatch(/no photo-likeness claim/i);
    expect(generatedStoryAnchorHasRecoverableCandidate(cache, row.url)).toBe(true);
    expect(generatedStoryAnchorHasRecoverableCandidate(cache, 'https://example.test/other.png')).toBe(false);
  });

  it.each([
    { semanticPass: false, stylePass: true, passed: true },
    { semanticPass: true, stylePass: false, passed: true },
    { semanticPass: true, stylePass: true, passed: false },
  ])('does not recover failed generic evidence %#', (evidence) => {
    const row = {
      attempt: 1,
      url: 'https://example.test/rejected-generic.png',
      identityMode: 'description_template' as const,
      ...evidence,
      createdAt: '2026-08-21T00:00:00.000Z',
    };
    const cache: PipelineCache = { stage0AnchorCandidates: [row] };
    expect(stage0CandidateIsRecoverable(row)).toBe(false);
    expect(pickStage0Candidate(cache)).toBeNull();
    expect(attachPendingChildAnchorFromCandidate(order, cache, row)).toBe(cache);
  });
});
