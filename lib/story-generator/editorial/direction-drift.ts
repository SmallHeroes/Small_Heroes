/**
 * v0.2.6 — Adventure direction drift detector.
 *
 * Identified pattern in batch v0.2.5.1: stories with direction=adventure routinely
 * stay in bedroom/blanket setting and end at sunrise. That's bedtime, not adventure.
 *
 * Deterministic check: count pages with bed/sleep/blanket signals.
 * If too many pages stay in bed-state → flag as MAJOR direction_drift.
 *
 * No LLM call. Fast. Catches the pattern without false positives because we only
 * activate for direction=adventure or direction=fantasy.
 */
import type { ParsedStory } from '@/lib/story-validators';
import { stripHebrewNiqqud } from './known-bad-hebrew';
import type { EditorialIssueRuntime } from './schemas';

/** Words that signal "currently in/near bed" — heavy presence = bedtime, not adventure. */
const BED_STATE_TOKENS = [
  'מיטה', 'מיטתה', 'מיטתו', 'במיטה',
  'שמיכה', 'השמיכה', 'בשמיכה',
  'כרית', 'הכרית', 'בכרית',
  'סדין', 'הסדין', 'בסדין',
  'נרדמת', 'נרדם', 'נרדמו',
  'תרדם', 'תירדם', 'תירדמי',
  'ישנה', 'ישן', 'ישנים',
  'עיניים נעצמות', 'עוצמת עיניים', 'עיניה נעצמות',
];

/** "Morning wake-up" tokens — should NOT close bedtime story (child becomes active). */
const MORNING_WAKE_TOKENS = [
  'בוקר', 'הבוקר', 'בבוקר',
  'מתעוררת', 'מתעורר', 'התעוררה', 'התעורר',
  'אור ראשון', 'שמש עולה', 'עלה הבוקר',
];

/**
 * v0.4.6 — Regex-based morning detection with Hebrew article tolerance.
 *
 * v0.4.5 batch had bedtime page 10 = "האור הראשון מחליק דרך התריסים".
 * Substring check for "אור ראשון" missed it because the definite article ה
 * inserted between the two words ("אור הראשון") broke the contiguous match.
 *
 * These regex patterns tolerate ה' inserted before either word.
 */
const MORNING_WAKE_RE: RegExp[] = [
  /\bה?בוקר\b/,                          // בוקר / הבוקר
  /\bבבוקר\b/,                            // בבוקר
  /\bמתעורר(ת|ים)?\b/,                    // מתעוררת / מתעורר / מתעוררים
  /\bהתעורר(ה|ו|תי)?\b/,                  // התעוררה / התעורר / התעוררו
  /\bה?אור\s+ה?ראשון\b/,                  // אור ראשון / האור הראשון / אור הראשון / האור ראשון
  /\bה?שמש\s+(עולה|זרחה)\b/,              // שמש עולה / השמש עולה / השמש זרחה
  /\bעלה\s+ה?בוקר\b/,                     // עלה הבוקר / עלה בוקר
];

function pageHasAnyToken(text: string, tokens: string[]): boolean {
  const t = stripHebrewNiqqud(text);
  return tokens.some((token) => t.includes(stripHebrewNiqqud(token)));
}

function pageHasMorningSignal(text: string): boolean {
  const t = stripHebrewNiqqud(text);
  return MORNING_WAKE_RE.some((re) => re.test(t));
}

/** % of pages that contain bed-state language. */
function bedStateRatio(parsed: ParsedStory): number {
  if (parsed.pages.length === 0) return 0;
  const hits = parsed.pages.filter((p) => pageHasAnyToken(p.text, BED_STATE_TOKENS)).length;
  return hits / parsed.pages.length;
}

/** Does the final page describe a morning/wake state? Only relevant for bedtime. */
function endsAtMorning(parsed: ParsedStory): boolean {
  const last = parsed.pages[parsed.pages.length - 1];
  if (!last) return false;
  // v0.4.6 — use the regex variant that tolerates Hebrew definite article.
  return pageHasMorningSignal(last.text);
}

export function detectDirectionDrift(
  parsed: ParsedStory,
  direction: 'bedtime' | 'adventure' | 'fantasy'
): EditorialIssueRuntime[] {
  const issues: EditorialIssueRuntime[] = [];

  // For adventure/fantasy: too much bed-state language = drifted to bedtime
  if (direction === 'adventure' || direction === 'fantasy') {
    const ratio = bedStateRatio(parsed);
    if (ratio > 0.4) {
      // v0.4.3 — suggestions are CONCRETE Hebrew sample sentences, not Hebrew
      // imperatives. Hebrew imperatives in the `suggestion` field get copied
      // verbatim into prose by the editorial repair LLM. Sample sentences are
      // safer: even if copied, they read as story content.
      issues.push({
        page: 1,
        field: 'body',
        severity: 'MAJOR',
        reason: 'direction_drift',
        quote: `${Math.round(ratio * 100)}% of pages in bed-state`,
        suggestion:
          direction === 'adventure'
            ? 'נועה יוצאת מהבית. הדלת נסגרת מאחוריה. בּוֹלִי בתיק.'
            : 'הקיר נמס לסלע. נועה ראתה הר. בּוֹלִי התגלגל לפניה.',
        explanation: `Story direction is ${direction} but ${Math.round(
          ratio * 100
        )}% of pages contain bed-state words (מיטה/שמיכה/כרית). That is a bedtime profile.`,
        _source: 'scanner',
      });
    }
  }

  // For bedtime: should NOT end at morning/wake state
  if (direction === 'bedtime' && endsAtMorning(parsed)) {
    const last = parsed.pages[parsed.pages.length - 1];
    // v0.4.3 — The suggestion is a CONCRETE Hebrew replacement page, NOT a
    // Hebrew imperative. Earlier the suggestion read "סיים בשינה רכה, לא
    // בבוקר/התעוררות" — the editorial repair LLM literally copied that meta
    // instruction into the final page (caught by instructionLeakage validator,
    // but only after it had wasted a repair attempt and degraded the story).
    //
    // Now the suggestion IS the kind of ending we want. The repair model can
    // use it verbatim or as a pattern.
    issues.push({
      page: last.pageNumber,
      field: 'body',
      severity: 'MAJOR',
      reason: 'wrong_ending',
      quote: last.text.slice(0, 100),
      suggestion:
        'בּוֹלִי ישן ליד הכרית. בפנים היה חם. נועה עוצמת עיניים. החדר שקט.',
      explanation:
        'Bedtime story ended in morning/waking imagery — must end with the child falling asleep and the companion settled.',
      _source: 'scanner',
    });
  }

  return issues;
}
