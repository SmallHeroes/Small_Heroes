import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  ACTION_SEMANTIC_COVERAGE_VERSION,
  assertCompleteActionSemanticCoverage,
  type ActionSemanticCoverageRecord,
} from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import type {
  SourceEvidenceCatalogEntry,
} from '@/lib/visual-contract-compiler/sourceEvidenceCatalog';
import { assertValidBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';

import {
  canonicalContentAddressedJsonBytes,
  writeCanonicalContentAddressedJsonArtifact,
} from './canonicalContentAddressedJson';
import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  normalizeTextForDigest,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  buildReconciliationReviewBundle,
  persistReconciliationDraftBundle,
  reconciliationDraftBundleJsonBytes,
  renderReconciliationReviewMarkdown,
} from './reconciliationLifecycle';
import {
  ACTION_SEMANTIC_COVERAGE_RECONCILIATION_AUTHORITY_VERSION,
  PRESENTATION_REQUIREMENT_DISPOSITION_VERSION,
  PRESENTATION_REQUIREMENT_RECONCILIATION_VERSION,
  buildSourcePromptProjectionDigest,
  resolveJsonPointer,
  sourcePromptReconciliationIssues,
  type ReconciliationSourceKind,
  type SourcePromptReconciliation,
} from './sourcePromptReconciliation';
import {
  assertValidStorySourceAuthoritySnapshot,
  buildStorySourceAuthoritySnapshot,
  legacyStorySourceAuthoritySnapshotV2,
  persistStorySourceAuthoritySnapshot,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import {
  loadCurrentVisualPackageV4,
  type VisualPackageV4,
} from './visualPackageV4';

export const STORY_SOURCE_REVISION_PACKAGE_MIGRATION_MANIFEST_VERSION =
  'story-source-revision-package-migration-manifest/v1' as const;
export const STORY_SOURCE_EVIDENCE_MIGRATION_MAP_VERSION =
  'story-source-evidence-migration-map/v1' as const;

export const STORY_SOURCE_REVISION_PACKAGE_MIGRATION_EXCLUSIONS = [
  'blueprint_approval',
  'database_write',
  'deployment',
  'image_render',
  'locator_update',
  'package_approval',
  'provider_call',
  'publication',
  'reconciliation_approval',
] as const;

const ACCEPTED_REVISION_MANIFEST_VERSION =
  'small-heroes-product-accepted-story-source-revision-manifest/v2';
const ACCEPTED_REVISION_STATUS =
  'product_accepted_story_source_revision';
const ACCEPTED_REVISION_SCOPE =
  'story_source_and_visual_directions_only';
const ACCEPTED_REVISION_EXCLUSIONS = [
  'blueprint',
  'deployment',
  'production',
  'render',
  'runtime_locator',
  'story_bank',
  'visual_contract',
  'visual_package',
] as const;
const ACCEPTANCE_VERSION =
  'small-heroes-story-source-revision-product-acceptance/v2';
const ACCEPTED_ROOT =
  'story-pipeline/04_approved_story_sources/accepted';
const ACCEPTANCE_ROOT =
  'story-pipeline/04_approved_story_sources/approvals/revisions';
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9_-]{0,159}$/;

interface AcceptedFileDescriptor {
  filename: string;
  bytes: number;
  sha256: string;
  digest?: string;
}

interface AcceptedRevisionManifest {
  version: string;
  status: string;
  authorityScope: string;
  storyKey: string;
  briefId: string;
  sourceGenderMode: string;
  metadataChanges: unknown[];
  revisionDigest: string;
  parent: unknown;
  files: {
    story: AcceptedFileDescriptor;
    visualDirections: AcceptedFileDescriptor;
    integratedStory: AcceptedFileDescriptor;
    directionMigration: AcceptedFileDescriptor;
    pendingManifest: AcceptedFileDescriptor;
    reviewBundle: AcceptedFileDescriptor;
    revisionIdentity: AcceptedFileDescriptor;
  };
  productAcceptance: {
    path: string;
    bytes: number;
    sha256: string;
    acceptedBy: string;
    acceptedAt: string;
  };
  exclusions: string[];
  digest: string;
}

interface AcceptedRevisionAuthority {
  manifest: AcceptedRevisionManifest;
  manifestPath: string;
  manifestSha256: string;
  integratedStoryPath: string;
  integratedStorySha256: string;
  reviewBundleDigest: string;
  acceptancePath: string;
  acceptanceSha256: string;
}

export interface StorySourceEvidenceMigrationMapEntry {
  pageNumber: number;
  excerptOrdinal: number;
  oldSourceEvidenceId: string;
  newSourceEvidenceId: string;
  oldExcerpt: string;
  newExcerpt: string;
  excerptChanged: boolean;
}

