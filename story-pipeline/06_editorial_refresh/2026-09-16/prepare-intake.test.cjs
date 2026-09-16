'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canonicalCandidate, prepare, hash } = require('./prepare-intake.cjs');
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
