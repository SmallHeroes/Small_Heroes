/**
 * Single golden fantasy page for prose DENSITY target (not plot/voice/engine).
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
  { file: 'dragon_dini_fantasy.md', page: 3 },
  { file: 'dolphin_shahkan_fantasy.md', page: 4 },
  { file: 'bolly_armadillo_fantasy.md', page: 2 },
];

function extractPageProse(markdown: string, pageNum: number): string | null {
  const chunks = markdown.split(/\r?\n--- Page \d+ ---\r?\n/);
  const chunk = chunks[pageNum];
  if (!chunk) return null;
  const imageIdx = chunk.indexOf('\nimageDirection:');
  return imageIdx >= 0 ? chunk.slice(0, imageIdx).trim() : chunk.trim();
}

const FALLBACK_EXEMPLAR = {
  source: 'dragon_dini_fantasy.md',
  pageNumber: 3,
  prose: `{{childName}} {נחת|נחתה} על גבעות כתומות ורכות.
שם חיכתה דִּינִי.
דרקונית גדולה כמו כלב גדול, עם עיניים חמות וסרט טרקוטה.
"שלום!" קראה דִּינִי.
עוד לפני ש{{childName}} {ענה|ענתה}, הזנב שלה עשה {סביבו|סביבה} עיגול.
"הגנה מלאה!"`,
};

export function loadFantasyDensityExemplar(): {
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
    if (wordCount >= 42 && wordCount <= 65) {
      return { source: c.file, pageNumber: c.page, prose, wordCount };
    }
  }
  const wordCount = countPageWords(FALLBACK_EXEMPLAR.prose);
  return { ...FALLBACK_EXEMPLAR, wordCount };
}

export function formatFantasyDensityExemplarBlock(): string {
  const ex = loadFantasyDensityExemplar();
  return `
GOLDEN-PAGE DENSITY TARGET (LENGTH/RHYTHM ONLY — do NOT copy theme, voice, plot, or companion engine):
Source: ${ex.source} page ${ex.pageNumber} (~${ex.wordCount} Hebrew words)
Match the fullness of this fantasy page: visible action + concrete world/setting detail + body/emotion signal + small story movement. Not a one-beat summary.

--- exemplar page ---
${ex.prose}
--- end exemplar ---`.trim();
}
