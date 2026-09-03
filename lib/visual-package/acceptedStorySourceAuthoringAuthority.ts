import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { canonicalize } from '@/lib/canonical-json';
import {
  assertValidStoryVisualContinuityIntent,
  type StoryVisualContinuityIntent,
} from '@/lib/visual-contract-compiler/storyVisualContinuityIntent';

import { repoRelativePath } from './integrity';

export const ACCEPTED_STORY_SOURCE_AUTHORING_AUTHORITY_VERSION =
  'accepted-story-source-authoring-authority/v1' as const;

const ACCEPTED_REVISION_MANIFEST_VERSION =
  'small-heroes-product-accepted-story-source-revision-manifest/v3';
const CORRECTION_ACCEPTED_REVISION_MANIFEST_VERSION =
  'small-heroes-product-accepted-story-source-revision-manifest/v4';
const LEGACY_ACCEPTED_REVISION_MANIFEST_VERSION =
  'small-heroes-product-accepted-story-source-revision-manifest/v2';
const PRODUCT_ACCEPTANCE_VERSION =
  'small-heroes-story-source-visual-direction-product-acceptance/v1';
const TECHNICAL_REVIEW_VERSION =
  'small-heroes-story-source-visual-direction-technical-review/v1';
const CORRECTION_PRODUCT_ACCEPTANCE_VERSION =
  'small-heroes-story-source-visual-direction-correction-product-acceptance/v2';
const CORRECTION_TECHNICAL_REVIEW_VERSION =
  'small-heroes-story-source-visual-direction-correction-technical-review/v2';
const CORRECTION_PRODUCT_DECISION_VERSION =
  'small-heroes-story-source-visual-direction-correction-product-decision/v2';
const CORRECTION_REVISION_IDENTITY_VERSION =
  'small-heroes-story-source-visual-direction-correction-identity/v1';
export const ACCEPTED_STORY_SOURCE_ROOT =
  'story-pipeline/04_approved_story_sources/accepted';
const ACCEPTED_ROOT = ACCEPTED_STORY_SOURCE_ROOT;
const DIGEST = /^[a-f0-9]{64}$/;
const GIT_COMMIT = /^[a-f0-9]{40}$/;
const PRODUCT_ACCEPTANCE_RUNTIME_REASON =
  'accepted_story_source_requires_fresh_visual_contract';
const PRODUCT_ACCEPTANCE_EXCLUSIONS = [
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
] as const;
const CORRECTION_PRODUCT_ACCEPTANCE_EXCLUSIONS = [
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
] as const;
const PRODUCT_ACCEPTANCE_KEYS = [
  'acceptedAt',
  'acceptedBy',
  'authorityScope',
  'candidateDigest',
  'decision',
  'digest',
  'digestAlgorithm',
  'exclusions',
  'reviewBundleDigest',
  'revisionDigest',
  'runtimeEligibility',
  'status',
  'storyKey',
  'technicalReviewDigest',
  'version',
] as const;
const TECHNICAL_REVIEW_KEYS = [
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
] as const;
const SAFE_STORY_KEY = /^[a-z0-9][a-z0-9_-]*$/;
const V3_EXPECTED_FILENAMES = [
  'enrichment-manifest.json',
  'enrichment-review-bundle.json',
  'integrated.md',
  'manifest.json',
  'product-acceptance.json',
  'revision-identity.json',
  'story.md',
  'technical-review.json',
  'visual-directions.json',
] as const;
const V4_EXPECTED_FILENAMES = [
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
] as const;
const EXPECTED_FILENAMES = [
  ...V3_EXPECTED_FILENAMES,
  ...V4_EXPECTED_FILENAMES,
] as const;

type AcceptedFilename = (typeof EXPECTED_FILENAMES)[number];
type V3AcceptedFilename = (typeof V3_EXPECTED_FILENAMES)[number];
type V4AcceptedFilename = (typeof V4_EXPECTED_FILENAMES)[number];

export interface AcceptedStorySourceAuthoringAuthority {
  version: typeof ACCEPTED_STORY_SOURCE_AUTHORING_AUTHORITY_VERSION;
  revisionDigest: string;
  manifestDigest: string;
  manifestSha256: string;
  productAcceptanceDigest: string;
  technicalReviewDigest: string;
  continuityIntent: StoryVisualContinuityIntent;
  fileSha256:
    | Record<V3AcceptedFilename, string>
    | Record<V4AcceptedFilename, string>;
}

export type AcceptedProductLineageDisposition =
  | { kind: 'absent' }
  | { kind: 'present' }
  | { kind: 'invalid'; reasons: string[] };

export function acceptedStorySourceAuthoringAuthorityIssues(
  value: unknown,
  pageNumbers?: readonly number[],
): string[] {
  const record = recordValue(value);
  if (!record) return ['accepted_authoring_authority_not_object'];
  const issues: string[] = [];
  if (
    !exactKeys(record, [
      'continuityIntent',
      'fileSha256',
      'manifestDigest',
      'manifestSha256',
      'productAcceptanceDigest',
      'revisionDigest',
      'technicalReviewDigest',
      'version',
    ])
  ) {
    issues.push('accepted_authoring_authority_keys_invalid');
  }
  if (record.version !== ACCEPTED_STORY_SOURCE_AUTHORING_AUTHORITY_VERSION) {
    issues.push('accepted_authoring_authority_version_invalid');
  }
  for (const field of [
    'revisionDigest',
    'manifestDigest',
    'manifestSha256',
    'productAcceptanceDigest',
    'technicalReviewDigest',
  ] as const) {
    if (typeof record[field] !== 'string' || !DIGEST.test(record[field])) {
      issues.push(`accepted_authoring_authority_${field}_invalid`);
    }
  }
  const fileSha256 = recordValue(record.fileSha256);
  if (
    !fileSha256 ||
    (!exactKeys(fileSha256, V3_EXPECTED_FILENAMES) &&
      !exactKeys(fileSha256, V4_EXPECTED_FILENAMES)) ||
    Object.keys(fileSha256).some(
      (filename) =>
        typeof fileSha256[filename] !== 'string' ||
        !DIGEST.test(fileSha256[filename]),
    ) ||
    fileSha256?.['manifest.json'] !== record.manifestSha256
  ) {
    issues.push('accepted_authoring_authority_inventory_invalid');
  }
  try {
    assertValidStoryVisualContinuityIntent(
      record.continuityIntent,
      pageNumbers,
    );
  } catch {
    issues.push('accepted_authoring_authority_continuity_invalid');
  }
  return issues;
}

