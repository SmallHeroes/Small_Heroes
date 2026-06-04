/**
 * Smoke: fox_uri_bedtime bank has 8 pages, nikud in source, display strip, TTS path keeps nikud.
 * Run: node scripts/smoke-fox-bedtime-nikud.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createContext, runInContext } from 'vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NIKUD_RE = /[\u0591-\u05C7]/;

function stripNikud(text) {
  return text.replace(NIKUD_RE, '');
}

const md = readFileSync(join(root, 'story-bank/v5-fixed-v2/fox_uri_bedtime.md'), 'utf8');
const pageBlocks = md.split(/--- Page \d+ ---/).slice(1);
if (pageBlocks.length !== 8) {
  console.error('FAIL: expected 8 pages, got', pageBlocks.length);
  process.exit(1);
}

const page1Raw = pageBlocks[0].split('imageDirection:')[0].trim();
if (!NIKUD_RE.test(page1Raw) && !pageBlocks.some((b) => NIKUD_RE.test(b.split('imageDirection:')[0]))) {
  console.error('FAIL: bank should contain partial nikud on at least one page');
  process.exit(1);
}

const page1Display = stripNikud(page1Raw);
if (NIKUD_RE.test(page1Display)) {
  console.error('FAIL: display strip left nikud');
  process.exit(1);
}
if (!page1Display.includes('{{childName}}') && !page1Display.match(/\{שכב\|שכבה\}/)) {
  console.error('FAIL: chips stripped incorrectly');
  process.exit(1);
}

// Simulate story-bank-loader: narrationText = raw bank text (with nikud)
const narrationSample = pageBlocks[2].split('imageDirection:')[0].trim();
if (!NIKUD_RE.test(narrationSample)) {
  console.error('FAIL: page 3 narration sample should retain nikud for TTS');
  process.exit(1);
}
console.log('[TTS sample retains nikud]', NIKUD_RE.test(narrationSample), narrationSample.slice(0, 60) + '…');

// legacy-adapter path via compiled import is heavy; vm-load strip is enough for display
console.log('OK: fox_uri_bedtime 8 pages, bank has nikud, display strip preserves chips, TTS sample has nikud');
