#!/usr/bin/env node
/**
 * Story Bank Generator v2 — GPT-5.3 Pro via Responses API
 *
 * Usage:
 *   node scripts/generate-stories-v2.mjs --batch 07
 *   node scripts/generate-stories-v2.mjs --batch 07 --story 19a
 *   node scripts/generate-stories-v2.mjs --batch all
 *   node scripts/generate-stories-v2.mjs --batch 07 --dry-run
 *   node scripts/generate-stories-v2.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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
const REASONING_EFFORT = process.env.STORY_REASONING_EFFORT || '';  // empty = no reasoning
const VERBOSITY = process.env.STORY_VERBOSITY || '';
const MAX_OUTPUT_TOKENS = 12000;

const MEGA_BRIEF = path.join(ROOT, 'briefs', 'batches-07-11-all-30-stories.md');
const PROMPT_TMPL = path.join(ROOT, 'story-bank', 'raw', 'batch-05_13a_prompt.md');
const OUT_DIR = path.join(ROOT, 'story-bank', 'raw');

const BATCH_META = {
  '07': { name: 'SIRENS', cat: 'SIRENS (קולות ואזעקות)',
    stories: ['19a','19b','20a','20b','21a','21b'],
    arch: { '19a':'connection','19b':'connection','20a':'adventure','20b':'adventure','21a':'courage','21b':'courage' } },
  '08': { name: 'GENERAL_FEARS', cat: 'GENERAL_FEARS (פחדים אחרים)',
    stories: ['22a','22b','23a','23b','24a','24b'],
    arch: { '22a':'connection','22b':'connection','23a':'adventure','23b':'adventure','24a':'courage','24b':'courage' } },
  '09': { name: 'CONFIDENCE', cat: 'CONFIDENCE (ביטחון וערך עצמי)',
    stories: ['25a','25b','26a','26b','27a','27b'],
    arch: { '25a':'connection','25b':'connection','26a':'adventure','26b':'adventure','27a':'courage','27b':'courage' } },
  '10': { name: 'SIBLING', cat: 'SIBLING (אח או אחות חדשים)',
    stories: ['28a','28b','29a','29b','30a','30b'],
    arch: { '28a':'connection','28b':'connection','29a':'adventure','29b':'adventure','30a':'courage','30b':'courage' } },
  '11': { name: 'FOCUS', cat: 'FOCUS (קשב, סקרנות ולמידה)',
    stories: ['31a','31b','32a','32b','33a','33b'],
    arch: { '31a':'connection','31b':'connection','32a':'adventure','32b':'adventure','33a':'courage','33b':'courage' } },
};

const ARCH_DESC = {
  connection: 'connection (intimate, warm, stays in familiar space. Companion comes TO the child.)',
  adventure: 'adventure (goes outside, multiple locations, physical challenges)',
  courage: 'courage (small brave act in magical-realist setting, reality transforms)',
};

function parseMegaBrief() {
  const content = fs.readFileSync(MEGA_BRIEF, 'utf-8');
  const stories = {};
  const re = /### Story (\d+[ab]) — (\w+)\n([\s\S]*?)(?=### Story \d+[ab]|^# BATCH|^---\s*$)/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    stories[m[1]] = { solutionType: m[2], body: m[3].trim() };
  }
  return stories;
}

function buildPrompt(storyId, batchId) {
  let prompt = fs.readFileSync(PROMPT_TMPL, 'utf-8');
  const meta = BATCH_META[batchId];
  if (!meta) throw new Error('Unknown batch: ' + batchId);
  const archKey = meta.arch[storyId];
  if (!archKey) throw new Error('Story ' + storyId + ' not in batch ' + batchId);
  const allStories = parseMegaBrief();
  const sd = allStories[storyId];
  if (!sd) throw new Error('Story ' + storyId + ' not in mega-brief');

  prompt = prompt.replace(/Generate \d+ complete stories?\./, 'Generate 1 complete story.');
  prompt = prompt.replace(/\*\*Category:\*\* .+/, '**Category:** ' + meta.cat);
  prompt = prompt.replace(/\*\*Archetype:\*\* .+/, '**Archetype:** ' + ARCH_DESC[archKey]);

  const aIdx = prompt.indexOf('## Story Assignments');
  const sIdx = prompt.indexOf('## Structure');
  if (aIdx !== -1 && sIdx !== -1) {
    prompt = prompt.substring(0, aIdx) +
      '## Story Assignments\n\n### Story 1\n' + sd.body + '\n\n---\n\n' +
      prompt.substring(sIdx);
  } else {
    prompt += '\n\n## Story Assignment\n\n### Story 1\n' + sd.body + '\n';
  }
  return prompt;
}

async function callAPI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const useResp = MODEL.includes('-pro') || !!REASONING_EFFORT;
  console.log('  [API] model=' + MODEL + ', reasoning=' + REASONING_EFFORT + ', responsesAPI=' + useResp);

  if (useResp) {
    const body = { model: MODEL, max_output_tokens: MAX_OUTPUT_TOKENS,
      input: [{ role: 'user', content: prompt }] };
    if (REASONING_EFFORT) body.reasoning = { effort: REASONING_EFFORT };
    body.text = { format: { type: 'text' } };

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 404 || err.includes('does not exist') || err.includes('not found'))
        throw new Error('STORY_MODEL=' + MODEL + ' is NOT available. Error: ' + err.slice(0, 300));
      throw new Error('OpenAI Responses ' + res.status + ': ' + err.slice(0, 500));
    }
    const data = await res.json();
    let text = data.output_text || '';
    if (!text) text = data.output?.find(o => o.type === 'message')?.content?.find(c => c.type === 'output_text')?.text || '';
    const u = data.usage || {};
    console.log('  [API] tokens: in=' + (u.input_tokens||0) + ' out=' + (u.output_tokens||0) +
      ' reasoning=' + (u.output_tokens_details?.reasoning_tokens||0));
    return { text, usage: u };
  } else {
    const body = { model: MODEL, messages: [{ role: 'user', content: prompt }] };
    if (MODEL.startsWith('gpt-5.')) body.max_completion_tokens = MAX_OUTPUT_TOKENS;
    else { body.max_tokens = MAX_OUTPUT_TOKENS; body.temperature = 0.85; }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('OpenAI Chat ' + res.status + ': ' + (await res.text()).slice(0, 500));
    const data = await res.json();
    console.log('  [API] tokens: ' + (data.usage?.total_tokens||0));
    return { text: data.choices[0].message.content, usage: data.usage };
  }
}

async function main() {
  const args = process.argv.slice(2);
  let batchArg = null, storyArg = null, dryRun = false, listMode = false, delayMs = 5000;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch') batchArg = args[++i];
    else if (args[i] === '--story') storyArg = args[++i];
    else if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--list') listMode = true;
    else if (args[i] === '--delay') delayMs = parseInt(args[++i], 10);
  }

  console.log('\nParsing mega-brief: ' + MEGA_BRIEF);
  const allStories = parseMegaBrief();
  console.log('Found ' + Object.keys(allStories).length + ' story assignments\n');

  if (listMode) {
    for (const [bid, meta] of Object.entries(BATCH_META)) {
      console.log('\n  Batch ' + bid + ' - ' + meta.name + ' (' + meta.cat + ')');
      for (const sid of meta.stories) {
        const ok = allStories[sid] ? 'Y' : 'N';
        const type = allStories[sid]?.solutionType || '???';
        const disk = fs.existsSync(path.join(OUT_DIR, 'batch-' + bid + '_' + sid + '.md')) ? ' [ON DISK]' : '';
        console.log('    [' + ok + '] ' + sid + ' - ' + type + disk);
      }
    }
    return;
  }

  if (!batchArg) { console.error('Usage: --batch <07-11|all> [--story id] [--dry-run]'); process.exit(1); }

  let queue = [];
  if (batchArg === 'all') {
    for (const [bid, meta] of Object.entries(BATCH_META))
      for (const sid of meta.stories) queue.push({ storyId: sid, batchId: bid });
  } else {
    const meta = BATCH_META[batchArg];
    if (!meta) { console.error('Unknown batch: ' + batchArg); process.exit(1); }
    if (storyArg) {
      for (const sid of storyArg.split(',')) {
        if (!meta.stories.includes(sid)) { console.error(sid + ' not in batch ' + batchArg); process.exit(1); }
        queue.push({ storyId: sid, batchId: batchArg });
      }
    } else {
      for (const sid of meta.stories) queue.push({ storyId: sid, batchId: batchArg });
    }
  }

  if (!storyArg) {
    const before = queue.length;
    queue = queue.filter(({ storyId, batchId }) => {
      const exists = fs.existsSync(path.join(OUT_DIR, 'batch-' + batchId + '_' + storyId + '.md'));
      if (exists) console.log('  Skip ' + storyId + ' (on disk)');
      return !exists;
    });
    if (before !== queue.length) console.log('  Skipped ' + (before - queue.length) + ' existing\n');
  }

  console.log('Generating ' + queue.length + ' stories with ' + MODEL + ' (reasoning=' + REASONING_EFFORT + ')\n');
  if (dryRun) console.log('  DRY RUN - no API calls\n');

  for (const { storyId } of queue) {
    if (!allStories[storyId]) { console.error('Story ' + storyId + ' not in brief!'); process.exit(1); }
  }

  let ok = 0, fail = 0;
  const t0 = Date.now();

  for (let i = 0; i < queue.length; i++) {
    const { storyId, batchId } = queue[i];
    const meta = BATCH_META[batchId];
    console.log('\n' + '='.repeat(60));
    console.log('  [' + (i+1) + '/' + queue.length + '] Story ' + storyId + ' - Batch ' + batchId + ' (' + meta.name + ')');
    console.log('  Solution: ' + allStories[storyId].solutionType);
    console.log('='.repeat(60));

    try {
      const prompt = buildPrompt(storyId, batchId);
      if (dryRun) {
        const pp = path.join(OUT_DIR, 'batch-' + batchId + '_' + storyId + '_prompt.md');
        fs.writeFileSync(pp, prompt, 'utf-8');
        console.log('  [DRY RUN] Prompt saved (' + prompt.length + ' chars)');
        ok++;
        continue;
      }
      const start = Date.now();
      const { text } = await callAPI(prompt);
      const secs = ((Date.now() - start) / 1000).toFixed(1);
      if (!text || text.length < 200) { console.error('  FAIL: too short (' + text.length + ' chars)'); fail++; continue; }
      console.log('  OK in ' + secs + 's (' + text.length + ' chars)');
      const pfx = 'batch-' + batchId + '_' + storyId;
      fs.writeFileSync(path.join(OUT_DIR, pfx + '_prompt.md'), prompt, 'utf-8');
      fs.writeFileSync(path.join(OUT_DIR, pfx + '.md'), text, 'utf-8');
      console.log('  Saved to ' + OUT_DIR);
      ok++;
      if (i < queue.length - 1) {
        console.log('  Waiting ' + (delayMs/1000) + 's...');
        await new Promise(r => setTimeout(r, delayMs));
      }
    } catch (err) {
      console.error('  FAIL: ' + err.message);
      fail++;
      if (err.message.includes('NOT available')) { console.error('\nModel unavailable - aborting.'); break; }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('  DONE: ' + ok + ' ok, ' + fail + ' fail, ' + ((Date.now()-t0)/1000/60).toFixed(1) + ' min');
  console.log('='.repeat(60) + '\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
