/**
 * Gender chip normalization — allowlist + safe slash-pattern converter.
 * NO blind stem+suffix guessing; unrecognized patterns stay unchanged and fail validation.
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
  reason:
    | 'partial_suffix_chip'
    | 'slash_chip'
    | 'full_slash_chip'
    | 'safe_slash_regular'
    | 'safe_slash_exception';
}

export interface ChipNormalizeReport {
  status: 'deterministic_normalize_safe_slash';
  fixes: ChipNormalizeEntry[];
  fixCount: number;
  convertedRegularCount: number;
  convertedExceptionCount: number;
  unrepaired: Array<{ page: number; token: string; reason: string }>;
  advisoryFail: boolean;
}

/** Trusted masculine → feminine pairs. Partial-suffix and full-slash allowlist. */
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
  בוחר: { male: 'בוחר', female: 'בוחרת' },
  מחליט: { male: 'מחליט', female: 'מחליטה' },
  מוריד: { male: 'מוריד', female: 'מורידה' },
  עוצם: { male: 'עוצם', female: 'עוצמת' },
  פותח: { male: 'פותח', female: 'פותחת' },
  מצטרף: { male: 'מצטרף', female: 'מצטרפת' },
  מפחד: { male: 'מפחד', female: 'מפחדת' },
  מסתכל: { male: 'מסתכל', female: 'מסתכלת' },
  נשען: { male: 'נשען', female: 'נשענת' },
  מרגיש: { male: 'מרגיש', female: 'מרגישה' },
  מכוון: { male: 'מכוון', female: 'מכוונת' },
  ומכוון: { male: 'ומכוון', female: 'ומכוונת' },
  מחזיק: { male: 'מחזיק', female: 'מחזיקה' },
  מצמיד: { male: 'מצמיד', female: 'מצמידה' },
  מסמן: { male: 'מסמן', female: 'מסמנת' },
  ומסמן: { male: 'ומסמן', female: 'ומסמנת' },
  שם: { male: 'שם', female: 'שמה' },
  מצחקק: { male: 'מצחקק', female: 'מצחקקת' },
  נעצר: { male: 'נעצר', female: 'נעצרה' },
  מאזין: { male: 'מאזין', female: 'מאזינה' },
  שומע: { male: 'שומע', female: 'שומעת' },
  בודק: { male: 'בודק', female: 'בודקת' },
  מיישר: { male: 'מיישר', female: 'מיישרת' },
  ומיישר: { male: 'ומיישר', female: 'ומיישרת' },
  נופל: { male: 'נופל', female: 'נופלת' },
  מזיז: { male: 'מזיז', female: 'מזיזה' },
};

/** Irregular slash forms — explicit map only; no guessing. */
export const VERIFIED_SLASH_EXCEPTIONS: Record<string, { male: string; female: string }> = {
  'עצמו/ה': { male: 'עצמו', female: 'עצמה' },
  'שלו/ה': { male: 'שלו', female: 'שלה' },
  'ילד/ה': { male: 'ילד', female: 'ילדה' },
  'אחד/ת': { male: 'אחד', female: 'אחת' },
  'אחר/ת': { male: 'אחר', female: 'אחרת' },
};

const FINAL_LETTERS = new Set(['ך', 'ם', 'ן', 'ף', 'ץ']);

function isBrokenChipPair(male: string, female: string): boolean {
  const chip = `{${male}|${female}}`;
  if (/\{מחייך\|מחייךת\}/.test(chip)) return true;
  if (/\{מושך\|מושךת\}/.test(chip)) return true;
  if (/\{שלו\|שלוה\}/.test(chip)) return true;
  if (/\{עצמו\|עצמוה\}/.test(chip)) return true;
  if (/ךת|םת|ןת|ףת|ץת/.test(female)) return true;
  if (/יםה$/.test(female)) return true;
  if (male === 'שלו' && female === 'שלוה') return true;
  if (male === 'עצמו' && female === 'עצמוה') return true;
  if (female === male + 'ת' && male.endsWith('ך')) return true;
  return false;
}

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
    if (stem === 'שלו') {
      rules.push({
        pattern: /שלו\/שלה/g,
        replacement: chip,
        reason: 'slash_chip',
      });
    }
    if (pair.male !== pair.female) {
      rules.push({
        pattern: new RegExp(`${escapeRegExp(pair.male)}/${escapeRegExp(pair.female)}`, 'g'),
        replacement: chip,
        reason: 'full_slash_chip',
      });
    }
  }

  for (const [slash, pair] of Object.entries(VERIFIED_SLASH_EXCEPTIONS)) {
    rules.push({
      pattern: new RegExp(escapeRegExp(slash), 'g'),
      replacement: `{${pair.male}|${pair.female}}`,
      reason: 'safe_slash_exception',
    });
  }

  return rules;
}

const ALLOWLIST_REPLACEMENTS = buildAllowlistReplacements();

