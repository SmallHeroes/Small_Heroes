#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const materializer = require('./materialize-story-source-revision.cjs');
const acceptedV3 = require('./story-source-visual-direction-acceptance-lifecycle.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUTS_ROOT_RELATIVE = 'outputs';
const APPROVAL_ROOT_RELATIVE =
  'story-pipeline/04_approved_story_sources/approvals';
const ACCEPTED_ROOT_RELATIVE =
  'story-pipeline/04_approved_story_sources/accepted';
const DECISION_VERSION =
  'small-heroes-story-source-visual-direction-correction-product-decision/v2';
const COWORK_REVIEW_VERSION =
  'small-heroes-story-source-visual-direction-correction-cowork-review/v1';
const TECHNICAL_REVIEW_VERSION =
  'small-heroes-story-source-visual-direction-correction-technical-review/v2';
const PRODUCT_ACCEPTANCE_VERSION =
  'small-heroes-story-source-visual-direction-correction-product-acceptance/v2';
const REVISION_IDENTITY_VERSION =
  'small-heroes-story-source-visual-direction-correction-identity/v1';
const ACCEPTED_REVISION_VERSION =
  'small-heroes-product-accepted-story-source-revision-manifest/v4';
const CORRECTION_BATCH_VERSION =
  'small-heroes-story-source-visual-direction-correction-candidate-batch/v1';
const AUTHORITY_SCOPE = 'story_source_and_visual_directions_only';
const EXPECTED_BATCH = Object.freeze({
  bytes: 353307,
  digest: '96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b',
  path:
    'outputs/r3b1a-story-source-visual-direction-correction-candidates/' +
    '96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b.json',
  sha256: 'd8a57650364d62cfc52496b1385ba5dd95fe702f06edf51ff327ae5a43caba4c',
});
const EXPECTED_PACKET = Object.freeze({
  bytes: 18413,
  gitCommit: '19f110f414ec70cd64e96be3b0a99132bb4ef8b9',
  path:
    'docs/ai-workflow/' +
    'R3B1A_STORY_SOURCE_VISUAL_DIRECTION_PRODUCT_DECISION_PACKET.md',
  sha256: 'cbe65b9687d04bba5fdf691a4a0f0275297bc79e5195d8eb0d68a36e9deb3d78',
});
const EXPECTED_CANDIDATE_QA = Object.freeze({
  baseCommit: '462aaf4c19c7e8809284a96579fb993400e5a593',
  headCommit: '85ef104cd7765a3e0376bb5ec84a72e75103d9c8',
  p0: 0,
  p1: 0,
  p2: 3,
  reviewer: 'Claude Code',
  status: 'pass',
});
const EXPECTED_CANDIDATE_QA_CLOSEOUT = Object.freeze({
  baseCommit: 'e7c7bf4a3dda1e06a692802000a0a93cb1646bd0',
  closes: {
    baseCommit: EXPECTED_CANDIDATE_QA.baseCommit,
    headCommit: EXPECTED_CANDIDATE_QA.headCommit,
    p0: 0,
    p1: 0,
    p2: 3,
  },
  headCommit: 'e1df111f9b956fa360a03d53ef0bfc438bb29c2c',
  p0: 0,
  p1: 0,
  p2: 0,
  reviewer: 'Claude Code',
  status: 'pass',
});
const EXPECTED_PACKET_QA = Object.freeze({
  baseCommit: 'ad54e3c1929e9ca235131b3a559dd4f30403c4f7',
  headCommit: '19f110f414ec70cd64e96be3b0a99132bb4ef8b9',
  p0: 0,
  p1: 0,
  p2: 0,
  reviewer: 'Claude Code',
  status: 'pass',
});
const EXPECTED_ACCEPTED_DECISION_IDS = Object.freeze([
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P7',
  'P8',
]);
const EXPECTED_CORRECTION_DIRECTIONS = Object.freeze([
  ['D1', 'APPROVE'],
  ['D2', 'APPROVE'],
  ['D3', 'APPROVE'],
  ['D4', 'APPROVE_PROJECTED_AGREEMENT'],
  ['D5', 'FEMALE_FROG'],
  ['D6', 'D6A_STORM_STRIPES_PURPLE_ORANGE_GOLD_OVERLAY'],
  ['D7', 'SECURED_AT_SIDE'],
  ['D8', 'ONE_BOLT'],
  ['D9', 'EXPLICIT_EXITS'],
  ['D10', 'HEAD_TO_LAP_ON_PAGE_7'],
  ['D11', 'INDEPENDENT_STAGE_PROP'],
  ['D12', 'MALE_CREATURE'],
  ['D13', 'STORY_SCARF_VISIBLE_SHIRT_RETURNED'],
]);
const SHA256_HEX = /^[a-f0-9]{64}$/;
const COMMIT_HEX = /^[a-f0-9]{40}$/;
const SAFE_SEGMENT = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;
const WORLD_MODES = new Set([
  'fantastical',
  'grounded',
  'grounded_with_visual_metaphor',
]);
const RUNTIME_ELIGIBILITY = Object.freeze({
  eligible: false,
  reason: 'accepted_story_source_requires_fresh_visual_contract',
});
const EXCLUSIONS = Object.freeze([
  'blueprint',
  'deployment',
  'image_render',
  'narration_human_ear',
  'production',
  'provider_call',
  'runtime_locator',
  'story_bank_current_pointer',
  'visual_contract',
  'visual_package',
  'wizard',
]);
const EXPECTED_INVENTORY = Object.freeze([
  'correction-candidate.json',
  'correction-manifest.json',
  'correction-request.json',
  'direction-migration.json',
  'integrated.md',
  'manifest.json',
  'product-acceptance.json',
  'product-decision.json',
  'revision-identity.json',
  'story.md',
  'technical-review.json',
  'visual-directions.json',
]);

const safety = acceptedV3.publicationSafetyKernel;
if (
  safety?.version !==
  'small-heroes-story-source-publication-safety-kernel/v1'
) {
  throw new Error('story_correction_acceptance_safety_kernel_invalid');
}

function fail(code) {
  throw new Error(code);
}

function pathsEqual(left, right) {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function canonicalizeCompact(value) {
  if (typeof value === 'string') return value.normalize('NFC');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('story_correction_digest_invalid');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalizeCompact);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      const normalizedKey = key.normalize('NFC');
      if (Object.hasOwn(result, normalizedKey)) {
        fail('story_correction_digest_invalid');
      }
      result[normalizedKey] = canonicalizeCompact(value[key]);
    }
    return result;
  }
  fail('story_correction_digest_invalid');
}

