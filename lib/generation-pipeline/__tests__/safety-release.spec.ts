import { describe, it, expect } from 'vitest';

import {
  assertReleaseAdmissible,
  projectReleaseOntoQuality,
  releaseTargetOf,
  releaseAuditIdempotencyKey,
  ReleaseAdmissibilityError,
  type ReleaseAdmissibilityInputs,
} from '@/lib/generation-pipeline/safety-release';
import { QUALITY_EVALUATOR_CONTRACT_VERSION, type QualityEvidenceRow } from '@/lib/generation-pipeline/quality-evidence';

const V = QUALITY_EVALUATOR_CONTRACT_VERSION;
const SHA = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

function evRow(over: Partial<QualityEvidenceRow> = {}): QualityEvidenceRow {
  return {
    artifactKey: 'page:4', assetSha256: SHA, verdict: 'failed', evaluatorContractVersion: V,
    reason: 'safety:unsafe_pose', regenCount: 0, contractHash: null, safetyOverride: false, safetyOverrideSha256: null, ...over,
  };
}
/** A fully-admissible baseline; each test mutates ONE dimension to trigger exactly one rule. */
function inputs(over: Partial<ReleaseAdmissibilityInputs> = {}): ReleaseAdmissibilityInputs {
  return {
    request: {
      artifactKey: 'page:4', expectedMarker: 'safety_hold:hazard:page:4:unsafe_pose',
      overriddenHazards: ['unsafe_pose'], assetSha256: SHA, overrideReason: 'child is on the floor, not the railing', actor: 'op',
    },
    currentMarker: 'safety_hold:hazard:page:4:unsafe_pose',
    currentHash: SHA,
    targetRow: evRow(),
    assetHazards: ['unsafe_pose'],
    assetContentSha256: SHA,
    hasOpenSafetyCase: true,
    hasPaymentFence: false,
    contractVersion: V,
    activeContractHash: null,
    ...over,
  };
}
const ruleOf = (fn: () => unknown): string => {
  try { fn(); return '(did not throw)'; } catch (e) { return e instanceof ReleaseAdmissibilityError ? e.rule : `(${(e as Error).message})`; }
};

describe('assertReleaseAdmissible — every §3 rule refuses with its specific reason (most-specific first)', () => {
  it('the fully-admissible baseline PASSES and binds the override to the current bytes', () => {
    expect(assertReleaseAdmissible(inputs())).toEqual({ overrideSha256: SHA });
  });

  it('marker_not_safety_hazard — an unverified marker can never be released (cannot override ignorance)', () => {
    expect(ruleOf(() => assertReleaseAdmissible(inputs({
      request: { ...inputs().request, expectedMarker: 'safety_hold:unverified:page:4' },
      currentMarker: 'safety_hold:unverified:page:4',
    })))).toBe('marker_not_safety_hazard');
  });

  it('marker_changed — a re-hold moved the marker under the operator', () => {
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ currentMarker: 'safety_hold:hazard:page:9:other' })))).toBe('marker_changed');
  });

  it('payment_fence_active — an active payment fence blocks any delivery action', () => {
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ hasPaymentFence: true })))).toBe('payment_fence_active');
  });

  it('no_active_safety_case — there must be an open safety case to resolve', () => {
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ hasOpenSafetyCase: false })))).toBe('no_active_safety_case');
  });

  it('sha_missing — the asset carries no content SHA, so the bytes cannot be identified', () => {
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ assetContentSha256: null })))).toBe('sha_missing');
  });

  it('asset_hash_mismatch — operator hash / current bytes / bound asset SHA must ALL agree', () => {
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ request: { ...inputs().request, assetSha256: OTHER } })))).toBe('asset_hash_mismatch');
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ currentHash: OTHER })))).toBe('asset_hash_mismatch');
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ assetContentSha256: OTHER })))).toBe('asset_hash_mismatch');
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ request: { ...inputs().request, assetSha256: 'A'.repeat(64) } })))).toBe('asset_hash_mismatch');
  });

  it('evidence_stale — a stale evaluator version / superseded contract makes the evidence inadmissible', () => {
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ targetRow: evRow({ evaluatorContractVersion: 'qa-v0' }) })))).toBe('evidence_stale');
    // the evidence row's OWN assetSha256 must also match the current bytes (hash-mismatch on the row → inadmissible)
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ targetRow: evRow({ assetSha256: OTHER }) })))).toBe('evidence_stale');
  });

  it('not_safety_hard_hold — the SHARED outcome must be a determinate SAFETY hard-hold (never contract_world / released / passed)', () => {
    // a contract_world-only row → kind contract_world
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ targetRow: evRow({ reason: 'contract_world:door' }), assetHazards: [] })))).toBe('not_safety_hard_hold');
    // an already-released row → hardHold false
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ targetRow: evRow({ safetyOverride: true, safetyOverrideSha256: SHA }) })))).toBe('not_safety_hard_hold');
    // a passed row → not a hold
    expect(ruleOf(() => assertReleaseAdmissible(inputs({ targetRow: evRow({ verdict: 'passed', reason: null }), assetHazards: [] })))).toBe('not_safety_hard_hold');
  });

  it('hazards_not_subset — a found hazard outside the operator\'s overridden set refuses', () => {
    expect(ruleOf(() => assertReleaseAdmissible(inputs({
      targetRow: evRow({ reason: 'safety:unsafe_pose|height' }),
      assetHazards: ['unsafe_pose', 'height'],
      request: { ...inputs().request, overriddenHazards: ['unsafe_pose'] }, // 'height' not overridden
    })))).toBe('hazards_not_subset');
    // …and it PASSES when every found hazard is overridden
    expect(assertReleaseAdmissible(inputs({
      targetRow: evRow({ reason: 'safety:unsafe_pose|height' }),
      assetHazards: ['unsafe_pose', 'height'],
      request: { ...inputs().request, overriddenHazards: ['height', 'unsafe_pose', 'extra'] },
    }))).toEqual({ overrideSha256: SHA });
  });
});

