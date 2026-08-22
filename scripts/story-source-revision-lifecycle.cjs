#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const materializer = require('./materialize-story-source-revision.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const REVIEW_VERSION = 'small-heroes-story-source-revision-review-bundle/v2';
const TECHNICAL_REVIEW_VERSION =
  'small-heroes-story-source-revision-technical-review/v1';
const ACCEPTANCE_VERSION =
  'small-heroes-story-source-revision-product-acceptance/v2';
const ACCEPTED_REVISION_VERSION =
  'small-heroes-product-accepted-story-source-revision-manifest/v2';
const REVISION_IDENTITY_VERSION = 'small-heroes-story-source-revision-identity/v2';
const PENDING_VERSION = 'small-heroes-story-source-revision-pending-manifest/v4';
const OUTPUTS_ROOT_RELATIVE = 'outputs';
const ACCEPTED_ROOT_RELATIVE =
  'story-pipeline/04_approved_story_sources/accepted';
const APPROVAL_ROOT_RELATIVE =
  'story-pipeline/04_approved_story_sources/approvals/revisions';
const EXCLUSIONS = [
  'blueprint',
  'deployment',
  'production',
  'render',
  'runtime_locator',
  'story_bank',
  'visual_contract',
  'visual_package',
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

function pathIsInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
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

function assertExistingDirectoryIsSafe(rootPath, targetPath, code) {
  let realRoot;
  let realTarget;
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
    realRoot = fs.realpathSync(rootPath);
    realTarget = fs.realpathSync(targetPath);
  } catch {
    throw new Error(code);
  }
  if (realRoot !== realTarget && !pathIsInside(realRoot, realTarget)) throw new Error(code);
  return realTarget;
}