export function acceptedStorySourceAuthoringAuthorityBindsSource(args: {
  authority: AcceptedStorySourceAuthoringAuthority;
  storyKey: string;
  storyPath: string;
  acceptedRootRelative?: string;
}): boolean {
  const acceptedRoot = args.acceptedRootRelative || ACCEPTED_ROOT;
  return (
    args.storyPath.split('\\').join('/') ===
    `${acceptedRoot}/${args.storyKey}/revisions/${args.authority.revisionDigest}/integrated.md`
  );
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort())
  );
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(
    `${JSON.stringify(canonicalize(value), null, 2)}\n`,
    'utf8',
  );
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalDigest(value: Record<string, unknown>): string {
  const { digest: _digest, ...payload } = value;
  return sha256(canonicalBytes(payload));
}

function compactCanonicalDigest(value: Record<string, unknown>): string {
  const { digest: _digest, ...payload } = value;
  return sha256(JSON.stringify(canonicalize(payload)));
}

function canonicalUtcTimestampIsValid(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function productAcceptanceV1IsValid(
  value: Record<string, unknown>,
  args: { storyKey: string; revisionDigest: string },
): boolean {
  const runtimeEligibility = recordValue(value.runtimeEligibility);
  return (
    exactKeys(value, PRODUCT_ACCEPTANCE_KEYS) &&
    value.version === PRODUCT_ACCEPTANCE_VERSION &&
    value.status === 'accepted' &&
    value.acceptedBy === 'Guy' &&
    value.authorityScope ===
      'story_source_and_visual_directions_only' &&
    value.storyKey === args.storyKey &&
    value.candidateDigest === args.revisionDigest &&
    value.revisionDigest === args.revisionDigest &&
    typeof value.reviewBundleDigest === 'string' &&
    DIGEST.test(value.reviewBundleDigest) &&
    typeof value.technicalReviewDigest === 'string' &&
    DIGEST.test(value.technicalReviewDigest) &&
    canonicalUtcTimestampIsValid(value.acceptedAt) &&
    typeof value.decision === 'string' &&
    value.decision.trim().length > 0 &&
    value.digestAlgorithm === 'canonical-json-sha256' &&
    JSON.stringify(value.exclusions) ===
      JSON.stringify(PRODUCT_ACCEPTANCE_EXCLUSIONS) &&
    runtimeEligibility !== null &&
    exactKeys(runtimeEligibility, ['eligible', 'reason']) &&
    runtimeEligibility.eligible === false &&
    runtimeEligibility.reason === PRODUCT_ACCEPTANCE_RUNTIME_REASON &&
    typeof value.digest === 'string' &&
    DIGEST.test(value.digest) &&
    canonicalDigest(value) === value.digest
  );
}

function technicalReviewV1IsValid(
  value: Record<string, unknown>,
  args: { revisionDigest: string; reviewBundleDigest: unknown },
): boolean {
  const acceptedMinor = value.acceptedMinor;
  return (
    exactKeys(value, TECHNICAL_REVIEW_KEYS) &&
    value.version === TECHNICAL_REVIEW_VERSION &&
    value.status === 'pass' &&
    value.reviewer === 'Claude Code' &&
    value.blocker === 0 &&
    value.major === 0 &&
    Number.isSafeInteger(value.minor) &&
    Number(value.minor) >= 0 &&
    Array.isArray(acceptedMinor) &&
    acceptedMinor.length === value.minor &&
    acceptedMinor.every((entry) => {
      const record = recordValue(entry);
      return (
        record !== null &&
        exactKeys(record, ['code', 'disposition', 'note']) &&
        typeof record.code === 'string' &&
        record.code.trim().length > 0 &&
        record.disposition === 'accepted_non_blocking' &&
        typeof record.note === 'string' &&
        record.note.trim().length > 0
      );
    }) &&
    typeof value.baseCommit === 'string' &&
    GIT_COMMIT.test(value.baseCommit) &&
    typeof value.headCommit === 'string' &&
    GIT_COMMIT.test(value.headCommit) &&
    value.candidateDigest === args.revisionDigest &&
    value.reviewBundleDigest === args.reviewBundleDigest &&
    value.digestAlgorithm === 'canonical-json-sha256' &&
    typeof value.digest === 'string' &&
    DIGEST.test(value.digest) &&
    canonicalDigest(value) === value.digest
  );
}

function pathsEqual(left: string, right: string): boolean {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

export function validatedAcceptedStorySourceRootRelative(
  repoRoot: string,
  requested?: string,
): string {
  const acceptedRoot = requested || ACCEPTED_ROOT;
  if (
    acceptedRoot.length === 0 ||
    acceptedRoot.includes('\\') ||
    acceptedRoot.startsWith('/') ||
    acceptedRoot.endsWith('/') ||
    acceptedRoot
      .split('/')
      .some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('accepted_story_source_root_path_invalid');
  }
  const absolute = path.resolve(repoRoot, ...acceptedRoot.split('/'));
  if (repoRelativePath(repoRoot, absolute) !== acceptedRoot) {
    throw new Error('accepted_story_source_root_path_invalid');
  }
  return acceptedRoot;
}

function escapedPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function acceptedPathPatterns(acceptedRoot: string): {
  source: RegExp;
  revisions: RegExp;
} {
  const escaped = escapedPattern(acceptedRoot);
  return {
    source: new RegExp(
      `^${escaped}/([^/]+)/revisions/([a-f0-9]{64})/integrated\\.md$`,
    ),
    revisions: new RegExp(`^${escaped}/[^/]+/revisions(?:/|$)`),
  };
}

/**
 * Fresh-order fallback policy derived from immutable accepted-lineage bytes.
 *
 * This intentionally does not choose a revision. The separately approved v4
 * current locator owns that decision. Any adjacent product-acceptance artifact
 * closes legacy fallback for the whole story lineage; the selected package
 * must then bind a revision accepted by the strict loader below.
 */
export function acceptedProductLineageDisposition(args: {
  repoRoot: string;
  storyKey: string;
  acceptedRootRelative?: string;
}): AcceptedProductLineageDisposition {
  if (!SAFE_STORY_KEY.test(args.storyKey)) {
    return { kind: 'invalid', reasons: ['story_key_invalid'] };
  }
  let acceptedRoot: string;
  try {
    acceptedRoot = validatedAcceptedStorySourceRootRelative(
      args.repoRoot,
      args.acceptedRootRelative,
    );
  } catch {
    return { kind: 'invalid', reasons: ['accepted_root_path_invalid'] };
  }
  const expectedRelative = `${acceptedRoot}/${args.storyKey}/revisions`;
  const revisionsRoot = path.resolve(args.repoRoot, expectedRelative);
  try {
    if (repoRelativePath(args.repoRoot, revisionsRoot) !== expectedRelative) {
      return { kind: 'invalid', reasons: ['revisions_root_path_invalid'] };
    }
  } catch {
    return { kind: 'invalid', reasons: ['revisions_root_path_invalid'] };
  }

  let rootStat: fs.Stats;
  try {
    rootStat = fs.lstatSync(revisionsRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { kind: 'absent' };
    }
    return { kind: 'invalid', reasons: ['revisions_root_unreadable'] };
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    return { kind: 'invalid', reasons: ['revisions_root_invalid'] };
  }
  try {
    if (!pathsEqual(revisionsRoot, fs.realpathSync(revisionsRoot))) {
      return { kind: 'invalid', reasons: ['revisions_root_alias_rejected'] };
    }
  } catch {
    return { kind: 'invalid', reasons: ['revisions_root_unreadable'] };
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(revisionsRoot, { withFileTypes: true });
  } catch {
    return { kind: 'invalid', reasons: ['revisions_inventory_unreadable'] };
  }
  const reasons: string[] = [];
  let acceptancePresent = false;
  for (const entry of [...entries].sort((left, right) =>
    left.name.localeCompare(right.name))) {
    if (!DIGEST.test(entry.name) || !entry.isDirectory()) {
      reasons.push('revision_entry_invalid');
      continue;
    }
    const revisionRoot = path.resolve(revisionsRoot, entry.name);
    try {
      const revisionStat = fs.lstatSync(revisionRoot);
      if (
        revisionStat.isSymbolicLink() ||
        !revisionStat.isDirectory() ||
        !pathsEqual(revisionRoot, fs.realpathSync(revisionRoot))
      ) {
        reasons.push('revision_root_invalid');
        continue;
      }
    } catch {
      reasons.push('revision_root_unreadable');
      continue;
    }

    const acceptancePath = path.resolve(
      revisionRoot,
      'product-acceptance.json',
    );
    let acceptanceStat: fs.Stats;
    try {
      acceptanceStat = fs.lstatSync(acceptancePath);
      acceptancePresent = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      reasons.push('product_acceptance_unreadable');
      continue;
    }
    try {
      if (
        acceptanceStat.isSymbolicLink() ||
        !acceptanceStat.isFile() ||
        acceptanceStat.nlink !== 1 ||
        !pathsEqual(acceptancePath, fs.realpathSync(acceptancePath))
      ) {
        reasons.push('product_acceptance_file_invalid');
        continue;
      }
      const acceptanceBytes = fs.readFileSync(acceptancePath);
      const acceptance = recordValue(
        JSON.parse(acceptanceBytes.toString('utf8')) as unknown,
      );
      const acceptanceContentIsValid = acceptance !== null &&
        (acceptance.version === PRODUCT_ACCEPTANCE_VERSION
          ? productAcceptanceV1IsValid(acceptance, {
              storyKey: args.storyKey,
              revisionDigest: entry.name,
            })
          : typeof acceptance.version === 'string' &&
            acceptance.version.trim().length > 0 &&
            acceptance.status === 'accepted' &&
            acceptance.acceptedBy === 'Guy' &&
            acceptance.storyKey === args.storyKey &&
            acceptance.revisionDigest === entry.name &&
            typeof acceptance.digest === 'string' &&
            DIGEST.test(acceptance.digest) &&
            canonicalDigest(acceptance) === acceptance.digest);
      if (
        !acceptance ||
        !acceptanceBytes.equals(canonicalBytes(acceptance)) ||
        !acceptanceContentIsValid
      ) {
        reasons.push('product_acceptance_content_invalid');
      }
    } catch {
      reasons.push('product_acceptance_content_invalid');
    }
  }
  if (reasons.length > 0) {
    return { kind: 'invalid', reasons: [...new Set(reasons)].sort() };
  }
  return acceptancePresent ? { kind: 'present' } : { kind: 'absent' };
}

function readCanonicalRegularFile(args: {
  repoRoot: string;
  revisionRoot: string;
  filename: AcceptedFilename;
}): Buffer {
  const lexical = path.resolve(args.revisionRoot, args.filename);
  repoRelativePath(args.repoRoot, lexical);
  const relativeToRevision = path.relative(args.revisionRoot, lexical);
  if (
    relativeToRevision.startsWith('..') ||
    path.isAbsolute(relativeToRevision)
  ) {
    throw new Error('accepted_story_source_inventory_path_invalid');
  }
  let real: string;
  try {
    const stat = fs.lstatSync(lexical);
    if (
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      stat.nlink !== 1
    ) {
      throw new Error('accepted_story_source_inventory_file_invalid');
    }
    real = fs.realpathSync(lexical);
  } catch {
    throw new Error('accepted_story_source_inventory_file_invalid');
  }
  if (!pathsEqual(lexical, real)) {
    throw new Error('accepted_story_source_inventory_alias_rejected');
  }
  return fs.readFileSync(real);
}

function parseCanonicalJson(
  bytes: Buffer,
  code: string,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    throw new Error(code);
  }
  const record = recordValue(parsed);
  if (!record || !bytes.equals(canonicalBytes(record))) {
    throw new Error(code);
  }
  return record;
}

function parseJsonRecord(bytes: Buffer, code: string): Record<string, unknown> {
  try {
    const record = recordValue(JSON.parse(bytes.toString('utf8')) as unknown);
    if (!record) throw new Error(code);
    return record;
  } catch {
    throw new Error(code);
  }
}

function descriptor(
  value: unknown,
  expectedFilename: AcceptedFilename,
  requiresDigest: boolean,
): Record<string, unknown> {
  const record = recordValue(value);
  const expectedKeys = requiresDigest
    ? ['bytes', 'digest', 'filename', 'sha256']
    : ['bytes', 'filename', 'sha256'];
  if (
    !record ||
    !exactKeys(record, expectedKeys) ||
    record.filename !== expectedFilename ||
    !Number.isSafeInteger(record.bytes) ||
    Number(record.bytes) < 1 ||
    typeof record.sha256 !== 'string' ||
    !DIGEST.test(record.sha256) ||
    (requiresDigest &&
      (typeof record.digest !== 'string' ||
        !DIGEST.test(record.digest)))
  ) {
    throw new Error('accepted_story_source_manifest_descriptor_invalid');
  }
  return record;
}

function assertCanonicalEmbeddedDigest(
  bytes: Buffer,
  expectedDigest: string,
  code: string,
): Record<string, unknown> {
  const record = parseCanonicalJson(bytes, code);
  if (
    (record.digestAlgorithm !== undefined &&
      record.digestAlgorithm !== 'canonical-json-sha256') ||
    record.digest !== expectedDigest ||
    canonicalDigest(record) !== expectedDigest
  ) {
    throw new Error(code);
  }
  return record;
}

function loadAcceptedManifest(args: {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  revisionDigest: string;
  acceptedRootRelative: string;
}): AcceptedStorySourceAuthoringAuthority {
  const storyAbsolute = path.resolve(args.repoRoot, args.storyPath);
  const revisionRoot = path.dirname(storyAbsolute);
  const revisionRelative = repoRelativePath(args.repoRoot, revisionRoot);
  if (
    revisionRelative !==
    `${args.acceptedRootRelative}/${args.storyKey}/revisions/${args.revisionDigest}`
  ) {
    throw new Error('accepted_story_source_revision_path_invalid');
  }
  let rootReal: string;
  try {
    const stat = fs.lstatSync(revisionRoot);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('accepted_story_source_revision_root_invalid');
    }
    rootReal = fs.realpathSync(revisionRoot);
  } catch {
    throw new Error('accepted_story_source_revision_root_invalid');
  }
  if (!pathsEqual(revisionRoot, rootReal)) {
    throw new Error('accepted_story_source_revision_alias_rejected');
  }

  const inventory = fs.readdirSync(revisionRoot, { withFileTypes: true });
  const inventoryNames = inventory.map((entry) => entry.name).sort();
  if (
    inventory.some((entry) => !entry.isFile()) ||
    JSON.stringify(inventoryNames) !==
      JSON.stringify([...V3_EXPECTED_FILENAMES].sort())
  ) {
    throw new Error('accepted_story_source_inventory_invalid');
  }

  const fileBytes = new Map<V3AcceptedFilename, Buffer>();
  for (const filename of V3_EXPECTED_FILENAMES) {
    fileBytes.set(
      filename,
      readCanonicalRegularFile({
        repoRoot: args.repoRoot,
        revisionRoot,
        filename,
      }),
    );
  }
  const manifestBytes = fileBytes.get('manifest.json')!;
  const manifest = parseCanonicalJson(
    manifestBytes,
    'accepted_story_source_manifest_invalid',
  );
  if (
    !exactKeys(manifest, [
      'authorityScope',
      'continuityIntent',
      'digest',
      'digestAlgorithm',
      'exclusions',
      'files',
      'identity',
      'parent',
      'productAcceptance',
      'revisionDigest',
      'runtimeEligibility',
      'sourceGenderMode',
      'sourceProfile',
      'status',
      'storyKey',
      'version',
    ]) ||
    manifest.version !== ACCEPTED_REVISION_MANIFEST_VERSION ||
    manifest.status !== 'product_accepted_story_source_revision' ||
    manifest.authorityScope !== 'story_source_and_visual_directions_only' ||
    manifest.storyKey !== args.storyKey ||
    manifest.revisionDigest !== args.revisionDigest ||
    manifest.digestAlgorithm !== 'canonical-json-sha256' ||
    JSON.stringify(manifest.exclusions) !==
      JSON.stringify(PRODUCT_ACCEPTANCE_EXCLUSIONS) ||
    typeof manifest.digest !== 'string' ||
    !DIGEST.test(manifest.digest) ||
    canonicalDigest(manifest) !== manifest.digest
  ) {
    throw new Error('accepted_story_source_manifest_invalid');
  }
  const runtimeEligibility = recordValue(manifest.runtimeEligibility);
  if (
    !runtimeEligibility ||
    !exactKeys(runtimeEligibility, ['eligible', 'reason']) ||
    runtimeEligibility.eligible !== false ||
    runtimeEligibility.reason !==
      'accepted_story_source_requires_fresh_visual_contract'
  ) {
    throw new Error('accepted_story_source_runtime_eligibility_invalid');
  }

  const pageNumbers = (() => {
    const identity = recordValue(manifest.identity);
    const count = Number(identity?.pageCount);
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error('accepted_story_source_identity_invalid');
    }
    return Array.from({ length: count }, (_, index) => index + 1);
  })();
  assertValidStoryVisualContinuityIntent(
    manifest.continuityIntent,
    pageNumbers,
  );

  const files = recordValue(manifest.files);
  if (
    !files ||
    !exactKeys(files, [
      'enrichmentManifest',
      'enrichmentReviewBundle',
      'integratedStory',
      'productAcceptance',
      'revisionIdentity',
      'story',
      'technicalReview',
      'visualDirections',
    ])
  ) {
    throw new Error('accepted_story_source_manifest_files_invalid');
  }
  const descriptors = [
    ['enrichmentManifest', 'enrichment-manifest.json', true, true],
    ['enrichmentReviewBundle', 'enrichment-review-bundle.json', true, true],
    ['integratedStory', 'integrated.md', false, false],
    ['productAcceptance', 'product-acceptance.json', true, true],
    ['revisionIdentity', 'revision-identity.json', true, false],
    ['story', 'story.md', false, false],
    ['technicalReview', 'technical-review.json', true, true],
    ['visualDirections', 'visual-directions.json', false, false],
  ] as const;
  const fileSha256 = {} as Record<AcceptedFilename, string>;
  const parsedDigestFiles = new Map<string, Record<string, unknown>>();
  for (const [
    key,
    filename,
    requiresDigest,
    hasEmbeddedDigest,
  ] of descriptors) {
    const current = descriptor(files[key], filename, requiresDigest);
    const bytes = fileBytes.get(filename)!;
    if (
      current.bytes !== bytes.length ||
      current.sha256 !== sha256(bytes)
    ) {
      throw new Error('accepted_story_source_manifest_file_stale');
    }
    fileSha256[filename] = current.sha256 as string;
    if (requiresDigest) {
      const parsed = hasEmbeddedDigest
        ? assertCanonicalEmbeddedDigest(
            bytes,
            current.digest as string,
            `accepted_story_source_embedded_digest_invalid:${filename}`,
          )
        : parseCanonicalJson(
            bytes,
            `accepted_story_source_embedded_digest_invalid:${filename}`,
          );
      if (
        !hasEmbeddedDigest &&
        canonicalDigest(parsed) !== current.digest
      ) {
        throw new Error(
          `accepted_story_source_embedded_digest_invalid:${filename}`,
        );
      }
      parsedDigestFiles.set(filename, parsed);
    }
  }
  fileSha256['manifest.json'] = sha256(manifestBytes);
  if (
    fileSha256['integrated.md'] !== sha256(fileBytes.get('integrated.md')!) ||
    !fileBytes.get('integrated.md')!.equals(fs.readFileSync(storyAbsolute))
  ) {
    throw new Error('accepted_story_source_integrated_story_invalid');
  }

  const productAcceptance = parsedDigestFiles.get(
    'product-acceptance.json',
  )!;
  const technicalReview = parsedDigestFiles.get('technical-review.json')!;
  const revisionIdentity = parsedDigestFiles.get('revision-identity.json')!;
  const enrichmentManifest = parsedDigestFiles.get(
    'enrichment-manifest.json',
  )!;
  const enrichmentReviewBundle = parsedDigestFiles.get(
    'enrichment-review-bundle.json',
  )!;
  const manifestAcceptance = recordValue(manifest.productAcceptance);
  const manifestParent = recordValue(manifest.parent);
  const revisionSource = recordValue(revisionIdentity.sourceRevision);
  const revisionIntegrated = recordValue(revisionIdentity.integratedStory);
  const revisionDirections = recordValue(revisionIdentity.visualDirections);
  const enrichmentManifestSource = recordValue(
    enrichmentManifest.sourceRevision,
  );
  const enrichmentReviewSource = recordValue(
    enrichmentReviewBundle.sourceRevision,
  );
  const enrichmentReviewIntegrated = recordValue(
    enrichmentReviewBundle.integratedStory,
  );
  const enrichmentReviewDirections = recordValue(
    enrichmentReviewBundle.visualDirections,
  );
  if (
    !productAcceptanceV1IsValid(productAcceptance, {
      storyKey: args.storyKey,
      revisionDigest: args.revisionDigest,
    }) ||
    productAcceptance.reviewBundleDigest !==
      enrichmentReviewBundle.digest ||
    productAcceptance.technicalReviewDigest !== technicalReview.digest ||
    !technicalReviewV1IsValid(technicalReview, {
      revisionDigest: args.revisionDigest,
      reviewBundleDigest: enrichmentReviewBundle.digest,
    }) ||
    canonicalDigest(revisionIdentity) !== args.revisionDigest ||
    revisionIdentity.version !==
      'small-heroes-story-source-visual-direction-enrichment-identity/v1' ||
    revisionIdentity.storyKey !== args.storyKey ||
    JSON.stringify(revisionIdentity.continuityIntent) !==
      JSON.stringify(manifest.continuityIntent) ||
    !revisionIntegrated ||
    revisionIntegrated.sha256 !== fileSha256['integrated.md'] ||
    !revisionDirections ||
    revisionDirections.sha256 !== fileSha256['visual-directions.json'] ||
    !manifestParent ||
    !revisionSource ||
    JSON.stringify(revisionSource) !== JSON.stringify(manifestParent) ||
    enrichmentManifest.version !==
      'small-heroes-story-source-visual-direction-enrichment-candidate-manifest/v1' ||
    enrichmentManifest.storyKey !== args.storyKey ||
    enrichmentManifest.candidateDigest !== args.revisionDigest ||
    JSON.stringify(enrichmentManifest.continuityIntent) !==
      JSON.stringify(manifest.continuityIntent) ||
    !enrichmentManifestSource ||
    JSON.stringify(enrichmentManifestSource) !==
      JSON.stringify(manifestParent) ||
    enrichmentReviewBundle.version !==
      'small-heroes-story-source-visual-direction-enrichment-review-bundle/v1' ||
    enrichmentReviewBundle.storyKey !== args.storyKey ||
    enrichmentReviewBundle.candidateDigest !== args.revisionDigest ||
    JSON.stringify(enrichmentReviewBundle.continuityIntent) !==
      JSON.stringify(manifest.continuityIntent) ||
    !enrichmentReviewSource ||
    JSON.stringify(enrichmentReviewSource) !==
      JSON.stringify(manifestParent) ||
    !enrichmentReviewIntegrated ||
    enrichmentReviewIntegrated.sha256 !== fileSha256['integrated.md'] ||
    !enrichmentReviewDirections ||
    enrichmentReviewDirections.sha256 !==
      fileSha256['visual-directions.json'] ||
    !manifestAcceptance ||
    !exactKeys(manifestAcceptance, ['acceptedAt', 'acceptedBy', 'digest']) ||
    manifestAcceptance.acceptedBy !== 'Guy' ||
    manifestAcceptance.digest !== productAcceptance.digest ||
    manifestAcceptance.acceptedAt !== productAcceptance.acceptedAt ||
    JSON.stringify(productAcceptance.runtimeEligibility) !==
      JSON.stringify(runtimeEligibility) ||
    JSON.stringify(productAcceptance.exclusions) !==
      JSON.stringify(manifest.exclusions)
  ) {
    throw new Error('accepted_story_source_approval_binding_invalid');
  }

  return {
    version: ACCEPTED_STORY_SOURCE_AUTHORING_AUTHORITY_VERSION,
    revisionDigest: args.revisionDigest,
    manifestDigest: manifest.digest,
    manifestSha256: fileSha256['manifest.json'],
    productAcceptanceDigest: productAcceptance.digest as string,
    technicalReviewDigest: technicalReview.digest as string,
    continuityIntent: structuredClone(
      manifest.continuityIntent as StoryVisualContinuityIntent,
    ),
    fileSha256,
  };
}

