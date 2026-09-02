import { describe, expect, it } from 'vitest';
import {
  evaluateSafetyDeliveryGate,
  projectHumanVerificationOntoGateInputs,
  projectPersistedHumanVerificationsOntoGateInputs,
  projectSafetyOverrideOntoGateInputs,
  type SafetyGateInputs,
} from './safety-delivery-gate';
import type { QualityEvidenceRow } from './quality-evidence';

const SHA_P1 = 'a'.repeat(64);
const SHA_P2 = 'b'.repeat(64);
const SHA_COVER = 'c'.repeat(64);
const WRONG = 'd'.repeat(64);

function book(overrides: Partial<SafetyGateInputs> = {}): SafetyGateInputs {
  return {
    coverImageUrl: 'https://cdn.example/x/cover.png',
    coverSafetyVerified: true,
    coverSafetyHazards: [],
    coverSafetyContentSha256: SHA_COVER,
    coverSafetyOverriddenHazards: [],
    coverSafetyOverrideSha256: null,
    pages: [],
    ...overrides,
  };
}

function hazardPage(pageNumber: number, sha: string, hazards: string[] = ['sharp_object']) {
  return {
    pageNumber,
    imageAsset: {
      safetyVerified: true,
      safetyHazards: hazards,
      safetyContentSha256: sha,
      safetyOverriddenHazards: [] as string[],
      safetyOverrideSha256: null as string | null,
    },
  };
}

function unverifiedPage(pageNumber: number, sha: string) {
  return {
    pageNumber,
    imageAsset: {
      safetyVerified: false,
      safetyHazards: [] as string[],
      safetyContentSha256: sha,
      safetyOverriddenHazards: [] as string[],
      safetyOverrideSha256: null as string | null,
    },
  };
}

describe('evaluateSafetyDeliveryGate — the readiness-independent physical-safety gate (moved core)', () => {
  it('a missing book is never held', () => {
    expect(evaluateSafetyDeliveryGate(null)).toEqual({ held: false, reason: null });
  });

  it('a clean, verified-safe book is not held', () => {
    expect(evaluateSafetyDeliveryGate(book({ pages: [hazardPage(1, SHA_P1, [])] }))).toEqual({ held: false, reason: null });
  });

  it('an unverified asset holds (unverified) — you cannot override ignorance', () => {
    const b = book({ pages: [{ pageNumber: 1, imageAsset: { safetyVerified: false, safetyHazards: [], safetyContentSha256: null, safetyOverriddenHazards: [], safetyOverrideSha256: null } }] });
    expect(evaluateSafetyDeliveryGate(b)).toEqual({ held: true, reason: 'safety_hold:unverified:page:1' });
  });

  it('a single confirmed hazard (visible to Gate 2 regardless of any Gate-1 state) holds', () => {
    const b = book({ pages: [hazardPage(3, SHA_P1)] });
    expect(evaluateSafetyDeliveryGate(b)).toEqual({ held: true, reason: 'safety_hold:hazard:page:3:sharp_object' });
  });

  it('a valid byte-bound committed override clears the hazard (c-ii preserved)', () => {
    const b = book({
      pages: [{ pageNumber: 3, imageAsset: { safetyVerified: true, safetyHazards: ['sharp_object'], safetyContentSha256: SHA_P1, safetyOverriddenHazards: ['sharp_object'], safetyOverrideSha256: SHA_P1 } }],
    });
    expect(evaluateSafetyDeliveryGate(b)).toEqual({ held: false, reason: null });
  });
});

describe('projectSafetyOverrideOntoGateInputs + evaluate — THE RULING: release one of two → still held; both → clear', () => {
  const twoHazards = book({ pages: [hazardPage(1, SHA_P1), hazardPage(2, SHA_P2)] });

  it('two hazardous pages both hold, aggregated into one marker', () => {
    expect(evaluateSafetyDeliveryGate(twoHazards)).toEqual({
      held: true,
      reason: 'safety_hold:hazard:page:1:sharp_object,page:2:sharp_object',
    });
  });

  it('releasing ONE (project page 1) → Gate 2 STILL HELD by page 2 → the release must refuse', () => {
    const projected = projectSafetyOverrideOntoGateInputs(twoHazards, { kind: 'page', pageNumber: 1 }, { overriddenHazards: ['sharp_object'], overrideSha256: SHA_P1 });
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({ held: true, reason: 'safety_hold:hazard:page:2:sharp_object' });
  });

  it('releasing BOTH (project page 1 then page 2) → Gate 2 clears → ships', () => {
    const one = projectSafetyOverrideOntoGateInputs(twoHazards, { kind: 'page', pageNumber: 1 }, { overriddenHazards: ['sharp_object'], overrideSha256: SHA_P1 });
    const both = projectSafetyOverrideOntoGateInputs(one, { kind: 'page', pageNumber: 2 }, { overriddenHazards: ['sharp_object'], overrideSha256: SHA_P2 });
    expect(evaluateSafetyDeliveryGate(both)).toEqual({ held: false, reason: null });
  });

  it('an override with the WRONG sha does not clear (bound to the exact bytes only) → still held', () => {
    const projected = projectSafetyOverrideOntoGateInputs(twoHazards, { kind: 'page', pageNumber: 1 }, { overriddenHazards: ['sharp_object'], overrideSha256: WRONG });
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({
      held: true,
      reason: 'safety_hold:hazard:page:1:sharp_object,page:2:sharp_object',
    });
  });

  it('a hazard on the COVER blocks a page release (any other artifact holds → refuse)', () => {
    const coverAndPage = book({
      coverSafetyHazards: ['nudity'],
      pages: [hazardPage(1, SHA_P1)],
    });
    // Release only page 1 → the cover still holds.
    const projected = projectSafetyOverrideOntoGateInputs(coverAndPage, { kind: 'page', pageNumber: 1 }, { overriddenHazards: ['sharp_object'], overrideSha256: SHA_P1 });
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({ held: true, reason: 'safety_hold:hazard:cover:nudity' });
  });

  it('the raw inputs are never mutated by projection', () => {
    const before = JSON.parse(JSON.stringify(twoHazards));
    projectSafetyOverrideOntoGateInputs(twoHazards, { kind: 'page', pageNumber: 1 }, { overriddenHazards: ['sharp_object'], overrideSha256: SHA_P1 });
    expect(twoHazards).toEqual(before);
  });
});

