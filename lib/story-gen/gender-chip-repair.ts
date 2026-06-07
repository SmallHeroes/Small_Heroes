/**
 * Deterministic repair of identical {male|female} chips in story prose.
 */

import {
  countPageWords,
  formatWordCountLine,
  pageProseOnly,
  parseStoryPages,
} from './story-page-utils';

export interface GenderChipRepairEntry {
  page: number;
  before: string;
  after: string;
  word: string;
}

export interface GenderChipRepairReport {
  status: 'deterministic_repair';
  repairs: GenderChipRepairEntry[];
  totalRepaired: number;
  unrepaired: Array<{ page: number; chip: string }>;
}

function repairIdenticalChipsInText(text: string): {
  text: string;
  repairs: Array<{ before: string; after: string; word: string }>;
} {
  const repairs: Array<{ before: string; after: string; word: string }> = [];
  const result = text.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (full, left: string, right: string) => {
    const l = left.trim();
    const r = right.trim();
    if (l && r && l === r) {
      repairs.push({ before: full, after: l, word: l });
      return l;
    }
    return full;
  });
  return { text: result, repairs };
}

function splitPrefixAndPageSection(markdown: string): { prefix: string; pageSection: string } {
  const idx = markdown.search(/\r?\n--- Page 1 ---/);
  if (idx < 0) return { prefix: markdown, pageSection: '' };
  return { prefix: markdown.slice(0, idx).trimEnd(), pageSection: markdown.slice(idx) };
}

/** Collapse {word|word} to plain word in page prose; refresh WORD_COUNT line. */
export function repairGenderChipsInStory(markdown: string): {
  markdown: string;
  report: GenderChipRepairReport;
} {
  const { prefix, pageSection } = splitPrefixAndPageSection(markdown);
  const prefixRepair = repairIdenticalChipsInText(prefix);
  const pages = parseStoryPages(pageSection || markdown);
  const allRepairs: GenderChipRepairEntry[] = prefixRepair.repairs.map((r) => ({
    page: 0,
    ...r,
  }));
  const unrepaired: Array<{ page: number; chip: string }> = [];

  const updatedPages = pages.map(({ page, body }) => {
    const imgMatch = body.match(/imageDirection\s*:[\s\S]*/i);
    const img = imgMatch?.[0] ?? '';
    const proseBlock = img ? body.slice(0, body.indexOf(img)).trimEnd() : body;
    const { text: repairedProse, repairs } = repairIdenticalChipsInText(proseBlock);
    for (const r of repairs) {
      allRepairs.push({ page, ...r });
    }
    const newBody = img ? `${repairedProse}\n\n${img.trim()}` : repairedProse;
    return { page, body: newBody };
  });

  const pageSectionOut = updatedPages
    .map(({ page, body }) => `--- Page ${page} ---\n${body.trim()}`)
    .join('\n\n');

  let out = prefixRepair.text ? `${prefixRepair.text}\n${pageSectionOut}` : pageSectionOut;
  out = out.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '').trim();
  const counts = updatedPages.map((p) => countPageWords(pageProseOnly(p.body)));
  out = `${out}\n\n${formatWordCountLine(counts)}`;

  return {
    markdown: out,
    report: {
      status: 'deterministic_repair',
      repairs: allRepairs,
      totalRepaired: allRepairs.length,
      unrepaired,
    },
  };
}
