import fs from 'fs/promises';
import type { GeneratedStory, ShotVisualDirection, StoryPage } from './pipeline';
import {
  ANTHROPIC_SUPPORT_MODEL_DEFAULT,
  ANTHROPIC_VISION_MODEL_DEFAULT,
} from './anthropic-model-authority';
import {
  applyPersonalizationPatches,
  type LetterContext,
  type PatchContext,
  generateCompanionLetter,
} from './personalization';
import { truncateStoryMarkdownToPages } from '../../lib/story-bank-truncate';
import {
  assertStoryPersonalizationGate,
  normalizeWizardChildGender,
  resolveStoryBankPlaceholders,
  runStoryPersonalizationGate,
  type WizardPersonalizationContext,
} from '../../lib/story-bank-personalization';
import {
  ChildPhotoUploadError,
  normalizePhotoUrlForVision,
} from '../../lib/child-photo-normalize';
import {
  buildPhotoAnchoredChildStructured,
  joinChildStructuredDNA,
  sanitizeChildStructuredAgainstPhoto,
} from '../../lib/child-photo-dna-sanitize';
import {
  normalizeChildPhotoHairDescription,
  resolveDevChildHairOverride,
} from '../../lib/child-photo-hair';
import {
  parsePageTimeOfDayFromBlock,
  parseStoryCategoryFromFrontmatter,
  parseStoryTimeOfDayFromFrontmatter,
  resolveStoryTimeOfDay,
  type StoryTimeOfDay,
} from '../../lib/story-time-of-day';
import {
  parseRecurringEntitiesFromStoryMarkdown,
  resolveDeclarationAnchorUrls,
} from '../../lib/story-bank/recurring-entities';

/** Thrown when gender/name personalization cannot produce verified final text. */
export class StoryBankPersonalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryBankPersonalizationError';
  }
}

const PERSONALIZATION_MAX_ATTEMPTS = 3;

/**
 * (reliability) Timeout for the PRE-IMAGE LLM/vision provider fetches below. These run SYNCHRONOUSLY in the text
 * stage of the 300s generation worker, and the worker's budget guard is only checked BETWEEN stages — so an
 * UNBOUNDED provider hang runs straight to the 300s hard kill (FUNCTION_INVOCATION_TIMEOUT) before the child anchor.
 * 30s: generous for a healthy vision/support/DNA call (typically 3–20s), while the worst-case all-hang path
 * (swapGender 3× + personalizeChildName + Claude→OpenAI vision + childStructured DNA = 7 calls ≈ 210s) stays
 * comfortably under the 300s worker cap — so a hung provider ABORTS and its existing fallback fires, never eating the
 * whole budget. Read at CALL time (like getWorkerBudgetMs) so tests can shrink it. NOT a substitute for maxDuration.
 */
function preImageLlmTimeoutMs(): number {
  const raw = process.env.PRE_IMAGE_LLM_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 30_000;
}

/**
 * `fetch` bounded by an `AbortSignal.timeout`. On timeout the fetch rejects with a `TimeoutError` that the caller's
 * EXISTING try/catch already handles (vision → Claude→OpenAI→null→fallback DNA; childStructured DNA → hardcoded
 * fallback; swapGender/personalizeChildName → bounded retry/throw). Happy-path (fast providers) is byte-unchanged —
 * the signal only fires on a hang. Every pre-image provider call in this module goes through this helper.
 */
function preImageLlmFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(preImageLlmTimeoutMs()) });
}

function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type LoadStoryFromBankOptions = {
  patchContext?: PatchContext | null;
  /** When set with companionLetter frontmatter, generates and splices the letter page. */
  letterContext?: LetterContext | null;
  /** When set, keep only the first N story pages (truncates at `--- Page N ---` markers). */
  maxPages?: number;
  /** Skip LLM gender/name passes (use after text is finalized — image/cover loads only). */
  skipLlmPersonalization?: boolean;
  /**
   * Allow the NON-DETERMINISTIC free-form LLM rewrite (gender swap / name weave) on the correction path.
   * DEFAULT false: the PAID v3-approved path resolves gender/name DETERMINISTICALLY (placeholders + gender
   * chips/slashes + a deterministic name top-up) and FAILS CLOSED if that leaves a residual mismatch — it never
   * runs a free LLM rewrite of approved text (which could change plot/tone, desync text↔image, or drift across
   * retry → payloadHash strand). Set true ONLY for dev/experiment callers that explicitly want the legacy LLM
   * passes. (Fork B — constrain live LLM story-correction on paid generation.)
   */
  allowLlmRewrite?: boolean;
};

export { truncateStoryMarkdownToPages } from '../../lib/story-bank-truncate';

/**
 * Parse `companionLetter` from story markdown (YAML anywhere in header region).
 */
export function parseCompanionLetterMeta(
  raw: string
): { insertAfterPage: number; imageDirection: string } | null {
  if (!/companionLetter\s*:/.test(raw)) return null;
  const insert = raw.match(/insertAfterPage\s*:\s*(\d+)/);
  const img =
    raw.match(/imageDirection\s*:\s*"((?:\\.|[^"\\])*)"/) ??
    raw.match(/imageDirection\s*:\s*'((?:\\.|[^'\\])*)'/);
  if (!insert?.[1] || !img?.[1]) return null;
  const insertAfterPage = parseInt(insert[1], 10);
  if (!Number.isFinite(insertAfterPage) || insertAfterPage < 0) return null;
  return { insertAfterPage, imageDirection: img[1].trim() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fork B — deterministic name personalization + fail-closed correction guards.
// (Constrain live LLM story-correction on paid v3-approved generation.)
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic name top-up aims for this many occurrences; below it we substitute generic child-word slots. */
export const NAME_PERSONALIZATION_TARGET = 3;
/** Hard floor: fewer than this after deterministic resolution FAILS CLOSED (a wrong-personalization book). */
export const NAME_PERSONALIZATION_MIN = 1;
/** Per-page correction edit-distance budget (abs, chars) — a few name substitutions, not a rewrite. */
export const CORRECTION_DIFF_ABS_BUDGET = 24;
/** Per-page correction edit-distance budget as a fraction of page length (scales the abs floor up on long pages). */
export const CORRECTION_DIFF_RATIO = 0.12;

/** Count child-name occurrences (substring, matching the historical count — errs toward NOT false-failing). */
export function countNameOccurrences(pages: Pick<StoryPage, 'text'>[], name: string): number {
  if (!name) return 0;
  const re = new RegExp(escapeRegexLiteral(name), 'g');
  return pages.reduce((acc, p) => acc + ((p.text ?? '').match(re) || []).length, 0);
}

/**
 * Deterministically weave the child's name into leading GENERIC child-word slots (הילד/הילדה, ילד/ילדה) up to
 * `target`. Pure string substitution (no LLM): same inputs → same output → stable payloadHash on retry. Only the
 * definite/bare noun tokens are replaced (prefixed forms like לילד stay, to avoid ungrammatical bare-name splices).
 * v3-approved stories use {{childName}} placeholders and have no generic slots, so this is usually a no-op.
 * Returns the number of substitutions made.
 */
export function deterministicNameTopUp(
  pages: Pick<StoryPage, 'text' | 'narrationText'>[],
  name: string,
  gender: 'boy' | 'girl' | 'other',
  target: number
): number {
  let need = target - countNameOccurrences(pages, name);
  if (need <= 0 || !name) return 0;
  const tokens = gender === 'girl' ? ['הילדה', 'ילדה'] : ['הילד', 'ילד'];
  let added = 0;
  for (const page of pages) {
    if (need <= 0) break;
    let text = page.text ?? '';
    for (const tok of tokens) {
      if (need <= 0) break;
      // Standalone token only: non-Hebrew-letter (or edge) on both sides — never a partial match inside a word.
      const re = new RegExp(`(?<=[^א-ת]|^)${escapeRegexLiteral(tok)}(?=[^א-ת]|$)`, 'g');
      text = text.replace(re, (m) => {
        if (need <= 0) return m;
        need--;
        added++;
        return name;
      });
    }
    page.text = text;
    page.narrationText = text;
  }
  return added;
}

/** Fail CLOSED when the child's name is not present at the required minimum after deterministic resolution. */
export function assertNameFloor(name: string, count: number, min: number): void {
  if (count < min) {
    throw new StoryBankPersonalizationError(
      `Name '${name}' appears ${count}x after deterministic resolution (min ${min}) — the story's {{childName}} ` +
        `placeholders resolved too few times and there were no generic child-word slots to top up. Fix the story authoring.`
    );
  }
}

/** Edit distance with an early-exit ceiling (returns >max once the whole row exceeds the budget). */
export function boundedLevenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1; // even the best cell this row exceeds the budget → bail
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/**
 * Fail CLOSED if the correction changed the approved text beyond a small, localized per-page name-substitution
 * budget — i.e. a free-form rewrite that could alter plot/tone or desync text↔image. On the deterministic path
 * the diff is zero (name-dense stories) or a handful of name substitutions; a meaning rewrite blows the budget.
 */
export function assertCorrectionWithinDiffBudget(baseline: string[], finalized: string[]): void {
  if (baseline.length !== finalized.length) {
    throw new StoryBankPersonalizationError(
      `Correction changed the page count (${baseline.length} → ${finalized.length}) — refusing to ship.`
    );
  }
  for (let i = 0; i < baseline.length; i++) {
    const a = baseline[i] ?? '';
    const b = finalized[i] ?? '';
    const budget = Math.max(CORRECTION_DIFF_ABS_BUDGET, Math.ceil(a.length * CORRECTION_DIFF_RATIO));
    const dist = boundedLevenshtein(a, b, budget);
    if (dist > budget) {
      throw new StoryBankPersonalizationError(
        `Correction rewrote page ${i + 1} beyond the name-substitution budget (edit distance >${budget}) — a ` +
          `free-form rewrite that could change meaning/tone or desync text↔image. Refusing to ship approved paid text.`
      );
    }
  }
}

/**
 * Parse a story-bank markdown file into a GeneratedStory object.
 * Skips all LLM stages — uses imageDirection fields as rawScenePrompt.
 * On the paid path gender/name are resolved DETERMINISTICALLY (placeholders + chips/slashes + a deterministic
 * name top-up) and FAIL CLOSED on a residual mismatch; a free-form LLM rewrite runs only under allowLlmRewrite (dev).
 */
export async function loadStoryFromBank(
  filePath: string,
  childName: string,
  companionName: string,
  childGender?: string,
  options?: LoadStoryFromBankOptions | null
): Promise<GeneratedStory> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return loadStoryFromBankContent(
    raw,
    childName,
    companionName,
    childGender,
    options,
  );
}

