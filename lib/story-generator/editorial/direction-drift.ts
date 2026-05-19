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

function pageHasAnyToken(text: string, tokens: string[]): boolean {
  const t = stripHebrewNiqqud(text);
  return tokens.some((token) => t.includes(stripHebrewNiqqud(token)));
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
  return pageHasAnyToken(last.text, MORNING_WAKE_TOKENS);
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
      issues.push({
        page: 1,
        field: 'body',
        severity: 'MAJOR',
        reason: 'direction_drift',
        quote: `${Math.round(ratio * 100)}% of pages in bed-state`,
        suggestion:
          direction === 'adventure'
            ? 'הוסיפו מסע/גילוי חיצוני; אל תישארו במיטה/בשמיכה ברוב הסיפור'
            : 'הוסיפו עולם פנטזיה ברור; אל תישארו בחדר השינה',
        explanation: `סיפור ${direction} עם ${Math.round(
          ratio * 100
        )}% עמודים שמכילים מילים כמו מיטה/שמיכה/כרית — זה פרופיל של bedtime, לא ${direction}`,
        _source: 'scanner',
      });
    }
  }

  // For bedtime: should NOT end at morning/wake state
  if (direction === 'bedtime' && endsAtMorning(parsed)) {
    const last = parsed.pages[parsed.pages.length - 1];
    issues.push({
      page: last.pageNumber,
      field: 'body',
      severity: 'MAJOR',
      reason: 'wrong_ending',
      quote: last.text.slice(0, 100),
      suggestion: 'סיים בשינה רכה, לא בבוקר/התעוררות',
      explanation: 'סיפור bedtime נגמר בבוקר/יקיצה — הילד התעורר במקום להירדם',
      _source: 'scanner',
    });
  }

  return issues;
}
