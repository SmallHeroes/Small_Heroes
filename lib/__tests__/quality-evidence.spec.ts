import { describe, expect, it, vi } from 'vitest';
import {
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  QUALITY_REGEN_BUDGET,
  coverArtifactKey,
  pageArtifactKey,
  requiredArtifactKeys,
  evaluateQualityGate,
  qualityEvidenceFingerprint,
  reserveQualityRegen,
  ensureQualityEvidenceRow,
  makeQualityRegenReserver,
  type QualityEvidenceRow,
  type ArtifactHashes,
} from '@/lib/generation-pipeline/quality-evidence';

const V = QUALITY_EVALUATOR_CONTRACT_VERSION;

function row(overrides: Partial<QualityEvidenceRow> & { artifactKey: string }): QualityEvidenceRow {
  return {
    assetSha256: 'hash',
    verdict: 'passed',
    evaluatorContractVersion: V,
    reason: null,
    regenCount: 0,
    ...overrides,
  };
}

// A 1-page book: required = [cover, page:1]. Current delivered-bytes hashes match 'hcover'/'hp1' unless noted.
function hashes(map: Record<string, string | null>): ArtifactHashes {
  return new Map(Object.entries(map));
}
const REQUIRED = ['cover', 'page:1'];
const CURRENT = hashes({ cover: 'hcover', 'page:1': 'hp1' });

describe('artifact keys', () => {
  it('cover + page:N', () => {
    expect(coverArtifactKey()).toBe('cover');
    expect(pageArtifactKey(3)).toBe('page:3');
  });
  it('requiredArtifactKeys = cover + page:1..N', () => {
    expect(requiredArtifactKeys(3)).toEqual(['cover', 'page:1', 'page:2', 'page:3']);
    expect(requiredArtifactKeys(0)).toEqual(['cover']);
  });
});

describe('evaluateQualityGate — PASS only when every artifact passes on current bytes + version', () => {
  it('all passed + hashes match → passed', () => {
    const rows = [
      row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed' }),
      row({ artifactKey: 'page:1', assetSha256: 'hp1', verdict: 'passed' }),
    ];
    const r = evaluateQualityGate(REQUIRED, rows, CURRENT);
    expect(r.status).toBe('passed');
    expect(r.reason).toBeNull();
  });
});

describe('evaluateQualityGate — FAILED (terminal) path', () => {
  it('a failed verdict with budget exhausted → failed (quality_failed)', () => {
    const rows = [
      row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed' }),
      row({ artifactKey: 'page:1', assetSha256: 'hp1', verdict: 'failed', regenCount: QUALITY_REGEN_BUDGET, reason: 'anatomy_failed' }),
    ];
    const r = evaluateQualityGate(REQUIRED, rows, CURRENT);
    expect(r.status).toBe('failed');
    expect(r.failedArtifacts).toEqual(['page:1']);
    expect(r.reason).toContain('quality_failed');
  });

  it('failed takes precedence over unknown (a terminal fail blocks regardless of a missing sibling)', () => {
    const rows = [
      row({ artifactKey: 'page:1', assetSha256: 'hp1', verdict: 'failed', regenCount: QUALITY_REGEN_BUDGET }),
      // cover row missing → would be unknown, but the terminal fail dominates
    ];
    const r = evaluateQualityGate(REQUIRED, rows, CURRENT);
    expect(r.status).toBe('failed');
  });
});

