#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const materializer = require('./materialize-story-source-revision.cjs');
const enrichment = require('./story-source-visual-direction-enrichment-lifecycle.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUTS_ROOT_RELATIVE = 'outputs';
const ACCEPTED_ROOT_RELATIVE =
  'story-pipeline/04_approved_story_sources/accepted';
const REQUEST_VERSION =
  'small-heroes-story-source-visual-direction-acceptance-request/v1';
const TECHNICAL_REVIEW_VERSION =
  'small-heroes-story-source-visual-direction-technical-review/v1';
const PRODUCT_ACCEPTANCE_VERSION =
  'small-heroes-story-source-visual-direction-product-acceptance/v1';
const ACCEPTED_REVISION_VERSION =
  'small-heroes-product-accepted-story-source-revision-manifest/v3';
const AUTHORITY_SCOPE = 'story_source_and_visual_directions_only';
const SHA256_HEX = /^[a-f0-9]{64}$/;
const COMMIT_HEX = /^[a-f0-9]{40}$/;
const SAFE_SEGMENT = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;
const EXCLUSIONS = Object.freeze([
  'blueprint',
  'deployment',
  'image_render',
  'production',
  'provider_call',
  'runtime_locator',
  'story_bank_current_pointer',
  'visual_contract',
  'visual_package',
  'wizard',
]);
const RUNTIME_ELIGIBILITY = Object.freeze({
  eligible: false,
  reason: 'accepted_story_source_requires_fresh_visual_contract',
});

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
  return (
    relative.length > 0 &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
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

function assertNoLinkComponents(rootPath, targetPath, code) {
  const relative = path.relative(rootPath, targetPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(code);
  }
  let current = rootPath;
  const rootStat = fs.lstatSync(current);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(code);
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(code);
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
}

function parseJson(bytes, code) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(code);
  }
}

function canonicalDigest(payload) {
  return materializer.sha256(materializer.canonicalBytes(payload));
}

function attachDigest(payload) {
  const withAlgorithm = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
  };
  return { ...withAlgorithm, digest: canonicalDigest(withAlgorithm) };
}

function digestIsCanonical(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    value.digestAlgorithm !== 'canonical-json-sha256' ||
    !SHA256_HEX.test(value.digest)
  ) {
    return false;
  }
  const { digest, ...payload } = value;
  return canonicalDigest(payload) === digest;
}

function validateTechnicalReview(value) {
  if (
    !exactKeys(value, [
      'acceptedMinor',
      'baseCommit',
      'blocker',
      'candidateDigest',
      'digest',
      'digestAlgorithm',
      'headCommit',
      'major',
      'minor',
      'reviewBundleDigest',
      'reviewer',
      'status',
      'version',
    ]) ||
    value.version !== TECHNICAL_REVIEW_VERSION ||
    value.status !== 'pass' ||
    value.reviewer !== 'Claude Code' ||
    !COMMIT_HEX.test(value.baseCommit) ||
    !COMMIT_HEX.test(value.headCommit) ||
    value.baseCommit === value.headCommit ||
    value.blocker !== 0 ||
    value.major !== 0 ||
    !Number.isSafeInteger(value.minor) ||
    value.minor < 0 ||
    !SHA256_HEX.test(value.candidateDigest) ||
    !SHA256_HEX.test(value.reviewBundleDigest) ||
    !Array.isArray(value.acceptedMinor) ||
    value.acceptedMinor.length !== value.minor ||
    !value.acceptedMinor.every(
      (entry) =>
        exactKeys(entry, ['code', 'disposition', 'note']) &&
        SAFE_SEGMENT.test(entry.code) &&
        entry.disposition === 'accepted_non_blocking' &&
        typeof entry.note === 'string' &&
        entry.note.trim() === entry.note &&
        entry.note.length >= 8 &&
        entry.note.length <= 1000,
    ) ||
    !digestIsCanonical(value)
  ) {
    throw new Error('story_visual_direction_technical_review_invalid');
  }
  return value;
}

