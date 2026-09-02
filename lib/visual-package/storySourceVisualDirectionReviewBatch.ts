import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  allNominalMvpStorySlots,
  isCompleteMvpWizardStoryInventory,
  type MvpCategory,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import { canonicalHash, canonicalize } from '@/lib/canonical-json';
import {
  loadWizardQaCatalog,
  WIZARD_QA_CANDIDATE_VERSION,
  WIZARD_QA_CATALOG_VERSION,
  WIZARD_QA_RESEMBLANCE_THRESHOLD,
  type WizardQaCatalogRecord,
  type WizardQaRenderCatalog,
  type WizardQaStoryboardCandidate,
} from '@/lib/wizard-render-readiness';

import {
  auditWizardAllStoryRenderReadinessForR3B0bReplay,
  WIZARD_ALL_STORY_RENDER_READINESS_VERSION,
  type StorySourceTextReadiness,
  type WizardAllStoryReadinessRecord,
  type WizardAllStoryRenderReadinessReport,
} from './wizardAllStoryRenderReadiness';
import { normalizedTextDigest, relativeArtifactPathIssues } from './integrity';

export const STORY_SOURCE_VISUAL_DIRECTION_REVIEW_REQUEST_VERSION =
  'small-heroes-story-source-visual-direction-review-request/v1' as const;
export const STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_VERSION =
  'small-heroes-story-source-visual-direction-review-batch/v1' as const;

export const DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_REQUEST_PATH =
  'story-pipeline/04_approved_story_sources/review-requests/r3b0b-qa-story-source-visual-direction-review-request.json' as const;
export const DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_OUTPUT_ROOT =
  'outputs/r3b0b-story-source-visual-direction-review-batch' as const;

const QA_BANK_ROOT = 'story-bank/qa-autonomous-20260815-v1';
const QA_CANDIDATE_ROOT = 'qa-authorities/wizard/storyboard-candidates';
const QA_AUTHORITY_ROOT = 'qa-authorities/wizard';
const V3_PRODUCT_STORY_ROOT = 'story-bank/v3-approved';
const ACCEPTED_SOURCE_ROOT =
  'story-pipeline/04_approved_story_sources/accepted';
const PRODUCT_ACCEPTANCE_ROOT =
  'story-pipeline/04_approved_story_sources/approvals';
const REVIEW_CORPUS_ROOT =
  'story-pipeline/04_approved_story_sources/review-corpora';
const STORYBOARD_ROOT =
  'story-pipeline/05_storyboard_inputs/autonomous-20260815-v1';
const REQUEST_ROOT =
  'story-pipeline/04_approved_story_sources/review-requests';
const APPROVED_VISUAL_PACKAGE_ROOT = 'visual-packages/approved';
const STORYBOARD_RECORD_VERSION =
  'small-heroes-story-visual-direction-record/v1';
const STORYBOARD_CORPUS_VERSION =
  'small-heroes-storyboard-input-corpus/v1';
const DIRECTION_RECEIPT_VERSION =
  'small-heroes-story-visual-direction-call-receipt/v1';
const ACCEPTED_SOURCE_MANIFEST_VERSION =
  'small-heroes-product-accepted-story-source-manifest/v1';
const INDIVIDUAL_PRODUCT_ACCEPTANCE_VERSION =
  'small-heroes-story-product-acceptance/v1';
const CORPUS_PRODUCT_ACCEPTANCE_VERSION =
  'small-heroes-story-corpus-product-acceptance/v1';
const HISTORICAL_REVIEW_CORPUS_VERSION =
  'small-heroes-autonomous-story-review-corpus/v1';
const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_STORY_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SAFE_STORY_KEY = /^[a-z][a-z0-9_]{2,95}$/;
const DIRECTION_PRESENCE = new Set(['present', 'partial', 'absent']);
const DIRECTION_SHOTS = new Set([
  'extreme_wide',
  'wide',
  'medium_wide',
  'medium',
  'medium_close',
  'close',
  'detail',
]);
const DIRECTION_ANGLES = new Set([
  'eye_level',
  'high_angle',
  'low_angle',
  'overhead',
  'ground_level',
  'three_quarter',
]);

const REQUIRED_EXCLUSIONS = [
  'acceptance',
  'deployment',
  'publication',
  'runtime_eligibility',
  'story_source_rewrite',
  'visual_direction_rewrite',
] as const;

const ZERO_EFFECTS = Object.freeze({
  filesDeleted: 0 as const,
  storySourcesRewritten: 0 as const,
  visualDirectionsRewritten: 0 as const,
  acceptancesCreated: 0 as const,
  publicationsCreated: 0 as const,
  runtimeActivations: 0 as const,
  databaseReads: 0 as const,
  databaseWrites: 0 as const,
  storageReads: 0 as const,
  storageWrites: 0 as const,
  networkCalls: 0 as const,
  providerCalls: 0 as const,
  imagesGenerated: 0 as const,
  audioGenerated: 0 as const,
  pdfsGenerated: 0 as const,
  ordersCreatedOrModified: 0 as const,
  maximumSpendUsd: 0 as const,
});

export interface RawFileDescriptor {
  path: string;
  bytes: number;
  rawSha256: string;
}

export interface JsonFileDescriptor extends RawFileDescriptor {
  canonicalDigestAlgorithm: 'canonical-json-sha256';
  canonicalDigest: string;
}

export interface BoundCompanionView extends RawFileDescriptor {
  kind: string;
  qaStatus: 'passed';
  resemblanceToIdentity: number;
}

export interface StorySourceVisualDirectionReviewRecord {
  category: MvpCategory;
  direction: StoryDirection;
  storyKey: string;
  companionId: string;
  pageCount: number;
  state: 'pending_exact_product_and_visual_review';
  productionEligible: false;
  runtimeEligible: false;
  authorityChain: {
    v3ProductFallback: {
      story: RawFileDescriptor & {
        normalizedDigestAlgorithm: 'sha256-normalized-utf8';
        normalizedDigest: string;
      };
      importSidecar: JsonFileDescriptor;
    };
    acceptedManifest: JsonFileDescriptor;
    acceptedStory: RawFileDescriptor;
    productAcceptance: JsonFileDescriptor;
    productAcceptanceBinding:
      | {
          kind: 'individual_story';
          version: typeof INDIVIDUAL_PRODUCT_ACCEPTANCE_VERSION;
          storySha256: string;
          editorialReviewSha256: string;
        }
      | {
          kind: 'corpus';
          version: typeof CORPUS_PRODUCT_ACCEPTANCE_VERSION;
          corpusManifest: JsonFileDescriptor;
          corpusRecordDigest: string;
        };
    editorialReview: {
      verdict: 'pass';
      trackedSnapshot: JsonFileDescriptor;
      upstreamSource: {
        path: string;
        status: 'not_dereferenced_manifest_provenance';
        expectedBytes: number;
        expectedRawSha256: string;
      };
    };
    qaIntegratedStory: RawFileDescriptor & {
      normalizedDigestAlgorithm: 'sha256-normalized-utf8';
      normalizedDigest: string;
    };
    sourceProjection: {
      algorithm: 'remove-imageDirection-lines/v1';
      imageDirectionLineCount: number;
      bytes: number;
      rawSha256: string;
      byteIdenticalToAcceptedStory: true;
    };
    importSidecar: JsonFileDescriptor;
    qaCandidate: JsonFileDescriptor & {
      embeddedDigest: string;
    };
    visualDirection: JsonFileDescriptor & {
      version: typeof STORYBOARD_RECORD_VERSION;
      pageCount: number;
    };
    visualDirectionReceipt: JsonFileDescriptor;
    storyboardCorpusRecordDigest: string;
    companionAuthority: {
      manifest: JsonFileDescriptor;
      minimumResemblance: number;
      resemblanceThreshold: typeof WIZARD_QA_RESEMBLANCE_THRESHOLD;
      views: BoundCompanionView[];
    };
  };
  readinessEvidence: {
    sourceAuditRecordDigest: string;
    qaCandidateDigest: string;
    excludedLegacyAdjacentArtifactPaths: string[];
  };
  narrationPreflight: StorySourceTextReadiness & {
    status: 'automated_evidence_only_human_review_pending';
  };
  reviewRequirements: {
    technical: 'pending_claude_code';
    exactProductAndVisual: 'pending_guy';
    storyQuality:
      | 'pending_claude_cowork'
      | 'not_required_by_current_request';
  };
  exclusions: readonly string[];
  effects: typeof ZERO_EFFECTS;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface StorySourceVisualDirectionReviewBatch {
  version: typeof STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_VERSION;
  status: 'pending_exact_product_and_visual_review';
  authorityScope: 'review_candidates_only';
  productionEligible: false;
  runtimeEligible: false;
  request: {
    artifact: JsonFileDescriptor;
    version: typeof STORY_SOURCE_VISUAL_DIRECTION_REVIEW_REQUEST_VERSION;
    digest: string;
    authorizedBy: 'Guy';
    authorizedOn: string;
  };
  selection: {
    sourceRole: 'qa_low_only';
    predicate: 'sources.corpusDecisionRequired === true';
    sourceAudit: {
      version: typeof WIZARD_ALL_STORY_RENDER_READINESS_VERSION;
      digest: string;
    };
    qaCatalog: JsonFileDescriptor & {
      version: typeof WIZARD_QA_CATALOG_VERSION;
      embeddedDigest: string;
    };
    storyboardCorpus: JsonFileDescriptor & {
      version: typeof STORYBOARD_CORPUS_VERSION;
      embeddedDigest: string;
    };
    nominalSlotCount: 18;
    candidateCount: 17;
    companionCount: 6;
    directionCounts: Record<StoryDirection, number>;
    totalPageCount: number;
    fantasy: {
      storyCount: 6;
      pageCountPerStory: 16;
    };
    preservedExistingStrictAuthority: Array<{
      storyKey: string;
      sourceAuditRecordDigest: string;
      acceptedRevisionDigests: string[];
      packageRevisionDigest: string | null;
      qaCompletenessRecordDigest: string;
      locator: JsonFileDescriptor;
      packageArtifact: JsonFileDescriptor;
    }>;
  };
  records: StorySourceVisualDirectionReviewRecord[];
  exclusions: readonly string[];
  effects: typeof ZERO_EFFECTS;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface PreparedStorySourceVisualDirectionReviewBatch {
  batch: StorySourceVisualDirectionReviewBatch;
  artifact: {
    path: string;
    created: boolean;
  };
}

interface BoundFile {
  absolutePath: string;
  bytes: Buffer;
  descriptor: RawFileDescriptor;
}

interface BoundJsonFile extends BoundFile {
  value: Record<string, unknown>;
  descriptor: JsonFileDescriptor;
}

interface ReviewRequest {
  version: typeof STORY_SOURCE_VISUAL_DIRECTION_REVIEW_REQUEST_VERSION;
  status: 'candidate_preparation_authorized';
  authorityScope: 'review_batch_candidate_preparation_only';
  authorizedBy: 'Guy';
  authorizedOn: string;
  decisionGatePath: string;
  decisions: {
    fantasyFormat: {
      preserve: true;
      requiredPageCountPerStory: 16;
      requiredStoryCount: 6;
    };
    preserveExistingStrictAuthority: {
      required: true;
      storyKey: string;
    };
    sourceCorpus: {
      role: 'review_starting_point';
      value: 'qa_corpus';
    };
    unresolvedSelection: {
      enumeratedStoryKeys: false;
      predicate: 'sources.corpusDecisionRequired === true';
      requiredCandidateCount: 17;
    };
  };
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
  effects: Record<string, number>;
  exclusions: string[];
  reviewRequirements: {
    allCandidates: {
      exactProductAndVisualAcceptance: { reviewer: 'Guy'; status: 'pending' };
      technicalReview: { reviewer: 'Claude Code'; status: 'pending' };
    };
    storySpecific: Record<
      string,
      {
        exactAcceptance: { reviewer: 'Guy'; status: 'pending' };
        storyQualityReview: { reviewer: 'Claude Cowork'; status: 'pending' };
      }
    >;
  };
  runtimeEligible: false;
}

interface HistoricalReviewCorpusRecord {
  briefId: string;
  slot: string;
  companionId: string;
  direction: StoryDirection;
  category: MvpCategory;
  textPageCount: number;
  physicalPageCount: number;
  storySha256: string;
  reviewSha256: string;
  normalizationActions: Array<{ code: string; lineCount: number }>;
  source: Record<string, unknown>;
}

interface ValidatedHistoricalAcceptance {
  file: BoundJsonFile;
  version:
    | typeof INDIVIDUAL_PRODUCT_ACCEPTANCE_VERSION
    | typeof CORPUS_PRODUCT_ACCEPTANCE_VERSION;
  audit: Record<string, unknown>;
  exclusions: string[];
  individual?: {
    briefId: string;
    storySha256: string;
    editorialReviewSha256: string;
  };
  corpus?: {
    file: BoundJsonFile;
    records: Map<string, HistoricalReviewCorpusRecord>;
  };
}

function fail(message: string): never {
  throw new Error(`story source/visual direction review batch rejected: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort(asciiCompare);
  const expected = [...keys].sort(asciiCompare);
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  if (!exactKeys(value, keys)) fail(`${label} keys are invalid`);
}

function requireExactKeysInOrder(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key, index) => key !== keys[index])
  ) {
    fail(`${label} keys or key order are invalid`);
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function requireSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function requireSha256(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_HEX.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest`);
  }
  return value;
}

function requireGitSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) {
    fail(`${label} must be a lowercase 40-character Git SHA`);
  }
  return value;
}

function isoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function jsonTreeIsNfc(value: unknown): boolean {
  if (typeof value === 'string') return value.normalize('NFC') === value;
  if (Array.isArray(value)) return value.every(jsonTreeIsNfc);
  if (!isObject(value)) return true;
  return Object.entries(value).every(
    ([key, entry]) => key.normalize('NFC') === key && jsonTreeIsNfc(entry),
  );
}

function requireLegacyPrettyJsonBytes(file: BoundJsonFile, label: string): void {
  const serialized = JSON.stringify(file.value, null, 2);
  if (
    serialized === undefined ||
    file.bytes.toString('utf8') !== `${serialized}\n` ||
    !jsonTreeIsNfc(file.value)
  ) {
    fail(`${label} bytes are not strict LF/NFC pretty JSON`);
  }
}

function asciiCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJsonBytes(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value), null, 2);
  if (serialized === undefined) fail('canonical JSON is undefined');
  return `${serialized}\n`;
}

function compactCanonicalJsonBytes(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) fail('compact canonical JSON is undefined');
  return `${serialized}\n`;
}

function digestWithoutDigest(value: Record<string, unknown>): string {
  const { digest: _digest, ...payload } = value;
  return canonicalHash(payload);
}

function canonicalRelativePath(value: string): boolean {
  const segments = value.split('/');
  return value.length > 0 &&
    value.length <= 512 &&
    !value.includes('\0') &&
    relativeArtifactPathIssues('path', value).length === 0 &&
    path.posix.normalize(value) === value &&
    segments.every(
      (segment) =>
        !/[. ]$/u.test(segment) &&
        !segment.includes(':') &&
        !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(segment),
    );
}

function filesystemPathsEqual(left: string, right: string): boolean {
  return process.platform === 'win32'
    ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
    : path.resolve(left) === path.resolve(right);
}

function pathIsWithinOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validateDirectoryIdentity(directory: string, label: string): void {
  let stat: fs.Stats;
  let real: string;
  try {
    stat = fs.lstatSync(directory);
    real = fs.realpathSync(directory);
  } catch {
    fail(`${label} is missing or unreadable`);
  }
  if (
    stat.isSymbolicLink() ||
    !stat.isDirectory() ||
    !filesystemPathsEqual(real, directory)
  ) {
    fail(`${label} contains a link or reparse alias`);
  }
}

/** Strict authority reader: canonical path, containment, no links, one link, bounded bytes, stable identity. */
export function readStoryReviewBoundRegularFile(args: {
  repoRoot: string;
  relativePath: string;
  allowedRoot: string;
  label: string;
  maxBytes: number;
}): BoundFile {
  if (!canonicalRelativePath(args.relativePath)) {
    fail(`${args.label} path is not canonical`);
  }
  if (!canonicalRelativePath(args.allowedRoot)) {
    fail(`${args.label} authority root is not canonical`);
  }
  const repoRoot = path.resolve(args.repoRoot);
  validateDirectoryIdentity(repoRoot, 'repository root');
  const allowedRoot = path.resolve(
    repoRoot,
    ...args.allowedRoot.split('/'),
  );
  const absolutePath = path.resolve(
    repoRoot,
    ...args.relativePath.split('/'),
  );
  if (!pathIsWithinOrEqual(allowedRoot, absolutePath) || absolutePath === allowedRoot) {
    fail(`${args.label} path escaped its authority root`);
  }
  validateDirectoryIdentity(allowedRoot, `${args.label} authority root`);
  const relativeParts = path.relative(allowedRoot, absolutePath).split(path.sep);
  let targetStat: fs.Stats | null = null;
  for (let index = 0; index < relativeParts.length; index += 1) {
    const candidate = path.join(
      allowedRoot,
      ...relativeParts.slice(0, index + 1),
    );
    let stat: fs.Stats;
    let real: string;
    try {
      stat = fs.lstatSync(candidate);
      real = fs.realpathSync(candidate);
    } catch {
      fail(`${args.label} is missing or unreadable`);
    }
    if (stat.isSymbolicLink() || !filesystemPathsEqual(real, candidate)) {
      fail(`${args.label} contains a link or reparse alias`);
    }
    const isTarget = index === relativeParts.length - 1;
    if (!isTarget && !stat.isDirectory()) {
      fail(`${args.label} parent is not a directory`);
    }
    if (isTarget) targetStat = stat;
  }
  if (!targetStat?.isFile() || targetStat.nlink !== 1) {
    fail(`${args.label} is not a single-link regular file`);
  }
  if (targetStat.size <= 0 || targetStat.size > args.maxBytes) {
    fail(`${args.label} byte size is outside the allowed range`);
  }
  const before = targetStat;
  const bytes = fs.readFileSync(absolutePath);
  const after = fs.lstatSync(absolutePath);
  if (
    !after.isFile() ||
    after.nlink !== 1 ||
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs ||
    after.ctimeMs !== before.ctimeMs ||
    ('ino' in before && before.ino !== after.ino) ||
    bytes.length !== before.size ||
    !filesystemPathsEqual(fs.realpathSync(absolutePath), absolutePath)
  ) {
    fail(`${args.label} changed identity while it was read`);
  }
  return {
    absolutePath,
    bytes,
    descriptor: {
      path: args.relativePath,
      bytes: bytes.length,
      rawSha256: sha256(bytes),
    },
  };
}

function readBoundJson(args: {
  repoRoot: string;
  relativePath: string;
  allowedRoot: string;
  label: string;
}): BoundJsonFile {
  const file = readStoryReviewBoundRegularFile({
    ...args,
    maxBytes: MAX_JSON_BYTES,
  });
  let value: unknown;
  try {
    value = JSON.parse(file.bytes.toString('utf8')) as unknown;
  } catch {
    fail(`${args.label} JSON is invalid`);
  }
  const object = requireObject(value, args.label);
  return {
    ...file,
    value: object,
    descriptor: {
      ...file.descriptor,
      canonicalDigestAlgorithm: 'canonical-json-sha256',
      canonicalDigest: canonicalHash(object),
    },
  };
}

function validateReviewRequest(file: BoundJsonFile): ReviewRequest {
  const value = file.value;
  if (file.bytes.toString('utf8') !== canonicalJsonBytes(value)) {
    fail('review request bytes are not canonical pretty JSON');
  }
  requireExactKeys(value, [
    'authorityScope',
    'authorizedBy',
    'authorizedOn',
    'decisionGatePath',
    'decisions',
    'digest',
    'digestAlgorithm',
    'effects',
    'exclusions',
    'reviewRequirements',
    'runtimeEligible',
    'status',
    'version',
  ], 'review request');
  if (
    value.version !== STORY_SOURCE_VISUAL_DIRECTION_REVIEW_REQUEST_VERSION ||
    value.status !== 'candidate_preparation_authorized' ||
    value.authorityScope !== 'review_batch_candidate_preparation_only' ||
    value.authorizedBy !== 'Guy' ||
    value.runtimeEligible !== false ||
    value.digestAlgorithm !== 'canonical-json-sha256' ||
    value.digest !== digestWithoutDigest(value)
  ) {
    fail('review request authority or self-digest is invalid');
  }
  const authorizedOn = requireString(value.authorizedOn, 'authorizedOn');
  if (!isoCalendarDate(authorizedOn)) {
    fail('review request authorizedOn must be an ISO calendar date');
  }
  if (
    value.decisionGatePath !==
      'docs/ai-workflow/R3B0B_QA_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_DECISION_GATE.md'
  ) {
    fail('review request Decision Gate path is invalid');
  }
  const decisions = requireObject(value.decisions, 'review request decisions');
  requireExactKeys(decisions, [
    'fantasyFormat',
    'preserveExistingStrictAuthority',
    'sourceCorpus',
    'unresolvedSelection',
  ], 'review request decisions');
  const fantasy = requireObject(decisions.fantasyFormat, 'fantasy format');
  const preserve = requireObject(
    decisions.preserveExistingStrictAuthority,
    'strict authority preservation',
  );
  const corpus = requireObject(decisions.sourceCorpus, 'source corpus choice');
  const selection = requireObject(
    decisions.unresolvedSelection,
    'unresolved selection',
  );
  if (
    fantasy.preserve !== true ||
    fantasy.requiredPageCountPerStory !== 16 ||
    fantasy.requiredStoryCount !== 6 ||
    preserve.required !== true ||
    preserve.storyKey !== 'chameleon_koko_bedtime' ||
    corpus.role !== 'review_starting_point' ||
    corpus.value !== 'qa_corpus' ||
    selection.enumeratedStoryKeys !== false ||
    selection.predicate !== 'sources.corpusDecisionRequired === true' ||
    selection.requiredCandidateCount !== 17
  ) {
    fail('review request product decisions are invalid');
  }
  const effects = requireObject(value.effects, 'review request effects');
  if (
    Object.keys(effects).length === 0 ||
    Object.values(effects).some((effect) => effect !== 0)
  ) {
    fail('review request effects must all be zero');
  }
  if (
    !Array.isArray(value.exclusions) ||
    [...value.exclusions].sort(asciiCompare).join('\0') !==
      [...REQUIRED_EXCLUSIONS].sort(asciiCompare).join('\0')
  ) {
    fail('review request exclusions are invalid');
  }
  const requirements = requireObject(
    value.reviewRequirements,
    'review requirements',
  );
  const allCandidates = requireObject(
    requirements.allCandidates,
    'all-candidate requirements',
  );
  const exactReview = requireObject(
    allCandidates.exactProductAndVisualAcceptance,
    'exact product/visual requirement',
  );
  const technicalReview = requireObject(
    allCandidates.technicalReview,
    'technical requirement',
  );
  const storySpecific = requireObject(
    requirements.storySpecific,
    'story-specific requirements',
  );
  const lion = requireObject(
    storySpecific.lion_shaket_adventure,
    'Lion adventure requirements',
  );
  const lionAcceptance = requireObject(
    lion.exactAcceptance,
    'Lion exact acceptance',
  );
  const lionQuality = requireObject(
    lion.storyQualityReview,
    'Lion story quality',
  );
  if (
    Object.keys(storySpecific).length !== 1 ||
    exactReview.reviewer !== 'Guy' ||
    exactReview.status !== 'pending' ||
    technicalReview.reviewer !== 'Claude Code' ||
    technicalReview.status !== 'pending' ||
    lionAcceptance.reviewer !== 'Guy' ||
    lionAcceptance.status !== 'pending' ||
    lionQuality.reviewer !== 'Claude Cowork' ||
    lionQuality.status !== 'pending'
  ) {
    fail('review requirements are invalid');
  }
  return value as unknown as ReviewRequest;
}

