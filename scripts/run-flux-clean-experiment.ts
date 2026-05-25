/**
 * Flux clean-prompt experiment — Bedtime gold book, arms A/B (child input_images on/off).
 *
 * Usage:
 *   npx tsx scripts/run-flux-clean-experiment.ts
 *
 * Requires: REPLICATE_API_TOKEN, FLUX_CLEAN_PROMPT=on, ENABLE_LORA=false (base flux-dev)
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();
import './shims/register-server-only.cjs';
import { readFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  generateAllPageImages,
  generatePageVisualStoryboard,
  previewFluxCleanPrompt,
} from '../backend/providers/image';
import { BOLLY_ARMADILLO } from '../lib/companions';
import {
  countPromptWords,
  FLUX_CLEAN_ANTI_CROP_NEGATIVES,
  FLUX_CLEAN_FRAMING_FLOOR,
  fluxCleanPromptContainsCloseUp,
  fluxCleanPromptContainsHebrew,
  fluxCleanStyleLineHasNeutralWhiteBalance,
  fluxCleanStyleLineHasWarmCastWording,
  normalizeFluxChildDisplayName,
} from '../lib/flux-clean-prompt';

const PROMPTS_ONLY = process.argv.includes('--prompts-only');

function parseArmArg(argv: string[]): 'A' | 'B' | 'both' {
  const idx = argv.indexOf('--arm');
  if (idx === -1) return 'both';
  const raw = (argv[idx + 1] ?? '').trim().toUpperCase();
  if (raw === 'A' || raw === 'B') return raw;
  console.error(`Invalid --arm value. Use: A | B`);
  process.exit(1);
}

function parseMaxPagesArg(argv: string[]): number | null {
  const idx = argv.indexOf('--max-pages');
  if (idx === -1) return null;
  const raw = argv[idx + 1];
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < 1) {
    console.error(`Invalid --max-pages value "${raw ?? ''}". Use a positive integer.`);
    process.exit(1);
  }
  return n;
}

process.env.IMAGE_PROVIDER = 'replicate';
process.env.FLUX_CLEAN_PROMPT = 'on';
/** Base flux-dev only — LoRA off for this experiment (proven-cute recipe). */
process.env.ENABLE_LORA = 'false';
process.env.USE_VISUAL_DIRECTOR = 'false';
if (PROMPTS_ONLY) {
  process.env.DISABLE_IMAGE_GENERATION = 'true';
} else {
  process.env.DISABLE_IMAGE_GENERATION = 'false';
}

const STORY_PATH = path.join(
  process.cwd(),
  'gold-candidates',
  'bolly_bedtime_v0.5.0-b_gold.md'
);
const TEST_CHILD_PATH = path.join(
  process.cwd(),
  'public',
  'experiments',
  'image-consistency-1',
  'test-child-reference.jpg'
);
const ILLUSTRATION_STYLE = 'realistic_illustrated';
const CHILD_NAME = 'מיכל';
const CHILD_AGE = 5;
const CHILD_GENDER = 'girl';

type ParsedPage = {
  pageNumber: number;
  text: string;
  imageDirection: string;
};