function validateRequest(value) {
  if (
    !exactKeys(value, [
      'candidate',
      'productAcceptance',
      'storyKey',
      'technicalReview',
      'version',
    ]) ||
    value.version !== REQUEST_VERSION ||
    !SAFE_SEGMENT.test(value.storyKey) ||
    !exactKeys(value.candidate, [
      'candidateDigest',
      'outputRoot',
      'requestPath',
      'reviewBundleDigest',
    ]) ||
    !SHA256_HEX.test(value.candidate.candidateDigest) ||
    !SHA256_HEX.test(value.candidate.reviewBundleDigest) ||
    !canonicalRepoRelativePathIsValid(value.candidate.outputRoot) ||
    !value.candidate.outputRoot.startsWith('outputs/') ||
    !canonicalRepoRelativePathIsValid(value.candidate.requestPath) ||
    !value.candidate.requestPath.startsWith('outputs/') ||
    !exactKeys(value.technicalReview, ['bytes', 'digest', 'path', 'sha256']) ||
    !canonicalRepoRelativePathIsValid(value.technicalReview.path) ||
    !value.technicalReview.path.startsWith('outputs/') ||
    !Number.isSafeInteger(value.technicalReview.bytes) ||
    value.technicalReview.bytes < 1 ||
    !SHA256_HEX.test(value.technicalReview.sha256) ||
    !SHA256_HEX.test(value.technicalReview.digest) ||
    !exactKeys(value.productAcceptance, [
      'acceptedAt',
      'acceptedBy',
      'decision',
    ]) ||
    value.productAcceptance.acceptedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(value.productAcceptance.acceptedAt) ||
    typeof value.productAcceptance.decision !== 'string' ||
    value.productAcceptance.decision.trim() !== value.productAcceptance.decision ||
    value.productAcceptance.decision.length < 8 ||
    value.productAcceptance.decision.length > 1000
  ) {
    throw new Error('story_visual_direction_acceptance_request_invalid');
  }
  return value;
}

function loadInputs(requestPath, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const outputsRoot = roots.outputsRootRelative || OUTPUTS_ROOT_RELATIVE;
  const requestFile = readContainedRegularFile({
    repoRoot,
    relativePath: requestPath,
    allowedRoot: outputsRoot,
    maximumBytes: 64 * 1024,
    code: 'story_visual_direction_acceptance_request_invalid',
  });
  const request = validateRequest(
    parseJson(requestFile.bytes, 'story_visual_direction_acceptance_request_invalid'),
  );
  const expectedRequestBytes = Buffer.from(
    `${JSON.stringify(request, null, 2)}\n`,
    'utf8',
  );
  if (!requestFile.bytes.equals(expectedRequestBytes)) {
    throw new Error('story_visual_direction_acceptance_request_not_canonical');
  }
  const existing = enrichment.loadExistingCandidate(
    {
      requestPath: request.candidate.requestPath,
      outputRoot: request.candidate.outputRoot,
    },
    roots,
  );
  if (
    existing.candidate.candidateDigest !== request.candidate.candidateDigest ||
    existing.candidate.reviewBundle.digest !== request.candidate.reviewBundleDigest ||
    existing.candidate.manifest.storyKey !== request.storyKey
  ) {
    throw new Error('story_visual_direction_acceptance_candidate_invalid');
  }
  const technicalReviewFile = readContainedRegularFile({
    repoRoot,
    relativePath: request.technicalReview.path,
    allowedRoot: outputsRoot,
    maximumBytes: 64 * 1024,
    code: 'story_visual_direction_technical_review_invalid',
  });
  if (
    technicalReviewFile.bytes.length !== request.technicalReview.bytes ||
    technicalReviewFile.sha256 !== request.technicalReview.sha256
  ) {
    throw new Error('story_visual_direction_technical_review_invalid');
  }
  const technicalReview = validateTechnicalReview(
    parseJson(
      technicalReviewFile.bytes,
      'story_visual_direction_technical_review_invalid',
    ),
  );
  const expectedTechnicalBytes = Buffer.from(
    materializer.canonicalBytes(technicalReview),
    'utf8',
  );
  if (
    !technicalReviewFile.bytes.equals(expectedTechnicalBytes) ||
    technicalReview.digest !== request.technicalReview.digest ||
    technicalReview.candidateDigest !== request.candidate.candidateDigest ||
    technicalReview.reviewBundleDigest !== request.candidate.reviewBundleDigest
  ) {
    throw new Error('story_visual_direction_technical_review_invalid');
  }
  return {
    existing,
    request,
    requestFile,
    technicalReview,
    technicalReviewFile,
  };
}

function fileDescriptor(filename, bytes, digest) {
  return {
    filename,
    bytes: bytes.length,
    sha256: materializer.sha256(bytes),
    ...(digest ? { digest } : {}),
  };
}

