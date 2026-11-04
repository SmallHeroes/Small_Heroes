import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { PrismaClient } from '@prisma/client';
import { AtomicOperationOutcomeUnknownError } from '@/lib/generation-pipeline/atomic-operation';
import {
  inspectEngineOrderMeter, registerEngineOrderAuthority, reserveEngineCall, settleEngineCall,
} from '../order-meter';
import { authority, hash } from './fixtures';
import { bookDigest } from '../contract';
import { operatorDecisionDigest } from '../delivery-gate';
import { readEngineOperatorHistory, recordEngineOperatorDecision } from '../operator-review-store';
import { gate, manifest, NOW } from './fixtures';
import { z } from 'zod';
import { dispatchAnthropicAuthor } from '../anthropic-author';

/** Actual production SQL and receipt helper, isolated in-memory PG. NOT two-session/pooler concurrency proof. */
let pg: PGlite;
function prismaTransaction(tx: Transaction) {
  return {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
      return (await tx.query(sql, values)).rows;
    },
    atomicOperationReceipt: {
      findUnique: async (input: { where: { operationKey: string } }) =>
        (await tx.query('SELECT * FROM "AtomicOperationReceipt" WHERE "operationKey" = $1', [input.where.operationKey])).rows[0] ?? null,
      findMany: async (input: { where: { orderId: string; kind: { in: string[] } } }) =>
        (await tx.query('SELECT * FROM "AtomicOperationReceipt" WHERE "orderId" = $1 AND "kind" = ANY($2::text[])',
          [input.where.orderId, input.where.kind.in])).rows,
      update: async (input: { where: { operationKey: string }; data: { result: unknown } }) => {
        await tx.query('UPDATE "AtomicOperationReceipt" SET "result" = $1::jsonb WHERE "operationKey" = $2',
          [JSON.stringify(input.data.result), input.where.operationKey]);
      },
    },
  };
}
const db = {
  $transaction: (work: (tx: ReturnType<typeof prismaTransaction>) => Promise<unknown>) => pg.transaction(tx => work(prismaTransaction(tx))),
} as unknown as PrismaClient;

