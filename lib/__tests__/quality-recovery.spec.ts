import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reQaUnknownQualityEvidence, loadRegenPendingArtifacts } from '@/lib/generation-pipeline/quality-recovery';
import { QUALITY_EVALUATOR_CONTRACT_VERSION } from '@/lib/generation-pipeline/quality-evidence';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';

const okInspect = (sha: string | null): AssetInspection => ({
  ok: sha != null, bytes: sha ? 2048 : 0, format: sha ? 'webp' : null, mime: sha ? 'image/webp' : null,
  width: sha ? 800 : null, height: sha ? 1200 : null, sha256: sha, error: sha ? undefined : 'not_decodable',
});
const QA_CTX = { expectsChild: true, expectsCompanion: false, expectedPageTimeOfDay: null, isEmotionalClosing: false, hasStructuredObjects: false, hasRailedBedOrCrib: false, hasHumanFamily: false };

type Book = { coverImageUrl: string | null; pages: Array<{ pageNumber: number; imageAsset: { url: string | null; presentationUrl: string | null } | null }> };
type Row = { artifactKey: string; verdict: string; evaluatorContractVersion: string; assetSha256: string; regenCount?: number; evidence?: unknown; contractHash?: string | null; reason?: string | null; safetyOverride?: boolean; safetyOverrideSha256?: string | null };

// Stateful mock: upsert records the persisted verdict; findUnique reads it back (regenCount preserved).
function makeDb(book: Book, rows: Row[], visualContractHash: string | null = null) {
  const verdicts = new Map(rows.map((r) => [r.artifactKey, r.verdict]));
  const regens = new Map(rows.map((r) => [r.artifactKey, r.regenCount ?? 0]));
  const upsert = vi.fn(async (a: { where: { orderId_artifactKey: { artifactKey: string } }; create: { verdict: string } }) => {
    verdicts.set(a.where.orderId_artifactKey.artifactKey, a.create.verdict);
    return {};
  });
  return {
    upsert,
    db: {
      order: { findUnique: vi.fn(async () => ({ book, visualContractHash })) },
      qualityEvidence: {
        findMany: vi.fn(async () => rows),
        upsert,
        findUnique: vi.fn(async (a: { where: { orderId_artifactKey: { artifactKey: string } } }) => ({
          verdict: verdicts.get(a.where.orderId_artifactKey.artifactKey) ?? 'evidence_unknown',
          regenCount: regens.get(a.where.orderId_artifactKey.artifactKey) ?? 0,
        })),
      },
    },
  };
}

const page = (n: number, url: string) => ({ pageNumber: n, imageAsset: { url, presentationUrl: null } });
let prev: string | undefined;
beforeEach(() => { prev = process.env.READINESS_MANIFEST_ENABLED; process.env.READINESS_MANIFEST_ENABLED = 'true'; });
afterEach(() => { if (prev === undefined) delete process.env.READINESS_MANIFEST_ENABLED; else process.env.READINESS_MANIFEST_ENABLED = prev; vi.restoreAllMocks(); });

