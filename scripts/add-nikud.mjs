#!/usr/bin/env node
/**
 * Add Nikud (Hebrew vowel marks) to all story-bank files.
 *
 * Uses GPT to add accurate nikud to children's story text.
 * Only touches Hebrew page text — imageDirection, headers, metadata untouched.
 *
 * Usage:
 *   node scripts/add-nikud.mjs                  # process all stories
 *   node scripts/add-nikud.mjs --dry-run        # show what would be processed
 *   node scripts/add-nikud.mjs --only 15b       # process one story
 *   node scripts/add-nikud.mjs --batch 05       # process one batch
 *   node scripts/add-nikud.mjs --verify         # check which files already have nikud
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ── env ───────────────────────────────────────────────── */
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(path.join(ROOT, '.env.local'));
loadEnv(path.join(ROOT, '.env'));

const MODEL = 'gpt-4o'; // Good enough for nikud, much cheaper than 5.3
const RAW = path.join(ROOT, 'story-bank', 'raw');

/* ── CLI args ──────────────────────────────────────────── */
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERIFY_ONLY = args.includes('--verify');
const onlyIdx = args.indexOf('--only');
const ONLY_ID = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const batchIdx = args.indexOf('--batch');
const ONLY_BATCH = batchIdx >= 0 ? args[batchIdx + 1] : null;

/* ── nikud detection ───────────────────────────────────── */
// Hebrew nikud code points: U+05B0–U+05BD, U+05BF, U+05C1–U+05C2, U+05C4–U+05C5, U+05C7
const NIKUD_REGEX = /[ְ-ׇֽֿׁׂׅׄ]/;

function hasNikud(text) {
  return NIKUD_REGEX.test(text);
}

function nikudDensity(text) {
  // Count nikud marks vs Hebrew letters
  const hebrewLetters = (text.match(/[֐-ת]/g) || []).length;
  const nikudMarks = (text.match(/[ְ-ׇֽֿׁׂׅׄ]/g) || []).length;
  if (hebrewLetters === 0) return 0;
  return nikudMarks / hebrewLetters;
}

/* ── story parsing (from fix-structural.mjs) ───────────── */
function parseStory(content) {
  const firstPage = content.match(/--- Page 1 ---/);
  const header = firstPage ? content.substring(0, firstPage.index).trim() : '';
  const pages = [];
  const pageRegex = /--- Page (\d+) ---\s*\n([\s\S]*?)(?=--- Page \d+ ---|\nWORD_COUNT:|$)/g;
  let m;
  while ((m = pageRegex.exec(content)) !== null) {
    const pageNum = parseInt(m[1]);
    const body = m[2].trim();
    const imgMatch = body.match(/\nimageDirection:\s*/);
    let text, imageDir;
    if (imgMatch) {
      text = body.substring(0, imgMatch.index).trim();
      imageDir = body.substring(imgMatch.index).trim();
    } else if (body.startsWith('imageDirection:')) {
      text = ''; imageDir = body;
    } else {
      text = body; imageDir = '';
    }
    text = text.replace(/\n---\s*$/g, '').trim();
    imageDir = imageDir.replace(/\n---\s*$/g, '').trim();
    pages.push({ pageNum, text, imageDir });
  }

  // Extract WORD_COUNT line if present
  const wcMatch = content.match(/\nWORD_COUNT:\s*(.+)/);
  const wordCountLine = wcMatch ? wcMatch[0].trim() : null;

  return { header, pages, wordCountLine };
}

function rebuildStory(header, pages, wordCountLine) {
  let out = header + '\n\n';
  for (const p of pages) {
    out += '--- Page ' + p.pageNum + ' ---\n';
    out += p.text + '\n\n';
    if (p.imageDir) out += p.imageDir + '\n\n';
  }
  if (wordCountLine) out += wordCountLine;
  return out;
}

/* ── GPT call ──────────────────────────────────────────── */
async function callGPT(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const body = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a Hebrew nikud (vocalization) expert specializing in children's literature.
Your job is to add accurate nikud (vowel marks) to Hebrew text.

RULES:
1. Add FULL nikud (ניקוד מלא) to every Hebrew word
2. Keep the EXACT same text — do not change, add, or remove any word
3. Keep template variables like {{childName}} and {{companionName}} EXACTLY as-is (no nikud on them)
4. Keep all punctuation, line breaks, and formatting identical
5. Use correct grammatical nikud — this is a children's story, so pronunciation must be clear and standard
6. Dagesh (דגש) must be used correctly
7. Return ONLY the nikud'd text, nothing else — no explanations, no markdown`
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1, // Very low — we want consistent, accurate nikud
    max_tokens: 8000,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + (await res.text()).slice(0, 500));
  const data = await res.json();
  return data.choices[0].message.content;
}

