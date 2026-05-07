#!/usr/bin/env node
/**
 * Generate 10-page and 20-page RETELLINGS of all 15-page story-bank stories.
 *
 * NOT trimming or padding — each variant is a fresh retelling:
 * - 10-page: simpler, lighter, for ages 3-4. Same metaphor, fewer steps, faster arc.
 * - 20-page: deeper, richer, for ages 6-7. Same metaphor, more layers, subplot, atmosphere.
 *
 * Usage:
 *   node scripts/generate-page-variants.mjs                    # all stories, both variants
 *   node scripts/generate-page-variants.mjs --only 15b         # one story
 *   node scripts/generate-page-variants.mjs --batch 05         # one batch
 *   node scripts/generate-page-variants.mjs --length 10        # only 10-page variants
 *   node scripts/generate-page-variants.mjs --length 20        # only 20-page variants
 *   node scripts/generate-page-variants.mjs --dry-run          # show plan only
 *   node scripts/generate-page-variants.mjs --verify           # check which variants exist
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

const MODEL = process.env.STORY_MODEL || 'gpt-5.3-chat-latest';
const RAW = path.join(ROOT, 'story-bank', 'raw');

/* ── CLI args ──────────────────────────────────────────── */
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERIFY_ONLY = args.includes('--verify');
const onlyIdx = args.indexOf('--only');
const ONLY_ID = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const batchIdx = args.indexOf('--batch');
const ONLY_BATCH = batchIdx >= 0 ? args[batchIdx + 1] : null;
const lengthIdx = args.indexOf('--length');
const ONLY_LENGTH = lengthIdx >= 0 ? parseInt(args[lengthIdx + 1]) : null;

/* ── parsing ───────────────────────────────────────────── */
function countHebrewWords(text) {
  const lines = text.split('\n').filter(l => !l.trim().startsWith('imageDirection:'));
  const joined = lines.join(' ').replace(/\{\{[^}]+\}\}/g, 'מילה').replace(/\s+/g, ' ').trim();
  if (!joined) return 0;
  return joined.split(' ').filter(t => /[֐-׿]/.test(t) || /[a-zA-Z0-9]/.test(t)).length;
}

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
      imageDir = body.substring(imgMatch.index).trim().replace(/^imageDirection:\s*/i, '').trim();
    } else if (body.startsWith('imageDirection:')) {
      text = ''; imageDir = body.replace(/^imageDirection:\s*/, '').trim();
    } else {
      text = body; imageDir = '';
    }
    text = text.replace(/\n---\s*$/g, '').trim();
    pages.push({ pageNum, text, imageDir, wordCount: countHebrewWords(text) });
  }
  return { header, pages };
}

function extractMetadata(header) {
  const meta = {};
  const lines = header.split('\n');
  for (const l of lines) {
    const m = l.match(/^(storyStyle|metaphor|stakes|weirdMoment|emotionalArc|solutionType|coverScene):\s*(.+)/);
    if (m) meta[m[1]] = m[2].trim();
    const titleMatch = l.match(/^===\s*STORY \d+:\s*(.+?)\s*===/);
    if (titleMatch) meta.title = titleMatch[1];
  }
  return meta;
}

/* ── GPT call ──────────────────────────────────────────── */
async function callGPT(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };
  if (MODEL.startsWith('gpt-5.')) {
    body.max_completion_tokens = 12000;
  } else {
    body.max_tokens = 12000;
    body.temperature = 0.75;
  }

  console.log('  [API] Calling ' + MODEL + '...');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + (await res.text()).slice(0, 500));
  const data = await res.json();
  console.log('  [API] tokens: ' + (data.usage?.total_tokens || 0));
  return data.choices[0].message.content;
}

/* ── prompts ───────────────────────────────────────────── */

