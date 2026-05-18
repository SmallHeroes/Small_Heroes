import type { StoryValidator } from '../types';
import { extractShotType, finding } from '../utils';

/** WARNING: shot variety and position hints in imageDirection. */
export const visualVarietyValidator: StoryValidator = {
  id: 'visualVariety',
  run({ parsed }) {
    const findings = [];
    const shotTypes: string[] = [];
    let closeStartCount = 0;

    for (const page of parsed.pages) {
      const shot = extractShotType(page.imageDirection);
      shotTypes.push(shot);
      if (page.imageDirection.toLowerCase().startsWith('close')) {
        closeStartCount++;
      } else {
        closeStartCount = 0;
      }
      if (closeStartCount > 4) {
        findings.push(
          finding('visualVariety', 'WARNING', 'יותר מ-4 עמודים שמתחילים ב-Close shot', {
            page: page.pageNumber,
          })
        );
        closeStartCount = 0;
      }
    }

    let run = 1;
    for (let i = 1; i < shotTypes.length; i++) {
      if (shotTypes[i] === shotTypes[i - 1] && shotTypes[i] !== 'other') {
        run++;
        if (run > 3) {
          findings.push(
            finding('visualVariety', 'WARNING', `יותר מ-3 שוטים רצופים מסוג ${shotTypes[i]}`, {
              page: parsed.pages[i]?.pageNumber,
            })
          );
          break;
        }
      } else {
        run = 1;
      }
    }

    for (const page of parsed.pages) {
      const lower = page.imageDirection.toLowerCase();
      const hasPosition =
        /\bchild\b|\bcompanion\b|\bforeground\b|\bposition\b|\bcenter\b|\bleft\b|\bright\b/i.test(
          lower
        );
      if (page.imageDirection && !hasPosition) {
        findings.push(
          finding('visualVariety', 'WARNING', `חסר מיקום ילד/דמות ב-imageDirection בעמוד ${page.pageNumber}`, {
            page: page.pageNumber,
          })
        );
      }
    }

    return findings;
  },
};
