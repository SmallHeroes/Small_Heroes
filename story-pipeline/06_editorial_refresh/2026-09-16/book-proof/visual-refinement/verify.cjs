// Read-only verification; invoke with --import tsx and the server-only shim.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../..');
const enrichment = require(path.join(repo, 'scripts/story-source-visual-direction-enrichment-lifecycle.cjs'));
const { parseStoryMarkdown } = require(path.join(repo, 'lib/story-validators/parser.ts'));
const read = p => fs.readFileSync(p);
const json = p => JSON.parse(read(p));
const local = name => path.join(__dirname, name);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const request = json(local('enrichment-request.json'));
const created = json(local('creating-receipt.json'));
const replay = json(local('replay-receipt.json'));
const dry = json(local('dry-run-receipt.json'));
const requestPath = 'outputs/panda-visual-refinement-inputs-20260917/enrichment-request.json';
const outputRoot = 'outputs/panda-visual-refinement-candidate-20260917';
assert.deepEqual(read(path.join(repo, requestPath)), read(local('enrichment-request.json')));
assert.deepEqual(read(path.join(repo, request.visualDirections.path)), read(local('visual-directions.json')));
assert.equal(created.created, true);
assert.equal(replay.created, false);
assert.deepEqual(replay, { ...created, created: false });
assert.deepEqual(dry, replay);
const loaded = enrichment.loadExistingCandidate({ requestPath, outputRoot });
const current = enrichment.prepare({ requestPath, outputRoot, write: false });
assert.deepEqual(current, replay);
assert.equal(loaded.candidate.candidateDigest, created.candidateDigest);
assert.equal(created.status, 'pending_exact_product_review');
assert.equal(created.runtimeEligibility.eligible, false);
const old = json(path.resolve(__dirname, '../visual-preparation/visual-directions.json'));
const next = json(local('visual-directions.json'));
const leaves = (a, b, p = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => leaves(a[k], b[k], p + '/' + k));
  }
  return [p];
};
assert.deepEqual(leaves(old, next), ['/pages/8/mainAction']);
assert.equal(next.pages[8].pageNumber, 9);
assert.match(next.pages[8].mainAction, /keeps the telescope at eye level/);
assert.match(next.pages[9].mainAction, /has lowered the tube/);
assert.deepEqual(enrichment.compositionMetrics(old), enrichment.compositionMetrics(next));
const sourceFile = path.join(repo, path.dirname(request.sourceRevision.manifestPath), 'story.md');
const source = read(sourceFile).toString('utf8');
assert.equal(hash(read(sourceFile)), '5bed647c29ca61b6fe75ccd39b3e73fb6be5ea2d775f4add220026dc20714b0e');
const integrated = read(path.join(loaded.target, 'integrated.md')).toString('utf8');
const prose = s => parseStoryMarkdown(s).pages.map(({ pageNumber, text }) => ({ pageNumber, text }));
assert.deepEqual(prose(source), prose(integrated));
assert.equal(parseStoryMarkdown(integrated).pages.filter(p => p.imageDirection).length, 12);
const snapshot = rows => rows.map(row => {
  const full = path.join(repo, row.file), b = read(full);
  return { file: row.file, bytes: b.length, sha256: hash(b), mtimeMs: fs.statSync(full).mtimeMs };
});
const before = json(local('preservation-before.json'));
const replayBefore = json(local('replay-before.json'));
assert.equal(before.length, 12);
assert.equal(replayBefore.length, 5);
assert.deepEqual(snapshot(before), before);
assert.deepEqual(snapshot(replayBefore), replayBefore);
const filenames = fs.readdirSync(loaded.target).sort();
assert.deepEqual(fs.readdirSync(local('candidate')).sort(), filenames);
assert.equal(filenames.length, 5);
for (const name of filenames) assert.deepEqual(read(local('candidate/' + name)), read(path.join(loaded.target, name)));
const negatives = [];
const rejects = (name, fn) => { assert.throws(fn); negatives.push(name); };
rejects('extra_direction_change', () => {
  const altered = structuredClone(next); altered.pages[0].cameraAngle = 'eye_level';
  assert.deepEqual(leaves(old, altered), ['/pages/8/mainAction']);
});
rejects('source_prose_change', () => assert.deepEqual(prose(source), prose(integrated.replace('בגן השעשועים', 'בבית הספר'))));
rejects('candidate_digest_change', () => assert.equal(loaded.candidate.candidateDigest, '0'.repeat(64)));
console.log(JSON.stringify({
  status: 'offline_successor_verified_not_accepted', candidateDigest: created.candidateDigest,
  changedLeaves: leaves(old, next), pages: 12, parsedProseUnchanged: true,
  composition: current.composition, originalFilesPreserved: before.length,
  replayFilesPreservedIncludingMtime: replayBefore.length, trackedCandidateCopies: filenames.length,
  preservationAfter: snapshot(before), replayAfter: snapshot(replayBefore),
  negativeControls: negatives, providerCalls: 0, writes: 0,
  limitations: ['No independent visual review', 'No product acceptance', 'No frozen contract or render qualification', 'No pixel/anatomy/narration evidence'],
}, null, 2));