const WORD_COUNT_BLOCK_10 = `
WORD COUNT / PAGE FULLNESS

This is a read-aloud picture book for ages 3-4. Pages should be SHORT and LIGHT.
The 15-page original averages ~29 words/page. Your 10-page version should average 22-30 words/page.
Total target: 220–300 words for the whole book.

Regular pages:
- Target: 22–30 Hebrew words
- Hard minimum: 18 Hebrew words
- Hard MAXIMUM: 35 Hebrew words — do NOT exceed this

Climax pages 7–8:
- Target: 28–35 Hebrew words
- Hard minimum: 22 Hebrew words
- Hard MAXIMUM: 40 Hebrew words

CRITICAL: This is for YOUNG children. Short sentences. Simple words. One idea per page.
Do NOT write dense paragraphs. Each page = 2-4 short sentences maximum.

Before final output:
1. Count the actual Hebrew words on every page.
2. If any page EXCEEDS the maximum, shorten it.
3. If any page is below the hard minimum, add one sensory detail.
4. Output the corrected story only.
5. Include WORD_COUNT at the end.
`;

const WORD_COUNT_BLOCK_20 = `
WORD COUNT / PAGE FULLNESS

This is a read-aloud picture book for ages 6-7. Pages should feel rich but not dense.
The 15-page original averages ~29 words/page (~435 total). Your 20-page version should average 28-38 words/page.
Target total: 560–760 words for the whole book.

Regular pages:
- Target: 28–38 Hebrew words
- Hard minimum: 22 Hebrew words
- Hard MAXIMUM: 45 Hebrew words — do NOT exceed this

Climax pages 14–17:
- Target: 35–45 Hebrew words
- Hard minimum: 28 Hebrew words
- Hard MAXIMUM: 50 Hebrew words

Each page should feel like ONE moment — not a dense paragraph.
3-5 sentences per page. Leave room for the illustration to tell part of the story.

Before final output:
1. Count the actual Hebrew words on every page.
2. If any page EXCEEDS the maximum, shorten it.
3. If any page is below the hard minimum, add one sensory or emotional detail.
4. Output the corrected story only.
5. Include WORD_COUNT at the end.
`;

const SYSTEM_10_PAGE = `You are an expert Hebrew children's book author, specializing in picture books for ages 3-4.

You will receive a 15-page Hebrew children's story. Your job is to RETELL the same story in 10 pages.

THIS IS NOT TRIMMING. You are writing a new, complete 10-page story that:
- Uses the SAME metaphor, stakes, weird moment, emotional arc, and solution type
- Uses the SAME characters ({{childName}}, {{companionName}})
- Tells the SAME core story — but SIMPLER and LIGHTER
- Is designed for younger children (ages 3-4)

WHAT MAKES A GOOD 10-PAGE VERSION:
- Simpler vocabulary, shorter sentences
- Fewer intermediate steps — get to the core conflict sooner
- The emotional arc is COMPLETE but moves faster
- Less internal monologue, more action and sensory moments
- The companion is more present and reactive
- The "weird moment" can be simpler but must still exist
- The climax (pages 7-8) is still ACTIVE — the child DOES something physical
- The resolution is warm and clear
${WORD_COUNT_BLOCK_10}
STRUCTURAL RULES:
- Exactly 10 pages
- Template variables {{childName}} and {{companionName}} must be used exactly as shown
- Each page MUST have an imageDirection line (English, on its own line starting with "imageDirection:")
- imageDirection must describe the SPECIFIC visual scene for illustration
- Keep the same storyStyle as the original

FORMAT — return ONLY this, nothing else:
--- Page 1 ---
[Hebrew text]

imageDirection: [English scene description]

--- Page 2 ---
...

WORD_COUNT: [w1, w2, ...] = total`;

