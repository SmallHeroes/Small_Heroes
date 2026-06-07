/**
 * Shared page parsing + word counts for Phase B validators and WORD_COUNT line.
 */

import type { StoryDirection } from './story-generation-types';

/** Strip {{childName}} and imageDirection before counting / chip checks. */
export function pageProseOnly(pageBody: string): string {
  return pageBody.replace(/imageDirection\s*:[^\n]*/gi, '').trim();
}

export function countPageWords(prose: string): number {
  const stripped = prose
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\{[^{}|]+\|[^{}|]+\}/g, ' ')
    .replace(/[{}]/g, ' ');
  const tokens = stripped.match(/[\u0590-\u05FF]+|[A-Za-z]+|\d+/g);
  return tokens?.length ?? 0;
}

export function parseStoryPages(markdown: string): Array<{ page: number; body: string }> {
  const pages: Array<{ page: number; body: string }> = [];
  const body = markdown.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '');
  const re =
    /\r?\n--- Page (\d+) ---\r?\n([\s\S]*?)(?=\r?\n--- Page \d+ ---|\r?\nWORD_COUNT:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec('\n' + body)) !== null) {
    pages.push({ page: parseInt(m[1], 10), body: m[2] ?? '' });
  }
  if (pages.length === 0) {
    const h3 =
      /\r?\n### Page (\d+)\r?\n([\s\S]*?)(?=\r?\n### Page \d+|\r?\nWORD_COUNT:|$)/g;
    while ((m = h3.exec('\n' + body)) !== null) {
      pages.push({ page: parseInt(m[1], 10), body: m[2] ?? '' });
    }
  }
  return pages;
}

/** Gender chips only: single-brace {male|female} — not {{childName}} placeholders. */
export function analyzeGenderChips(prose: string): {
  malformed: string[];
  identical: string[];
} {
  const malformed: string[] = [];
  const identical: string[] = [];
  const withoutDouble = prose.replace(/\{\{[^}]+\}\}/g, '');
  const chipRe = /\{([^{}|]+)\|([^{}|]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = chipRe.exec(withoutDouble)) !== null) {
    const full = m[0];
    const left = m[1].trim();
    const right = m[2].trim();
    if (!left || !right) malformed.push(full);
    if (left === right) identical.push(full);
  }
  return { malformed, identical };
}

export function fixHebrewLatinDrift(text: string): string {
  return text
    .replace(/בחצi/g, 'בחצי')
    .replace(/(?<=[\u0590-\u05FF])חצi(?=[\u0590-\u05FF\s"'.,!?—–-]|$)/g, 'חצי')
    .replace(/חצi-אוזן/g, 'חצי-אוזן');
}

export function computePageWordCounts(markdown: string): number[] {
  return parseStoryPages(markdown).map((p) => countPageWords(pageProseOnly(p.body)));
}

export function formatWordCountLine(perPage: number[]): string {
  const total = perPage.reduce((a, b) => a + b, 0);
  return `WORD_COUNT: [${perPage.join(', ')}] = ${total}`;
}

export function parseWordCountLine(markdown: string): number[] | null {
  const m = markdown.match(/WORD_COUNT:\s*\[([^\]]+)\]/i);
  if (!m) return null;
  return m[1].split(',').map((s) => parseInt(s.trim(), 10));
}

export function hasValidYamlFrontmatter(markdown: string): boolean {
  return /(?:^|\r?\n)---\r?\n[\s\S]*?\r?\n---/.test(markdown.trim());
}

export const PHASE_B_PROMPT_VERSION = 'v5-story-gen-phase-b';

/** Default child gender in bank YAML (runtime personalization uses chips in prose). */
export const PHASE_B_DEFAULT_CHILD_GENDER = 'female';
