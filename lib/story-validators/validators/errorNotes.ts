import type { StoryValidator } from '../types';
import { excerptAround, finding } from '../utils';

const ERROR_NOTE_PATTERNS: RegExp[] = [
  /\(טעות:/i,
  /\(תיקון:/i,
  /\(הערה:/i,
  /<correction>/i,
  /\[NOTE:/i,
  /\(סליחה/i,
];

/** BLOCKING: model self-correction notes left in prose. */
export const errorNotesValidator: StoryValidator = {
  id: 'errorNotes',
  run({ parsed }) {
    const findings = [];
    for (const page of parsed.pages) {
      for (const re of ERROR_NOTE_PATTERNS) {
        const match = page.text.match(re);
        if (match && match.index != null) {
          findings.push(
            finding('errorNotes', 'BLOCKING', `הערת מודל/תיקון נשארה בעמוד ${page.pageNumber}`, {
              page: page.pageNumber,
              excerpt: excerptAround(page.text, match.index),
            })
          );
        }
      }
    }
    return findings;
  },
};