function nearestExistingDirectory(targetPath) {
  let current = targetPath;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

function resolveFreshContainedDirectory(repoRoot, relativePath, allowedRoot, code) {
  if (!canonicalRepoRelativePathIsValid(relativePath)) throw new Error(code);
  const root = path.resolve(repoRoot, ...allowedRoot.split('/'));
  const target = path.resolve(repoRoot, ...relativePath.split('/'));
  if (!pathIsInside(root, target) || fs.existsSync(target)) throw new Error(code);
  const ancestor = nearestExistingDirectory(target);
  if (ancestor === null || (!pathIsInside(root, ancestor) && ancestor !== root)) {
    throw new Error(code);
  }
  if (ancestor === root) {
    let rootStat;
    try {
      rootStat = fs.lstatSync(root);
    } catch {
      throw new Error(code);
    }
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(code);
  } else {
    assertExistingDirectoryIsSafe(root, ancestor, code);
  }
  return { root, target };
}

function writeFreshDirectoryAtomically({ root, target, files, code }) {
  const parent = path.dirname(target);
  const fresh = resolveFreshContainedDirectory(
    path.dirname(root),
    path.relative(path.dirname(root), target).replaceAll('\\', '/'),
    path.basename(root),
    code,
  );
  if (fresh.root !== root || fresh.target !== target) throw new Error(code);
  fs.mkdirSync(parent, { recursive: true });
  assertExistingDirectoryIsSafe(root, parent, code);
  const staging = path.join(parent, `.${path.basename(target)}.staging-${process.pid}`);
  if (fs.existsSync(staging)) throw new Error(code);
  try {
    fs.mkdirSync(staging);
    const realStaging = assertExistingDirectoryIsSafe(root, staging, code);
    if (realStaging !== fs.realpathSync(staging)) throw new Error(code);
    for (const [name, bytes] of files) {
      if (path.basename(name) !== name || !Buffer.isBuffer(bytes)) throw new Error(code);
      fs.writeFileSync(path.join(staging, name), bytes, { flag: 'wx' });
    }
    fs.renameSync(staging, target);
  } catch (error) {
    const resolvedStaging = path.resolve(staging);
    if (pathIsInside(root, resolvedStaging) && fs.existsSync(resolvedStaging)) {
      const stat = fs.lstatSync(resolvedStaging);
      if (!stat.isSymbolicLink() && stat.isDirectory()) {
        fs.rmSync(resolvedStaging, { recursive: true, force: true });
      }
    }
    throw error;
  }
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

function readContainedRegularFile(repoRoot, relativePath, allowedRoot, maxBytes, code) {
  if (!canonicalRepoRelativePathIsValid(relativePath)) throw new Error(code);
  const root = path.resolve(repoRoot, ...allowedRoot.split('/'));
  const target = path.resolve(repoRoot, ...relativePath.split('/'));
  let stat;
  let realRoot;
  let realTarget;
  try {
    if (!pathIsInside(root, target)) throw new Error(code);
    assertNoLinkComponents(root, target, code);
    stat = fs.lstatSync(target);
    realRoot = fs.realpathSync(root);
    realTarget = fs.realpathSync(target);
  } catch {
    throw new Error(code);
  }
  if (
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    stat.nlink !== 1 ||
    !pathIsInside(realRoot, realTarget) ||
    stat.size < 1 ||
    stat.size > maxBytes
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
}

function parseJson(bytes, code) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(code);
  }
}

function canonicalDigestIsValid(value) {
  if (!value || typeof value !== 'object' || !/^[a-f0-9]{64}$/.test(value.digest)) {
    return false;
  }
  const { digest, ...payload } = value;
  return materializer.sha256(materializer.canonicalBytes(payload)) === digest;
}

function validateTechnicalReview(value) {
  if (
    !exactKeys(value, [
      'baseCommit',
      'blocker',
      'digest',
      'headCommit',
      'major',
      'minor',
      'reviewer',
      'status',
      'version',
    ]) ||
    value.version !== TECHNICAL_REVIEW_VERSION ||
    value.status !== 'pass' ||
    value.reviewer !== 'Claude Code' ||
    !/^[a-f0-9]{40}$/.test(value.baseCommit) ||
    !/^[a-f0-9]{40}$/.test(value.headCommit) ||
    value.baseCommit === value.headCommit ||
    value.blocker !== 0 ||
    value.major !== 0 ||
    value.minor !== 0 ||
    !canonicalDigestIsValid(value)
  ) {
    throw new Error('story_source_revision_technical_review_invalid');
  }
  return value;
}

function validatePendingShape(pending) {
  if (
    !exactKeys(pending, [
      'authorityScope',
      'briefId',
      'digest',
      'inputs',
      'invariants',
      'metadataChanges',
      'outputs',
      'projections',
      'request',
      'sourceGenderMode',
      'status',
      'storyKey',
      'version',
    ]) ||
    pending.version !== PENDING_VERSION ||
    pending.status !== 'pending_exact_product_review' ||
    pending.authorityScope !== 'story_source_and_visual_directions_only' ||
    pending.sourceGenderMode !== 'neutral' ||
    JSON.stringify(pending.metadataChanges) !==
      JSON.stringify([{ field: 'gender', from: 'female', to: 'neutral' }]) ||
    !/^[a-z][a-z0-9_]{2,95}$/.test(pending.storyKey) ||
    !/^[a-f0-9]{64}$/.test(pending.digest) ||
    pending.invariants?.approved !== false ||
    pending.invariants?.providerCalls !== 0 ||
    pending.invariants?.storageWrites !== 0 ||
    pending.invariants?.databaseWrites !== 0 ||
    pending.invariants?.renders !== 0 ||
    !canonicalDigestIsValid(pending)
  ) {
    throw new Error('story_source_revision_pending_invalid');
  }
  return pending;
}

function pendingFileNames(pending) {
  return [
    `${pending.digest}.manifest.json`,
    pending.outputs.acceptedStoryCandidate.filename,
    pending.outputs.visualDirectionCandidate.filename,
    pending.outputs.integratedStoryCandidate.filename,
    pending.outputs.directionMigration.filename,
  ].sort();
}

function assertDescriptor(file, descriptor, code) {
  if (
    !descriptor ||
    descriptor.bytes !== file.bytes.length ||
    descriptor.sha256 !== file.sha256 ||
    path.basename(file.absolutePath) !== descriptor.filename
  ) {
    throw new Error(code);
  }
}

function loadPendingRevision(pendingManifestPath, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const outputsRoot = roots.outputsRootRelative || OUTPUTS_ROOT_RELATIVE;
  const sourceAcceptedRoot =
    roots.sourceAcceptedRootRelative || ACCEPTED_ROOT_RELATIVE;
  const pendingFile = readContainedRegularFile(
    repoRoot,
    pendingManifestPath,
    outputsRoot,
    128 * 1024,
    'story_source_revision_pending_path_rejected',
  );
  const pending = validatePendingShape(
    parseJson(pendingFile.bytes, 'story_source_revision_pending_json_invalid'),
  );
  if (path.basename(pendingFile.absolutePath) !== `${pending.digest}.manifest.json`) {
    throw new Error('story_source_revision_pending_invalid');
  }
  const pendingDir = path.dirname(pendingFile.absolutePath);
  const actualNames = fs.readdirSync(pendingDir).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(pendingFileNames(pending))) {
    throw new Error('story_source_revision_pending_inventory_invalid');
  }
  const relativeDir = path.relative(repoRoot, pendingDir).replaceAll('\\', '/');
  const source = readContainedRegularFile(
    repoRoot,
    `${relativeDir}/${pending.outputs.acceptedStoryCandidate.filename}`,
    outputsRoot,
    256 * 1024,
    'story_source_revision_pending_source_invalid',
  );
  const directions = readContainedRegularFile(
    repoRoot,
    `${relativeDir}/${pending.outputs.visualDirectionCandidate.filename}`,
    outputsRoot,
    256 * 1024,
    'story_source_revision_pending_directions_invalid',
  );
  const integrated = readContainedRegularFile(
    repoRoot,
    `${relativeDir}/${pending.outputs.integratedStoryCandidate.filename}`,
    outputsRoot,
    512 * 1024,
    'story_source_revision_pending_integrated_invalid',
  );
  const migration = readContainedRegularFile(
    repoRoot,
    `${relativeDir}/${pending.outputs.directionMigration.filename}`,
    outputsRoot,
    128 * 1024,
    'story_source_revision_pending_migration_invalid',
  );
  assertDescriptor(source, pending.outputs.acceptedStoryCandidate, 'story_source_revision_pending_source_invalid');
  assertDescriptor(directions, pending.outputs.visualDirectionCandidate, 'story_source_revision_pending_directions_invalid');
  assertDescriptor(integrated, pending.outputs.integratedStoryCandidate, 'story_source_revision_pending_integrated_invalid');
  assertDescriptor(migration, pending.outputs.directionMigration, 'story_source_revision_pending_migration_invalid');

  const requestAuthority = readContainedRegularFile(
    repoRoot,
    pending.request.path,
    outputsRoot,
    128 * 1024,
    'story_source_revision_pending_request_invalid',
  );
  const requestFile = materializer.readRequestFile(requestAuthority.absolutePath);
  if (
    requestFile.bytes.length !== pending.request.bytes ||
    requestFile.sha256 !== pending.request.sha256 ||
    requestFile.request.version !== pending.request.version
  ) {
    throw new Error('story_source_revision_pending_request_invalid');
  }
  const rebuilt = materializer.buildStorySourceRevision({
    requestFile,
    outputDir: path.join(repoRoot, outputsRoot, `.revision-reverify-${pending.digest}`),
    write: false,
  });
  if (materializer.canonicalBytes(rebuilt.manifest) !== pendingFile.bytes.toString('utf8')) {
    throw new Error('story_source_revision_pending_rebuild_mismatch');
  }
  const acceptedManifestFile = readContainedRegularFile(
    repoRoot,
    pending.inputs.acceptedManifest.path,
    sourceAcceptedRoot,
    128 * 1024,
    'story_source_revision_parent_manifest_invalid',
  );
  if (
    acceptedManifestFile.bytes.length !== pending.inputs.acceptedManifest.bytes ||
    acceptedManifestFile.sha256 !== pending.inputs.acceptedManifest.sha256
  ) {
    throw new Error('story_source_revision_parent_manifest_invalid');
  }
  const acceptedManifest = parseJson(
    acceptedManifestFile.bytes,
    'story_source_revision_parent_manifest_invalid',
  );
  if (
    path.basename(path.dirname(acceptedManifestFile.absolutePath)) !== pending.storyKey ||
    acceptedManifest?.record?.briefId !== pending.briefId
  ) {
    throw new Error('story_source_revision_parent_manifest_invalid');
  }
  return {
    acceptedManifest,
    directions,
    integrated,
    migration,
    pending,
    pendingFile,
    request: requestFile.request,
    source,
  };
}

