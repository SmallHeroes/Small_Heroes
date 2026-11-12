import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { reviewedPersonalBookRequestSchema } from '@/lib/personal-wizard/contract';
import type { PersonalWizardOptions } from '@/lib/personal-wizard/options';
import { acceptPersonalBookRequest } from '@/lib/personal-wizard/request-acceptance';
import { ENGINE_SITE_PROTOCOL, engineOrderAuthoritySchema, engineSiteFail, type EngineOrderAuthority } from './contract';
import { ENGINE_SITE_LAUNCH_OFFER } from './offer-definition';
import { engineSiteCheckoutPricing } from './offer';
import { registerEngineOrderAuthority } from './order-meter';
import { assertEnginePrivateDatabase } from './private-assets';
import { engineOrderSteps, engineProfileAuthority, enginePolicyDigest, type EngineSpendPolicy } from './platform-policy';
import type { EngineCheckpoint } from './durable-worker';
import { engineOrderPaymentAccepted, engineQaRequired, engineQaScope, isEngineQaOrder, isEngineQaSessionId } from './qa-order-policy';

export async function loadEngineOrderSnapshot(db: PrismaClient, orderId: string) {
  const qa = engineQaScope();
  if (engineQaRequired() && !qa) engineSiteFail('engine_qa_order_scope_required');
  await assertEnginePrivateDatabase(db);
  const order = await db.order.findUnique({ where: { id: orderId }, include: { wizardSession: true } });
  if (!order || order.frozenProductVersion !== ENGINE_SITE_PROTOCOL || !order.userId || !order.wizardSession)
    engineSiteFail('engine_personal_order_required');
  if (qa ? !isEngineQaOrder(qa, order, order.wizardSession.sessionId)
    : isEngineQaSessionId(order.wizardSession.sessionId)) engineSiteFail('engine_qa_order_scope_required');
  engineSiteCheckoutPricing(order);
  const record = z.object({ version: z.literal(ENGINE_SITE_PROTOCOL), ownerId: z.string(), inputSha256: z.string().length(64),
    requestSha256: z.string().length(64), optionsSha256: z.string().length(64), request: reviewedPersonalBookRequestSchema,
    options: z.unknown(), offer: z.unknown(), offerSha256: z.string().length(64), imageQuality: z.literal(ENGINE_SITE_LAUNCH_OFFER.imageQuality),
    appearance: z.discriminatedUnion('kind', [z.object({ kind: z.literal('description'), description: z.string() }).strict(),
      z.object({ kind: z.literal('private_photo'), assetId: z.string().uuid() }).strict()]),
    photoBytes: z.object({ sha256: z.string().length(64), bytes: z.number().int().positive() }).strict().optional(),
    fictionalQa: z.literal(true).optional(),
  }).strict().parse(order.wizardSession.data);
  const { inputSha256, ...snapshot } = record;
  if (qa ? snapshot.fictionalQa !== true || snapshot.appearance.kind !== 'description' ||
      snapshot.request.appearance.photo !== 'none' || snapshot.request.bookOptions.voiceId !== order.selectedVoice
    : snapshot.fictionalQa === true) engineSiteFail('engine_qa_order_scope_required');
  const options = snapshot.options as PersonalWizardOptions;
  const accepted = acceptPersonalBookRequest(snapshot.request, options);
  if (!accepted.ok || accepted.containsFixtureData || snapshot.ownerId !== order.userId || canonicalHash(snapshot) !== inputSha256 ||
      inputSha256 !== order.storySourceHash || snapshot.optionsSha256 !== options.fingerprint || accepted.requestId !== snapshot.requestSha256 ||
      canonicalHash(snapshot.offer) !== snapshot.offerSha256 || snapshot.offerSha256 !== canonicalHash(ENGINE_SITE_LAUNCH_OFFER) ||
      snapshot.appearance.kind === 'private_photo' && !snapshot.photoBytes) engineSiteFail('engine_order_snapshot_changed');
  return { order, snapshot: { ...snapshot, options }, inputSha256 };
}

export async function startEnginePersonalJob(db: PrismaClient, orderId: string, policy: EngineSpendPolicy) {
  const { order, snapshot, inputSha256 } = await loadEngineOrderSnapshot(db, orderId);
  if (!['paid', 'generating'].includes(order.status) || !engineOrderPaymentAccepted(order, order.wizardSession?.sessionId) ||
      order.deliveryHoldReason !== null || order.manualReviewRequired) engineSiteFail('engine_personal_payment_required');
  const authority: EngineOrderAuthority = engineOrderAuthoritySchema.parse({ version: ENGINE_SITE_PROTOCOL, orderId,
    requestSha256: inputSha256, optionsSha256: snapshot.optionsSha256,
    offer: { id: ENGINE_SITE_LAUNCH_OFFER.id, revisionSha256: snapshot.offerSha256 }, engine: 'native-cde-book/v1',
    sourceRevision: policy.sourceRevision, policySha256: enginePolicyDigest(policy), purpose: 'customer', imageQuality: snapshot.imageQuality,
    ...engineProfileAuthority(policy),
    narrativePages: ENGINE_SITE_LAUNCH_OFFER.narrativePages, entitlements: { narration: true, pdf: true }, budget: {
      maximumMicroUsd: policy.maximumMicroUsd, maximumCalls: policy.maximumCalls, approvalReference: policy.approvalReference,
      approvedBy: policy.approvedBy, approvedAt: policy.approvedAt, steps: engineOrderSteps(policy),
    } });
  await registerEngineOrderAuthority(db, authority);
  const result = await db.$transaction(async tx => {
    const locked = await tx.$queryRaw<Array<{ status: string; deliveryHoldReason: string | null }>>`
      SELECT "status"::text AS status, "deliveryHoldReason" FROM "Order" WHERE id=${orderId} FOR UPDATE`;
    if (locked.length !== 1 || !['paid', 'generating'].includes(locked[0].status) || locked[0].deliveryHoldReason !== null)
      engineSiteFail('engine_personal_order_changed');
    const existing = await tx.generationJob.findUnique({ where: { orderId } });
    if (existing) {
      const cache = existing.pipelineCache as unknown as { engineSite?: EngineCheckpoint };
      if (canonicalHash(cache.engineSite?.authority) !== canonicalHash(authority)) engineSiteFail('engine_personal_job_changed');
      return { started: ['pending', 'running', 'done'].includes(existing.status), created: false };
    }
    const checkpoint: EngineCheckpoint = { version: 'engine-site-job/v1', authority, ownerId: snapshot.ownerId,
      draftId: snapshot.request.draftId, snapshotSha256: inputSha256, phase: 'story', calls: {}, outputs: {}, waiting: null };
    await tx.generationJob.create({ data: { orderId, currentStage: 'engine_site_story', status: 'pending', generationVersion: 2,
      quality: authority.imageQuality, model: authority.engine, provider: 'engine-site/v1',
      pipelineCache: { engineSite: checkpoint } as unknown as Prisma.InputJsonValue } });
    await tx.order.update({ where: { id: orderId }, data: { status: 'generating' } });
    return { started: true, created: true };
  });
  return { ...result, orderId };
}