function withCanonicalAuditEnvironment<T>(callback: () => T): T {
  const previousV3 = process.env.ENABLE_V3_APPROVED_BANK;
  const previousQa = process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
  process.env.ENABLE_V3_APPROVED_BANK = 'true';
  process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = 'false';
  try {
    return callback();
  } finally {
    if (previousV3 === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = previousV3;
    if (previousQa === undefined) delete process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
    else process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = previousQa;
  }
}

function preflightPredictableAuthorityGraph(repoRoot: string): void {
  const slots = allNominalMvpStorySlots();
  if (slots.length !== 18) {
    fail('predictable authority preflight requires the complete 18-slot matrix');
  }
  for (const slot of slots) {
    const storyKey = slot.storyKey;
    for (const input of [
      {
        path: `${QA_BANK_ROOT}/${storyKey}.md`,
        root: QA_BANK_ROOT,
        maxBytes: MAX_STORY_BYTES,
        label: `${storyKey} preflight QA story`,
      },
      {
        path: `${QA_BANK_ROOT}/${storyKey}.import.json`,
        root: QA_BANK_ROOT,
        maxBytes: MAX_JSON_BYTES,
        label: `${storyKey} preflight QA sidecar`,
      },
      {
        path: `${QA_CANDIDATE_ROOT}/${storyKey}.json`,
        root: QA_CANDIDATE_ROOT,
        maxBytes: MAX_JSON_BYTES,
        label: `${storyKey} preflight QA candidate`,
      },
      {
        path: `${STORYBOARD_ROOT}/${storyKey}.visual-directions.json`,
        root: STORYBOARD_ROOT,
        maxBytes: MAX_JSON_BYTES,
        label: `${storyKey} preflight Visual Direction`,
      },
      {
        path: `${STORYBOARD_ROOT}/${storyKey}.receipt.json`,
        root: STORYBOARD_ROOT,
        maxBytes: MAX_JSON_BYTES,
        label: `${storyKey} preflight Visual Direction receipt`,
      },
      {
        path: `${V3_PRODUCT_STORY_ROOT}/${storyKey}.md`,
        root: V3_PRODUCT_STORY_ROOT,
        maxBytes: MAX_STORY_BYTES,
        label: `${storyKey} preflight V3 story`,
      },
      {
        path: `${V3_PRODUCT_STORY_ROOT}/${storyKey}.import.json`,
        root: V3_PRODUCT_STORY_ROOT,
        maxBytes: MAX_JSON_BYTES,
        label: `${storyKey} preflight V3 sidecar`,
      },
    ]) {
      readStoryReviewBoundRegularFile({
        repoRoot,
        relativePath: input.path,
        allowedRoot: input.root,
        label: input.label,
        maxBytes: input.maxBytes,
      });
    }
  }
  const viewFilenames = ['front.png', '3-4.png', 'side.png', 'back.png', 'happy.png', 'theme.png'];
  for (const companionId of new Set(slots.map((slot) => slot.companionId))) {
    const sheetRoot = `public/companions/${companionId}/style01-sheets`;
    readStoryReviewBoundRegularFile({
      repoRoot,
      relativePath: `${sheetRoot}/manifest.json`,
      allowedRoot: sheetRoot,
      label: `${companionId} preflight companion manifest`,
      maxBytes: MAX_JSON_BYTES,
    });
    for (const filename of viewFilenames) {
      readStoryReviewBoundRegularFile({
        repoRoot,
        relativePath: `${sheetRoot}/${filename}`,
        allowedRoot: sheetRoot,
        label: `${companionId} preflight companion ${filename}`,
        maxBytes: MAX_IMAGE_BYTES,
      });
    }
  }
}

function validateQaCatalog(args: {
  repoRoot: string;
}): { catalog: WizardQaRenderCatalog; file: BoundJsonFile } {
  const relativePath = `${QA_AUTHORITY_ROOT}/catalog.json`;
  const file = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath,
    allowedRoot: QA_AUTHORITY_ROOT,
    label: 'Wizard QA catalog',
  });
  const loaded = loadWizardQaCatalog({
    repoRoot: args.repoRoot,
    catalogPath: relativePath,
  });
  if (
    !loaded ||
    loaded.version !== WIZARD_QA_CATALOG_VERSION ||
    file.value.version !== WIZARD_QA_CATALOG_VERSION ||
    file.value.digest !== digestWithoutDigest(file.value) ||
    canonicalHash(loaded) !== canonicalHash(file.value) ||
    file.bytes.toString('utf8') !== compactCanonicalJsonBytes(file.value)
  ) {
    fail('Wizard QA catalog is invalid or drifted');
  }
  return { catalog: loaded, file };
}

interface StoryboardCorpusRecord {
  category: MvpCategory;
  companionId: string;
  direction: StoryDirection;
  importSidecarSha256: string;
  integratedStorySha256: string;
  pageCount: number;
  sourceStorySha256: string;
  storyKey: string;
  visualDirectionSha256: string;
}

function validateStoryboardCorpus(args: {
  repoRoot: string;
}): {
  file: BoundJsonFile;
  records: Map<string, StoryboardCorpusRecord>;
  embeddedDigest: string;
} {
  const file = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: `${STORYBOARD_ROOT}/manifest.json`,
    allowedRoot: STORYBOARD_ROOT,
    label: 'storyboard corpus manifest',
  });
  const value = file.value;
  const embeddedDigest = requireSha256(
    value.digest,
    'storyboard corpus digest',
  );
  const { digest: _digest, ...payload } = value;
  if (
    value.version !== STORYBOARD_CORPUS_VERSION ||
    value.status !== 'qa_ready_for_low_story_generation' ||
    value.authorityScope !== 'qa_only' ||
    value.productionEligible !== false ||
    value.productionStoryBankTouched !== false ||
    value.storyCount !== 18 ||
    value.companionCount !== 6 ||
    value.directionCount !== 3 ||
    sha256(canonicalJsonBytes(payload)) !== embeddedDigest ||
    file.bytes.toString('utf8') !== canonicalJsonBytes(value) ||
    !Array.isArray(value.records) ||
    value.records.length !== 18
  ) {
    fail('storyboard corpus manifest is invalid');
  }
  const records = new Map<string, StoryboardCorpusRecord>();
  for (const entry of value.records) {
    const record = requireObject(entry, 'storyboard corpus record');
    requireExactKeys(record, [
      'category',
      'companionId',
      'direction',
      'importSidecarSha256',
      'integratedStorySha256',
      'pageCount',
      'sourceStorySha256',
      'storyKey',
      'visualDirectionSha256',
    ], 'storyboard corpus record');
    const storyKey = requireString(record.storyKey, 'corpus storyKey');
    if (!SAFE_STORY_KEY.test(storyKey) || records.has(storyKey)) {
      fail('storyboard corpus identities are duplicate or invalid');
    }
    records.set(storyKey, record as unknown as StoryboardCorpusRecord);
  }
  if (!isCompleteMvpWizardStoryInventory({
    declaredSlotCount: 18,
    storyKeys: [...records.keys()],
  })) {
    fail('storyboard corpus is not the complete 18-slot inventory');
  }
  return { file, records, embeddedDigest };
}

function verifyDescriptor(
  descriptor: RawFileDescriptor,
  expected: { bytes: unknown; sha256: unknown },
  label: string,
): void {
  if (
    descriptor.bytes !== requireSafeInteger(expected.bytes, `${label} bytes`) ||
    descriptor.rawSha256 !== requireSha256(expected.sha256, `${label} SHA-256`)
  ) {
    fail(`${label} bytes or digest drifted`);
  }
}

function historicalReviewSourceProvenance(args: {
  relativePath: string;
  expectedBytes: number;
  expectedRawSha256: string;
}): StorySourceVisualDirectionReviewRecord['authorityChain']['editorialReview']['upstreamSource'] {
  if (!canonicalRelativePath(args.relativePath)) {
    fail('editorial review upstream source path is not canonical');
  }
  const allowedRoot = args.relativePath.startsWith(`${REVIEW_CORPUS_ROOT}/`)
    ? REVIEW_CORPUS_ROOT
    : args.relativePath.startsWith('outputs/')
      ? 'outputs'
      : null;
  if (!allowedRoot) fail('editorial review upstream source root is not allowed');
  // This historical locator can point into ignored outputs. It is deliberately
  // recorded as opaque provenance and never probed, so clean-checkout output
  // cannot depend on machine-local ignored files. The tracked accepted snapshot
  // above is the byte-verified editorial evidence.
  return {
    path: args.relativePath,
    status: 'not_dereferenced_manifest_provenance',
    expectedBytes: args.expectedBytes,
    expectedRawSha256: args.expectedRawSha256,
  };
}

function validatePassAudit(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  requireExactKeysInOrder(value, keys, label);
  if (
    value.status !== 'pass' ||
    value.blocker !== 0 ||
    value.major !== 0 ||
    value.minor !== 0
  ) {
    fail(`${label} verdict is invalid`);
  }
  requireGitSha(value.reviewedHead, `${label} reviewedHead`);
  if (keys.includes('reviewedBase')) {
    requireGitSha(value.reviewedBase, `${label} reviewedBase`);
  }
}

