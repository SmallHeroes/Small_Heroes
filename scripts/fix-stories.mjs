#!/usr/bin/env node
/**
 * Story Fixer — Surgical page-level fixes via GPT API
 * 
 * Usage:
 *   node scripts/fix-stories.mjs --all            # fix all stories with issues
 *   node scripts/fix-stories.mjs --story 29b       # fix specific story
 *   node scripts/fix-stories.mjs --dry-run --all   # show what would be fixed
 *   node scripts/fix-stories.mjs --recount-only    # just fix WORD_COUNT lines
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
const OUT_DIR = path.join(ROOT, 'story-bank', 'raw');

// ── Hebrew word counter ──
// Counts space-separated tokens containing at least one Hebrew letter
function countHebrewWords(text) {
  const lines = text.split('\n').filter(l => !l.trim().startsWith('imageDirection:'));
  const joined = lines.join(' ')
    .replace(/{{[^}]+}}/g, 'מילה')
    .replace(/\s+/g, ' ')
    .trim();
  if (!joined) return 0;
  return joined.split(' ').filter(t => /[֐-׿]/.test(t) || /[a-zA-Z0-9]/.test(t)).length;
}

// ── Parse story file ──
function parseStory(content) {
  // Header = everything before first page
  const firstPage = content.match(/--- Page 1 ---/);
  const header = firstPage ? content.substring(0, firstPage.index).trim() : '';
  
  const pages = [];
  // Flexible regex: allows trailing whitespace after ---
  const pageRegex = /--- Page (\d+) ---\s*\n([\s\S]*?)(?=--- Page \d+ ---|\nWORD_COUNT:|$)/g;
  let m;
  while ((m = pageRegex.exec(content)) !== null) {
    const pageNum = parseInt(m[1]);
    const body = m[2].trim();
    
    // Split text from imageDirection
    const imgMatch = body.match(/\nimageDirection:\s*/);
    let text, imageDir;
    if (imgMatch) {
      text = body.substring(0, imgMatch.index).trim();
      imageDir = body.substring(imgMatch.index).trim();
    } else if (body.startsWith('imageDirection:')) {
      text = '';
      imageDir = body;
    } else {
      text = body;
      imageDir = '';
    }
    
    // Clean trailing --- separators from text
    text = text.replace(/\n---\s*$/g, '').trim();
    // Clean trailing --- from imageDir
    imageDir = imageDir.replace(/\n---\s*$/g, '').trim();
    
    pages.push({ pageNum, text, imageDir, wordCount: countHebrewWords(text) });
  }
  return { header, pages };
}

// ── Rebuild story file ──
function rebuildStory(header, pages) {
  let out = header + '\n\n';
  for (const p of pages) {
    out += '--- Page ' + p.pageNum + ' ---\n';
    out += p.text + '\n\n';
    if (p.imageDir) out += p.imageDir + '\n\n';
  }
  const counts = pages.map(p => p.wordCount);
  const total = counts.reduce((a, b) => a + b, 0);
  out += 'WORD_COUNT: [' + counts.join(', ') + '] = ' + total;
  return out;
}

// ── Diagnose issues (calibrated for real Hebrew counting) ──
// GPT overcounts Hebrew by ~30%. Real thresholds:
//   Floor: 20 real words (≈ GPT's 28-30)
//   Climax min: 28 real words (≈ GPT's 40)
//   Overweight total: 550+ real words (≈ GPT's 750+)
//   Thin total: <380 real words (≈ GPT's 520)
function diagnose(pages) {
  const issues = [];
  const total = pages.reduce((s, p) => s + p.wordCount, 0);
  
  for (const p of pages) {
    if (p.wordCount < 20) {
      issues.push({ page: p.pageNum, type: 'FLOOR', current: p.wordCount, target: '25-32' });
    }
    if (p.pageNum >= 11 && p.pageNum <= 13 && p.wordCount < 28) {
      issues.push({ page: p.pageNum, type: 'CLIMAX_THIN', current: p.wordCount, target: '32-38' });
    }
  }
  
  if (total > 550) {
    const trimmable = pages
      .filter(p => p.wordCount > 38 && (p.pageNum < 11 || p.pageNum > 13))
      .sort((a, b) => b.wordCount - a.wordCount);
    for (const p of trimmable.slice(0, 4)) {
      issues.push({ page: p.pageNum, type: 'OVERWEIGHT', current: p.wordCount, target: '30-36' });
    }
  }
  
  if (total < 380) {
    // Story is genuinely thin — flag thin non-floor pages for padding
    const paddable = pages
      .filter(p => p.wordCount < 25 && p.wordCount >= 20)
      .sort((a, b) => a.wordCount - b.wordCount);
    for (const p of paddable.slice(0, 5)) {
      issues.push({ page: p.pageNum, type: 'THIN_STORY', current: p.wordCount, target: '28-33' });
    }
  }
  
  return issues;
}