export interface StorySourceEvidenceMigrationMap {
  version: typeof STORY_SOURCE_EVIDENCE_MIGRATION_MAP_VERSION;
  storyKey: string;
  oldSourceIdentityDigest: string;
  newSourceIdentityDigest: string;
  oldCatalogDigest: string;
  newCatalogDigest: string;
  entries: StorySourceEvidenceMigrationMapEntry[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface StorySourceRevisionPackageMigrationManifest {
  version: typeof STORY_SOURCE_REVISION_PACKAGE_MIGRATION_MANIFEST_VERSION;
  stage: 'reconciliation_pending';
  storyKey: string;
  styleId: string;
  sourcePackage: {
    locatorPath: string;
    packagePath: string;
    revisionDigest: string;
    sourcePath: string;
    sourceIdentityDigest: string;
    sourceAuthoritySnapshotDigest: string;
    templateDigest: string;
    reconciliationDigest: string;
  };
  acceptedRevision: {
    manifestPath: string;
    manifestDigest: string;
    manifestSha256: string;
    revisionDigest: string;
    integratedStoryPath: string;
    integratedStorySha256: string;
    productReviewDigest: string;
    acceptancePath: string;
    acceptanceSha256: string;
  };
  evidenceMigration: {
    oldSnapshotDigest: string;
    oldSnapshotPath: string;
    newSnapshotDigest: string;
    newSnapshotPath: string;
    mapDigest: string;
    mapPath: string;
    entryCount: number;
    changedExcerptCount: number;
    allEvidenceIdsChanged: true;
  };
  projection: {
    migratedTemplateDigest: string;
    migratedTemplatePath: string;
    templateEvidenceOccurrenceCount: number;
    coverageDigest: string;
    coveragePath: string;
    coverageRecordCount: number;
    sourcePackageEvidenceOccurrenceCount: number;
    changedDirectionPages: number[];
  };
  reconciliation: {
    digest: string;
    path: string;
    reviewBundleDigest: string;
    reviewBundlePath: string;
    reviewMarkdownPath: string;
    readyForApproval: false;
    blockingIssueCount: number;
  };
  externalCounters: {
    providerCalls: 0;
    imageRenders: 0;
    audioRenders: 0;
    databaseWrites: 0;
    storageWrites: 0;
    locatorWrites: 0;
  };
  doesNotAuthorize: typeof STORY_SOURCE_REVISION_PACKAGE_MIGRATION_EXCLUSIONS;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface PrepareStorySourceRevisionPackageMigrationArgs {
  repoRoot: string;
  outputDir: string;
  storyKey: string;
  styleId: string;
  locatorPath: string;
  acceptedRevisionManifestPath: string;
  write?: boolean;
}

export interface PreparedStorySourceRevisionPackageMigration {
  manifest: StorySourceRevisionPackageMigrationManifest;
  oldSnapshot: StorySourceAuthoritySnapshot;
  newSnapshot: StorySourceAuthoritySnapshot;
  evidenceMap: StorySourceEvidenceMigrationMap;
  migratedTemplate: BookVisualContractTemplate;
  migratedCoverage: ActionSemanticCoverageRecord[];
  pendingReconciliation: SourcePromptReconciliation;
  reviewBundle: ReturnType<typeof buildReconciliationReviewBundle>;
  artifacts: {
    manifestPath: string;
    created: boolean;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function sha256Bytes(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function pathIsInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function canonicalRelativePath(value: string): boolean {
  return value.length > 0 &&
    value.length <= 512 &&
    value === value.trim() &&
    !value.includes('\\') &&
    !value.includes('\0') &&
    !value.startsWith('/') &&
    value !== '..' &&
    !value.startsWith('../') &&
    path.posix.normalize(value) === value;
}

export function readContainedRegularFile(args: {
  repoRoot: string;
  relativePath: string;
  allowedRoot: string;
  label: string;
}): { bytes: Buffer; absolutePath: string; relativePath: string } {
  if (!canonicalRelativePath(args.relativePath)) {
    throw new Error(`${args.label} path is not canonical`);
  }
  const repoRoot = path.resolve(args.repoRoot);
  const allowedRoot = path.resolve(repoRoot, ...args.allowedRoot.split('/'));
  const absolutePath = path.resolve(repoRoot, ...args.relativePath.split('/'));
  if (!pathIsInside(allowedRoot, absolutePath)) {
    throw new Error(`${args.label} path escaped its authority root`);
  }
  let allowedRootStat: fs.Stats;
  let realAllowedRoot: string;
  try {
    allowedRootStat = fs.lstatSync(allowedRoot);
    realAllowedRoot = fs.realpathSync(allowedRoot);
  } catch {
    throw new Error(`${args.label} authority root is missing or unreadable`);
  }
  if (
    allowedRootStat.isSymbolicLink() ||
    !allowedRootStat.isDirectory() ||
    realAllowedRoot !== allowedRoot
  ) {
    throw new Error(`${args.label} authority root contains a link or reparse alias`);
  }
  const relativeParts = path.relative(allowedRoot, absolutePath).split(path.sep);
  for (let index = 0; index < relativeParts.length; index += 1) {
    const candidate = path.join(allowedRoot, ...relativeParts.slice(0, index + 1));
    let stat: fs.Stats;
    let realCandidate: string;
    try {
      stat = fs.lstatSync(candidate);
      realCandidate = fs.realpathSync(candidate);
    } catch {
      throw new Error(`${args.label} is missing or unreadable`);
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`${args.label} contains a link or reparse alias`);
    }
    const expectedReal = path.resolve(realAllowedRoot, ...relativeParts.slice(0, index + 1));
    if (realCandidate !== expectedReal) {
      throw new Error(`${args.label} contains a link or reparse alias`);
    }
    if (index < relativeParts.length - 1 && !stat.isDirectory()) {
      throw new Error(`${args.label} parent is not a directory`);
    }
    if (index === relativeParts.length - 1 && (!stat.isFile() || stat.nlink !== 1)) {
      throw new Error(`${args.label} is not a single-link regular file`);
    }
  }
  return {
    bytes: fs.readFileSync(absolutePath),
    absolutePath,
    relativePath: repoRelativePath(repoRoot, absolutePath),
  };
}

function parseJsonObject(bytes: Buffer, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    throw new Error(`${label} JSON is invalid`);
  }
  if (!isObject(value)) throw new Error(`${label} is not an object`);
  return value;
}

function descriptorIsValid(value: unknown, digestRequired: boolean): value is AcceptedFileDescriptor {
  if (!isObject(value)) return false;
  const keys = digestRequired
    ? ['bytes', 'digest', 'filename', 'sha256']
    : ['bytes', 'filename', 'sha256'];
  return exactKeys(value, keys) &&
    typeof value.filename === 'string' &&
    Number.isSafeInteger(value.bytes) &&
    (value.bytes as number) > 0 &&
    typeof value.sha256 === 'string' &&
    SHA256_HEX.test(value.sha256) &&
    (!digestRequired || (typeof value.digest === 'string' && SHA256_HEX.test(value.digest)));
}

function loadAcceptedRevisionAuthority(args: {
  repoRoot: string;
  storyKey: string;
  acceptedRevisionManifestPath: string;
}): AcceptedRevisionAuthority {
  if (!SAFE_SEGMENT.test(args.storyKey)) throw new Error('accepted revision storyKey is invalid');
  const parts = args.acceptedRevisionManifestPath.split('/');
  if (
    parts.length !== 7 ||
    parts[0] !== 'story-pipeline' ||
    parts[1] !== '04_approved_story_sources' ||
    parts[2] !== 'accepted' ||
    parts[3] !== args.storyKey ||
    parts[4] !== 'revisions' ||
    !SHA256_HEX.test(parts[5] ?? '') ||
    parts[6] !== 'manifest.json'
  ) {
    throw new Error('accepted revision manifest path is not canonical for the story');
  }
  const revisionDigest = parts[5]!;
  const revisionRoot = `${ACCEPTED_ROOT}/${args.storyKey}/revisions/${revisionDigest}`;
  const manifestFile = readContainedRegularFile({
    repoRoot: args.repoRoot,
    relativePath: args.acceptedRevisionManifestPath,
    allowedRoot: `${ACCEPTED_ROOT}/${args.storyKey}`,
    label: 'accepted revision manifest',
  });
  const raw = parseJsonObject(manifestFile.bytes, 'accepted revision manifest');
  const topKeys = [
    'authorityScope',
    'briefId',
    'digest',
    'exclusions',
    'files',
    'metadataChanges',
    'parent',
    'productAcceptance',
    'revisionDigest',
    'sourceGenderMode',
    'status',
    'storyKey',
    'version',
  ];
  if (!exactKeys(raw, topKeys)) throw new Error('accepted revision manifest keys are invalid');
  const manifest = raw as unknown as AcceptedRevisionManifest;
  if (
    manifest.version !== ACCEPTED_REVISION_MANIFEST_VERSION ||
    manifest.status !== ACCEPTED_REVISION_STATUS ||
    manifest.authorityScope !== ACCEPTED_REVISION_SCOPE ||
    manifest.storyKey !== args.storyKey ||
    manifest.revisionDigest !== revisionDigest ||
    manifest.sourceGenderMode !== 'neutral' ||
    !Array.isArray(manifest.metadataChanges) ||
    canonicalJsonDigest(manifest.metadataChanges) !==
      canonicalJsonDigest([{ field: 'gender', from: 'female', to: 'neutral' }]) ||
    !Array.isArray(manifest.exclusions) ||
    canonicalJsonDigest(manifest.exclusions) !== canonicalJsonDigest(ACCEPTED_REVISION_EXCLUSIONS) ||
    !SHA256_HEX.test(manifest.digest)
  ) {
    throw new Error('accepted revision manifest authority is invalid');
  }
  const { digest: _manifestDigest, ...manifestPayload } = manifest;
  if (
    sha256Bytes(canonicalContentAddressedJsonBytes(manifestPayload)) !==
      manifest.digest
  ) {
    throw new Error('accepted revision manifest digest is stale');
  }
  if (!isObject(manifest.files) || !exactKeys(manifest.files as unknown as Record<string, unknown>, [
    'directionMigration',
    'integratedStory',
    'pendingManifest',
    'reviewBundle',
    'revisionIdentity',
    'story',
    'visualDirections',
  ])) {
    throw new Error('accepted revision file descriptors are invalid');
  }
  const descriptors: Array<[keyof AcceptedRevisionManifest['files'], string, boolean]> = [
    ['directionMigration', 'direction-migration.json', true],
    ['integratedStory', 'integrated.md', false],
    ['pendingManifest', 'source-revision-manifest.json', true],
    ['reviewBundle', 'review-bundle.json', true],
    ['revisionIdentity', 'revision-identity.json', true],
    ['story', 'story.md', false],
    ['visualDirections', 'visual-directions.json', false],
  ];
  const expectedInventory = [...descriptors.map(([, filename]) => filename), 'manifest.json'].sort();
  const actualInventory = fs.readdirSync(path.dirname(manifestFile.absolutePath)).sort();
  if (canonicalJsonDigest(actualInventory) !== canonicalJsonDigest(expectedInventory)) {
    throw new Error('accepted revision inventory is not exact');
  }
  for (const [key, filename, digestRequired] of descriptors) {
    const descriptor = manifest.files[key];
    if (!descriptorIsValid(descriptor, digestRequired) || descriptor.filename !== filename) {
      throw new Error(`accepted revision ${String(key)} descriptor is invalid`);
    }
    const file = readContainedRegularFile({
      repoRoot: args.repoRoot,
      relativePath: `${revisionRoot}/${filename}`,
      allowedRoot: `${ACCEPTED_ROOT}/${args.storyKey}`,
      label: `accepted revision ${String(key)}`,
    });
    if (file.bytes.length !== descriptor.bytes || sha256Bytes(file.bytes) !== descriptor.sha256) {
      throw new Error(`accepted revision ${String(key)} bytes are stale`);
    }
  }
  if (
    manifest.files.revisionIdentity.digest !== revisionDigest ||
    manifest.files.revisionIdentity.sha256 !== revisionDigest ||
    manifest.files.reviewBundle.digest === undefined
  ) {
    throw new Error('accepted revision identity or review binding is stale');
  }
  if (!isObject(manifest.productAcceptance) || !exactKeys(
    manifest.productAcceptance as unknown as Record<string, unknown>,
    ['acceptedAt', 'acceptedBy', 'bytes', 'path', 'sha256'],
  )) {
    throw new Error('accepted revision product acceptance binding is invalid');
  }
  const expectedAcceptancePath =
    `${ACCEPTANCE_ROOT}/${args.storyKey}/${revisionDigest}.product-acceptance.json`;
  if (
    manifest.productAcceptance.path !== expectedAcceptancePath ||
    manifest.productAcceptance.acceptedBy !== 'Guy' ||
    !isoTimestampIsValid(manifest.productAcceptance.acceptedAt) ||
    !Number.isSafeInteger(manifest.productAcceptance.bytes) ||
    manifest.productAcceptance.bytes <= 0 ||
    !SHA256_HEX.test(manifest.productAcceptance.sha256)
  ) {
    throw new Error('accepted revision product acceptance authority is invalid');
  }
  const acceptanceFile = readContainedRegularFile({
    repoRoot: args.repoRoot,
    relativePath: expectedAcceptancePath,
    allowedRoot: ACCEPTANCE_ROOT,
    label: 'accepted revision product acceptance',
  });
  if (
    acceptanceFile.bytes.length !== manifest.productAcceptance.bytes ||
    sha256Bytes(acceptanceFile.bytes) !== manifest.productAcceptance.sha256
  ) {
    throw new Error('accepted revision product acceptance bytes are stale');
  }
  const acceptance = parseJsonObject(acceptanceFile.bytes, 'accepted revision product acceptance');
  if (
    acceptance.version !== ACCEPTANCE_VERSION ||
    acceptance.status !== 'accepted' ||
    acceptance.acceptedBy !== 'Guy' ||
    acceptance.acceptedAt !== manifest.productAcceptance.acceptedAt ||
    acceptance.storyKey !== args.storyKey ||
    acceptance.revisionDigest !== revisionDigest ||
    acceptance.sourceGenderMode !== 'neutral' ||
    !isObject(acceptance.reviewBundle) ||
    acceptance.reviewBundle.digest !== manifest.files.reviewBundle.digest ||
    acceptance.integratedStorySha256 !== manifest.files.integratedStory.sha256 ||
    acceptance.visualDirectionSha256 !== manifest.files.visualDirections.sha256
  ) {
    throw new Error('accepted revision product acceptance content is stale');
  }
  return {
    manifest,
    manifestPath: manifestFile.relativePath,
    manifestSha256: sha256Bytes(manifestFile.bytes),
    integratedStoryPath: `${revisionRoot}/integrated.md`,
    integratedStorySha256: manifest.files.integratedStory.sha256,
    reviewBundleDigest: manifest.files.reviewBundle.digest,
    acceptancePath: expectedAcceptancePath,
    acceptanceSha256: manifest.productAcceptance.sha256,
  };
}

function entryIdentity(entry: Pick<SourceEvidenceCatalogEntry, 'pageNumber' | 'excerptOrdinal'>): string {
  return `${entry.pageNumber}:${entry.excerptOrdinal}`;
}

export function buildStorySourceEvidenceMigrationMap(args: {
  oldSnapshot: StorySourceAuthoritySnapshot;
  newSnapshot: StorySourceAuthoritySnapshot;
}): StorySourceEvidenceMigrationMap {
  assertValidStorySourceAuthoritySnapshot(args.oldSnapshot);
  assertValidStorySourceAuthoritySnapshot(args.newSnapshot);
  if (
    args.oldSnapshot.content.storyKey !== args.newSnapshot.content.storyKey ||
    args.oldSnapshot.content.sourceIdentity.pageCount !== args.newSnapshot.content.sourceIdentity.pageCount ||
    canonicalJsonDigest(args.oldSnapshot.content.sourceIdentity.pageNumbers) !==
      canonicalJsonDigest(args.newSnapshot.content.sourceIdentity.pageNumbers) ||
    args.oldSnapshot.content.sourceIdentity.digest === args.newSnapshot.content.sourceIdentity.digest
  ) {
    throw new Error('Story Source revision does not preserve one changed-source page topology');
  }
  const oldEntries = args.oldSnapshot.content.sourceEvidenceCatalog.entries;
  const newEntries = args.newSnapshot.content.sourceEvidenceCatalog.entries;
  if (oldEntries.length === 0 || oldEntries.length !== newEntries.length) {
    throw new Error('Story Source evidence catalogs are not cardinality-compatible');
  }
  const newByIdentity = new Map(newEntries.map((entry) => [entryIdentity(entry), entry]));
  if (newByIdentity.size !== newEntries.length) {
    throw new Error('new Story Source evidence catalog contains duplicate identities');
  }
  const seenNewIds = new Set<string>();
  const entries = oldEntries.map((oldEntry): StorySourceEvidenceMigrationMapEntry => {
    const newEntry = newByIdentity.get(entryIdentity(oldEntry));
    if (
      !newEntry ||
      oldEntry.sourceEvidenceId === newEntry.sourceEvidenceId ||
      seenNewIds.has(newEntry.sourceEvidenceId)
    ) {
      throw new Error('Story Source evidence migration is not one exact old-to-new bijection');
    }
    seenNewIds.add(newEntry.sourceEvidenceId);
    return {
      pageNumber: oldEntry.pageNumber,
      excerptOrdinal: oldEntry.excerptOrdinal,
      oldSourceEvidenceId: oldEntry.sourceEvidenceId,
      newSourceEvidenceId: newEntry.sourceEvidenceId,
      oldExcerpt: oldEntry.excerpt,
      newExcerpt: newEntry.excerpt,
      excerptChanged: oldEntry.excerpt !== newEntry.excerpt,
    };
  });
  if (seenNewIds.size !== newEntries.length) {
    throw new Error('Story Source evidence migration does not cover every new identity');
  }
  const withoutDigest = {
    version: STORY_SOURCE_EVIDENCE_MIGRATION_MAP_VERSION,
    storyKey: args.oldSnapshot.content.storyKey,
    oldSourceIdentityDigest: args.oldSnapshot.content.sourceIdentity.digest,
    newSourceIdentityDigest: args.newSnapshot.content.sourceIdentity.digest,
    oldCatalogDigest: args.oldSnapshot.content.sourceEvidenceCatalog.digest,
    newCatalogDigest: args.newSnapshot.content.sourceEvidenceCatalog.digest,
    entries,
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(withoutDigest),
  };
}

interface ProjectionResult<T> {
  value: T;
  sourceEvidenceOccurrenceCount: number;
}

export function projectStorySourceEvidenceBindings<T>(args: {
  value: T;
  evidenceMap: StorySourceEvidenceMigrationMap;
}): ProjectionResult<T> {
  const { digestAlgorithm: _digestAlgorithm, digest: _digest, ...mapPayload } =
    args.evidenceMap;
  if (
    args.evidenceMap.version !== STORY_SOURCE_EVIDENCE_MIGRATION_MAP_VERSION ||
    args.evidenceMap.digestAlgorithm !== 'canonical-json-sha256' ||
    args.evidenceMap.digest !== canonicalJsonDigest(mapPayload) ||
    args.evidenceMap.entries.length === 0 ||
    new Set(args.evidenceMap.entries.map((entry) => entry.oldSourceEvidenceId)).size !==
      args.evidenceMap.entries.length ||
    new Set(args.evidenceMap.entries.map((entry) => entry.newSourceEvidenceId)).size !==
      args.evidenceMap.entries.length
  ) {
    throw new Error('Story Source evidence migration map is stale or malformed');
  }
  const byOldId = new Map(
    args.evidenceMap.entries.map((entry) => [entry.oldSourceEvidenceId, entry]),
  );
  let sourceEvidenceOccurrenceCount = 0;
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!isObject(value)) return value;
    const projected: Record<string, unknown> = {};
    let mapping: StorySourceEvidenceMigrationMapEntry | undefined;
    if ('sourceEvidenceId' in value) {
      if (typeof value.sourceEvidenceId !== 'string') {
        throw new Error('sourceEvidenceId occurrence is malformed');
      }
      mapping = byOldId.get(value.sourceEvidenceId);
      if (!mapping) throw new Error('sourceEvidenceId occurrence is not in the old authority map');
      sourceEvidenceOccurrenceCount += 1;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'sourceEvidenceId' && mapping) {
        projected[key] = mapping.newSourceEvidenceId;
      } else if (key === 'sourcePhrase' && mapping) {
        if (child !== mapping.oldExcerpt) {
          throw new Error('sourcePhrase is stale for its old sourceEvidenceId');
        }
        projected[key] = mapping.newExcerpt;
      } else {
        projected[key] = visit(child);
      }
    }
    return projected;
  };
  return {
    value: visit(args.value) as T,
    sourceEvidenceOccurrenceCount,
  };
}

function countSourceEvidenceOccurrences(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countSourceEvidenceOccurrences(item), 0);
  if (!isObject(value)) return 0;
  return Object.entries(value).reduce(
    (sum, [key, child]) => sum + (key === 'sourceEvidenceId' ? 1 : countSourceEvidenceOccurrences(child)),
    0,
  );
}

