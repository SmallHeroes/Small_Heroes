#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const materializer = require('./materialize-story-source-revision.cjs');
const editorialContract = require('./story-editorial-validation-contract.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUTS_ROOT_RELATIVE = 'outputs';
const ACCEPTED_ROOT_RELATIVE =
  'story-pipeline/04_approved_story_sources/accepted';

const REQUEST_VERSION =
  'small-heroes-story-source-creative-replacement-request/v1';
const REVISION_IDENTITY_VERSION =
  'small-heroes-story-source-creative-replacement-identity/v1';
const REVIEW_BUNDLE_VERSION =
  'small-heroes-story-source-creative-replacement-review-bundle/v1';
const ACCEPTANCE_VERSION =
  'small-heroes-story-source-creative-replacement-product-acceptance/v1';
const ACCEPTED_REVISION_VERSION =
  'small-heroes-product-accepted-story-source-creative-replacement-manifest/v1';
const ACCEPTED_REVISION_STATUS =
  'product_accepted_story_source_creative_replacement';
const SOURCE_PROFILE = 'gender_flexible';
const SOURCE_GENDER_MODE = 'neutral';
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SAFE_SEGMENT = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;

const EXCLUSIONS = Object.freeze([
  'blueprint',
  'deployment',
  'production',
  'render',
  'runtime_locator',
  'story_bank',
  'visual_contract',
  'visual_directions',
  'visual_package',
  'wizard',
]);

const CREATIVE_BRIEF_KEYS = [
  'attempts',
  'briefVersion',
  'category',
  'childClimaxAction',
  'childDiscovery',
  'childWant',
  'comicEscalations',
  'companionIndispensability',
  'companionWrongHelp',
  'creativePromise',
  'direction',
  'endingEnergy',
  'hiddenUnderlayer',
  'id',
  'lineTargets',
  'lockedCausalMovement',
  'mechanicKey',
  'modelFreedom',
  'mustAvoid',
  'oldStoryAntiCopy',
  'openingHook',
  'pageCount',
  'physicalProblem',
  'playRule',
  'recurringObjects',
  'rereadHooks',
  'setPieces',
  'status',
  'transientCast',
  'visiblePayoff',
  'workingTitle',
  'worldAndSafetyLocks',
];

function exactKeys(value, keys) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
  );
}

function canonicalRepoRelativePathIsValid(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes('\0') &&
    !value.includes('\\') &&
    value === value.trim() &&
    value === path.posix.normalize(value) &&
    !value.startsWith('/') &&
    !value.startsWith('../') &&
    value !== '..'
  );
}

function canonicalUtcTimestampIsValid(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function pathIsInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return (
    relative.length > 0 &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}

function assertNoLinkComponents(rootPath, targetPath, code) {
  const relative = path.relative(rootPath, targetPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(code);
  }
  let current = rootPath;
  if (fs.lstatSync(current).isSymbolicLink()) throw new Error(code);
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(code);
  }
}

function assertSafeDirectory(rootPath, targetPath, code) {
  try {
    const rootStat = fs.lstatSync(rootPath);
    const targetStat = fs.lstatSync(targetPath);
    if (
      rootStat.isSymbolicLink() ||
      !rootStat.isDirectory() ||
      targetStat.isSymbolicLink() ||
      !targetStat.isDirectory()
    ) {
      throw new Error(code);
    }
    if (path.resolve(rootPath) !== path.resolve(targetPath)) {
      assertNoLinkComponents(rootPath, targetPath, code);
    }
    const realRoot = fs.realpathSync(rootPath);
    const realTarget = fs.realpathSync(targetPath);
    if (realRoot !== realTarget && !pathIsInside(realRoot, realTarget)) {
      throw new Error(code);
    }
    return realTarget;
  } catch {
    throw new Error(code);
  }
}

function readContainedRegularFile({
  repoRoot,
  relativePath,
  allowedRoot,
  maximumBytes,
  code,
}) {
  if (!canonicalRepoRelativePathIsValid(relativePath)) throw new Error(code);
  const root = path.resolve(repoRoot, ...allowedRoot.split('/'));
  const target = path.resolve(repoRoot, ...relativePath.split('/'));
  try {
    if (!pathIsInside(root, target)) throw new Error(code);
    assertNoLinkComponents(root, target, code);
    const stat = fs.lstatSync(target);
    const realRoot = fs.realpathSync(root);
    const realTarget = fs.realpathSync(target);
    if (
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      stat.nlink !== 1 ||
      !pathIsInside(realRoot, realTarget) ||
      stat.size < 1 ||
      stat.size > maximumBytes
    ) {
      throw new Error(code);
    }
    const bytes = fs.readFileSync(realTarget);
    return {
      absolutePath: realTarget,
      bytes,
      relativePath: path.relative(repoRoot, realTarget).replaceAll('\\', '/'),
      sha256: materializer.sha256(bytes),
    };
  } catch {
    throw new Error(code);
  }
}

