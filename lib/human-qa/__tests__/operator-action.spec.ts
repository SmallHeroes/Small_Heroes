import { describe, it, expect } from 'vitest';

import {
  evaluateOperatorActionPreconditions,
  operatorActionOperationKey,
  operatorActionRequestHash,
  type OperatorActionInput,
} from '@/lib/human-qa/operator-action';

const heldOrder = { status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:page:3' };
const openCase = { status: 'open' };

describe('evaluateOperatorActionPreconditions (the §2.3 shared-contract gates)', () => {
  it('passes when held, an open case matches, the marker matches, and no payment case is active', () => {
    expect(
      evaluateOperatorActionPreconditions({ order: heldOrder, activeCase: openCase, paymentCaseActive: false, expectedMarker: 'safety_hold:page:3' }),
    ).toEqual({ ok: true });
  });

  it('order_not_found when the (locked) order is absent', () => {
    expect(evaluateOperatorActionPreconditions({ order: null, activeCase: openCase, paymentCaseActive: false, expectedMarker: 'x' }))
      .toEqual({ ok: false, reason: 'order_not_found' });
  });

  it('not_held when the order is not needs_human_qa (a released/ready order can never be acted on)', () => {
    for (const status of ['ready', 'paid', 'generating', 'failed', 'draft']) {
      expect(evaluateOperatorActionPreconditions({ order: { status, deliveryHoldReason: 'safety_hold:x' }, activeCase: openCase, paymentCaseActive: false, expectedMarker: 'safety_hold:x' }))
        .toEqual({ ok: false, reason: 'not_held' });
    }
  });

  it('no_active_case when there is no case, or the case is not open', () => {
    expect(evaluateOperatorActionPreconditions({ order: heldOrder, activeCase: null, paymentCaseActive: false, expectedMarker: 'safety_hold:page:3' }))
      .toEqual({ ok: false, reason: 'no_active_case' });
    for (const status of ['superseded', 'resolved', 'cancelled']) {
      expect(evaluateOperatorActionPreconditions({ order: heldOrder, activeCase: { status }, paymentCaseActive: false, expectedMarker: 'safety_hold:page:3' }))
        .toEqual({ ok: false, reason: 'no_active_case' });
    }
  });

  it('marker_changed when the current hold marker differs from the one the operator acted on (optimistic concurrency)', () => {
    // a re-hold bumped the marker under the operator
    expect(evaluateOperatorActionPreconditions({ order: { status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:page:5' }, activeCase: openCase, paymentCaseActive: false, expectedMarker: 'safety_hold:page:3' }))
      .toEqual({ ok: false, reason: 'marker_changed' });
    // a null current marker never silently matches a real expected marker
    expect(evaluateOperatorActionPreconditions({ order: { status: 'needs_human_qa', deliveryHoldReason: null }, activeCase: openCase, paymentCaseActive: false, expectedMarker: 'safety_hold:page:3' }))
      .toEqual({ ok: false, reason: 'marker_changed' });
  });

  it('payment_case_active blocks the action even when everything else is valid', () => {
    expect(evaluateOperatorActionPreconditions({ order: heldOrder, activeCase: openCase, paymentCaseActive: true, expectedMarker: 'safety_hold:page:3' }))
      .toEqual({ ok: false, reason: 'payment_case_active' });
  });

  it('evaluates the gates in order: not_held wins over a stale marker; marker wins over an active payment case', () => {
    expect(evaluateOperatorActionPreconditions({ order: { status: 'ready', deliveryHoldReason: 'other' }, activeCase: openCase, paymentCaseActive: true, expectedMarker: 'safety_hold:page:3' }))
      .toEqual({ ok: false, reason: 'not_held' });
    expect(evaluateOperatorActionPreconditions({ order: { status: 'needs_human_qa', deliveryHoldReason: 'other' }, activeCase: openCase, paymentCaseActive: true, expectedMarker: 'safety_hold:page:3' }))
      .toEqual({ ok: false, reason: 'marker_changed' });
  });
});

describe('operatorActionOperationKey — the exactly-once fence key', () => {
  it('is scoped by kind + orderId so the same header on a different action or order cannot collide', () => {
    expect(operatorActionOperationKey('rerender', 'ord_1', 'hdr-abc')).toBe('operator_action:rerender:ord_1:hdr-abc');
    expect(operatorActionOperationKey('release', 'ord_1', 'hdr-abc')).not.toBe(operatorActionOperationKey('rerender', 'ord_1', 'hdr-abc'));
    expect(operatorActionOperationKey('rerender', 'ord_2', 'hdr-abc')).not.toBe(operatorActionOperationKey('rerender', 'ord_1', 'hdr-abc'));
  });
});

const baseInput: OperatorActionInput = { orderId: 'ord_1', idempotencyKey: 'k', kind: 'rerender', actor: 'op', expectedMarker: 'safety_hold:page:3' };

describe('operatorActionRequestHash — same-key/different-request fail-closed material', () => {
  it('is stable and independent of targetArtifacts / overriddenHazards ORDER', () => {
    const a = operatorActionRequestHash({ ...baseInput, targetArtifacts: ['page:3', 'cover'], overriddenHazards: ['b', 'a'] });
    const b = operatorActionRequestHash({ ...baseInput, targetArtifacts: ['cover', 'page:3'], overriddenHazards: ['a', 'b'] });
    expect(a).toBe(b);
  });

  it('changes when the note, marker, targets, hazards, reason, or asset hash changes', () => {
    const base = operatorActionRequestHash(baseInput);
    expect(operatorActionRequestHash({ ...baseInput, note: 'the child is away from the railing' })).not.toBe(base);
    expect(operatorActionRequestHash({ ...baseInput, expectedMarker: 'safety_hold:page:4' })).not.toBe(base);
    expect(operatorActionRequestHash({ ...baseInput, targetArtifacts: ['page:3'] })).not.toBe(base);
    expect(operatorActionRequestHash({ ...baseInput, overriddenHazards: ['railing'] })).not.toBe(base);
    expect(operatorActionRequestHash({ ...baseInput, overrideReason: 'visibly safe' })).not.toBe(base);
    expect(operatorActionRequestHash({ ...baseInput, assetSha256: 'deadbeef' })).not.toBe(base);
  });
});
