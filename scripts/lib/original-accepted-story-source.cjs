'use strict';

// Read-only original-source authority. No provider, promotion or inferred approval.
const path = require('node:path');
const { isDeepStrictEqual: equal } = require('node:util');
const { validateEditorialPassDraft } = require('../story-editorial-validation-contract.cjs');
const { validateProductAcceptance, validateEditorialReviewResult } = require('../materialize-story-commission-briefs.cjs');
const { validateAcceptance: validateCorpusAcceptance } = require('../promote-autonomous-story-review-corpus.cjs');
const APPROVAL_ROOT = 'story-pipeline/04_approved_story_sources/approvals';
const CORPUS_ROOT = 'story-pipeline/04_approved_story_sources/review-corpora';
const CODE = 'story_source_creative_replacement_original_invalid';
const keys = (value, expected) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
const requireFact = value => { if (!value) throw Error(CODE); };

function loadOriginalAcceptedSource({ repoRoot, acceptedRoot, storyKey, predecessor, identity, readFile }) {
  requireFact(/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/.test(storyKey));
  const root = `${acceptedRoot}/${storyKey}`;
  requireFact(keys(predecessor, ['kind', 'manifestPath', 'manifestSha256'])
    && predecessor.kind === 'accepted_root_v1' && predecessor.manifestPath === `${root}/manifest.json`);
  const read = (relativePath, allowedRoot, maximumBytes = 256 * 1024) =>
    readFile({ repoRoot, relativePath, allowedRoot, maximumBytes, code: CODE });
  const json = file => { try { return JSON.parse(file.bytes.toString('utf8')); } catch { throw Error(CODE); } };
  const file = read(predecessor.manifestPath, root);
  requireFact(file.sha256 === predecessor.manifestSha256);
  const manifest = json(file), r = manifest.record;
  requireFact(keys(manifest, ['version', 'status', 'authorityScope', 'record'])
    && manifest.version === 'small-heroes-product-accepted-story-source-manifest/v1'
    && manifest.status === 'product_accepted_story_source' && manifest.authorityScope === 'story_text_only'
    && keys(r, ['briefId', 'companionId', 'direction', 'category', 'textPageCount', 'physicalPageCount',
      'story', 'editorialReview', 'productAcceptance', 'independentArtifactAudit', 'excludedAuthorities'])
    && storyKey === `${r.companionId}_${r.direction}`
    && Number.isSafeInteger(r.textPageCount) && r.textPageCount >= 1 && r.textPageCount <= 24
    && r.physicalPageCount === r.textPageCount * 2
    && (!identity || (identity.companionId === r.companionId && identity.direction === r.direction && identity.category === r.category)));
  requireFact(keys(r.story, ['filename', 'bytes', 'sha256', 'byteIdenticalToSource'])
    && r.story.filename === 'story.md' && r.story.byteIdenticalToSource === true
    && keys(r.editorialReview, ['filename', 'sourcePath', 'bytes', 'sha256', 'verdict', 'byteIdenticalToSource'])
    && r.editorialReview.filename === 'editorial-review.json' && r.editorialReview.verdict === 'pass'
    && r.editorialReview.byteIdenticalToSource === true
    && keys(r.productAcceptance, ['path', 'bytes', 'sha256', 'acceptedBy', 'acceptedOn']));
  const story = read(`${root}/story.md`, root), review = read(`${root}/editorial-review.json`, root);
  const approvalFile = read(r.productAcceptance.path, APPROVAL_ROOT, 32 * 1024);
  for (const [actual, descriptor] of [[story, r.story], [review, r.editorialReview], [approvalFile, r.productAcceptance]]) {
    requireFact(actual.sha256 === descriptor.sha256 && actual.bytes.length === descriptor.bytes);
  }
  const approval = json(approvalFile);
  // Reuse the historical validators; do not weaken their authority requirements.
  let audit;
  if (approval.version === 'small-heroes-story-product-acceptance/v1') {
    validateProductAcceptance(approval);
    requireFact(approval.briefId === r.briefId && approval.storySha256 === story.sha256
      && approval.editorialReviewSha256 === review.sha256);
    audit = approval.independentArtifactAudit;
    // This path may have been an ignored temporary output. The retained review
    // and the product approval bind its original bytes; no external path is read.
    requireFact(typeof r.editorialReview.sourcePath === 'string' && r.editorialReview.sourcePath.length > 0);
  } else {
    validateCorpusAcceptance(approval, approvalFile.bytes);
    const corpusFile = read(approval.corpusManifestPath, CORPUS_ROOT, 512 * 1024);
    requireFact(corpusFile.sha256 === approval.corpusManifestSha256);
    const corpus = json(corpusFile);
    requireFact(corpus.version === 'small-heroes-autonomous-story-review-corpus/v1'
      && corpus.status === 'pending_independent_artifact_audit' && corpus.authorityScope === 'story_text_candidates_only'
      && corpus.candidateCount === approval.recordCount && Array.isArray(corpus.records)
      && corpus.records.length === approval.recordCount
      && new Set(corpus.records.map(row => row.slot)).size === approval.recordCount
      && new Set(corpus.records.map(row => row.briefId)).size === approval.recordCount);
    const matches = corpus.records.filter(row => row.slot === storyKey);
    requireFact(matches.length === 1);
    const row = matches[0];
    requireFact(row.briefId === r.briefId && row.companionId === r.companionId && row.direction === r.direction
      && row.category === r.category && row.textPageCount === r.textPageCount && row.physicalPageCount === r.physicalPageCount
      && row.storySha256 === story.sha256 && row.reviewSha256 === review.sha256);
    const sourceRoot = `${path.posix.dirname(approval.corpusManifestPath)}/${storyKey}`;
    requireFact(r.editorialReview.sourcePath === `${sourceRoot}/editorial-review.json`);
    requireFact(read(`${sourceRoot}/story.md`, CORPUS_ROOT).bytes.equals(story.bytes)
      && read(`${sourceRoot}/editorial-review.json`, CORPUS_ROOT).bytes.equals(review.bytes));
    const { reviewedBase, ...remainingAudit } = approval.independentArtifactAudit;
    audit = remainingAudit;
  }
  requireFact(approval.acceptedBy === r.productAcceptance.acceptedBy && approval.acceptedOn === r.productAcceptance.acceptedOn
    && equal(audit, r.independentArtifactAudit) && equal(approval.exclusions, r.excludedAuthorities));
  const validated = validateEditorialPassDraft(
    { companionId: r.companionId, brief: { direction: r.direction, category: r.category, pageCount: r.textPageCount } },
    { text: story.bytes.toString('utf8'), sha256: story.sha256 },
  );
  requireFact(validated.sha256 === story.sha256);
  const editorial = validateEditorialReviewResult(json(review), r.textPageCount);
  requireFact(editorial.verdict === 'pass' && editorial.issues.length === 0 && editorial.revisionPriorities.length === 0);
  return { file, manifest, original: true, descriptor: { ...predecessor },
    evidence: { storySha256: story.sha256, reviewSha256: review.sha256, approvalSha256: approvalFile.sha256 } };
}

module.exports = { loadOriginalAcceptedSource };
