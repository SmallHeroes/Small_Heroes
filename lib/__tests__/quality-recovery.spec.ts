import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reQaUnknownQualityEvidence, loadRegenPendingArtifacts } from '@/lib/generation-pipeline/quality-recovery';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';

const okInspect = (sha: string | null): AssetInspection => ({
  ok: sha != null, bytes: sha ? 2048 : 0, format: sha ? 'webp' : null, mime: sha ? 'image/webp' : null,
  width: sha ? 800 : null, height: sha ? 1200 : null, sha256: sha, error: sha ? undefined : 'not_decodable',
});
const QA_CTX = { expectsChild: true, expectsCompanion: false, expectedPageTimeOfDay: null, isEmotionalClosing: false, hasStructuredObjects: false, hasRailedBedOrCrib: false, hasHumanFamily: false };

type Book = { coverImageUrl: string | null; pages: Array<{ pageNumber: number; imageAsset: { url: string | null; presentationUrl: string | null } | null }> };
type Row = { artifactKey: string; verdict: string; evaluatorContractVersion: string; assetSha256: string; regenCount?: number; evidence?: unknown };

// Stateful mock: upsert records the persisted verdict; findUnique reads it back (regenCount preserved).
function makeDb(book: Book, rows: Row[]) {
  const verdicts = new Map(rows.map((r) => [r.artifactKey, r.verdict]));
  const regens = new Map(rows.map((r) => [r.artifactKey, r.regenCount ?? 0]));
  const upsert = vi.fn(async (a: { where: { orderId_artifactKey: { artifactKey: string } }; create: { verdict: string } }) => {
    verdicts.set(a.where.orderId_artifactKey.artifactKey, a.create.verdict);
    return {};
  });
  return {
    upsert,
    db: {
      order: { findUnique: vi.fn(async () => ({ book })) },
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
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'evidence_unknown', evaluatorContractVersion: 'qa-v1', assetSha256: 'H', regenCount: 0, evidence: { qaContext: { ...QA_CTX, expectsCompanion: true } } }];
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
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'passed', evaluatorContractVersion: 'qa-v1', assetSha256: 'H_OLD', evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H_CURRENT') });
    expect(r.reQaCount).toBe(1); // re-QA'd despite the stored verdict being 'passed'
    expect(r.nowPassed).toEqual(['page:1']);
  });

  it('ADMISSIBLE: a PASSED row matching the current hash + evaluator version is NOT re-QA\'d', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'passed', evaluatorContractVersion: 'qa-v1', assetSha256: 'H' }];
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
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'failed', evaluatorContractVersion: 'qa-v1', assetSha256: 'H', regenCount: 0, evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn();
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(evaluate).not.toHaveBeenCalled(); // admissible → trusted, no re-QA
    expect(r.reQaCount).toBe(0);
    expect(r.nowFailed).toEqual([{ artifactKey: 'page:1', regenCount: 0 }]); // routed to the rescue → reserve will run
    expect(r.nowPassed).toEqual([]);
  });

  it('(#6-fix-4 P1 #1) ADMISSIBLE FAILED @regenCount=2 (budget spent) → still routed to nowFailed, carrying regenCount 2 → the processor refunds (reserve declines)', async () => {
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'failed', evaluatorContractVersion: 'qa-v1', assetSha256: 'H', regenCount: 2, evidence: { qaContext: QA_CTX } }];
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
    const rows: Row[] = [{ artifactKey: 'page:1', verdict: 'evidence_unknown', evaluatorContractVersion: 'qa-v1', assetSha256: 'H', regenCount: 1, evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, rows);
    const evaluate = vi.fn(async () => ({ passed: false, verdict: 'failed', reason: 'child_missing', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(r.nowFailed).toEqual([{ artifactKey: 'page:1', regenCount: 1 }]);
  });

  it('the COVER is a required artifact and is re-QA\'d against its delivered bytes (using its stored context)', async () => {
    const rows: Row[] = [{ artifactKey: 'cover', verdict: 'evidence_unknown', evaluatorContractVersion: 'qa-v1', assetSha256: 'STALE', evidence: { qaContext: QA_CTX } }];
    const { db } = makeDb({ coverImageUrl: 'https://h/cover.png', pages: [] }, rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('HC') });
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://h/cover.png' }));
    expect(r.nowPassed).toEqual(['cover']);
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
