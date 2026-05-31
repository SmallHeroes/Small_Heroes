/**
 * Style 01 + gpt-image-2 — dragon_dini boundary-egg LOW selective audition.
 *
 * Env (audition — do NOT set GPT_IMAGE_QUALITY):
 *   STYLE01_QA_IMAGE_QUALITY=low
 *   STYLE_01_GPT_MODEL=gpt-image-2
 *   PHASE2_STYLE01_BOOK_PIPELINE=true
 *   IMAGE_PROVIDER=gpt-image
 *
 * Optional:
 *   ONLY_PAGES=1,6,10,13,15,16,20  (default)
 *   PROMPT_AUDIT_ONLY=true          (assemble prompts, no API spend)
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-style01-dini-audition.ts
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
import { mergeGptImageReferenceSources } from '../lib/image-reference-utils';
import { estimateGptImage2CostUsd } from '../lib/pricing';
import { assembleStyle01Phase2Prompt } from '../lib/style01-prompt-assembly';
import {
  DRAGON_DINI_COMPOSITION_BY_PAGE,
  DRAGON_DINI_RECURRING_OBJECT_CATALOG,
  isStyle01AuditionModeEnabled,
  isStyle01Phase2BookPipelineEnabled,
  resolveStyle01AuditionImageQuality,
  resolveStyle01GptModel,
  resolveStyle01RefBudgetConfig,
  shouldUseStyle01Phase2Path,
} from '../lib/style01-gptimage';
import { resolveDefaultPageStoryState } from '../lib/story-page-state-catalog';

const STORY_FILE = 'dragon_dini_fantasy.md';
const COMPANION_ID = 'dragon_dini';
const ILLUSTRATION_STYLE = 'soft_hand_drawn_storybook';
const CHILD_NAME = process.env.CHILD_NAME?.trim() || 'נועם';
const CHILD_AGE = Number.parseInt(process.env.CHILD_AGE?.trim() ?? '5', 10) || 5;
const CHILD_GENDER = (process.env.CHILD_GENDER?.trim() || 'boy') as 'boy' | 'girl';
const MAX_STORY_PAGES = 20;
/** Full selective set: 1,6,10,13,15,16,20. Re-audit after fixes: 1,13,15,20 only. */
const DEFAULT_RENDER_PAGES = [1, 13, 15, 20];
const PAGE_SOFT_TIMEOUT_MS = 4 * 60 * 1000;

const DAY_CLOTHES_LEFTOVER_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'sun t-shirt wardrobe', re: /\bsky-blue t-shirt with a small yellow sun\b/i },
  { label: 'denim shorts wardrobe', re: /\bdark denim shorts\b/i },
  { label: 'red sneakers wardrobe', re: /\bRED sneakers\b/i },
];

const OLD_STORY_LEFTOVER_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'glowing stone (old prop)', re: /\bglowing\s+stone\b/i },
  { label: 'warm stone (old prop)', re: /\bwarm\s+stone\b/i },
  { label: 'warming stone (old prop)', re: /\bwarming\s+stone\b/i },
  { label: 'on a glowing amber stone (old staging)', re: /\bon a glowing amber stone\b/i },
  { label: 'cave interior lock', re: /\bENVIRONMENT LOCK — CAVE INTERIOR\b/i },
  { label: 'blue speckled egg', re: /\bblue[\s-]*speckled\s+egg\b/i },
  { label: 'warmth.shared scene', re: /\bwarmth\.shared\b/i },
  { label: 'glowing_stone catalog key', re: /\bglowing_stone\b/ },
  { label: 'blue_speckled_egg catalog key', re: /\bblue_speckled_egg\b/ },
];

function resolveAuditionQuality(): string {
  return resolveStyle01AuditionImageQuality();
}

