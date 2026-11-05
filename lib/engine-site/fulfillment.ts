import 'server-only';
import {closeEnginePaymentProofCases} from './payment-proof-alert';
import type { Prisma, PrismaClient, DeliveryOutbox } from '@prisma/client';
import { z } from 'zod';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { canonicalHash } from '@/lib/canonical-json';
import { enqueueDelivery, hashPayload, deliveryDedupeKey, type BookReadyPayload, type CasResult } from '@/lib/generation-chunked/delivery-outbox';
import { lockOrderForExceptionCase, openExceptionCase } from '@/lib/generation-chunked/exception-case';
import { bookDigest, authorityDigest, engineSiteFail, digestSchema } from './contract';
import { evaluateAutomaticAcceptance, evaluateLaunchDeliveryGate, launchDeliveryFenceDigest, policyDigest } from './delivery-gate';
import { readEngineOperatorHistoryInTx, recordEngineOperatorDecision } from './operator-review-store';
import { ensureEngineLaunchPolicy, readEngineLaunchPolicy } from './launch-policy';
import { inspectEngineOrderMeter, lockEngineOrder, requireRegisteredEngineAuthority } from './order-meter';
import { parseEngineCheckpoint } from './durable-worker';
import { admitEngineBookEvidence } from './readmission';
import { engineDeterministicFailure, recordEngineInfrastructureFault, engineRecoveryDue, clearEngineInfrastructureFault } from './failure-policy';
import { loadEnginePrivateAsset, readEnginePrivateBytes } from './private-assets';
import { decodeEngineAudio,validateEngineNarrationAudio } from './narration';
import { verifyEngineBookAsset } from './materialize';
import { loadEngineReaderBook, type EngineReaderContext } from './reader';
import type { EnginePrivateStorage } from './private-storage';
import { runAtomicOperation, hashOperationPayload } from '@/lib/generation-pipeline/atomic-operation';
import { readEngineOperatorHistory } from './operator-review-store';

import { ENGINE_BOOK_SCOPE, engineFulfillmentEnabled } from './lifecycle-config';
export { ENGINE_BOOK_SCOPE, engineFulfillmentEnabled } from './lifecycle-config';
export function engineSiteOrigin(value = process.env.NEXT_PUBLIC_APP_URL) {
  if (!value) engineSiteFail('engine_site_origin_required'); const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') engineSiteFail('engine_site_origin_invalid');
  return url.origin;
}
const automaticSchema = z.object({ version: z.literal('engine-site-automatic-acceptance/v1'), orderId: z.string(), authoritySha256: digestSchema,
  bookSha256: digestSchema, status: z.enum(['accepted', 'held']), holdReasons: z.array(z.string()) }).strict();
const evidenceSchema = z.object({ version: z.literal('engine-site-readiness/v1'), bookSha256: digestSchema, materializedAssetId: z.string().uuid(),
  automatic: automaticSchema, gateSha256: digestSchema, policySha256: digestSchema, inputVersion: z.number().int(),
  deliveryFenceVersion: z.number().int() }).strict();