function compactDigestIsCanonical(value) {
  if (!value || typeof value !== 'object' || !SHA256_HEX.test(value.digest)) {
    return false;
  }
  const { digest, ...payload } = value;
  return (
    createHash('sha256')
      .update(JSON.stringify(canonicalizeCompact(payload)))
      .digest('hex') === digest
  );
}

function materializerDigestIsCanonical(value) {
  if (!value || typeof value !== 'object' || !SHA256_HEX.test(value.digest)) {
    return false;
  }
  const { digest, ...payload } = value;
  return materializer.sha256(materializer.canonicalBytes(payload)) === digest;
}

function validateDescriptor(value, code, options = {}) {
  const expectedKeys = options.digest
    ? ['bytes', 'digest', 'path', 'sha256']
    : ['bytes', 'path', 'sha256'];
  if (
    !safety.exactKeys(value, expectedKeys) ||
    !safety.canonicalRepoRelativePathIsValid(value.path) ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 1 ||
    !SHA256_HEX.test(value.sha256) ||
    (options.digest && !SHA256_HEX.test(value.digest))
  ) {
    fail(code);
  }
  return value;
}

function readCanonicalJsonFile({
  repoRoot,
  descriptor,
  allowedRoot,
  maximumBytes,
  code,
}) {
  const file = safety.readContainedRegularFile({
    repoRoot,
    relativePath: descriptor.path,
    allowedRoot,
    maximumBytes,
    code,
  });
  if (
    file.bytes.length !== descriptor.bytes ||
    file.sha256 !== descriptor.sha256
  ) {
    fail(code);
  }
  const value = safety.parseJson(file.bytes, code);
  const expectedBytes = Buffer.from(materializer.canonicalBytes(value), 'utf8');
  if (!file.bytes.equals(expectedBytes)) fail(`${code}_not_canonical`);
  return { file, value };
}

function readCanonicalJsonPath({
  repoRoot,
  relativePath,
  allowedRoot,
  maximumBytes,
  code,
}) {
  const file = safety.readContainedRegularFile({
    repoRoot,
    relativePath,
    allowedRoot,
    maximumBytes,
    code,
  });
  const value = safety.parseJson(file.bytes, code);
  const expectedBytes = Buffer.from(materializer.canonicalBytes(value), 'utf8');
  if (!file.bytes.equals(expectedBytes)) fail(`${code}_not_canonical`);
  return { file, value };
}

function validateQaRange(value, code) {
  if (
    !safety.exactKeys(value, [
      'baseCommit',
      'headCommit',
      'p0',
      'p1',
      'p2',
      'reviewer',
      'status',
    ]) ||
    value.status !== 'pass' ||
    value.reviewer !== 'Claude Code' ||
    !COMMIT_HEX.test(value.baseCommit) ||
    !COMMIT_HEX.test(value.headCommit) ||
    value.baseCommit === value.headCommit ||
    value.p0 !== 0 ||
    value.p1 !== 0 ||
    !Number.isSafeInteger(value.p2) ||
    value.p2 < 0
  ) {
    fail(code);
  }
  return value;
}

function validateQaCloseout(value, code) {
  if (
    !safety.exactKeys(value, [
      'baseCommit',
      'closes',
      'headCommit',
      'p0',
      'p1',
      'p2',
      'reviewer',
      'status',
    ]) ||
    !value.closes ||
    typeof value.closes !== 'object' ||
    Array.isArray(value.closes) ||
    !safety.exactKeys(value.closes, [
      'baseCommit',
      'headCommit',
      'p0',
      'p1',
      'p2',
    ])
  ) {
    fail(code);
  }
  const { closes, ...review } = value;
  validateQaRange(review, code);
  if (
    !COMMIT_HEX.test(closes.baseCommit) ||
    !COMMIT_HEX.test(closes.headCommit) ||
    closes.baseCommit === closes.headCommit ||
    !Number.isSafeInteger(closes.p0) ||
    !Number.isSafeInteger(closes.p1) ||
    !Number.isSafeInteger(closes.p2) ||
    closes.p0 < 0 ||
    closes.p1 < 0 ||
    closes.p2 < 0
  ) {
    fail(code);
  }
  return value;
}

function validateContinuityIntent(value, code) {
  if (
    !safety.exactKeys(value, [
      'childWardrobeAuthority',
      'childWardrobeTransitionPages',
      'companionAccessoryAuthority',
      'companionAppearanceAuthority',
      'companionStateTransitionPages',
      'version',
    ]) ||
    value.version !== 'small-heroes-story-visual-continuity-intent/v1' ||
    value.childWardrobeAuthority !== 'frozen_visual_contract' ||
    value.companionAccessoryAuthority !== 'canonical_companion_profile' ||
    value.companionAppearanceAuthority !== 'frozen_companion_state'
  ) {
    fail(code);
  }
  for (const field of [
    'childWardrobeTransitionPages',
    'companionStateTransitionPages',
  ]) {
    const pages = value[field];
    if (
      !Array.isArray(pages) ||
      pages.some((page) => !Number.isSafeInteger(page) || page < 1) ||
      JSON.stringify(pages) !==
        JSON.stringify([...new Set(pages)].sort((left, right) => left - right))
    ) {
      fail(code);
    }
  }
  return value;
}

function validateCoworkReference(value, code) {
  if (safety.exactKeys(value, ['status'])) {
    if (value.status !== 'not_required') fail(code);
    return value;
  }
  if (
    !safety.exactKeys(value, ['review', 'status']) ||
    value.status !== 'passed' ||
    !validateDescriptor(value.review, code, { digest: true })
  ) {
    fail(code);
  }
  return value;
}

