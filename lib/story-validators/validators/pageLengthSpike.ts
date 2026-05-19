import type { Finding, StoryValidator } from '../types';
import { excerptAround, finding, stripNikud } from '../utils';

/**
 * v0.3.2 — page length spike detection + late-abstract-object detection.
 *
 * Background: bedtime p10 and fantasy p13 both exhibited the same failure:
 * one page suddenly explodes to a paragraph block, often introducing abstract
 * poetic objects that weren't in the earlier pages.
 *
 * Two-stage logic:
 *   WARNING: any page whose word count is > 2.5x the median across all pages.
 *   BLOCKING: a spike page that ALSO contains a "late-abstract-object" phrase
 *             from the kill list below.
 */

const LATE_ABSTRACT_OBJECTS = [
  'גשר אור',
  'גשר דק של אור',
  'גשר דק',
  'כבל דק',
  'כבל אור',
  'עמק כריות',
  'עמק כריות קטן',
  'מילא את החדר',
  'נעים מילא',
  'מילאה את החדר',
];

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

export const pageLengthSpikeValidator: StoryValidator = {
  id: 'pageLengthSpike',
  run({ parsed }) {
    const findings: Finding[] = [];
    if (parsed.pages.length < 5) return findings;

    const totalPages = parsed.pages.length;
    const counts = parsed.pages.map((p) => ({
      page: p.pageNumber,
      words: countHebrewWords(p.text),
      text: p.text,
    }));

    const wordsArr = counts.map((c) => c.words);
    const med = median(wordsArr);
    const effectiveMedian = Math.max(med, 8);
    // v0.3.6 — three tiers based on ratio (was a single 2.5x threshold):
    //   >= 3.0x  → BLOCKING (catastrophic spike)
    //   >= 2.0x  → BLOCKING if combined with late-abstract-object, else WARNING
    const HARD_SPIKE_RATIO = 3.0;
    const SOFT_SPIKE_RATIO = 2.0;

    for (const c of counts) {
      const ratio = c.words / effectiveMedian;
      if (ratio < SOFT_SPIKE_RATIO) continue;

      const isLatePage = c.page / totalPages > 0.6;
      // v0.4.7 — opening pages (1-3) set the tone. A dump here destroys the
      // whole story. ChatGPT's call: treat any 2.0×+ spike on pages 1-3 as
      // BLOCKING, not WARNING. The reader notices early-page bloat the most.
      const isEarlyPage = c.page <= 3;
      const naked = stripNikud(c.text);
      const hasLateAbstractObject = isLatePage
        ? LATE_ABSTRACT_OBJECTS.find((phrase) => naked.includes(phrase))
        : undefined;

      const isHardSpike = ratio >= HARD_SPIKE_RATIO;

      if (isEarlyPage) {
        findings.push(
          finding(
            'pageLengthSpike',
            'BLOCKING',
            `עמוד פתיחה ${c.page} ארוך פי ${ratio.toFixed(1)} מהחציון (${c.words} מילים מול חציון ${med}). עמ' פתיחה (1-3) חייבים אורך אחיד עם שאר הסיפור — קפיצה כאן הורסת את הקצב מההתחלה.`,
            {
              page: c.page,
              excerpt: excerptAround(naked, 0, 60),
              suggestion: `פצל את עמ' ${c.page} לשני עמ' או יותר. הפתיחה חייבת להיות מהודקת.`,
            }
          )
        );
      } else if (isHardSpike) {
        // v0.3.6 — single page > 3x median is a structural failure on its own.
        // No need for combined abstract-object trigger.
        findings.push(
          finding(
            'pageLengthSpike',
            'BLOCKING',
            `עמוד ${c.page} ארוך פי ${ratio.toFixed(1)} מהחציון (${c.words} מילים מול חציון ${med}). זו קפיצת אורך קיצונית — סימן מובהק ל"המודל ממלא עמוד חשוב". כל עמוד חייב להיות באותו טווח אורך.`,
            {
              page: c.page,
              excerpt: excerptAround(naked, 0, 60),
              suggestion: `פצל את עמוד ${c.page} לשני עמ' או יותר. שמור על אורך אחיד עם שאר העמ'.`,
            }
          )
        );
      } else if (hasLateAbstractObject) {
        const idx = naked.indexOf(hasLateAbstractObject);
        findings.push(
          finding(
            'pageLengthSpike',
            'BLOCKING',
            `עמוד ${c.page} ארוך פי ${ratio.toFixed(1)} מהחציון (${c.words} מילים מול חציון ${med}) וגם מכיל אובייקט פואטי-מאוחר: "${hasLateAbstractObject}". זו תבנית "המודל ממלא עמוד חשוב" — אסורה.`,
            {
              page: c.page,
              excerpt: excerptAround(naked, idx, 40),
              suggestion: `פצל את עמ' ${c.page} לשני עמ' קצרים, או הסר את הדימוי המופשט.`,
            }
          )
        );
      } else {
        // 2.0x-3.0x without abstract poetry — still flag, but warning only.
        findings.push(
          finding(
            'pageLengthSpike',
            'WARNING',
            `עמוד ${c.page} ארוך פי ${ratio.toFixed(1)} מהחציון (${c.words} מילים מול חציון ${med}). שאר העמ' קצרים — שקול לפצל.`,
            {
              page: c.page,
              suggestion: `שמור על אורך עמ' אחיד. אם זה רגע רגשי, פצל לשני עמ' של 2-3 שורות.`,
            }
          )
        );
      }
    }

    return findings;
  },
};
