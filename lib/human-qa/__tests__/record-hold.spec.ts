import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import type { Prisma, HumanQaHoldKind } from '@prisma/client';
import {
  HUMAN_QA_HOLD_KINDS,
  holdKindRank,
  scopeForHoldKind,
  computeHoldFingerprint,
  planHumanQaHold,
  buildOperatorNotificationPayload,
  parsePagesFromRawReason,
  recordHumanQaHoldInTx,
  resolveHumanQaCaseOnReleaseInTx,
  type ActiveHoldCaseFacts,
  type RecordHumanQaHoldArgs,
} from '@/lib/human-qa/record-hold';

// ─── Fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────

function fpArgs(over: Partial<Parameters<typeof computeHoldFingerprint>[0]> = {}) {
  return {
    kind: 'safety' as HumanQaHoldKind,
    scope: 'base_book',
    rawReason: 'anchor_low_confidence:soft_band',
    inputVersion: 3,
    contractHash: 'ch_abc',
    sourceManifestId: 'man_1',
    artifactRefs: { readUrl: 'https://x/1', sha: 'deadbeef' },
    ...over,
  };
}

function recordArgs(over: Partial<RecordHumanQaHoldArgs> = {}): RecordHumanQaHoldArgs {
  return {
    orderId: 'ord_1',
    scope: 'base_book',
    kind: 'safety',
    rawReason: 'anchor_low_confidence:soft_band',
    humanReason: 'Anchor resemblance in the soft band; needs a human eye.',
    childName: 'Noa',
    inputVersion: 3,
    contractHash: 'ch_abc',
    sourceManifestId: 'man_1',
    artifactRefs: { readUrl: 'https://x/1' },
    ...over,
  };
}

// ─── PURE PLANNER (no DB) ───────────────────────────────────────────────────────────────────────────────────────

describe('planHumanQaHold — pure planner', () => {
  it('creates when there is no active case (revision = maxRevision + 1)', () => {
    expect(planHumanQaHold(null, fpArgs())).toMatchObject({ action: 'create', revision: 1 });
    expect(planHumanQaHold(null, { ...fpArgs(), maxRevision: 4 })).toMatchObject({ action: 'create', revision: 5 });
  });

  it('is idempotent when the incoming fingerprint matches the active case', () => {
    const args = fpArgs();
    const existing: ActiveHoldCaseFacts = { revision: 2, kind: 'safety', holdFingerprint: computeHoldFingerprint(args) };
    expect(planHumanQaHold(existing, args)).toEqual({ action: 'idempotent', revision: 2, fingerprint: existing.holdFingerprint });
  });

  it('skips a weaker incoming hold meeting a stronger active one (anchor vs active safety)', () => {
    const active: ActiveHoldCaseFacts = { revision: 1, kind: 'safety', holdFingerprint: 'fp_safety' };
    const plan = planHumanQaHold(active, fpArgs({ kind: 'anchor' }));
    expect(plan).toMatchObject({ action: 'skip_weaker', revision: 1 });
  });

  it('skips contract_world when a stronger safety hold is active', () => {
    const active: ActiveHoldCaseFacts = { revision: 3, kind: 'safety', holdFingerprint: 'fp_safety' };
    const plan = planHumanQaHold(active, fpArgs({ kind: 'contract_world' }));
    expect(plan).toMatchObject({ action: 'skip_weaker', revision: 3 });
  });

  it('supersedes on an equal-strength hold with a changed reason (safety over safety)', () => {
    const active: ActiveHoldCaseFacts = { revision: 1, kind: 'safety', holdFingerprint: 'fp_old' };
    const plan = planHumanQaHold(active, fpArgs({ kind: 'safety', rawReason: 'safety_scan:weapon_detected' }));
    expect(plan).toMatchObject({ action: 'supersede', revision: 2 });
  });

  it('supersedes a weaker active hold with a stronger incoming one (safety over active anchor)', () => {
    const active: ActiveHoldCaseFacts = { revision: 2, kind: 'anchor', holdFingerprint: 'fp_anchor' };
    const plan = planHumanQaHold(active, fpArgs({ kind: 'safety' }));
    expect(plan).toMatchObject({ action: 'supersede', revision: 3 });
  });

  it('increments the revision on every supersede', () => {
    const active: ActiveHoldCaseFacts = { revision: 7, kind: 'contract_world', holdFingerprint: 'fp_x' };
    expect(planHumanQaHold(active, fpArgs({ kind: 'safety' })).revision).toBe(8);
  });

  it('fingerprint is stable across object key-order and does not depend on revision', () => {
    const a = computeHoldFingerprint(fpArgs({ artifactRefs: { readUrl: 'u', sha: 's' } }));
    const b = computeHoldFingerprint(fpArgs({ artifactRefs: { sha: 's', readUrl: 'u' } }));
    expect(a).toBe(b);
    // Same identity, different revisions on the active case → still idempotent (revision is not in the identity).
    const args = fpArgs();
    const fp = computeHoldFingerprint(args);
    expect(planHumanQaHold({ revision: 1, kind: 'safety', holdFingerprint: fp }, args).action).toBe('idempotent');
    expect(planHumanQaHold({ revision: 99, kind: 'safety', holdFingerprint: fp }, args).action).toBe('idempotent');
  });

  it('payment_integrity lives in a different scope and is never ranked above base_book kinds', () => {
    expect(scopeForHoldKind('payment_integrity')).toBe('payment');
    for (const k of ['safety', 'contract_world', 'anchor', 'legacy_unknown'] as HumanQaHoldKind[]) {
      expect(scopeForHoldKind(k)).toBe('base_book');
      // Defensive: even if a stray cross-scope comparison happened, payment_integrity could never read as stronger.
      expect(holdKindRank('payment_integrity')).toBeLessThan(holdKindRank(k));
    }
    // Within the payment scope it composes normally: same fp → idempotent, different fp → supersede (equal rank).
    const args = fpArgs({ kind: 'payment_integrity', scope: 'payment' });
    const active: ActiveHoldCaseFacts = { revision: 1, kind: 'payment_integrity', holdFingerprint: computeHoldFingerprint(args) };
    expect(planHumanQaHold(active, args).action).toBe('idempotent');
    expect(planHumanQaHold(active, { ...args, rawReason: 'payment_mismatch:v2' }).action).toBe('supersede');
  });

  it('exports the canonical hold-kind list', () => {
    expect([...HUMAN_QA_HOLD_KINDS]).toEqual(['safety', 'contract_world', 'anchor', 'payment_integrity', 'legacy_unknown']);
  });
});

