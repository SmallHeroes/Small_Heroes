import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, PrismaClient } from '@prisma/client';

import { computeVisualContractHash } from '@/lib/visual-contract-compiler';
import type { PipelineCache } from '@/lib/generation-pipeline/types';
import {
  ensureSetIdentityBoardSnapshot,
  requireSetIdentityBoardsBoundForRender,
  runSetIdentityBoardBindStage,
  setIdentityBoardRefsForPage,
  shouldEnterSetRefsStage,
} from '@/lib/generation-pipeline/set-identity-board-stage';
import { SetIdentityBoardUnavailableError, type BoardResolverDeps } from '../resolveBoards';
import { clone, makeApprovedEntry, makeContract, STYLE } from './board-fixtures';
import { computeSetDefinitionHash } from '../setDefinition';

/**
 * SCOPE + HONESTY NOTE.
 *
 * These specs drive the REAL lifecycle module (`set-identity-board-stage.ts`) with the DB and the registry/storage
 * injected as fakes — so the activation fence, the bind stage, the pre-render assertion, and the tagged-ref
 * selection are all genuinely exercised.
 *
 * What they do NOT cover: `processGenerationChunk`/`deriveStartingStage` in chunk-runner.ts, which need a live
 * Postgres (they call `prisma` directly, not through an injectable seam). The stage-ORDER specs below therefore
 * drive `shouldEnterSetRefsStage` — the extracted decision that chunk-runner's `deriveStartingStage` and its
 * dna→cover transition BOTH delegate to — through a replica of deriveStartingStage's exact ordering. That replica
 * is asserted to match the shipped ordering by reading, not by running it; it is NOT a substitute for an
 * integration test, and it is not presented as one.
 */

const REQUIRED_ID = 'set_alpha';
const ORDER_ID = 'order_synthetic_1';

function frozenHash(): string {
  return computeVisualContractHash(makeContract());
}
function setHash(): string {
  return computeSetDefinitionHash(makeContract(), REQUIRED_ID, STYLE);
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    illustrationStyle: STYLE,
    visualContractHash: frozenHash(),
    ...overrides,
  } as unknown as Order;
}

/** A cache with a frozen, readable contract — i.e. an order the freeze already ran for. */
function makeCache(overrides: Partial<PipelineCache> = {}): PipelineCache {
  return {
    textFinalized: true,
    dna: { childDNA: 'a child', companionDNA: 'a pal' },
    visualContract: clone(makeContract()) as unknown as PipelineCache['visualContract'],
    ...overrides,
  };
}

function makeResolverDeps(overrides: Partial<BoardResolverDeps> = {}): BoardResolverDeps {
  const entry = makeApprovedEntry(setHash());
  return {
    loadRegistryEntry: vi.fn(() => entry),
    fetchAssetSha256: vi.fn(async () => entry.assetSha256),
    resolveDurableUrl: vi.fn(async (key: string) => `https://cdn.example/${key}`),
    ...overrides,
  };
}

/**
 * (P0-4b) The pre-render assert re-reads the board's bytes, so it needs the resolver seam too. This wrapper is the
 * shipped `requireSetIdentityBoardsBoundForRender` with the storage door faked to "the approved bytes are still
 * there" — i.e. the byte check passes and the spec is testing whatever else it means to test.
 */
async function assertBound(order: Order, cache: PipelineCache, resolver: BoardResolverDeps = makeResolverDeps()) {
  return requireSetIdentityBoardsBoundForRender(order, cache, { resolver });
}

/** A fake Prisma + barrier that record what the lifecycle wrote, with no database anywhere. */
function makeDb(opts: { hasCover?: boolean; hasPageImage?: boolean } = {}) {
  return {
    generatedBook: {
      findUnique: vi.fn(async () => ({
        coverImageUrl: opts.hasCover ? 'https://cdn.example/cover.png' : null,
        pages: opts.hasPageImage ? [{ id: 'p1' }] : [],
      })),
    },
  };
}

