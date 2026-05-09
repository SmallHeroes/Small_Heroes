/**
 * POST /api/orders — Create order from wizard data
 * File: app/api/orders/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { computePricing } from '../../../backend/config/wizard';
import { mapStyleToDatabaseValue } from '../../../lib/styles';
import { enforceRateLimit, enforceSameOrigin } from '../../../lib/request-security';
import { prisma } from '../../../lib/prisma';
import { storeImageFromDataUrl } from '../../../lib/image-storage';
import { resolveUserFromRequest } from '../../../lib/auth-session';
import {
  buildPersistedCharacterAnchorsJson,
  type CategoryAnswer,
  type PhotoQualityMeta,
} from '../../../lib/orderMeta';

type ExtraCharacterInput = {
  relation?: unknown;
  name?: unknown;
  description?: unknown;
  imageDataUrl?: unknown;
  imageUrl?: unknown;
  photoQuality?: unknown;
};

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRelation(value: string | null): string {
  if (!value) return 'other';
  if (['mother', 'father', 'brother', 'sister', 'other'].includes(value)) return value;
  return 'other';
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

async function persistCharacterImage(
  orderScopedId: string,
  index: number,
  payload: ExtraCharacterInput,
): Promise<string | null> {
  const directUrl = toStringOrNull(payload.imageUrl);
  if (directUrl && (directUrl.startsWith('https://') || directUrl.startsWith('http://'))) {
    return directUrl;
  }
  const fromPayload = toStringOrNull(payload.imageDataUrl);
  const dataUrl =
    fromPayload && fromPayload.startsWith('data:image/')
      ? fromPayload
      : directUrl && directUrl.startsWith('data:image/')
        ? directUrl
        : null;
  if (!dataUrl) return null;
  try {
    return await storeImageFromDataUrl({
      dataUrl,
      orderId: orderScopedId,
      assetPath: `references/additional-character-${index + 1}`,
    });
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
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
    const sessionUser = await resolveUserFromRequest(req);
    const { wizardData, sessionId } = body;

    if (!wizardData || !wizardData.child?.name || !wizardData.contact?.email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { child, topic, challenge, desiredOutcome, helpers, avoid, product, contact, familyContext } = wizardData;
    const w = wizardData as Record<string, unknown>;
    const bookName = typeof w.bookName === 'string' ? w.bookName.trim().slice(0, 60) : null;
    const storedCompanionId = toStringOrNull(w.companionCharacterId);
    const storedChallengeCategory = toStringOrNull(w.challengeCategory);
    const categoryAnswers = normalizeCategoryAnswers(w.categoryAnswers);
    const photoQuality = normalizePhotoQuality(w.photoQuality);
    const hasWizardMeta =
      Boolean(storedCompanionId || storedChallengeCategory || categoryAnswers.length > 0 || photoQuality);
    const characterAnchorsPayload = hasWizardMeta
      ? (buildPersistedCharacterAnchorsJson(
          {},
          {
            ...(storedCompanionId ? { companionCharacterId: storedCompanionId } : {}),
            ...(storedChallengeCategory ? { challengeCategory: storedChallengeCategory } : {}),
            ...(categoryAnswers.length > 0 ? { categoryAnswers } : {}),
            ...(photoQuality ? { photoQuality } : {}),
          },
        ) as object)
      : undefined;
    const pricing = computePricing(product);
    const persistedIllustrationStyle = mapStyleToDatabaseValue(
      product?.illustrationStyle ?? 'soft_hand_drawn_storybook'
    );
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

    const rawAdditionalCharacters = Array.isArray(familyContext?.additionalCharacters)
      ? familyContext.additionalCharacters
      : [];
    const trimmedAdditionalCharacters = rawAdditionalCharacters.slice(0, 2) as ExtraCharacterInput[];
    const persistedAdditionalCharacters = (
      await Promise.all(
        trimmedAdditionalCharacters.map(async (entry, index) => {
          const name = toStringOrNull(entry?.name);
          if (!name) return null;
          const relation = normalizeRelation(toStringOrNull(entry?.relation));
          const description = toStringOrNull(entry?.description);
          const entryPhotoQuality = normalizePhotoQuality(entry?.photoQuality);
          const imageUrl = entryPhotoQuality?.status === 'blocked'
            ? null
            : await persistCharacterImage(uploadScopeId, index, entry);
          return {
            relation,
            name,
            description: description || undefined,
            imageUrl: imageUrl || undefined,
            ...(entryPhotoQuality ? { photoQuality: entryPhotoQuality } : {}),
          };
        })
      )
    ).filter(Boolean);

    const legacyParent1Name = toStringOrNull(familyContext?.parent1?.name);
    const legacyParent2Name = toStringOrNull(familyContext?.parent2?.name);
    const legacySiblingName = toStringOrNull(familyContext?.sibling?.name);
    const normalizedFamilyContext = persistedAdditionalCharacters.length > 0
      ? {
          additionalCharacters: persistedAdditionalCharacters,
          ...(persistedAdditionalCharacters[0]
            ? {
                parent1: {
                  name: persistedAdditionalCharacters[0].name,
                  description: persistedAdditionalCharacters[0].description,
                },
              }
            : {}),
          ...(persistedAdditionalCharacters[1]
            ? {
                parent2: {
                  name: persistedAdditionalCharacters[1].name,
                  description: persistedAdditionalCharacters[1].description,
                },
              }
            : {}),
        }
      : (legacyParent1Name || legacyParent2Name || legacySiblingName)
        ? familyContext
        : null;
    const normalizedWizardData = {
      ...wizardData,
      ...(photoQuality ? { photoQuality } : {}),
      child: {
        ...child,
        imageUrl: childImageUrl || null,
      },
      familyContext: normalizedFamilyContext,
    };

    // Upsert customer
    const customer = await prisma.customer.upsert({
      where: { email: contact.email },
      update: { name: contact.name },
      create: { email: contact.email, name: contact.name },
    });

    // Create or update wizard session
    let wizardSession = null;
    if (sessionId) {
      wizardSession = await prisma.wizardSession.upsert({
        where: { sessionId },
        update: { data: normalizedWizardData },
        create: { sessionId, data: normalizedWizardData },
      });

      // Idempotency guard: a retry with the same wizard session should reuse
      // the existing order instead of creating a duplicate.
      const existingOrder = await prisma.order.findUnique({
        where: { wizardSessionId: wizardSession.id },
        select: { id: true, totalPrice: true },
      });
      if (existingOrder) {
        return NextResponse.json({
          orderId: existingOrder.id,
          totalPrice: Number(existingOrder.totalPrice) / 100,
        });
      }
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        status: 'draft',

        // Customer — use relation connect, not raw scalar customerId
        customer: { connect: { id: customer.id } },
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
        childImageUrl:    childImageUrl || null,
        familyContext:    normalizedFamilyContext,
        characterAnchors: characterAnchorsPayload ?? Prisma.JsonNull,

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
        storyLength: product.length,
        illustrationStyle: persistedIllustrationStyle,
        audioEnabled: product.audioEnabled,
        selectedVoice: product.selectedVoice || null,
        sleepMode: product.sleepMode || false,
        pdfEnabled: product.pdfEnabled,
        bundleEnabled: product.bundleEnabled || false,
        videoEnabled: Boolean(product.videoEnabled),

        // Pricing (stored in agorot)
        basePrice: pricing.basePrice * 100,
        addonsPrice: pricing.addonsPrice * 100,
        totalPrice: pricing.totalPrice * 100,

        // Wizard session — use relation connect only when a session exists
        ...(wizardSession
          ? { wizardSession: { connect: { id: wizardSession.id } } }
          : {}),
      },
    });

    return NextResponse.json({ orderId: order.id, totalPrice: pricing.totalPrice });

  } catch (error) {
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
    return NextResponse.json({ error