describe('projectHumanVerificationOntoGateInputs + evaluate — exact-byte unverified release', () => {
  it('clears an unverified page only when the human-review SHA exactly matches its current content SHA', () => {
    const input = book({ pages: [unverifiedPage(1, SHA_P1)] });
    const projected = projectHumanVerificationOntoGateInputs(
      input,
      { kind: 'page', pageNumber: 1 },
      { humanVerificationSha256: SHA_P1 },
    );
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({ held: false, reason: null });
  });

  it('clears an unverified cover under the same exact-byte rule', () => {
    const input = book({
      coverSafetyVerified: null,
      coverSafetyContentSha256: SHA_COVER,
    });
    const projected = projectHumanVerificationOntoGateInputs(
      input,
      { kind: 'cover' },
      { humanVerificationSha256: SHA_COVER },
    );
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({ held: false, reason: null });
  });

  it('keeps the hold when the human-review SHA targets different bytes', () => {
    const input = book({ pages: [unverifiedPage(1, SHA_P1)] });
    const projected = projectHumanVerificationOntoGateInputs(
      input,
      { kind: 'page', pageNumber: 1 },
      { humanVerificationSha256: WRONG },
    );
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({
      held: true,
      reason: 'safety_hold:unverified:page:1',
    });
  });

  it('keeps the hold when legacy overridden-hazard state is present', () => {
    const target = unverifiedPage(1, SHA_P1);
    target.imageAsset.safetyOverriddenHazards = ['sharp_object'];
    const projected = projectHumanVerificationOntoGateInputs(
      book({ pages: [target] }),
      { kind: 'page', pageNumber: 1 },
      { humanVerificationSha256: SHA_P1 },
    );
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({
      held: true,
      reason: 'safety_hold:unverified:page:1',
    });
  });

  it('does not release a confirmed hazard — hazard coverage remains mandatory', () => {
    const projected = projectHumanVerificationOntoGateInputs(
      book({ pages: [hazardPage(1, SHA_P1)] }),
      { kind: 'page', pageNumber: 1 },
      { humanVerificationSha256: SHA_P1 },
    );
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({
      held: true,
      reason: 'safety_hold:hazard:page:1:sharp_object',
    });
  });

  it('verifying one of two unverified pages leaves the other page held', () => {
    const projected = projectHumanVerificationOntoGateInputs(
      book({ pages: [unverifiedPage(1, SHA_P1), unverifiedPage(2, SHA_P2)] }),
      { kind: 'page', pageNumber: 1 },
      { humanVerificationSha256: SHA_P1 },
    );
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({
      held: true,
      reason: 'safety_hold:unverified:page:2',
    });
  });

  it('projects only the target override SHA and never mutates machine evidence or raw inputs', () => {
    const input = book({ pages: [unverifiedPage(1, SHA_P1), unverifiedPage(2, SHA_P2)] });
    const before = JSON.parse(JSON.stringify(input)) as SafetyGateInputs;
    const expected = JSON.parse(JSON.stringify(input)) as SafetyGateInputs;
    expected.pages[0].imageAsset!.humanVerifiedUnverifiedSha256 = SHA_P1;

    const projected = projectHumanVerificationOntoGateInputs(
      input,
      { kind: 'page', pageNumber: 1 },
      { humanVerificationSha256: SHA_P1 },
    );

    expect(projected).toEqual(expected);
    expect(input).toEqual(before);
  });

  it('derives the dedicated runtime signal only from a fully validated persisted human review', () => {
    const input = book({ pages: [unverifiedPage(1, SHA_P1)] });
    const reviewed = {
      artifactKey: 'page:1',
      assetSha256: SHA_P1,
      humanReviewVerified: true,
    } as QualityEvidenceRow;
    const projected = projectPersistedHumanVerificationsOntoGateInputs(
      input,
      [reviewed],
    );
    expect(projected?.pages[0].imageAsset).toMatchObject({
      safetyOverrideSha256: null,
      humanVerifiedUnverifiedSha256: SHA_P1,
    });
    expect(evaluateSafetyDeliveryGate(projected)).toEqual({ held: false, reason: null });
  });

  it('does not reinterpret the legacy confirmed-hazard override SHA as human verification', () => {
    const input = book({ pages: [unverifiedPage(1, SHA_P1)] });
    input.pages[0].imageAsset!.safetyOverrideSha256 = SHA_P1;
    expect(evaluateSafetyDeliveryGate(input)).toEqual({
      held: true,
      reason: 'safety_hold:unverified:page:1',
    });
  });
});