function parseOnlyPages(): number[] {
  const raw = process.env.ONLY_PAGES?.trim();
  if (!raw) return [...DEFAULT_RENDER_PAGES];
  return raw
    .split(/[,\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= MAX_STORY_PAGES);
}

function assertHardGuards(): void {
  process.env.STYLE_01_AUDITION_MODE = 'true';
  process.env.CHILD_ANCHOR_VARIANTS = '1';
  process.env.IMAGE_PROVIDER = 'gpt-image';
  process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
  if (!process.env.STYLE01_QA_IMAGE_QUALITY?.trim()) {
    process.env.STYLE01_QA_IMAGE_QUALITY = 'low';
  }
  if (!process.env.STYLE_01_GPT_MODEL?.trim()) {
    process.env.STYLE_01_GPT_MODEL = 'gpt-image-2';
  }

  const errors: string[] = [];
  const provider = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  const model = resolveStyle01GptModel();
  let quality: string;
  try {
    quality = resolveAuditionQuality();
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    quality = 'invalid';
  }

  if (provider !== 'gpt-image') errors.push(`IMAGE_PROVIDER must be gpt-image (got ${provider})`);
  if (!isStyle01Phase2BookPipelineEnabled()) {
    errors.push('PHASE2_STYLE01_BOOK_PIPELINE must be true');
  }
  if (!shouldUseStyle01Phase2Path(ILLUSTRATION_STYLE)) {
    errors.push('Style 01 phase-2 path not active for soft_hand_drawn_storybook');
  }
  if (model !== 'gpt-image-2') errors.push(`STYLE_01_GPT_MODEL must be gpt-image-2 (got ${model})`);
  if (quality !== 'low') errors.push(`STYLE01_QA_IMAGE_QUALITY must be low (got ${quality})`);
  if (!isStyle01AuditionModeEnabled()) errors.push('STYLE_01_AUDITION_MODE must be true');

  if (!DRAGON_DINI_RECURRING_OBJECT_CATALOG.green_speckled_egg?.length) {
    errors.push('DRAGON_DINI_RECURRING_OBJECT_CATALOG.green_speckled_egg missing');
  }
  for (let p = 1; p <= MAX_STORY_PAGES; p++) {
    if (!DRAGON_DINI_COMPOSITION_BY_PAGE[p]) {
      errors.push(`DRAGON_DINI_COMPOSITION_BY_PAGE missing page ${p}`);
      break;
    }
  }

  const forbiddenReplicate =
    process.env.IMAGE_PROVIDER_FALLBACK?.trim() ||
    process.env.FORCE_REPLICATE?.trim();
  if (forbiddenReplicate) {
    errors.push(`Replicate/flux fallback env set: ${forbiddenReplicate}`);
  }

  console.log('=== Hard guards ===');
  console.log(`  provider: ${provider}`);
  console.log(`  model: ${model}`);
  console.log(`  quality (STYLE01_QA): ${quality}`);
  console.log(`  style01 pipeline: ${isStyle01Phase2BookPipelineEnabled()}`);
  console.log(`  GPT_IMAGE_QUALITY (production, untouched): ${process.env.GPT_IMAGE_QUALITY ?? '(unset)'}`);

  if (errors.length) {
    throw new Error(`Audition aborted before spend:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}

/** Scan prompt body but skip negation lines (e.g. "NEVER on a glowing amber stone"). */
function promptTextForOldStoryScan(prompt: string): string {
  return prompt
    .split('\n')
    .filter((line) => !/^\s*NEVER\b/i.test(line) && !/that was the old story/i.test(line))
    .join('\n');
}

function auditPromptForOldStory(prompt: string, pageNumber: number): string[] {
  const scanned = promptTextForOldStoryScan(prompt);
  const hits: string[] = [];
  for (const { label, re } of [...OLD_STORY_LEFTOVER_PATTERNS, ...DAY_CLOTHES_LEFTOVER_PATTERNS]) {
    if (re.test(scanned)) hits.push(`${label} (page ${pageNumber})`);
  }
  if (/\bcave ceiling\b/i.test(prompt)) {
    hits.push(`cave ceiling framing residue (page ${pageNumber})`);
  }
  return hits;
}

function formatOutDir(): string {
  const d = new Date();
  const ymd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const hms = d.toISOString().slice(11, 19).replace(/:/g, '');
  return path.join(
    process.cwd(),
    'outputs',
    'style01-auditions',
    `dini-boundary-egg-low-${ymd}-${hms}`
  );
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

async function assembleAndAuditPrompts(
  outDir: string,
  pages: Array<{
    pageNumber: number;
    text: string;
    imagePrompt: string;
    rawScenePrompt?: string;
  }>,
  dna: Awaited<ReturnType<typeof generateStoryBankCharacterDNA>>,
  companion: NonNullable<ReturnType<typeof getCompanionById>>
): Promise<Map<number, string>> {
  const promptsDir = path.join(outDir, 'prompts');
  await mkdir(promptsDir, { recursive: true });

  const prompts = new Map<number, string>();
  const allHits: string[] = [];

  for (const page of pages) {
    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: page.pageNumber,
      pagePrompt: page.imagePrompt,
      rawScenePrompt: page.rawScenePrompt,
      bookPageText: page.text,
      childFirstName: CHILD_NAME,
      childAge: CHILD_AGE,
      childGender: CHILD_GENDER,
      childDescription: dna.childDNA,
      childStructured: dna.childStructured,
      companion,
      companionStructured: dna.companionStructured,
      pageStoryState: resolveDefaultPageStoryState(companion.id, page.pageNumber),
    });

    const prompt = assembled.prompt;
    prompts.set(page.pageNumber, prompt);

    const promptFile = path.join(
      promptsDir,
      `page-${String(page.pageNumber).padStart(2, '0')}-prompt.txt`
    );
    await writeFile(promptFile, prompt, 'utf-8');

    const hits = auditPromptForOldStory(prompt, page.pageNumber);
    allHits.push(...hits);

    let mustHave: RegExp[] = [];
    if (page.pageNumber === 20) {
      mustHave = [/yellow blanket/i, /pillow fortress|expanded/i, /BIRDS/i];
    } else if (page.pageNumber === 1) {
      mustHave = [/pillow fortress|pillow_fortress/i, /BIRDS/i];
    } else if (page.pageNumber === 13 || page.pageNumber === 15) {
      mustHave = [/BIRDS/i, /fabric|CLOTH/i];
    } else if (page.pageNumber === 16) {
      mustHave = [/moss-green/i, /copper freckles/i];
    }
    for (const re of mustHave) {
      if (!re.test(prompt)) {
        allHits.push(`missing expected rewrite cue ${re} (page ${page.pageNumber})`);
      }
    }

    console.log(`  [prompt audit] page ${page.pageNumber}: ${prompt.length} chars → ${path.relative(process.cwd(), promptFile)}`);
  }

  if (allHits.length) {
    throw new Error(
      `Old-story leftovers or prompt audit failures — fix before generation:\n${[...new Set(allHits)].map((h) => `  - ${h}`).join('\n')}`
    );
  }

  console.log(`\nPrompt audit passed (${pages.length} pages). Prompts: ${promptsDir}\n`);
  return prompts;
}

async function main(): Promise<void> {
  assertHardGuards();

  const onlyPages = parseOnlyPages();
  const promptAuditOnly = process.env.PROMPT_AUDIT_ONLY?.trim().toLowerCase() === 'true';

  const companion = getCompanionById(COMPANION_ID);
  if (!companion) throw new Error(`${COMPANION_ID} companion not found`);

  const storyPath = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', STORY_FILE);
  const outDir = formatOutDir();
  await mkdir(outDir, { recursive: true });

  console.log('=== Style 01 Dini boundary-egg LOW audition ===');
  console.log(`Model: ${resolveStyle01GptModel()} | Ref config: ${resolveStyle01RefBudgetConfig()}`);
  console.log(`Render pages: ${onlyPages.join(', ')} (story has ${MAX_STORY_PAGES} pages)`);
  console.log(`Output: ${outDir}`);
  if (promptAuditOnly) console.log('PROMPT_AUDIT_ONLY=true — no image API calls\n');

  const story = await loadStoryFromBank(
    storyPath,
    CHILD_NAME,
    companion.name,
    CHILD_GENDER,
    { maxPages: MAX_STORY_PAGES }
  );

  const pagesToRender = story.pages.filter((p) => onlyPages.includes(p.pageNumber));
  if (pagesToRender.length !== onlyPages.length) {
    throw new Error(
      `Story missing pages: wanted ${onlyPages.join(',')}, got ${pagesToRender.map((p) => p.pageNumber).join(',')}`
    );
  }

  const allText = pagesToRender.map((p) => p.text).join('\n');
  const dna = await generateStoryBankCharacterDNA({
    childName: CHILD_NAME,
    childGender: CHILD_GENDER,
    childAge: CHILD_AGE,
    companionName: companion.name,
    storyText: allText,
    illustrationStyle: ILLUSTRATION_STYLE,
  });

  await assembleAndAuditPrompts(outDir, pagesToRender, dna, companion);

  if (promptAuditOnly) {
    console.log('Done (prompt audit only).');
    return;
  }

  const childPhoto = process.env.CHILD_PHOTO_PATH?.trim();
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const referenceImages =
    childPhoto && (existsSync(childPhoto) || childPhoto.startsWith('http'))
      ? mergeGptImageReferenceSources(childPhoto, companion, appBaseUrl) ?? []
      : mergeGptImageReferenceSources(null, companion, appBaseUrl) ?? [];

  const orderId = `style01-dini-boundary-${randomUUID().slice(0, 8)}`;
  const companionKey = `companion:${companion.id}`;

  const pipelinePages = pagesToRender.map((page) => ({
    pageNumber: page.pageNumber,
    imagePrompt: page.imagePrompt,
    rawScenePrompt: page.rawScenePrompt,
    bookPageText: page.text,
    expectedCharacterIds: ['child', companionKey] as string[],
  }));

  const startedAt = Date.now();
  const q = resolveAuditionQuality();
  const model = resolveStyle01GptModel();

  console.log(`\nGenerating ${pagesToRender.length} pages at quality=${q} model=${model}…\n`);

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
  const renderedPageNumbers: number[] = [];

  for (const page of pagesToRender) {
    const image = results.get(page.pageNumber);
    const localPath = path.join(outDir, `page-${String(page.pageNumber).padStart(2, '0')}.png`);
    const promptPath = path.join(
      outDir,
      'prompts',
      `page-${String(page.pageNumber).padStart(2, '0')}-prompt.txt`
    );

    if (image?.url) {
      await downloadImage(image.url, localPath);
      renderedPageNumbers.push(page.pageNumber);
    }

    const meta = image as { style01Meta?: Record<string, unknown> } | undefined;
    const usage = meta?.style01Meta?.usage as Record<string, unknown> | undefined;
    const cost = estimateGptImage2CostUsd(usage);
    if (cost.estimatedCostUsd != null) {
      totalEstimatedCostUsd += cost.estimatedCostUsd;
    }

    const resolvedModel = (image as { model?: string } | undefined)?.model ?? image?.provider ?? 'failed';
    if (resolvedModel !== model && image?.url) {
      throw new Error(
        `[audition] BLOCKER: page ${page.pageNumber} model ${resolvedModel} !== expected ${model}`
      );
    }

    manifestPages.push({
      pageNumber: page.pageNumber,
      hebrewText: page.text,
      imageDirection: page.rawScenePrompt,
      finalPrompt: image?.prompt ?? '(no prompt returned)',
      model: resolvedModel,
      quality: q,
      provider: 'gpt-image',
      style: 'style01',
      promptPath: path.relative(process.cwd(), promptPath),
      sceneClass: meta?.style01Meta?.sceneClass ?? null,
      imageUrl: image?.url ?? null,
      localPng: existsSync(localPath) ? localPath : null,
      failed: !image || failedPages.includes(page.pageNumber),
      renderStatus: image?.url && !failedPages.includes(page.pageNumber) ? 'rendered' : 'not rendered in this audition',
      usage: usage ?? null,
      durationMs: meta?.style01Meta?.durationMs ?? null,
      estimatedCostUsd: cost.estimatedCostUsd,
      costRateSource: cost.costRateSource,
    });
  }

  const allStoryPages = story.pages
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((p) => {
      const rendered = manifestPages.find((m) => m.pageNumber === p.pageNumber);
      return {
        pageNumber: p.pageNumber,
        hebrewText: p.text,
        renderStatus: rendered
          ? (rendered.failed ? 'not rendered in this audition' : 'rendered')
          : 'not rendered in this audition',
        imageUrl: rendered && !rendered.failed ? (rendered.imageUrl as string | null) : null,
        localPng: rendered?.localPng ?? null,
      };
    });

  const manifest = {
    audition: 'style01-dini-boundary-egg-low',
    anchorMissingExpected: true,
    anchorMissingNote:
      'EXPECTED for this run: companion/child anchor election may log "anchor missing" — we are testing prompt-only locks. New female Dini + moss-green baby_dragon character sheets have NOT been regenerated yet (Q2 hypothesis). Not an error.',
    model,
    quality: q,
    provider: 'gpt-image',
    style: 'style01',
    illustrationStyle: ILLUSTRATION_STYLE,
    storyFile: STORY_FILE,
    refConfig: resolveStyle01RefBudgetConfig(),
    orderId,
    manifestDir: path.basename(outDir),
    outputRoot: 'outputs/style01-auditions',
    totalStoryPages: MAX_STORY_PAGES,
    renderedPageNumbers,
    previewUrl: `/dev/style01-book-preview?dir=${encodeURIComponent(path.basename(outDir))}&root=outputs`,
    runtimeMs: Date.now() - startedAt,
    failedPages,
    totalEstimatedCostUsd: totalEstimatedCostUsd > 0 ? totalEstimatedCostUsd : null,
    pages: manifestPages,
    allStoryPages,
    acceptanceChecklist: [
      'Bird-print pajamas identical on all child pages (NOT sun shirt / denim / red sneakers)',
      'p1: same child face as rest; plastic toy clearly non-green and inanimate',
      'p13: silver ribbon = soft cloth fabric, NOT metal',
      'p15: soft orange-moss nest nook — NO cave; Dini mid-sized with ONE tail',
      'p20: EXACTLY ONE child at crib; expanded fort in background only',
      'anchor missing in logs = EXPECTED until new character sheets',
    ],
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n=== Done ===');
  console.log(`Manifest: ${path.join(outDir, 'manifest.json')}`);
  console.log(`Prompts: ${path.join(outDir, 'prompts')}`);
  console.log(`Failed pages: ${failedPages.length ? failedPages.join(', ') : 'none'}`);
  console.log(`Quality: ${q} | Model: ${model}`);
  console.log(
    `Est. cost: ${manifest.totalEstimatedCostUsd != null ? `$${manifest.totalEstimatedCostUsd.toFixed(3)}` : 'unset'}`
  );
  for (const p of manifestPages) {
    console.log(`  page ${p.pageNumber}: ${p.localPng ?? p.imageUrl ?? 'FAILED'}`);
  }
  console.log(
    `Preview: http://localhost:3000/dev/style01-book-preview?dir=${encodeURIComponent(path.basename(outDir))}&root=outputs`
  );

  if (failedPages.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