function validateAcceptedIntent(value) {
  if (
    !safety.exactKeys(value, [
      'continuityIntent',
      'coworkReview',
      'decisionId',
      'disposition',
      'recordDigest',
      'storyCandidateSha256',
      'storyKey',
      'visualDirectionCandidateSha256',
      'worldMode',
    ]) ||
    !/^P[1-9][0-9]*$/.test(value.decisionId) ||
    value.disposition !== 'acceptance_intent' ||
    !SAFE_SEGMENT.test(value.storyKey) ||
    !SHA256_HEX.test(value.recordDigest) ||
    !SHA256_HEX.test(value.storyCandidateSha256) ||
    !SHA256_HEX.test(value.visualDirectionCandidateSha256) ||
    !WORLD_MODES.has(value.worldMode)
  ) {
    fail('story_correction_product_decision_invalid');
  }
  validateContinuityIntent(
    value.continuityIntent,
    'story_correction_product_decision_invalid',
  );
  validateCoworkReference(
    value.coworkReview,
    'story_correction_product_decision_invalid',
  );
  return value;
}

function uniqueBy(values, field) {
  return new Set(values.map((value) => value[field])).size === values.length;
}

function validateProductDecision(value) {
  if (
    !safety.exactKeys(value, [
      'acceptedIntents',
      'candidateBatch',
      'candidateTechnicalQa',
      'candidateTechnicalQaCloseout',
      'correctionDirections',
      'coworkReferrals',
      'decidedBy',
      'decisionText',
      'digest',
      'digestAlgorithm',
      'exclusions',
      'narration',
      'packet',
      'packetPlanningQa',
      'publication',
      'status',
      'version',
    ]) ||
    value.version !== DECISION_VERSION ||
    value.status !== 'approved_for_correction_acceptance_preparation' ||
    value.decidedBy !== 'Guy' ||
    typeof value.decisionText !== 'string' ||
    value.decisionText.trim() !== value.decisionText ||
    value.decisionText.length < 64 ||
    value.decisionText.length > 4000 ||
    !Array.isArray(value.acceptedIntents) ||
    value.acceptedIntents.length < 1 ||
    !value.acceptedIntents.every((entry) => {
      validateAcceptedIntent(entry);
      return true;
    }) ||
    !uniqueBy(value.acceptedIntents, 'decisionId') ||
    !uniqueBy(value.acceptedIntents, 'storyKey') ||
    JSON.stringify(value.acceptedIntents.map((entry) => entry.decisionId)) !==
      JSON.stringify(EXPECTED_ACCEPTED_DECISION_IDS) ||
    !Array.isArray(value.coworkReferrals) ||
    !value.coworkReferrals.every(
      (entry) =>
        safety.exactKeys(entry, [
          'decisionId',
          'recordDigest',
          'status',
          'storyKey',
        ]) &&
        /^P[1-9][0-9]*$/.test(entry.decisionId) &&
        entry.status === 'referred_not_accepted' &&
        SAFE_SEGMENT.test(entry.storyKey) &&
        SHA256_HEX.test(entry.recordDigest),
    ) ||
    !uniqueBy(value.coworkReferrals, 'decisionId') ||
    !uniqueBy(value.coworkReferrals, 'storyKey') ||
    value.coworkReferrals.length !== 1 ||
    value.coworkReferrals[0].decisionId !== 'P6' ||
    value.coworkReferrals[0].storyKey !== 'lion_shaket_adventure' ||
    value.coworkReferrals[0].recordDigest !==
      'e10757db73cfb1c9a9ef49cc24ff7f0a32a6b83ff4197dc172cb4f72e760ee40' ||
    !Array.isArray(value.correctionDirections) ||
    value.correctionDirections.length < 1 ||
    !value.correctionDirections.every(
      (entry) =>
        safety.exactKeys(entry, ['decisionId', 'selection']) &&
        /^D[1-9][0-9]*$/.test(entry.decisionId) &&
        typeof entry.selection === 'string' &&
        entry.selection.trim() === entry.selection &&
        entry.selection.length >= 2 &&
        entry.selection.length <= 80,
    ) ||
    !uniqueBy(value.correctionDirections, 'decisionId') ||
    JSON.stringify(
      value.correctionDirections.map((entry) => [
        entry.decisionId,
        entry.selection,
      ]),
    ) !== JSON.stringify(EXPECTED_CORRECTION_DIRECTIONS) ||
    !safety.exactKeys(value.packet, [
      'bytes',
      'gitCommit',
      'path',
      'sha256',
    ]) ||
    !validateDescriptor(
      {
        path: value.packet.path,
        bytes: value.packet.bytes,
        sha256: value.packet.sha256,
      },
      'story_correction_product_decision_invalid',
    ) ||
    !COMMIT_HEX.test(value.packet.gitCommit) ||
    !validateDescriptor(
      value.candidateBatch,
      'story_correction_product_decision_invalid',
      { digest: true },
    ) ||
    !validateQaRange(
      value.candidateTechnicalQa,
      'story_correction_product_decision_invalid',
    ) ||
    !validateQaCloseout(
      value.candidateTechnicalQaCloseout,
      'story_correction_product_decision_invalid',
    ) ||
    !validateQaRange(
      value.packetPlanningQa,
      'story_correction_product_decision_invalid',
    ) ||
    !safety.exactKeys(value.narration, ['status']) ||
    value.narration.status !== 'separate_human_ear_gate_pending' ||
    !safety.exactKeys(value.publication, ['status']) ||
    value.publication.status !== 'final_digest_confirmation_pending' ||
    JSON.stringify(value.exclusions) !== JSON.stringify(EXCLUSIONS) ||
    JSON.stringify(value.candidateBatch) !== JSON.stringify(EXPECTED_BATCH) ||
    JSON.stringify(value.packet) !== JSON.stringify(EXPECTED_PACKET) ||
    JSON.stringify(value.candidateTechnicalQa) !==
      JSON.stringify(EXPECTED_CANDIDATE_QA) ||
    JSON.stringify(value.candidateTechnicalQaCloseout) !==
      JSON.stringify(EXPECTED_CANDIDATE_QA_CLOSEOUT) ||
    JSON.stringify(value.packetPlanningQa) !==
      JSON.stringify(EXPECTED_PACKET_QA) ||
    !safety.digestIsCanonical(value)
  ) {
    fail('story_correction_product_decision_invalid');
  }
  return value;
}

