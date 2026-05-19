/**
 * v0.4 — derive a PageBlueprint[] from the Plan + age tier + category anchors.
 *
 * The blueprint is the contract between Code and the Author LLM:
 *   - Author CAN: choose Hebrew sentences
 *   - Author MUST: stay within maxWords, maxSentences
 *   - Author MUST: include requiredAnchor verbatim when present
 *   - Author MUST: ensure companion physically appears when flagged
 *
 * Each procedure beat (when phase=procedure) gets its own blueprint entry
 * with a SMALL cap (30-40 words) so the model cannot collapse beats.
 */
import type { Plan } from '../types';
import { getAgeTier } from '../prompts/draft-prompt';
import {
  getCategoryAnchors,
  type CategoryAnchors,
  type ProcedureBeat,
} from '../prompts/category-anchors';
import type { GenerateInput } from '../types';
import type {
  PageBlueprint,
  DraftPage,
  BlueprintValidationFinding,
} from '../editorial/draft-page-schema';

interface BuildBlueprintArgs {
  plan: Plan;
  input: GenerateInput;
}

/**
 * Build one blueprint entry per page from the Plan's beatMap.
 * If the direction is procedure-phase (adventure/fantasy), the procedure
 * beats are interleaved into the appropriate pages by purpose-tag.
 *
 * The blueprint is the input the Author sees inline in the prompt.
 */
export function buildPageBlueprint(args: BuildBlueprintArgs): PageBlueprint[] {
  const { plan, input } = args;
  const tier = getAgeTier(input.childAge);
  const [tierMinWords, tierMaxWords] = parseWordRange(tier.wordsPerPage);
  const tierMaxSentences = parseMaxSentences(tier.sentencesPerPage);

  const anchors = getCategoryAnchors(input.companionId, input.direction);
  const procedureBeats = anchors.phase === 'procedure' ? anchors.procedureMoment ?? [] : [];

  // Map procedure beat indices to actual page numbers using the beatMap heuristic:
  // procedure phase is roughly the middle 30-40% of pages. Default: place the
  // 6 beats at the heart-page +/- 3 unless beatMap suggests otherwise.
  const procedurePages = mapProcedureBeatsToPages({
    pageCount: plan.beatMap.length,
    momentPage: plan.momentContract.page,
    beatCount: procedureBeats.length,
  });

  const blueprint: PageBlueprint[] = plan.beatMap.map((beat) => {
    const beatIndex = procedurePages.indexOf(beat.pageNumber);
    const procedureBeat = beatIndex >= 0 ? procedureBeats[beatIndex] : undefined;

    // Cap target words at tier's max — never let the Plan override the age cap.
    const target = clamp(beat.wordCountTarget, tierMinWords, tierMaxWords);
    const maxWords = procedureBeat
      ? Math.min(tierMaxWords, 32) // procedure beats stay tight
      : tierMaxWords;

    const companionDecision = deriveCompanionRequired({
      pageNumber: beat.pageNumber,
      direction: input.direction,
      anchors,
      beatHasCompanion: hasCompanionMention(beat.companionAction, input.companionId),
    });

    // v0.4.8 — reserve a sentence slot for auto-inject on per-page strict
    // companion-required pages. Without this, the model could fill all
    // maxSentences slots without naming the companion, and tryInjectCompanionLine
    // would refuse (no room). The fantasy p2 missing-companion HARD GATE in the
    // v0.4.7 batch failed precisely because the page was full.
    //
    // Bumping by 1 here gives auto-inject a guaranteed slot. The model sees
    // maxSentences=4 instead of 3; even if the model produces 4 sentences with
    // the companion in one of them, no inject needed. If the model produces
    // 3 sentences without companion, auto-inject fits the 4th.
    const isPerPageCompanionStrict =
      companionDecision.required && companionDecision.mode === 'per-page';
    const adjustedMaxSentences = isPerPageCompanionStrict
      ? tierMaxSentences + 1
      : tierMaxSentences;

    return {
      page: beat.pageNumber,
      purpose: procedureBeat
        ? `[procedure beat ${beatIndex + 1}/${procedureBeats.length}] ${procedureBeat.description}`
        : beatPurposeFromBeatMap(beat),
      targetWords: target,
      maxWords,
      maxSentences: adjustedMaxSentences,
      requiredCompanionPresence: companionDecision.required,
      companionRequirementMode: companionDecision.mode,
      requiredAnchor: procedureBeat ? undefined : deriveAnchor(beat),
    };
  });

  return blueprint;
}

