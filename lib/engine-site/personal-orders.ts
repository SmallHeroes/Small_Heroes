import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { resolvePersonalWizardOptions, type PersonalWizardOptions } from '@/lib/personal-wizard/options';
import { acceptPersonalBookRequest } from '@/lib/personal-wizard/request-acceptance';
import { ENGINE_SITE_PROTOCOL, engineSiteFail } from './contract';
import { ENGINE_SITE_LAUNCH_OFFER as offer } from './offer-definition';
import { engineOrderInputSchema } from './order-input';
import { assertEnginePrivateDatabase } from './private-assets';

/** Short remains eight engine beats. The UI uses the offer's eight story pages, never the old spread display count. */
export function resolveEngineWizardOptions(root: string = process.cwd()): PersonalWizardOptions {
  const options = resolvePersonalWizardOptions(root);
  const lengths = options.lengths.filter(length => length.id === 'short');
  return { ...options, lengths, fingerprint: canonicalHash({ version: 'engine-site-options/v1',
    admittedOptions: options.fingerprint, lengths, offer }) };
}
export function engineOrderIntakeEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.ENGINE_SITE_ORDER_INTAKE_ENABLED === 'true';
}
export type EngineParent = { id: string; email: string; name: string | null };

export function prepareEngineOrder(input: unknown, parent: EngineParent, options: PersonalWizardOptions) {
  const parsed = engineOrderInputSchema.safeParse(input);
  if (!parsed.success) engineSiteFail('engine_order_input_invalid');
  const data = parsed.data;
  if (data.optionsFingerprint !== options.fingerprint) engineSiteFail('engine_order_options_changed');
  const accepted = acceptPersonalBookRequest(data.request, options);
  if (!accepted.ok || accepted.containsFixtureData) engineSiteFail('engine_order_request_invalid');
  if (data.request.bookOptions.lengthId !== 'short' || !data.request.bookOptions.voiceId)
    engineSiteFail('engine_order_launch_options_required');
  if (data.appearance.kind === 'description' && data.request.appearance.photo !== 'none')
    engineSiteFail('engine_order_photo_not_uploaded');
  const snapshot = { version: ENGINE_SITE_PROTOCOL, ownerId: parent.id,
    requestSha256: accepted.requestId, optionsSha256: options.fingerprint,
    request: accepted.canonical, options, appearance: data.appearance,
    offer, offerSha256: canonicalHash(offer), imageQuality: offer.imageQuality };
  return { snapshot, inputSha256: canonicalHash(snapshot),
    sessionId: `engine-site-order/v1/${canonicalHash({ owner: parent.id, draft: data.request.draftId })}` };
}

/** Unique session row + row lock serialize identical retries; the stored snapshot is never overwritten. */
export async function createEnginePersonalOrder(db: PrismaClient, input: unknown, parent: EngineParent,
  options: PersonalWizardOptions, verifyPrivatePhoto?: (tx: Prisma.TransactionClient, assetId: string, draftId: string) => Promise<{ sha256: string; bytes: number }>) {
  const prepared = prepareEngineOrder(input, parent, options);
  return db.$transaction(async tx => {
    await assertEnginePrivateDatabase(tx);
    let snapshot: typeof prepared.snapshot & { photoBytes?: { sha256: string; bytes: number } } = prepared.snapshot;
    const { sessionId } = prepared;
    if (snapshot.appearance.kind === 'private_photo') {
      if (!verifyPrivatePhoto) engineSiteFail('engine_order_private_photo_unavailable');
      const photoBytes = await verifyPrivatePhoto(tx, snapshot.appearance.assetId, snapshot.request.draftId);
      snapshot = { ...snapshot, photoBytes: { sha256: photoBytes.sha256, bytes: photoBytes.bytes } };
    }
    const inputSha256 = canonicalHash(snapshot);
    const session = await tx.wizardSession.upsert({ where: { sessionId }, update: {}, create: {
      sessionId, data: { ...snapshot, inputSha256 } as unknown as Prisma.InputJsonValue,
    } });
    await tx.$queryRaw`SELECT "id" FROM "WizardSession" WHERE "id" = ${session.id} FOR UPDATE`;
    if (canonicalHash(session.data) !== canonicalHash({ ...snapshot, inputSha256 }))
      engineSiteFail('engine_order_draft_already_bound');
    const existing = await tx.order.findUnique({ where: { wizardSessionId: session.id } });
    if (existing) {
      if (existing.userId !== parent.id || existing.storySourceHash !== inputSha256 || existing.frozenProductVersion !== ENGINE_SITE_PROTOCOL)
        engineSiteFail('engine_order_existing_binding_mismatch');
      return { orderId: existing.id, inputSha256, replay: true };
    }
    const order = await tx.order.create({ data: {
      status: 'draft', userId: parent.id, customerEmail: parent.email,
      customerName: parent.name?.trim() || parent.email,
      wizardSessionId: session.id, childName: snapshot.request.child.name,
      childAge: snapshot.request.child.age, childGender: snapshot.request.child.address,
      childTraits: [], topic: 'personal_live', challengeItems: [], outcomeItems: [], helperItems: [],
      avoidItems: snapshot.request.avoid, storyLength: 'short', storyDirection: 'personal_live',
      childImageUrl: null, illustrationStyle: 'pencil_watercolor',
      audioEnabled: offer.narration, pdfEnabled: offer.pdf, selectedVoice: snapshot.request.bookOptions.voiceId,
      videoEnabled: false, bundleEnabled: false, basePrice: offer.priceAgorot,
      addonsPrice: offer.addonsPriceAgorot, totalPrice: offer.priceAgorot,
      frozenProductVersion: ENGINE_SITE_PROTOCOL, expectedPageCount: offer.narrativePages,
      storySourceHash: inputSha256, selectionFilename: null,
    } });
    return { orderId: order.id, inputSha256, replay: false };
  });
}