function loadProductDecision(decisionPath, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const decisionRoot = roots.approvalRootRelative || APPROVAL_ROOT_RELATIVE;
  const loaded = readCanonicalJsonPath({
    repoRoot,
    relativePath: decisionPath,
    allowedRoot: decisionRoot,
    maximumBytes: 256 * 1024,
    code: 'story_correction_product_decision_invalid',
  });
  return { ...loaded, decision: validateProductDecision(loaded.value) };
}

function readBoundPacket(decision, repoRoot) {
  const packet = safety.readContainedRegularFile({
    repoRoot,
    relativePath: decision.packet.path,
    allowedRoot: 'docs/ai-workflow',
    maximumBytes: 128 * 1024,
    code: 'story_correction_packet_invalid',
  });
  if (
    packet.bytes.length !== decision.packet.bytes ||
    packet.sha256 !== decision.packet.sha256
  ) {
    fail('story_correction_packet_invalid');
  }
  return packet;
}

function loadCandidateBatch(decision, repoRoot, outputsRoot) {
  const loaded = readCanonicalJsonFile({
    repoRoot,
    descriptor: decision.candidateBatch,
    allowedRoot: outputsRoot,
    maximumBytes: 512 * 1024,
    code: 'story_correction_candidate_batch_invalid',
  });
  const batch = loaded.value;
  if (
    batch.version !== CORRECTION_BATCH_VERSION ||
    batch.status !==
      'pending_exact_product_visual_narration_and_technical_review' ||
    batch.runtimeEligible !== false ||
    batch.productionEligible !== false ||
    batch.digest !== decision.candidateBatch.digest ||
    !compactDigestIsCanonical(batch) ||
    !Array.isArray(batch.records)
  ) {
    fail('story_correction_candidate_batch_invalid');
  }
  return { ...loaded, batch };
}

function validateCandidateRecord(record, intent, decision) {
  if (
    !record ||
    record.storyKey !== intent.storyKey ||
    record.digest !== intent.recordDigest ||
    !compactDigestIsCanonical(record) ||
    record.status !== 'pending_exact_product_and_visual_review' ||
    record.runtimeEligible !== false ||
    record.productionEligible !== false ||
    record.worldModeRecommendation?.value !== intent.worldMode ||
    JSON.stringify(record.continuityIntent) !==
      JSON.stringify(intent.continuityIntent) ||
    record.candidateOutputs?.acceptedStory?.sha256 !==
      intent.storyCandidateSha256 ||
    record.candidateOutputs?.visualDirection?.sha256 !==
      intent.visualDirectionCandidateSha256 ||
    !Array.isArray(record.unresolvedCreativeSourceIssues) ||
    record.unresolvedCreativeSourceIssues.length !== 0 ||
    !Array.isArray(record.protectedAuthorityIssues) ||
    record.protectedAuthorityIssues.length !== 0
  ) {
    fail('story_correction_candidate_record_invalid');
  }
  const coworkRequired =
    record.reviewRequirements?.storyQuality === 'pending_claude_cowork';
  if (coworkRequired && intent.coworkReview.status !== 'passed') {
    fail('story_correction_cowork_review_required');
  }
  if (!coworkRequired && intent.coworkReview.status !== 'not_required') {
    fail('story_correction_cowork_review_invalid');
  }
  if (
    decision.coworkReferrals.some(
      (entry) => entry.storyKey === record.storyKey,
    )
  ) {
    fail('story_correction_candidate_not_accepted');
  }
  return record;
}

function loadCoworkReview(intent, record, repoRoot, approvalRoot) {
  if (intent.coworkReview.status === 'not_required') return null;
  const loaded = readCanonicalJsonFile({
    repoRoot,
    descriptor: intent.coworkReview.review,
    allowedRoot: approvalRoot,
    maximumBytes: 128 * 1024,
    code: 'story_correction_cowork_review_invalid',
  });
  const review = loaded.value;
  if (
    !safety.exactKeys(review, [
      'decision',
      'digest',
      'digestAlgorithm',
      'recordDigest',
      'reviewer',
      'status',
      'storyKey',
      'version',
    ]) ||
    review.version !== COWORK_REVIEW_VERSION ||
    review.status !== 'pass' ||
    review.reviewer !== 'Claude Cowork' ||
    review.storyKey !== record.storyKey ||
    review.recordDigest !== record.digest ||
    typeof review.decision !== 'string' ||
    review.decision.trim().length < 8 ||
    !safety.digestIsCanonical(review) ||
    review.digest !== intent.coworkReview.review.digest
  ) {
    fail('story_correction_cowork_review_invalid');
  }
  return loaded;
}

function candidateOutputDescriptor(record, key, code) {
  const value = record.candidateOutputs?.[key];
  if (
    !value ||
    typeof value.filename !== 'string' ||
    path.posix.basename(value.filename) !== value.filename ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 1 ||
    !SHA256_HEX.test(value.sha256)
  ) {
    fail(code);
  }
  return value;
}

function readCandidateOutput({
  repoRoot,
  outputsRoot,
  candidateDirectory,
  descriptor,
  code,
}) {
  const file = safety.readContainedRegularFile({
    repoRoot,
    relativePath: `${candidateDirectory}/${descriptor.filename}`,
    allowedRoot: outputsRoot,
    maximumBytes: 512 * 1024,
    code,
  });
  if (
    file.bytes.length !== descriptor.bytes ||
    file.sha256 !== descriptor.sha256
  ) {
    fail(code);
  }
  return file;
}

