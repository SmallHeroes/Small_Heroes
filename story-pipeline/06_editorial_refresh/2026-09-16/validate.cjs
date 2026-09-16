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

function validateManuscript(text, direction) {
  const count = { bedtime: 8, adventure: 12, fantasy: 16 }[direction];
  assert.ok(text.startsWith('---\n'), 'frontmatter_missing');
  assert.match(text, /^status: editorial_draft$/m);
  assert.match(text, /^runtimeAuthority: none$/m);
  assert.match(text, /^companionId: fox_uri$/m);
  assert.match(text, /^gender: neutral$/m);
  assert.match(text, new RegExp(`^direction: ${direction}$`, 'm'));
  assert.match(text, new RegExp(`^pages: ${count}$`, 'm'));
  assert.doesNotMatch(text, /^imageDirection:/m, 'visual_authority_not_in_this_draft');
  const markers = [...text.matchAll(/^--- Page (\d+) ---$/gm)];
  assert.deepEqual(markers.map(x => Number(x[1])), Array.from({ length: count }, (_, i) => i + 1));
  const body = text.slice(markers[0].index);
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

const candidates = directions.map(direction => {
  const file = `fox_uri_${direction}.md`;
  const bytes = fs.readFileSync(path.join(__dirname, file));
  return { file, sha256: hash(bytes), bytes: bytes.length,
    ...validateManuscript(bytes.toString('utf8').replace(/\r\n/g, '\n'), direction) };
});
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
];
for (const [index, mutation] of mutations.entries()) {
  assert.throws(() => validateManuscript(mutation(specimen), 'bedtime'), `mutation_not_rejected:${index}`);
}
console.log(JSON.stringify({ status: 'offline_structure_and_preservation_checked',
  sourcesUnchanged: inventory.sources.length, reportSlots: expectedKeys.length,
  completeDrafts: candidates.length, totalDraftPages: candidates.reduce((n, c) => n + c.pages, 0),
  rejectedNegativeControls: mutations.length, candidates, providerCalls: 0, writes: 0,
  productAccepted: false, independentReview: 'not_performed',
  limits: ['Not the production bank validator', 'Chip expansion is not Hebrew grammar validation',
    'Not a read-aloud or child/parent test', 'No visual/narration/runtime readiness',
    'Fifteen other manuscripts are diagnosed but not rewritten'] }, null, 2));
