import type { StoryValidator } from '../types';
import { extractShotType, finding } from '../utils';

/** BLOCKING + WARNING on English imageDirection lines only. */
export const imageDirectionValidator: StoryValidator = {
  id: 'imageDirectionValidator',
  run({ parsed }) {
    const findings = [];
    const shotTypes: string[] = [];

    for (const page of parsed.pages) {
      if (!page.imageDirection.trim()) {
        findings.push(
          finding('imageDirectionValidator', 'BLOCKING', `חסר imageDirection בעמוד ${page.pageNumber}`, {
            page: page.pageNumber,
          })
        );
        shotTypes.push('missing');
        continue;
      }
      shotTypes.push(extractShotType(page.imageDirection));
      const lower = page.imageDirection.toLowerCase();
      const mentionsChild =
        /\bchild\b|\bboy\b|\bgirl\b|\bprotagonist\b/i.test(lower) ||
        /position|foreground|midground/i.test(lower);
      const mentionsCompanion = /\bcompanion\b|\bbat\b|\bfriend\b|\bcreature\b/i.test(lower);
      if (!mentionsChild && !mentionsCompanion) {
        findings.push(
          finding(
            'imageDirectionValidator',
            'WARNING',
            `imageDirection בעמוד ${page.pageNumber} לא מציין מיקום ילד/דמות`,
            { page: page.pageNumber, excerpt: page.imageDirection.slice(0, 80) }
          )
        );
      }
    }

    let run = 1;
    for (let i = 1; i < shotTypes.length; i++) {
      if (shotTypes[i] === shotTypes[i - 1] && shotTypes[i] !== 'missing') {
        run++;
        if (run > 3) {
          findings.push(
            finding(
              'imageDirectionValidator',
              'WARNING',
              `יותר מ-3 עמודים רצופים עם אותו סוג שוט (${shotTypes[i]})`,
              { page: parsed.pages[i]?.pageNumber }
            )
          );
          break;
        }
      } else {
        run = 1;
      }
    }

    return findings;
  },
};
