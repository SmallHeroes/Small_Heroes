import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reQaUnknownQualityEvidence } from '@/lib/generation-pipeline/quality-recovery';
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
  it('MISSING row (asset exists, no evidence — crash envelope) → re-QA current bytes → recover', async () => {
    const { db } = makeDb({ coverImageUrl: null, pages: [page(1, 'https://h/p1.png')] }, []); // no rows
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('H') });
    expect(r.reQaCount).toBe(1);
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://h/p1.png' }));
    expect(r.nowPassed).toEqual(['page:1']);
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

  it('the COVER is a required artifact and is re-QA\'d against its delivered bytes', async () => {
    const { db } = makeDb({ coverImageUrl: 'https://h/cover.png', pages: [] }, []);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('HC') });
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://h/cover.png' }));
    expect(r.nowPassed).toEqual(['cover']);
  });
});