beforeAll(async () => {
  vi.stubGlobal('fetch', () => { throw Error('network_forbidden'); });
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE "Order" (
      "id" text PRIMARY KEY, "status" text NOT NULL DEFAULT 'paid',
      "paymentProvider" text DEFAULT 'payme', "paymeTransactionId" text DEFAULT 'synthetic_transaction',
      "deliveryHoldReason" text, "manualReviewRequired" boolean NOT NULL DEFAULT false,
      "selectionFilename" text, "visualPackageAuthority" jsonb, "frozenProductVersion" text DEFAULT 'engine-site/v1'
    );
    CREATE TABLE "GenerationJob" ("orderId" text PRIMARY KEY);
    CREATE TABLE "AtomicOperationReceipt" (
      "id" text PRIMARY KEY, "operationKey" text UNIQUE NOT NULL, "orderId" text NOT NULL REFERENCES "Order"("id"),
      "kind" text NOT NULL, "payloadHash" text NOT NULL, "result" jsonb NOT NULL, "createdAt" timestamptz NOT NULL
    );
  `);
});
beforeEach(async () => {
  await pg.exec('TRUNCATE "AtomicOperationReceipt", "GenerationJob", "Order"');
  await pg.query('INSERT INTO "Order" ("id") VALUES ($1), ($2)', ['synthetic_order', 'another_order']);
});
afterAll(async () => { await pg?.close(); vi.unstubAllGlobals(); });

const call = (step = 'page_0_0', maximumMicroUsd = step === 'page_0_0_qa' ? 70 : 40) => ({ step, maximumMicroUsd, wireSha256: hash() });
const settle = (estimatedMicroUsd: number | null = 30, completed = true, step = 'page_0_0') =>
  settleEngineCall(db, { authority: authority(), step, estimatedMicroUsd, completed, wireSha256: hash(), receiptSha256: hash('b') });
const meter = () => inspectEngineOrderMeter(db, authority());

describe('order-scoped native engine meter through the existing receipt fence', () => {
  it('registers once, grants a claim once, and frees only known settled usage', async () => {
    await registerEngineOrderAuthority(db, authority());
    await registerEngineOrderAuthority(db, authority());
    expect((await reserveEngineCall(db, { authority: authority(), call: call() })).dispatchGranted).toBe(true);
    expect((await reserveEngineCall(db, { authority: authority(), call: call() })).dispatchGranted).toBe(false);
    expect(await meter()).toMatchObject({ pendingCalls: 1, accountedMicroUsd: 40, logicalCalls: 1, blocked: true });
    await settle(); await settle();
    expect(await meter()).toMatchObject({ pendingCalls: 0, accountedMicroUsd: 30, knownEstimateMicroUsd: 30, logicalCalls: 1, blocked: false });
    expect((await reserveEngineCall(db, { authority: authority(), call: call('page_0_0_qa', 70) })).dispatchGranted).toBe(true);
    const count = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM "AtomicOperationReceipt"');
    expect(count.rows[0].n).toBe(4);
  });

  it('refuses authority/cap changes, changed wire/reserve and unauthorized step names without resetting history', async () => {
    await registerEngineOrderAuthority(db, authority());
    const changed = authority(); changed.budget.maximumMicroUsd = 101;
    await expect(registerEngineOrderAuthority(db, changed)).rejects.toThrow('payloadHash mismatch');
    await expect(reserveEngineCall(db, { authority: changed, call: call() })).rejects.toThrow('engine_authority_missing_or_changed');
    await reserveEngineCall(db, { authority: authority(), call: call() });
    await expect(reserveEngineCall(db, { authority: authority(), call: { ...call(), wireSha256: hash('c') } })).rejects.toThrow('payloadHash mismatch');
    await expect(reserveEngineCall(db, { authority: authority(), call: call('page_0_0', 41) })).rejects.toThrow('engine_step_not_authorized');
    await expect(reserveEngineCall(db, { authority: authority(), call: call('page_0_0', 1) })).rejects.toThrow('engine_step_not_authorized');
    await expect(reserveEngineCall(db, { authority: authority(), call: call('new_cycle_page_0_0') })).rejects.toThrow('engine_step_not_authorized');
    expect(await meter()).toMatchObject({ logicalCalls: 1, pendingCalls: 1, accountedMicroUsd: 40 });
  });

  it('pending or UNKNOWN outcomes keep the full reserve and forbid every next paid step', async () => {
    await registerEngineOrderAuthority(db, authority());
    await reserveEngineCall(db, { authority: authority(), call: call() });
    await expect(reserveEngineCall(db, { authority: authority(), call: call('page_0_0_qa') })).rejects.toThrow('engine_previous_call_unresolved_or_failed');
    await settle(null, false);
    expect(await meter()).toMatchObject({ pendingCalls: 0, unknownCalls: 1, failedCalls: 1, accountedMicroUsd: 40, knownEstimateMicroUsd: 0 });
    await expect(reserveEngineCall(db, { authority: authority(), call: call('page_0_0_qa') })).rejects.toThrow('engine_previous_call_unresolved_or_failed');
    await expect(settle(0, true)).rejects.toThrow('payloadHash mismatch');
  });

  it('does not treat a known failed call as permission to render again', async () => {
    await registerEngineOrderAuthority(db, authority()); await reserveEngineCall(db, { authority: authority(), call: call() });
    await settle(5, false);
    expect(await meter()).toMatchObject({ failedCalls: 1, accountedMicroUsd: 5, blocked: true });
    await expect(reserveEngineCall(db, { authority: authority(), call: call('page_0_0_qa') })).rejects.toThrow('engine_previous_call_unresolved_or_failed');
  });

  it('enforces remaining total budget and individual step reserves in the same locked transaction', async () => {
    const auth = authority(); auth.budget.steps[1].maximumMicroUsd = 71;
    await registerEngineOrderAuthority(db, auth);
    await reserveEngineCall(db, { authority: auth, call: call() });
    await settleEngineCall(db, { authority: auth, ...call(), estimatedMicroUsd: 30, completed: true, receiptSha256: hash() });
    await expect(reserveEngineCall(db, { authority: auth, call: call('page_0_0_qa', 81) })).rejects.toThrow('engine_step_not_authorized');
    await expect(reserveEngineCall(db, { authority: auth, call: call('page_0_0_qa', 71) })).rejects.toThrow('engine_budget_exhausted');
    expect((await inspectEngineOrderMeter(db, auth)).logicalCalls).toBe(1);
  });

  it('enforces call count even when prior calls cost zero', async () => {
    const auth = authority(); auth.budget.maximumCalls = 1;
    await registerEngineOrderAuthority(db, auth); await reserveEngineCall(db, { authority: auth, call: call() });
    await settleEngineCall(db, { authority: auth, ...call(), estimatedMicroUsd: 0, completed: true, receiptSha256: hash() });
    await expect(reserveEngineCall(db, { authority: auth, call: call('page_0_0_qa') })).rejects.toThrow('engine_budget_exhausted');
  });

  it('records actual cost above reserve/cap in full and stops future dispatch', async () => {
    await registerEngineOrderAuthority(db, authority()); await reserveEngineCall(db, { authority: authority(), call: call() });
    await settle(125);
    expect(await meter()).toMatchObject({ accountedMicroUsd: 125, knownEstimateMicroUsd: 125, overReservedCalls: 1, blocked: true });
    await expect(reserveEngineCall(db, { authority: authority(), call: call('page_0_0_qa') })).rejects.toThrow('engine_previous_call_unresolved_or_failed');
  });

  it.each(['draft', 'pending_payment', 'needs_human_qa', 'failed', 'ready', 'partial'])(
    'does not dispatch from non-generating status %s', async status => {
      await registerEngineOrderAuthority(db, authority());
      await pg.query('UPDATE "Order" SET "status" = $1 WHERE "id" = $2', [status, authority().orderId]);
      await expect(reserveEngineCall(db, { authority: authority(), call: call() })).rejects.toThrow('engine_order_not_dispatchable');
      expect((await meter()).logicalCalls).toBe(0);
    });

  it.each(['hold', 'manual_review', 'missing_payment', 'wrong_provider'])(
    'requires verified paid eligibility and refuses %s', async kind => {
      await registerEngineOrderAuthority(db, authority());
      const updates = { hold: '"deliveryHoldReason" = \'synthetic_hold\'', manual_review: '"manualReviewRequired" = true',
        missing_payment: '"paymeTransactionId" = null', wrong_provider: '"paymentProvider" = \'none\'' };
      await pg.exec(`UPDATE "Order" SET ${updates[kind as keyof typeof updates]}`);
      await expect(reserveEngineCall(db, { authority: authority(), call: call() })).rejects.toThrow('engine_order_not_dispatchable');
    });

  it('settles a late returned answer after the order was held without reopening dispatch', async () => {
    await registerEngineOrderAuthority(db, authority()); await reserveEngineCall(db, { authority: authority(), call: call() });
    await pg.exec('UPDATE "Order" SET "status" = \'needs_human_qa\', "deliveryHoldReason" = \'cancelled\'');
    await settle(35);
    expect(await meter()).toMatchObject({ knownEstimateMicroUsd: 35, pendingCalls: 0 });
    await expect(reserveEngineCall(db, { authority: authority(), call: call('page_0_0_qa') })).rejects.toThrow('engine_order_not_dispatchable');
  });

  it('cannot settle another wire, an unclaimed step, or silently alter a settled result', async () => {
    await registerEngineOrderAuthority(db, authority());
    await expect(settle()).rejects.toThrow('engine_result_without_claim');
    await reserveEngineCall(db, { authority: authority(), call: call() });
    await expect(settleEngineCall(db, { authority: authority(), ...call(), wireSha256: hash('c'), completed: true,
      estimatedMicroUsd: 30, receiptSha256: hash() })).rejects.toThrow('engine_result_binding');
    await settle(); await expect(settle(31)).rejects.toThrow('payloadHash mismatch');
    expect((await meter()).knownEstimateMicroUsd).toBe(30);
  });

  it('keeps authorities, duplicate calls and budgets scoped to separate orders', async () => {
    const other = authority('another_order');
    await registerEngineOrderAuthority(db, authority()); await registerEngineOrderAuthority(db, other);
    expect((await reserveEngineCall(db, { authority: authority(), call: call() })).dispatchGranted).toBe(true);
    expect((await reserveEngineCall(db, { authority: other, call: call() })).dispatchGranted).toBe(true);
    expect((await inspectEngineOrderMeter(db, other)).accountedMicroUsd).toBe(40);
  });

  it.each(['bank_file', 'bank_package', 'existing_job'])(
    'does not take authority over an existing legacy order (%s)', async kind => {
      if (kind === 'bank_file') await pg.exec('UPDATE "Order" SET "selectionFilename" = \'retired_bank\'');
      if (kind === 'bank_package') await pg.exec('UPDATE "Order" SET "visualPackageAuthority" = \'{}\'::jsonb');
      if (kind === 'existing_job') await pg.query('INSERT INTO "GenerationJob" VALUES ($1)', [authority().orderId]);
      await expect(registerEngineOrderAuthority(db, authority())).rejects.toThrow(kind === 'existing_job'
        ? 'engine_authority_registration_refused' : 'engine_bank_order_refused');
    });

  it('cannot bind an authority to a legacy order that lacks the immutable new-engine discriminator', async () => {
    await pg.exec('UPDATE "Order" SET "frozenProductVersion" = null');
    await expect(registerEngineOrderAuthority(db, authority())).rejects.toThrow('engine_order_protocol_mismatch');
  });

  it('replays an internal ambiguous commit safely before dispatch, but never grants a later invocation again', async () => {
    await registerEngineOrderAuthority(db, authority());
    let first = true;
    const result = await reserveEngineCall(db, { authority: authority(), call: call() }, {
      sleep: async () => {}, afterCommit: async () => { if (first) { first = false; throw { code: 'P2028' }; } },
    });
    expect(result.dispatchGranted).toBe(true);
    expect((await reserveEngineCall(db, { authority: authority(), call: call() })).dispatchGranted).toBe(false);
    expect((await meter()).logicalCalls).toBe(1);
  });

  it('a lost claim response leaves a full pending reservation and no redispatch on restart', async () => {
    await registerEngineOrderAuthority(db, authority());
    await expect(reserveEngineCall(db, { authority: authority(), call: call() }, {
      maxAttempts: 1, afterCommit: async () => { throw { code: 'P2028' }; },
    })).rejects.toBeInstanceOf(AtomicOperationOutcomeUnknownError);
    expect((await reserveEngineCall(db, { authority: authority(), call: call() })).dispatchGranted).toBe(false);
    expect(await meter()).toMatchObject({ pendingCalls: 1, accountedMicroUsd: 40, logicalCalls: 1, blocked: true });
  });

  it('serializes simultaneous callers on the local PG transaction scheduler (not a multi-session lock proof)', async () => {
    await registerEngineOrderAuthority(db, authority());
    const results = await Promise.all([reserveEngineCall(db, { authority: authority(), call: call() }),
      reserveEngineCall(db, { authority: authority(), call: call() })]);
    expect(results.filter(result => result.dispatchGranted)).toHaveLength(1);
    const attempts = await Promise.allSettled([reserveEngineCall(db, { authority: authority(), call: call('page_0_0_qa') }),
      reserveEngineCall(db, { authority: authority(), call: call('page_0_0_identity') })]);
    expect(attempts.every(attempt => attempt.status === 'rejected')).toBe(true);
  });

  it('fails closed on corrupt stored claims and malformed monetary inputs', async () => {
    await registerEngineOrderAuthority(db, authority());
    for (const amount of [-1, 0, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(reserveEngineCall(db, { authority: authority(), call: call('page_0_0', amount) })).rejects.toThrow();
    }
    await reserveEngineCall(db, { authority: authority(), call: call() });
    await pg.exec('UPDATE "AtomicOperationReceipt" SET "result" = \'{}\'::jsonb WHERE "kind" = \'engine_site_call_claim_v1\'');
    await expect(meter()).rejects.toThrow();
  });

  it('persists actor, first server time and exact book bytes, with idempotent review-command replay', async () => {
    const auth = authority(), book = manifest(auth);
    await registerEngineOrderAuthority(db, auth);
    const input = { authority: auth, manifest: book, policy: gate(), expectedBookSha256: bookDigest(book),
      expectedPreviousDecisionSha256: null, idempotencyKey: 'synthetic_review_1', actorId: 'synthetic_guy',
      decision: 'approve' as const, reason: 'Synthetic eye review' };
    const approved = await recordEngineOperatorDecision(db, input, { now: () => NOW });
    const replay = await recordEngineOperatorDecision(db, input, { now: () => new Date('2026-11-05T00:00:00.000Z') });
    expect(replay).toEqual(approved);
    expect(approved).toMatchObject({ actorId: 'synthetic_guy', decidedAt: NOW.toISOString(), bookSha256: bookDigest(book) });
    expect(await readEngineOperatorHistory(db, auth)).toEqual([approved]);
    expect((await meter()).logicalCalls).toBe(0);
  });

  it('review commands reject stale bytes/history and append rejection without overwriting approval', async () => {
    const auth = authority(), book = manifest(auth); await registerEngineOrderAuthority(db, auth);
    const input = { authority: auth, manifest: book, policy: gate(), expectedBookSha256: bookDigest(book),
      expectedPreviousDecisionSha256: null, idempotencyKey: 'review_1', actorId: 'synthetic_guy', decision: 'approve' as const, reason: 'Synthetic' };
    const approved = await recordEngineOperatorDecision(db, input, { now: () => NOW });
    await expect(recordEngineOperatorDecision(db, { ...input, decision: 'reject' })).rejects.toThrow('payloadHash mismatch');
    await expect(recordEngineOperatorDecision(db, { ...input, idempotencyKey: 'review_2' })).rejects.toThrow('operator_review_conflict');
    const changed = manifest(auth); changed.pages[0].textSha256 = hash('f');
    await expect(recordEngineOperatorDecision(db, { ...input, manifest: changed })).rejects.toThrow('operator_book_changed');
    const rejected = await recordEngineOperatorDecision(db, { ...input, idempotencyKey: 'review_2', decision: 'reject',
      expectedPreviousDecisionSha256: operatorDecisionDigest(approved) }, { now: () => NOW });
    expect(await readEngineOperatorHistory(db, auth)).toEqual([approved, rejected]);
  });

  it('only one concurrent local review command may consume an expected history revision', async () => {
    const auth = authority(), book = manifest(auth); await registerEngineOrderAuthority(db, auth);
    const input = { authority: auth, manifest: book, policy: gate(), expectedBookSha256: bookDigest(book),
      expectedPreviousDecisionSha256: null, idempotencyKey: 'review_1', actorId: 'synthetic_guy', decision: 'approve' as const, reason: 'Synthetic' };
    const results = await Promise.allSettled([recordEngineOperatorDecision(db, input, { now: () => NOW }),
      recordEngineOperatorDecision(db, { ...input, idempotencyKey: 'review_2', decision: 'reject' }, { now: () => NOW })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await readEngineOperatorHistory(db, auth)).toHaveLength(1);
  });

  it('connects the actual SQL meter to the Anthropic boundary, persists privately and never redispatches on replay', async () => {
    const auth = authority(); auth.budget = { ...auth.budget, maximumMicroUsd: 5000,
      steps: [{ id: 'story_author', maximumMicroUsd: 1000 }] };
    await registerEngineOrderAuthority(db, auth);
    const raw = { type: 'message', model: 'claude-opus-5-5', stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"text":"Synthetic story"}' }],
      usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
        service_tier: 'standard', speed: 'standard', inference_geo: 'global' } };
    const privateBodies: string[] = [], fetchImpl = vi.fn(async () => new Response(JSON.stringify(raw), { headers: { 'request-id': 'req_synthetic' } }));
    const key = vi.fn(() => 'SYNTHETIC_ONLY');
    const options = { authority: auth, step: 'story_author', availableMs: 1_000_000, signal: new AbortController().signal,
      call: { role: 'opus' as const, stage: 'author' as const, conversationKey: 'synthetic_fresh', input: 'Synthetic brief',
        instructions: 'Synthetic author recipe', schema: z.object({ text: z.string().min(2) }).strict(), maxOutputTokens: 8000 },
      ports: { assertCurrent: async () => {}, key, fetch: fetchImpl,
        reserve: (call: Parameters<typeof reserveEngineCall>[1]['call']) => reserveEngineCall(db, { authority: auth, call }),
        settle: (result: Omit<Parameters<typeof settleEngineCall>[1], 'authority'>) => settleEngineCall(db, { authority: auth, ...result }),
        persistPrivateBody: async (body: string) => { privateBodies.push(body); },
      } };
    expect(await dispatchAnthropicAuthor(options)).toMatchObject({ kind: 'completed', estimatedMicroUsd: 800 });
    expect(await dispatchAnthropicAuthor(options)).toEqual({ kind: 'already_claimed' });
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(key).toHaveBeenCalledTimes(1); expect(privateBodies).toHaveLength(1);
    expect(await inspectEngineOrderMeter(db, auth)).toMatchObject({ logicalCalls: 1, pendingCalls: 0,
      knownEstimateMicroUsd: 800, accountedMicroUsd: 800, blocked: false });
  });
});
