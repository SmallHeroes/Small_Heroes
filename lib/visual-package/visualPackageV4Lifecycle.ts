import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  compareBoardArtifacts,
  resolveRequiredBoardArtifacts,
} from './artifacts';
import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  parseJsonFile,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  assertValidPreRenderBookVisualBlueprint,
  computePreRenderBookVisualBlueprintDigest,
} from './preRenderBlueprint';
import type {
  PreRenderBlueprintAuthoringProvenance,
} from './preRenderBlueprintAuthoring';
import {
  createPreRenderBlueprintValidationEvidence,
  validatePreRenderBlueprintApprovalAttestation,
  writeImmutableLocalArtifact,
  type PreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintReviewPacket,
  type PreRenderBlueprintValidationEvidence,
} from './preRenderBlueprintLifecycle';
import type { PreRenderBookVisualBlueprint } from './preRenderBlueprintTypes';
import {
  comparePropArtifacts,
  resolveRequiredPropArtifacts,
} from './propArtifacts';
import {
  buildProductionAuthoringContext,
  type ProductionAuthoringContext,
} from './productionAuthoringContext';
import type {
  VisualPackageReviewReality,
} from './types';
import {
  VISUAL_PACKAGE_V4_APPROVAL_VERSION,
  VISUAL_PACKAGE_V4_APPROVAL_EXCLUSIONS,
  VISUAL_PACKAGE_V4_LAYOUT_POLICY,
  VISUAL_PACKAGE_V4_PACKAGE_REVIEW_EXCLUSIONS,
  VISUAL_PACKAGE_V4_PACKAGE_REVIEW_VERSION,
  VISUAL_PACKAGE_V4_VERSION,
  buildVisualPackageV4Candidate,
  buildVisualPackageV4PackageReviewSummary,
  computeVisualPackageV4ApprovalDigest,
  computeVisualPackageV4CandidateDigest,
  computeVisualPackageV4PackageReviewDigest,
  finalizeVisualPackageV4,
  visualPackageV4LayoutIssues,
  type VisualPackageV4,
  type VisualPackageV4Approval,
  type VisualPackageV4Artifact,
  type VisualPackageV4Candidate,
  type VisualPackageV4CandidateContent,
  type VisualPackageV4PackageReview,
} from './visualPackageV4';

export const VISUAL_PACKAGE_V4_QUALIFICATION_VERSION =
  'visual-package-v4-offline-qualification/v1' as const;

export interface ApprovedBlueprintLifecyclePaths {
  blueprintPath: string;
  authoringProvenancePath: string;
  validationEvidencePath: string;
  reviewPacketPath: string;
  planningApprovalPath: string;
}

export interface LoadedApprovedBlueprintLifecycle {
  blueprint: VisualPackageV4Artifact<PreRenderBookVisualBlueprint>;
  authoringProvenance: VisualPackageV4Artifact<PreRenderBlueprintAuthoringProvenance>;
  validationEvidence: VisualPackageV4Artifact<PreRenderBlueprintValidationEvidence>;
  reviewPacket: VisualPackageV4Artifact<PreRenderBlueprintReviewPacket>;
  planningApproval: VisualPackageV4Artifact<PreRenderBlueprintApprovalAttestation>;
}

export type VisualPackageV4QualificationReasonCode =
  | 'candidate_invalid'
  | 'package_review_invalid'
  | 'package_approval_missing'
  | 'package_approval_invalid'
  | 'source_stale'
  | 'template_stale'
  | 'style_stale'
  | 'reconciliation_stale'
  | 'blueprint_stale'
  | 'board_stale'
  | 'prop_reference_stale'
  | 'layout_incompatible'
  | 'legacy_authority_forbidden';

export interface VisualPackageV4QualificationReason {
  code: VisualPackageV4QualificationReasonCode;
  message: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
}

