import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  persistDeliveredQualityEvidence,
  persistQualityContext,
  type QaContext,
} from '@/lib/generation-pipeline/quality-evidence-producer';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';

const okInspect = (sha: string | null): AssetInspection => ({
  ok: sha != null, bytes: sha ? 2048 : 0, format: sha ? 'webp' : null, mime: sha ? 'image/webp' : null,
  width: sha ? 800 : null, height: sha ? 1200 : null, sha256: sha, error: sha ? undefined : 'not_decodable',
});

const QA_CTX: QaContext = {
  expectsChild: true, expectsCompanion: false, expectedPageTimeOfDay: null,
  isEmotionalClosing: false, hasStructuredObjects: false, hasRailedBedOrCrib: false, hasHumanFamily: false,
};

type UpsertArg = { create: Record<string, unknown>; update: Record<string, unknown> };
function makeDb() {
  return { qualityEvidence: { upsert: vi.fn(async (_arg: UpsertArg) => ({})) } };
}
function upsertArg(db: ReturnType<typeof makeDb>): UpsertArg {
  return (db.qualityEvidence.upsert.mock.calls[0]?.[0] ?? { create: {}, update: {} }) as UpsertArg;
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

describe('persistDeliveredQualityEvidence — flag gating', () => {
  it('flag OFF → no-op (no persist, no inspect, no evaluate)', async () => {
    process.env.READINESS_MANIFEST_ENABLED = 'false';
    const db = makeDb();
    const evaluate = vi.fn();
    const inspect = vi.fn();
    await persistDeliveredQualityEvidence(db as never, {
      orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'https://h/p1.webp',
      presentationApplied: false, rawVerdict: 'passed', qaContext: QA_CTX,
    }, { evaluate: evaluate as never, inspect: inspect as never });
    expect(db.qualityEvidence.upsert).not.toHaveBeenCalled();
    expect(inspect).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  });
});

describe('persistQualityContext (#6-fix-3 BLOCKER 1) — bind the exact context atomically with the asset', () => {
  type CtxDb = { qualityEvidence: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> } };
  const ctxDb = (existingEvidence: Record<string, unknown> | null): CtxDb => ({
    qualityEvidence: {
      findUnique: vi.fn(async () => (existingEvidence === undefined ? null : { evidence: existingEvidence })),
      upsert: vi.fn(async () => ({})),
    },
  });
  const arg = (db: CtxDb) => db.qualityEvidence.upsert.mock.calls[0]?.[0] as { create: Record<string, unknown>; update: Record<string, unknown> };

  it('no existing row → creates a fail-closed evidence_unknown row (regenCount 0) carrying the REAL qaContext', async () => {
    const db = ctxDb(null);
    await persistQualityContext(db as never, { orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'u1', qaContext: { ...QA_CTX, expectsCompanion: true } });
    const a = arg(db);
    expect(a.create.verdict).toBe('evidence_unknown');
    expect(a.create.regenCount).toBe(0);
    expect((a.create.evidence as Record<string, unknown>).qaContext).toEqual(expect.objectContaining({ expectsCompanion: true }));
    expect((a.create.evidence as Record<string, unknown>).deliveredUrl).toBe('u1');
  });

  it('(#6-fix-4 P1 #2) existing row → INVALIDATES the old proof: verdict→evidence_unknown + hash cleared, regenCount/regenPending PRESERVED', async () => {
    const db = ctxDb({ regenPending: true, stray: 1 });
    await persistQualityContext(db as never, { orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'u2', qaContext: QA_CTX });
    const a = arg(db);
    // Binding a (possibly CHANGED) context must force a re-QA: the old PASS + matching hash can no longer certify the
    // bytes under the new requirements. So verdict is knocked to evidence_unknown and the hash is cleared — while
    // regenPending (inside evidence) and regenCount (untouched column) survive so the durable budget/marker persist.
    expect(a.update.verdict).toBe('evidence_unknown'); // old proof invalidated
    expect(a.update.assetSha256).toBe(''); // hash cleared → cannot stay admissible on stale bytes
    expect(a.update.evidence).toEqual(expect.objectContaining({ regenPending: true, stray: 1, deliveredUrl: 'u2', qaContext: QA_CTX }));
    expect(a.update).not.toHaveProperty('regenCount'); // never touches the durable budget (5b)
  });

  it('flag OFF → no-op (no findUnique, no upsert)', async () => {
    process.env.READINESS_MANIFEST_ENABLED = 'false';
    const db = ctxDb(null);
    await persistQualityContext(db as never, { orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'u', qaContext: QA_CTX });
    expect(db.qualityEvidence.findUnique).not.toHaveBeenCalled();
    expect(db.qualityEvidence.upsert).not.toHaveBeenCalled();
  });

  it('no qaContext → no-op (the fail-closed gate still covers a context-less artifact)', async () => {
    const db = ctxDb(null);
    await persistQualityContext(db as never, { orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'u', qaContext: undefined });
    expect(db.qualityEvidence.upsert).not.toHaveBeenCalled();
  });
});