describe('projectReleaseOntoQuality — patches EXACTLY ONE row, non-mutating (fingerprint stays raw)', () => {
  const rows = [evRow({ artifactKey: 'cover', reason: null, verdict: 'passed' }), evRow({ artifactKey: 'page:4' })];
  const release = { artifactKey: 'page:4', expectedMarker: 'safety_hold:hazard:page:4:x', overriddenHazards: ['unsafe_pose'], assetSha256: SHA, overrideReason: 'r', actor: 'op' };

  it('the target row gains the override; every OTHER row is the SAME reference; the input array is untouched', () => {
    const out = projectReleaseOntoQuality(rows, release);
    expect(out).not.toBe(rows);
    expect(out[0]).toBe(rows[0]);                    // cover row — same reference, unchanged
    expect(out[1]).not.toBe(rows[1]);                // page:4 — a new object
    expect(out[1]).toMatchObject({ safetyOverride: true, safetyOverrideSha256: SHA });
    expect(rows[1].safetyOverride).toBe(false);      // the ORIGINAL is not mutated (raw fingerprint stays raw)
  });

  it('no matching artifactKey → every row is the same reference (a no-op projection)', () => {
    const out = projectReleaseOntoQuality(rows, { ...release, artifactKey: 'page:99' });
    expect(out[0]).toBe(rows[0]);
    expect(out[1]).toBe(rows[1]);
  });
});

describe('releaseTargetOf', () => {
  it('classifies cover and page:<n>, and throws on a malformed key', () => {
    expect(releaseTargetOf('cover')).toEqual({ kind: 'cover' });
    expect(releaseTargetOf('page:4')).toEqual({ kind: 'page', pageNumber: 4 });
    expect(() => releaseTargetOf('nonsense')).toThrow(ReleaseAdmissibilityError);
  });
});

describe('releaseAuditIdempotencyKey — §4 + re-gate: artifactKey AND caseId in the key, so legitimate distinct releases never collide', () => {
  const order = 'order_abc';
  const caseA = 'case_1';
  const caseB = 'case_2';
  it('two artifacts in the SAME order+case with IDENTICAL bytes produce DISTINCT keys (both releasable)', () => {
    const k1 = releaseAuditIdempotencyKey(order, caseA, 'page:3', SHA);
    const k2 = releaseAuditIdempotencyKey(order, caseA, 'cover', SHA);
    expect(k1).not.toBe(k2);
    expect(k1).toBe(`operator_action:release:${order}:${caseA}:page:3:${SHA}`);
    expect(k2).toBe(`operator_action:release:${order}:${caseA}:cover:${SHA}`);
  });

  it('the SAME order+case+artifact+bytes is stable (a within-cycle replay would mint the same key → the unique constraint is the backstop)', () => {
    expect(releaseAuditIdempotencyKey(order, caseA, 'page:3', SHA)).toBe(releaseAuditIdempotencyKey(order, caseA, 'page:3', SHA));
  });

  it('a NEW case cycle (re-render → byte-identical bytes → re-held under a new case) → DISTINCT key, so the re-release never collides', () => {
    expect(releaseAuditIdempotencyKey(order, caseA, 'page:3', SHA)).not.toBe(releaseAuditIdempotencyKey(order, caseB, 'page:3', SHA));
  });

  it('different bytes on the same artifact → different keys (a re-render to NEW bytes is a new record)', () => {
    expect(releaseAuditIdempotencyKey(order, caseA, 'page:3', SHA)).not.toBe(releaseAuditIdempotencyKey(order, caseA, 'page:3', OTHER));
  });
});