function parseExperimentStory(raw: string): { title: string; pages: ParsedPage[] } {
  const yamlTitleMatch = raw.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
  const title = yamlTitleMatch?.[1]?.trim() || `הסיפור של ${CHILD_NAME}`;

  const pageParts = raw.split(/---\s*Page\s*(\d+)\s*---/).slice(1);
  const pages: ParsedPage[] = [];

  for (let i = 0; i < pageParts.length; i += 2) {
    const pageNumber = parseInt(pageParts[i], 10);
    if (!Number.isFinite(pageNumber)) continue;
    const block = pageParts[i + 1] ?? '';
    const imageDirectionMatch = block.match(/imageDirection:\s*(.+)/);
    const imageDirection = imageDirectionMatch?.[1]?.trim() ?? '';
    const text = block
      .replace(/imageDirection:.*/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    pages.push({ pageNumber, text, imageDirection });
  }

  return { title, pages };
}

function pageExpectsCompanion(page: ParsedPage): boolean {
  const hay = `${page.text} ${page.imageDirection}`.toLowerCase();
  return (
    hay.includes('bolly') ||
    hay.includes('בולי') ||
    hay.includes('בּוֹלִי') ||
    hay.includes('armadillo')
  );
}

function buildPageImagePrompt(page: ParsedPage): string {
  return [
    `Children's picture book illustration, page ${page.pageNumber}.`,
    page.imageDirection || page.text.slice(0, 200),
    `Story moment: ${page.text.replace(/\n/g, ' ').slice(0, 400)}`,
  ].join(' ');
}

async function downloadPageImage(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

async function runArm(arm: 'A' | 'B', pages: ParsedPage[], title: string): Promise<string> {
  const orderId = `flux-clean-bedtime-arm${arm}-${randomUUID().slice(0, 8)}`;
  const outDir = path.join(
    process.cwd(),
    'image-experiment-1',
    `flux-clean-bedtime-arm${arm}-${new Date().toISOString().slice(0, 10)}-${orderId}`
  );
  await mkdir(outDir, { recursive: true });

  const useChildRef = arm === 'A';
  const referenceImages = useChildRef ? [TEST_CHILD_PATH] : undefined;

  console.log(`\n=== Flux clean prompt — Arm ${arm} ===`);
  console.log(`FLUX_CLEAN_PROMPT=on | IMAGE_PROVIDER=replicate | ENABLE_LORA=${process.env.ENABLE_LORA}`);
  console.log(`input_images (child photo): ${useChildRef ? 'YES' : 'NO'}`);
  console.log(`output: ${outDir}\n`);

  const pipelinePages = pages.map((page) => ({
    pageNumber: page.pageNumber,
    imagePrompt: buildPageImagePrompt(page),
    bookPageText: page.text,
    expectedCharacterIds: pageExpectsCompanion(page)
      ? ['child', 'companion:bolly_armadillo']
      : ['child'],
  }));

  const { results, failedPages, textZones } = await generateAllPageImages(pipelinePages, {
    illustrationStyle: ILLUSTRATION_STYLE,
    childName: CHILD_NAME,
    childAge: CHILD_AGE,
    childGender: CHILD_GENDER,
    childDescription: 'Michal, 5-year-old girl, warm olive skin, soft brown eyes.',
    referenceImages,
    initialCharacterAnchors: useChildRef ? { child: TEST_CHILD_PATH } : undefined,
    orderId,
    companion: BOLLY_ARMADILLO,
    directionArchetype: 'bedtime',
    companionStructured: COMPANION_STRUCTURED,
    photoQuality: { status: 'good', faceCount: 1 },
  });

  const manifestPages: Array<{
    pageNumber: number;
    localPath: string;
    provider: string;
    promptWordCount: number;
    promptPreview: string;
    textZone: string;
  }> = [];

  let page1PromptLog: { wordCount: number; fullPrompt: string } | null = null;

  for (const page of pages) {
    const generated = results.get(page.pageNumber);
    if (!generated) {
      console.warn(`[arm ${arm}] page ${page.pageNumber} missing (failed=${failedPages.includes(page.pageNumber)})`);
      continue;
    }
    const localFilename = `page-${String(page.pageNumber).padStart(2, '0')}.jpg`;
    const localPath = path.join(outDir, localFilename);
    const downloadUrl = generated.rawUrl ?? generated.url;
    await downloadPageImage(downloadUrl, localPath);

    const wordCount = countPromptWords(generated.prompt);
    if (page.pageNumber === 1) {
      page1PromptLog = { wordCount, fullPrompt: generated.prompt };
      await writeFile(
        path.join(outDir, 'page-01-prompt.txt'),
        `${generated.prompt}\n\n--- word count: ${wordCount} ---\n`,
        'utf8'
      );
    }

    manifestPages.push({
      pageNumber: page.pageNumber,
      localPath: localFilename,
      provider: generated.provider,
      promptWordCount: wordCount,
      promptPreview: generated.prompt.replace(/\s+/g, ' ').slice(0, 200),
      textZone: textZones.get(page.pageNumber) ?? 'unknown',
    });
    console.log(`  ✓ page ${page.pageNumber} (${wordCount} prompt words)`);
  }

  const manifest = {
    experiment: 'flux-clean-prompt-bedtime',
    arm,
    generatedAt: new Date().toISOString(),
    orderId,
    storyFile: STORY_PATH,
    storyTitle: title,
    provider: 'replicate',
    fluxCleanPrompt: true,
    enableLora: process.env.ENABLE_LORA === 'true',
    illustrationStyle: ILLUSTRATION_STYLE,
    childReference: useChildRef ? TEST_CHILD_PATH : null,
    bollyReference: path.join('public', 'companions', 'bolly_armadillo', 'reference.jpg'),
    inputImagesArm: useChildRef ? 'child-photo-only' : 'none-lora-text-only',
    page1Prompt: page1PromptLog,
    failedPages,
    pages: manifestPages,
    abCompareWith: 'image-experiment-1/bedtime-2026-05-24-exp1-0413959e/',
    qaNotes: [
      'Compare page-text match vs legacy bloated Bedtime run',
      'Child continuity arm A vs B',
      'Composition variety from storyboard shot lines',
    ],
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Arm ${arm} done — ${manifestPages.length}/${pages.length} pages → ${outDir}`);
  if (page1PromptLog) {
    console.log(`Page-1 prompt: ${page1PromptLog.wordCount} words (target 70–110, scene-first)`);
  }
  return outDir;
}

const COMPANION_STRUCTURED = {
  species: 'small friendly armadillo',
  size: 'compact, child-scale',
  coloring: 'warm tan-brown segmented shell plates',
  feature: 'one plate slightly open showing soft pink belly, round dark gentle eyes',
};

async function runPromptsOnlyGate(pages: ParsedPage[]): Promise<void> {
  const pipelinePages = pages.map((page) => ({
    pageNumber: page.pageNumber,
    imagePrompt: buildPageImagePrompt(page),
    bookPageText: page.text,
  }));

  const storyboardPlan = await generatePageVisualStoryboard({
    fullStory: pages
      .map((p) => p.text)
      .join('\n\n')
      .slice(0, 12000),
    pages: pipelinePages,
    childProfile: `${normalizeFluxChildDisplayName(CHILD_NAME)} | age ${CHILD_AGE} girl`,
    selectedStyle: ILLUSTRATION_STYLE,
  });
  const storyboardByPage = new Map(storyboardPlan.map((row) => [row.pageNumber, row]));

  const shotTypes = new Set(storyboardPlan.map((r) => r.shotType));
  console.log(`Storyboard shot variety: ${[...shotTypes].join(', ')} (${shotTypes.size} distinct)\n`);

  const reportDir = path.join(process.cwd(), 'image-experiment-1', 'flux-clean-prompts-only-gate');
  await mkdir(reportDir, { recursive: true });

  const pageReports: Array<{
    pageNumber: number;
    wordCount: number;
    hasHebrew: boolean;
    hasMichal: boolean;
    hasBadChildName: boolean;
    hasFramingFloor: boolean;
    hasCloseUp: boolean;
    styleLineNoWarmCast: boolean;
    styleLineNeutralWb: boolean;
    wordCountInRange: boolean;
    negativeHasAntiCrop: boolean;
    companionHasShellTraits: boolean;
  }> = [];

  let page1FullPrompt = '';
  let page1NegativePrompt = '';

  for (const page of pages) {
    const sb = storyboardByPage.get(page.pageNumber)!;
    const preview = await previewFluxCleanPrompt({
      pagePrompt: buildPageImagePrompt(page),
      illustrationStyle: ILLUSTRATION_STYLE,
      bookPageText: page.text,
      pageNumber: page.pageNumber,
      totalPages: pages.length,
      childFirstName: CHILD_NAME,
      childAge: CHILD_AGE,
      childGender: CHILD_GENDER,
      directionArchetype: 'bedtime',
      companion: BOLLY_ARMADILLO,
      companionStructured: COMPANION_STRUCTURED,
      expectedCharacterIds: pageExpectsCompanion(page)
        ? ['child', 'companion:bolly_armadillo']
        : ['child'],
      pageStoryboard: sb,
      orderId: 'flux-clean-prompts-only-gate',
    });

    const prompt = preview.finalPrompt;
    if (page.pageNumber === 1) {
      page1FullPrompt = prompt;
      page1NegativePrompt = preview.negativePrompt;
    }

    const hasHebrew = fluxCleanPromptContainsHebrew(prompt);
    const hasMichal = /\bMichal\b/.test(prompt);
    const hasBadChildName =
      /\bMicha\b/i.test(prompt) ||
      /\bMichael\b/i.test(prompt) ||
      /מיכל/.test(prompt);
    const hasFramingFloor = prompt.includes(FLUX_CLEAN_FRAMING_FLOOR);
    const hasCloseUp = fluxCleanPromptContainsCloseUp(prompt);
    const styleLineNoWarmCast = !fluxCleanStyleLineHasWarmCastWording(prompt);
    const styleLineNeutralWb = fluxCleanStyleLineHasNeutralWhiteBalance(prompt);
    const wordCountInRange = preview.wordCount >= 70 && preview.wordCount <= 130;
    const negativeHasAntiCrop = FLUX_CLEAN_ANTI_CROP_NEGATIVES.split(', ')
      .every((term) => preview.negativePrompt.toLowerCase().includes(term.trim().toLowerCase()));
    const companionLine = prompt.split('\n').find((l) => l.startsWith('Companion:'));
    const companionHasShellTraits = companionLine
      ? /segmented armored shell|hard segmented/i.test(companionLine) &&
        /soft pink belly/i.test(companionLine) &&
        !/pi\s+ink/i.test(companionLine)
      : true;

    pageReports.push({
      pageNumber: page.pageNumber,
      wordCount: preview.wordCount,
      hasHebrew,
      hasMichal,
      hasBadChildName,
      hasFramingFloor,
      hasCloseUp,
      styleLineNoWarmCast,
      styleLineNeutralWb,
      wordCountInRange,
      negativeHasAntiCrop,
      companionHasShellTraits,
    });

    await writeFile(
      path.join(reportDir, `page-${String(page.pageNumber).padStart(2, '0')}-prompt.txt`),
      `${prompt}\n\n--- word count: ${preview.wordCount} ---\n\n--- negative ---\n${preview.negativePrompt}\n`,
      'utf8'
    );
  }

  const allEnglish = pageReports.every((r) => !r.hasHebrew);
  const allMichal = pageReports.every((r) => r.hasMichal && !r.hasBadChildName);
  const allFraming = pageReports.every((r) => r.hasFramingFloor);
  const noCloseUp = pageReports.every((r) => !r.hasCloseUp);
  const allStyleDeWarmed = pageReports.every((r) => r.styleLineNoWarmCast && r.styleLineNeutralWb);
  const allWordCount = pageReports.every((r) => r.wordCountInRange);
  const allAntiCrop = pageReports.every((r) => r.negativeHasAntiCrop);
  const allShellTraits = pageReports.every((r) => r.companionHasShellTraits);
  const page1Words = pageReports.find((r) => r.pageNumber === 1)?.wordCount ?? 0;

  await writeFile(
    path.join(reportDir, 'gate-summary.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        page1WordCount: page1Words,
        storyboardShotTypes: [...shotTypes],
        checks: {
          zeroHebrewAllPages: allEnglish,
          childNameMichalAllPages: allMichal,
          framingFloorAllPages: allFraming,
          noCloseUpLiteral: noCloseUp,
          styleLineNoWarmCastAllPages: allStyleDeWarmed,
          wordCount70to130AllPages: allWordCount,
          negativeAntiCropAllPages: allAntiCrop,
          companionShellTraits: allShellTraits,
        },
        pages: pageReports,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  console.log('=== Prompts-only gate (pre-render fix pass) ===\n');
  console.log('--- Page 1 full prompt ---\n');
  console.log(page1FullPrompt);
  console.log(`\nPage-1 word count: ${page1Words} (target 70–130)\n`);
  console.log('--- Page 1 negative (excerpt) ---\n');
  console.log(page1NegativePrompt.slice(0, 400) + (page1NegativePrompt.length > 400 ? '…' : ''));
  console.log('\n--- Confirmations (all pages) ---');
  console.log(`Framing floor on every page: ${allFraming ? 'PASS' : 'FAIL'}`);
  console.log(`No literal "close-up": ${noCloseUp ? 'PASS' : 'FAIL'}`);
  console.log(`Style line de-warmed + neutral WB: ${allStyleDeWarmed ? 'PASS' : 'FAIL'}`);
  console.log(`Word count 70–130: ${allWordCount ? 'PASS' : 'FAIL'}`);
  console.log(`Negative anti-crop terms: ${allAntiCrop ? 'PASS' : 'FAIL'}`);
  console.log(`Zero Hebrew: ${allEnglish ? 'PASS' : 'FAIL'}`);
  console.log(`Child name Michal only: ${allMichal ? 'PASS' : 'FAIL'}`);
  console.log(`Companion armadillo shell traits: ${allShellTraits ? 'PASS' : 'FAIL'}`);
  console.log(`\nPer-page reports: ${reportDir}`);

  if (
    !allEnglish ||
    !allMichal ||
    !allFraming ||
    !noCloseUp ||
    !allStyleDeWarmed ||
    !allWordCount ||
    !allAntiCrop ||
    !allShellTraits
  ) {
    process.exit(1);
  }
}

async function main() {
  const raw = await readFile(STORY_PATH, 'utf8');
  let { title, pages } = parseExperimentStory(raw);
  const maxPages = parseMaxPagesArg(process.argv);
  if (maxPages !== null) {
    pages = pages.slice(0, maxPages);
  }
  console.log('=== Flux Style-01 Clean-Prompt Experiment ===');
  console.log(`Story: "${title}" — ${pages.length} pages`);
  console.log(`Compare A/B to: image-experiment-1/bedtime-2026-05-24-exp1-0413959e/\n`);

  if (PROMPTS_ONLY) {
    await runPromptsOnlyGate(pages);
    return;
  }

  if (process.env.DISABLE_IMAGE_GENERATION === 'true') {
    console.error(
      'DISABLE_IMAGE_GENERATION=true — set it to false (or unset) for real Replicate renders.'
    );
    process.exit(1);
  }
  if (!process.env.REPLICATE_API_TOKEN?.trim()) {
    console.error('REPLICATE_API_TOKEN is required for full experiment run.');
    process.exit(1);
  }

  const arm = parseArmArg(process.argv);
  let armAOut: string | null = null;
  let armBOut: string | null = null;
  if (arm === 'A' || arm === 'both') {
    armAOut = await runArm('A', pages, title);
  }
  if (arm === 'B' || arm === 'both') {
    armBOut = await runArm('B', pages, title);
  }

  console.log('\n=== Experiment complete ===');
  if (armAOut) console.log(`Arm A (child input_images): ${armAOut}`);
  if (armBOut) console.log(`Arm B (no child photo):       ${armBOut}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