function parseJson(bytes, code) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(code);
  }
}

function canonicalDigestIsValid(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !SHA256_HEX.test(value.digest)
  ) {
    return false;
  }
  const { digest, ...payload } = value;
  return (
    materializer.sha256(materializer.canonicalBytes(payload)) === digest
  );
}

function validBoundFile(value) {
  return (
    exactKeys(value, ['path', 'sha256']) &&
    canonicalRepoRelativePathIsValid(value.path) &&
    SHA256_HEX.test(value.sha256)
  );
}

function validIdentity(value) {
  return (
    exactKeys(value, [
      'category',
      'companionId',
      'direction',
      'pageCount',
    ]) &&
    typeof value.category === 'string' &&
    value.category.length >= 2 &&
    value.category.length <= 64 &&
    SAFE_SEGMENT.test(value.companionId) &&
    SAFE_SEGMENT.test(value.direction) &&
    Number.isSafeInteger(value.pageCount) &&
    value.pageCount >= 1 &&
    value.pageCount <= 24
  );
}

function validateRequest(value) {
  if (
    !exactKeys(value, [
      'acceptedAt',
      'acceptedBy',
      'approvedEditorialReviewSha256',
      'approvedStoryRevisionSha256',
      'creativeBrief',
      'decision',
      'editorialReview',
      'identity',
      'predecessor',
      'sourceProfile',
      'storyKey',
      'storyRevision',
      'version',
    ]) ||
    value.version !== REQUEST_VERSION ||
    !SAFE_SEGMENT.test(value.storyKey) ||
    value.sourceProfile !== SOURCE_PROFILE ||
    !validIdentity(value.identity) ||
    !validBoundFile(value.creativeBrief) ||
    !validBoundFile(value.storyRevision) ||
    !validBoundFile(value.editorialReview) ||
    !exactKeys(value.predecessor, [
      'manifestPath',
      'manifestSha256',
      'revisionDigest',
    ]) ||
    !canonicalRepoRelativePathIsValid(value.predecessor.manifestPath) ||
    !SHA256_HEX.test(value.predecessor.manifestSha256) ||
    !SHA256_HEX.test(value.predecessor.revisionDigest) ||
    value.acceptedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(value.acceptedAt) ||
    value.approvedStoryRevisionSha256 !== value.storyRevision.sha256 ||
    value.approvedEditorialReviewSha256 !== value.editorialReview.sha256 ||
    typeof value.decision !== 'string' ||
    value.decision.trim().length < 32 ||
    value.decision.length > 2000 ||
    value.decision.includes('\0')
  ) {
    throw new Error('story_source_creative_replacement_request_invalid');
  }
  return value;
}

function readRequestFile(requestPath, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const outputsRoot = roots.outputsRootRelative || OUTPUTS_ROOT_RELATIVE;
  const file = readContainedRegularFile({
    repoRoot,
    relativePath: requestPath,
    allowedRoot: outputsRoot,
    maximumBytes: 64 * 1024,
    code: 'story_source_creative_replacement_request_path_rejected',
  });
  if (path.extname(file.absolutePath).toLowerCase() !== '.json') {
    throw new Error('story_source_creative_replacement_request_path_rejected');
  }
  const request = validateRequest(
    parseJson(file.bytes, 'story_source_creative_replacement_request_json_invalid'),
  );
  return { file, request };
}

function validateCreativeBrief(value, request) {
  const stringsAreSafe = (values, minimum, maximum) =>
    Array.isArray(values) &&
    values.length >= minimum &&
    values.length <= maximum &&
    values.every(
      (entry) =>
        typeof entry === 'string' &&
        entry.trim().length >= 2 &&
        entry.length <= 2000 &&
        !entry.includes('\0'),
    );
  if (
    !exactKeys(value, CREATIVE_BRIEF_KEYS) ||
    value.briefVersion !== 'story-creative-brief/v1' ||
    !SAFE_SEGMENT.test(value.id) ||
    value.status !== 'draft_for_guy_review' ||
    value.category !== request.identity.category ||
    value.direction !== request.identity.direction ||
    value.pageCount !== request.identity.pageCount ||
    typeof value.workingTitle !== 'string' ||
    value.workingTitle.trim().length < 3 ||
    typeof value.mechanicKey !== 'string' ||
    !SAFE_SEGMENT.test(value.mechanicKey) ||
    !stringsAreSafe(value.lockedCausalMovement, 3, 12) ||
    !stringsAreSafe(value.recurringObjects, 1, 12) ||
    !stringsAreSafe(value.worldAndSafetyLocks, 1, 12) ||
    !stringsAreSafe(value.mustAvoid, 1, 16)
  ) {
    throw new Error('story_source_creative_replacement_brief_invalid');
  }
  return value;
}

