/**
 * v0.2.2: Deterministic post-draft fixes.
 *
 * Some failures (especially name mutations like "שולי" instead of "בּוֹלִי") are
 * deterministic typos that the LLM produces sporadically. Asking the LLM to
 * "repair" them in REPAIR MODE is expensive AND risks the model rewriting
 * adjacent prose. Fix them in code first.
 *
 * Pipeline placement: between Draft and first Validate (or between failed
 * Validate and LLM Repair) — see orchestrate.ts.
 */
import { getCompanionBible } from '@/lib/companion-bible';
import { parseStoryMarkdown, type ValidationReport } from '@/lib/story-validators';
import { resolvePageCount } from '../data/direction-dna';
import { pagesFromParsed, rebuildStoryMarkdown } from '../markdown';
import type { GenerateInput } from '../types';

/**
 * v0.2.5 — Force canonical frontmatter values.
 *
 * Draft was hallucinating frontmatter values across 8/9 stories in batch v0.2.4:
 *   direction: "bedtime"           ← for every direction (default fallback)
 *   companionId: "001" / "boli" / "bat001" / "לילי" ← any non-canonical form
 *
 * The frontmatter values are 100% deterministic from the order context. There is
 * NO reason to let the LLM author them. Replace them in code post-draft.
 *
 * Body text + imageDirection stay LLM-authored — those are creative.
 */
export function enforceCanonicalFrontmatter(
  storyMarkdown: string,
  input: GenerateInput
): { storyMarkdown: string; changedFields: string[] } {
  const parsed = parseStoryMarkdown(storyMarkdown);
  const fm = { ...parsed.frontmatter };
  const changed: string[] = [];

  // Canonical values from input — these are always right
  const pageCount = resolvePageCount(input.direction, input.pageCount);
  const bible = getCompanionBible(input.companionId);

  if (fm.companionId !== input.companionId) {
    fm.companionId = input.companionId;
    changed.push('companionId');
  }
  if (fm.direction !== input.direction) {
    fm.direction = input.direction;
    changed.push('direction');
  }
  if (fm.childGender !== input.childGender) {
    fm.childGender = input.childGender;
    changed.push('childGender');
  }
  if (Number(fm.pages) !== pageCount) {
    fm.pages = pageCount;
    changed.push('pages');
  }
  // Title: keep LLM's if it exists, fallback to "{childName} + {companionNameClean}"
  if (!fm.title || typeof fm.title !== 'string' || !fm.title.trim()) {
    const companionName = bible?.nameClean ?? input.companionId;
    fm.title = `${input.childName} ו${companionName}`;
    changed.push('title');
  }

  if (changed.length === 0) {
    return { storyMarkdown, changedFields: [] };
  }

  return {
    storyMarkdown: rebuildStoryMarkdown(fm, pagesFromParsed(parsed)),
    changedFields: changed,
  };
}

/**
 * v0.2.5.1 — English leak fixes. Draft LLM occasionally drops English nouns into
 * Hebrew prose ("lashes" instead of "ריסים"). These are deterministic translations
 * for common words we've seen leak in production.
 *
 * Conservative: only replace when surrounded by Hebrew context (whitespace or Hebrew letters).
 */
const ENGLISH_LEAK_FIXES: Record<string, string> = {
  lashes: 'ריסים',
  eyes: 'עיניים',
  cheek: 'לחי',
  blanket: 'שמיכה',
  pillow: 'כרית',
  bedroom: 'חדר השינה',
  hand: 'יד',
  shoulder: 'כתף',
  whisper: 'לחישה',
  // Add more as we see new leaks in batches
};

