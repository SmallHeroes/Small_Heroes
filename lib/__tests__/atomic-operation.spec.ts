import { describe, it, expect, vi } from 'vitest';
import {
  runAtomicOperation,
  isRetryablePoolerError,
  ReceiptPayloadMismatchError,
  hashOperationPayload,
} from '@/lib/generation-pipeline/atomic-operation';

class PrismaErr extends Error {
  constructor(public code: string, msg = code) { super(msg); }
}

/**
 * Stateful fake modelling the AtomicOperationReceipt table + interactive-tx atomicity: staged writes commit only
 * if the tx callback resolves, and roll back if it throws (so a non-committed attempt leaves no receipt). The
 * INSERT ... ON CONFLICT DO NOTHING is simulated via the unique operationKey.
 */
function makeFakePrisma(seed: Record<string, { payloadHash: string; result: unknown }> = {}) {
  const committed = new Map(Object.entries(seed));
  const fake = {
    _committed: committed,
    async $transaction(cb: (tx: unknown) => Promise<unknown>) {
      const staged = new Map(committed);
      const tx = {
        async $queryRaw(_strings: TemplateStringsArray, ...values: unknown[]) {
          // values = [id, operationKey, orderId, kind, payloadHash]
          const operationKey = values[1] as string;
          const payloadHash = values[4] as string;
          if (staged.has(operationKey)) return []; // ON CONFLICT DO NOTHING → 0 rows
          staged.set(operationKey, { payloadHash, result: {} });
          return [{ id: values[0] }];
        },
        atomicOperationReceipt: {
          async findUnique({ where }: { where: { operationKey: string } }) {
            const row = staged.get(where.operationKey);
            return row ? { payloadHash: row.payloadHash, result: row.result } : null;
          },
          async update({ where, data }: { where: { operationKey: string }; data: { result: unknown } }) {
            const row = staged.get(where.operationKey);
            if (row) row.result = data.result;
            return {};
          },
        },
      };
      const value = await cb(tx); // throws → rollback (staged discarded)
      for (const [k, v] of staged) committed.set(k, v); // commit
      return value;
    },
  };
  return fake;
}

const noSleep = { sleep: async () => {} };