function validateEditorialReview(value) {
  const stringsAreSafe = (values, minimum, maximum) =>
    Array.isArray(values) &&
    values.length >= minimum &&
    values.length <= maximum &&
    values.every(
      (entry) =>
        typeof entry === 'string' &&
        entry.trim().length >= 3 &&
        entry.length <= 2000 &&
        !entry.includes('\0'),
    );
  if (
    !exactKeys(value, [
      'issues',
      'mustPreserve',
      'revisionPriorities',
      'strengths',
      'verdict',
      'version',
    ]) ||
    value.version !== 'small-heroes-story-editorial-review/v1' ||
    value.verdict !== 'pass' ||
    !stringsAreSafe(value.strengths, 1, 4) ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0 ||
    !Array.isArray(value.revisionPriorities) ||
    value.revisionPriorities.length !== 0 ||
    !stringsAreSafe(value.mustPreserve, 1, 8)
  ) {
    throw new Error('story_source_creative_replacement_editorial_review_invalid');
  }
  return value;
}

function loadPredecessor(request, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const acceptedRoot =
    roots.acceptedRootRelative || ACCEPTED_ROOT_RELATIVE;
  const expectedPath =
    `${acceptedRoot}/${request.storyKey}/revisions/` +
    `${request.predecessor.revisionDigest}/manifest.json`;
  if (request.predecessor.manifestPath !== expectedPath) {
    throw new Error('story_source_creative_replacement_predecessor_invalid');
  }
  const file = readContainedRegularFile({
    repoRoot,
    relativePath: expectedPath,
    allowedRoot: `${acceptedRoot}/${request.storyKey}`,
    maximumBytes: 256 * 1024,
    code: 'story_source_creative_replacement_predecessor_invalid',
  });
  const manifest = parseJson(
    file.bytes,
    'story_source_creative_replacement_predecessor_invalid',
  );
  const recognized =
    (manifest.version ===
      'small-heroes-product-accepted-story-source-revision-manifest/v2' &&
      manifest.status === 'product_accepted_story_source_revision') ||
    (manifest.version === ACCEPTED_REVISION_VERSION &&
      manifest.status === ACCEPTED_REVISION_STATUS);
  if (
    file.sha256 !== request.predecessor.manifestSha256 ||
    !recognized ||
    manifest.storyKey !== request.storyKey ||
    manifest.revisionDigest !== request.predecessor.revisionDigest ||
    !canonicalDigestIsValid(manifest)
  ) {
    throw new Error('story_source_creative_replacement_predecessor_invalid');
  }
  return { file, manifest };
}

function readBoundOutput(reference, request, roots, maximumBytes, code) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const outputsRoot = roots.outputsRootRelative || OUTPUTS_ROOT_RELATIVE;
  const file = readContainedRegularFile({
    repoRoot,
    relativePath: reference.path,
    allowedRoot: outputsRoot,
    maximumBytes,
    code,
  });
  if (file.sha256 !== reference.sha256) throw new Error(code);
  return file;
}

function projectionDescriptor(storyText, gender) {
  const text = materializer.resolveProjection(storyText, gender);
  if (/\{[^{}|]+\|[^{}|]+\}/.test(text)) {
    throw new Error('story_source_creative_replacement_projection_invalid');
  }
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: materializer.sha256(text),
  };
}

function loadInputs(requestPath, roots = {}) {
  const requestResult = readRequestFile(requestPath, roots);
  const request = requestResult.request;
  const predecessor = loadPredecessor(request, roots);
  const briefFile = readBoundOutput(
    request.creativeBrief,
    request,
    roots,
    128 * 1024,
    'story_source_creative_replacement_brief_invalid',
  );
  const brief = validateCreativeBrief(
    parseJson(briefFile.bytes, 'story_source_creative_replacement_brief_invalid'),
    request,
  );
  const storyFile = readBoundOutput(
    request.storyRevision,
    request,
    roots,
    128 * 1024,
    'story_source_creative_replacement_story_invalid',
  );
  const storyText = storyFile.bytes.toString('utf8');
  const validatedStory = editorialContract.validateEditorialPassDraft(
    {
      companionId: request.identity.companionId,
      brief,
    },
    { text: storyText, sha256: storyFile.sha256 },
    { sourceProfile: editorialContract.EDITORIAL_SOURCE_PROFILE_GENDER_FLEXIBLE },
  );
  if (validatedStory.sha256 !== request.approvedStoryRevisionSha256) {
    throw new Error('story_source_creative_replacement_story_invalid');
  }
  const reviewFile = readBoundOutput(
    request.editorialReview,
    request,
    roots,
    128 * 1024,
    'story_source_creative_replacement_editorial_review_invalid',
  );
  const editorialReview = validateEditorialReview(
    parseJson(
      reviewFile.bytes,
      'story_source_creative_replacement_editorial_review_invalid',
    ),
  );
  return {
    requestResult,
    request,
    predecessor,
    briefFile,
    brief,
    storyFile,
    storyText,
    editorialReview,
    reviewFile,
  };
}

