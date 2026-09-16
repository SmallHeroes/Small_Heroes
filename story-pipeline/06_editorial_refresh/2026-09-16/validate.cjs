'use strict';
// Offline editorial fixture validation only. No imports from runtime/providers,
// no network, no writes and no assertion of literary quality or product acceptance.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const companions = ['bunny_ometz', 'chameleon_koko', 'dragon_dini', 'fox_uri', 'lion_shaket', 'panda_anat'];
const directions = ['adventure', 'bedtime', 'fantasy'];
const expectedKeys = companions.flatMap(id => directions.map(d => `${id}_${d}`)).sort();
assert.deepEqual(inventory.sources.map(x => x.key).sort(), expectedKeys);
const report = fs.readFileSync(path.join(__dirname, 'READING_REPORT_HE.md'), 'utf8');
for (const row of inventory.sources) {
  const file = path.resolve(root, row.file);
  assert.ok(file.startsWith(root + path.sep), 'source_outside_repository');
  const bytes = fs.readFileSync(file);
  assert.equal(hash(bytes), row.sha256, `source_changed:${row.key}`);
  assert.equal(bytes.length, row.bytes, `source_size_changed:${row.key}`);
  assert.ok(report.includes(`. ${row.key} —`), `report_missing_slot:${row.key}`);
}

function validateManuscript(text, direction, companion = 'fox_uri') {
  const count = { bedtime: 8, adventure: 12, fantasy: 16 }[direction];
  assert.ok(text.startsWith('---\n'), 'frontmatter_missing');
  assert.match(text, /^status: editorial_draft$/m);
  assert.match(text, /^runtimeAuthority: none$/m);
  assert.match(text, new RegExp(`^companionId: ${companion}$`, 'm'));
  const categories = { bunny_ometz: 'MEDICAL_PROCEDURE', chameleon_koko: 'TRANSITION',
    dragon_dini: 'NEW_SIBLING', fox_uri: 'NIGHT_FEAR', lion_shaket: 'ANGER_FRUSTRATION', panda_anat: 'SOCIAL' };
  assert.match(text, new RegExp(`^category: ${categories[companion]}$`, 'm'));
  assert.match(text, /^gender: neutral$/m);
  assert.match(text, new RegExp(`^direction: ${direction}$`, 'm'));
  assert.match(text, new RegExp(`^pages: ${count}$`, 'm'));
  assert.doesNotMatch(text, /^imageDirection:/m, 'visual_authority_not_in_this_draft');
  const markers = [...text.matchAll(/^--- Page (\d+) ---$/gm)];
  assert.deepEqual(markers.map(x => Number(x[1])), Array.from({ length: count }, (_, i) => i + 1));
  const body = text.slice(markers[0].index);
  const visibleText = text.match(/^title:.*$/m)[0] + '\n' + body.replace(/^--- Page \d+ ---$/gm, '');
  assert.doesNotMatch(visibleText, /[\p{Dash_Punctuation}\u2212\u00ad]/u, 'authored_dash_in_story');
  assert.ok(text.match(/^title:.*$/m)[0].includes('{{childName}}'), 'title_requires_child_name');
  assert.doesNotMatch(text, /\p{L}\{\{childName\}\}|\{\{childName\}\}\p{L}/u, 'glued_child_placeholder');
  const allTokensResolved = text.replace(/\{\{childName\}\}/g, 'בר')
    .replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (_, boy) => boy);
  assert.doesNotMatch(allTokensResolved, /[{}|]|childName/, 'unresolved_placeholder_including_title');
  const chips = [...body.matchAll(/\{([^{}|]+)\|([^{}|]+)\}/g)];
  for (const chip of chips) {
    assert.notEqual(chip[1].trim(), chip[2].trim(), 'identical_gender_chip');
    assert.ok(chip[1].trim() && chip[2].trim(), 'empty_gender_chip');
  }
  const genders = ['boy', 'girl'].map((gender, index) => {
    const resolved = body.replace(/\{\{childName\}\}/g, index ? 'נועה' : 'בר')
      .replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (_, boy, girl) => index ? girl : boy);
    assert.doesNotMatch(resolved, /[{}|]|childName/, 'unresolved_placeholder');
    const pages = resolved.split(/^--- Page \d+ ---$/m).slice(1);
    const wordsPerPage = pages.map(s => s.trim().split(/\s+/u).length);
    assert.ok(wordsPerPage.every(n => n >= 25 && n <= 110), 'editorial_word_band');
    return { gender, words: wordsPerPage.reduce((a, b) => a + b, 0), wordsPerPage };
  });
  return { pages: count, genderChips: chips.length, genders };
}

