import { describe, it, expect } from 'vitest';
import type { HumanQaHoldKind } from '@prisma/client';
import { deriveHumanQaHoldKindFromOrder, computeHoldFingerprint } from '@/lib/human-qa/record-hold';
import {
  planReconcileOrder,
  deriveHumanReasonFromMarker,
  RECONCILE_LEGACY_RAW_REASON,
  type ReconcileOrderRow,
} from '@/lib/human-qa/reconcile-plan';

// ─── Fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────

function orderRow(over: Partial<ReconcileOrderRow> = {}): ReconcileOrderRow {
  return {
    id: 'ord_1',
    deliveryHoldReason: null,
    manualReviewRequired: false,
    childName: 'Noa',
    inputVersion: 3,
    visualContractHash: 'ch_abc',
    ...over,
  };
}

// ─── deriveHumanQaHoldKindFromOrder (pure classifier) ─────────────────────────────────────────────────────────

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

  it('maps manualReviewRequired=true with a coupon-fence reason → payment_integrity', () => {
    expect(
      deriveHumanQaHoldKindFromOrder({
        deliveryHoldReason: 'coupon_paid_late_over_cap',
        manualReviewRequired: true,
      }),
    ).toBe('payment_integrity');
  });

  it('maps manualReviewRequired=true with NO reason → payment_integrity', () => {
    expect(deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: null, manualReviewRequired: true })).toBe(
      'payment_integrity',
    );
  });

  it('falls back to legacy_unknown for a null marker and no manual-review flag', () => {
    expect(deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: null, manualReviewRequired: false })).toBe(
      'legacy_unknown',
    );
    expect(deriveHumanQaHoldKindFromOrder({})).toBe('legacy_unknown');
  });

  it('falls back to legacy_unknown for an unrecognized marker with no manual-review flag', () => {
    expect(deriveHumanQaHoldKindFromOrder({ deliveryHoldReason: 'some_future_hold:whatever' })).toBe(
      'legacy_unknown',
    );
  });

  it('the delivery marker wins over the manual-review flag (marker checked first)', () => {
    // A base_book hold that ALSO carries manualReviewRequired is still classified by its marker, never payment.
    expect(
      deriveHumanQaHoldKindFromOrder({
        deliveryHoldReason: 'safety_hold:hazard:page:1',
        manualReviewRequired: true,
      }),
    ).toBe('safety');
  });
});

// ─── planReconcileOrder (pure plan) ───────────────────────────────────────────────────────────────────────────

