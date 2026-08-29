import { readFileSync } from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import {
  BARRIER_OWNED_PIPELINE_CACHE_KEYS,
  persistOrdinaryPipelineCache,
} from '../pipeline-cache-store';
import { ensureFrozenVisualContract } from '../ensure-frozen-visual-contract';
import { executeReadinessShipCas, writeOrderHoldFenced } from '../order-authority';
import type { PipelineCache } from '../types';

/**
 * (Codex round-4 MAJOR 1 + MAJOR 2) REAL PostgreSQL semantics for the
 * barrier-owned pipelineCache keys — executed, not text-inspected. PGlite is
 * actual Postgres (WASM build), fully offline and hermetic, so this runs in
 * the ordinary battery on every machine.
 *
 * What executes here is not a re-implementation: the ordinary-store statement
 * is captured from `persistOrdinaryPipelineCache` itself (its exact tagged
 * template, replayed with $n parameters), the freeze write runs through the
 * REAL `ensureFrozenVisualContract` (its barrier callback executing against
 * this database), and the Board write replays the exact statement extracted
 * from set-identity-board-stage.ts's source.
 *
 * Proven:
 *  1. jsonb_strip_nulls REGRESSION — the real approved a9c253d9… contract
 *     template (8 nested nulls) survives an ordinary write byte-for-byte:
 *     canonical digest stays 51901523… and never becomes the stripped
 *     6c28adf8… Codex demonstrated.
 *  2. Value-verbatim preservation for nested nulls, null array entries, and an
 *     explicit top-level JSON null; key ABSENCE is preserved (an ordinary
 *     write cannot create a barrier-owned key); a SQL-NULL cache column is
 *     tolerated.
 *  3. Both commit orders for freeze-vs-ordinary and Board-vs-ordinary: the
 *     barrier-owned value wins deterministically, so a stale ordinary
 *     replacement can never delete or roll back a freeze or a Board binding —
 *     which is also why a receipt REPLAY (which skips the barrier mutation)
 *     can never meet a cache the ordinary path hollowed out.
 */

const APPROVED_PACKAGE_PATH = path.join(
  process.cwd(),
  'visual-packages/approved/revisions',
  'a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb.visual-package.json',
);
// The exact digest pair from the Codex round-4 finding: the template's true
// canonical digest, and the corrupted digest jsonb_strip_nulls produced.
const APPROVED_TEMPLATE_DIGEST =
  '51901523133394266c7e5a795e2ee5b5cf471733d9d781e61107484e3460f365';
const STRIPPED_TEMPLATE_DIGEST =
  '6c28adf8483a63374d2768abcd339303c24e59b5430086541664305d1ddbe2f1';

let pg: PGlite;

/**
 * Adapter: replay a Prisma tagged-template raw call against PGlite verbatim. Composed
 * `Prisma.sql` fragments (e.g. the ship CAS's terminal-hold blocklist and optional clauses) are
 * SPLICED as SQL text with their own params renumbered — exactly what Prisma's serializer does —
 * so the statement that executes here is the production statement.
 */