const SYSTEM_20_PAGE = `You are an expert Hebrew children's book author, specializing in rich illustrated stories for ages 6-7.

You will receive a 15-page Hebrew children's story. Your job is to RETELL the same story in 20 pages.

THIS IS NOT PADDING. You are writing a new, complete 20-page story that:
- Uses the SAME metaphor, stakes, weird moment, emotional arc, and solution type
- Uses the SAME characters ({{childName}}, {{companionName}})
- Tells the SAME core story — but DEEPER and RICHER
- Is designed for older children (ages 6-7) who want more story

WHAT TO ADD (not filler — genuine depth):
- A backstory moment: WHY does the central object/place matter to the child? Show it, don't tell.
- The companion's own mini-arc: they start one way and end differently (e.g., oblivious → aware)
- Atmospheric/sensory pages: what does the rain sound like on mud? What does the dark room smell like?
- A false-hope beat before the climax: something seems to work, then doesn't
- A reflection moment: the child pauses and THINKS about what's happening
- Richer dialogue: more back-and-forth between child and companion
- Deeper emotional nuance: mixed feelings, not just one emotion per page

WHAT NOT TO ADD:
- New characters (unless the original has them)
- A different conflict or resolution
- Repetitive scenes that don't advance the story
- Moralistic narration or lessons
- Scenes that exist only to fill pages
${WORD_COUNT_BLOCK_20}
STRUCTURAL RULES:
- Exactly 20 pages
- Template variables {{childName}} and {{companionName}} must be used exactly as shown
- Each page MUST have an imageDirection line (English, on its own line starting with "imageDirection:")
- imageDirection must describe the SPECIFIC visual scene for illustration
- Keep the same storyStyle as the original
- The child must ACTIVELY solve the problem (not passive, not magic)

FORMAT — return ONLY this, nothing else:
--- Page 1 ---
[Hebrew text]

imageDirection: [English scene description]

--- Page 2 ---
...

WORD_COUNT: [w1, w2, ...] = total`;

function buildUserPrompt(meta, pages, targetLength) {
  const fullStory = pages.map(p =>
    `--- Page ${p.pageNum} ---\n${p.text}\n\nimageDirection: ${p.imageDir}`
  ).join('\n\n');

  const ageLabel = targetLength === 10 ? '3-4' : '6-7';

  return `Here is the original 15-page story. Retell it as a complete ${targetLength}-page story for ages ${ageLabel}.

STORY METADATA:
- Title: ${meta.title || 'untitled'}
- Style: ${meta.storyStyle || 'unknown'}
- Metaphor: ${meta.metaphor || ''}
- Stakes: ${meta.stakes || ''}
- Weird Moment: ${meta.weirdMoment || ''}
- Emotional Arc: ${meta.emotionalArc || ''}
- Solution Type: ${meta.solutionType || ''}

ORIGINAL 15-PAGE STORY:

${fullStory}

Now write the ${targetLength}-page retelling. Remember:
${targetLength === 10
  ? '- SIMPLER, not shorter. A complete story for young children (ages 3-4).\n- Fewer steps to the conflict, but the arc is whole.\n- Target 22-30 Hebrew words per page. Max 35. Climax pages 7-8 target 28-35.\n- Total: 220-300 words. Keep it LIGHT.'
  : '- DEEPER, not longer. A richer story for older children (ages 6-7).\n- Add backstory, atmosphere, companion arc, false hope.\n- Target 28-38 Hebrew words per page. Max 45. Climax pages 14-17 target 35-45.\n- Total: 560-760 words.'}`;
}

