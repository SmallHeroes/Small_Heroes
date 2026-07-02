import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildQaWarningsFromAnchorHold,
  buildQaWarningsFromReadinessBlock,
  canUseQaSoftDeliver,
} from '@/lib/qa-soft-deliver';
import { isProductionLikeRuntime } from '@/lib/runtime-env';
import { finalizePackageDelivery } from '@/lib/generation-pipeline/package-delivery';

const MANAGED = ['QA_SOFT_DELIVER', 'VERCEL_ENV'] as const;
const saved: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe('canUseQaSoftDeliver (prod-fenced)', () => {
  beforeEach(() => {
    for (const k of MANAGED) saved[k] = process.env[k];
    setEnv('QA_SOFT_DELIVER', 'true');
    setEnv('VERCEL_ENV', 'preview');
  });
  afterEach(() => {
    for (const k of MANAGED) setEnv(k, saved[k]);
  });

  it('is true on non-prod when QA_SOFT_DELIVER=true', () => {
    expect(canUseQaSoftDeliver()).toBe(true);
  });

  it('is false on production-like runtime even when flag is set', () => {
    setEnv('VERCEL_ENV', 'production');
    expect(isProductionLikeRuntime()).toBe(true);
    expect(canUseQaSoftDeliver()).toBe(false);
  });

  it('is false when flag is off', () => {
    setEnv('QA_SOFT_DELIVER', 'false');
    expect(canUseQaSoftDeliver()).toBe(false);
  });
});

describe('qaWarnings builders', () => {
  it('builds page flags from quality evidence_unknown block', () => {
    const warnings = buildQaWarningsFromReadinessBlock({
      reason: 'quality_evidence_unknown:page:2,page:7',
      evidence: {
        quality: {
          perArtifact: {
            'page:2': { state: 'missing' },
            'page:7': { state: 'evidence_unknown', verdict: 'evidence_unknown' },
          },
        },
      },
    });
    expect(warnings.wouldHaveReason).toContain('quality_evidence_unknown');
    expect(warnings.pageFlags.map((f) => f.artifactKey)).toEqual(expect.arrayContaining(['page:2', 'page:7']));
  });

  it('builds anchor score + band warnings', () => {
    const warnings = buildQaWarningsFromAnchorHold({ reason: 'hard_band', score: 0.147 });
    expect(warnings.anchor).toMatchObject({ score: 0.147, band: 'hard_band' });
    expect(warnings.wouldHaveReason).toContain('hard_band');
  });
});

describe('QA soft-deliver integration', () => {
  const order = {
    id: 'o1',
    customerEmail: 'parent@example.com',
    customerName: 'Parent',
    childName: 'Kid',
  };

  beforeEach(() => {
    for (const k of MANAGED) saved[k] = process.env[k];
    setEnv('QA_SOFT_DELIVER', 'true');
    setEnv('VERCEL_ENV', 'preview');
  });
  afterEach(() => {
    for (const k of MANAGED) setEnv(k, saved[k]);
  });

  it('flag-off legacy path still holds weak anchor', async () => {
    setEnv('QA_SOFT_DELIVER', 'false');
    const prisma = {
      order: { update: vi.fn(async () => ({})) },
      generationJob: { update: vi.fn(async () => ({})) },
    };
    const send = vi.fn(async () => ({}));
    const heldGate = {
      held: true,
      orderStatus: 'needs_human_qa' as const,
      reason: 'anchor_low_confidence:hard_band',
      sendBookReadyEmail: false,
    };
    const result = await finalizePackageDelivery(
      prisma as never,
      {
        order,
        deliveryGate: heldGate,
        readUrl: 'https://app/ready?orderId=o1',
        pdfUrl: null,
        firstAudioUrl: null,
        anchorLowConfidence: { reason: 'hard_band', score: 0.12 },
      },
      { readinessEnabled: () => false, send },
    );
    expect(result.deliveryHeld).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'needs_human_qa' }),
    }));
  });

  it('flag-on non-prod legacy path delivers weak anchor with qaWarnings email', async () => {
    const prisma = {
      order: { update: vi.fn(async () => ({})) },
      generationJob: { update: vi.fn(async () => ({})) },
    };
    const send = vi.fn(async () => ({}));
    const heldGate = {
      held: true,
      orderStatus: 'needs_human_qa' as const,
      reason: 'anchor_low_confidence:hard_band',
      sendBookReadyEmail: false,
    };
    const result = await finalizePackageDelivery(
      prisma as never,
      {
        order,
        deliveryGate: heldGate,
        readUrl: 'https://app/ready?orderId=o1',
        pdfUrl: null,
        firstAudioUrl: null,
        anchorLowConfidence: { reason: 'hard_band', score: 0.12 },
      },
      { readinessEnabled: () => false, send },
    );
    expect(result.deliveryHeld).toBe(false);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      qaWarnings: expect.objectContaining({
        anchor: expect.objectContaining({ score: 0.12, band: 'hard_band' }),
      }),
    }));
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ready' }),
    }));
  });

  it('flag-on prod-like runtime ignores soft-deliver in manifest commit (still holds)', async () => {
    setEnv('VERCEL_ENV', 'production');
    const commit = vi.fn(async () => ({
      manifestStatus: 'blocked' as const,
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: 'base_book_integrity:quality_evidence_unknown:page:2',
      revision: 1,
    }));
    const result = await finalizePackageDelivery(
      { order: { update: vi.fn() }, generationJob: { update: vi.fn() } } as never,
      {
        order,
        deliveryGate: { held: false, orderStatus: 'ready', reason: null, sendBookReadyEmail: true },
        readUrl: 'https://app/ready?orderId=o1',
        pdfUrl: null,
        firstAudioUrl: null,
      },
      { readinessEnabled: () => true, commit: commit as never },
    );
    expect(result.deliveryHeld).toBe(true);
    expect(commit).toHaveBeenCalled();
  });
});
