import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import type { AuthoredCoverAuthority } from '@/lib/visual-contract-compiler/coverSourceAuthority';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';

import {
  assertValidPreRenderBookVisualBlueprint,
  computePreRenderBookVisualBlueprintDigest,
} from './preRenderBlueprint';
import type { PreRenderBlueprintAuthoringProvenance } from './preRenderBlueprintAuthoring';
import {
  createPreRenderBlueprintValidationEvidence,
  validatePreRenderBlueprintApprovalAttestation,
  writeImmutableLocalArtifact,
  type PreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintReviewPacket,
  type PreRenderBlueprintValidationEvidence,
} from './preRenderBlueprintLifecycle';
import type {
  PreRenderBlueprintReconciliationAuthority,
  PreRenderBlueprintStyleAuthority,
  PreRenderBlueprintValidationContext,
  PreRenderBookVisualBlueprint,
} from './preRenderBlueprintTypes';
import type { SourcePromptReconciliation } from './sourcePromptReconciliation';
import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  normalizedTextDigest,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import type {
  StorySourceIdentity,
  VisualPackageBoardArtifactIdentity,
  VisualPackagePropArtifactIdentity,
  VisualPackageReviewReality,
  VisualPackageTemplateIdentity,
} from './types';

export const VISUAL_PACKAGE_V4_VERSION = 'visual-package/v4' as const;
export const VISUAL_PACKAGE_V4_LOCATOR_VERSION =
  'visual-package-current-locator/v1' as const;
export const VISUAL_PACKAGE_V4_APPROVAL_VERSION =
  'visual-package-v4-approval/v1' as const;
export const VISUAL_PACKAGE_V4_LAYOUT_POLICY_VERSION =
  'portrait-layout-compatibility/v1' as const;
export const VISUAL_PACKAGE_V4_FREEZE_VERSION =
  'frozen-visual-package-authority/v1' as const;

const SHA256_HEX = /^[a-f0-9]{64}$/;

export interface VisualPackageV4Artifact<T> {
  artifactPath: string;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
  content: T;
}

export interface VisualPackageV4StorySourceSnapshot {
  identity: StorySourceIdentity;
  rawDigestAlgorithm: 'sha256-utf8';
  rawDigest: string;
  content: string;
}

export interface VisualPackageV4StyleAuthority
  extends PreRenderBlueprintStyleAuthority {
  content: unknown;
}