export function fixEnglishLeaks(
  storyMarkdown: string
): { storyMarkdown: string; replacementCount: number; replacedTokens: string[] } {
  let fixed = storyMarkdown;
  let replacementCount = 0;
  const replacedTokens: string[] = [];

  for (const [eng, heb] of Object.entries(ENGLISH_LEAK_FIXES)) {
    // Only replace when surrounded by whitespace/punctuation/Hebrew chars (not inside other English words).
    // We do NOT want to touch English in imageDirection — parser handles that separately.
    // But auto-fix runs on the FULL markdown, which includes imageDirection. So we only
    // match when the word is surrounded by Hebrew context (Hebrew chars or Hebrew punctuation).
    const escapedEng = eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Hebrew letter ranges: ֐-׿. A Hebrew char + ASCII English + Hebrew char pattern.
    const pattern = new RegExp(
      `(^|[\\s.,;:!?"'״׳—\\-()\\[\\]\\u0590-\\u05FF])${escapedEng}([\\s.,;:!?"'״׳—\\-()\\[\\]\\u0590-\\u05FF]|$)`,
      'g'
    );
    let didReplace = false;
    fixed = fixed.replace(pattern, (full, before, after) => {
      // Only replace if at least one boundary is Hebrew — confirms we're in Hebrew prose.
      const hebrewRange = /[֐-׿]/;
      if (!hebrewRange.test(before) && !hebrewRange.test(after)) {
        return full; // probably inside English imageDirection — skip
      }
      replacementCount++;
      didReplace = true;
      return `${before}${heb}${after}`;
    });
    if (didReplace) replacedTokens.push(`${eng}→${heb}`);
  }

  return { storyMarkdown: fixed, replacementCount, replacedTokens };
}

/**
 * v0.3.5 — Strip leaked planning bracket labels from prose.
 *
 * v0.3.3 batch produced fantasy page 9 starting with "[medical-object-appears]"
 * because the arc-example used that prefix format. v0.3.5 fixed the arc example
 * to remove the brackets, but we also need a runtime safety net: if the model
 * still emits a bracket label of a known beat ID, remove it.
 *
 * Only matches a closed allowlist of known beat IDs — NOT generic [..] which
 * could be legitimate punctuation in some Hebrew text.
 */
const KNOWN_BEAT_LABELS = [
  'medical-object-appears',
  'child-body-resists',
  'companion-closes',
  'child-mirrors',
  'procedure-happens',
  'sticker-closes',
  'companion-opens',
  'residue',
];

export function stripBeatLabels(
  storyMarkdown: string
): { storyMarkdown: string; strippedCount: number } {
  let fixed = storyMarkdown;
  let strippedCount = 0;
  for (const label of KNOWN_BEAT_LABELS) {
    // Match the label as a bracketed token, with optional surrounding whitespace.
    // Replace with a single space and let downstream collapse whitespace.
    const re = new RegExp(`\\s*\\[${label}\\]\\s*`, 'g');
    const before = fixed;
    fixed = fixed.replace(re, ' ');
    if (fixed !== before) {
      const matches = before.match(re);
      strippedCount += matches ? matches.length : 0;
    }
  }
  // Collapse double spaces created by stripping at line starts.
  fixed = fixed.replace(/^[ \t]+/gm, '').replace(/[ \t]+\n/g, '\n');
  return { storyMarkdown: fixed, strippedCount };
}

/** Per-companion known name mutations (deterministic find/replace). */
/**
 * v0.2.3 — TIGHT preemptive list. ONLY mutations that have NO legitimate Hebrew
 * meaning. Real Hebrew words removed from this list — they get caught reactively
 * by tryAutoNameFixFromReport AFTER companionName validator flags them in context.
 *
 * REMOVED from preemptive (real Hebrew words that auto-fix was corrupting):
 *   - 'בוקע' (light/sound emerging) — corrupted "אור בוקע" → "אור בּוֹלִי"
 *   - 'בועה' (bubble)
 *   - 'בוקר' (morning) — direction-drift signal, not a name mutation
 *   - 'בחול' (in sand) — legitimate in adventure/fantasy
 *   - 'בקול' (in voice) — legitimate
 *   - 'בועה' (bubble)
 *   - 'בולה' / 'בובה' — also legitimate (doll, marble)
 *
 * What REMAINS: tokens that are clearly broken names with no Hebrew meaning.
 */