function loadMaterializedCandidate({
  repoRoot,
  outputsRoot,
  pendingManifestPath,
  record,
}) {
  const requestPath = record.request?.identityPath;
  if (
    !record.request ||
    !safety.canonicalRepoRelativePathIsValid(requestPath) ||
    !Number.isSafeInteger(record.request.bytes) ||
    record.request.bytes < 1 ||
    !SHA256_HEX.test(record.request.sha256)
  ) {
    fail('story_correction_candidate_request_invalid');
  }
  const requestDirectory = path.posix.dirname(requestPath);
  const candidateDirectory = `${requestDirectory}/candidate`;
  const manifestDescriptor = candidateOutputDescriptor(
    record,
    'manifest',
    'story_correction_candidate_manifest_invalid',
  );
  const expectedManifestPath =
    `${candidateDirectory}/${manifestDescriptor.filename}`;
  if (pendingManifestPath !== expectedManifestPath) {
    fail('story_correction_candidate_manifest_path_invalid');
  }
  const requestDescriptor = {
    path: requestPath,
    bytes: record.request.bytes,
    sha256: record.request.sha256,
  };
  const requestLoaded = readCanonicalJsonFile({
    repoRoot,
    descriptor: requestDescriptor,
    allowedRoot: outputsRoot,
    maximumBytes: 128 * 1024,
    code: 'story_correction_candidate_request_invalid',
  });
  const request = materializer.validateRequest(requestLoaded.value);
  if (
    request.version !== materializer.CORRECTION_REQUEST_VERSION ||
    request.storyKey !== record.storyKey ||
    JSON.stringify(request) !== JSON.stringify(record.request.payload)
  ) {
    fail('story_correction_candidate_request_invalid');
  }
  const story = readCandidateOutput({
    repoRoot,
    outputsRoot,
    candidateDirectory,
    descriptor: candidateOutputDescriptor(
      record,
      'acceptedStory',
      'story_correction_candidate_story_invalid',
    ),
    code: 'story_correction_candidate_story_invalid',
  });
  const visualDirections = readCandidateOutput({
    repoRoot,
    outputsRoot,
    candidateDirectory,
    descriptor: candidateOutputDescriptor(
      record,
      'visualDirection',
      'story_correction_candidate_direction_invalid',
    ),
    code: 'story_correction_candidate_direction_invalid',
  });
  const integrated = readCandidateOutput({
    repoRoot,
    outputsRoot,
    candidateDirectory,
    descriptor: candidateOutputDescriptor(
      record,
      'integratedStory',
      'story_correction_candidate_integrated_invalid',
    ),
    code: 'story_correction_candidate_integrated_invalid',
  });
  const migration = readCandidateOutput({
    repoRoot,
    outputsRoot,
    candidateDirectory,
    descriptor: candidateOutputDescriptor(
      record,
      'directionMigration',
      'story_correction_candidate_migration_invalid',
    ),
    code: 'story_correction_candidate_migration_invalid',
  });
  const manifest = readCandidateOutput({
    repoRoot,
    outputsRoot,
    candidateDirectory,
    descriptor: manifestDescriptor,
    code: 'story_correction_candidate_manifest_invalid',
  });
  const manifestValue = safety.parseJson(
    manifest.bytes,
    'story_correction_candidate_manifest_invalid',
  );
  const migrationValue = safety.parseJson(
    migration.bytes,
    'story_correction_candidate_migration_invalid',
  );
  if (
    !manifest.bytes.equals(
      Buffer.from(materializer.canonicalBytes(manifestValue), 'utf8'),
    ) ||
    manifestValue.version !== materializer.CORRECTION_MANIFEST_VERSION ||
    manifestValue.status !== 'pending_exact_product_review' ||
    manifestValue.storyKey !== record.storyKey ||
    manifestValue.digest !== record.sourceRevisionManifest.digest ||
    !materializerDigestIsCanonical(manifestValue) ||
    !migration.bytes.equals(
      Buffer.from(materializer.canonicalBytes(migrationValue), 'utf8'),
    ) ||
    migrationValue.version !==
      materializer.CORRECTION_DIRECTION_MIGRATION_VERSION ||
    migrationValue.status !== 'pending_exact_review' ||
    migrationValue.storyKey !== record.storyKey ||
    migrationValue.digest !==
      record.candidateOutputs.directionMigration.digest ||
    !materializerDigestIsCanonical(migrationValue)
  ) {
    fail('story_correction_candidate_manifest_invalid');
  }
  const dryRun = materializer.buildStorySourceRevision({
    requestFile: {
      bytes: requestLoaded.file.bytes,
      relativePath: requestLoaded.file.relativePath,
      request,
      sha256: requestLoaded.file.sha256,
    },
    outputDir: path.resolve(repoRoot, ...candidateDirectory.split('/')),
    write: false,
  });
  if (
    dryRun.created !== false ||
    materializer.canonicalBytes(dryRun.manifest) !==
      materializer.canonicalBytes(manifestValue)
  ) {
    fail('story_correction_candidate_replay_invalid');
  }
  return {
    candidateDirectory,
    request: requestLoaded,
    story,
    visualDirections,
    integrated,
    migration: { file: migration, value: migrationValue },
    manifest: { file: manifest, value: manifestValue },
  };
}

function buildRecordDecision(decision, intent) {
  return safety.attachDigest({
    version:
      'small-heroes-story-source-visual-direction-correction-record-decision/v1',
    status: 'acceptance_intent',
    authorityScope: AUTHORITY_SCOPE,
    packet: {
      gitCommit: decision.packet.gitCommit,
      sha256: decision.packet.sha256,
    },
    candidateBatch: {
      digest: decision.candidateBatch.digest,
      sha256: decision.candidateBatch.sha256,
    },
    acceptedIntent: intent,
  });
}

function buildRevisionIdentity({ decision, intent, record, candidate }) {
  const recordDecision = buildRecordDecision(decision, intent);
  const identity = safety.attachDigest({
    version: REVISION_IDENTITY_VERSION,
    authorityScope: AUTHORITY_SCOPE,
    storyKey: record.storyKey,
    candidateBatch: {
      digest: decision.candidateBatch.digest,
      rawSha256: decision.candidateBatch.sha256,
    },
    candidateRecordDigest: record.digest,
    recordDecisionDigest: recordDecision.digest,
    acceptedWorldMode: intent.worldMode,
    continuityIntent: intent.continuityIntent,
    sourceRevision: record.sourceRevisionManifest.inputs.acceptedStory,
    correction: {
      pendingManifestDigest: candidate.manifest.value.digest,
      requestSha256: candidate.request.file.sha256,
      directionMigrationDigest: candidate.migration.value.digest,
    },
    outputs: {
      storySha256: candidate.story.sha256,
      visualDirectionsSha256: candidate.visualDirections.sha256,
      integratedStorySha256: candidate.integrated.sha256,
    },
  });
  return { identity, recordDecision };
}

