import { describe, expect, it } from 'vitest';

import {
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  QUALITY_REGEN_BUDGET,
  evaluateQualityGate,
  qualityEvidenceFingerprint,
  resolveArtifactHoldOutcome,
  type ArtifactHashes,
  type QualityEvidenceRow,
} from '@/lib/generation-pipeline/quality-evidence';

const VERSION = QUALITY_EVALUATOR_CONTRACT_VERSION;
const SHA = 'a'.repeat(64);
const OTHER_SHA = 'b'.repeat(64);
const CONTRACT = 'contract-v1';
const ARTIFACT = 'page:6';

function row(overrides: Partial<QualityEvidenceRow> = {}): QualityEvidenceRow {
  return {
    artifactKey: ARTIFACT,
    assetSha256: SHA,
    verdict: 'evidence_unknown',
    evaluatorContractVersion: VERSION,
    reason: 'safety:unverified+vision_malformed',
    regenCount: 0,
    contractHash: CONTRACT,
    safetyOverride: false,
    safetyOverrideSha256: null,
    humanReviewVerified: true,
    humanReviewActionDigest: 'action-digest-a',
    ...overrides,
  };
}

function hashes(sha = SHA): ArtifactHashes {
  return new Map([[ARTIFACT, sha]]);
}

function evaluate(evidence: QualityEvidenceRow, current: ArtifactHashes = hashes(), activeContractHash = CONTRACT) {
  return evaluateQualityGate([ARTIFACT], [evidence], current, { activeContractHash });
}

describe('Gate 1 — exact-byte human verification of safety:unverified', () => {
  it('treats a current admissible evidence_unknown safety:unverified+vision_malformed review as passed-equivalent without a hard hold', () => {
    const evidence = row();
    const outcome = resolveArtifactHoldOutcome(evidence, SHA, {
      contractVersion: VERSION,
      activeContractHash: CONTRACT,
    });
    expect(outcome).toMatchObject({
      admissible: true,
      humanVerified: true,
      passedEquivalent: true,
      hardHold: false,
      kind: null,
    });

    const result = evaluate(evidence);
    expect(result).toMatchObject({
      status: 'passed',
      reason: null,
      failedArtifacts: [],
      unknownArtifacts: [],
      contractHardHold: false,
      hardHoldKind: null,
    });
    const perArtifact = (result.evidence as {
      perArtifact: Record<string, { state: string; actionDigest: string | null }>;
    }).perArtifact;
    expect(perArtifact[ARTIFACT]).toEqual({
      state: 'human_verified_unverified',
      actionDigest: 'action-digest-a',
    });
    expect(evidence.verdict).toBe('evidence_unknown');
    expect(evidence.reason).toBe('safety:unverified+vision_malformed');
  });

  it('never lets humanReviewVerified turn a failed machine verdict into a pass', () => {
    const evidence = row({ verdict: 'failed', regenCount: QUALITY_REGEN_BUDGET });
    const outcome = resolveArtifactHoldOutcome(evidence, SHA, {
      contractVersion: VERSION,
      activeContractHash: CONTRACT,
    });
    expect(outcome).toMatchObject({
      admissible: true,
      humanVerified: false,
      passedEquivalent: false,
      hardHold: true,
      kind: 'safety',
    });

    const result = evaluate(evidence);
    expect(result.status).toBe('failed');
    expect(result.failedArtifacts).toEqual([ARTIFACT]);
    expect(result.contractHardHold).toBe(true);
    expect(result.hardHoldKind).toBe('safety');
  });

  it.each([
    {
      name: 'stale evaluator version',
      evidence: row({ evaluatorContractVersion: 'quality-evaluator/old' }),
      current: hashes(),
      activeContractHash: CONTRACT,
    },
    {
      name: 'wrong delivered bytes',
      evidence: row(),
      current: hashes(OTHER_SHA),
      activeContractHash: CONTRACT,
    },
    {
      name: 'superseded contract',
      evidence: row(),
      current: hashes(),
      activeContractHash: 'contract-v2',
    },
  ])('fails closed when the reviewed evidence has $name', ({ evidence, current, activeContractHash }) => {
    const outcome = resolveArtifactHoldOutcome(evidence, current.get(ARTIFACT) ?? null, {
      contractVersion: VERSION,
      activeContractHash,
    });
    expect(outcome.admissible).toBe(false);
    expect(outcome.humanVerified).toBe(false);
    expect(outcome.passedEquivalent).toBe(false);

    const result = evaluate(evidence, current, activeContractHash);
    expect(result.status).toBe('evidence_unknown');
    expect(result.unknownArtifacts).toEqual([ARTIFACT]);
    expect(result.contractHardHold).toBe(true);
    expect(result.hardHoldKind).toBe('safety');
  });

  it('rejects a human review when any reason component is outside the explicit unverified allowlist', () => {
    const evidence = row({
      reason: 'safety:unverified+vision_malformed+anatomy_failed',
    });
    const outcome = resolveArtifactHoldOutcome(evidence, SHA, {
      contractVersion: VERSION,
      activeContractHash: CONTRACT,
    });
    expect(outcome).toMatchObject({
      admissible: true,
      humanVerified: false,
      passedEquivalent: false,
      hardHold: true,
      kind: 'safety',
    });
    const result = evaluate(evidence);
    expect(result.status).toBe('evidence_unknown');
    expect(result.unknownArtifacts).toEqual([ARTIFACT]);
  });

  it('changes the readiness fingerprint when either the review binding or immutable action digest changes', () => {
    const reviewedAt = new Date('2026-09-02T03:00:00.000Z');
    const reviewed = row({
      reviewStatus: 'human_verified_unverified_release/v1',
      reviewedAssetSha256: SHA,
      reviewedContractHash: CONTRACT,
      reviewedBy: 'admin:exact_byte_human_verification',
      reviewedAt,
      reviewReason: JSON.stringify({
        version: 'human_verified_unverified_release/v1',
        actionId: 'action-a',
        reason: 'exact bytes inspected',
      }),
      humanReviewActionDigest: 'action-digest-a',
    });
    const reviewBindingChanged = {
      ...reviewed,
      reviewReason: JSON.stringify({
        version: 'human_verified_unverified_release/v1',
        actionId: 'action-b',
        reason: 'exact bytes inspected',
      }),
    };
    const actionDigestChanged = {
      ...reviewed,
      humanReviewActionDigest: 'action-digest-b',
    };

    const baseline = qualityEvidenceFingerprint([reviewed]);
    expect(qualityEvidenceFingerprint([reviewBindingChanged])).not.toBe(baseline);
    expect(qualityEvidenceFingerprint([actionDigestChanged])).not.toBe(baseline);
  });
});
