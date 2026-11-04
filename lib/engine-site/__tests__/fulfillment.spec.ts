import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve } from 'path';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import type { SavedPage } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import { canonicalHash } from '@/lib/canonical-json';
import { claimDueDeliveries, processDelivery } from '@/lib/generation-chunked/delivery-outbox';
import { claimDueExceptionCases, fencedOutboxTerminalWithException } from '@/lib/generation-chunked/exception-case';
import { processExceptionCase } from '@/lib/generation-chunked/exception-processor';
import { refundOrderPayment, prismaRefundFence } from '@/lib/payment-refunds';
import { syntheticMaterializedEngineBook } from './synthetic-book';
import { loadEngineReaderBook } from '../reader';
import { handleEngineBookRead } from '../reader-http';
import { loadEnginePrivateAsset } from '../private-assets';
import { ensureEngineLaunchPolicy, readEngineLaunchPolicy, changeEngineLaunchPolicy } from '../launch-policy';
import { policyDigest } from '../delivery-gate';
import { readEngineOperatorHistory } from '../operator-review-store';
import { ENGINE_BOOK_SCOPE, reconcileEngineBook, recoverEnginePaidJob, decideEngineBook, readEngineFamilyReady, casEngineClaimSendSlot, failEngineOrder } from '../fulfillment';
import { handleEngineOperator } from '../operator-http';
import { admitEngineBookEvidence } from '../readmission';
import { parseEngineCheckpoint, runEngineDurableInvocation } from '../durable-worker';
import { engineTestDb } from './engine-test-db';
import { startEnginePersonalJob } from '../personal-jobs';
import { engineRecipeSteps, type EngineSpendPolicy } from '../platform-policy';
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get() { throw Error('production_db_forbidden'); } }) }));
vi.mock('@/lib/env', () => ({ env: {}, isFakePaymentEnabled: () => false, canUseFakePayments: () => false }));
vi.mock('@/backend/lib/email', () => ({ sendBookReadyEmail: () => { throw Error('production_email_forbidden'); },
  getBookReadyEmailDeliveryState: () => { throw Error('production_email_forbidden'); }, sendRefundNoticeEmail: () => { throw Error('production_email_forbidden'); } }));
