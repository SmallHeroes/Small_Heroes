/**
 * Seed ONE matrix-sellable `bunny_ometz_adventure` fixture order for the B1 render proof
 * (`lib/generation-chunked/__tests__/quality-hash-proof.staging.spec.ts`, proof #3 / RUN_B1). NO RENDER.
 *
 * The proof drives `runGenerationWorkerInvocation(HASH_PROOF_ORDER_ID)` and does NOT self-seed. This creates the
 * fixture via the REAL order-creation TRUTH PATH — the same functions `app/api/orders/route.ts` uses — so the order
 * is genuinely sellable / correctly priced / bound to the exact story bytes (never hand-rolled). It then bootstraps
 * the generation job via the REAL entrypoint `startChunkedGeneration(..., { skipWorkerChain: true })`, which creates
 * the job + claims the order to `generating` but fires NO worker → NOTHING renders here.
 *
 * The child anchor is auto-generated + auto-accepted by Stage 0 during the render (chunk-runner always sets
 * qaStatus='passed'; only the semantic gender/hair/face + style checks hard-gate). So the seed only needs a
 * REACHABLE, CLEAN, FRONT-FACE boy photo at `order.childImageUrl`. It refuses to guess a committed photo (a bad /
 * occluded one fails the semantic gate → ANCHOR_QA_BLOCK → no render):
 *   - SEED_CHILD_PHOTO_URL  — used verbatim (an already-hosted, known-good boy front-face URL), OR
 *   - SEED_CHILD_PHOTO_FILE — a local clean boy image uploaded to STAGING Supabase (self-contained), else it
 *   - fails loudly. Guy must confirm the chosen photo clears the anchor gate on staging BEFORE the render.
 *
 * Runs on Guy's machine (local files) against the STAGING DB. `assertEnvSeparation()` HARD-REFUSES if any resource
 * points at prod (the `.env.local`→prod-DB trap). Idempotent: reuses an existing seed order unless SEED_FRESH=true.
 *
 *   SH_ENV_FILE=.env.local VERCEL_ENV=preview ALLOW_STAGING_QA=true ENABLE_V3_APPROVED_BANK=true \
 *     SEED_CHILD_PHOTO_URL='https://<staging-supabase>/.../boy-frontface.png' \
 *     DATABASE_URL='postgresql://...staging-pooler...:6543/postgres?pgbouncer=true' \
 *     SUPABASE_URL='https://<staging-ref>.supabase.co' SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx --require ./scripts/shims/register-server-only.cjs scripts/seed-hash-proof-order.ts
 *   # → prints HASH_PROOF_ORDER_ID=<id>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: process.env.SH_ENV_FILE || '.env.local' });

import { readFileSync } from 'fs';
import path from 'path';
import type { Prisma } from '@prisma/client';

const SEED_EMAIL = 'hash-proof-seed@smallheroes.test';
const SEED_NAME = 'Hash-Proof Seed';
const V3_SELECTION = 'story-bank/v3-approved/bunny_ometz_adventure.md';

/** Resolve a reachable child photo URL: an operator-supplied URL, an uploaded local file, or fail loudly. */
async function resolveChildPhotoUrl(): Promise<string> {
  const direct = process.env.SEED_CHILD_PHOTO_URL?.trim();
  if (direct) return direct;

  const file = process.env.SEED_CHILD_PHOTO_FILE?.trim();
  if (file) {
    const { storeWizardCharacterPhotoUpload } = await import('@/lib/image-storage');
    const ext = path.extname(file).toLowerCase();
    const contentType =
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
    const url = await storeWizardCharacterPhotoUpload({ buffer: readFileSync(path.resolve(file)), contentType });
    console.log(`[seed] uploaded ${file} → ${url}`);
    return url;
  }

  throw new Error(
    'No child photo configured. Set SEED_CHILD_PHOTO_URL (a reachable, KNOWN-GOOD boy front-face photo) or ' +
      'SEED_CHILD_PHOTO_FILE (a clean, unoccluded front-face boy image to upload). Do NOT assume a committed ' +
      'default clears the Stage-0 anchor gate — verify anchor acceptance on staging first.',
  );
}