const UNREPAIRED_PARTIAL_SUFFIX = /[\u0590-\u05FF]{2,}\{[תה]\}/g;
const SLASH_GENDER_PATTERN =
  /[\u0590-\u05FF][\u0590-\u05FF\u05B0-\u05C7]*\/(?:ת|ה|[\u0590-\u05FF][\u0590-\u05FF\u05B0-\u05C7]*)/g;

function lookupTrustedPair(left: string, right: string): { male: string; female: string } | null {
  for (const pair of Object.values(TRUSTED_STEM_PAIRS)) {
    const male = stripHebrewDiacritics(pair.male);
    const female = stripHebrewDiacritics(pair.female);
    if (!left.endsWith(male) && left !== male) continue;
    const okRight =
      right === female ||
      (right === 'ה' && female.endsWith('ה')) ||
      (right === 'ת' && female.endsWith('ת'));
    if (!okRight) continue;
    return pair;
  }
  return null;
}

export type SafeSlashConvertResult = {
  male: string;
  female: string;
  kind: 'exception' | 'regular';
};

/**
 * Conservative slash → {male|female} converter. Returns null if unsafe.
 */
export function safeConvertSlashGender(match: string): SafeSlashConvertResult | null {
  const strippedKey = stripHebrewDiacritics(match);

  for (const [slash, pair] of Object.entries(VERIFIED_SLASH_EXCEPTIONS)) {
    if (stripHebrewDiacritics(slash) === strippedKey) {
      return { ...pair, kind: 'exception' };
    }
  }

  const slashIdx = match.indexOf('/');
  if (slashIdx < 0) return null;

  const left = stripHebrewDiacritics(match.slice(0, slashIdx));
  const right = stripHebrewDiacritics(match.slice(slashIdx + 1));

  const trusted = lookupTrustedPair(left, right);
  if (trusted) {
    return { male: trusted.male, female: trusted.female, kind: 'exception' };
  }

  if (right.length > 1) {
    for (const pair of Object.values(TRUSTED_STEM_PAIRS)) {
      if (stripHebrewDiacritics(pair.male) === left && stripHebrewDiacritics(pair.female) === right) {
        return { male: pair.male, female: pair.female, kind: 'exception' };
      }
    }
    return null;
  }

  let male = left;
  let female: string;

  if (right === 'ת') {
    if (left.endsWith('ך')) {
      female = left.slice(0, -1) + 'כת';
    } else if (FINAL_LETTERS.has(left[left.length - 1] ?? '')) {
      return null;
    } else {
      female = left + 'ת';
    }
  } else if (right === 'ה') {
    if (FINAL_LETTERS.has(left[left.length - 1] ?? '')) {
      return null;
    }
    female = left + 'ה';
  } else {
    return null;
  }

  if (isBrokenChipPair(male, female)) return null;
  return { male, female, kind: 'regular' };
}

function splitLeadingVav(match: string): { prefix: string; core: string } {
  const slashAt = match.indexOf('/');
  if (slashAt < 0) return { prefix: '', core: match };
  const beforeSlash = match.slice(0, slashAt);
  if (beforeSlash.startsWith('ו') && beforeSlash.length > 1) {
    return { prefix: 'ו', core: match.slice(1) };
  }
  return { prefix: '', core: match };
}

function repairSafeSlashForms(
  text: string,
  page: number,
  fixes: ChipNormalizeEntry[]
): string {
  return text.replace(SLASH_GENDER_PATTERN, (match) => {
    const { prefix, core } = splitLeadingVav(match);
    const converted = safeConvertSlashGender(core);
    if (!converted) return match;
    const chip = `${prefix}{${converted.male}|${converted.female}}`;
    if (isBrokenChipPair(converted.male, converted.female)) return match;
    fixes.push({
      page,
      before: match,
      after: chip,
      reason:
        converted.kind === 'exception' ? 'safe_slash_exception' : 'safe_slash_regular',
    });
    APPROVED_CHIP_PAIRS.add(chipPairKey(converted.male, converted.female));
    return chip;
  });
}

function collectUnrepairedTokens(text: string, page: number): ChipNormalizeReport['unrepaired'] {
  const hits: ChipNormalizeReport['unrepaired'] = [];
  for (const re of [UNREPAIRED_PARTIAL_SUFFIX, SLASH_GENDER_PATTERN]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({
        page,
        token: m[0],
        reason:
          re === UNREPAIRED_PARTIAL_SUFFIX
            ? 'partial_suffix_unrecognized'
            : 'unrepaired_slash_gender',
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

  out = repairSafeSlashForms(out, page, fixes);

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

  const convertedRegularCount = allFixes.filter((f) => f.reason === 'safe_slash_regular').length;
  const convertedExceptionCount = allFixes.filter(
    (f) => f.reason === 'safe_slash_exception'
  ).length;

  return {
    markdown: out,
    report: {
      status: 'deterministic_normalize_safe_slash',
      fixes: allFixes,
      fixCount: allFixes.length,
      convertedRegularCount,
      convertedExceptionCount,
      unrepaired: dedupedUnrepaired,
      advisoryFail: dedupedUnrepaired.length > 0,
    },
  };
}