describe('reQaUnknownQualityEvidence — enumerate REQUIRED artifacts (#6-fix BLOCKER 1)', () => {
  it('BLOCKER 1: a MISSING evidence row (no persisted context) is NEVER re-QA\'d under a lenient fabricated context → stays evidence_unknown (fail-closed)', async () => {
    // Pre-#6-fix-3 this re-QA\'d under a lenient FALLBACK (companion/crib/family OFF) and could PASS a page missing
    // its required companion. Now, with no stored context, we cannot verify against the REAL requirements → leave it
    // unknown (→ the recommit blocks → recovery/refund). The producer persists the exact context atomically with the
    // asset, so a real delivered artifact always has its context and never lands here.
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, []); // asset exists, no row
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(evaluate).not.toHaveBeenCalled(); // never fabricates a lenient context
    expect(r.reQaCount).toBe(0);
    expect(r.stillUnknown).toEqual(['page:1']);
    expect(r.nowPassed).toEqual([]);
  });

  it('BLOCKER 1: re-QA uses the REAL persisted context (companion REQUIRED) — a companion-missing image FAILS, never a lenient pass', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'evidence_unknown', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: 'H', regenCount: 0, evidence: { qaContext: { ...QA_CTX, expectsCompanion: true } } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    // The evaluator honors the passed context: with expectsCompanion it FAILS the companion-missing image.
    const evaluate = vi.fn(async (input: { expectsCompanion?: boolean }) => ({
      passed: !input.expectsCompanion, verdict: input.expectsCompanion ? 'failed' : 'passed',
      reason: 'companion_missing', details: '', flags: {},
    } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ expectsCompanion: true })); // REAL requirement used
    expect(r.nowFailed).toEqual([{ artifactKey: 'page:1', regenCount: 0 }]); // correctly failed, not a lenient pass
    expect(r.nowPassed).toEqual([]);
  });

  it('HASH_MISMATCH: a PASSED row for OLD bytes ≠ current delivered bytes → re-QA current → recover (not refunded)', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: 'H_OLD', evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H_CURRENT') });
    expect(r.reQaCount).toBe(1); // re-QA'd despite the stored verdict being 'passed'
    expect(r.nowPassed).toEqual(['page:1']);
  });

  it('ADMISSIBLE: a PASSED row matching the current hash + evaluator version is NOT re-QA\'d', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: 'H' }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn();
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(r.reQaCount).toBe(0);
    expect(evaluate).not.toHaveBeenCalled();
    expect(r.nowFailed).toEqual([]); // a PASS is genuinely done — not routed anywhere
  });

  it('(#6-fix-4 P1 #1) ADMISSIBLE FAILED @regenCount=0 → routed to the rescue (nowFailed) WITHOUT re-QA — a first-render fail is never skipped', async () => {
    // The durable 'failed' verdict already matches the CURRENT bytes at the current evaluator version (admissible),
    // so it is trusted as-is (no re-QA). But it MUST still reach the rescue: pre-fix this row was `continue`d →
    // nowFailed stayed empty → reserve never ran → the failing page shipped. Now it routes with regenCount 0 so the
    // processor reserves → clears → redrives.
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'failed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: 'H', regenCount: 0, evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn();
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(evaluate).not.toHaveBeenCalled(); // admissible → trusted, no re-QA
    expect(r.reQaCount).toBe(0);
    expect(r.nowFailed).toEqual([{ artifactKey: 'page:1', regenCount: 0 }]); // routed to the rescue → reserve will run
    expect(r.nowPassed).toEqual([]);
  });

  it('(#6-fix-4 P1 #1) ADMISSIBLE FAILED @regenCount=2 (budget spent) → still routed to nowFailed, carrying regenCount 2 → the processor refunds (reserve declines)', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'failed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: 'H', regenCount: 2, evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn();
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(evaluate).not.toHaveBeenCalled();
    // Routed with the durable regenCount at budget (2). The processor fast-skips the reserve (>= budget) → no clear →
    // recommit → quality_failed → refund. The routing is what makes that path reachable at all.
    expect(r.nowFailed).toEqual([{ artifactKey: 'page:1', regenCount: 2 }]);
  });

  it('STALE evaluatorContractVersion → re-QA even if verdict was passed', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'passed', evaluatorContractVersion: 'qa-v0', assetSha256: 'H', evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(r.reQaCount).toBe(1);
  });

  it('re-QA to FAILED carries the durable regenCount (drives the rescue)', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'evidence_unknown', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: 'H', regenCount: 1, evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn(async () => ({ passed: false, verdict: 'failed', reason: 'child_missing', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(r.nowFailed).toEqual([{ artifactKey: 'page:1', regenCount: 1 }]);
  });

  it('preserves the required numeric child gate: qualitative pass + scorer unavailable stays evidence_unknown', async () => {
    const rows: Row[] = [{
      artifactKey: 'page:7',
      verdict: 'evidence_unknown',
      evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      assetSha256: 'H',
      regenCount: 2,
      reason: 'recovery:rerender_pending',
      evidence: {
        qaContext: QA_CTX,
        releaseV1PageRerender: {
          version: 'release-v1-page-rerender-pending/v1',
          recoveryAttemptId: 'attempt-1',
        },
        pageResemblanceGate: {
          required: true,
          referenceImageUrl: 'https://h/approved-child-anchor.webp',
          status: 'evidence_unknown',
          resemblanceScore: null,
          threshold: 0.7,
          minAcceptableScore: 0.62,
          faceDetectConfidence: null,
          faceAreaRatio: null,
          source: 'delivered_bytes',
        },
      },
    }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(7, 'https://h/p7.webp')] }, rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const scoreResemblance = vi.fn(async () => { throw new Error('scorer_unavailable'); });

    const r = await reQaUnknownQualityEvidence(db as never, 'o1', {
      evaluate: evaluate as never,
      inspect: async () => okInspect('H'),
      scoreResemblance: scoreResemblance as never,
    });

    expect(evaluate).toHaveBeenCalled();
    expect(scoreResemblance).toHaveBeenCalledWith(expect.objectContaining({
      referenceImageUrl: 'https://h/approved-child-anchor.webp',
      candidateImageUrl: 'https://h/p7.webp',
      effectiveThreshold: 0.7,
    }));
    expect(r.nowPassed).toEqual([]);
    expect(r.stillUnknown).toEqual(['page:7']);
  });

  it('crash envelope: a rerender-pending marker with missing numeric policy cannot be weakened to qualitative PASS', async () => {
    const rows: Row[] = [{
      artifactKey: 'page:6',
      verdict: 'evidence_unknown',
      evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      assetSha256: '',
      regenCount: 0,
      reason: 'recovery:rerender_pending',
      evidence: {
        qaContext: QA_CTX,
        releaseV1PageRerender: {
          version: 'release-v1-page-rerender-pending/v1',
          recoveryAttemptId: 'attempt-1',
        },
      },
    }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(6, 'https://h/p6.webp')] }, rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));

    const r = await reQaUnknownQualityEvidence(db as never, 'o1', {
      evaluate: evaluate as never,
      inspect: async () => okInspect('H'),
    });

    expect(evaluate).not.toHaveBeenCalled();
    expect(r.reQaCount).toBe(0);
    expect(r.nowPassed).toEqual([]);
    expect(r.stillUnknown).toEqual(['page:6']);
  });

  it('preserves the required numeric child gate: a fresh 0.70 score may clear the unknown evidence', async () => {
    const rows: Row[] = [{
      artifactKey: 'page:8',
      verdict: 'evidence_unknown',
      evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      assetSha256: 'H',
      regenCount: 0,
      reason: 'child_resemblance_unverified',
      evidence: {
        qaContext: QA_CTX,
        pageResemblanceGate: {
          required: true,
          referenceImageUrl: 'https://h/approved-child-anchor.webp',
          status: 'evidence_unknown',
          resemblanceScore: null,
          threshold: 0.7,
          minAcceptableScore: 0.62,
          faceDetectConfidence: null,
          faceAreaRatio: null,
          source: 'delivered_bytes',
        },
      },
    }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(8, 'https://h/p8.webp')] }, rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const scoreResemblance = vi.fn(async () => ({
      resemblanceScore: 0.7,
      faceDetectConfidence: 0.9,
      faceAreaRatio: 0.2,
      sanityFlags: {},
      candidateEmbedding: [],
    }));

    const r = await reQaUnknownQualityEvidence(db as never, 'o1', {
      evaluate: evaluate as never,
      inspect: async () => okInspect('H'),
      scoreResemblance: scoreResemblance as never,
    });

    expect(scoreResemblance).toHaveBeenCalled();
    expect(r.nowPassed).toEqual(['page:8']);
    expect(r.stillUnknown).toEqual([]);
  });

  it('(Slice A) an admissible FAILED row tagged contract_world → nowParked (terminal human-QA hold), never nowFailed', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'failed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: 'H', regenCount: 0, reason: 'contract_world:wrong_zone', evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn();
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(evaluate).not.toHaveBeenCalled(); // admissible → trusted, no re-QA
    expect(r.nowParked).toEqual(['page:1']); // → the processor parks it (no reserve/clear/redrive, no refund)
    expect(r.nowFailed).toEqual([]);         // NEVER routed to the regen-rescue
  });

  it('(Stage 1) an admissible FAILED row tagged safety → nowParked too (rides the SAME park path, never regen/refund)', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'failed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: 'H', regenCount: 0, reason: 'safety:child_on_railing', evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn();
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(evaluate).not.toHaveBeenCalled();
    expect(r.nowParked).toEqual(['page:1']); // parked for human QA, NOT the regen-rescue that would wipe the evidence
    expect(r.nowFailed).toEqual([]);
  });

  const SHA = 'a'.repeat(64);      // valid lowercase 64-hex, so the regex-validated predicate (parity with Gate 2) fires
  const SHA_OLD = 'b'.repeat(64);

  it('(release c-ii) an admissible FAILED safety-only row with a BYTE-BOUND override → nowPassed (released), NOT nowParked — recovery AGREES with the gate', async () => {
    // The disagreement this closes: evaluateQualityGate clears this artifact on the IDENTICAL composition (admissible →
    // isSafetyEvidenceReleased && isSafetyOnlyReason), so if recovery still parked it the two loop forever.
    const rows: Row[] = [{ artifactKey: 'page:4', verdict: 'failed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: SHA, regenCount: 0, reason: 'safety:unsafe_pose', safetyOverride: true, safetyOverrideSha256: SHA, evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(4, 'https://h/p4.png')] }, rows);
    const evaluate = vi.fn();
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect(SHA) });
    expect(evaluate).not.toHaveBeenCalled();  // admissible → trusted, no re-QA (which would clear the override via P1b)
    expect(r.nowPassed).toEqual(['page:4']);  // released → cleared, exactly like the gate
    expect(r.nowParked).toEqual([]);          // NOT re-parked → no gate/recovery loop
    expect(r.nowFailed).toEqual([]);
  });

  it('(release c-ii) the override is BYTE-BOUND in recovery too: a release for DIFFERENT bytes lapses → nowParked (matches the gate hard-hold)', async () => {
    const rows: Row[] = [{ artifactKey: 'page:4', verdict: 'failed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: SHA, regenCount: 0, reason: 'safety:unsafe_pose', safetyOverride: true, safetyOverrideSha256: SHA_OLD, evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(4, 'https://h/p4.png')] }, rows);
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { inspect: async () => okInspect(SHA) });
    expect(r.nowParked).toEqual(['page:4']);  // override bound to old bytes → lapsed → parked (fail-closed)
    expect(r.nowPassed).toEqual([]);
  });

  it('(release c-ii §4) a MIXED reason WITH a valid release parks as contract_world in RECOVERY too — gate + recovery agree on the KIND', async () => {
    // The P2 this closes: recovery used to derive the kind from the reason substring (safety: present → "safety"),
    // mislabeling this as a safety case the operator could re-release but never ship. The SHARED outcome makes both
    // paths call it contract_world (the safety component was validly released; contract_world is the real blocker).
    const rows: Row[] = [{ artifactKey: 'page:4', verdict: 'failed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: SHA, regenCount: 0, reason: 'safety:unsafe_pose+contract_world:door_moved', safetyOverride: true, safetyOverrideSha256: SHA, evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(4, 'https://h/p4.png')] }, rows);
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { inspect: async () => okInspect(SHA) });
    expect(r.nowParked).toEqual(['page:4']);          // safety-only false → not cleared → parked
    expect(r.nowParkedKind).toBe('contract_world');   // the FIX: released safety → contract_world drives the kind
    expect(r.nowPassed).toEqual([]);
  });

  it('(release c-ii §4) the SAME mixed reason with NO/invalid release parks as safety in both (safety dominates when NOT released)', async () => {
    const rows: Row[] = [{ artifactKey: 'page:4', verdict: 'failed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: SHA, regenCount: 0, reason: 'safety:unsafe_pose+contract_world:door_moved', safetyOverride: false, safetyOverrideSha256: null, evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(4, 'https://h/p4.png')] }, rows);
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { inspect: async () => okInspect(SHA) });
    expect(r.nowParked).toEqual(['page:4']);
    expect(r.nowParkedKind).toBe('safety');           // no release → safety dominates contract_world
  });

  it('(Slice A) qa-v2 bump: a prior-evaluator (qa-v1) PASSED row is stale → re-QA\'d (never delivered un-world-QA\'d)', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'passed', evaluatorContractVersion: 'qa-v1', assetSha256: 'H', evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(r.reQaCount).toBe(1); // qa-v1 no longer admissible under qa-v2 → forced re-QA
  });

  it('the COVER is a required artifact and is re-QA\'d against its delivered bytes (using its stored context)', async () => {
    const rows: Row[] = [{ artifactKey: 'cover', verdict: 'evidence_unknown', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, assetSha256: 'STALE', evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: 'https://h/cover.png', pages: [] }, rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('HC') });
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://h/cover.png' }));
    expect(r.nowPassed).toEqual(['cover']);
  });

  // (P1-3) contract-stale recovery must CONVERGE — exercised via the PRODUCTION reQaUnknownQualityEvidence end to end,
  // NOT a hand-simulated already-rebound row (that was the test that hid the bug).
  it('(P1-3) a v1-passed row on CURRENT bytes but order now at v2 → re-QA rebinds to v2 → converges (not skipped as admissible)', async () => {
    // By the OLD criteria this row is "admissible" (passed, current bytes 'H', current evaluator) — but it is bound to
    // a SUPERSEDED contract (v1) while the order is v2. It MUST be re-QA'd + rebound, else readiness loops on
    // contract_stale until the budget refunds.
    const rows: Row[] = [{
      artifactKey: 'page:1', verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      assetSha256: 'H', contractHash: 'v1', evidence: { qaContext: QA_CTX },
    }];
    const { db, upsert } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows, 'v2');
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(evaluate).toHaveBeenCalled(); // re-QA'd (NOT trusted as admissible)
    expect(r.reQaCount).toBe(1);
    // rebound to the CURRENT active contract (v2) by persistDeliveredQualityEvidence
    const upsertArg = upsert.mock.calls[upsert.mock.calls.length - 1][0] as unknown as { create: Record<string, unknown>; update: Record<string, unknown> };
    expect(upsertArg.create.contractHash).toBe('v2');
    expect(upsertArg.update.contractHash).toBe('v2');
    expect(r.nowPassed).toEqual(['page:1']); // re-QA passed on current bytes → now admissible → converges
  });

  it('(P1-3) a v1-passed row when the order is ALSO v1 (matching) stays admissible → no re-QA (existing criteria intact)', async () => {
    const rows: Row[] = [{
      artifactKey: 'page:1', verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      assetSha256: 'H', contractHash: 'v1', evidence: { qaContext: QA_CTX },
    }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows, 'v1');
    const evaluate = vi.fn();
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(evaluate).not.toHaveBeenCalled(); // matching contract → admissible → trusted, no needless re-QA
    expect(r.reQaCount).toBe(0);
    expect(r.nowPassed).toEqual([]); // an admissible PASS is "done" (only failed routes to nowFailed)
  });
});

describe('loadRegenPendingArtifacts (#6-fix-3 BLOCKER 3)', () => {
  it('returns only the artifacts durably marked regenPending in their evidence JSON', async () => {
    const rows = [
      { artifactKey: 'cover', evidence: { qaContext: QA_CTX, regenPending: true } },
      { artifactKey: 'page:1', evidence: { qaContext: QA_CTX } }, // not pending
      { artifactKey: 'page:2', evidence: { regenPending: true } },
      { artifactKey: 'page:3', evidence: null }, // no evidence
      { artifactKey: 'page:4', evidence: { regenPending: false } },
    ];
    const prisma = { qualityEvidence: { findMany: vi.fn(async () => rows) } };
    const r = await loadRegenPendingArtifacts(prisma as never, 'o1');
    expect(r.sort()).toEqual(['cover', 'page:2']);
  });

  it('no pending rows → empty (recovery falls through to the recommit)', async () => {
    const prisma = { qualityEvidence: { findMany: vi.fn(async () => [{ artifactKey: 'page:1', evidence: { qaContext: QA_CTX } }]) } };
    expect(await loadRegenPendingArtifacts(prisma as never, 'o1')).toEqual([]);
  });
});
