#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const materializer = require('./materialize-story-source-revision.cjs');
const creativeReplacement = require('./story-source-creative-replacement-lifecycle.cjs');
const directionContract = require('./story-visual-direction-contract.cjs');
const directionIntegration = require('./story-bank-direction-integration.cjs');
const companionAppearanceState = require('../lib/companion-appearance-state.ts');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUTS_ROOT_RELATIVE = 'outputs';
const ACCEPTED_ROOT_RELATIVE =
  'story-pipeline/04_approved_story_sources/accepted';
const REQUEST_VERSION =
  'small-heroes-story-source-visual-direction-enrichment-request/v1';
const CONTINUITY_INTENT_VERSION =
  'small-heroes-story-visual-continuity-intent/v1';
const COMPOSITION_POLICY_VERSION =
  'small-heroes-storyboard-composition-review-policy/v1';
const REVISION_IDENTITY_VERSION =
  'small-heroes-story-source-visual-direction-enrichment-identity/v1';
const REVIEW_BUNDLE_VERSION =
  'small-heroes-story-source-visual-direction-enrichment-review-bundle/v1';
const CANDIDATE_MANIFEST_VERSION =
  'small-heroes-story-source-visual-direction-enrichment-candidate-manifest/v1';
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SAFE_SEGMENT = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;

const EXCLUSIONS = Object.freeze([
  'accepted_revision_publication',
  'blueprint',
  'deployment',
  'production',
  'provider',
  'render',
  'runtime_locator',
  'story_bank',
  'visual_contract',
  'visual_package',
  'wizard',
]);

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
      stat.size <= 0 ||
      stat.size > maximumBytes
    ) {
      throw new Error(code);
    }
    const bytes = fs.readFileSync(target);
    if (bytes.length !== stat.size) throw new Error(code);
    return {
      absolutePath: target,
      bytes,
      relativePath,
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

function boundFileIsValid(value) {
  return (
    exactKeys(value, ['bytes', 'path', 'sha256']) &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes > 0 &&
    canonicalRepoRelativePathIsValid(value.path) &&
    SHA256_HEX.test(value.sha256)
  );
}

function orderedUniquePageNumbersAreValid(value, pageCount) {
  return (
    Array.isArray(value) &&
    value.length <= pageCount &&
    value.every(
      (pageNumber, index) =>
        Number.isSafeInteger(pageNumber) &&
        pageNumber >= 1 &&
        pageNumber <= pageCount &&
        (index === 0 || pageNumber > value[index - 1]),
    )
  );
}

function validateContinuityIntent(value, pageCount) {
  if (
    !exactKeys(value, [
      'childWardrobeAuthority',
      'childWardrobeTransitionPages',
      'companionAccessoryAuthority',
      'companionAppearanceAuthority',
      'companionStateTransitionPages',
      'version',
    ]) ||
    value.version !== CONTINUITY_INTENT_VERSION ||
    value.childWardrobeAuthority !== 'frozen_visual_contract' ||
    value.companionAccessoryAuthority !== 'canonical_companion_profile' ||
    value.companionAppearanceAuthority !== 'frozen_companion_state' ||
    !orderedUniquePageNumbersAreValid(
      value.childWardrobeTransitionPages,
      pageCount,
    ) ||
    !orderedUniquePageNumbersAreValid(
      value.companionStateTransitionPages,
      pageCount,
    )
  ) {
    throw new Error('story_visual_direction_enrichment_continuity_intent_invalid');
  }
  return value;
}

function validateRequest(value) {
  if (
    !exactKeys(value, [
      'compositionPolicyVersion',
      'continuityIntent',
      'sourceRevision',
      'storyKey',
      'version',
      'visualDirections',
    ]) ||
    value.version !== REQUEST_VERSION ||
    !SAFE_SEGMENT.test(value.storyKey) ||
    value.compositionPolicyVersion !== COMPOSITION_POLICY_VERSION ||
    !exactKeys(value.sourceRevision, [
      'manifestDigest',
      'manifestPath',
      'manifestSha256',
      'revisionDigest',
    ]) ||
    !canonicalRepoRelativePathIsValid(value.sourceRevision.manifestPath) ||
    !SHA256_HEX.test(value.sourceRevision.manifestDigest) ||
    !SHA256_HEX.test(value.sourceRevision.manifestSha256) ||
    !SHA256_HEX.test(value.sourceRevision.revisionDigest) ||
    !boundFileIsValid(value.visualDirections)
  ) {
    throw new Error('story_visual_direction_enrichment_request_invalid');
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
    code: 'story_visual_direction_enrichment_request_path_rejected',
  });
  if (path.extname(file.absolutePath).toLowerCase() !== '.json') {
    throw new Error('story_visual_direction_enrichment_request_path_rejected');
  }
  return {
    file,
    request: validateRequest(
      parseJson(file.bytes, 'story_visual_direction_enrichment_request_json_invalid'),
    ),
  };
}