function validateHistoricalReviewCorpus(args: {
  repoRoot: string;
  relativePath: string;
  expectedRawSha256: string;
  expectedRecordCount: number;
}): {
  file: BoundJsonFile;
  records: Map<string, HistoricalReviewCorpusRecord>;
} {
  const file = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: args.relativePath,
    allowedRoot: REVIEW_CORPUS_ROOT,
    label: 'historical accepted review corpus',
  });
  if (file.descriptor.rawSha256 !== args.expectedRawSha256) {
    fail('historical accepted review corpus raw digest drifted');
  }
  requireLegacyPrettyJsonBytes(file, 'historical accepted review corpus');
  const value = file.value;
  requireExactKeysInOrder(value, [
    'version',
    'status',
    'authorityScope',
    'selection',
    'acceptedExistingBriefId',
    'candidateCount',
    'completeSlotCountAfterExistingAcceptance',
    'records',
    'exclusions',
  ], 'historical accepted review corpus');
  const expectedExclusions = [
    'product_acceptance',
    'story_bank_import',
    'wizard_runtime',
    'visual_contract',
    'render',
    'deployment',
  ];
  if (
    value.version !== HISTORICAL_REVIEW_CORPUS_VERSION ||
    value.status !== 'pending_independent_artifact_audit' ||
    value.authorityScope !== 'story_text_candidates_only' ||
    value.selection !==
      'story-pipeline/04_approved_story_sources/autonomous-corpus-selection.json' ||
    typeof value.acceptedExistingBriefId !== 'string' ||
    value.acceptedExistingBriefId.length === 0 ||
    value.candidateCount !== args.expectedRecordCount ||
    value.completeSlotCountAfterExistingAcceptance !== 18 ||
    !Array.isArray(value.records) ||
    value.records.length !== args.expectedRecordCount ||
    !Array.isArray(value.exclusions) ||
    JSON.stringify(value.exclusions) !== JSON.stringify(expectedExclusions)
  ) {
    fail('historical accepted review corpus authority is invalid');
  }
  const records = new Map<string, HistoricalReviewCorpusRecord>();
  for (const entry of value.records) {
    const record = requireObject(entry, 'historical review corpus record');
    requireExactKeysInOrder(record, [
      'briefId',
      'slot',
      'companionId',
      'direction',
      'category',
      'textPageCount',
      'physicalPageCount',
      'storySha256',
      'reviewSha256',
      'normalizationActions',
      'source',
    ], 'historical review corpus record');
    const storyKey = requireString(record.slot, 'historical review corpus slot');
    const direction = requireString(
      record.direction,
      `${storyKey} historical direction`,
    ) as StoryDirection;
    const expectedPages = direction === 'bedtime'
      ? 8
      : direction === 'adventure'
        ? 12
        : direction === 'fantasy'
          ? 16
          : -1;
    if (
      !SAFE_STORY_KEY.test(storyKey) ||
      records.has(storyKey) ||
      requireString(record.briefId, `${storyKey} historical briefId`).length === 0 ||
      requireString(record.companionId, `${storyKey} historical companionId`).length === 0 ||
      typeof record.category !== 'string' ||
      expectedPages < 0 ||
      record.textPageCount !== expectedPages ||
      record.physicalPageCount !== expectedPages * 2
    ) {
      fail(`${storyKey} historical review corpus identity is invalid`);
    }
    requireSha256(record.storySha256, `${storyKey} historical story SHA-256`);
    requireSha256(record.reviewSha256, `${storyKey} historical review SHA-256`);
    if (
      !Array.isArray(record.normalizationActions) ||
      record.normalizationActions.some((item) => {
        if (!isObject(item)) return true;
        if (!exactKeys(item, ['code', 'lineCount'])) return true;
        return typeof item.code !== 'string' ||
          item.code.length === 0 ||
          !Number.isSafeInteger(item.lineCount) ||
          Number(item.lineCount) <= 0;
      })
    ) {
      fail(`${storyKey} historical normalization actions are invalid`);
    }
    const source = requireObject(record.source, `${storyKey} historical source`);
    requireExactKeysInOrder(source, [
      'root',
      'pipelineVersion',
      'repoHead',
      'manifestSha256',
      'waveStatus',
      'storySha256',
      'logicalProviderCalls',
      'actualCostUsd',
      'transportRetries',
      'fallbackUsed',
      'selectedOptionId',
      'revisionCount',
    ], `${storyKey} historical source`);
    const sourceRoot = requireString(source.root, `${storyKey} historical source root`);
    if (
      !canonicalRelativePath(sourceRoot) ||
      !sourceRoot.startsWith('outputs/') ||
      typeof source.pipelineVersion !== 'string' ||
      !/^small-heroes-autonomous-story-batch\/v[1-3]$/.test(source.pipelineVersion) ||
      !['machine_qualified', 'in_progress'].includes(String(source.waveStatus)) ||
      !Number.isSafeInteger(source.logicalProviderCalls) ||
      Number(source.logicalProviderCalls) < 0 ||
      typeof source.actualCostUsd !== 'number' ||
      !Number.isFinite(source.actualCostUsd) ||
      source.actualCostUsd < 0 ||
      source.transportRetries !== 0 ||
      source.fallbackUsed !== false ||
      !['A', 'B', 'C'].includes(String(source.selectedOptionId)) ||
      !Number.isSafeInteger(source.revisionCount) ||
      Number(source.revisionCount) < 0
    ) {
      fail(`${storyKey} historical source provenance is invalid`);
    }
    requireGitSha(source.repoHead, `${storyKey} historical source repoHead`);
    requireSha256(source.manifestSha256, `${storyKey} historical manifest SHA-256`);
    requireSha256(source.storySha256, `${storyKey} historical upstream story SHA-256`);
    records.set(storyKey, record as unknown as HistoricalReviewCorpusRecord);
  }
  if (records.size !== args.expectedRecordCount) {
    fail('historical accepted review corpus identities are incomplete');
  }
  return { file, records };
}

function loadHistoricalAcceptance(args: {
  repoRoot: string;
  relativePath: string;
  cache: Map<string, ValidatedHistoricalAcceptance>;
}): ValidatedHistoricalAcceptance {
  const cached = args.cache.get(args.relativePath);
  if (cached) return cached;
  const file = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: args.relativePath,
    allowedRoot: PRODUCT_ACCEPTANCE_ROOT,
    label: 'historical product acceptance',
  });
  requireLegacyPrettyJsonBytes(file, 'historical product acceptance');
  const value = file.value;
  const version = value.version;
  const isIndividual = version === INDIVIDUAL_PRODUCT_ACCEPTANCE_VERSION;
  const isCorpus = version === CORPUS_PRODUCT_ACCEPTANCE_VERSION;
  if (!isIndividual && !isCorpus) {
    fail('historical product acceptance version is unsupported');
  }
  const topKeys = isIndividual
    ? [
        'version',
        'status',
        'briefId',
        'acceptedBy',
        'acceptedOn',
        'acceptanceScope',
        'storySha256',
        'editorialReviewSha256',
        'independentArtifactAudit',
        'decision',
        'exclusions',
      ]
    : [
        'version',
        'status',
        'acceptedBy',
        'acceptedOn',
        'acceptanceScope',
        'corpusManifestPath',
        'corpusManifestSha256',
        'recordCount',
        'independentArtifactAudit',
        'decision',
        'exclusions',
      ];
  requireExactKeysInOrder(value, topKeys, 'historical product acceptance');
  const acceptedOn = requireString(value.acceptedOn, 'historical acceptance date');
  const exclusions = value.exclusions;
  if (
    value.status !== 'accepted' ||
    value.acceptanceScope !== 'story_text_only' ||
    value.acceptedBy !== 'Guy' ||
    !isoCalendarDate(acceptedOn) ||
    typeof value.decision !== 'string' ||
    value.decision.trim().length === 0 ||
    !Array.isArray(exclusions) ||
    exclusions.some((item) => typeof item !== 'string')
  ) {
    fail('historical product acceptance metadata is invalid');
  }
  const audit = requireObject(
    value.independentArtifactAudit,
    'historical product acceptance audit',
  );
  validatePassAudit(
    audit,
    isCorpus
      ? ['status', 'reviewedBase', 'reviewedHead', 'blocker', 'major', 'minor']
      : ['status', 'reviewedHead', 'blocker', 'major', 'minor'],
    'historical product acceptance audit',
  );
  let result: ValidatedHistoricalAcceptance;
  if (isIndividual) {
    result = {
      file,
      version,
      audit,
      exclusions: exclusions as string[],
      individual: {
        briefId: requireString(value.briefId, 'individual acceptance briefId'),
        storySha256: requireSha256(
          value.storySha256,
          'individual acceptance story SHA-256',
        ),
        editorialReviewSha256: requireSha256(
          value.editorialReviewSha256,
          'individual acceptance editorial SHA-256',
        ),
      },
    };
  } else {
    const corpusPath = requireString(
      value.corpusManifestPath,
      'historical accepted corpus path',
    );
    const corpusSha256 = requireSha256(
      value.corpusManifestSha256,
      'historical accepted corpus SHA-256',
    );
    const recordCount = requireSafeInteger(
      value.recordCount,
      'historical accepted corpus record count',
    );
    const corpus = validateHistoricalReviewCorpus({
      repoRoot: args.repoRoot,
      relativePath: corpusPath,
      expectedRawSha256: corpusSha256,
      expectedRecordCount: recordCount,
    });
    result = {
      file,
      version,
      audit,
      exclusions: exclusions as string[],
      corpus,
    };
  }
  args.cache.set(args.relativePath, result);
  return result;
}

function bindHistoricalAcceptanceForStory(args: {
  acceptance: ValidatedHistoricalAcceptance;
  acceptedRecord: Record<string, unknown>;
  acceptedStorySha256: string;
  editorialReviewSha256: string;
  storyKey: string;
  category: MvpCategory;
  direction: StoryDirection;
  companionId: string;
  pageCount: number;
  acceptedBy: unknown;
  acceptedOn: unknown;
}): StorySourceVisualDirectionReviewRecord['authorityChain']['productAcceptanceBinding'] {
  const { acceptance, acceptedRecord, storyKey } = args;
  if (
    acceptance.file.value.acceptedBy !== args.acceptedBy ||
    acceptance.file.value.acceptedOn !== args.acceptedOn
  ) {
    fail(`${storyKey} historical product acceptance reference drifted`);
  }
  const manifestAudit = requireObject(
    acceptedRecord.independentArtifactAudit,
    `${storyKey} accepted manifest audit`,
  );
  validatePassAudit(
    manifestAudit,
    ['status', 'reviewedHead', 'blocker', 'major', 'minor'],
    `${storyKey} accepted manifest audit`,
  );
  if (
    manifestAudit.reviewedHead !== acceptance.audit.reviewedHead ||
    !Array.isArray(acceptedRecord.excludedAuthorities) ||
    JSON.stringify(acceptedRecord.excludedAuthorities) !==
      JSON.stringify(acceptance.exclusions)
  ) {
    fail(`${storyKey} accepted manifest audit or exclusions drifted`);
  }
  if (acceptance.version === INDIVIDUAL_PRODUCT_ACCEPTANCE_VERSION) {
    if (
      !acceptance.individual ||
      acceptance.individual.briefId !== acceptedRecord.briefId ||
      acceptance.individual.storySha256 !== args.acceptedStorySha256 ||
      acceptance.individual.editorialReviewSha256 !== args.editorialReviewSha256
    ) {
      fail(`${storyKey} individual product acceptance binding drifted`);
    }
    return {
      kind: 'individual_story',
      version: INDIVIDUAL_PRODUCT_ACCEPTANCE_VERSION,
      storySha256: args.acceptedStorySha256,
      editorialReviewSha256: args.editorialReviewSha256,
    };
  }
  const corpus = acceptance.corpus;
  const record = corpus?.records.get(storyKey);
  if (
    !corpus ||
    !record ||
    record.briefId !== acceptedRecord.briefId ||
    record.companionId !== args.companionId ||
    record.direction !== args.direction ||
    record.category !== args.category ||
    record.textPageCount !== args.pageCount ||
    record.physicalPageCount !== args.pageCount * 2 ||
    record.storySha256 !== args.acceptedStorySha256 ||
    record.reviewSha256 !== args.editorialReviewSha256
  ) {
    fail(`${storyKey} corpus product acceptance membership drifted`);
  }
  return {
    kind: 'corpus',
    version: CORPUS_PRODUCT_ACCEPTANCE_VERSION,
    corpusManifest: corpus.file.descriptor,
    corpusRecordDigest: canonicalHash(record),
  };
}

