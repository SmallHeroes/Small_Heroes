/**
 * POST /api/orders — Create order from wizard data
 * File: app/api/orders/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { computePricing } from '../../../backend/config/wizard';
import { findVoiceById } from '../../../backend/config/voices';
import { mapStyleToDatabaseValue } from '../../../lib/styles';
import { assertOrderStyleSellable } from '../../../lib/image-engine-guard';
import { enforceRateLimit, enforceSameOrigin } from '../../../lib/request-security';
import { prisma } from '../../../lib/prisma';
import { storeImageFromDataUrl } from '../../../lib/image-storage';
import { resolveUserFromRequest } from '../../../lib/auth-session';
import {
  buildPersistedCharacterAnchorsJson,
  type CategoryAnswer,
  type PhotoQualityMeta,
} from '../../../lib/orderMeta';
import {
  enforceMvpOrderSlot,
  MvpMatrixValidationError,
} from '../../../backend/config/mvp-story-matrix';
import {
  resolveStoryProductTruth,
  StoryProductResolutionError,
} from '../../../backend/providers/story-product-resolver';
import { mergeOriginalChildPhotoUrlIntoAnchors } from '../../../lib/child-photo-deletion';
import { buildFrozenStoryProductTruth } from '../../../lib/generation-pipeline/frozen-product-truth';
import {
  OrderVisualPackageAuthorityError,
  requireOrderVisualPackageAuthority,
} from '../../../lib/generation-pipeline/order-visual-package-authority';
import {
  assertReleaseV1OperationalAdmission,
  parseWizardProductBindingV1,
  RELEASE_V1_PROTOCOL,
  ReleaseV1ContinuityError,
  requireExpectedWizardProductBinding,
  type WizardProductBindingV1,
} from '../../../lib/generation-pipeline/release-v1-continuity';
import { canonicalJsonDigest } from '../../../lib/visual-package/integrity';

const RELEASE_V1_ORDER_CLAIM_TTL_MS = 10 * 60_000;
const RELEASE_V1_ORDER_CLAIM_KEYS = [
  'binding',
  'bindingDigest',
  'claimedAt',
  'phase',
  'token',
  'version',
] as const;

type ReleaseV1OrderClaim = {
  version: 'release-v1-order-claim/v1';
  binding: WizardProductBindingV1;
  bindingDigest: string;
  token: string;
  claimedAt: string;
  phase: 'claimed' | 'processing';
};

function releaseV1OrderClaimData(
  binding: WizardProductBindingV1,
  token: string,
  claimedAt: Date,
  phase: ReleaseV1OrderClaim['phase'],
): Prisma.InputJsonObject {
  return {
    version: 'release-v1-order-claim/v1',
    binding: binding as unknown as Prisma.InputJsonObject,
    bindingDigest: canonicalJsonDigest(binding),
    token,
    claimedAt: claimedAt.toISOString(),
    phase,
  };
}

function parseReleaseV1OrderClaim(
  data: unknown,
  binding: WizardProductBindingV1,
): ReleaseV1OrderClaim | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const keys = Object.keys(row).sort((left, right) => left.localeCompare(right));
  if (
    JSON.stringify(keys) !==
    JSON.stringify(
      [...RELEASE_V1_ORDER_CLAIM_KEYS].sort((left, right) => left.localeCompare(right)),
    )
  ) {
    return null;
  }
  if (
    row.version !== 'release-v1-order-claim/v1' ||
    (row.phase !== 'claimed' && row.phase !== 'processing') ||
    typeof row.token !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(row.token) ||
    typeof row.claimedAt !== 'string'
  ) {
    return null;
  }
  const claimedAt = new Date(row.claimedAt);
  if (
    !Number.isFinite(claimedAt.getTime()) ||
    claimedAt.toISOString() !== row.claimedAt
  ) {
    return null;
  }
  try {
    const embeddedBinding = parseWizardProductBindingV1(row.binding);
    const expectedDigest = canonicalJsonDigest(binding);
    if (
      canonicalJsonDigest(embeddedBinding) !== expectedDigest ||
      row.bindingDigest !== expectedDigest
    ) {
      return null;
    }
    return row as unknown as ReleaseV1OrderClaim;
  } catch {
    return null;
  }
}

const EXISTING_ORDER_AUTHORITY_SELECT = {
  id: true,
  totalPrice: true,
  selectionFilename: true,
  storySourceHash: true,
  illustrationStyle: true,
  visualPackageAuthority: true,
} satisfies Prisma.OrderSelect;

type ExistingOrderAuthority = Prisma.OrderGetPayload<{
  select: typeof EXISTING_ORDER_AUTHORITY_SELECT;
}>;

function existingOrderResponse(
  existingOrder: ExistingOrderAuthority,
  expectedBinding: WizardProductBindingV1 | null = null,
) {
  let releaseBinding: WizardProductBindingV1 | null = null;
  try {
    // Replay the historical Order's own immutable binding. A later current-locator
    // promotion must not turn an idempotent retry into a different product or a 409.
    requireOrderVisualPackageAuthority(existingOrder);
    if (expectedBinding) {
      releaseBinding = requireExpectedWizardProductBinding({
        order: existingOrder,
        expected: expectedBinding,
      });
    }
  } catch (error) {
    if (error instanceof OrderVisualPackageAuthorityError) {
      console.error(
        '[POST /api/orders] existing session package authority mismatch:',
        error.message,
      );
      return NextResponse.json(
        { error: 'order_visual_package_authority_conflict' },
        { status: 409 },
      );
    }
    throw error;
  }
  return NextResponse.json({
    orderId: existingOrder.id,
    totalPrice: Number(existingOrder.totalPrice) / 100,
    ...(releaseBinding ? { wizardProductBinding: releaseBinding } : {}),
  });
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeCategoryAnswers(raw: unknown): CategoryAnswer[] {
  if (!Array.isArray(raw)) return [];
  const out: CategoryAnswer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.question !== 'string' || typeof row.answer !== 'string') continue;
    const selectedQuickAnswers = Array.isArray(row.selectedQuickAnswers)
      ? row.selectedQuickAnswers
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    out.push({
      ...(typeof row.questionId === 'string' && row.questionId.trim()
        ? { questionId: row.questionId.trim() }
        : {}),
      question: row.question.trim(),
      answer: row.answer.trim(),
      ...(selectedQuickAnswers.length > 0 ? { selectedQuickAnswers } : {}),
    });
  }
  return out;
}

function normalizePhotoQuality(raw: unknown): PhotoQualityMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (row.status !== 'good' && row.status !== 'warning' && row.status !== 'blocked') return null;
  const faceCount = Number(row.faceCount);
  if (!Number.isFinite(faceCount) || faceCount < 0) return null;
  const reasonCodes = Array.isArray(row.reasonCodes)
    ? row.reasonCodes.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
    : [];
  return {
    status: row.status,
    faceCount,
    ...(Number.isFinite(Number(row.dominantFaceRatio))
      ? { dominantFaceRatio: Number(row.dominantFaceRatio) }
      : {}),
    reasonCodes,
  };
}

export async function handleOrderPost(
  req: NextRequest,
  options: { routeProtocol: 'legacy-route' | typeof RELEASE_V1_PROTOCOL },
) {
  try {
    const sameOriginError = enforceSameOrigin(req);
    if (sameOriginError) return sameOriginError;
    const rateLimitError = enforceRateLimit(req, {
      namespace: 'api-orders-post',
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;

    const body = await req.json();
    const releaseV1 = options.routeProtocol === RELEASE_V1_PROTOCOL;
    if (releaseV1) assertReleaseV1OperationalAdmission();
    const sessionUser = await resolveUserFromRequest(req);
    const { wizardData, sessionId } = body;
    const expectedBinding = releaseV1
      ? parseWizardProductBindingV1(body.wizardProductBinding)
      : null;

    if (!wizardData || !wizardData.child?.name || !wizardData.contact?.email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fast idempotent replay is deliberately before product resolution, photo persistence,
    // customer mutation, and current-locator reads. Once a session owns an Order, only that
    // Order's frozen authority may decide the replay. The post-upsert check below remains as
    // the concurrency fence for a session whose Order is created between this read and upsert.
    if (sessionId) {
      const existingSession = await prisma.wizardSession.findUnique({
        where: { sessionId },
        select: { order: { select: EXISTING_ORDER_AUTHORITY_SELECT } },
      });
      if (existingSession?.order) {
        return existingOrderResponse(existingSession.order, expectedBinding);
      }
    }

    const { child, topic, challenge, desiredOutcome, helpers, avoid, product, contact, familyContext } = wizardData;
    const w = wizardData as Record<string, unknown>;
    const bookName = typeof w.bookName === 'string' ? w.bookName.trim().slice(0, 60) : null;
    const dedication =
      typeof w.dedication === 'string' && w.dedication.trim().length > 0
        ? w.dedication.trim().slice(0, 300)
        : null;
    const storedCompanionId = toStringOrNull(w.companionCharacterId);
    const storedChallengeCategory = toStringOrNull(w.challengeCategory);
    const categoryAnswers = normalizeCategoryAnswers(w.categoryAnswers);
    const photoQuality = normalizePhotoQuality(w.photoQuality);

    // MVP matrix gate — derive companion from category; reject non-sellable slots (422).
    let matrixCompanionId = storedCompanionId;
    let matrixDirection = product?.direction;
    try {
      const enforced = enforceMvpOrderSlot({
        challengeCategory: storedChallengeCategory,
        clientDirection: product?.direction,
        clientCompanionId: storedCompanionId,
      });
      matrixCompanionId = enforced.companionId;
      matrixDirection = enforced.direction;
    } catch (error) {
      if (error instanceof MvpMatrixValidationError) {
        console.warn('[POST /api/orders] MVP matrix rejected:', error.message);
        return NextResponse.json({ error: error.message }, { status: 422 });
      }
      throw error;
    }

    const hasWizardMeta =
      Boolean(matrixCompanionId || storedChallengeCategory || categoryAnswers.length > 0 || photoQuality);
    const characterAnchorsPayload = hasWizardMeta
      ? (buildPersistedCharacterAnchorsJson(
          {},
          {
            ...(matrixCompanionId ? { companionCharacterId: matrixCompanionId } : {}),
            ...(storedChallengeCategory ? { challengeCategory: storedChallengeCategory } : {}),
            ...(categoryAnswers.length > 0 ? { categoryAnswers } : {}),
            ...(photoQuality ? { photoQuality } : {}),
          },
        ) as object)
      : undefined;

    const persistedIllustrationStyle = mapStyleToDatabaseValue(
      product?.illustrationStyle ?? 'soft_hand_drawn_storybook'
    );
    // A style must be sellable before it participates in package selection. This keeps the
    // resolver-selected package style and the persisted Order style in one namespace.
    try {
      assertOrderStyleSellable(persistedIllustrationStyle, 'order creation');
    } catch (err) {
      console.warn(`[POST /api/orders] ${(err as Error).message}`);
      return NextResponse.json(
        { error: 'illustration_style_not_available', message: 'הסגנון המבוקש עדיין לא זמין לרכישה' },
        { status: 400 }
      );
    }

    // Source of truth: direction/pages/price come from the story that will be
    // served (companion golden / v3-approved binding) — never from a guess.
    let resolvedProduct;
    try {
      resolvedProduct = resolveStoryProductTruth({
        companionId: matrixCompanionId,
        clientDirection: matrixDirection,
        legacyLength: product?.length,
        challengeCategory: storedChallengeCategory,
        illustrationStyle: persistedIllustrationStyle,
      });
    } catch (error) {
      if (error instanceof StoryProductResolutionError) {
        console.error('[POST /api/orders] product resolution failed:', error.message);
        return NextResponse.json({ error: error.message }, { status: error.httpStatus });
      }
      throw error;
    }
    const { storyLength, storyDirection, pages } = resolvedProduct;
    if (!releaseV1 && resolvedProduct.visualPackageAuthority) {
      return NextResponse.json(
        { error: 'release_v1_order_route_required' },
        { status: 409 },
      );
    }
    const frozenProductTruth = resolvedProduct.storyFile
      ? buildFrozenStoryProductTruth({
          storyFilePath: resolvedProduct.storyFile,
          expectedPageCount: pages,
          storyDirection,
        })
      : null;
    if (resolvedProduct.visualPackageAuthority) {
      if (!frozenProductTruth) {
        throw new Error(
          'Visual Package product is missing frozen Story Source truth',
        );
      }
      try {
        requireOrderVisualPackageAuthority({
          selectionFilename: frozenProductTruth.selectionFilename,
          storySourceHash: frozenProductTruth.storySourceHash,
          illustrationStyle: persistedIllustrationStyle,
          visualPackageAuthority: resolvedProduct.visualPackageAuthority,
        });
      } catch (error) {
        if (error instanceof OrderVisualPackageAuthorityError) {
          console.error(
            '[POST /api/orders] selected package authority is inconsistent:',
            error.message,
          );
          return NextResponse.json(
            { error: 'order_visual_package_authority_invalid' },
            { status: 500 },
          );
        }
        throw error;
      }
    }
    let releaseBinding: WizardProductBindingV1 | null = null;
    if (expectedBinding) {
      if (!resolvedProduct.visualPackageAuthority || !frozenProductTruth) {
        throw new ReleaseV1ContinuityError([
          'release/v1 product resolution did not produce a Visual Package',
        ]);
      }
      releaseBinding = requireExpectedWizardProductBinding({
        order: {
          selectionFilename: frozenProductTruth.selectionFilename,
          storySourceHash: frozenProductTruth.storySourceHash,
          illustrationStyle: persistedIllustrationStyle,
          visualPackageAuthority: resolvedProduct.visualPackageAuthority,
        },
        expected: expectedBinding,
      });
    }
    if (
      typeof product?.direction === 'string' &&
      product.direction.trim() &&
      product.direction.trim().toLowerCase() !== storyDirection
    ) {
      console.warn(
        `[POST /api/orders] client direction "${product.direction}" overridden by story truth "${storyDirection}" (source=${resolvedProduct.source})`
      );
    }
    const pricing = computePricing({
      length: storyLength,
      direction: storyDirection,
      audioEnabled: Boolean(product?.audioEnabled),
      pdfEnabled: Boolean(product?.pdfEnabled),
      bundleEnabled: Boolean(product?.bundleEnabled),
      videoEnabled: Boolean(product?.videoEnabled),
    });
    // Fail-CLOSED narration-voice gate: `selectedVoice` MUST exist in the backend registry
    // (backend/config/voices.ts → findVoiceById is the strict source of truth for producible voices). A stale/removed id
    // (e.g. a returning user whose persisted wizard state still holds a voice we later dropped) or any client-supplied
    // value must NOT enter a paid order — otherwise audio generation throws "Unknown voice" AFTER payment. Reject here.
    const requestedVoice = toStringOrNull(product?.selectedVoice);
    const audioWillGenerate = Boolean(
      product?.audioEnabled || product?.videoEnabled || product?.bundleEnabled
    );
    if (requestedVoice && !findVoiceById(requestedVoice)) {
      console.warn(`[POST /api/orders] rejected invalid/stale voice "${requestedVoice}"`);
      return NextResponse.json(
        { error: 'invalid_voice', message: 'הקול שנבחר אינו זמין. אנא בחרו קול מהרשימה.' },
        { status: 400 }
      );
    }
    if (audioWillGenerate && !requestedVoice) {
      console.warn('[POST /api/orders] rejected audio order with no narration voice selected');
      return NextResponse.json(
        { error: 'voice_required', message: 'יש לבחור קול לקריינות.' },
        { status: 400 }
      );
    }

    // The versioned session row is an expiring, exact-binding creation claim.
    // It serializes same-session A/B races before child-photo storage or any
    // customer/Order mutation. A crashed claim is recoverable after the TTL.
    let releaseClaimedSession: {
      id: string;
      token: string;
      data: Prisma.InputJsonObject;
    } | null = null;
    if (releaseV1) {
      if (!sessionId || typeof sessionId !== 'string') {
        return NextResponse.json(
          { error: 'release_v1_session_id_required' },
          { status: 400 },
        );
      }
      if (!releaseBinding) {
        throw new ReleaseV1ContinuityError(['release/v1 binding was not admitted']);
      }
      const claimToken = randomUUID();
      const claimData = releaseV1OrderClaimData(
        releaseBinding,
        claimToken,
        new Date(),
        'claimed',
      );
      try {
        const created = await prisma.wizardSession.create({
          data: { sessionId, data: claimData },
          select: { id: true, data: true },
        });
        releaseClaimedSession = {
          id: created.id,
          token: claimToken,
          data: claimData,
        };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
        const existing = await prisma.wizardSession.findUnique({
          where: { sessionId },
          select: {
            id: true,
            data: true,
            order: { select: EXISTING_ORDER_AUTHORITY_SELECT },
          },
        });
        if (!existing) {
          throw new ReleaseV1ContinuityError([
            'release/v1 session claim disappeared during conflict recovery',
          ]);
        }
        if (existing.order) {
          return existingOrderResponse(existing.order, releaseBinding);
        }
        const existingClaim = parseReleaseV1OrderClaim(existing.data, releaseBinding);
        if (!existingClaim) {
          throw new ReleaseV1ContinuityError([
            'wizard session is already claimed for another package binding',
          ]);
        }
        const claimedAt = Date.parse(existingClaim.claimedAt);
        if (Date.now() - claimedAt < RELEASE_V1_ORDER_CLAIM_TTL_MS) {
          return NextResponse.json(
            { error: 'release_v1_order_creation_in_progress' },
            { status: 409 },
          );
        }
        const reclaimed = await prisma.wizardSession.updateMany({
          where: {
            id: existing.id,
            data: { equals: existing.data as Prisma.InputJsonValue },
          },
          data: { data: claimData },
        });
        if (reclaimed.count !== 1) {
          return NextResponse.json(
            { error: 'release_v1_order_creation_in_progress' },
            { status: 409 },
          );
        }
        releaseClaimedSession = {
          id: existing.id,
          token: claimToken,
          data: claimData,
        };
      }

      const processingData = releaseV1OrderClaimData(
        releaseBinding,
        releaseClaimedSession.token,
        new Date(),
        'processing',
      );
      const ownership = await prisma.wizardSession.updateMany({
        where: {
          id: releaseClaimedSession.id,
          data: { equals: releaseClaimedSession.data },
        },
        data: { data: processingData },
      });
      if (ownership.count !== 1) {
        throw new ReleaseV1ContinuityError([
          'release/v1 Order creation claim was superseded before storage',
        ]);
      }
      releaseClaimedSession.data = processingData;
    }

    const uploadScopeId = `draft-${randomUUID()}`;

    const rawChildImage = toStringOrNull(child?.imageUrl);
    const isChildDataUrl = Boolean(rawChildImage?.startsWith('data:image/'));
    const canPersistChildReference =
      isChildDataUrl &&
      (photoQuality == null ||
        photoQuality.status === 'good' ||
        photoQuality.status === 'warning');
    const childImageUrl = canPersistChildReference && rawChildImage
      ? await (async () => {
          try {
            return await storeImageFromDataUrl({
              dataUrl: rawChildImage,
              orderId: uploadScopeId,
              assetPath: 'references/main-child',
            });
          } catch {
            return null;
          }
        })()
      : isChildDataUrl
        ? null
        : rawChildImage;

    const legacyParent1Name = toStringOrNull(familyContext?.parent1?.name);
    const legacyParent2Name = toStringOrNull(familyContext?.parent2?.name);
    const legacySiblingName = toStringOrNull(familyContext?.sibling?.name);
    const normalizedFamilyContext =
      legacyParent1Name || legacyParent2Name || legacySiblingName ? familyContext : null;
    const normalizedWizardData = {
      ...wizardData,
      ...(photoQuality ? { photoQuality } : {}),
      child: {
        ...child,
        imageUrl: childImageUrl || null,
      },
      familyContext: normalizedFamilyContext,
    };

    const persistedCharacterAnchors = mergeOriginalChildPhotoUrlIntoAnchors(
      characterAnchorsPayload ?? null,
      childImageUrl
    );

    const buildOrderCreateData = (
      customerId: string,
      wizardSessionId: string | null,
    ) => ({
        status: 'draft' as const,

        // Customer — use relation connect, not raw scalar customerId
        customer: { connect: { id: customerId } },
        customerEmail: contact.email,
        customerName: contact.name,
        ...(sessionUser ? { user: { connect: { id: sessionUser.user.id } } } : {}),

        // Child
        childName:        child.name,
        childAge:         child.age ? parseInt(child.age, 10) : null,
        childGender:      child.gender || null,
        childTraits:      child.traits || [],
        childSuperpower:  child.superpower || null,
        bookName:         bookName || null,
        dedication:       dedication || null,
        childImageUrl:    childImageUrl || null,
        familyContext:    normalizedFamilyContext,
        characterAnchors: persistedCharacterAnchors ?? Prisma.JsonNull,

        // Story
        topic,
        challengeItems: challenge.selected || [],
        challengeFree: challenge.freeText || null,
        outcomeItems: desiredOutcome.selected || [],
        outcomeFree: desiredOutcome.freeText || null,
        helperItems: helpers.selected || [],
        helperFree: helpers.freeText || null,
        avoidItems: avoid.selected || [],
        avoidFree: avoid.freeText || null,

        // Product
        storyLength,
        storyDirection,
        ...(frozenProductTruth ?? {}),
        ...(resolvedProduct.visualPackageAuthority
          ? {
              visualPackageAuthority:
                resolvedProduct.visualPackageAuthority as unknown as Prisma.InputJsonValue,
            }
          : {}),
        illustrationStyle: persistedIllustrationStyle,
        audioEnabled: product.audioEnabled,
        selectedVoice: requestedVoice,
        sleepMode: product.sleepMode || false,
        pdfEnabled: product.pdfEnabled,
        bundleEnabled: product.bundleEnabled || false,
        videoEnabled: Boolean(product.videoEnabled),

        // Pricing (stored in agorot)
        basePrice: pricing.basePrice * 100,
        addonsPrice: pricing.addonsPrice * 100,
        totalPrice: pricing.totalPrice * 100,

        // Wizard session — use relation connect only when a session exists
        ...(wizardSessionId
          ? { wizardSession: { connect: { id: wizardSessionId } } }
          : {}),
      });

    const successResponse = (orderId: string) => NextResponse.json({
      orderId,
      totalPrice: pricing.totalPrice,
      product: {
        direction: storyDirection,
        // BEATS — generation units; UI renders displayPages only.
        pages,
        displayPages: resolvedProduct.displayPages,
        basePrice: pricing.basePrice,
        source: resolvedProduct.source,
      },
      ...(releaseBinding ? { wizardProductBinding: releaseBinding } : {}),
    });

    if (releaseClaimedSession) {
      const releaseClaim = releaseClaimedSession;
      const releaseSessionData = {
        ...normalizedWizardData,
        releaseContinuity: {
          version: RELEASE_V1_PROTOCOL,
          binding: releaseBinding as unknown as Prisma.InputJsonObject,
        },
      } as Prisma.InputJsonObject;
      try {
        const persisted = await prisma.$transaction(async (transaction) => {
          const existingOrder = await transaction.order.findUnique({
            where: { wizardSessionId: releaseClaim.id },
            select: EXISTING_ORDER_AUTHORITY_SELECT,
          });
          if (existingOrder) {
            return { existingOrder, order: null };
          }
          const finalized = await transaction.wizardSession.updateMany({
            where: {
              id: releaseClaim.id,
              data: { equals: releaseClaim.data },
            },
            data: { data: releaseSessionData },
          });
          if (finalized.count !== 1) {
            throw new ReleaseV1ContinuityError([
              'release/v1 Order creation claim was superseded before commit',
            ]);
          }
          const customer = await transaction.customer.upsert({
            where: { email: contact.email },
            update: { name: contact.name },
            create: { email: contact.email, name: contact.name },
          });
          const order = await transaction.order.create({
            data: buildOrderCreateData(customer.id, releaseClaim.id),
          });
          return { existingOrder: null, order };
        });
        if (persisted.existingOrder) {
          return existingOrderResponse(persisted.existingOrder, expectedBinding);
        }
        if (!persisted.order) {
          throw new ReleaseV1ContinuityError([
            'release/v1 Order transaction produced no durable result',
          ]);
        }
        return successResponse(persisted.order.id);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const existing = await prisma.wizardSession.findUnique({
            where: { sessionId },
            select: { order: { select: EXISTING_ORDER_AUTHORITY_SELECT } },
          });
          if (existing?.order) {
            return existingOrderResponse(existing.order, expectedBinding);
          }
        }
        throw error;
      }
    }

    // Historical legacy route retains its existing non-transactional persistence shape.
    const customer = await prisma.customer.upsert({
      where: { email: contact.email },
      update: { name: contact.name },
      create: { email: contact.email, name: contact.name },
    });
    let wizardSession = null;
    if (sessionId) {
      wizardSession = await prisma.wizardSession.upsert({
        where: { sessionId },
        update: { data: normalizedWizardData },
        create: { sessionId, data: normalizedWizardData },
      });
      const existingOrder = await prisma.order.findUnique({
        where: { wizardSessionId: wizardSession.id },
        select: EXISTING_ORDER_AUTHORITY_SELECT,
      });
      if (existingOrder) {
        return existingOrderResponse(existingOrder, expectedBinding);
      }
    }
    const order = await prisma.order.create({
      data: buildOrderCreateData(customer.id, wizardSession?.id ?? null),
    });

    return successResponse(order.id);

  } catch (error) {
    if (error instanceof ReleaseV1ContinuityError) {
      console.warn('[POST /api/orders] release/v1 authority rejected:', error.message);
      return NextResponse.json(
        { error: error.code, reasons: error.reasons },
        { status: 409 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      String(error.message).includes('invalid input value for enum "IllustrationStyle"')
    ) {
      return NextResponse.json(
        { error: 'Database style enum is outdated (missing new illustration style values).' },
        { status: 500 }
      );
    }
    console.error('[POST /api/orders]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