function buildRevisionIdentity(loaded) {
  return {
    version: REVISION_IDENTITY_VERSION,
    storyKey: loaded.request.storyKey,
    predecessor: {
      manifestPath: loaded.predecessor.file.relativePath,
      manifestSha256: loaded.predecessor.file.sha256,
      revisionDigest: loaded.predecessor.manifest.revisionDigest,
    },
    sourceProfile: SOURCE_PROFILE,
    sourceGenderMode: SOURCE_GENDER_MODE,
    identity: {
      briefId: loaded.brief.id,
      category: loaded.request.identity.category,
      companionId: loaded.request.identity.companionId,
      direction: loaded.request.identity.direction,
      pageCount: loaded.request.identity.pageCount,
    },
    approvedContent: {
      creativeBriefSha256: loaded.briefFile.sha256,
      editorialReviewSha256: loaded.reviewFile.sha256,
      storySha256: loaded.storyFile.sha256,
    },
  };
}

function buildRevision(loaded) {
  const revisionIdentity = buildRevisionIdentity(loaded);
  const revisionIdentityBytes = Buffer.from(
    materializer.canonicalBytes(revisionIdentity),
    'utf8',
  );
  const revisionDigest = materializer.sha256(revisionIdentityBytes);
  const projections = {
    boy: projectionDescriptor(loaded.storyText, 'boy'),
    girl: projectionDescriptor(loaded.storyText, 'girl'),
  };
  const reviewPayload = {
    version: REVIEW_BUNDLE_VERSION,
    status: 'product_editorial_pass',
    authorityScope: 'story_text_only',
    storyKey: loaded.request.storyKey,
    revisionDigest,
    predecessor: revisionIdentity.predecessor,
    sourceProfile: SOURCE_PROFILE,
    sourceGenderMode: SOURCE_GENDER_MODE,
    identity: revisionIdentity.identity,
    approvedContent: revisionIdentity.approvedContent,
    projections,
    editorialVerdict: loaded.editorialReview.verdict,
    exclusions: [...EXCLUSIONS],
  };
  const reviewBundle = {
    ...reviewPayload,
    digest: materializer.sha256(materializer.canonicalBytes(reviewPayload)),
  };
  const reviewBundleBytes = Buffer.from(
    materializer.canonicalBytes(reviewBundle),
    'utf8',
  );
  const acceptancePayload = {
    version: ACCEPTANCE_VERSION,
    status: 'accepted',
    acceptedAt: loaded.request.acceptedAt,
    acceptedBy: 'Guy',
    decision: loaded.request.decision,
    storyKey: loaded.request.storyKey,
    revisionDigest,
    predecessor: revisionIdentity.predecessor,
    sourceProfile: SOURCE_PROFILE,
    sourceGenderMode: SOURCE_GENDER_MODE,
    approvedStoryRevisionSha256:
      loaded.request.approvedStoryRevisionSha256,
    approvedEditorialReviewSha256:
      loaded.request.approvedEditorialReviewSha256,
    reviewBundle: {
      digest: reviewBundle.digest,
      sha256: materializer.sha256(reviewBundleBytes),
    },
    exclusions: [...EXCLUSIONS],
  };
  const acceptance = {
    ...acceptancePayload,
    digest: materializer.sha256(materializer.canonicalBytes(acceptancePayload)),
  };
  const acceptanceBytes = Buffer.from(
    materializer.canonicalBytes(acceptance),
    'utf8',
  );
  const descriptor = (filename, bytes, digest) => ({
    filename,
    bytes: bytes.length,
    sha256: materializer.sha256(bytes),
    ...(digest ? { digest } : {}),
  });
  const manifestPayload = {
    version: ACCEPTED_REVISION_VERSION,
    status: ACCEPTED_REVISION_STATUS,
    authorityScope: 'story_text_only',
    storyKey: loaded.request.storyKey,
    revisionDigest,
    predecessor: revisionIdentity.predecessor,
    sourceProfile: SOURCE_PROFILE,
    sourceGenderMode: SOURCE_GENDER_MODE,
    identity: revisionIdentity.identity,
    files: {
      creativeBrief: descriptor('creative-brief.json', loaded.briefFile.bytes),
      editorialReview: descriptor(
        'editorial-review.json',
        loaded.reviewFile.bytes,
      ),
      productAcceptance: descriptor(
        'product-acceptance.json',
        acceptanceBytes,
        acceptance.digest,
      ),
      reviewBundle: descriptor(
        'review-bundle.json',
        reviewBundleBytes,
        reviewBundle.digest,
      ),
      revisionIdentity: descriptor(
        'revision-identity.json',
        revisionIdentityBytes,
        revisionDigest,
      ),
      story: descriptor('story.md', loaded.storyFile.bytes),
    },
    runtimeEligibility: {
      eligible: false,
      reason: 'visual_directions_not_approved',
    },
    exclusions: [...EXCLUSIONS],
  };
  const manifest = {
    ...manifestPayload,
    digest: materializer.sha256(materializer.canonicalBytes(manifestPayload)),
  };
  const files = new Map([
    ['creative-brief.json', loaded.briefFile.bytes],
    ['editorial-review.json', loaded.reviewFile.bytes],
    ['manifest.json', Buffer.from(materializer.canonicalBytes(manifest), 'utf8')],
    ['product-acceptance.json', acceptanceBytes],
    ['review-bundle.json', reviewBundleBytes],
    ['revision-identity.json', revisionIdentityBytes],
    ['story.md', loaded.storyFile.bytes],
  ]);
  return {
    acceptance,
    files,
    manifest,
    projections,
    reviewBundle,
    revisionDigest,
    revisionIdentity,
  };
}