function presentationRequirements(coverage: readonly ActionSemanticCoverageRecord[]) {
  return {
    version: PRESENTATION_REQUIREMENT_RECONCILIATION_VERSION,
    actionSemanticCoverageVersion: ACTION_SEMANTIC_COVERAGE_VERSION,
    actionSemanticCoverageDigest: canonicalJsonDigest(coverage),
    requirements: coverage.flatMap((record) =>
      record.disposition.kind === 'presentation_requirement'
        ? [{
            pageNumber: record.pageNumber,
            beatId: record.beatId,
            sourceEvidenceId: record.sourceEvidenceId,
            presentationClass: record.disposition.presentationClass,
            contractPointer: record.disposition.contractPointer,
            contractValue: record.disposition.contractValue,
          }]
        : [],
    ),
  };
}

function expectedSourceText(args: {
  snapshot: StorySourceAuthoritySnapshot;
  frameKind: 'cover' | 'page';
  pageNumber: number;
  sourceKind: ReconciliationSourceKind;
}): string {
  if (args.frameKind === 'cover' && args.sourceKind === 'story_prose') {
    return args.snapshot.content.fullStoryText;
  }
  if (args.frameKind === 'cover' && args.sourceKind === 'authored_cover_authority') {
    if (!args.snapshot.content.authoredCoverAuthority) {
      throw new Error('migrated reconciliation retains an orphaned authored cover authority');
    }
    return JSON.stringify(args.snapshot.content.authoredCoverAuthority);
  }
  if (args.frameKind === 'page' && args.sourceKind === 'story_prose') {
    const page = args.snapshot.content.pages.find((candidate) => candidate.pageNumber === args.pageNumber);
    if (!page) throw new Error('migrated reconciliation page source is missing');
    return page.text;
  }
  if (args.frameKind === 'page' && args.sourceKind === 'historical_image_direction') {
    const direction = args.snapshot.content.pageImageDirections.find(
      (candidate) => candidate.pageNumber === args.pageNumber,
    );
    if (!direction) throw new Error('migrated reconciliation image direction is missing');
    return direction.imageDirection;
  }
  throw new Error('migrated reconciliation contains an unsupported source requirement');
}

