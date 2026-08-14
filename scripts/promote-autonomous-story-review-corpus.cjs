#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  findRecord,
  loadStoryArchitectAuthority,
  sha256,
  validateEditorialReviewResult,
  writeProductAcceptedStorySource,
} = require('./materialize-story-commission-briefs.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const ACCEPTANCE_REL = 'story-pipeline/04_approved_story_sources/approvals/autonomous-20260815-v1.product-acceptance.json';
const ACCEPTED_ROOT = path.join(REPO_ROOT, 'story-pipeline', '04_approved_story_sources', 'accepted');
const EXPECTED_CORPUS_VERSION = 'small-heroes-autonomous-story-review-corpus/v1';
const EXPECTED_ACCEPTANCE_VERSION = 'small-heroes-story-corpus-product-acceptance/v1';

function hasExactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function validateAcceptance(value, bytes) {
  const keys = [
    'version', 'status', 'acceptedBy', 'acceptedOn', 'acceptanceScope',
    'corpusManifestPath', 'corpusManifestSha256', 'recordCount',
    'independentArtifactAudit', 'decision', 'exclusions',
  ];
  const auditKeys = ['status', 'reviewedBase', 'reviewedHead', 'blocker', 'major', 'minor'];
  if (
    !hasExactKeys(value, keys) ||
    value.version !== EXPECTED_ACCEPTANCE_VERSION ||
    value.status !== 'accepted' ||
    value.acceptedBy !== 'Guy' ||
    value.acceptedOn !== '2026-08-15' ||
    value.acceptanceScope !== 'story_text_only' ||
    value.recordCount !== 17 ||
    !/^[a-f0-9]{64}$/.test(value.corpusManifestSha256) ||
    !hasExactKeys(value.independentArtifactAudit, auditKeys) ||
    value.independentArtifactAudit.status !== 'pass' ||
    value.independentArtifactAudit.reviewedBase !== '816f0df75017bd7c061fbf2076925e9c2e255146' ||
    value.independentArtifactAudit.reviewedHead !== 'dc7f15423616db80fa6a09ddd15ca9dc8702049c' ||
    ['blocker', 'major', 'minor'].some((key) => value.independentArtifactAudit[key] !== 0) ||
    typeof value.decision !== 'string' || value.decision.length < 20 ||
    !Array.isArray(value.exclusions) || value.exclusions.length < 5 ||
    new Set(value.exclusions).size !== value.exclusions.length ||
    bytes.length > 32 * 1024
  ) {
    throw new Error('story_corpus_product_acceptance_invalid');
  }
  return value;
}

function main() {
  const acceptancePath = path.join(REPO_ROOT, ACCEPTANCE_REL);
  const acceptanceBytes = fs.readFileSync(acceptancePath);
  const acceptance = validateAcceptance(JSON.parse(acceptanceBytes.toString('utf8')), acceptanceBytes);
  const corpusPath = path.resolve(REPO_ROOT, acceptance.corpusManifestPath);
  const corpusBytes = fs.readFileSync(corpusPath);
  if (sha256(corpusBytes) !== acceptance.corpusManifestSha256) {
    throw new Error('story_corpus_product_acceptance_manifest_drift');
  }
  const corpus = JSON.parse(corpusBytes.toString('utf8'));
  if (
    corpus.version !== EXPECTED_CORPUS_VERSION ||
    corpus.status !== 'pending_independent_artifact_audit' ||
    corpus.authorityScope !== 'story_text_candidates_only' ||
    corpus.candidateCount !== 17 ||
    !Array.isArray(corpus.records) || corpus.records.length !== 17 ||
    new Set(corpus.records.map(({ briefId }) => briefId)).size !== 17 ||
    new Set(corpus.records.map(({ slot }) => slot)).size !== 17
  ) {
    throw new Error('story_corpus_product_acceptance_corpus_invalid');
  }

  const authority = loadStoryArchitectAuthority();
  const manifests = [];
  for (const corpusRecord of corpus.records) {
    const record = findRecord(authority.commissionAuthority, corpusRecord.briefId);
    const sourceDir = path.join(path.dirname(corpusPath), corpusRecord.slot);
    const storyPath = path.join(sourceDir, 'story.md');
    const reviewPath = path.join(sourceDir, 'editorial-review.json');
    const storyBytes = fs.readFileSync(storyPath);
    const reviewBytes = fs.readFileSync(reviewPath);
    if (
      sha256(storyBytes) !== corpusRecord.storySha256 ||
      sha256(reviewBytes) !== corpusRecord.reviewSha256
    ) {
      throw new Error('story_corpus_product_acceptance_record_drift');
    }
    const review = validateEditorialReviewResult(
      JSON.parse(reviewBytes.toString('utf8')),
      record.brief.pageCount,
    );
    const outputDir = path.join(ACCEPTED_ROOT, corpusRecord.slot);
    const syntheticApproval = {
      version: 'small-heroes-story-product-acceptance/v1',
      status: 'accepted',
      briefId: corpusRecord.briefId,
      acceptedBy: acceptance.acceptedBy,
      acceptedOn: acceptance.acceptedOn,
      acceptanceScope: acceptance.acceptanceScope,
      storySha256: corpusRecord.storySha256,
      editorialReviewSha256: corpusRecord.reviewSha256,
      independentArtifactAudit: {
        status: 'pass',
        reviewedHead: acceptance.independentArtifactAudit.reviewedHead,
        blocker: 0,
        major: 0,
        minor: 0,
      },
      decision: acceptance.decision,
      exclusions: acceptance.exclusions,
    };
    manifests.push(writeProductAcceptedStorySource(
      record,
      {
        absolutePath: storyPath,
        relativePath: path.relative(REPO_ROOT, storyPath).replace(/\\/g, '/'),
        bytes: storyBytes.length,
        text: storyBytes.toString('utf8'),
        sha256: corpusRecord.storySha256,
      },
      {
        absolutePath: reviewPath,
        relativePath: path.relative(REPO_ROOT, reviewPath).replace(/\\/g, '/'),
        bytes: reviewBytes.length,
        sha256: corpusRecord.reviewSha256,
        review,
      },
      {
        absolutePath: acceptancePath,
        relativePath: ACCEPTANCE_REL,
        bytes: acceptanceBytes.length,
        sha256: sha256(acceptanceBytes),
        approval: syntheticApproval,
      },
      outputDir,
    ));
  }

  process.stdout.write(`${JSON.stringify({
    version: 'small-heroes-product-accepted-story-corpus/v1',
    status: 'product_accepted_story_sources',
    acceptedCount: manifests.length,
    completeSlotCount: manifests.length + 1,
    acceptancePath: ACCEPTANCE_REL,
  }, null, 2)}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { validateAcceptance };