function protectedAuthorityIssues(record, companionId) {
  const issues = [];
  const childReference =
    /\b(?:child|boy|girl|kid|toddler)\b|\{\{childName\}\}/i;
  const wardrobeGarment =
    /\b(?:wardrobe|outfits?|pajamas?|pyjamas?|shirts?|trousers|pants|dresses?|skirts?|sweaters?|jackets?|coats?|hoodies?|shoes?|clothes|clothing|scarves|scarf|socks?|boots?|shorts|blouses?|tops?|uniforms?|costumes?|robes?|gowns?|slippers?)\b/i;
  const wardrobeChange =
    /\b(?:wears?|wearing|wore|puts?\s+on|takes?\s+off|gets?\s+dressed|changes?\s+clothes|ties?\s+(?:his|her|their)\s+shoes?)\b/i;
  const explicitBodyAppearance =
    /\b(?:(?:his|her|its|their)\s+)?(?:body|skin)\s+(?:hue|colou?r|tone|pattern|turns?|shifts?|changes?|becomes?|goes?|looks?)\b/i;
  const declaredAuthority =
    companionAppearanceState.declaredCompanionAppearanceStateAuthority(companionId);
  if (
    !declaredAuthority ||
    companionAppearanceState.companionAppearanceStateAuthorityIssues(
      declaredAuthority,
      companionId,
    ).length > 0
  ) {
    return ['companion_appearance_state_authority_missing'];
  }
  const authority = {
    ...declaredAuthority,
    subjectAliases: [...new Set(['companion', ...declaredAuthority.subjectAliases])],
  };
  for (const page of record.pages) {
    const fields = [
      ['setting', page.setting],
      ['mainAction', page.mainAction],
      ['heroObject', page.heroObject],
      ['lighting', page.lighting],
      ...page.supportingCharacters.map((value, index) => [
        `supportingCharacters[${index}]`,
        value,
      ]),
      ...page.continuityAnchors.map((value, index) => [
        `continuityAnchors[${index}]`,
        value,
      ]),
    ];
    for (const [field, raw] of fields) {
      if (typeof raw !== 'string') continue;
      if (
        wardrobeChange.test(raw) ||
        (childReference.test(raw) && wardrobeGarment.test(raw))
      ) {
        issues.push(`page_${page.pageNumber}_${field}_wardrobe_authority`);
      }
      if (
        explicitBodyAppearance.test(raw) ||
        companionAppearanceState.companionAppearanceProseConflicts({
          authority,
          texts: [raw],
        }).length > 0
      ) {
        issues.push(`page_${page.pageNumber}_${field}_companion_appearance_authority`);
      }
    }
  }
  return [...new Set(issues)];
}

