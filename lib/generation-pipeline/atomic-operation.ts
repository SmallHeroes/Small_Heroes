/**
 * (pooler-fix / Codex B′) Receipt-fenced interactive transaction for the generation worker.
 *
 * WHY: under the Supavisor TRANSACTION pooler (port 6543) a post-render barrier transaction can COMMIT on the
 * server yet the caller still receives P2028 ("Transaction not found") — the connection was recycled during the
 * ~45-50s render gap. A bare retry would re-apply the mutation (double inputVersion bump / double regen / double
 * outbox). Instead, every fenced tx writes a durable AtomicOperationReceipt keyed by a caller-supplied durable
 * operationKey, IN THE SAME TX as the business mutation. A retry re-enters through the fence:
 *   - prior attempt COMMITTED → the unique operationKey conflicts → replay the RECORDED result (mutation NEVER
 *     reapplied) → exactly-once.
 *   - prior attempt did NOT commit → the receipt is absent → run the mutation.
 * A payloadHash mismatch under the same key FAILS CLOSED (same key + different payload = a defect).
 *
 * Runtime stays on the 6543 pooler (serverless-correct). No session-pinning, no $connect/$disconnect, no blind
 * rerun — the receipt is the only source of idempotency.
 */
import { randomUUID, createHash } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient;

// Prisma/pooler errors that make the commit outcome AMBIGUOUS (connection/transaction lost). Safe to retry
// THROUGH the receipt fence — the receipt, not the retry, decides exactly-once.
const RETRYABLE_CODES = new Set(['P2028', 'P1017', 'P2024', 'P2034']);
const RETRYABLE_MESSAGE_RE =
  /transaction not found|transaction api error|transaction already closed|connection.*(closed|reset|lost)|terminating connection|server (has )?gone away|econnreset|obtained before disconnecting/i;

/** True when the error indicates a lost/recycled pooled connection or transaction (ambiguous commit). */
export function isRetryablePoolerError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const code = (e as { code?: string }).code;
  if (typeof code === 'string' && RETRYABLE_CODES.has(code)) return true;
  const msg = (e as { message?: string }).message ?? '';
  return typeof msg === 'string' && RETRYABLE_MESSAGE_RE.test(msg);
}

/** A different payload under the same operationKey — a programming defect. NEVER retried; fails closed. */
export class ReceiptPayloadMismatchError extends Error {
  readonly code = 'atomic_receipt_payload_mismatch';
  constructor(
    public readonly operationKey: string,
    public readonly expected: string,
    public readonly got: string,
  ) {
    super(
      `[atomic-op] payloadHash mismatch for operationKey=${operationKey} ` +
        `(recorded=${expected} incoming=${got}) — same key, different payload = defect; failing closed`,
    );
    this.name = 'ReceiptPayloadMismatchError';
  }
}

/** Stable hash of an operation's inputs — folded into the receipt so a same-key/different-payload retry fails closed. */
export function hashOperationPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

export interface AtomicOperationArgs<T> {
  /** Durable key that survives worker retries; the exactly-once fence. */
  operationKey: string;
  orderId: string;
  /** 'delivery_input' | 'regen_reserve' | 'readiness_commit'. */
  kind: string;
  /** Hash of the operation inputs; a mismatch under the same key fails closed. */
  payloadHash: string;
  /**
   * The business mutation + invalidation + counters. Runs ONLY when the receipt is newly inserted (never on a
   * fence hit). MUST return a JSON-round-trippable value — it is recorded and replayed verbatim on a fence hit.
   */
  run: (tx: Tx) => Promise<T>;
}

export interface AtomicOperationDeps {
  /** Injected for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected to simulate an ambiguous commit (commit succeeds; caller sees P2028) in the proof. */
  afterCommit?: (attempt: number) => Promise<void>;
  maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
// maxWait 10s (acquire a pooled connection), timeout 20s (absorb latency without the 5s default tripping).
const TX_OPTS = { maxWait: 10_000, timeout: 20_000 } as const;

/**
 * Run a receipt-fenced interactive transaction, retrying the SAME operationKey ≤maxAttempts over the 6543 pooler
 * on an ambiguous-commit error. Exactly-once regardless of whether the ambiguous attempt actually committed.
 */
export async function runAtomicOperation<T>(
  prisma: PrismaClient,
  args: AtomicOperationArgs<T>,
  deps: AtomicOperationDeps = {},
): Promise<T> {
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const value = await prisma.$transaction((tx) => runFenced(tx, args), TX_OPTS);
      // Proof hook: simulate "commit succeeded, caller receives P2028" AFTER the tx committed. The retry must
      // re-enter through the fence and replay the recorded result (exactly-once), not reapply the mutation.
      if (deps.afterCommit) await deps.afterCommit(attempt);
      return value;
    } catch (e) {
      if (e instanceof ReceiptPayloadMismatchError) throw e; // defect → fail closed, never retry
      lastErr = e;
      if (!isRetryablePoolerError(e) || attempt === maxAttempts - 1) throw e;
      // bounded jittered backoff; the SAME operationKey re-enters through the fence next iteration
      const base = 150 * Math.pow(2, attempt);
      await sleep(Math.round(base * (1 + Math.random() * 0.5)));
    }
  }
  throw lastErr;
}

/** The in-tx protocol (steps a–e). Kept separate so tests can drive it against a stateful fake. */
async function runFenced<T>(tx: Tx, args: AtomicOperationArgs<T>): Promise<T> {
  // (a) INSERT the receipt ON CONFLICT DO NOTHING → RETURNING tells us whether THIS attempt owns the operation.
  const inserted = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "AtomicOperationReceipt" ("id", "operationKey", "orderId", "kind", "payloadHash", "result", "createdAt")
    VALUES (${randomUUID()}, ${args.operationKey}, ${args.orderId}, ${args.kind}, ${args.payloadHash}, '{}'::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT ("operationKey") DO NOTHING
    RETURNING "id"`;

  if (inserted.length === 0) {
    // (b) already present (a prior attempt committed) → verify payloadHash, then replay the recorded result.
    const existing = await tx.atomicOperationReceipt.findUnique({
      where: { operationKey: args.operationKey },
      select: { payloadHash: true, result: true },
    });
    if (!existing) throw new Error('atomic_receipt_conflict_without_row'); // impossible under the unique index
    if (existing.payloadHash !== args.payloadHash) {
      throw new ReceiptPayloadMismatchError(args.operationKey, existing.payloadHash, args.payloadHash);
    }
    return (existing.result as { value: T }).value; // NEVER reapply the mutation
  }

  // (c) newly inserted → perform the mutation + invalidation + counters exactly once.
  const value = await args.run(tx);
  // (d) record the result in the receipt row (same tx) so a later fence hit can replay it.
  await tx.atomicOperationReceipt.update({
    where: { operationKey: args.operationKey },
    data: { result: { value } as unknown as Prisma.InputJsonValue },
  });
  // (e) commit is atomic (receipt + mutation all-or-nothing) — the enclosing $transaction guarantees it.
  return value;
}
