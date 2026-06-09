/**
 * Suffix-chip leak gate — FAIL broken word{ת}/word{ה}; ALLOW full {male|female} and {{childName}}.
 */

import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';

export interface SuffixChipHit {
  page: number;
  match: string;
  line: string;
  field: 'prose' | 'imageDirection';
}

export interface SuffixChipScanReport {
  suffixChipPass: boolean;
  hits: SuffixChipHit[];
  suffixChipCount: number;
}

/** Hebrew stem directly followed by suffix-only braces: נוגע{ת}, מחליק{ה} */
const SUFFIX_CHIP_RE = /[\u0590-\u05FF][\u0590-\u05FF\u05F3\u05F4'\-]*\{(?:ת|ה|ים|ות|נ)\}/g;

/** Single-brace token without pipe — not {{childName}}, not valid full chip */
const MALFORMED_SINGLE_BRACE_RE = /(?<!\{)\{(?!\{)([^{}|]+)\}(?!\})/g;

function isAllowedBraceContent(content: string): boolean {
  if (!content.includes('|')) return false;
  const [male, female] = content.split('|');
  return Boolean(male?.trim() && female?.trim());
}

export function scanSuffixChipsInText(
  text: string,
  page: number,
  field: 'prose' | 'imageDirection'
): SuffixChipHit[] {
  const hits: SuffixChipHit[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const suffixMatches = line.match(SUFFIX_CHIP_RE) ?? [];
    for (const match of suffixMatches) {
      hits.push({ page, match, line: line.slice(0, 120), field });
    }

    let m: RegExpExecArray | null;
    const re = new RegExp(MALFORMED_SINGLE_BRACE_RE.source, 'g');
    while ((m = re.exec(line)) !== null) {
      const content = m[1] ?? '';
      if (isAllowedBraceContent(content)) continue;
      if (content === 'childName') continue;
      hits.push({ page, match: m[0], line: line.slice(0, 120), field });
    }
  }
  return hits;
}

export function scanSuffixChipsInMarkdown(
  markdown: string,
  opts?: { includeImageDirection?: boolean }
): SuffixChipScanReport {
  const includeImageDirection = opts?.includeImageDirection ?? true;
  const hits: SuffixChipHit[] = [];

  for (const { page, body } of parseStoryPages(markdown)) {
    const prose = pageProseOnly(body);
    hits.push(...scanSuffixChipsInText(prose, page, 'prose'));

    if (includeImageDirection) {
      const imgMatch = body.match(/imageDirection:\s*(.+)/i);
      if (imgMatch?.[1]) {
        hits.push(...scanSuffixChipsInText(imgMatch[1], page, 'imageDirection'));
      }
    }
  }

  return {
    suffixChipPass: hits.length === 0,
    hits,
    suffixChipCount: hits.length,
  };
}

/** Known irregular Hebrew suffix-chip → full chip (female child stories). */
const SUFFIX_CHIP_REPLACEMENTS: Record<string, string> = {
  'נוגע{ת}': '{נוגע|נוגעת}',
  'מחליק{ה}': '{מחליק|מחליקה}',
  'מצביע{ה}': '{מצביע|מצביעה}',
  'מנופף{ת}': '{מנופף|מנופפת}',
  'קופץ{ת}': '{קופץ|קופצת}',
  'לוחש{ת}': '{לוחש|לוחשת}',
  'שולף{ת}': '{שולף|שולפת}',
  'מלביש{ה}': '{מלביש|מלבישה}',
  'דוחף{ת}': '{דוחף|דוחפת}',
  'מחזיק{ה}': '{מחזיק|מחזיקה}',
  'מוביל{ה}': '{מוביל|מובילה}',
  'מרים{ה}': '{מרים|מרימה}',
  'מדביק{ה}': '{מדביק|מדביקה}',
  'מדלג{ה}': '{מדלג|מדלגת}',
  'סופר{ת}': '{סופר|סופרת}',
};

export function convertSuffixChipsInMarkdown(markdown: string): {
  markdown: string;
  converted: string[];
} {
  let out = markdown;
  const converted: string[] = [];
  for (const [from, to] of Object.entries(SUFFIX_CHIP_REPLACEMENTS)) {
    if (out.includes(from)) {
      out = out.split(from).join(to);
      converted.push(`${from} → ${to}`);
    }
  }
  return { markdown: out, converted };
}