export function buildPendingStorySourceRevisionReconciliation(args: {
  sourceReconciliation: SourcePromptReconciliation;
  sourceTemplate: BookVisualContractTemplate;
  migratedTemplate: BookVisualContractTemplate;
  migratedCoverage: readonly ActionSemanticCoverageRecord[];
  newSnapshot: StorySourceAuthoritySnapshot;
  evidenceMap: StorySourceEvidenceMigrationMap;
}): SourcePromptReconciliation {
  if (
    args.sourceReconciliation.review.status !== 'approved' ||
    args.sourceReconciliation.review.reviewedBy !== 'Guy' ||
    !isoTimestampIsValid(args.sourceReconciliation.review.reviewedAt)
  ) {
    throw new Error('source package reconciliation is not exact Guy-approved content');
  }
  const pending = structuredClone(args.sourceReconciliation);
  pending.sourceIdentity = structuredClone(args.newSnapshot.content.sourceIdentity);
  pending.sourceAuthoritySnapshotDigest = args.newSnapshot.digest;
  pending.templateDigest = canonicalJsonDigest(args.migratedTemplate);
  pending.templateSchemaVersion = args.migratedTemplate.schemaVersion;
  for (const frame of pending.frames) {
    frame.contractProjectionDigest = buildSourcePromptProjectionDigest(
      args.migratedTemplate,
      frame.frameKind,
      frame.pageNumber,
    );
    for (const requirement of frame.sourceRequirements) {
      requirement.sourceText = expectedSourceText({
        snapshot: args.newSnapshot,
        frameKind: frame.frameKind,
        pageNumber: frame.pageNumber,
        sourceKind: requirement.sourceKind,
      });
      for (const beat of requirement.visualBeats) {
        for (const evidence of beat.contractEvidence) {
          const before = resolveJsonPointer(args.sourceTemplate, evidence.path);
          const after = resolveJsonPointer(args.migratedTemplate, evidence.path);
          if (
            !before.found ||
            !after.found ||
            canonicalJsonDigest(before.value) !== canonicalJsonDigest(evidence.value)
          ) {
            throw new Error('source reconciliation contract evidence is stale or unmappable');
          }
          evidence.value = structuredClone(after.value);
        }
        if (beat.disposition === 'intentionally_superseded') {
          beat.supersessionReview = { status: 'pending', reviewedBy: null, reviewedAt: null };
        }
      }
    }
  }
  pending.actionSemanticCoverageAuthority = {
    version: ACTION_SEMANTIC_COVERAGE_RECONCILIATION_AUTHORITY_VERSION,
    actionSemanticCoverageVersion: ACTION_SEMANTIC_COVERAGE_VERSION,
    actionSemanticCoverageDigest: canonicalJsonDigest(args.migratedCoverage),
    records: structuredClone([...args.migratedCoverage]),
  };
  pending.presentationRequirements = presentationRequirements(args.migratedCoverage);
  const byOldId = new Map(
    args.evidenceMap.entries.map((entry) => [entry.oldSourceEvidenceId, entry.newSourceEvidenceId]),
  );
  pending.presentationRequirementDispositions = {
    version: PRESENTATION_REQUIREMENT_DISPOSITION_VERSION,
    entries: pending.presentationRequirementDispositions.entries.map((entry) => {
      const sourceEvidenceId = byOldId.get(entry.sourceEvidenceId);
      if (!sourceEvidenceId) throw new Error('presentation disposition sourceEvidenceId is unmappable');
      return {
        ...entry,
        sourceEvidenceId,
        review: { status: 'pending' as const, reviewedBy: null, reviewedAt: null },
      };
    }),
  };
  pending.review = { status: 'pending', reviewedBy: null, reviewedAt: null };
  return pending;
}