function descriptorMatches(value, filename, digestRequired) {
  const keys = digestRequired
    ? ['bytes', 'digest', 'filename', 'sha256']
    : ['bytes', 'filename', 'sha256'];
  return (
    exactKeys(value, keys) &&
    value.filename === filename &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes > 0 &&
    SHA256_HEX.test(value.sha256) &&
    (!digestRequired || SHA256_HEX.test(value.digest))
  );
}

function loadAcceptedCreativeReplacement({ manifestPath }, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const acceptedRoot =
    roots.acceptedRootRelative || ACCEPTED_ROOT_RELATIVE;
  if (!canonicalRepoRelativePathIsValid(manifestPath)) {
    throw new Error('story_source_creative_replacement_accepted_invalid');
  }
  const parts = manifestPath.split('/');
  if (
    parts.length !== acceptedRoot.split('/').length + 4 ||
    parts.slice(0, acceptedRoot.split('/').length).join('/') !== acceptedRoot ||
    !SAFE_SEGMENT.test(parts[acceptedRoot.split('/').length] || '') ||
    parts[acceptedRoot.split('/').length + 1] !== 'revisions' ||
    !SHA256_HEX.test(parts[acceptedRoot.split('/').length + 2] || '') ||
    parts[acceptedRoot.split('/').length + 3] !== 'manifest.json'
  ) {
    throw new Error('story_source_creative_replacement_accepted_invalid');
  }
  const storyKey = parts[acceptedRoot.split('/').length];
  const revisionDigest = parts[acceptedRoot.split('/').length + 2];
  const revisionRoot = `${acceptedRoot}/${storyKey}/revisions/${revisionDigest}`;
  const manifestFile = readContainedRegularFile({
    repoRoot,
    relativePath: manifestPath,
    allowedRoot: `${acceptedRoot}/${storyKey}`,
    maximumBytes: 256 * 1024,
    code: 'story_source_creative_replacement_accepted_invalid',
  });
  const manifest = parseJson(
    manifestFile.bytes,
    'story_source_creative_replacement_accepted_invalid',
  );
  if (
    !exactKeys(manifest, [
      'authorityScope',
      'digest',
      'exclusions',
      'files',
      'identity',
      'predecessor',
      'revisionDigest',
      'runtimeEligibility',
      'sourceGenderMode',
      'sourceProfile',
      'status',
      'storyKey',
      'version',
    ]) ||
    manifest.version !== ACCEPTED_REVISION_VERSION ||
    manifest.status !== ACCEPTED_REVISION_STATUS ||
    manifest.authorityScope !== 'story_text_only' ||
    manifest.storyKey !== storyKey ||
    manifest.revisionDigest !== revisionDigest ||
    manifest.sourceProfile !== SOURCE_PROFILE ||
    manifest.sourceGenderMode !== SOURCE_GENDER_MODE ||
    JSON.stringify(manifest.exclusions) !== JSON.stringify(EXCLUSIONS) ||
    !exactKeys(manifest.runtimeEligibility, ['eligible', 'reason']) ||
    manifest.runtimeEligibility.eligible !== false ||
    manifest.runtimeEligibility.reason !== 'visual_directions_not_approved' ||
    !canonicalDigestIsValid(manifest) ||
    manifestFile.bytes.toString('utf8') !== materializer.canonicalBytes(manifest)
  ) {
    throw new Error('story_source_creative_replacement_accepted_invalid');
  }
  if (
    !exactKeys(manifest.files, [
      'creativeBrief',
      'editorialReview',
      'productAcceptance',
      'reviewBundle',
      'revisionIdentity',
      'story',
    ]) ||
    !descriptorMatches(manifest.files.creativeBrief, 'creative-brief.json', false) ||
    !descriptorMatches(manifest.files.editorialReview, 'editorial-review.json', false) ||
    !descriptorMatches(manifest.files.productAcceptance, 'product-acceptance.json', true) ||
    !descriptorMatches(manifest.files.reviewBundle, 'review-bundle.json', true) ||
    !descriptorMatches(manifest.files.revisionIdentity, 'revision-identity.json', true) ||
    !descriptorMatches(manifest.files.story, 'story.md', false)
  ) {
    throw new Error('story_source_creative_replacement_accepted_invalid');
  }
  const inventory = [
    ['creativeBrief', 'creative-brief.json'],
    ['editorialReview', 'editorial-review.json'],
    ['productAcceptance', 'product-acceptance.json'],
    ['reviewBundle', 'review-bundle.json'],
    ['revisionIdentity', 'revision-identity.json'],
    ['story', 'story.md'],
  ];
  const revisionRootAbsolute = path.resolve(
    repoRoot,
    ...revisionRoot.split('/'),
  );
  const actualNames = fs.readdirSync(revisionRootAbsolute).sort();
  const expectedNames = [
    ...inventory.map(([, filename]) => filename),
    'manifest.json',
  ].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error('story_source_creative_replacement_accepted_invalid');
  }
  const files = {};
  for (const [key, filename] of inventory) {
    const file = readContainedRegularFile({
      repoRoot,
      relativePath: `${revisionRoot}/${filename}`,
      allowedRoot: `${acceptedRoot}/${storyKey}`,
      maximumBytes: 512 * 1024,
      code: 'story_source_creative_replacement_accepted_invalid',
    });
    const descriptor = manifest.files[key];
    if (
      file.bytes.length !== descriptor.bytes ||
      file.sha256 !== descriptor.sha256
    ) {
      throw new Error('story_source_creative_replacement_accepted_invalid');
    }
    files[key] = file;
  }
  const acceptance = parseJson(
    files.productAcceptance.bytes,
    'story_source_creative_replacement_accepted_invalid',
  );
  if (
    !exactKeys(acceptance, [
      'acceptedAt',
      'acceptedBy',
      'approvedEditorialReviewSha256',
      'approvedStoryRevisionSha256',
      'decision',
      'digest',
      'exclusions',
      'predecessor',
      'reviewBundle',
      'revisionDigest',
      'sourceGenderMode',
      'sourceProfile',
      'status',
      'storyKey',
      'version',
    ]) ||
    acceptance.version !== ACCEPTANCE_VERSION ||
    acceptance.status !== 'accepted' ||
    acceptance.acceptedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(acceptance.acceptedAt) ||
    acceptance.storyKey !== storyKey ||
    acceptance.revisionDigest !== revisionDigest ||
    acceptance.sourceProfile !== SOURCE_PROFILE ||
    acceptance.sourceGenderMode !== SOURCE_GENDER_MODE ||
    typeof acceptance.decision !== 'string' ||
    acceptance.decision.trim().length < 32 ||
    acceptance.decision.length > 2000 ||
    acceptance.decision.includes('\0') ||
    acceptance.approvedStoryRevisionSha256 !== files.story.sha256 ||
    acceptance.approvedEditorialReviewSha256 !== files.editorialReview.sha256 ||
    JSON.stringify(acceptance.exclusions) !== JSON.stringify(EXCLUSIONS) ||
    !canonicalDigestIsValid(acceptance) ||
    files.productAcceptance.bytes.toString('utf8') !==
      materializer.canonicalBytes(acceptance) ||
    manifest.files.productAcceptance.digest !== acceptance.digest
  ) {
    throw new Error('story_source_creative_replacement_accepted_invalid');
  }
  const identity = parseJson(
    files.revisionIdentity.bytes,
    'story_source_creative_replacement_accepted_invalid',
  );
  if (
    materializer.sha256(files.revisionIdentity.bytes) !== revisionDigest ||
    manifest.files.revisionIdentity.digest !== revisionDigest ||
    files.revisionIdentity.bytes.toString('utf8') !==
      materializer.canonicalBytes(identity)
  ) {
    throw new Error('story_source_creative_replacement_accepted_invalid');
  }
  const requestIdentity = {
    category: manifest.identity?.category,
    companionId: manifest.identity?.companionId,
    direction: manifest.identity?.direction,
    pageCount: manifest.identity?.pageCount,
  };
  const syntheticRequest = {
    storyKey,
    identity: requestIdentity,
    predecessor: manifest.predecessor,
    acceptedAt: acceptance.acceptedAt,
    decision: acceptance.decision,
    approvedStoryRevisionSha256: acceptance.approvedStoryRevisionSha256,
    approvedEditorialReviewSha256:
      acceptance.approvedEditorialReviewSha256,
  };
  if (!validIdentity(requestIdentity)) {
    throw new Error('story_source_creative_replacement_accepted_invalid');
  }
  const predecessor = loadPredecessor(syntheticRequest, roots);
  const brief = validateCreativeBrief(
    parseJson(
      files.creativeBrief.bytes,
      'story_source_creative_replacement_accepted_invalid',
    ),
    syntheticRequest,
  );
  const editorialReview = validateEditorialReview(
    parseJson(
      files.editorialReview.bytes,
      'story_source_creative_replacement_accepted_invalid',
    ),
  );
  const storyText = files.story.bytes.toString('utf8');
  editorialContract.validateEditorialPassDraft(
    { companionId: requestIdentity.companionId, brief },
    { text: storyText, sha256: files.story.sha256 },
    { sourceProfile: editorialContract.EDITORIAL_SOURCE_PROFILE_GENDER_FLEXIBLE },
  );
  const rebuilt = buildRevision({
    request: syntheticRequest,
    predecessor,
    briefFile: files.creativeBrief,
    brief,
    storyFile: files.story,
    storyText,
    editorialReview,
    reviewFile: files.editorialReview,
  });
  for (const [name, bytes] of rebuilt.files) {
    const actual = fs.readFileSync(path.join(revisionRootAbsolute, name));
    if (!actual.equals(bytes)) {
      throw new Error('story_source_creative_replacement_accepted_invalid');
    }
  }
  if (
    rebuilt.revisionDigest !== revisionDigest ||
    acceptance.reviewBundle.digest !== rebuilt.reviewBundle.digest ||
    acceptance.reviewBundle.sha256 !==
      materializer.sha256(rebuilt.files.get('review-bundle.json'))
  ) {
    throw new Error('story_source_creative_replacement_accepted_invalid');
  }
  return {
    acceptance,
    manifest,
    manifestPath: manifestFile.relativePath,
    revisionDigest,
    storyPath: `${revisionRoot}/story.md`,
    storySha256: files.story.sha256,
  };
}