function validateDirectionRecord(
  value: Record<string, unknown>,
  storyKey: string,
  pageCount: number,
): void {
  if (
    value.version !== STORYBOARD_RECORD_VERSION ||
    value.storyKey !== storyKey ||
    !Array.isArray(value.pages) ||
    value.pages.length !== pageCount
  ) {
    fail(`${storyKey} Visual Direction identity is invalid`);
  }
  const pageKeys = [
    'cameraAngle',
    'childPresence',
    'companionPresence',
    'continuityAnchors',
    'heroObject',
    'lighting',
    'mainAction',
    'pageNumber',
    'setting',
    'settingKey',
    'shotType',
    'supportingCharacters',
  ];
  value.pages.forEach((entry, index) => {
    const page = requireObject(entry, `${storyKey} direction page ${index + 1}`);
    if (
      !exactKeys(page, pageKeys) ||
      page.pageNumber !== index + 1 ||
      typeof page.settingKey !== 'string' ||
      !SAFE_STORY_KEY.test(page.settingKey) ||
      typeof page.setting !== 'string' ||
      /[\u0590-\u05ff{}]/u.test(page.setting) ||
      !DIRECTION_PRESENCE.has(String(page.childPresence)) ||
      !DIRECTION_PRESENCE.has(String(page.companionPresence)) ||
      !Array.isArray(page.supportingCharacters) ||
      page.supportingCharacters.some((item) => typeof item !== 'string') ||
      typeof page.mainAction !== 'string' ||
      (page.heroObject !== null && typeof page.heroObject !== 'string') ||
      !DIRECTION_SHOTS.has(String(page.shotType)) ||
      !DIRECTION_ANGLES.has(String(page.cameraAngle)) ||
      typeof page.lighting !== 'string' ||
      !Array.isArray(page.continuityAnchors) ||
      page.continuityAnchors.some((item) => typeof item !== 'string')
    ) {
      fail(`${storyKey} Visual Direction page coverage or shape is invalid`);
    }
  });
}

function directionSentence(value: string): string {
  const normalized = value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.]+$/u, '');
  return normalized ? `${normalized}.` : '';
}

function typedPageDirection(page: Record<string, unknown>): string {
  const supportingCharacters = page.supportingCharacters as string[];
  const continuityAnchors = page.continuityAnchors as string[];
  const heroObject = page.heroObject as string | null;
  const parts = [
    directionSentence(
      `${String(page.shotType).replace(/_/g, ' ')} shot, ${String(page.cameraAngle).replace(/_/g, ' ')} view, ${String(page.setting)}`,
    ),
    directionSentence(String(page.mainAction)),
    directionSentence(
      `Child ${String(page.childPresence)}; companion ${String(page.companionPresence)}`,
    ),
    supportingCharacters.length > 0
      ? directionSentence(
          `Supporting characters: ${supportingCharacters.join(', ')}`,
        )
      : '',
    heroObject
      ? directionSentence(`Hero object: ${heroObject}`)
      : '',
    directionSentence(`Lighting: ${String(page.lighting)}`),
    continuityAnchors.length > 0
      ? directionSentence(`Continuity: ${continuityAnchors.join('; ')}`)
      : '',
  ].filter(Boolean);
  const result = parts.join(' ');
  if (
    /\r|\n|[\u0590-\u05ff]|\{\{|\}\}/u.test(result) ||
    result.length > 1600
  ) {
    fail('typed Visual Direction cannot be serialized safely');
  }
  return result;
}

function projectIntegratedStory(args: {
  storyKey: string;
  text: string;
  expectedPageCount: number;
}): { bytes: Buffer; directions: string[] } {
  const everyDirectionLine = args.text.match(/^imageDirection:[^\r\n]*$/gm) ?? [];
  const directions: string[] = [];
  const pageNumbers: number[] = [];
  const binding = /^(--- Page (\d+) ---)((?:\r?\n){2})imageDirection: ([^\r\n]+)(\r?\n)/gm;
  const projected = args.text.replace(
    binding,
    (_whole, marker: string, pageNumber: string, markerSpacing: string, direction: string) => {
      pageNumbers.push(Number(pageNumber));
      directions.push(direction);
      return `${marker}${markerSpacing}`;
    },
  );
  if (
    everyDirectionLine.length !== args.expectedPageCount ||
    directions.length !== args.expectedPageCount ||
    pageNumbers.some((pageNumber, index) => pageNumber !== index + 1)
  ) {
    fail(`${args.storyKey} imageDirection placement or page binding is invalid`);
  }
  return { bytes: Buffer.from(projected, 'utf8'), directions };
}

function validateCandidateCompanionAuthority(args: {
  repoRoot: string;
  candidate: WizardQaStoryboardCandidate;
  storyKey: string;
}): StorySourceVisualDirectionReviewRecord['authorityChain']['companionAuthority'] {
  const authority = args.candidate.companionAuthority;
  if (
    authority.resemblanceThreshold !== WIZARD_QA_RESEMBLANCE_THRESHOLD ||
    authority.minimumResemblance < WIZARD_QA_RESEMBLANCE_THRESHOLD
  ) {
    fail(`${args.storyKey} companion resemblance authority is below 0.70`);
  }
  const manifest = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: authority.manifestPath,
    allowedRoot: `public/companions/${args.candidate.companionId}/style01-sheets`,
    label: `${args.storyKey} companion manifest`,
  });
  if (manifest.descriptor.canonicalDigest !== authority.manifestDigest) {
    fail(`${args.storyKey} companion manifest digest drifted`);
  }
  const views: BoundCompanionView[] = authority.views.map((view) => {
    const file = readStoryReviewBoundRegularFile({
      repoRoot: args.repoRoot,
      relativePath: view.path,
      allowedRoot: `public/companions/${args.candidate.companionId}/style01-sheets`,
      label: `${args.storyKey} companion ${view.kind} view`,
      maxBytes: MAX_IMAGE_BYTES,
    });
    if (
      file.descriptor.rawSha256 !== view.sha256 ||
      view.qaStatus !== 'passed' ||
      view.resemblanceToIdentity < WIZARD_QA_RESEMBLANCE_THRESHOLD
    ) {
      fail(`${args.storyKey} companion view authority drifted`);
    }
    return {
      ...file.descriptor,
      kind: view.kind,
      qaStatus: 'passed',
      resemblanceToIdentity: view.resemblanceToIdentity,
    };
  });
  return {
    manifest: manifest.descriptor,
    minimumResemblance: authority.minimumResemblance,
    resemblanceThreshold: WIZARD_QA_RESEMBLANCE_THRESHOLD,
    views,
  };
}