describe('evaluateQualityGate — EVIDENCE_UNKNOWN (recovery) path, fail-closed', () => {
  it('a missing required artifact → evidence_unknown (never passes on absent evidence)', () => {
    const rows = [row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed' })];
    const r = evaluateQualityGate(REQUIRED, rows, CURRENT);
    expect(r.status).toBe('evidence_unknown');
    expect(r.unknownArtifacts).toEqual(['page:1']);
  });

  it('an evidence_unknown verdict → evidence_unknown', () => {
    const rows = [
      row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed' }),
      row({ artifactKey: 'page:1', assetSha256: 'hp1', verdict: 'evidence_unknown', reason: 'vision_skipped' }),
    ];
    expect(evaluateQualityGate(REQUIRED, rows, CURRENT).status).toBe('evidence_unknown');
  });

  it('anti-bypass: an old evaluatorContractVersion is stale → evidence_unknown even if verdict=passed', () => {
    const rows = [
      row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed' }),
      row({ artifactKey: 'page:1', assetSha256: 'hp1', verdict: 'passed', evaluatorContractVersion: 'qa-v0' }),
    ];
    const r = evaluateQualityGate(REQUIRED, rows, CURRENT);
    expect(r.status).toBe('evidence_unknown');
    expect(r.unknownArtifacts).toEqual(['page:1']);
  });

  it('anti-bypass: a PASS for different bytes cannot authorize the current delivered image (hash mismatch) → evidence_unknown', () => {
    const rows = [
      row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed' }),
      row({ artifactKey: 'page:1', assetSha256: 'STALE_HASH', verdict: 'passed' }),
    ];
    expect(evaluateQualityGate(REQUIRED, rows, CURRENT).status).toBe('evidence_unknown');
  });

  it('anti-bypass: a non-decodable current asset (null hash) → evidence_unknown even with a passed row', () => {
    const rows = [
      row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed' }),
      row({ artifactKey: 'page:1', assetSha256: 'hp1', verdict: 'passed' }),
    ];
    const r = evaluateQualityGate(REQUIRED, rows, hashes({ cover: 'hcover', 'page:1': null }));
    expect(r.status).toBe('evidence_unknown');
  });

  it('anti-bypass: an unrecognized verdict string → evidence_unknown (inadmissible)', () => {
    const rows = [
      row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed' }),
      row({ artifactKey: 'page:1', assetSha256: 'hp1', verdict: 'ok' }),
    ];
    expect(evaluateQualityGate(REQUIRED, rows, CURRENT).status).toBe('evidence_unknown');
  });

  it('a failed verdict WITH budget remaining is recoverable → evidence_unknown (not terminal)', () => {
    const rows = [
      row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed' }),
      row({ artifactKey: 'page:1', assetSha256: 'hp1', verdict: 'failed', regenCount: 0 }),
    ];
    const r = evaluateQualityGate(REQUIRED, rows, CURRENT);
    expect(r.status).toBe('evidence_unknown');
    expect(r.failedArtifacts).toEqual([]);
  });

  it('empty evidence (nothing rendered yet) → evidence_unknown, never passed', () => {
    expect(evaluateQualityGate(REQUIRED, [], CURRENT).status).toBe('evidence_unknown');
  });
});

describe('qualityEvidenceFingerprint', () => {
  it('is order-independent and reflects verdict/hash/version/regenCount', () => {
    const a = [row({ artifactKey: 'cover', assetSha256: 'h1' }), row({ artifactKey: 'page:1', assetSha256: 'h2' })];
    const b = [row({ artifactKey: 'page:1', assetSha256: 'h2' }), row({ artifactKey: 'cover', assetSha256: 'h1' })];
    expect(qualityEvidenceFingerprint(a)).toBe(qualityEvidenceFingerprint(b));
    const changed = [row({ artifactKey: 'cover', assetSha256: 'h1' }), row({ artifactKey: 'page:1', assetSha256: 'h2', verdict: 'failed' })];
    expect(qualityEvidenceFingerprint(changed)).not.toBe(qualityEvidenceFingerprint(a));
  });
});

describe('reserveQualityRegen — durable, atomic, budget-bounded', () => {
  it('grants a regen (returns true) when the conditional increment matches a row', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const db = { qualityEvidence: { updateMany } } as never;
    const granted = await reserveQualityRegen(db, { orderId: 'o1', artifactKey: 'page:1' });
    expect(granted).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o1', artifactKey: 'page:1', regenCount: { lt: QUALITY_REGEN_BUDGET } },
      data: { regenCount: { increment: 1 } },
    });
  });

  it('denies a regen (returns false) when the budget is exhausted (0 rows matched)', async () => {
    const db = { qualityEvidence: { updateMany: vi.fn(async () => ({ count: 0 })) } } as never;
    expect(await reserveQualityRegen(db, { orderId: 'o1', artifactKey: 'page:1' })).toBe(false);
  });
});

describe('ensureQualityEvidenceRow + makeQualityRegenReserver (#7-a 5b)', () => {
  type UpsertArg = { create: Record<string, unknown>; update: Record<string, unknown> };
  it('ensureQualityEvidenceRow: create at regenCount 0 (evidence_unknown), update is a NO-OP (never resets)', async () => {
    const upsert = vi.fn(async (_a: UpsertArg) => ({}));
    const db = { qualityEvidence: { upsert } } as never;
    await ensureQualityEvidenceRow(db, { orderId: 'o1', artifactKey: 'page:1' });
    const arg = upsert.mock.calls[0]![0];
    expect(arg.create).toMatchObject({ regenCount: 0, verdict: 'evidence_unknown', assetSha256: '' });
    expect(arg.update).toEqual({});
  });

  it('makeQualityRegenReserver: ensures the row BEFORE the atomic increment, returns the reserve result', async () => {
    const order: string[] = [];
    const upsert = vi.fn(async (_a: UpsertArg) => { order.push('ensure'); return {}; });
    const updateMany = vi.fn(async (_a: unknown) => { order.push('reserve'); return { count: 1 }; });
    const db = { qualityEvidence: { upsert, updateMany } } as never;
    const reserve = makeQualityRegenReserver(db, { orderId: 'o1', artifactKey: 'page:1' });
    expect(await reserve()).toBe(true);
    expect(order).toEqual(['ensure', 'reserve']); // crash-safe: row exists before the reserve increments it
  });

  it('makeQualityRegenReserver: false when the budget is spent (reserve matched 0 rows)', async () => {
    const db = { qualityEvidence: { upsert: vi.fn(async (_a: UpsertArg) => ({})), updateMany: vi.fn(async (_a: unknown) => ({ count: 0 })) } } as never;
    const reserve = makeQualityRegenReserver(db, { orderId: 'o1', artifactKey: 'page:1' });
    expect(await reserve()).toBe(false);
  });
});
