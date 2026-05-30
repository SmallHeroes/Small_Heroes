/**
 * Style 01 + gpt-image-1 — dragon_dini 5-page controlled audition (Path B').
 *
 * Usage:
 *   PHASE2_STYLE01_BOOK_PIPELINE=true
 *   PHASE2_STYLE01_REF_CONFIG=A
 *   IMAGE_PROVIDER=gpt-image
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-style01-dini-audition.ts
 *
 * Optional: CHILD_PHOTO_PATH=... (only used on pages where childPresence !== absent)
 * Optional: STORY_BANK_SKIP_PERSONALIZATION_GATE=true (pages 1–5 are companion-only; child name appears from page 6)
 * Composition: per-page targets + subjectScale in lib/style01-gptimage.ts DRAGON_DINI_COMPOSITION_BY_PAGE
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
import { derivePageEntityPresence } from '../lib/image-entity-presence';
import { mergeGptImageReferenceSources } from '../lib/image-reference-utils';
import { estimateGptImage2CostUsd } from '../lib/pricing';
import {
  DRAGON_DINI_COMPOSITION_BY_PAGE,
  DRAGON_DINI_RECURRING_OBJECT_CATALOG,
  DRAGON_DINI_RECURRING_ENTITY_CATALOG,
  isStyle01Phase2BookPipelineEnabled,
  resolveStyle01RefBudgetConfig,
  resolveStyle01GptModel,
  resolveStyle01StoryLocks,
} from '../lib/style01-gptimage';

const STORY_FILE = 'dragon_dini_fantasy.md';
const ILLUSTRATION_STYLE = 'soft_hand_drawn_storybook';
const CHILD_NAME = process.env.CHILD_NAME?.trim() || 'נועם';
const CHILD_AGE = Number.parseInt(process.env.CHILD_AGE?.trim() ?? '5', 10) || 5;
const CHILD_GENDER = (process.env.CHILD_GENDER?.trim() || 'boy') as 'boy' | 'girl';
const MAX_PAGES = 5;
const PAGE_SOFT_TIMEOUT_MS = 4 * 60 * 1000;

function parseOnlyPages(): number[] {
  const raw = process.env.ONLY_PAGES?.trim();
  if (!raw) return [1, 2, 3, 4, 5];
  return raw
    .split(/[,\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= MAX_PAGES);
}

function assertEnv(): void {
  process.env.IMAGE_PROVIDER = 'gpt-image';
  process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
  if (!isStyle01Phase2BookPipelineEnabled()) {
    throw new Error('PHASE2_STYLE01_BOOK_PIPELINE must be true');
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

  const onlyPages = parseOnlyPages();
  const companion = getCompanionById('dragon_dini');
  if (!companion) throw new Error('dragon_dini companion not found');

  const storyPath = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', STORY_FILE);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'phase2-logs', `style01-dini-audition-${ts}`);
  await mkdir(outDir, { recursive: true });

  console.log('=== Style 01 Dini audition ===');
  console.log(`Model: ${resolveStyle01GptModel()} | Ref config: ${resolveStyle01RefBudgetConfig()}`);
  console.log(`Pages: ${onlyPages.join(', ')}`);
  console.log(`Output: ${outDir}\n`);

  const story = await loadStoryFromBank(
    storyPath,
    CHILD_NAME,
    companion.name,
    CHILD_GENDER,
    { maxPages: MAX_PAGES }
  );

  const pagesToRender = story.pages.filter((p) => onlyPages.includes(p.pageNumber));
  const allText = pagesToRender.map((p) => p.text).join('\n');
  const dna = await generateStoryBankCharacterDNA({
    childName: CHILD_NAME,
    childGender: CHILD_GENDER,
    childAge: CHILD_AGE,
    companionName: companion.name,
    storyText: allText,
    illustrationStyle: ILLUSTRATION_STYLE,
  });

  const childPhoto = process.env.CHILD_PHOTO_PATH?.trim();
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const referenceImages =
    childPhoto && (existsSync(childPhoto) || childPhoto.startsWith('http'))
      ? mergeGptImageReferenceSources(childPhoto, companion, appBaseUrl) ?? []
      : mergeGptImageReferenceSources(null, companion, appBaseUrl) ?? [];

  const orderId = `style01-dini-${randomUUID().slice(0, 8)}`;
  const companionKey = `companion:${companion.id}`;

  const pipelinePages = pagesToRender.map((page) => ({
    pageNumber: page.pageNumber,
    imagePrompt: page.imagePrompt,
    rawScenePrompt: page.rawScenePrompt,
    bookPageText: page.text,
    expectedCharacterIds: ['child', companionKey] as string[],
  }));

  const startedAt = Date.now();
  const { results, failedPages } = await generateAllPageImages(pipelinePages, {
    illustrationStyle: ILLUSTRATION_STYLE,
    childName: CHILD_NAME,
    childAge: CHILD_AGE,
    childGender: CHILD_GENDER,
    childDescription: dna.childDNA,
    referenceImages,
    orderId,
    companion,
    directionArchetype: 'fantasy',
    challengeCategory: 'NEW_SIBLING',
    childStructured: dna.childStructured,
    companionStructured: dna.companionStructured,
    propDNA: dna.propDNA,
    extraNegativeRules: dna.negativeRules,
    pageGenerationTimeoutMs: PAGE_SOFT_TIMEOUT_MS,
  });

  const manifestPages: Array<Record<string, unknown>> = [];
  let totalEstimatedCostUsd = 0;

  for (const page of pagesToRender) {
    const image = results.get(page.pageNumber);
    const entityPresence = derivePageEntityPresence({
      bookPageText: page.text,
      imageDirection: page.rawScenePrompt,
      rawScenePrompt: page.rawScenePrompt,
      childFirstName: CHILD_NAME,
      companionName: companion.name,
      companionId: companion.id,
      recurringObjectCatalog: DRAGON_DINI_RECURRING_OBJECT_CATALOG,
      recurringEntityCatalog: DRAGON_DINI_RECURRING_ENTITY_CATALOG,
    });
    const composition = DRAGON_DINI_COMPOSITION_BY_PAGE[page.pageNumber];
    const localPath = path.join(outDir, `page-${String(page.pageNumber).padStart(2, '0')}.png`);
    const promptPath = path.join(outDir, `page-${String(page.pageNumber).padStart(2, '0')}-prompt.txt`);

    if (image?.url) {
      await downloadImage(image.url, localPath);
    }

    const meta = image as { style01Meta?: Record<string, unknown> } | undefined;
    const usage = meta?.style01Meta?.usage as Record<string, unknown> | undefined;
    const cost = estimateGptImage2CostUsd(usage);
    if (cost.estimatedCostUsd != null) {
      totalEstimatedCostUsd += cost.estimatedCostUsd;
    }

    const promptText = image?.prompt ?? '(no prompt returned)';
    await writeFile(promptPath, promptText, 'utf-8');

    manifestPages.push({
      pageNumber: page.pageNumber,
      hebrewText: page.text,
      imageDirection: page.rawScenePrompt,
      entityPresence,
      compositionTarget: composition ?? null,
      finalPrompt: promptText,
      refsPassed: meta?.style01Meta?.referenceBreakdown ?? null,
      model: image?.provider ?? 'failed',
      sceneClass: meta?.style01Meta?.sceneClass ?? null,
      imageUrl: image?.url ?? null,
      localPng: existsSync(localPath) ? localPath : null,
      failed: !image || failedPages.includes(page.pageNumber),
      usage: usage ?? null,
      durationMs: meta?.style01Meta?.durationMs ?? null,
      estimatedCostUsd: cost.estimatedCostUsd,
      costRateSource: cost.costRateSource,
      acceptanceNotes: {
        noChild: entityPresence.childPresence === 'absent',
        diniPresent: entityPresence.companionPresence === 'present',
        recurringObjects: entityPresence.recurringObjects,
        recurringEntities: entityPresence.recurringEntities,
      },
    });
  }

  const sampleCost = estimateGptImage2CostUsd(
    (manifestPages[0]?.usage as Record<string, unknown> | undefined) ?? undefined
  );

  const manifest = {
    audition: 'style01-dragon-dini-5p',
    model: resolveStyle01GptModel(),
    illustrationStyle: ILLUSTRATION_STYLE,
    storyFile: STORY_FILE,
    refConfig: resolveStyle01RefBudgetConfig(),
    orderId,
    runtimeMs: Date.now() - startedAt,
    failedPages,
    totalEstimatedCostUsd: totalEstimatedCostUsd > 0 ? totalEstimatedCostUsd : null,
    costRateSource: sampleCost.costRateSource,
    pages: manifestPages,
    acceptanceChecklist: [
      'Pages 1–3: no human child in image',
      'Dini copper/orange (not green) across pages',
      'Glowing stone same object when visible',
      'Blue-speckled egg same object on page 3+',
      'Baby dragon copper-orange (recurringEntityLock) on pages 4–5',
      'Page 5 cave interior only — no outdoor drift',
      'Compositions: p1 wide establishing, p2 intimate close, p3 discovery',
      'Soft watercolor Style 01 — not cinematic Style 02',
    ],
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  await writeFile(
    path.join(outDir, 'QA.md'),
    [
      '# Style 01 — dragon_dini 5-page audition QA',
      '',
      '## Acceptance',
      '',
      '- [ ] Pages 1–3: **no human child**',
      '- [ ] Dini **copper/orange**, not green',
      '- [ ] **Glowing stone** consistent',
      '- [ ] **Blue-speckled egg** consistent (page 3+)',
      '- [ ] Composition variety (wide / intimate / discovery)',
      '- [ ] Soft watercolor — **not** Style 02 cinematic',
      '',
      '## Per page',
      '',
      ...manifestPages.map(
        (p) =>
          `### Page ${p.pageNumber}\n- childPresence: ${(p.entityPresence as { childPresence: string }).childPresence}\n- composition: ${JSON.stringify(p.compositionTarget)}\n- [ ] pass\n`
      ),
    ].join('\n'),
    'utf-8'
  );

  console.log('\n=== Done ===');
  console.log(`Manifest: ${path.join(outDir, 'manifest.json')}`);
  console.log(`Failed pages: ${failedPages.length ? failedPages.join(', ') : 'none'}`);
  console.log(`Est. cost: ${manifest.totalEstimatedCostUsd != null ? `$${manifest.totalEstimatedCostUsd.toFixed(2)}` : 'unset — configure GPT_IMAGE_2_COST_PER_1K_*'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