function parseWordRange(range: string): [number, number] {
  const m = range.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return [12, 24];
  return [Number(m[1]), Number(m[2])];
}

function parseMaxSentences(range: string): number {
  const m = range.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return 3;
  return Number(m[2]);
}

function clamp(n: number | undefined, min: number, max: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return Math.round((min + max) / 2);
  return Math.max(min, Math.min(max, n));
}

/**
 * Map procedure beats to story pages.
 * Strategy: center them on the heart-page (momentContract.page),
 * expanding outward.
 */
function mapProcedureBeatsToPages(args: {
  pageCount: number;
  momentPage: number;
  beatCount: number;
}): number[] {
  const { pageCount, momentPage, beatCount } = args;
  if (beatCount === 0) return [];

  // Place beats centered on momentPage, but never before page 3 (need setup)
  // and never after pageCount - 1 (need post-procedure).
  const earliest = Math.max(3, momentPage - Math.floor(beatCount / 2));
  const latest = Math.min(pageCount - 1, earliest + beatCount - 1);
  const start = Math.max(3, latest - beatCount + 1);

  const pages: number[] = [];
  for (let i = 0; i < beatCount; i++) {
    const page = start + i;
    if (page >= 1 && page <= pageCount) pages.push(page);
  }
  return pages;
}

function beatPurposeFromBeatMap(beat: {
  location: string;
  childAction: string;
  companionAction: string;
}): string {
  const parts: string[] = [];
  if (beat.location) parts.push(`location: ${beat.location}`);
  if (beat.childAction) parts.push(`child: ${beat.childAction}`);
  if (beat.companionAction) parts.push(`companion: ${beat.companionAction}`);
  return parts.join(' | ').slice(0, 160);
}

/**
 * v0.4.2 — Direction-aware companion presence requirement.
 *
 * Old behavior: pages 1-2 of every procedure-phase story required companion.
 * That over-triggered. Adventure page 1 can legitimately open with the child
 * waking up alone — companion arrives on page 2.
 *
 * New rules:
 *   bedtime    — companion appears by page 1 or 2 (no hard slot)
 *   adventure  — page 1 can be child/scene. Companion required FROM page 2.
 *   fantasy    — page 1 AND page 2 require companion (story leaves reality fast;
 *                without companion early, the fantasy detaches)
 *
 * Plus: from page 3 onward, the explicit beatHasCompanion signal still drives.
 */
function deriveCompanionRequired(args: {
  pageNumber: number;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  anchors: CategoryAnchors;
  beatHasCompanion: boolean;
}): { required: boolean; mode: 'per-page' | 'cumulative-by' } {
  if (args.direction === 'fantasy') {
    // Fantasy is strict — without companion early, the fantasy detaches.
    if (args.pageNumber <= 2) return { required: true, mode: 'per-page' };
  } else if (args.direction === 'adventure') {
    // Adventure p2: cumulative — Bolly must have appeared by here.
    // If page 1 had him, page 2 doesn't have to. If page 1 didn't, page 2 must.
    if (args.pageNumber === 2) return { required: true, mode: 'cumulative-by' };
  }
  // bedtime + page-3+: follow the beatMap signal (per-page).
  return { required: args.beatHasCompanion, mode: 'per-page' };
}

/**
 * v0.4.2 — accept signature sound / signature object as evidence of presence.
 * In the world of the book, "טוּמְפּ" IS Bolly. Forcing the literal name on every
 * page leads to "בולי" appearing 8+ times which itself is awkward.
 *
 * Per-companion signatures match by niqqud-stripped substring.
 */
const COMPANION_SIGNATURES: Record<string, RegExp> = {
  bolly_armadillo: /בולי|טומפ|טוּמְפּ|שריון/,
  bat_lily: /לילי|ששש|כנף|פנס/,
  chameleon_koko: /קים|קוקו|פששש|צעיף/,
};