/** Narrow the fake down to the `PrismaClient` slot without losing the spy types at the assertion site. */
function asPrisma(db: ReturnType<typeof makeDb>): PrismaClient {
  return db as unknown as PrismaClient;
}

function makeBarrier() {
  const calls: Array<{ reason: string; operationKey?: string; payload: unknown }> = [];
  const withMutation = vi.fn(async (_db: unknown, args: never, mutate: (tx: never) => Promise<unknown>) => {
    const a = args as unknown as { reason: string; operationKey?: string; mutationPayload?: unknown };
    calls.push({ reason: a.reason, operationKey: a.operationKey, payload: a.mutationPayload });
    // $executeRaw is a tagged template on the tx; record nothing, just let it run.
    await mutate({ $executeRaw: async () => 1 } as never);
    return { value: undefined, inputVersion: 1, orderStatus: 'generating', readinessInvalidated: false };
  });
  return { calls, withMutation: withMutation as never };
}

const ENV_KEYS = ['VERCEL_ENV', 'SET_IDENTITY_BOARD'] as const;
let snapshot: Record<string, string | undefined>;
beforeEach(() => {
  snapshot = {};
  for (const k of ENV_KEYS) snapshot[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
});

function enableFlag() {
  process.env.SET_IDENTITY_BOARD = 'true';
}

/** Activate + bind an order, returning the fully bound cache. */
async function activateAndBind(): Promise<PipelineCache> {
  enableFlag();
  const barrier = makeBarrier();
  const activated = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
    db: asPrisma(makeDb()),
    withMutation: barrier.withMutation,
  });
  return runSetIdentityBoardBindStage(makeOrder(), activated, {
    db: asPrisma(makeDb()),
    withMutation: barrier.withMutation,
    resolver: makeResolverDeps(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A replica of `deriveStartingStage`'s ordering (chunk-runner.ts) with the DB read replaced by `hasCover`. The ONLY
 * board-aware line is the `shouldEnterSetRefsStage` call, which is the real shipped function.
 */
function deriveStartingStageReplica(
  job: { textDone: boolean; imagesDone: boolean; audioDone: boolean; packaged: boolean },
  cache: PipelineCache,
  hasCover: boolean
): string {
  if (!job.textDone || !cache.textFinalized) return 'text';
  if (!cache.dna?.childDNA) return 'dna';
  if (!hasCover && shouldEnterSetRefsStage(cache)) return 'set_refs';
  if (!hasCover) return 'cover';
  if (!job.imagesDone) return 'page_images';
  if (!job.audioDone) return 'audio';
  if (!job.packaged) return 'package';
  return 'done';
}

const JOB = { textDone: true, imagesDone: false, audioDone: false, packaged: false };

describe('stage order — dna → set_refs → cover when enabled + snapshotted', () => {
  it('an activated, unbound order starts at set_refs', async () => {
    enableFlag();
    const barrier = makeBarrier();
    const cache = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb()),
      withMutation: barrier.withMutation,
    });
    expect(shouldEnterSetRefsStage(cache)).toBe(true);
    expect(deriveStartingStageReplica(JOB, cache, false)).toBe('set_refs');
  });

  it('once bound, the stage falls through to cover (set_refs has no work left)', async () => {
    const bound = await activateAndBind();
    expect(shouldEnterSetRefsStage(bound)).toBe(false);
    expect(deriveStartingStageReplica(JOB, bound, false)).toBe('cover');
  });

  it('never returns set_refs once a cover exists (set_refs is strictly pre-first-paid-image)', async () => {
    enableFlag();
    const barrier = makeBarrier();
    const cache = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb()),
      withMutation: barrier.withMutation,
    });
    expect(deriveStartingStageReplica(JOB, cache, true)).toBe('page_images');
  });
});

