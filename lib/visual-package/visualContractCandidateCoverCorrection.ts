import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  projectCoverMustNotShow,
  validateBookVisualContractTemplate,
  type BookVisualContract,
  type BookVisualContractTemplate,
} from '../visual-contract-compiler';
import {
  canonicalContentAddressedJsonBytes,
} from './canonicalContentAddressedJson';
import {
  createContainedContentAddressedJsonArtifactStore,
} from './canonicalLiveAuthoringArtifacts';
import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  loadQaWizardCandidateValidationAttestation,
} from './qaWizardCandidateBridge';
import {
  assertVisualContractCandidateForReconciliation,
} from './reconciliationLifecycle';
import {
  assertValidStorySourceAuthoritySnapshot,
  buildStorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import type {
  VisualContractCandidateArtifact,
} from './visualContractAuthoringLifecycle';

export const VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_PLAN_VERSION =
  'visual-contract-candidate-cover-correction-plan/v1' as const;
export const VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_VERSION =
  'visual-contract-candidate-cover-correction/v1' as const;
export const VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_REVIEW_VERSION =
  'visual-contract-candidate-cover-correction-review/v1' as const;
export const VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_APPROVAL_VERSION =
  'visual-contract-candidate-cover-correction-approval/v1' as const;

export const VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_DOES_NOT_AUTHORIZE = [
  'candidate_mutation',
  'reconciliation_approval',
  'blueprint_authoring',
  'blueprint_approval',
  'visual_package_authoring',
  'visual_package_approval',
  'wizard_qualification',
  'wizard_render',
  'provider_call',
  'image_render',
  'production_publication',
  'deployment',
] as const;

export const VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_APPROVAL_DOES_NOT_AUTHORIZE = [
  'candidate_mutation',
  'reconciliation_approval',
  'blueprint_authoring',
  'blueprint_approval',
  'visual_package_authoring',
  'visual_package_approval',
  'wizard_qualification',
  'wizard_render',
  'provider_call',
  'image_render',
  'production_publication',
  'deployment',
] as const;

export interface CoverVisibleRecurringPropOperation {
  kind: 'cover_visible_recurring_prop';
  propId: string;
  expectedFirstRevealPage: number;
  expectedCoverMustShowIndex: number;
  expectedCoverMustShowValue: string;
  expectedCoverMustNotShowIndex: number;
  expectedCoverMustNotShowValue: string;
  decisionBasis: 'cover_hero_object_intentionally_visible';
}

export interface CandidateCoverCorrectionPlan {
  version: typeof VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_PLAN_VERSION;
  subject: {
    storyKey: string;
    storyPath: string;
    sourceSnapshotDigest: string;
    candidateDigest: string;
    candidatePath: string;
    candidateValidationAttestationDigest: string;
    candidateValidationAttestationPath: string;
    templateDigest: string;
  };
  operations: CoverVisibleRecurringPropOperation[];
  authorityScope: 'pending_exact_cover_semantic_correction_review';
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface CandidateCoverCorrectionArtifact {
  version: typeof VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_VERSION;
  planDigest: string;
  subject: CandidateCoverCorrectionPlan['subject'];
  original: {
    templateDigest: string;
    actionSemanticCoverageDigest: string;
    coverContractDigest: string;
  };
  effective: {
    template: BookVisualContractTemplate;
    templateDigest: string;
    actionSemanticCoverageDigest: string;
    coverContractDigest: string;
  };
  changes: Array<{
    kind: 'cover_visible_recurring_prop';
    propId: string;
    removedFirstRevealPage: number;
    preservedCoverMustShowIndex: number;
    preservedCoverMustShowValue: string;
    removedCoverMustNotShowIndex: number;
    removedCoverMustNotShowValue: string;
  }>;
  validation: {
    validator: 'validateBookVisualContractTemplate';
    status: 'passed';
    structuralIssueCount: 0;
    selectedCoverConflictCount: 0;
    unrelatedTemplateDrift: false;
  };
  authorityScope: 'effective_candidate_template_for_product_review_only';
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface CandidateCoverCorrectionReview {
  version: typeof VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_REVIEW_VERSION;
  planDigest: string;
  correctionDigest: string;
  subject: CandidateCoverCorrectionPlan['subject'];
  decision: 'pending';
  reviewedBy: null;
  reviewedAt: null;
  coverBefore: BookVisualContractTemplate['coverContract'];
  coverAfter: BookVisualContractTemplate['coverContract'];
  recurringPropsBefore: Array<{
    id: string;
    name: string;
    firstRevealPage: number;
  }>;
  recurringPropsAfter: Array<{
    id: string;
    name: string;
    firstRevealPage: null;
  }>;
  changes: CandidateCoverCorrectionArtifact['changes'];
  validation: CandidateCoverCorrectionArtifact['validation'];
  readyForExactProductReview: true;
  authorityScope: 'cover_semantic_correction_review_only';
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface CandidateCoverCorrectionApproval {
  version: typeof VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_APPROVAL_VERSION;
  subject: CandidateCoverCorrectionPlan['subject'];
  plan: {
    digest: string;
    path: string;
  };
  correction: {
    digest: string;
    path: string;
    effectiveTemplateDigest: string;
  };
  review: {
    digest: string;
    path: string;
    markdownPath: string;
    markdownSha256: string;
  };
  decision: 'approved';
  approvedBy: 'Guy';
  approvedAt: string;
  authorityScope: 'exact_candidate_cover_correction_approval_only';
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface PrepareCandidateCoverCorrectionRequest {
  repoRoot: string;
  outputDir: string;
  storyKey: string;
  storyPath: string;
  candidatePath: string;
  candidateValidationAttestationPath: string;
  operations: CoverVisibleRecurringPropOperation[];
  write?: boolean;
}

export interface RecordCandidateCoverCorrectionApprovalRequest {
  repoRoot: string;
  outputDir: string;
  planPath: string;
  correctionPath: string;
  reviewPath: string;
  reviewMarkdownPath: string;
  approvedBy: 'Guy';
  approvedAt: string;
  write?: boolean;
}

export interface CandidateCoverCorrectionArtifactWrite {
  path: string;
  digest: string;
  created: boolean;
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function digestValue(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function canonicalUtcTimestampIsValid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    isoTimestampIsValid(value) &&
    new Date(value).toISOString() === value
  );
}

function sha256Utf8(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizedAbsolute(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function readUniqueCanonicalJson(args: {
  repoRoot: string;
  artifactPath: string;
  category: string;
  label: string;
}): Record<string, unknown> {
  const absolute = resolveRepoPath(args.repoRoot, args.artifactPath);
  let lexicalStat: fs.Stats;
  let realPath: string;
  let realStat: fs.Stats;
  try {
    lexicalStat = fs.lstatSync(absolute);
    realPath = fs.realpathSync(absolute);
    realStat = fs.statSync(realPath);
  } catch {
    throw new Error(`${args.label} is missing`);
  }
  if (
    !lexicalStat.isFile() ||
    lexicalStat.isSymbolicLink() ||
    !realStat.isFile() ||
    realStat.nlink !== 1 ||
    normalizedAbsolute(realPath) !== normalizedAbsolute(absolute) ||
    repoRelativePath(args.repoRoot, absolute) !== args.artifactPath ||
    path.basename(path.dirname(absolute)) !== args.category
  ) {
    throw new Error(`${args.label} filesystem identity is invalid`);
  }
  let parsed: unknown;
  const bytes = fs.readFileSync(absolute, 'utf8');
  try {
    parsed = JSON.parse(bytes) as unknown;
  } catch {
    throw new Error(`${args.label} JSON is invalid`);
  }
  if (
    !objectValue(parsed) ||
    !digestValue(parsed.digest) ||
    path.basename(absolute) !== `${parsed.digest}.json` ||
    bytes !== canonicalContentAddressedJsonBytes(parsed)
  ) {
    throw new Error(`${args.label} path or bytes are not canonical`);
  }
  return parsed;
}

function readUniqueUtf8(args: {
  repoRoot: string;
  artifactPath: string;
  category: string;
  label: string;
}): string {
  const absolute = resolveRepoPath(args.repoRoot, args.artifactPath);
  let lexicalStat: fs.Stats;
  let realPath: string;
  let realStat: fs.Stats;
  try {
    lexicalStat = fs.lstatSync(absolute);
    realPath = fs.realpathSync(absolute);
    realStat = fs.statSync(realPath);
  } catch {
    throw new Error(`${args.label} is missing`);
  }
  if (
    !lexicalStat.isFile() ||
    lexicalStat.isSymbolicLink() ||
    !realStat.isFile() ||
    realStat.nlink !== 1 ||
    normalizedAbsolute(realPath) !== normalizedAbsolute(absolute) ||
    repoRelativePath(args.repoRoot, absolute) !== args.artifactPath ||
    path.basename(path.dirname(absolute)) !== args.category
  ) {
    throw new Error(`${args.label} filesystem identity is invalid`);
  }
  return fs.readFileSync(absolute, 'utf8');
}

function correctionSubjectIsValid(value: unknown): boolean {
  return (
    objectValue(value) &&
    exactKeys(value, [
      'storyKey',
      'storyPath',
      'sourceSnapshotDigest',
      'candidateDigest',
      'candidatePath',
      'candidateValidationAttestationDigest',
      'candidateValidationAttestationPath',
      'templateDigest',
    ]) &&
    nonEmpty(value.storyKey) &&
    nonEmpty(value.storyPath) &&
    digestValue(value.sourceSnapshotDigest) &&
    digestValue(value.candidateDigest) &&
    nonEmpty(value.candidatePath) &&
    digestValue(value.candidateValidationAttestationDigest) &&
    nonEmpty(value.candidateValidationAttestationPath) &&
    digestValue(value.templateDigest)
  );
}

function assertOperation(
  value: unknown,
): asserts value is CoverVisibleRecurringPropOperation {
  if (
    !objectValue(value) ||
    !exactKeys(value, [
      'kind',
      'propId',
      'expectedFirstRevealPage',
      'expectedCoverMustShowIndex',
      'expectedCoverMustShowValue',
      'expectedCoverMustNotShowIndex',
      'expectedCoverMustNotShowValue',
      'decisionBasis',
    ]) ||
    value.kind !== 'cover_visible_recurring_prop' ||
    !nonEmpty(value.propId) ||
    !Number.isSafeInteger(value.expectedFirstRevealPage) ||
    Number(value.expectedFirstRevealPage) < 1 ||
    !Number.isSafeInteger(value.expectedCoverMustShowIndex) ||
    Number(value.expectedCoverMustShowIndex) < 0 ||
    !nonEmpty(value.expectedCoverMustShowValue) ||
    !Number.isSafeInteger(value.expectedCoverMustNotShowIndex) ||
    Number(value.expectedCoverMustNotShowIndex) < 0 ||
    !nonEmpty(value.expectedCoverMustNotShowValue) ||
    value.decisionBasis !== 'cover_hero_object_intentionally_visible'
  ) {
    throw new Error('candidate cover correction operation is invalid');
  }
}

function cloneTemplate(
  template: BookVisualContractTemplate,
): BookVisualContractTemplate {
  return JSON.parse(JSON.stringify(template)) as BookVisualContractTemplate;
}

function noSpoilerProjection(args: {
  template: BookVisualContractTemplate;
  propId: string;
}): string {
  const prop = args.template.recurringProps.find(
    (candidate) => candidate.id === args.propId,
  );
  if (!prop || typeof prop.firstRevealPage !== 'number') {
    throw new Error('candidate cover correction prop lifecycle is absent');
  }
  const projected = projectCoverMustNotShow({
    ...args.template,
    recurringProps: [prop],
  } as unknown as BookVisualContract);
  if (projected.length !== 1 || !projected[0]) {
    throw new Error('candidate cover correction projection is invalid');
  }
  return projected[0];
}

function normalizedForUnrelatedComparison(args: {
  template: BookVisualContractTemplate;
  operations: readonly CoverVisibleRecurringPropOperation[];
}): BookVisualContractTemplate {
  const normalized = cloneTemplate(args.template);
  const selectedPropIds = new Set(args.operations.map((item) => item.propId));
  for (const prop of normalized.recurringProps) {
    if (selectedPropIds.has(prop.id)) delete prop.firstRevealPage;
  }
  const selectedNoSpoilerValues = new Set(
    args.operations.map((item) => item.expectedCoverMustNotShowValue),
  );
  normalized.coverContract.mustNotShow =
    normalized.coverContract.mustNotShow.filter(
      (value) => !selectedNoSpoilerValues.has(value),
    );
  return normalized;
}

export function applyCoverVisibleRecurringPropOperations(args: {
  template: BookVisualContractTemplate;
  operations: readonly CoverVisibleRecurringPropOperation[];
}): {
  template: BookVisualContractTemplate;
  changes: CandidateCoverCorrectionArtifact['changes'];
} {
  if (
    !Array.isArray(args.operations) ||
    args.operations.length < 1 ||
    args.operations.length > 16
  ) {
    throw new Error('candidate cover correction operations are invalid');
  }
  for (const operation of args.operations) assertOperation(operation);
  if (
    new Set(args.operations.map((item) => item.propId)).size !==
      args.operations.length ||
    new Set(
      args.operations.map((item) => item.expectedCoverMustNotShowIndex),
    ).size !== args.operations.length ||
    new Set(
      args.operations.map((item) => item.expectedCoverMustNotShowValue),
    ).size !== args.operations.length
  ) {
    throw new Error('candidate cover correction operations are duplicated');
  }

  for (const operation of args.operations) {
    const propMatches = args.template.recurringProps.filter(
      (prop) => prop.id === operation.propId,
    );
    if (
      propMatches.length !== 1 ||
      propMatches[0]!.firstRevealPage !== operation.expectedFirstRevealPage ||
      args.template.coverContract.mustShow[
        operation.expectedCoverMustShowIndex
      ] !== operation.expectedCoverMustShowValue ||
      args.template.coverContract.mustNotShow[
        operation.expectedCoverMustNotShowIndex
      ] !== operation.expectedCoverMustNotShowValue ||
      noSpoilerProjection({
        template: args.template,
        propId: operation.propId,
      }) !== operation.expectedCoverMustNotShowValue
    ) {
      throw new Error(
        'candidate cover correction before-state is stale or cross-bound',
      );
    }
  }

  const corrected = cloneTemplate(args.template);
  const selectedPropIds = new Set(args.operations.map((item) => item.propId));
  for (const prop of corrected.recurringProps) {
    if (selectedPropIds.has(prop.id)) delete prop.firstRevealPage;
  }
  const removedIndexes = new Set(
    args.operations.map((item) => item.expectedCoverMustNotShowIndex),
  );
  corrected.coverContract.mustNotShow =
    corrected.coverContract.mustNotShow.filter(
      (_value, index) => !removedIndexes.has(index),
    );

  const changes = args.operations.map((operation) => ({
    kind: operation.kind,
    propId: operation.propId,
    removedFirstRevealPage: operation.expectedFirstRevealPage,
    preservedCoverMustShowIndex: operation.expectedCoverMustShowIndex,
    preservedCoverMustShowValue: operation.expectedCoverMustShowValue,
    removedCoverMustNotShowIndex:
      operation.expectedCoverMustNotShowIndex,
    removedCoverMustNotShowValue:
      operation.expectedCoverMustNotShowValue,
  }));

  for (const operation of args.operations) {
    const correctedProp = corrected.recurringProps.find(
      (prop) => prop.id === operation.propId,
    );
    if (
      !correctedProp ||
      Object.prototype.hasOwnProperty.call(
        correctedProp,
        'firstRevealPage',
      ) ||
      !corrected.coverContract.mustShow.includes(
        operation.expectedCoverMustShowValue,
      ) ||
      corrected.coverContract.mustNotShow.includes(
        operation.expectedCoverMustNotShowValue,
      )
    ) {
      throw new Error('candidate cover correction did not close exactly');
    }
  }

  if (
    canonicalContentAddressedJsonBytes(
      normalizedForUnrelatedComparison({
        template: args.template,
        operations: args.operations,
      }),
    ) !== canonicalContentAddressedJsonBytes(corrected)
  ) {
    throw new Error('candidate cover correction changed unrelated authority');
  }
  return { template: corrected, changes };
}

function readCandidate(args: {
  repoRoot: string;
  candidatePath: string;
}): VisualContractCandidateArtifact {
  const absolute = resolveRepoPath(args.repoRoot, args.candidatePath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(absolute, 'utf8')) as unknown;
  } catch {
    throw new Error('candidate cover correction candidate is missing or invalid');
  }
  if (!objectValue(parsed)) {
    throw new Error('candidate cover correction candidate is invalid');
  }
  const candidate = parsed as unknown as VisualContractCandidateArtifact;
  if (
    path.basename(absolute) !== `${candidate.digest}.json` ||
    fs.readFileSync(absolute, 'utf8') !==
      canonicalContentAddressedJsonBytes(candidate)
  ) {
    throw new Error('candidate cover correction candidate bytes are not canonical');
  }
  return candidate;
}

function withDigest<T extends Record<string, unknown>>(
  payload: T,
): T & { digestAlgorithm: 'canonical-json-sha256'; digest: string } {
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
}

function renderReviewMarkdown(review: CandidateCoverCorrectionReview): string {
  const lines = [
    '# Candidate Cover Semantic-Correction Review',
    '',
    `- Story: \`${review.subject.storyKey}\``,
    `- Candidate: \`${review.subject.candidateDigest}\``,
    `- Original template: \`${review.subject.templateDigest}\``,
    `- Correction: \`${review.correctionDigest}\``,
    `- Review: \`${review.digest}\``,
    '- Decision: **PENDING — Guy approval required**',
    '',
    '## Exact changes',
    '',
  ];
  for (const change of review.changes) {
    lines.push(
      `### ${change.propId}`,
      '',
      `- Preserve cover requirement: ${JSON.stringify(change.preservedCoverMustShowValue)}`,
      `- Remove lifecycle: \`firstRevealPage=${change.removedFirstRevealPage}\``,
      `- Remove derived no-spoiler projection: ${JSON.stringify(change.removedCoverMustNotShowValue)}`,
      '',
    );
  }
  lines.push(
    '## Cover before',
    '',
    '```json',
    JSON.stringify(review.coverBefore, null, 2),
    '```',
    '',
    '## Cover after',
    '',
    '```json',
    JSON.stringify(review.coverAfter, null, 2),
    '```',
    '',
    '## Validation',
    '',
    '- Structural issues: 0',
    '- Selected cover conflicts: 0',
    '- Unrelated template drift: false',
    '',
    'This review grants no approval, rendering, publication, Wizard, provider, or deployment authority.',
    '',
  );
  return lines.join('\n');
}

function persistMarkdown(args: {
  repoRoot: string;
  outputDir: string;
  review: CandidateCoverCorrectionReview;
  markdown: string;
}): CandidateCoverCorrectionArtifactWrite {
  const destination = path.resolve(
    args.repoRoot,
    args.outputDir,
    'candidate-cover-correction-reviews',
    `${args.review.digest}.md`,
  );
  repoRelativePath(args.repoRoot, destination);
  const bytes = args.markdown;
  if (fs.existsSync(destination)) {
    if (fs.readFileSync(destination, 'utf8') !== bytes) {
      throw new Error('candidate cover correction review markdown conflicts');
    }
    return {
      path: repoRelativePath(args.repoRoot, destination),
      digest: args.review.digest,
      created: false,
    };
  }
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporary, bytes, { encoding: 'utf8', flag: 'wx' });
    fs.linkSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return {
    path: repoRelativePath(args.repoRoot, destination),
    digest: args.review.digest,
    created: true,
  };
}

function assertImmutableBytesCompatible(args: {
  destinationPath: string;
  bytes: string;
  label: string;
}): void {
  if (
    fs.existsSync(args.destinationPath) &&
    fs.readFileSync(args.destinationPath, 'utf8') !== args.bytes
  ) {
    throw new Error(`${args.label} conflicts with existing immutable bytes`);
  }
}

export function prepareCandidateCoverCorrection(
  args: PrepareCandidateCoverCorrectionRequest,
): {
  plan: CandidateCoverCorrectionPlan;
  correction: CandidateCoverCorrectionArtifact;
  review: CandidateCoverCorrectionReview;
  markdown: string;
  artifacts: {
    plan: CandidateCoverCorrectionArtifactWrite;
    correction: CandidateCoverCorrectionArtifactWrite;
    review: CandidateCoverCorrectionArtifactWrite;
    markdown: CandidateCoverCorrectionArtifactWrite;
  };
} {
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    storyPath: args.storyPath,
  });
  assertValidStorySourceAuthoritySnapshot(snapshot);
  const candidate = readCandidate({
    repoRoot: args.repoRoot,
    candidatePath: args.candidatePath,
  });
  assertVisualContractCandidateForReconciliation({ snapshot, candidate });
  const attestation = loadQaWizardCandidateValidationAttestation({
    repoRoot: args.repoRoot,
    attestationPath: args.candidateValidationAttestationPath,
  });
  if (
    attestation.validation.status !== 'passed' ||
    attestation.subject.storyKey !== args.storyKey ||
    attestation.subject.storyPath !== args.storyPath ||
    attestation.subject.sourceSnapshotDigest !== snapshot.digest ||
    attestation.subject.candidateDigest !== candidate.digest ||
    attestation.subject.candidatePath !== args.candidatePath ||
    attestation.subject.templateDigest !== candidate.templateDigest
  ) {
    throw new Error(
      'candidate cover correction attestation is stale or cross-bound',
    );
  }
  const applied = applyCoverVisibleRecurringPropOperations({
    template: candidate.template,
    operations: args.operations,
  });
  const validation = validateBookVisualContractTemplate(applied.template);
  if (!validation.ok) {
    throw new Error('candidate cover correction effective template is invalid');
  }

  const subject = {
    storyKey: args.storyKey,
    storyPath: args.storyPath,
    sourceSnapshotDigest: snapshot.digest,
    candidateDigest: candidate.digest,
    candidatePath: args.candidatePath,
    candidateValidationAttestationDigest: attestation.digest,
    candidateValidationAttestationPath:
      args.candidateValidationAttestationPath,
    templateDigest: candidate.templateDigest,
  };
  const plan = withDigest({
    version: VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_PLAN_VERSION,
    subject,
    operations: args.operations.map((operation) => ({ ...operation })),
    authorityScope: 'pending_exact_cover_semantic_correction_review' as const,
  }) as CandidateCoverCorrectionPlan;
  const correction = withDigest({
    version: VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_VERSION,
    planDigest: plan.digest,
    subject,
    original: {
      templateDigest: candidate.templateDigest,
      actionSemanticCoverageDigest:
        candidate.actionSemanticCoverageDigest,
      coverContractDigest: canonicalJsonDigest(candidate.template.coverContract),
    },
    effective: {
      template: applied.template,
      templateDigest: canonicalJsonDigest(applied.template),
      actionSemanticCoverageDigest:
        candidate.actionSemanticCoverageDigest,
      coverContractDigest: canonicalJsonDigest(
        applied.template.coverContract,
      ),
    },
    changes: applied.changes,
    validation: {
      validator: 'validateBookVisualContractTemplate' as const,
      status: 'passed' as const,
      structuralIssueCount: 0 as const,
      selectedCoverConflictCount: 0 as const,
      unrelatedTemplateDrift: false as const,
    },
    authorityScope: 'effective_candidate_template_for_product_review_only' as const,
    doesNotAuthorize: [
      ...VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_DOES_NOT_AUTHORIZE,
    ],
  }) as CandidateCoverCorrectionArtifact;
  const selectedProps = args.operations.map((operation) => {
    const prop = candidate.template.recurringProps.find(
      (item) => item.id === operation.propId,
    )!;
    return {
      id: prop.id,
      name: prop.name,
      firstRevealPage: operation.expectedFirstRevealPage,
    };
  });
  const review = withDigest({
    version: VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_REVIEW_VERSION,
    planDigest: plan.digest,
    correctionDigest: correction.digest,
    subject,
    decision: 'pending' as const,
    reviewedBy: null,
    reviewedAt: null,
    coverBefore: candidate.template.coverContract,
    coverAfter: applied.template.coverContract,
    recurringPropsBefore: selectedProps,
    recurringPropsAfter: selectedProps.map(({ id, name }) => ({
      id,
      name,
      firstRevealPage: null,
    })),
    changes: applied.changes,
    validation: correction.validation,
    readyForExactProductReview: true as const,
    authorityScope: 'cover_semantic_correction_review_only' as const,
    doesNotAuthorize: [
      ...VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_DOES_NOT_AUTHORIZE,
    ],
  }) as CandidateCoverCorrectionReview;
  const markdown = renderReviewMarkdown(review);
  const categories = [
    'candidate-cover-correction-plans',
    'candidate-cover-corrections',
    'candidate-cover-correction-reviews',
  ] as const;
  const artifactPaths = {
    plan: `${args.outputDir}/${categories[0]}/${plan.digest}.json`,
    correction: `${args.outputDir}/${categories[1]}/${correction.digest}.json`,
    review: `${args.outputDir}/${categories[2]}/${review.digest}.json`,
    markdown: `${args.outputDir}/${categories[2]}/${review.digest}.md`,
  };
  let artifacts = {
    plan: { path: artifactPaths.plan, digest: plan.digest, created: false },
    correction: {
      path: artifactPaths.correction,
      digest: correction.digest,
      created: false,
    },
    review: {
      path: artifactPaths.review,
      digest: review.digest,
      created: false,
    },
    markdown: {
      path: artifactPaths.markdown,
      digest: review.digest,
      created: false,
    },
  };
  if (args.write === true) {
    for (const item of [
      {
        path: artifactPaths.plan,
        value: plan,
        label: 'candidate cover correction plan',
      },
      {
        path: artifactPaths.correction,
        value: correction,
        label: 'candidate cover correction artifact',
      },
      {
        path: artifactPaths.review,
        value: review,
        label: 'candidate cover correction review',
      },
    ]) {
      assertImmutableBytesCompatible({
        destinationPath: resolveRepoPath(args.repoRoot, item.path),
        bytes: canonicalContentAddressedJsonBytes(item.value),
        label: item.label,
      });
    }
    assertImmutableBytesCompatible({
      destinationPath: resolveRepoPath(
        args.repoRoot,
        artifactPaths.markdown,
      ),
      bytes: markdown,
      label: 'candidate cover correction review markdown',
    });
    const store = createContainedContentAddressedJsonArtifactStore({
      repoRoot: args.repoRoot,
      repositoryRealPath: fs.realpathSync(args.repoRoot),
      outputDir: args.outputDir,
      categories,
      rejectSymlinkAliases: true,
      errorPrefix: 'candidate cover correction',
    });
    store.prepare();
    artifacts = {
      plan: store.persist({
        category: categories[0],
        digest: plan.digest,
        value: plan,
      }),
      correction: store.persist({
        category: categories[1],
        digest: correction.digest,
        value: correction,
      }),
      review: store.persist({
        category: categories[2],
        digest: review.digest,
        value: review,
      }),
      markdown: persistMarkdown({
        repoRoot: args.repoRoot,
        outputDir: args.outputDir,
        review,
        markdown,
      }),
    };
  }
  return { plan, correction, review, markdown, artifacts };
}

function validatedPlanEnvelope(
  raw: Record<string, unknown>,
): CandidateCoverCorrectionPlan {
  if (
    !exactKeys(raw, [
      'version',
      'subject',
      'operations',
      'authorityScope',
      'digestAlgorithm',
      'digest',
    ]) ||
    raw.version !==
      VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_PLAN_VERSION ||
    !correctionSubjectIsValid(raw.subject) ||
    !Array.isArray(raw.operations) ||
    raw.operations.length < 1 ||
    raw.operations.length > 16 ||
    raw.authorityScope !==
      'pending_exact_cover_semantic_correction_review' ||
    raw.digestAlgorithm !== 'canonical-json-sha256' ||
    !digestValue(raw.digest)
  ) {
    throw new Error('candidate cover correction plan is invalid');
  }
  for (const operation of raw.operations) assertOperation(operation);
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = raw;
  if (raw.digest !== canonicalJsonDigest(payload)) {
    throw new Error('candidate cover correction plan digest is invalid');
  }
  return structuredClone(raw) as unknown as CandidateCoverCorrectionPlan;
}

function normalizedOutputDir(args: {
  repoRoot: string;
  outputDir: string;
}): string {
  return repoRelativePath(
    args.repoRoot,
    path.resolve(args.repoRoot, args.outputDir),
  );
}

function replayCandidateCoverCorrectionPacket(args: {
  repoRoot: string;
  outputDir: string;
  planPath: string;
  correctionPath: string;
  reviewPath: string;
  reviewMarkdownPath: string;
}): ReturnType<typeof prepareCandidateCoverCorrection> {
  const outputDir = normalizedOutputDir(args);
  const planRaw = readUniqueCanonicalJson({
    repoRoot: args.repoRoot,
    artifactPath: args.planPath,
    category: 'candidate-cover-correction-plans',
    label: 'candidate cover correction plan',
  });
  const plan = validatedPlanEnvelope(planRaw);
  const correctionRaw = readUniqueCanonicalJson({
    repoRoot: args.repoRoot,
    artifactPath: args.correctionPath,
    category: 'candidate-cover-corrections',
    label: 'candidate cover correction artifact',
  });
  const reviewRaw = readUniqueCanonicalJson({
    repoRoot: args.repoRoot,
    artifactPath: args.reviewPath,
    category: 'candidate-cover-correction-reviews',
    label: 'candidate cover correction review',
  });
  const markdown = readUniqueUtf8({
    repoRoot: args.repoRoot,
    artifactPath: args.reviewMarkdownPath,
    category: 'candidate-cover-correction-reviews',
    label: 'candidate cover correction review markdown',
  });
  const replay = prepareCandidateCoverCorrection({
    repoRoot: args.repoRoot,
    outputDir,
    storyKey: plan.subject.storyKey,
    storyPath: plan.subject.storyPath,
    candidatePath: plan.subject.candidatePath,
    candidateValidationAttestationPath:
      plan.subject.candidateValidationAttestationPath,
    operations: plan.operations,
    write: false,
  });
  if (
    args.planPath !== replay.artifacts.plan.path ||
    args.correctionPath !== replay.artifacts.correction.path ||
    args.reviewPath !== replay.artifacts.review.path ||
    args.reviewMarkdownPath !== replay.artifacts.markdown.path ||
    canonicalContentAddressedJsonBytes(planRaw) !==
      canonicalContentAddressedJsonBytes(replay.plan) ||
    canonicalContentAddressedJsonBytes(correctionRaw) !==
      canonicalContentAddressedJsonBytes(replay.correction) ||
    canonicalContentAddressedJsonBytes(reviewRaw) !==
      canonicalContentAddressedJsonBytes(replay.review) ||
    markdown !== replay.markdown
  ) {
    throw new Error(
      'candidate cover correction packet is stale, substituted, or tampered',
    );
  }
  return replay;
}

export function buildCandidateCoverCorrectionApproval(args: {
  packet: ReturnType<typeof prepareCandidateCoverCorrection>;
  approvedBy: 'Guy';
  approvedAt: string;
}): CandidateCoverCorrectionApproval {
  if (
    args.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(args.approvedAt)
  ) {
    throw new Error(
      'candidate cover correction approval identity or timestamp is invalid',
    );
  }
  const payload = {
    version:
      VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_APPROVAL_VERSION,
    subject: args.packet.plan.subject,
    plan: {
      digest: args.packet.plan.digest,
      path: args.packet.artifacts.plan.path,
    },
    correction: {
      digest: args.packet.correction.digest,
      path: args.packet.artifacts.correction.path,
      effectiveTemplateDigest:
        args.packet.correction.effective.templateDigest,
    },
    review: {
      digest: args.packet.review.digest,
      path: args.packet.artifacts.review.path,
      markdownPath: args.packet.artifacts.markdown.path,
      markdownSha256: sha256Utf8(args.packet.markdown),
    },
    decision: 'approved' as const,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    authorityScope:
      'exact_candidate_cover_correction_approval_only' as const,
    doesNotAuthorize: [
      ...VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_APPROVAL_DOES_NOT_AUTHORIZE,
    ],
  };
  return withDigest(payload) as CandidateCoverCorrectionApproval;
}

function approvalShapeIsValid(
  value: Record<string, unknown>,
): boolean {
  if (
    !exactKeys(value, [
      'version',
      'subject',
      'plan',
      'correction',
      'review',
      'decision',
      'approvedBy',
      'approvedAt',
      'authorityScope',
      'doesNotAuthorize',
      'digestAlgorithm',
      'digest',
    ]) ||
    value.version !==
      VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_APPROVAL_VERSION ||
    !correctionSubjectIsValid(value.subject) ||
    !objectValue(value.plan) ||
    !exactKeys(value.plan, ['digest', 'path']) ||
    !digestValue(value.plan.digest) ||
    !nonEmpty(value.plan.path) ||
    !objectValue(value.correction) ||
    !exactKeys(value.correction, [
      'digest',
      'path',
      'effectiveTemplateDigest',
    ]) ||
    !digestValue(value.correction.digest) ||
    !nonEmpty(value.correction.path) ||
    !digestValue(value.correction.effectiveTemplateDigest) ||
    !objectValue(value.review) ||
    !exactKeys(value.review, [
      'digest',
      'path',
      'markdownPath',
      'markdownSha256',
    ]) ||
    !digestValue(value.review.digest) ||
    !nonEmpty(value.review.path) ||
    !nonEmpty(value.review.markdownPath) ||
    !digestValue(value.review.markdownSha256) ||
    value.decision !== 'approved' ||
    value.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(value.approvedAt) ||
    value.authorityScope !==
      'exact_candidate_cover_correction_approval_only' ||
    !Array.isArray(value.doesNotAuthorize) ||
    canonicalJsonDigest(value.doesNotAuthorize) !==
      canonicalJsonDigest(
        VISUAL_CONTRACT_CANDIDATE_COVER_CORRECTION_APPROVAL_DOES_NOT_AUTHORIZE,
      ) ||
    value.digestAlgorithm !== 'canonical-json-sha256' ||
    !digestValue(value.digest)
  ) {
    return false;
  }
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = value;
  return value.digest === canonicalJsonDigest(payload);
}

export function candidateCoverCorrectionApprovalIsStructurallyValid(
  value: unknown,
): boolean {
  return objectValue(value) && approvalShapeIsValid(value);
}

export function recordCandidateCoverCorrectionApproval(
  args: RecordCandidateCoverCorrectionApprovalRequest,
): {
  approval: CandidateCoverCorrectionApproval;
  artifact: CandidateCoverCorrectionArtifactWrite;
  packet: ReturnType<typeof prepareCandidateCoverCorrection>;
} {
  if (
    args.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(args.approvedAt)
  ) {
    throw new Error(
      'candidate cover correction approval identity or timestamp is invalid',
    );
  }
  const outputDir = normalizedOutputDir(args);
  const packet = replayCandidateCoverCorrectionPacket({
    ...args,
    outputDir,
  });
  const approval = buildCandidateCoverCorrectionApproval({
    packet,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
  });
  if (
    !approvalShapeIsValid(
      approval as unknown as Record<string, unknown>,
    )
  ) {
    throw new Error('candidate cover correction approval is invalid');
  }
  const artifactPath =
    `${outputDir}/candidate-cover-correction-approvals/${approval.digest}.json`;
  const destinationPath = resolveRepoPath(args.repoRoot, artifactPath);
  assertImmutableBytesCompatible({
    destinationPath,
    bytes: canonicalContentAddressedJsonBytes(approval),
    label: 'candidate cover correction approval',
  });
  let created = false;
  if (args.write === true) {
    const store = createContainedContentAddressedJsonArtifactStore({
      repoRoot: args.repoRoot,
      repositoryRealPath: fs.realpathSync(args.repoRoot),
      outputDir,
      categories: ['candidate-cover-correction-approvals'] as const,
      rejectSymlinkAliases: true,
      errorPrefix: 'candidate cover correction approval',
    });
    store.prepare();
    created = store.persist({
      category: 'candidate-cover-correction-approvals',
      digest: approval.digest,
      value: approval,
    }).created;
  }
  return {
    approval,
    artifact: {
      path: artifactPath,
      digest: approval.digest,
      created,
    },
    packet,
  };
}

export function loadApprovedCandidateCoverCorrection(args: {
  repoRoot: string;
  approvalPath: string;
}): {
  approval: CandidateCoverCorrectionApproval;
  packet: ReturnType<typeof prepareCandidateCoverCorrection>;
} {
  const raw = readUniqueCanonicalJson({
    repoRoot: args.repoRoot,
    artifactPath: args.approvalPath,
    category: 'candidate-cover-correction-approvals',
    label: 'candidate cover correction approval',
  });
  if (!approvalShapeIsValid(raw)) {
    throw new Error(
      'candidate cover correction approval is invalid or tampered',
    );
  }
  const approval = raw as unknown as CandidateCoverCorrectionApproval;
  const normalizedPath = repoRelativePath(
    args.repoRoot,
    resolveRepoPath(args.repoRoot, args.approvalPath),
  );
  const outputDir = path.posix.dirname(path.posix.dirname(normalizedPath));
  const rebuilt = recordCandidateCoverCorrectionApproval({
    repoRoot: args.repoRoot,
    outputDir,
    planPath: approval.plan.path,
    correctionPath: approval.correction.path,
    reviewPath: approval.review.path,
    reviewMarkdownPath: approval.review.markdownPath,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
    write: false,
  });
  if (
    rebuilt.artifact.path !== normalizedPath ||
    canonicalContentAddressedJsonBytes(rebuilt.approval) !==
      canonicalContentAddressedJsonBytes(approval)
  ) {
    throw new Error(
      'candidate cover correction approval cannot be exactly replayed',
    );
  }
  return { approval: rebuilt.approval, packet: rebuilt.packet };
}
