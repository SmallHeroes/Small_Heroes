import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withDeliveryInputMutation } from '@/lib/generation-pipeline/readiness-manifest';
import { reserveMarkAndClearRegen } from '@/lib/generation-chunked/clear-page-images-for-regen';
import {
  ReceiptPayloadMismatchError,
  AtomicOperationOutcomeUnknownError,
  isOutcomeUnknown,
  hashOperationPayload,
  runAtomicOperation,
} from '@/lib/generation-pipeline/atomic-operation';

/**
 * (Codex B′) Integration coverage of the receipt fence WIRED into the three barrier entry points. The wrapper's
 * exactly-once mechanics are unit-tested in atomic-operation.spec.ts; here we prove each SITE actually routes
 * through it and is exactly-once under an ambiguous commit (tx committed on the 6543 pooler, caller sees P2028).
 *
 * The fake models the AtomicOperationReceipt table + interactive-tx atomicity: staged writes commit only when the
 * tx callback resolves; a throw rolls them back (so a non-committed attempt leaves no receipt). `$queryRaw` is
 * dispatched by SQL content — the receipt INSERT ... ON CONFLICT DO NOTHING vs the Order inputVersion++ UPDATE.
 */
class PrismaErr extends Error {
  meta: { error: string };
  constructor(public code: string, msg = code) {
    super(msg);
    this.meta = { error: msg };
  }
}

interface ReceiptRow { payloadHash: string; result: unknown }

function makeFake(opts: {
  seedReceipts?: Record<string, ReceiptRow>;
  versionRow?: { inputVersion: number; status: string; previousStatus: string };
  // reservation store for the regen path
  regen?: { count: number; budget: number };
} = {}) {
  const committedReceipts = new Map<string, ReceiptRow>(Object.entries(opts.seedReceipts ?? {}));
  const versionRow = opts.versionRow ?? { inputVersion: 5, status: 'generating', previousStatus: 'generating' };
  const regen = opts.regen; // shared, mutated only on commit
  const spies = {
    mutate: vi.fn(),
    bookReadinessUpdateMany: vi.fn(),
    regenUpdateMany: vi.fn(),
  };

  const prisma = {
    _receipts: committedReceipts,
    _regen: regen,
    async $transaction(cb: (tx: unknown) => Promise<unknown>, _opts?: unknown) {
      const stagedReceipts = new Map(committedReceipts);
      // staged copy of the reservation counter so a rollback un-does the increment
      const stagedRegen = regen ? { ...regen } : undefined;
      const tx = {
        async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
          const sql = strings.join(' ');
          if (sql.includes('AtomicOperationReceipt')) {
            const operationKey = values[1] as string;
            const payloadHash = values[4] as string;
            if (stagedReceipts.has(operationKey)) return []; // ON CONFLICT DO NOTHING
            stagedReceipts.set(operationKey, { payloadHash, result: {} });
            return [{ id: values[0] }];
          }
          if (sql.includes('SELECT "id" FROM "Order"') && sql.includes('FOR UPDATE')) {
            return [{ id: 'o1' }];
          }
          if (sql.includes('inputVersion')) return [versionRow]; // Order version++ UPDATE
          return [];
        },
        atomicOperationReceipt: {
          async findUnique({ where }: { where: { operationKey: string } }) {
            const row = stagedReceipts.get(where.operationKey);
            return row ? { payloadHash: row.payloadHash, result: row.result } : null;
          },
          async update({ where, data }: { where: { operationKey: string }; data: { result: unknown } }) {
            const row = stagedReceipts.get(where.operationKey);
            if (row) row.result = data.result;
            return {};
          },
        },
        bookReadiness: { updateMany: async (a: unknown) => { spies.bookReadinessUpdateMany(a); return { count: 1 }; } },
        generationJob: { update: async () => ({}) },
        imageAsset: { update: async (a: unknown) => { spies.mutate(a); return { id: 'asset-1' }; }, deleteMany: async () => ({ count: 1 }) },
        // regen-reserve path
        qualityEvidence: {
          updateMany: async (a: { where: { regenCount?: { lt: number } } }) => {
            spies.regenUpdateMany(a);
            if (!stagedRegen) return { count: 0 };
            if (stagedRegen.count < stagedRegen.budget) { stagedRegen.count += 1; return { count: 1 }; }
            return { count: 0 };
          },
          upsert: async () => ({}),
          findUnique: async () => ({ evidence: {} }),
          update: async () => ({}),
        },
        generatedBook: { findUnique: async () => ({ id: 'book-1', pages: [{ id: 'p-1' }] }), update: async () => ({}) },
        order: { update: async () => ({}) },
      };
      const value = await cb(tx); // throw → rollback (staged discarded)
      for (const [k, v] of stagedReceipts) committedReceipts.set(k, v); // commit receipts
      if (regen && stagedRegen) regen.count = stagedRegen.count; // commit reservation
      return value;
    },
  };
  return { prisma, spies };
}