function changedDirectionPages(args: {
  oldSnapshot: StorySourceAuthoritySnapshot;
  newSnapshot: StorySourceAuthoritySnapshot;
}): number[] {
  const oldDirections = new Map(
    args.oldSnapshot.content.pageImageDirections.map((entry) => [entry.pageNumber, entry.imageDirection]),
  );
  const changed = args.newSnapshot.content.pageImageDirections
    .filter((entry) => oldDirections.get(entry.pageNumber) !== entry.imageDirection)
    .map((entry) => entry.pageNumber);
  if (oldDirections.size !== args.newSnapshot.content.pageImageDirections.length) {
    throw new Error('accepted revision direction migration changes page topology');
  }
  return changed;
}

function persistJson(args: {
  repoRoot: string;
  outputDir: string;
  category: string;
  digest: string;
  value: unknown;
  write: boolean;
}): { path: string; created: boolean } {
  const outputRoot = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, outputRoot);
  const destinationPath = path.join(outputRoot, args.category, `${args.digest}.json`);
  const result = args.write
    ? writeCanonicalContentAddressedJsonArtifact({ destinationPath, value: args.value })
    : { created: false };
  return {
    path: repoRelativePath(args.repoRoot, destinationPath),
    created: result.created,
  };
}

export function assertStorySourceRevisionMigrationArtifactPlanIsSafe(args: {
  repoRoot: string;
  outputRoot: string;
  artifacts: Array<{ path: string; bytes: string }>;
}): void {
  const allowedRoot = path.resolve(args.repoRoot, 'outputs');
  const allowedRootStat = fs.lstatSync(allowedRoot);
  const realAllowedRoot = fs.realpathSync(allowedRoot);
  if (
    allowedRootStat.isSymbolicLink() ||
    !allowedRootStat.isDirectory() ||
    realAllowedRoot !== allowedRoot ||
    !pathIsInside(allowedRoot, args.outputRoot)
  ) {
    throw new Error('migration output authority root is unsafe');
  }
  for (const artifact of args.artifacts) {
    const absolutePath = resolveRepoPath(args.repoRoot, artifact.path);
    if (!pathIsInside(args.outputRoot, absolutePath)) {
      throw new Error('migration output artifact escaped its exact output root');
    }
    const relativeParts = path.relative(allowedRoot, absolutePath).split(path.sep);
    for (let index = 0; index < relativeParts.length; index += 1) {
      const candidate = path.join(allowedRoot, ...relativeParts.slice(0, index + 1));
      if (!fs.existsSync(candidate)) break;
      const stat = fs.lstatSync(candidate);
      const realCandidate = fs.realpathSync(candidate);
      const expectedReal = path.resolve(realAllowedRoot, ...relativeParts.slice(0, index + 1));
      if (stat.isSymbolicLink() || realCandidate !== expectedReal) {
        throw new Error('migration output path contains a link or reparse alias');
      }
      if (index < relativeParts.length - 1 && !stat.isDirectory()) {
        throw new Error('migration output parent is not a directory');
      }
      if (index === relativeParts.length - 1) {
        if (!stat.isFile() || stat.nlink !== 1) {
          throw new Error('migration output artifact is not a single-link regular file');
        }
        if (fs.readFileSync(candidate, 'utf8') !== artifact.bytes) {
          throw new Error('migration output artifact conflicts with requested immutable bytes');
        }
      }
    }
  }
}