export interface VisualPackageV4Approval {
  version: typeof VISUAL_PACKAGE_V4_APPROVAL_VERSION;
  approvedBy: 'Guy';
  approvedAt: string;
  scope: 'immutable_runtime_authority_promotion';
  blueprintApprovalDigest: string;
  note?: string;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface VisualPackageV4LayoutCompatibilityPolicy {
  version: typeof VISUAL_PACKAGE_V4_LAYOUT_POLICY_VERSION;
  aspectRatio: '2:3';
  coordinateSpace: 'portrait-normalized-1000';
  cover: {
    zone: 'top_clear';
    x: 0;
    y: 0;
    width: 1000;
    minHeight: 250;
    maxHeight: 350;
  };
  body: {
    zone: 'bottom_clear';
    x: 0;
    bottom: 1000;
    width: 1000;
    minHeight: 250;
    maxHeight: 350;
  };
  remapPolicy: 'reject';
}

export const VISUAL_PACKAGE_V4_LAYOUT_POLICY: VisualPackageV4LayoutCompatibilityPolicy =
  {
    version: VISUAL_PACKAGE_V4_LAYOUT_POLICY_VERSION,
    aspectRatio: '2:3',
    coordinateSpace: 'portrait-normalized-1000',
    cover: {
      zone: 'top_clear',
      x: 0,
      y: 0,
      width: 1000,
      minHeight: 250,
      maxHeight: 350,
    },
    body: {
      zone: 'bottom_clear',
      x: 0,
      bottom: 1000,
      width: 1000,
      minHeight: 250,
      maxHeight: 350,
    },
    remapPolicy: 'reject',
  };

export interface VisualPackageV4 {
  manifestVersion: typeof VISUAL_PACKAGE_V4_VERSION;
  state: 'approved';
  storyKey: string;
  styleId: string;
  sourceSnapshot: VisualPackageV4StorySourceSnapshot;
  blueprint: VisualPackageV4Artifact<PreRenderBookVisualBlueprint>;
  authoringProvenance: VisualPackageV4Artifact<PreRenderBlueprintAuthoringProvenance>;
  validationEvidence: VisualPackageV4Artifact<PreRenderBlueprintValidationEvidence>;
  reviewPacket: VisualPackageV4Artifact<PreRenderBlueprintReviewPacket>;
  planningApproval: VisualPackageV4Artifact<PreRenderBlueprintApprovalAttestation>;
  styleAuthority: VisualPackageV4StyleAuthority;
  visualContractTemplate: VisualPackageV4Artifact<BookVisualContractTemplate> & {
    identity: VisualPackageTemplateIdentity;
  };
  reconciliation: VisualPackageV4Artifact<SourcePromptReconciliation> & {
    identity: PreRenderBlueprintReconciliationAuthority;
  };
  authoredCoverAuthority: AuthoredCoverAuthority | null;
  review: VisualPackageReviewReality;
  requiredBoards: VisualPackageBoardArtifactIdentity[];
  requiredPropReferences: VisualPackagePropArtifactIdentity[];
  layoutPolicy: VisualPackageV4LayoutCompatibilityPolicy;
  packageApproval: VisualPackageV4Approval;
  revisionDigestAlgorithm: 'canonical-json-sha256';
  revisionDigest: string;
}

export type VisualPackageV4Draft = Omit<
  VisualPackageV4,
  'revisionDigestAlgorithm' | 'revisionDigest'
>;

export interface VisualPackageV4Locator {
  version: typeof VISUAL_PACKAGE_V4_LOCATOR_VERSION;
  storyKey: string;
  styleId: string;
  packagePath: string;
  revisionDigest: string;
}

export interface FrozenVisualPackageAuthority {
  [key: string]: string;
  version: typeof VISUAL_PACKAGE_V4_FREEZE_VERSION;
  manifestVersion: typeof VISUAL_PACKAGE_V4_VERSION;
  storyKey: string;
  styleId: string;
  packagePath: string;
  packageRevisionDigest: string;
  sourcePath: string;
  sourceDigest: string;
  sourceRawDigest: string;
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  planningApprovalDigest: string;
  styleAuthorityDigest: string;
  visualContractTemplateDigest: string;
  reconciliationDigest: string;
  layoutPolicyVersion: typeof VISUAL_PACKAGE_V4_LAYOUT_POLICY_VERSION;
}

export interface VisualPackageV4Qualification {
  renderQualified: boolean;
  storyKey: string;
  styleId: string;
  packagePath: string | null;
  packageValue: VisualPackageV4 | null;
  frozenAuthority: FrozenVisualPackageAuthority | null;
  reasons: string[];
}

export class InvalidVisualPackageV4Error extends Error {
  readonly issues: string[];