// ── Call GPT to fix pages ──
async function fixPages(pages, issues) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  
  const pageIssues = {};
  for (const iss of issues) {
    if (!pageIssues[iss.page]) pageIssues[iss.page] = [];
    pageIssues[iss.page].push(iss);
  }
  
  const pagesToFix = Object.keys(pageIssues).map(Number).sort((a, b) => a - b);
  
  let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). תקן עמודים ספציפיים בסיפור.

## כללים:
- שמור על הסגנון, הטון, המטאפורה, והעלילה המקוריים
- שמור על {{childName}} ו-{{companionName}} בדיוק כמו שהם
- אל תשנה imageDirection
- כשמרפד: הוסף פרטים חושיים (צליל, מרקם, ריח, תנועה, דיאלוג קצר)
- כשמקצר: הורד חזרה מיותרת, לא אקשן ולא רגש
- שפה פשוטה, משפטים קצרים, בלי מילים גבוהות

## הסיפור המלא (הקשר):
`;
  
  for (const p of pages) {
    prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + ' מילים]\n' + p.text + '\n';
  }
  
  prompt += '\n\n## תקן את העמודים הבאים:\n';
  
  for (const pn of pagesToFix) {
    const p = pages.find(pg => pg.pageNum === pn);
    const iss = pageIssues[pn];
    prompt += '\n### עמוד ' + pn + ' (' + p.wordCount + ' מילים כרגע)\n';
    for (const i of iss) {
      if (i.type === 'FLOOR' || i.type === 'THIN_STORY') {
        prompt += '- רפד ל-' + i.target + ' מילים. הוסף פרט חושי או תגובה של הדמות.\n';
      } else if (i.type === 'CLIMAX_THIN') {
        prompt += '- זה עמוד שיא! חזק ל-' + i.target + ' מילים עם אקשן פיזי ורגש חזק.\n';
      } else if (i.type === 'OVERWEIGHT') {
        prompt += '- קצר ל-' + i.target + ' מילים. הורד חזרה מיותרת.\n';
      }
    }
    prompt += 'טקסט נוכחי:\n' + p.text + '\n';
  }
  
  prompt += `\n## פורמט תשובה — בדיוק ככה:

--- Page X ---
[טקסט מתוקן בלבד, בלי imageDirection, בלי הסברים]

