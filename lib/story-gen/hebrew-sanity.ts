/**
 * Conservative suspicious-token scan for post-enrich Hebrew prose + power-card anatomy.
 */

import { pageProseOnly, parseStoryPages } from './story-page-utils';

/** Known bad tokens from prior runs — substring match (also checked case-insensitive for Latin). */
export const KNOWN_SUSPICIOUS_HEBREW = [
  'מתנקלות',
  'מַצִּיָּה',
  'מַצִּיָּה',
  'בתַרְנוּג',
  'בתרנוג',
  'נומבפנים',
  'לעף אחד',
  'too-SHUT',
  'too‑SHUT',
  'tooSHUT',
  'אַסוּג',
  'אסוג',
  'אָסוּג',
  'קול כשר',
  'קול כָשֵׁר',
  'קוֹל כָּשֵׁר',
  'בוחר/ת קול כשר',
  'בוחר/ת קוֹל כָּשֵׁר',
  'נושף/ת קטנה מהחדק',
] as const;

/** Latin fragments to flag anywhere in Hebrew prose (case-insensitive). */
const KNOWN_SUSPICIOUS_LATIN = ['too-shut', 'toosht'] as const;

export interface HebrewSanityHit {
  page: number;
  token: string;
  reason:
    | 'known_suspicious'
    | 'latin_in_hebrew'
    | 'hebrew_latin_drift'
    | 'power_card_child_anatomy';
  context: string;
}

export interface HebrewSanityReport {
  status: 'advisory_conservative';
  hits: HebrewSanityHit[];
  hitCount: number;
  advisoryFail: boolean;
}

const LATIN_IN_HEBREW_RE = /[\u0590-\u05FF][a-zA-Z]|[a-zA-Z][\u0590-\u05FF]/;

function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05C7\u05F3\u05F4]/g, '');
}

function snippet(text: string, index: number, len = 40): string {
  const start = Math.max(0, index - 15);
  const end = Math.min(text.length, index + len);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function indexOfStripped(haystack: string, needle: string, from = 0): number {
  return stripHebrewDiacritics(haystack).indexOf(stripHebrewDiacritics(needle), from);
}

function frontmatterBlock(markdown: string): string {
  const idx = markdown.search(/\r?\n--- Page 1 ---/);
  return idx >= 0 ? markdown.slice(0, idx) : markdown;
}

function scanPowerCardChildAnatomy(markdown: string): HebrewSanityHit[] {
  const hits: HebrewSanityHit[] = [];
  const block = frontmatterBlock(markdown);
  const stepsBlock = block.match(/steps:[\s\S]*?(?=^\s+\w+:|\n---\s*$)/m)?.[0] ?? '';
  const stepLines = stepsBlock.match(/^\s+-\s+.+$/gm) ?? [];
  for (const line of stepLines) {
    const stripped = stripHebrewDiacritics(line);
    if (/חדק|חטם|trunk/i.test(stripped)) {
      hits.push({
        page: 0,
        token: line.trim(),
        reason: 'power_card_child_anatomy',
        context: 'powerCard step — child should use nose/breath, not trunk (חדק)',
      });
    }
  }
  return hits;
}

function scanProseLatinFragments(prose: string, page: number): HebrewSanityHit[] {
  const hits: HebrewSanityHit[] = [];
  const lower = prose.toLowerCase();
  for (const token of KNOWN_SUSPICIOUS_LATIN) {
    let idx = lower.indexOf(token);
    while (idx >= 0) {
      hits.push({
        page,
        token: prose.slice(idx, idx + token.length),
        reason: 'known_suspicious',
        context: snippet(prose, idx),
      });
      idx = lower.indexOf(token, idx + 1);
    }
  }
  return hits;
}

export function scanHebrewSanity(markdown: string): HebrewSanityReport {
  const hits: HebrewSanityHit[] = [...scanPowerCardChildAnatomy(markdown)];
  const pages = parseStoryPages(markdown);

  for (const { page, body } of pages) {
    const prose = pageProseOnly(body);

    for (const token of KNOWN_SUSPICIOUS_HEBREW) {
      let idx = indexOfStripped(prose, token);
      while (idx >= 0) {
        hits.push({
          page,
          token,
          reason: 'known_suspicious',
          context: snippet(stripHebrewDiacritics(prose), idx),
        });
        idx = indexOfStripped(prose, token, idx + 1);
      }
    }

    hits.push(...scanProseLatinFragments(prose, page));

    const strippedProse = stripHebrewDiacritics(prose);
    if (
      /(?:{{childName}}|נושמ|נושמת|מהחדק)[^\n]{0,40}חדק|חדק[^\n]{0,40}(?:{{childName}}|נושמ)/.test(
        strippedProse
      )
    ) {
      const m = strippedProse.match(
        /(?:{{childName}}|נושמ|נושמת|מהחדק)[^\n]{0,40}חדק|חדק[^\n]{0,40}(?:{{childName}}|נושמ)/
      );
      hits.push({
        page,
        token: m?.[0]?.slice(0, 48) ?? 'child+חדק',
        reason: 'power_card_child_anatomy',
        context: snippet(strippedProse, m?.index ?? 0),
      });
    }

    if (LATIN_IN_HEBREW_RE.test(prose)) {
      const m = prose.match(LATIN_IN_HEBREW_RE);
      if (m?.index != null) {
        hits.push({
          page,
          token: m[0],
          reason: 'latin_in_hebrew',
          context: snippet(prose, m.index),
        });
      }
    }

    const driftMatches = prose.match(/[\u0590-\u05FF]+[a-zA-Z]+[\u0590-\u05FF]+/g) ?? [];
    for (const dm of driftMatches) {
      if (dm.includes('imageDirection')) continue;
      hits.push({
        page,
        token: dm,
        reason: 'hebrew_latin_drift',
        context: dm,
      });
    }
  }

  return {
    status: 'advisory_conservative',
    hits,
    hitCount: hits.length,
    advisoryFail: hits.length > 0,
  };
}
