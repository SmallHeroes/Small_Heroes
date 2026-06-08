/**
 * Allowlist-only gender chip normalization.
 * NO generic feminine guessing — unrecognized patterns stay unchanged and fail validation.
 */

import {
  countPageWords,
  formatWordCountLine,
  pageProseOnly,
  parseStoryPages,
} from './story-page-utils';

export interface ChipNormalizeEntry {
  page: number;
  before: string;
  after: string;
  reason: 'partial_suffix_chip' | 'slash_chip' | 'full_slash_chip';
}

export interface ChipNormalizeReport {
  status: 'deterministic_normalize_allowlist';
  fixes: ChipNormalizeEntry[];
  fixCount: number;
  unrepaired: Array<{ page: number; token: string; reason: string }>;
  advisoryFail: boolean;
}

/** Trusted masculine → feminine pairs. Only these may be auto-normalized. */
export const TRUSTED_STEM_PAIRS: Record<string, { male: string; female: string }> = {
  מתיישב: { male: 'מתיישב', female: 'מתיישבת' },
  מציץ: { male: 'מציץ', female: 'מציצה' },
  נוגע: { male: 'נוגע', female: 'נוגעת' },
  דוחף: { male: 'דוחף', female: 'דוחפת' },
  ילד: { male: 'ילד', female: 'ילדה' },
  אחד: { male: 'אחד', female: 'אחת' },
  נושם: { male: 'נושם', female: 'נושמת' },
  מוביל: { male: 'מוביל', female: 'מובילה' },
  גדול: { male: 'גדול', female: 'גדולה' },
  שלו: { male: 'שלו', female: 'שלה' },
  מניח: { male: 'מניח', female: 'מניחה' },
  מושך: { male: 'מושך', female: 'מושכת' },
  מחייך: { male: 'מחייך', female: 'מחייכת' },
  לוחש: { male: 'לוחש', female: 'לוחשת' },
  צוחק: { male: 'צוחק', female: 'צוחקת' },
  מתכופף: { male: 'מתכופף', female: 'מתכופפת' },
  מושיט: { male: 'מושיט', female: 'מושיטה' },
  מקפיא: { male: 'מקפיא', female: 'מקפיאה' },
  עומד: { male: 'עומד', female: 'עומדת' },
  קופא: { male: 'קופא', female: 'קופאת' },
  נסוג: { male: 'נסוג', female: 'נסוגה' },
  לוקח: { male: 'לוקח', female: 'לוקחת' },
  מרים: { male: 'מרים', female: 'מרימה' },
  מצביע: { male: 'מצביע', female: 'מצביעה' },
  אמר: { male: 'אמר', female: 'אמרה' },
  ומניח: { male: 'ומניח', female: 'ומניחה' },
  נשאר: { male: 'נשאר', female: 'נשארת' },
  יכול: { male: 'יכול', female: 'יכולה' },
  שואל: { male: 'שואל', female: 'שואלת' },
  מותח: { male: 'מותח', female: 'מותחת' },
  מסתובב: { male: 'מסתובב', female: 'מסתובבת' },
};

export function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05C7\u05F3\u05F4]/g, '');
}

function chipPairKey(male: string, female: string): string {
  return `${stripHebrewDiacritics(male)}|${stripHebrewDiacritics(female)}`;
}

/** Approved full {male|female} chips after normalization. */
export const APPROVED_CHIP_PAIRS = new Set<string>(
  Object.values(TRUSTED_STEM_PAIRS).map((p) => chipPairKey(p.male, p.female))
);