describe('(Codex B′) receipt fence wired into withDeliveryInputMutation', () => {
  let prev: string | undefined;
  beforeEach(() => { prev = process.env.READINESS_MANIFEST_ENABLED; process.env.READINESS_MANIFEST_ENABLED = 'true'; });
  afterEach(() => { if (prev === undefined) delete process.env.READINESS_MANIFEST_ENABLED; else process.env.READINESS_MANIFEST_ENABLED = prev; });

  it('AMBIGUOUS COMMIT: retry replays the recorded result — the mutation + inputVersion++ apply EXACTLY ONCE', async () => {
    const { prisma, spies } = makeFake({ versionRow: { inputVersion: 6, status: 'generating', previousStatus: 'generating' } });
    const afterCommit = vi.fn(async (attempt: number) => { if (attempt === 0) throw new PrismaErr('P2028', 'Transaction not found'); });

    const out = await withDeliveryInputMutation(
      prisma as never,
      { orderId: 'o1', reason: 'page_asset_changed', operationKey: 'delivery_input:o1:page:3:url', mutationPayload: { url: 'url' }, atomic: { sleep: async () => {}, afterCommit } },
      async (tx) => { await (tx as { imageAsset: { update: (a: unknown) => Promise<unknown> } }).imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'url' } }); },
    );

    expect(spies.mutate).toHaveBeenCalledTimes(1);              // mutation applied once
    expect(spies.bookReadinessUpdateMany).toHaveBeenCalledTimes(1); // invalidation once
    expect(afterCommit).toHaveBeenCalledTimes(2);               // attempt 0 threw, attempt 1 replayed
    expect(out.inputVersion).toBe(6);                           // recorded result replayed
    expect(prisma._receipts.size).toBe(1);                      // one durable receipt
  });

  it('PAYLOAD-HASH MISMATCH under the same key FAILS CLOSED (mutation never runs)', async () => {
    // Seed a committed receipt for this key under a DIFFERENT payloadHash → a same-key/different-payload defect.
    const { prisma, spies } = makeFake({ seedReceipts: { 'delivery_input:o1:page:3:url': { payloadHash: 'OTHER', result: { value: { value: {}, inputVersion: 1, orderStatus: 'ready', readinessInvalidated: false } } } } });
    await expect(withDeliveryInputMutation(
      prisma as never,
      { orderId: 'o1', reason: 'page_asset_changed', operationKey: 'delivery_input:o1:page:3:url', mutationPayload: { url: 'url' }, atomic: { sleep: async () => {} } },
      async (tx) => { await (tx as { imageAsset: { update: (a: unknown) => Promise<unknown> } }).imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'url' } }); },
    )).rejects.toBeInstanceOf(ReceiptPayloadMismatchError);
    expect(spies.mutate).not.toHaveBeenCalled();
  });

  it('(P1 #1) the REAL mutationPayload is folded into the fence — same key + DIFFERENT content FAILS CLOSED', async () => {
    // A committed receipt whose payloadHash was computed from the ORIGINAL content; a retry under the SAME key but
    // with different mutationPayload recomputes a different hash → mismatch → fail closed (no silent stale replay).
    const original = hashOperationPayload({ reason: 'page_asset_changed', key: 'delivery_input:o1:page:3:url', mutation: { url: 'A' } });
    const { prisma, spies } = makeFake({ seedReceipts: { 'delivery_input:o1:page:3:url': { payloadHash: original, result: { value: { value: {}, inputVersion: 1, orderStatus: 'ready', readinessInvalidated: false } } } } });
    await expect(withDeliveryInputMutation(
      prisma as never,
      { orderId: 'o1', reason: 'page_asset_changed', operationKey: 'delivery_input:o1:page:3:url', mutationPayload: { url: 'B' }, atomic: { sleep: async () => {} } },
      async (tx) => { await (tx as { imageAsset: { update: (a: unknown) => Promise<unknown> } }).imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'B' } }); },
    )).rejects.toBeInstanceOf(ReceiptPayloadMismatchError);
    expect(spies.mutate).not.toHaveBeenCalled();
  });

  it('(P1 #1) the fenced path REQUIRES mutationPayload — throws if a caller forgets it', async () => {
    const { prisma, spies } = makeFake();
    await expect(withDeliveryInputMutation(
      prisma as never,
      { orderId: 'o1', reason: 'page_asset_changed', operationKey: 'delivery_input:o1:page:3:url', atomic: { sleep: async () => {} } },
      async (tx) => { await (tx as { imageAsset: { update: (a: unknown) => Promise<unknown> } }).imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'url' } }); },
    )).rejects.toThrow(/delivery_input_mutation_payload_required/);
    expect(spies.mutate).not.toHaveBeenCalled();
  });

  it('(P1 #1) page_asset payload must include provider+style — same key + different style FAILS CLOSED', async () => {
    const key = 'delivery_input:o1:page:3:url';
    const original = hashOperationPayload({
      reason: 'page_asset_changed',
      key,
      mutation: { url: 'url', provider: 'openai', style: 'style01' },
    });
    const { prisma, spies } = makeFake({
      seedReceipts: {
        [key]: {
          payloadHash: original,
          result: { value: { value: {}, inputVersion: 1, orderStatus: 'ready', readinessInvalidated: false } },
        },
      },
    });
    await expect(withDeliveryInputMutation(
      prisma as never,
      {
        orderId: 'o1',
        reason: 'page_asset_changed',
        operationKey: key,
        mutationPayload: { url: 'url', provider: 'openai', style: 'style02' },
        atomic: { sleep: async () => {} },
      },
      async (tx) => {
        await (tx as { imageAsset: { update: (a: unknown) => Promise<unknown> } }).imageAsset.update({
          where: { id: 'asset-1' },
          data: { url: 'url', provider: 'openai', style: 'style02' },
        });
      },
    )).rejects.toBeInstanceOf(ReceiptPayloadMismatchError);
    expect(spies.mutate).not.toHaveBeenCalled();
  });

  it('(P1 #1) anchor payload must hash the merged registry — same key + different merged JSON FAILS CLOSED', async () => {
    const key = 'delivery_input:o1:anchors:hashA';
    const mergedA = { characterAnchors: { child: { anchorImageUrl: 'a' } }, childImageUrl: 'a' };
    const original = hashOperationPayload({ reason: 'character_anchors_changed', key, mutation: mergedA });
    const { prisma, spies } = makeFake({
      seedReceipts: {
        [key]: {
          payloadHash: original,
          result: { value: { value: {}, inputVersion: 1, orderStatus: 'ready', readinessInvalidated: false } },
        },
      },
    });
    const mergedB = { characterAnchors: { child: { anchorImageUrl: 'b' } }, childImageUrl: 'b' };
    await expect(withDeliveryInputMutation(
      prisma as never,
      {
        orderId: 'o1',
        reason: 'character_anchors_changed',
        operationKey: key,
        mutationPayload: mergedB,
        atomic: { sleep: async () => {} },
      },
      async (tx) => {
        await (tx as { order: { update: (a: unknown) => Promise<unknown> } }).order.update({
          where: { id: 'o1' },
          data: { characterAnchors: mergedB.characterAnchors, childImageUrl: mergedB.childImageUrl },
        });
      },
    )).rejects.toBeInstanceOf(ReceiptPayloadMismatchError);
    expect(spies.mutate).not.toHaveBeenCalled();
  });

  it('(P1 #1 round-2) story frozenTruth in mutationPayload — same key + different selectionFilename FAILS CLOSED', async () => {
    const storyHash = 'deadbeef'.repeat(8);
    const key = `delivery_input:o1:story:${storyHash}`;
    const frozenA = {
      expectedPageCount: 8,
      storySourceHash: storyHash,
      selectionFilename: 'story-bank/v3-approved/fox_uri_bedtime.md',
      frozenProductVersion: 'story-product/v1:bedtime',
      title: 'T',
      coverText: 'C',
      pages: [[1, 'a', 'b', 'art_top_text_bottom']],
    };
    const original = hashOperationPayload({
      reason: 'story_text_finalized',
      key,
      mutation: frozenA,
    });
    const { prisma, spies } = makeFake({
      seedReceipts: {
        [key]: {
          payloadHash: original,
          result: { value: { value: {}, inputVersion: 1, orderStatus: 'ready', readinessInvalidated: false } },
        },
      },
    });
    const frozenB = { ...frozenA, selectionFilename: 'story-bank/v5-fixed-v2/fox_uri_bedtime.md' };
    await expect(withDeliveryInputMutation(
      prisma as never,
      {
        orderId: 'o1',
        reason: 'story_text_finalized',
        operationKey: key,
        frozenTruth: {
          expectedPageCount: frozenB.expectedPageCount,
          storySourceHash: frozenB.storySourceHash,
          selectionFilename: frozenB.selectionFilename,
          frozenProductVersion: frozenB.frozenProductVersion,
        },
        mutationPayload: frozenB,
        atomic: { sleep: async () => {} },
      },
      async (tx) => {
        await (tx as { generatedBook: { create: (a: unknown) => Promise<unknown> } }).generatedBook.create({ data: {} });
      },
    )).rejects.toBeInstanceOf(ReceiptPayloadMismatchError);
    expect(spies.mutate).not.toHaveBeenCalled();
  });

  it('(P1 #1 round-2) story frozenTruth in mutationPayload — same key + different frozenProductVersion FAILS CLOSED', async () => {
    const storyHash = 'cafebabe'.repeat(8);
    const key = `delivery_input:o1:story:${storyHash}`;
    const frozenA = {
      expectedPageCount: 12,
      storySourceHash: storyHash,
      selectionFilename: 'story-bank/v3-approved/lion_shaket_adventure.md',
      frozenProductVersion: 'story-product/v1:adventure',
      title: 'T',
      coverText: 'C',
      pages: [[1, 'a', 'b', null]],
    };
    const original = hashOperationPayload({
      reason: 'story_text_finalized',
      key,
      mutation: frozenA,
    });
    const { prisma, spies } = makeFake({
      seedReceipts: {
        [key]: {
          payloadHash: original,
          result: { value: { value: {}, inputVersion: 1, orderStatus: 'ready', readinessInvalidated: false } },
        },
      },
    });
    const frozenB = { ...frozenA, frozenProductVersion: 'story-product/v2:adventure' };
    await expect(withDeliveryInputMutation(
      prisma as never,
      {
        orderId: 'o1',
        reason: 'story_text_finalized',
        operationKey: key,
        frozenTruth: {
          expectedPageCount: frozenB.expectedPageCount,
          storySourceHash: frozenB.storySourceHash,
          selectionFilename: frozenB.selectionFilename,
          frozenProductVersion: frozenB.frozenProductVersion,
        },
        mutationPayload: frozenB,
        atomic: { sleep: async () => {} },
      },
      async (tx) => {
        await (tx as { generatedBook: { create: (a: unknown) => Promise<unknown> } }).generatedBook.create({ data: {} });
      },
    )).rejects.toBeInstanceOf(ReceiptPayloadMismatchError);
    expect(spies.mutate).not.toHaveBeenCalled();
  });

  it('flag-on WITHOUT an operationKey stays on the legacy path (no receipt written)', async () => {
    const { prisma, spies } = makeFake();
    await withDeliveryInputMutation(
      prisma as never,
      { orderId: 'o1', reason: 'page_asset_changed' },
      async (tx) => { await (tx as { imageAsset: { update: (a: unknown) => Promise<unknown> } }).imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'url' } }); },
    );
    expect(spies.mutate).toHaveBeenCalledTimes(1);
    expect(prisma._receipts.size).toBe(0); // no fence engaged
  });
});