export interface VisualPackageV4OfflineQualification {
  version: typeof VISUAL_PACKAGE_V4_QUALIFICATION_VERSION;
  storyKey: string;
  styleId: string;
  candidateDigest: string | null;
  packageReviewDigest: string | null;
  packageApprovalDigest: string | null;
  candidateValid: boolean;
  reviewReady: boolean;
  approvalValid: boolean;
  readyForPublication: boolean;
  zeroWrite: true;
  reasons: VisualPackageV4QualificationReason[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export class InvalidVisualPackageV4LifecycleError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid visual-package/v4 lifecycle:\n- ${issues.join('\n- ')}`);
    this.name = 'InvalidVisualPackageV4LifecycleError';
  }
}

function rawDigest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function lifecycleArtifactDigest(content: unknown): string {
  if (
    content &&
    typeof content === 'object' &&
    !Array.isArray(content) &&
    (content as { version?: unknown }).version ===
      'pre-render-book-visual-blueprint/v2'
  ) {
    return computePreRenderBookVisualBlueprintDigest(
      content as PreRenderBookVisualBlueprint,
    );
  }
  return canonicalJsonDigest(content);
}

function readArtifact<T>(args: {
  repoRoot: string;
  artifactPath: string;
  label: string;
}): VisualPackageV4Artifact<T> {
  const absolute = resolveRepoPath(args.repoRoot, args.artifactPath);
  if (!fs.existsSync(absolute)) {
    throw new InvalidVisualPackageV4LifecycleError([
      `${args.label} is missing: ${args.artifactPath}`,
    ]);
  }
  let content: unknown;
  try {
    content = parseJsonFile(absolute);
  } catch (error) {
    throw new InvalidVisualPackageV4LifecycleError([
      `${args.label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
  return {
    artifactPath: repoRelativePath(args.repoRoot, absolute),
    digestAlgorithm: 'canonical-json-sha256',
    digest: lifecycleArtifactDigest(content),
    content: content as T,
  };
}

function artifactCurrentIssue(args: {
  repoRoot: string;
  artifact: VisualPackageV4Artifact<unknown>;
  label: string;
}): string | null {
  try {
    const current = readArtifact<unknown>({
      repoRoot: args.repoRoot,
      artifactPath: args.artifact.artifactPath,
      label: args.label,
    });
    return current.digest === args.artifact.digest &&
      canonicalJsonDigest(current.content) ===
        canonicalJsonDigest(args.artifact.content)
      ? null
      : `${args.label} content changed after candidate assembly`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function loadApprovedBlueprintLifecycle(args: {
  repoRoot: string;
  context: ProductionAuthoringContext;
  paths: ApprovedBlueprintLifecyclePaths;
}): LoadedApprovedBlueprintLifecycle {
  const blueprint = readArtifact<PreRenderBookVisualBlueprint>({
    repoRoot: args.repoRoot,
    artifactPath: args.paths.blueprintPath,
    label: 'Blueprint',
  });
  const authoringProvenance =
    readArtifact<PreRenderBlueprintAuthoringProvenance>({
      repoRoot: args.repoRoot,
      artifactPath: args.paths.authoringProvenancePath,
      label: 'Blueprint authoring provenance',
    });
  const validationEvidence =
    readArtifact<PreRenderBlueprintValidationEvidence>({
      repoRoot: args.repoRoot,
      artifactPath: args.paths.validationEvidencePath,
      label: 'Blueprint validation evidence',
    });
  const reviewPacket = readArtifact<PreRenderBlueprintReviewPacket>({
    repoRoot: args.repoRoot,
    artifactPath: args.paths.reviewPacketPath,
    label: 'Blueprint review packet',
  });
  const planningApproval =
    readArtifact<PreRenderBlueprintApprovalAttestation>({
      repoRoot: args.repoRoot,
      artifactPath: args.paths.planningApprovalPath,
      label: 'Blueprint planning approval',
    });

  const issues: string[] = [];
  try {
    assertValidPreRenderBookVisualBlueprint(
      blueprint.content,
      args.context.validationContext,
    );
  } catch (error) {
    issues.push(
      `Blueprint is stale or invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    blueprint.digest !==
      computePreRenderBookVisualBlueprintDigest(blueprint.content) ||
    blueprint.content.digest !== blueprint.digest
  ) {
    issues.push('Blueprint artifact digest does not match Blueprint content');
  }
  if (
    authoringProvenance.content.blueprintDigest !== blueprint.digest ||
    authoringProvenance.content.authoringAuthorityDigest !==
      blueprint.content.identity.authoringAuthority.digest ||
    authoringProvenance.content.noFallback !== true
  ) {
    issues.push(
      'authoring provenance does not bind the exact Blueprint authority with noFallback=true',
    );
  }
  const expectedEvidence = createPreRenderBlueprintValidationEvidence({
    blueprint: blueprint.content,
    context: args.context.validationContext,
  });
  if (
    canonicalJsonDigest(expectedEvidence) !== validationEvidence.digest ||
    validationEvidence.content.digest !== expectedEvidence.digest ||
    validationEvidence.content.valid !== true
  ) {
    issues.push('Blueprint validation evidence is stale or not passing');
  }
  if (
    reviewPacket.content.authoringProvenance.digest !==
      authoringProvenance.digest
  ) {
    issues.push(
      'Blueprint review packet does not bind exact authoring provenance',
    );
  }
  issues.push(
    ...validatePreRenderBlueprintApprovalAttestation({
      blueprint: blueprint.content,
      context: args.context.validationContext,
      reviewPacket: reviewPacket.content,
      attestation: planningApproval.content,
    }).map((issue) => `Blueprint planning approval: ${issue}`),
  );
  if (
    planningApproval.digest !==
    canonicalJsonDigest(planningApproval.content)
  ) {
    issues.push(
      'Blueprint planning approval artifact content digest is stale',
    );
  }
  if (issues.length > 0) {
    throw new InvalidVisualPackageV4LifecycleError(issues);
  }
  return {
    blueprint,
    authoringProvenance,
    validationEvidence,
    reviewPacket,
    planningApproval,
  };
}

function reviewRealityIssues(review: VisualPackageReviewReality): string[] {
  const issues: string[] = [];
  if (
    !nonEmpty(review.authoredBy) ||
    review.reviewedBy !== 'Guy' ||
    !isoTimestampIsValid(review.reviewedAt) ||
    !['grounded', 'grounded_with_visual_metaphor', 'fantastical'].includes(
      review.worldMode ?? '',
    )
  ) {
    issues.push(
      'Visual Contract review requires exact authoredBy, Guy reviewedBy/reviewedAt, and worldMode',
    );
  }
  return issues;
}

export function buildVisualPackageV4PackageReview(args: {
  candidate: VisualPackageV4Candidate;
  blockers?: string[];
}): VisualPackageV4PackageReview {
  const blockers = [...new Set(args.blockers ?? [])].sort();
  const review: VisualPackageV4PackageReview = {
    version: VISUAL_PACKAGE_V4_PACKAGE_REVIEW_VERSION,
    storyKey: args.candidate.content.storyKey,
    styleId: args.candidate.content.styleId,
    packageCandidateDigest: args.candidate.digest,
    summary: buildVisualPackageV4PackageReviewSummary(
      args.candidate.content,
    ),
    blockers,
    readyForApproval: blockers.length === 0,
    doesNotAuthorize: [
      ...VISUAL_PACKAGE_V4_PACKAGE_REVIEW_EXCLUSIONS,
    ],
    digestAlgorithm: 'canonical-json-sha256' as const,
    digest: '',
  };
  review.digest = computeVisualPackageV4PackageReviewDigest(review);
  return review;
}

export function assembleVisualPackageV4Candidate(args: {
  repoRoot: string;
  context: ProductionAuthoringContext;
  approvedBlueprintPaths: ApprovedBlueprintLifecyclePaths;
  review: VisualPackageReviewReality;
  boardRegistryDir?: string;
}): {
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
} {
  const reviewIssues = reviewRealityIssues(args.review);
  if (reviewIssues.length > 0) {
    throw new InvalidVisualPackageV4LifecycleError(reviewIssues);
  }
  const lifecycle = loadApprovedBlueprintLifecycle({
    repoRoot: args.repoRoot,
    context: args.context,
    paths: args.approvedBlueprintPaths,
  });
  const boardRegistryRoot = resolveRepoPath(
    args.repoRoot,
    args.boardRegistryDir ?? 'set-identity-boards',
  );
  const boardResult = resolveRequiredBoardArtifacts({
    repoRoot: args.repoRoot,
    boardRegistryRoot,
    template: args.context.template.content,
    styleId: args.context.styleId,
  });
  const propResult = resolveRequiredPropArtifacts({
    repoRoot: args.repoRoot,
    storyKey: args.context.storyKey,
    storySourcePath: args.context.sourceSnapshot.identity.path,
    styleId: args.context.styleId,
    template: args.context.template.content,
  });
  const authorityIssues = [
    ...boardResult.issues.map(
      (issue) => `Board compatibility: ${issue.code}: ${issue.message}`,
    ),
    ...propResult.issues.map(
      (issue) => `Prop compatibility: ${issue.code}: ${issue.message}`,
    ),
  ];
  if (authorityIssues.length > 0) {
    throw new InvalidVisualPackageV4LifecycleError(authorityIssues);
  }
  const content: VisualPackageV4CandidateContent = {
    manifestVersion: VISUAL_PACKAGE_V4_VERSION,
    storyKey: args.context.storyKey,
    styleId: args.context.styleId,
    sourceSnapshot: {
      identity: args.context.sourceSnapshot.identity,
      rawDigestAlgorithm: 'sha256-utf8',
      rawDigest: args.context.sourceSnapshot.rawDigest,
      content: args.context.sourceSnapshot.content,
    },
    blueprint: lifecycle.blueprint,
    authoringProvenance: lifecycle.authoringProvenance,
    validationEvidence: lifecycle.validationEvidence,
    reviewPacket: lifecycle.reviewPacket,
    planningApproval: lifecycle.planningApproval,
    styleAuthority: {
      ...args.context.styleAuthority.identity,
      content: args.context.styleAuthority.content,
    },
    visualContractTemplate: {
      artifactPath: args.context.template.identity.artifactPath,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(args.context.template.content),
      content: args.context.template.content,
      identity: args.context.template.identity,
    },
    reconciliation: {
      artifactPath: args.context.reconciliation.artifactPath,
      digestAlgorithm: 'canonical-json-sha256',
      digest: args.context.reconciliation.digest,
      content: args.context.reconciliation.content,
      identity:
        lifecycle.blueprint.content.identity.authoringAuthority.reconciliation,
    },
    authoredCoverAuthority: args.context.authoredCoverAuthority,
    review: args.review,
    requiredBoards: boardResult.boards,
    requiredPropReferences: propResult.artifacts,
    layoutPolicy: VISUAL_PACKAGE_V4_LAYOUT_POLICY,
  };
  const layoutIssues = visualPackageV4LayoutIssues(content);
  if (layoutIssues.length > 0) {
    throw new InvalidVisualPackageV4LifecycleError(layoutIssues);
  }
  const candidate = buildVisualPackageV4Candidate(content);
  return {
    candidate,
    packageReview: buildVisualPackageV4PackageReview({ candidate }),
  };
}

function qualificationReason(
  code: VisualPackageV4QualificationReasonCode,
  message: string,
  extra: Omit<
    VisualPackageV4QualificationReason,
    'code' | 'message'
  > = {},
): VisualPackageV4QualificationReason {
  return { code, message, ...extra };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function candidateShapeReasons(
  value: unknown,
): VisualPackageV4QualificationReason[] {
  const reasons: VisualPackageV4QualificationReason[] = [];
  const candidate = value as VisualPackageV4Candidate;
  const content = isRecord(candidate?.content)
    ? candidate.content
    : null;
  const manifestVersion = content?.manifestVersion;
  const blueprint = isRecord(content?.blueprint)
    ? content.blueprint
    : null;
  const blueprintContent = isRecord(blueprint?.content)
    ? blueprint.content
    : null;
  const structurallyComplete =
    isRecord(content) &&
    isRecord(content.sourceSnapshot) &&
    isRecord(content.styleAuthority) &&
    isRecord(content.visualContractTemplate) &&
    isRecord(content.reconciliation) &&
    isRecord(content.authoringProvenance) &&
    isRecord(content.validationEvidence) &&
    isRecord(content.reviewPacket) &&
    isRecord(content.planningApproval) &&
    isRecord(content.review) &&
    isRecord(content.layoutPolicy) &&
    Array.isArray(content.requiredBoards) &&
    Array.isArray(content.requiredPropReferences) &&
    isRecord(blueprint) &&
    isRecord(blueprintContent) &&
    Array.isArray(blueprintContent.frames) &&
    isRecord(blueprintContent.identity) &&
    isRecord(blueprintContent.identity.authoringAuthority);
  let digestMatches = false;
  if (structurallyComplete) {
    try {
      digestMatches =
        candidate.digest ===
        computeVisualPackageV4CandidateDigest(
          candidate.content,
        );
    } catch {
      digestMatches = false;
    }
  }
  if (
    !isRecord(value) ||
    candidate.version !== 'visual-package-v4-candidate/v1' ||
    candidate.state !== 'candidate' ||
    candidate.digestAlgorithm !== 'canonical-json-sha256' ||
    manifestVersion !== VISUAL_PACKAGE_V4_VERSION ||
    !structurallyComplete ||
    !digestMatches
  ) {
    reasons.push(
      qualificationReason(
        String(manifestVersion) === 'visual-package/v3'
          ? 'legacy_authority_forbidden'
          : 'candidate_invalid',
        'candidate structure, version, state, manifest, or content digest is invalid',
      ),
    );
  }
  return reasons;
}

function packageReviewReasons(args: {
  candidate: VisualPackageV4Candidate;
  packageReview: unknown;
}): VisualPackageV4QualificationReason[] {
  if (!isRecord(args.packageReview)) {
    return [
      qualificationReason(
        'package_review_invalid',
        'package review must be a structured exact-digest artifact',
      ),
    ];
  }
  const packageReview =
    args.packageReview as unknown as VisualPackageV4PackageReview;
  let expectedSummary: ReturnType<
    typeof buildVisualPackageV4PackageReviewSummary
  >;
  let digestMatches = false;
  try {
    expectedSummary = buildVisualPackageV4PackageReviewSummary(
      args.candidate.content,
    );
    digestMatches =
      packageReview.digest ===
      computeVisualPackageV4PackageReviewDigest(packageReview);
  } catch {
    return [
      qualificationReason(
        'package_review_invalid',
        'package review structure or digest payload is invalid',
      ),
    ];
  }
  if (
    packageReview.version !==
      VISUAL_PACKAGE_V4_PACKAGE_REVIEW_VERSION ||
    packageReview.storyKey !== args.candidate.content.storyKey ||
    packageReview.styleId !== args.candidate.content.styleId ||
    packageReview.packageCandidateDigest !== args.candidate.digest ||
    canonicalJsonDigest(packageReview.summary) !==
      canonicalJsonDigest(expectedSummary) ||
    packageReview.readyForApproval !== true ||
    !Array.isArray(packageReview.blockers) ||
    packageReview.blockers.length > 0 ||
    !Array.isArray(packageReview.doesNotAuthorize) ||
    canonicalJsonDigest(packageReview.doesNotAuthorize) !==
      canonicalJsonDigest(
        VISUAL_PACKAGE_V4_PACKAGE_REVIEW_EXCLUSIONS,
      ) ||
    packageReview.digestAlgorithm !== 'canonical-json-sha256' ||
    !digestMatches
  ) {
    return [
      qualificationReason(
        'package_review_invalid',
        'package review is stale, blocked, or does not bind the exact candidate',
      ),
    ];
  }
  return [];
}

export function visualPackageV4ApprovalIssues(args: {
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
  approval: unknown;
}): string[] {
  if (!isRecord(args.approval)) {
    return ['package approval must be a structured exact-digest decision'];
  }
  const approval = args.approval as unknown as VisualPackageV4Approval;
  const issues: string[] = [];
  if (
    approval.version !== VISUAL_PACKAGE_V4_APPROVAL_VERSION ||
    approval.approvedBy !== 'Guy' ||
    approval.scope !== 'immutable_runtime_authority_promotion' ||
    !isoTimestampIsValid(approval.approvedAt)
  ) {
    issues.push('package approval identity, approver, scope, or timestamp is invalid');
  }
  if (
    approval.blueprintApprovalDigest !==
      args.candidate.content.planningApproval.content.digest ||
    approval.packageCandidateDigest !== args.candidate.digest ||
    approval.packageReviewDigest !== args.packageReview.digest
  ) {
    issues.push(
      'package approval does not bind the exact Blueprint approval, candidate, and package review digests',
    );
  }
  if (
    !Array.isArray(approval.doesNotAuthorize) ||
    canonicalJsonDigest(approval.doesNotAuthorize) !==
    canonicalJsonDigest(VISUAL_PACKAGE_V4_APPROVAL_EXCLUSIONS)
  ) {
    issues.push(
      'package approval must retain the exact non-authorized action boundary',
    );
  }
  if (
    approval.digestAlgorithm !== 'canonical-json-sha256' ||
    approval.digest !== computeVisualPackageV4ApprovalDigest(approval)
  ) {
    issues.push('package approval content digest is invalid');
  }
  return issues;
}

export function qualifyVisualPackageV4Candidate(args: {
  repoRoot: string;
  candidate: unknown;
  packageReview: unknown;
  approval?: unknown;
  boardRegistryDir?: string;
}): VisualPackageV4OfflineQualification {
  const candidateShape = candidateShapeReasons(args.candidate);
  const candidate = args.candidate as VisualPackageV4Candidate;
  const packageReview =
    args.packageReview as VisualPackageV4PackageReview;
  const reasons = [...candidateShape];
  if (candidateShape.length === 0) {
    reasons.push(
      ...packageReviewReasons({
        candidate,
        packageReview: args.packageReview,
      }),
    );
  } else if (!isRecord(args.packageReview)) {
    reasons.push(
      qualificationReason(
        'package_review_invalid',
        'package review must be a structured exact-digest artifact',
      ),
    );
  }
  if (reasons.length === 0) {
    const exactInputs = [
      {
        code: 'template_stale' as const,
        label: 'Visual Contract Template',
        artifactPath:
          candidate.content.visualContractTemplate.artifactPath,
        expectedDigest:
          candidate.content.visualContractTemplate.digest,
      },
      {
        code: 'style_stale' as const,
        label: 'stable style authority',
        artifactPath: candidate.content.styleAuthority.artifactPath,
        expectedDigest: candidate.content.styleAuthority.digest,
      },
      {
        code: 'reconciliation_stale' as const,
        label: 'semantic reconciliation',
        artifactPath: candidate.content.reconciliation.artifactPath,
        expectedDigest: candidate.content.reconciliation.digest,
      },
    ];
    try {
      const sourceAbsolute = resolveRepoPath(
        args.repoRoot,
        candidate.content.sourceSnapshot.identity.path,
      );
      const currentSource = fs.readFileSync(sourceAbsolute, 'utf8');
      if (
        rawDigest(currentSource) !==
        candidate.content.sourceSnapshot.rawDigest
      ) {
        reasons.push(
          qualificationReason(
            'source_stale',
            'Story Source changed after candidate assembly',
          ),
        );
      }
    } catch (error) {
      reasons.push(
        qualificationReason(
          'source_stale',
          `Story Source cannot be read: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
    for (const input of exactInputs) {
      try {
        const absolute = resolveRepoPath(
          args.repoRoot,
          input.artifactPath,
        );
        const current = parseJsonFile(absolute);
        if (canonicalJsonDigest(current) !== input.expectedDigest) {
          reasons.push(
            qualificationReason(
              input.code,
              `${input.label} changed after candidate assembly`,
            ),
          );
        }
      } catch (error) {
        reasons.push(
          qualificationReason(
            input.code,
            `${input.label} cannot be read: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    }
  }
  let currentContext: ProductionAuthoringContext | null = null;
  if (reasons.length === 0) {
    try {
      currentContext = buildProductionAuthoringContext({
        repoRoot: args.repoRoot,
        storyKey: candidate.content.storyKey,
        storyPath:
          candidate.content.sourceSnapshot.identity.path,
        templatePath:
          candidate.content.visualContractTemplate.artifactPath,
        reconciliationPath:
          candidate.content.reconciliation.artifactPath,
        styleId: candidate.content.styleId,
        styleAuthorityPath:
          candidate.content.styleAuthority.artifactPath,
        expectedStyleAuthorityDigest:
          candidate.content.styleAuthority.digest,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code: VisualPackageV4QualificationReasonCode =
        /style/i.test(message)
          ? 'style_stale'
          : /reconciliation/i.test(message)
            ? 'reconciliation_stale'
            : /template|contract/i.test(message)
              ? 'template_stale'
              : 'source_stale';
      reasons.push(qualificationReason(code, message));
    }
  }
  if (currentContext) {
    const content = candidate.content;
    if (
      currentContext.sourceSnapshot.rawDigest !==
        content.sourceSnapshot.rawDigest ||
      currentContext.sourceSnapshot.identity.digest !==
        content.sourceSnapshot.identity.digest
    ) {
      reasons.push(
        qualificationReason(
          'source_stale',
          'Story Source changed after candidate assembly',
        ),
      );
    }
    if (
      currentContext.template.identity.digest !==
        content.visualContractTemplate.digest ||
      currentContext.template.identity.artifactPath !==
        content.visualContractTemplate.artifactPath
    ) {
      reasons.push(
        qualificationReason(
          'template_stale',
          'Visual Contract Template changed after candidate assembly',
        ),
      );
    }
    if (
      currentContext.styleAuthority.identity.digest !==
        content.styleAuthority.digest ||
      currentContext.styleAuthority.identity.artifactPath !==
        content.styleAuthority.artifactPath
    ) {
      reasons.push(
        qualificationReason(
          'style_stale',
          'stable style authority changed after candidate assembly',
        ),
      );
    }
    if (
      currentContext.reconciliation.digest !==
        content.reconciliation.digest ||
      currentContext.reconciliation.artifactPath !==
        content.reconciliation.artifactPath
    ) {
      reasons.push(
        qualificationReason(
          'reconciliation_stale',
          'semantic reconciliation changed after candidate assembly',
        ),
      );
    }
    try {
      assertValidPreRenderBookVisualBlueprint(
        content.blueprint.content,
        currentContext.validationContext,
      );
    } catch (error) {
      reasons.push(
        qualificationReason(
          'blueprint_stale',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
    for (const [
      label,
      artifact,
    ] of [
      ['Blueprint', content.blueprint],
      ['Blueprint authoring provenance', content.authoringProvenance],
      ['Blueprint validation evidence', content.validationEvidence],
      ['Blueprint review packet', content.reviewPacket],
      ['Blueprint planning approval', content.planningApproval],
    ] as const) {
      const issue = artifactCurrentIssue({
        repoRoot: args.repoRoot,
        artifact,
        label,
      });
      if (issue) {
        reasons.push(qualificationReason('blueprint_stale', issue));
      }
    }
    const currentBoards = resolveRequiredBoardArtifacts({
      repoRoot: args.repoRoot,
      boardRegistryRoot: resolveRepoPath(
        args.repoRoot,
        args.boardRegistryDir ?? 'set-identity-boards',
      ),
      template: currentContext.template.content,
      styleId: currentContext.styleId,
    });
    reasons.push(
      ...currentBoards.issues.map((issue) =>
        qualificationReason(
          'board_stale',
          `${issue.code}: ${issue.message}`,
        ),
      ),
      ...compareBoardArtifacts(
        content.requiredBoards,
        currentBoards.boards,
      ).map((issue) =>
        qualificationReason(
          'board_stale',
          `${issue.code}: ${issue.message}`,
        ),
      ),
    );
    const currentProps = resolveRequiredPropArtifacts({
      repoRoot: args.repoRoot,
      storyKey: currentContext.storyKey,
      storySourcePath: currentContext.sourceSnapshot.identity.path,
      styleId: currentContext.styleId,
      template: currentContext.template.content,
    });
    reasons.push(
      ...currentProps.issues.map((issue) =>
        qualificationReason(
          'prop_reference_stale',
          `${issue.code}: ${issue.message}`,
        ),
      ),
      ...comparePropArtifacts(
        content.requiredPropReferences,
        currentProps.artifacts,
      ).map((issue) =>
        qualificationReason(
          'prop_reference_stale',
          `${issue.code}: ${issue.message}`,
        ),
      ),
    );
    reasons.push(
      ...visualPackageV4LayoutIssues(content).map((message) =>
        qualificationReason('layout_incompatible', message),
      ),
    );
  }

  if (!args.approval) {
    reasons.push(
      qualificationReason(
        'package_approval_missing',
        'separate exact Guy package-promotion approval is missing',
      ),
    );
  } else if (
    candidateShape.length > 0 ||
    !isRecord(args.packageReview)
  ) {
    reasons.push(
      qualificationReason(
        'package_approval_invalid',
        'package approval cannot be validated against an invalid candidate or package review',
      ),
    );
  } else {
    reasons.push(
      ...visualPackageV4ApprovalIssues({
        candidate,
        packageReview,
        approval: args.approval,
      }).map((message) =>
        qualificationReason('package_approval_invalid', message),
      ),
    );
  }
  const stableReasons = reasons
    .sort((left, right) => {
      const code = left.code.localeCompare(right.code);
      return code !== 0 ? code : left.message.localeCompare(right.message);
    })
    .filter(
      (candidate, index, all) =>
        index === 0 ||
        canonicalJsonDigest(candidate) !==
          canonicalJsonDigest(all[index - 1]),
    );
  const candidateValid = !stableReasons.some((reason) =>
    [
      'candidate_invalid',
      'legacy_authority_forbidden',
      'source_stale',
      'template_stale',
      'style_stale',
      'reconciliation_stale',
      'blueprint_stale',
      'board_stale',
      'prop_reference_stale',
      'layout_incompatible',
    ].includes(reason.code),
  );
  const reviewReady =
    candidateValid &&
    !stableReasons.some(
      (reason) => reason.code === 'package_review_invalid',
    );
  const approvalValid =
    reviewReady &&
    !stableReasons.some((reason) =>
      ['package_approval_missing', 'package_approval_invalid'].includes(
        reason.code,
      ),
    );
  const withoutDigest = {
    version: VISUAL_PACKAGE_V4_QUALIFICATION_VERSION,
    storyKey:
      isRecord(candidate?.content) &&
      typeof candidate.content.storyKey === 'string'
        ? candidate.content.storyKey
        : '',
    styleId:
      isRecord(candidate?.content) &&
      typeof candidate.content.styleId === 'string'
        ? candidate.content.styleId
        : '',
    candidateDigest:
      isRecord(args.candidate) &&
      typeof args.candidate.digest === 'string'
        ? args.candidate.digest
        : null,
    packageReviewDigest:
      isRecord(args.packageReview) &&
      typeof args.packageReview.digest === 'string'
        ? args.packageReview.digest
        : null,
    packageApprovalDigest:
      isRecord(args.approval) &&
      typeof args.approval.digest === 'string'
        ? args.approval.digest
        : null,
    candidateValid,
    reviewReady,
    approvalValid,
    readyForPublication: approvalValid,
    zeroWrite: true as const,
    reasons: stableReasons,
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(withoutDigest),
  };
}

export function finalizeApprovedVisualPackageV4(args: {
  repoRoot: string;
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
  packageReviewArtifactPath: string;
  approval: VisualPackageV4Approval;
  boardRegistryDir?: string;
}): VisualPackageV4 {
  const qualification = qualifyVisualPackageV4Candidate({
    repoRoot: args.repoRoot,
    candidate: args.candidate,
    packageReview: args.packageReview,
    approval: args.approval,
    boardRegistryDir: args.boardRegistryDir,
  });
  if (!qualification.readyForPublication) {
    throw new InvalidVisualPackageV4LifecycleError(
      qualification.reasons.map(
        (reason) => `${reason.code}: ${reason.message}`,
      ),
    );
  }
  const currentPackageReview = readArtifact<VisualPackageV4PackageReview>({
    repoRoot: args.repoRoot,
    artifactPath: args.packageReviewArtifactPath,
    label: 'package review',
  });
  if (
    currentPackageReview.digest !== canonicalJsonDigest(args.packageReview)
  ) {
    throw new InvalidVisualPackageV4LifecycleError([
      'package review artifact changed after exact Guy approval',
    ]);
  }
  const packageReviewArtifactPath = currentPackageReview.artifactPath;
  return finalizeVisualPackageV4({
    ...args.candidate.content,
    state: 'approved',
    packageReview: {
      artifactPath: packageReviewArtifactPath,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(args.packageReview),
      content: args.packageReview,
    },
    packageApproval: args.approval,
  });
}

export function persistVisualPackageV4CandidateReview(args: {
  repoRoot: string;
  outputDir: string;
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
  write?: boolean;
}): {
  candidatePath: string;
  packageReviewPath: string;
  wrote: boolean;
} {
  const root = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, root);
  const candidatePath = path.join(
    root,
    'candidates',
    `${args.candidate.digest}.json`,
  );
  const packageReviewPath = path.join(
    root,
    'package-reviews',
    `${args.packageReview.digest}.json`,
  );
  if (args.write === true) {
    writeImmutableLocalArtifact({
      destinationPath: candidatePath,
      bytes: `${JSON.stringify(args.candidate, null, 2)}\n`,
    });
    writeImmutableLocalArtifact({
      destinationPath: packageReviewPath,
      bytes: `${JSON.stringify(args.packageReview, null, 2)}\n`,
    });
  }
  return {
    candidatePath: repoRelativePath(args.repoRoot, candidatePath),
    packageReviewPath: repoRelativePath(args.repoRoot, packageReviewPath),
    wrote: args.write === true,
  };
}
