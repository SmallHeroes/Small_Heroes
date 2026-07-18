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

  it('(round-6 Unit C) a plain HOLD and its soft-deliver SHIP key DIFFERENTLY — hold fence-independent, ship fence-bound', () => {
    const hold = buildReadinessCommitReceiptBinding(baseArgs, 3, blockedDecision, false);
    const soft = buildReadinessCommitReceiptBinding(baseArgs, 3, blockedDecision, true);
    // The soft-deliver flag flips the SAME blocked decision from a hold (needs_human_qa) to a soft SHIP (ready). Under
    // Unit C the plain hold is fence-INDEPENDENT (holdfenceNA) while the ship keeps its load-time fence (round-5 P1),
    // so they are now distinct operations. (Round-5 keyed BOTH on the same load-time fence → identical key.)
    expect(hold.operationKey).not.toBe(soft.operationKey);
    expect(hold.operationKey).toContain(':holdfenceNA');
    expect(soft.operationKey).toContain(':fence0');
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

  it('(round-6 Unit C) anchor hold vs its soft-deliver ship: hold fence-independent, ship fence-bound (distinct keys)', () => {
    const hold = buildReadinessCommitReceiptBinding(baseArgs, 2, passedDecision, false);
    const soft = buildReadinessCommitReceiptBinding(baseArgs, 2, passedDecision, true);
    expect(hold.operationKey).not.toBe(soft.operationKey);
    expect(hold.operationKey).toContain(':holdfenceNA'); // anchor hold → needs_human_qa → fence-independent
    expect(soft.operationKey).toContain(':fence0');       // soft-deliver ships → fence-bound
    expect(hold.plan.enqueued).toBe(false);
    expect(soft.plan.enqueued).toBe(true);
    expect(hold.payloadHash).not.toBe(soft.payloadHash);
  });

  // ── (round-6 Unit C) the load-time fence belongs to SHIP/release identity ONLY — a plain HOLD is fence-independent ─
  it('(Unit C) a plain HOLD keys fence-INDEPENDENTLY: a redrive at a bumped fence derives the SAME key → replays, never double-applies', () => {
    // A hold BUMPS its own fence, so a fresh cross-worker redrive loads N+1. If the fence were in the key the redrive
    // would derive a NEW key and APPLY THE HOLD AGAIN (a second bump). Fence-independent → same key → the redrive
    // replays the recorded hold at the atomic short-circuit (exactly-once). This is the Codex round-6 Unit C fix.
    const firstAtFence5 = buildReadinessCommitReceiptBinding(baseArgs, 3, blockedDecision, false, 5);
    const redriveAtFence6 = buildReadinessCommitReceiptBinding(baseArgs, 3, blockedDecision, false, 6);
    expect(firstAtFence5.plan).toMatchObject({ enqueued: false, orderStatus: 'needs_human_qa' }); // it IS a plain hold
    expect(firstAtFence5.operationKey).toBe(redriveAtFence6.operationKey); // fence moved 5→6; key unchanged → replay
    expect(firstAtFence5.operationKey).toContain(':holdfenceNA');
    expect(firstAtFence5.operationKey).not.toContain(':fence5');
    expect(firstAtFence5.operationKey).not.toContain(':fence6');
  });

  it('(round-5 P1, preserved) a SHIP keys ON the load-time fence: a redrive at a moved fence derives a DIFFERENT key → re-CAS, no stale ready replay', () => {
    const passArgs = { orderId: 'o1', anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null };
    const shipAt7 = buildReadinessCommitReceiptBinding(passArgs, 3, passedDecision, false, 7);
    const shipAt8 = buildReadinessCommitReceiptBinding(passArgs, 3, passedDecision, false, 8); // a competing hold moved 7→8
    expect(shipAt7.plan).toMatchObject({ enqueued: true, orderStatus: 'ready' });
    expect(shipAt7.operationKey).toContain(':fence7');
    expect(shipAt7.operationKey).not.toBe(shipAt8.operationKey); // a stale ship cannot replay at a moved fence
  });

  it('(Unit C) an authorized RELEASE (requireHold → ship) carries the fence in its identity', () => {
    const relArgs = { ...baseArgs, anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null, requireHold: { deliveryHoldReason: 'anchor_low_confidence:soft_band' } };
    const rel = buildReadinessCommitReceiptBinding(relArgs, 3, passedDecision, false, 4);
    expect(rel.plan).toMatchObject({ orderStatus: 'ready' });
    expect(rel.operationKey).toContain(':rh:anchor_low_confidence:soft_band:');
    expect(rel.operationKey).toContain(':fence4'); // a release is a delivery-authorizing commit → fence-bound
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
