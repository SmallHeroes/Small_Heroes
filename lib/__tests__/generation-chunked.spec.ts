import { describe, expect, it } from 'vitest';
import {
  buildArtifactIdempotencyKey,
  isValidImageAssetUrl,
} from '@/lib/generation-chunked/artifact-keys';
import {
  GENERATION_VERSION,
  getPageImagesPerChunk,
  getPageStartMinBudgetMs,
  getWorkerBudgetMs,
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

  it('page chunk size defaults to 1 (cloud-safe) and honors the env override', () => {
    const prev = process.env.PAGE_IMAGES_PER_CHUNK;
    delete process.env.PAGE_IMAGES_PER_CHUNK;
    expect(getPageImagesPerChunk()).toBe(1); // QA/staging/cloud default
    process.env.PAGE_IMAGES_PER_CHUNK = '2';
    expect(getPageImagesPerChunk()).toBe(2); // local/LOW experiments
    process.env.PAGE_IMAGES_PER_CHUNK = '0'; // invalid → clamp to default
    expect(getPageImagesPerChunk()).toBe(1);
    if (prev === undefined) delete process.env.PAGE_IMAGES_PER_CHUNK;
    else process.env.PAGE_IMAGES_PER_CHUNK = prev;
  });

  it('page-start budget guard leaves room inside the worker budget', () => {
    const prev = process.env.PAGE_START_MIN_BUDGET_MS;
    delete process.env.PAGE_START_MIN_BUDGET_MS;
    // Must require a large slice of the budget (a page needs most of the envelope) but still be
    // satisfiable by a fresh worker.
    expect(getPageStartMinBudgetMs()).toBeGreaterThanOrEqual(150_000);
    expect(getPageStartMinBudgetMs()).toBeLessThanOrEqual(getWorkerBudgetMs());
    process.env.PAGE_START_MIN_BUDGET_MS = '180000';
    expect(getPageStartMinBudgetMs()).toBe(180_000);
    if (prev === undefined) delete process.env.PAGE_START_MIN_BUDGET_MS;
    else process.env.PAGE_START_MIN_BUDGET_MS = prev;
  });
});
