import type { StoryValidator } from '../types';
import { finding } from '../utils';

/** BLOCKING: pages 1..N sequential, no gaps or duplicates. */
export const pageSequenceValidator: StoryValidator = {
  id: 'pageSequence',
  run({ parsed, input }) {
    const findings = [];
    const numbers = parsed.pages.map((p) => p.pageNumber);
    const seen = new Set<number>();

    for (const n of numbers) {
      if (seen.has(n)) {
        findings.push(finding('pageSequence', 'BLOCKING', `עמוד ${n} מופיע פעמיים`));
      }
      seen.add(n);
    }

    const expected = input.context.pageCount;
    for (let i = 1; i <= expected; i++) {
      if (!seen.has(i)) {
        findings.push(finding('pageSequence', 'BLOCKING', `חסר עמוד ${i} ברצף`));
      }
    }

    for (const n of numbers) {
      if (n < 1 || n > expected) {
        findings.push(finding('pageSequence', 'BLOCKING', `מספר עמוד ${n} מחוץ לטווח 1-${expected}`));
      }
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    if (sorted.length > 1) {
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1 && sorted[i] !== sorted[i - 1]) {
          // gap detected between sorted unique neighbors
        }
      }
      for (let i = 1; i <= expected; i++) {
        if (!sorted.includes(i)) continue;
      }
    }

    return findings;
  },
};