type Tx = Prisma.TransactionClient;
const isOwnReviewHold = (reason: string | null) => reason === 'engine_site_hold:operator_review';
function publicationPayload(context: EngineReaderContext, origin: string): BookReadyPayload {
  const readUrl = `${origin}/personal/orders/${encodeURIComponent(context.order.id)}`;
  return { to: context.order.customerEmail, customerName: context.order.customerName || context.book.childName,
    childName: context.book.childName, readUrl, pdfUrl: `${readUrl}#pdf` };
}
async function currentBinding(tx: Tx, c: EngineReaderContext) {
  await lockEngineOrder(tx, c.order.id); await requireRegisteredEngineAuthority(tx, c.checkpoint.authority);
  const order = await tx.order.findUnique({ where: { id: c.order.id } }), job = await tx.generationJob.findUnique({ where: { orderId: c.order.id } });
  const checkpoint = parseEngineCheckpoint(job?.pipelineCache);
  if (!order || !job || order.userId !== c.checkpoint.ownerId || order.storySourceHash !== c.inputSha256 ||
      order.inputVersion !== c.order.inputVersion || checkpoint.outputs.materialized_book !== c.checkpoint.outputs.materialized_book ||
      authorityDigest(checkpoint.authority) !== authorityDigest(c.checkpoint.authority)) engineSiteFail('engine_fulfillment_inputs_changed');
  return { order, job, checkpoint };
}
/** Current policy, decision history, immutable book pointer and readiness are all checked under the same locks as send. */
async function familyReadyInTx(tx: Tx, c: EngineReaderContext, lockPolicy = true) {
  const sent = await tx.deliveryOutbox.findFirst({ where: { orderId: c.order.id, scope: ENGINE_BOOK_SCOPE, status: 'sent', sentAt: { not: null } } });
  const policy = sent ? null : await readEngineLaunchPolicy(tx, lockPolicy);
  const { order, job } = await currentBinding(tx, c);
  if (order.status !== 'ready' || order.manualReviewRequired || order.deliveryHoldReason !== null || order.paymentProvider !== 'payme' ||
      !order.paymeTransactionId || job.status !== 'done') return null;
  const delivered = await tx.deliveryOutbox.findFirst({ where: { orderId: order.id, scope: ENGINE_BOOK_SCOPE, status: 'sent', sentAt: { not: null } } });
  const readiness = await tx.bookReadiness.findUnique({ where: { orderId_scope: { orderId: order.id, scope: ENGINE_BOOK_SCOPE } } });
  if (readiness?.status !== 'passed' || !readiness.currentManifestId) return null;
  const manifest = await tx.bookReadinessManifest.findUnique({ where: { id: delivered?.manifestId ?? readiness.currentManifestId } });
  if (!manifest || manifest.orderId !== order.id || manifest.scope !== ENGINE_BOOK_SCOPE || manifest.status !== 'passed' || manifest.inputVersion !== order.inputVersion) return null;
  const evidence = evidenceSchema.parse(manifest.evidence);
  if (!delivered && !policy) return null;
  const gate = policy ? evaluateLaunchDeliveryGate({ authority: c.checkpoint.authority, manifest: c.book.manifest, automatic: evidence.automatic, policy,
    history: await readEngineOperatorHistoryInTx(tx, c.checkpoint.authority) }) : null;
  if ((!delivered && !gate?.eligible) || evidence.automatic.status !== 'accepted' || evidence.bookSha256 !== c.bookSha256 || evidence.materializedAssetId !== c.checkpoint.outputs.materialized_book ||
      (!delivered && (!policy || !gate || evidence.policySha256 !== policyDigest(policy) || evidence.gateSha256 !== launchDeliveryFenceDigest(gate))) ||
      evidence.deliveryFenceVersion !== order.deliveryFenceVersion || evidence.inputVersion !== order.inputVersion ||
      manifest.inputsHash !== canonicalHash(evidence)) return null;
  const liability = await tx.exceptionCase.findUnique({ where: { activeKey: `${order.id}:${ENGINE_BOOK_SCOPE}` } });
  if (liability?.status === 'refund_pending' || (liability?.resolution as { refundConfirmed?: boolean } | null)?.refundConfirmed) return null;
  return { order, manifest, evidence, gate };
}
export async function readEngineFamilyReady(db: PrismaClient, context: EngineReaderContext) {
  if (!engineFulfillmentEnabled()) return false;
  try { return !!await db.$transaction(tx => familyReadyInTx(tx, context)); } catch { return false; }
}
export type EngineFulfillmentPorts = { storage: EnginePrivateStorage; origin: string;
  /** Synthetic test seams; production always uses the real compiler/raw-evidence admission and media decoder. */
  admit?: typeof admitEngineBookEvidence; decodeAudio?: typeof decodeEngineAudio };
const admissionSchema = z.object({ version: z.literal('engine-site-admission/v1'), automatic: automaticSchema,
  bindings: z.array(z.object({ assetId: z.string().uuid(), sha256: digestSchema, bytes: z.number().int().positive() }).strict()).max(1000) }).strict();
