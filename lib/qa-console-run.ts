import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { mkdtemp, rm, writeFile as writeFileFs } from 'fs/promises';
import { tmpdir } from 'os';
import { generateAllPageImages } from '@/backend/providers/image';
import {
  describeChildFromPhoto,
  generateStoryBankCharacterDNA,
  loadStoryFromBank,
} from '@/backend/providers/story-bank-loader';
import { callElevenLabs } from '@/backend/providers/audio';
import { getVoiceById, VOICES } from '@/backend/config/voices';
import { getCompanionById } from '@/lib/companions';
import { mergeGptImageReferenceSources } from '@/lib/image-reference-utils';
import { estimateGptImage2CostUsd } from '@/lib/pricing';
import { assembleStyle01Phase2Prompt } from '@/lib/style01-prompt-assembly';
import {
  DRAGON_DINI_COMPOSITION_BY_PAGE,
  DRAGON_DINI_RECURRING_OBJECT_CATALOG,
  isStyle01AuditionModeEnabled,
  isStyle01Phase2BookPipelineEnabled,
  resolveStyle01AuditionImageQuality,
  resolveStyle01GptModel,
  resolveStyle01RefBudgetConfig,
  shouldUseStyle01Phase2Path,
} from '@/lib/style01-gptimage';
import { resolveDefaultPageStoryState } from '@/lib/story-page-state-catalog';
import { reportStyle01ChildScaleViolations } from '@/lib/style01-child-scale-validator';
import { V3_COMPANION_BANK_CATEGORY } from '@/backend/providers/story-bank-index';
import {
  ChildPhotoUploadError,
  normalizePhotoUrlForVision,
} from '@/lib/child-photo-normalize';
import { storyPathForKey, storyFileForKey, parseStoryKey } from '@/lib/qa-console-stories';
import {
  QaAnchorReviewRequiredError,
  resolveQaConsoleChildReference,
} from '@/lib/qa-console-anchor';
import { storyFileKeyFromPath } from '@/lib/style01-story-wardrobe';
import {
  assertQaRenderWardrobeParity,
  buildQaImageGenerationLockFields,
  resolveQaBookLockContext,
  resolveQaPageLocationPlan,
  resolveQaPageShot,
} from '@/lib/qa-console-book-lock-context';
import { promptContainsSetTopologyLock } from '@/lib/story-location-bible/set-topology';
import { promptContainsSceneMemoryLock, writeSceneMemoryDriftReportFile } from '@/lib/scene-memory';
import {
  approveSetAppearanceBoardManifest,
  BOARD_MANIFEST_VERSION,
  buildAppearanceDriftReport,
  ensureSetAppearanceBoard,
  isSetAppearanceBoardUsable,
  loadSetAppearanceBoardManifest,
  promptContainsSetAppearanceLock,
  seedSceneAppearanceMemory,
  writeAppearanceDriftReportFile,
} from '@/lib/set-appearance';
import { measureImageToneStats } from '@/lib/book-color-normalize';
import { resolveStyle01StyleReferencePaths } from '@/lib/style01-gptimage';

import {
  estimateQaConsoleCostUsd,
  QA_CONSOLE_MAX_PAGES,
  QA_REPRESENTATIVE_PAGES,
} from '@/lib/qa-console-cost';

export { estimateQaConsoleCostUsd, QA_CONSOLE_MAX_PAGES, QA_REPRESENTATIVE_PAGES };
export const ILLUSTRATION_STYLE = 'soft_hand_drawn_storybook';
const PAGE_SOFT_TIMEOUT_MS = 4 * 60 * 1000;
const EST_AUDIO_USD_PER_PAGE = 0.008;

export type QaConsoleChildInput =
  | { preset: 'noam'; photoDataUrl?: string; photoPath?: string }
  | { preset: 'mia'; photoDataUrl?: string; photoPath?: string }
  | {
      name: string;
      gender: 'boy' | 'girl';
      age: number;
      photoPath?: string;
      photoDataUrl?: string;
    };

