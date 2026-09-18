'use strict';
// Actual local paid candidate, read-only by default. No candidate/approval writer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
globalThis.fetch = async () => { throw Error('offline_companion_presence_network_forbidden'); };
const repo = path.resolve(__dirname, '../../../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(repo, p), 'utf8'));
const { canonicalHash } = require(path.join(repo, 'lib/canonical-json.ts'));
const { prepareAcceptedSupportingCastReview } = require(path.join(repo, 'lib/visual-package/acceptedSupportingCastReview.ts'));
const { buildSemanticCorrectionPlan, applySemanticCorrection } = require(path.join(repo, 'lib/visual-package/visualContractSemanticCorrection.ts'));
const summary = read('outputs/panda-contract-execution-20260918-01/stdout.json');
const artifacts = Object.values(summary.persistence).filter(v => v && typeof v.path === 'string');
assert.equal(artifacts.length, 6);
const observe = () => artifacts.map(({ path: p }) => {
  const file = path.join(repo, p), bytes = fs.readFileSync(file), stat = fs.statSync(file);
  return { path: p, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, mtimeMs: stat.mtimeMs };
});
const before = observe();
const candidate = read(summary.persistence.candidate.path);
const fixture = read('lib/visual-package/__tests__/fixtures/semantic-recovery-held-panda.json');
assert.deepEqual(fixture, candidate); // The tracked fixture is a semantic copy, not the original run archive.
const request = read('story-pipeline/06_editorial_refresh/2026-09-16/book-proof/visual-acceptance/source-authority-request.json');
const accepted = prepareAcceptedSupportingCastReview({ ...request, repoRoot: repo, entries: [] });
const context = { snapshot: accepted.snapshot, candidate, supportingCastReview: accepted.review };
const originalInputDigest = canonicalHash(context);
const operation = { kind: 'require_companion_presence', pageNumber: 6,
  companionId: candidate.template.cast.companion.id, expectedCompanionPresent: false,
  expectedCastIds: ['child:hero'], acceptedVisualDirectionsJson: fs.readFileSync(path.join(repo, path.dirname(request.storyPath), 'visual-directions.json'), 'utf8') };
const plan = buildSemanticCorrectionPlan(context, [operation]);
const result = applySemanticCorrection(context, plan);
const expected = structuredClone(candidate.template);
expected.pageContracts[5].characterPresence.companion = true;
expected.pageContracts[5].castIds.push(operation.companionId);
assert.deepEqual(result.effective.template, expected);
assert.deepEqual(result.effective.coverage, candidate.actionSemanticCoverage);
assert.equal(canonicalHash(context), originalInputDigest);
for (const patch of [{ companionId: 'companion:invented' }, { acceptedVisualDirectionsJson: '{}' }, { pageNumber: 5 }]) {
  assert.throws(() => applySemanticCorrection(context, buildSemanticCorrectionPlan(context, [{ ...operation, ...patch }])));
}
assert.deepEqual(observe(), before);
const evidence = { version: 'companion-presence-offline-witness/v1', originalCandidateDigest: candidate.digest,
  sourceSnapshotDigest: accepted.snapshot.digest, planDigest: plan.digest, correctionDigest: result.digest,
  effectiveTemplateDigest: result.effective.templateDigest, changedPages: [6],
  changesOnly: ['characterPresence.companion:false->true', 'castIds:add-authoritative-companion'],
  sourceAndInputsUnchanged: true, paidArtifactsPreserved: before, negativeControls: 3,
  providerCalls: 0, costUsd: 0, candidateStillHeld: true, runtimeEligible: false,
  limitations: ['presence-only review overlay', 'not supporting-cast recovery', 'not selected-moment/cover/custody recovery',
    'no product acceptance or independent code PASS', 'original outputs local-only without verified backup'] };
if (process.argv.includes('--record')) fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify(evidence, null, 2) + '\n');