let image: Buffer, audio: Buffer;
const stores: { pg: { close(): Promise<void> } }[] = [];
beforeAll(async () => {
  image = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: '#397a81' } }).png().toBuffer();
  const dir = resolve('_review/engine-site-launch/m11-acceptance-delivery/synthetic-tmp'); mkdirSync(dir, { recursive: true }); writeFileSync(resolve(dir, '.gitignore'), '*\n');
  const load = createRequire(resolve('package.json')), file = resolve(dir, 'synthetic-tone.mp3');
  execFileSync(load('@ffmpeg-installer/ffmpeg').path, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2', '-b:a', '96k', file], { windowsHide: true }); audio = readFileSync(file);
});
beforeEach(() => { vi.stubEnv('ENGINE_SITE_FULFILLMENT_ENABLED', 'true'); vi.stubGlobal('fetch', () => { throw Error('external_network_forbidden'); }); });
afterEach(async () => { for (const s of stores.splice(0)) await s.pg.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function setup() {
  const s = await syntheticMaterializedEngineBook(image, audio); stores.push(s); const c = await s.finish();
  // The engine's perception/compiler proof is tested independently. These SQL lifecycle tests inject admitted synthetic frames.
  const ports = { storage: s.storage, origin: 'https://app.example.invalid', admit: async () => s.pages as unknown as SavedPage[] };
  await ensureEngineLaunchPolicy(s.db);
  const command = async (decision: 'approve' | 'reject', idempotencyKey = 'synthetic_review_1') => ({ expectedBookSha256: c.bookSha256,
    expectedPolicySha256: policyDigest(await readEngineLaunchPolicy(s.db)), expectedPreviousDecisionSha256: null, idempotencyKey, decision, reason: 'Synthetic operator eye only' });
  const reconcile = () => reconcileEngineBook(s.db, 'synthetic_order', ports);
  const context = () => loadEngineReaderBook(s.db, s.storage, 'synthetic_order');
  const claim = async () => (await claimDueDeliveries(s.db, new Date(), 1))[0];
  const send = vi.fn(async () => ({ providerMessageId: 'synthetic_message' }));
  const deliver = async () => { const row = await claim(); return row ? processDelivery(s.db, row, { send,
    cas: (r, token, expiry, now) => casEngineClaimSendSlot(s.db, r, token, expiry, now, ports) }) : null; };
  return { ...s, c, ports, command, reconcile, context, claim, send, deliver };
}
describe('personal automatic path + audited launch gate + existing readiness/outbox/refund (synthetic only)', () => {
  it('reconciles paid-to-job loss, probes an ambiguous job commit and creates a refund liability when no job exists', async () => {
    const s = await engineTestDb(); stores.push(s); const kick = vi.fn();
    const policy: EngineSpendPolicy = { version: 'engine-site-spend-policy/v1', sourceRevision: 'a'.repeat(40), maximumMicroUsd: 10_000_000,
      maximumCalls: 200, approvalReference: 'SYNTHETIC_ONLY', approvedBy: 'synthetic', approvedAt: '2026-11-04T00:00:00.000Z', paidProviderActivation: 'owner_approved_live_personal_orders' };
    const start = vi.fn(async () => { await startEnginePersonalJob(s.db, 'synthetic_order', policy); throw Error('synthetic_ambiguous_commit'); });
    expect(await recoverEnginePaidJob(s.db, 'synthetic_order', start, kick)).toMatchObject({ status: 'job_recovered' });
    expect(start).toHaveBeenCalledTimes(1); expect(kick).toHaveBeenCalledTimes(1); expect(await s.db.exceptionCase.findMany()).toHaveLength(0);
    const missing = await engineTestDb(); stores.push(missing);
    expect(await recoverEnginePaidJob(missing.db, 'synthetic_order', async () => { throw Error('synthetic_no_job'); }, kick)).toMatchObject({ status: 'failed' });
    expect((await missing.db.exceptionCase.findFirst())!.status).toBe('refund_pending'); expect(kick).toHaveBeenCalledTimes(1);
  }, 120_000);
  it('holds the automatic pass, authenticates eye approval, publishes and sends exactly once through the actual outbox', async () => {
    const s = await setup(); expect(await s.reconcile()).toMatchObject({ status: 'operator_review' });
    expect(await readEngineFamilyReady(s.db, await s.context())).toBe(false); expect(await s.claim()).toBeUndefined();
    const operatorPorts = { ...s.ports, db: s.db, storage: () => s.storage, operatorIds: ['synthetic_guy'], parent: async () => ({ id: 'synthetic_guy' }),
      fulfillmentEnabled: true, fulfillment: () => s.ports };
    const request = (body?: unknown) => new NextRequest('http://localhost/api/engine-site/v1/review/synthetic_order', body ? {
      method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    expect((await handleEngineOperator(request(), 'synthetic_order', { ...operatorPorts, parent: async () => ({ id: s.parent.id }) })).status).toBe(404);
    const inspected = await (await handleEngineOperator(request(), 'synthetic_order', operatorPorts)).json();
    expect(inspected).toMatchObject({ bookSha256: s.c.bookSha256, readiness: 'blocked', previousDecisionSha256: null });
    const command = await s.command('approve');
    expect((await handleEngineOperator(request({ ...command, actorId: 'forged_owner' }), 'synthetic_order', operatorPorts)).status).toBe(409);
    const accepted = await handleEngineOperator(request(command), 'synthetic_order', operatorPorts); expect(accepted.status).toBe(200); expect(await accepted.json()).toMatchObject({ status: 'ready' });
    const c = await s.context(); expect(await readEngineFamilyReady(s.db, c)).toBe(true);
    const history = await readEngineOperatorHistory(s.db, c.checkpoint.authority);
    expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ actorId: 'synthetic_guy', decision: 'approve', bookSha256: c.bookSha256 });
    expect(Date.parse(history[0].decidedAt)).toBeGreaterThan(0);
    expect((await handleEngineBookRead(new NextRequest('http://localhost/book'), 'synthetic_order', { ...s.ports, db: s.db, storage: () => s.storage, enabled: true, parent: async () => ({ id: s.parent.id }) })).status).toBe(200);
    expect(await s.deliver()).toBe('sent'); expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.send.mock.calls[0]).toEqual([{ to: 'parent@example.invalid', customerName: 'Synthetic', childName: 'סינתטי',
      readUrl: 'https://app.example.invalid/personal/orders/synthetic_order', pdfUrl: 'https://app.example.invalid/personal/orders/synthetic_order#pdf' }, 'book-ready/synthetic_order/engine_site_book/1']);
    const count = (await s.db.bookReadinessManifest.findMany()).length;
    await s.reconcile(); expect((await s.db.bookReadinessManifest.findMany()).length).toBe(count);
    expect(await s.deliver()).toBeNull(); expect(s.send).toHaveBeenCalledTimes(1); expect(s.fetchTts).toHaveBeenCalledTimes(9);
  }, 120_000);
  it('gate-off uses the same automatic pass, policy changes block stale sends, and off/on events are audited and replay-safe', async () => {
    const s = await setup(); await s.reconcile(); const original = (await s.db.bookReadinessManifest.findFirst())!.evidence as any;
    const policy = await readEngineLaunchPolicy(s.db), cmd = { idempotencyKey: 'synthetic_policy_off', expectedPolicySha256: policyDigest(policy), mode: 'off' as const, reason: 'Synthetic automatic mode' };
    const off = await changeEngineLaunchPolicy(s.db, cmd, 'synthetic_guy'); expect(off.changedBy).toBe('synthetic_guy');
    await s.reconcile(); expect(await readEngineFamilyReady(s.db, await s.context())).toBe(true);
    const pointer = (await s.db.bookReadiness.findFirst())!.currentManifestId!, passed = (await s.db.bookReadinessManifest.findUnique({ where: { id: pointer } }))!.evidence as any;
    expect(passed.automatic).toEqual(original.automatic); expect(await readEngineOperatorHistory(s.db, s.c.checkpoint.authority)).toEqual([]);
    const row = await s.claim();
    const required = await changeEngineLaunchPolicy(s.db, { ...cmd, mode: 'required', idempotencyKey: 'synthetic_policy_required', expectedPolicySha256: policyDigest(off) }, 'synthetic_guy');
    expect(await readEngineFamilyReady(s.db, await s.context())).toBe(false);
    expect(await processDelivery(s.db, row, { send: s.send, cas: (r, token, expiry, now) => casEngineClaimSendSlot(s.db, r, token, expiry, now, s.ports) })).toBe('delivery_blocked');
    expect(s.send).not.toHaveBeenCalled();
    await changeEngineLaunchPolicy(s.db, { ...cmd, idempotencyKey: 'synthetic_policy_off_again', expectedPolicySha256: policyDigest(required) }, 'synthetic_guy');
    await s.reconcile(); const rebound = await s.db.deliveryOutbox.findFirst(); expect(rebound!.id).toBe(row.id); expect(rebound!.dedupeKey).toBe(row.dedupeKey);
    await changeEngineLaunchPolicy(s.db, cmd, 'synthetic_guy'); expect((await readEngineLaunchPolicy(s.db)).revision).toBe('synthetic_policy_off_again');
    await expect(changeEngineLaunchPolicy(s.db, cmd, 'forged_actor')).rejects.toThrow('replay_conflict');
    expect(await s.deliver()).toBe('sent'); expect(s.send).toHaveBeenCalledTimes(1); expect(s.fetchTts).toHaveBeenCalledTimes(9);
  }, 120_000);
  it('rejects stale book approvals and binds audited approval to every delivered text/image/audio/PDF hash', async () => {
    const s = await setup(); await s.reconcile();
    const command = await s.command('approve');
    await expect(decideEngineBook(s.db, 'synthetic_order', { ...command, expectedBookSha256: 'f'.repeat(64) }, 'synthetic_guy', s.ports)).rejects.toThrow('changed');
    expect(await readEngineOperatorHistory(s.db, s.c.checkpoint.authority)).toEqual([]);
    await decideEngineBook(s.db, 'synthetic_order', command, 'synthetic_guy', s.ports);
    const c = await s.context(), artifact = await loadEnginePrivateAsset(s.db, c.checkpoint.outputs.materialized_book);
    const value = JSON.parse(s.objects.get(artifact.key)!.toString()); value.manifest.pdfSha256 = 'f'.repeat(64);
    s.objects.set(artifact.key, Buffer.from(JSON.stringify(value)));
    expect((await handleEngineBookRead(new NextRequest('http://localhost/book'), 'synthetic_order', { ...s.ports, db: s.db, storage: () => s.storage,
      enabled: true, parent: async () => ({ id: s.parent.id }) })).status).toBe(404);
    expect(await s.deliver()).toBe('lost_lease'); expect(s.send).not.toHaveBeenCalled();
  }, 120_000);
  it('detects changed private bytes before send, revokes the unsent intent and creates one durable refund liability', async () => {
    const s = await setup(); const policy = await readEngineLaunchPolicy(s.db);
    await changeEngineLaunchPolicy(s.db, { expectedPolicySha256: policyDigest(policy), idempotencyKey: 'synthetic_off', mode: 'off', reason: 'Synthetic' }, 'synthetic_guy');
    await s.reconcile(); const a = await loadEnginePrivateAsset(s.db, s.c.book.pages[3].image.assetId); s.objects.set(a.key, Buffer.from('changed'));
    expect(await s.deliver()).toBe('lost_lease'); expect(s.send).not.toHaveBeenCalled();
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))!.status).toBe('failed');
    expect((await s.db.exceptionCase.findMany()).length).toBe(1);
    await failEngineOrder(s.db, 'synthetic_order', 'engine_send_assets_changed'); await failEngineOrder(s.db, 'synthetic_order', 'engine_worker_failed');
    expect((await s.db.exceptionCase.findMany()).length).toBe(1); expect(await readEngineFamilyReady(s.db, await s.context())).toBe(false);
  }, 120_000);
  it('uses the existing PayMe refund fence and confirmed notice; terminal replay cannot create a second refund case', async () => {
    const s = await setup(); await s.reconcile(); await decideEngineBook(s.db, 'synthetic_order', await s.command('reject'), 'synthetic_guy', s.ports);
    const claimed = (await claimDueExceptionCases(s.db, new Date(Date.now() + 1000), 1))[0]; expect(claimed.status).toBe('refund_pending'); expect(claimed.scope).toBe(ENGINE_BOOK_SCOPE);
    let saleState: 'paid' | 'refunded' = 'paid';
    const query = vi.fn(async () => ({ state: saleState, rawStatus: saleState })), physicalRefund = vi.fn(async () => ({ state: 'pending' as const, providerActionId: 'synthetic_refund' }));
    const notice = vi.fn(async () => ({ providerMessageId: 'synthetic_notice' }));
    const refund = vi.fn((...[order, key, prior, extra]: Parameters<typeof refundOrderPayment>) => refundOrderPayment(order, key, prior, { ...extra, queryPaymeSale: query, refundPaymeSale: physicalRefund }));
    expect(await processExceptionCase(s.db, claimed, { refund, refundNotice: notice })).toBe('refund_pending');
    expect(physicalRefund).toHaveBeenCalledTimes(1); expect(notice).not.toHaveBeenCalled();
    const next = (await claimDueExceptionCases(s.db, new Date(Date.now() + 300_000), 1))[0];
    expect(await processExceptionCase(s.db, next, { refund, refundNotice: notice })).toBe('refund_pending');
    expect(physicalRefund).toHaveBeenCalledTimes(1); expect(notice).not.toHaveBeenCalled();
    saleState = 'refunded'; const confirmed = (await claimDueExceptionCases(s.db, new Date(Date.now() + 600_000), 1))[0];
    expect(await processExceptionCase(s.db, confirmed, { refund, refundNotice: notice })).toBe('resolved');
    expect(physicalRefund).toHaveBeenCalledTimes(1); expect(notice).toHaveBeenCalledTimes(1);
    expect((await s.db.refundAttempt.findFirst())!.status).toBe('confirmed');
    const order = await s.db.order.findUnique({ where: { id: 'synthetic_order' } });
    await refundOrderPayment({ ...order!, payment: null }, 'refund/another_scope_case', null,
      { refundFence: prismaRefundFence(s.db), queryPaymeSale: query, refundPaymeSale: physicalRefund });
    expect(physicalRefund).toHaveBeenCalledTimes(1); expect(await s.db.refundAttempt.findMany()).toHaveLength(1);
    await failEngineOrder(s.db, 'synthetic_order', 'engine_worker_failed'); await s.reconcile();
    expect(await s.db.exceptionCase.findMany()).toHaveLength(1); expect((await s.db.exceptionCase.findFirst())!.status).toBe('resolved');
    expect(await s.claim()).toBeUndefined(); expect(await readEngineFamilyReady(s.db, await s.context())).toBe(false);
  }, 120_000);
  it('an ambiguous personal email cannot replay through a changed launch gate or legacy reissue/recovery', async () => {
    const s = await setup(), policy = await readEngineLaunchPolicy(s.db);
    const off = await changeEngineLaunchPolicy(s.db, { expectedPolicySha256: policyDigest(policy), idempotencyKey: 'synthetic_off', mode: 'off', reason: 'Synthetic' }, 'synthetic_guy');
    await s.reconcile(); const row = await s.claim(), now = new Date();
    await fencedOutboxTerminalWithException(s.db, { row, token: row.attempts, kind: 'send_ambiguous', reason: 'synthetic_unknown_send', now,
      outboxData: { status: 'failed', failureClass: 'send_ambiguous', sendAttempted: true, firstSendAttemptAt: now, leaseExpiresAt: null } });
    await changeEngineLaunchPolicy(s.db, { expectedPolicySha256: policyDigest(off), idempotencyKey: 'synthetic_required', mode: 'required', reason: 'Synthetic' }, 'synthetic_guy');
    const exception = (await claimDueExceptionCases(s.db, new Date(Date.now()+1000),1))[0], replay = vi.fn(), redrive = vi.fn();
    expect(await processExceptionCase(s.db, exception, { replayEmail: replay, redriveGeneration: redrive,
      personalDeliveryAllowed: async () => readEngineFamilyReady(s.db, await s.context()) })).toBe('retry_scheduled');
    expect(replay).not.toHaveBeenCalled(); expect(redrive).not.toHaveBeenCalled(); expect(await s.db.deliveryOutbox.findMany()).toHaveLength(1);
  }, 120_000);
  it('never upgrades a synthetic summary to real engine admission or lets an approve override a raw-evidence hold', async () => {
    const s = await setup(); await expect(admitEngineBookEvidence(s.db, s.storage, s.c)).rejects.toThrow('engine_readmission');
    expect((await reconcileEngineBook(s.db, 'synthetic_order', { storage: s.storage, origin: s.ports.origin })).status).toBe('failed');
    await expect(decideEngineBook(s.db, 'synthetic_order', await s.command('approve'), 'synthetic_guy', s.ports)).rejects.toThrow('held');
    expect(await s.db.exceptionCase.findMany()).toHaveLength(1); expect(s.fetchTts).toHaveBeenCalledTimes(9); expect(s.send).not.toHaveBeenCalled();
  }, 120_000);
  it('a cap stop enters the same failure/refund path without another provider call or a quality downgrade', async () => {
    const s = await engineTestDb(); stores.push(s); const policy: EngineSpendPolicy = { version: 'engine-site-spend-policy/v1', sourceRevision: 'a'.repeat(40),
      maximumMicroUsd: 1_300_000, maximumCalls: 200, approvalReference: 'SYNTHETIC_ONLY', approvedBy: 'synthetic', approvedAt: '2026-11-04T00:00:00.000Z', paidProviderActivation: 'owner_approved_live_personal_orders' };
    await startEnginePersonalJob(s.db, 'synthetic_order', policy);
    const objects = new Map<string, Buffer>(), storage = { put: async (k: string, b: Buffer) => { objects.set(k,b); }, read: async (k: string) => objects.get(k)!, sign: async () => '' };
    const execute = vi.fn(async () => ({ kind: 'completed' as const, result: { output: {}, raw: {}, estimatedMicroUsd: 1_000_000 } }));
    const recipe = async (r: any) => { for (const step of ['page_0_0','page_1_0']) { const wire = { step, quality: r.checkpoint.authority.imageQuality };
      await r.call({ wire, requiredMs: 1000, call: { step, wireSha256: canonicalHash(wire), maximumMicroUsd: engineRecipeSteps().find(s=>s.id===step)!.maximumMicroUsd }, execute }); } };
    const invoke = () => runEngineDurableInvocation(s.db, 'synthetic_order', { executor: 'chunk', storage, recipe, assertAdmission: async () => {} });
    expect((await invoke()).kind).toBe('progress'); expect((await invoke()).kind).toBe('held'); expect(execute).toHaveBeenCalledTimes(1);
    expect(await reconcileEngineBook(s.db, 'synthetic_order', { storage, origin: 'https://app.example.invalid' })).toMatchObject({ status: 'failed' });
    expect((await s.db.exceptionCase.findFirst())!.status).toBe('refund_pending');
    expect(parseEngineCheckpoint((await s.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } }))!.pipelineCache).authority.imageQuality).toBe('low');
  }, 120_000);
});
