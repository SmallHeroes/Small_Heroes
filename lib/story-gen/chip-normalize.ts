/**
 * Normalize partial gender-chip suffix patterns into full {male|female} pairs.
 * e.g. מתיישב{ת} → {מתיישב|מתיישבת}, מציץ/ה → {מציץ|מציצה}
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
  reason: 'partial_suffix_chip' | 'slash_chip';
}

export interface ChipNormalizeReport {
  status: 'deterministic_normalize';
  fixes: ChipNormalizeEntry[];
  fixCount: number;
  unrepaired: Array<{ page: number; token: string }>;
}

/** Explicit stem → {male|female} for partial-suffix and slash forms. */
const STEM_PAIRS: Record<string, { male: string; female: string }> = {
  מתיישב: { male: 'מתיישב', female: 'מתיישבת' },
  מציץ: { male: 'מציץ', female: 'מציצה' },
  נוגע: { male: 'נוגע', female: 'נוגעת' },
  דוחף: { male: 'דוחף', female: 'דוחפת' },
  ילד: { male: 'ילד', female: 'ילדה' },
  אחד: { male: 'אחד', female: 'אחת' },
  נושם: { male: 'נושם', female: 'נושמת' },
};

const EXPLICIT_REPLACEMENTS: Array<{
  pattern: RegExp;
  replacement: string;
  reason: ChipNormalizeEntry['reason'];
}> = [
  { pattern: /מתיישב\{ת\}/g, replacement: '{מתיישב|מתיישבת}', reason: 'partial_suffix_chip' },
  { pattern: /מציץ\{ה\}/g, replacement: '{מציץ|מציצה}', reason: 'partial_suffix_chip' },
  { pattern: /נוגע\{ת\}/g, replacement: '{נוגע|נוגעת}', reason: 'partial_suffix_chip' },
  { pattern: /דוחף\{ת\}/g, replacement: '{דוחף|דוחפת}', reason: 'partial_suffix_chip' },
  { pattern: /ילד\{ה\}/g, replacement: '{ילד|ילדה}', reason: 'partial_suffix_chip' },
  { pattern: /ילד\{ת\}/g, replacement: '{ילד|ילדה}', reason: 'partial_suffix_chip' },
  { pattern: /אחד\{ת\}/g, replacement: '{אחד|אחת}', reason: 'partial_suffix_chip' },
  { pattern: /נושם\/ת/g, replacement: '{נושם|נושמת}', reason: 'slash_chip' },
  { pattern: /מציץ\/ה/g, replacement: '{מציץ|מציצה}', reason: 'slash_chip' },
  { pattern: /מציץ\/ת/g, replacement: '{מציץ|מציצה}', reason: 'slash_chip' },
];

const PARTIAL_SUFFIX_SCAN = /([\u0590-\u05FF]{2,})\{([תה])\}/g;
const SLASH_CHIP_SCAN = /([\u0590-\u05FF]{2,})\/(ת|ה)/g;

function fullChipForStem(stem: string, suffix: 'ת' | 'ה'): string | null {
  const pair = STEM_PAIRS[stem];
  if (pair) return `{${pair.male}|${pair.female}}`;
  if (suffix === 'ת') return `{${stem}|${stem}ת}`;
  if (suffix === 'ה' && stem.endsWith('ד')) return `{${stem}|${stem}ה}`;
  if (suffix === 'ה') return `{${stem}|${stem}ה}`;
  return null;
}

function normalizeChipsInText(text: string, page: number): {
  text: string;
  fixes: ChipNormalizeEntry[];
  unrepaired: Array<{ page: number; token: string }>;
} {
  const fixes: ChipNormalizeEntry[] = [];
  let out = text;

  for (const { pattern, replacement, reason } of EXPLICIT_REPLACEMENTS) {
    out = out.replace(pattern, (match) => {
      if (match === replacement) return match;
      fixes.push({ page, before: match, after: replacement, reason });
      return replacement;
    });
  }

  const unrepaired: Array<{ page: number; token: string }> = [];

  out = out.replace(PARTIAL_SUFFIX_SCAN, (full, stem: string, suffix: string) => {
    const chip = fullChipForStem(stem, suffix as 'ת' | 'ה');
    if (!chip) {
      unrepaired.push({ page, token: full });
      return full;
    }
    fixes.push({ page, before: full, after: chip, reason: 'partial_suffix_chip' });
    return chip;
  });

  out = out.replace(SLASH_CHIP_SCAN, (full, stem: string, suffix: string) => {
    const chip = fullChipForStem(stem, suffix as 'ת' | 'ה');
    if (!chip) {
      unrepaired.push({ page, token: full });
      return full;
    }
    fixes.push({ page, before: full, after: chip, reason: 'slash_chip' });
    return chip;
  });

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
  const allUnrepaired: Array<{ page: number; token: string }> = [...prefixResult.unrepaired];

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

  return {
    markdown: out,
    report: {
      status: 'deterministic_normalize',
      fixes: allFixes,
      fixCount: allFixes.length,
      unrepaired: allUnrepaired,
    },
  };
}