function buildPublicationBundle(loaded) {
  const candidate = loaded.existing.candidate;
  const candidateFiles = candidate.files;
  const source = loaded.existing.loaded.source;
  const identityBytes = candidateFiles.get('revision-identity.json');
  const candidateManifestBytes = candidateFiles.get('manifest.json');
  const candidateReviewBytes = candidateFiles.get('review-bundle.json');
  const directionBytes = candidateFiles.get('visual-directions.json');
  const integratedBytes = candidateFiles.get('integrated.md');
  if (
    !identityBytes ||
    !candidateManifestBytes ||
    !candidateReviewBytes ||
    !directionBytes ||
    !integratedBytes
  ) {
    throw new Error('story_visual_direction_acceptance_candidate_invalid');
  }
  const sourceStoryBytes = loaded.existing.loaded.sourceStoryFile.bytes;
  const acceptancePayload = {
    version: PRODUCT_ACCEPTANCE_VERSION,
    status: 'accepted',
    authorityScope: AUTHORITY_SCOPE,
    storyKey: loaded.request.storyKey,
    revisionDigest: candidate.candidateDigest,
    candidateDigest: candidate.candidateDigest,
    reviewBundleDigest: candidate.reviewBundle.digest,
    technicalReviewDigest: loaded.technicalReview.digest,
    acceptedBy: 'Guy',
    acceptedAt: loaded.request.productAcceptance.acceptedAt,
    decision: loaded.request.productAcceptance.decision,
    runtimeEligibility: RUNTIME_ELIGIBILITY,
    exclusions: [...EXCLUSIONS],
  };
  const acceptance = attachDigest(acceptancePayload);
  const acceptanceBytes = Buffer.from(materializer.canonicalBytes(acceptance), 'utf8');
  const files = new Map([
    ['enrichment-manifest.json', candidateManifestBytes],
    ['enrichment-review-bundle.json', candidateReviewBytes],
    ['integrated.md', integratedBytes],
    ['product-acceptance.json', acceptanceBytes],
    ['revision-identity.json', identityBytes],
    ['story.md', sourceStoryBytes],
    ['technical-review.json', loaded.technicalReviewFile.bytes],
    ['visual-directions.json', directionBytes],
  ]);
  const manifestPayload = {
    version: ACCEPTED_REVISION_VERSION,
    status: 'product_accepted_story_source_revision',
    authorityScope: AUTHORITY_SCOPE,
    storyKey: loaded.request.storyKey,
    revisionDigest: candidate.candidateDigest,
    sourceProfile: source.manifest.sourceProfile,
    sourceGenderMode: source.manifest.sourceGenderMode,
    identity: source.manifest.identity,
    parent: candidate.identity.sourceRevision,
    continuityIntent: candidate.identity.continuityIntent,
    productAcceptance: {
      acceptedBy: acceptance.acceptedBy,
      acceptedAt: acceptance.acceptedAt,
      digest: acceptance.digest,
    },
    files: {
      enrichmentManifest: fileDescriptor(
        'enrichment-manifest.json',
        candidateManifestBytes,
        candidate.manifest.digest,
      ),
      enrichmentReviewBundle: fileDescriptor(
        'enrichment-review-bundle.json',
        candidateReviewBytes,
        candidate.reviewBundle.digest,
      ),
      integratedStory: fileDescriptor('integrated.md', integratedBytes),
      productAcceptance: fileDescriptor(
        'product-acceptance.json',
        acceptanceBytes,
        acceptance.digest,
      ),
      revisionIdentity: fileDescriptor(
        'revision-identity.json',
        identityBytes,
        candidate.candidateDigest,
      ),
      story: fileDescriptor('story.md', sourceStoryBytes),
      technicalReview: fileDescriptor(
        'technical-review.json',
        loaded.technicalReviewFile.bytes,
        loaded.technicalReview.digest,
      ),
      visualDirections: fileDescriptor('visual-directions.json', directionBytes),
    },
    runtimeEligibility: RUNTIME_ELIGIBILITY,
    exclusions: [...EXCLUSIONS],
  };
  const manifest = attachDigest(manifestPayload);
  files.set('manifest.json', Buffer.from(materializer.canonicalBytes(manifest), 'utf8'));
  return {
    acceptance,
    files,
    manifest,
    revisionDigest: candidate.candidateDigest,
  };
}

function canonicalOutputRoot(repoRoot, outputRootRelative, write) {
  if (
    !canonicalRepoRelativePathIsValid(outputRootRelative) ||
    !outputRootRelative.startsWith(`${OUTPUTS_ROOT_RELATIVE}/`)
  ) {
    throw new Error('story_visual_direction_acceptance_output_root_rejected');
  }
  const outputsRoot = path.resolve(repoRoot, OUTPUTS_ROOT_RELATIVE);
  const outputRoot = path.resolve(repoRoot, ...outputRootRelative.split('/'));
  if (!pathIsInside(outputsRoot, outputRoot)) {
    throw new Error('story_visual_direction_acceptance_output_root_rejected');
  }
  let current = outputsRoot;
  for (const segment of path.relative(outputsRoot, outputRoot).split(path.sep)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('story_visual_direction_acceptance_output_root_rejected');
    }
  }
  if (write) {
    fs.mkdirSync(outputRoot, { recursive: true });
    assertNoLinkComponents(
      outputsRoot,
      outputRoot,
      'story_visual_direction_acceptance_output_root_rejected',
    );
  }
  return outputRoot;
}

