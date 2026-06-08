/**
 * Conservative detector for bare gendered verbs/adjectives referring to the child
 * near {{childName}} without a {male|female} chip.
 * Allowlist-only — no broad Hebrew morphology.
 */

import { stripHebrewDiacritics } from './chip-normalize';
import { pageProseOnly, parseStoryPages } from './story-page-utils';

/** Known verbs where masculine ≠ feminine — bare forms near {{childName}} must be chipped. */
export const BARE_CHILD_GENDER_VERBS: Array<{ male: string; female: string }> = [
  { male: 'מוריד', female: 'מורידה' },
  { male: 'מאזין', female: 'מאזינה' },
  { male: 'מחליט', female: 'מחליטה' },
  { male: 'בוחר', female: 'בוחרת' },
  { male: 'מצטרף', female: 'מצטרפת' },
  { male: 'פותח', female: 'פותחת' },
  { male: 'מושך', female: 'מושכת' },
  { male: 'מניח', female: 'מניחה' },
  { male: 'מרים', female: 'מרימה' },
  { male: 'לוקח', female: 'לוקחת' },
  { male: 'מתכופף', female: 'מתכופפת' },
  { male: 'מתיישב', female: 'מתיישבת' },
  { male: 'עומד', female: 'עומדת' },
  { male: 'יושב', female: 'יושבת' },
  { male: 'נרדם', female: 'נרדמת' },
];

export type BareChildGenderReason =
  | 'bare_child_gender_verb'
  | 'implied_subject_bare_verb';

export interface BareChildGenderHit {
  page: number;
  token: string;
  reason: BareChildGenderReason;
  severity: 'fail' | 'warning';
  context: string;
}

export interface BareChildGenderReport {
  status: 'deterministic_bare_child_gender';
  hits: BareChildGenderHit[];
  failHits: BareChildGenderHit[];
  warningHits: BareChildGenderHit[];
  hitCount: number;
  advisoryFail: boolean;
}

const CHILD_PLACEHOLDER = '{{childName}}';
const PROXIMITY_AFTER_CHILD = 120;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskChipsAndPlaceholders(text: string): string {
  return text
    .replace(/\{\{[^}]+\}\}/g, (m) => ' '.repeat(m.length))
    .replace(/\{[^{}|]+\|[^{}|]+\}/g, (m) => ' '.repeat(m.length));
}

function bareFormPattern(form: string): RegExp {
  const f = escapeRegExp(stripHebrewDiacritics(form));
  return new RegExp(`(^|[\\s,.:;"'״׳—–\\-])${f}(?=[\\s,.:;"'״׳—–\\-]|$)`);
}

function snippet(text: string, index: number, len = 48): string {
  const start = Math.max(0, index - 12);
  const end = Math.min(text.length, index + len);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function hebrewTokens(text: string, maxTokens?: number): string[] {
  const stripped = stripHebrewDiacritics(maskChipsAndPlaceholders(text));
  const clauseEnd = stripped.search(/[.!?\n]/);
  const clause = clauseEnd >= 0 ? stripped.slice(0, clauseEnd) : stripped;
  const tokens = clause.match(/[\u0590-\u05FF]+/g) ?? [];
  return maxTokens != null ? tokens.slice(0, maxTokens) : tokens;
}

function tokenMatchesBareForm(token: string, form: string): boolean {
  const t = stripHebrewDiacritics(token).replace(/^ו/, '');
  const f = stripHebrewDiacritics(form);
  return t === f;
}

function scanWindowForBareVerbs(
  window: string,
  page: number,
  severity: 'fail' | 'warning',
  maxSubjectTokens = 3
): BareChildGenderHit[] {
  const hits: BareChildGenderHit[] = [];
  const tokens = hebrewTokens(window, severity === 'fail' ? maxSubjectTokens : undefined);

  for (const pair of BARE_CHILD_GENDER_VERBS) {
    if (stripHebrewDiacritics(pair.male) === stripHebrewDiacritics(pair.female)) continue;
    for (const form of [pair.male, pair.female]) {
      const tokenIdx = tokens.findIndex((t) => tokenMatchesBareForm(t, form));
      if (tokenIdx < 0) continue;
      if (severity === 'fail' && tokenIdx >= maxSubjectTokens) continue;
      hits.push({
        page,
        token: form,
        reason:
          severity === 'fail' ? 'bare_child_gender_verb' : 'implied_subject_bare_verb',
        severity,
        context: tokens.slice(Math.max(0, tokenIdx - 1), tokenIdx + 3).join(' '),
      });
    }
  }
  return hits;
}

function sentenceChunks(prose: string): string[] {
  return prose.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
}

function scanProse(prose: string, page: number): BareChildGenderHit[] {
  const hits: BareChildGenderHit[] = [];
  const stripped = stripHebrewDiacritics(prose);

  let searchFrom = 0;
  while (true) {
    const childIdx = stripped.indexOf(CHILD_PLACEHOLDER, searchFrom);
    if (childIdx < 0) break;
    const windowStart = childIdx + CHILD_PLACEHOLDER.length;
    const windowEnd = Math.min(prose.length, windowStart + PROXIMITY_AFTER_CHILD);
    const window = prose.slice(windowStart, windowEnd);
    hits.push(...scanWindowForBareVerbs(window, page, 'fail', 3));
    searchFrom = childIdx + 1;
  }

  for (const sentence of sentenceChunks(prose)) {
    if (sentence.includes(CHILD_PLACEHOLDER)) continue;
    const bareInSentence = scanWindowForBareVerbs(sentence, page, 'warning');
    hits.push(...bareInSentence);
  }

  const deduped = hits.filter(
    (h, i, arr) =>
      arr.findIndex(
        (x) =>
          x.page === h.page &&
          x.token === h.token &&
          x.severity === h.severity &&
          x.reason === h.reason
      ) === i
  );
  return deduped;
}

export function scanBareChildGender(markdown: string): BareChildGenderReport {
  const hits: BareChildGenderHit[] = [];
  const pages = parseStoryPages(markdown);

  for (const { page, body } of pages) {
    const prose = pageProseOnly(body);
    hits.push(...scanProse(prose, page));
  }

  const failHits = hits.filter((h) => h.severity === 'fail');
  const warningHits = hits.filter((h) => h.severity === 'warning');

  return {
    status: 'deterministic_bare_child_gender',
    hits,
    failHits,
    warningHits,
    hitCount: hits.length,
    advisoryFail: failHits.length > 0,
  };
}
