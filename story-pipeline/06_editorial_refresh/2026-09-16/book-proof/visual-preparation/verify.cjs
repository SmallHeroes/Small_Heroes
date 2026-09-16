#!/usr/bin/env node
// Offline preparation verifier. No publishing, provider imports or file writes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../..');
const contract = require(path.join(repo, 'scripts/story-visual-direction-contract.cjs'));
const enrichment = require(path.join(repo, 'scripts/story-source-visual-direction-enrichment-lifecycle.cjs'));
const replacement = require(path.join(repo, 'scripts/story-source-creative-replacement-lifecycle.cjs'));
const integration = require(path.join(repo, 'scripts/story-bank-direction-integration.cjs'));
const { parseStoryMarkdown } = require(path.join(repo, 'lib/story-validators/parser.ts'));
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = (name) => JSON.parse(fs.readFileSync(path.resolve(__dirname, name), 'utf8'));
const grounding = readJson('source-grounding.json');
const readBound = (bound) => {
  const bytes = fs.readFileSync(path.resolve(__dirname, bound.path));
  assert.equal(hash(bytes), bound.sha256, 'bound_input_hash');
  return bytes;
};
const source = readBound(grounding.story).toString('utf8');
const review = JSON.parse(readBound(grounding.editorialReview));
const record = readJson('visual-directions.json');
const intent = readJson('continuity-intent.json');
const brief = readJson('creative-brief.json');
const story = contract.parseStory(source);
const storyKey = `${story.companionId}_${story.direction}`;
assert.equal(grounding.status, 'pending_preparation_not_accepted');
assert.equal(grounding.runtimeAuthority, 'none');
replacement.validateEditorialReview(review);
replacement.validateCreativeBrief(brief, { identity: {
  category: story.category, direction: story.direction, pageCount: story.declaredPages,
} });
contract.validateVisualDirectionRecord(record, storyKey, story.declaredPages);
assert.deepEqual(contract.normalizeVisualDirectionRecord(record), record);
enrichment.validateContinuityIntent(intent, story.declaredPages);
assert.deepEqual(enrichment.protectedAuthorityIssues(record, story.companionId, intent), []);
const metrics = enrichment.compositionMetrics(record);
assert.ok(metrics.widePageNumbers.length >= Math.ceil(story.declaredPages / 3));
assert.ok(metrics.closeFocusPageNumbers.length <= Math.floor(story.declaredPages / 3));
const verifyGrounding = (data) => {
  assert.equal(data.pages.length, story.pages.length);
  data.pages.forEach((page, i) => {
    assert.equal(page.pageNumber, i + 1);
    assert.ok(page.sourceExcerpt.length >= 12);
    assert.ok(story.pages[i].prose.includes(page.sourceExcerpt), `page_${i + 1}_source_excerpt`);
  });
};
verifyGrounding(grounding);
const integrated = integration.injectDirections(source, record);
assert.equal(integrated.replace(/^imageDirection:.*\r?\n/gm, ''), source);
const prose = (text) => parseStoryMarkdown(text).pages.map(({ pageNumber, text }) => ({ pageNumber, text }));
assert.deepEqual(prose(integrated), prose(source));
assert.equal(parseStoryMarkdown(integrated).pages.filter(p => p.imageDirection).length, story.declaredPages);

// Re-inspect genuine predecessor evidence, but never construct a publication request.
const saved = readJson('../original-source-inspection.json').records.find(x => x.storyKey === storyKey);
assert.ok(saved);
const original = replacement.inspectOriginalAcceptedSource({
  storyKey, manifestSha256: saved.predecessor.manifestSha256,
}, { repoRoot: repo });
assert.deepEqual({ storyKey, ...original }, saved);

const negativeControls = [];
const rejects = (name, operation) => {
  assert.throws(operation);
  negativeControls.push(name);
};
rejects('source_hash_change', () => assert.equal(hash(Buffer.from(source + '\n')), grounding.story.sha256));
rejects('editor_hash_change', () => assert.equal(hash(Buffer.from('{}')), grounding.editorialReview.sha256));
rejects('missing_page', () => contract.validateVisualDirectionRecord({ ...record, pages: record.pages.slice(1) }, storyKey, 12));
rejects('wrong_story_key', () => contract.validateVisualDirectionRecord(record, 'fox_uri_adventure', 12));
rejects('wrong_page_evidence', () => {
  const altered = structuredClone(grounding);
  altered.pages[0].sourceExcerpt = grounding.pages[11].sourceExcerpt;
  verifyGrounding(altered);
});
rejects('repeated_composition', () => enrichment.compositionMetrics({ ...record,
  pages: record.pages.map(p => ({ ...p, shotType: 'wide', cameraAngle: 'eye_level' })),
}));
for (const [name, mainAction] of [
  ['gender_override', 'The child raises his hand.'],
  ['wardrobe_override', 'The child wears a new sweater.'],
]) {
  rejects(name, () => {
    const altered = structuredClone(record);
    altered.pages[0].mainAction = mainAction;
    assert.deepEqual(enrichment.protectedAuthorityIssues(altered, story.companionId, intent), []);
  });
}
rejects('changed_prose', () => assert.deepEqual(prose(integrated.replace('בגן השעשועים', 'בבית הספר')), prose(source)));
rejects('directions_already_present', () => integration.injectDirections(integrated, record));

const files = ['creative-brief.json', 'visual-directions.json', 'continuity-intent.json', 'source-grounding.json', 'DESIGN_LOCKS.md'];
console.log(JSON.stringify({
  status: 'offline_preparation_valid_not_published', storyKey,
  sourceSha256: grounding.story.sha256, editorialReviewSha256: grounding.editorialReview.sha256,
  files: files.map(name => { const b = fs.readFileSync(path.join(__dirname, name)); return { name, bytes: b.length, sha256: hash(b) }; }),
  metrics, directionLengths: record.pages.map(p => integration.pageDirection(p).length),
  sourceExcerptCount: grounding.pages.length, parsedProseUnchanged: true,
  originalEvidenceVerified: true, negativeControls, providerCalls: 0, writes: 0,
  limitations: ['No accepted-source publication or enrichment prepare invocation', 'No visual correctness or numerical image-scale evidence', 'No independent QA or product acceptance'],
}, null, 2));
