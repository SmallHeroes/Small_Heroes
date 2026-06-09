/**
 * Detect Hebrew prose lines that read like imageDirection pose residue.
 */

import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';

export interface ProsePoseHit {
  page: number;
  line: string;
}

/** Static pose / frame-description patterns — not attention beats like הביט בקערה. */
const POSE_RESIDUE_PATTERNS: RegExp[] = [
  /ידיים פתוחות ל(?:תפוס|רווחה)/,
  /ידיים פרוסות(?:\s+לרווחה)?/,
  /\{מתכופף\|מתכופפת\}\s+לבדוק,\s*ידיים/,
  /מתכופף\|מתכופפת\}?\s+לבדוק,\s*ידיים/,
  /עומד ומביט(?!\s+(?:ואז|אבל|—|-))/,
  /יושב ומסתכל/,
  /ידיים מוכנות לתפוס/,
  /פרוסות לרווחה/,
];

const ALLOWED_ATTENTION = /\{הביט\|הביטה\}\s+ב/;

export function scanProseNotImagePrompt(markdown: string): ProsePoseHit[] {
  const hits: ProsePoseHit[] = [];
  for (const { page, body } of parseStoryPages(markdown)) {
    const prose = pageProseOnly(body);
    for (const rawLine of prose.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || ALLOWED_ATTENTION.test(line)) continue;
      for (const re of POSE_RESIDUE_PATTERNS) {
        if (re.test(line)) {
          hits.push({ page, line: line.slice(0, 80) });
          break;
        }
      }
    }
  }
  return hits;
}

function stripNiqqud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

export function isP12EndingTruncated(markdown: string): boolean {
  if (/דיני לא קמה\.\s*\nה\s*$/m.test(stripNiqqud(markdown))) return true;
  const tail = markdown.trimEnd();
  if (tail.endsWith('ה') && !tail.includes('"אחרי הסרט."')) return true;
  return false;
}

export function isP12EndingComplete(
  markdown: string,
  profile: 'dini_popcorn' | 'koko_transition' | 'confidence_generic' = 'dini_popcorn',
  expectedPageCount = 12
): boolean {
  if (isP12EndingTruncated(markdown)) return false;
  const pages = parseStoryPages(markdown);
  const finalPage = pages.find((p) => p.page === expectedPageCount);
  if (!finalPage) return false;
  const prose = pageProseOnly(finalPage.body);
  const plain = stripNiqqud(prose);
  if (profile === 'confidence_generic') {
    return plain.length >= 40 && !plain.endsWith('ה');
  }
  if (profile === 'koko_transition') {
    return (
      plain.length >= 80 &&
      (plain.includes('פס הגשר') || plain.includes('פס המחבר')) &&
      plain.includes('שלמה') &&
      plain.includes('טביעת כף')
    );
  }
  return (
    plain.includes('גרעין אחד קפץ בשקט') &&
    plain.includes('"אש," הוא לחש') &&
    plain.includes('דיני לא קמה') &&
    prose.includes('קרצה ל{{childName}}') &&
    prose.includes('"אחרי הסרט."')
  );
}