const KNOWN_NAME_MUTATIONS: Record<string, string[]> = {
  bolly_armadillo: [
    'בולו', 'בולא', 'בובו',
  ],
  bat_lily: [
    'ליליל', 'לִיללִי', 'ליליי',
  ],
  chameleon_koko: [
    'קימו', 'קומי', 'קימי',
  ],
};

/**
 * Escapes regex special chars for safe use in a RegExp constructor.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace standalone Hebrew tokens that match known mutations.
 * Token boundary = start-of-string OR non-Hebrew char (preserves Hebrew prefixes
 * like ה/ב/ל/ו from being treated as boundaries — they're already part of the word).
 *
 * Returns the fixed story + count of replacements (for logging).
 */
export function autoFixCompanionMutations(
  storyMarkdown: string,
  companionId: string
): { storyMarkdown: string; replacementCount: number; replacedTokens: string[] } {
  const bible = getCompanionBible(companionId);
  const mutations = KNOWN_NAME_MUTATIONS[companionId];
  if (!bible || !mutations || mutations.length === 0) {
    return { storyMarkdown, replacementCount: 0, replacedTokens: [] };
  }

  const canonical = bible.nameClean;
  let fixed = storyMarkdown;
  let replacementCount = 0;
  const replacedTokens: string[] = [];

  for (const mutation of mutations) {
    // Standalone token boundary: surrounded by non-Hebrew chars or start/end of string.
    // Crucially: Hebrew prefix letters (ה, ו, ב, ל, מ, ש, כ) are PART of a word — we do
    // NOT want to match "השולי" as "שולי" + prefix, because that's likely intentional.
    // We match the token only when it's at a true word boundary.
    const pattern = new RegExp(
      `(^|[\\s.,;:!?"'״׳—\\-()\\[\\]])${escapeRegex(mutation)}([\\s.,;:!?"'״׳—\\-()\\[\\]]|$)`,
      'g'
    );
    fixed = fixed.replace(pattern, (_, before, after) => {
      replacementCount++;
      if (!replacedTokens.includes(mutation)) replacedTokens.push(mutation);
      return `${before}${canonical}${after}`;
    });
  }

  return { storyMarkdown: fixed, replacementCount, replacedTokens };
}

/**
 * Smart auto-fix: extract suspicious tokens from a validation report's
 * companionName findings, and ONLY replace tokens that the validator actually
 * flagged. This is safer than blanket mutation lists because it's reactive,
 * not preemptive.
 *
 * Use case: after first validate fails with companionName BLOCKING — try this
 * before paying for LLM repair.
 */
export function tryAutoNameFixFromReport(
  storyMarkdown: string,
  report: ValidationReport,
  companionId: string
): { storyMarkdown: string; fixed: boolean; replacedTokens: string[] } {
  const bible = getCompanionBible(companionId);
  if (!bible) return { storyMarkdown, fixed: false, replacedTokens: [] };

  // Collect every suspicious token from companionName BLOCKING findings
  const suspiciousTokens = new Set<string>();
  for (const f of report.findings) {
    if (f.validator !== 'companionName') continue;
    if (f.severity !== 'BLOCKING') continue;
    if (f.excerpt) suspiciousTokens.add(f.excerpt.trim());
  }
  if (suspiciousTokens.size === 0) {
    return { storyMarkdown, fixed: false, replacedTokens: [] };
  }

  const canonical = bible.nameClean;
  let fixed = storyMarkdown;
  const replacedTokens: string[] = [];

  for (const token of suspiciousTokens) {
    if (token === canonical) continue; // safety: don't replace canonical
    const pattern = new RegExp(
      `(^|[\\s.,;:!?"'״׳—\\-()\\[\\]])${escapeRegex(token)}([\\s.,;:!?"'״׳—\\-()\\[\\]]|$)`,
      'g'
    );
    const before = fixed;
    fixed = fixed.replace(pattern, (_match, b, a) => `${b}${canonical}${a}`);
    if (fixed !== before) replacedTokens.push(token);
  }

  return { storyMarkdown: fixed, fixed: fixed !== storyMarkdown, replacedTokens };
}