/* ── extract and validate result ──────────────────────── */
function extractResult(reply, targetLength) {
  const pages = [];
  const pageRegex = /--- Page (\d+) ---\s*\n([\s\S]*?)(?=--- Page \d+ ---|\nWORD_COUNT:|$)/g;
  let m;
  while ((m = pageRegex.exec(reply)) !== null) {
    const pageNum = parseInt(m[1]);
    const body = m[2].trim();
    const imgMatch = body.match(/\nimageDirection:\s*/);
    let text, imageDir;
    if (imgMatch) {
      text = body.substring(0, imgMatch.index).trim();
      imageDir = body.substring(imgMatch.index).trim().replace(/^imageDirection:\s*/i, '').trim();
    } else {
      text = body; imageDir = '';
    }
    const wc = countHebrewWords(text);
    pages.push({ pageNum, text, imageDir, wordCount: wc });
  }

  // Validate
  const issues = [];
  if (pages.length !== targetLength) {
    issues.push(`Expected ${targetLength} pages, got ${pages.length}`);
  }
  for (const p of pages) {
    if (!p.imageDir) issues.push(`Page ${p.pageNum}: missing imageDirection`);
    if (targetLength === 10) {
      if (p.wordCount < 20) issues.push(`Page ${p.pageNum}: too short (${p.wordCount}w, floor 20)`);
      if (p.wordCount > 42) issues.push(`Page ${p.pageNum}: too long (${p.wordCount}w, ceiling 42)`);
    } else {
      if (p.wordCount < 22) issues.push(`Page ${p.pageNum}: too short (${p.wordCount}w, floor 22)`);
      if (p.wordCount > 52) issues.push(`Page ${p.pageNum}: too long (${p.wordCount}w, ceiling 52)`);
    }
  }
  const total = pages.reduce((s, p) => s + p.wordCount, 0);

  return { pages, issues, total };
}

/* ── build output file ────────────────────────────────── */
function buildOutputFile(originalHeader, meta, pages, targetLength, originalFilename) {
  // Modify header: add variant info
  let header = originalHeader;

  // Add variant note after the first ---
  const dashIdx = header.indexOf('\n---\n');
  if (dashIdx >= 0) {
    const variantNote = `Variant: ${targetLength}-page retelling of ${originalFilename}`;
    header = header.slice(0, dashIdx) + `\n${variantNote}` + header.slice(dashIdx);
  }

  let out = header + '\n\n';
  for (const p of pages) {
    out += `--- Page ${p.pageNum} ---\n`;
    out += p.text + '\n\n';
    const dir = p.imageDir.replace(/^imageDirection:\s*/i, '').trim();
    out += `imageDirection: ${dir}\n\n`;
  }
  const counts = pages.map(p => p.wordCount);
  const total = counts.reduce((a, b) => a + b, 0);
  out += `WORD_COUNT: [${counts.join(', ')}] = ${total}`;
  return out;
}

/* ── page validator + targeted fix ─────────────────────── */
function getMinWords(pageNum, targetLength) {
  if (targetLength === 10) {
    return [7, 8].includes(pageNum) ? 22 : 18;
  } else {
    return [14, 15, 16, 17].includes(pageNum) ? 28 : 22;
  }
}

function findThinPages(pages, targetLength) {
  const thin = [];
  for (const p of pages) {
    const min = getMinWords(p.pageNum, targetLength);
    if (p.wordCount < min) {
      thin.push({ pageNum: p.pageNum, wordCount: p.wordCount, min });
    }
  }
  return thin;
}

async function fixThinPage(page, minWords, targetLength) {
  const targetWords = minWords + 10; // Ask for more to compensate overestimation
  const prompt = `Rewrite ONLY this single page of a Hebrew children's story.
It currently has ${page.wordCount} Hebrew words.
It must have at least ${targetWords} Hebrew words.

Keep the EXACT same plot event and emotional beat.
Keep {{childName}} and {{companionName}} exactly as-is.
Keep the same imageDirection (do not change it).

Expand with:
- sensory detail (what does the child hear, feel, smell?)
- body action (what does the child's body do?)
- companion reaction (what does the companion say or do?)
- one small environmental change

Do not add new plot events. Do not change what happens.

Current page text:
${page.text}

Return ONLY the rewritten Hebrew text (no imageDirection, no page header, no explanation).`;

  const reply = await callGPT(
    'You rewrite Hebrew children\'s story pages to be fuller and richer. Return ONLY Hebrew text.',
    prompt
  );

  // Clean reply — remove any markdown or headers GPT might add
  let cleaned = reply.trim()
    .replace(/^```[\s\S]*?```$/gm, '')
    .replace(/^---.*---$/gm, '')
    .replace(/^Page \d+.*$/gim, '')
    .replace(/^imageDirection:.*$/gim, '')
    .trim();

  // If GPT wrapped in backticks or added explanations, try to extract Hebrew
  if (!cleaned || countHebrewWords(cleaned) < page.wordCount) {
    return null; // Fix failed
  }

  return cleaned;
}