/**
 * Normalize Hebrew for substring/regex matching.
 *
 * Strips:
 *   - Hebrew niqqud and cantillation marks (U+0591–U+05C7)
 *   - Bidirectional control characters (RTL/LTR markers)
 *   - Collapses whitespace runs
 *
 * #169 — COMPANION_SIGNATURES patterns are written WITHOUT niqqud
 * ("בולי", not "בּוֹלִי"). When the Author or our deterministic
 * requiredExactLine injection emits the canonical form WITH niqqud, the
 * raw .test() fails because niqqud characters sit between the consonants.
 * Normalizing the haystack before regex/substring fixes the false-negative.
 */
function normalizeHebrewForMatch(s: string): string {
  return s
    .replace(/[֑-ׇ]/g, '')      // niqqud + cantillation
    .replace(/[‎‏‪-‮]/g, '') // bidi markers
    .replace(/\s+/g, ' ');
}

/** Exported for #170 — used by structured-draft.ts to decide whether
 * requiredExactLine injection is actually needed (don't overwrite
 * Author prose when companion is already mentioned somehow). */
export function hasCompanionMention(action: string, companionId?: string): boolean {
  if (!action) return false;
  const normalized = normalizeHebrewForMatch(action);
  if (companionId && COMPANION_SIGNATURES[companionId]) {
    return COMPANION_SIGNATURES[companionId].test(normalized);
  }
  // Fallback: generic name regex
  return /בולי|לילי|קים|קוקו/.test(normalized);
}

function deriveAnchor(beat: {
  childAction: string;
  companionAction: string;
}): string | undefined {
  // Pull a likely anchor word from the beat description.
  // Common medical anchors first; fall back to companion sound.
  const ANCHOR_WORDS = ['מדחום', 'מדבקה', 'בדיקה', 'טומפ', 'טוּמְפּ', 'בפנים היה חם'];
  const text = `${beat.childAction} ${beat.companionAction}`;
  return ANCHOR_WORDS.find((w) => text.includes(w));
}

/**
 * v0.4 — validate the Author's JSON output against the blueprint.
 *
 * Returns findings (empty if valid). Used by the Draft stage to decide
 * whether to retry the LLM call once.
 */
export function validateDraftAgainstBlueprint(
  pages: DraftPage[],
  blueprint: PageBlueprint[],
  companionId?: string
): BlueprintValidationFinding[] {
  const findings: BlueprintValidationFinding[] = [];

  // Page count mismatch is a structural error.
  if (pages.length !== blueprint.length) {
    findings.push({
      page: 0,
      rule: 'page-mismatch',
      detail: `Author returned ${pages.length} pages; blueprint expected ${blueprint.length}.`,
    });
    return findings; // No point checking per-page if counts differ.
  }

  for (let i = 0; i < blueprint.length; i++) {
    const bp = blueprint[i];
    const page = pages[i];

    if (page.page !== bp.page) {
      findings.push({
        page: bp.page,
        rule: 'page-mismatch',
        detail: `Author labeled page ${page.page} where blueprint expected ${bp.page}.`,
      });
      continue;
    }

    if (page.textSentences.length > bp.maxSentences) {
      findings.push({
        page: bp.page,
        rule: 'too-many-sentences',
        detail: `Page ${bp.page} has ${page.textSentences.length} sentences; max ${bp.maxSentences}.`,
      });
    }

    const wordCount = countHebrewWords(page.textSentences.join(' '));
    if (wordCount > bp.maxWords) {
      findings.push({
        page: bp.page,
        rule: 'too-many-words',
        detail: `Page ${bp.page} has ${wordCount} Hebrew words; max ${bp.maxWords}.`,
      });
    }

    if (bp.requiredAnchor) {
      // #169 — normalize both sides for nikud-tolerant substring match.
      // Recipe mustInclude entries may be stored without niqqud while the
      // Author writes with partial niqqud (or vice versa) — raw .includes()
      // fails on mismatch even when the word is semantically present.
      const normalizedAnchor = normalizeHebrewForMatch(bp.requiredAnchor);
      const anchorPresent = page.textSentences.some((s) =>
        normalizeHebrewForMatch(s).includes(normalizedAnchor)
      );
      if (!anchorPresent) {
        findings.push({
          page: bp.page,
          rule: 'missing-anchor',
          detail: `Page ${bp.page} missing required anchor "${bp.requiredAnchor}".`,
        });
      }
    }

    if (bp.requiredCompanionPresence) {
      const text = page.textSentences.join(' ');
      const onThisPage = hasCompanionMention(text, companionId);
      const mode = bp.companionRequirementMode ?? 'per-page';

      if (mode === 'cumulative-by') {
        // v0.4.3 — cumulative: pass if companion appeared on this page OR
        // any earlier page (1..bp.page-1).
        const earlierPages = pages.filter((p) => p.page < bp.page);
        const onEarlier = earlierPages.some((p) =>
          hasCompanionMention(p.textSentences.join(' '), companionId)
        );
        if (!onThisPage && !onEarlier) {
          findings.push({
            page: bp.page,
            rule: 'missing-companion',
            detail: `Companion has not appeared by page ${bp.page}. Add the companion's name (e.g., "בּוֹלִי") OR signature sound (e.g., "טוּמְפּ") on this page or any earlier page.`,
          });
        }
      } else {
        // per-page strict
        if (!onThisPage) {
          findings.push({
            page: bp.page,
            rule: 'missing-companion',
            detail: `Page ${bp.page} requires the companion on THIS page. Add the literal "בּוֹלִי" OR his signature sound "טוּמְפּ" to textSentences. A single short line is enough: "בּוֹלִי הציץ. טוּמְפּ."`,
          });
        }
      }
    }
  }

  return findings;
}