function correctionProductAcceptanceIsValid(
  value: Record<string, unknown>,
  args: {
    storyKey: string;
    revisionDigest: string;
    candidateRecordDigest: string;
    productDecisionDigest: string;
    recordDecisionDigest: string;
    technicalReviewDigest: string;
    acceptedWorldMode: unknown;
  },
): boolean {
  const runtimeEligibility = recordValue(value.runtimeEligibility);
  return (
    exactKeys(value, [
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
    ]) &&
    value.version === CORRECTION_PRODUCT_ACCEPTANCE_VERSION &&
    value.status === 'accepted' &&
    value.acceptedBy === 'Guy' &&
    value.authorityScope === 'story_source_and_visual_directions_only' &&
    value.storyKey === args.storyKey &&
    value.revisionDigest === args.revisionDigest &&
    value.candidateRecordDigest === args.candidateRecordDigest &&
    value.productDecisionDigest === args.productDecisionDigest &&
    value.recordDecisionDigest === args.recordDecisionDigest &&
    value.technicalReviewDigest === args.technicalReviewDigest &&
    value.acceptedWorldMode === args.acceptedWorldMode &&
    typeof value.decision === 'string' &&
    value.decision.trim() === value.decision &&
    value.decision.length >= 32 &&
    value.digestAlgorithm === 'canonical-json-sha256' &&
    JSON.stringify(value.exclusions) ===
      JSON.stringify(CORRECTION_PRODUCT_ACCEPTANCE_EXCLUSIONS) &&
    runtimeEligibility !== null &&
    exactKeys(runtimeEligibility, ['eligible', 'reason']) &&
    runtimeEligibility.eligible === false &&
    runtimeEligibility.reason === PRODUCT_ACCEPTANCE_RUNTIME_REASON &&
    typeof value.digest === 'string' &&
    DIGEST.test(value.digest) &&
    canonicalDigest(value) === value.digest
  );
}

