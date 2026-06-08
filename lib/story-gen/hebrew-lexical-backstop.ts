/**
 * Deterministic Hebrew lexical backstop — no LLM dependency (safe for unit tests).
 */

import { pageProseOnly, parseStoryPages } from './story-page-utils';
import type {
  HebrewLexicalDomain,
  HebrewLexicalHit,
  HebrewLexicalSeverity,
} from './hebrew-lexical-types';

export type { HebrewLexicalHit, HebrewLexicalHitSource } from './hebrew-lexical-types';

export {
  ONOMATOPOEIA_ALLOWLIST,
  COMPANION_SCOPED_SOUND_WORDS,
  resolveSoundWordsForCompanion,
  formatSoundAllowlistForPrompt,
} from './hebrew-lexical-sound-allowlist';
import {
  RE_BROKEN_HOLES,
  RE_BROKEN_KITZKASH,
  RE_BROKEN_MAHNEH,
  RE_BROKEN_METSITS,
  RE_BROKEN_MITZTAMETS,
} from './hebrew-lexical-broken-forms';
import { ONOMATOPOEIA_ALLOWLIST, resolveSoundWordsForCompanion } from './hebrew-lexical-sound-allowlist';

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
  severity: HebrewLexicalSeverity;
  domain: HebrewLexicalDomain;
  phraseLevel?: boolean;
  chipScan?: boolean;
};

export const DETERMINISTIC_LEXICAL_PATTERNS: DeterministicPattern[] = [
  {
    pattern: RE_BROKEN_MITZTAMETS,
    issue: 'truncated/broken verb (מצטמצ — missing final ם)',
    suggest: '{מתכווץ|מתכווצת}',
    severity: 'BLOCKER',
    domain: 'malformed_inflection',
    chipScan: true,
  },
  {
    pattern: RE_BROKEN_METSITS,
    issue: 'invented nonce for מציץ',
    suggest: 'מציץ',
    severity: 'BLOCKER',
    domain: 'non_word',
  },
  {
    pattern: RE_BROKEN_HOLES,
    issue: 'non-word (חולש — likely חולשה)',
    suggest: 'בתוך הגוף',
    severity: 'BLOCKER',
    domain: 'non_word',
  },
  {
    pattern: RE_BROKEN_MAHNEH,
    issue: 'non-word (מהנה — likely מהנהן)',
    suggest: 'מהנהן',
    severity: 'BLOCKER',
    domain: 'non_word',
  },
  {
    pattern: /כמעט[־-]?שׁ?[ֵ]?ן/,
    issue: 'unclear phrase for ages 4–8 (כמעט־שן)',
    suggest: 'קול כמעט ישן',
    severity: 'REVIEW',
    domain: 'age_inappropriate_register',
  },
  {
    pattern: RE_BROKEN_KITZKASH,
    issue: 'non-word (קיצקש)',
    suggest: 'מסתובב קצת',
    severity: 'BLOCKER',
    domain: 'non_word',
  },
  {
    pattern: /ריצ['\u05F3\u2019]?רוץ[^\n]{0,40}ריצ['\u05F3\u2019]?רוץ/,
    issue: 'forced unnatural tongue-twister phrasing',
    suggest: 'האצבעות משחקות ברוכסן',
    severity: 'REVIEW',
    domain: 'unnatural_phrase',
    phraseLevel: true,
  },
  {
    pattern: /נָח בֵּין גְּלִידוֹת|נח בין גלידות/,
    issue: 'unnatural simile (nach between ice creams)',
    suggest: 'נוח שקט על הברכיים',
    severity: 'REVIEW',
    domain: 'unnatural_phrase',
    phraseLevel: true,
  },
  {
    pattern: /פִּתְחוֹנֵי קָפִיץ|פתחוני קפיץ/,
    issue: 'jarring invented metaphor',
    suggest: 'פתחונים קטנים',
    severity: 'REVIEW',
    domain: 'unnatural_phrase',
    phraseLevel: true,
  },
];

function isAllowlistedSoundToken(token: string, companionId: string | null): boolean {
  const bare = stripHebrewDiacritics(token);
  return resolveSoundWordsForCompanion(companionId).some(
    (a) => stripHebrewDiacritics(a) === bare || bare.includes(stripHebrewDiacritics(a))
  );
}

function isInsideDoublePlaceholder(prose: string, index: number): boolean {
  const before = prose.slice(0, index);
  const openDbl = (before.match(/\{\{/g) ?? []).length;
  const closeDbl = (before.match(/\}\}/g) ?? []).length;
  return openDbl > closeDbl;
}

function scanBrokenChipWords(prose: string, page: number): HebrewLexicalHit[] {
  const hits: HebrewLexicalHit[] = [];
  const chipRe = /\{([^{}|]+)\|([^{}|]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = chipRe.exec(prose)) !== null) {
    for (const side of [m[1], m[2]]) {
      const bare = stripHebrewDiacritics(side);
      for (const { pattern, issue, suggest, severity, domain } of DETERMINISTIC_LEXICAL_PATTERNS) {
        if (!pattern.test(bare)) continue;
        hits.push({
          page,
          original: m[0],
          issue: `${issue} (chip side: ${side.trim()})`,
          suggestedMinimalFix: suggest,
          source: 'deterministic',
          severity,
          domain: domain === 'malformed_inflection' ? 'broken_chip_word' : domain,
        });
        break;
      }
    }
  }
  return hits;
}

export function runDeterministicLexicalBackstop(markdown: string): HebrewLexicalHit[] {
  const hits: HebrewLexicalHit[] = [];
  const seen = new Set<string>();
  const companionId = markdown.match(/companionId:\s*(\S+)/)?.[1]?.trim() ?? null;

  for (const { page, body } of parseStoryPages(markdown)) {
    const prose = pageProseOnly(body);
    const stripped = stripHebrewDiacritics(prose);

    hits.push(...scanBrokenChipWords(prose, page));

    for (const {
      pattern,
      issue,
      suggest,
      severity,
      domain,
      phraseLevel,
    } of DETERMINISTIC_LEXICAL_PATTERNS) {
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
      const globalPattern = new RegExp(pattern.source, flags);
      let m: RegExpExecArray | null;
      while ((m = globalPattern.exec(stripped)) !== null) {
        const original = m[0];
        const key = `p${page}:${original}:${issue}`;
        if (seen.has(key)) continue;
        if (!phraseLevel && isAllowlistedSoundToken(original, companionId)) continue;
        const proseIdx = stripHebrewDiacritics(prose).indexOf(original, m.index);
        if (proseIdx >= 0 && isInsideDoublePlaceholder(prose, proseIdx)) continue;
        seen.add(key);
        hits.push({
          page,
          original: snippetAround(prose, Math.max(0, proseIdx)),
          issue,
          suggestedMinimalFix: suggest,
          source: 'deterministic',
          severity,
          domain,
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