describe('atomic-operation — receipt-fenced exactly-once (Codex B′)', () => {
  it('fresh operation: runs the mutation once and returns its result', async () => {
    const prisma = makeFakePrisma();
    const run = vi.fn(async () => ({ inputVersion: 1, granted: true }));
    const out = await runAtomicOperation(prisma as never, {
      operationKey: 'k1', orderId: 'o1', kind: 'delivery_input', payloadHash: 'p', run,
    }, noSleep);
    expect(run).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ inputVersion: 1, granted: true });
    expect(prisma._committed.get('k1')).toEqual({ payloadHash: 'p', result: { value: { inputVersion: 1, granted: true } } });
  });

  it('AMBIGUOUS COMMIT (commit succeeded, caller receives P2028): retry replays the recorded result — mutation NEVER reapplied', async () => {
    const prisma = makeFakePrisma();
    const run = vi.fn(async () => ({ inputVersion: 7 }));
    // afterCommit throws P2028 on the first (committed) attempt only → simulate the pooler eating the ack.
    const afterCommit = vi.fn(async (attempt: number) => { if (attempt === 0) throw new PrismaErr('P2028', 'Transaction not found'); });
    const out = await runAtomicOperation(prisma as never, {
      operationKey: 'k2', orderId: 'o1', kind: 'delivery_input', payloadHash: 'p', run,
    }, { ...noSleep, afterCommit });
    expect(run).toHaveBeenCalledTimes(1);          // exactly-once: the second attempt replayed, did not rerun
    expect(afterCommit).toHaveBeenCalledTimes(2);  // attempt 0 (threw) + attempt 1 (replay, no throw)
    expect(out).toEqual({ inputVersion: 7 });      // the recorded result, replayed
  });

  it('NON-COMMITTED ambiguous error (mutation threw P2028 before commit): retry re-runs the mutation', async () => {
    const prisma = makeFakePrisma();
    let n = 0;
    const run = vi.fn(async () => { n++; if (n === 1) throw new PrismaErr('P2028'); return { inputVersion: 2 }; });
    const out = await runAtomicOperation(prisma as never, {
      operationKey: 'k3', orderId: 'o1', kind: 'regen_reserve', payloadHash: 'p', run,
    }, noSleep);
    expect(run).toHaveBeenCalledTimes(2);   // attempt 0 rolled back (no receipt) → attempt 1 re-ran
    expect(out).toEqual({ inputVersion: 2 });
    expect(prisma._committed.get('k3')).toEqual({ payloadHash: 'p', result: { value: { inputVersion: 2 } } });
  });

  it('PAYLOAD-HASH MISMATCH under the same key FAILS CLOSED (no retry, mutation never runs)', async () => {
    const prisma = makeFakePrisma({ k4: { payloadHash: 'ORIGINAL', result: { value: { inputVersion: 1 } } } });
    const run = vi.fn(async () => ({ inputVersion: 9 }));
    await expect(runAtomicOperation(prisma as never, {
      operationKey: 'k4', orderId: 'o1', kind: 'delivery_input', payloadHash: 'DIFFERENT', run,
    }, noSleep)).rejects.toBeInstanceOf(ReceiptPayloadMismatchError);
    expect(run).not.toHaveBeenCalled();
  });

  it('MATCHING replay: a second call with the SAME key+payload returns the recorded result without rerunning', async () => {
    const prisma = makeFakePrisma({ k5: { payloadHash: 'p', result: { value: { revision: 3 } } } });
    const run = vi.fn(async () => ({ revision: 999 }));
    const out = await runAtomicOperation(prisma as never, {
      operationKey: 'k5', orderId: 'o1', kind: 'readiness_commit', payloadHash: 'p', run,
    }, noSleep);
    expect(run).not.toHaveBeenCalled();
    expect(out).toEqual({ revision: 3 });
  });

  it('a NON-retryable error propagates immediately (no retry)', async () => {
    const prisma = makeFakePrisma();
    const run = vi.fn(async () => { throw new Error('boom_business_error'); });
    await expect(runAtomicOperation(prisma as never, {
      operationKey: 'k6', orderId: 'o1', kind: 'delivery_input', payloadHash: 'p', run,
    }, noSleep)).rejects.toThrow('boom_business_error');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('exhausts maxAttempts on a persistent ambiguous error and throws', async () => {
    const prisma = makeFakePrisma();
    const run = vi.fn(async () => { throw new PrismaErr('P1017', 'connection lost'); });
    await expect(runAtomicOperation(prisma as never, {
      operationKey: 'k7', orderId: 'o1', kind: 'delivery_input', payloadHash: 'p', run,
    }, noSleep)).rejects.toBeInstanceOf(PrismaErr);
    expect(run).toHaveBeenCalledTimes(3); // maxAttempts
  });
});

describe('isRetryablePoolerError', () => {
  it('matches the pooler/connection ambiguity codes + messages, not business errors', () => {
    for (const c of ['P2028', 'P1017', 'P2024', 'P2034']) expect(isRetryablePoolerError(new PrismaErr(c))).toBe(true);
    expect(isRetryablePoolerError(new Error('Transaction not found. Transaction ID is invalid'))).toBe(true);
    expect(isRetryablePoolerError(new Error('obtained before disconnecting'))).toBe(true);
    expect(isRetryablePoolerError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryablePoolerError(new PrismaErr('P2002', 'unique constraint'))).toBe(false);
    expect(isRetryablePoolerError(new Error('frozen_product_truth_mismatch'))).toBe(false);
    expect(isRetryablePoolerError(null)).toBe(false);
  });
});

describe('hashOperationPayload', () => {
  it('is stable + order-sensitive', () => {
    expect(hashOperationPayload({ a: 1, b: 2 })).toBe(hashOperationPayload({ a: 1, b: 2 }));
    expect(hashOperationPayload({ a: 1 })).not.toBe(hashOperationPayload({ a: 2 }));
  });
});