function assertNoAcceptedFork({
  repoRoot,
  revisionsRoot,
  predecessorDigest,
  proposedRevisionDigest,
}) {
  for (const entry of fs.readdirSync(revisionsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !SHA256_HEX.test(entry.name)) continue;
    const manifestPath = path.join(revisionsRoot, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try {
      const stat = fs.lstatSync(manifestPath);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) {
        throw new Error('invalid');
      }
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      throw new Error('story_source_creative_replacement_predecessor_not_current');
    }
    if (
      manifest.version === ACCEPTED_REVISION_VERSION &&
      manifest.status === ACCEPTED_REVISION_STATUS &&
      manifest.predecessor?.revisionDigest === predecessorDigest &&
      manifest.revisionDigest !== proposedRevisionDigest
    ) {
      throw new Error('story_source_creative_replacement_predecessor_not_current');
    }
  }
}

function assertExistingRevision(target, files) {
  if (!fs.existsSync(target)) return false;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('story_source_creative_replacement_collision');
  }
  const actual = fs.readdirSync(target).sort();
  const expected = [...files.keys()].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('story_source_creative_replacement_collision');
  }
  for (const [name, bytes] of files) {
    const filePath = path.join(target, name);
    const fileStat = fs.lstatSync(filePath);
    if (
      fileStat.isSymbolicLink() ||
      !fileStat.isFile() ||
      fileStat.nlink !== 1 ||
      !fs.readFileSync(filePath).equals(bytes)
    ) {
      throw new Error('story_source_creative_replacement_collision');
    }
  }
  return true;
}