function buildManifest(
  input: Omit<StorySourceRevisionPackageMigrationManifest, 'digestAlgorithm' | 'digest'>,
): StorySourceRevisionPackageMigrationManifest {
  return {
    ...input,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(input),
  };
}

function validatePackageSource(packageValue: VisualPackageV4, oldSnapshot: StorySourceAuthoritySnapshot): void {
  const historicalSnapshotDigest =
    packageValue.reconciliation.content.sourceAuthoritySnapshotDigest;
  const legacyV2Digest = legacyStorySourceAuthoritySnapshotV2(oldSnapshot).digest;
  if (
    canonicalJsonDigest(packageValue.sourceSnapshot.identity) !==
      canonicalJsonDigest(oldSnapshot.content.sourceIdentity) ||
    normalizeTextForDigest(packageValue.sourceSnapshot.content) !==
      oldSnapshot.content.normalizedRawStorySource ||
    packageValue.sourceSnapshot.rawDigest !== sha256Bytes(packageValue.sourceSnapshot.content) ||
    historicalSnapshotDigest === undefined ||
    (historicalSnapshotDigest !== oldSnapshot.digest && historicalSnapshotDigest !== legacyV2Digest)
  ) {
    throw new Error('current Visual Package source authority is stale or incomplete');
  }
}