/**
 * Parse an already-frozen Story Source snapshot. PVB runtime callers use this
 * seam so an in-flight order never reloads a mutable source path.
 */
export async function loadStoryFromBankContent(
  rawContent: string,
  childName: string,
  companionName: string,
  childGender?: string,
  options?: LoadStoryFromBankOptions | null
): Promise<GeneratedStory> {
  let raw = rawContent;
  if (options?.maxPages && options.maxPages > 0) {
    raw = truncateStoryMarkdownToPages(raw, options.maxPages);
  }
  const letterMeta = parseCompanionLetterMeta(raw);

  // Try YAML frontmatter first (v5-fixed-v2 format), fall back to legacy "=== STORY N: title ===".
  // No longer falls back to "סיפור מהבנק" — that placeholder leaked into the production UI.
  const yamlTitleMatch = raw.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
  const legacyTitleMatch = raw.match(/===\s*STORY\s*\d+:\s*(.+?)\s*===/);
  const rawTitle = yamlTitleMatch?.[1]?.trim() || legacyTitleMatch?.[1]?.trim() || '';
  const title = (rawTitle || `הסיפור של ${childName}`)
    .replace(/\{\{childName\}\}/g, childName)
    .replace(/\{\{companionName\}\}/g, companionName);

  // Extract story metadata for cover generation
  const coverSceneMatch = raw.match(/coverScene:\s*(.+)/);
  const coverSceneRaw = coverSceneMatch?.[1]?.trim() ?? '';

  // Extract explicit gender metadata (if present in story file header)
  const genderMatch = raw.match(/^gender:\s*(female|male|girl|boy)\b/mi);
  const explicitGender = genderMatch?.[1]?.trim().toLowerCase() ?? null;
  const normalizedExplicitGender =
    explicitGender === 'girl' || explicitGender === 'female' ? 'female' :
    explicitGender === 'boy' || explicitGender === 'male' ? 'male' : null;

  const pageParts = raw.split(/---\s*Page\s*(\d+)\s*---/).slice(1);
  const pages: StoryPage[] = [];
  const pageTimeOfDayOverrides: Partial<Record<number, StoryTimeOfDay>> = {};

  for (let i = 0; i < pageParts.length; i += 2) {
    const pageNumber = parseInt(pageParts[i], 10);
    if (!Number.isFinite(pageNumber)) continue;
    const block = pageParts[i + 1] ?? '';

    const pageTimeOverride = parsePageTimeOfDayFromBlock(block);
    if (pageTimeOverride) pageTimeOfDayOverrides[pageNumber] = pageTimeOverride;

    const imageDirectionMatch = block.match(/imageDirection:\s*(.+)/);
    const imageDirection = imageDirectionMatch?.[1]?.trim() ?? '';

    const textPart = block
      .replace(/imageDirection:.*/g, '')
      .replace(/WORD_COUNT:.*/g, '')
      .trim();
    const text = textPart
      .replace(/\{\{childName\}\}/g, childName)
      .replace(/\{\{companionName\}\}/g, companionName);

    const resolvedImageDirection = imageDirection
      .replace(/\{\{childName\}\}/g, childName)
      .replace(/\{\{companionName\}\}/g, companionName);

    const visualDirection = parseImageDirection(resolvedImageDirection);

    pages.push({
      pageNumber,
      text,
      narrationText: text,
      imageSubject: visualDirection?.mainAction ? 'action' : 'child',
      imagePrompt: resolvedImageDirection,
      rawScenePrompt: resolvedImageDirection,
      visualDirection,
    });
  }

  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  const wizardGender = normalizeWizardChildGender(childGender);
  const personalizationCtx: WizardPersonalizationContext = {
    childName: childName.trim(),
    childGender: wizardGender,
    companionName: companionName.trim(),
  };

  for (let i = 0; i < pages.length; i++) {
    pages[i].text = resolveStoryBankPlaceholders(pages[i].text, personalizationCtx);
    pages[i].narrationText = pages[i].text;
    pages[i].imagePrompt = resolveStoryBankPlaceholders(pages[i].imagePrompt, personalizationCtx);
    pages[i].rawScenePrompt = resolveStoryBankPlaceholders(
      pages[i].rawScenePrompt ?? pages[i].imagePrompt,
      personalizationCtx
    );
  }

  // Fork B: snapshot the DETERMINISTIC resolution (placeholders + gender chips/slashes) as the baseline that the
  // finalized correction text is diff-budget-checked against — any change beyond small, localized name
  // substitutions (i.e. a free-form rewrite that shifted meaning/tone) FAILS CLOSED (assertCorrectionWithinDiffBudget).
  const deterministicBaseline = pages.map((p) => p.text);

  // ── Gender adaptation ──────────────────────────────────────────────
  // Chip-resolved v5 stories are correct by construction; LLM swap is belt-and-suspenders only.
  if (childGender && !options?.skipLlmPersonalization) {
    const allText = pages.map((p) => p.text).join('\n');
    // Consistent normalization (handles 'female' / Hebrew נקבה / etc.), not a raw `=== 'girl'` that misses them.
    const targetGender = wizardGender === 'girl' ? 'female' : 'male';
    const genderAfterChips = detectStoryGender(allText);
    console.log(
      `[StoryBank] Gender: yamlExplicit=${normalizedExplicitGender}, afterChips=${genderAfterChips}, target=${targetGender}`
    );

    const genderGateFailures = runStoryPersonalizationGate({
      wizard: personalizationCtx,
      pages: pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text,
        imagePrompt: p.imagePrompt,
      })),
    }).filter(
      (f) =>
        f.includes('gender') ||
        f.includes('gendered child marker') ||
        f.includes('gender chip') ||
        f.includes('gender slash')
    );
    const genderGateClean = genderGateFailures.length === 0;

    const needsSwap =
      genderAfterChips != null
        ? genderAfterChips !== targetGender
        : !genderGateClean &&
          normalizedExplicitGender != null &&
          normalizedExplicitGender !== targetGender;

    if (needsSwap) {
      const fromGender = (genderAfterChips ?? normalizedExplicitGender)!;
      if (!options?.allowLlmRewrite) {
        // Fork B: the coarse GLOBAL gender heuristic (detectStoryGender counts every gendered marker, incl.
        // secondary characters like a mother/companion, so it can skew) disagrees with the target. We do NOT run
        // a non-deterministic LLM rewrite of approved text on the paid path. The deterministic chip/slash
        // resolution stands, and the PRECISE, name-adjacent gender gate (assertStoryPersonalizationGate — the
        // FIXED Hebrew boundary, called below + in text-finalization) is the fail-closed re-check: it blocks a
        // genuine wrong-gender CHILD leak while not over-blocking a correctly-authored story the global heuristic
        // misreads. (A story that legitimately trips the gate is a chip-coverage authoring bug to fix at source.)
        console.warn(
          `[StoryBank] Gender heuristic mismatch (global detect=${fromGender}, target=${targetGender}); LLM rewrite OFF (paid path). ` +
            `Relying on deterministic chips/slashes + the name-adjacent gender gate to fail closed on any real leak.`
        );
      } else {
        console.log(
          `[StoryBank] Gender mismatch after chips: from=${fromGender}, target=${targetGender}. Running LLM swap (allowLlmRewrite=on)...`
        );
        const swappedPages = await swapGender(pages, fromGender, targetGender, childName);
        for (let i = 0; i < pages.length; i++) {
          if (swappedPages[i]) {
            pages[i].text = swappedPages[i];
            pages[i].narrationText = swappedPages[i];
          }
        }
        console.log(`[StoryBank] Gender swap complete (${pages.length} pages).`);
      }
    } else {
      console.log(
        `[StoryBank] Gender OK after chips (afterChips=${genderAfterChips}, gateClean=${genderGateClean}). No swap needed.`
      );
    }
  }

  // ── Child name personalization (Fork B: DETERMINISTIC — no free-form LLM weave on the paid path) ──────
  if (childName && childName.trim().length > 0 && !options?.skipLlmPersonalization) {
    const trimmedName = childName.trim();
    const nameCount = countNameOccurrences(pages, trimmedName);

    if (nameCount >= NAME_PERSONALIZATION_TARGET) {
      // v3-approved / v5 stories carry {{childName}} placeholders → the name is already dense after the
      // deterministic resolution above. Nothing to add, and nothing a free LLM rewrite should touch.
      console.log(`[StoryBank] Name already dense — '${trimmedName}' appears ${nameCount}x (deterministic placeholders).`);
    } else if (options?.allowLlmRewrite) {
      // Legacy DEV opt-in ONLY: the non-deterministic LLM name weave. Never runs on the paid v3-approved path.
      const targetGenderForName: 'female' | 'male' = wizardGender === 'girl' ? 'female' : 'male';
      try {
        const personalizedPages = await personalizeChildName(pages, trimmedName, targetGenderForName);
        for (let i = 0; i < pages.length; i++) {
          if (personalizedPages[i]) {
            pages[i].text = personalizedPages[i];
            pages[i].narrationText = personalizedPages[i];
          }
        }
      } catch (err) {
        throw err instanceof StoryBankPersonalizationError
          ? err
          : new StoryBankPersonalizationError(
              `Name personalization failed: ${err instanceof Error ? err.message : String(err)}`
            );
      }
    } else {
      // Fork B default: DETERMINISTIC top-up — substitute the child's name into leading generic child-word
      // slots (הילד/הילדה) up to the target. Pure string substitution: same inputs → same output → stable
      // payloadHash on retry. (v3 stories have no generic slots and are already dense, so this is usually a no-op.)
      const added = deterministicNameTopUp(pages, trimmedName, wizardGender, NAME_PERSONALIZATION_TARGET);
      if (added > 0) console.log(`[StoryBank] Deterministic name top-up: +${added} '${trimmedName}' into generic child-word slots.`);
    }

    // Fail CLOSED if the name isn't present at the required minimum after deterministic resolution (a broken
    // placeholder, or an LLM that stripped personalization) — never ship a wrong-personalization book.
    const finalNameCount = countNameOccurrences(pages, trimmedName);
    assertNameFloor(trimmedName, finalNameCount, NAME_PERSONALIZATION_MIN);
    console.log(`[StoryBank] Name check OK — '${trimmedName}' appears ${finalNameCount}x (min ${NAME_PERSONALIZATION_MIN}).`);
  }

  // Fork B: fail CLOSED if the correction changed the approved text beyond a small, localized name-substitution
  // budget (a free-form rewrite that altered plot/tone → text↔image desync). Deterministic path diff ≈ 0.
  if (!options?.skipLlmPersonalization && !options?.allowLlmRewrite) {
    assertCorrectionWithinDiffBudget(deterministicBaseline, pages.map((p) => p.text));
  }

  const opts = options ?? undefined;

  if (opts?.patchContext) {
    for (let i = 0; i < pages.length; i++) {
      const patchedText = await applyPersonalizationPatches(pages[i].text, opts.patchContext);
      pages[i].text = patchedText;
      pages[i].narrationText = patchedText;
    }
    console.log(`[StoryBank] Personalization patches applied (${pages.length} pages).`);
  }

  if (letterMeta && opts?.letterContext) {
    const letter = await generateCompanionLetter(opts.letterContext);
    const insertIdx = pages.findIndex((p) => p.pageNumber === letterMeta.insertAfterPage);
    const pos = insertIdx >= 0 ? insertIdx + 1 : pages.length;
    const resolvedLetterImg = letterMeta.imageDirection
      .replace(/\{\{childName\}\}/g, childName)
      .replace(/\{\{companionName\}\}/g, companionName);
    const letterVisual = parseImageDirection(resolvedLetterImg);
    const letterPage: StoryPage = {
      pageNumber: 0,
      text: letter.text,
      narrationText: letter.text,
      imageSubject: 'child',
      imagePrompt: resolvedLetterImg,
      rawScenePrompt: resolvedLetterImg,
      visualDirection: letterVisual,
      isLetter: true,
    };
    pages.splice(pos, 0, letterPage);
    pages.forEach((p, idx) => {
      p.pageNumber = idx + 1;
    });
    console.log(
      `[StoryBank] Companion letter inserted after logical page ${letterMeta.insertAfterPage} (total pages=${pages.length}).`
    );
  } else if (letterMeta && !opts?.letterContext) {
    console.warn(
      '[StoryBank] companionLetter frontmatter found but letterContext missing — letter page skipped.'
    );
  }

  assertStoryPersonalizationGate({
    wizard: personalizationCtx,
    pages: pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
      imagePrompt: p.imagePrompt,
    })),
  });
  console.log('[StoryBank] Personalization gate passed.');

  // Use explicit English coverScene from story file when available
  const coverSceneHint = coverSceneRaw || undefined;

  const storyRecurringEntities = resolveDeclarationAnchorUrls(
    parseRecurringEntitiesFromStoryMarkdown(raw)
  );

  const storyCategory = parseStoryCategoryFromFrontmatter(raw);
  const frontmatterTimeOfDay = parseStoryTimeOfDayFromFrontmatter(raw);
  const storyTimeOfDay = resolveStoryTimeOfDay({
    frontmatterTimeOfDay,
    category: storyCategory,
    pages,
  });

  // Traceability for v3-approved imports (optional frontmatter; absent in v5 bank files).
  const storyIdMatch = raw.match(/^storyId:\s*['"]?(.+?)['"]?\s*$/m);
  const sourceRunDirMatch = raw.match(/^sourceRunDir:\s*['"]?(.+?)['"]?\s*$/m);

  return {
    title,
    coverText: title,
    coverSceneHint,
    storyCategory,
    storyTimeOfDay,
    pageTimeOfDayOverrides:
      Object.keys(pageTimeOfDayOverrides).length > 0 ? pageTimeOfDayOverrides : undefined,
    characterSheet: {
      mainCharacter: { name: childName, visualDescription: '' },
      supportingCharacters: [
        { name: companionName, relationship: 'companion', visualDescription: '' },
      ],
      worldDescription: '',
    },
    concept: {
      centralEntity: {
        name: companionName,
        type: 'external_helper',
        visualDescription: '',
        behaviorRules: ['', '', ''],
        strangeDetail: '',
      },
      narrativePurpose: { represents: '', whyItAppears: '', whatItNeedsOrWants: '' },
      resilienceLayer: {
        identificationAnchor: '',
        projectionLogic: '',
        regulationAction: '',
        transformationMarker: '',
      },
      surpriseOrShift: '',
      emotionalPeak: '',
      resolution: { action: '', transformation: '' },
    },
    pages,
    storyRecurringEntities,
    meta: {
      provider: 'story-bank',
      model: 'pre-written',
      tokens: 0,
      totalTokens: 0,
      ...(storyIdMatch?.[1] ? { storyId: storyIdMatch[1].trim() } : {}),
      ...(sourceRunDirMatch?.[1] ? { sourceRunDir: sourceRunDirMatch[1].trim() } : {}),
    },
  };
}

/**
 * Parse an imageDirection string into a ShotVisualDirection.
 * Format: "Description, camera type, focal point: X, lighting"
 */
export function parseImageDirection(dir: string): ShotVisualDirection | undefined {
  if (!dir) return undefined;

  const focalMatch = dir.match(/focal point:\s*([^,]+)/i);
  const focal = focalMatch?.[1]?.trim() ?? '';

  const cameraMatch = dir.match(
    /(wide shot|medium shot|close shot|low angle|bird-eye view|bird.?s eye)/i
  );
  const camera = cameraMatch?.[1]?.trim() ?? 'medium shot';

  const lightMatch = dir.match(/([\w\s]+lighting|[\w\s]+light|[\w\s]+mood)$/i);
  const lighting = lightMatch?.[1]?.trim() ?? '';
  const weatherMatch = dir.match(/(rain|rainy|storm|flood|flooding|overcast|gray|grey|dark|wet|mud|muddy|snow|sunny|bright)/gi);
  const weather = weatherMatch ? [...new Set(weatherMatch.map((w) => w.toLowerCase()))].join(', ') : '';
  const emotionMatch = dir.match(/(dramatic|calm|gentle|tense|struggle|peaceful|sad|worried|determined|scared)/gi);
  const emotion = emotionMatch?.[0]?.toLowerCase() ?? '';

  // FIXED: Use the FULL imageDirection as mainAction, stripping only metadata suffixes
  // (camera type, focal point, lighting). Previously only took first comma chunk,
  // which destroyed critical scene details like specific objects, water levels, etc.
  const metadataPattern = /,?\s*(?:wide shot|medium shot|close shot|low angle|bird-eye view|bird.?s eye)\b.*$/i;
  let mainAction = dir.replace(metadataPattern, '').trim() || dir.split(',')[0]?.trim() || dir;
  let paletteOnlyOriginal: string | null = null;

  // ── PALETTE-ONLY GUARD ──────────────────────────────────────────────────
  // Some story-bank pages have imageDirection that describes mood/palette only
  // (e.g. "dim blue tones, tall trees, long overlapping shadows") with no
  // character or pose verb. When passed unchanged as `mainAction`, the image
  // model receives no narrative subject and defaults to a centered standing
  // portrait of the protagonist. Detect this and prepend a generic character
  // action so the model has a real subject to render. The original palette
  // stays attached as atmospheric context so we don't lose the mood.
  const CHARACTER_WORDS_RE =
    /\b(child|girl|boy|kid|she|he|her|him|hero|hands?|face|eyes?|feet|arms?|legs?|body|figure)\b/i;
  const POSE_VERBS_RE =
    /\b(stand|sit|kneel|crouch|lie|lay|walk|run|jump|climb|hide|reach|hold|look|peer|watch|gaze|listen|whisper|call|point|hug|smile|laugh|cry|sleep|lift|lean|bend|turn|gesture|wave|recoil|flatten|tilt|alert|relaxed|frozen|surprised|reading|playing|eating|drinking|drawing|writing|riding|swimming|flying|with\s+one|with\s+both)\w*\b/i;
  const hasCharacter = CHARACTER_WORDS_RE.test(mainAction);
  const hasPose = POSE_VERBS_RE.test(mainAction);
  if (!hasCharacter && !hasPose) {
    paletteOnlyOriginal = mainAction;
    mainAction = `child positioned naturally inside the scene, observing the environment around them; atmospheric context — ${paletteOnlyOriginal}`;
    console.warn(
      `[parseImageDirection] palette_only_action — synthesized character subject. source="${paletteOnlyOriginal}"`,
    );
  }

  // Extract ALL named objects from the full description for mustInclude
  const mustInclude: string[] = [];
  if (focal) mustInclude.push(focal);

  // Extract creature/companion mentions from plain prose ("starfish with open notebook")
  // so the companion gets injected as a required visual element. Without this, the
  // image gen would only render the child and drop the companion entirely.
  const creatureRegex = /\b(starfish|seahorse|octopus|dolphin|whale|fish|jellyfish|crab|turtle|otter|seal|shark|coral|anemone|bat|owl|fox|deer|fawn|squirrel|rabbit|bunny|chameleon|panda|bear|cub|hedgehog|hawk|eagle|pelican|dragon|bee|lion|butterfly|ant|firefly|mongoose|wolf|gecko|salamander|kitten|cat|snail|puppy|dog|parrot|bird|mole|giant)\b/gi;
  const creatures = dir.match(creatureRegex);
  if (creatures) {
    for (const c of creatures) {
      const lc = c.toLowerCase();
      if (!mustInclude.some((m) => m.toLowerCase().includes(lc))) {
        mustInclude.push(lc);
      }
    }
  }

  // Extract location from imageDirection text instead of hardcoding
  const locationZone = extractLocationZone(dir);

  return {
    locationZone,
    mainAction,
    visibleObjects: mustInclude.length ? mustInclude : [],
    characterPose: '',
    emotionVisual: emotion,
    lightingSource: lighting,
    // Preserve the original palette/atmosphere description as environmentDetail
    // when we synthesized the action (so the mood survives even though
    // mainAction now leads with the character subject).
    environmentDetail: paletteOnlyOriginal ? paletteOnlyOriginal : weather,
    textTranslation: '',
    mustInclude,
    mustNotInclude: [],
    camera,
    composition: '',
  };
}

/**
 * Extract location/setting from imageDirection text.
 *
 * ADVISORY ONLY (Visual Contract Compiler authority rule): this keyword classifier is a HINT. Once a
 * BookVisualContract governs a book, the page's location identity comes from the contract
 * (`locationId`/`zoneId`) and this output may NEVER override it — it caused the gate→cave
 * reclassification by promoting a zone to a whole new world. See lib/visual-contract-compiler
 * (resolveAuthoritativePageLocation). Use it only to inform camera/action phrasing.
 */
function extractLocationZone(dir: string): string {
  const d = dir.toLowerCase();
  // Indoor locations
  if (/\b(bedroom|bed|pillow|blanket|dresser|drawer|nightstand|lamp|mattress)\b/.test(d)) return 'bedroom';
  if (/\b(kitchen|stove|fridge|counter|oven|sink)\b/.test(d)) return 'kitchen';
  if (/\b(bathroom|bath|shower|toilet)\b/.test(d)) return 'bathroom';
  if (/\b(living room|couch|sofa|armchair|tv|television)\b/.test(d)) return 'living room';
  if (/\b(classroom|school|desk|blackboard|whiteboard)\b/.test(d)) return 'classroom';
  if (/\b(room|indoor|inside|wall|floor|ceiling|door|window|hallway|corridor)\b/.test(d)) return 'room';
  // Outdoor locations
  if (/\b(garden|yard|fence|hedge|gate|flower.?pot|swing|tree.*branch)\b/.test(d)) return 'garden';
  if (/\b(forest|woods|clearing|trail|path.*tree)\b/.test(d)) return 'forest';
  if (/\b(park|playground|bench|slide)\b/.test(d)) return 'park';
  if (/\b(beach|sand|shore|dune|coast)\b/.test(d)) return 'beach';
  if (/\b(underwater|coral|reef|kelp|sea ?floor|seabed|sea bottom|ocean floor|undersea|deep sea|mermaid|aquatic|submerged)\b/.test(d)) return 'underwater';
  if (/\b(ocean|sea|wave|water|tide|lagoon|pool of water|river|lake|stream|pond|brook|creek)\b/.test(d)) return 'water';
  if (/\b(mountain|cliff|peak|valley|hill|ridge)\b/.test(d)) return 'mountain';
  if (/\b(desert|dune|cactus|sand dune|wasteland)\b/.test(d)) return 'desert';
  if (/\b(meadow|field|prairie|grassland|pasture)\b/.test(d)) return 'meadow';
  if (/\b(cave|cavern|underground|tunnel|grotto)\b/.test(d)) return 'cave';
  if (/\b(sky|cloud|stars|moon|night sky|starlit|celestial|cosmic|galaxy|space)\b/.test(d)) return 'sky';
  if (/\b(snow|ice|frost|glacier|icicle|snowflake)\b/.test(d)) return 'snow';
  if (/\b(street|road|sidewalk|crosswalk|car)\b/.test(d)) return 'street';
  if (/\b(village|town|farm|barn|stable|cottage)\b/.test(d)) return 'village';
  // Abstract/transitional
  if (/\b(open space|bright space|threshold|doorway.*light)\b/.test(d)) return 'threshold';
  // Default — generic scene
  return 'scene';
}

// ─── Gender Detection & Swap ─────────────────────────────────────────────────

/**
 * Detect the written gender of a Hebrew story by counting gendered verb/pronoun markers.
 * Returns 'female', 'male', or null if unclear.
 */
/**
 * Hebrew word boundary helper.
 * JS \b doesn't work with Hebrew chars — they aren't \w.
 * Use lookbehind/lookahead for non-Hebrew-letter boundaries instead.
 */
function heWord(word: string): RegExp {
  // Match word surrounded by non-Hebrew-letter chars (or start/end of string)
  return new RegExp(`(?<=[^א-ת]|^)${word}(?=[^א-ת]|$)`, 'g');
}

function detectStoryGender(text: string): 'female' | 'male' | null {
  // Strip niqqud + cantillation — they break regex and aren't needed for gender detection
  const clean = text.replace(/\p{M}/gu, '');

  // Feminine markers (pronouns + common past-tense verbs)
  const feminineWords = [
    'היא', 'אותה', 'שלה',
    'הרגישה', 'הסתכלה', 'אמרה', 'רצתה', 'ידעה',
    'ראתה', 'הלכה', 'ישבה', 'עמדה', 'נתנה', 'לקחה', 'שמעה',
    'רצה', 'עשתה', 'חשבה', 'הביטה', 'נשמה', 'לחשה',
  ];
  // Masculine markers
  const masculineWords = [
    'הוא', 'אותו', 'שלו',
    'הרגיש', 'הסתכל', 'אמר', 'רצה', 'ידע',
    'ראה', 'הלך', 'ישב', 'עמד', 'נתן', 'לקח', 'שמע',
    'עשה', 'חשב', 'הביט', 'נשם', 'לחש',
  ];

  let femScore = 0;
  let mascScore = 0;

  for (const w of feminineWords) {
    femScore += (clean.match(heWord(w)) || []).length;
  }
  for (const w of masculineWords) {
    mascScore += (clean.match(heWord(w)) || []).length;
  }

  console.log(`[StoryBank] Gender detection: fem=${femScore}, masc=${mascScore}`);

  const total = femScore + mascScore;
  if (total < 3) return null;

  if (femScore > mascScore * 1.5) return 'female';
  if (mascScore > femScore * 1.5) return 'male';
  return null;
}

/**
 * Use LLM to swap gendered Hebrew forms in story pages.
 * Returns array of swapped text strings (one per page).
 */
async function swapGender(
  pages: StoryPage[],
  fromGender: 'female' | 'male',
  toGender: 'female' | 'male',
  childName: string
): Promise<string[]> {
  const provider = process.env.STORY_PROVIDER || 'openai';
  const model = process.env.PIPELINE_SUPPORT_MODEL ||
    (provider === 'anthropic' ? ANTHROPIC_SUPPORT_MODEL_DEFAULT : 'gpt-4o-mini');

  const fromLabel = fromGender === 'female' ? 'נקבה' : 'זכר';
  const toLabel = toGender === 'female' ? 'נקבה' : 'זכר';

  // Prepare pages text as numbered blocks
  const pagesBlock = pages
    .map(p => `=== עמוד ${p.pageNumber} ===\n${p.text}`)
    .join('\n\n');

  const systemPrompt = `אתה מתרגם מגדרי מקצועי לעברית ספרותית לילדים. תפקידך להמיר את כל הצורות הלשוניות מ${fromLabel} ל${toLabel}, תוך שמירה מוחלטת על סגנון הכתיבה, הקצב, הדמיון והאווירה.`;

  const userPrompt = `המר את הטקסט הבא מ${fromLabel} ל${toLabel}.

שם הילד/ה: ${childName}

כללים:
1. המר כל פועל, שם תואר, כינוי גוף וסיומת ל${toLabel}
2. אל תשנה שום תוכן, עלילה, דימוי או מטאפורה
3. שמור על הניקוד (אם יש)
4. שמור על שורות ריקות ומבנה פסקאות בדיוק כמו במקור
5. אל תוסיף ואל תמחק מילים — רק המר מגדר
6. שמות דמויות (כולל {{companionName}}) נשארים כמו שהם
7. שמור על תבניות {{patch:...|...|...}} בדיוק כמו שהן — אל תתרגם ואל תשנה את התוכן בתוך הסוגריים
8. החזר JSON בפורמט: {"pages": ["טקסט עמוד 1", "טקסט עמוד 2", ...]}

הטקסט:
${pagesBlock}`;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= PERSONALIZATION_MAX_ATTEMPTS; attempt++) {
    try {
      let responseText = '';

      if (provider === 'anthropic') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
        const res = await preImageLlmFetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: 4000,
            temperature: 0.1,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
        const data = await res.json();
        responseText = data.content?.[0]?.text ?? '';
      } else {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY not set');
        const useResponsesAPI = model.startsWith('gpt-5.') || model.includes('-pro');

        if (useResponsesAPI) {
          const body: Record<string, unknown> = {
            model,
            max_output_tokens: 4000,
            input: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            text: { format: { type: 'json_object' } },
          };
          const res = await preImageLlmFetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`OpenAI Responses ${res.status}: ${await res.text()}`);
          const data = await res.json();
          responseText =
            data.output_text ??
            data.output?.find((item: { type?: string; content?: Array<{ type?: string; text?: string }> }) => item.type === 'message')
              ?.content?.find((c: { type?: string; text?: string }) => c.type === 'output_text')?.text ??
            '';
        } else {
          const body: Record<string, unknown> = {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 4000,
          };
          const res = await preImageLlmFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content ?? '';
        }
      }

      const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      if (!cleaned) {
        throw new StoryBankPersonalizationError(
          `Gender swap returned empty response (attempt ${attempt}/${PERSONALIZATION_MAX_ATTEMPTS})`
        );
      }
      const parsed = JSON.parse(cleaned) as { pages?: string[] };

      if (!Array.isArray(parsed.pages) || parsed.pages.length !== pages.length) {
        throw new StoryBankPersonalizationError(
          `Gender swap returned ${parsed.pages?.length ?? 0} pages, expected ${pages.length} (attempt ${attempt}/${PERSONALIZATION_MAX_ATTEMPTS})`
        );
      }

      console.log(
        `[StoryBank] Gender swap SUCCESS — ${parsed.pages.length} pages swapped from ${fromGender} to ${toGender}.`
      );
      return parsed.pages;
    } catch (error) {
      lastError = error;
      console.warn(
        `[StoryBank] Gender swap attempt ${attempt}/${PERSONALIZATION_MAX_ATTEMPTS} failed:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  throw new StoryBankPersonalizationError(
    `Gender swap failed after ${PERSONALIZATION_MAX_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

/**
 * Naturally weave the child's real name into the story.
 *
 * The story-bank templates use generic "הילד"/"הילדה" because they're written
 * before we know who's reading. This pass takes the whole story + the child's
 * actual name and rewrites the text so the name appears 2-4 times in natural
 * spots (opening, emotional turning points, ending) — replacing some, NOT all,
 * generic "הילד"/"הילדה" mentions. Over-using the name feels robotic.
 *
 * Single LLM call for the full story so the model can pick GOOD spots.
 */
async function personalizeChildName(
  pages: StoryPage[],
  childName: string,
  childGender: 'female' | 'male'
): Promise<string[]> {
  const provider = process.env.STORY_PROVIDER || 'openai';
  const model = process.env.PIPELINE_SUPPORT_MODEL ||
    (provider === 'anthropic' ? ANTHROPIC_SUPPORT_MODEL_DEFAULT : 'gpt-4o-mini');

  const childWord = childGender === 'female' ? 'הילדה' : 'הילד';
  const pagesBlock = pages.map(p => `=== עמוד ${p.pageNumber} ===\n${p.text}`).join('\n\n');

  const systemPrompt = `אתה עורך לשוני מקצועי לעברית ספרותית לילדים. תפקידך לשלב את שם הילד/ה בתוך הסיפור באופן שירגיש כמו ספר שנכתב במיוחד עבור הילד/ה הזה/הזו. השם חייב להופיע כמה פעמים — לא בכל שורה, אבל מספיק כדי שהקוראים ירגישו שהסיפור הוא עליה/עליו ספציפית.`;

  const userPrompt = `שם הילד/ה: ${childName}
מספר עמודים בסיפור: ${pages.length}

כללים מחייבים:

1. החלף לפחות 5-7 הופעות של "${childWord}" / "ילד/ה" בשם "${childName}".
   - לסיפור של 8-12 עמודים: 5-6 החלפות.
   - לסיפור של 16 עמודים ומעלה: 6-8 החלפות.
   - **השם חייב להופיע ב-עמוד הראשון** (פתיחה).
   - **השם חייב להופיע ב-עמוד האחרון** (סיום).
   - שלוש-ארבע הופעות נוספות במקומות החזקים: רגע רגשי, רגע של קונפליקט, רגע של פתרון.

2. אל תחליף את כל ההופעות — אם יש 12 פעמים "${childWord}" בסיפור, תחליף 5-7 בלבד. השאר נשארות "${childWord}".

3. אל תחליף "הוא"/"היא"/"אני"/"אותה"/"אותו" או כינויי גוף — רק את המילים "${childWord}" / "ילד/ה" (במקרים שמחליפים מפורשות שם דמות).

4. אל תוסיף ואל תמחק שום מילה אחרת. שמור על מבנה פסקאות, ניקוד, וסימני פיסוק בדיוק.

5. אל תיגע בתבניות {{patch:...}} או בשמות דמויות אחרות (companion וכו').

6. השם "${childName}" צריך להיכנס כ-SUBJECT (נושא) של משפט פעולה, לא כ-OBJECT (מושא). לדוגמה: "${childName} הולכת..." טוב יותר מ-"הענק רואה את ${childName}".

7. החזר JSON בפורמט: {"pages": ["טקסט עמוד 1", "טקסט עמוד 2", ...]} — אורך המערך זהה למקור (${pages.length} עמודים).

הטקסט:
${pagesBlock}`;

  try {
    let responseText = '';

    if (provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
      const res = await preImageLlmFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 4000, temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      responseText = data.content?.[0]?.text ?? '';
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not set');
      const useResponsesAPI = model.startsWith('gpt-5.') || model.includes('-pro');

      if (useResponsesAPI) {
        const body: Record<string, unknown> = {
          model, max_output_tokens: 4000,
          input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          text: { format: { type: 'json_object' } },
        };
        const res = await preImageLlmFetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`OpenAI Responses ${res.status}: ${await res.text()}`);
        const data = await res.json();
        responseText = data.output_text ??
          data.output?.find((item: { type?: string; content?: Array<{ type?: string; text?: string }> }) => item.type === 'message')
            ?.content?.find((c: { type?: string; text?: string }) => c.type === 'output_text')?.text ??
          '';
      } else {
        const body: Record<string, unknown> = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.45,
          max_tokens: 4000,
        };
        const res = await preImageLlmFetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        const data = await res.json();
        responseText = data.choices?.[0]?.message?.content ?? '';
      }
    }

    const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    if (!cleaned) {
      throw new StoryBankPersonalizationError('Name personalization returned empty response');
    }
    const parsed = JSON.parse(cleaned) as { pages?: string[] };
    if (!Array.isArray(parsed.pages) || parsed.pages.length !== pages.length) {
      throw new StoryBankPersonalizationError(
        `Name personalization returned ${parsed.pages?.length ?? 0} pages, expected ${pages.length}`
      );
    }
    return parsed.pages;
  } catch (error) {
    if (error instanceof StoryBankPersonalizationError) throw error;
    throw new StoryBankPersonalizationError(
      `Name personalization LLM call failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}




/**
 * Use Claude Vision to extract a child's facial features from an uploaded photo.
 * Returns a tight 30-50 word physical description used to anchor the generated
 * character to the real child. Returns null if the photo is unavailable or the
 * call fails — caller MUST handle null gracefully (falls back to story-derived DNA).
 *
 * The output is INJECTED into the image-generation prompt as a HARD constraint
 * so every page renders a child who actually resembles the user's real child.
 */
const CHILD_PHOTO_VISION_SYSTEM_PROMPT =
  "You are a children's book illustrator describing a real child's appearance so that another illustrator can draw a cartoon version that clearly resembles them. Be specific about facial features that are recognizable. Never describe emotions, expressions, or clothing — only stable physical features. If the photo contains more than one person, describe ONLY the most prominent / foreground child and completely ignore any background people or faces.";

const CHILD_PHOTO_VISION_USER_PROMPT = `Look at this photo of a child and describe their PHYSICAL APPEARANCE for a children's-book illustrator who needs to draw a cartoon version that clearly looks like THIS specific child.

IMPORTANT: if more than one person appears in the photo, describe ONLY the most prominent / foreground child (the largest, clearest face). Ignore any background people or partial faces entirely — they are not the subject.

Describe in 40-60 words, covering ONLY:
- Face shape (round, oval, heart-shaped)
- Skin tone (warm pale, light olive, medium tan, deep brown, etc — be specific)
- Hair (CRITICAL — measure carefully): exact color; texture (straight/wavy/curly/coily); LENGTH using these rules:
  * LONG = hair ends at or below the shoulders, past the jaw, mid-back, or waist — say "long" explicitly
  * MEDIUM = ends between chin and shoulders only
  * SHORT = above chin / ears / pixie / cropped only
  * Do NOT call shoulder-length or longer hair "short" or "short-to-medium"
  * Describe how the hair falls (e.g. past shoulders, frames face, volume)
- Eyes: shape (round/almond/upturned) and color
- Distinctive features: freckles, dimples, gap teeth, glasses, eyebrow shape, prominent cheeks, etc.

DO NOT describe:
- Clothing, accessories, jewelry
- Emotion, expression, mood
- Background, lighting, photo quality
- Age or gender (the illustrator already has those)

Return ONLY the description as plain text — no preamble, no JSON, no quotes. Just the description.`;

async function describeChildFromPhotoOpenAI(photoUrl: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o';
  try {
    const res = await preImageLlmFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: 0.2,
        messages: [
          { role: 'system', content: CHILD_PHOTO_VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: photoUrl, detail: 'high' } },
              { type: 'text', text: CHILD_PHOTO_VISION_USER_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(
        `[StoryBank/PhotoVision] OpenAI Vision ${res.status}: ${(await res.text()).slice(0, 200)}`
      );
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const description = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (description.length < 20) {
      console.warn(
        `[StoryBank/PhotoVision] OpenAI description too short (${description.length} chars), discarding.`
      );
      return null;
    }
    const normalized = normalizeChildPhotoHairDescription(description);
    console.log(
      `[StoryBank/PhotoVision] OpenAI fallback description (${normalized.length} chars): "${normalized.slice(0, 120)}..."`
    );
    return normalized;
  } catch (err) {
    console.error('[StoryBank/PhotoVision] OpenAI fallback failed:', err);
    return null;
  }
}

export async function describeChildFromPhoto(photoUrl: string): Promise<string | null> {
  if (!photoUrl || photoUrl.trim().length === 0) return null;

  let visionUrl: string;
  try {
    visionUrl = await normalizePhotoUrlForVision(photoUrl);
  } catch (err) {
    if (err instanceof ChildPhotoUploadError) {
      console.warn(`[StoryBank/PhotoVision] ${err.message}`);
      throw err;
    }
    throw new ChildPhotoUploadError();
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      '[StoryBank/PhotoVision] ANTHROPIC_API_KEY missing — trying OpenAI vision fallback (same prompt).'
    );
    return describeChildFromPhotoOpenAI(visionUrl);
  }

  const systemPrompt = CHILD_PHOTO_VISION_SYSTEM_PROMPT;
  const userPrompt = CHILD_PHOTO_VISION_USER_PROMPT;

  try {
    const res = await preImageLlmFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Keep the Anthropic model separately overridable from the OpenAI fallback.
        // The default is centralized in current provider lifecycle authority.
        model:
          process.env.CHILD_PHOTO_VISION_ANTHROPIC_MODEL?.trim() ||
          ANTHROPIC_VISION_MODEL_DEFAULT,
        max_tokens: 400,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: visionUrl } },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`[StoryBank/PhotoVision] Claude Vision ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return describeChildFromPhotoOpenAI(visionUrl);
    }
    const data = await res.json();
    const description: string = data.content?.[0]?.text?.trim() ?? '';
    if (description.length < 20) {
      console.warn(`[StoryBank/PhotoVision] Description too short (${description.length} chars), discarding.`);
      return null;
    }
    const normalized = normalizeChildPhotoHairDescription(description);
    if (normalized !== description) {
      console.log('[StoryBank/PhotoVision] Applied hair-length normalization to vision description');
    }
    console.log(
      `[StoryBank/PhotoVision] Got description (${normalized.length} chars): "${normalized.slice(0, 120)}..."`
    );
    return normalized;
  } catch (err) {
    console.error('[StoryBank/PhotoVision] Failed to call Claude Vision:', err);
    return describeChildFromPhotoOpenAI(visionUrl);
  }
}

/** Structured character identity lock — each field injected as a labeled constraint. */
export type StructuredChildDNA = {
  face: string;      // face shape, skin tone, eye color/shape (15-25 words)
  hair: string;      // color, length, style, accessory (10-20 words)
  body: string;      // build, height relative to age (10-15 words)
  clothing: string;  // EXACT outfit — locked for entire book (15-25 words)
  signature: string; // one unique visual anchor detail (5-10 words)
};

/** Structured companion identity lock. */
export type StructuredCompanionDNA = {
  species: string;   // exact animal/creature type (3-8 words)
  size: string;      // relative to child (5-10 words)
  coloring: string;  // exact color description (10-15 words)
  feature: string;   // one distinctive visual feature (5-10 words)
};

export type StoryBankCharacterDNA = {
  /** Structured child identity — preferred over flat childDNA */
  childStructured: StructuredChildDNA;
  /** Structured companion identity — preferred over flat companionDNA */
  companionStructured: StructuredCompanionDNA;
  /** Flat fallback for backward compat */
  childDNA: string;
  companionDNA: string;
  worldDNA: string;
  negativeRules: string[];
  /** Locked visual descriptions for recurring objects (tree, swing, etc.) */
  propDNA: Record<string, string>;
};

function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Safely parse propDNA from LLM output, falling back to defaults.
 */
function parsePropDNA(
  raw: Record<string, string> | undefined,
  fallback: Record<string, string>
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return fallback;
  const result: Record<string, string> = {};
  let validCount = 0;
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'string' && val.trim().length > 5) {
      result[key.toLowerCase().replace(/\s+/g, '_')] = val.trim();
      validCount++;
    }
  }
  // If LLM returned fewer than 2 props, use fallback entirely
  return validCount >= 2 ? result : fallback;
}

/**
 * Generate compact locked "visual bible" DNA for story-bank image generation.
 */
export async function generateStoryBankCharacterDNA(params: {
  childName: string;
  childGender: string;
  childAge: number;
  companionName: string;
  storyText: string;
  illustrationStyle: string;
  /** Optional Claude-Vision-derived description of the real child's face,
   *  produced by describeChildFromPhoto(). When present, the LLM is told
   *  the generated child MUST closely match these physical features. */
  childPhotoDescription?: string | null;
}): Promise<StoryBankCharacterDNA> {
  const systemPrompt =
    "You are a children's book character designer. Create structured, locked visual DNA for consistent illustrations across every page of a book.";

  const userPrompt = `
You are a children's book character designer. Read the story below and create LOCKED STRUCTURED visual descriptions.

Each field below will be copy-pasted VERBATIM as a LABELED CONSTRAINT into every illustration prompt.
They MUST be in English. They MUST be specific enough that 15 different illustrators would draw the SAME character.

STORY TEXT:
${params.storyText}

CHARACTER:
- Name: ${params.childName}
- Gender: ${params.childGender}
- Age: ${params.childAge}

COMPANION:
- Name: ${params.companionName} (appears as the child's friend/sidekick throughout the story)

STYLE:
- Illustration style: ${params.illustrationStyle}

${params.childPhotoDescription ? `\n⚠️  REAL CHILD PHOTO REFERENCE (HIGHEST PRIORITY — OVERRIDES STORY DEFAULTS):\nThe person reading this book has uploaded a photo of the REAL child. Here is the description of their face:\n\n"${params.childPhotoDescription}"\n\nThe character you describe MUST clearly resemble this real child. Their face, skin tone, hair color/length/texture, eye shape/color, and any distinctive features above MUST be reflected in your "face" and "hair" fields below. Do NOT invent different features. This is the most important constraint.\n` : ''}

RULES FOR CHILD:
- Describe PHYSICAL appearance only — no personality, no emotions, no actions
- Each field must be self-contained and specific
- "face": face shape + skin tone + eye color/shape + any distinctive facial feature (15-25 words)
- "hair": exact color + LENGTH + texture from the photo reference only (10-20 words). If the photo says long/shoulder-length/past shoulders/curly past jaw, the hair field MUST say long — never shorten to medium or short. Do NOT add hair clips, bows, headbands, or other accessories unless explicitly in the photo reference above
- "body": build + approximate height for age ${params.childAge} (10-15 words)
- "clothing": EXACT outfit description — this outfit is LOCKED for the ENTIRE book. Include every garment, color, and any pattern. (15-25 words)
${params.childPhotoDescription ? `- "signature": OPTIONAL. Only a distinctive facial feature explicitly stated in the photo reference (5-10 words). Leave empty string "" if the photo has no unique facial mark. NEVER invent hair clips, glasses, hats, jewelry, birthmarks, or freckles unless explicitly in the photo reference` : `- "signature": ONE unique visual detail that anchors this character's identity across pages (5-10 words)`}
- DO NOT include the character's name anywhere in visual descriptions
- DO NOT put any text, letters, numbers, or words on clothing

RULES FOR COMPANION:
- "species": exact animal/creature type (3-8 words)
- "size": size relative to the child (5-10 words)
- "coloring": exact color description including any patterns or markings (10-15 words)
- "feature": ONE distinctive visual feature that makes this companion recognizable (5-10 words)

WEATHER/ENVIRONMENT from the story:
- Read the story and identify the dominant weather and setting
- Describe in 20 words: weather, time of day, dominant colors, ground condition
- Include a color palette constraint — consistent muted soft palette across all pages

RECURRING OBJECTS (CRITICAL):
- Identify ALL objects that appear on MORE THAN ONE page
- For EACH: write a locked 15-25 word visual description (exact shape, size, color, material)
- These will be copy-pasted into every page where the object appears — must look IDENTICAL every time

Return JSON:
{
  "childStructured": {
    "face": "15-25 words: face shape, skin tone, eye color/shape, distinctive facial feature",
    "hair": "10-20 words: exact color, length, style, any hair accessory",
    "body": "10-15 words: build and height relative to age",
    "clothing": "15-25 words: every garment, exact colors, patterns — LOCKED for entire book",
    "signature": "5-10 words: one unique anchoring visual detail"
  },
  "companionStructured": {
    "species": "3-8 words: exact animal/creature type",
    "coloring": "10-15 words: exact colors and markings",
    "feature": "5-10 words: one distinctive visual feature"
  },
  "childDNA": "40-60 words: flat paragraph combining all child fields above (backward compat)",
  "companionDNA": "20-30 words: flat paragraph combining all companion fields above",
  "worldDNA": "20-30 words: weather, time, palette, ground condition",
  "propDNA": {
    "object_name": "15-25 word locked visual description",
    "another_object": "15-25 word locked visual description"
  },
  "negativeRules": [
    "NEVER put text, letters, numbers, or words on clothing, walls, signs, or any surface",
    "NEVER change the child's outfit, hair, or accessories between pages",
    "Rule 3",
    "Rule 4"
  ]
}
`.trim();

  const genderWord = params.childGender === 'girl' ? 'girl' : 'boy';


  const fallbackChildStructured: StructuredChildDNA = {
    face: `Round soft face, warm light olive skin, large dark brown almond-shaped eyes, small upturned nose`,
    hair: `Medium-length straight brown hair, tucked behind ears, thin red fabric headband`,
    body: `Average build for a ${params.childAge}-year-old ${genderWord}, about ${params.childAge >= 5 ? '3.5' : '3'} feet tall`,
    clothing: `Yellow rain jacket with two front pockets, blue denim shorts, white canvas sneakers`,
    signature: `Always carries a worn stuffed bunny in left hand`,
  };
  const fallbackCompanionStructured: StructuredCompanionDNA = {
    species: 'cat',
    size: `Small, fits comfortably in the child's arms`,
    coloring: `${'Orange tabby with white chest patch'}`,
    feature: `Big round curious eyes that always look directly at the child`,
  };
  const photoAnchoredChild = params.childPhotoDescription?.trim()
    ? buildPhotoAnchoredChildStructured(
        params.childPhotoDescription.trim(),
        params.childAge,
        params.childGender
      )
    : null;

  const fallback: StoryBankCharacterDNA = {
    childStructured: photoAnchoredChild ?? fallbackChildStructured,
    companionStructured: fallbackCompanionStructured,
    childDNA: `${fallbackChildStructured.face}. ${fallbackChildStructured.hair}. ${fallbackChildStructured.body}. ${fallbackChildStructured.clothing}. ${fallbackChildStructured.signature}.`,
    companionDNA: `${fallbackCompanionStructured.species}, ${fallbackCompanionStructured.size}. ${fallbackCompanionStructured.coloring}. ${fallbackCompanionStructured.feature}.`,
    worldDNA: 'Warm soft natural lighting, gentle depth-of-field, environment described per page imageDirection (do NOT default to bedroom/indoor — honor whatever setting each page specifies, including underwater/forest/sky/etc).',
    propDNA: {},
    negativeRules: [
      "NEVER put text, letters, numbers, or words on clothing, walls, signs, or any surface",
      "NEVER change the child's outfit, hair, or accessories between pages",
    ],
  };

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY missing');
    const model = process.env.STORY_GENERATION_MODEL || 'gpt-4o';
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    };
    if (model.startsWith('gpt-5.')) {
      body.max_completion_tokens = 1500;
    } else {
      body.max_tokens = 1500;
      body.temperature = 0.2;
    }
    const res = await preImageLlmFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const parsed = parseJsonResponse<Partial<StoryBankCharacterDNA>>(text);

    return finalizeDNA(assembleDNA(parsed, fallback));
  } catch (error) {
    console.warn('[StoryBankDNA] failed, using fallback DNA:', error);
    return finalizeDNA(fallback);
  }

  function finalizeDNA(dna: StoryBankCharacterDNA): StoryBankCharacterDNA {
    const childStructured = sanitizeChildStructuredAgainstPhoto(
      dna.childStructured,
      params.childPhotoDescription
    );
    return {
      ...dna,
      childStructured,
      childDNA: joinChildStructuredDNA(childStructured),
    };
  }

  /** Merge LLM output with fallback, validating structured fields. */
  function assembleDNA(
    parsed: Partial<StoryBankCharacterDNA>,
    fb: StoryBankCharacterDNA
  ): StoryBankCharacterDNA {
    // Validate structured child fields — each must be a non-empty string
    const cs = parsed.childStructured;
    const childStructured: StructuredChildDNA =
      cs &&
      typeof cs.face === 'string' && cs.face.trim().length > 5 &&
      typeof cs.hair === 'string' && cs.hair.trim().length > 5 &&
      typeof cs.body === 'string' && cs.body.trim().length > 5 &&
      typeof cs.clothing === 'string' && cs.clothing.trim().length > 5 &&
      typeof cs.signature === 'string' && cs.signature.trim().length > 3
        ? {
            face: cs.face.trim(),
            hair: cs.hair.trim(),
            body: cs.body.trim(),
            clothing: cs.clothing.trim(),
            signature: cs.signature.trim(),
          }
        : fb.childStructured;

    // Validate structured companion fields
    const cps = parsed.companionStructured;
    const companionStructured: StructuredCompanionDNA =
      cps &&
      typeof cps.species === 'string' && cps.species.trim().length > 2 &&
      typeof cps.size === 'string' && cps.size.trim().length > 3 &&
      typeof cps.coloring === 'string' && cps.coloring.trim().length > 5 &&
      typeof cps.feature === 'string' && cps.feature.trim().length > 3
        ? {
            species: cps.species.trim(),
            size: cps.size.trim(),
            coloring: cps.coloring.trim(),
            feature: cps.feature.trim(),
          }
        : fb.companionStructured;

    // Build flat DNA from structured if LLM didn't provide it
    const childDNA =
      parsed.childDNA?.trim() ||
      joinChildStructuredDNA(childStructured);
    const companionDNA =
      parsed.companionDNA?.trim() ||
      `${companionStructured.species}, ${companionStructured.size}. ${companionStructured.coloring}. ${companionStructured.feature}.`;

    const result: StoryBankCharacterDNA = {
      childStructured,
      companionStructured,
      childDNA,
      companionDNA,
      worldDNA: parsed.worldDNA?.trim() || fb.worldDNA,
      propDNA: parsePropDNA(parsed.propDNA, fb.propDNA),
      negativeRules:
        parsed.negativeRules?.filter(
          (rule): rule is string => typeof rule === 'string' && !!rule.trim()
        ) ?? fb.negativeRules,
    };

    console.log(
      `[StoryBankDNA] Structured child: face=${childStructured.face.length}ch hair=${childStructured.hair.length}ch clothing=${childStructured.clothing.length}ch signature="${childStructured.signature}"`
    );
    console.log(
      `[StoryBankDNA] Structured companion: species="${companionStructured.species}" coloring=${companionStructured.coloring.length}ch feature="${companionStructured.feature}"`
    );

    return result;
  }
}