describe('persistDeliveredQualityEvidence — semantic byte binding (carry-in #1)', () => {
  it('NO presentation transform → reuses the genuine in-loop verdict for the same bytes (no re-QA)', async () => {
    const db = makeDb();
    const evaluate = vi.fn();
    const inspect = vi.fn(async () => okInspect('sha_raw'));
    await persistDeliveredQualityEvidence(db as never, {
      orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'https://h/p1.png',
      presentationApplied: false, rawVerdict: 'passed', qaContext: QA_CTX,
    }, { evaluate: evaluate as never, inspect });
    expect(evaluate).not.toHaveBeenCalled();
    const a = upsertArg(db);
    expect(a.create.verdict).toBe('passed');
    expect(a.create.assetSha256).toBe('sha_raw');
  });

  it('presentation transform applied → RE-QAs the DELIVERED bytes (never binds the raw verdict to the presentation hash)', async () => {
    const db = makeDb();
    const evaluate = vi.fn(async () => ({ passed: false, verdict: 'failed', reason: 'anatomy_failed', details: '', flags: {} } as never));
    const inspect = vi.fn(async () => okInspect('sha_presentation'));
    await persistDeliveredQualityEvidence(db as never, {
      orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'https://h/p1.webp',
      presentationApplied: true, rawVerdict: 'passed', qaContext: QA_CTX,
    }, { evaluate: evaluate as never, inspect });
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://h/p1.webp', expectsChild: true }));
    const a = upsertArg(db);
    expect(a.create.verdict).toBe('failed'); // the DELIVERED-bytes verdict, not the raw 'passed'
    expect(a.create.assetSha256).toBe('sha_presentation');
  });
});

describe('persistDeliveredQualityEvidence — genuine cover verdict + fail-closed (carry-in #2)', () => {
  it('no raw verdict and no transform → evidence_unknown (never a synthesized PASS)', async () => {
    const db = makeDb();
    await persistDeliveredQualityEvidence(db as never, {
      orderId: 'o1', artifactKey: 'cover', deliveredUrl: 'https://h/cover.png',
      presentationApplied: false, rawVerdict: undefined, qaContext: undefined,
    }, { inspect: async () => okInspect('sha_cover') });
    expect(upsertArg(db).create.verdict).toBe('evidence_unknown');
  });

  it('presentation applied but no QA context → evidence_unknown', async () => {
    const db = makeDb();
    const evaluate = vi.fn();
    await persistDeliveredQualityEvidence(db as never, {
      orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'https://h/p1.webp',
      presentationApplied: true, rawVerdict: 'passed', qaContext: undefined,
    }, { evaluate: evaluate as never, inspect: async () => okInspect('sha') });
    expect(evaluate).not.toHaveBeenCalled();
    expect(upsertArg(db).create.verdict).toBe('evidence_unknown');
  });
});

describe('persistDeliveredQualityEvidence — hash binding + budget preservation', () => {
  it('inspect cannot hash the delivered bytes → evidence_unknown + empty hash (blocks at readiness) (carry-in #3)', async () => {
    const db = makeDb();
    await persistDeliveredQualityEvidence(db as never, {
      orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'https://h/p1.png',
      presentationApplied: false, rawVerdict: 'passed', qaContext: QA_CTX,
    }, { inspect: async () => okInspect(null) });
    const a = upsertArg(db);
    expect(a.create.verdict).toBe('evidence_unknown');
    expect(a.create.assetSha256).toBe('');
  });

  it('the persist NEVER sets regenCount on update — the DB-reserved budget is preserved (carry-in #4)', async () => {
    const db = makeDb();
    await persistDeliveredQualityEvidence(db as never, {
      orderId: 'o1', artifactKey: 'page:1', deliveredUrl: 'https://h/p1.png',
      presentationApplied: false, rawVerdict: 'passed', qaContext: QA_CTX, regenAttempts: 2,
    }, { inspect: async () => okInspect('sha') });
    const a = upsertArg(db);
    expect('regenCount' in a.update).toBe(false); // re-persist preserves the reserved value
  });
});
