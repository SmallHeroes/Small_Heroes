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
    contractHash: null,
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

describe('(WS0b) evaluateQualityGate — contract staleness (contract_stale → evidence_unknown → re-QA)', () => {
  const passingRows = (contractHash: string | null) => [
    row({ artifactKey: 'cover', assetSha256: 'hcover', verdict: 'passed', contractHash }),
    row({ artifactKey: 'page:1', assetSha256: 'hp1', verdict: 'passed', contractHash }),
  ];

  it('null/null (no contract frozen — today) → NOT stale → passes exactly as before (byte-identical)', () => {
    // No activeContractHash threaded AND rows carry no contractHash → the WS0b check is a no-op.
    expect(evaluateQualityGate(REQUIRED, passingRows(null), CURRENT).status).toBe('passed');
    expect(evaluateQualityGate(REQUIRED, passingRows(null), CURRENT, { activeContractHash: null }).status).toBe('passed');
  });

  it('evidence bound to a superseded contract (row v1, active v2) → evidence_unknown, state contract_stale', () => {
    const r = evaluateQualityGate(REQUIRED, passingRows('v1'), CURRENT, { activeContractHash: 'v2' });
    expect(r.status).toBe('evidence_unknown');
    expect(r.failedArtifacts).toEqual([]); // re-QA, NEVER failed/refund-terminal
    const per = (r.evidence as { perArtifact: Record<string, { state?: string }> }).perArtifact;
    expect(per.cover.state).toBe('contract_stale');
    expect(per['page:1'].state).toBe('contract_stale');
  });

  it('evidence bound to the active contract (row v1, active v1) → decides on the real verdict (passed)', () => {
    expect(evaluateQualityGate(REQUIRED, passingRows('v1'), CURRENT, { activeContractHash: 'v1' }).status).toBe('passed');
  });

  it('FAIL-CLOSED default: hash-bound evidence with NO active contract threaded → stale (phantom contract)', () => {
    // Absent activeContractHash + a row that claims a contract → treated as stale (safe re-QA), per the helper.
    const r = evaluateQualityGate(REQUIRED, passingRows('v1'), CURRENT);
    expect(r.status).toBe('evidence_unknown');
  });

  it('CONVERGES: a stale row, after re-QA re-binds it to the stable active contract, is no longer stale (terminates)', () => {
    const active = 'v2';
    // Round 1 — evidence still bound to the OLD contract → contract_stale → evidence_unknown (triggers re-QA).
    expect(evaluateQualityGate(REQUIRED, passingRows('v1'), CURRENT, { activeContractHash: active }).status)
      .toBe('evidence_unknown');
    // Re-QA (recovery) re-binds each row's contractHash to the current (frozen, STABLE) active hash (WS0b B1:
    // recovery reads Order.visualContractHash to re-bind; the render seam threads the render-time hash instead).
    // The next read matches → NOT stale → the gate decides on the verdict → PASS.
    // Because the active contract is stable, this converges in ONE re-QA; the regen budget (QUALITY_REGEN_BUDGET)
    // bounds any actual re-renders in the existing recovery path — contract_stale itself consumes zero budget.
    expect(evaluateQualityGate(REQUIRED, passingRows(active), CURRENT, { activeContractHash: active }).status)
      .toBe('passed');
  });

  it('(WS0b B1) contractHash IS in the row fingerprint — a superseded-contract restamp drifts the TOCTOU hash', () => {
    const a = [row({ artifactKey: 'cover', assetSha256: 'h1', contractHash: 'v1' })];
    const b = [row({ artifactKey: 'cover', assetSha256: 'h1', contractHash: 'v2' })];
    // Same bytes/verdict/version/regenCount — only the bound contract differs → the fingerprint MUST differ.
    expect(qualityEvidenceFingerprint(a)).not.toBe(qualityEvidenceFingerprint(b));
    // null everywhere (freeze off) → the added element is a constant → still byte-identical eval-vs-commit.
    expect(qualityEvidenceFingerprint([row({ artifactKey: 'cover', assetSha256: 'h1', contractHash: null })]))
      .toBe(qualityEvidenceFingerprint([row({ artifactKey: 'cover', assetSha256: 'h1', contractHash: null })]));
  });

  it('(WS0b B1) stale-v1-row race: a late producer restamping a superseded contract drifts the fingerprint → TOCTOU abort', () => {
    // Eval time: the row is bound to the active contract v1 and would pass.
    const atEval = [row({ artifactKey: 'cover', assetSha256: 'h1', verdict: 'passed', contractHash: 'v1' })];
    // A late producer (post-eval, pre-commit) restamps the SAME row to a SUPERSEDED contract v2 — every other field
    // identical. The readiness TOCTOU fingerprint (folded into inputsHash) drifts, so the commit aborts + re-evaluates
    // instead of committing the stale-contract row as PASS.
    const atCommit = [row({ artifactKey: 'cover', assetSha256: 'h1', verdict: 'passed', contractHash: 'v2' })];
    expect(qualityEvidenceFingerprint(atEval)).not.toBe(qualityEvidenceFingerprint(atCommit));
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