function countHebrewWords(text: string): number {
  return text
    .split(/[\s,.;:!?\-]+/)
    .filter((w) => /[֐-׿]/.test(w))
    .length;
}

/**
 * Format the blueprint for inclusion in the Draft prompt.
 * The Author sees this and must follow per-page.
 *
 * v0.4.2 — when a page requires companion presence, emit a concrete example
 * starter line. Saying "companionMustAppear=true" alone doesn't tell the
 * model HOW; the example gives it a pattern to riff on.
 */
const COMPANION_LINE_EXAMPLES: Record<string, string[]> = {
  bolly_armadillo: [
    '"בּוֹלִי התגלגל אליה. טוּמְפּ קטן נשמע."',
    '"מתחת לשמיכה זז משהו. בּוֹלִי הציץ החוצה."',
    '"בּוֹלִי נח על הכר ליד נועה."',
    '"בכיס של נועה נשמע טוּמְפּ. בּוֹלִי היה שם."',
  ],
  bat_lily: [
    '"לִילִי תלויה הפוכה מהמדף. ששש."',
    '"כנף קטנה של לִילִי עטפה את הצעצוע."',
  ],
  chameleon_koko: [
    '"קִים על הקיר. הצעיף הפסים שלה לא משתנה."',
    '"קִים שאפה אוויר. פששש."',
  ],
};

export function formatBlueprintForPrompt(
  blueprint: PageBlueprint[],
  companionId?: string
): string {
  const examples = companionId ? COMPANION_LINE_EXAMPLES[companionId] ?? [] : [];

  const lines: string[] = ['PAGE BLUEPRINT — fill each page within its caps:'];
  for (const bp of blueprint) {
    const parts = [
      `Page ${bp.page}: purpose="${bp.purpose}"`,
      `  target=${bp.targetWords}w max=${bp.maxWords}w maxSentences=${bp.maxSentences}`,
    ];
    if (bp.requiredCompanionPresence) {
      const mode = bp.companionRequirementMode ?? 'per-page';
      if (mode === 'cumulative-by') {
        parts.push(
          `  companionMustAppearBy=page${bp.page} (cumulative — OK if the companion already appeared on an earlier page)`
        );
      } else {
        parts.push(
          '  companionMustAppearOnThisPage=true (this page MUST contain the companion name or signature sound)'
        );
      }
      // v0.4.2/v0.4.3 — concrete example for the model to riff on.
      if (examples.length) {
        const ex = examples[(bp.page - 1) % examples.length];
        parts.push(`  HINT example line: ${ex}`);
      }
    }
    if (bp.requiredAnchor) parts.push(`  requiredAnchor="${bp.requiredAnchor}"`);
    lines.push(parts.join('\n'));
  }
  return lines.join('\n');
}