function flattenSql(
  strings: TemplateStringsArray | readonly string[],
  values: unknown[],
): { text: string; params: unknown[] } {
  let text = '';
  const params: unknown[] = [];
  strings.forEach((part, i) => {
    text += part;
    if (i < values.length) {
      const value = values[i] as { strings?: readonly string[]; values?: unknown[] } | unknown;
      if (
        value &&
        typeof value === 'object' &&
        Array.isArray((value as { strings?: unknown }).strings) &&
        Array.isArray((value as { values?: unknown }).values)
      ) {
        const fragment = value as { strings: readonly string[]; values: unknown[] };
        const inner = flattenSql(fragment.strings, fragment.values);
        const offset = params.length;
        text += inner.text.replace(/\$(\d+)/g, (_, n: string) => `$${offset + Number(n)}`);
        params.push(...inner.params);
      } else {
        params.push(value);
        text += `$${params.length}`;
      }
    }
  });
  return { text, params };
}
function replayRaw(strings: TemplateStringsArray | readonly string[], values: unknown[]) {
  const { text, params } = flattenSql(strings, values);
  return pg.query(text, params as never[]);
}
const storeDb = {
  $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const result = await replayRaw(strings, values);
    return result.affectedRows ?? 0;
  },
};
/** Barrier tx adapter: the freeze callback's `tx.order.update` + `tx.$executeRaw`, against PGlite. */
const barrierTx = {
  order: {
    update: async (args: { where: { id: string }; data: { visualContractHash: string } }) => {
      await pg.query('UPDATE "Order" SET "visualContractHash" = $1 WHERE "id" = $2', [
        args.data.visualContractHash,
        args.where.id,
      ]);
      return {};
    },
  },
  $executeRaw: storeDb.$executeRaw,
};
const fakeWithMutation = (async (
  _db: unknown,
  _args: unknown,
  mutate: (tx: typeof barrierTx) => Promise<unknown>,
) => {
  const value = await mutate(barrierTx);
  return { value, inputVersion: 1, orderStatus: 'generating', readinessInvalidated: false };
}) as never;

async function readCache(orderId: string): Promise<Record<string, unknown> | null> {
  const result = await pg.query<{ pipelineCache: Record<string, unknown> | null }>(
    'SELECT "pipelineCache" FROM "GenerationJob" WHERE "orderId" = $1',
    [orderId],
  );
  return result.rows[0]?.pipelineCache ?? null;
}

async function seedJob(orderId: string, cache: unknown): Promise<void> {
  await pg.query('INSERT INTO "Order" ("id") VALUES ($1) ON CONFLICT DO NOTHING', [orderId]);
  await pg.query(
    'INSERT INTO "GenerationJob" ("orderId", "pipelineCache") VALUES ($1, $2::jsonb)',
    [orderId, cache === null ? null : JSON.stringify(cache)],
  );
}

/** The exact Board persist statement, extracted from the module source (zero drift). */
function boardStatement(): { text: string } {
  const source = readFileSync(
    path.join(process.cwd(), 'lib/generation-pipeline/set-identity-board-stage.ts'),
    'utf8',
  );
  const raw = source.match(/UPDATE "GenerationJob"[^`]*'\{setIdentityBoards\}'[^`]*/)?.[0];
  if (!raw) throw new Error('board persist statement not found in set-identity-board-stage.ts');
  const text = raw
    .replace('${JSON.stringify(context)}', '$1')
    .replace('${orderId}', '$2');
  if (text.includes('${')) throw new Error(`unsubstituted placeholder in board statement: ${text}`);
  return { text };
}

// A contract fixture with every null shape the finding names: nested object
// nulls, null array entries — plus (as a separate cache key) an explicit
// top-level JSON null value.
const NULLED_CONTRACT = {
  storyKey: 'nulled_fixture',
  pageContracts: [
    { pageNumber: 1, transition: { cue: null, fromZoneId: null, toZoneId: 'z2' } },
    { pageNumber: 2, sameLocationAs: null },
  ],
  markers: [null, 'a', null],
  deep: { deeper: { value: null } },
};