function revisionIdentityPayload(loaded) {
  return {
    version: REVISION_IDENTITY_VERSION,
    storyKey: loaded.pending.storyKey,
    briefId: loaded.pending.briefId,
    sourceGenderMode: loaded.pending.sourceGenderMode,
    metadataChanges: loaded.pending.metadataChanges,
    parent: {
      acceptedManifestSha256: loaded.pending.inputs.acceptedManifest.sha256,
      acceptedStorySha256: loaded.pending.inputs.acceptedStory.sha256,
    },
    corrected: {
      acceptedStorySha256: loaded.source.sha256,
      integratedStorySha256: loaded.integrated.sha256,
      visualDirectionSha256: loaded.directions.sha256,
      directionMigration: {
        digest: loaded.pending.outputs.directionMigration.digest,
        sha256: loaded.migration.sha256,
      },
    },
  };
}

function buildReviewBundle(loaded, technicalReview) {
  validateTechnicalReview(technicalReview);
  const revisionIdentity = revisionIdentityPayload(loaded);
  const revisionDigest = materializer.sha256(materializer.canonicalBytes(revisionIdentity));
  const sourceText = loaded.source.bytes.toString('utf8');
  const femaleText = materializer.resolveProjection(sourceText, 'girl');
  const maleText = materializer.resolveProjection(sourceText, 'boy');
  const payload = {
    version: REVIEW_VERSION,
    status: 'pending_exact_product_review',
    authorityScope: 'story_source_revision_only',
    storyKey: loaded.pending.storyKey,
    briefId: loaded.pending.briefId,
    sourceGenderMode: loaded.pending.sourceGenderMode,
    revisionDigest,
    parent: revisionIdentity.parent,
    proposed: {
      acceptedStorySha256: loaded.source.sha256,
      integratedStorySha256: loaded.integrated.sha256,
      visualDirectionSha256: loaded.directions.sha256,
      sourceGenderMode: loaded.pending.sourceGenderMode,
      metadataChanges: loaded.pending.metadataChanges,
      directionMigration: revisionIdentity.corrected.directionMigration,
      pendingManifest: {
        digest: loaded.pending.digest,
        sha256: loaded.pendingFile.sha256,
      },
    },
    productReview: {
      companionId: loaded.acceptedManifest.record.companionId,
      category: loaded.acceptedManifest.record.category,
      direction: loaded.acceptedManifest.record.direction,
      pageCount: loaded.acceptedManifest.record.textPageCount,
      pageCountUnchanged: true,
      metadataChanges: loaded.pending.metadataChanges,
      femaleProjection: {
        bytes: Buffer.byteLength(femaleText, 'utf8'),
        sha256: materializer.sha256(femaleText),
        proseByteIdenticalToPrevious:
          loaded.pending.projections.female.proseByteIdenticalToPrevious,
        proseBytes: loaded.pending.projections.female.proseBytes,
        proseSha256: loaded.pending.projections.female.proseSha256,
        text: femaleText,
      },
      maleProjection: {
        bytes: Buffer.byteLength(maleText, 'utf8'),
        sha256: materializer.sha256(maleText),
        text: maleText,
      },
      proseReplacements: loaded.request.textReplacements,
      visualDirectionReplacements: loaded.request.directionReplacements,
    },
    technicalReview,
    exclusions: [...EXCLUSIONS],
  };
  return { ...payload, digest: materializer.sha256(materializer.canonicalBytes(payload)) };
}

