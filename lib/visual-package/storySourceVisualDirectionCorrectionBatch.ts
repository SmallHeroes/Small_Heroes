import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalHash, canonicalize } from '@/lib/canonical-json';

import {
  STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_VERSION,
  prepareStorySourceVisualDirectionReviewBatch,
  readStoryReviewBoundRegularFile,
  type StorySourceVisualDirectionReviewBatch,
  type StorySourceVisualDirectionReviewRecord,
} from './storySourceVisualDirectionReviewBatch';

export const STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_VERSION =
  'small-heroes-story-source-visual-direction-correction-plan/v1' as const;
export const STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_BATCH_VERSION =
  'small-heroes-story-source-visual-direction-correction-candidate-batch/v1' as const;
export const DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_PATH =
  'story-pipeline/04_approved_story_sources/review-requests/r3b1a-story-source-visual-direction-correction-plan.json' as const;
export const DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_OUTPUT_ROOT =
  'outputs/r3b1a-story-source-visual-direction-correction-candidates' as const;

const EXPECTED_REVIEW_BATCH_DIGEST =
  '7a8434c76f90bc96776909430e93fecb97f2c8a08800085d0ba3e55d7f97a143';
const EXPECTED_REVIEW_BATCH_RAW_SHA256 =
  '143ff1a7a0f67382ae5efce1deecf492761bb51809f7183cf6c8304c682d5a08';
const PLAN_ROOT = 'story-pipeline/04_approved_story_sources/review-requests';
const ACCEPTED_SOURCE_ROOT = 'story-pipeline/04_approved_story_sources/accepted';
const STORYBOARD_INPUT_ROOT = 'story-pipeline/05_storyboard_inputs';
const DECISION_GATE_PATH =
  'docs/ai-workflow/R3B1A_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_CANDIDATES_DECISION_GATE.md';
const EXPECTED_DECISION_GATE_BYTES = 10_131;
const EXPECTED_DECISION_GATE_SHA256 =
  'b8c8dd15e70e46f6df2a143f002576adf300c6fa57af972bbe872ecefa790374';
const CORRECTION_RECIPE_VERSION =
  'small-heroes-story-source-visual-direction-correction-recipe/v1' as const;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SAFE_STORY_KEY = /^[a-z][a-z0-9_]{2,95}$/;
const SAFE_BRIEF_ID = /^[a-z][a-z0-9_]{2,159}$/;
const MATERIALIZER_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const require = createRequire(import.meta.url);

interface TextReplacement {
  expectedCount: number;
  from: string;
  to: string;
}

interface DirectionReplacement extends TextReplacement {
  pageNumber: number;
  field:
    | 'cameraAngle'
    | 'continuityAnchors'
    | 'heroObject'
    | 'lighting'
    | 'mainAction'
    | 'setting'
    | 'shotType';
  itemIndex?: number;
}

export interface CorrectionContinuityIntent {
  version: 'small-heroes-story-visual-continuity-intent/v1';
  childWardrobeAuthority: 'frozen_visual_contract';
  childWardrobeTransitionPages: number[];
  companionAccessoryAuthority: 'canonical_companion_profile';
  companionAppearanceAuthority: 'frozen_companion_state';
  companionStateTransitionPages: number[];
}

interface WorldModeRecommendation {
  value: 'fantastical' | 'grounded' | 'grounded_with_visual_metaphor';
  authorityStatus: 'recommendation_only_pending_reviewer_decision';
  rationale: string;
}

interface UnresolvedCreativeSourceIssue {
  code: string;
  severity: 'hold' | 'review';
  pageNumbers: number[];
  evidence: string;
  requiredAction: string;
}

interface FileReference {
  path: string;
  sha256: string;
}

export interface StorySourceVisualDirectionCorrectionPlanRecord {
  storyKey: string;
  reviewRecordDigest: string;
  briefId: string;
  acceptedManifest: FileReference;
  acceptedStory: FileReference;
  visualDirection: FileReference;
  textReplacements: TextReplacement[];
  directionReplacements: DirectionReplacement[];
  continuityIntent: CorrectionContinuityIntent;
  worldModeRecommendation: WorldModeRecommendation;
  unresolvedCreativeSourceIssues: UnresolvedCreativeSourceIssue[];
}

