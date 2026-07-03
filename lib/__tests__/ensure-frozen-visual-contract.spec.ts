import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureFrozenVisualContract } from '@/lib/generation-pipeline/ensure-frozen-visual-contract';
import type { PipelineCache } from '@/lib/generation-pipeline/types';
import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import type { Order } from '@prisma/client';

/**
 * WS0b commit (a): freeze mechanism. These prove the WIRING/idempotency contract with the barrier + producer
 * INJECTED — the receipt fence's own exactly-once mechanics live in atomic-operation/atomic-barrier tests. The
 * money-adjacent invariants under test: (1) flag OFF ⇒ byte-identical no-op; (2) non-blocking skip on missing/
 * failed produce; (3) the fence gets a contract-hash operationKey + a payload covering 100% of what it writes
 * (both Order.visualContractHash AND pipelineCache.visualContract); (4) a re-freeze of the same contract yields
 * the SAME key (so the fence replays — no double inputVersion bump).
 */

const CONTRACT = { version: 1, worldType: 'playground' } as unknown as BookVisualContract;
const HASH = 'contract-hash-abc123';

function fakeOrder(
  overrides: Partial<Pick<Order, 'id' | 'visualContractHash' | 'childName' | 'childGender'>> = {},
): Order {
  return {
    id: 'ord_1',
    visualContractHash: null,
    childName: 'Dana',
    childGender: 'female',
    ...overrides,
  } as unknown as Order;
}

/** A barrier double that runs the mutate closure against a recording tx (models atomic write capture). */
function makeWithMutation() {
  const calls: Array<{ args: Record<string, unknown>; writes: { order?: any; job?: any } }> = [];
  const fn = vi.fn(async (_db: unknown, args: Record<string, unknown>, mutate: (tx: unknown) => Promise<unknown>) => {
    const writes: { order?: any; job?: any } = {};
    const tx = {
      order: { update: vi.fn(async (a: unknown) => { writes.order = a; return {}; }) },
      generationJob: { update: vi.fn(async (a: unknown) => { writes.job = a; return {}; }) },
    };
    const value = await mutate(tx);
    calls.push({ args, writes });
    return { value, inputVersion: 1, orderStatus: 'generating', readinessInvalidated: false };
  });
  return { fn: fn as unknown as typeof import('@/lib/generation-pipeline/readiness-manifest').withDeliveryInputMutation, calls };
}

describe('ensureFrozenVisualContract (WS0b freeze)', () => {
  const savedFlag = process.env.VISUAL_CONTRACT_FREEZE;
  beforeEach(() => {
    delete process.env.VISUAL_CONTRACT_FREEZE;
  });
  afterEach(() => {
    if (savedFlag === undefined) delete process.env.VISUAL_CONTRACT_FREEZE;
    else process.env.VISUAL_CONTRACT_FREEZE = savedFlag;
    vi.restoreAllMocks();
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

  it('flag ON + already frozen (hash + cached contract) → no-op', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const produce = vi.fn();
    const { fn } = makeWithMutation();
    const cache: PipelineCache = {
      textFinalized: true,
      visualContract: CONTRACT as unknown as PipelineCache['visualContract'],
    };
    const out = await ensureFrozenVisualContract(
      fakeOrder({ visualContractHash: HASH }),
      cache,
      { produce, withMutation: fn, db: {} as never },
    );
    expect(out).toBe(cache);
    expect(produce).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
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

  it('flag ON + contract → freezes: hash-keyed operation, payload covers BOTH writes, stamps order + cache', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const produce = vi.fn(async () => ({ contract: CONTRACT, contractHash: HASH }));
    const { fn, calls } = makeWithMutation();
    const cache: PipelineCache = { textFinalized: true, expectedPageCount: 12 };
    const out = await ensureFrozenVisualContract(fakeOrder(), cache, { produce, withMutation: fn, db: {} as never });

    // Returned cache carries the frozen contract; unrelated fields preserved.
    expect(out.visualContract).toBe(CONTRACT);
    expect(out.expectedPageCount).toBe(12);

    expect(fn).toHaveBeenCalledTimes(1);
    const { args, writes } = calls[0];
    expect(args.reason).toBe('visual_contract_frozen');
    expect(args.operationKey).toBe(`delivery_input:ord_1:visual_contract:${HASH}`);
    // Payload covers 100% of what the mutation authoritatively writes.
    expect(args.mutationPayload).toEqual({ visualContractHash: HASH, visualContract: CONTRACT });
    // The mutate closure writes BOTH Order.visualContractHash AND pipelineCache.visualContract.
    expect(writes.order.where).toEqual({ id: 'ord_1' });
    expect(writes.order.data).toEqual({ visualContractHash: HASH });
    expect(writes.job.where).toEqual({ orderId: 'ord_1' });
    expect((writes.job.data.pipelineCache as PipelineCache).visualContract).toBe(CONTRACT);
  });

  it('re-freeze of the SAME contract → SAME operationKey (receipt fence replays → no double inputVersion bump)', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const produce = vi.fn(async () => ({ contract: CONTRACT, contractHash: HASH }));
    const { fn, calls } = makeWithMutation();
    const cache: PipelineCache = { textFinalized: true };
    await ensureFrozenVisualContract(fakeOrder(), cache, { produce, withMutation: fn, db: {} as never });
    await ensureFrozenVisualContract(fakeOrder(), cache, { produce, withMutation: fn, db: {} as never });
    expect(calls).toHaveLength(2);
    expect(calls[0].args.operationKey).toBe(calls[1].args.operationKey);
  });
});