function writeRevisionAtomically(revisionsRoot, target, files) {
  const staging = path.join(
    revisionsRoot,
    `.${path.basename(target)}.staging-${process.pid}`,
  );
  if (fs.existsSync(staging) || fs.existsSync(target)) {
    throw new Error('story_source_creative_replacement_collision');
  }
  try {
    fs.mkdirSync(staging);
    for (const [name, bytes] of files) {
      if (path.basename(name) !== name || !Buffer.isBuffer(bytes)) {
        throw new Error('story_source_creative_replacement_collision');
      }
      fs.writeFileSync(path.join(staging, name), bytes, { flag: 'wx' });
    }
    fs.renameSync(staging, target);
  } catch (error) {
    if (fs.existsSync(staging)) {
      const stat = fs.lstatSync(staging);
      if (!stat.isSymbolicLink() && stat.isDirectory()) {
        fs.rmSync(staging, { recursive: true, force: true });
      }
    }
    throw error;
  }
}

function publish({ requestPath, write }, roots = {}) {
  if (typeof write !== 'boolean') {
    throw new Error('story_source_creative_replacement_arguments_invalid');
  }
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const acceptedRoot =
    roots.acceptedRootRelative || ACCEPTED_ROOT_RELATIVE;
  const loaded = loadInputs(requestPath, roots);
  const built = buildRevision(loaded);
  const storyRoot = path.resolve(
    repoRoot,
    ...`${acceptedRoot}/${loaded.request.storyKey}`.split('/'),
  );
  const acceptedRootAbsolute = path.resolve(
    repoRoot,
    ...acceptedRoot.split('/'),
  );
  const revisionsRoot = path.join(storyRoot, 'revisions');
  assertSafeDirectory(
    acceptedRootAbsolute,
    storyRoot,
    'story_source_creative_replacement_target_invalid',
  );
  assertSafeDirectory(
    storyRoot,
    revisionsRoot,
    'story_source_creative_replacement_target_invalid',
  );
  const target = path.join(revisionsRoot, built.revisionDigest);
  if (path.dirname(target) !== revisionsRoot) {
    throw new Error('story_source_creative_replacement_target_invalid');
  }
  assertNoAcceptedFork({
    repoRoot,
    revisionsRoot,
    predecessorDigest: loaded.request.predecessor.revisionDigest,
    proposedRevisionDigest: built.revisionDigest,
  });
  if (assertExistingRevision(target, built.files)) {
    return {
      created: false,
      manifest: built.manifest,
      revisionDigest: built.revisionDigest,
      target: path.relative(repoRoot, target).replaceAll('\\', '/'),
    };
  }
  if (!write) {
    return {
      created: false,
      manifest: built.manifest,
      revisionDigest: built.revisionDigest,
      target: path.relative(repoRoot, target).replaceAll('\\', '/'),
    };
  }
  writeRevisionAtomically(revisionsRoot, target, built.files);
  return {
    created: true,
    manifest: built.manifest,
    revisionDigest: built.revisionDigest,
    target: path.relative(repoRoot, target).replaceAll('\\', '/'),
  };
}