function assertExistingBundle(target, files, code) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(code);
  const expectedNames = [...files.keys()].sort();
  const actualNames = fs.readdirSync(target).sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) {
    throw new Error(code);
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
      throw new Error(code);
    }
  }
}

function writeDirectoryAtomically(root, target, files, code) {
  if (fs.existsSync(target)) {
    assertExistingBundle(target, files, code);
    return { created: false, target };
  }
  const staging = path.join(
    root,
    `.${path.basename(target)}.${process.pid}.staging`,
  );
  if (fs.existsSync(staging)) throw new Error(`${code}_staging_exists`);
  fs.mkdirSync(staging, { recursive: false });
  try {
    for (const [name, bytes] of files) {
      if (path.basename(name) !== name || !Buffer.isBuffer(bytes)) {
        throw new Error(`${code}_filename_invalid`);
      }
      fs.writeFileSync(path.join(staging, name), bytes, { flag: 'wx' });
    }
    fs.renameSync(staging, target);
  } catch (error) {
    if (fs.existsSync(staging)) {
      const stat = fs.lstatSync(staging);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error(`${code}_staging_cleanup_rejected`);
      }
      fs.rmSync(staging, { recursive: true, force: false });
    }
    throw error;
  }
  return { created: true, target };
}

function prepare({ requestPath, outputRoot, write = false }, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const loaded = loadInputs(requestPath, roots);
  const bundle = buildPublicationBundle(loaded);
  const outputRootAbsolute = canonicalOutputRoot(repoRoot, outputRoot, write);
  const target = path.join(outputRootAbsolute, bundle.revisionDigest);
  let created = false;
  if (write) {
    ({ created } = writeDirectoryAtomically(
      outputRootAbsolute,
      target,
      bundle.files,
      'story_visual_direction_publication_candidate_collision',
    ));
  }
  return {
    version: ACCEPTED_REVISION_VERSION,
    status: 'publication_candidate',
    created,
    revisionDigest: bundle.revisionDigest,
    manifestDigest: bundle.manifest.digest,
    productAcceptanceDigest: bundle.acceptance.digest,
    target: path.relative(repoRoot, target).replaceAll('\\', '/'),
    acceptedTarget:
      `${roots.acceptedRootRelative || ACCEPTED_ROOT_RELATIVE}/` +
      `${loaded.request.storyKey}/revisions/${bundle.revisionDigest}`,
    runtimeEligibility: RUNTIME_ELIGIBILITY,
    externalCounters: {
      providerCalls: 0,
      imageRenders: 0,
      audioRenders: 0,
      databaseWrites: 0,
      storageWrites: 0,
      locatorWrites: 0,
    },
    bundle,
    loaded,
  };
}

function acceptedTarget(repoRoot, storyKey, revisionDigest, acceptedRootRelative, write) {
  if (!SAFE_SEGMENT.test(storyKey) || !SHA256_HEX.test(revisionDigest)) {
    throw new Error('story_visual_direction_accepted_target_invalid');
  }
  const acceptedRoot = path.resolve(repoRoot, ...acceptedRootRelative.split('/'));
  const storyRoot = path.join(acceptedRoot, storyKey);
  const revisionsRoot = path.join(storyRoot, 'revisions');
  try {
    const acceptedStat = fs.lstatSync(acceptedRoot);
    const storyStat = fs.lstatSync(storyRoot);
    if (
      acceptedStat.isSymbolicLink() ||
      !acceptedStat.isDirectory() ||
      storyStat.isSymbolicLink() ||
      !storyStat.isDirectory()
    ) {
      throw new Error('story_visual_direction_accepted_target_invalid');
    }
    assertNoLinkComponents(
      acceptedRoot,
      storyRoot,
      'story_visual_direction_accepted_target_invalid',
    );
  } catch {
    throw new Error('story_visual_direction_accepted_target_invalid');
  }
  if (write && !fs.existsSync(revisionsRoot)) fs.mkdirSync(revisionsRoot);
  if (fs.existsSync(revisionsRoot)) {
    const stat = fs.lstatSync(revisionsRoot);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('story_visual_direction_accepted_target_invalid');
    }
    assertNoLinkComponents(
      acceptedRoot,
      revisionsRoot,
      'story_visual_direction_accepted_target_invalid',
    );
  }
  return {
    revisionsRoot,
    target: path.join(revisionsRoot, revisionDigest),
  };
}