function correctionTechnicalReviewIsValid(
  value: Record<string, unknown>,
  args: {
    candidateBatchDigest: string;
    productDecisionDigest: string;
    recordDecisionDigest: string;
    revisionDigest: string;
  },
): boolean {
  return (
    exactKeys(value, [
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
    ]) &&
    value.version === CORRECTION_TECHNICAL_REVIEW_VERSION &&
    value.status === 'pass' &&
    value.reviewer === 'Claude Code' &&
    value.p0 === 0 &&
    value.p1 === 0 &&
    Number.isSafeInteger(value.p2) &&
    Number(value.p2) >= 0 &&
    typeof value.baseCommit === 'string' &&
    GIT_COMMIT.test(value.baseCommit) &&
    typeof value.headCommit === 'string' &&
    GIT_COMMIT.test(value.headCommit) &&
    value.baseCommit !== value.headCommit &&
    value.candidateBatchDigest === args.candidateBatchDigest &&
    value.productDecisionDigest === args.productDecisionDigest &&
    value.recordDecisionDigest === args.recordDecisionDigest &&
    value.revisionDigest === args.revisionDigest &&
    value.digestAlgorithm === 'canonical-json-sha256' &&
    typeof value.digest === 'string' &&
    DIGEST.test(value.digest) &&
    canonicalDigest(value) === value.digest
  );
}

