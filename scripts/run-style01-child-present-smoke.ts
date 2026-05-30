/**
 * Style 01 child-present smoke test — verify child ref + locks on present pages.
 *
 * Uses bear_cub_gahal page 4 (child + Dobi at forest edge).
 *
 * Usage:
 *   PHASE2_STYLE01_BOOK_PIPELINE=true
 *   PHASE2_STYLE01_REF_CONFIG=A
 *   IMAGE_PROVIDER=gpt-image
 *   STYLE_01_GPT_MODEL=gpt-image-2
 *   CHILD_PHOTO_PATH=... (required)
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-style01-child-present-smoke.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();
import './shims/register-server-only.cjs';

import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateAllPageImages } from '../backend/providers/image';
import {
  generateStoryBankCharacterDNA,
  loadStoryFromBank,
} from '../backend/providers/story-bank-loader';
import { getCompanionById } from '../lib/companions';
import { childPresenceAllowsReferencePhoto, derivePageEntityPresence } from '../lib/image-entity-presence';
import { mergeGptImageReferenceSources } from '../lib/image-reference-utils';
import { estimateGptImage2CostUsd } from '../lib/pricing';
import {
  isStyle01Phase2BookPipelineEnabled,
  resolveStyle01RefBudgetConfig,
  resolveStyle01GptModel,
} from '../lib/style01-gptimage';

const STORY_FILE = 'bear_cub_gahal_adventure.md';
const COMPANION_ID = 'bear_cub_gahal';
const SMOKE_PAGE = Number.parseInt(process.env.SMOKE_PAGE?.trim() ?? '4', 10) || 4;
const ILLUSTRATION_STYLE = 'soft_hand_drawn_storybook';
const CHILD_NAME = process.env.CHILD_NAME?.trim() || 'נועם';
const CHILD_AGE = Number.parseInt(process.env.CHILD_AGE?.trim() ?? '5', 10) || 5;
const CHILD_GENDER = (process.env.CHILD_GENDER?.trim() || 'boy') as 'boy' | 'girl';

function assertEnv(): void {
  process.env.IMAGE_PROVIDER = 'gpt-image';
  process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
  if (!isStyle01Phase2BookPipelineEnabled()) {
    throw new Error('PHASE2_STYLE01_BOOK_PIPELINE must be true');
  }
  const photo = process.env.CHILD_PHOTO_PATH?.trim();
  if (!photo || (!existsSync(photo) && !photo.startsWith('http'))) {
    throw new Error('CHILD_PHOTO_PATH must point to a valid child photo for this smoke test');
  }
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  const { readFile, writeFile: wf } = await import('fs/promises');
  if (existsSync(url)) {
    await wf(destPath, await readFile(url));
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await wf(destPath, Buffer.from(await res.arrayBuffer()));
}

async function main(): Promise<void> {
  assertEnv();

  const companion = getCompanionById(COMPANION_ID);
  if (!companion) throw new Error(`${COMPANION_ID} not found`);

  const storyPath = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', STORY_FILE);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'phase2-logs', `style01-child-present-smoke-${ts}`);
  await mkdir(outDir, { recursive: true });

  console.log('=== Style 01 child-present smoke ===');
  console.log(`Model: ${resolveStyle01GptModel()} | Page: ${SMOKE_PAGE}`);
  console.log(`Output: ${outDir}\n`);

  const story = await loadStoryFromBank(
    storyPath,
    CHILD_NAME,
    companion.name,
    CHILD_GENDER,
    { maxPages: SMOKE_PAGE }
  );

  const page = story.pages.find((p) => p.pageNumber === SMOKE_PAGE);
  if (!page) throw new Error(`Page ${SMOKE_PAGE} not found`);

  const entityPresencePre = derivePageEntityPresence({
    bookPageText: page.text,
    imageDirection: page.rawScenePrompt,
    rawScenePrompt: page.rawScenePrompt,
    childFirstName: CHILD_NAME,
    companionName: companion.name,
    companionId: companion.id,
  });

  console.log('[Smoke] Pre-flight entityPresence:', JSON.stringify(entityPresencePre));
  if (entityPresencePre.childPresence !== 'present') {
    throw new Error(
      `Smoke page ${SMOKE_PAGE} expected childPresence=present, got ${entityPresencePre.childPresence}`
    );
  }
  if (!childPresenceAllowsReferencePhoto(entityPresencePre.childPresence)) {
    throw new Error('Child ref photo should be allowed on this page');
  }

  const dna = await generateStoryBankCharacterDNA({
    childName: CHILD_NAME,
    childGender: CHILD_GENDER,
    childAge: CHILD_AGE,
    companionName: companion.name,
    storyText: page.text,
    illustrationStyle: ILLUSTRATION_STYLE,
  });

  const childPhoto = process.env.CHILD_PHOTO_PATH!.trim();
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const referenceImages =
    mergeGptImageReferenceSources(childPhoto, companion, appBaseUrl) ?? [];

  const orderId = `style01-child-smoke-${randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();

  const { results, failedPages } = await generateAllPageImages(
    [
      {
        pageNumber: page.pageNumber,
        imagePrompt: page.imagePrompt,
        rawScenePrompt: page.rawScenePrompt,
        bookPageText: page.text,
        expectedCharacterIds: ['child', `companion:${companion.id}`],
      },
    ],
    {
      illustrationStyle: ILLUSTRATION_STYLE,
      childName: CHILD_NAME,
      childAge: CHILD_AGE,
      childGender: CHILD_GENDER,
      childDescription: dna.childDNA,
      referenceImages,
      orderId,
      companion,
      directionArchetype: 'adventure',
      challengeCategory: 'ANGER_FRUSTRATION',
      childStructured: dna.childStructured,
      companionStructured: dna.companionStructured,
      propDNA: dna.propDNA,
      extraNegativeRules: dna.negativeRules,
    }
  );

  const image = results.get(page.pageNumber);
  const meta = image as { style01Meta?: Record<string, unknown> } | undefined;
  const refs = meta?.style01Meta?.referenceBreakdown as Record<string, string[]> | undefined;
  const childRefs = refs?.child ?? [];
  const usage = meta?.style01Meta?.usage as Record<string, unknown> | undefined;
  const cost = estimateGptImage2CostUsd(usage);

  const localPath = path.join(outDir, `page-${String(SMOKE_PAGE).padStart(2, '0')}.png`);
  if (image?.url) await downloadImage(image.url, localPath);
  if (image?.prompt) {
    await writeFile(path.join(outDir, `page-${String(SMOKE_PAGE).padStart(2, '0')}-prompt.txt`), image.prompt);
  }

  const manifest = {
    smoke: 'style01-child-present',
    model: resolveStyle01GptModel(),
    storyFile: STORY_FILE,
    pageNumber: SMOKE_PAGE,
    orderId,
    runtimeMs: Date.now() - startedAt,
    failedPages,
    entityPresence: entityPresencePre,
    refsPassed: refs ?? null,
    childRefPassed: childRefs.length > 0,
    companionRefPassed: (refs?.companion ?? []).length > 0,
    usage: usage ?? null,
    estimatedCostUsd: cost.estimatedCostUsd,
    costRateSource: cost.costRateSource,
    imageUrl: image?.url ?? null,
    localPng: existsSync(localPath) ? localPath : null,
    acceptance: {
      childPresent: entityPresencePre.childPresence === 'present',
      childRefOnPresentPage: childRefs.length > 0,
      companionDistinct: (refs?.companion ?? []).length > 0,
      noApiFailure: failedPages.length === 0,
    },
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n=== Smoke result ===');
  console.log(JSON.stringify(manifest.acceptance, null, 2));
  console.log(`Manifest: ${path.join(outDir, 'manifest.json')}`);
  if (failedPages.length) process.exit(1);
  if (!manifest.acceptance.childRefOnPresentPage) {
    console.error('FAIL: child ref not passed on present page');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