function readTechnicalReview(technicalReviewPath, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const outputsRoot = roots.outputsRootRelative || OUTPUTS_ROOT_RELATIVE;
  const file = readContainedRegularFile(
    repoRoot,
    technicalReviewPath,
    outputsRoot,
    32 * 1024,
    'story_source_revision_technical_review_path_rejected',
  );
  const review = validateTechnicalReview(
    parseJson(file.bytes, 'story_source_revision_technical_review_json_invalid'),
  );
  if (
    path.basename(file.absolutePath) !== `${review.digest}.technical-review.json` ||
    file.bytes.toString('utf8') !== materializer.canonicalBytes(review)
  ) {
    throw new Error('story_source_revision_technical_review_invalid');
  }
  return { file, review };
}

function resolveFreshOutputDir(repoRoot, outputDir, outputsRoot) {
  return resolveFreshContainedDirectory(
    repoRoot,
    outputDir,
    outputsRoot,
    'story_source_revision_review_output_rejected',
  );
}

function prepareReview({ pendingManifestPath, technicalReviewPath, outputDir, write }, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const outputsRoot = roots.outputsRootRelative || OUTPUTS_ROOT_RELATIVE;
  const loaded = loadPendingRevision(pendingManifestPath, roots);
  const technical = readTechnicalReview(technicalReviewPath, roots);
  const review = buildReviewBundle(loaded, technical.review);
  const bytes = materializer.canonicalBytes(review);
  const filename = `${review.digest}.review-bundle.json`;
  const target = resolveFreshOutputDir(repoRoot, outputDir, outputsRoot);
  if (write) {
    writeFreshDirectoryAtomically({
      root: target.root,
      target: target.target,
      files: new Map([[filename, Buffer.from(bytes, 'utf8')]]),
      code: 'story_source_revision_review_output_rejected',
    });
  }
  return {
    created: write,
    outputDir,
    filename,
    review,
    reviewSha256: materializer.sha256(bytes),
  };
}

