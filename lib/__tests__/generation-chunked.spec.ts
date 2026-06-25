import { describe, expect, it } from 'vitest';
import {
  buildArtifactIdempotencyKey,
  isValidImageAssetUrl,
} from '@/lib/generation-chunked/artifact-keys';
import {
  GENERATION_VERSION,
  getAnchorAttemptBudgetMs,
  getWorkerBudgetMs,
  PAGE_IMAGES_PER_CHUNK,
} from '@/lib/generation-chunked/constants';

describe('generation-chunked', () => {
  it('builds stable artifact idempotency keys', () => {
    const a = buildArtifactIdempotencyKey({
      orderId: 'ord_1',
      kind: 'page_image',
      pageNumber: 5,
      model: 'gpt-image-2',
      quality: 'low',
      generationVersion: GENERATION_VERSION,
    });
    const b = buildArtifactIdempotencyKey({
      orderId: 'ord_1',
      kind: 'page_image',
      pageNumber: 5,
      model: 'gpt-image-2',
      quality: 'low',
      generationVersion: GENERATION_VERSION,
    });
    expect(a).toBe(b);
    expect(a).toContain('ord_1');
    expect(a).toContain('p5');
  });

  it('changes key when generation version changes', () => {
    const v1 = buildArtifactIdempotencyKey({
      orderId: 'ord_1',
      kind: 'cover',
      generationVersion: 1,
    });
    const v2 = buildArtifactIdempotencyKey({
      orderId: 'ord_1',
      kind: 'cover',
      generationVersion: 2,
    });
    expect(v1).not.toBe(v2);
  });

  it('validates image URLs', () => {
    expect(isValidImageAssetUrl('https://cdn.example.com/a.png')).toBe(true);
    expect(isValidImageAssetUrl('')).toBe(false);
    expect(isValidImageAssetUrl('ftp://x')).toBe(false);
  });

  it('defaults worker budget under vercel limit', () => {
    const prev = process.env.GENERATION_WORKER_BUDGET_MS;
    delete process.env.GENERATION_WORKER_BUDGET_MS;
    expect(getWorkerBudgetMs()).toBeLessThanOrEqual(240_000);
    if (prev) process.env.GENERATION_WORKER_BUDGET_MS = prev;
  });

  it('anchor attempt budget fits a single attempt under the worker budget', () => {
    const prev = process.env.ANCHOR_ATTEMPT_BUDGET_MS;
    delete process.env.ANCHOR_ATTEMPT_BUDGET_MS;
    // Must be enough to finish one generate+persist+QA, yet leave room inside the worker budget.
    expect(getAnchorAttemptBudgetMs()).toBeGreaterThanOrEqual(60_000);
    expect(getAnchorAttemptBudgetMs()).toBeLessThan(getWorkerBudgetMs());
    process.env.ANCHOR_ATTEMPT_BUDGET_MS = '90000';
    expect(getAnchorAttemptBudgetMs()).toBe(90_000);
    if (prev === undefined) delete process.env.ANCHOR_ATTEMPT_BUDGET_MS;
    else process.env.ANCHOR_ATTEMPT_BUDGET_MS = prev;
  });

  it('uses conservative page chunk size', () => {
    expect(PAGE_IMAGES_PER_CHUNK).toBeGreaterThanOrEqual(1);
    expect(PAGE_IMAGES_PER_CHUNK).toBeLessThanOrEqual(3);
  });
});