describe('pipeline-cache-store — REAL PostgreSQL semantics (PGlite)', () => {
  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(`
      CREATE TYPE "OrderStatus" AS ENUM ('paid','generating','ready','partial','needs_human_qa','failed');
      CREATE TYPE "GenerationStatus" AS ENUM ('pending','running','done','failed');
      CREATE TABLE "Order" (
        "id" text PRIMARY KEY,
        "visualContractHash" text,
        "status" "OrderStatus" DEFAULT 'generating',
        "packageStatus" "GenerationStatus" DEFAULT 'pending',
        "deliveryHoldReason" text,
        "manualReviewRequired" boolean DEFAULT false,
        "inputVersion" int DEFAULT 0,
        "deliveryFenceVersion" int DEFAULT 0
      );
      CREATE TABLE "GenerationJob" ("orderId" text PRIMARY KEY, "pipelineCache" jsonb);
      CREATE TABLE "HumanQaReviewCase" ("id" text PRIMARY KEY, "activeKey" text, "status" text, "kind" text);
    `);
  });
  afterAll(async () => {
    await pg.close();
  });
  beforeEach(async () => {
    await pg.exec('DELETE FROM "GenerationJob"; DELETE FROM "Order";');
  });

  it('the REAL approved a9c253d9… template survives an ordinary write byte-for-byte (the strip_nulls regression)', async () => {
    const template = (
      JSON.parse(readFileSync(APPROVED_PACKAGE_PATH, 'utf8')) as {
        visualContractTemplate: { content: unknown };
      }
    ).visualContractTemplate.content;
    // The fixture really is the finding's artifact: its canonical digest is the
    // exact pair Codex reported.
    expect(canonicalJsonDigest(template)).toBe(APPROVED_TEMPLATE_DIGEST);

    await seedJob('o-real', {
      visualContract: template,
      visualPackageAuthority: { packageRevisionDigest: 'a9c253d9'.repeat(8) },
      ordinaryOld: 'to-be-replaced',
    });
    await persistOrdinaryPipelineCache(storeDb as never, 'o-real', {
      textFinalized: true,
      visualContract: { schemaVersion: 'hostile-in-memory' },
    } as unknown as PipelineCache);

    const after = await readCache('o-real');
    expect(canonicalJsonDigest(after?.visualContract)).toBe(APPROVED_TEMPLATE_DIGEST);
    expect(canonicalJsonDigest(after?.visualContract)).not.toBe(STRIPPED_TEMPLATE_DIGEST);
    // Ordinary replacement semantics still hold around it.
    expect(after?.ordinaryOld).toBeUndefined();
    expect(after?.textFinalized).toBe(true);
    expect(after?.visualPackageAuthority).toEqual({ packageRevisionDigest: 'a9c253d9'.repeat(8) });
  });

  it('preserves nested nulls, null array entries, and an explicit top-level JSON null — verbatim', async () => {
    await seedJob('o-nulls', {
      visualContract: NULLED_CONTRACT,
      // Explicit top-level JSON null VALUE for a barrier-owned key: the key
      // EXISTS and must survive as null (never be dropped, never re-created).
      visualPackageAuthority: null,
      setIdentityBoards: { mode: 'required-v2', bindings: { loc: null } },
    });
    await persistOrdinaryPipelineCache(storeDb as never, 'o-nulls', {
      storyKey: 'k',
      visualPackageAuthority: { version: 'hostile' },
      setIdentityBoards: { mode: 'hostile' },
    } as unknown as PipelineCache);

    const after = await readCache('o-nulls');
    expect(after?.visualContract).toEqual(NULLED_CONTRACT);
    expect(after).toHaveProperty('visualPackageAuthority', null);
    expect(after?.setIdentityBoards).toEqual({ mode: 'required-v2', bindings: { loc: null } });
    expect(after?.storyKey).toBe('k');
  });

  it('cannot CREATE a barrier-owned key (absent stays absent), and tolerates a SQL-NULL cache column', async () => {
    await seedJob('o-absent', { ordinary: 1 });
    await persistOrdinaryPipelineCache(storeDb as never, 'o-absent', {
      visualContract: { smuggled: true },
      visualPackageAuthority: { smuggled: true },
      setIdentityBoards: { smuggled: true },
      ordinary: 2,
    } as unknown as PipelineCache);
    const after = await readCache('o-absent');
    expect(after).toEqual({ ordinary: 2 });
    for (const key of BARRIER_OWNED_PIPELINE_CACHE_KEYS) {
      expect(after).not.toHaveProperty(key);
    }

    await seedJob('o-null-col', null);
    const rows = await persistOrdinaryPipelineCache(storeDb as never, 'o-null-col', {
      seeded: true,
    } as unknown as PipelineCache);
    expect(rows).toBe(1);
    expect(await readCache('o-null-col')).toEqual({ seeded: true });
  });

  it('freeze-vs-ordinary, BOTH commit orders: the freeze-written contract + authority win deterministically', async () => {
    const authority = { version: 'frozen-visual-package-authority/v3', packageRevisionDigest: 'b'.repeat(64), detail: { note: null } };
    const staleSnapshot = { storyKey: 'stale', visualContract: { schemaVersion: 'stale-in-memory' } } as unknown as PipelineCache;
    const order = (id: string) =>
      ({
        id,
        selectionFilename: 'story-bank/v3-approved/bunny.md',
        storySourceHash: 'f'.repeat(64),
        illustrationStyle: 'pencil_watercolor',
        visualPackageAuthority: null,
        visualContractHash: null,
      }) as never;
    const freeze = (id: string) =>
      ensureFrozenVisualContract(order(id), {} as PipelineCache, {
        produce: async () => ({
          contract: NULLED_CONTRACT as never,
          contractHash: 'c0'.repeat(32),
          visualPackageAuthority: authority as never,
        }),
        withMutation: fakeWithMutation,
        db: barrierTx as never,
      });
    const prevFreeze = process.env.VISUAL_CONTRACT_FREEZE;
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    try {
      // Order 1: barrier first, then a STALE ordinary replacement.
      await seedJob('o-freeze-1', { seeded: true });
      await freeze('o-freeze-1');
      await persistOrdinaryPipelineCache(storeDb as never, 'o-freeze-1', staleSnapshot);
      const one = await readCache('o-freeze-1');
      expect(one?.visualContract).toEqual(NULLED_CONTRACT);
      expect(one?.visualPackageAuthority).toEqual(authority);
      expect(one?.storyKey).toBe('stale'); // ordinary keys still replaced

      // Order 2: ordinary first, then the barrier — the barrier writes land on top.
      await seedJob('o-freeze-2', { seeded: true });
      await persistOrdinaryPipelineCache(storeDb as never, 'o-freeze-2', staleSnapshot);
      await freeze('o-freeze-2');
      const two = await readCache('o-freeze-2');
      expect(two?.visualContract).toEqual(NULLED_CONTRACT);
      expect(two?.visualPackageAuthority).toEqual(authority);
      // A second stale ordinary write (the receipt-replay window) still cannot hollow it out.
      await persistOrdinaryPipelineCache(storeDb as never, 'o-freeze-2', { storyKey: 'later' } as unknown as PipelineCache);
      const replayed = await readCache('o-freeze-2');
      expect(replayed?.visualContract).toEqual(NULLED_CONTRACT);
      expect(replayed?.visualPackageAuthority).toEqual(authority);
    } finally {
      if (prevFreeze === undefined) delete process.env.VISUAL_CONTRACT_FREEZE;
      else process.env.VISUAL_CONTRACT_FREEZE = prevFreeze;
    }
  });

  it('(Codex round-5) the REAL ship CAS binds the observed anchor-disposition source — a flipped band matches ZERO rows', async () => {
    // The exact production statement (executeReadinessShipCas) executes here: a ship derived from a
    // clear anchor source must not win once the producing snapshot's childAnchorLowConfidence has
    // been flipped by a concurrent ordinary write (which bumps no inputVersion).
    const statusOf = async () =>
      (await pg.query<{ status: string }>('SELECT "status"::text AS status FROM "Order" WHERE "id" = $1', ['o-cas'])).rows[0]?.status;
    await seedJob('o-cas', { ordinary: 1 }); // childAnchorLowConfidence ABSENT → observed source null
    const casDb = { $executeRaw: storeDb.$executeRaw } as never;

    // Observed null ≡ row null → the ship wins.
    expect(
      await executeReadinessShipCas(casDb, {
        orderId: 'o-cas',
        inputVersion: 0,
        deliveryFenceVersion: 0,
        deliveryHoldReason: null,
        producingAnchorBind: { childAnchorLowConfidence: null },
      }),
    ).toBe(1);
    expect(await statusOf()).toBe('ready');

    // Reset; flip the band on the producing snapshot AFTER the (simulated) eval observed null.
    await pg.query(`UPDATE "Order" SET "status" = 'generating' WHERE "id" = $1`, ['o-cas']);
    await pg.query(
      `UPDATE "GenerationJob" SET "pipelineCache" = jsonb_set("pipelineCache", '{childAnchorLowConfidence}', $1::jsonb, true) WHERE "orderId" = $2`,
      [JSON.stringify({ reason: 'hard_band', score: 0.3 }), 'o-cas'],
    );
    expect(
      await executeReadinessShipCas(casDb, {
        orderId: 'o-cas',
        inputVersion: 0,
        deliveryFenceVersion: 0,
        deliveryHoldReason: null,
        producingAnchorBind: { childAnchorLowConfidence: null }, // stale observation
      }),
    ).toBe(0);
    expect(await statusOf()).toBe('generating'); // never shipped

    // An eval that observed the CURRENT band value binds and wins.
    expect(
      await executeReadinessShipCas(casDb, {
        orderId: 'o-cas',
        inputVersion: 0,
        deliveryFenceVersion: 0,
        deliveryHoldReason: null,
        producingAnchorBind: { childAnchorLowConfidence: { reason: 'hard_band', score: 0.3 } },
      }),
    ).toBe(1);
    expect(await statusOf()).toBe('ready');
  });

  it('Board-vs-ordinary, BOTH commit orders: the barrier-written Board binding survives a stale replacement (the rollback Codex named)', async () => {
    const boardContext = {
      mode: 'required-v2',
      frozenContractHash: 'c1'.repeat(32),
      bindings: { 'loc:kindergarten': { assetSha256: 'd'.repeat(64), objectPath: null } },
    };
    const { text } = boardStatement();
    const staleSnapshot = { storyKey: 'pre-board-snapshot' } as unknown as PipelineCache;

    // Order 1: Board bound, then a STALE ordinary snapshot (taken before the
    // bind) is persisted — the binding must survive without any version bump.
    await seedJob('o-board-1', { storyKey: 'pre-board-snapshot' });
    await pg.query(text, [JSON.stringify(boardContext), 'o-board-1']);
    await persistOrdinaryPipelineCache(storeDb as never, 'o-board-1', staleSnapshot);
    const one = await readCache('o-board-1');
    expect(one?.setIdentityBoards).toEqual(boardContext);

    // Order 2: ordinary write first, Board bind second — binding present.
    await seedJob('o-board-2', { storyKey: 'pre-board-snapshot' });
    await persistOrdinaryPipelineCache(storeDb as never, 'o-board-2', staleSnapshot);
    await pg.query(text, [JSON.stringify(boardContext), 'o-board-2']);
    const two = await readCache('o-board-2');
    expect(two?.setIdentityBoards).toEqual(boardContext);
  });

  it('(Codex round-9) requireOpenCaseId: the EXISTS bind lands the hold ONLY while the SAME case is open — real SQL semantics', async () => {
    // PGlite already has the HumanQaReviewCase table from the beforeAll DDL.
    // $queryRaw adapter: flattenSql → pg.query, return rows array (writeOrderHoldFenced's SELECT path).
    const queryRawAdapter = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const { text, params } = flattenSql(strings as readonly string[], values);
      const result = await pg.query<Record<string, unknown>>(text, params as never[]);
      // PGlite returns boolean columns as booleans; the funnel checks === true, which is compatible.
      return result.rows;
    };
    const holdDb = { $queryRaw: queryRawAdapter as never, $executeRaw: storeDb.$executeRaw } as never;
    const orderStatusOf = async (id: string) =>
      (await pg.query<{ status: string }>('SELECT "status"::text AS status FROM "Order" WHERE "id" = $1', [id])).rows[0]?.status;
    const holdReasonOf = async (id: string) =>
      (await pg.query<{ r: string | null }>('SELECT "deliveryHoldReason" AS r FROM "Order" WHERE "id" = $1', [id])).rows[0]?.r;

    // Seed order + open case.
    await pg.query(
      `INSERT INTO "Order" ("id") VALUES ('o-case-bind-1')`,
    );
    await pg.query(
      `INSERT INTO "HumanQaReviewCase" ("id", "status", "kind") VALUES ('case-open', 'open', 'safety')`,
    );

    // Attempt with an OPEN case → hold lands (applied).
    const resultOpen = await writeOrderHoldFenced(holdDb, {
      orderId: 'o-case-bind-1',
      newStatus: 'needs_human_qa',
      newHoldReason: 'safety_hold:hazard:pg_test',
      requireOpenCaseId: 'case-open',
    });
    expect(resultOpen).toBe('applied');
    expect(await orderStatusOf('o-case-bind-1')).toBe('needs_human_qa');
    expect(await holdReasonOf('o-case-bind-1')).toBe('safety_hold:hazard:pg_test');

    // Reset the Order to clean state; mark the case closed.
    await pg.query(`UPDATE "Order" SET "status" = 'generating', "deliveryHoldReason" = NULL, "deliveryFenceVersion" = 0 WHERE "id" = 'o-case-bind-1'`);
    await pg.query(`UPDATE "HumanQaReviewCase" SET "status" = 'resolved' WHERE "id" = 'case-open'`);

    // Attempt with the SAME case id now CLOSED → funnel returns 'lost', no hold lands.
    const resultClosed = await writeOrderHoldFenced(holdDb, {
      orderId: 'o-case-bind-1',
      newStatus: 'needs_human_qa',
      newHoldReason: 'safety_hold:hazard:pg_test',
      requireOpenCaseId: 'case-open',
    });
    expect(resultClosed).toBe('lost');
    // Order is UNCHANGED — a closed case grants zero authority.
    expect(await orderStatusOf('o-case-bind-1')).toBe('generating');
    expect(await holdReasonOf('o-case-bind-1')).toBeNull();
  });

  it('(Codex round-10) the REAL ship CAS never matches a DELIVERED row: `ready` and `partial` reject (0 rows, bytes untouched); `generating` still ships', async () => {
    // The shared production SQL changed (status NOT IN ('ready','partial')) — this executes the
    // exact exported statement against real Postgres, per the round-10 requirement.
    const casDb = { $executeRaw: storeDb.$executeRaw } as never;
    const rowOf = async (id: string) =>
      (await pg.query<{ status: string; hold: string | null; fence: number }>(
        'SELECT "status"::text AS status, "deliveryHoldReason" AS hold, "deliveryFenceVersion" AS fence FROM "Order" WHERE "id" = $1',
        [id],
      )).rows[0];
    const ship = (id: string) =>
      executeReadinessShipCas(casDb, { orderId: id, inputVersion: 0, deliveryFenceVersion: 0, deliveryHoldReason: null });

    // READY (already delivered by a competing worker; its post-ship marker must survive verbatim).
    await pg.query(`INSERT INTO "Order" ("id","status","deliveryHoldReason") VALUES ('o-r10-ready','ready','qa_soft_deliver:soft_band')`);
    expect(await ship('o-r10-ready')).toBe(0);
    expect(await rowOf('o-r10-ready')).toEqual({ status: 'ready', hold: 'qa_soft_deliver:soft_band', fence: 0 });

    // PARTIAL (partially delivered — the same non-retraction pair as writeOrderHoldFenced).
    await pg.query(`INSERT INTO "Order" ("id","status") VALUES ('o-r10-partial','partial')`);
    expect(await ship('o-r10-partial')).toBe(0);
    expect(await rowOf('o-r10-partial')).toEqual({ status: 'partial', hold: null, fence: 0 });

    // GENERATING (positive control): the exclusion must not block an ordinary clean ship.
    await pg.query(`INSERT INTO "Order" ("id","status") VALUES ('o-r10-gen','generating')`);
    expect(await ship('o-r10-gen')).toBe(1);
    expect((await rowOf('o-r10-gen')).status).toBe('ready');
  });
});
