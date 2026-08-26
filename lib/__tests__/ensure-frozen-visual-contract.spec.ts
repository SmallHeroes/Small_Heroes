import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureFrozenVisualContract } from '@/lib/generation-pipeline/ensure-frozen-visual-contract';
import type { PipelineCache } from '@/lib/generation-pipeline/types';
import {
  computeVisualContractHash,
  readFrozenVisualContract,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';
import type { Order } from '@prisma/client';
import {
  buildFrozenVisualPackageAuthority,
  loadCurrentVisualPackageV4,
  publishVisualPackageV4,
  visualPackageV4LocatorPath,
} from '@/lib/visual-package/visualPackageV4';
import { buildVisualPackageV4Fixture } from '@/lib/visual-package/__tests__/visual-package-v4.fixtures';
import { STYLE_IDS } from '@/lib/styles';

/**
 * WS0b commit (a) + fix (B2): freeze mechanism. These prove the WIRING/idempotency contract with the barrier +
 * producer INJECTED — the receipt fence's own exactly-once mechanics live in atomic-operation/atomic-barrier tests.
 * The money-adjacent invariants under test: (1) flag OFF ⇒ byte-identical no-op; (2) non-blocking skip on missing/
 * failed produce; (3) the fence gets a contract-hash operationKey + a payload covering 100% of what it writes; (4) a
 * re-freeze of the same contract yields the SAME key (fence replays — no double inputVersion bump); and the B2
 * invariants: (5) the fast path short-circuits ONLY when the cached contract's hash MATCHES the Order stamp
 * (mismatch → re-freeze); (6) the cache write is a single-key jsonb_set, so a pre-existing unrelated field survives.
 */

// A minimal but STRUCTURALLY VALID vNext contract (single steady page 1) so readFrozenVisualContract accepts it and
// the fast path can hash-verify it. REAL_HASH is its canonical hash.
const VALID_CONTRACT = {
  version: 1,
  storyKey: 'freeze_test',
  worldType: 'playground',
  locations: [{ id: 'home', name: 'Home', description: 'a cozy home', environmentClass: 'indoor' }],
  zones: [{ id: 'home.room', locationId: 'home', name: 'Room', description: 'the room', shot: 'wide' }],
  cast: { child: { id: 'child:hero', role: 'child', name: 'Dana', wardrobe: { description: 'red coat', forbidden: [] } } },
  recurringProps: [],
  forbiddenGlobalElements: [],
  coverContract: { worldType: 'playground', locationId: 'home', mustShow: ['the child'], mustNotShow: [] },
  pageContracts: [
    { pageNumber: 1, locationId: 'home', zoneId: 'home.room', mustShow: ['the child at home'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero'], transition: { kind: 'steady' } },
  ],
} as unknown as BookVisualContract;
const REAL_HASH = computeVisualContractHash(VALID_CONTRACT);

function fakeOrder(
  overrides: Partial<Order> = {},
): Order {
  return {
    id: 'ord_1',
    visualContractHash: null,
    childName: 'Dana',
    childGender: 'female',
    illustrationStyle: 'pencil_watercolor',
    ...overrides,
  } as unknown as Order;
}

/**
 * A barrier double that runs the mutate closure against a recording tx. The tx models the atomic write capture:
 *  - order.update is recorded;
 *  - generationJob.update THROWS (B2: the freeze must never issue a whole-cache pipelineCache write);
 *  - $executeRaw records the SQL/params and SIMULATES the single-key jsonb_set against a seeded pipelineCache store,
 *    preserving every other key — so a test can assert an unrelated field survives.
 */
function makeWithMutation(seedCache: Record<string, unknown> = {}) {
  const jobStore = { pipelineCache: { ...seedCache } as Record<string, unknown> };
  const calls: Array<{ args: Record<string, unknown>; writes: { order?: any }; execRaw: Array<{ sql: string; values: unknown[] }> }> = [];
  const fn = vi.fn(async (_db: unknown, args: Record<string, unknown>, mutate: (tx: unknown) => Promise<unknown>) => {
    const writes: { order?: any } = {};
    const execRaw: Array<{ sql: string; values: unknown[] }> = [];
    const tx = {
      order: { update: vi.fn(async (a: any) => { writes.order = a; return {}; }) },
      generationJob: {
        update: vi.fn(async () => {
          throw new Error('B2: freeze must use a single-key jsonb_set, not a whole-cache generationJob.update');
        }),
      },
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?');
        execRaw.push({ sql, values });
        // Simulate the atomic single-key jsonb_set: preserve every existing key, set ONLY visualContract.
        if (/jsonb_set/i.test(sql) && sql.includes('visualContract')) {
          jobStore.pipelineCache = { ...jobStore.pipelineCache, visualContract: JSON.parse(String(values[0])) };
          if (sql.includes('visualPackageAuthority')) {
            jobStore.pipelineCache.visualPackageAuthority = JSON.parse(String(values[1]));
          }
        }
        return 1;
      }),
    };
    const value = await mutate(tx);
    calls.push({ args, writes, execRaw });
    return { value, inputVersion: 1, orderStatus: 'generating', readinessInvalidated: false };
  });
  return { fn: fn as unknown as typeof import('@/lib/generation-pipeline/readiness-manifest').withDeliveryInputMutation, calls, jobStore };
}

describe('ensureFrozenVisualContract (WS0b freeze)', () => {
  const savedFlag = process.env.VISUAL_CONTRACT_FREEZE;
  const temporaryRoots: string[] = [];
  beforeEach(() => {
    delete process.env.VISUAL_CONTRACT_FREEZE;
  });
  afterEach(() => {
    if (savedFlag === undefined) delete process.env.VISUAL_CONTRACT_FREEZE;
    else process.env.VISUAL_CONTRACT_FREEZE = savedFlag;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    for (const root of temporaryRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('flag OFF → no-op: no produce, no fence, same cache reference', async () => {
    const produce = vi.fn();
    const { fn } = makeWithMutation();
    const cache: PipelineCache = { textFinalized: true };
    const out = await ensureFrozenVisualContract(fakeOrder(), cache, { produce, withMutation: fn, db: {} as never });
    expect(out).toBe(cache);
    expect(produce).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('Production + flags OFF freezes a package-backed Order from its immutable revision, never the advanced current locator', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    vi.stubEnv('VISUAL_CONTRACT_FREEZE', 'false');
    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'small-heroes-order-package-freeze-'),
    );
    temporaryRoots.push(repoRoot);
    const storyKey = 'package_order_fixture';
    const sourcePath =
      `story-pipeline/04_approved_story_sources/accepted/${storyKey}/revisions/` +
      `${'a'.repeat(64)}/integrated.md`;
    const packageA = buildVisualPackageV4Fixture('no_companion', 'package A', {
      storyKey,
      sourcePath,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      styleContent: { renderingContract: 'immutable package A' },
    }).packageValue;
    const publishedA = publishVisualPackageV4({
      repoRoot,
      approvedPackagesDir: path.join(repoRoot, 'visual-packages', 'approved'),
      packageValue: packageA,
      write: true,
    });
    const frozenA = buildFrozenVisualPackageAuthority({
      packageValue: packageA,
      packagePath: publishedA.packagePath,
    });
    const packageB = buildVisualPackageV4Fixture('no_companion', 'package B', {
      storyKey,
      sourcePath,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      styleContent: { renderingContract: 'advanced mutable locator package B' },
    }).packageValue;
    publishVisualPackageV4({
      repoRoot,
      approvedPackagesDir: path.join(repoRoot, 'visual-packages', 'approved'),
      packageValue: packageB,
      write: true,
    });
    const current = loadCurrentVisualPackageV4({
      repoRoot,
      locatorPath: visualPackageV4LocatorPath({
        repoRoot,
        storyKey,
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      }),
      storyKey,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    });
    expect(current.packageValue.revisionDigest).toBe(packageB.revisionDigest);
    expect(current.packageValue.revisionDigest).not.toBe(packageA.revisionDigest);

    const order = fakeOrder({
      familyContext: null,
      illustrationStyle: 'pencil_watercolor',
      selectionFilename: sourcePath,
      storySourceHash: packageA.sourceSnapshot.rawDigest,
      visualPackageAuthority: frozenA,
    });
    const cache: PipelineCache = {
      storyFilePath: sourcePath,
      storyKey,
      storySourceAuthorityKind: 'product_accepted_revision',
      selectionFilename: 'integrated.md',
      textFinalized: true,
      dna: {
        childDNA: 'fixture',
        companionDNA: '',
        childStructured: {
          face: 'deep brown skin',
          hair: 'dark brown curly hair',
          body: 'young child proportions',
          clothing: 'green shirt',
          signature: 'small smile',
        },
      },
    };
    const { fn } = makeWithMutation();
    const out = await ensureFrozenVisualContract(order, cache, {
      withMutation: fn,
      db: {} as never,
      repoRoot,
    });
    expect(out.visualPackageAuthority).toEqual(frozenA);
    expect(
      (out.visualContract as unknown as {
        approvedRuntimeAuthority?: { packageRevisionDigest?: string };
      }).approvedRuntimeAuthority?.packageRevisionDigest,
    ).toBe(packageA.revisionDigest);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Production + flags OFF never degrades a package-backed Order with missing authority to legacy', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    vi.stubEnv('VISUAL_CONTRACT_FREEZE', 'false');
    const produce = vi.fn();
    const { fn } = makeWithMutation();
    await expect(
      ensureFrozenVisualContract(
        fakeOrder({
          illustrationStyle: 'pencil_watercolor',
          selectionFilename:
            'story-pipeline/04_approved_story_sources/accepted/package_order_fixture/revisions/' +
            `${'a'.repeat(64)}/integrated.md`,
          storySourceHash: 'b'.repeat(64),
          visualPackageAuthority: null,
        }),
        { textFinalized: true },
        { produce, withMutation: fn, db: {} as never },
      ),
    ).rejects.toThrow(/missing frozen Visual Package authority/);
    expect(produce).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('flag ON + already frozen (cache contract hashes to the Order stamp) → no-op (fast path)', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    // Guard: the fixture must be a valid vNext contract, else the fast path cannot hash-verify it.
    expect(readFrozenVisualContract(VALID_CONTRACT)).not.toBeNull();
    const produce = vi.fn();
    const { fn } = makeWithMutation();
    const cache: PipelineCache = {
      textFinalized: true,
      visualContract: VALID_CONTRACT as unknown as PipelineCache['visualContract'],
    };
    const out = await ensureFrozenVisualContract(
      fakeOrder({ visualContractHash: REAL_HASH }),
      cache,
      { produce, withMutation: fn, db: {} as never },
    );
    expect(out).toBe(cache);
    expect(produce).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('(B2) flag ON + stamp/cache MISMATCH (Order stamped a DIFFERENT hash) → re-freezes, never accepts the stale pair', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const produce = vi.fn(async () => ({ contract: VALID_CONTRACT, contractHash: REAL_HASH }));
    const { fn } = makeWithMutation();
    const cache: PipelineCache = {
      textFinalized: true,
      visualContract: VALID_CONTRACT as unknown as PipelineCache['visualContract'],
    };
    // The Order is stamped with a hash that does NOT match the cached contract → the fast path must fall through.
    const out = await ensureFrozenVisualContract(
      fakeOrder({ visualContractHash: 'stale-mismatched-hash' }),
      cache,
      { produce, withMutation: fn, db: {} as never },
    );
    expect(produce).toHaveBeenCalledTimes(1); // fell through → re-produced
    expect(fn).toHaveBeenCalledTimes(1); // re-froze (reconciles the stamp + cache)
    expect(out.visualContract).toBe(VALID_CONTRACT);
  });

  it('flag ON + no contract available → skip (no fence, cache unchanged)', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const produce = vi.fn(async () => null);
    const { fn } = makeWithMutation();
    const cache: PipelineCache = { textFinalized: true };
    const out = await ensureFrozenVisualContract(fakeOrder(), cache, { produce, withMutation: fn, db: {} as never });
    expect(out).toBe(cache);
    expect(fn).not.toHaveBeenCalled();
  });

  it('(C1) dynamic (non-bank, no selectionFilename) → DEFAULT producer returns null (dormant) → freeze no-ops, stays legacy', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const { fn } = makeWithMutation();
    // NO `produce` injected → uses the real defaultProduceContract. No selectionFilename → non-bank → the dynamic
    // compiler is dormant (C1) → returns null before touching the (unused) injected db → ensureFrozenVisualContract
    // no-ops. A future safe dynamic design re-enables it; until then dynamic stories are legacy (byte-identical).
    const cache: PipelineCache = { textFinalized: true };
    const out = await ensureFrozenVisualContract(fakeOrder(), cache, { withMutation: fn, db: {} as never });
    expect(out).toBe(cache);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flag ON + produce throws → NON-BLOCKING skip (no throw, cache unchanged, no fence)', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const produce = vi.fn(async () => {
      throw new Error('compile boom');
    });
    const { fn } = makeWithMutation();
    const cache: PipelineCache = { textFinalized: true };
    const out = await ensureFrozenVisualContract(fakeOrder(), cache, { produce, withMutation: fn, db: {} as never });
    expect(out).toBe(cache);
    expect(fn).not.toHaveBeenCalled();
  });

  it('non-production enforcement implies freeze and never degrades a producer failure to legacy', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    vi.stubEnv('VISUAL_CONTRACT_FREEZE', 'false');
    const produce = vi.fn(async () => {
      throw new Error('approved package unavailable');
    });
    const { fn } = makeWithMutation();
    await expect(ensureFrozenVisualContract(
      fakeOrder(),
      { textFinalized: true },
      { produce, withMutation: fn, db: {} as never },
    )).rejects.toThrow('approved package unavailable');
    expect(produce).toHaveBeenCalledTimes(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it('R1C enforcement does not change the freeze lifecycle for a non-Style01 order', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    vi.stubEnv('VISUAL_CONTRACT_FREEZE', 'false');
    const produce = vi.fn();
    const { fn } = makeWithMutation();
    const cache: PipelineCache = { textFinalized: true };
    const out = await ensureFrozenVisualContract(
      fakeOrder({ illustrationStyle: 'whimsical_comic_fantasy' }),
      cache,
      { produce, withMutation: fn, db: {} as never },
    );
    expect(out).toBe(cache);
    expect(produce).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('flag ON + contract → freezes: hash-keyed op, payload covers BOTH writes, stamps order + single-key jsonb_set', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const produce = vi.fn(async () => ({ contract: VALID_CONTRACT, contractHash: REAL_HASH }));
    const { fn, calls } = makeWithMutation();
    const cache: PipelineCache = { textFinalized: true, expectedPageCount: 12 };
    const order = fakeOrder();
    const out = await ensureFrozenVisualContract(order, cache, { produce, withMutation: fn, db: {} as never });

    // Returned cache carries the frozen contract; unrelated fields preserved.
    expect(out.visualContract).toBe(VALID_CONTRACT);
    expect(out.expectedPageCount).toBe(12);
    expect(order.visualContractHash).toBe(REAL_HASH);

    expect(fn).toHaveBeenCalledTimes(1);
    const { args, writes, execRaw } = calls[0];
    expect(args.reason).toBe('visual_contract_frozen');
    expect(args.operationKey).toBe(`delivery_input:ord_1:visual_contract:${REAL_HASH}`);
    // Payload covers 100% of what the mutation authoritatively writes.
    expect(args.mutationPayload).toEqual({ visualContractHash: REAL_HASH, visualContract: VALID_CONTRACT });
    // Order.visualContractHash via order.update; pipelineCache.visualContract via a SINGLE-KEY jsonb_set.
    expect(writes.order.where).toEqual({ id: 'ord_1' });
    expect(writes.order.data).toEqual({ visualContractHash: REAL_HASH });
    expect(execRaw).toHaveLength(1);
    expect(execRaw[0].sql).toMatch(/jsonb_set/);
    expect(execRaw[0].sql).toContain("'{visualContract}'");
    expect(execRaw[0].values[0]).toBe(JSON.stringify(VALID_CONTRACT)); // the contract JSON param
    expect(execRaw[0].values[1]).toBe('ord_1'); // the orderId param
  });

  it('(B2) freeze writes ONLY visualContract via jsonb_set — a pre-existing unrelated cache field survives', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const produce = vi.fn(async () => ({ contract: VALID_CONTRACT, contractHash: REAL_HASH }));
    // Seed the DB pipelineCache with unrelated fields a concurrent (non-freeze) writer persisted.
    const { fn, calls, jobStore } = makeWithMutation({ childAnchor: 'anchor-X', completedPages: [1, 2] });
    const cache: PipelineCache = { textFinalized: true };
    await ensureFrozenVisualContract(fakeOrder(), cache, { produce, withMutation: fn, db: {} as never });
    // The write is a single-key jsonb_set (the mock throws on any whole-cache generationJob.update).
    const { execRaw } = calls[0];
    expect(execRaw).toHaveLength(1);
    expect(execRaw[0].sql).toMatch(/jsonb_set/);
    // The pre-existing fields are intact; only visualContract was added.
    expect(jobStore.pipelineCache).toEqual({ childAnchor: 'anchor-X', completedPages: [1, 2], visualContract: VALID_CONTRACT });
  });

  it('re-freeze of the SAME contract → SAME operationKey (receipt fence replays → no double inputVersion bump)', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const produce = vi.fn(async () => ({ contract: VALID_CONTRACT, contractHash: REAL_HASH }));
    const { fn, calls } = makeWithMutation();
    const cache: PipelineCache = { textFinalized: true };
    await ensureFrozenVisualContract(fakeOrder(), cache, { produce, withMutation: fn, db: {} as never });
    await ensureFrozenVisualContract(fakeOrder(), cache, { produce, withMutation: fn, db: {} as never });
    expect(calls).toHaveLength(2);
    expect(calls[0].args.operationKey).toBe(calls[1].args.operationKey);
  });
});
