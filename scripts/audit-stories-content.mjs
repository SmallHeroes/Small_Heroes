#!/usr/bin/env node
/**
 * audit-stories-content.mjs — Deterministic story-bank content audit.
 *
 * Scans every .md file in story-bank/v5-fixed-v2/ for issues codified in
 * docs/STORYBANK_RULES.md, EDITORIAL PRINCIPLES section. NO LLM calls.
 *
 * Checks performed:
 *   1. Companion name consistency  — canonical name from lib/companions.ts
 *      must appear at least 3x in the body
 *   2. Title uniqueness within a companion's 3-book series
 *   3. Behavior-modeling patterns — eye-rolling, mocking-mimicry,
 *      shout-at-helper, command-helper-to-leave, physical-silencing,
 *      throwing helper's possessions, grabbing helper's objects
 *   4. UTF-8 corruption (U+FFFD)
 *   5. Page-count vs direction consistency
 *   6. Clinical phrases (percentages, research language) per existing rules
 *
 * Output:
 *   - Markdown report to stdout (or --out=PATH file)
 *   - Exit code 0 if clean, 1 if any issues
 *
 * Usage:
 *   node scripts/audit-stories-content.mjs
 *   node scripts/audit-stories-content.mjs --out=audit-report.md
 *   node scripts/audit-stories-content.mjs --severity=high   # only blockers
 *   node scripts/audit-stories-content.mjs --json            # machine-readable
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const STORY_DIR = join(process.cwd(), 'story-bank', 'v5-fixed-v2');
const COMPANIONS_PATH = join(process.cwd(), 'lib', 'companions.ts');

const OUT_FLAG = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
const JSON_FLAG = process.argv.includes('--json');
const SEVERITY_FILTER = process.argv.find((a) => a.startsWith('--severity='))?.split('=')[1];

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

function stripNikud(s) {
  return s.replace(/[ְ-ׇֽֿׁׂׅׄ]/g, '');
}

function loadCanonicalCompanionNames() {
  const src = readFileSync(COMPANIONS_PATH, 'utf-8');
  const re = /id:\s*'([a-z0-9_]+)'\s*,\s*\n\s*name:\s*'([^']+)'/g;
  const map = {};
  let m;
  while ((m = re.exec(src)) !== null) {
    const id = m[1];
    // Take the LAST word of the canonical name (e.g., 'הנמלה טִיטִי' → 'טִיטִי')
    const fullName = m[2];
    const lastWord = fullName.trim().split(/\s+/).pop();
    map[id] = { fullName, firstName: lastWord, firstNameBare: stripNikud(lastWord) };
  }
  return map;
}

function readStory(filename) {
  const filepath = join(STORY_DIR, filename);
  const content = readFileSync(filepath, 'utf-8');
  const yamlMatch = content.match(/^---\s*[\s\S]*?---\s*\n([\s\S]*)/);
  const body = yamlMatch ? yamlMatch[1] : content;
  // Extract YAML key=value pairs
  const yaml = {};
  for (const line of content.split('\n')) {
    const km = line.match(/^([a-zA-Z]+):\s*(.+)$/);
    if (km) yaml[km[1]] = km[2].replace(/^["']|["']$/g, '').trim();
  }
  return { filename, content, body, yaml };
}

// ───────────────────────────────────────────────────────────────────
// Issue patterns
// ───────────────────────────────────────────────────────────────────

const BEHAVIOR_PATTERNS = [
  { id: 'eye_rolling', severity: 'high',
    re: /מגלגל[תה]?\s+עיניים|גלגל[ית]?\s+עיניים/,
    msg: 'eye-rolling at helper (models passive disrespect)' },
  { id: 'mocking_mimicry', severity: 'high',
    re: /מחקה את ה?(ידיים|תנועות|קול|דיבור)|מחקה\s+(אותו|אותה)/,
    msg: 'mocking/mimicry of helper' },
  { id: 'shout_stop_at_helper', severity: 'high',
    re: /"\s*תפסיק[י]?[!.]/,
    msg: '"תפסיק!" shouted at helper (use self-statement "אני לא יכול יותר")' },
  { id: 'command_move', severity: 'medium',
    re: /"\s*תזוּז[יה]?!|"\s*לך[!.]\s*"/,
    msg: 'commanding the helper to move or leave' },
  { id: 'dismissive_shrug', severity: 'medium',
    re: /מרים\s+את\s+הכתפיים|מרימה\s+את\s+הכתפיים/,
    msg: 'dismissive shrug at helper' },
  { id: 'wave_aside', severity: 'medium',
    re: /מנופף[ת]?\s+הצידה|מנופף[ת]?\s+הצדה|דוחפ[הת]?\s+אות[הו]\s+הצידה/,
    msg: 'waving/pushing helper aside' },
  { id: 'hand_on_mouth', severity: 'critical',
    re: /שׂם[הת]?\s+יד\s+על\s+ה?פה\s+של/,
    msg: 'hand on helper\'s mouth (physical silencing)' },
  { id: 'cover_helper_ears', severity: 'critical',
    re: /(שׂם[הת]?|מכסה|מכסים)\s+ה?ידיים?\s+על\s+ה?אוזניים?\s+של\s+(לולי|לִילִי|אורי|רכי|רוקי|דודי|רופי)/,
    msg: 'covering helper\'s ears to silence them' },
  { id: 'throw_aside', severity: 'medium',
    re: /זורק[ת]?\s+אות[הו]\s+הצידה|זרק[הת]?\s+אות[הו]\s+על/,
    msg: 'throwing helper\'s possession aside' },
  { id: 'grab_from_helper', severity: 'medium',
    re: /לוקח[ת]?\s+(את\s+)?ה[א-ת]+\s+מהיד\s+של|מושך[ת]?\s+(את\s+)?ה[א-ת]+\s+מ(ה?ידיים|החזה|הכתף)\s+של/,
    msg: 'grabbing item from helper' },
  { id: 'blame_helper', severity: 'medium',
    // Match direct criticism addressed to helper, not generic "זה לא עוזר" which a
    // companion can legitimately say about their own situation.
    re: /"את\s+לא\s+(מראה|עוזרת|מבינה)|"אתה\s+לא\s+(מראה|עוזר|מבין)|"זה\s+לא\s+עוזר[!.,]\s*"\s+(אומר|אומרת)\s+ה?(ילד|ילדה)/,
    msg: 'child criticizing helper directly (use self-statement: "אני עדיין לא רואה" / "אני מתבלבל")' },
];

const CLINICAL_PATTERNS = [
  { id: 'percent', severity: 'critical',
    re: /\d+\s*%|אחוזים|תשעים\s+ו?חמש[ה]?|כמעט\s+כולם|רוב\s+ה(ילדים|אנשים|בני\s+אדם)/,
    msg: 'percentage / population claim (forbidden in children\'s story)' },
  { id: 'research_lang', severity: 'critical',
    re: /מחקרים?\s+(מראים|מראה|מוכיחים)|מומחים\s+(אומרים|טוענים)|המדע\s+אומר/,
    msg: 'research/study language' },
  { id: 'precise_measurement', severity: 'high',
    re: /בדיוק\s+\d+\s+(דקות|שעות|שבועות)|\d+\s+סנטימטרים/,
    msg: 'precise measurement-as-fact in dialogue' },
  { id: 'lecturing', severity: 'high',
    re: /זה לימד אותו|המוסר השכל|וככה למדנו|זה נקרא [^"]+/,
    msg: 'lecturing / explaining the lesson' },
  { id: 'biological_term', severity: 'critical',
    re: /תאי\s+דם|מערכת\s+חיסונית|תהליך\s+ביולוגי|בקטריות|מולקול[הת]/,
    msg: 'biological/medical jargon' },
];

// ───────────────────────────────────────────────────────────────────
// Audit
// ───────────────────────────────────────────────────────────────────

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function auditOneStory(story, companions) {
  const issues = [];
  const cid = story.yaml.companionId;
  const direction = story.yaml.direction;

  // 1. Companion name consistency
  if (cid && companions[cid]) {
    const expected = companions[cid].firstNameBare;
    const bareBody = stripNikud(story.body);
    const nameRe = new RegExp(`(?<![\\u05D0-\\u05EA])${expected}(?![\\u05D0-\\u05EA])`, 'g');
    const count = (bareBody.match(nameRe) || []).length;
    // Skip if file uses {{companionName}} templates
    const hasTemplate = /\{\{companionName\}\}/.test(story.content);
    if (count < 3 && !hasTemplate) {
      issues.push({
        id: 'missing_canonical_name',
        severity: 'high',
        msg: `canonical name "${expected}" appears ${count}× (target ≥3, OR use {{companionName}} placeholders)`,
      });
    }
  }

  // 2. Page count vs direction
  const expectedPages = { bedtime: 10, adventure: 15, fantasy: 20 }[direction];
  const declaredPages = parseInt(story.yaml.pages, 10);
  const actualPages = (story.content.match(/--- Page \d+ ---/g) || []).length;
  if (expectedPages && actualPages !== expectedPages) {
    issues.push({
      id: 'page_count_mismatch',
      severity: 'critical',
      msg: `direction=${direction} expects ${expectedPages} pages, file has ${actualPages}`,
    });
  }

  // 3. UTF-8 corruption
  if (story.content.includes('�')) {
    const idx = story.content.indexOf('�');
    const ctx = story.content.slice(Math.max(0, idx - 20), idx + 20).replace(/\n/g, ' ');
    issues.push({
      id: 'utf8_corruption',
      severity: 'critical',
      msg: `U+FFFD found: ...${ctx}...`,
    });
  }

  // 4. Behavior-modeling patterns
  for (const pat of BEHAVIOR_PATTERNS) {
    const matches = [...story.body.matchAll(new RegExp(pat.re.source, 'g' + (pat.re.flags || '')))];
    for (const m of matches) {
      const preceding = story.body.slice(0, m.index);
      const pageMatches = [...preceding.matchAll(/--- Page (\d+) ---/g)];
      const page = pageMatches.length > 0 ? pageMatches[pageMatches.length - 1][1] : '?';
      issues.push({
        id: pat.id,
        severity: pat.severity,
        msg: `p${page}: ${pat.msg}`,
        match: m[0],
      });
    }
  }

  // 5. Clinical patterns
  for (const pat of CLINICAL_PATTERNS) {
    const matches = [...story.body.matchAll(new RegExp(pat.re.source, 'g' + (pat.re.flags || '')))];
    for (const m of matches) {
      const preceding = story.body.slice(0, m.index);
      const pageMatches = [...preceding.matchAll(/--- Page (\d+) ---/g)];
      const page = pageMatches.length > 0 ? pageMatches[pageMatches.length - 1][1] : '?';
      issues.push({
        id: pat.id,
        severity: pat.severity,
        msg: `p${page}: ${pat.msg}`,
        match: m[0],
      });
    }
  }

  return issues;
}

function checkTitleUniqueness(stories) {
  // Group by companionId, check that the 3 directions have distinct titles
  const byCompanion = {};
  for (const s of stories) {
    const cid = s.yaml.companionId;
    if (!cid) continue;
    byCompanion[cid] = byCompanion[cid] || [];
    byCompanion[cid].push({ direction: s.yaml.direction, title: s.yaml.title, file: s.filename });
  }
  const duplicates = [];
  for (const [cid, books] of Object.entries(byCompanion)) {
    const titles = books.map((b) => b.title);
    const seen = new Set();
    for (const b of books) {
      if (seen.has(b.title)) {
        duplicates.push({ companionId: cid, ...b });
      }
      seen.add(b.title);
    }
  }
  return duplicates;
}

// ───────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────

const companions = loadCanonicalCompanionNames();
const files = readdirSync(STORY_DIR)
  .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .sort();

const stories = files.map(readStory);

let allIssues = [];
for (const story of stories) {
  const issues = auditOneStory(story, companions);
  for (const issue of issues) {
    allIssues.push({ file: story.filename, ...issue });
  }
}

const titleDupes = checkTitleUniqueness(stories);
for (const d of titleDupes) {
  allIssues.push({
    file: d.file,
    id: 'duplicate_title',
    severity: 'medium',
    msg: `title "${d.title}" duplicated across this companion's ${d.direction} book — each of the 3 books must have a unique title`,
  });
}

// Filter by severity if requested
if (SEVERITY_FILTER) {
  const minRank = SEVERITY_RANK[SEVERITY_FILTER];
  allIssues = allIssues.filter((i) => SEVERITY_RANK[i.severity] <= minRank);
}

// Sort: severity asc, then file
allIssues.sort((a, b) => {
  const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  return r !== 0 ? r : a.file.localeCompare(b.file);
});

// ───────────────────────────────────────────────────────────────────
// Output
// ───────────────────────────────────────────────────────────────────

if (JSON_FLAG) {
  const output = JSON.stringify(
    { totalFiles: stories.length, totalIssues: allIssues.length, issues: allIssues },
    null, 2
  );
  if (OUT_FLAG) writeFileSync(OUT_FLAG, output);
  else process.stdout.write(output + '\n');
  process.exit(allIssues.length > 0 ? 1 : 0);
}

// Markdown report
const lines = [];
lines.push(`# Story Bank Content Audit`);
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Stories scanned: **${stories.length}**`);
lines.push(`Issues found: **${allIssues.length}**`);
lines.push('');

const bySeverity = { critical: [], high: [], medium: [], low: [] };
for (const i of allIssues) bySeverity[i.severity].push(i);

for (const sev of ['critical', 'high', 'medium', 'low']) {
  const list = bySeverity[sev];
  if (list.length === 0) continue;
  lines.push(`## ${sev.toUpperCase()} (${list.length})`);
  lines.push('');
  let prevFile = null;
  for (const i of list) {
    if (i.file !== prevFile) {
      lines.push(`### ${i.file}`);
      prevFile = i.file;
    }
    const matchStr = i.match ? ` — match: \`${i.match}\`` : '';
    lines.push(`- \`${i.id}\` ${i.msg}${matchStr}`);
  }
  lines.push('');
}

if (allIssues.length === 0) {
  lines.push('✅ No issues found.');
}

const output = lines.join('\n');
if (OUT_FLAG) {
  writeFileSync(OUT_FLAG, output);
  console.log(`Report written to ${OUT_FLAG}`);
} else {
  process.stdout.write(output);
}

process.exit(allIssues.length > 0 ? 1 : 0);