function inspect({ decisionPath, pendingManifestPath }, roots = {}) {
  const repoRoot = path.resolve(roots.repoRoot || REPO_ROOT);
  if (!pathsEqual(repoRoot, REPO_ROOT)) {
    fail('story_correction_acceptance_repo_root_invalid');
  }
  const outputsRoot = roots.outputsRootRelative || OUTPUTS_ROOT_RELATIVE;
  const approvalRoot = roots.approvalRootRelative || APPROVAL_ROOT_RELATIVE;
  const decisionLoaded = loadProductDecision(decisionPath, {
    repoRoot,
    approvalRootRelative: approvalRoot,
  });
  readBoundPacket(decisionLoaded.decision, repoRoot);
  const batchLoaded = loadCandidateBatch(
    decisionLoaded.decision,
    repoRoot,
    outputsRoot,
  );
  const matches = [];
  for (const intent of decisionLoaded.decision.acceptedIntents) {
    for (const record of batchLoaded.batch.records.filter(
      (entry) => entry.storyKey === intent.storyKey,
    )) {
      const manifest = candidateOutputDescriptor(
        record,
        'manifest',
        'story_correction_candidate_record_invalid',
      );
      const expectedPath =
        `${path.posix.dirname(record.request?.identityPath || '')}/candidate/` +
        manifest.filename;
      if (pendingManifestPath === expectedPath) {
        matches.push({ intent, record });
      }
    }
  }
  if (matches.length === 0) fail('story_correction_candidate_not_accepted');
  if (matches.length !== 1) {
    fail('story_correction_candidate_record_invalid');
  }
  const { intent } = matches[0];
  const record = validateCandidateRecord(
    matches[0].record,
    intent,
    decisionLoaded.decision,
  );
  const coworkReview = loadCoworkReview(
    intent,
    record,
    repoRoot,
    approvalRoot,
  );
  const candidate = loadMaterializedCandidate({
    repoRoot,
    outputsRoot,
    pendingManifestPath,
    record,
  });
  const { identity, recordDecision } = buildRevisionIdentity({
    decision: decisionLoaded.decision,
    intent,
    record,
    candidate,
  });
  return {
    version: ACCEPTED_REVISION_VERSION,
    status: 'pending_implementation_technical_review_and_final_confirmation',
    storyKey: record.storyKey,
    candidateBatchDigest: batchLoaded.batch.digest,
    candidateRecordDigest: record.digest,
    productDecisionDigest: decisionLoaded.decision.digest,
    recordDecisionDigest: recordDecision.digest,
    revisionDigest: identity.digest,
    acceptedWorldMode: intent.worldMode,
    runtimeEligibility: RUNTIME_ELIGIBILITY,
    pendingRequirements: [
      'implementation_technical_review',
      'guy_final_digest_confirmation',
    ],
    externalCounters: {
      providerCalls: 0,
      networkCalls: 0,
      imageRenders: 0,
      audioRenders: 0,
      pdfRenders: 0,
      databaseWrites: 0,
      storageWrites: 0,
      orderWrites: 0,
      paymentWrites: 0,
      deploymentWrites: 0,
    },
    loaded: {
      repoRoot,
      outputsRoot,
      approvalRoot,
      decision: decisionLoaded,
      batch: batchLoaded,
      intent,
      record,
      coworkReview,
      candidate,
      identity,
      recordDecision,
    },
  };
}

function loadTechnicalReview(reviewPath, inspected) {
  const repoRoot = inspected.loaded.repoRoot;
  const loaded = readCanonicalJsonPath({
    repoRoot,
    relativePath: reviewPath,
    allowedRoot: inspected.loaded.outputsRoot,
    maximumBytes: 128 * 1024,
    code: 'story_correction_technical_review_invalid',
  });
  const review = loaded.value;
  if (
    !safety.exactKeys(review, [
      'baseCommit',
      'candidateBatchDigest',
      'digest',
      'digestAlgorithm',
      'headCommit',
      'p0',
      'p1',
      'p2',
      'productDecisionDigest',
      'recordDecisionDigest',
      'reviewer',
      'revisionDigest',
      'status',
      'version',
    ]) ||
    review.version !== TECHNICAL_REVIEW_VERSION ||
    review.status !== 'pass' ||
    review.reviewer !== 'Claude Code' ||
    !COMMIT_HEX.test(review.baseCommit) ||
    !COMMIT_HEX.test(review.headCommit) ||
    review.baseCommit === review.headCommit ||
    review.p0 !== 0 ||
    review.p1 !== 0 ||
    !Number.isSafeInteger(review.p2) ||
    review.p2 < 0 ||
    review.candidateBatchDigest !== inspected.candidateBatchDigest ||
    review.productDecisionDigest !== inspected.productDecisionDigest ||
    review.recordDecisionDigest !== inspected.recordDecisionDigest ||
    review.revisionDigest !== inspected.revisionDigest ||
    !safety.digestIsCanonical(review)
  ) {
    fail('story_correction_technical_review_invalid');
  }
  return { ...loaded, review };
}

function loadProductAcceptance(acceptancePath, inspected, technicalReview) {
  const repoRoot = inspected.loaded.repoRoot;
  const loaded = readCanonicalJsonPath({
    repoRoot,
    relativePath: acceptancePath,
    allowedRoot: inspected.loaded.approvalRoot,
    maximumBytes: 128 * 1024,
    code: 'story_correction_product_acceptance_invalid',
  });
  const acceptance = loaded.value;
  if (
    !safety.exactKeys(acceptance, [
      'acceptedBy',
      'acceptedWorldMode',
      'authorityScope',
      'candidateRecordDigest',
      'decision',
      'digest',
      'digestAlgorithm',
      'exclusions',
      'productDecisionDigest',
      'recordDecisionDigest',
      'revisionDigest',
      'runtimeEligibility',
      'status',
      'storyKey',
      'technicalReviewDigest',
      'version',
    ]) ||
    acceptance.version !== PRODUCT_ACCEPTANCE_VERSION ||
    acceptance.status !== 'accepted' ||
    acceptance.acceptedBy !== 'Guy' ||
    acceptance.authorityScope !== AUTHORITY_SCOPE ||
    acceptance.storyKey !== inspected.storyKey ||
    acceptance.revisionDigest !== inspected.revisionDigest ||
    acceptance.candidateRecordDigest !== inspected.candidateRecordDigest ||
    acceptance.productDecisionDigest !== inspected.productDecisionDigest ||
    acceptance.recordDecisionDigest !== inspected.recordDecisionDigest ||
    acceptance.technicalReviewDigest !== technicalReview.review.digest ||
    acceptance.acceptedWorldMode !== inspected.acceptedWorldMode ||
    typeof acceptance.decision !== 'string' ||
    acceptance.decision.trim() !== acceptance.decision ||
    acceptance.decision.length < 32 ||
    JSON.stringify(acceptance.runtimeEligibility) !==
      JSON.stringify(RUNTIME_ELIGIBILITY) ||
    JSON.stringify(acceptance.exclusions) !== JSON.stringify(EXCLUSIONS) ||
    !safety.digestIsCanonical(acceptance)
  ) {
    fail('story_correction_product_acceptance_invalid');
  }
  return { ...loaded, acceptance };
}