function compositionMetrics(record) {
  const wideShots = new Set(['extreme_wide', 'wide']);
  const closeShots = new Set(['medium_close', 'close', 'detail']);
  const shotTypes = [...new Set(record.pages.map((page) => page.shotType))];
  const cameraAngles = [
    ...new Set(record.pages.map((page) => page.cameraAngle)),
  ];
  const adjacentRepeatedPairs = [];
  let currentShotRun = 0;
  let maximumShotRun = 0;
  let previousShot = null;
  for (let index = 0; index < record.pages.length; index += 1) {
    const page = record.pages[index];
    if (page.shotType === previousShot) currentShotRun += 1;
    else currentShotRun = 1;
    maximumShotRun = Math.max(maximumShotRun, currentShotRun);
    previousShot = page.shotType;
    if (index > 0) {
      const prior = record.pages[index - 1];
      if (
        page.shotType === prior.shotType &&
        page.cameraAngle === prior.cameraAngle
      ) {
        adjacentRepeatedPairs.push([prior.pageNumber, page.pageNumber]);
      }
    }
  }
  const metrics = {
    pageCount: record.pages.length,
    widePageNumbers: record.pages
      .filter((page) => wideShots.has(page.shotType))
      .map((page) => page.pageNumber),
    closeFocusPageNumbers: record.pages
      .filter((page) => closeShots.has(page.shotType))
      .map((page) => page.pageNumber),
    distinctShotTypes: shotTypes.sort(),
    distinctCameraAngles: cameraAngles.sort(),
    adjacentRepeatedPairs,
    maximumShotTypeRun: maximumShotRun,
  };
  const minimumShotTypes = record.pages.length >= 8 ? 4 : 2;
  const minimumAngles = record.pages.length >= 8 ? 3 : 2;
  if (
    metrics.widePageNumbers.length === 0 ||
    metrics.closeFocusPageNumbers.length === 0 ||
    metrics.distinctShotTypes.length < minimumShotTypes ||
    metrics.distinctCameraAngles.length < minimumAngles ||
    metrics.adjacentRepeatedPairs.length > 0 ||
    metrics.maximumShotTypeRun > 2
  ) {
    throw new Error('story_visual_direction_enrichment_composition_invalid');
  }
  return metrics;
}