function parseArgs(argv) {
  const [command, ...tokens] = argv;
  if (command !== 'publish' || tokens.length !== 4) {
    throw new Error('story_source_creative_replacement_arguments_invalid');
  }
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!['--request', '--write'].includes(key) || values.has(key)) {
      throw new Error('story_source_creative_replacement_arguments_invalid');
    }
    values.set(key, value);
  }
  if (
    !values.get('--request') ||
    !['true', 'false'].includes(values.get('--write'))
  ) {
    throw new Error('story_source_creative_replacement_arguments_invalid');
  }
  return {
    requestPath: values.get('--request'),
    write: values.get('--write') === 'true',
  };
}

function main(argv) {
  try {
    const result = publish(parseArgs(argv));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message.split(':')[0] : 'story_source_creative_replacement_unknown_failure'}\n`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  ACCEPTANCE_VERSION,
  ACCEPTED_REVISION_STATUS,
  ACCEPTED_REVISION_VERSION,
  EXCLUSIONS,
  REQUEST_VERSION,
  REVIEW_BUNDLE_VERSION,
  REVISION_IDENTITY_VERSION,
  SOURCE_GENDER_MODE,
  SOURCE_PROFILE,
  buildRevision,
  loadAcceptedCreativeReplacement,
  loadInputs,
  parseArgs,
  publish,
  readRequestFile,
  validateCreativeBrief,
  validateEditorialReview,
  validateRequest,
};

if (require.main === module) main(process.argv.slice(2));