export interface StorySourceVisualDirectionCorrectionPlan {
  version: typeof STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_VERSION;
  status: 'proposal_only_pending_exact_review';
  authorityScope: 'deterministic_correction_candidates_only';
  decisionGate: {
    path: typeof DECISION_GATE_PATH;
    bytes: typeof EXPECTED_DECISION_GATE_BYTES;
    sha256: typeof EXPECTED_DECISION_GATE_SHA256;
    authorizedBy: 'Guy';
    authorizedOn: '2026-09-03';
  };
  reviewBatch: {
    version: typeof STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_VERSION;
    digest: string;
    rawSha256: string;
  };
  storyboardCorpus: {
    path: string;
    sha256: string;
    digest: string;
  };
  records: StorySourceVisualDirectionCorrectionPlanRecord[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

interface MaterializerManifestOutput {
  filename: string;
  bytes: number;
  sha256: string;
  digest?: string;
}

interface MaterializerManifest {
  status: 'pending_exact_product_review';
  runtimeEligible?: never;
  productionEligible?: never;
  projections: {
    female: {
      proseByteIdenticalToPrevious: true;
      proseBytes: number;
      proseSha256: string;
    };
    male: { bytes: number; sha256: string };
  };
  outputs: {
    acceptedStoryCandidate: MaterializerManifestOutput;
    visualDirectionCandidate: MaterializerManifestOutput;
    integratedStoryCandidate: MaterializerManifestOutput;
    directionMigration: MaterializerManifestOutput & { digest: string };
  };
  invariants: {
    approved: false;
    providerCalls: 0;
    renders: 0;
    storageWrites: 0;
    databaseWrites: 0;
  };
  digest: string;
  [key: string]: unknown;
}

interface MaterializerResult {
  created: boolean;
  manifest: MaterializerManifest;
  files: {
    direction: string;
    integratedStory: string;
    manifest: string;
    migration: string;
    source: string;
  };
}

interface MaterializerModule {
  CORRECTION_DIRECTION_MIGRATION_VERSION: string;
  CORRECTION_MANIFEST_VERSION: string;
  CORRECTION_REQUEST_VERSION: string;
  applyDirectionReplacements: (
    record: VisualDirectionRecord,
    replacements: DirectionReplacement[],
  ) => VisualDirectionRecord;
  applyExactTextReplacements: (
    source: string,
    replacements: TextReplacement[],
    code: string,
  ) => string;
  buildStorySourceRevision: (args: {
    requestFile: MaterializerRequestFile;
    outputDir: string;
    write: boolean;
  }) => MaterializerResult;
  canonicalBytes: (value: unknown) => string;
  resolveProjection: (source: string, gender: 'boy' | 'girl') => string;
  sha256: (value: string | Buffer) => string;
  stripCanonicalSourceGenderLine: (
    source: string,
    expectedGender: 'female' | 'neutral',
  ) => string;
  validateRequest: (value: unknown) => MaterializerRequest;
}

interface DirectionIntegrationModule {
  injectDirections: (
    source: string,
    record: VisualDirectionRecord,
  ) => string;
}

interface EnrichmentModule {
  COMPOSITION_POLICY_VERSION: string;
  CONTINUITY_INTENT_VERSION: string;
  compositionMetrics: (record: VisualDirectionRecord) => CompositionMetrics;
  protectedAuthorityIssues: (
    record: VisualDirectionRecord,
    companionId: string,
    continuityIntent: CorrectionContinuityIntent,
  ) => string[];
  validateContinuityIntent: (
    value: unknown,
    pageCount: number,
  ) => CorrectionContinuityIntent;
}

interface VisualDirectionPage {
  pageNumber: number;
  shotType: string;
  cameraAngle: string;
  [key: string]: unknown;
}

interface VisualDirectionRecord {
  pages: VisualDirectionPage[];
  [key: string]: unknown;
}

interface CompositionMetrics {
  pageCount: number;
  widePageNumbers: number[];
  closeFocusPageNumbers: number[];
  distinctShotTypes: string[];
  distinctCameraAngles: string[];
  adjacentRepeatedPairs: Array<[number, number]>;
  maximumShotTypeRun: number;
}

interface MaterializerRequest {
  version: string;
  storyKey: string;
  briefId: string;
  source: {
    manifest: FileReference;
    story: FileReference;
  };
  visualDirections: {
    corpusManifest: FileReference & { digest: string };
    record: FileReference;
  };
  textReplacements: TextReplacement[];
  directionReplacements: DirectionReplacement[];
  reviewBatch: {
    version: typeof STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_VERSION;
    digest: string;
    recordDigest: string;
  };
}

interface MaterializerRequestFile {
  bytes: Buffer;
  relativePath: string;
  request: MaterializerRequest;
  sha256: string;
}

interface CandidateFileDescriptor {
  path: string;
  bytes: number;
  sha256: string;
}

interface CandidateOutputDescriptor {
  filename: string;
  bytes: number;
  sha256: string;
}

export interface StorySourceVisualDirectionCorrectionCandidateRecord {
  storyKey: string;
  category: string;
  direction: string;
  companionId: string;
  pageCount: number;
  reviewRecordDigest: string;
  status:
    | 'hold_before_exact_review'
    | 'pending_exact_product_and_visual_review';
  runtimeEligible: false;
  productionEligible: false;
  policies: {
    recipe: typeof CORRECTION_RECIPE_VERSION;
    materializerRequest: string;
    materializerManifest: string;
    directionMigration: string;
    composition: string;
    continuityIntent: string;
  };
  request: {
    identityPath: string;
    bytes: number;
    sha256: string;
    version: string;
    payload: MaterializerRequest;
  };
  candidateOutputs: {
    acceptedStory: CandidateOutputDescriptor;
    visualDirection: CandidateOutputDescriptor;
    integratedStory: CandidateOutputDescriptor;
    directionMigration: CandidateOutputDescriptor & { digest: string };
    manifest: CandidateOutputDescriptor;
  };
  sourceRevisionManifest: MaterializerManifest;
  invariants: {
    sourceGenderNeutral: true;
    femaleProseByteIdentical: true;
    boyProjectionResolved: true;
    girlProjectionResolved: true;
    visualDirectionShapeValid: true;
    compositionValid: true;
    singularEnglishGenderPronouns: 0;
  };
  composition: CompositionMetrics;
  continuityIntent: CorrectionContinuityIntent;
  protectedAuthorityIssues: string[];
  worldModeRecommendation: WorldModeRecommendation;
  unresolvedCreativeSourceIssues: UnresolvedCreativeSourceIssue[];
  narrationPreflight: StorySourceVisualDirectionReviewRecord['narrationPreflight'];
  reviewRequirements: StorySourceVisualDirectionReviewRecord['reviewRequirements'] & {
    narrationEar: 'pending_guy';
  };
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

const ZERO_EXTERNAL_EFFECTS = Object.freeze({
  acceptedSourcesRewritten: 0 as const,
  visualDirectionsRewritten: 0 as const,
  acceptancesCreated: 0 as const,
  publicationsCreated: 0 as const,
  runtimeActivations: 0 as const,
  networkCalls: 0 as const,
  providerCalls: 0 as const,
  imagesGenerated: 0 as const,
  audioGenerated: 0 as const,
  pdfsGenerated: 0 as const,
  databaseReads: 0 as const,
  databaseWrites: 0 as const,
  storageReads: 0 as const,
  storageWrites: 0 as const,
  ordersCreatedOrModified: 0 as const,
  maximumSpendUsd: 0 as const,
  resemblanceThresholdChanged: false as const,
  localArtifactScope: 'optional_content_addressed_ignored_output_only' as const,
});

const EXCLUSIONS = Object.freeze([
  'acceptance',
  'publication',
  'runtime_eligibility',
  'production_eligibility',
  'provider_calls',
  'image_render',
  'audio_render',
  'pdf_render',
  'package_or_locator',
  'deployment',
]);

export interface StorySourceVisualDirectionCorrectionCandidateBatch {
  version: typeof STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_BATCH_VERSION;
  status: 'pending_exact_product_visual_narration_and_technical_review';
  authorityScope: 'correction_candidates_only';
  runtimeEligible: false;
  productionEligible: false;
  plan: CandidateFileDescriptor & {
    version: typeof STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_VERSION;
    digest: string;
  };
  reviewBatch: {
    version: typeof STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_VERSION;
    digest: string;
    rawSha256: string;
  };
  policies: {
    recipe: typeof CORRECTION_RECIPE_VERSION;
    materializerRequest: string;
    materializerManifest: string;
    directionMigration: string;
    composition: string;
    continuityIntent: string;
  };
  summary: {
    candidateCount: 17;
    totalPageCount: 208;
    directionCounts: { bedtime: 5; adventure: 6; fantasy: 6 };
    neutralSourceCandidateCount: 17;
    femaleProseIdentityCount: 17;
    resolvedBoyProjectionCount: 17;
    resolvedGirlProjectionCount: 17;
    compositionValidCount: 17;
    singularEnglishGenderPronounCount: 0;
    holdRecordCount: number;
    pendingExactReviewRecordCount: number;
    unresolvedCreativeSourceIssueCount: number;
    protectedAuthorityIssueCount: number;
    criticalNarrationReviewItemCount: number;
    softNarrationReviewItemCount: number;
    narrationEarAcceptedCount: 0;
    strictRenderReadyCount: 0;
  };
  records: StorySourceVisualDirectionCorrectionCandidateRecord[];
  exclusions: readonly string[];
  effects: typeof ZERO_EXTERNAL_EFFECTS;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface PreparedStorySourceVisualDirectionCorrectionBatch {
  batch: StorySourceVisualDirectionCorrectionCandidateBatch;
  artifact: {
    path: string;
    created: boolean;
    fileCount: number;
  };
}

const materializer = require(
  '../../scripts/materialize-story-source-revision.cjs',
) as MaterializerModule;
const enrichment = require(
  '../../scripts/story-source-visual-direction-enrichment-lifecycle.cjs',
) as EnrichmentModule;
const directionIntegration = require(
  '../../scripts/story-bank-direction-integration.cjs',
) as DirectionIntegrationModule;

function fail(message: string): never {
  throw new Error(`story correction batch: ${message}`);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function correctionCanonicalJsonBytes(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) fail(`${label} must be an object`);
  return value;
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort().join('\0');
  const expected = [...keys].sort().join('\0');
  if (actual !== expected) fail(`${label} has an unexpected shape`);
}

function cleanText(value: unknown, maximum = 20_000): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.normalize('NFC') &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)
  );
}

function canonicalRelativePath(value: unknown): value is string {
  if (!cleanText(value, 512) || value.includes('\\') || value.startsWith('/')) {
    return false;
  }
  const parts = value.split('/');
  return (
    parts.length > 1 &&
    parts.every(
      (part) =>
        part.length > 0 &&
        part !== '.' &&
        part !== '..' &&
        !part.endsWith('.') &&
        !part.endsWith(' '),
    ) &&
    path.posix.normalize(value) === value
  );
}

function validateFileReference(
  value: unknown,
  allowedRoot: string,
  label: string,
): FileReference {
  const object = requireObject(value, label);
  requireExactKeys(object, ['path', 'sha256'], label);
  if (
    !canonicalRelativePath(object.path) ||
    !object.path.startsWith(`${allowedRoot}/`) ||
    typeof object.sha256 !== 'string' ||
    !SHA256_HEX.test(object.sha256)
  ) {
    fail(`${label} reference is invalid`);
  }
  return object as unknown as FileReference;
}

function validateReplacement(value: unknown, label: string): TextReplacement {
  const object = requireObject(value, label);
  requireExactKeys(object, ['expectedCount', 'from', 'to'], label);
  if (
    !Number.isSafeInteger(object.expectedCount) ||
    (object.expectedCount as number) < 1 ||
    (object.expectedCount as number) > 16 ||
    !cleanText(object.from) ||
    !cleanText(object.to) ||
    object.from === object.to
  ) {
    fail(`${label} is invalid`);
  }
  return object as unknown as TextReplacement;
}

function validateDirectionReplacement(
  value: unknown,
  pageCount: number,
  label: string,
): DirectionReplacement {
  const object = requireObject(value, label);
  const hasItemIndex = Object.prototype.hasOwnProperty.call(object, 'itemIndex');
  requireExactKeys(
    object,
    [
      'expectedCount',
      'field',
      'from',
      ...(hasItemIndex ? ['itemIndex'] : []),
      'pageNumber',
      'to',
    ],
    label,
  );
  const base = validateReplacement(
    {
      expectedCount: object.expectedCount,
      from: object.from,
      to: object.to,
    },
    label,
  );
  const allowedFields = new Set([
    'cameraAngle',
    'continuityAnchors',
    'heroObject',
    'lighting',
    'mainAction',
    'setting',
    'shotType',
  ]);
  if (
    !Number.isSafeInteger(object.pageNumber) ||
    (object.pageNumber as number) < 1 ||
    (object.pageNumber as number) > pageCount ||
    typeof object.field !== 'string' ||
    !allowedFields.has(object.field) ||
    (hasItemIndex &&
      (object.field !== 'continuityAnchors' ||
        !Number.isSafeInteger(object.itemIndex) ||
        (object.itemIndex as number) < 0 ||
        (object.itemIndex as number) > 31)) ||
    (!hasItemIndex && object.field === 'continuityAnchors')
  ) {
    fail(`${label} target is invalid`);
  }
  return { ...base, ...object } as unknown as DirectionReplacement;
}

function validateOrderedPages(
  value: unknown,
  pageCount: number,
  label: string,
): number[] {
  if (
    !Array.isArray(value) ||
    value.length > pageCount ||
    value.some(
      (pageNumber, index) =>
        !Number.isSafeInteger(pageNumber) ||
        pageNumber < 1 ||
        pageNumber > pageCount ||
        (index > 0 && pageNumber <= value[index - 1]),
    )
  ) {
    fail(`${label} is invalid`);
  }
  return value as number[];
}

function validateContinuityIntent(
  value: unknown,
  pageCount: number,
  label: string,
): CorrectionContinuityIntent {
  const object = requireObject(value, label);
  requireExactKeys(
    object,
    [
      'childWardrobeAuthority',
      'childWardrobeTransitionPages',
      'companionAccessoryAuthority',
      'companionAppearanceAuthority',
      'companionStateTransitionPages',
      'version',
    ],
    label,
  );
  validateOrderedPages(
    object.childWardrobeTransitionPages,
    pageCount,
    `${label}.childWardrobeTransitionPages`,
  );
  validateOrderedPages(
    object.companionStateTransitionPages,
    pageCount,
    `${label}.companionStateTransitionPages`,
  );
  try {
    return enrichment.validateContinuityIntent(object, pageCount);
  } catch {
    fail(`${label} does not satisfy the continuity contract`);
  }
}

function validateWorldModeRecommendation(
  value: unknown,
  label: string,
): WorldModeRecommendation {
  const object = requireObject(value, label);
  requireExactKeys(object, ['authorityStatus', 'rationale', 'value'], label);
  if (
    !['fantastical', 'grounded', 'grounded_with_visual_metaphor'].includes(
      String(object.value),
    ) ||
    object.authorityStatus !==
      'recommendation_only_pending_reviewer_decision' ||
    !cleanText(object.rationale, 2_000)
  ) {
    fail(`${label} is invalid`);
  }
  return object as unknown as WorldModeRecommendation;
}

function validateUnresolvedIssue(
  value: unknown,
  pageCount: number,
  label: string,
): UnresolvedCreativeSourceIssue {
  const object = requireObject(value, label);
  requireExactKeys(
    object,
    ['code', 'evidence', 'pageNumbers', 'requiredAction', 'severity'],
    label,
  );
  if (
    typeof object.code !== 'string' ||
    !/^[a-z][a-z0-9_]{2,95}$/.test(object.code) ||
    !['hold', 'review'].includes(String(object.severity)) ||
    !cleanText(object.evidence, 4_000) ||
    !cleanText(object.requiredAction, 4_000)
  ) {
    fail(`${label} is invalid`);
  }
  validateOrderedPages(object.pageNumbers, pageCount, `${label}.pageNumbers`);
  return object as unknown as UnresolvedCreativeSourceIssue;
}

function validatePlanRecord(
  value: unknown,
  pageCount: number,
  label: string,
): StorySourceVisualDirectionCorrectionPlanRecord {
  const object = requireObject(value, label);
  requireExactKeys(
    object,
    [
      'acceptedManifest',
      'acceptedStory',
      'briefId',
      'continuityIntent',
      'directionReplacements',
      'reviewRecordDigest',
      'storyKey',
      'textReplacements',
      'unresolvedCreativeSourceIssues',
      'visualDirection',
      'worldModeRecommendation',
    ],
    label,
  );
  if (
    typeof object.storyKey !== 'string' ||
    !SAFE_STORY_KEY.test(object.storyKey) ||
    typeof object.reviewRecordDigest !== 'string' ||
    !SHA256_HEX.test(object.reviewRecordDigest) ||
    typeof object.briefId !== 'string' ||
    !SAFE_BRIEF_ID.test(object.briefId) ||
    !Array.isArray(object.textReplacements) ||
    object.textReplacements.length < 1 ||
    object.textReplacements.length > 64 ||
    !Array.isArray(object.directionReplacements) ||
    object.directionReplacements.length > 32 ||
    !Array.isArray(object.unresolvedCreativeSourceIssues) ||
    object.unresolvedCreativeSourceIssues.length > 32
  ) {
    fail(`${label} is invalid`);
  }
  return {
    storyKey: object.storyKey,
    reviewRecordDigest: object.reviewRecordDigest,
    briefId: object.briefId,
    acceptedManifest: validateFileReference(
      object.acceptedManifest,
      ACCEPTED_SOURCE_ROOT,
      `${label}.acceptedManifest`,
    ),
    acceptedStory: validateFileReference(
      object.acceptedStory,
      ACCEPTED_SOURCE_ROOT,
      `${label}.acceptedStory`,
    ),
    visualDirection: validateFileReference(
      object.visualDirection,
      STORYBOARD_INPUT_ROOT,
      `${label}.visualDirection`,
    ),
    textReplacements: object.textReplacements.map((replacement, index) =>
      validateReplacement(replacement, `${label}.textReplacements[${index}]`),
    ),
    directionReplacements: object.directionReplacements.map(
      (replacement, index) =>
        validateDirectionReplacement(
          replacement,
          pageCount,
          `${label}.directionReplacements[${index}]`,
        ),
    ),
    continuityIntent: validateContinuityIntent(
      object.continuityIntent,
      pageCount,
      `${label}.continuityIntent`,
    ),
    worldModeRecommendation: validateWorldModeRecommendation(
      object.worldModeRecommendation,
      `${label}.worldModeRecommendation`,
    ),
    unresolvedCreativeSourceIssues: object.unresolvedCreativeSourceIssues.map(
      (issue, index) =>
        validateUnresolvedIssue(
          issue,
          pageCount,
          `${label}.unresolvedCreativeSourceIssues[${index}]`,
        ),
    ),
  };
}

export function validateStorySourceVisualDirectionCorrectionPlan(
  value: unknown,
  pageCountByStory: ReadonlyMap<string, number>,
): StorySourceVisualDirectionCorrectionPlan {
  const object = requireObject(value, 'correction plan');
  requireExactKeys(
    object,
    [
      'authorityScope',
      'decisionGate',
      'digest',
      'digestAlgorithm',
      'records',
      'reviewBatch',
      'status',
      'storyboardCorpus',
      'version',
    ],
    'correction plan',
  );
  const decisionGate = requireObject(object.decisionGate, 'decisionGate');
  requireExactKeys(
    decisionGate,
    ['authorizedBy', 'authorizedOn', 'bytes', 'path', 'sha256'],
    'decisionGate',
  );
  const reviewBatch = requireObject(object.reviewBatch, 'reviewBatch');
  requireExactKeys(
    reviewBatch,
    ['digest', 'rawSha256', 'version'],
    'reviewBatch',
  );
  const storyboardCorpus = requireObject(
    object.storyboardCorpus,
    'storyboardCorpus',
  );
  requireExactKeys(
    storyboardCorpus,
    ['digest', 'path', 'sha256'],
    'storyboardCorpus',
  );
  if (
    object.version !== STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_VERSION ||
    object.status !== 'proposal_only_pending_exact_review' ||
    object.authorityScope !== 'deterministic_correction_candidates_only' ||
    decisionGate.path !== DECISION_GATE_PATH ||
    decisionGate.bytes !== EXPECTED_DECISION_GATE_BYTES ||
    decisionGate.sha256 !== EXPECTED_DECISION_GATE_SHA256 ||
    decisionGate.authorizedBy !== 'Guy' ||
    decisionGate.authorizedOn !== '2026-09-03' ||
    reviewBatch.version !== STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_VERSION ||
    reviewBatch.digest !== EXPECTED_REVIEW_BATCH_DIGEST ||
    reviewBatch.rawSha256 !== EXPECTED_REVIEW_BATCH_RAW_SHA256 ||
    !canonicalRelativePath(storyboardCorpus.path) ||
    typeof storyboardCorpus.sha256 !== 'string' ||
    !SHA256_HEX.test(storyboardCorpus.sha256) ||
    typeof storyboardCorpus.digest !== 'string' ||
    !SHA256_HEX.test(storyboardCorpus.digest) ||
    !Array.isArray(object.records) ||
    object.records.length !== 17 ||
    object.digestAlgorithm !== 'canonical-json-sha256' ||
    typeof object.digest !== 'string' ||
    !SHA256_HEX.test(object.digest)
  ) {
    fail('correction plan header is invalid');
  }
  const records = object.records.map((record, index) => {
    const candidate = requireObject(record, `records[${index}]`);
    const storyKey = candidate.storyKey;
    if (typeof storyKey !== 'string') fail(`records[${index}] storyKey is invalid`);
    const pageCount = pageCountByStory.get(storyKey);
    if (!pageCount) fail(`records[${index}] does not bind a reviewed story`);
    return validatePlanRecord(record, pageCount, `records[${index}]`);
  });
  const storyKeys = records.map((record) => record.storyKey);
  const sorted = [...storyKeys].sort(asciiCompare);
  if (
    new Set(storyKeys).size !== 17 ||
    storyKeys.some((storyKey, index) => storyKey !== sorted[index])
  ) {
    fail('correction plan records must be the 17 unique ASCII-sorted stories');
  }
  const { digest: _digest, ...payload } = object;
  if (canonicalHash(payload) !== object.digest) {
    fail('correction plan digest is invalid');
  }
  return { ...object, records } as unknown as StorySourceVisualDirectionCorrectionPlan;
}

function asciiCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function loadCorrectionPlan(args: {
  repoRoot: string;
  relativePath: string;
  reviewBatch: StorySourceVisualDirectionReviewBatch;
}): {
  plan: StorySourceVisualDirectionCorrectionPlan;
  bytes: Buffer;
  sha256: string;
} {
  const file = readStoryReviewBoundRegularFile({
    repoRoot: args.repoRoot,
    relativePath: args.relativePath,
    allowedRoot: PLAN_ROOT,
    label: 'R3-B1a correction plan',
    maxBytes: 2 * 1024 * 1024,
  });
  let value: unknown;
  try {
    value = JSON.parse(file.bytes.toString('utf8')) as unknown;
  } catch {
    fail('correction plan JSON is invalid');
  }
  if (file.bytes.toString('utf8') !== correctionCanonicalJsonBytes(value)) {
    fail('correction plan bytes are not canonical pretty JSON');
  }
  const pageCountByStory = new Map(
    args.reviewBatch.records.map((record) => [record.storyKey, record.pageCount]),
  );
  return {
    plan: validateStorySourceVisualDirectionCorrectionPlan(
      value,
      pageCountByStory,
    ),
    bytes: file.bytes,
    sha256: file.descriptor.rawSha256,
  };
}

function verifyDecisionGateBinding(repoRoot: string): void {
  const gate = readStoryReviewBoundRegularFile({
    repoRoot,
    relativePath: DECISION_GATE_PATH,
    allowedRoot: 'docs/ai-workflow',
    label: 'R3-B1a Decision Gate',
    maxBytes: 64 * 1024,
  });
  if (
    gate.bytes.length !== EXPECTED_DECISION_GATE_BYTES ||
    gate.descriptor.rawSha256 !== EXPECTED_DECISION_GATE_SHA256
  ) {
    fail('R3-B1a Decision Gate bytes drifted from the approved bound brief');
  }
}

function requireExactCurrentRepo(repoRoot: string): string {
  const resolved = path.resolve(repoRoot);
  let actual: string;
  let expected: string;
  try {
    actual = fs.realpathSync(resolved);
    expected = fs.realpathSync(MATERIALIZER_REPO_ROOT);
  } catch {
    fail('repository root is missing or unreadable');
  }
  if (!filesystemPathsEqual(actual, expected)) {
    fail('repository root does not match the bound materializer worktree');
  }
  return actual;
}

function filesystemPathsEqual(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function readBoundText(args: {
  repoRoot: string;
  reference: FileReference;
  allowedRoot: string;
  label: string;
  maxBytes: number;
}): Buffer {
  const file = readStoryReviewBoundRegularFile({
    repoRoot: args.repoRoot,
    relativePath: args.reference.path,
    allowedRoot: args.allowedRoot,
    label: args.label,
    maxBytes: args.maxBytes,
  });
  if (file.descriptor.rawSha256 !== args.reference.sha256) {
    fail(`${args.label} SHA-256 drifted`);
  }
  return file.bytes;
}

function buildMaterializerRequest(args: {
  plan: StorySourceVisualDirectionCorrectionPlan;
  record: StorySourceVisualDirectionCorrectionPlanRecord;
}): MaterializerRequest {
  return {
    version: materializer.CORRECTION_REQUEST_VERSION,
    storyKey: args.record.storyKey,
    briefId: args.record.briefId,
    source: {
      manifest: args.record.acceptedManifest,
      story: args.record.acceptedStory,
    },
    visualDirections: {
      corpusManifest: {
        path: args.plan.storyboardCorpus.path,
        sha256: args.plan.storyboardCorpus.sha256,
        digest: args.plan.storyboardCorpus.digest,
      },
      record: args.record.visualDirection,
    },
    textReplacements: args.record.textReplacements,
    directionReplacements: args.record.directionReplacements,
    reviewBatch: {
      version: STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_VERSION,
      digest: args.plan.reviewBatch.digest,
      recordDigest: args.record.reviewRecordDigest,
    },
  };
}

function assertProjectionResolved(value: string, label: string): void {
  if (
    /\{[^{}|]+\|[^{}|]+\}/u.test(value) ||
    /[\u0590-\u05FF]+\/[\u0590-\u05FF]+/u.test(value) ||
    value.includes('gender: female')
  ) {
    fail(`${label} remains unresolved`);
  }
}

function validateMaterializerOutputDescriptor(
  value: unknown,
  label: string,
  withDigest: boolean,
): MaterializerManifestOutput {
  const object = requireObject(value, label);
  requireExactKeys(
    object,
    ['bytes', ...(withDigest ? ['digest'] : []), 'filename', 'sha256'],
    label,
  );
  if (
    !Number.isSafeInteger(object.bytes) ||
    (object.bytes as number) < 1 ||
    (object.bytes as number) > 4 * 1024 * 1024 ||
    typeof object.filename !== 'string' ||
    path.posix.basename(object.filename) !== object.filename ||
    typeof object.sha256 !== 'string' ||
    !SHA256_HEX.test(object.sha256) ||
    (withDigest &&
      (typeof object.digest !== 'string' || !SHA256_HEX.test(object.digest)))
  ) {
    fail(`${label} is invalid`);
  }
  return object as unknown as MaterializerManifestOutput;
}

interface ExpectedMaterializerBindings {
  inputs: {
    acceptedManifest: { path: string; bytes: number; sha256: string };
    acceptedStory: { path: string; bytes: number; sha256: string };
    visualDirections: { path: string; bytes: number; sha256: string };
    storyboardCorpusManifest: {
      path: string;
      bytes: number;
      sha256: string;
      digest: string;
    };
  };
  revisedSource: string;
  revisedDirectionBytes: string;
  integratedStory: string;
  boyProjection: string;
  girlProjection: string;
  girlProseProjection: string;
}

export function validateStorySourceVisualDirectionCorrectionCandidateManifest(args: {
  manifest: unknown;
  files: MaterializerResult['files'];
  requestFile: MaterializerRequestFile;
  planRecord: StorySourceVisualDirectionCorrectionPlanRecord;
  expected: ExpectedMaterializerBindings;
}): MaterializerManifest {
  const expectedRequestBytes = Buffer.from(
    materializer.canonicalBytes(args.requestFile.request),
    'utf8',
  );
  if (
    !args.requestFile.bytes.equals(expectedRequestBytes) ||
    args.requestFile.sha256 !== materializer.sha256(expectedRequestBytes)
  ) {
    fail(`${args.planRecord.storyKey} materializer request identity is invalid`);
  }
  const manifest = requireObject(
    args.manifest,
    `${args.planRecord.storyKey} materializer manifest`,
  );
  requireExactKeys(
    manifest,
    [
      'authorityScope',
      'briefId',
      'digest',
      'inputs',
      'invariants',
      'metadataChanges',
      'outputs',
      'projections',
      'request',
      'reviewBatch',
      'sourceGenderMode',
      'status',
      'storyKey',
      'version',
    ],
    `${args.planRecord.storyKey} materializer manifest`,
  );
  const request = requireObject(manifest.request, 'materializer manifest request');
  requireExactKeys(request, ['bytes', 'path', 'sha256', 'version'], 'manifest request');
  const reviewBatch = requireObject(
    manifest.reviewBatch,
    'materializer manifest reviewBatch',
  );
  requireExactKeys(
    reviewBatch,
    ['digest', 'recordDigest', 'version'],
    'materializer manifest reviewBatch',
  );
  const inputs = requireObject(manifest.inputs, 'materializer manifest inputs');
  requireExactKeys(
    inputs,
    [
      'acceptedManifest',
      'acceptedStory',
      'storyboardCorpusManifest',
      'visualDirections',
    ],
    'materializer manifest inputs',
  );
  for (const [name, value] of Object.entries(inputs)) {
    const descriptor = requireObject(value, `manifest inputs.${name}`);
    requireExactKeys(
      descriptor,
      ['bytes', ...(name === 'storyboardCorpusManifest' ? ['digest'] : []), 'path', 'sha256'],
      `manifest inputs.${name}`,
    );
    if (
      !canonicalRelativePath(descriptor.path) ||
      !Number.isSafeInteger(descriptor.bytes) ||
      (descriptor.bytes as number) < 1 ||
      typeof descriptor.sha256 !== 'string' ||
      !SHA256_HEX.test(descriptor.sha256) ||
      (name === 'storyboardCorpusManifest' &&
        (typeof descriptor.digest !== 'string' ||
          !SHA256_HEX.test(descriptor.digest)))
    ) {
      fail(`manifest inputs.${name} is invalid`);
    }
  }
  if (
    materializer.canonicalBytes(inputs) !==
    materializer.canonicalBytes(args.expected.inputs)
  ) {
    fail(`${args.planRecord.storyKey} materializer input provenance is invalid`);
  }
  const outputs = requireObject(manifest.outputs, 'materializer manifest outputs');
  requireExactKeys(
    outputs,
    [
      'acceptedStoryCandidate',
      'directionMigration',
      'integratedStoryCandidate',
      'visualDirectionCandidate',
    ],
    'materializer manifest outputs',
  );
  const acceptedStory = validateMaterializerOutputDescriptor(
    outputs.acceptedStoryCandidate,
    'accepted story output',
    false,
  );
  const visualDirection = validateMaterializerOutputDescriptor(
    outputs.visualDirectionCandidate,
    'visual direction output',
    false,
  );
  const integratedStory = validateMaterializerOutputDescriptor(
    outputs.integratedStoryCandidate,
    'integrated story output',
    false,
  );
  const directionMigration = validateMaterializerOutputDescriptor(
    outputs.directionMigration,
    'direction migration output',
    true,
  ) as MaterializerManifestOutput & { digest: string };
  const projections = requireObject(
    manifest.projections,
    'materializer manifest projections',
  );
  requireExactKeys(projections, ['female', 'male'], 'manifest projections');
  const female = requireObject(projections.female, 'manifest female projection');
  const male = requireObject(projections.male, 'manifest male projection');
  requireExactKeys(
    female,
    [
      'byteIdenticalToPrevious',
      'bytes',
      'proseByteIdenticalToPrevious',
      'proseBytes',
      'proseSha256',
      'sha256',
    ],
    'manifest female projection',
  );
  requireExactKeys(male, ['bytes', 'sha256'], 'manifest male projection');
  const invariants = requireObject(
    manifest.invariants,
    'materializer manifest invariants',
  );
  requireExactKeys(
    invariants,
    [
      'approved',
      'databaseWrites',
      'editoriallyCanonical',
      'historicalInputsRewritten',
      'integratedSourceProjectionExact',
      'providerCalls',
      'renders',
      'storageWrites',
      'visualDirectionsValid',
    ],
    'materializer manifest invariants',
  );
  const expectedAcceptedStory = {
    bytes: Buffer.byteLength(args.expected.revisedSource, 'utf8'),
    sha256: materializer.sha256(args.expected.revisedSource),
  };
  const expectedVisualDirection = {
    bytes: Buffer.byteLength(args.expected.revisedDirectionBytes, 'utf8'),
    sha256: materializer.sha256(args.expected.revisedDirectionBytes),
  };
  const expectedIntegratedStory = {
    bytes: Buffer.byteLength(args.expected.integratedStory, 'utf8'),
    sha256: materializer.sha256(args.expected.integratedStory),
  };
  const migrationPayload = {
    version: materializer.CORRECTION_DIRECTION_MIGRATION_VERSION,
    status: 'pending_exact_review',
    authorityScope: 'deterministic_direction_text_migration_only',
    storyKey: args.planRecord.storyKey,
    sourceStorySha256: expectedAcceptedStory.sha256,
    previousDirectionSha256: args.planRecord.visualDirection.sha256,
    revisedDirectionSha256: expectedVisualDirection.sha256,
    replacements: args.planRecord.directionReplacements.map((replacement) => ({
      expectedCount: replacement.expectedCount,
      field: replacement.field,
      pageNumber: replacement.pageNumber,
    })),
    providerCalls: 0,
    transportRetries: 0,
    fallbackUsed: false,
  };
  const expectedMigrationDigest = materializer.sha256(
    materializer.canonicalBytes(migrationPayload),
  );
  const expectedMigrationBytes = materializer.canonicalBytes({
    ...migrationPayload,
    digest: expectedMigrationDigest,
  });
  const expectedGirlProjection = {
    bytes: Buffer.byteLength(args.expected.girlProjection, 'utf8'),
    sha256: materializer.sha256(args.expected.girlProjection),
    proseBytes: Buffer.byteLength(args.expected.girlProseProjection, 'utf8'),
    proseSha256: materializer.sha256(args.expected.girlProseProjection),
  };
  const expectedBoyProjection = {
    bytes: Buffer.byteLength(args.expected.boyProjection, 'utf8'),
    sha256: materializer.sha256(args.expected.boyProjection),
  };
  if (
    manifest.version !== materializer.CORRECTION_MANIFEST_VERSION ||
    manifest.status !== 'pending_exact_product_review' ||
    manifest.authorityScope !== 'story_source_and_visual_directions_only' ||
    manifest.storyKey !== args.planRecord.storyKey ||
    manifest.briefId !== args.planRecord.briefId ||
    manifest.sourceGenderMode !== 'neutral' ||
    JSON.stringify(manifest.metadataChanges) !==
      JSON.stringify([{ field: 'gender', from: 'female', to: 'neutral' }]) ||
    request.path !== args.requestFile.relativePath ||
    request.bytes !== args.requestFile.bytes.length ||
    request.sha256 !== args.requestFile.sha256 ||
    request.version !== materializer.CORRECTION_REQUEST_VERSION ||
    materializer.canonicalBytes(reviewBatch) !==
      materializer.canonicalBytes(args.requestFile.request.reviewBatch) ||
    female.byteIdenticalToPrevious !== false ||
    female.proseByteIdenticalToPrevious !== true ||
    female.bytes !== expectedGirlProjection.bytes ||
    female.sha256 !== expectedGirlProjection.sha256 ||
    female.proseBytes !== expectedGirlProjection.proseBytes ||
    female.proseSha256 !== expectedGirlProjection.proseSha256 ||
    male.bytes !== expectedBoyProjection.bytes ||
    male.sha256 !== expectedBoyProjection.sha256 ||
    invariants.historicalInputsRewritten !== false ||
    invariants.editoriallyCanonical !== true ||
    invariants.visualDirectionsValid !== true ||
    invariants.integratedSourceProjectionExact !== true ||
    invariants.approved !== false ||
    invariants.providerCalls !== 0 ||
    invariants.storageWrites !== 0 ||
    invariants.databaseWrites !== 0 ||
    invariants.renders !== 0 ||
    acceptedStory.bytes !== expectedAcceptedStory.bytes ||
    acceptedStory.sha256 !== expectedAcceptedStory.sha256 ||
    visualDirection.bytes !== expectedVisualDirection.bytes ||
    visualDirection.sha256 !== expectedVisualDirection.sha256 ||
    integratedStory.bytes !== expectedIntegratedStory.bytes ||
    integratedStory.sha256 !== expectedIntegratedStory.sha256 ||
    directionMigration.bytes !==
      Buffer.byteLength(expectedMigrationBytes, 'utf8') ||
    directionMigration.sha256 !== materializer.sha256(expectedMigrationBytes) ||
    directionMigration.digest !== expectedMigrationDigest ||
    acceptedStory.filename !== `${acceptedStory.sha256}.story.md` ||
    visualDirection.filename !==
      `${visualDirection.sha256}.visual-directions.json` ||
    integratedStory.filename !== `${integratedStory.sha256}.integrated.md` ||
    directionMigration.filename !==
      `${directionMigration.digest}.direction-migration.json` ||
    args.files.source !== acceptedStory.filename ||
    args.files.direction !== visualDirection.filename ||
    args.files.integratedStory !== integratedStory.filename ||
    args.files.migration !== directionMigration.filename ||
    typeof manifest.digest !== 'string' ||
    !SHA256_HEX.test(manifest.digest)
  ) {
    fail(`${args.planRecord.storyKey} materializer manifest is invalid`);
  }
  const { digest: _digest, ...manifestPayload } = manifest;
  if (
    materializer.sha256(materializer.canonicalBytes(manifestPayload)) !==
      manifest.digest ||
    args.files.manifest !== `${manifest.digest}.manifest.json`
  ) {
    fail(`${args.planRecord.storyKey} materializer manifest digest is invalid`);
  }
  return manifest as unknown as MaterializerManifest;
}

function buildCandidateRecord(args: {
  repoRoot: string;
  finalRoot: string;
  plan: StorySourceVisualDirectionCorrectionPlan;
  planRecord: StorySourceVisualDirectionCorrectionPlanRecord;
  reviewRecord: StorySourceVisualDirectionReviewRecord;
  storyboardCorpus: StorySourceVisualDirectionReviewBatch['selection']['storyboardCorpus'];
}): {
  record: StorySourceVisualDirectionCorrectionCandidateRecord;
} {
  const { planRecord, reviewRecord } = args;
  if (
    planRecord.reviewRecordDigest !== reviewRecord.digest ||
    planRecord.acceptedManifest.path !==
      reviewRecord.authorityChain.acceptedManifest.path ||
    planRecord.acceptedManifest.sha256 !==
      reviewRecord.authorityChain.acceptedManifest.rawSha256 ||
    planRecord.acceptedStory.path !== reviewRecord.authorityChain.acceptedStory.path ||
    planRecord.acceptedStory.sha256 !==
      reviewRecord.authorityChain.acceptedStory.rawSha256 ||
    planRecord.visualDirection.path !==
      reviewRecord.authorityChain.visualDirection.path ||
    planRecord.visualDirection.sha256 !==
      reviewRecord.authorityChain.visualDirection.rawSha256
  ) {
    fail(`${planRecord.storyKey} plan-to-review binding is invalid`);
  }

  const request = buildMaterializerRequest({ plan: args.plan, record: planRecord });
  try {
    materializer.validateRequest(request);
  } catch {
    fail(`${planRecord.storyKey} materializer request is invalid`);
  }
  const requestRelativePath = `${args.finalRoot}/records/${planRecord.storyKey}/request.json`;
  const requestBytes = Buffer.from(materializer.canonicalBytes(request), 'utf8');
  const requestFile: MaterializerRequestFile = {
    bytes: requestBytes,
    relativePath: requestRelativePath,
    request,
    sha256: materializer.sha256(requestBytes),
  };
  const candidateOutputRelative = `${args.finalRoot}/records/${planRecord.storyKey}/candidate`;
  const candidateOutputAbsolute = path.resolve(
    args.repoRoot,
    ...candidateOutputRelative.split('/'),
  );
  let materialized: MaterializerResult;
  try {
    materialized = materializer.buildStorySourceRevision({
      requestFile,
      outputDir: candidateOutputAbsolute,
      write: false,
    });
  } catch (error) {
    fail(
      `${planRecord.storyKey} materialization failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (materialized.created !== false) {
    fail(`${planRecord.storyKey} materializer escalated candidate authority`);
  }

  const sourceBytes = readBoundText({
    repoRoot: args.repoRoot,
    reference: planRecord.acceptedStory,
    allowedRoot: ACCEPTED_SOURCE_ROOT,
    label: `${planRecord.storyKey} accepted story`,
    maxBytes: 2 * 1024 * 1024,
  });
  const revisedSource = materializer.applyExactTextReplacements(
    sourceBytes.toString('utf8'),
    planRecord.textReplacements,
    'story_source_revision_text_target_invalid',
  );
  if (
    revisedSource.split('gender: neutral').length - 1 !== 1 ||
    revisedSource.includes('gender: female')
  ) {
    fail(`${planRecord.storyKey} source gender metadata is not exactly neutral`);
  }
  const boyProjection = materializer.resolveProjection(revisedSource, 'boy');
  const girlProjection = materializer.resolveProjection(revisedSource, 'girl');
  const girlProseProjection = materializer.stripCanonicalSourceGenderLine(
    girlProjection,
    'neutral',
  );
  assertProjectionResolved(boyProjection, `${planRecord.storyKey} boy projection`);
  assertProjectionResolved(girlProjection, `${planRecord.storyKey} girl projection`);

  const directionBytes = readBoundText({
    repoRoot: args.repoRoot,
    reference: planRecord.visualDirection,
    allowedRoot: STORYBOARD_INPUT_ROOT,
    label: `${planRecord.storyKey} visual direction`,
    maxBytes: 2 * 1024 * 1024,
  });
  let direction: VisualDirectionRecord;
  try {
    direction = JSON.parse(directionBytes.toString('utf8')) as VisualDirectionRecord;
  } catch {
    fail(`${planRecord.storyKey} visual direction JSON is invalid`);
  }
  const revisedDirection = materializer.applyDirectionReplacements(
    direction,
    planRecord.directionReplacements,
  );
  const revisedDirectionBytes = `${JSON.stringify(revisedDirection, null, 2)}\n`;
  const integratedStory = directionIntegration.injectDirections(
    revisedSource,
    revisedDirection,
  );
  let composition: CompositionMetrics;
  try {
    composition = enrichment.compositionMetrics(revisedDirection);
  } catch {
    fail(`${planRecord.storyKey} corrected composition is invalid`);
  }
  const protectedAuthorityIssues = enrichment.protectedAuthorityIssues(
    revisedDirection,
    reviewRecord.companionId,
    planRecord.continuityIntent,
  );
  const genderedPronouns = protectedAuthorityIssues.filter((issue) =>
    issue.endsWith('_gendered_pronoun'),
  );
  if (genderedPronouns.length > 0) {
    fail(`${planRecord.storyKey} corrected directions retain gendered pronouns`);
  }

  const materializerManifest =
    validateStorySourceVisualDirectionCorrectionCandidateManifest({
      manifest: materialized.manifest,
      files: materialized.files,
      requestFile,
      planRecord,
      expected: {
        inputs: {
          acceptedManifest: {
            path: reviewRecord.authorityChain.acceptedManifest.path,
            bytes: reviewRecord.authorityChain.acceptedManifest.bytes,
            sha256: reviewRecord.authorityChain.acceptedManifest.rawSha256,
          },
          acceptedStory: {
            path: reviewRecord.authorityChain.acceptedStory.path,
            bytes: reviewRecord.authorityChain.acceptedStory.bytes,
            sha256: reviewRecord.authorityChain.acceptedStory.rawSha256,
          },
          visualDirections: {
            path: reviewRecord.authorityChain.visualDirection.path,
            bytes: reviewRecord.authorityChain.visualDirection.bytes,
            sha256: reviewRecord.authorityChain.visualDirection.rawSha256,
          },
          storyboardCorpusManifest: {
            path: args.storyboardCorpus.path,
            bytes: args.storyboardCorpus.bytes,
            sha256: args.storyboardCorpus.rawSha256,
            digest: args.storyboardCorpus.embeddedDigest,
          },
        },
        revisedSource,
        revisedDirectionBytes,
        integratedStory,
        boyProjection,
        girlProjection,
        girlProseProjection,
      },
    });

  const outputDescriptors = materializerManifest.outputs;
  const candidateOutputs = {
    acceptedStory: {
      filename: materialized.files.source,
      bytes: outputDescriptors.acceptedStoryCandidate.bytes,
      sha256: outputDescriptors.acceptedStoryCandidate.sha256,
    },
    visualDirection: {
      filename: materialized.files.direction,
      bytes: outputDescriptors.visualDirectionCandidate.bytes,
      sha256: outputDescriptors.visualDirectionCandidate.sha256,
    },
    integratedStory: {
      filename: materialized.files.integratedStory,
      bytes: outputDescriptors.integratedStoryCandidate.bytes,
      sha256: outputDescriptors.integratedStoryCandidate.sha256,
    },
    directionMigration: {
      filename: materialized.files.migration,
      bytes: outputDescriptors.directionMigration.bytes,
      sha256: outputDescriptors.directionMigration.sha256,
      digest: outputDescriptors.directionMigration.digest,
    },
    manifest: {
      filename: materialized.files.manifest,
      bytes: Buffer.byteLength(
        materializer.canonicalBytes(materializerManifest),
        'utf8',
      ),
      sha256: materializer.sha256(
        materializer.canonicalBytes(materializerManifest),
      ),
    },
  };
  const status:
    | 'hold_before_exact_review'
    | 'pending_exact_product_and_visual_review' =
    planRecord.unresolvedCreativeSourceIssues.length > 0 ||
    protectedAuthorityIssues.length > 0
      ? 'hold_before_exact_review'
      : 'pending_exact_product_and_visual_review';
  const payload = {
    storyKey: planRecord.storyKey,
    category: reviewRecord.category,
    direction: reviewRecord.direction,
    companionId: reviewRecord.companionId,
    pageCount: reviewRecord.pageCount,
    reviewRecordDigest: reviewRecord.digest,
    status,
    runtimeEligible: false as const,
    productionEligible: false as const,
    policies: {
      recipe: CORRECTION_RECIPE_VERSION,
      materializerRequest: materializer.CORRECTION_REQUEST_VERSION,
      materializerManifest: materializer.CORRECTION_MANIFEST_VERSION,
      directionMigration: materializer.CORRECTION_DIRECTION_MIGRATION_VERSION,
      composition: enrichment.COMPOSITION_POLICY_VERSION,
      continuityIntent: enrichment.CONTINUITY_INTENT_VERSION,
    },
    request: {
      identityPath: requestRelativePath,
      bytes: requestBytes.length,
      sha256: requestFile.sha256,
      version: request.version,
      payload: request,
    },
    candidateOutputs,
    sourceRevisionManifest: materializerManifest,
    invariants: {
      sourceGenderNeutral: true as const,
      femaleProseByteIdentical: true as const,
      boyProjectionResolved: true as const,
      girlProjectionResolved: true as const,
      visualDirectionShapeValid: true as const,
      compositionValid: true as const,
      singularEnglishGenderPronouns: 0 as const,
    },
    composition,
    continuityIntent: planRecord.continuityIntent,
    protectedAuthorityIssues,
    worldModeRecommendation: planRecord.worldModeRecommendation,
    unresolvedCreativeSourceIssues: planRecord.unresolvedCreativeSourceIssues,
    narrationPreflight: reviewRecord.narrationPreflight,
    reviewRequirements: {
      ...reviewRecord.reviewRequirements,
      narrationEar: 'pending_guy' as const,
    },
    digestAlgorithm: 'canonical-json-sha256' as const,
  };
  const record: StorySourceVisualDirectionCorrectionCandidateRecord = {
    ...payload,
    digest: canonicalHash(payload),
  };
  return { record };
}

export function validateStorySourceVisualDirectionCorrectionPlanBindings(args: {
  batch: StorySourceVisualDirectionReviewBatch;
  plan: StorySourceVisualDirectionCorrectionPlan;
  reviewRawSha256: string;
}): void {
  if (
    args.batch.digest !== EXPECTED_REVIEW_BATCH_DIGEST ||
    args.reviewRawSha256 !== EXPECTED_REVIEW_BATCH_RAW_SHA256 ||
    args.plan.reviewBatch.digest !== args.batch.digest ||
    args.plan.reviewBatch.rawSha256 !== args.reviewRawSha256 ||
    args.plan.storyboardCorpus.path !== args.batch.selection.storyboardCorpus.path ||
    args.plan.storyboardCorpus.sha256 !==
      args.batch.selection.storyboardCorpus.rawSha256 ||
    args.plan.storyboardCorpus.digest !==
      args.batch.selection.storyboardCorpus.embeddedDigest ||
    args.batch.records.length !== 17 ||
    args.batch.selection.totalPageCount !== 208 ||
    args.batch.selection.directionCounts.bedtime !== 5 ||
    args.batch.selection.directionCounts.adventure !== 6 ||
    args.batch.selection.directionCounts.fantasy !== 6
  ) {
    fail('review-batch or storyboard-corpus binding is invalid');
  }
  const reviewKeys = args.batch.records.map((record) => record.storyKey);
  const planKeys = args.plan.records.map((record) => record.storyKey);
  if (
    reviewKeys.length !== planKeys.length ||
    reviewKeys.some((storyKey, index) => storyKey !== planKeys[index])
  ) {
    fail('correction plan membership differs from the exact review batch');
  }
  for (let index = 0; index < args.batch.records.length; index += 1) {
    const reviewRecord = args.batch.records[index];
    const planRecord = args.plan.records[index];
    if (
      !reviewRecord ||
      !planRecord ||
      planRecord.reviewRecordDigest !== reviewRecord.digest ||
      planRecord.acceptedManifest.path !==
        reviewRecord.authorityChain.acceptedManifest.path ||
      planRecord.acceptedManifest.sha256 !==
        reviewRecord.authorityChain.acceptedManifest.rawSha256 ||
      planRecord.acceptedStory.path !==
        reviewRecord.authorityChain.acceptedStory.path ||
      planRecord.acceptedStory.sha256 !==
        reviewRecord.authorityChain.acceptedStory.rawSha256 ||
      planRecord.visualDirection.path !==
        reviewRecord.authorityChain.visualDirection.path ||
      planRecord.visualDirection.sha256 !==
        reviewRecord.authorityChain.visualDirection.rawSha256
    ) {
      fail(`${planRecord?.storyKey ?? `record_${index}`} plan-to-review binding is invalid`);
    }
  }
}

function validateOutputRoot(value: string): void {
  if (!canonicalRelativePath(value) || !value.startsWith('outputs/')) {
    fail('output root must be a canonical repository-relative child of outputs/');
  }
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
    fail(`${label} is not a direct directory`);
  }
}

interface DirectoryIdentityFence {
  path: string;
  dev: number;
  ino: number;
}

interface CorrectionPublicationLock {
  assertOwned: () => void;
}

const CORRECTION_PUBLICATION_LOCK_FILENAME =
  '.r3b1a-story-source-correction-publication.lock';

function captureDirectoryIdentity(
  directory: string,
  label: string,
): DirectoryIdentityFence {
  validateDirectoryIdentity(directory, label);
  const stat = fs.lstatSync(directory);
  return { path: directory, dev: stat.dev, ino: stat.ino };
}

function assertDirectoryIdentity(
  identity: DirectoryIdentityFence,
  label: string,
): void {
  validateDirectoryIdentity(identity.path, label);
  const current = fs.lstatSync(identity.path);
  if (current.dev !== identity.dev || current.ino !== identity.ino) {
    fail(`${label} changed during the publication transaction`);
  }
}

function withCorrectionPublicationLock<T>(
  repoRoot: string,
  action: (lock: CorrectionPublicationLock) => T,
): T {
  const rootIdentity = captureDirectoryIdentity(repoRoot, 'repository root');
  const lockPath = path.join(repoRoot, CORRECTION_PUBLICATION_LOCK_FILENAME);
  let descriptor: number | null = null;
  let lockIdentity: fs.Stats | null = null;
  try {
    try {
      descriptor = fs.openSync(lockPath, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        fail('another correction publication transaction is active');
      }
      throw error;
    }
    const owner = Buffer.from(
      correctionCanonicalJsonBytes({
        pid: process.pid,
        token: randomUUID(),
        version: STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_BATCH_VERSION,
      }),
      'utf8',
    );
    fs.writeFileSync(descriptor, owner);
    fs.fsyncSync(descriptor);
    lockIdentity = fs.fstatSync(descriptor);
    const assertOwned = (): void => {
      assertDirectoryIdentity(rootIdentity, 'repository root');
      const current = fs.lstatSync(lockPath);
      if (
        current.isSymbolicLink() ||
        !current.isFile() ||
        current.nlink !== 1 ||
        current.dev !== lockIdentity?.dev ||
        current.ino !== lockIdentity?.ino ||
        !filesystemPathsEqual(fs.realpathSync(lockPath), lockPath)
      ) {
        fail('correction publication lock ownership was lost');
      }
    };
    assertOwned();
    const result = action({ assertOwned });
    assertOwned();
    return result;
  } finally {
    if (descriptor !== null) {
      try {
        if (lockIdentity) {
          const current = fs.lstatSync(lockPath);
          if (
            !current.isSymbolicLink() &&
            current.isFile() &&
            current.dev === lockIdentity.dev &&
            current.ino === lockIdentity.ino
          ) {
            fs.unlinkSync(lockPath);
          }
        }
      } finally {
        fs.closeSync(descriptor);
      }
    }
  }
}

function ensureOutputDirectory(repoRoot: string, relativePath: string): string {
  validateOutputRoot(relativePath);
  validateDirectoryIdentity(repoRoot, 'repository root');
  let current = repoRoot;
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) fs.mkdirSync(current);
    validateDirectoryIdentity(current, 'output directory');
  }
  return current;
}

function readExistingImmutableOutput(
  destination: string,
  expectedBytes: Buffer,
): boolean {
  let before: fs.Stats;
  try {
    before = fs.lstatSync(destination);
  } catch {
    return false;
  }
  if (
    before.isSymbolicLink() ||
    !before.isFile() ||
    before.nlink !== 1 ||
    before.size !== expectedBytes.length ||
    !filesystemPathsEqual(fs.realpathSync(destination), destination)
  ) {
    fail('existing candidate artifact identity is invalid');
  }
  const actual = fs.readFileSync(destination);
  const after = fs.lstatSync(destination);
  if (
    !after.isFile() ||
    after.nlink !== 1 ||
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs ||
    after.ctimeMs !== before.ctimeMs ||
    ('ino' in before && before.ino !== after.ino) ||
    !actual.equals(expectedBytes) ||
    !filesystemPathsEqual(fs.realpathSync(destination), destination)
  ) {
    fail('immutable candidate artifact collision');
  }
  return true;
}

function persistCandidateBatch(args: {
  repoRoot: string;
  outputRoot: string;
  filename: string;
  bytes: Buffer;
}): boolean {
  return withCorrectionPublicationLock(args.repoRoot, (lock) => {
    lock.assertOwned();
    const outputRoot = ensureOutputDirectory(args.repoRoot, args.outputRoot);
    const outputIdentity = captureDirectoryIdentity(outputRoot, 'output directory');
    const destination = path.join(outputRoot, args.filename);
    if (path.basename(destination) !== args.filename) {
      fail('candidate artifact filename is invalid');
    }
    if (readExistingImmutableOutput(destination, args.bytes)) {
      return false;
    }
    const temporary = path.join(
      outputRoot,
      `.${args.filename}.${process.pid}.${randomUUID()}.tmp`,
    );
    let descriptor: number | null = null;
    try {
      lock.assertOwned();
      assertDirectoryIdentity(outputIdentity, 'output directory');
      descriptor = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(descriptor, args.bytes);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
      lock.assertOwned();
      assertDirectoryIdentity(outputIdentity, 'output directory');
      try {
        fs.linkSync(temporary, destination);
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code === 'EEXIST' &&
          readExistingImmutableOutput(destination, args.bytes)
        ) {
          return false;
        }
        throw error;
      }
      lock.assertOwned();
      assertDirectoryIdentity(outputIdentity, 'output directory');
      fs.unlinkSync(temporary);
      if (!readExistingImmutableOutput(destination, args.bytes)) {
        fail('candidate artifact publication did not persist');
      }
      return true;
    } finally {
      if (descriptor !== null) fs.closeSync(descriptor);
      lock.assertOwned();
      assertDirectoryIdentity(outputIdentity, 'output directory');
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  });
}

export function prepareStorySourceVisualDirectionCorrectionBatch(args: {
  repoRoot: string;
  planPath?: string;
  outputRoot?: string;
  write?: boolean;
}): PreparedStorySourceVisualDirectionCorrectionBatch {
  const repoRoot = requireExactCurrentRepo(args.repoRoot);
  verifyDecisionGateBinding(repoRoot);
  const reviewBatch = prepareStorySourceVisualDirectionReviewBatch({
    repoRoot,
    write: false,
  }).batch;
  const reviewBytes = correctionCanonicalJsonBytes(reviewBatch);
  const reviewRawSha256 = sha256(reviewBytes);
  const planPath =
    args.planPath ?? DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_PATH;
  const loadedPlan = loadCorrectionPlan({
    repoRoot,
    relativePath: planPath,
    reviewBatch,
  });
  validateStorySourceVisualDirectionCorrectionPlanBindings({
    batch: reviewBatch,
    plan: loadedPlan.plan,
    reviewRawSha256,
  });
  const outputRoot =
    args.outputRoot ?? DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_OUTPUT_ROOT;
  validateOutputRoot(outputRoot);
  const policyIdentity = {
    recipe: CORRECTION_RECIPE_VERSION,
    materializerRequest: materializer.CORRECTION_REQUEST_VERSION,
    materializerManifest: materializer.CORRECTION_MANIFEST_VERSION,
    directionMigration: materializer.CORRECTION_DIRECTION_MIGRATION_VERSION,
    composition: enrichment.COMPOSITION_POLICY_VERSION,
    continuityIntent: enrichment.CONTINUITY_INTENT_VERSION,
  };
  const requestIdentityDigest = canonicalHash({
    planDigest: loadedPlan.plan.digest,
    policies: policyIdentity,
  });
  const requestIdentityRoot = `${outputRoot}/request-identities/${requestIdentityDigest}`;
  const reviewByStory = new Map(
    reviewBatch.records.map((record) => [record.storyKey, record]),
  );
  const records = loadedPlan.plan.records.map((planRecord) => {
    const reviewRecord = reviewByStory.get(planRecord.storyKey);
    if (!reviewRecord) fail(`${planRecord.storyKey} review record is missing`);
    const prepared = buildCandidateRecord({
      repoRoot,
      finalRoot: requestIdentityRoot,
      plan: loadedPlan.plan,
      planRecord,
      reviewRecord,
      storyboardCorpus: reviewBatch.selection.storyboardCorpus,
    });
    return prepared.record;
  });
  const holdRecordCount = records.filter(
    (record) => record.status === 'hold_before_exact_review',
  ).length;
  const batchPayload = {
    version: STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_BATCH_VERSION,
    status: 'pending_exact_product_visual_narration_and_technical_review' as const,
    authorityScope: 'correction_candidates_only' as const,
    runtimeEligible: false as const,
    productionEligible: false as const,
    plan: {
      path: planPath,
      bytes: loadedPlan.bytes.length,
      sha256: loadedPlan.sha256,
      version: loadedPlan.plan.version,
      digest: loadedPlan.plan.digest,
    },
    reviewBatch: {
      version: reviewBatch.version,
      digest: reviewBatch.digest,
      rawSha256: reviewRawSha256,
    },
    policies: policyIdentity,
    summary: {
      candidateCount: 17 as const,
      totalPageCount: 208 as const,
      directionCounts: {
        bedtime: 5 as const,
        adventure: 6 as const,
        fantasy: 6 as const,
      },
      neutralSourceCandidateCount: 17 as const,
      femaleProseIdentityCount: 17 as const,
      resolvedBoyProjectionCount: 17 as const,
      resolvedGirlProjectionCount: 17 as const,
      compositionValidCount: 17 as const,
      singularEnglishGenderPronounCount: 0 as const,
      holdRecordCount,
      pendingExactReviewRecordCount: 17 - holdRecordCount,
      unresolvedCreativeSourceIssueCount: records.reduce(
        (total, record) => total + record.unresolvedCreativeSourceIssues.length,
        0,
      ),
      protectedAuthorityIssueCount: records.reduce(
        (total, record) => total + record.protectedAuthorityIssues.length,
        0,
      ),
      criticalNarrationReviewItemCount: records.reduce(
        (total, record) =>
          total +
          record.narrationPreflight.boy.criticalTtsGaps.length +
          record.narrationPreflight.girl.criticalTtsGaps.length,
        0,
      ),
      softNarrationReviewItemCount: records.reduce(
        (total, record) =>
          total + record.narrationPreflight.softTtsReviewItemCount,
        0,
      ),
      narrationEarAcceptedCount: 0 as const,
      strictRenderReadyCount: 0 as const,
    },
    records,
    exclusions: EXCLUSIONS,
    effects: ZERO_EXTERNAL_EFFECTS,
    digestAlgorithm: 'canonical-json-sha256' as const,
  };
  const batch: StorySourceVisualDirectionCorrectionCandidateBatch = {
    ...batchPayload,
    digest: canonicalHash(batchPayload),
  };
  const batchBytes = Buffer.from(correctionCanonicalJsonBytes(batch), 'utf8');
  const artifactFilename = `${batch.digest}.json`;
  const artifactPath = `${outputRoot}/${artifactFilename}`;
  const created =
    args.write === true
      ? persistCandidateBatch({
          repoRoot,
          outputRoot,
          filename: artifactFilename,
          bytes: batchBytes,
        })
      : false;
  return {
    batch,
    artifact: {
      path: artifactPath,
      created,
      fileCount: 1,
    },
  };
}

export interface MaterializedStorySourceVisualDirectionCorrectionCandidate {
  storyKey: string;
  batchDigest: string;
  status: 'pending_exact_product_review';
  recordDisposition:
    | 'hold_before_exact_review'
    | 'pending_exact_product_and_visual_review';
  runtimeEligible: false;
  productionEligible: false;
  created: boolean;
  requestPath: string;
  candidateDirectory: string;
  pendingManifestPath: string;
  fileCount: 6;
}

function candidateRequestFile(
  record: StorySourceVisualDirectionCorrectionCandidateRecord,
): MaterializerRequestFile {
  const bytes = Buffer.from(materializer.canonicalBytes(record.request.payload), 'utf8');
  if (
    bytes.length !== record.request.bytes ||
    materializer.sha256(bytes) !== record.request.sha256
  ) {
    fail(`${record.storyKey} embedded request identity is invalid`);
  }
  return {
    bytes,
    relativePath: record.request.identityPath,
    request: record.request.payload,
    sha256: record.request.sha256,
  };
}

function expectedCandidateRecordFiles(
  record: StorySourceVisualDirectionCorrectionCandidateRecord,
  requestBytes: Buffer,
): Map<string, { bytes: number; sha256: string; exact?: Buffer }> {
  const expected = new Map<
    string,
    { bytes: number; sha256: string; exact?: Buffer }
  >();
  expected.set('request.json', {
    bytes: requestBytes.length,
    sha256: record.request.sha256,
    exact: requestBytes,
  });
  for (const descriptor of Object.values(record.candidateOutputs)) {
    expected.set(`candidate/${descriptor.filename}`, {
      bytes: descriptor.bytes,
      sha256: descriptor.sha256,
      ...(descriptor === record.candidateOutputs.manifest
        ? {
            exact: Buffer.from(
              materializer.canonicalBytes(record.sourceRevisionManifest),
              'utf8',
            ),
          }
        : {}),
    });
  }
  return expected;
}

function collectClosedCandidateFiles(
  root: string,
  prefix = '',
): string[] {
  validateDirectoryIdentity(root, 'materialized candidate directory');
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) fail('materialized candidate contains a link');
    const absolute = path.join(root, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...collectClosedCandidateFiles(absolute, relative));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      fail('materialized candidate contains a non-file entry');
    }
  }
  return files.sort(asciiCompare);
}

function verifyMaterializedCandidateTree(args: {
  root: string;
  record: StorySourceVisualDirectionCorrectionCandidateRecord;
  requestBytes: Buffer;
}): void {
  const expected = expectedCandidateRecordFiles(args.record, args.requestBytes);
  const expectedNames = [...expected.keys()].sort(asciiCompare);
  const actualNames = collectClosedCandidateFiles(args.root);
  if (
    expectedNames.length !== actualNames.length ||
    actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    fail(`${args.record.storyKey} materialized inventory is invalid`);
  }
  for (const name of actualNames) {
    const descriptor = expected.get(name);
    if (!descriptor) fail('materialized candidate contains an unexpected file');
    const absolute = path.join(args.root, ...name.split('/'));
    const before = fs.lstatSync(absolute);
    if (
      before.isSymbolicLink() ||
      !before.isFile() ||
      before.nlink !== 1 ||
      before.size !== descriptor.bytes ||
      !filesystemPathsEqual(fs.realpathSync(absolute), absolute)
    ) {
      fail(`${args.record.storyKey} materialized file identity is invalid`);
    }
    const bytes = fs.readFileSync(absolute);
    const after = fs.lstatSync(absolute);
    if (
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      ('ino' in before && before.ino !== after.ino) ||
      sha256(bytes) !== descriptor.sha256 ||
      (descriptor.exact && !bytes.equals(descriptor.exact))
    ) {
      fail(`${args.record.storyKey} materialized file bytes are invalid`);
    }
  }
}

function writeExclusiveFile(filename: string, bytes: Buffer): void {
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(filename, 'wx', 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function removeVerifiedCandidateStaging(staging: string, parent: string): void {
  if (!fs.existsSync(staging)) return;
  if (
    !filesystemPathsEqual(path.dirname(staging), parent) ||
    !path.basename(staging).startsWith('.tmp-correction-record-')
  ) {
    fail('refused to clean an unverified candidate staging directory');
  }
  validateDirectoryIdentity(staging, 'candidate staging directory');
  fs.rmSync(staging, { recursive: true, force: false });
}

export function materializeStorySourceVisualDirectionCorrectionCandidate(args: {
  repoRoot: string;
  storyKey: string;
  planPath?: string;
  outputRoot?: string;
  write?: boolean;
}): MaterializedStorySourceVisualDirectionCorrectionCandidate {
  if (!SAFE_STORY_KEY.test(args.storyKey)) fail('story key is invalid');
  const repoRoot = requireExactCurrentRepo(args.repoRoot);
  const outputRoot =
    args.outputRoot ?? DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_OUTPUT_ROOT;
  const prepared = prepareStorySourceVisualDirectionCorrectionBatch({
    repoRoot,
    planPath: args.planPath,
    outputRoot,
    write: false,
  });
  const matches = prepared.batch.records.filter(
    (record) => record.storyKey === args.storyKey,
  );
  const record = matches[0];
  if (matches.length !== 1 || !record) {
    fail('story key is not an exact member of the correction batch');
  }
  const requestFile = candidateRequestFile(record);
  const requestDirectory = path.posix.dirname(record.request.identityPath);
  const expectedSuffix = `/records/${record.storyKey}`;
  if (
    !requestDirectory.startsWith(`${outputRoot}/request-identities/`) ||
    !requestDirectory.endsWith(expectedSuffix) ||
    path.posix.basename(record.request.identityPath) !== 'request.json'
  ) {
    fail(`${record.storyKey} request identity path is invalid`);
  }
  const candidateDirectory = `${requestDirectory}/candidate`;
  const pendingManifestPath = `${candidateDirectory}/${record.candidateOutputs.manifest.filename}`;
  const dryRun = materializer.buildStorySourceRevision({
    requestFile,
    outputDir: path.resolve(repoRoot, ...candidateDirectory.split('/')),
    write: false,
  });
  if (
    dryRun.created !== false ||
    materializer.canonicalBytes(dryRun.manifest) !==
      materializer.canonicalBytes(record.sourceRevisionManifest)
  ) {
    fail(`${record.storyKey} extraction dry-run differs from the bound candidate`);
  }
  let created = false;
  if (args.write === true) {
    created = withCorrectionPublicationLock(repoRoot, (lock) => {
      lock.assertOwned();
      const recordsRootRelative = path.posix.dirname(requestDirectory);
      const recordsRoot = ensureOutputDirectory(repoRoot, recordsRootRelative);
      const recordsIdentity = captureDirectoryIdentity(
        recordsRoot,
        'candidate records directory',
      );
      const assertPublicationParents = (): void => {
        lock.assertOwned();
        assertDirectoryIdentity(recordsIdentity, 'candidate records directory');
      };
      const finalRoot = path.join(recordsRoot, record.storyKey);
      if (fs.existsSync(finalRoot)) {
        assertPublicationParents();
        verifyMaterializedCandidateTree({
          root: finalRoot,
          record,
          requestBytes: requestFile.bytes,
        });
        assertPublicationParents();
        return false;
      }
      const staging = path.join(
        recordsRoot,
        `.tmp-correction-record-${process.pid}-${randomUUID()}`,
      );
      assertPublicationParents();
      fs.mkdirSync(staging, { mode: 0o700 });
      try {
        assertPublicationParents();
        validateDirectoryIdentity(staging, 'candidate staging directory');
        const stagingCandidate = path.join(staging, 'candidate');
        fs.mkdirSync(stagingCandidate, { mode: 0o700 });
        assertPublicationParents();
        validateDirectoryIdentity(stagingCandidate, 'candidate staging output');
        writeExclusiveFile(path.join(staging, 'request.json'), requestFile.bytes);
        assertPublicationParents();
        validateDirectoryIdentity(staging, 'candidate staging directory');
        validateDirectoryIdentity(stagingCandidate, 'candidate staging output');
        const written = materializer.buildStorySourceRevision({
          requestFile,
          outputDir: stagingCandidate,
          write: true,
        });
        assertPublicationParents();
        if (
          written.created !== true ||
          materializer.canonicalBytes(written.manifest) !==
            materializer.canonicalBytes(record.sourceRevisionManifest)
        ) {
          fail(`${record.storyKey} extracted bytes differ from the bound candidate`);
        }
        verifyMaterializedCandidateTree({
          root: staging,
          record,
          requestBytes: requestFile.bytes,
        });
        assertPublicationParents();
        let publishedByThisCall = true;
        try {
          fs.renameSync(staging, finalRoot);
        } catch (error) {
          assertPublicationParents();
          if (fs.existsSync(finalRoot)) {
            verifyMaterializedCandidateTree({
              root: finalRoot,
              record,
              requestBytes: requestFile.bytes,
            });
            removeVerifiedCandidateStaging(staging, recordsRoot);
            publishedByThisCall = false;
          } else {
            throw error;
          }
        }
        assertPublicationParents();
        verifyMaterializedCandidateTree({
          root: finalRoot,
          record,
          requestBytes: requestFile.bytes,
        });
        assertPublicationParents();
        return publishedByThisCall;
      } catch (error) {
        assertPublicationParents();
        if (fs.existsSync(staging)) {
          removeVerifiedCandidateStaging(staging, recordsRoot);
        }
        throw error;
      }
    });
  }
  return {
    storyKey: record.storyKey,
    batchDigest: prepared.batch.digest,
    status: 'pending_exact_product_review',
    recordDisposition: record.status,
    runtimeEligible: false,
    productionEligible: false,
    created,
    requestPath: record.request.identityPath,
    candidateDirectory,
    pendingManifestPath,
    fileCount: 6,
  };
}
