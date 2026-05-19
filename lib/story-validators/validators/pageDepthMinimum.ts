import type { Finding, StoryValidator } from '../types';
import { finding } from '../utils';

/**
 * v0.3.4 — WARNING: page-density floor per age tier.
 *
 * Background: v0.3.2/v0.3.3 fixed "too rich" but the next batch swung to
 * "too thin" — pages with 4-8 Hebrew words felt like an outline for age 6-8.
 *
 * This validator measures the MEDIAN page word count and warns if it falls
 * below the age-tier floor. We use median (not single-page minimum) because
 * a single quiet page like "טוּמְפּ. נועה חייכה." is legitimate.
 *
 * Severity is WARNING (not BLOCKING) — the main fix is in the prompt.
 * This validator exists to surface regressions during batch review.
 */

interface AgeFloor {
  /** Median Hebrew words per page must be at least this. */
  median: number;
  /** Suggested target range for the tier (for the suggestion text only). */
  target: string;
  label: string;
}

function getAgeFloor(age: number): AgeFloor {
  // v0.3.5 — floors tied to the new wider age-tier ranges (8-18 / 18-32 / 32-55).
  // Median must reach the lower bound of the target range.
  if (age <= 4) return { median: 8, target: '8-18', label: 'age 3-4' };
  if (age <= 6) return { median: 18, target: '18-32', label: 'age 5-6' };
  return { median: 32, target: '32-55', label: 'age 7-8' };
}

function countHebrewWords(text: string): number {
  return text
    .split(/[\s,.;:!?\-]+/)
    .filter((w) => /[֐-׿]/.test(w))
    .length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export const pageDepthMinimumValidator: StoryValidator = {
  id: 'pageDepthMinimum',
  run({ parsed, input }) {
    const findings: Finding[] = [];
    if (parsed.pages.length < 3) return findings;

    const age = input.context.childAge;
    const floor = getAgeFloor(age);
    const counts = parsed.pages.map((p) => countHebrewWords(p.text));
    const med = median(counts);

    if (med < floor.median) {
      findings.push(
        finding(
          'pageDepthMinimum',
          'WARNING',
          `הסיפור דק מדי לגיל ${age} (${floor.label}): חציון מילים לעמוד ${med}, מתחת לרצפה ${floor.median}. הטווח היעד הוא ${floor.target} מילים.`,
          {
            suggestion: `הוסף עוד תיאור גופני / סיבה-תוצאה / דיאלוג קצר בעמודים הקצרים. "פשוט אבל לא דל."`,
          }
        )
      );
    }

    return findings;
  },
};