describe('planReconcileOrder', () => {
  it('plans a base_book case for a safety hold with the exact recordHumanQaHoldInTx args', () => {
    const plan = planReconcileOrder(
      orderRow({ id: 'ord_safety', deliveryHoldReason: 'safety_hold:hazard:page:2:child_on_railing' }),
    );
    expect(plan.kind).toBe('safety');
    expect(plan.scope).toBe('base_book');
    expect(plan.activeKey).toBe('ord_safety:base_book');
    expect(plan.needsOperatorAttention).toBe(false);
    expect(plan.recordArgs).toEqual({
      orderId: 'ord_safety',
      scope: 'base_book',
      kind: 'safety',
      rawReason: 'safety_hold:hazard:page:2:child_on_railing',
      humanReason: deriveHumanReasonFromMarker('safety', 'safety_hold:hazard:page:2:child_on_railing'),
      childName: 'Noa',
      inputVersion: 3,
      contractHash: 'ch_abc',
      sourceManifestId: null,
      artifactRefs: null,
    });
  });

  it('plans a payment scope + activeKey for a payment_integrity hold', () => {
    const plan = planReconcileOrder(
      orderRow({ id: 'ord_pay', deliveryHoldReason: 'coupon_paid_late_over_cap', manualReviewRequired: true }),
    );
    expect(plan.kind).toBe('payment_integrity');
    expect(plan.scope).toBe('payment');
    expect(plan.activeKey).toBe('ord_pay:payment');
    expect(plan.recordArgs.rawReason).toBe('coupon_paid_late_over_cap');
    expect(plan.needsOperatorAttention).toBe(false);
  });

  it('backfills a legacy_unknown order (cmrnuhsva) AND flags it for operator attention', () => {
    // cmrnuhsva proved the silent-hold gap: held in needs_human_qa with no case + no recognizable marker.
    const plan = planReconcileOrder(orderRow({ id: 'cmrnuhsva', deliveryHoldReason: null }));
    expect(plan.kind).toBe('legacy_unknown');
    expect(plan.scope).toBe('base_book');
    expect(plan.activeKey).toBe('cmrnuhsva:base_book');
    expect(plan.needsOperatorAttention).toBe(true);
    // Missing marker → the stable fallback raw reason (so re-runs keep the same fingerprint).
    expect(plan.recordArgs.rawReason).toBe(RECONCILE_LEGACY_RAW_REASON);
  });

  it('passes childName / inputVersion / visualContractHash through, with null manifest + artifacts', () => {
    const plan = planReconcileOrder(
      orderRow({ childName: 'דניאל', inputVersion: 7, visualContractHash: null }),
    );
    expect(plan.recordArgs.childName).toBe('דניאל');
    expect(plan.recordArgs.inputVersion).toBe(7);
    expect(plan.recordArgs.contractHash).toBeNull();
    expect(plan.recordArgs.sourceManifestId).toBeNull();
    expect(plan.recordArgs.artifactRefs).toBeNull();
  });

  it('derives base_book scope for every non-payment kind', () => {
    const cases: Array<{ reason: string | null; kind: HumanQaHoldKind }> = [
      { reason: 'safety_hold:x', kind: 'safety' },
      { reason: 'contract_world_hold:x', kind: 'contract_world' },
      { reason: 'anchor_low_confidence:soft_band', kind: 'anchor' },
      { reason: null, kind: 'legacy_unknown' },
    ];
    for (const c of cases) {
      const plan = planReconcileOrder(orderRow({ deliveryHoldReason: c.reason }));
      expect(plan.kind).toBe(c.kind);
      expect(plan.scope).toBe('base_book');
    }
  });
});

// ─── Idempotency of the reconcile mapping (determinism ⇒ stable fingerprint) ──────────────────────────────────

describe('reconcile mapping is idempotent', () => {
  it('planning the same order twice yields deeply-equal plans (no clock / randomness)', () => {
    const order = orderRow({ id: 'ord_idem', deliveryHoldReason: 'anchor_low_confidence:soft_band' });
    expect(planReconcileOrder(order)).toEqual(planReconcileOrder(order));
  });

  it('produces a STABLE hold fingerprint across re-runs, so recordHumanQaHoldInTx would go idempotent', () => {
    // computeHoldFingerprint over the planned args is exactly what recordHumanQaHoldInTx hashes; equal fingerprints
    // on a re-run mean the existing active case matches → the applier writes nothing new.
    const order = orderRow({ id: 'ord_fp', deliveryHoldReason: 'contract_world_hold:quality_failed:page:2' });
    const a = planReconcileOrder(order).recordArgs;
    const b = planReconcileOrder(order).recordArgs;
    expect(computeHoldFingerprint(a)).toBe(computeHoldFingerprint(b));
  });

  it('legacy_unknown re-runs are also fingerprint-stable (fixed fallback raw reason)', () => {
    const order = orderRow({ id: 'cmrnuhsva', deliveryHoldReason: null });
    const a = planReconcileOrder(order).recordArgs;
    const b = planReconcileOrder(order).recordArgs;
    expect(a.rawReason).toBe(RECONCILE_LEGACY_RAW_REASON);
    expect(computeHoldFingerprint(a)).toBe(computeHoldFingerprint(b));
  });
});