function validateAcceptance(acceptance, prepared) {
  if (
    !exactKeys(acceptance, [
      'acceptedAt',
      'acceptedBy',
      'acceptedStorySha256',
      'decision',
      'directionMigration',
      'exclusions',
      'integratedStorySha256',
      'metadataChanges',
      'pendingManifest',
      'reviewBundle',
      'revisionDigest',
      'sourceGenderMode',
      'status',
      'storyKey',
      'version',
      'visualDirectionSha256',
    ]) ||
    acceptance.version !== ACCEPTANCE_VERSION ||
    acceptance.status !== 'accepted' ||
    acceptance.acceptedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(acceptance.acceptedAt) ||
    acceptance.storyKey !== prepared.review.storyKey ||
    acceptance.revisionDigest !== prepared.review.revisionDigest ||
    acceptance.sourceGenderMode !== prepared.review.sourceGenderMode ||
    JSON.stringify(acceptance.metadataChanges) !==
      JSON.stringify(prepared.review.proposed.metadataChanges) ||
    acceptance.acceptedStorySha256 !== prepared.review.proposed.acceptedStorySha256 ||
    acceptance.visualDirectionSha256 !== prepared.review.proposed.visualDirectionSha256 ||
    acceptance.integratedStorySha256 !== prepared.review.proposed.integratedStorySha256 ||
    JSON.stringify(acceptance.directionMigration) !==
      JSON.stringify(prepared.review.proposed.directionMigration) ||
    JSON.stringify(acceptance.pendingManifest) !==
      JSON.stringify(prepared.review.proposed.pendingManifest) ||
    !exactKeys(acceptance.reviewBundle, ['digest', 'sha256']) ||
    acceptance.reviewBundle.digest !== prepared.review.digest ||
    acceptance.reviewBundle.sha256 !== prepared.reviewSha256 ||
    !exactKeys(acceptance.pendingManifest, ['digest', 'sha256']) ||
    !exactKeys(acceptance.directionMigration, ['digest', 'sha256']) ||
    !Array.isArray(acceptance.exclusions) ||
    JSON.stringify(acceptance.exclusions) !== JSON.stringify(EXCLUSIONS) ||
    typeof acceptance.decision !== 'string' ||
    acceptance.decision.trim().length < 16 ||
    acceptance.decision.includes('\0')
  ) {
    throw new Error('story_source_revision_product_acceptance_invalid');
  }
  return acceptance;
}

function readReviewBundle(reviewBundlePath, loaded, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const outputsRoot = roots.outputsRootRelative || OUTPUTS_ROOT_RELATIVE;
  const file = readContainedRegularFile(
    repoRoot,
    reviewBundlePath,
    outputsRoot,
    512 * 1024,
    'story_source_revision_review_bundle_path_rejected',
  );
  const review = parseJson(file.bytes, 'story_source_revision_review_bundle_json_invalid');
  if (
    review.version !== REVIEW_VERSION ||
    path.basename(file.absolutePath) !== `${review.digest}.review-bundle.json` ||
    !canonicalDigestIsValid(review)
  ) {
    throw new Error('story_source_revision_review_bundle_invalid');
  }
  const rebuilt = buildReviewBundle(loaded, review.technicalReview);
  if (materializer.canonicalBytes(rebuilt) !== file.bytes.toString('utf8')) {
    throw new Error('story_source_revision_review_bundle_invalid');
  }
  return { file, review };
}

function readAcceptance(acceptancePath, prepared, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const approvalRoot = roots.approvalRootRelative || APPROVAL_ROOT_RELATIVE;
  const expected = `${approvalRoot}/${prepared.review.storyKey}/${prepared.review.revisionDigest}.product-acceptance.json`;
  if (acceptancePath !== expected) {
    throw new Error('story_source_revision_product_acceptance_path_rejected');
  }
  const file = readContainedRegularFile(
    repoRoot,
    acceptancePath,
    approvalRoot,
    64 * 1024,
    'story_source_revision_product_acceptance_path_rejected',
  );
  const acceptance = validateAcceptance(
    parseJson(file.bytes, 'story_source_revision_product_acceptance_json_invalid'),
    prepared,
  );
  return { acceptance, file };
}

