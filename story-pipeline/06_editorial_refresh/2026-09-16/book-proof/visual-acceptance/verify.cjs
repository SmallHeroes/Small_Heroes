// Read-only acceptance/consumer verification, no provider or credential access.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../..');
const local = p => path.join(__dirname, p);
const read = p => fs.readFileSync(p);
const json = p => JSON.parse(read(p));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const lifecycle = require(path.join(repo, 'scripts/story-source-visual-direction-acceptance-lifecycle.cjs'));
const source = require(path.join(repo, 'lib/visual-package/storySourceAuthority.ts'));
const authoring = require(path.join(repo, 'lib/visual-package/visualContractAuthoringLifecycle.ts'));
const readiness = require(path.join(repo, 'lib/visual-package/wizardAllStoryRenderReadiness.ts'));
const requestPath = 'outputs/panda-visual-acceptance-inputs-20260917/request.json';
const outputRoot = 'outputs/panda-visual-acceptance-prepared-20260917';
const request = json(local('request.json'));
assert.deepEqual(read(path.join(repo, requestPath)), read(local('request.json')));
assert.deepEqual(read(path.join(repo, request.technicalReview.path)), read(local('technical-review.json')));
const genuineReview = json(path.resolve(__dirname, '../visual-refinement/technical-review.json'));
assert.deepEqual(json(local('technical-review.json')), genuineReview);
lifecycle.validateTechnicalReview(genuineReview);
const prepared = lifecycle.prepare({ requestPath, outputRoot, write: false });
const published = lifecycle.publish({ requestPath, outputRoot, write: false });
const create = json(local('publish-create.json'));
const replay = json(local('publish-replay.json'));
assert.equal(create.created, true);
assert.deepEqual(replay, { ...create, created: false });
assert.deepEqual(published, replay);
assert.deepEqual(json(local('prepare-replay.json')), { ...json(local('prepare-create.json')), created: false });
const target = path.join(repo, published.target);
assert.equal(fs.readdirSync(target).length, 9);
for (const [name, bytes] of prepared.bundle.files) {
  assert.deepEqual(read(path.join(target, name)), bytes);
  assert.deepEqual(read(path.join(repo, outputRoot, published.revisionDigest, name)), bytes);
}
assert.equal(hash(read(path.join(target, 'story.md'))), '5bed647c29ca61b6fe75ccd39b3e73fb6be5ea2d775f4add220026dc20714b0e');
for (const name of ['integrated.md', 'visual-directions.json', 'revision-identity.json']) {
  assert.deepEqual(read(path.join(target, name)), read(path.resolve(__dirname, '../visual-refinement/candidate', name)));
}
assert.deepEqual(published.runtimeEligibility, { eligible: false, reason: 'accepted_story_source_requires_fresh_visual_contract' });
const before = json(local('replay-before.json'));
assert.equal(before.length, 18);
const after = before.map(row => {
  const p = path.join(repo, row.file), b = read(p);
  return { file: row.file, bytes: b.length, sha256: hash(b), mtimeMs: fs.statSync(p).mtimeMs };
});
assert.deepEqual(after, before);
const sourceRequest = json(local('source-authority-request.json'));
const snapshot = source.buildStorySourceAuthoritySnapshot(sourceRequest);
source.assertValidStorySourceAuthoritySnapshot(snapshot);
assert.equal(snapshot.content.pages.length, 12);
assert.equal(snapshot.content.pageImageDirections.length, 12);
assert.equal(snapshot.content.acceptedRevisionAuthority.revisionDigest, published.revisionDigest);
const snapshotReceipt = json(local('authoring-preparation.json'));
assert.deepEqual(json(path.join(repo, snapshotReceipt.saved.path)), snapshot);
const authoringRequest = authoring.buildVisualContractAuthoringRequest({
  snapshot, mode: 'preflight', requestId: 'panda-accepted-directions-20260917',
  requestedAt: request.productAcceptance.acceptedAt,
});
assert.deepEqual(authoring.visualContractAuthoringRequestIssues({ request: authoringRequest, snapshot }), []);
const oldFlag = process.env.ENABLE_V3_APPROVED_BANK;
const oldQa = process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
const summaries = [];
try {
  process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = 'false';
  for (const flag of ['true', 'false']) {
    process.env.ENABLE_V3_APPROVED_BANK = flag;
    const report = readiness.auditWizardAllStoryRenderReadiness({ repoRoot: repo, now: () => new Date(request.productAcceptance.acceptedAt) });
    const panda = report.records.find(r => r.storyKey === request.storyKey);
    assert.equal(panda.sources.currentProductSourcePath, sourceRequest.storyPath);
    assert.equal(panda.productionStages.acceptedSourceRevision, true);
    assert.equal(panda.productionStages.renderQualified, false);
    assert.equal(panda.environmentProductSellable, false);
    assert.equal(panda.nextCanonicalAction.code, 'author_visual_contract_for_exact_accepted_source');
    assert.equal(panda.nextCanonicalAction.requiresGuyDecision, false);
    assert.equal(panda.nextCanonicalAction.providerSpendAuthorized, false);
    summaries.push({ v3Flag: flag, summary: report.summary, next: panda.nextCanonicalAction });
  }
} finally {
  if (oldFlag === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
  else process.env.ENABLE_V3_APPROVED_BANK = oldFlag;
  if (oldQa === undefined) delete process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
  else process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = oldQa;
}
const tamperedReview = structuredClone(genuineReview);
tamperedReview.candidateDigest = '0'.repeat(64);
assert.throws(() => lifecycle.validateTechnicalReview(tamperedReview));
console.log(JSON.stringify({ status: 'accepted_source_verified_not_render_qualified',
  revisionDigest: published.revisionDigest, manifestDigest: published.manifestDigest,
  snapshotDigest: snapshot.digest, authoringRequestDigest: authoringRequest.digest,
  authoringRequestMode: authoringRequest.mode, acceptedFiles: 9, replayPreserved: after,
  summaries, providerCalls: 0, writes: 0,
  limitations: ['No actual contract/Blueprint/package authored', 'P2 staging/custody obligations remain', 'No pixels or audio validated', 'No release/stability closure'],
}, null, 2));