async function main(): Promise<void> {
  // The resolver binds the v3-approved story ONLY when this flag is on — required so proof #3's freeze resolves the
  // authored artifact at story-bank/v3-approved/. Fail before any DB work if it's off.
  if (process.env.ENABLE_V3_APPROVED_BANK !== 'true') {
    throw new Error(
      'Set ENABLE_V3_APPROVED_BANK=true so resolveStoryProductTruth binds ' +
        'story-bank/v3-approved/bunny_ometz_adventure.md (the authored visual-contract artifact lives there).',
    );
  }

  // Dynamic-import server modules AFTER loadEnv so validateEnv() sees the loaded staging env.
  const { prisma } = await import('@/lib/prisma');
  const { assertEnvSeparation } = await import('@/lib/generation-chunked/env-separation-guard');
  const { enforceMvpOrderSlot } = await import('@/backend/config/mvp-story-matrix');
  const { resolveStoryProductTruth } = await import('@/backend/providers/story-product-resolver');
  const { buildFrozenStoryProductTruth } = await import('@/lib/generation-pipeline/frozen-product-truth');
  const { computePricing } = await import('@/backend/config/wizard');
  const { buildPersistedCharacterAnchorsJson } = await import('@/lib/orderMeta');
  const { mapStyleToDatabaseValue } = await import('@/lib/styles');
  const { startChunkedGeneration } = await import('@/lib/generation-chunked/start');

  // Refuse to touch prod (guards the .env.local → prod-DB trap) BEFORE any read/write.
  assertEnvSeparation();

  // Idempotent: reuse an existing seed fixture unless a fresh one is explicitly requested.
  if (process.env.SEED_FRESH !== 'true') {
    const existing = await prisma.order.findFirst({
      where: { customerEmail: SEED_EMAIL, selectionFilename: V3_SELECTION },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, childImageUrl: true },
    });
    if (existing) {
      console.log(`[seed] reusing existing fixture (status=${existing.status}, childImageUrl=${existing.childImageUrl ?? 'none'})`);
      console.log(`[seed] pass SEED_FRESH=true to force a new one.`);
      console.log(`HASH_PROOF_ORDER_ID=${existing.id}`);
      await prisma.$disconnect();
      return;
    }
  }

  // ── REAL truth / matrix path (mirrors app/api/orders/route.ts:111-185) — nothing hand-rolled ──
  const enforced = enforceMvpOrderSlot({
    challengeCategory: 'MEDICAL_PROCEDURE',
    clientDirection: 'adventure',
    clientCompanionId: 'bunny_ometz',
  });

  const resolved = resolveStoryProductTruth({
    companionId: enforced.companionId,
    clientDirection: enforced.direction,
    challengeCategory: 'MEDICAL_PROCEDURE',
  });
  if (!resolved.storyFile) {
    throw new Error(`resolveStoryProductTruth returned no storyFile (source=${resolved.source}) — cannot freeze product truth.`);
  }

  const frozen = buildFrozenStoryProductTruth({
    storyFilePath: resolved.storyFile,
    expectedPageCount: resolved.pages,
    storyDirection: resolved.storyDirection,
  });
  if (frozen.selectionFilename !== V3_SELECTION) {
    throw new Error(
      `selectionFilename resolved to "${frozen.selectionFilename}" but proof #3 needs "${V3_SELECTION}" ` +
        `(so the freeze finds the authored artifact). Ensure ENABLE_V3_APPROVED_BANK=true.`,
    );
  }

  const pricing = computePricing({
    length: resolved.storyLength,
    direction: resolved.storyDirection,
    audioEnabled: false,
    pdfEnabled: false,
    bundleEnabled: false,
    videoEnabled: false,
  });

  const characterAnchors = buildPersistedCharacterAnchorsJson(
    {},
    { companionCharacterId: enforced.companionId, challengeCategory: enforced.category },
  );

  // Resolve the child photo BEFORE creating the order (fail loudly before any write if none is configured).
  const childImageUrl = await resolveChildPhotoUrl();

  const customer = await prisma.customer.upsert({
    where: { email: SEED_EMAIL },
    update: {},
    create: { email: SEED_EMAIL, name: SEED_NAME },
  });

  const order = await prisma.order.create({
    data: {
      // `paid` = the real post-payment state startChunkedGeneration claims from; payment is the ONLY short-circuit —
      // every product/price/selection field below is truth-derived, never fabricated.
      status: 'paid',
      customer: { connect: { id: customer.id } },
      customerEmail: SEED_EMAIL,
      customerName: SEED_NAME,
      childName: 'נועם',
      childGender: 'male', // matches the male-variant story/artifact so the Stage-0 semantic gender check aligns
      childImageUrl,
      topic: 'medical',
      storyLength: resolved.storyLength,
      storyDirection: resolved.storyDirection,
      // Frozen product truth (expectedPageCount / storySourceHash / selectionFilename / frozenProductVersion).
      ...frozen,
      illustrationStyle: mapStyleToDatabaseValue('soft_hand_drawn_storybook'),
      characterAnchors: characterAnchors as Prisma.InputJsonValue,
      basePrice: pricing.basePrice * 100, // ILS → agorot
      addonsPrice: pricing.addonsPrice * 100,
      totalPrice: pricing.totalPrice * 100,
    },
  });

  // Bootstrap the generation job via the REAL entrypoint, but WITHOUT rendering (skipWorkerChain fires no worker).
  const started = await startChunkedGeneration(order.id, 'seed-hash-proof', { skipWorkerChain: true });
  if (!started.started) {
    throw new Error(`startChunkedGeneration did not start the order: ${started.message ?? 'unknown reason'}`);
  }

  console.log('[seed] created matrix-sellable bunny_ometz_adventure fixture via the real truth path:');
  console.log(`  source=${resolved.source} direction=${resolved.storyDirection} pages=${frozen.expectedPageCount} priceILS=${pricing.totalPrice}`);
  console.log(`  selectionFilename=${frozen.selectionFilename}`);
  console.log(`  storySourceHash=${frozen.storySourceHash.slice(0, 12)}…`);
  console.log(`  childImageUrl=${childImageUrl}`);
  console.log('  NOTE: NO render was run. Verify this photo clears the Stage-0 anchor gate on staging BEFORE proof #3.');
  console.log(`HASH_PROOF_ORDER_ID=${order.id}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