function fileDescriptor(filename, bytes, digest) {
  return {
    filename,
    bytes: bytes.length,
    sha256: materializer.sha256(bytes),
    ...(digest ? { digest } : {}),
  };
}

function buildPublicationBundle(inspected, technicalReview, productAcceptance) {
  const candidate = inspected.loaded.candidate;
  const recordBytes = Buffer.from(
    materializer.canonicalBytes(inspected.loaded.record),
    'utf8',
  );
  const identityBytes = Buffer.from(
    materializer.canonicalBytes(inspected.loaded.identity),
    'utf8',
  );
  const files = new Map([
    ['correction-candidate.json', recordBytes],
    ['correction-manifest.json', candidate.manifest.file.bytes],
    ['correction-request.json', candidate.request.file.bytes],
    ['direction-migration.json', candidate.migration.file.bytes],
    ['integrated.md', candidate.integrated.bytes],
    ['product-acceptance.json', productAcceptance.file.bytes],
    ['product-decision.json', inspected.loaded.decision.file.bytes],
    ['revision-identity.json', identityBytes],
    ['story.md', candidate.story.bytes],
    ['technical-review.json', technicalReview.file.bytes],
    ['visual-directions.json', candidate.visualDirections.bytes],
  ]);
  const manifestPayload = {
    version: ACCEPTED_REVISION_VERSION,
    status: 'product_accepted_story_source_revision',
    authorityScope: AUTHORITY_SCOPE,
    storyKey: inspected.storyKey,
    revisionDigest: inspected.revisionDigest,
    acceptedWorldMode: inspected.acceptedWorldMode,
    sourceGenderMode: 'neutral',
    continuityIntent: inspected.loaded.intent.continuityIntent,
    correctionProvenance: {
      candidateBatchDigest: inspected.candidateBatchDigest,
      candidateBatchRawSha256:
        inspected.loaded.decision.decision.candidateBatch.sha256,
      candidateRecordDigest: inspected.candidateRecordDigest,
      correctionManifestDigest: candidate.manifest.value.digest,
      correctionRequestSha256: candidate.request.file.sha256,
      directionMigrationDigest: candidate.migration.value.digest,
      productDecisionDigest: inspected.productDecisionDigest,
      recordDecisionDigest: inspected.recordDecisionDigest,
      technicalReviewDigest: technicalReview.review.digest,
    },
    productAcceptance: {
      acceptedBy: productAcceptance.acceptance.acceptedBy,
      digest: productAcceptance.acceptance.digest,
    },
    files: {
      correctionCandidate: fileDescriptor(
        'correction-candidate.json',
        recordBytes,
        inspected.candidateRecordDigest,
      ),
      correctionManifest: fileDescriptor(
        'correction-manifest.json',
        candidate.manifest.file.bytes,
        candidate.manifest.value.digest,
      ),
      correctionRequest: fileDescriptor(
        'correction-request.json',
        candidate.request.file.bytes,
      ),
      directionMigration: fileDescriptor(
        'direction-migration.json',
        candidate.migration.file.bytes,
        candidate.migration.value.digest,
      ),
      integratedStory: fileDescriptor('integrated.md', candidate.integrated.bytes),
      productAcceptance: fileDescriptor(
        'product-acceptance.json',
        productAcceptance.file.bytes,
        productAcceptance.acceptance.digest,
      ),
      productDecision: fileDescriptor(
        'product-decision.json',
        inspected.loaded.decision.file.bytes,
        inspected.productDecisionDigest,
      ),
      revisionIdentity: fileDescriptor(
        'revision-identity.json',
        identityBytes,
        inspected.revisionDigest,
      ),
      story: fileDescriptor('story.md', candidate.story.bytes),
      technicalReview: fileDescriptor(
        'technical-review.json',
        technicalReview.file.bytes,
        technicalReview.review.digest,
      ),
      visualDirections: fileDescriptor(
        'visual-directions.json',
        candidate.visualDirections.bytes,
      ),
    },
    runtimeEligibility: RUNTIME_ELIGIBILITY,
    exclusions: [...EXCLUSIONS],
  };
  const manifest = safety.attachDigest(manifestPayload);
  files.set('manifest.json', Buffer.from(materializer.canonicalBytes(manifest), 'utf8'));
  return { files, manifest };
}

function prepare(
  {
    decisionPath,
    pendingManifestPath,
    technicalReviewPath,
    productAcceptancePath,
    outputRoot,
    write = false,
  },
  roots = {},
) {
  const inspected = inspect({ decisionPath, pendingManifestPath }, roots);
  const technicalReview = loadTechnicalReview(
    technicalReviewPath,
    inspected,
  );
  const productAcceptance = loadProductAcceptance(
    productAcceptancePath,
    inspected,
    technicalReview,
  );
  const bundle = buildPublicationBundle(
    inspected,
    technicalReview,
    productAcceptance,
  );
  const outputRootAbsolute = safety.canonicalOutputRoot(
    inspected.loaded.repoRoot,
    outputRoot,
    write,
  );
  const target = path.join(outputRootAbsolute, inspected.revisionDigest);
  let created = false;
  if (write) {
    ({ created } = safety.writeDirectoryAtomically(
      outputRootAbsolute,
      target,
      bundle.files,
      'story_correction_publication_candidate_collision',
    ));
  }
  return {
    version: ACCEPTED_REVISION_VERSION,
    status: 'publication_candidate',
    created,
    storyKey: inspected.storyKey,
    revisionDigest: inspected.revisionDigest,
    manifestDigest: bundle.manifest.digest,
    productAcceptanceDigest: productAcceptance.acceptance.digest,
    technicalReviewDigest: technicalReview.review.digest,
    target: path.relative(inspected.loaded.repoRoot, target).replaceAll('\\', '/'),
    acceptedTarget:
      `${roots.acceptedRootRelative || ACCEPTED_ROOT_RELATIVE}/` +
      `${inspected.storyKey}/revisions/${inspected.revisionDigest}`,
    runtimeEligibility: RUNTIME_ELIGIBILITY,
    externalCounters: inspected.externalCounters,
    bundle,
    inspected,
  };
}