function acceptedRevisionFiles(loaded, prepared, acceptanceResult) {
  const revisionIdentity = revisionIdentityPayload(loaded);
  const revisionIdentityBytes = Buffer.from(materializer.canonicalBytes(revisionIdentity));
  if (materializer.sha256(revisionIdentityBytes) !== prepared.review.revisionDigest) {
    throw new Error('story_source_revision_identity_mismatch');
  }
  const manifestPayload = {
    version: ACCEPTED_REVISION_VERSION,
    status: 'product_accepted_story_source_revision',
    authorityScope: 'story_source_and_visual_directions_only',
    storyKey: loaded.pending.storyKey,
    briefId: loaded.pending.briefId,
    sourceGenderMode: loaded.pending.sourceGenderMode,
    metadataChanges: loaded.pending.metadataChanges,
    revisionDigest: prepared.review.revisionDigest,
    parent: prepared.review.parent,
    files: {
      story: { filename: 'story.md', bytes: loaded.source.bytes.length, sha256: loaded.source.sha256 },
      visualDirections: { filename: 'visual-directions.json', bytes: loaded.directions.bytes.length, sha256: loaded.directions.sha256 },
      integratedStory: { filename: 'integrated.md', bytes: loaded.integrated.bytes.length, sha256: loaded.integrated.sha256 },
      directionMigration: { filename: 'direction-migration.json', bytes: loaded.migration.bytes.length, sha256: loaded.migration.sha256, digest: loaded.pending.outputs.directionMigration.digest },
      pendingManifest: { filename: 'source-revision-manifest.json', bytes: loaded.pendingFile.bytes.length, sha256: loaded.pendingFile.sha256, digest: loaded.pending.digest },
      reviewBundle: { filename: 'review-bundle.json', bytes: prepared.file.bytes.length, sha256: prepared.file.sha256, digest: prepared.review.digest },
      revisionIdentity: { filename: 'revision-identity.json', bytes: revisionIdentityBytes.length, sha256: materializer.sha256(revisionIdentityBytes), digest: prepared.review.revisionDigest },
    },
    productAcceptance: {
      path: acceptanceResult.file.relativePath,
      bytes: acceptanceResult.file.bytes.length,
      sha256: acceptanceResult.file.sha256,
      acceptedBy: 'Guy',
      acceptedAt: acceptanceResult.acceptance.acceptedAt,
    },
    exclusions: [...EXCLUSIONS],
  };
  const manifest = {
    ...manifestPayload,
    digest: materializer.sha256(materializer.canonicalBytes(manifestPayload)),
  };
  return new Map([
    ['direction-migration.json', loaded.migration.bytes],
    ['integrated.md', loaded.integrated.bytes],
    ['manifest.json', Buffer.from(materializer.canonicalBytes(manifest))],
    ['review-bundle.json', prepared.file.bytes],
    ['revision-identity.json', revisionIdentityBytes],
    ['source-revision-manifest.json', loaded.pendingFile.bytes],
    ['story.md', loaded.source.bytes],
    ['visual-directions.json', loaded.directions.bytes],
  ]);
}

function assertExistingRevision(root, target, files) {
  if (!fs.existsSync(target)) return false;
  const realTarget = assertExistingDirectoryIsSafe(
    root,
    target,
    'story_source_revision_accepted_collision',
  );
  const names = fs.readdirSync(target).sort();
  if (JSON.stringify(names) !== JSON.stringify([...files.keys()].sort())) {
    throw new Error('story_source_revision_accepted_collision');
  }
  for (const [name, bytes] of files) {
    const filePath = path.join(target, name);
    let stat;
    let realFile;
    try {
      stat = fs.lstatSync(filePath);
      realFile = fs.realpathSync(filePath);
    } catch {
      throw new Error('story_source_revision_accepted_collision');
    }
    if (
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      stat.nlink !== 1 ||
      !pathIsInside(realTarget, realFile)
    ) {
      throw new Error('story_source_revision_accepted_collision');
    }
    const existing = fs.readFileSync(realFile);
    if (!existing.equals(bytes)) throw new Error('story_source_revision_accepted_collision');
  }
  return true;
}