--- Page Y ---
[טקסט מתוקן]`;

  console.log('  [API] Fixing pages ' + pagesToFix.join(',') + ' (' + MODEL + ')');
  
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
  };
  if (MODEL.startsWith('gpt-5.')) {
    body.max_completion_tokens = 4000;
  } else {
    body.max_tokens = 4000;
    body.temperature = 0.7;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + (await res.text()).slice(0, 300));
  const data = await res.json();
  const reply = data.choices[0].message.content;
  console.log('  [API] tokens: ' + (data.usage?.total_tokens || 0));
  
  const fixedPages = {};
  const fixRegex = /--- Page (\d+) ---\s*\n([\s\S]*?)(?=\n--- Page \d+ ---|$)/g;
  let fm;
  while ((fm = fixRegex.exec(reply)) !== null) {
    fixedPages[parseInt(fm[1])] = fm[2].trim();
  }
  
  return fixedPages;
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  let targetStory = null, dryRun = false, recountOnly = false, fixAll = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--story') targetStory = args[++i];
    else if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--recount-only') recountOnly = true;
    else if (args[i] === '--all') fixAll = true;
  }
  
  if (!targetStory && !fixAll && !recountOnly) {
    console.error('Usage: --all | --story <id,...> | --recount-only [--dry-run]');
    process.exit(1);
  }
  
  const files = fs.readdirSync(OUT_DIR)
    .filter(f => f.match(/^batch-\d+_\d+[ab]\.md$/) && !f.includes('_prompt'))
    .sort();
  
  // Filter to batches 07-11
  let targets = files
    .map(f => {
      const m = f.match(/batch-(\d+)_(\d+[ab])\.md/);
      return { file: f, batchId: m[1], storyId: m[2], path: path.join(OUT_DIR, f) };
    })
    .filter(t => parseInt(t.batchId) >= 7);
  
  if (targetStory) {
    const ids = targetStory.split(',');
    targets = targets.filter(t => ids.includes(t.storyId));
  }
  
  console.log('Processing ' + targets.length + ' stories...\n');
  
  let fixed = 0, skipped = 0, errors = 0, apiCalls = 0;
  
  for (const t of targets) {
    const content = fs.readFileSync(t.path, 'utf-8');
    const { header, pages } = parseStory(content);
    
    if (pages.length !== 15) {
      console.log('  ERROR: ' + t.storyId + ' — ' + pages.length + '/15 pages parsed');
      errors++;
      continue;
    }
    
    const total = pages.reduce((s, p) => s + p.wordCount, 0);
    
    // Check if WORD_COUNT line needs fixing
    const oldWC = content.match(/WORD_COUNT:.*/)?.[0] || '';
    const wcBroken = oldWC.includes('Fifty') || oldWC.includes('Forty') || 
                     oldWC.includes('TOTAL') || oldWC.includes('approx') ||
                     oldWC === '';
    
    if (recountOnly) {
      const rebuilt = rebuildStory(header, pages);
      if (rebuilt !== content) {
        console.log(t.storyId + ': recount ' + total + ' words' + (wcBroken ? ' (FORMAT FIX)' : ''));
        if (!dryRun) fs.writeFileSync(t.path, rebuilt, 'utf-8');
        fixed++;
      } else {
        skipped++;
      }
      continue;
    }
    
    const issues = diagnose(pages);
    
    if (issues.length === 0) {
      // Still recount if format broken
      if (wcBroken) {
        console.log(t.storyId + ': format fix only (' + total + ' words)');
        if (!dryRun) {
          const rebuilt = rebuildStory(header, pages);
          fs.writeFileSync(t.path, rebuilt, 'utf-8');
        }
        fixed++;
      } else {
        skipped++;
      }
      continue;
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('  ' + t.storyId + ' (batch ' + t.batchId + ') — ' + total + ' real words');
    for (const iss of issues) {
      console.log('  P' + iss.page + ': ' + iss.type + ' (' + iss.current + ' → ' + iss.target + ')');
    }
    
    if (dryRun) {
      console.log('  [DRY RUN] ' + issues.length + ' issues');
      fixed++;
      continue;
    }
    
    try {
      // Backup
      const backupPath = t.path.replace('.md', '_backup.md');
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(t.path, backupPath);
        console.log('  Backup saved');
      }
      
      const fixedPages = await fixPages(pages, issues);
      apiCalls++;
      const fixedCount = Object.keys(fixedPages).length;
      
      if (fixedCount === 0) {
        console.log('  WARNING: API returned 0 fixed pages');
        errors++;
        continue;
      }
      
      // Apply fixes
      for (const [pn, newText] of Object.entries(fixedPages)) {
        const idx = pages.findIndex(p => p.pageNum === parseInt(pn));
        if (idx !== -1) {
          const oldWC = pages[idx].wordCount;
          pages[idx].text = newText;
          pages[idx].wordCount = countHebrewWords(newText);
          console.log('  P' + pn + ': ' + oldWC + ' → ' + pages[idx].wordCount + ' words');
        }
      }
      
      const rebuilt = rebuildStory(header, pages);
      fs.writeFileSync(t.path, rebuilt, 'utf-8');
      
      const newTotal = pages.reduce((s, p) => s + p.wordCount, 0);
      console.log('  SAVED (' + total + ' → ' + newTotal + ' total words)');
      fixed++;
      
      // Rate limit between API calls
      if (apiCalls > 0) {
        console.log('  Waiting 2s...');
        await new Promise(r => setTimeout(r, 2000));
      }
      
    } catch (err) {
      console.error('  ERROR: ' + err.message);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('  DONE: ' + fixed + ' fixed, ' + skipped + ' clean, ' + errors + ' errors');
  console.log('  API calls: ' + apiCalls);
  console.log('='.repeat(50));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
