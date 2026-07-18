import { describe, it, expect } from 'vitest';
import { deriveHumanQaHoldKindFromOrder, computeHoldFingerprint } from '@/lib/human-qa/record-hold';
import { classifyHoldForCase, type HoldSignals } from '@/lib/human-qa/sync-hold-case';

// ─── Fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────

function signals(over: Partial<HoldSignals> = {}): HoldSignals {
  return {
    status: 'needs_human_qa',
    deliveryHoldReason: null,
    manualReviewRequired: false,
    hasActiveRecoveryCase: false,
    ...over,
  };
}

// ─── deriveHumanQaHoldKindFromOrder (pure marker→kind classifier) ─────────────────────────────────────────────

describe('deriveHumanQaHoldKindFromOrder', () => {
  it('maps a safety_hold: marker → safety', () => {
    expect(
      deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: 'safety_hold:hazard:page:2:child_on_railing' }),
    ).toBe('safety');
  });

  it('maps a contract_world_hold: marker → contract_world', () => {
    expect(
      deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: 'contract_world_hold:quality_failed:page:2' }),
    ).toBe('contract_world');
  });

  it('maps an anchor_low_confidence: marker → anchor', () => {
    expect(deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: 'anchor_low_confidence:soft_band' })).toBe(
      'anchor',
    );
  });

  it('maps manualReviewRequired=true → payment_integrity', () => {
    expect(
      deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: 'coupon_paid_late_over_cap', manualReviewRequired: true }),
    ).toBe('payment_integrity');
    expect(deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: null, manualReviewRequired: true })).toBe(
      'payment_integrity',
    );
  });

  it('falls back to legacy_unknown for a null / unrecognized marker and no manual-review flag', () => {
    expect(deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: null, manualReviewRequired: false })).toBe(
      'legacy_unknown',
    );
    expect(deriveHumanQaHoldKindFromOrder({})).toBe('legacy_unknown');
    expect(deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: 'some_future_hold:whatever' })).toBe(
      'legacy_unknown',
    );
  });

  it('the delivery marker wins over the manual-review flag (marker checked first)', () => {
    expect(
      deriveHumanQaHoldKindFromOrder({
        deliveryHoldReason: 'safety_hold:hazard:page:1',
        manualReviewRequired: true,
      }),
    ).toBe('safety');
  });
});

// ─── classifyHoldForCase (the reconcile + post-commit classifier — P1-3) ──────────────────────────────────────
// This is THE decision the reconciler and every seam's post-commit hook share. Its job is to open a case ONLY for a
// terminal MANUAL hold, and to SKIP recoverable / recovery-owned / unknown parks (the "total classifier" NO-GO fix).

describe('classifyHoldForCase', () => {
  it('a non-held order → not_held (no case)', () => {
    expect(classifyHoldForCase(signals({ status: 'ready' }))).toEqual({ create: false, reason: 'not_held' });
    expect(classifyHoldForCase(signals({ status: 'generating' }))).toEqual({ create: false, reason: 'not_held' });
  });

  it('opens a base_book case for each terminal manual marker', () => {
    expect(classifyHoldForCase(signals({ deliveryHoldReason: 'safety_hold:hazard' }))).toEqual({
      create: true,
      kind: 'safety',
      scope: 'base_book',
    });
    expect(classifyHoldForCase(signals({ deliveryHoldReason: 'contract_world_hold:drift' }))).toEqual({
      create: true,
      kind: 'contract_world',
      scope: 'base_book',
    });
    expect(classifyHoldForCase(signals({ deliveryHoldReason: 'anchor_low_confidence:soft_band' }))).toEqual({
      create: true,
      kind: 'anchor',
      scope: 'base_book',
    });
  });

  it('opens a PAYMENT-scope case for the manual-review fence', () => {
    expect(
      classifyHoldForCase(signals({ deliveryHoldReason: 'coupon_paid_late_over_cap', manualReviewRequired: true })),
    ).toEqual({ create: true, kind: 'payment_integrity', scope: 'payment' });
  });

  it('SKIPS a recoverable base_book_integrity park (owned by the recovery loop) — the total-classifier NO-GO fix', () => {
    expect(classifyHoldForCase(signals({ deliveryHoldReason: 'base_book_integrity:missing_page:3' }))).toEqual({
      create: false,
      reason: 'recoverable',
    });
  });

  it('SKIPS an order with an active recovery ExceptionCase (unknown/null marker)', () => {
    expect(classifyHoldForCase(signals({ deliveryHoldReason: null, hasActiveRecoveryCase: true }))).toEqual({
      create: false,
      reason: 'exception_case',
    });
  });

  it('NEVER auto-backfills an unknown/null marker without explicit opt-in', () => {
    expect(classifyHoldForCase(signals({ deliveryHoldReason: null }))).toEqual({ create: false, reason: 'unknown' });
    expect(classifyHoldForCase(signals({ deliveryHoldReason: 'some_future_hold:x' }))).toEqual({
      create: false,
      reason: 'unknown',
    });
  });

  it('opens a legacy_unknown case for an unknown marker ONLY with includeUnknown', () => {
    expect(classifyHoldForCase(signals({ deliveryHoldReason: null }), { includeUnknown: true })).toEqual({
      create: true,
      kind: 'legacy_unknown',
      scope: 'base_book',
    });
  });

  it('a terminal safety marker wins even over an active recovery case (marker checked first)', () => {
    // A safety hold MUST get a case; an incidentally-active recovery case must not suppress it.
    expect(
      classifyHoldForCase(signals({ deliveryHoldReason: 'safety_hold:hazard', hasActiveRecoveryCase: true })),
    ).toEqual({ create: true, kind: 'safety', scope: 'base_book' });
  });

  it('recoverable park is skipped even while includeUnknown is set (recoverable ≠ unknown)', () => {
    expect(
      classifyHoldForCase(signals({ deliveryHoldReason: 'base_book_integrity:x' }), { includeUnknown: true }),
    ).toEqual({ create: false, reason: 'recoverable' });
  });
});

// ─── Idempotency of the recorded args (determinism ⇒ stable fingerprint) ──────────────────────────────────────

describe('reconcile mapping is idempotent', () => {
  it('produces a STABLE hold fingerprint across re-runs, so recordHumanQaHoldInTx would go idempotent', () => {
    const args = {
      orderId: 'ord_fp',
      scope: 'base_book' as const,
      kind: 'contract_world' as const,
      rawReason: 'contract_world_hold:quality_failed:page:2',
      humanReason: 'x',
      childName: 'Noa',
      inputVersion: 3,
      contractHash: 'ch_abc',
      sourceManifestId: null,
      artifactRefs: null,
    };
    expect(computeHoldFingerprint(args)).toBe(computeHoldFingerprint({ ...args }));
  });
});
