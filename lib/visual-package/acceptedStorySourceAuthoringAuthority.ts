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
const LEGACY_ACCEPTED_REVISION_MANIFEST_VERSION =
  'small-heroes-product-accepted-story-source-revision-manifest/v2';
const ACCEPTED_ROOT =
  'story-pipeline/04_approved_story_sources/accepted';
const DIGEST = /^[a-f0-9]{64}$/;
const ACCEPTED_SOURCE_PATTERN = new RegExp(
  `^${ACCEPTED_ROOT}/([^/]+)/revisions/([a-f0-9]{64})/integrated\\.md$`,
);
const ACCEPTED_REVISION_ROOT_PATTERN = new RegExp(
  `^${ACCEPTED_ROOT}/[^/]+/revisions(?:/|$)`,
);
const EXPECTED_FILENAMES = [
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

type AcceptedFilename = (typeof EXPECTED_FILENAMES)[number];

export interface AcceptedStorySourceAuthoringAuthority {
  version: typeof ACCEPTED_STORY_SOURCE_AUTHORING_AUTHORITY_VERSION;
  revisionDigest: string;
  manifestDigest: string;
  manifestSha256: string;
  productAcceptanceDigest: string;
  technicalReviewDigest: string;
  continuityIntent: StoryVisualContinuityIntent;
  fileSha256: Record<AcceptedFilename, string>;
}

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
    !exactKeys(fileSha256, EXPECTED_FILENAMES) ||
    EXPECTED_FILENAMES.some(
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
}): boolean {
  return (
    args.storyPath.split('\\').join('/') ===
    `${ACCEPTED_ROOT}/${args.storyKey}/revisions/${args.authority.revisionDigest}/integrated.md`
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

function pathsEqual(left: string, right: string): boolean {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
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
}): AcceptedStorySourceAuthoringAuthority {
  const storyAbsolute = path.resolve(args.repoRoot, args.storyPath);
  const revisionRoot = path.dirname(storyAbsolute);
  const revisionRelative = repoRelativePath(args.repoRoot, revisionRoot);
  if (
    revisionRelative !==
    `${ACCEPTED_ROOT}/${args.storyKey}/revisions/${args.revisionDigest}`
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
      JSON.stringify([...EXPECTED_FILENAMES].sort())
  ) {
    throw new Error('accepted_story_source_inventory_invalid');
  }

  const fileBytes = new Map<AcceptedFilename, Buffer>();
  for (const filename of EXPECTED_FILENAMES) {
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
    productAcceptance.version !==
      'small-heroes-story-source-visual-direction-product-acceptance/v1' ||
    productAcceptance.status !== 'accepted' ||
    productAcceptance.acceptedBy !== 'Guy' ||
    productAcceptance.authorityScope !==
      'story_source_and_visual_directions_only' ||
    productAcceptance.storyKey !== args.storyKey ||
    productAcceptance.candidateDigest !== args.revisionDigest ||
    productAcceptance.revisionDigest !== args.revisionDigest ||
    productAcceptance.reviewBundleDigest !==
      enrichmentReviewBundle.digest ||
    productAcceptance.technicalReviewDigest !== technicalReview.digest ||
    technicalReview.version !==
      'small-heroes-story-source-visual-direction-technical-review/v1' ||
    technicalReview.status !== 'pass' ||
    technicalReview.reviewer !== 'Claude Code' ||
    technicalReview.blocker !== 0 ||
    technicalReview.major !== 0 ||
    technicalReview.candidateDigest !== args.revisionDigest ||
    technicalReview.reviewBundleDigest !==
      enrichmentReviewBundle.digest ||
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
    manifestAcceptance.acceptedBy !== 'Guy' ||
    manifestAcceptance.digest !== productAcceptance.digest ||
    manifestAcceptance.acceptedAt !== productAcceptance.acceptedAt
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

export function loadAcceptedStorySourceAuthoringAuthority(args: {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
}): AcceptedStorySourceAuthoringAuthority | null {
  const canonicalPath = args.storyPath.split('\\').join('/');
  const match = ACCEPTED_SOURCE_PATTERN.exec(canonicalPath);
  if (!match) {
    if (
      ACCEPTED_REVISION_ROOT_PATTERN.test(canonicalPath)
    ) {
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
  if (manifest.version !== ACCEPTED_REVISION_MANIFEST_VERSION) {
    throw new Error('accepted_story_source_manifest_version_unsupported');
  }
  return loadAcceptedManifest({
    ...args,
    storyPath: canonicalPath,
    revisionDigest: revisionDigest!,
  });
}