function loadInputs(requestPath, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const outputsRoot = roots.outputsRootRelative || OUTPUTS_ROOT_RELATIVE;
  const acceptedRoot =
    roots.acceptedRootRelative || ACCEPTED_ROOT_RELATIVE;
  const requestResult = readRequestFile(requestPath, roots);
  const request = requestResult.request;
  const source = creativeReplacement.loadAcceptedCreativeReplacement(
    { manifestPath: request.sourceRevision.manifestPath },
    { repoRoot, acceptedRootRelative: acceptedRoot },
  );
  const sourceManifestFile = readContainedRegularFile({
    repoRoot,
    relativePath: source.manifestPath,
    allowedRoot: `${acceptedRoot}/${request.storyKey}`,
    maximumBytes: 256 * 1024,
    code: 'story_visual_direction_enrichment_source_revision_invalid',
  });
  if (
    source.manifest.storyKey !== request.storyKey ||
    source.revisionDigest !== request.sourceRevision.revisionDigest ||
    source.manifest.digest !== request.sourceRevision.manifestDigest ||
    sourceManifestFile.sha256 !== request.sourceRevision.manifestSha256
  ) {
    throw new Error('story_visual_direction_enrichment_source_revision_invalid');
  }
  const sourceStoryFile = readContainedRegularFile({
    repoRoot,
    relativePath: source.storyPath,
    allowedRoot: `${acceptedRoot}/${request.storyKey}`,
    maximumBytes: 256 * 1024,
    code: 'story_visual_direction_enrichment_source_story_invalid',
  });
  if (sourceStoryFile.sha256 !== source.storySha256) {
    throw new Error('story_visual_direction_enrichment_source_story_invalid');
  }
  const storyText = sourceStoryFile.bytes.toString('utf8');
  const story = directionContract.parseStory(storyText);
  if (
    source.manifest.identity?.category !== story.category ||
    source.manifest.identity?.companionId !== story.companionId ||
    source.manifest.identity?.direction !== story.direction ||
    source.manifest.identity?.pageCount !== story.declaredPages
  ) {
    throw new Error('story_visual_direction_enrichment_source_story_invalid');
  }
  const continuityIntent = validateContinuityIntent(
    request.continuityIntent,
    story.declaredPages,
  );
  const directionFile = readContainedRegularFile({
    repoRoot,
    relativePath: request.visualDirections.path,
    allowedRoot: outputsRoot,
    maximumBytes: 256 * 1024,
    code: 'story_visual_direction_enrichment_directions_invalid',
  });
  if (
    directionFile.bytes.length !== request.visualDirections.bytes ||
    directionFile.sha256 !== request.visualDirections.sha256
  ) {
    throw new Error('story_visual_direction_enrichment_directions_invalid');
  }
  const parsedRecord = parseJson(
    directionFile.bytes,
    'story_visual_direction_enrichment_directions_invalid',
  );
  const record = directionContract.validateVisualDirectionRecord(
    directionContract.normalizeVisualDirectionRecord(parsedRecord),
    request.storyKey,
    story.declaredPages,
  );
  const expectedDirectionBytes = Buffer.from(
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8',
  );
  if (!directionFile.bytes.equals(expectedDirectionBytes)) {
    throw new Error('story_visual_direction_enrichment_directions_not_canonical');
  }
  const authorityIssues = protectedAuthorityIssues(record, story.companionId);
  if (authorityIssues.length > 0) {
    throw new Error(
      `story_visual_direction_enrichment_protected_authority_invalid:${authorityIssues.join(',')}`,
    );
  }
  const composition = compositionMetrics(record);
  const integratedText = directionIntegration.injectDirections(storyText, record);
  const integratedBytes = Buffer.from(integratedText, 'utf8');
  return {
    composition,
    continuityIntent,
    directionFile,
    integratedBytes,
    record,
    request,
    requestResult,
    source,
    sourceManifestFile,
    sourceStoryFile,
    story,
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

function buildCandidate(loaded) {
  const directionBytes = loaded.directionFile.bytes;
  const identity = {
    version: REVISION_IDENTITY_VERSION,
    storyKey: loaded.request.storyKey,
    sourceRevision: {
      manifestPath: loaded.source.manifestPath,
      manifestSha256: loaded.sourceManifestFile.sha256,
      manifestDigest: loaded.source.manifest.digest,
      revisionDigest: loaded.source.revisionDigest,
      storySha256: loaded.sourceStoryFile.sha256,
    },
    visualDirections: {
      sha256: materializer.sha256(directionBytes),
    },
    integratedStory: {
      sha256: materializer.sha256(loaded.integratedBytes),
    },
    compositionPolicyVersion: COMPOSITION_POLICY_VERSION,
    continuityIntent: loaded.continuityIntent,
  };
  const identityBytes = Buffer.from(materializer.canonicalBytes(identity), 'utf8');
  const candidateDigest = materializer.sha256(identityBytes);
  const reviewPayload = {
    version: REVIEW_BUNDLE_VERSION,
    status: 'pending_exact_product_review',
    authorityScope: 'visual_directions_enrichment_candidate_only',
    storyKey: loaded.request.storyKey,
    candidateDigest,
    sourceRevision: identity.sourceRevision,
    visualDirections: fileDescriptor('visual-directions.json', directionBytes),
    integratedStory: fileDescriptor('integrated.md', loaded.integratedBytes),
    compositionPolicyVersion: COMPOSITION_POLICY_VERSION,
    composition: loaded.composition,
    continuityIntent: loaded.continuityIntent,
    protectedAuthority: {
      childIdentityOrWardrobeInDirectionProse: false,
      companionAppearanceStateInDirectionProse: false,
    },
    runtimeEligibility: {
      eligible: false,
      reason: 'visual_directions_candidate_not_product_accepted',
    },
    exclusions: [...EXCLUSIONS],
  };
  const reviewBundle = {
    ...reviewPayload,
    digest: materializer.sha256(materializer.canonicalBytes(reviewPayload)),
  };
  const reviewBytes = Buffer.from(
    materializer.canonicalBytes(reviewBundle),
    'utf8',
  );
  const files = new Map([
    ['integrated.md', loaded.integratedBytes],
    ['revision-identity.json', identityBytes],
    ['review-bundle.json', reviewBytes],
    ['visual-directions.json', directionBytes],
  ]);
  const manifestPayload = {
    version: CANDIDATE_MANIFEST_VERSION,
    status: 'pending_exact_product_review',
    authorityScope: 'visual_directions_enrichment_candidate_only',
    storyKey: loaded.request.storyKey,
    candidateDigest,
    sourceRevision: identity.sourceRevision,
    compositionPolicyVersion: COMPOSITION_POLICY_VERSION,
    continuityIntent: loaded.continuityIntent,
    files: {
      integratedStory: fileDescriptor('integrated.md', loaded.integratedBytes),
      revisionIdentity: fileDescriptor(
        'revision-identity.json',
        identityBytes,
        candidateDigest,
      ),
      reviewBundle: fileDescriptor(
        'review-bundle.json',
        reviewBytes,
        reviewBundle.digest,
      ),
      visualDirections: fileDescriptor('visual-directions.json', directionBytes),
    },
    runtimeEligibility: reviewPayload.runtimeEligibility,
    exclusions: [...EXCLUSIONS],
  };
  const manifest = {
    ...manifestPayload,
    digest: materializer.sha256(materializer.canonicalBytes(manifestPayload)),
  };
  files.set('manifest.json', Buffer.from(materializer.canonicalBytes(manifest), 'utf8'));
  return {
    candidateDigest,
    files,
    identity,
    manifest,
    reviewBundle,
  };
}

function canonicalOutputRoot(repoRoot, outputRootRelative, write) {
  if (
    !canonicalRepoRelativePathIsValid(outputRootRelative) ||
    !outputRootRelative.startsWith(`${OUTPUTS_ROOT_RELATIVE}/`)
  ) {
    throw new Error('story_visual_direction_enrichment_output_root_rejected');
  }
  const outputsRoot = path.resolve(repoRoot, OUTPUTS_ROOT_RELATIVE);
  const outputRoot = path.resolve(repoRoot, ...outputRootRelative.split('/'));
  if (!pathIsInside(outputsRoot, outputRoot)) {
    throw new Error('story_visual_direction_enrichment_output_root_rejected');
  }
  let current = outputsRoot;
  const relative = path.relative(outputsRoot, outputRoot);
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('story_visual_direction_enrichment_output_root_rejected');
    }
  }
  if (write) {
    fs.mkdirSync(outputRoot, { recursive: true });
    assertNoLinkComponents(outputsRoot, outputRoot, 'story_visual_direction_enrichment_output_root_rejected');
  }
  return outputRoot;
}

