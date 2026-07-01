import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reQaUnknownQualityEvidence } from '@/lib/generation-pipeline/quality-recovery';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';

const okInspect = (sha: string | null): AssetInspection => ({
  ok: sha != null, bytes: sha ? 2048 : 0, format: sha ? 'webp' : null, mime: sha ? 'image/webp' : null,
  width: sha ? 800 : null, height: sha ? 1200 : null, sha256: sha, error: sha ? undefined : 'not_decodable',
});
const QA_CTX = { expectsChild: true, expectsCompanion: false, expectedPageTimeOfDay: null, isEmotionalClosing: false, hasStructuredObjects: false, hasRailedBedOrCrib: false, hasHumanFamily: false };

type Row = { artifactKey: string; verdict: string; evaluatorContractVersion: string; evidence: unknown };

// Stateful mock: upsert records the persisted verdict; findUnique reads it back.
function makeDb(rows: Row[]) {
  const store = new Map<string, string>();
  return {
    qualityEvidence: {
      findMany: vi.fn(async () => rows),
      upsert: vi.fn(async (a: { where: { orderId_artifactKey: { artifactKey: string } }; create: { verdict: string } }) => {
        store.set(a.where.orderId_artifactKey.artifactKey, a.create.verdict);
        return {};
      }),
      findUnique: vi.fn(async (a: { where: { orderId_artifactKey: { artifactKey: string } } }) => ({
        verdict: store.get(a.where.orderId_artifactKey.artifactKey) ?? 'evidence_unknown',
      })),
    },
  };
}

let prev: string | undefined;
beforeEach(() => {
  prev = process.env.READINESS_MANIFEST_ENABLED;
  process.env.READINESS_MANIFEST_ENABLED = 'true';
});
afterEach(() => {
  if (prev === undefined) delete process.env.READINESS_MANIFEST_ENABLED;
  else process.env.READINESS_MANIFEST_ENABLED = prev;
  vi.restoreAllMocks();
});

describe('reQaUnknownQualityEvidence (#7-a 6)', () => {
  it('re-QAs only inadmissible rows (evidence_unknown/stale); an authoritative passed row is left alone', async () => {
    const rows: Row[] = [
      { artifactKey: 'page:1', verdict: 'evidence_unknown', evaluatorContractVersion: 'qa-v1', evidence: { deliveredUrl: 'https://h/p1.webp', qaContext: QA_CTX } },
      { artifactKey: 'cover', verdict: 'passed', evaluatorContractVersion: 'qa-v1', evidence: { deliveredUrl: 'https://h/cover.png', qaContext: QA_CTX } },
    ];
    const db = makeDb(rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const inspect = vi.fn(async () => okInspect('sha_p1'));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect });
    expect(r.reQaCount).toBe(1); // cover (passed, current version) is authoritative → not re-QA'd
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://h/p1.webp', expectsChild: true }));
    expect(r.nowPassed).toEqual(['page:1']);
    expect(r.nowFailed).toEqual([]);
  });

  it('a re-QA that now FAILS → nowFailed (feeds the readiness recommit → quality_failed upgrade)', async () => {
    const rows: Row[] = [
      { artifactKey: 'page:2', verdict: 'evidence_unknown', evaluatorContractVersion: 'qa-v1', evidence: { deliveredUrl: 'https://h/p2.webp', qaContext: QA_CTX } },
    ];
    const db = makeDb(rows);
    const evaluate = vi.fn(async () => ({ passed: false, verdict: 'failed', reason: 'child_missing', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('sha_p2') });
    expect(r.nowFailed).toEqual(['page:2']);
  });

  it('a STALE evaluatorContractVersion row is re-QA\'d even if its verdict was passed', async () => {
    const rows: Row[] = [
      { artifactKey: 'page:3', verdict: 'passed', evaluatorContractVersion: 'qa-v0', evidence: { deliveredUrl: 'https://h/p3.webp', qaContext: QA_CTX } },
    ];
    const db = makeDb(rows);
    const evaluate = vi.fn(async () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never));
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('sha_p3') });
    expect(r.reQaCount).toBe(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('missing stored context → stays evidence_unknown (never a fabricated pass)', async () => {
    const rows: Row[] = [
      { artifactKey: 'page:4', verdict: 'evidence_unknown', evaluatorContractVersion: 'qa-v1', evidence: { deliveredUrl: 'https://h/p4.webp' } }, // no qaContext
    ];
    const db = makeDb(rows);
    const evaluate = vi.fn();
    const r = await reQaUnknownQualityEvidence(db as never, 'o1', { evaluate: evaluate as never, inspect: async () => okInspect('sha_p4') });
    expect(evaluate).not.toHaveBeenCalled();
    expect(r.stillUnknown).toEqual(['page:4']);
  });
});
