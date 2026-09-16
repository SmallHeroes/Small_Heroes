'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canonicalCandidate, prepare, hash } = require('./prepare-intake.cjs');
const { parseStoryMarkdown } = require('../../../lib/story-validators/parser.ts');
const { validateEditorialPassDraft } = require('../../../scripts/story-editorial-validation-contract.cjs');
const sources = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'))).sources;
const approvals = JSON.parse(fs.readFileSync(path.join(__dirname, 'OWNER_APPROVAL.json'))).manuscripts;
const source = sources[0];
const approved = approvals.find(a => a.file === source.key + '.md');
const raw = fs.readFileSync(path.join(__dirname, approved.file));
const changed = transform => {
  const bytes = Buffer.from(transform(raw.toString('utf8').replace(/\r\n/g, '\n')));
  return [bytes, { ...approved, sha256: hash(bytes), bytes: bytes.length }, source];
};

test('all18 candidates satisfy the real publication text boundary, not its review boundary', () => {
  const prepared = prepare();
  assert.equal(prepared.artifacts.length, 18);
  assert.equal(prepared.manifest.pageCount, 216);
  assert.equal(prepared.manifest.publicationReady, false);
  for (const artifact of prepared.artifacts) {
    assert.equal(artifact.descriptor.runtimeAuthority, 'none');
    assert.equal(artifact.descriptor.editorialReview, 'not_supplied');
    assert.equal(artifact.descriptor.artifactIndependentReview, 'not_supplied');
    assert.equal(artifact.descriptor.visualDirections, 'not_prepared');
  }
});
test('original staging metadata is rejected by the genuine publication validator', () => {
  assert.throws(() => validateEditorialPassDraft({ companionId: 'bunny_ometz', brief: {
    category: 'MEDICAL_PROCEDURE', direction: 'adventure', pageCount: 12 } },
  { text: raw.toString('utf8'), sha256: hash(raw) }, { sourceProfile: 'gender_flexible' }),
  /story_writer_revision_frontmatter_invalid/);
});
test('unapproved content byte change is rejected before conversion', () => {
  assert.throws(() => canonicalCandidate(Buffer.concat([raw, Buffer.from('x')]), approved, source),
    /approved_manuscript_drift/);
});
test('approval size mismatch is rejected even with a matching hash', () => {
  assert.throws(() => canonicalCandidate(raw, { ...approved, bytes: raw.length + 1 }, source),
    /approved_manuscript_size/);
});
test('a forged active staging flag cannot disappear through conversion', () => {
  assert.throws(() => canonicalCandidate(...changed(s => s.replace('runtimeAuthority: none',
    'runtimeAuthority: production'))), /staging_authority/);
});
test('an extra metadata field is rejected rather than silently stripped', () => {
  assert.throws(() => canonicalCandidate(...changed(s => s.replace('status: editorial_draft',
    'unknown: yes\nstatus: editorial_draft'))), /exact_staging_keys/);
});
test('another companion slot cannot borrow this approval mapping', () => {
  assert.throws(() => canonicalCandidate(...changed(s => s.replace('companionId: bunny_ometz',
    'companionId: fox_uri'))), /slot_identity/);
});
test('missing page is rejected', () => {
  assert.throws(() => canonicalCandidate(...changed(s => s.replace('--- Page 2 ---',
    'not a page marker'))), /slot_page_count/);
});
test('wrong declared gender is rejected by the genuine validator', () => {
  assert.throws(() => canonicalCandidate(...changed(s => s.replace('gender: neutral',
    'gender: female'))), /story_writer_revision_identity_mismatch/);
});
test('suffix-style gender chips are rejected by the genuine validator', () => {
  assert.throws(() => canonicalCandidate(...changed(s => s.replace('{הוציא|הוציאה}',
    'הוציא{ה|ו}'))), /story_writer_revision_gender_chips_invalid/);
});
test('CRLF and LF produce identical candidates while binding their own input bytes', () => {
  const lf = changed(s => s);
  const crlf = changed(s => s.replaceAll('\n', '\r\n'));
  assert.equal(canonicalCandidate(...lf).text, canonicalCandidate(...crlf).text);
});

// Synthetic approval descriptors exist only in memory to reach the direction
// boundary. They are NOT owner approvals and never change OWNER_APPROVAL.json.
test('injected nonempty image direction is rejected, not stripped', () => {
  const fixture = changed(s => s.replace('--- Page 1 ---',
    '--- Page 1 ---\nimageDirection: reuse the old prop board'));
  assert.equal(parseStoryMarkdown(fixture[0].toString('utf8')).pages[0].imageDirection,
    'reuse the old prop board', 'injection must not be a no-op');
  assert.throws(() => canonicalCandidate(...fixture), /no_reused_directions/);
});
test('empty image direction preserves next prose line and is not a false rejection', () => {
  const fixture = changed(s => s.replace('--- Page 1 ---',
    '--- Page 1 ---\nimageDirection:   '));
  const result = canonicalCandidate(...fixture);
  assert.deepEqual(parseStoryMarkdown(result.text).pages,
    parseStoryMarkdown(raw.toString('utf8')).pages);
});
test('a later nonempty direction cannot hide behind an empty first direction', () => {
  for (const injected of ['imageDirection: reuse the old prop board',
    'IMAGEDIRECTION:\treuse the old prop board',
    'imageDirection:   \nimageDirection: reuse the old prop board']) {
    const fixture = changed(s => s.replace('--- Page 1 ---',
      '--- Page 1 ---\nimageDirection:\n' + injected));
    // The shared parser exposes only the FIRST direction; this is the blind spot.
    assert.equal(parseStoryMarkdown(fixture[0].toString('utf8')).pages[0].imageDirection, '');
    assert.throws(() => canonicalCandidate(...fixture), /no_reused_directions/);
  }
});

test('indented nonempty directions are rejected even when the parser leaves them in prose', () => {
  for (const indent of ['  ', '\t', ' \t ', '\u00a0']) {
    for (const pageNumber of [1, 7]) {
      const marker = `--- Page ${pageNumber} ---`;
      const fixture = changed(s => s.replace(marker,
        `${marker}\nimageDirection:\n${indent}ImageDirection: hidden stale board`));
      const parsed = parseStoryMarkdown(fixture[0].toString('utf8')).pages[pageNumber - 1];
      assert.equal(parsed.imageDirection, '');
      assert.match(parsed.text, /ImageDirection: hidden stale board/);
      assert.throws(() => canonicalCandidate(...fixture), /no_reused_directions/);
    }
  }
});
test('empty indented first directions preserve prose, including next-line text', () => {
  for (const indent of ['  ', '\t', ' \t ', '\u00a0']) {
    const fixture = changed(s => s.replace('--- Page 1 ---',
      `--- Page 1 ---\n${indent}imageDirection: \t`));
    const result = canonicalCandidate(...fixture);
    assert.deepEqual(parseStoryMarkdown(result.text).pages,
      parseStoryMarkdown(raw.toString('utf8')).pages);
  }
});
test('ordinary prose mentioning imageDirection is accepted without modification', () => {
  const fixture = changed(s => s.replace('--- Page 1 ---',
    '--- Page 1 ---\nהכיתוב imageDirection: מופיע בתוך משפט.'));
  const result = canonicalCandidate(...fixture);
  assert.match(result.text, /הכיתוב imageDirection: מופיע בתוך משפט\./);
});