export function prepareStorySourceRevisionPackageMigration(
  args: PrepareStorySourceRevisionPackageMigrationArgs,
): PreparedStorySourceRevisionPackageMigration {
  const write = args.write === true;
  if (!canonicalRelativePath(args.outputDir) || !args.outputDir.startsWith('outputs/')) {
    throw new Error('migration output directory must be a canonical child of outputs');
  }
  const outputRoot = resolveRepoPath(args.repoRoot, args.outputDir);
  const allowedOutputRoot = path.resolve(args.repoRoot, 'outputs');
  if (!pathIsInside(allowedOutputRoot, outputRoot)) {
    throw new Error('migration output directory escaped outputs');
  }
  const current = loadCurrentVisualPackageV4({
    repoRoot: args.repoRoot,
    locatorPath: args.locatorPath,
    storyKey: args.storyKey,
    styleId: args.styleId,
  });
  const accepted = loadAcceptedRevisionAuthority({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    acceptedRevisionManifestPath: args.acceptedRevisionManifestPath,
  });
  const oldSnapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    storyPath: current.packageValue.sourceSnapshot.identity.path,
  });
  const newSnapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    storyPath: accepted.integratedStoryPath,
  });
  assertValidStorySourceAuthoritySnapshot(oldSnapshot);
  assertValidStorySourceAuthoritySnapshot(newSnapshot);
  validatePackageSource(current.packageValue, oldSnapshot);
  if (
    newSnapshot.content.sourceGenderMode !== 'neutral' ||
    sha256Bytes(fs.readFileSync(resolveRepoPath(args.repoRoot, accepted.integratedStoryPath))) !==
      accepted.integratedStorySha256
  ) {
    throw new Error('accepted revision Story Source authority is stale');
  }
  const evidenceMap = buildStorySourceEvidenceMigrationMap({ oldSnapshot, newSnapshot });
  const templateProjection = projectStorySourceEvidenceBindings({
    value: current.packageValue.visualContractTemplate.content,
    evidenceMap,
  });
  const migratedTemplate = templateProjection.value;
  assertValidBookVisualContractTemplate(migratedTemplate);
  const sourceCoverage =
    current.packageValue.reconciliation.content.actionSemanticCoverageAuthority.records;
  const coverageProjection = projectStorySourceEvidenceBindings({
    value: sourceCoverage,
    evidenceMap,
  });
  const migratedCoverage = coverageProjection.value;
  if (coverageProjection.sourceEvidenceOccurrenceCount !== migratedCoverage.length) {
    throw new Error('migrated Action Semantic Coverage source binding cardinality is invalid');
  }
  assertCompleteActionSemanticCoverage({ template: migratedTemplate, coverage: migratedCoverage });
  const newCatalogById = new Map(
    newSnapshot.content.sourceEvidenceCatalog.entries.map((entry) => [entry.sourceEvidenceId, entry]),
  );
  for (const record of migratedCoverage) {
    const entry = newCatalogById.get(record.sourceEvidenceId);
    if (!entry || entry.pageNumber !== record.pageNumber || entry.excerpt !== record.sourcePhrase) {
      throw new Error('migrated Action Semantic Coverage does not bind exact new source evidence');
    }
  }
  const pendingReconciliation = buildPendingStorySourceRevisionReconciliation({
    sourceReconciliation: current.packageValue.reconciliation.content,
    sourceTemplate: current.packageValue.visualContractTemplate.content,
    migratedTemplate,
    migratedCoverage,
    newSnapshot,
    evidenceMap,
  });
  const pendingIssues = sourcePromptReconciliationIssues({
    raw: pendingReconciliation,
    storyKey: args.storyKey,
    sourceIdentity: newSnapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: newSnapshot.digest,
    rawStorySource: newSnapshot.content.normalizedRawStorySource,
    template: migratedTemplate,
    templateDigest: canonicalJsonDigest(migratedTemplate),
    ...(newSnapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: newSnapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage: migratedCoverage,
    requireComplete: false,
  });
  if (pendingIssues.some((issue) => issue.code !== 'reconciliation_incomplete')) {
    throw new Error('migrated reconciliation has non-review blocking issues');
  }
  const reviewBundle = buildReconciliationReviewBundle({
    reconciliation: pendingReconciliation,
    sourceIdentity: newSnapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: newSnapshot.digest,
    rawStorySource: newSnapshot.content.normalizedRawStorySource,
    template: migratedTemplate,
    ...(newSnapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: newSnapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage: migratedCoverage,
  });
  if (reviewBundle.readyForApproval || reviewBundle.blockingIssues.length === 0) {
    throw new Error('migration preparation must require fresh reconciliation review');
  }
  const oldSnapshotArtifact = persistStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    snapshot: oldSnapshot,
    write: false,
  });
  const newSnapshotArtifact = persistStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    snapshot: newSnapshot,
    write: false,
  });
  const evidenceMapArtifact = persistJson({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'source-evidence-maps',
    digest: evidenceMap.digest,
    value: evidenceMap,
    write: false,
  });
  const migratedTemplateDigest = canonicalJsonDigest(migratedTemplate);
  const templateArtifact = persistJson({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'migrated-template-projections',
    digest: migratedTemplateDigest,
    value: migratedTemplate,
    write: false,
  });
  const coverageDigest = canonicalJsonDigest(migratedCoverage);
  const coverageArtifact = persistJson({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'migrated-action-semantic-coverage',
    digest: coverageDigest,
    value: migratedCoverage,
    write: false,
  });
  const reviewMarkdown = renderReconciliationReviewMarkdown(reviewBundle);
  const reconciliationArtifacts = persistReconciliationDraftBundle({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    reconciliation: pendingReconciliation,
    reviewBundle,
    markdown: reviewMarkdown,
    write: false,
  });
  const sourcePackageEvidenceOccurrenceCount = countSourceEvidenceOccurrences(current.packageValue);
  const manifest = buildManifest({
    version: STORY_SOURCE_REVISION_PACKAGE_MIGRATION_MANIFEST_VERSION,
    stage: 'reconciliation_pending',
    storyKey: args.storyKey,
    styleId: args.styleId,
    sourcePackage: {
      locatorPath: repoRelativePath(args.repoRoot, resolveRepoPath(args.repoRoot, args.locatorPath)),
      packagePath: current.locator.packagePath,
      revisionDigest: current.packageValue.revisionDigest,
      sourcePath: oldSnapshot.content.sourceIdentity.path,
      sourceIdentityDigest: oldSnapshot.content.sourceIdentity.digest,
      sourceAuthoritySnapshotDigest:
        current.packageValue.reconciliation.content.sourceAuthoritySnapshotDigest!,
      templateDigest: current.packageValue.visualContractTemplate.digest,
      reconciliationDigest: current.packageValue.reconciliation.digest,
    },
    acceptedRevision: {
      manifestPath: accepted.manifestPath,
      manifestDigest: accepted.manifest.digest,
      manifestSha256: accepted.manifestSha256,
      revisionDigest: accepted.manifest.revisionDigest,
      integratedStoryPath: accepted.integratedStoryPath,
      integratedStorySha256: accepted.integratedStorySha256,
      productReviewDigest: accepted.reviewBundleDigest,
      acceptancePath: accepted.acceptancePath,
      acceptanceSha256: accepted.acceptanceSha256,
    },
    evidenceMigration: {
      oldSnapshotDigest: oldSnapshot.digest,
      oldSnapshotPath: oldSnapshotArtifact.path,
      newSnapshotDigest: newSnapshot.digest,
      newSnapshotPath: newSnapshotArtifact.path,
      mapDigest: evidenceMap.digest,
      mapPath: evidenceMapArtifact.path,
      entryCount: evidenceMap.entries.length,
      changedExcerptCount: evidenceMap.entries.filter((entry) => entry.excerptChanged).length,
      allEvidenceIdsChanged: true,
    },
    projection: {
      migratedTemplateDigest,
      migratedTemplatePath: templateArtifact.path,
      templateEvidenceOccurrenceCount: templateProjection.sourceEvidenceOccurrenceCount,
      coverageDigest,
      coveragePath: coverageArtifact.path,
      coverageRecordCount: migratedCoverage.length,
      sourcePackageEvidenceOccurrenceCount,
      changedDirectionPages: changedDirectionPages({ oldSnapshot, newSnapshot }),
    },
    reconciliation: {
      digest: reviewBundle.reconciliationDigest,
      path: reconciliationArtifacts.reconciliationPath,
      reviewBundleDigest: reviewBundle.digest,
      reviewBundlePath: reconciliationArtifacts.reviewBundlePath,
      reviewMarkdownPath: reconciliationArtifacts.markdownPath,
      readyForApproval: false,
      blockingIssueCount: reviewBundle.blockingIssues.length,
    },
    externalCounters: {
      providerCalls: 0,
      imageRenders: 0,
      audioRenders: 0,
      databaseWrites: 0,
      storageWrites: 0,
      locatorWrites: 0,
    },
    doesNotAuthorize: STORY_SOURCE_REVISION_PACKAGE_MIGRATION_EXCLUSIONS,
  });
  const manifestArtifact = persistJson({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'story-source-revision-package-migration-manifests',
    digest: manifest.digest,
    value: manifest,
    write: false,
  });
  let manifestCreated = false;
  if (write) {
    assertStorySourceRevisionMigrationArtifactPlanIsSafe({
      repoRoot: args.repoRoot,
      outputRoot,
      artifacts: [
        {
          path: oldSnapshotArtifact.path,
          bytes: canonicalContentAddressedJsonBytes(oldSnapshot),
        },
        {
          path: newSnapshotArtifact.path,
          bytes: canonicalContentAddressedJsonBytes(newSnapshot),
        },
        {
          path: evidenceMapArtifact.path,
          bytes: canonicalContentAddressedJsonBytes(evidenceMap),
        },
        {
          path: templateArtifact.path,
          bytes: canonicalContentAddressedJsonBytes(migratedTemplate),
        },
        {
          path: coverageArtifact.path,
          bytes: canonicalContentAddressedJsonBytes(migratedCoverage),
        },
        {
          path: reconciliationArtifacts.reconciliationPath,
          bytes: reconciliationDraftBundleJsonBytes(pendingReconciliation),
        },
        {
          path: reconciliationArtifacts.reviewBundlePath,
          bytes: reconciliationDraftBundleJsonBytes(reviewBundle),
        },
        {
          path: reconciliationArtifacts.markdownPath,
          bytes: reviewMarkdown,
        },
        {
          path: manifestArtifact.path,
          bytes: canonicalContentAddressedJsonBytes(manifest),
        },
      ],
    });
    persistStorySourceAuthoritySnapshot({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      snapshot: oldSnapshot,
      write: true,
    });
    persistStorySourceAuthoritySnapshot({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      snapshot: newSnapshot,
      write: true,
    });
    persistJson({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      category: 'source-evidence-maps',
      digest: evidenceMap.digest,
      value: evidenceMap,
      write: true,
    });
    persistJson({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      category: 'migrated-template-projections',
      digest: migratedTemplateDigest,
      value: migratedTemplate,
      write: true,
    });
    persistJson({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      category: 'migrated-action-semantic-coverage',
      digest: coverageDigest,
      value: migratedCoverage,
      write: true,
    });
    persistReconciliationDraftBundle({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      reconciliation: pendingReconciliation,
      reviewBundle,
      markdown: reviewMarkdown,
      write: true,
    });
    const writtenManifestArtifact = persistJson({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      category: 'story-source-revision-package-migration-manifests',
      digest: manifest.digest,
      value: manifest,
      write: true,
    });
    manifestCreated = writtenManifestArtifact.created;
    const persistedBytes = fs.readFileSync(resolveRepoPath(args.repoRoot, manifestArtifact.path), 'utf8');
    if (persistedBytes !== canonicalContentAddressedJsonBytes(manifest)) {
      throw new Error('persisted migration manifest bytes are stale');
    }
  }
  return {
    manifest,
    oldSnapshot,
    newSnapshot,
    evidenceMap,
    migratedTemplate,
    migratedCoverage,
    pendingReconciliation,
    reviewBundle,
    artifacts: {
      manifestPath: manifestArtifact.path,
      created: manifestCreated,
    },
  };
}