function publish(args, roots = {}) {
  const acceptedRootRelative =
    roots.acceptedRootRelative || ACCEPTED_ROOT_RELATIVE;
  const prepared = prepare({ ...args, write: false }, roots);
  const publicationRoot = safety.canonicalOutputRoot(
    prepared.inspected.loaded.repoRoot,
    args.outputRoot,
    false,
  );
  const publicationTarget = path.join(
    publicationRoot,
    prepared.revisionDigest,
  );
  if (!fs.existsSync(publicationTarget)) {
    fail('story_correction_publication_candidate_missing');
  }
  safety.assertNoLinkComponents(
    path.resolve(
      prepared.inspected.loaded.repoRoot,
      ...prepared.inspected.loaded.outputsRoot.split('/'),
    ),
    publicationTarget,
    'story_correction_publication_candidate_collision',
  );
  safety.assertExistingBundle(
    publicationTarget,
    prepared.bundle.files,
    'story_correction_publication_candidate_collision',
  );
  const accepted = safety.acceptedTarget(
    prepared.inspected.loaded.repoRoot,
    prepared.storyKey,
    prepared.revisionDigest,
    acceptedRootRelative,
    args.write,
  );
  let created = false;
  if (args.write) {
    ({ created } = safety.writeDirectoryAtomically(
      accepted.revisionsRoot,
      accepted.target,
      prepared.bundle.files,
      'story_correction_accepted_revision_collision',
    ));
  } else if (fs.existsSync(accepted.target)) {
    safety.assertExistingBundle(
      accepted.target,
      prepared.bundle.files,
      'story_correction_accepted_revision_collision',
    );
  }
  return {
    version: ACCEPTED_REVISION_VERSION,
    status: 'product_accepted_story_source_revision',
    created,
    wouldCreate: !fs.existsSync(accepted.target),
    storyKey: prepared.storyKey,
    revisionDigest: prepared.revisionDigest,
    manifestDigest: prepared.manifestDigest,
    productAcceptanceDigest: prepared.productAcceptanceDigest,
    technicalReviewDigest: prepared.technicalReviewDigest,
    target: path
      .relative(prepared.inspected.loaded.repoRoot, accepted.target)
      .replaceAll('\\', '/'),
    runtimeEligibility: RUNTIME_ELIGIBILITY,
    externalCounters: prepared.externalCounters,
  };
}

function parseArgs(argv) {
  const command = argv[0];
  if (!['inspect', 'prepare', 'publish'].includes(command)) {
    fail('story_correction_acceptance_arguments_invalid');
  }
  const allowed = new Set([
    '--decision',
    '--output-root',
    '--pending-manifest',
    '--product-acceptance',
    '--technical-review',
    '--write',
  ]);
  const values = new Map();
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      !allowed.has(key) ||
      value === undefined ||
      values.has(key) ||
      key.includes('=')
    ) {
      fail('story_correction_acceptance_arguments_invalid');
    }
    values.set(key, value);
  }
  const inspectKeys = ['--decision', '--pending-manifest'];
  const publicationKeys = [
    '--decision',
    '--output-root',
    '--pending-manifest',
    '--product-acceptance',
    '--technical-review',
    '--write',
  ];
  const expected = command === 'inspect' ? inspectKeys : publicationKeys;
  if (
    JSON.stringify([...values.keys()].sort()) !==
      JSON.stringify([...expected].sort()) ||
    (command !== 'inspect' && !['true', 'false'].includes(values.get('--write')))
  ) {
    fail('story_correction_acceptance_arguments_invalid');
  }
  return command === 'inspect'
    ? {
        command,
        decisionPath: values.get('--decision'),
        pendingManifestPath: values.get('--pending-manifest'),
      }
    : {
        command,
        decisionPath: values.get('--decision'),
        pendingManifestPath: values.get('--pending-manifest'),
        technicalReviewPath: values.get('--technical-review'),
        productAcceptancePath: values.get('--product-acceptance'),
        outputRoot: values.get('--output-root'),
        write: values.get('--write') === 'true',
      };
}

function main(argv) {
  const args = parseArgs(argv);
  const result = args.command === 'inspect'
    ? inspect(args)
    : args.command === 'prepare'
      ? prepare(args)
      : publish(args);
  process.stdout.write(
    `${JSON.stringify({
      version: result.version,
      status: result.status,
      storyKey: result.storyKey,
      revisionDigest: result.revisionDigest,
      ...(result.manifestDigest
        ? { manifestDigest: result.manifestDigest }
        : {}),
      ...(Object.hasOwn(result, 'created') ? { created: result.created } : {}),
      ...(Object.hasOwn(result, 'wouldCreate')
        ? { wouldCreate: result.wouldCreate }
        : {}),
      runtimeEligibility: result.runtimeEligibility,
      ...(result.pendingRequirements
        ? { pendingRequirements: result.pendingRequirements }
        : {}),
      externalCounters: result.externalCounters,
    }, null, 2)}\n`,
  );
}

module.exports = {
  ACCEPTED_REVISION_VERSION,
  AUTHORITY_SCOPE,
  COWORK_REVIEW_VERSION,
  DECISION_VERSION,
  EXPECTED_INVENTORY,
  EXCLUSIONS,
  PRODUCT_ACCEPTANCE_VERSION,
  REVISION_IDENTITY_VERSION,
  RUNTIME_ELIGIBILITY,
  TECHNICAL_REVIEW_VERSION,
  buildPublicationBundle,
  buildRecordDecision,
  inspect,
  parseArgs,
  prepare,
  publish,
  validateProductDecision,
  attachDigest: safety.attachDigest,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error
        ? error.message.split(':')[0]
        : 'story_correction_acceptance_unknown_failure'}\n`,
    );
    process.exitCode = 1;
  }
}