/* ── process one story ─────────────────────────────────── */
async function processStory(filePath) {
  const filename = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const { header, pages, wordCountLine } = parseStory(content);

  if (pages.length === 0) {
    console.log(`  ⚠ ${filename}: no pages found, skipping`);
    return { skipped: true, reason: 'no pages' };
  }

  // Check if already has nikud
  const allText = pages.map(p => p.text).join('\n');
  const density = nikudDensity(allText);
  if (density > 0.3) {
    console.log(`  ✓ ${filename}: already has nikud (density ${(density * 100).toFixed(1)}%), skipping`);
    return { skipped: true, reason: 'already has nikud' };
  }

  if (DRY_RUN) {
    console.log(`  → ${filename}: ${pages.length} pages, would add nikud (current density: ${(density * 100).toFixed(1)}%)`);
    return { skipped: false, dryRun: true };
  }

  // Build prompt — send all page texts at once, numbered
  const pageTexts = pages
    .map(p => `=== עמוד ${p.pageNum} ===\n${p.text}`)
    .join('\n\n');

  const prompt = `Add full nikud (ניקוד מלא) to the following Hebrew children's story pages.
Return the text in the EXACT same format — each page starting with === עמוד X ===

CRITICAL: Keep {{childName}} and {{companionName}} exactly as-is. Do not nikud them.

${pageTexts}`;

  console.log(`  → ${filename}: sending ${pages.length} pages to GPT...`);
  const reply = await callGPT(prompt);

  // Parse reply — extract nikud'd text per page
  const nikudPages = {};
  const replyRegex = /===\s*עמ[וּ]ד\s*(\d+)\s*===\s*\n([\s\S]*?)(?====\s*עמ[וּ]ד\s*\d+\s*===|$)/g;
  let rm;
  while ((rm = replyRegex.exec(reply)) !== null) {
    nikudPages[parseInt(rm[1])] = rm[2].trim();
  }

  // Validate — we should get back the same number of pages
  const returnedCount = Object.keys(nikudPages).length;
  if (returnedCount < pages.length * 0.8) {
    console.log(`  ⚠ ${filename}: GPT returned only ${returnedCount}/${pages.length} pages, skipping`);
    console.log(`    First 200 chars of reply: ${reply.slice(0, 200)}`);
    return { skipped: true, reason: `incomplete reply (${returnedCount}/${pages.length})` };
  }

  // Apply nikud'd text to pages
  let updated = 0;
  for (const p of pages) {
    if (nikudPages[p.pageNum]) {
      const newText = nikudPages[p.pageNum];
      // Validate: new text should have nikud
      if (!hasNikud(newText)) {
        console.log(`    Page ${p.pageNum}: no nikud detected in reply, keeping original`);
        continue;
      }
      // Validate: length shouldn't change dramatically (nikud adds marks, not words)
      // Hebrew text with nikud is longer in bytes but should have same word count
      const origWords = p.text.split(/\s+/).length;
      const newWords = newText.split(/\s+/).length;
      if (Math.abs(origWords - newWords) > origWords * 0.15) {
        console.log(`    Page ${p.pageNum}: word count mismatch (${origWords} → ${newWords}), keeping original`);
        continue;
      }
      p.text = newText;
      updated++;
    }
  }

  if (updated === 0) {
    console.log(`  ⚠ ${filename}: no pages updated, skipping save`);
    return { skipped: true, reason: 'no pages updated' };
  }

  // Backup original
  const backupPath = filePath.replace('.md', '_pre-nikud.md');
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, content, 'utf-8');
    console.log(`  📄 Backup: ${path.basename(backupPath)}`);
  }

  // Save nikud'd version
  const rebuilt = rebuildStory(header, pages, wordCountLine);
  fs.writeFileSync(filePath, rebuilt, 'utf-8');
  console.log(`  ✅ ${filename}: ${updated}/${pages.length} pages nikud'd`);

  // Verify
  const newDensity = nikudDensity(pages.map(p => p.text).join('\n'));
  console.log(`    Nikud density: ${(density * 100).toFixed(1)}% → ${(newDensity * 100).toFixed(1)}%`);

  return { skipped: false, updated, total: pages.length };
}

/* ── main ──────────────────────────────────────────────── */
async function main() {
  console.log('🔤 Add Nikud to Story Bank');
  console.log('Model:', MODEL);
  if (DRY_RUN) console.log('Mode: DRY RUN');
  if (VERIFY_ONLY) console.log('Mode: VERIFY ONLY');
  if (ONLY_ID) console.log('Only:', ONLY_ID);
  if (ONLY_BATCH) console.log('Batch:', ONLY_BATCH);
  console.log('');

  // Collect story files (exclude prompts, backups)
  const allFiles = fs.readdirSync(RAW)
    .filter(f =>
      f.endsWith('.md') &&
      !f.includes('_prompt') &&
      !f.includes('_backup') &&
      !f.includes('_pre-nikud') &&
      !f.startsWith('rewrite_')
    )
    .sort();

  let storyFiles = allFiles;

  if (ONLY_ID) {
    storyFiles = allFiles.filter(f => f.includes(`_${ONLY_ID}.md`));
  } else if (ONLY_BATCH) {
    storyFiles = allFiles.filter(f => f.startsWith(`batch-${ONLY_BATCH.padStart(2, '0')}`));
  }

  console.log(`Found ${storyFiles.length} story files\n`);

  if (VERIFY_ONLY) {
    let withNikud = 0, without = 0;
    for (const f of storyFiles) {
      const content = fs.readFileSync(path.join(RAW, f), 'utf-8');
      const { pages } = parseStory(content);
      const allText = pages.map(p => p.text).join('\n');
      const density = nikudDensity(allText);
      const status = density > 0.3 ? '✅' : '❌';
      if (density > 0.3) withNikud++; else without++;
      console.log(`  ${status} ${f} — ${(density * 100).toFixed(1)}% nikud density`);
    }
    console.log(`\nSummary: ${withNikud} with nikud, ${without} without`);
    return;
  }

  const results = { processed: 0, skipped: 0, errors: 0 };
  const DELAY_MS = 1500; // Rate limit protection

  for (const f of storyFiles) {
    const filePath = path.join(RAW, f);
    try {
      const result = await processStory(filePath);
      if (result.skipped) results.skipped++;
      else results.processed++;
    } catch (err) {
      console.error(`  ❌ ${f}: ${err.message}`);
      results.errors++;
    }

    // Delay between API calls
    if (!DRY_RUN && !VERIFY_ONLY) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log('\n═══ Summary ═══');
  console.log(`Processed: ${results.processed}`);
  console.log(`Skipped:   ${results.skipped}`);
  console.log(`Errors:    ${results.errors}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