export function isApprovedChipPair(male: string, female: string): boolean {
  return APPROVED_CHIP_PAIRS.has(chipPairKey(male, female));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAllowlistReplacements(): Array<{
  pattern: RegExp;
  replacement: string;
  reason: ChipNormalizeEntry['reason'];
}> {
  const rules: Array<{
    pattern: RegExp;
    replacement: string;
    reason: ChipNormalizeEntry['reason'];
  }> = [];

  for (const [stem, pair] of Object.entries(TRUSTED_STEM_PAIRS)) {
    const chip = `{${pair.male}|${pair.female}}`;
    rules.push({
      pattern: new RegExp(`${escapeRegExp(stem)}\\{ת\\}`, 'g'),
      replacement: chip,
      reason: 'partial_suffix_chip',
    });
    rules.push({
      pattern: new RegExp(`${escapeRegExp(stem)}\\{ה\\}`, 'g'),
      replacement: chip,
      reason: 'partial_suffix_chip',
    });
    rules.push({
      pattern: new RegExp(`${escapeRegExp(pair.male)}/ת`, 'g'),
      replacement: chip,
      reason: 'slash_chip',
    });
    if (pair.female.endsWith('ה')) {
      rules.push({
        pattern: new RegExp(`${escapeRegExp(pair.male)}/ה`, 'g'),
        replacement: chip,
        reason: 'slash_chip',
      });
    }
    if (pair.female.endsWith('ת') && pair.female !== pair.male + 'ת') {
      rules.push({
        pattern: new RegExp(`${escapeRegExp(pair.male)}/ת`, 'g'),
        replacement: chip,
        reason: 'slash_chip',
      });
    }
  }

  return rules;
}

const ALLOWLIST_REPLACEMENTS = buildAllowlistReplacements();

const UNREPAIRED_PARTIAL_SUFFIX = /[\u0590-\u05FF]{2,}\{[תה]\}/g;
const UNREPAIRED_SLASH_GENDER =
  /[\u0590-\u05FF][\u0590-\u05FF\u05B0-\u05C7]*\/(?:ת|ה|[\u0590-\u05FF][\u0590-\u05FF\u05B0-\u05C7]*)/g;

function collectUnrepairedTokens(text: string, page: number): ChipNormalizeReport['unrepaired'] {
  const hits: ChipNormalizeReport['unrepaired'] = [];
  for (const re of [UNREPAIRED_PARTIAL_SUFFIX, UNREPAIRED_SLASH_GENDER]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({
        page,
        token: m[0],
        reason: re === UNREPAIRED_PARTIAL_SUFFIX ? 'partial_suffix_unrecognized' : 'slash_gender_unrecognized',
      });
    }
  }
  return hits;
}

function normalizeChipsInText(text: string, page: number): {
  text: string;
  fixes: ChipNormalizeEntry[];
  unrepaired: ChipNormalizeReport['unrepaired'];
} {
  const fixes: ChipNormalizeEntry[] = [];
  let out = text;

  for (const { pattern, replacement, reason } of ALLOWLIST_REPLACEMENTS) {
    out = out.replace(pattern, (match) => {
      if (match === replacement) return match;
      fixes.push({ page, before: match, after: replacement, reason });
      return replacement;
    });
  }

  const unrepaired = collectUnrepairedTokens(out, page);
  return { text: out, fixes, unrepaired };
}

function splitPrefixAndPageSection(markdown: string): { prefix: string; pageSection: string } {
  const idx = markdown.search(/\r?\n--- Page 1 ---/);
  if (idx < 0) return { prefix: markdown, pageSection: '' };
  return { prefix: markdown.slice(0, idx).trimEnd(), pageSection: markdown.slice(idx) };
}

export function normalizePartialGenderChips(markdown: string): {
  markdown: string;
  report: ChipNormalizeReport;
} {
  const { prefix, pageSection } = splitPrefixAndPageSection(markdown);
  const prefixResult = normalizeChipsInText(prefix, 0);
  const pages = parseStoryPages(pageSection || markdown);

  const allFixes: ChipNormalizeEntry[] = [...prefixResult.fixes];
  const allUnrepaired: ChipNormalizeReport['unrepaired'] = [...prefixResult.unrepaired];

  const updatedPages = pages.map(({ page, body }) => {
    const imgMatch = body.match(/imageDirection\s*:[\s\S]*/i);
    const img = imgMatch?.[0] ?? '';
    const proseBlock = img ? body.slice(0, body.indexOf(img)).trimEnd() : body;
    const { text, fixes, unrepaired } = normalizeChipsInText(proseBlock, page);
    allFixes.push(...fixes);
    allUnrepaired.push(...unrepaired);
    const newBody = img ? `${text}\n\n${img.trim()}` : text;
    return { page, body: newBody };
  });

  const pageSectionOut = updatedPages
    .map(({ page, body }) => `--- Page ${page} ---\n${body.trim()}`)
    .join('\n\n');

  let out = prefixResult.text ? `${prefixResult.text}\n${pageSectionOut}` : pageSectionOut;
  out = out.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '').trim();
  const counts = updatedPages.map((p) => countPageWords(pageProseOnly(p.body)));
  out = `${out}\n\n${formatWordCountLine(counts)}`;

  const dedupedUnrepaired = allUnrepaired.filter(
    (u, i, arr) =>
      arr.findIndex((x) => x.page === u.page && x.token === u.token && x.reason === u.reason) === i
  );

  return {
    markdown: out,
    report: {
      status: 'deterministic_normalize_allowlist',
      fixes: allFixes,
      fixCount: allFixes.length,
      unrepaired: dedupedUnrepaired,
      advisoryFail: dedupedUnrepaired.length > 0,
    },
  };
}
