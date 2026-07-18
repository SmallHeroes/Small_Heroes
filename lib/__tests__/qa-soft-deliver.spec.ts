import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildQaWarningsFromAnchorHold,
  buildQaWarningsFromReadinessBlock,
  canUseQaSoftDeliver,
} from '@/lib/qa-soft-deliver';
import { buildReadinessCommitReceiptBinding } from '@/lib/generation-pipeline/readiness-manifest';
import { BASE_BOOK_SCOPE } from '@/lib/generation-pipeline/integrity-gate';
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

describe('readiness commit receipt binding (soft-deliver keyed)', () => {
  const baseArgs = {
    orderId: 'o1',
    anchorAllowsDelivery: false,
    anchorOrderStatus: 'needs_human_qa',
    anchorReason: 'anchor_low_confidence:hard_band',
    anchorLowConfidence: { reason: 'hard_band' as const, score: 0.12 },
  };
  const blockedDecision = {
    status: 'blocked' as const,
    reason: 'quality_evidence_unknown:page:2',
    inputsHash: 'hash-abc',
    evidence: { quality: { perArtifact: { 'page:2': { state: 'missing' } } } },
    blockExceptionKind: 'infra_transient' as const,
    blockClassification: 'quality_evidence_unknown',
    contractHardHold: false,
    hardHoldKind: null,
  };
  const passedDecision = {
    status: 'passed' as const,
    reason: null,
    inputsHash: 'hash-pass',
    evidence: {},
    blockExceptionKind: null,
    blockClassification: 'passed',
    contractHardHold: false,
    hardHoldKind: null,
  };

  it('keys receipt on effective outcome, not the env flag — clean pass unchanged when flag toggles', () => {
    const passArgs = {
      orderId: 'o1',
      anchorAllowsDelivery: true,
      anchorOrderStatus: 'ready',
      anchorReason: null,
    };
    const flagOff = buildReadinessCommitReceiptBinding(passArgs, 3, passedDecision, false);
    const flagOn = buildReadinessCommitReceiptBinding(passArgs, 3, passedDecision, true);
    expect(flagOff.operationKey).toBe(flagOn.operationKey);
    expect(flagOff.payloadHash).toBe(flagOn.payloadHash);
    expect(flagOff.operationKey).not.toContain(':sd');
  });

  it('same operationKey but different payloadHash when soft-deliver changes blocked disposition', () => {
    const hold = buildReadinessCommitReceiptBinding(baseArgs, 3, blockedDecision, false);
    const soft = buildReadinessCommitReceiptBinding(baseArgs, 3, blockedDecision, true);
    expect(hold.operationKey).toBe(soft.operationKey);
    expect(hold.payloadHash).not.toBe(soft.payloadHash);
    expect(soft.plan).toMatchObject({ enqueued: true, orderStatus: 'ready', usesSoftDeliver: true });
    expect(hold.plan).toMatchObject({ enqueued: false, orderStatus: 'needs_human_qa', usesSoftDeliver: false });
  });

  it('includes scope in operationKey', () => {
    const binding = buildReadinessCommitReceiptBinding(baseArgs, 3, blockedDecision, true);
    expect(binding.operationKey).toContain(`:${BASE_BOOK_SCOPE}:`);
  });

  it('(Slice A) a contract-world hard-hold is NEVER soft-delivered — holds even with QA_SOFT_DELIVER on', () => {
    const hardHold = { ...blockedDecision, reason: 'quality_failed:page:2', blockExceptionKind: 'quality_failed' as const, contractHardHold: true, hardHoldKind: 'contract_world' as const };
    const soft = buildReadinessCommitReceiptBinding(baseArgs, 3, hardHold, true);
    expect(soft.plan).toMatchObject({ enqueued: false, orderStatus: 'needs_human_qa', usesSoftDeliver: false });
  });

  it('anchor hold: same key, different payload when soft-deliver applies', () => {
    const hold = buildReadinessCommitReceiptBinding(baseArgs, 2, passedDecision, false);
    const soft = buildReadinessCommitReceiptBinding(baseArgs, 2, passedDecision, true);
    expect(hold.operationKey).toBe(soft.operationKey);
    expect(hold.plan.enqueued).toBe(false);
    expect(soft.plan.enqueued).toBe(true);
    expect(hold.payloadHash).not.toBe(soft.payloadHash);
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
    // (Human-QA Slice 1) the legacy path now wraps its two writes in prisma.$transaction; pass `prisma` as its own
    // tx so `prisma.order.update` (the asserted mock) is still what the legacy path calls, plus no-op stubs for the
    // additive review-case writes. Decision assertions are unchanged.
    const prisma = {
      order: {
        update: vi.fn(async () => ({})),
        findUnique: vi.fn(async () => ({ childName: 'K', inputVersion: 0, visualContractHash: null, deliveryFenceVersion: 0 })),
      },
      generationJob: { update: vi.fn(async () => ({})) },
      humanQaReviewCase: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
      operatorNotificationOutbox: { findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
      // (delivery fence round-5) the legacy ship/park CAS is $executeRaw; $queryRaw carries writeOrderHoldFenced's read.
      $queryRaw: vi.fn(async () => [{ id: 'hqc-test', fence: 0, rank: 1, status: 'generating', inputVersion: 0 }]),
      $executeRaw: vi.fn(async () => 1),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(prisma));
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
        safetyGate: { held: false, reason: null },
        readUrl: 'https://app/ready?orderId=o1',
        pdfUrl: null,
        firstAudioUrl: null,
        anchorLowConfidence: { reason: 'hard_band', score: 0.12 },
      },
      { readinessEnabled: () => false, send },
    );
    expect(result.deliveryHeld).toBe(true);
    expect(send).not.toHaveBeenCalled();
    // (delivery fence round-5) the legacy park is now writeOrderHoldFenced ($executeRaw), not a bare order.update.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('flag-on non-prod legacy path delivers weak anchor with qaWarnings email', async () => {
    // (Human-QA Slice 1) the legacy path now wraps its two writes in prisma.$transaction; pass `prisma` as its own
    // tx so `prisma.order.update` (the asserted mock) is still what the legacy path calls, plus no-op stubs for the
    // additive review-case writes. Decision assertions are unchanged.
    const prisma = {
      order: {
        update: vi.fn(async () => ({})),
        findUnique: vi.fn(async () => ({ childName: 'K', inputVersion: 0, visualContractHash: null, deliveryFenceVersion: 0 })),
      },
      generationJob: { update: vi.fn(async () => ({})) },
      humanQaReviewCase: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
      operatorNotificationOutbox: { findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
      // (delivery fence round-5) the legacy ship/park CAS is $executeRaw; $queryRaw carries writeOrderHoldFenced's read.
      $queryRaw: vi.fn(async () => [{ id: 'hqc-test', fence: 0, rank: 1, status: 'generating', inputVersion: 0 }]),
      $executeRaw: vi.fn(async () => 1),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(prisma));
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
        safetyGate: { held: false, reason: null },
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
    // (delivery fence round-5) the legacy soft-deliver `ready` is now the ship CAS ($executeRaw), gated on winning.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
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
        safetyGate: { held: false, reason: null },
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