function buildReviewRecord(args: {
  repoRoot: string;
  row: WizardAllStoryReadinessRecord;
  catalogRecord: WizardQaCatalogRecord;
  corpusRecord: StoryboardCorpusRecord;
  request: ReviewRequest;
  acceptanceCache: Map<string, ValidatedHistoricalAcceptance>;
}): StorySourceVisualDirectionReviewRecord {
  const { row, catalogRecord, corpusRecord } = args;
  const storyKey = row.storyKey;
  if (
    !SAFE_STORY_KEY.test(storyKey) ||
    row.qaAuthority.readyForLowStoryGeneration !== true ||
    row.qaAuthority.resemblanceThreshold !== WIZARD_QA_RESEMBLANCE_THRESHOLD ||
    (row.qaAuthority.companionMinimumResemblance ?? 0) <
      WIZARD_QA_RESEMBLANCE_THRESHOLD ||
    !row.sources.qaLowOnly.available ||
    !row.sources.qaLowOnly.identity ||
    !row.sources.qaLowOnly.rawSha256 ||
    !row.qaTextReadiness
  ) {
    fail(`${storyKey} is not a complete QA review candidate`);
  }
  if (
    catalogRecord.storyKey !== storyKey ||
    catalogRecord.category !== row.category ||
    catalogRecord.direction !== row.direction ||
    catalogRecord.companionId !== row.companionId ||
    corpusRecord.storyKey !== storyKey ||
    corpusRecord.category !== row.category ||
    corpusRecord.direction !== row.direction ||
    corpusRecord.companionId !== row.companionId ||
    corpusRecord.pageCount !== row.renderBeatCount
  ) {
    fail(`${storyKey} cross-authority identity mismatch`);
  }

  const v3Fallback = row.sources.v3ProductFallback;
  const expectedV3StoryPath = `${V3_PRODUCT_STORY_ROOT}/${storyKey}.md`;
  const expectedV3SidecarPath = `${V3_PRODUCT_STORY_ROOT}/${storyKey}.import.json`;
  if (
    v3Fallback.role !== 'v3_product_fallback' ||
    v3Fallback.available !== true ||
    v3Fallback.path !== expectedV3StoryPath ||
    v3Fallback.importSidecarPath !== expectedV3SidecarPath ||
    v3Fallback.importSidecarValid !== true ||
    !v3Fallback.identity ||
    !v3Fallback.rawSha256 ||
    !v3Fallback.importSidecarDigest
  ) {
    fail(`${storyKey} V3 product fallback evidence is incomplete`);
  }
  const v3StoryFile = readStoryReviewBoundRegularFile({
    repoRoot: args.repoRoot,
    relativePath: expectedV3StoryPath,
    allowedRoot: V3_PRODUCT_STORY_ROOT,
    label: `${storyKey} V3 product fallback story`,
    maxBytes: MAX_STORY_BYTES,
  });
  const v3NormalizedDigest = normalizedTextDigest(v3StoryFile.bytes.toString('utf8'));
  if (
    v3StoryFile.descriptor.rawSha256 !== v3Fallback.rawSha256 ||
    v3NormalizedDigest !== v3Fallback.identity.digest ||
    v3Fallback.identity.path !== expectedV3StoryPath ||
    v3Fallback.identity.pageCount !== row.renderBeatCount
  ) {
    fail(`${storyKey} V3 product fallback bytes drifted`);
  }
  const v3SidecarFile = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: expectedV3SidecarPath,
    allowedRoot: V3_PRODUCT_STORY_ROOT,
    label: `${storyKey} V3 product fallback sidecar`,
  });
  if (v3SidecarFile.descriptor.canonicalDigest !== v3Fallback.importSidecarDigest) {
    fail(`${storyKey} V3 product fallback sidecar drifted`);
  }

  const expectedCandidatePath = `${QA_CANDIDATE_ROOT}/${storyKey}.json`;
  if (
    catalogRecord.candidatePath !== expectedCandidatePath ||
    row.qaAuthority.candidatePath !== expectedCandidatePath ||
    catalogRecord.candidateDigest !== row.qaAuthority.candidateDigest
  ) {
    fail(`${storyKey} QA candidate locator drifted`);
  }
  const candidateFile = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: expectedCandidatePath,
    allowedRoot: QA_CANDIDATE_ROOT,
    label: `${storyKey} QA candidate`,
  });
  const candidateValue = candidateFile.value;
  if (
    candidateValue.version !== WIZARD_QA_CANDIDATE_VERSION ||
    candidateValue.productionEligible !== false ||
    candidateValue.storyKey !== storyKey ||
    candidateValue.category !== row.category ||
    candidateValue.direction !== row.direction ||
    candidateValue.companionId !== row.companionId ||
    candidateValue.digest !== digestWithoutDigest(candidateValue) ||
    candidateValue.digest !== catalogRecord.candidateDigest ||
    candidateFile.bytes.toString('utf8') !==
      compactCanonicalJsonBytes(candidateValue)
  ) {
    fail(`${storyKey} QA candidate is invalid`);
  }
  const candidate = candidateValue as unknown as WizardQaStoryboardCandidate;

  const sidecarPath = `${QA_BANK_ROOT}/${storyKey}.import.json`;
  const sidecarFile = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: sidecarPath,
    allowedRoot: QA_BANK_ROOT,
    label: `${storyKey} import sidecar`,
  });
  if (
    sidecarFile.descriptor.canonicalDigest !== candidate.importSidecarDigest ||
    sidecarFile.descriptor.rawSha256 !== corpusRecord.importSidecarSha256
  ) {
    fail(`${storyKey} import sidecar digest drifted`);
  }
  const sidecar = sidecarFile.value;
  if (
    sidecar.version !== 'story-bank-import/v4' ||
    sidecar.status !== 'qa_ready_for_low_story_generation' ||
    sidecar.authorityScope !== 'qa_only' ||
    sidecar.productionEligible !== false ||
    sidecar.storyKey !== storyKey ||
    sidecar.category !== row.category ||
    sidecar.direction !== row.direction ||
    sidecar.companionId !== row.companionId ||
    sidecar.pageCount !== row.renderBeatCount ||
    sidecar.physicalPageCount !== row.renderBeatCount * 2
  ) {
    fail(`${storyKey} import sidecar identity is invalid`);
  }
  const sidecarSource = requireObject(sidecar.source, `${storyKey} sidecar source`);
  const integrated = requireObject(
    sidecar.integratedStory,
    `${storyKey} integrated story`,
  );
  const sidecarDirection = requireObject(
    sidecar.visualDirections,
    `${storyKey} sidecar Visual Direction`,
  );

  const integratedPath = requireString(
    integrated.path,
    `${storyKey} integrated story path`,
  );
  if (
    integratedPath !== `${QA_BANK_ROOT}/${storyKey}.md` ||
    integratedPath !== catalogRecord.storySourcePath ||
    integratedPath !== candidate.source.path ||
    integratedPath !== row.sources.qaLowOnly.path
  ) {
    fail(`${storyKey} integrated story locator drifted`);
  }
  const integratedFile = readStoryReviewBoundRegularFile({
    repoRoot: args.repoRoot,
    relativePath: integratedPath,
    allowedRoot: QA_BANK_ROOT,
    label: `${storyKey} QA integrated story`,
    maxBytes: MAX_STORY_BYTES,
  });
  if (
    integratedFile.descriptor.rawSha256 !==
      requireSha256(integrated.sha256, `${storyKey} integrated SHA-256`) ||
    integratedFile.descriptor.rawSha256 !== corpusRecord.integratedStorySha256 ||
    integratedFile.descriptor.rawSha256 !== row.sources.qaLowOnly.rawSha256
  ) {
    fail(`${storyKey} integrated story raw bytes drifted`);
  }
  const normalizedDigest = normalizedTextDigest(
    integratedFile.bytes.toString('utf8'),
  );
  if (
    normalizedDigest !== candidate.source.digest ||
    normalizedDigest !== catalogRecord.storySourceDigest ||
    normalizedDigest !== row.sources.qaLowOnly.identity.digest
  ) {
    fail(`${storyKey} normalized Story Source identity drifted`);
  }
  const integratedText = integratedFile.bytes.toString('utf8');
  const projection = projectIntegratedStory({
    storyKey,
    text: integratedText,
    expectedPageCount: row.renderBeatCount,
  });
  const projectedBytes = projection.bytes;
  const projectedSha256 = sha256(projectedBytes);
  if (
    projectedSha256 !== requireSha256(
      integrated.sourceProjectionSha256,
      `${storyKey} source projection SHA-256`,
    ) ||
    projectedSha256 !== requireSha256(
      sidecarSource.storySha256,
      `${storyKey} accepted source SHA-256`,
    ) ||
    projectedSha256 !== corpusRecord.sourceStorySha256
  ) {
    fail(`${storyKey} source projection is invalid`);
  }

  const acceptedManifestPath = requireString(
    sidecarSource.acceptedManifestPath,
    `${storyKey} accepted manifest path`,
  );
  const expectedAcceptedRoot = `${ACCEPTED_SOURCE_ROOT}/${storyKey}`;
  if (acceptedManifestPath !== `${expectedAcceptedRoot}/manifest.json`) {
    fail(`${storyKey} accepted manifest locator drifted`);
  }
  const acceptedManifestFile = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: acceptedManifestPath,
    allowedRoot: expectedAcceptedRoot,
    label: `${storyKey} accepted source manifest`,
  });
  const acceptedManifest = acceptedManifestFile.value;
  requireLegacyPrettyJsonBytes(
    acceptedManifestFile,
    `${storyKey} accepted source manifest`,
  );
  requireExactKeysInOrder(acceptedManifest, [
    'version',
    'status',
    'authorityScope',
    'record',
  ], `${storyKey} accepted source manifest`);
  if (
    acceptedManifest.version !== ACCEPTED_SOURCE_MANIFEST_VERSION ||
    acceptedManifest.status !== 'product_accepted_story_source' ||
    acceptedManifest.authorityScope !== 'story_text_only'
  ) {
    fail(`${storyKey} accepted source manifest authority is invalid`);
  }
  const acceptedRecord = requireObject(
    acceptedManifest.record,
    `${storyKey} accepted source record`,
  );
  requireExactKeysInOrder(acceptedRecord, [
    'briefId',
    'companionId',
    'direction',
    'category',
    'textPageCount',
    'physicalPageCount',
    'story',
    'editorialReview',
    'productAcceptance',
    'independentArtifactAudit',
    'excludedAuthorities',
  ], `${storyKey} accepted source record`);
  if (
    typeof acceptedRecord.briefId !== 'string' ||
    acceptedRecord.briefId.length === 0 ||
    acceptedRecord.category !== row.category ||
    acceptedRecord.direction !== row.direction ||
    acceptedRecord.companionId !== row.companionId ||
    acceptedRecord.textPageCount !== row.renderBeatCount ||
    acceptedRecord.physicalPageCount !== row.renderBeatCount * 2
  ) {
    fail(`${storyKey} accepted source identity drifted`);
  }
  const acceptedStoryRef = requireObject(
    acceptedRecord.story,
    `${storyKey} accepted story reference`,
  );
  requireExactKeysInOrder(acceptedStoryRef, [
    'filename',
    'bytes',
    'sha256',
    'byteIdenticalToSource',
  ], `${storyKey} accepted story reference`);
  const acceptedStoryFilename = requireString(
    acceptedStoryRef.filename,
    `${storyKey} accepted story filename`,
  );
  if (acceptedStoryFilename !== 'story.md') {
    fail(`${storyKey} accepted story filename is invalid`);
  }
  const acceptedStoryFile = readStoryReviewBoundRegularFile({
    repoRoot: args.repoRoot,
    relativePath: `${expectedAcceptedRoot}/${acceptedStoryFilename}`,
    allowedRoot: expectedAcceptedRoot,
    label: `${storyKey} accepted story`,
    maxBytes: MAX_STORY_BYTES,
  });
  verifyDescriptor(acceptedStoryFile.descriptor, {
    bytes: acceptedStoryRef.bytes,
    sha256: acceptedStoryRef.sha256,
  }, `${storyKey} accepted story`);
  if (
    acceptedStoryRef.byteIdenticalToSource !== true ||
    !acceptedStoryFile.bytes.equals(projectedBytes)
  ) {
    fail(`${storyKey} accepted story is not byte-identical to QA projection`);
  }

  const editorialRef = requireObject(
    acceptedRecord.editorialReview,
    `${storyKey} editorial review reference`,
  );
  requireExactKeysInOrder(editorialRef, [
    'filename',
    'sourcePath',
    'bytes',
    'sha256',
    'verdict',
    'byteIdenticalToSource',
  ], `${storyKey} editorial review reference`);
  const editorialFilename = requireString(
    editorialRef.filename,
    `${storyKey} editorial review filename`,
  );
  if (editorialFilename !== 'editorial-review.json') {
    fail(`${storyKey} editorial review filename is invalid`);
  }
  const editorialSnapshot = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: `${expectedAcceptedRoot}/${editorialFilename}`,
    allowedRoot: expectedAcceptedRoot,
    label: `${storyKey} tracked editorial review snapshot`,
  });
  verifyDescriptor(editorialSnapshot.descriptor, {
    bytes: editorialRef.bytes,
    sha256: editorialRef.sha256,
  }, `${storyKey} tracked editorial review snapshot`);
  if (
    editorialRef.byteIdenticalToSource !== true ||
    editorialRef.verdict !== 'pass' ||
    editorialSnapshot.value.verdict !== 'pass'
  ) {
    fail(`${storyKey} historical editorial review is invalid`);
  }
  const upstreamReview = historicalReviewSourceProvenance({
    relativePath: requireString(
      editorialRef.sourcePath,
      `${storyKey} editorial upstream source`,
    ),
    expectedBytes: editorialSnapshot.descriptor.bytes,
    expectedRawSha256: editorialSnapshot.descriptor.rawSha256,
  });

  const acceptanceRef = requireObject(
    acceptedRecord.productAcceptance,
    `${storyKey} product acceptance reference`,
  );
  requireExactKeysInOrder(acceptanceRef, [
    'path',
    'bytes',
    'sha256',
    'acceptedBy',
    'acceptedOn',
  ], `${storyKey} product acceptance reference`);
  const acceptancePath = requireString(
    acceptanceRef.path,
    `${storyKey} product acceptance path`,
  );
  const acceptance = loadHistoricalAcceptance({
    repoRoot: args.repoRoot,
    relativePath: acceptancePath,
    cache: args.acceptanceCache,
  });
  const acceptanceFile = acceptance.file;
  verifyDescriptor(acceptanceFile.descriptor, {
    bytes: acceptanceRef.bytes,
    sha256: acceptanceRef.sha256,
  }, `${storyKey} historical product acceptance`);
  if (
    acceptanceRef.acceptedBy !== 'Guy' ||
    typeof acceptanceRef.acceptedOn !== 'string' ||
    !isoCalendarDate(acceptanceRef.acceptedOn)
  ) {
    fail(`${storyKey} historical product acceptance reference is invalid`);
  }
  const productAcceptanceBinding = bindHistoricalAcceptanceForStory({
    acceptance,
    acceptedRecord,
    acceptedStorySha256: acceptedStoryFile.descriptor.rawSha256,
    editorialReviewSha256: editorialSnapshot.descriptor.rawSha256,
    storyKey,
    category: row.category,
    direction: row.direction,
    companionId: row.companionId,
    pageCount: row.renderBeatCount,
    acceptedBy: acceptanceRef.acceptedBy,
    acceptedOn: acceptanceRef.acceptedOn,
  });

  const directionPath = requireString(
    sidecarDirection.path,
    `${storyKey} Visual Direction path`,
  );
  if (
    directionPath !== `${STORYBOARD_ROOT}/${storyKey}.visual-directions.json` ||
    directionPath !== candidate.visualDirections.path ||
    sidecarDirection.version !== STORYBOARD_RECORD_VERSION ||
    candidate.visualDirections.version !== STORYBOARD_RECORD_VERSION
  ) {
    fail(`${storyKey} Visual Direction locator drifted`);
  }
  const directionFile = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: directionPath,
    allowedRoot: STORYBOARD_ROOT,
    label: `${storyKey} Visual Direction`,
  });
  validateDirectionRecord(directionFile.value, storyKey, row.renderBeatCount);
  const directionPages = directionFile.value.pages as Array<Record<string, unknown>>;
  if (
    directionPages.some(
      (page, index) => typedPageDirection(page) !== projection.directions[index],
    )
  ) {
    fail(`${storyKey} embedded imageDirection text drifted from the typed record`);
  }
  if (
    directionFile.descriptor.rawSha256 !==
      requireSha256(sidecarDirection.sha256, `${storyKey} direction SHA-256`) ||
    directionFile.descriptor.rawSha256 !== candidate.visualDirections.digest ||
    directionFile.descriptor.rawSha256 !== catalogRecord.visualDirectionDigest ||
    directionFile.descriptor.rawSha256 !== corpusRecord.visualDirectionSha256 ||
    candidate.visualDirections.pageCount !== row.renderBeatCount
  ) {
    fail(`${storyKey} Visual Direction bytes drifted`);
  }

  const receiptPath = requireString(
    sidecarDirection.receiptPath,
    `${storyKey} Visual Direction receipt path`,
  );
  if (receiptPath !== `${STORYBOARD_ROOT}/${storyKey}.receipt.json`) {
    fail(`${storyKey} Visual Direction receipt locator drifted`);
  }
  const receiptFile = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: receiptPath,
    allowedRoot: STORYBOARD_ROOT,
    label: `${storyKey} Visual Direction receipt`,
  });
  if (
    receiptFile.descriptor.rawSha256 !== requireSha256(
      sidecarDirection.receiptSha256,
      `${storyKey} receipt SHA-256`,
    ) ||
    receiptFile.value.version !== DIRECTION_RECEIPT_VERSION ||
    receiptFile.value.storyKey !== storyKey ||
    receiptFile.value.sourceStorySha256 !==
      acceptedStoryFile.descriptor.rawSha256 ||
    receiptFile.value.store !== false ||
    receiptFile.value.transportRetries !== 0 ||
    receiptFile.value.fallbackUsed !== false
  ) {
    fail(`${storyKey} Visual Direction receipt is invalid`);
  }
  const receiptOutput = requireObject(
    receiptFile.value.output,
    `${storyKey} receipt output`,
  );
  if (
    receiptOutput.filename !==
      `visual-directions.${directionFile.descriptor.rawSha256}.json`
  ) {
    fail(`${storyKey} receipt output filename is invalid`);
  }
  verifyDescriptor(directionFile.descriptor, {
    bytes: receiptOutput.bytes,
    sha256: receiptOutput.sha256,
  }, `${storyKey} receipt-bound Visual Direction`);

  const companionAuthority = validateCandidateCompanionAuthority({
    repoRoot: args.repoRoot,
    candidate,
    storyKey,
  });
  const storySpecific =
    args.request.reviewRequirements.storySpecific[storyKey];
  const excludedLegacyAdjacentArtifactPaths = [
    row.legacyAdjacentArtifacts.visualContractTemplatePath,
    row.legacyAdjacentArtifacts.visualContractPath,
  ].filter((value): value is string => value !== null).sort(asciiCompare);
  const payload = {
    category: row.category,
    direction: row.direction,
    storyKey,
    companionId: row.companionId,
    pageCount: row.renderBeatCount,
    state: 'pending_exact_product_and_visual_review' as const,
    productionEligible: false as const,
    runtimeEligible: false as const,
    authorityChain: {
      v3ProductFallback: {
        story: {
          ...v3StoryFile.descriptor,
          normalizedDigestAlgorithm: 'sha256-normalized-utf8' as const,
          normalizedDigest: v3NormalizedDigest,
        },
        importSidecar: v3SidecarFile.descriptor,
      },
      acceptedManifest: acceptedManifestFile.descriptor,
      acceptedStory: acceptedStoryFile.descriptor,
      productAcceptance: acceptanceFile.descriptor,
      productAcceptanceBinding,
      editorialReview: {
        verdict: 'pass' as const,
        trackedSnapshot: editorialSnapshot.descriptor,
        upstreamSource: upstreamReview,
      },
      qaIntegratedStory: {
        ...integratedFile.descriptor,
        normalizedDigestAlgorithm: 'sha256-normalized-utf8' as const,
        normalizedDigest,
      },
      sourceProjection: {
        algorithm: 'remove-imageDirection-lines/v1' as const,
        imageDirectionLineCount: projection.directions.length,
        bytes: projectedBytes.length,
        rawSha256: projectedSha256,
        byteIdenticalToAcceptedStory: true as const,
      },
      importSidecar: sidecarFile.descriptor,
      qaCandidate: {
        ...candidateFile.descriptor,
        embeddedDigest: candidate.digest,
      },
      visualDirection: {
        ...directionFile.descriptor,
        version:
          STORYBOARD_RECORD_VERSION as typeof STORYBOARD_RECORD_VERSION,
        pageCount: row.renderBeatCount,
      },
      visualDirectionReceipt: receiptFile.descriptor,
      storyboardCorpusRecordDigest: canonicalHash(corpusRecord),
      companionAuthority,
    },
    readinessEvidence: {
      sourceAuditRecordDigest: canonicalHash(row),
      qaCandidateDigest: catalogRecord.candidateDigest,
      excludedLegacyAdjacentArtifactPaths,
    },
    narrationPreflight: {
      ...row.qaTextReadiness,
      status: 'automated_evidence_only_human_review_pending' as const,
    },
    reviewRequirements: {
      technical: 'pending_claude_code' as const,
      exactProductAndVisual: 'pending_guy' as const,
      storyQuality: storySpecific
        ? 'pending_claude_cowork' as const
        : 'not_required_by_current_request' as const,
    },
    exclusions: REQUIRED_EXCLUSIONS,
    effects: ZERO_EFFECTS,
    digestAlgorithm: 'canonical-json-sha256' as const,
  };
  return {
    ...payload,
    digest: canonicalHash(payload),
  };
}