async function admittedAutomatic(db: PrismaClient, c: EngineReaderContext, ports: EngineFulfillmentPorts) {
  const cp = c.checkpoint, inputHash = canonicalHash({ authority: authorityDigest(cp.authority), bookSha256: c.bookSha256,
    outputs: cp.outputs, calls: cp.calls }), operationKey = `engine-site/v1/${c.order.id}/admission/${c.bookSha256}`;
  const existing = await db.atomicOperationReceipt.findUnique({ where: { operationKey } });
  let admitted: z.infer<typeof admissionSchema>;
  if (existing) {
    if (existing.kind !== 'engine_site_admission_v1' || existing.payloadHash !== canonicalHash({ inputHash, admitted: (existing.result as any)?.value })) engineSiteFail('engine_readmission_admission_changed');
    const parsed = admissionSchema.safeParse((existing.result as { value?: unknown } | null)?.value);
    if (!parsed.success) engineSiteFail('engine_readmission_admission_changed'); admitted = parsed.data;
  } else {
    const meter = await inspectEngineOrderMeter(db, cp.authority);
    const pages = await (ports.admit ?? admitEngineBookEvidence)(db, ports.storage, c);
    for (const page of c.book.pages) {
      const image = await verifyEngineBookAsset(db, ports.storage, c, page.image, 'page'), metadata = await sharp(image).metadata();
      if (metadata.format !== 'png' || metadata.width !== 1024 || metadata.height !== 1536) engineSiteFail('engine_final_image_invalid');
      const audio = await verifyEngineBookAsset(db, ports.storage, c, page.audio, 'audio'); await (ports.decodeAudio ?? validateEngineNarrationAudio)(audio);
    }
    const pdf = await PDFDocument.load(await verifyEngineBookAsset(db, ports.storage, c, c.book.pdf, 'pdf'));
    if (pdf.getPageCount() !== 9) engineSiteFail('engine_final_pdf_invalid');
    const automatic = evaluateAutomaticAcceptance({ authority: cp.authority, manifest: c.book.manifest,
      frames: pages.map(p => ({ pageNumber: p.pageNumber, attempt: p.chosen })), prerequisiteHolds: meter.blocked ? ['engine_meter_blocked'] : [] });
    if (automatic.status !== 'accepted') engineSiteFail('engine_automatic_acceptance_held');
    const ids = [...new Set([...Object.values(cp.outputs), ...Object.values(cp.calls).flatMap(x => [x.requestAssetId, ...(x.resultAssetId ? [x.resultAssetId] : [])]),
      ...c.book.pages.flatMap(p => [p.image.assetId, p.audio.assetId]), c.book.pdf.assetId])];
    const bindings = [];
    for (const id of ids) {
      const asset = await loadEnginePrivateAsset(db, id);
      if (asset.ownerId !== cp.ownerId || asset.orderId !== c.order.id || asset.draftId !== cp.draftId) engineSiteFail('engine_readmission_asset_changed');
      await readEnginePrivateBytes(ports.storage, asset); bindings.push({ assetId: id, sha256: asset.sha256, bytes: asset.bytes });
    }
    admitted = admissionSchema.parse({ version: 'engine-site-admission/v1', automatic, bindings });
    admitted = admissionSchema.parse(await runAtomicOperation(db, { operationKey, orderId: c.order.id, kind: 'engine_site_admission_v1', payloadHash: canonicalHash({ inputHash, admitted }),
      beforeReceipt: async tx => { await currentBinding(tx, c); }, run: async () => admitted }));
  }
  const expected = [...new Set([...Object.values(cp.outputs), ...Object.values(cp.calls).flatMap(x => [x.requestAssetId, ...(x.resultAssetId ? [x.resultAssetId] : [])]),
    ...c.book.pages.flatMap(p => [p.image.assetId, p.audio.assetId]), c.book.pdf.assetId])].sort();
  if (canonicalHash(admitted.bindings.map(x => x.assetId).sort()) !== canonicalHash(expected) || admitted.automatic.orderId !== c.order.id ||
      admitted.automatic.bookSha256 !== c.bookSha256 || admitted.automatic.authoritySha256 !== authorityDigest(cp.authority) || admitted.automatic.status !== 'accepted')
    engineSiteFail('engine_readmission_admission_changed');
  for (const pin of admitted.bindings) {
    const asset = await loadEnginePrivateAsset(db, pin.assetId);
    if (asset.sha256 !== pin.sha256 || asset.bytes !== pin.bytes || asset.orderId !== c.order.id || asset.ownerId !== cp.ownerId)
      engineSiteFail('engine_readmission_asset_changed');
    await readEnginePrivateBytes(ports.storage, asset);
  }
  if ((await inspectEngineOrderMeter(db, cp.authority)).blocked) engineSiteFail('engine_automatic_acceptance_held');
  return admitted.automatic;
}
/** Reconcile a verified paid order whose webhook/redirect lost job creation. No provider call or key read here. */
export async function recoverEnginePaidJob(db: PrismaClient, orderId: string, start: (id: string) => Promise<unknown>, kick: (id: string) => void) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.frozenProductVersion !== 'engine-site/v1' || !['paid', 'generating'].includes(order.status) ||
      order.paymentProvider !== 'payme' || !order.paymeTransactionId || order.deliveryHoldReason !== null || order.manualReviewRequired)
    return { status: 'ineligible' as const };
  if (!await engineRecoveryDue(db,orderId,'paid_job')) return {status:'retry_scheduled' as const};
  if (!await db.generationJob.findUnique({ where: { orderId } })) {
    try { await start(orderId); } catch { /* Read back a possibly committed job before declaring a failure. */ }
  }
  const durable = await db.generationJob.findUnique({ where: { orderId } });
  if (!durable) return recordEngineInfrastructureFault(db, orderId, 'paid_job', Error('engine_paid_job_not_created'));
  kick(orderId); return { status: 'job_recovered' as const };
}
export async function failEngineOrder(db: PrismaClient, orderId: string, reason: string) {
  return runAtomicOperation(db, { operationKey: `engine-site/v1/${orderId}/terminal-failure`, orderId, kind: 'engine_site_terminal_failure_v1',
    payloadHash: hashOperationPayload({ orderId, version: 'engine-site-terminal-failure/v1' }),
    beforeReceipt: async tx => {
      const o = await lockEngineOrder(tx, orderId);
      if (o.deliveryHoldReason !== null && !o.deliveryHoldReason.startsWith('engine_site_hold:')) engineSiteFail('engine_terminal_external_hold');
    }, run: async tx => {
    const order = await lockEngineOrder(tx, orderId);
    if (order.deliveryHoldReason !== null && !order.deliveryHoldReason.startsWith('engine_site_hold:'))
      return { status: 'external_hold' as const };
    const lock = await lockOrderForExceptionCase(tx, orderId); if (!lock) engineSiteFail('engine_order_missing');
    await tx.order.update({ where: { id: orderId }, data: { status: 'failed', manualReviewRequired: true,
      deliveryHoldReason: 'engine_site_hold:failed', lastError: /^engine_[a-z_]+$/.test(reason) ? reason : 'engine_fulfillment_failed',
      deliveryFenceVersion: { increment: 1 } } });
    await closeEnginePaymentProofCases(tx,orderId);
    await tx.bookReadiness.updateMany({ where: { orderId, scope: ENGINE_BOOK_SCOPE }, data: { status: 'blocked', reason: 'engine_site_failed' } });
    await tx.generationJob.updateMany({ where: { orderId }, data: { status: 'failed', currentStage: 'engine_site_terminal', retryable: false,
      lastError: 'engine_site_failed', failedAt: new Date() } });
    await tx.deliveryOutbox.updateMany({ where: { orderId, sendAttempted: false, status: { in: ['scheduled', 'processing', 'delivery_blocked', 'superseded_by_manifest'] } },
      data: { status: 'delivery_revoked', attempts: { increment: 1 }, leaseExpiresAt: null, nextAttemptAt: null, lastError: 'engine_site_failed' } });
    // Only a genuinely paid new order has a refund liability. The existing provider fence owns external money actions.
    const priorCases = await tx.exceptionCase.findMany({ where: { orderId } });
    const existingLiability = priorCases.filter(c => !c.scope.startsWith('engine_site_extra_payment/')&&c.scope!=='engine_site_infrastructure'&&!c.scope.startsWith('engine_site_payment_proof/')).some(c => !['resolved', 'cancelled'].includes(c.status) || c.actionAttemptedAt !== null ||
      c.resolution && typeof c.resolution === 'object' && !Array.isArray(c.resolution) && c.resolution.refundConfirmed === true);
    if (!existingLiability && order.paymentProvider === 'payme' && order.paymeTransactionId) await openExceptionCase(tx, { orderId, scope: ENGINE_BOOK_SCOPE,
      kind: 'quality_failed', reason: /^engine_[a-z_]+$/.test(reason) ? reason : 'engine_fulfillment_failed',
      initialStatus: 'refund_pending', nextActionAt: new Date(), fenceExisting: true }, lock);
    return { status: 'failed' as const };
  } }).catch(error => { if (error?.code === 'engine_terminal_external_hold') return { status: 'external_hold' as const }; throw error; });
}
export async function reconcileEngineBook(db: PrismaClient, orderId: string, ports: EngineFulfillmentPorts) {
  try { return await reconcileEngineBookAttempt(db, orderId, ports); }
  catch (error) {
    return engineDeterministicFailure(error) ? failEngineOrder(db, orderId, 'engine_acceptance_evidence_failed')
      : recordEngineInfrastructureFault(db, orderId, 'fulfillment', error);
  }
}
async function reconcileEngineBookAttempt(db: PrismaClient, orderId: string, ports: EngineFulfillmentPorts) {
  await ensureEngineLaunchPolicy(db);
  const job = await db.generationJob.findUnique({ where: { orderId } });
  if (!job) return { status: 'preparing' as const };
  if (!await engineRecoveryDue(db, orderId, 'fulfillment')) return { status: 'retry_scheduled' as const };
  const checkpoint = parseEngineCheckpoint(job.pipelineCache);
  if (checkpoint.phase === 'held') return failEngineOrder(db, orderId, 'engine_worker_failed');
  if (job.status === 'failed') return recordEngineInfrastructureFault(db, orderId, 'fulfillment', Error('engine_generation_unknown_failure'));
  if (!['accept', 'done'].includes(checkpoint.phase)) return { status: 'preparing' as const };
  if(await db.deliveryOutbox.findFirst({where:{orderId,scope:ENGINE_BOOK_SCOPE,status:'processing',sendAttempted:true}}))
    return {status:'delivery_in_progress' as const};
  let c: EngineReaderContext;
  try { c = await loadEngineReaderBook(db, ports.storage, orderId); } catch (error) {
    return engineDeterministicFailure(error) ? failEngineOrder(db, orderId, 'engine_materialized_book_unavailable')
      : recordEngineInfrastructureFault(db, orderId, 'fulfillment', error);
  }
  // Successful send is an immutable publication. Policy changes only govern unsent books.
  if (await db.deliveryOutbox.findFirst({ where: { orderId, scope: ENGINE_BOOK_SCOPE, status: 'sent', sentAt: { not: null } } }))
    return { status: await readEngineFamilyReady(db, c) ? 'ready' as const : 'operator_reconciliation_required' as const, bookSha256: c.bookSha256 };
  const history = await readEngineOperatorHistory(db, c.checkpoint.authority);
  if (history[history.length - 1]?.decision === 'reject') return failEngineOrder(db, orderId, 'engine_operator_rejected');
  let automatic: ReturnType<typeof evaluateAutomaticAcceptance>;
  try { automatic = await admittedAutomatic(db, c, ports); }
  catch (error) {
    return engineDeterministicFailure(error) ? failEngineOrder(db, orderId, 'engine_acceptance_evidence_failed')
      : recordEngineInfrastructureFault(db, orderId, 'fulfillment', error);
  }
  if (automatic.status !== 'accepted') return failEngineOrder(db, orderId, 'engine_automatic_acceptance_held');
  // No provider action inside the transaction. A retry after ambiguous commit simply observes this same readiness.
  return db.$transaction(async tx => {
    const policy = await readEngineLaunchPolicy(tx, true), { order, job: freshJob, checkpoint: fresh } = await currentBinding(tx, c);
    // Once the external send has begun, its authorized manifest stays pinned until the send settles.
    // The actual send CAS and this guard share Order/policy locks, including the race after preflight.
    const inFlight=await tx.deliveryOutbox.findFirst({where:{orderId,scope:ENGINE_BOOK_SCOPE,status:'processing',sendAttempted:true}});
    if(inFlight)return {status:'delivery_in_progress' as const,bookSha256:c.bookSha256};
    const liability = await tx.exceptionCase.findUnique({ where: { activeKey: `${orderId}:${ENGINE_BOOK_SCOPE}` } });
    if (liability && !['resolved', 'cancelled'].includes(liability.status)) engineSiteFail('engine_fulfillment_liability_active');
    if (!['generating', 'paid', 'ready', 'needs_human_qa'].includes(order.status) ||
        (order.deliveryHoldReason !== null && !isOwnReviewHold(order.deliveryHoldReason)) ||
        order.manualReviewRequired && !isOwnReviewHold(order.deliveryHoldReason)) engineSiteFail('engine_fulfillment_order_held');
    if (freshJob.lockedBy && freshJob.leaseExpiresAt && freshJob.leaseExpiresAt > new Date()) engineSiteFail('engine_fulfillment_worker_busy');
    await clearEngineInfrastructureFault(tx,orderId,'fulfillment');
    const gate = evaluateLaunchDeliveryGate({ authority: fresh.authority, manifest: c.book.manifest, automatic, policy,
      history: await readEngineOperatorHistoryInTx(tx, fresh.authority) });
    if (gate.holdReasons.includes('operator_rejected')) engineSiteFail('engine_operator_rejected');
    const state = await tx.bookReadiness.findUnique({ where: { orderId_scope: { orderId, scope: ENGINE_BOOK_SCOPE } } });
    const prior = state?.currentManifestId ? await tx.bookReadinessManifest.findUnique({ where: { id: state.currentManifestId } }) : null;
    const evidenceWithoutFence = { version: 'engine-site-readiness/v1' as const, bookSha256: c.bookSha256,
      materializedAssetId: fresh.outputs.materialized_book, automatic, gateSha256: launchDeliveryFenceDigest(gate),
      policySha256: policyDigest(policy), inputVersion: order.inputVersion };
    const old = prior ? evidenceSchema.safeParse(prior.evidence) : null;
    if (old?.success && canonicalHash({ ...old.data, deliveryFenceVersion: 0 }) === canonicalHash({ ...evidenceWithoutFence, deliveryFenceVersion: 0 }) &&
        old.data.deliveryFenceVersion === order.deliveryFenceVersion && (gate.eligible ? order.status === 'ready' : isOwnReviewHold(order.deliveryHoldReason))) {
      // Rotate an unchanged review wait to the back of the free reconciler queue; it must not starve other books.
      await tx.generationJob.update({ where: { orderId }, data: { lastError: null } });
      const intent = await tx.deliveryOutbox.findUnique({ where: { dedupeKey: deliveryDedupeKey(orderId, ENGINE_BOOK_SCOPE, order.fulfillmentVersion) } });
      if (gate.eligible && !intent?.sendAttempted && prior) await enqueueDelivery(tx, { orderId, scope: ENGINE_BOOK_SCOPE, fulfillmentVersion: order.fulfillmentVersion,
        manifestId: prior.id, inputVersion: order.inputVersion, deliveryFenceVersion: order.deliveryFenceVersion, payload: publicationPayload(c, ports.origin), now: new Date() });
      return { status: gate.eligible ? 'ready' as const : 'operator_review' as const, bookSha256: c.bookSha256 };
    }
    const fence = order.deliveryFenceVersion + 1, evidence = evidenceSchema.parse({ ...evidenceWithoutFence, deliveryFenceVersion: fence });
    const latest = await tx.bookReadinessManifest.findFirst({ where: { orderId, scope: ENGINE_BOOK_SCOPE }, orderBy: { revision: 'desc' } });
    const manifest = await tx.bookReadinessManifest.create({ data: { orderId, scope: ENGINE_BOOK_SCOPE, revision: (latest?.revision ?? 0) + 1,
      status: gate.eligible ? 'passed' : 'blocked', inputsHash: canonicalHash(evidence), inputVersion: order.inputVersion,
      evidence: evidence as unknown as Prisma.InputJsonValue, reason: gate.eligible ? null : 'operator_review_required' } });
    await tx.bookReadiness.upsert({ where: { orderId_scope: { orderId, scope: ENGINE_BOOK_SCOPE } },
      create: { orderId, scope: ENGINE_BOOK_SCOPE, status: manifest.status, currentManifestId: manifest.id, reason: manifest.reason },
      update: { status: manifest.status, currentManifestId: manifest.id, reason: manifest.reason } });
    await tx.order.update({ where: { id: orderId }, data: { status: gate.eligible ? 'ready' : 'needs_human_qa',
      manualReviewRequired: !gate.eligible, deliveryHoldReason: gate.eligible ? null : 'engine_site_hold:operator_review', deliveryFenceVersion: fence } });
    fresh.phase = gate.eligible ? 'done' : 'accept';
    await tx.generationJob.update({ where: { orderId }, data: { status: gate.eligible ? 'done' : 'running', currentStage: gate.eligible ? 'done' : 'engine_site_review',
      completedAt: gate.eligible ? new Date() : null, textDone: true, imagesDone: true, audioDone: true, packaged: true,
      pipelineCache: { engineSite: fresh } as unknown as Prisma.InputJsonValue } });
    if (gate.eligible) {
      const existing = await tx.deliveryOutbox.findUnique({ where: { dedupeKey: deliveryDedupeKey(orderId, ENGINE_BOOK_SCOPE, order.fulfillmentVersion) } });
      if (existing?.sendAttempted && (!old?.success || old.data.bookSha256 !== c.bookSha256)) engineSiteFail('engine_changed_book_after_send');
      if (!existing?.sendAttempted) await enqueueDelivery(tx, { orderId, scope: ENGINE_BOOK_SCOPE, fulfillmentVersion: order.fulfillmentVersion,
        manifestId: manifest.id, inputVersion: order.inputVersion, deliveryFenceVersion: fence, payload: publicationPayload(c, ports.origin), now: new Date() });
    }
    return { status: gate.eligible ? 'ready' as const : 'operator_review' as const, bookSha256: c.bookSha256 };
  });
}
export async function decideEngineBook(db: PrismaClient, orderId: string, command: { expectedBookSha256: string; expectedPreviousDecisionSha256: string | null;
  expectedPolicySha256: string; idempotencyKey: string; decision: 'approve' | 'reject'; reason: string }, actorId: string, ports: EngineFulfillmentPorts) {
  await ensureEngineLaunchPolicy(db); const c = await loadEngineReaderBook(db, ports.storage, orderId), policy = await readEngineLaunchPolicy(db);
  if (policyDigest(policy) !== command.expectedPolicySha256 || c.bookSha256 !== command.expectedBookSha256) engineSiteFail('engine_operator_book_or_policy_changed');
  await recordEngineOperatorDecision(db, { ...command, authority: c.checkpoint.authority, manifest: c.book.manifest, policy, actorId }, {
    beforeOrderLock: async tx => { if (policyDigest(await readEngineLaunchPolicy(tx, true)) !== policyDigest(policy)) engineSiteFail('engine_operator_policy_changed'); },
    onFreshDecision: async tx => {
      const { order } = await currentBinding(tx, c);
      const liability = await tx.exceptionCase.findUnique({ where: { activeKey: `${orderId}:${ENGINE_BOOK_SCOPE}` } });
      if (liability || order.status === 'failed' || (order.deliveryHoldReason !== null && !isOwnReviewHold(order.deliveryHoldReason))) engineSiteFail('engine_operator_order_held');
      const sent = await tx.deliveryOutbox.findFirst({ where: { orderId, sendAttempted: true } });
      if (sent) engineSiteFail('engine_operator_delivery_started');
      await tx.order.update({ where: { id: orderId }, data: { status: 'needs_human_qa', manualReviewRequired: true,
        deliveryHoldReason: 'engine_site_hold:operator_review', deliveryFenceVersion: { increment: 1 } } });
      await tx.bookReadiness.updateMany({ where: { orderId, scope: ENGINE_BOOK_SCOPE }, data: { status: 'blocked', reason: 'engine_operator_decision_changed' } });
    } });
  if (command.decision === 'reject') return failEngineOrder(db, orderId, 'engine_operator_rejected');
  return reconcileEngineBook(db, orderId, ports);
}
export async function casEngineClaimSendSlot(db: PrismaClient, row: DeliveryOutbox, token: number, leaseExpiresAt: Date, now: Date, ports: EngineFulfillmentPorts): Promise<CasResult> {
  if (!engineFulfillmentEnabled() || row.scope !== ENGINE_BOOK_SCOPE) return 'delivery_blocked';
  let c: EngineReaderContext; try { c = await loadEngineReaderBook(db, ports.storage, row.orderId); }
  catch (error) {
    if (engineDeterministicFailure(error)) await failEngineOrder(db, row.orderId, 'engine_send_manifest_unavailable');
    else await recordEngineInfrastructureFault(db, row.orderId, 'send', error);
    return 'delivery_blocked';
  }
  try {
    const assets = [...c.book.pages.flatMap(p => [{ ref: p.image, kind: 'page' as const }, { ref: p.audio, kind: 'audio' as const }]), { ref: c.book.pdf, kind: 'pdf' as const }];
    for (let n = 0; n < assets.length; n += 6) await Promise.all(assets.slice(n, n + 6).map(a => verifyEngineBookAsset(db, ports.storage, c, a.ref, a.kind)));
  } catch (error) {
    if (engineDeterministicFailure(error)) await failEngineOrder(db, row.orderId, 'engine_send_assets_changed');
    else await recordEngineInfrastructureFault(db, row.orderId, 'send', error);
    return 'delivery_blocked';
  }
  return db.$transaction(async tx => {
    const ready = await familyReadyInTx(tx, c); if (!ready) return 'delivery_blocked';
    const current = await tx.deliveryOutbox.findUnique({ where: { id: row.id } });
    if (!current || current.status !== 'processing' || current.attempts !== token || !current.leaseExpiresAt || current.leaseExpiresAt <= now) return 'lost_lease';
    if (current.manifestId !== ready.manifest.id || current.inputVersion !== ready.order.inputVersion || current.deliveryFenceVersion !== ready.order.deliveryFenceVersion) return 'superseded_by_manifest';
    if (hashPayload(current.payload) !== row.payloadHash || current.payloadHash !== row.payloadHash ||
        hashPayload(publicationPayload(c, ports.origin)) !== row.payloadHash ||
        current.dedupeKey !== deliveryDedupeKey(row.orderId, ENGINE_BOOK_SCOPE, ready.order.fulfillmentVersion)) return 'delivery_blocked';
    await clearEngineInfrastructureFault(tx,row.orderId,'send');
    const moved = await tx.deliveryOutbox.updateMany({ where: { id: row.id, attempts: token, status: 'processing', payloadHash: row.payloadHash,
      manifestId: row.manifestId, inputVersion: row.inputVersion, deliveryFenceVersion: row.deliveryFenceVersion }, data: {
        sendAttempted: true, sendAttempts: { increment: 1 }, firstSendAttemptAt: current.firstSendAttemptAt ?? now, leaseExpiresAt } });
    return moved.count === 1 ? 'ok' : 'lost_lease';
  });
}