const priorUri = JSON.parse(fs.readFileSync(path.join(__dirname, 'validation.json'), 'utf8')).candidates;
assert.deepEqual(priorUri.map(x => x.file).sort(), directions.map(d => `fox_uri_${d}.md`).sort());
const priorAll = JSON.parse(fs.readFileSync(path.join(__dirname, 'validation-all18.json'), 'utf8')).candidates;
const approval = JSON.parse(fs.readFileSync(path.join(__dirname, 'OWNER_APPROVAL.json'), 'utf8'));
assert.equal(approval.decision, 'approved');
assert.equal(approval.approvedBy, 'Guy');
assert.equal(approval.runtimeAuthority, 'none');
assert.deepEqual(approval.manuscripts.map(r => r.file).sort(), expectedKeys.map(k => k + '.md'));
for (const row of approval.manuscripts) {
  const before = priorAll.find(r => r.file === row.file);
  assert.equal(row.beforeSha256, before.sha256, 'approval_baseline_changed');
  assert.equal(row.beforeBytes, before.bytes, 'approval_baseline_size_changed');
}
const actualFiles = fs.readdirSync(__dirname).filter(f => companions.some(c => f.startsWith(c + '_')) && f.endsWith('.md')).sort();
assert.deepEqual(actualFiles, expectedKeys.map(k => k + '.md'), 'missing_or_extra_draft');
const candidates = companions.flatMap(companion => directions.map(direction => {
  const file = `${companion}_${direction}.md`;
  const bytes = fs.readFileSync(path.join(__dirname, file));
  const approved = approval.manuscripts.find(row => row.file === file);
  assert.equal(hash(bytes), approved.sha256, `approved_text_changed:${file}`);
  assert.equal(bytes.length, approved.bytes, `approved_size_changed:${file}`);
  if (companion === 'fox_uri') {
    const prior = priorUri.find(row => row.file === file);
    assert.equal(approved.beforeSha256, prior.sha256, `uri_pre_edit_identity:${file}`);
    assert.equal(approved.beforeBytes, prior.bytes, `uri_pre_edit_size:${file}`);
  }
  return { file, sha256: hash(bytes), bytes: bytes.length,
    ...validateManuscript(bytes.toString('utf8').replace(/\r\n/g, '\n'), direction, companion) };
}));
const specimen = fs.readFileSync(path.join(__dirname, 'fox_uri_bedtime.md'), 'utf8').replace(/\r\n/g, '\n');
const mutations = [
  s => s.replace('--- Page 8 ---', '--- Page 9 ---'),
  s => s.replace('status: editorial_draft', 'status: accepted'),
  s => s.replace('runtimeAuthority: none', 'runtimeAuthority: production'),
  s => s.replace('{{childName}}', '{{unknownChild}}'),
  s => s.replace(/\{([^{}|]+)\|([^{}|]+)\}/, '{הלך|הלך}'),
  s => s + '\nimageDirection: invented approved plan\n',
  s => s.replace('pages: 8', 'pages: 12'),
  s => s.replace('{{childName}}', 'הלך{{childName}}'),
  s => s.replace('companionId: fox_uri', 'companionId: dragon_dini'),
  s => s.replace('category: NIGHT_FEAR', 'category: SOCIAL'),
  ...['-', '־', '–', '—', '\u2212', '\u00ad'].map(dash => s => s + '\nאסור' + dash + 'כאן'),
  s => s.replace('title: "{{childName}}', 'title: "בר'),
];
for (const [index, mutation] of mutations.entries()) {
  assert.throws(() => validateManuscript(mutation(specimen), 'bedtime'), `mutation_not_rejected:${index}`);
}
const readingHeader = "# כל 18 הסיפורים: עותק קריאה\n\nהתוכן אושר בידי גיא, בכפוף להסרת מקפים והתאמה לפרמטרי הילד. נוסח זה כולל את תיקוני הפיסוק והפרסונליזציה. השם בר ונוסח הילד הם דוגמה לקריאה בלבד; כתבי היד הנפרדים שומרים שם משתנה ונוסח לילד ולילדה. הקבצים טרם פורסמו כמקורות פעילים בצינור. אין כאן תמונות או קריינות.\n\n";
const resolveReading = text => text.replace(/\r\n/g, '\n').replace(/\{\{childName\}\}/g, 'בר')
  .replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (_, boy) => boy);
const expectedReading = readingHeader + candidates.map((row, index) => {
  const text = resolveReading(fs.readFileSync(path.join(__dirname, row.file), 'utf8'));
  const title = text.match(/^title: "(.*)"$/m)[1];
  const body = text.slice(text.indexOf('--- Page 1 ---'))
    .replace(/^--- Page (\d+) ---$/gm, (_, n) => `### עמוד ${n}`).trim();
  return `## ${index + 1}. ${title}\n\n${body}\n\n`;
}).join('');
assert.equal(fs.readFileSync(path.join(__dirname, 'READ_ALL_HE.md'), 'utf8').replace(/\r\n/g, '\n').trimEnd(),
  expectedReading.trimEnd(), 'stale_reading_copy');

console.log(JSON.stringify({ status: 'offline_structure_and_preservation_checked',
  sourcesUnchanged: inventory.sources.length, reportSlots: expectedKeys.length,
  priorUriIdentitiesPreservedInApprovalBaseline: priorUri.length,
  ownerApprovedManuscriptsBound: approval.manuscripts.length,
  authoredDashCharacters: 0,
  readingCopyMatchesAllDrafts: true,
  completeDrafts: candidates.length, totalDraftPages: candidates.reduce((n, c) => n + c.pages, 0),
  rejectedNegativeControls: mutations.length, candidates, providerCalls: 0, writes: 0,
  productContentApprovedByGuy: true, runtimeBookAccepted: false, independentReview: 'not_performed',
  limits: ['Not the production bank validator', 'Chip expansion is not Hebrew grammar validation',
    'Not a read-aloud or child/parent test', 'No visual/narration/runtime readiness',
    'All eighteen have owner content approval, not runtime source publication',
    'Inherited categories do not establish clinical or category suitability'] }, null, 2));