describe('(Codex B′) receipt fence wired into reserveMarkAndClearRegen — one regenCount++ under ambiguous commit', () => {
  let prev: string | undefined;
  beforeEach(() => { prev = process.env.READINESS_MANIFEST_ENABLED; process.env.READINESS_MANIFEST_ENABLED = 'true'; });
  afterEach(() => { if (prev === undefined) delete process.env.READINESS_MANIFEST_ENABLED; else process.env.READINESS_MANIFEST_ENABLED = prev; });

  it('AMBIGUOUS COMMIT: the durable budget is reserved EXACTLY ONCE (no double-spend)', async () => {
    const regen = { count: 0, budget: 2 };
    const { prisma, spies } = makeFake({ regen, versionRow: { inputVersion: 2, status: 'generating', previousStatus: 'generating' } });
    const afterCommit = vi.fn(async (attempt: number) => { if (attempt === 0) throw new PrismaErr('P2028', 'Transaction not found'); });

    const out = await reserveMarkAndClearRegen(prisma as never, {
      orderId: 'o1',
      artifactKey: 'page:3',
      operationKey: 'regen_reserve:case1:0:page:3',
      atomic: { sleep: async () => {}, afterCommit },
    });

    expect(out.granted).toBe(true);
    expect(regen.count).toBe(1);                        // reserved once despite the ambiguous-commit retry
    expect(spies.regenUpdateMany).toHaveBeenCalledTimes(1); // the conditional increment ran once (attempt 0 only)
    expect(afterCommit).toHaveBeenCalledTimes(2);       // attempt 0 threw, attempt 1 replayed granted
  });
});