/**
 * Load and fully re-derive a pending migration before it can receive approval.
 * This boundary deliberately consults the still-current locator; downstream
 * stages use the immutable approval artifact instead, so historical evidence
 * remains readable after the locator eventually advances.
 */
export function loadPendingStorySourceRevisionPackageMigration(args: {
  repoRoot: string;
  manifestPath: string;
}): PreparedStorySourceRevisionPackageMigration {
  const manifestFile = readContainedRegularFile({
    repoRoot: args.repoRoot,
    relativePath: args.manifestPath,
    allowedRoot: 'outputs',
    label: 'Story Source revision package migration manifest',
  });
  const raw = parseJsonObject(
    manifestFile.bytes,
    'Story Source revision package migration manifest',
  );
  const manifest = raw as unknown as StorySourceRevisionPackageMigrationManifest;
  if (
    manifest.version !== STORY_SOURCE_REVISION_PACKAGE_MIGRATION_MANIFEST_VERSION ||
    manifest.stage !== 'reconciliation_pending' ||
    manifest.digestAlgorithm !== 'canonical-json-sha256' ||
    manifest.digest !== canonicalJsonDigest((({ digestAlgorithm: _a, digest: _d, ...payload }) => payload)(manifest)) ||
    path.basename(manifestFile.absolutePath) !== `${manifest.digest}.json` ||
    path.basename(path.dirname(manifestFile.absolutePath)) !==
      'story-source-revision-package-migration-manifests'
  ) {
    throw new Error('Story Source revision package migration manifest is invalid');
  }
  const outputRoot = path.dirname(path.dirname(manifestFile.absolutePath));
  const outputDir = repoRelativePath(args.repoRoot, outputRoot);
  const rebuilt = prepareStorySourceRevisionPackageMigration({
    repoRoot: args.repoRoot,
    outputDir,
    storyKey: manifest.storyKey,
    styleId: manifest.styleId,
    locatorPath: manifest.sourcePackage.locatorPath,
    acceptedRevisionManifestPath: manifest.acceptedRevision.manifestPath,
    write: false,
  });
  if (
    canonicalContentAddressedJsonBytes(rebuilt.manifest) !==
      canonicalContentAddressedJsonBytes(manifest) ||
    rebuilt.artifacts.manifestPath !== args.manifestPath
  ) {
    throw new Error('Story Source revision package migration manifest is stale');
  }
  return rebuilt;
}