function assertExistingCandidate(target, files) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('story_visual_direction_enrichment_candidate_collision');
  }
  const expectedNames = [...files.keys()].sort();
  const actualNames = fs.readdirSync(target).sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) {
    throw new Error('story_visual_direction_enrichment_candidate_collision');
  }
  for (const [name, bytes] of files) {
    const candidatePath = path.join(target, name);
    const fileStat = fs.lstatSync(candidatePath);
    if (
      fileStat.isSymbolicLink() ||
      !fileStat.isFile() ||
      fileStat.nlink !== 1 ||
      !fs.readFileSync(candidatePath).equals(bytes)
    ) {
      throw new Error('story_visual_direction_enrichment_candidate_collision');
    }
  }
}

function loadExistingCandidate({ requestPath, outputRoot }, roots = {}) {
  const repoRoot = roots.repoRoot || REPO_ROOT;
  const loaded = loadInputs(requestPath, roots);
  const candidate = buildCandidate(loaded);
  const outputRootAbsolute = canonicalOutputRoot(repoRoot, outputRoot, false);
  const target = path.join(outputRootAbsolute, candidate.candidateDigest);
  if (!fs.existsSync(target)) {
    throw new Error('story_visual_direction_enrichment_candidate_missing');
  }
  assertNoLinkComponents(
    path.resolve(repoRoot, OUTPUTS_ROOT_RELATIVE),
    target,
    'story_visual_direction_enrichment_candidate_collision',
  );
  assertExistingCandidate(target, candidate.files);
  return {
    candidate,
    loaded,
    target,
    targetRelative: path.relative(repoRoot, target).replaceAll('\\', '/'),
  };
}

