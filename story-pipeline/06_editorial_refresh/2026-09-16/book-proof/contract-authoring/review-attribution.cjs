'use strict';
// Offline regression witness, not an automatic semantic judge or authority grant.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(repo, p), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, p))).digest('hex');
const { storySourceSnapshotToTemplateInput } = require(path.join(repo, 'lib/visual-package/storySourceAuthority.ts'));
const { extractDeterministicFacts } = require(path.join(repo, 'lib/visual-contract-compiler/extractDeterministicFacts.ts'));
const { supportingCastFacts } = require(path.join(repo, 'lib/visual-contract-compiler/supportingCastReview.ts'));
const { prepareAcceptedSupportingCastReview } = require(path.join(repo, 'lib/visual-package/acceptedSupportingCastReview.ts'));
const { canonicalHash } = require(path.join(repo, 'lib/canonical-json.ts'));
globalThis.fetch = async () => { throw Error('offline_attribution_network_forbidden'); };
const summary = read('outputs/panda-contract-execution-20260918-01/stdout.json');
const c = read(summary.persistence.candidate.path);
const replay = read(summary.persistence.structuredDraftReplayEvidence.path);
const snapshot = read(summary.persistence.sourceSnapshot.path);
const draft = JSON.parse(replay.attempts[0].responseJson);
assert.equal(c.digest, '41d400698df1aa452b326a050b5f1a316ea4679ffb80e093fa16c6466c7ff2ba');
assert.equal(canonicalHash(c.template), c.templateDigest);
const input = storySourceSnapshotToTemplateInput(snapshot);
const facts = extractDeterministicFacts(input);
const page = (obj, n) => obj.pageContracts.find(p => p.pageNumber === n);
// Comparing complete ordered predicate/polarity lists proves these selected
// requirements existed before prose projection; it does not assert all fields equal.
const signature = p => p.actionRequirements.map(a => [a.predicate, a.polarity]);
function checkDraftActions(raw, compiled) {
  for (const n of [5, 8, 12]) assert.deepEqual(signature(page(raw, n)), signature(page(compiled, n)));
  assert.deepEqual(signature(page(raw, 8)), [['reaches_toward', 'must'], ['holds', 'must'], ['pushes', 'must']]);
  assert.deepEqual(signature(page(raw, 12)), [['walks', 'must'], ['pushes', 'must'], ['places', 'must']]);
}
checkDraftActions(draft, c.template);
assert.deepEqual(draft.humanCast.map(h => h.id), ['child']);
assert.deepEqual(c.template.humanCast, []);
assert.equal(c.template.cast.child.id, 'child:hero');
assert.deepEqual(facts.humans, []);
assert.deepEqual(c.template.pageContracts.map(p => p.castIds.length), [2,2,2,2,2,1,2,2,2,2,2,2]);
const direction6 = snapshot.content.pageImageDirections.find(p => p.pageNumber === 6).imageDirection;
function checkCompanion(compiled) {
  assert.ok(direction6.includes('the companion waits nearby'));
  assert.ok(direction6.includes('companion present'));
  assert.deepEqual(page(compiled, 6).castIds, ['child:hero']);
  assert.equal(page(compiled, 6).characterPresence.companion, false);
}
checkCompanion(c.template);
assert.ok(!facts.companionPresentPages.includes(6));
// The current supporting-cast path retains the legacy companion fact vector.
// Empty review is a bounded control, not the proposed Panda cast review.
const authority = read('story-pipeline/06_editorial_refresh/2026-09-16/book-proof/visual-acceptance/source-authority-request.json');
const control = prepareAcceptedSupportingCastReview({ ...authority, entries: [] });
assert.deepEqual(supportingCastFacts(control.input, control.review).companionPresentPages, facts.companionPresentPages);
const negativeControls = [];
for (const n of [8, 12]) {
  const changed = structuredClone(draft);
  page(changed, n).actionRequirements.shift();
  assert.throws(() => checkDraftActions(changed, c.template));
  negativeControls.push('missing_raw_action_page_' + n);
}
const restored = structuredClone(c.template);
page(restored, 6).castIds.push('companion:panda_anat');
page(restored, 6).characterPresence.companion = true;
assert.throws(() => checkCompanion(restored));
negativeControls.push('restored_companion_page_6');
const report = {
  status: 'attribution_reproduced_semantic_hold_remains',
  candidateDigest: c.digest, sourceSnapshotDigest: snapshot.digest,
  draftHumanIds: draft.humanCast.map(h => h.id), compiledHumanIds: [],
  castCounts: c.template.pageContracts.map(p => p.castIds.length),
  moments: [5,8,12].map(n => ({ pageNumber: n, rawMustShowCount: page(draft,n).mustShow.length,
    compiledMustShowCount: page(c.template,n).mustShow.length, rawActions: signature(page(draft,n)),
    compiledActions: signature(page(c.template,n)),
    addedProse: page(c.template,n).mustShow.filter(x => !page(draft,n).mustShow.includes(x)) })),
  page6: { approvedDirection: direction6, compiledCastIds: page(c.template,6).castIds,
    companionPresent: false, extractorPresentPages: facts.companionPresentPages,
    emptySupportingCastReviewPreservesPresenceVector: true },
  negativeControls, providerCalls: 0,
  preservedRunFiles: read('story-pipeline/06_editorial_refresh/2026-09-16/book-proof/contract-authoring/verification.json').artifacts.map(r => {
    assert.equal(sha(r.path), r.sha256); return { path: r.path, sha256: r.sha256 };
  }),
  limitations: ['Not a production fix', 'No reviewed cast authority created', 'No product or independent QA PASS']
};
if (process.argv.includes('--record')) fs.writeFileSync(path.join(__dirname, 'review-attribution.json'), JSON.stringify(report,null,2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report,null,2));