/**
 * (P1 #2) commit succeeds → ALL acks fail (exhaustion) → outcome_unknown → redrive → exactly one manifest/outbox
 * AND final Order.ready + Job.done. Models a readiness-commit `run` that writes a manifest+outbox and flips
 * order/job to ready/done inside the committed tx; the ack throws P2028 on EVERY attempt so retries exhaust.
 */
describe('(Codex B′ P1 #2) exhaustion → outcome_unknown, then a redrive reconciles exactly-once', () => {
  function makeCommitFake() {
    const receipts = new Map<string, { payloadHash: string; result: unknown }>();
    const state = { manifests: 0, outbox: 0, orderStatus: 'generating', jobStatus: 'running' };
    const prisma = {
      state,
      async $transaction(cb: (tx: unknown) => Promise<unknown>) {
        const staged = new Map(receipts);
        const s = { ...state };
        const tx = {
          async $queryRaw(_strings: TemplateStringsArray, ...values: unknown[]) {
            const key = values[1] as string; const payloadHash = values[4] as string;
            if (staged.has(key)) return [];
            staged.set(key, { payloadHash, result: {} });
            return [{ id: values[0] }];
          },
          atomicOperationReceipt: {
            findUnique: async ({ where }: { where: { operationKey: string } }) => {
              const r = staged.get(where.operationKey); return r ? { payloadHash: r.payloadHash, result: r.result } : null;
            },
            update: async ({ where, data }: { where: { operationKey: string }; data: { result: unknown } }) => {
              const r = staged.get(where.operationKey); if (r) r.result = data.result; return {};
            },
          },
          // the "readiness commit" body: one manifest + one outbox + order ready + job done
          commit: async () => { s.manifests += 1; s.outbox = 1; s.orderStatus = 'ready'; s.jobStatus = 'done'; },
        };
        const value = await cb(tx);
        for (const [k, v] of staged) receipts.set(k, v);
        Object.assign(state, s); // commit the business state
        return value;
      },
    };
    const run = async (tx: unknown) => {
      await (tx as { commit: () => Promise<void> }).commit();
      return { manifestStatus: 'passed', enqueued: true, orderStatus: 'ready', revision: 1 } as const;
    };
    return { prisma, state, run };
  }

  it('commit lands but all 3 acks fail → AtomicOperationOutcomeUnknownError (state already consistent: 1 manifest/outbox, ready/done)', async () => {
    const { prisma, state, run } = makeCommitFake();
    const afterCommit = vi.fn(async () => { throw new PrismaErr('P2028', 'Transaction not found'); }); // EVERY attempt
    let thrown: unknown;
    try {
      await runAtomicOperation(prisma as never, { operationKey: 'readiness_commit:o1', orderId: 'o1', kind: 'readiness_commit', payloadHash: 'ph', run }, { sleep: async () => {}, afterCommit });
    } catch (e) { thrown = e; }
    expect(isOutcomeUnknown(thrown)).toBe(true);
    expect(thrown).toBeInstanceOf(AtomicOperationOutcomeUnknownError);
    expect(afterCommit).toHaveBeenCalledTimes(3);       // exhausted all attempts
    // The tx committed on attempt 0; attempts 1-2 fence-hit (no re-run) → state is consistent, NOT doubled.
    expect(state).toMatchObject({ manifests: 1, outbox: 1, orderStatus: 'ready', jobStatus: 'done' });
  });

  it('the redrive re-enters the fence → replays the recorded result, NO duplicate manifest/outbox, stays ready/done', async () => {
    const { prisma, state, run } = makeCommitFake();
    // First: exhaust (commit + all acks fail).
    await runAtomicOperation(prisma as never, { operationKey: 'readiness_commit:o1', orderId: 'o1', kind: 'readiness_commit', payloadHash: 'ph', run }, { sleep: async () => {}, afterCommit: async () => { throw new PrismaErr('P2028'); } }).catch(() => {});
    const runSpy = vi.fn(run);
    // Redrive: same key, now the ack succeeds → fence-hit replays the recorded result; run NEVER called again.
    const out = await runAtomicOperation(prisma as never, { operationKey: 'readiness_commit:o1', orderId: 'o1', kind: 'readiness_commit', payloadHash: 'ph', run: runSpy }, { sleep: async () => {} });
    expect(runSpy).not.toHaveBeenCalled();              // replayed, not re-run
    expect(out).toMatchObject({ manifestStatus: 'passed', enqueued: true, orderStatus: 'ready', revision: 1 });
    expect(state).toMatchObject({ manifests: 1, outbox: 1, orderStatus: 'ready', jobStatus: 'done' }); // exactly once
  });
});