describe('buildOperatorNotificationPayload', () => {
  it('carries orderId + human reason + a pending-console marker and NO access key / deep link', () => {
    const payload = buildOperatorNotificationPayload({
      orderId: 'ord_1', childName: 'Noa', kind: 'anchor', scope: 'base_book',
      humanReason: 'needs a look', rawReason: 'anchor_low_confidence:page:4',
    });
    expect(payload).toEqual({
      orderId: 'ord_1', childName: 'Noa', kind: 'anchor', scope: 'base_book',
      humanReason: 'needs a look', pages: [4], reviewConsole: 'pending_slice_2',
    });
    const asJson = JSON.stringify(payload);
    expect(asJson).not.toMatch(/accessKey|access_key|http/i);
  });

  it('omits pages when none parse from the raw marker', () => {
    const payload = buildOperatorNotificationPayload({
      orderId: 'o', childName: 'c', kind: 'safety', scope: 'base_book', humanReason: 'r', rawReason: 'safety_scan:weapon',
    });
    expect(payload).not.toHaveProperty('pages');
  });

  it('parses multiple pages from a marker', () => {
    expect(parsePagesFromRawReason('contract_world_drift pages 4,5')).toEqual([4, 5]);
    expect(parsePagesFromRawReason('no digits here')).toEqual([]);
  });
});

// ─── MOCK TX (in-memory fake) ───────────────────────────────────────────────────────────────────────────────────

interface Row { [k: string]: unknown }

function whereMatches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v !== null && typeof v === 'object' && 'not' in (v as object)) {
      return row[k] !== (v as { not: unknown }).not;
    }
    return row[k] === v;
  });
}