  constructor(issues: readonly string[]) {
    const stable = [...new Set(issues)].sort((left, right) =>
      left.localeCompare(right),
    );
    super(`visual-package/v4 is not render-qualified:\n- ${stable.join('\n- ')}`);
    this.name = 'InvalidVisualPackageV4Error';
    this.issues = stable;
  }
}

function rawSourceDigest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function artifactDigest(value: unknown): string {
  return canonicalJsonDigest(value);
}

function withoutRevisionDigest(
  value: VisualPackageV4 | VisualPackageV4Draft,
): VisualPackageV4Draft {
  if ('revisionDigest' in value) {
    const {
      revisionDigest: _revisionDigest,
      revisionDigestAlgorithm: _revisionDigestAlgorithm,
      ...payload
    } = value;
    return payload;
  }
  return value;
}

function withoutApprovalDigest(
  approval: VisualPackageV4Approval,
): Omit<VisualPackageV4Approval, 'digestAlgorithm' | 'digest'> {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = approval;
  return payload;
}

export function computeVisualPackageV4ApprovalDigest(
  approval: VisualPackageV4Approval,
): string {
  return canonicalJsonDigest(withoutApprovalDigest(approval));
}

export function computeVisualPackageV4RevisionDigest(
  value: VisualPackageV4 | VisualPackageV4Draft,
): string {
  return canonicalJsonDigest(withoutRevisionDigest(value));
}

export function finalizeVisualPackageV4(
  draft: VisualPackageV4Draft,
): VisualPackageV4 {
  const value: VisualPackageV4 = {
    ...draft,
    revisionDigestAlgorithm: 'canonical-json-sha256',
    revisionDigest: computeVisualPackageV4RevisionDigest(draft),
  };
  assertValidVisualPackageV4(value);
  return value;
}

function artifactIssues(
  label: string,
  artifact: VisualPackageV4Artifact<unknown>,
): string[] {
  const issues: string[] = [];
  if (!nonEmpty(artifact.artifactPath)) {
    issues.push(`${label} artifact path is missing`);
  }
  if (artifact.digestAlgorithm !== 'canonical-json-sha256') {
    issues.push(`${label} digest algorithm is unsupported`);
  }
  if (
    !SHA256_HEX.test(artifact.digest) ||
    artifact.digest !== artifactDigest(artifact.content)
  ) {
    issues.push(`${label} content digest mismatch`);
  }
  return issues;
}

function layoutIssues(value: VisualPackageV4): string[] {
  const issues: string[] = [];
  if (
    canonicalJsonDigest(value.layoutPolicy) !==
    canonicalJsonDigest(VISUAL_PACKAGE_V4_LAYOUT_POLICY)
  ) {
    issues.push('layout compatibility policy is not the exact supported v1 policy');
    return issues;
  }
  for (const frame of value.blueprint.content.frames) {
    const region = frame.textSafeRegion;
    if (frame.kind === 'cover') {
      const policy = value.layoutPolicy.cover;
      if (
        region.x !== policy.x ||
        region.y !== policy.y ||
        region.width !== policy.width ||
        region.height < policy.minHeight ||
        region.height > policy.maxHeight
      ) {
        issues.push(
          `${frame.id} is not exactly representable as the cover top text-safe band`,
        );
      }
      continue;
    }
    const policy = value.layoutPolicy.body;
    if (
      region.x !== policy.x ||
      region.width !== policy.width ||
      region.y + region.height !== policy.bottom ||
      region.height < policy.minHeight ||
      region.height > policy.maxHeight
    ) {
      issues.push(
        `${frame.id} is not exactly representable as the body bottom text-safe band`,
      );
    }
  }
  return issues;
}

export function validateVisualPackageV4(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['package must be an object'];
  }
  const packageValue = value as VisualPackageV4;
  const issues: string[] = [];
  if (packageValue.manifestVersion !== VISUAL_PACKAGE_V4_VERSION) {
    issues.push(
      `manifestVersion must be ${JSON.stringify(VISUAL_PACKAGE_V4_VERSION)}`,
    );
    return issues;
  }
  if (packageValue.state !== 'approved') {
    issues.push('package state must be approved');
  }
  if (!nonEmpty(packageValue.storyKey) || !nonEmpty(packageValue.styleId)) {
    issues.push('storyKey and styleId are required');
  }
  if (
    !packageValue.review ||
    !nonEmpty(packageValue.review.authoredBy) ||
    packageValue.review.reviewedBy !== 'Guy' ||
    !isoTimestampIsValid(packageValue.review.reviewedAt) ||
    !packageValue.review.worldMode
  ) {
    issues.push('exact authored/reviewed world approval metadata is missing');
  }
  if (
    !packageValue.sourceSnapshot ||
    typeof packageValue.sourceSnapshot.content !== 'string'
  ) {
    issues.push('exact Story Source snapshot content is required');
    return issues;
  }
  const source = packageValue.sourceSnapshot;
  if (
    source.rawDigestAlgorithm !== 'sha256-utf8' ||
    !SHA256_HEX.test(source.rawDigest) ||
    source.rawDigest !== rawSourceDigest(source.content)
  ) {
    issues.push('Story Source raw snapshot digest mismatch');
  }
  if (
    source.identity.digest !== normalizedTextDigest(source.content) ||
    source.identity.digestAlgorithm !== 'sha256-normalized-utf8'
  ) {
    issues.push('Story Source normalized identity does not match embedded content');
  }
  if (
    packageValue.blueprint &&
    packageValue.authoringProvenance &&
    packageValue.validationEvidence &&
    packageValue.reviewPacket &&
    packageValue.planningApproval &&
    packageValue.visualContractTemplate &&
    packageValue.reconciliation
  ) {
    issues.push(
      ...artifactIssues(
        'Blueprint authoring provenance',
        packageValue.authoringProvenance,
      ),
      ...artifactIssues(
        'Blueprint validation evidence',
        packageValue.validationEvidence,
      ),
      ...artifactIssues('Blueprint review packet', packageValue.reviewPacket),
      ...artifactIssues(
        'Blueprint planning approval',
        packageValue.planningApproval,
      ),
      ...artifactIssues(
        'Visual Contract template',
        packageValue.visualContractTemplate,
      ),
      ...artifactIssues('reconciliation', packageValue.reconciliation),
    );
    if (
      !nonEmpty(packageValue.blueprint.artifactPath) ||
      packageValue.blueprint.digestAlgorithm !== 'canonical-json-sha256'
    ) {
      issues.push('Blueprint artifact identity is incomplete');
    }
    const context: PreRenderBlueprintValidationContext = {
      source: source.identity,
      rawStorySource: source.content,
      template: packageValue.visualContractTemplate.content,
      templateIdentity: packageValue.visualContractTemplate.identity,
      reconciliation: packageValue.reconciliation.content,
      reconciliationArtifactPath:
        packageValue.reconciliation.identity.artifactPath,
      ...(packageValue.authoredCoverAuthority
        ? { authoredCoverAuthority: packageValue.authoredCoverAuthority }
        : {}),
      style: {
        styleId: packageValue.styleAuthority.styleId,
        artifactPath: packageValue.styleAuthority.artifactPath,
        digestAlgorithm: packageValue.styleAuthority.digestAlgorithm,
        digest: packageValue.styleAuthority.digest,
      },
      styleContent: packageValue.styleAuthority.content,
    };
    try {
      assertValidPreRenderBookVisualBlueprint(
        packageValue.blueprint.content,
        context,
      );
    } catch (error) {
      issues.push(
        `embedded Blueprint is invalid: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (
      packageValue.blueprint.digest !==
        computePreRenderBookVisualBlueprintDigest(
          packageValue.blueprint.content,
        ) ||
      packageValue.blueprint.content.digest !== packageValue.blueprint.digest
    ) {
      issues.push('Blueprint identity/content digest mismatch');
    }
    const expectedEvidence = createPreRenderBlueprintValidationEvidence({
      blueprint: packageValue.blueprint.content,
      context,
    });
    if (
      packageValue.validationEvidence.content.digest !==
        expectedEvidence.digest ||
      !packageValue.validationEvidence.content.valid
    ) {
      issues.push('Blueprint validation evidence is stale or not passing');
    }
    issues.push(
      ...validatePreRenderBlueprintApprovalAttestation({
        blueprint: packageValue.blueprint.content,
        context,
        reviewPacket: packageValue.reviewPacket.content,
        attestation: packageValue.planningApproval.content,
      }).map((issue) => `Blueprint planning approval: ${issue}`),
    );
    if (
      packageValue.reviewPacket.content.authoringProvenance.digest !==
      packageValue.authoringProvenance.digest
    ) {
      issues.push('review packet does not bind exact authoring provenance');
    }
    if (
      packageValue.visualContractTemplate.identity.digest !==
      packageValue.visualContractTemplate.digest
    ) {
      issues.push('template identity/content digest mismatch');
    }
    if (
      packageValue.blueprint.content.identity.storyKey !==
        packageValue.storyKey ||
      packageValue.blueprint.content.identity.styleId !== packageValue.styleId ||
      packageValue.blueprint.content.identity.authoringAuthority.source.digest !==
        source.identity.digest
    ) {
      issues.push('package identity disagrees with Blueprint authoring authority');
    }
    for (const frame of packageValue.blueprint.content.frames) {
      const location = packageValue.visualContractTemplate.content.locations.find(
        (entry) => entry.id === frame.locationId,
      );
      if (
        !location?.environmentClass ||
        !location.timeOfDay?.trim() ||
        !['day', 'night', 'dusk', 'dawn', 'mixed'].includes(
          location.timeOfDay.trim().toLowerCase(),
        ) ||
        !location.lighting?.trim()
      ) {
        issues.push(
          `${frame.id} location lacks exact environment, supported time-of-day, or lighting authority`,
        );
      }
    }
    if (
      packageValue.styleAuthority.styleId !== packageValue.styleId ||
      packageValue.styleAuthority.digest !==
        canonicalJsonDigest(packageValue.styleAuthority.content)
    ) {
      issues.push('style authority content or style identity mismatch');
    }
    issues.push(...layoutIssues(packageValue));
  } else {
    issues.push('one or more required immutable authority artifacts are missing');
  }
  const approval = packageValue.packageApproval;
  if (
    !approval ||
    approval.version !== VISUAL_PACKAGE_V4_APPROVAL_VERSION ||
    approval.approvedBy !== 'Guy' ||
    approval.scope !== 'immutable_runtime_authority_promotion' ||
    !isoTimestampIsValid(approval.approvedAt) ||
    approval.blueprintApprovalDigest !==
      packageValue.planningApproval?.content.digest ||
    approval.digestAlgorithm !== 'canonical-json-sha256' ||
    approval.digest !== computeVisualPackageV4ApprovalDigest(approval)
  ) {
    issues.push('exact Guy v4 package promotion approval is missing or stale');
  }
  if (
    packageValue.revisionDigestAlgorithm !== 'canonical-json-sha256' ||
    !SHA256_HEX.test(packageValue.revisionDigest) ||
    packageValue.revisionDigest !==
      computeVisualPackageV4RevisionDigest(packageValue)
  ) {
    issues.push('content-addressed package revision digest mismatch');
  }
  return [...new Set(issues)].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function assertValidVisualPackageV4(
  value: unknown,
): asserts value is VisualPackageV4 {
  const issues = validateVisualPackageV4(value);
  if (issues.length > 0) throw new InvalidVisualPackageV4Error(issues);
}

export function buildFrozenVisualPackageAuthority(args: {
  packageValue: VisualPackageV4;
  packagePath: string;
}): FrozenVisualPackageAuthority {
  assertValidVisualPackageV4(args.packageValue);
  return {
    version: VISUAL_PACKAGE_V4_FREEZE_VERSION,
    manifestVersion: VISUAL_PACKAGE_V4_VERSION,
    storyKey: args.packageValue.storyKey,
    styleId: args.packageValue.styleId,
    packagePath: args.packagePath,
    packageRevisionDigest: args.packageValue.revisionDigest,
    sourcePath: args.packageValue.sourceSnapshot.identity.path,
    sourceDigest: args.packageValue.sourceSnapshot.identity.digest,
    sourceRawDigest: args.packageValue.sourceSnapshot.rawDigest,
    blueprintDigest: args.packageValue.blueprint.digest,
    authoringAuthorityDigest:
      args.packageValue.blueprint.content.identity.authoringAuthority.digest,
    planningApprovalDigest: args.packageValue.planningApproval.content.digest,
    styleAuthorityDigest: args.packageValue.styleAuthority.digest,
    visualContractTemplateDigest:
      args.packageValue.visualContractTemplate.digest,
    reconciliationDigest: args.packageValue.reconciliation.digest,
    layoutPolicyVersion: VISUAL_PACKAGE_V4_LAYOUT_POLICY_VERSION,
  };
}

function locatorIssues(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['current locator must be an object'];
  }
  const locator = value as VisualPackageV4Locator;
  const issues: string[] = [];
  if (locator.version !== VISUAL_PACKAGE_V4_LOCATOR_VERSION) {
    issues.push('current locator version is unsupported');
  }
  if (
    !nonEmpty(locator.storyKey) ||
    !nonEmpty(locator.styleId) ||
    !nonEmpty(locator.packagePath) ||
    !SHA256_HEX.test(locator.revisionDigest)
  ) {
    issues.push('current locator identity is incomplete');
  }
  return issues;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

export function loadVisualPackageV4Revision(args: {
  repoRoot: string;
  packagePath: string;
  expectedRevisionDigest?: string;
}): VisualPackageV4 {
  const absolute = resolveRepoPath(args.repoRoot, args.packagePath);
  if (!fs.existsSync(absolute)) {
    throw new InvalidVisualPackageV4Error([
      `immutable package revision is missing: ${args.packagePath}`,
    ]);
  }
  const value = readJson(absolute);
  assertValidVisualPackageV4(value);
  if (
    path.basename(absolute) !==
    `${value.revisionDigest}.visual-package.json`
  ) {
    throw new InvalidVisualPackageV4Error([
      'immutable package filename is not its exact content address',
    ]);
  }
  if (
    args.expectedRevisionDigest &&
    value.revisionDigest !== args.expectedRevisionDigest
  ) {
    throw new InvalidVisualPackageV4Error([
      `immutable package revision mismatch: expected ${args.expectedRevisionDigest}, got ${value.revisionDigest}`,
    ]);
  }
  return value;
}

export function loadCurrentVisualPackageV4(args: {
  repoRoot: string;
  locatorPath: string;
  storyKey: string;
  styleId: string;
}): { locator: VisualPackageV4Locator; packageValue: VisualPackageV4 } {
  const absolute = resolveRepoPath(args.repoRoot, args.locatorPath);
  if (!fs.existsSync(absolute)) {
    throw new InvalidVisualPackageV4Error([
      `current v4 locator is missing: ${args.locatorPath}`,
    ]);
  }
  const raw = readJson(absolute);
  const issues = locatorIssues(raw);
  if (issues.length > 0) throw new InvalidVisualPackageV4Error(issues);
  const locator = raw as VisualPackageV4Locator;
  if (locator.storyKey !== args.storyKey || locator.styleId !== args.styleId) {
    throw new InvalidVisualPackageV4Error([
      'current locator story/style identity mismatch',
    ]);
  }
  const packageValue = loadVisualPackageV4Revision({
    repoRoot: args.repoRoot,
    packagePath: locator.packagePath,
    expectedRevisionDigest: locator.revisionDigest,
  });
  if (
    packageValue.storyKey !== args.storyKey ||
    packageValue.styleId !== args.styleId
  ) {
    throw new InvalidVisualPackageV4Error([
      'selected package story/style identity mismatch',
    ]);
  }
  return { locator, packageValue };
}

export function loadFrozenVisualPackageV4(args: {
  repoRoot: string;
  frozen: FrozenVisualPackageAuthority;
}): VisualPackageV4 {
  const packageValue = loadVisualPackageV4Revision({
    repoRoot: args.repoRoot,
    packagePath: args.frozen.packagePath,
    expectedRevisionDigest: args.frozen.packageRevisionDigest,
  });
  const expected = buildFrozenVisualPackageAuthority({
    packageValue,
    packagePath: args.frozen.packagePath,
  });
  if (canonicalJsonDigest(expected) !== canonicalJsonDigest(args.frozen)) {
    throw new InvalidVisualPackageV4Error([
      'frozen order authority does not match immutable package content',
    ]);
  }
  return packageValue;
}

export function visualPackageV4LocatorPath(args: {
  repoRoot: string;
  approvedPackagesDir?: string;
  storyKey: string;
  styleId: string;
}): string {
  return repoRelativePath(
    args.repoRoot,
    path.join(
      args.approvedPackagesDir ??
        path.join(args.repoRoot, 'visual-packages', 'approved'),
      `${args.storyKey}.${args.styleId}.visual-package-current.json`,
    ),
  );
}

/**
 * Read-only selector/qualification boundary. A fresh order may consult the current locator exactly once; a frozen
 * order loads only its immutable content address and never reads the locator or mutable Story Source again.
 */
export function evaluateVisualPackageV4Qualification(args: {
  repoRoot: string;
  storyKey: string;
  styleId: string;
  approvedPackagesDir?: string;
  locatorPath?: string;
  frozenAuthority?: FrozenVisualPackageAuthority | null;
  expectedOrderSourceRawDigest?: string | null;
}): VisualPackageV4Qualification {
  try {
    let packageValue: VisualPackageV4;
    let packagePath: string;
    if (args.frozenAuthority) {
      packageValue = loadFrozenVisualPackageV4({
        repoRoot: args.repoRoot,
        frozen: args.frozenAuthority,
      });
      packagePath = args.frozenAuthority.packagePath;
    } else {
      const locatorPath =
        args.locatorPath ??
        visualPackageV4LocatorPath({
          repoRoot: args.repoRoot,
          approvedPackagesDir: args.approvedPackagesDir,
          storyKey: args.storyKey,
          styleId: args.styleId,
        });
      const selected = loadCurrentVisualPackageV4({
        repoRoot: args.repoRoot,
        locatorPath,
        storyKey: args.storyKey,
        styleId: args.styleId,
      });
      packageValue = selected.packageValue;
      packagePath = selected.locator.packagePath;
    }
    const reasons: string[] = [];
    if (
      packageValue.storyKey !== args.storyKey ||
      packageValue.styleId !== args.styleId
    ) {
      reasons.push('package story/style identity mismatch');
    }
    if (args.expectedOrderSourceRawDigest !== undefined) {
      if (!args.expectedOrderSourceRawDigest?.trim()) {
        reasons.push('order Story Source snapshot identity is missing');
      } else if (
        packageValue.sourceSnapshot.rawDigest !==
        args.expectedOrderSourceRawDigest
      ) {
        reasons.push(
          'order Story Source snapshot does not match immutable package source identity',
        );
      }
    }
    const frozenAuthority = buildFrozenVisualPackageAuthority({
      packageValue,
      packagePath,
    });
    return {
      renderQualified: reasons.length === 0,
      storyKey: args.storyKey,
      styleId: args.styleId,
      packagePath,
      packageValue,
      frozenAuthority,
      reasons,
    };
  } catch (error) {
    return {
      renderQualified: false,
      storyKey: args.storyKey,
      styleId: args.styleId,
      packagePath: args.frozenAuthority?.packagePath ?? null,
      packageValue: null,
      frozenAuthority: null,
      reasons:
        error instanceof InvalidVisualPackageV4Error
          ? error.issues
          : [error instanceof Error ? error.message : String(error)],
    };
  }
}

function writeMutableLocatorAtomically(args: {
  destinationPath: string;
  bytes: string;
}): void {
  fs.mkdirSync(path.dirname(args.destinationPath), { recursive: true });
  const temporary = `${args.destinationPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, args.bytes, { encoding: 'utf8', flag: 'wx' });
  try {
    fs.renameSync(temporary, args.destinationPath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function publishVisualPackageV4(args: {
  repoRoot: string;
  approvedPackagesDir: string;
  packageValue: VisualPackageV4;
  write?: boolean;
}): {
  packagePath: string;
  locatorPath: string;
  locator: VisualPackageV4Locator;
  wrote: boolean;
} {
  assertValidVisualPackageV4(args.packageValue);
  const root = path.resolve(args.approvedPackagesDir);
  const packageAbsolutePath = path.join(
    root,
    'revisions',
    `${args.packageValue.revisionDigest}.visual-package.json`,
  );
  const locatorAbsolutePath = path.join(
    root,
    `${args.packageValue.storyKey}.${args.packageValue.styleId}.visual-package-current.json`,
  );
  const packagePath = repoRelativePath(args.repoRoot, packageAbsolutePath);
  const locatorPath = repoRelativePath(args.repoRoot, locatorAbsolutePath);
  const locator: VisualPackageV4Locator = {
    version: VISUAL_PACKAGE_V4_LOCATOR_VERSION,
    storyKey: args.packageValue.storyKey,
    styleId: args.packageValue.styleId,
    packagePath,
    revisionDigest: args.packageValue.revisionDigest,
  };
  if (args.write === true) {
    writeImmutableLocalArtifact({
      destinationPath: packageAbsolutePath,
      bytes: `${JSON.stringify(args.packageValue, null, 2)}\n`,
    });
    writeMutableLocatorAtomically({
      destinationPath: locatorAbsolutePath,
      bytes: `${JSON.stringify(locator, null, 2)}\n`,
    });
  }
  return {
    packagePath,
    locatorPath,
    locator,
    wrote: args.write === true,
  };
}