function correctionProductDecisionIntent(
  value: Record<string, unknown>,
  args: { storyKey: string; candidateRecordDigest: string },
): Record<string, unknown> | null {
  if (
    !exactKeys(value, [
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
    value.version !== CORRECTION_PRODUCT_DECISION_VERSION ||
    value.status !== 'approved_for_correction_acceptance_preparation' ||
    value.decidedBy !== 'Guy' ||
    value.digestAlgorithm !== 'canonical-json-sha256' ||
    typeof value.digest !== 'string' ||
    !DIGEST.test(value.digest) ||
    canonicalDigest(value) !== value.digest ||
    !Array.isArray(value.acceptedIntents)
  ) {
    return null;
  }
  const intents = value.acceptedIntents
    .map(recordValue)
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .filter(
      (entry) =>
        entry.storyKey === args.storyKey &&
        entry.recordDigest === args.candidateRecordDigest,
    );
  if (intents.length !== 1) return null;
  const intent = intents[0]!;
  return exactKeys(intent, [
    'continuityIntent',
    'coworkReview',
    'decisionId',
    'disposition',
    'recordDigest',
    'storyCandidateSha256',
    'storyKey',
    'visualDirectionCandidateSha256',
    'worldMode',
  ]) &&
    intent.disposition === 'acceptance_intent' &&
    typeof intent.storyCandidateSha256 === 'string' &&
    DIGEST.test(intent.storyCandidateSha256) &&
    typeof intent.visualDirectionCandidateSha256 === 'string' &&
    DIGEST.test(intent.visualDirectionCandidateSha256)
    ? intent
    : null;
}

function loadAcceptedCorrectionManifest(args: {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  revisionDigest: string;
  acceptedRootRelative: string;
}): AcceptedStorySourceAuthoringAuthority {
  const storyAbsolute = path.resolve(args.repoRoot, args.storyPath);
  const revisionRoot = path.dirname(storyAbsolute);
  const revisionRelative = repoRelativePath(args.repoRoot, revisionRoot);
  if (
    revisionRelative !==
    `${args.acceptedRootRelative}/${args.storyKey}/revisions/${args.revisionDigest}`
  ) {
    throw new Error('accepted_story_source_revision_path_invalid');
  }
  try {
    const stat = fs.lstatSync(revisionRoot);
    if (
      stat.isSymbolicLink() ||
      !stat.isDirectory() ||
      !pathsEqual(revisionRoot, fs.realpathSync(revisionRoot))
    ) {
      throw new Error('accepted_story_source_revision_root_invalid');
    }
  } catch {
    throw new Error('accepted_story_source_revision_root_invalid');
  }

  const inventory = fs.readdirSync(revisionRoot, { withFileTypes: true });
  if (
    inventory.some((entry) => !entry.isFile()) ||
    JSON.stringify(inventory.map((entry) => entry.name).sort()) !==
      JSON.stringify([...V4_EXPECTED_FILENAMES].sort())
  ) {
    throw new Error('accepted_story_source_inventory_invalid');
  }

  const fileBytes = new Map<V4AcceptedFilename, Buffer>();
  for (const filename of V4_EXPECTED_FILENAMES) {
    fileBytes.set(
      filename,
      readCanonicalRegularFile({
        repoRoot: args.repoRoot,
        revisionRoot,
        filename,
      }),
    );
  }
  const manifestBytes = fileBytes.get('manifest.json')!;
  const manifest = parseCanonicalJson(
    manifestBytes,
    'accepted_story_source_manifest_invalid',
  );
  const runtimeEligibility = recordValue(manifest.runtimeEligibility);
  if (
    !exactKeys(manifest, [
      'acceptedWorldMode',
      'authorityScope',
      'continuityIntent',
      'correctionProvenance',
      'digest',
      'digestAlgorithm',
      'exclusions',
      'files',
      'productAcceptance',
      'revisionDigest',
      'runtimeEligibility',
      'sourceGenderMode',
      'status',
      'storyKey',
      'version',
    ]) ||
    manifest.version !== CORRECTION_ACCEPTED_REVISION_MANIFEST_VERSION ||
    manifest.status !== 'product_accepted_story_source_revision' ||
    manifest.authorityScope !== 'story_source_and_visual_directions_only' ||
    manifest.storyKey !== args.storyKey ||
    manifest.revisionDigest !== args.revisionDigest ||
    manifest.sourceGenderMode !== 'neutral' ||
    !['fantastical', 'grounded', 'grounded_with_visual_metaphor'].includes(
      String(manifest.acceptedWorldMode),
    ) ||
    manifest.digestAlgorithm !== 'canonical-json-sha256' ||
    typeof manifest.digest !== 'string' ||
    !DIGEST.test(manifest.digest) ||
    canonicalDigest(manifest) !== manifest.digest ||
    JSON.stringify(manifest.exclusions) !==
      JSON.stringify(CORRECTION_PRODUCT_ACCEPTANCE_EXCLUSIONS) ||
    !runtimeEligibility ||
    !exactKeys(runtimeEligibility, ['eligible', 'reason']) ||
    runtimeEligibility.eligible !== false ||
    runtimeEligibility.reason !== PRODUCT_ACCEPTANCE_RUNTIME_REASON
  ) {
    throw new Error('accepted_story_source_manifest_invalid');
  }

  const files = recordValue(manifest.files);
  if (
    !files ||
    !exactKeys(files, [
      'correctionCandidate',
      'correctionManifest',
      'correctionRequest',
      'directionMigration',
      'integratedStory',
      'productAcceptance',
      'productDecision',
      'revisionIdentity',
      'story',
      'technicalReview',
      'visualDirections',
    ])
  ) {
    throw new Error('accepted_story_source_manifest_files_invalid');
  }
  const descriptorRows = [
    ['correctionCandidate', 'correction-candidate.json', true],
    ['correctionManifest', 'correction-manifest.json', true],
    ['correctionRequest', 'correction-request.json', false],
    ['directionMigration', 'direction-migration.json', true],
    ['integratedStory', 'integrated.md', false],
    ['productAcceptance', 'product-acceptance.json', true],
    ['productDecision', 'product-decision.json', true],
    ['revisionIdentity', 'revision-identity.json', true],
    ['story', 'story.md', false],
    ['technicalReview', 'technical-review.json', true],
    ['visualDirections', 'visual-directions.json', false],
  ] as const;
  const fileSha256 = {} as Record<V4AcceptedFilename, string>;
  const parsedFiles = new Map<V4AcceptedFilename, Record<string, unknown>>();
  for (const [key, filename, requiresDigest] of descriptorRows) {
    const current = descriptor(files[key], filename, requiresDigest);
    const bytes = fileBytes.get(filename)!;
    if (current.bytes !== bytes.length || current.sha256 !== sha256(bytes)) {
      throw new Error('accepted_story_source_manifest_file_stale');
    }
    fileSha256[filename] = current.sha256 as string;
    if (filename.endsWith('.json')) {
      const parsed = filename === 'visual-directions.json'
        ? parseJsonRecord(
            bytes,
            `accepted_story_source_embedded_digest_invalid:${filename}`,
          )
        : parseCanonicalJson(
            bytes,
            `accepted_story_source_embedded_digest_invalid:${filename}`,
          );
      if (requiresDigest) {
        const calculated = filename === 'correction-candidate.json'
          ? compactCanonicalDigest(parsed)
          : canonicalDigest(parsed);
        if (parsed.digest !== current.digest || calculated !== current.digest) {
          throw new Error(
            `accepted_story_source_embedded_digest_invalid:${filename}`,
          );
        }
      }
      parsedFiles.set(filename, parsed);
    }
  }
  fileSha256['manifest.json'] = sha256(manifestBytes);
  if (!fileBytes.get('integrated.md')!.equals(fs.readFileSync(storyAbsolute))) {
    throw new Error('accepted_story_source_integrated_story_invalid');
  }

  const candidate = parsedFiles.get('correction-candidate.json')!;
  const correctionManifest = parsedFiles.get('correction-manifest.json')!;
  const request = parsedFiles.get('correction-request.json')!;
  const migration = parsedFiles.get('direction-migration.json')!;
  const productAcceptance = parsedFiles.get('product-acceptance.json')!;
  const productDecision = parsedFiles.get('product-decision.json')!;
  const identity = parsedFiles.get('revision-identity.json')!;
  const technicalReview = parsedFiles.get('technical-review.json')!;
  const provenance = recordValue(manifest.correctionProvenance);
  const manifestAcceptance = recordValue(manifest.productAcceptance);
  const candidateOutputs = recordValue(candidate.candidateOutputs);
  const candidateRequest = recordValue(candidate.request);
  const manifestOutputs = recordValue(correctionManifest.outputs);
  const manifestRequest = recordValue(correctionManifest.request);
  const identityBatch = recordValue(identity.candidateBatch);
  const identityCorrection = recordValue(identity.correction);
  const identityOutputs = recordValue(identity.outputs);
  const decisionBatch = recordValue(productDecision.candidateBatch);
  const intent = correctionProductDecisionIntent(productDecision, {
    storyKey: args.storyKey,
    candidateRecordDigest: String(candidate.digest),
  });
  const pageCount = Number(candidate.pageCount);
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
    throw new Error('accepted_story_source_identity_invalid');
  }
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  assertValidStoryVisualContinuityIntent(manifest.continuityIntent, pageNumbers);

  const candidateStory = recordValue(candidateOutputs?.acceptedStory);
  const candidateDirections = recordValue(candidateOutputs?.visualDirection);
  const candidateIntegrated = recordValue(candidateOutputs?.integratedStory);
  const candidateMigration = recordValue(candidateOutputs?.directionMigration);
  const candidateManifest = recordValue(candidateOutputs?.manifest);
  const outputStory = recordValue(manifestOutputs?.acceptedStoryCandidate);
  const outputDirections = recordValue(manifestOutputs?.visualDirectionCandidate);
  const outputIntegrated = recordValue(manifestOutputs?.integratedStoryCandidate);
  const outputMigration = recordValue(manifestOutputs?.directionMigration);
  if (
    candidate.status !== 'pending_exact_product_and_visual_review' ||
    candidate.storyKey !== args.storyKey ||
    candidate.runtimeEligible !== false ||
    candidate.productionEligible !== false ||
    !Array.isArray(candidate.unresolvedCreativeSourceIssues) ||
    candidate.unresolvedCreativeSourceIssues.length !== 0 ||
    !Array.isArray(candidate.protectedAuthorityIssues) ||
    candidate.protectedAuthorityIssues.length !== 0 ||
    JSON.stringify(candidate.continuityIntent) !==
      JSON.stringify(manifest.continuityIntent) ||
    !intent ||
    intent.worldMode !== manifest.acceptedWorldMode ||
    intent.storyCandidateSha256 !== fileSha256['story.md'] ||
    intent.visualDirectionCandidateSha256 !==
      fileSha256['visual-directions.json'] ||
    !provenance ||
    !exactKeys(provenance, [
      'candidateBatchDigest',
      'candidateBatchRawSha256',
      'candidateRecordDigest',
      'correctionManifestDigest',
      'correctionRequestSha256',
      'directionMigrationDigest',
      'productDecisionDigest',
      'recordDecisionDigest',
      'technicalReviewDigest',
    ]) ||
    provenance.candidateRecordDigest !== candidate.digest ||
    provenance.productDecisionDigest !== productDecision.digest ||
    provenance.correctionManifestDigest !== correctionManifest.digest ||
    provenance.correctionRequestSha256 !== fileSha256['correction-request.json'] ||
    provenance.directionMigrationDigest !== migration.digest ||
    provenance.technicalReviewDigest !== technicalReview.digest ||
    !identityBatch ||
    identity.version !== CORRECTION_REVISION_IDENTITY_VERSION ||
    identity.storyKey !== args.storyKey ||
    identity.digest !== args.revisionDigest ||
    identity.candidateRecordDigest !== candidate.digest ||
    identity.recordDecisionDigest !== provenance.recordDecisionDigest ||
    identity.acceptedWorldMode !== manifest.acceptedWorldMode ||
    JSON.stringify(identity.continuityIntent) !==
      JSON.stringify(manifest.continuityIntent) ||
    identityBatch.digest !== provenance.candidateBatchDigest ||
    identityBatch.rawSha256 !== provenance.candidateBatchRawSha256 ||
    !identityCorrection ||
    identityCorrection.pendingManifestDigest !== correctionManifest.digest ||
    identityCorrection.requestSha256 !== fileSha256['correction-request.json'] ||
    identityCorrection.directionMigrationDigest !== migration.digest ||
    !identityOutputs ||
    identityOutputs.storySha256 !== fileSha256['story.md'] ||
    identityOutputs.visualDirectionsSha256 !==
      fileSha256['visual-directions.json'] ||
    identityOutputs.integratedStorySha256 !== fileSha256['integrated.md'] ||
    !decisionBatch ||
    decisionBatch.digest !== provenance.candidateBatchDigest ||
    decisionBatch.sha256 !== provenance.candidateBatchRawSha256 ||
    !candidateRequest ||
    candidateRequest.bytes !== fileBytes.get('correction-request.json')!.length ||
    candidateRequest.sha256 !== fileSha256['correction-request.json'] ||
    JSON.stringify(candidateRequest.payload) !== JSON.stringify(request) ||
    correctionManifest.version !==
      'small-heroes-story-source-visual-direction-correction-pending-manifest/v1' ||
    correctionManifest.status !== 'pending_exact_product_review' ||
    correctionManifest.storyKey !== args.storyKey ||
    !manifestRequest ||
    manifestRequest.bytes !== fileBytes.get('correction-request.json')!.length ||
    manifestRequest.sha256 !== fileSha256['correction-request.json'] ||
    !candidateStory ||
    candidateStory.sha256 !== fileSha256['story.md'] ||
    !candidateDirections ||
    candidateDirections.sha256 !== fileSha256['visual-directions.json'] ||
    !candidateIntegrated ||
    candidateIntegrated.sha256 !== fileSha256['integrated.md'] ||
    !candidateMigration ||
    candidateMigration.sha256 !== fileSha256['direction-migration.json'] ||
    candidateMigration.digest !== migration.digest ||
    !candidateManifest ||
    candidateManifest.sha256 !== fileSha256['correction-manifest.json'] ||
    JSON.stringify(candidate.sourceRevisionManifest) !==
      JSON.stringify(correctionManifest) ||
    !outputStory ||
    outputStory.sha256 !== fileSha256['story.md'] ||
    !outputDirections ||
    outputDirections.sha256 !== fileSha256['visual-directions.json'] ||
    !outputIntegrated ||
    outputIntegrated.sha256 !== fileSha256['integrated.md'] ||
    !outputMigration ||
    outputMigration.sha256 !== fileSha256['direction-migration.json'] ||
    outputMigration.digest !== migration.digest ||
    migration.storyKey !== args.storyKey ||
    migration.sourceStorySha256 !== fileSha256['story.md'] ||
    migration.revisedDirectionSha256 !== fileSha256['visual-directions.json'] ||
    !correctionTechnicalReviewIsValid(technicalReview, {
      candidateBatchDigest: String(provenance.candidateBatchDigest),
      productDecisionDigest: String(productDecision.digest),
      recordDecisionDigest: String(provenance.recordDecisionDigest),
      revisionDigest: args.revisionDigest,
    }) ||
    !correctionProductAcceptanceIsValid(productAcceptance, {
      storyKey: args.storyKey,
      revisionDigest: args.revisionDigest,
      candidateRecordDigest: String(candidate.digest),
      productDecisionDigest: String(productDecision.digest),
      recordDecisionDigest: String(provenance.recordDecisionDigest),
      technicalReviewDigest: String(technicalReview.digest),
      acceptedWorldMode: manifest.acceptedWorldMode,
    }) ||
    !manifestAcceptance ||
    !exactKeys(manifestAcceptance, ['acceptedBy', 'digest']) ||
    manifestAcceptance.acceptedBy !== 'Guy' ||
    manifestAcceptance.digest !== productAcceptance.digest ||
    JSON.stringify(productAcceptance.runtimeEligibility) !==
      JSON.stringify(runtimeEligibility) ||
    JSON.stringify(productAcceptance.exclusions) !==
      JSON.stringify(manifest.exclusions)
  ) {
    throw new Error('accepted_story_source_approval_binding_invalid');
  }

  return {
    version: ACCEPTED_STORY_SOURCE_AUTHORING_AUTHORITY_VERSION,
    revisionDigest: args.revisionDigest,
    manifestDigest: manifest.digest as string,
    manifestSha256: fileSha256['manifest.json'],
    productAcceptanceDigest: productAcceptance.digest as string,
    technicalReviewDigest: technicalReview.digest as string,
    continuityIntent: structuredClone(
      manifest.continuityIntent as StoryVisualContinuityIntent,
    ),
    fileSha256,
  };
}

export function loadAcceptedStorySourceAuthoringAuthority(args: {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  acceptedRootRelative?: string;
}): AcceptedStorySourceAuthoringAuthority | null {
  const acceptedRoot = validatedAcceptedStorySourceRootRelative(
    args.repoRoot,
    args.acceptedRootRelative,
  );
  const patterns = acceptedPathPatterns(acceptedRoot);
  const canonicalPath = args.storyPath.split('\\').join('/');
  const match = patterns.source.exec(canonicalPath);
  if (!match) {
    if (patterns.revisions.test(canonicalPath)) {
      throw new Error('accepted_story_source_revision_path_invalid');
    }
    return null;
  }
  const [, pathStoryKey, revisionDigest] = match;
  if (pathStoryKey !== args.storyKey) {
    throw new Error('accepted_story_source_story_key_mismatch');
  }
  const revisionRoot = path.resolve(
    args.repoRoot,
    path.dirname(canonicalPath),
  );
  const manifest = parseCanonicalJson(
    readCanonicalRegularFile({
      repoRoot: args.repoRoot,
      revisionRoot,
      filename: 'manifest.json',
    }),
    'accepted_story_source_manifest_invalid',
  );
  if (manifest.version === LEGACY_ACCEPTED_REVISION_MANIFEST_VERSION) {
    return null;
  }
  if (manifest.version === ACCEPTED_REVISION_MANIFEST_VERSION) {
    return loadAcceptedManifest({
      ...args,
      acceptedRootRelative: acceptedRoot,
      storyPath: canonicalPath,
      revisionDigest: revisionDigest!,
    });
  }
  if (manifest.version === CORRECTION_ACCEPTED_REVISION_MANIFEST_VERSION) {
    return loadAcceptedCorrectionManifest({
      ...args,
      acceptedRootRelative: acceptedRoot,
      storyPath: canonicalPath,
      revisionDigest: revisionDigest!,
    });
  }
  throw new Error('accepted_story_source_manifest_version_unsupported');
}
