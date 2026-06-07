/**
 * Single golden adventure page for prose DENSITY target (not plot/voice/engine).
 */

import fs from 'fs';
import path from 'path';

import { countPageWords, pageProseOnly } from './story-page-utils';

const STORY_BANK_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

const EXEMPLAR_CANDIDATES: Array<{ file: string; page: number }> = [
  { file: 'lion_shaket_adventure.md', page: 4 },
  { file: 'panda_anat_adventure.md', page: 6 },
  { file: 'panda_anat_adventure.md', page: 1 },
];

function extractPageProse(markdown: string, pageNum: number): string | null {
  const chunks = markdown.split(/\r?\n--- Page \d+ ---\r?\n/);
  const chunk = chunks[pageNum];
  if (!chunk) return null;
  const imageIdx = chunk.indexOf('\nimageDirection:');
  return imageIdx >= 0 ? chunk.slice(0, imageIdx).trim() : chunk.trim();
}

/** Fallback: lion_shaket_adventure page 4 (~45 words). */
const FALLBACK_EXEMPLAR = {
  source: 'lion_shaket_adventure.md',
  pageNumber: 4,
  prose: `"הארמון שלי נפל," {אמר|אמרה} {{childName}}. "והכול בפנים רותח."
שָׁקֵט הנהן.
"זה כַּעַס עם רעמה," אמר. "הוא לא סתם בא."
הוא שם כפה על החזה.
"כַּעַס אומר: זה היה חשוב לי."
{{childName}} {הסתכל|הסתכלה} על הידיים.
הן עדיין רצו לזרוק משהו.`,
};

export function loadAdventureDensityExemplar(): {
  source: string;
  pageNumber: number;
  prose: string;
  wordCount: number;
} {
  for (const c of EXEMPLAR_CANDIDATES) {
    const filePath = path.join(STORY_BANK_DIR, c.file);
    if (!fs.existsSync(filePath)) continue;
    const markdown = fs.readFileSync(filePath, 'utf8');
    const raw = extractPageProse(markdown, c.page);
    if (!raw) continue;
    const prose = pageProseOnly(raw);
    const wordCount = countPageWords(prose);
    if (wordCount >= 38 && wordCount <= 55) {
      return { source: c.file, pageNumber: c.page, prose, wordCount };
    }
  }
  const wordCount = countPageWords(FALLBACK_EXEMPLAR.prose);
  return { ...FALLBACK_EXEMPLAR, wordCount };
}

export function formatAdventureDensityExemplarBlock(): string {
  const ex = loadAdventureDensityExemplar();
  return `
GOLDEN-PAGE DENSITY TARGET (LENGTH/RHYTHM ONLY — do NOT copy theme, voice, plot, or companion engine):
Source: ${ex.source} page ${ex.pageNumber} (~${ex.wordCount} Hebrew words)
Match the fullness of this page: visible action + concrete scene detail + body/emotion cue + companion physical/comic cue when relevant. Do not compress into a summary.

--- exemplar page ---
${ex.prose}
--- end exemplar ---`.trim();
}
