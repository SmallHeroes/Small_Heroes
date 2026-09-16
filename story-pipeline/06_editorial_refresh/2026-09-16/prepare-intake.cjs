'use strict';
// Read-only corpus preparation. Emits candidate data, never writes or publishes.
require('tsx/cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseStoryMarkdown } = require('../../../lib/story-validators/parser.ts');
const { validateEditorialPassDraft } = require('../../../scripts/story-editorial-validation-contract.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const repoRoot = path.resolve(__dirname, '../../..');
const relativeRoot = path.relative(repoRoot, __dirname).replaceAll('\\', '/');
const canonicalKeys = ['title', 'companionId', 'direction', 'category', 'pages', 'gender', 'endingType'];

function canonicalCandidate(bytes, approved, source) {
  assert.equal(hash(bytes), approved.sha256, 'approved_manuscript_drift');
  assert.equal(bytes.length, approved.bytes, 'approved_manuscript_size');
  const text = bytes.toString('utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  assert.equal(lines[0], '---', 'frontmatter_open');
  const end = lines.indexOf('---', 1);
  assert.ok(end > 0, 'frontmatter_close');
  const header = lines.slice(1, end);
  assert.deepEqual(header.map(line => line.split(':')[0]),
    [...canonicalKeys, 'status', 'runtimeAuthority'], 'exact_staging_keys');
  assert.equal(header.at(-2), 'status: editorial_draft', 'staging_status');
  assert.equal(header.at(-1), 'runtimeAuthority: none', 'staging_authority');
  const candidate = ['---', ...header.slice(0, -2), ...lines.slice(end)].join('\n');
  const before = parseStoryMarkdown(text);
  const after = parseStoryMarkdown(candidate);
  const { status, runtimeAuthority, ...identity } = before.frontmatter;
  assert.deepEqual(after.frontmatter, identity, 'identity_preservation');
  assert.deepEqual(after.pages, before.pages, 'page_preservation');
  assert.equal(before.frontmatter.companionId + '_' + before.frontmatter.direction,
    source.key, 'slot_identity');
  assert.equal(before.pages.length, source.pages, 'slot_page_count');
  assert.equal(Number(before.frontmatter.pages), source.pages, 'declared_page_count');
  // The shared parser exposes only the FIRST direction in each page. Inspect
  // every raw direction line too: an empty first value must not hide a later one.
  const directionLines = [...candidate.matchAll(/^imageDirection:([^\n]*)$/gim)];
  assert.ok(directionLines.every(match => match[1].trim() === ''), 'no_reused_directions');
  assert.ok(after.pages.every(page => page.imageDirection === ''), 'no_reused_directions');
  const record = { companionId: after.frontmatter.companionId, brief: {
    category: after.frontmatter.category, direction: after.frontmatter.direction,
    pageCount: source.pages } };
  const result = validateEditorialPassDraft(record,
    { text: candidate, sha256: hash(candidate) }, { sourceProfile: 'gender_flexible' });
  assert.equal(result.text, candidate);
  return { text: candidate, descriptor: {
    key: source.key, path: `${relativeRoot}/intake/${source.key}.md`,
    sha256: result.sha256, bytes: Buffer.byteLength(candidate), pages: after.pages.length,
    manuscriptPath: `${relativeRoot}/${approved.file}`, manuscriptSha256: approved.sha256,
    readingPredecessor: { path: source.file, sha256: source.sha256 },
    contentFidelity: 'title_metadata_and_parsed_pages_equal',
    structuralValidation: 'validateEditorialPassDraft_gender_flexible',
    editorialReview: 'not_supplied', artifactIndependentReview: 'not_supplied',
    visualDirections: 'not_prepared', runtimeAuthority: 'none', publicationReady: false,
  } };
}

function prepare() {
  const approvalBytes = fs.readFileSync(path.join(__dirname, 'OWNER_APPROVAL.json'));
  const approval = JSON.parse(approvalBytes);
  const inventoryBytes = fs.readFileSync(path.join(__dirname, 'sources.json'));
  const sources = JSON.parse(inventoryBytes).sources;
  assert.equal(approval.approvedBy, 'Guy');
  assert.equal(approval.decision, 'approved');
  assert.equal(sources.length, 18);
  assert.equal(approval.manuscripts.length, sources.length);
  assert.equal(new Set(sources.map(row => row.key)).size, sources.length);
  assert.equal(new Set(approval.manuscripts.map(row => row.file)).size, sources.length);
  const artifacts = sources.map(source => {
    assert.match(source.key, /^[a-z][a-z0-9_]+$/);
    const approved = approval.manuscripts.find(row => row.file === source.key + '.md');
    assert.ok(approved, 'approval_slot_missing');
    assert.ok(source.file.startsWith('story-pipeline/04_approved_story_sources/accepted/'));
    assert.ok(!source.file.split('/').includes('..'));
    const oldBytes = fs.readFileSync(path.join(repoRoot, source.file));
    assert.equal(hash(oldBytes), source.sha256, 'reading_predecessor_drift');
    assert.equal(oldBytes.length, source.bytes, 'reading_predecessor_size');
    return canonicalCandidate(fs.readFileSync(path.join(__dirname, approved.file)), approved, source);
  });
  return { manifest: {
    version: 'editorial-canonical-intake/v1', status: 'prepared_not_published',
    ownerContentApproval: { path: `${relativeRoot}/OWNER_APPROVAL.json`, sha256: hash(approvalBytes) },
    readingInventory: { path: `${relativeRoot}/sources.json`, sha256: hash(inventoryBytes) },
    storyCount: artifacts.length, pageCount: artifacts.reduce((n, a) => n + a.descriptor.pages, 0),
    transform: 'Remove exact staging status/runtimeAuthority header lines; CRLF to LF only',
    runtimeAuthority: 'none', publicationReady: false,
    missingPrerequisites: ['External Editor review and independent artifact review',
      'Lifecycle-compatible creative briefs and verified publication predecessor bindings',
      'Publication request with required evidence, then fresh visual directions and consumer qualification'],
    limits: ['Structural validator is not an Editor verdict',
      'Reading predecessor is not a verified runtime locator or publication predecessor',
      'No creative replacement loadInputs/publish call was made',
      'Owner-approved prose is preserved; no approval is inferred for missing review evidence'],
    records: artifacts.map(a => a.descriptor), providerCalls: 0, writes: 0,
  }, artifacts };
}

function main(args) {
  assert.ok(args.length === 1 && ['--emit', '--check'].includes(args[0]),
    'usage: node prepare-intake.cjs --emit|--check');
  const prepared = prepare();
  if (args[0] === '--emit') {
    console.log(JSON.stringify(prepared, null, 2));
    return;
  }
  for (const artifact of prepared.artifacts) {
    assert.deepEqual(fs.readFileSync(path.join(repoRoot, artifact.descriptor.path)),
      Buffer.from(artifact.text), 'saved_candidate_drift');
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname, 'intake/manifest.json'), 'utf8')),
    prepared.manifest, 'saved_manifest_drift');
  console.log(JSON.stringify({ status: 'canonical_intake_verified',
    storyCount: prepared.manifest.storyCount, pageCount: prepared.manifest.pageCount,
    structuralValidator: 'validateEditorialPassDraft', publicationReady: false,
    providerCalls: 0, writes: 0 }, null, 2));
}
if (require.main === module) main(process.argv.slice(2));
module.exports = { canonicalCandidate, prepare, hash };
