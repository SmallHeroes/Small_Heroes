#!/usr/bin/env node
// Read-only verification of this real source publication and visual candidate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../..');
const replacement = require(path.join(repo, 'scripts/story-source-creative-replacement-lifecycle.cjs'));
const enrichment = require(path.join(repo, 'scripts/story-source-visual-direction-enrichment-lifecycle.cjs'));
const { parseStoryMarkdown } = require(path.join(repo, 'lib/story-validators/parser.ts'));
const { auditWizardAllStoryRenderReadiness } = require(path.join(repo, 'lib/visual-package/wizardAllStoryRenderReadiness.ts'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.resolve(repo, p));
const json = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const requestPath = 'outputs/panda-approved-source-20260917/request.json';
const enrichmentRequest = 'outputs/panda-approved-source-20260917/enrichment-request.json';
assert.deepEqual(JSON.parse(read(requestPath)), json('request.json'));
assert.deepEqual(JSON.parse(read(enrichmentRequest)), json('enrichment-request.json'));
const receipt = json('publication-receipt.json');
const visualReceipt = json('enrichment-receipt.json');
const loaded = replacement.loadInputs(requestPath);
const built = replacement.buildRevision(loaded);
assert.equal(built.revisionDigest, receipt.revisionDigest);
assert.deepEqual(built.manifest, receipt.manifest);
assert.equal(fs.readdirSync(path.join(repo, receipt.target)).length, built.files.size);
const acceptedFiles = [];
for (const [name, bytes] of built.files) {
  assert.ok(read(`${receipt.target}/${name}`).equals(bytes));
  acceptedFiles.push({ name, bytes: bytes.length, sha256: hash(bytes) });
}
const accepted = replacement.loadAcceptedCreativeReplacement({ manifestPath: `${receipt.target}/manifest.json` });
assert.equal(accepted.storySha256, '5bed647c29ca61b6fe75ccd39b3e73fb6be5ea2d775f4add220026dc20714b0e');
assert.equal(accepted.acceptance.acceptedBy, 'Guy');
assert.deepEqual(accepted.manifest.runtimeEligibility, { eligible: false, reason: 'visual_directions_not_approved' });
const visual = enrichment.loadExistingCandidate({ requestPath: enrichmentRequest, outputRoot: 'outputs/panda-visual-enrichment-20260917' });
assert.equal(visual.candidate.candidateDigest, visualReceipt.candidateDigest);
assert.equal(visual.candidate.manifest.digest, visualReceipt.manifestDigest);
assert.equal(visual.candidate.manifest.runtimeEligibility.eligible, false);
const candidateFiles = [];
for (const [name, bytes] of visual.candidate.files) {
  assert.ok(fs.readFileSync(path.join(__dirname, 'visual-candidate', name)).equals(bytes));
  candidateFiles.push({ name, bytes: bytes.length, sha256: hash(bytes) });
}
const source = read(accepted.storyPath).toString('utf8');
const integrated = read(`${visualReceipt.target}/integrated.md`).toString('utf8');
assert.equal(integrated.replace(/^imageDirection:.*\r?\n/gm, ''), source);
const prose = s => parseStoryMarkdown(s).pages.map(({ pageNumber, text }) => ({ pageNumber, text }));
assert.deepEqual(prose(integrated), prose(source));
assert.equal(parseStoryMarkdown(integrated).pages.filter(p => p.imageDirection).length, 12);
const prior = JSON.parse(fs.readFileSync(path.join(__dirname, '../original-source-inspection.json'), 'utf8'));
for (const row of prior.records) {
  const actual = replacement.inspectOriginalAcceptedSource({ storyKey: row.storyKey, manifestSha256: row.predecessor.manifestSha256 }, { repoRoot: repo });
  assert.deepEqual({ storyKey: row.storyKey, ...actual }, row);
}
process.env.ENABLE_V3_APPROVED_BANK = 'true';
process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = 'false';
const audit = auditWizardAllStoryRenderReadiness({ repoRoot: repo });
const current = audit.records.find(p => p.storyKey === 'panda_anat_adventure');
assert.equal(current.acceptedProductLineage.kind, 'present');
assert.equal(current.sources.currentProductSourcePath, null);
assert.equal(current.productTextReadiness, null);
assert.equal(current.productionStages.renderQualified, false);
assert.equal(current.nextCanonicalAction.providerSpendAuthorized, false);
console.log(JSON.stringify({
  sourceRevisionDigest: accepted.revisionDigest,
  candidateDigest: visual.candidate.candidateDigest,
  acceptedFiles, candidateFiles, originalRootsVerified: prior.records.length,
  directedPages: 12, exactProsePreserved: true,
  sourceAuthority: 'story_text_only', visualStatus: visual.candidate.manifest.status,
  runtimeAudit: { enabledV3Bank: true, summary: audit.summary,
    currentSource: current.sources.currentProductSourcePath,
    earliestBlocker: current.earliestBlocker, nextAction: current.nextCanonicalAction },
  providerCalls: 0, writes: 0,
}, null, 2));
