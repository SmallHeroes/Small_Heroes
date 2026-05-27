/**
 * guarded-v2 risk-page smoke — generates ONLY pages 4, 6, 10 (highest-risk).
 * ~3 images before committing to a full 10-page run.
 *
 * Usage:
 *   PHASE2_STYLE02_BOOK_PIPELINE=true
 *   PHASE2_STYLE02_REF_CONFIG=A
 *   PHASE2_STEP5_PROFILE=guarded-v2
 *   IMAGE_PROVIDER=gpt-image
 *   CHILD_PHOTO_PATH=C:\path\to\photo.png
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-guarded-v2-risk-pages.ts
 *
 * Optional: ONLY_PAGES=4,6,10  (default 4,6,10)
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
import { selectCompanionStory, STORY_BANK_V3_DIR_NAME } from '../backend/providers/story-bank-index';
import type { PatchContext } from '../backend/providers/personalization';
import { BOLLY_ARMADILLO } from '../lib/companions';
import { mergeGptImageReferenceSources } from '../lib/image-reference-utils';
import { estimateGptImage2CostUsd } from '../lib/pricing';
import { bollyBedtimeAge5Recipe } from '../lib/story-generator/recipes/bolly_bedtime_age_5';
import {
  isStyle02Phase2BookPipelineEnabled,
  resolveStyle02BookPromptProfile,
  resolveStyle02RefBudgetConfig,
  resolveStyle02Step5Profile,
  STYLE_02_GPT_MODEL,
} from '../lib/style02-gptimage';

const PROFILE = 'guarded-v2' as const;
const REF_CONFIG = 'A' as const;
const ILLUSTRATION_STYLE = 'detailed_whimsical_world';
const CHILD_NAME = process.env.CHILD_NAME?.trim() || 'Baboo';
const CHILD_AGE = Number.parseInt(process.env.CHILD_AGE?.trim() ?? '5', 10) || 5;
const CHILD_GENDER = (process.env.CHILD_GENDER?.trim() || 'boy') as 'boy' | 'girl';
const RECIPE_ID = 'bolly_bedtime_age_5';
const PAGE_SOFT_TIMEOUT_MS = 4 * 60 * 1000;

const DEFAULT_RISK_PAGES = [4, 6, 10] as const;

function parseOnlyPages(): number[] {
  const raw = process.env.ONLY_PAGES?.trim();
  if (!raw) return [...DEFAULT_RISK_PAGES];
  const nums = raw
    .split(/[,\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1);
  if (!nums.length) return [...DEFAULT_RISK_PAGES];
  return nums;
}

function assertEnv(): void {
  process.env.IMAGE_PROVIDER = 'gpt-image';
  process.env.PHASE2_STYLE02_BOOK_PIPELINE = 'true';
  process.env.PHASE2_STYLE02_REF_CONFIG = REF_CONFIG;
  process.env.PHASE2_STEP5_PROFILE = PROFILE;
  process.env.USE_VISUAL_DIRECTOR = 'false';

  if (!isStyle02Phase2BookPipelineEnabled()) throw new Error('PHASE2_STYLE02_BOOK_PIPELINE must be true');
  if (resolveStyle02RefBudgetConfig() !== REF_CONFIG) {
    throw new Error(`PHASE2_STYLE02_REF_CONFIG must be ${REF_CONFIG}`);
  }
  if (resolveStyle02Step5Profile() !== PROFILE) throw new Error(`PHASE2_STEP5_PROFILE must be ${PROFILE}`);
  if (resolveStyle02BookPromptProfile() !== PROFILE) {
    throw new Error(`Live profile must be ${PROFILE}`);
  }
}

function buildPatchContext(): PatchContext {
  return {
    childName: CHILD_NAME,
    childAge: CHILD_AGE,
    childGender: CHILD_GENDER,
    categoryAnswers: {},
    difficulties: [],
    helpers: [],
    goals: [],
    avoid: [],
    superpower: [],
  };
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

function riskPageSpec(pageNumber: number): string {
  const card = bollyBedtimeAge5Recipe.pageCards.find((c) => c.page === pageNumber);
  if (!card) return `Page ${pageNumber}`;
  return [
    `Page ${pageNumber}`,
    `sceneState=${card.sceneState ?? 'inferred'}`,
    `framingType=${card.framingType ?? 'inferred'}`,
    card.focalObject ? `focalObject=${card.focalObject}` : '',
    card.gestureFocus ? `gestureFocus=${card.gestureFocus}` : '',
    `imageIntent=${card.imageIntent}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildManualQaTemplate(pages: number[]): string {
  const checks: Record<number, string> = {
    4: 'Pajamas, no cap on head, no satchel worn. Same child without cap. Painterly face — NOT photoreal.',
    6: 'Hand is focal. Painterly hand — NOT live-action. NO accidental face close-up.',
    10: 'Sleeping pose, pajamas, no cap/satchel on body. Identity via face/hair. Intimate low-light bedtime.',
    7: 'OBJECT focus: shell plate + finger. NOT face drift. Painterly finger.',
    5: 'OBJECT focus: Bolly curled ball. Child face NOT focal.',
    9: 'Close-emotional face — painterly, identity without cap.',
  };

  const pageSections = pages
    .map(
      (p) => `### Page ${p}\n${riskPageSpec(p)}\n\n**Check:** ${checks[p] ?? 'See brief.'}\n\n- [ ] pass\n- [ ] fail\n- Notes:\n`
    )
    .join('\n');

  return [
    '# guarded-v2 manual QA — risk pages',
    '',
    '## Global',
    '',
    '- **childIdentityWithoutCap:** pass | fail | notes:',
    '- **bollyScale:** pass | fail | notes:',
    '',
    '## Per-page',
    '',
    pageSections,
    '',
    '## Page 7 (only if included in run)',
    '',
    checks[7],
    '',
    '---',
    '',
    'Do **not** judge page 7 on face close-up criteria.',
  ].join('\n');
}

async function main(): Promise<void> {
  assertEnv();

  const riskPages = parseOnlyPages();
  const childPhoto = process.env.CHILD_PHOTO_PATH?.trim();
  if (!childPhoto || (!existsSync(childPhoto) && !childPhoto.startsWith('http'))) {
    console.error('CHILD_PHOTO_PATH required (local file or URL)');
    process.exit(1);
  }

  const selection = selectCompanionStory('bolly_armadillo', 'bedtime');
  if (!selection) throw new Error('bolly_armadillo_bedtime story not found');

  const storyFilePath = path.join(process.cwd(), 'story-bank', STORY_BANK_V3_DIR_NAME, selection.filename);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'phase2-logs', `guarded-v2-risk-pages-${ts}`);
  await mkdir(outDir, { recursive: true });

  console.log('=== guarded-v2 risk pages ===');
  console.log(`Profile: ${PROFILE} | Config ${REF_CONFIG} | Model ${STYLE_02_GPT_MODEL}`);
  console.log(`Pages: ${riskPages.join(', ')}`);
  console.log(`Output: ${outDir}\n`);

  const story = await loadStoryFromBank(storyFilePath, CHILD_NAME, BOLLY_ARMADILLO.name, CHILD_GENDER, {
    patchContext: buildPatchContext(),
  });

  const pagesToRender = story.pages.filter((p) => riskPages.includes(p.pageNumber));
  if (pagesToRender.length !== riskPages.length) {
    throw new Error(`Missing pages. Wanted ${riskPages.join(',')}, got ${pagesToRender.map((p) => p.pageNumber).join(',')}`);
  }

  const allStoryText = story.pages.map((p) => p.text).join('\n');
  const dna = await generateStoryBankCharacterDNA({
    childName: CHILD_NAME,
    childGender: CHILD_GENDER,
    childAge: CHILD_AGE,
    companionName: BOLLY_ARMADILLO.name,
    storyText: allStoryText,
    illustrationStyle: ILLUSTRATION_STYLE,
  });

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const referenceImages = mergeGptImageReferenceSources(childPhoto, BOLLY_ARMADILLO, appBaseUrl) ?? [];
  const orderId = `guarded-v2-risk-${randomUUID().slice(0, 8)}`;
  const companionKey = `companion:bolly_armadillo`;

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
    companion: BOLLY_ARMADILLO,
    directionArchetype: 'bedtime',
    challengeCategory: 'MEDICAL_PROCEDURE',
    guardedV2RecipeId: RECIPE_ID,
    childStructured: dna.childStructured,
    companionStructured: dna.companionStructured,
    propDNA: dna.propDNA,
    extraNegativeRules: dna.negativeRules,
    photoQuality: { status: 'good', faceCount: 1 },
    pageGenerationTimeoutMs: PAGE_SOFT_TIMEOUT_MS,
  });

  const manifestPages: Array<Record<string, unknown>> = [];
  let totalEstimatedCostUsd = 0;

  for (const page of pagesToRender) {
    const generated = results.get(page.pageNumber);
    if (!generated?.style02Meta) {
      console.warn(`Page ${page.pageNumber}: no output`);
      continue;
    }
    const meta = generated.style02Meta;
    const pngName = `page-${String(page.pageNumber).padStart(2, '0')}.png`;
    await downloadImage(generated.rawUrl ?? generated.url, path.join(outDir, pngName));
    await writeFile(path.join(outDir, `page-${String(page.pageNumber).padStart(2, '0')}-prompt.txt`), generated.prompt, 'utf8');

    const gv2 = meta.guardedV2;
    const costEst = estimateGptImage2CostUsd(meta.usage ?? {});
    if (costEst.estimatedCostUsd != null) totalEstimatedCostUsd += costEst.estimatedCostUsd;

    manifestPages.push({
      pageNumber: page.pageNumber,
      outputPath: pngName,
      sceneClass: meta.sceneClass,
      promptProfile: meta.promptProfile,
      fallbackUsed: meta.fallbackUsed,
      recipeCard: bollyBedtimeAge5Recipe.pageCards.find((c) => c.page === page.pageNumber),
      ...(gv2 ?? {}),
      estimatedCostUsd: costEst.estimatedCostUsd,
    });
    console.log(
      `  ✓ page ${page.pageNumber} | sceneState=${gv2?.sceneState} framing=${gv2?.framingType} ` +
        `closeUp=${gv2?.closeUpRuleApplied} handDetail=${gv2?.handDetailRuleApplied}`
    );
  }

  const manifest = {
    phase: 'guarded-v2-risk-pages',
    profile: PROFILE,
    config: REF_CONFIG,
    model: STYLE_02_GPT_MODEL,
    orderId,
    pagesRequested: riskPages,
    pagesRendered: manifestPages.length,
    failedPages,
    runtimeMs: Date.now() - startedAt,
    totalEstimatedCostUsd: totalEstimatedCostUsd || null,
    pages: manifestPages,
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(path.join(outDir, 'QA_MANUAL.md'), buildManualQaTemplate(riskPages), 'utf8');

  if (failedPages.length > 0) {
    throw new Error(`Failed pages: ${failedPages.join(', ')}`);
  }
  if (manifestPages.length !== riskPages.length) {
    throw new Error(`Expected ${riskPages.length} pages, got ${manifestPages.length}`);
  }

  console.log(`\n=== Done (${((Date.now() - startedAt) / 1000).toFixed(1)}s) ===`);
  console.log(`Review PNGs + manifest.json + QA_MANUAL.md in:\n  ${outDir}`);
  console.log('\nIf pages 4, 6, 10 pass → green-light a full short-book bedtime run.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