function promoteRevision(
  { pendingManifestPath, reviewBundlePath, acceptancePath, write },
  roots = {},
) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const acceptedRoot = roots.acceptedRootRelative || ACCEPTED_ROOT_RELATIVE;
  const loaded = loadPendingRevision(pendingManifestPath, roots);
  const prepared = readReviewBundle(reviewBundlePath, loaded, roots);
  prepared.reviewSha256 = prepared.file.sha256;
  const acceptanceResult = readAcceptance(acceptancePath, prepared, roots);
  const targetRelative = `${acceptedRoot}/${loaded.pending.storyKey}/revisions/${prepared.review.revisionDigest}`;
  const target = path.resolve(repoRoot, ...targetRelative.split('/'));
  const acceptedRootAbsolute = path.resolve(repoRoot, ...acceptedRoot.split('/'));
  const legacyRoot = path.resolve(repoRoot, ...acceptedRoot.split('/'), loaded.pending.storyKey);
  const revisionsRoot = path.join(legacyRoot, 'revisions');
  if (
    !pathIsInside(legacyRoot, target) ||
    path.dirname(target) !== revisionsRoot
  ) {
    throw new Error('story_source_revision_accepted_target_invalid');
  }
  assertExistingDirectoryIsSafe(
    acceptedRootAbsolute,
    legacyRoot,
    'story_source_revision_accepted_target_invalid',
  );
  const files = acceptedRevisionFiles(loaded, prepared, acceptanceResult);
  if (assertExistingRevision(legacyRoot, target, files)) {
    return { created: false, revisionDigest: prepared.review.revisionDigest, target: targetRelative };
  }
  if (!write) {
    return { created: false, revisionDigest: prepared.review.revisionDigest, target: targetRelative };
  }
  resolveFreshContainedDirectory(
    repoRoot,
    targetRelative,
    `${acceptedRoot}/${loaded.pending.storyKey}`,
    'story_source_revision_accepted_target_invalid',
  );
  writeFreshDirectoryAtomically({
    root: legacyRoot,
    target,
    files,
    code: 'story_source_revision_accepted_collision',
  });
  return { created: true, revisionDigest: prepared.review.revisionDigest, target: targetRelative };
}

function parseArgs(argv) {
  const [command, ...tokens] = argv;
  const allowed = command === 'prepare-review'
    ? ['--out', '--pending', '--technical-review', '--write']
    : command === 'promote'
      ? ['--acceptance', '--pending', '--review', '--write']
      : null;
  if (!allowed || tokens.length !== allowed.length * 2) {
    throw new Error('story_source_revision_lifecycle_arguments_invalid');
  }
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!allowed.includes(key) || values.has(key)) {
      throw new Error('story_source_revision_lifecycle_arguments_invalid');
    }
    values.set(key, value);
  }
  if ([...values.keys()].sort().join('\0') !== [...allowed].sort().join('\0')) {
    throw new Error('story_source_revision_lifecycle_arguments_invalid');
  }
  if (!['true', 'false'].includes(values.get('--write'))) {
    throw new Error('story_source_revision_lifecycle_arguments_invalid');
  }
  return command === 'prepare-review'
    ? {
        command,
        outputDir: values.get('--out'),
        pendingManifestPath: values.get('--pending'),
        technicalReviewPath: values.get('--technical-review'),
        write: values.get('--write') === 'true',
      }
    : {
        command,
        acceptancePath: values.get('--acceptance'),
        pendingManifestPath: values.get('--pending'),
        reviewBundlePath: values.get('--review'),
        write: values.get('--write') === 'true',
      };
}

function main(argv) {
  const args = parseArgs(argv);
  const result = args.command === 'prepare-review'
    ? prepareReview(args)
    : promoteRevision(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message.split(':')[0] : 'story_source_revision_lifecycle_unknown_failure'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ACCEPTANCE_VERSION,
  ACCEPTED_REVISION_VERSION,
  EXCLUSIONS,
  REVIEW_VERSION,
  REVISION_IDENTITY_VERSION,
  TECHNICAL_REVIEW_VERSION,
  buildReviewBundle,
  loadPendingRevision,
  parseArgs,
  prepareReview,
  promoteRevision,
  revisionIdentityPayload,
  validateAcceptance,
  validatePendingShape,
  validateTechnicalReview,
};