/* ── process one story ─────────────────────────────────── */
async function processStory(filePath, targetLength) {
  const filename = path.basename(filePath);
  const storyId = filename.replace('.md', '');
  const outName = `${storyId}_${targetLength}p.md`;
  const outPath = path.join(RAW, outName);

  // Skip if already exists
  if (fs.existsSync(outPath)) {
    const existing = fs.readFileSync(outPath, 'utf-8');
    const { pages } = parseStory(existing);
    if (pages.length === targetLength) {
      console.log(`  ✓ ${outName}: already exists (${pages.length} pages), skipping`);
      return { skipped: true, reason: 'exists' };
    }
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const { header, pages } = parseStory(content);

  if (pages.length !== 15) {
    console.log(`  ⚠ ${filename}: has ${pages.length} pages (not 15), skipping`);
    return { skipped: true, reason: `not 15 pages (${pages.length})` };
  }

  const meta = extractMetadata(header);

  if (DRY_RUN) {
    console.log(`  → ${filename} → ${outName} (${meta.title || 'untitled'})`);
    return { skipped: false, dryRun: true };
  }

  const systemPrompt = targetLength === 10 ? SYSTEM_10_PAGE : SYSTEM_20_PAGE;
  const userPrompt = buildUserPrompt(meta, pages, targetLength);

  console.log(`  → ${filename} → ${targetLength}p retelling...`);
  const reply = await callGPT(systemPrompt, userPrompt);

  const result = extractResult(reply, targetLength);

  if (result.issues.length > 0) {
    console.log(`    ⚠ Issues:`);
    for (const issue of result.issues) console.log(`      - ${issue}`);
  }

  if (result.pages.length < targetLength * 0.8) {
    console.log(`    ❌ Too few pages (${result.pages.length}/${targetLength}), skipping save`);
    // Save raw reply for debugging
    fs.writeFileSync(outPath.replace('.md', '_failed.txt'), reply, 'utf-8');
    return { skipped: true, reason: 'too few pages' };
  }

  // ── Validate + fix thin pages ──
  const MAX_FIX_ROUNDS = 2;
  let fixRound = 0;
  let thinPages = findThinPages(result.pages, targetLength);

  while (thinPages.length > 0 && fixRound < MAX_FIX_ROUNDS) {
    fixRound++;
    console.log(`    🔧 Fix round ${fixRound}: ${thinPages.length} thin pages [${thinPages.map(t => `P${t.pageNum}:${t.wordCount}w<${t.min}`).join(', ')}]`);

    for (const thin of thinPages) {
      const page = result.pages.find(p => p.pageNum === thin.pageNum);
      if (!page) continue;

      const fixed = await fixThinPage(page, thin.min, targetLength);
      if (fixed) {
        const newWc = countHebrewWords(fixed);
        if (newWc >= thin.min) {
          console.log(`      ✅ P${thin.pageNum}: ${thin.wordCount}w → ${newWc}w`);
          page.text = fixed;
          page.wordCount = newWc;
        } else {
          console.log(`      ⚠ P${thin.pageNum}: fix produced ${newWc}w (still below ${thin.min}), keeping original`);
        }
      } else {
        console.log(`      ⚠ P${thin.pageNum}: fix failed, keeping original`);
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    thinPages = findThinPages(result.pages, targetLength);
  }

  if (thinPages.length > 0) {
    console.log(`    ⚠ ${thinPages.length} pages still thin after ${MAX_FIX_ROUNDS} rounds`);
  }

  // Recalculate total
  result.total = result.pages.reduce((s, p) => s + p.wordCount, 0);

  // Build and save
  const output = buildOutputFile(header, meta, result.pages, targetLength, filename);
  fs.writeFileSync(outPath, output, 'utf-8');
  console.log(`    ✅ Saved ${outName} — ${result.pages.length} pages, ${result.total} words`);

  return { skipped: false, pages: result.pages.length, words: result.total, issues: result.issues.length };
}

/* ── main ──────────────────────────────────────────────── */
async function main() {
  console.log('📖 Generate Page-Length Variants');
  console.log('Model:', MODEL);
  if (DRY_RUN) console.log('Mode: DRY RUN');
  if (VERIFY_ONLY) console.log('Mode: VERIFY');
  if (ONLY_ID) console.log('Only:', ONLY_ID);
  if (ONLY_BATCH) console.log('Batch:', ONLY_BATCH);
  if (ONLY_LENGTH) console.log('Length:', ONLY_LENGTH);
  console.log('');

  // Collect 15-page story files (exclude prompts, backups, variants)
  const allFiles = fs.readdirSync(RAW)
    .filter(f =>
      f.endsWith('.md') &&
      !f.includes('_prompt') &&
      !f.includes('_backup') &&
      !f.includes('_pre-nikud') &&
      !f.includes('_10p') &&
      !f.includes('_20p') &&
      !f.includes('_failed') &&
      !f.startsWith('rewrite_')
    )
    .sort();

  let storyFiles = allFiles;

  if (ONLY_ID) {
    storyFiles = allFiles.filter(f => f.includes(`_${ONLY_ID}.md`));
  } else if (ONLY_BATCH) {
    storyFiles = allFiles.filter(f => f.startsWith(`batch-${ONLY_BATCH.padStart(2, '0')}`));
  }

  const lengths = ONLY_LENGTH ? [ONLY_LENGTH] : [10, 20];

  console.log(`Found ${storyFiles.length} base stories, generating ${lengths.join(' + ')}-page variants\n`);

  if (VERIFY_ONLY) {
    let existing = 0, missing = 0;
    for (const f of storyFiles) {
      const base = f.replace('.md', '');
      for (const len of lengths) {
        const variantPath = path.join(RAW, `${base}_${len}p.md`);
        if (fs.existsSync(variantPath)) {
          const { pages } = parseStory(fs.readFileSync(variantPath, 'utf-8'));
          const total = pages.reduce((s, p) => s + p.wordCount, 0);
          console.log(`  ✅ ${base}_${len}p.md — ${pages.length} pages, ${total}w`);
          existing++;
        } else {
          console.log(`  ❌ ${base}_${len}p.md — missing`);
          missing++;
        }
      }
    }
    console.log(`\nExisting: ${existing}, Missing: ${missing}`);
    return;
  }

  const stats = { processed: 0, skipped: 0, errors: 0 };
  const DELAY_MS = 3000; // Rate limit — these are big prompts

  for (const f of storyFiles) {
    const filePath = path.join(RAW, f);
    for (const len of lengths) {
      try {
        const result = await processStory(filePath, len);
        if (result.skipped) stats.skipped++;
        else stats.processed++;
      } catch (err) {
        console.error(`  ❌ ${f} → ${len}p: ${err.message}`);
        stats.errors++;
      }

      if (!DRY_RUN) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
  }

  console.log('\n═══ Summary ═══');
  console.log(`Generated: ${stats.processed}`);
  console.log(`Skipped:   ${stats.skipped}`);
  console.log(`Errors:    ${stats.errors}`);
  console.log(`\nTotal API calls: ${stats.processed} × ~$0.03 = ~$${(stats.processed * 0.03).toFixed(2)}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