describe('stage order — dna → cover (NO set_refs) when the flag is off', () => {
  it('the flag off means no snapshot is ever written, so set_refs is unreachable', async () => {
    const barrier = makeBarrier();
    const db = makeDb();
    const cache = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(db),
      withMutation: barrier.withMutation,
    });
    expect(cache.setIdentityBoards).toBeUndefined();
    expect(barrier.withMutation).not.toHaveBeenCalled(); // no write, no inputVersion bump
    expect(db.generatedBook.findUnique).not.toHaveBeenCalled(); // no extra DB read either
    expect(shouldEnterSetRefsStage(cache)).toBe(false);
    expect(deriveStartingStageReplica(JOB, cache, false)).toBe('cover');
  });

  it('Vercel Production can never ACTIVATE an order, even with the var leaked on', async () => {
    process.env.VERCEL_ENV = 'production';
    enableFlag();
    const barrier = makeBarrier();
    const cache = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb()),
      withMutation: barrier.withMutation,
    });
    // The flag is the gate on ACTIVATION, and prod is hard-off → no snapshot → set_refs unreachable → legacy.
    expect(cache.setIdentityBoards).toBeUndefined();
    expect(barrier.withMutation).not.toHaveBeenCalled();
    expect(shouldEnterSetRefsStage(cache)).toBe(false);
    expect(deriveStartingStageReplica(JOB, cache, false)).toBe('cover');
  });

  it('the whole legacy stage sequence is unchanged with the flag off', () => {
    const cache = makeCache();
    expect(deriveStartingStageReplica({ ...JOB, textDone: false }, cache, false)).toBe('text');
    expect(deriveStartingStageReplica(JOB, { ...cache, dna: undefined }, false)).toBe('dna');
    expect(deriveStartingStageReplica(JOB, cache, false)).toBe('cover');
    expect(deriveStartingStageReplica(JOB, cache, true)).toBe('page_images');
    expect(deriveStartingStageReplica({ ...JOB, imagesDone: true }, cache, true)).toBe('audio');
    expect(deriveStartingStageReplica({ ...JOB, imagesDone: true, audioDone: true }, cache, true)).toBe('package');
    expect(
      deriveStartingStageReplica({ textDone: true, imagesDone: true, audioDone: true, packaged: true }, cache, true)
    ).toBe('done');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P0-1 — the SNAPSHOT is the authority for entering set_refs, never the env flag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE BUG THIS FIXES, concretely: an order activates at `dna` (snapshot written, boards NOT yet bound), the worker
 * dies, and the flag goes DOWN before the resume — a config rollback, a redeploy, a worker on a differently
 * configured runtime. `shouldEnterSetRefsStage` used to read the flag, so it returned false, `deriveStartingStage`
 * fell through to `cover`, and the pre-render assert (correctly snapshot-gated) threw. The order could never bind
 * and never render: bricked by an env var, forever.
 *
 * The rule now: the flag governs snapshot CREATION and nothing else. Past activation, the snapshot decides.
 */
describe('P0-1 — an ACTIVATED order still enters set_refs after the flag goes down', () => {
  async function activatedButUnbound(): Promise<PipelineCache> {
    enableFlag();
    return ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb()),
      withMutation: makeBarrier().withMutation,
    });
  }

  it('snapshot exists + flag OFF → shouldEnterSetRefsStage is STILL true', async () => {
    const cache = await activatedButUnbound();
    expect(shouldEnterSetRefsStage(cache)).toBe(true);

    delete process.env.SET_IDENTITY_BOARD; // the flag goes down mid-book
    expect(shouldEnterSetRefsStage(cache)).toBe(true);
  });

  it('snapshot exists + flag OFF → resume ENTERS set_refs and BINDS (not bricked at cover)', async () => {
    const cache = await activatedButUnbound();
    delete process.env.SET_IDENTITY_BOARD;

    expect(deriveStartingStageReplica(JOB, cache, false)).toBe('set_refs'); // not 'cover'

    const bound = await runSetIdentityBoardBindStage(makeOrder(), cache, {
      db: asPrisma(makeDb()),
      withMutation: makeBarrier().withMutation,
      resolver: makeResolverDeps(),
    });
    expect(bound.setIdentityBoards!.bindings[REQUIRED_ID].setDefinitionHash).toBe(setHash());
    await expect(assertBound(makeOrder(), bound)).resolves.toBeUndefined();
    // And once bound there is no work left, so the flag-off resume proceeds to the cover normally.
    expect(shouldEnterSetRefsStage(bound)).toBe(false);
    expect(deriveStartingStageReplica(JOB, bound, false)).toBe('cover');
  });

  it('snapshot exists + flag OFF on PROD → still enters set_refs (an activated order is never abandoned)', async () => {
    const cache = await activatedButUnbound();
    delete process.env.SET_IDENTITY_BOARD;
    process.env.VERCEL_ENV = 'production';
    expect(shouldEnterSetRefsStage(cache)).toBe(true);
    expect(deriveStartingStageReplica(JOB, cache, false)).toBe('set_refs');
  });

  it('LEGACY order (no snapshot) + flag OFF → NEVER enters set_refs (byte-identical)', () => {
    const legacy = makeCache(); // frozen contract present, never activated
    delete process.env.SET_IDENTITY_BOARD;
    expect(shouldEnterSetRefsStage(legacy)).toBe(false);
    expect(deriveStartingStageReplica(JOB, legacy, false)).toBe('cover');
    // …and the same holds on prod, and with no contract at all.
    process.env.VERCEL_ENV = 'production';
    expect(shouldEnterSetRefsStage(legacy)).toBe(false);
    expect(shouldEnterSetRefsStage(makeCache({ visualContract: undefined }))).toBe(false);
  });

  it('LEGACY order (no snapshot) + flag ON → still never enters set_refs (only activation opts an order in)', () => {
    enableFlag();
    expect(shouldEnterSetRefsStage(makeCache())).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P0-2 — styleId namespace: mint and live must key a board by the SAME id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE BUG THIS FIXES: `Order.illustrationStyle` holds a DB enum value (`pencil_watercolor`), while the mint tool —
 * and `buildSetIdentityBoardPrompt`, i.e. the thing that actually renders the board — key by the NORMALIZED
 * `StyleId` (`soft_hand_drawn_storybook`). The binder passed the raw column through, so a minted, QA'd,
 * human-approved board could never validate against a real order: `styleId mismatch`, fail-closed, forever. The
 * epic's own fixtures hid it because `detailed_whimsical_world` normalizes to itself — the one style where the two
 * namespaces coincide.
 */
describe('P0-2 — styleId is NORMALIZED once, and bind + assert agree by construction', () => {
  /** A board minted under the NORMALIZED id — exactly what `scripts/mint-set-identity-board.ts` writes. */
  const MINTED_STYLE_ID = 'soft_hand_drawn_storybook';
  /** …and a real order whose column holds the RAW DB value that normalizes to it. */
  const RAW_DB_STYLE = 'pencil_watercolor';

  function mintedBoardResolver(): BoardResolverDeps {
    const hash = computeSetDefinitionHash(makeContract(), REQUIRED_ID, MINTED_STYLE_ID);
    const entry = makeApprovedEntry(hash, { styleId: MINTED_STYLE_ID });
    return {
      loadRegistryEntry: vi.fn(() => entry),
      fetchAssetSha256: vi.fn(async () => entry.assetSha256),
      resolveDurableUrl: vi.fn(async (key: string) => `https://cdn.example/${key}`),
    };
  }

  async function bindRawDbStyleOrder(): Promise<PipelineCache> {
    enableFlag();
    const order = makeOrder({ illustrationStyle: RAW_DB_STYLE });
    const activated = await ensureSetIdentityBoardSnapshot(order, makeCache(), {
      db: asPrisma(makeDb()),
      withMutation: makeBarrier().withMutation,
    });
    return runSetIdentityBoardBindStage(order, activated, {
      db: asPrisma(makeDb()),
      withMutation: makeBarrier().withMutation,
      resolver: mintedBoardResolver(),
    });
  }

  it('round-trip: a board minted under the normalized id VALIDATES against a raw-DB-value order', async () => {
    const bound = await bindRawDbStyleOrder();
    const binding = bound.setIdentityBoards!.bindings[REQUIRED_ID];
    // The binding is keyed by the NORMALIZED id — never the raw column value.
    expect(binding.styleId).toBe(MINTED_STYLE_ID);
    expect(binding.styleId).not.toBe(RAW_DB_STYLE);
    expect(binding.setDefinitionHash).toBe(computeSetDefinitionHash(makeContract(), REQUIRED_ID, MINTED_STYLE_ID));
  });

  it('the ASSERT normalizes identically — it passes for the same order it bound', async () => {
    const bound = await bindRawDbStyleOrder();
    await expect(
      assertBound(makeOrder({ illustrationStyle: RAW_DB_STYLE }), bound, mintedBoardResolver())
    ).resolves.toBeUndefined();
  });

  it('two DB values that normalize to the SAME id share one board (realistic_illustrated ≡ pencil_watercolor)', async () => {
    const bound = await bindRawDbStyleOrder();
    await expect(
      assertBound(makeOrder({ illustrationStyle: 'realistic_illustrated' }), bound, mintedBoardResolver())
    ).resolves.toBeUndefined();
  });

  it('a genuinely DIFFERENT style still fails closed (normalization widens nothing)', async () => {
    const bound = await bindRawDbStyleOrder();
    await expect(
      assertBound(makeOrder({ illustrationStyle: 'detailed_whimsical_world' }), bound, mintedBoardResolver())
    ).rejects.toThrow(SetIdentityBoardUnavailableError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Activation (ensureSetIdentityBoardSnapshot)
// ─────────────────────────────────────────────────────────────────────────────

describe('ensureSetIdentityBoardSnapshot — the ONE activation point', () => {
  it('writes a required-v2 snapshot pinned to the frozen contract, atomically and content-addressed', async () => {
    enableFlag();
    const barrier = makeBarrier();
    const cache = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb()),
      withMutation: barrier.withMutation,
    });
    expect(cache.setIdentityBoards).toEqual({
      mode: 'required-v2',
      frozenContractHash: frozenHash(),
      bindings: {},
    });
    expect(barrier.calls).toHaveLength(1);
    expect(barrier.calls[0].reason).toBe('set_identity_board_bound');
    expect(barrier.calls[0].operationKey).toContain(frozenHash()); // embeds the frozen contract hash
    expect(barrier.calls[0].payload).toEqual({ setIdentityBoards: cache.setIdentityBoards });
  });

  it('is a no-op when there is no frozen contract (freeze off → legacy order)', async () => {
    enableFlag();
    const barrier = makeBarrier();
    const cache = await ensureSetIdentityBoardSnapshot(
      makeOrder(),
      makeCache({ visualContract: undefined }),
      { db: asPrisma(makeDb()), withMutation: barrier.withMutation }
    );
    expect(cache.setIdentityBoards).toBeUndefined();
    expect(barrier.withMutation).not.toHaveBeenCalled();
  });

  it('is IDEMPOTENT — a second call for the same contract writes nothing', async () => {
    enableFlag();
    const barrier = makeBarrier();
    const first = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb()),
      withMutation: barrier.withMutation,
    });
    const second = await ensureSetIdentityBoardSnapshot(makeOrder(), first, {
      db: asPrisma(makeDb()),
      withMutation: barrier.withMutation,
    });
    expect(second).toBe(first); // same object, untouched
    expect(barrier.withMutation).toHaveBeenCalledTimes(1);
  });

  it('HALF-LEGACY FENCE: a book that already has a cover never acquires a board', async () => {
    enableFlag();
    const barrier = makeBarrier();
    const cache = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb({ hasCover: true })),
      withMutation: barrier.withMutation,
    });
    expect(cache.setIdentityBoards).toBeUndefined();
    expect(barrier.withMutation).not.toHaveBeenCalled();
  });

  it('HALF-LEGACY FENCE: a book that already has a page image never acquires a board', async () => {
    enableFlag();
    const barrier = makeBarrier();
    const cache = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb({ hasPageImage: true })),
      withMutation: barrier.withMutation,
    });
    expect(cache.setIdentityBoards).toBeUndefined();
    expect(barrier.withMutation).not.toHaveBeenCalled();
  });
});

