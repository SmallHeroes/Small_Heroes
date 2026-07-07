/**
 * Homograph miss-list audit (report-only) for the per-page TTS niqqud pass.
 *
 * The bank .md stories are ~96-98% vocalized, so the RULES pass is a per-word no-op on them EXCEPT on the few words
 * that appear fully BARE (no niqqud). A bare AMBIGUOUS homograph the current RULES do NOT cover is a TTS mis-read
 * risk. This scans every bank story's narration prose, collects the bare (no-niqqud) Hebrew words, and flags the ones
 * that are known ambiguous homographs NOT already vocalized by the RULES.
 *
 * Report only — expanding RULES/fixtures is a separate task (needs Hebrew linguistic review).
 * Run: npx tsx scripts/audit-narration-homographs.ts
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { applyTtsAmbiguityNiqqudToText } from '../lib/story-gen-v2/tts-ambiguity-niqqud';

const BANK_DIRS = ['story-bank/v5-fixed-v2', 'story-bank/v3-approved'];
const NIQQUD = /[֑-ׇ]/;
const HEB_WORD = /[א-ת֑-ׇ]+/g;

/**
 * Known ambiguous Hebrew homographs whose reading depends on niqqud (bare form → the two+ plausible readings). A bare
 * occurrence of any of these that the RULES do not vocalize is a mis-read candidate. Curated (children's-story
 * common); NOT exhaustive — a first pass for human/ChatGPT confirmation before RULES are expanded.
 */
const CANDIDATE_HOMOGRAPHS: Record<string, string> = {
  בוקר: 'bóker (morning) vs bokér (cowherd)',
  ערב: 'érev (evening) vs arév (pleasant/mixed)',
  ספר: 'séfer (book) vs safár (counted) / sapár (barber)',
  שער: 'shá’ar (gate) vs sé’ar (hair)',
  פרח: 'pérach (flower) vs parách (bloomed/flew)',
  ילד: 'yéled (child) vs yiléd (delivered)',
  מלך: 'mélekh (king) vs malákh (reigned)',
  אוכל: 'ókhel (food) vs okhél (eats)',
  ישן: 'yashén (asleep) vs yashán (old)',
  פחד: 'páchad (fear, noun) vs pachád (feared, verb)',
  שמח: 'saméach (happy) vs samách (rejoiced)',
  רוח: 'rúach (wind/spirit) vs révach (gap/profit)',
  שמן: 'shémen (oil) vs shamén (fat)',
  חלב: 'chalav (milk) vs chélev (fat)',
  זקן: 'zakén (old man) vs zakán (beard)',
  קרן: 'kéren (horn/ray) vs karán (shone)',
  עצם: 'étzem (bone) vs atzám ((eyes) shut)',
  דבר: 'davár (thing) vs dibér (spoke)',
  צהריים: 'tzoharáyim (noon) — often bare',
  שירה: 'shirá (song/poetry) vs sha’yára? — check',
  בירה: 'birá (capital/beer) — context',
  חמה: 'chamá (sun) vs chamá (hot, f.) — context',
};

function extractProse(md: string): string {
  // Keep only the page prose (between "--- Page N ---" and "imageDirection:"), drop frontmatter/metadata/imageDirection.
  const parts = md.split(/(--- Page \d+ ---)/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0 && /^--- Page \d+ ---$/.test(parts[i - 1])) {
      const idx = parts[i].search(/imageDirection\s*:/i);
      out.push(idx >= 0 ? parts[i].slice(0, idx) : parts[i]);
    }
  }
  return out.join('\n');
}

type Hit = { count: number; files: Set<string> };
const bareWords = new Map<string, Hit>();
const fileList: string[] = [];

for (const dir of BANK_DIRS) {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    continue;
  }
  for (const name of entries) {
    if (!name.endsWith('.md') || name.startsWith('_') || name.includes('superseded')) continue;
    const path = join(dir, name);
    if (!statSync(path).isFile()) continue;
    fileList.push(`${dir}/${name}`);
    const prose = extractProse(readFileSync(path, 'utf8'));
    for (const word of prose.match(HEB_WORD) ?? []) {
      if (NIQQUD.test(word)) continue; // vocalized word → the TTS pass reads it correctly
      const hit = bareWords.get(word) ?? { count: 0, files: new Set<string>() };
      hit.count += 1;
      hit.files.add(name);
      bareWords.set(word, hit);
    }
  }
}

// The MISS LIST: bare words that are known homographs AND not vocalized by the current RULES.
const miss = [...bareWords.entries()]
  .filter(([w]) => w in CANDIDATE_HOMOGRAPHS)
  .filter(([w]) => applyTtsAmbiguityNiqqudToText(w).text === w) // RULES leave it bare → a MISS
  .sort((a, b) => b[1].count - a[1].count);

const covered = [...bareWords.keys()].filter((w) => w in CANDIDATE_HOMOGRAPHS && applyTtsAmbiguityNiqqudToText(w).text !== w);
const totalBareTokens = [...bareWords.values()].reduce((s, h) => s + h.count, 0);

console.log(`\n=== Narration homograph miss-list audit ===`);
console.log(`Files scanned: ${fileList.length} | distinct bare words: ${bareWords.size} | total bare tokens: ${totalBareTokens}`);
console.log(`Candidate homographs tracked: ${Object.keys(CANDIDATE_HOMOGRAPHS).length} | already covered by RULES (bare hits): ${covered.length}`);

console.log(`\n--- MISS LIST (bare homograph, NOT covered by RULES) ---`);
if (miss.length === 0) {
  console.log('(none of the tracked candidate homographs appear BARE in the bank narration)');
} else {
  for (const [w, hit] of miss) {
    const files = [...hit.files].sort();
    console.log(
      `${w}\t×${hit.count}\t${CANDIDATE_HOMOGRAPHS[w]}\n\tfiles(${files.length}): ${files.slice(0, 8).join(', ')}${files.length > 8 ? ' …' : ''}`,
    );
  }
}

// Forward-looking: the most frequent BARE words overall (so a human can spot homographs beyond the curated set).
console.log(`\n--- Top 30 BARE words overall (for human review beyond the curated set) ---`);
const topBare = [...bareWords.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 30);
console.log(topBare.map(([w, h]) => `${w}×${h.count}`).join('  '));
console.log('');