/** Zip a raw INSERT's `(col, col, …)` list to its positional `${…}` VALUES so the fake stores named fields. */
function parseRawInsert(strings: TemplateStringsArray, values: unknown[]): { table: string; row: Row } {
  const sql = strings.join(' ');
  const m = sql.match(/INSERT INTO "(\w+)"\s*\(([\s\S]*?)\)\s*VALUES/i);
  if (!m) throw new Error(`mock $queryRaw: unrecognized statement: ${sql.slice(0, 60)}`);
  const table = m[1];
  const cols = m[2].split(',').map((c) => c.trim().replace(/"/g, ''));
  const row: Row = {};
  cols.forEach((c, i) => { row[c] = values[i]; });
  return { table, row };
}

function makeMockTx() {
  const cases: Row[] = [];
  const outboxes: Row[] = [];
  // Race simulation: when armed, the NEXT raw case-insert lands the pre-committed "winner" rows and then reports
  // ZERO inserted rows — exactly the non-aborting `ON CONFLICT DO NOTHING` outcome a concurrent producer that won
  // the activeKey / (orderId,scope,revision) unique race would produce. NOTE: it does NOT throw — the whole point
  // of the hardening is that a duplicate never aborts the caller's (possibly money-bearing) transaction.
  let raceWinner: { caseRow: Row; outboxRow: Row } | null = null;

  const humanQaReviewCase = {
    findUnique: async ({ where }: { where: Record<string, unknown> }) =>
      cases.find((c) => whereMatches(c, where)) ?? null,
    findFirst: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: { revision?: 'asc' | 'desc' } }) => {
      const matched = cases.filter((c) => whereMatches(c, where));
      if (orderBy?.revision === 'desc') matched.sort((a, b) => (b.revision as number) - (a.revision as number));
      return matched[0] ?? null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const row = cases.find((c) => c.id === where.id);
      if (!row) throw new Error(`case not found: ${where.id}`);
      Object.assign(row, data);
      return row;
    },
  };

  const operatorNotificationOutbox = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      outboxes.find((o) => whereMatches(o, where)) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const row = outboxes.find((o) => o.id === where.id);
      if (!row) throw new Error(`outbox not found: ${where.id}`);
      Object.assign(row, data);
      return row;
    },
  };

  // Models `tx.$queryRaw\`INSERT … ON CONFLICT DO NOTHING RETURNING "id"\``: returns [{id}] on insert, [] on a
  // unique conflict (NEVER throws), mirroring Postgres ON CONFLICT DO NOTHING.
  const $queryRaw = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<Array<{ id: string }>> => {
    const { table, row } = parseRawInsert(strings, values);
    if (table === 'HumanQaReviewCase') {
      if (raceWinner) {
        cases.push(raceWinner.caseRow);
        outboxes.push(raceWinner.outboxRow);
        raceWinner = null;
        return []; // ON CONFLICT DO NOTHING → zero rows, no throw
      }
      const conflict =
        (row.activeKey != null && cases.some((c) => c.activeKey === row.activeKey)) ||
        cases.some((c) => c.orderId === row.orderId && c.scope === row.scope && c.revision === row.revision);
      if (conflict) return [];
      cases.push(row);
      return [{ id: row.id as string }];
    }
    if (table === 'OperatorNotificationOutbox') {
      if (outboxes.some((o) => o.dedupeKey === row.dedupeKey)) return [];
      // The raw INSERT omits DB-defaulted columns; mirror the schema defaults the fake relies on.
      outboxes.push({ sendAttempted: false, claimVersion: 0, sendAttempts: 0, ...row });
      return [{ id: row.id as string }];
    }
    throw new Error(`mock $queryRaw: unexpected table ${table}`);
  };

  const tx = { humanQaReviewCase, operatorNotificationOutbox, $queryRaw } as unknown as Prisma.TransactionClient;
  return {
    tx,
    cases,
    outboxes,
    armRace(caseRow: Row, outboxRow: Row) {
      raceWinner = { caseRow, outboxRow };
    },
  };
}

// ─── THIN APPLIER (mock tx) ─────────────────────────────────────────────────────────────────────────────────────