describe('an in-flight order with NO activation snapshot stays entirely legacy — even with the flag on', () => {
  it('binds nothing, asserts nothing, feeds no refs, and never enters set_refs', async () => {
    enableFlag();
    const legacy = makeCache(); // frozen contract present, but no setIdentityBoards snapshot
    const barrier = makeBarrier();

    expect(shouldEnterSetRefsStage(legacy)).toBe(false);
    expect(deriveStartingStageReplica(JOB, legacy, false)).toBe('cover');

    const afterBind = await runSetIdentityBoardBindStage(makeOrder(), legacy, {
      db: asPrisma(makeDb()),
      withMutation: barrier.withMutation,
      resolver: makeResolverDeps(),
    });
    expect(afterBind).toBe(legacy); // untouched
    expect(barrier.withMutation).not.toHaveBeenCalled();

    // The assert is a no-op AND does no I/O — a legacy order never touches registry or storage.
    const resolver = makeResolverDeps();
    await expect(assertBound(makeOrder(), legacy, resolver)).resolves.toBeUndefined();
    expect(resolver.fetchAssetSha256).not.toHaveBeenCalled();
    expect(resolver.loadRegistryEntry).not.toHaveBeenCalled();
    expect(setIdentityBoardRefsForPage(legacy, 0)).toBeUndefined();
    expect(setIdentityBoardRefsForPage(legacy, 1)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bind stage + resume shapes
// ─────────────────────────────────────────────────────────────────────────────

describe('runSetIdentityBoardBindStage — fresh / retry / crash-after-bind all yield the SAME binding', () => {
  it('fresh bind produces a board bound to the approved entry', async () => {
    const bound = await activateAndBind();
    const binding = bound.setIdentityBoards!.bindings[REQUIRED_ID];
    expect(binding.setDefinitionHash).toBe(setHash());
    expect(binding.resolvedUrl).toBe('https://cdn.example/set-identity-boards/synthetic/set_alpha/board.png');
  });

  it('crash AFTER bind → resume re-binds to the SAME board and writes nothing', async () => {
    const bound = await activateAndBind();
    const barrier = makeBarrier();
    const resolver = makeResolverDeps();
    const resumed = await runSetIdentityBoardBindStage(makeOrder(), bound, {
      db: asPrisma(makeDb()),
      withMutation: barrier.withMutation,
      resolver,
    });
    expect(resumed.setIdentityBoards).toEqual(bound.setIdentityBoards);
    expect(barrier.withMutation).not.toHaveBeenCalled(); // nothing changed → no write, no inputVersion bump
    expect(resolver.loadRegistryEntry).not.toHaveBeenCalled(); // never re-chooses
  });

  it('a retry storm over the bind stage converges on the SAME binding', async () => {
    let cache = await activateAndBind();
    const original = clone(cache.setIdentityBoards);
    for (let i = 0; i < 4; i++) {
      cache = await runSetIdentityBoardBindStage(makeOrder(), cache, {
        db: asPrisma(makeDb()),
        withMutation: makeBarrier().withMutation,
        resolver: makeResolverDeps(),
      });
    }
    expect(cache.setIdentityBoards).toEqual(original);
  });

  it('a resume entering DIRECTLY at cover sees the same binding and passes the assertion', async () => {
    const bound = await activateAndBind();
    await expect(assertBound(makeOrder(), bound)).resolves.toBeUndefined();
    expect(setIdentityBoardRefsForPage(bound, 0)?.[0].url).toBe(
      bound.setIdentityBoards!.bindings[REQUIRED_ID].resolvedUrl
    );
  });

  it('a resume entering DIRECTLY at page_images sees the same binding and passes the assertion', async () => {
    const bound = await activateAndBind();
    await expect(assertBound(makeOrder(), bound)).resolves.toBeUndefined();
    expect(setIdentityBoardRefsForPage(bound, 1)?.[0].url).toBe(
      bound.setIdentityBoards!.bindings[REQUIRED_ID].resolvedUrl
    );
  });

  it('a crash BETWEEN updateStage(set_refs) and the bind can still resume and bind (no assert-to-death)', async () => {
    // The worker persisted currentStage='set_refs' and died before binding. chunk-runner deliberately SKIPS the
    // pre-loop board assert for stage==='set_refs' — asserting there would deadlock this order forever, because
    // set_refs is the stage that creates the very bindings the assert demands.
    enableFlag();
    const activatedUnbound = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb()),
      withMutation: makeBarrier().withMutation,
    });
    // Proof of the hazard: the assert WOULD throw in this state…
    await expect(assertBound(makeOrder(), activatedUnbound)).rejects.toThrow(SetIdentityBoardUnavailableError);
    // …yet the bind stage recovers it, and the post-bind assert then passes.
    const bound = await runSetIdentityBoardBindStage(makeOrder(), activatedUnbound, {
      db: asPrisma(makeDb()),
      withMutation: makeBarrier().withMutation,
      resolver: makeResolverDeps(),
    });
    await expect(assertBound(makeOrder(), bound)).resolves.toBeUndefined();
    expect(bound.setIdentityBoards!.bindings[REQUIRED_ID].setDefinitionHash).toBe(setHash());
  });

  it('THROWS rather than bind when the snapshot is pinned to a different frozen contract', async () => {
    enableFlag();
    const cache = makeCache({
      setIdentityBoards: { mode: 'required-v2', frozenContractHash: 'a-stale-hash', bindings: {} },
    });
    await expect(
      runSetIdentityBoardBindStage(makeOrder(), cache, {
        db: asPrisma(makeDb()),
        withMutation: makeBarrier().withMutation,
        resolver: makeResolverDeps(),
      })
    ).rejects.toThrow(SetIdentityBoardUnavailableError);
  });

  it('THROWS when an activated order has no readable frozen contract', async () => {
    enableFlag();
    const cache = makeCache({
      visualContract: undefined,
      setIdentityBoards: { mode: 'required-v2', frozenContractHash: frozenHash(), bindings: {} },
    });
    await expect(
      runSetIdentityBoardBindStage(makeOrder(), cache, {
        db: asPrisma(makeDb()),
        withMutation: makeBarrier().withMutation,
        resolver: makeResolverDeps(),
      })
    ).rejects.toThrow(SetIdentityBoardUnavailableError);
  });

  it('an activated order binds even if the env flag was flipped OFF mid-book (never silently drops the board)', async () => {
    const bound = await activateAndBind();
    delete process.env.SET_IDENTITY_BOARD;
    // The snapshot — not the flag — is the gate from activation onward.
    await expect(assertBound(makeOrder(), bound)).resolves.toBeUndefined();
    expect(setIdentityBoardRefsForPage(bound, 1)).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pre-render assertion through the real lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('required mode CANNOT render with a missing or stale binding', () => {
  it('THROWS when activated but never bound', async () => {
    enableFlag();
    const cache = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
      db: asPrisma(makeDb()),
      withMutation: makeBarrier().withMutation,
    });
    await expect(assertBound(makeOrder(), cache)).rejects.toThrow(SetIdentityBoardUnavailableError);
  });

  it('THROWS when the order style changed under a bound board', async () => {
    const bound = await activateAndBind();
    // NB: a DB value that normalizes to a genuinely different StyleId (P0-2). `whimsical_comic_fantasy` would NOT
    // work here — it normalizes to `detailed_whimsical_world`, the same id the fixture bound under, so it is
    // correctly the SAME board.
    await expect(assertBound(makeOrder({ illustrationStyle: 'pencil_watercolor' }), bound)).rejects.toThrow(
      SetIdentityBoardUnavailableError
    );
  });

  it('THROWS when the frozen contract in the cache no longer matches the snapshot pin', async () => {
    const bound = await activateAndBind();
    const edited = clone(makeContract());
    edited.locations[0].description = 'a north room that has been re-described';
    const drifted: PipelineCache = {
      ...bound,
      visualContract: edited as unknown as PipelineCache['visualContract'],
    };
    await expect(assertBound(makeOrder(), drifted)).rejects.toThrow(SetIdentityBoardUnavailableError);
  });

  it('THROWS when the board BYTES were swapped under a perfectly-bound order (P0-4b, through the stage)', async () => {
    const bound = await activateAndBind();
    await expect(
      assertBound(makeOrder(), bound, makeResolverDeps({ fetchAssetSha256: vi.fn(async () => 'sha-SWAPPED') }))
    ).rejects.toThrow(/bytes changed since binding/);
  });

  const brokenEntries: Array<[string, () => BoardResolverDeps]> = [
    ['no registry entry', () => makeResolverDeps({ loadRegistryEntry: vi.fn(() => null) })],
    [
      'unapproved (human sign-off missing)',
      () =>
        makeResolverDeps({
          loadRegistryEntry: vi.fn(() => makeApprovedEntry(setHash(), { approvedBy: null, approvedAt: null })),
        }),
    ],
    [
      "qaStatus !== 'passed'",
      () => makeResolverDeps({ loadRegistryEntry: vi.fn(() => makeApprovedEntry(setHash(), { qaStatus: 'failed' })) }),
    ],
    [
      'wrong style',
      () => makeResolverDeps({ loadRegistryEntry: vi.fn(() => makeApprovedEntry(setHash(), { styleId: 'nope' })) }),
    ],
    [
      'stale boardVersion',
      () =>
        makeResolverDeps({
          loadRegistryEntry: vi.fn(() => makeApprovedEntry(setHash(), { boardVersion: 'set-board/v0' })),
        }),
    ],
    ['setDefinitionHash mismatch', () => makeResolverDeps({ loadRegistryEntry: vi.fn(() => makeApprovedEntry('other')) })],
    ['SHA mismatch', () => makeResolverDeps({ fetchAssetSha256: vi.fn(async () => 'sha-different') })],
  ];

  for (const [label, mkResolver] of brokenEntries) {
    it(`the bind stage THROWS (never renders) — ${label}`, async () => {
      enableFlag();
      const cache = await ensureSetIdentityBoardSnapshot(makeOrder(), makeCache(), {
        db: asPrisma(makeDb()),
        withMutation: makeBarrier().withMutation,
      });
      await expect(
        runSetIdentityBoardBindStage(makeOrder(), cache, {
          db: asPrisma(makeDb()),
          withMutation: makeBarrier().withMutation,
          resolver: mkResolver(),
        })
      ).rejects.toThrow(SetIdentityBoardUnavailableError);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tagged refs — a page only ever gets its OWN set's board
// ─────────────────────────────────────────────────────────────────────────────

describe('setIdentityBoardRefsForPage — the right board, or none', () => {
  it('the cover uses page 0 = coverContract.locationId (room_north → set_alpha)', async () => {
    const bound = await activateAndBind();
    const refs = setIdentityBoardRefsForPage(bound, 0);
    expect(refs).toHaveLength(1);
    expect(refs![0].kind).toBe('set');
    expect(refs![0].identityId).toBe(REQUIRED_ID);
    expect(refs![0].assetSha256).toBe('sha-approved-bytes');
  });

  it("a page in the boarded set gets that set's board", async () => {
    const bound = await activateAndBind();
    expect(setIdentityBoardRefsForPage(bound, 1)![0].identityId).toBe(REQUIRED_ID);
  });

  it('a page in an UNBOARDED location gets NO board — never another location\'s', async () => {
    const bound = await activateAndBind();
    expect(setIdentityBoardRefsForPage(bound, 2)).toBeUndefined(); // page 2 is the meadow
  });

  it('a page that is not in the contract at all gets no board', async () => {
    const bound = await activateAndBind();
    expect(setIdentityBoardRefsForPage(bound, 99)).toBeUndefined();
  });

  it('does not mutate the frozen contract', async () => {
    const bound = await activateAndBind();
    const before = clone(bound.visualContract);
    setIdentityBoardRefsForPage(bound, 0);
    setIdentityBoardRefsForPage(bound, 1);
    expect(bound.visualContract).toEqual(before);
  });
});
