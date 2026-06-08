/**
 * Deterministic Hebrew lexical backstop — no LLM dependency (safe for unit tests).
 */

import { pageProseOnly, parseStoryPages } from './story-page-utils';

export const ONOMATOPOEIA_ALLOWLIST = [
  'פּוּף',
  'פוף',
  'טַף־טַף',
  'טף־טַף',
  'טַף',
  'קְלָק',
  'קלק',
  'דִּינג',
  'דינג',
  'בּוּם',
  'בום',
  'רְרוּם',
  'ררום',
  'פְּססס',
  'פססס',
  'פְּלוּפּ',
  'פלופ',
  'קליק',
  'קְלִיק',
  'טִיק',
  'טָאק',
  'תִּקְתּוּק',
  'פיפס',
  'פִּפְּס',
] as const;

export type HebrewLexicalHitSource = 'deterministic' | 'llm';

export interface HebrewLexicalHit {
  page: number;
  original: string;
  issue: string;
  suggestedMinimalFix: string;
  source: HebrewLexicalHitSource;
}

function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05C7\u05F3\u05F4]/g, '');
}

function snippetAround(text: string, index: number, len = 60): string {
  const start = Math.max(0, index - 20);
  return text.slice(start, start + len).replace(/\s+/g, ' ').trim();
}

type DeterministicPattern = {
  pattern: RegExp;
  issue: string;
  suggest: string;
  phraseLevel?: boolean;
};

export const DETERMINISTIC_LEXICAL_PATTERNS: DeterministicPattern[] = [
  {
    pattern: /מִצְטָמֵצ|מצטמ[ץצ]|מצטמת/,
    issue: 'truncated/broken verb (מצטמצ — missing final ם)',
    suggest: 'מתכווצ/מתכווצת',
  },
  {
    pattern: /מצציץ|מצמיץ|מצטץ/,
    issue: 'invented nonce for מציץ',
    suggest: 'מציץ',
  },
  {
    pattern: /בתוך החולש(?:\s|$|[.,!?—–-])/,
    issue: 'non-word (חולש — likely חולשה)',
    suggest: 'בתוך החולשה',
  },
  {
    pattern: /ריצ['\u05F3\u2019]?רוץ[^\n]{0,40}ריצ['\u05F3\u2019]?רוץ/,
    issue: 'forced unnatural tongue-twister phrasing',
    suggest: 'simplify zipper/fidget description',
    phraseLevel: true,
  },
  {
    pattern: /נָח בֵּין גְּלִידוֹת|נח בין גלידות/,
    issue: 'unnatural simile (nach between ice creams)',
    suggest: 'simpler resting image',
    phraseLevel: true,
  },
  {
    pattern: /פִּתְחוֹנֵי קָפִיץ|פתחוני קפיץ/,
    issue: 'jarring invented metaphor',
    suggest: 'simpler mouth/opening image',
    phraseLevel: true,
  },
];

function isAllowlistedToken(token: string): boolean {
  const bare = stripHebrewDiacritics(token);
  return ONOMATOPOEIA_ALLOWLIST.some(
    (a) => stripHebrewDiacritics(a) === bare || bare.includes(stripHebrewDiacritics(a))
  );
}

function isInsidePlaceholder(prose: string, index: number): boolean {
  const before = prose.slice(0, index);
  const openDbl = (before.match(/\{\{/g) ?? []).length;
  const closeDbl = (before.match(/\}\}/g) ?? []).length;
  return openDbl > closeDbl;
}

export function runDeterministicLexicalBackstop(markdown: string): HebrewLexicalHit[] {
  const hits: HebrewLexicalHit[] = [];
  const seen = new Set<string>();

  for (const { page, body } of parseStoryPages(markdown)) {
    const prose = pageProseOnly(body);
    const stripped = stripHebrewDiacritics(prose);

    for (const { pattern, issue, suggest, phraseLevel } of DETERMINISTIC_LEXICAL_PATTERNS) {
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
      const globalPattern = new RegExp(pattern.source, flags);
      let m: RegExpExecArray | null;
      while ((m = globalPattern.exec(stripped)) !== null) {
        const original = m[0];
        const key = `p${page}:${original}`;
        if (seen.has(key)) continue;
        if (!phraseLevel && isAllowlistedToken(original)) continue;
        const proseIdx = stripHebrewDiacritics(prose).indexOf(original, m.index);
        if (proseIdx >= 0 && isInsidePlaceholder(prose, proseIdx)) continue;
        seen.add(key);
        hits.push({
          page,
          original: snippetAround(prose, Math.max(0, proseIdx)),
          issue,
          suggestedMinimalFix: suggest,
          source: 'deterministic',
        });
      }
    }
  }

  return hits;
}

export function dedupeLexicalHits(hits: HebrewLexicalHit[]): HebrewLexicalHit[] {
  const out: HebrewLexicalHit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const key = `p${h.page}:${stripHebrewDiacritics(h.original).slice(0, 40)}:${h.issue}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}