function publish({ requestPath, outputRoot, write = false }, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const acceptedRootRelative =
    roots.acceptedRootRelative || ACCEPTED_ROOT_RELATIVE;
  const prepared = prepare({ requestPath, outputRoot, write: false }, roots);
  const publicationRoot = canonicalOutputRoot(repoRoot, outputRoot, false);
  const publicationTarget = path.join(publicationRoot, prepared.revisionDigest);
  if (!fs.existsSync(publicationTarget)) {
    throw new Error('story_visual_direction_publication_candidate_missing');
  }
  assertNoLinkComponents(
    path.resolve(repoRoot, OUTPUTS_ROOT_RELATIVE),
    publicationTarget,
    'story_visual_direction_publication_candidate_collision',
  );
  assertExistingBundle(
    publicationTarget,
    prepared.bundle.files,
    'story_visual_direction_publication_candidate_collision',
  );
  const accepted = acceptedTarget(
    repoRoot,
    prepared.loaded.request.storyKey,
    prepared.revisionDigest,
    acceptedRootRelative,
    write,
  );
  let created = false;
  if (write) {
    ({ created } = writeDirectoryAtomically(
      accepted.revisionsRoot,
      accepted.target,
      prepared.bundle.files,
      'story_visual_direction_accepted_revision_collision',
    ));
  } else if (fs.existsSync(accepted.target)) {
    assertExistingBundle(
      accepted.target,
      prepared.bundle.files,
      'story_visual_direction_accepted_revision_collision',
    );
  }
  return {
    version: ACCEPTED_REVISION_VERSION,
    status: 'product_accepted_story_source_revision',
    created,
    wouldCreate: !fs.existsSync(accepted.target),
    revisionDigest: prepared.revisionDigest,
    manifestDigest: prepared.manifestDigest,
    productAcceptanceDigest: prepared.productAcceptanceDigest,
    target: path.relative(repoRoot, accepted.target).replaceAll('\\', '/'),
    runtimeEligibility: RUNTIME_ELIGIBILITY,
    externalCounters: prepared.externalCounters,
  };
}

function parseArgs(argv) {
  const command = argv[0];
  if (!['prepare', 'publish'].includes(command)) {
    throw new Error('story_visual_direction_acceptance_arguments_invalid');
  }
  const allowed = new Set(['--output-root', '--request', '--write']);
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
      throw new Error('story_visual_direction_acceptance_arguments_invalid');
    }
    values.set(key, value);
  }
  if (
    values.size !== 3 ||
    !['true', 'false'].includes(values.get('--write'))
  ) {
    throw new Error('story_visual_direction_acceptance_arguments_invalid');
  }
  return {
    command,
    requestPath: values.get('--request'),
    outputRoot: values.get('--output-root'),
    write: values.get('--write') === 'true',
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const fn = args.command === 'prepare' ? prepare : publish;
  const result = fn(
    {
      requestPath: args.requestPath,
      outputRoot: args.outputRoot,
      write: args.write,
    },
    {},
  );
  process.stdout.write(
    `${JSON.stringify({
      version: result.version,
      status: result.status,
      created: result.created,
      ...(Object.hasOwn(result, 'wouldCreate')
        ? { wouldCreate: result.wouldCreate }
        : {}),
      revisionDigest: result.revisionDigest,
      manifestDigest: result.manifestDigest,
      productAcceptanceDigest: result.productAcceptanceDigest,
      target: result.target,
      runtimeEligibility: result.runtimeEligibility,
      externalCounters: result.externalCounters,
    }, null, 2)}\n`,
  );
}

module.exports = {
  ACCEPTED_REVISION_VERSION,
  AUTHORITY_SCOPE,
  EXCLUSIONS,
  PRODUCT_ACCEPTANCE_VERSION,
  REQUEST_VERSION,
  RUNTIME_ELIGIBILITY,
  TECHNICAL_REVIEW_VERSION,
  attachDigest,
  buildPublicationBundle,
  loadInputs,
  parseArgs,
  prepare,
  publish,
  validateRequest,
  validateTechnicalReview,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error
        ? error.message.split(':')[0]
        : 'story_visual_direction_acceptance_unknown_failure'}\n`,
    );
    process.exitCode = 1;
  }
}