function bindPreservedExistingStrictAuthority(args: {
  repoRoot: string;
  record: WizardAllStoryReadinessRecord;
  qaCompletenessRecordDigest: string;
}): StorySourceVisualDirectionReviewBatch['selection']['preservedExistingStrictAuthority'][number] {
  const { record } = args;
  const locatorPath =
    `${APPROVED_VISUAL_PACKAGE_ROOT}/${record.storyKey}.soft_hand_drawn_storybook.visual-package-current.json`;
  if (
    record.storyKey !== 'chameleon_koko_bedtime' ||
    record.sources.corpusDecisionRequired ||
    record.productionStages.acceptedSourceRevision !== true ||
    record.productionStages.approvedVisualPackage !== true ||
    record.productionStages.renderQualified !== true ||
    record.sources.acceptedProductRevisions.length !== 1 ||
    !record.packageAuthority.path ||
    !record.packageAuthority.revisionDigest
  ) {
    fail('preserved strict Chameleon authority is not healthy');
  }
  const locator = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: locatorPath,
    allowedRoot: APPROVED_VISUAL_PACKAGE_ROOT,
    label: 'preserved Chameleon package locator',
  });
  if (
    locator.value.version !== 'visual-package-current-locator/v3' ||
    locator.value.storyKey !== record.storyKey ||
    locator.value.styleId !== 'soft_hand_drawn_storybook' ||
    locator.value.packagePath !== record.packageAuthority.path ||
    locator.value.revisionDigest !== record.packageAuthority.revisionDigest
  ) {
    fail('preserved Chameleon package locator drifted');
  }
  const packageArtifact = readBoundJson({
    repoRoot: args.repoRoot,
    relativePath: record.packageAuthority.path,
    allowedRoot: `${APPROVED_VISUAL_PACKAGE_ROOT}/revisions`,
    label: 'preserved Chameleon Visual Package',
  });
  if (
    packageArtifact.value.storyKey !== record.storyKey ||
    packageArtifact.value.styleId !== 'soft_hand_drawn_storybook' ||
    packageArtifact.value.revisionDigest !== record.packageAuthority.revisionDigest
  ) {
    fail('preserved Chameleon Visual Package identity drifted');
  }
  return {
    storyKey: record.storyKey,
    sourceAuditRecordDigest: canonicalHash(record),
    acceptedRevisionDigests: record.sources.acceptedProductRevisions.map(
      (revision) => revision.authoringAuthorityDigest,
    ),
    packageRevisionDigest: record.packageAuthority.revisionDigest,
    qaCompletenessRecordDigest: args.qaCompletenessRecordDigest,
    locator: locator.descriptor,
    packageArtifact: packageArtifact.descriptor,
  };
}

function prepareOutputDirectory(repoRoot: string, relativeDirectory: string): string {
  if (
    !canonicalRelativePath(relativeDirectory) ||
    !relativeDirectory.startsWith('outputs/')
  ) {
    fail('output root must be a canonical repository-relative child of outputs/');
  }
  const root = path.resolve(repoRoot);
  validateDirectoryIdentity(root, 'repository root');
  const segments = relativeDirectory.split('/');
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    if (fs.existsSync(current)) {
      validateDirectoryIdentity(current, 'output directory');
    } else {
      fs.mkdirSync(current);
      validateDirectoryIdentity(current, 'created output directory');
    }
  }
  return current;
}