export type QaConsoleRunInput = {
  storyKey: string;
  pages: number[];
  child: QaConsoleChildInput;
  quality: 'low' | 'medium';
  voiceId?: string | null;
  generateAudio?: boolean;
  promptAuditOnly?: boolean;
  runLabelPrefix?: string;
  /** Approve a cached Stage 0 anchor (wardrobe-locked stories) and continue page render. */
  approveAnchorCacheKey?: string | null;
  /** Approve a QA-passed set appearance board for this scene id and attach it to page render. */
  approveSetAppearanceBoardSceneId?: string | null;
  /** Skip LLM gender/name personalization (v3-approved stories with pre-resolved chips). */
  skipLlmPersonalization?: boolean;
  /** DEV/QA-CONSOLE ONLY — bypasses day-clothes prompt audit during repro runs. Never set on production order/chunk path. */
  skipPromptAudit?: boolean;
  forceRegenerateAnchor?: boolean;
};

export type QaConsoleRunResult = {
  manifestDir: string;
  outputRoot: 'outputs/style01-auditions';
  manifestPath: string;
  previewUrl: string;
  model: string;
  quality: string;
  estimatedCostUsd: number;
  renderedPageNumbers: number[];
  failedPages: number[];
  runtimeMs: number;
};

const CHILD_PRESETS = {
  noam: { name: 'נועם', gender: 'boy' as const, age: 5 },
  mia: { name: 'מיה', gender: 'girl' as const, age: 8 },
};

const DAY_CLOTHES_LEFTOVER_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'sun t-shirt wardrobe', re: /plain solid sky-blue t-shirt with a small yellow sun/i },
  { label: 'denim shorts wardrobe', re: /Shorts: dark denim shorts/i },
  { label: 'red sneakers wardrobe', re: /Shoes: RED sneakers/i },
];