function writeCandidateAtomically(outputRoot, candidate) {
  const target = path.join(outputRoot, candidate.candidateDigest);
  if (fs.existsSync(target)) {
    assertExistingCandidate(target, candidate.files);
    return { created: false, target };
  }
  const staging = path.join(
    outputRoot,
    `.${candidate.candidateDigest}.${process.pid}.staging`,
  );
  if (fs.existsSync(staging)) {
    throw new Error('story_visual_direction_enrichment_staging_exists');
  }
  fs.mkdirSync(staging, { recursive: false });
  try {
    for (const [name, bytes] of candidate.files) {
      if (path.basename(name) !== name) {
        throw new Error('story_visual_direction_enrichment_filename_invalid');
      }
      fs.writeFileSync(path.join(staging, name), bytes, { flag: 'wx' });
    }
    fs.renameSync(staging, target);
  } catch (error) {
    if (fs.existsSync(staging)) {
      const stat = fs.lstatSync(staging);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error('story_visual_direction_enrichment_staging_cleanup_rejected');
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
  const candidate = buildCandidate(loaded);
  const outputRootAbsolute = canonicalOutputRoot(repoRoot, outputRoot, write);
  const targetAbsolute = path.join(
    outputRootAbsolute,
    candidate.candidateDigest,
  );
  let created = false;
  if (write) {
    ({ created } = writeCandidateAtomically(outputRootAbsolute, candidate));
  } else if (fs.existsSync(targetAbsolute)) {
    assertExistingCandidate(targetAbsolute, candidate.files);
  }
  return {
    version: CANDIDATE_MANIFEST_VERSION,
    status: candidate.manifest.status,
    created,
    candidateDigest: candidate.candidateDigest,
    manifestDigest: candidate.manifest.digest,
    reviewBundleDigest: candidate.reviewBundle.digest,
    sourceRevisionDigest: loaded.source.revisionDigest,
    visualDirectionSha256: loaded.directionFile.sha256,
    integratedStorySha256: materializer.sha256(loaded.integratedBytes),
    composition: loaded.composition,
    target: path.relative(repoRoot, targetAbsolute).replaceAll('\\', '/'),
    runtimeEligibility: candidate.manifest.runtimeEligibility,
  };
}

function parseArgs(argv) {
  const [command, ...tokens] = argv;
  if (command !== 'prepare' || tokens.length !== 6) {
    throw new Error('story_visual_direction_enrichment_arguments_invalid');
  }
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (
      !['--output-root', '--request', '--write'].includes(key) ||
      values.has(key)
    ) {
      throw new Error('story_visual_direction_enrichment_arguments_invalid');
    }
    values.set(key, value);
  }
  if (
    !values.get('--request') ||
    !values.get('--output-root') ||
    !['true', 'false'].includes(values.get('--write'))
  ) {
    throw new Error('story_visual_direction_enrichment_arguments_invalid');
  }
  return {
    requestPath: values.get('--request'),
    outputRoot: values.get('--output-root'),
    write: values.get('--write') === 'true',
  };
}

function main(argv) {
  try {
    const result = prepare(parseArgs(argv));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message.split(':')[0] : 'story_visual_direction_enrichment_unknown_failure'}\n`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  CANDIDATE_MANIFEST_VERSION,
  COMPOSITION_POLICY_VERSION,
  CONTINUITY_INTENT_VERSION,
  EXCLUSIONS,
  REQUEST_VERSION,
  REVIEW_BUNDLE_VERSION,
  REVISION_IDENTITY_VERSION,
  buildCandidate,
  compositionMetrics,
  loadExistingCandidate,
  loadInputs,
  parseArgs,
  prepare,
  protectedAuthorityIssues,
  readRequestFile,
  validateContinuityIntent,
  validateRequest,
};

if (require.main === module) main(process.argv.slice(2));
