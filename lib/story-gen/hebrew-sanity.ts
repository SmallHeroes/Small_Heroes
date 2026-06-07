/**
 * Conservative suspicious-token scan for post-enrich Hebrew prose.
 */

import { pageProseOnly, parseStoryPages } from './story-page-utils';

/** Known bad tokens from prior runs — substring match. */
export const KNOWN_SUSPICIOUS_HEBREW = [
  'מתנקלות',
  'מַצִּיָּה',
  'מַצִּיָּה',
  'בתַרְנוּג',
  'בתרנוג',
  'נומבפנים',
  'לעף אחד',
] as const;

export interface HebrewSanityHit {
  page: number;
  token: string;
  reason: 'known_suspicious' | 'latin_in_hebrew' | 'hebrew_latin_drift';
  context: string;
}

export interface HebrewSanityReport {
  status: 'advisory_conservative';
  hits: HebrewSanityHit[];
  hitCount: number;
  advisoryFail: boolean;
}

const LATIN_IN_HEBREW_RE = /[\u0590-\u05FF][a-zA-Z]|[a-zA-Z][\u0590-\u05FF]/;

function snippet(text: string, index: number, len = 40): string {
  const start = Math.max(0, index - 15);
  const end = Math.min(text.length, index + len);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function scanHebrewSanity(markdown: string): HebrewSanityReport {
  const hits: HebrewSanityHit[] = [];
  const pages = parseStoryPages(markdown);

  for (const { page, body } of pages) {
    const prose = pageProseOnly(body);

    for (const token of KNOWN_SUSPICIOUS_HEBREW) {
      let idx = prose.indexOf(token);
      while (idx >= 0) {
        hits.push({
          page,
          token,
          reason: 'known_suspicious',
          context: snippet(prose, idx),
        });
        idx = prose.indexOf(token, idx + 1);
      }
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
