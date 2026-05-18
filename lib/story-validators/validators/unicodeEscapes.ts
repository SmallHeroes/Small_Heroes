import type { StoryValidator } from '../types';
import { excerptAround, finding } from '../utils';

const UNICODE_ESCAPE_RE = /\\u[0-9a-fA-F]{4}/g;

/** BLOCKING: unparsed \\uXXXX escapes in Hebrew prose. */
export const unicodeEscapesValidator: StoryValidator = {
  id: 'unicodeEscapes',
  run({ parsed }) {
    const findings = [];
    for (const page of parsed.pages) {
      for (const match of page.text.matchAll(UNICODE_ESCAPE_RE)) {
        const idx = match.index ?? 0;
        findings.push(
          finding('unicodeEscapes', 'BLOCKING', `מופע escape Unicode בעמוד ${page.pageNumber}`, {
            page: page.pageNumber,
            excerpt: excerptAround(page.text, idx),
          })
        );
      }
    }
    return findings;
  },
};