describe('recordHumanQaHoldInTx — thin applier', () => {
  it('identical replay collapses to exactly one case + one outbox', async () => {
    const m = makeMockTx();
    const first = await recordHumanQaHoldInTx(m.tx, recordArgs());
    expect(first.action).toBe('create');
    expect(m.cases).toHaveLength(1);
    expect(m.outboxes).toHaveLength(1);

    const replay = await recordHumanQaHoldInTx(m.tx, recordArgs());
    expect(replay.action).toBe('idempotent');
    expect(replay.caseId).toBe(first.caseId);
    expect(replay.outboxId).toBe(first.outboxId);
    expect(m.cases).toHaveLength(1);
    expect(m.outboxes).toHaveLength(1);
  });

  it('a concurrent insert race collapses to the winning row WITHOUT throwing (no duplicate case/outbox)', async () => {
    // The real guarantee is the DB unique constraint (activeKey / (orderId,scope,revision) / dedupeKey) + a
    // NON-ABORTING `ON CONFLICT DO NOTHING`: a concurrent duplicate can never create a second row, and — critically
    // for the payment fences that call this in the SAME tx as their money writes — never aborts the caller's
    // transaction. Here the winner "commits" just before our insert; our insert reports zero rows and we re-select.
    const m = makeMockTx();
    const winnerCase: Row = {
      id: 'case_winner', activeKey: 'ord_1:base_book', orderId: 'ord_1', scope: 'base_book',
      revision: 1, kind: 'safety', status: 'open', holdFingerprint: 'fp_winner',
    };
    const winnerOutbox: Row = {
      id: 'obx_winner', dedupeKey: 'human-qa/ord_1/base_book/1', caseId: 'case_winner',
      orderId: 'ord_1', scope: 'base_book', status: 'scheduled', sendAttempted: false,
    };
    m.armRace(winnerCase, winnerOutbox);

    const res = await recordHumanQaHoldInTx(m.tx, recordArgs());
    expect(res.action).toBe('idempotent');
    expect(res.caseId).toBe('case_winner');
    expect(res.outboxId).toBe('obx_winner');
    expect(m.cases).toHaveLength(1);
    expect(m.outboxes).toHaveLength(1);
  });

  it('supersede retires the old case, suppresses its outbox, and opens a new case+outbox', async () => {
    const m = makeMockTx();
    const first = await recordHumanQaHoldInTx(m.tx, recordArgs({ rawReason: 'safety_scan:v1' }));
    const second = await recordHumanQaHoldInTx(m.tx, recordArgs({ rawReason: 'safety_scan:v2' }));

    expect(second.action).toBe('supersede');
    expect(second.revision).toBe(2);
    expect(m.cases).toHaveLength(2);
    expect(m.outboxes).toHaveLength(2);

    const oldCase = m.cases.find((c) => c.id === first.caseId)!;
    expect(oldCase.status).toBe('superseded');
    expect(oldCase.activeKey).toBeNull();
    expect(oldCase.supersededByCaseId).toBe(second.caseId);

    const newCase = m.cases.find((c) => c.id === second.caseId)!;
    expect(newCase.status).toBe('open');
    expect(newCase.activeKey).toBe('ord_1:base_book');
    expect(newCase.revision).toBe(2);

    const oldOutbox = m.outboxes.find((o) => o.id === first.outboxId)!;
    expect(oldOutbox.status).toBe('suppressed');
    const newOutbox = m.outboxes.find((o) => o.id === second.outboxId)!;
    expect(newOutbox.status).toBe('scheduled');
  });

  it('release resolves an anchor case and suppresses its unsent outbox', async () => {
    const m = makeMockTx();
    const held = await recordHumanQaHoldInTx(m.tx, recordArgs({ kind: 'anchor', rawReason: 'anchor_low_confidence:soft_band' }));

    const out = await resolveHumanQaCaseOnReleaseInTx(m.tx, {
      orderId: 'ord_1', scope: 'base_book', kinds: ['anchor'], actor: 'qa@example.com', note: 'looks fine',
    });
    expect(out.resolvedCaseId).toBe(held.caseId);

    const c = m.cases.find((x) => x.id === held.caseId)!;
    expect(c.status).toBe('resolved');
    expect(c.activeKey).toBeNull();
    expect(c.resolvedActor).toBe('qa@example.com');
    expect(c.resolvedAt).toBeInstanceOf(Date);
    expect(c.decisionNote).toBe('looks fine');
    expect(m.outboxes.find((o) => o.id === held.outboxId)!.status).toBe('suppressed');
  });

  it('release is a NO-OP for a safety case when gated on kinds:[anchor]', async () => {
    const m = makeMockTx();
    const held = await recordHumanQaHoldInTx(m.tx, recordArgs({ kind: 'safety' }));

    const out = await resolveHumanQaCaseOnReleaseInTx(m.tx, {
      orderId: 'ord_1', scope: 'base_book', kinds: ['anchor'], actor: 'qa@example.com',
    });
    expect(out.resolvedCaseId).toBeNull();

    const c = m.cases.find((x) => x.id === held.caseId)!;
    expect(c.status).toBe('open');
    expect(c.activeKey).toBe('ord_1:base_book');
    expect(m.outboxes.find((o) => o.id === held.outboxId)!.status).toBe('scheduled');
  });
});

// ─── MIGRATION PRESENCE (cheap guard the CHECK + unique indexes are not dropped) ──────────────────────────────────

describe('20260718_human_qa_review_case migration', () => {
  const sqlPath = path.join(process.cwd(), 'backend', 'migrations', '20260718_human_qa_review_case', 'migration.sql');

  it('exists', () => {
    expect(existsSync(sqlPath)).toBe(true);
  });

  it('binds the status↔activeKey lifecycle CHECK', () => {
    const sql = readFileSync(sqlPath, 'utf8');
    expect(sql).toContain('HumanQaReviewCase_active_key_lifecycle_check');
    expect(sql).toMatch(/"status"\s*=\s*'open'\s+AND\s+"activeKey"\s*=\s*"orderId"\s*\|\|\s*':'\s*\|\|\s*"scope"/);
    expect(sql).toMatch(/"status"\s+IN\s*\('superseded','resolved','cancelled'\)\s+AND\s+"activeKey"\s+IS\s+NULL/);
  });

  it('declares the three unique indexes', () => {
    const sql = readFileSync(sqlPath, 'utf8');
    expect(sql).toContain('"HumanQaReviewCase_activeKey_key"');
    expect(sql).toContain('"HumanQaReviewCase_orderId_scope_revision_key"');
    expect(sql).toContain('"OperatorNotificationOutbox_dedupeKey_key"');
  });
});