const DRAGON_DINI_OLD_STORY_PATTERNS: Array<{ label: string; re: RegExp }> = [
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

function resolveChildProfile(child: QaConsoleChildInput): {
  name: string;
  gender: 'boy' | 'girl';
  age: number;
  photoPath?: string;
  photoDataUrl?: string;
} {
  if ('preset' in child && child.preset === 'noam') {
    return {
      ...CHILD_PRESETS.noam,
      photoPath: child.photoPath,
      photoDataUrl: child.photoDataUrl,
    };
  }
  if ('preset' in child && child.preset === 'mia') {
    return {
      ...CHILD_PRESETS.mia,
      photoPath: child.photoPath,
      photoDataUrl: child.photoDataUrl,
    };
  }
  return {
    name: child.name.trim(),
    gender: child.gender,
    age: child.age,
    photoPath: child.photoPath,
    photoDataUrl: child.photoDataUrl,
  };
}

function assertHardGuards(requestedQuality: 'low' | 'medium'): void {
  process.env.STYLE_01_AUDITION_MODE = 'true';
  process.env.CHILD_ANCHOR_VARIANTS = '1';
  process.env.IMAGE_PROVIDER = 'gpt-image';
  process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
  process.env.STYLE01_QA_IMAGE_QUALITY = requestedQuality;

  if (!process.env.STYLE_01_GPT_MODEL?.trim()) {
    process.env.STYLE_01_GPT_MODEL = 'gpt-image-2';
  }

  const errors: string[] = [];
  const provider = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  const model = resolveStyle01GptModel();
  let quality: string;
  try {
    quality = resolveStyle01AuditionImageQuality();
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
  if (quality !== requestedQuality) {
    errors.push(`STYLE01_QA_IMAGE_QUALITY must be ${requestedQuality} (got ${quality})`);
  }
  if (!isStyle01AuditionModeEnabled()) errors.push('STYLE_01_AUDITION_MODE must be true');

  if (errors.length) {
    throw new Error(`QA console aborted before spend:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}

function promptTextForOldStoryScan(prompt: string): string {
  return prompt
    .split('\n')
    .filter((line) => !/^\s*NEVER\b/i.test(line) && !/that was the old story/i.test(line))
    .join('\n');
}

function auditPrompt(
  prompt: string,
  pageNumber: number,
  companionId: string,
  auditCtx?: { direction?: string; timeOfDay?: string; storyFile?: string }
): { hits: string[]; warnings: string[] } {
  const hits: string[] = [];
  const warnings: string[] = [];
  const isNightBedtimeStory =
    auditCtx?.direction === 'bedtime' ||
    auditCtx?.timeOfDay === 'night' ||
    auditCtx?.storyFile?.includes('_bedtime') ||
    companionId === 'dragon_dini';

  const scanned = promptTextForOldStoryScan(prompt);

  if (companionId === 'dragon_dini') {
    for (const { label, re } of DRAGON_DINI_OLD_STORY_PATTERNS) {
      if (re.test(scanned)) hits.push(`${label} (page ${pageNumber})`);
    }
  }

  if (isNightBedtimeStory) {
    for (const { label, re } of DAY_CLOTHES_LEFTOVER_PATTERNS) {
      if (re.test(scanned)) hits.push(`${label} (page ${pageNumber})`);
    }
    if (!/\bpajama|slipper-sock|nightwear|two-piece pajamas\b/i.test(prompt)) {
      warnings.push(`missing explicit nightwear/pajama wording (page ${pageNumber}) — warning only`);
    }
  }

  if (companionId === 'dragon_dini' && /\bcave ceiling\b/i.test(prompt)) {
    hits.push(`cave ceiling framing residue (page ${pageNumber})`);
  }
  if (companionId === 'dragon_dini') {
    let mustHave: RegExp[] = [];
    if (pageNumber === 20) {
      mustHave = [/yellow blanket/i, /EXACTLY ONE/i, /EMPTY hands|NO pacifier/i, /3\/4|gentle 3\/4/i, /BIRDS/i];
    } else if (pageNumber === 15) {
      mustHave = [/NOT a cave/i, /large-dog|golden-retriever|SAME relative size/i, /PARTIALLY|partially/i, /BIRDS/i];
    } else if (pageNumber === 16) {
      mustHave = [/moss-green/i, /copper freckles/i];
    }
    for (const re of mustHave) {
      if (!re.test(prompt)) hits.push(`missing expected rewrite cue ${re} (page ${pageNumber})`);
    }
  }
  return { hits, warnings };
}

function assertChildPhotoDescriptionQuality(description: string): void {
  const trimmed = description.trim();
  if (trimmed.length < 40) {
    throw new Error(
      'Photo description was too short — upload another photo or check Vision API keys'
    );
  }
  const lower = trimmed.toLowerCase();
  const featureTokens = [
    'skin',
    'hair',
    'face',
    'eye',
    'cheek',
    'brow',
    'freckle',
    'dimple',
    'curl',
    'straight',
    'wavy',
    'oval',
    'round',
    'almond',
  ];
  const hits = featureTokens.filter((t) => lower.includes(t));
  if (hits.length < 2) {
    throw new Error('Photo description lacks face/hair/skin cues — not photo-faithful');
  }
  if (/\btypical (young )?child\b|\bgeneric\b|\bany child\b/i.test(trimmed)) {
    throw new Error('Photo description looks generic — fix before rendering');
  }
}

async function resolvePhotoDescription(
  outDir: string,
  photoPath?: string,
  photoDataUrl?: string
): Promise<string | null> {
  if (!photoPath?.trim() && !photoDataUrl?.trim()) return null;
  const source = photoDataUrl?.trim() || photoPath!.trim();
  let visionUrl: string;
  try {
    visionUrl = await normalizePhotoUrlForVision(source);
  } catch (err) {
    if (err instanceof ChildPhotoUploadError) throw err;
    throw new ChildPhotoUploadError();
  }
  const description = await describeChildFromPhoto(visionUrl);
  if (!description?.trim()) {
    throw new Error('Could not describe child photo — check Vision API keys');
  }
  assertChildPhotoDescriptionQuality(description);
  await writeFile(path.join(outDir, 'child-photo-description.local.txt'), description.trim(), 'utf-8');
  return description.trim();
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  const { readFile, writeFile: wf } = await import('fs/promises');
  if (existsSync(url)) {
    await wf(destPath, await readFile(url));
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  await wf(destPath, Buffer.from(await res.arrayBuffer()));
}

function formatOutDir(prefix: string): string {
  const d = new Date();
  const ymd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const hms = d.toISOString().slice(11, 19).replace(/:/g, '');
  return path.join(process.cwd(), 'outputs', 'style01-auditions', `${prefix}-${ymd}-${hms}`);
}

export function friendlyQaError(err: unknown): string {
  if (err instanceof QaAnchorReviewRequiredError) return err.message;
  if (err instanceof ChildPhotoUploadError) return err.message;
  if (err instanceof Error) {
    if (err.message.startsWith('ABORT:')) return err.message.replace(/^ABORT:\s*/, '');
    return err.message;
  }
  return 'QA run failed';
}

export async function runQaConsoleRender(input: QaConsoleRunInput): Promise<QaConsoleRunResult> {
  const pages = [...new Set(input.pages)].sort((a, b) => a - b);
  if (!pages.length) throw new Error('Select at least one page');
  if (pages.length > QA_CONSOLE_MAX_PAGES) {
    throw new Error(`Maximum ${QA_CONSOLE_MAX_PAGES} pages per QA run (requested ${pages.length})`);
  }

  assertHardGuards(input.quality);

  const storyFile = storyFileForKey(input.storyKey);
  const storyPath = storyPathForKey(input.storyKey);
  const { baseKey } = parseStoryKey(input.storyKey);
  const [, companionId, direction] = baseKey.match(/^(.+)_(bedtime|adventure|fantasy)$/) ?? [];
  if (!companionId || !direction) throw new Error('Invalid story key');

  const companion = getCompanionById(companionId);
  if (!companion) throw new Error(`Companion not found: ${companionId}`);

  if (companionId === 'dragon_dini') {
    if (!DRAGON_DINI_RECURRING_OBJECT_CATALOG.green_speckled_egg?.length) {
      throw new Error('DRAGON_DINI_RECURRING_OBJECT_CATALOG.green_speckled_egg missing');
    }
    for (let p = 1; p <= 20; p++) {
      if (!DRAGON_DINI_COMPOSITION_BY_PAGE[p]) {
        throw new Error(`DRAGON_DINI_COMPOSITION_BY_PAGE missing page ${p}`);
        break;
      }
    }
    reportStyle01ChildScaleViolations({ log: (line) => console.warn(line) });
  }

  const child = resolveChildProfile(input.child);
  const prefix = input.runLabelPrefix?.trim() || `qa-console-${companionId}-${direction}-${input.quality}`;
  const outDir = formatOutDir(prefix);
  await mkdir(outDir, { recursive: true });

  let tempPhotoDir: string | null = null;
  let childPhotoPath = child.photoPath;
  try {
    if (child.photoDataUrl?.trim()) {
      tempPhotoDir = await mkdtemp(path.join(tmpdir(), 'qa-child-photo-'));
      const normalized = await normalizePhotoUrlForVision(child.photoDataUrl.trim());
      const b64 = normalized.replace(/^data:image\/jpeg;base64,/, '');
      childPhotoPath = path.join(tempPhotoDir, 'child.jpg');
      await writeFileFs(childPhotoPath, Buffer.from(b64, 'base64'));
    }

    const story = await loadStoryFromBank(
      storyPath,
      child.name,
      companion.name,
      child.gender,
      {
        maxPages: Math.max(...pages),
        skipLlmPersonalization: input.skipLlmPersonalization,
      }
    );

    const pagesToRender = story.pages.filter((p) => pages.includes(p.pageNumber));
    if (pagesToRender.length !== pages.length) {
      throw new Error(
        `Story missing pages: wanted ${pages.join(',')}, got ${pagesToRender.map((p) => p.pageNumber).join(',')}`
      );
    }

    const childPhotoDescription = await resolvePhotoDescription(
      outDir,
      childPhotoPath,
      child.photoDataUrl
    );

    const dna = await generateStoryBankCharacterDNA({
      childName: child.name,
      childGender: child.gender,
      childAge: child.age,
      companionName: companion.name,
      storyText: pagesToRender.map((p) => p.text).join('\n'),
      illustrationStyle: ILLUSTRATION_STYLE,
      childPhotoDescription,
    });

    const storyFileKey = storyFileKeyFromPath(baseKey) ?? baseKey;
    const lockContext = resolveQaBookLockContext({
      storyPath,
      storyFileKey,
      direction: direction as 'bedtime' | 'adventure' | 'fantasy',
      challengeCategory: V3_COMPANION_BANK_CATEGORY[companionId] ?? 'GENERAL_FEARS',
      pages: story.pages,
      storyTimeOfDay: story.storyTimeOfDay,
      pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
    });
    const imageLockFields = buildQaImageGenerationLockFields(lockContext);
    const sceneAppearance = seedSceneAppearanceMemory({
      sceneMemory: lockContext.sceneMemoryPlan?.memory ?? null,
      locationBible: lockContext.storyLocationPlan.bible,
    });
    let setAppearanceBoardPath: string | null = null;
    if (sceneAppearance && process.env.SET_APPEARANCE_BOARD_ENABLED !== 'false') {
      const existing = loadSetAppearanceBoardManifest(sceneAppearance.sceneId);
      const styleRefs = resolveStyle01StyleReferencePaths('fantasy-cave-night', 1);
      const forceRegenerate = process.env.SET_APPEARANCE_BOARD_FORCE_REGENERATE === 'true';
      const keepExisting =
        existing?.boardVersion === BOARD_MANIFEST_VERSION && existing.qaPassed;
      const boardManifest = await ensureSetAppearanceBoard({
        appearance: sceneAppearance,
        styleRefPaths: styleRefs,
        existing: keepExisting ? existing : null,
        quality: input.quality,
        forceRegenerate,
      });
      if (input.approveSetAppearanceBoardSceneId?.trim() === sceneAppearance.sceneId && boardManifest.qaPassed) {
        approveSetAppearanceBoardManifest(sceneAppearance.sceneId);
      }
      const refreshed = loadSetAppearanceBoardManifest(sceneAppearance.sceneId);
      if (isSetAppearanceBoardUsable(refreshed)) {
        setAppearanceBoardPath = refreshed!.boardPath;
        console.log(`[qa-console] set appearance board (approved): ${setAppearanceBoardPath}`);
      } else {
        console.warn(
          `[qa-console] set appearance board pending — qaPassed=${boardManifest.qaPassed} approved=${boardManifest.approved}; fixed objects via TEXT on non-state pages`
        );
      }
    }

    const promptsDir = path.join(outDir, 'prompts');
    await mkdir(promptsDir, { recursive: true });
    const allHits: string[] = [];
    const allWarnings: string[] = [];
    const auditCtx = {
      direction,
      timeOfDay: story.storyTimeOfDay,
      storyFile: baseKey,
    };
    for (const page of pagesToRender) {
      const assembled = assembleStyle01Phase2Prompt({
        pageNumber: page.pageNumber,
        pagePrompt: page.imagePrompt,
        rawScenePrompt: page.rawScenePrompt,
        bookPageText: page.text,
        childFirstName: child.name,
        childAge: child.age,
        childGender: child.gender,
        childDescription: dna.childDNA,
        childStructured: dna.childStructured,
        companion,
        companionStructured: dna.companionStructured,
        pageStoryState: resolveDefaultPageStoryState(companion.id, page.pageNumber),
        storyFile: storyFileKey,
        direction,
        storyTimeOfDay: story.storyTimeOfDay,
        pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
        pageShot: resolveQaPageShot(lockContext.bookShotPlan, page.pageNumber),
        pageLocationPlan: resolveQaPageLocationPlan(lockContext.storyLocationPlan, page.pageNumber),
        locationBible: lockContext.storyLocationPlan.bible,
        sceneMemory: lockContext.sceneMemoryPlan?.memory ?? null,
        sceneAppearance,
        challengeCategory: V3_COMPANION_BANK_CATEGORY[companionId] ?? 'GENERAL_FEARS',
      });
      const prompt = assembled.prompt;
      await writeFile(
        path.join(promptsDir, `page-${String(page.pageNumber).padStart(2, '0')}-prompt.txt`),
        prompt,
        'utf-8'
      );
      const audit = auditPrompt(prompt, page.pageNumber, companion.id, auditCtx);
      allHits.push(...audit.hits);
      allWarnings.push(...audit.warnings);
    }
    for (const w of [...new Set(allWarnings)]) {
      console.warn(`[qa-console] ${w}`);
    }
    if (allHits.length && !input.skipPromptAudit) {
      throw new Error(
        `Prompt audit failed:\n${[...new Set(allHits)].map((h) => `  - ${h}`).join('\n')}`
      );
    }

    if (input.promptAuditOnly) {
      const manifestDir = path.basename(outDir);
      return {
        manifestDir,
        outputRoot: 'outputs/style01-auditions',
        manifestPath: path.join(outDir, 'manifest.json'),
        previewUrl: `/dev/viewer?dir=${encodeURIComponent(manifestDir)}&root=outputs`,
        model: resolveStyle01GptModel(),
        quality: input.quality,
        estimatedCostUsd: estimateQaConsoleCostUsd(pages.length, input.quality, Boolean(input.generateAudio)),
        renderedPageNumbers: [],
        failedPages: [],
        runtimeMs: 0,
      };
    }

    let childPhotoUrlForRefs = '';
    if (childPhotoPath && (existsSync(childPhotoPath) || childPhotoPath.startsWith('http'))) {
      childPhotoUrlForRefs = await normalizePhotoUrlForVision(
        child.photoDataUrl?.trim() || childPhotoPath
      );
    } else if (child.photoDataUrl?.trim()) {
      childPhotoUrlForRefs = await normalizePhotoUrlForVision(child.photoDataUrl.trim());
    }

    const childRef = await resolveQaConsoleChildReference({
      companionId,
      storyFileKey,
      child: { name: child.name, gender: child.gender, age: child.age },
      childPhotoUrl: childPhotoUrlForRefs,
      photoPath: childPhotoPath,
      photoDataUrl: child.photoDataUrl,
      lockedChildDescription: dna.childDNA,
      childPhotoDescription,
      approveAnchorCacheKey: input.approveAnchorCacheKey,
      forceRegenerateAnchor: input.forceRegenerateAnchor,
    });

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const referenceImages =
      mergeGptImageReferenceSources(childRef.childRefUrl, companion, appBaseUrl) ?? [];

    const orderId = `qa-console-${randomUUID().slice(0, 8)}`;
    const companionKey = `companion:${companion.id}`;
    const startedAt = Date.now();
    const q = resolveStyle01AuditionImageQuality();
    const model = resolveStyle01GptModel();

    for (const page of pagesToRender) {
      const renderPrompt = assembleStyle01Phase2Prompt({
        pageNumber: page.pageNumber,
        pagePrompt: page.imagePrompt,
        rawScenePrompt: page.rawScenePrompt,
        bookPageText: page.text,
        childFirstName: child.name,
        childAge: child.age,
        childGender: child.gender,
        childDescription: dna.childDNA,
        childStructured: dna.childStructured,
        companion,
        companionStructured: dna.companionStructured,
        pageStoryState: resolveDefaultPageStoryState(companion.id, page.pageNumber),
        storyFile: storyFileKey,
        direction,
        storyTimeOfDay: story.storyTimeOfDay,
        pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
        pageShot: resolveQaPageShot(lockContext.bookShotPlan, page.pageNumber),
        pageLocationPlan: resolveQaPageLocationPlan(lockContext.storyLocationPlan, page.pageNumber),
        locationBible: lockContext.storyLocationPlan.bible,
        sceneMemory: lockContext.sceneMemoryPlan?.memory ?? null,
        sceneAppearance,
        challengeCategory: V3_COMPANION_BANK_CATEGORY[companionId] ?? 'GENERAL_FEARS',
      }).prompt;
      assertQaRenderWardrobeParity(renderPrompt, {
        companionId: companion.id,
        storyFile: storyFileKey,
        pageNumber: page.pageNumber,
        storyTimeOfDay: story.storyTimeOfDay,
        challengeCategory: V3_COMPANION_BANK_CATEGORY[companionId] ?? 'GENERAL_FEARS',
      });
    }

    const { results, failedPages } = await generateAllPageImages(
      pagesToRender.map((page) => ({
        pageNumber: page.pageNumber,
        imagePrompt: page.imagePrompt,
        rawScenePrompt: page.rawScenePrompt,
        bookPageText: page.text,
        expectedCharacterIds: ['child', companionKey] as string[],
      })),
      {
        illustrationStyle: ILLUSTRATION_STYLE,
        childName: child.name,
        childAge: child.age,
        childGender: child.gender,
        childDescription: dna.childDNA,
        referenceImages,
        orderId,
        companion,
        directionArchetype: direction as 'bedtime' | 'adventure' | 'fantasy',
        challengeCategory: V3_COMPANION_BANK_CATEGORY[companionId] ?? 'GENERAL_FEARS',
        childStructured: dna.childStructured,
        companionStructured: dna.companionStructured,
        propDNA: dna.propDNA,
        extraNegativeRules: dna.negativeRules,
        pageGenerationTimeoutMs: PAGE_SOFT_TIMEOUT_MS,
        ...imageLockFields,
        sceneAppearance,
        setAppearanceBoardPath,
      }
    );

    const voiceId = input.voiceId?.trim() || null;
    const voice = voiceId ? getVoiceById(voiceId) : undefined;

    const manifestPages: Array<Record<string, unknown>> = [];
    let totalEstimatedCostUsd = 0;
    const renderedPageNumbers: number[] = [];

    for (const page of pagesToRender) {
      const image = results.get(page.pageNumber);
      const localPath = path.join(outDir, `page-${String(page.pageNumber).padStart(2, '0')}.png`);
      const promptPath = path.join(
        promptsDir,
        `page-${String(page.pageNumber).padStart(2, '0')}-prompt.txt`
      );

      if (image?.url) {
        await downloadImage(image.url, localPath);
        renderedPageNumbers.push(page.pageNumber);
      }

      const usage = (image as { style01Meta?: { usage?: Record<string, unknown> } } | undefined)
        ?.style01Meta?.usage;
      const style01Meta = (
        image as {
          style01Meta?: {
            usage?: Record<string, unknown>;
            setTopologyLockPresent?: boolean;
            setRefsRequested?: string[];
            setRefsPassed?: string[];
            setRefsDropped?: string[];
            sceneId?: string | null;
            sceneMemoryLockPresent?: boolean;
            sceneMemoryDriftReport?: import('@/lib/scene-memory/types').SceneMemoryDriftReport | null;
            setAppearanceLockPresent?: boolean;
            setAppearanceBoardAttached?: boolean;
            appearanceDriftReport?: import('@/lib/set-appearance/types').AppearanceDriftReport | null;
          };
        }
      )?.style01Meta;
      const cost = estimateGptImage2CostUsd(usage);
      if (cost.estimatedCostUsd != null) totalEstimatedCostUsd += cost.estimatedCostUsd;

      const resolvedModel = (image as { model?: string } | undefined)?.model ?? image?.provider ?? 'failed';
      if (resolvedModel !== model && image?.url) {
        throw new Error(`Page ${page.pageNumber} model ${resolvedModel} !== expected ${model}`);
      }

      let audioLocalPath: string | null = null;
      let audioUrl: string | null = null;
      if (input.generateAudio && voice && page.narrationText?.trim()) {
        const audioBuf = await callElevenLabs(
          page.narrationText.trim().replace(/\./g, '... ').replace(/,/g, ',  '),
          voice.elevenlabsVoiceId
        );
        audioLocalPath = path.join(outDir, `page-${String(page.pageNumber).padStart(2, '0')}.mp3`);
        await writeFile(audioLocalPath, audioBuf);
        audioUrl = `/api/dev/style01-book-preview/asset?dir=${encodeURIComponent(path.basename(outDir))}&page=${page.pageNumber}&kind=audio`;
        totalEstimatedCostUsd += EST_AUDIO_USD_PER_PAGE;
      }

      manifestPages.push({
        pageNumber: page.pageNumber,
        hebrewText: page.text,
        narrationText: page.narrationText,
        imageDirection: page.rawScenePrompt,
        finalPrompt: image?.prompt ?? '(no prompt returned)',
        model: resolvedModel,
        quality: q,
        provider: 'gpt-image',
        style: 'style01',
        promptPath: path.relative(process.cwd(), promptPath),
        imageUrl: image?.url ?? null,
        localPng: existsSync(localPath) ? localPath : null,
        audioUrl,
        localMp3: audioLocalPath,
        failed: !image || failedPages.includes(page.pageNumber),
        renderStatus:
          image?.url && !failedPages.includes(page.pageNumber) ? 'rendered' : 'not rendered in this audition',
        usage: usage ?? null,
        estimatedCostUsd: cost.estimatedCostUsd,
        setTopologyLockPresent:
          style01Meta?.setTopologyLockPresent ??
          promptContainsSetTopologyLock(image?.prompt ?? ''),
        setRefsRequested: style01Meta?.setRefsRequested ?? [],
        setRefsPassed: style01Meta?.setRefsPassed ?? [],
        setRefsDropped: style01Meta?.setRefsDropped ?? [],
        sceneId: style01Meta?.sceneId ?? lockContext.sceneMemoryPlan?.memory.sceneId ?? null,
        sceneMemoryLockPresent:
          style01Meta?.sceneMemoryLockPresent ??
          promptContainsSceneMemoryLock(image?.prompt ?? ''),
        sceneMemoryDriftReport: style01Meta?.sceneMemoryDriftReport ?? null,
        setAppearanceLockPresent:
          style01Meta?.setAppearanceLockPresent ??
          promptContainsSetAppearanceLock(image?.prompt ?? ''),
        setAppearanceBoardAttached: style01Meta?.setAppearanceBoardAttached ?? Boolean(setAppearanceBoardPath),
      });

      const driftReport = style01Meta?.sceneMemoryDriftReport;
      if (driftReport) {
        const driftPath = await writeSceneMemoryDriftReportFile(outDir, driftReport);
        manifestPages[manifestPages.length - 1].sceneMemoryDriftPath = path.relative(
          process.cwd(),
          driftPath
        );
      }
    }

    const pageLuminances = new Map<number, number>();
    for (const mp of manifestPages) {
      const localPng = mp.localPng as string | null | undefined;
      if (!localPng) continue;
      const buf = await readFile(localPng);
      pageLuminances.set(mp.pageNumber as number, (await measureImageToneStats(buf)).luminance);
    }
    const lumValues = [...pageLuminances.values()];
    const bookMeanLuminance =
      lumValues.length > 0 ? lumValues.reduce((a, b) => a + b, 0) / lumValues.length : null;
    for (let i = 0; i < manifestPages.length; i++) {
      const driftReport = manifestPages[i].sceneMemoryDriftReport as
        | import('@/lib/scene-memory/types').SceneMemoryDriftReport
        | null
        | undefined;
      if (!driftReport) continue;
      const pageNum = manifestPages[i].pageNumber as number;
      const pageLum = pageLuminances.get(pageNum);
      const appearanceReport = buildAppearanceDriftReport({
        sceneMemoryDrift: driftReport,
        pageLuminanceDelta:
          bookMeanLuminance != null && pageLum != null ? pageLum - bookMeanLuminance : null,
      });
      const appearancePath = await writeAppearanceDriftReportFile(outDir, appearanceReport);
      manifestPages[i].appearanceDriftReport = appearanceReport;
      manifestPages[i].appearanceDriftPath = path.relative(process.cwd(), appearancePath);
    }

    const allStoryPages = story.pages
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((p) => {
        const rendered = manifestPages.find((m) => m.pageNumber === p.pageNumber);
        return {
          pageNumber: p.pageNumber,
          hebrewText: p.text,
          narrationText: p.narrationText,
          renderStatus: rendered
            ? rendered.failed
              ? 'not rendered in this audition'
              : 'rendered'
            : 'not rendered in this audition',
          imageUrl: rendered && !rendered.failed ? (rendered.imageUrl as string | null) : null,
          localPng: rendered?.localPng ?? null,
          audioUrl: rendered?.audioUrl ?? null,
          localMp3: rendered?.localMp3 ?? null,
        };
      });

    const manifestDir = path.basename(outDir);
    const manifest = {
      audition: 'qa-console',
      qaConsole: true,
      storyKey: input.storyKey,
      storyFile,
      companionId,
      direction,
      childProfile: {
        name: child.name,
        gender: child.gender,
        age: child.age,
        photoFaithful: Boolean(childPhotoDescription),
        preset: 'preset' in input.child ? input.child.preset : undefined,
        stage0AnchorCacheKey: childRef.anchorCacheKey,
        usedApprovedStage0Anchor: childRef.usedApprovedAnchor,
      },
      voiceId: voiceId ?? undefined,
      model,
      quality: q,
      provider: 'gpt-image',
      style: 'style01',
      illustrationStyle: ILLUSTRATION_STYLE,
      refConfig: resolveStyle01RefBudgetConfig(),
      setAppearanceBoardPath,
      sceneAppearanceSceneId: sceneAppearance?.sceneId ?? null,
      orderId,
      manifestDir,
      outputRoot: 'outputs/style01-auditions',
      totalStoryPages: story.pages.length,
      renderedPageNumbers,
      previewUrl: `/dev/viewer?dir=${encodeURIComponent(manifestDir)}&root=outputs`,
      runtimeMs: Date.now() - startedAt,
      failedPages,
      totalEstimatedCostUsd:
        totalEstimatedCostUsd > 0
          ? totalEstimatedCostUsd
          : estimateQaConsoleCostUsd(pages.length, input.quality, Boolean(input.generateAudio)),
      pages: manifestPages,
      allStoryPages,
    };

    await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    if (failedPages.length) {
      throw new Error(`Image generation failed for pages: ${failedPages.join(', ')}`);
    }

    return {
      manifestDir,
      outputRoot: 'outputs/style01-auditions',
      manifestPath: path.join(outDir, 'manifest.json'),
      previewUrl: manifest.previewUrl,
      model,
      quality: q,
      estimatedCostUsd: manifest.totalEstimatedCostUsd as number,
      renderedPageNumbers,
      failedPages,
      runtimeMs: manifest.runtimeMs as number,
    };
  } finally {
    if (tempPhotoDir) {
      await rm(tempPhotoDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export function listQaConsoleVoices() {
  return VOICES.map((v) => ({
    id: v.id,
    label: v.label,
    description: v.description,
    emoji: v.emoji,
  }));
}
