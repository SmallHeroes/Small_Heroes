import type { StoryValidator } from '../types';
import { excerptAround, finding, stripNikud, stripStoryTemplates } from '../utils';

const FOREIGN_RE = /[a-zA-Z\u0600-\u06FF\u0E00-\u0E7F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF]/g;

/** BLOCKING: Latin/Arabic/CJK etc. inside Hebrew page prose only. */
export const foreignCharsValidator: StoryValidator = {
  id: 'foreignChars',
  run({ parsed }) {
    const findings = [];
    for (const page of parsed.pages) {
      const scrubbed = stripStoryTemplates(page.text);
      const matches = [...scrubbed.matchAll(FOREIGN_RE)];
      for (const match of matches) {
        const ch = match[0];
        const idx = match.index ?? 0;
        findings.push(
          finding('foreignChars', 'BLOCKING', `תו זר "${ch}" בעמוד ${page.pageNumber}`, {
            page: page.pageNumber,
            excerpt: excerptAround(scrubbed, idx),
            suggestion: 'הסר תווים לטיניים/זרים מגוף העמוד בעברית.',
          })
        );
      }
    }
    return findings;
  },
};