function readExistingOutput(destination: string, expectedBytes: string): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(destination);
  } catch {
    return false;
  }
  if (
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    stat.nlink !== 1 ||
    stat.size > MAX_JSON_BYTES ||
    !filesystemPathsEqual(fs.realpathSync(destination), destination)
  ) {
    fail('existing output is not a single-link regular file');
  }
  const existingBytes = fs.readFileSync(destination);
  const after = fs.lstatSync(destination);
  if (
    !after.isFile() ||
    after.nlink !== 1 ||
    after.size !== stat.size ||
    after.mtimeMs !== stat.mtimeMs ||
    after.ctimeMs !== stat.ctimeMs ||
    ('ino' in stat && after.ino !== stat.ino) ||
    existingBytes.length !== stat.size ||
    !filesystemPathsEqual(fs.realpathSync(destination), destination)
  ) {
    fail('existing output changed identity while it was read');
  }
  if (!existingBytes.equals(Buffer.from(expectedBytes, 'utf8'))) {
    fail('immutable output collision');
  }
  return true;
}

function writeImmutableReviewBatch(args: {
  repoRoot: string;
  outputRoot: string;
  filename: string;
  bytes: string;
}): { path: string; created: boolean } {
  const outputDirectory = prepareOutputDirectory(args.repoRoot, args.outputRoot);
  const destination = path.join(outputDirectory, args.filename);
  const relativePath = `${args.outputRoot}/${args.filename}`;
  if (readExistingOutput(destination, args.bytes)) {
    return { path: relativePath, created: false };
  }
  const temporary = path.join(
    outputDirectory,
    `.${args.filename}.${process.pid}.${randomUUID()}.tmp`,
  );
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, args.bytes, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    try {
      fs.linkSync(temporary, destination);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'EEXIST' &&
        readExistingOutput(destination, args.bytes)
      ) {
        return { path: relativePath, created: false };
      }
      throw error;
    }
    fs.unlinkSync(temporary);
    const finalStat = fs.lstatSync(destination);
    if (!finalStat.isFile() || finalStat.nlink !== 1) {
      fail('published output identity is invalid');
    }
    return { path: relativePath, created: true };
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function prepareStorySourceVisualDirectionReviewBatch(args: {
  repoRoot: string;
  requestPath?: string;
  outputRoot?: string;
  write?: boolean;
}): PreparedStorySourceVisualDirectionReviewBatch {
  const repoRoot = path.resolve(args.repoRoot);
  const requestPath =
    args.requestPath ?? DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_REQUEST_PATH;
  const requestFile = readBoundJson({
    repoRoot,
    relativePath: requestPath,
    allowedRoot: REQUEST_ROOT,
    label: 'review request',
  });
  const request = validateReviewRequest(requestFile);
  preflightPredictableAuthorityGraph(repoRoot);
  const { catalog, file: catalogFile } = validateQaCatalog({ repoRoot });
  const corpus = validateStoryboardCorpus({ repoRoot });
  const report = withCanonicalAuditEnvironment(() =>
    auditWizardAllStoryRenderReadinessForR3B0bReplay({
      repoRoot,
      now: () => new Date(`${request.authorizedOn}T12:00:00.000Z`),
    }),
  );
  if (
    report.version !== WIZARD_ALL_STORY_RENDER_READINESS_VERSION ||
    report.environment.v3ApprovedBankEnabled !== true ||
    report.environment.wizardQaCatalogEnabled !== false ||
    report.qaCatalogDigest !== catalog.digest ||
    report.summary.nominalSlotCount !== 18 ||
    report.records.length !== 18 ||
    !isCompleteMvpWizardStoryInventory({
      declaredSlotCount: report.summary.nominalSlotCount,
      storyKeys: report.records.map((record) => record.storyKey),
    })
  ) {
    fail('canonical readiness starting point is incomplete or drifted');
  }
  const reportByStory = new Map(
    report.records.map((record) => [record.storyKey, record]),
  );
  const selected = reviewBatchSelectionFromReport(report).map((storyKey) => {
    const record = reportByStory.get(storyKey);
    if (!record) fail(`${storyKey} disappeared from the readiness report`);
    return record;
  });
  const preserved = nominalReviewBatchStoryKeys()
    .filter((storyKey) => !selected.some((record) => record.storyKey === storyKey))
    .map((storyKey) => {
      const record = reportByStory.get(storyKey);
      if (!record) fail(`${storyKey} disappeared from the readiness report`);
      return record;
    });
  if (
    selected.length !== 17 ||
    new Set(selected.map((record) => record.storyKey)).size !== 17 ||
    preserved.length !== 1 ||
    preserved[0]?.storyKey !==
      request.decisions.preserveExistingStrictAuthority.storyKey
  ) {
    fail('readiness predicate did not yield the approved exact 17/1 split');
  }
  const fantasy = selected.filter((record) => record.direction === 'fantasy');
  if (
    fantasy.length !== request.decisions.fantasyFormat.requiredStoryCount ||
    fantasy.some(
      (record) =>
        record.renderBeatCount !==
        request.decisions.fantasyFormat.requiredPageCountPerStory,
    )
  ) {
    fail('the six approved 16-beat fantasy candidates were not preserved');
  }
  const catalogByStory = new Map(
    catalog.records.map((record) => [record.storyKey, record]),
  );
  if (catalogByStory.size !== 18 || corpus.records.size !== 18) {
    fail('QA authority inventories are incomplete');
  }
  const acceptanceCache = new Map<string, ValidatedHistoricalAcceptance>();
  const qaCompletenessRecords = nominalReviewBatchStoryKeys().map((storyKey) => {
    const row = reportByStory.get(storyKey);
    const catalogRecord = catalogByStory.get(storyKey);
    const corpusRecord = corpus.records.get(storyKey);
    if (!row) {
      fail(`${storyKey} is missing from the canonical readiness report`);
    }
    if (!catalogRecord || !corpusRecord) {
      fail(`${storyKey} is missing from a QA authority inventory`);
    }
    return buildReviewRecord({
      repoRoot,
      row,
      catalogRecord,
      corpusRecord,
      request,
      acceptanceCache,
    });
  });
  const qaCompletenessByStory = new Map(
    qaCompletenessRecords.map((record) => [record.storyKey, record]),
  );
  if (qaCompletenessByStory.size !== 18) {
    fail('strict QA completeness preflight did not bind all 18 slots');
  }
  const records = selected.map((row) => {
    const record = qaCompletenessByStory.get(row.storyKey);
    if (!record) fail(`${row.storyKey} disappeared after strict QA preflight`);
    return record;
  });
  const directionCounts: Record<StoryDirection, number> = {
    bedtime: records.filter((record) => record.direction === 'bedtime').length,
    adventure: records.filter((record) => record.direction === 'adventure').length,
    fantasy: records.filter((record) => record.direction === 'fantasy').length,
  };
  const payload = {
    version: STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_VERSION,
    status: 'pending_exact_product_and_visual_review' as const,
    authorityScope: 'review_candidates_only' as const,
    productionEligible: false as const,
    runtimeEligible: false as const,
    request: {
      artifact: requestFile.descriptor,
      version: STORY_SOURCE_VISUAL_DIRECTION_REVIEW_REQUEST_VERSION,
      digest: request.digest,
      authorizedBy: 'Guy' as const,
      authorizedOn: request.authorizedOn,
    },
    selection: {
      sourceRole: 'qa_low_only' as const,
      predicate: 'sources.corpusDecisionRequired === true' as const,
      sourceAudit: {
        version: WIZARD_ALL_STORY_RENDER_READINESS_VERSION,
        digest: report.digest,
      },
      qaCatalog: {
        ...catalogFile.descriptor,
        version: WIZARD_QA_CATALOG_VERSION,
        embeddedDigest: catalog.digest,
      },
      storyboardCorpus: {
        ...corpus.file.descriptor,
        version: STORYBOARD_CORPUS_VERSION as typeof STORYBOARD_CORPUS_VERSION,
        embeddedDigest: corpus.embeddedDigest,
      },
      nominalSlotCount: 18 as const,
      candidateCount: 17 as const,
      companionCount: new Set(records.map((record) => record.companionId)).size as 6,
      directionCounts,
      totalPageCount: records.reduce((total, record) => total + record.pageCount, 0),
      fantasy: {
        storyCount: 6 as const,
        pageCountPerStory: 16 as const,
      },
      preservedExistingStrictAuthority: preserved.map((record) =>
        bindPreservedExistingStrictAuthority({
          repoRoot,
          record,
          qaCompletenessRecordDigest:
            qaCompletenessByStory.get(record.storyKey)?.digest ??
            fail(`${record.storyKey} QA completeness record is missing`),
        }),
      ),
    },
    records,
    exclusions: REQUIRED_EXCLUSIONS,
    effects: ZERO_EFFECTS,
    digestAlgorithm: 'canonical-json-sha256' as const,
  };
  if (
    payload.selection.companionCount !== 6 ||
    directionCounts.bedtime !== 5 ||
    directionCounts.adventure !== 6 ||
    directionCounts.fantasy !== 6 ||
    payload.selection.totalPageCount !== 208
  ) {
    fail('selected batch shape is not the approved 5/6/6 and 208-beat corpus');
  }
  const batch: StorySourceVisualDirectionReviewBatch = {
    ...payload,
    digest: canonicalHash(payload),
  };
  const outputRoot =
    args.outputRoot ?? DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_OUTPUT_ROOT;
  if (
    !canonicalRelativePath(outputRoot) ||
    !outputRoot.startsWith('outputs/')
  ) {
    fail('output root must be a canonical repository-relative child of outputs/');
  }
  const artifactPath = `${outputRoot}/${batch.digest}.json`;
  if (args.write !== true) {
    return {
      batch,
      artifact: { path: artifactPath, created: false },
    };
  }
  const persisted = writeImmutableReviewBatch({
    repoRoot,
    outputRoot,
    filename: `${batch.digest}.json`,
    bytes: canonicalJsonBytes(batch),
  });
  return { batch, artifact: persisted };
}

export function verifyReviewBatchDeterminism(args: {
  repoRoot: string;
  requestPath?: string;
  outputRoot?: string;
}): StorySourceVisualDirectionReviewBatch {
  const first = prepareStorySourceVisualDirectionReviewBatch({
    ...args,
    write: false,
  }).batch;
  const second = prepareStorySourceVisualDirectionReviewBatch({
    ...args,
    write: false,
  }).batch;
  if (
    first.digest !== second.digest ||
    canonicalJsonBytes(first) !== canonicalJsonBytes(second)
  ) {
    fail('identical inputs did not produce a byte-identical review batch');
  }
  return first;
}

export function reviewBatchSelectionFromReport(
  report: Pick<WizardAllStoryRenderReadinessReport, 'records'>,
): string[] {
  return report.records
    .filter((record) => record.sources.corpusDecisionRequired)
    .map((record) => record.storyKey)
    .sort(asciiCompare);
}

export function nominalReviewBatchStoryKeys(): string[] {
  return allNominalMvpStorySlots()
    .map((slot) => slot.storyKey)
    .sort(asciiCompare);
}
