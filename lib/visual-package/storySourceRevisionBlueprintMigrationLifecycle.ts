import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import type { ActionSemanticCoverageRecord } from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';

import {
  canonicalContentAddressedJsonBytes,
  writeCanonicalContentAddressedJsonArtifact,
} from './canonicalContentAddressedJson';
import {
  canonicalJsonDigest,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  buildProductionAuthoringContextFromApprovedReconciliation,
  type ProductionAuthoringContext,
} from './productionAuthoringContext';
import {
  compilePreRenderBookVisualBlueprint,
  type PreRenderBlueprintAuthoringResult,
} from './preRenderBlueprintAuthoring';
import {
  buildPreRenderBlueprintReviewBundle,
  createPreRenderBlueprintValidationEvidence,
  planPreRenderBlueprintApprovalAttestation,
  persistPreRenderBlueprintLifecycle,
  preRenderBlueprintLifecycleJsonBytes,
  writePreRenderBlueprintApprovalAttestation,
  type PersistedPreRenderBlueprintLifecycle,
  type PreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintReviewPacket,
} from './preRenderBlueprintLifecycle';
import { serializePreRenderBookVisualBlueprint } from './preRenderBlueprint';
import type { PreRenderBookVisualBlueprint } from './preRenderBlueprintTypes';
import {
  approvePendingSourcePromptReconciliation,
  buildReconciliationReviewBundle,
  persistReconciliationDraftBundle,
  reconciliationDraftBundleJsonBytes,
  renderReconciliationReviewMarkdown,
} from './reconciliationLifecycle';
import type { SourcePromptReconciliation } from './sourcePromptReconciliation';
import {
  assertValidStorySourceAuthoritySnapshot,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import {
  assertStorySourceRevisionMigrationArtifactPlanIsSafe,
  loadPendingStorySourceRevisionPackageMigration,
  readContainedRegularFile,
  type StorySourceRevisionPackageMigrationManifest,
} from './storySourceRevisionPackageMigrationLifecycle';
import {
  loadVisualPackageV4Revision,
  type VisualPackageV4,
} from './visualPackageV4';
import {
  assembleVisualPackageV4Candidate,
  loadApprovedBlueprintLifecycle,
  persistVisualPackageV4CandidateReview,
  qualifyVisualPackageV4Candidate,
  type ApprovedBlueprintLifecyclePaths,
} from './visualPackageV4Lifecycle';
import type {
  VisualPackageReviewReality,
} from './types';

export const STORY_SOURCE_REVISION_RECONCILIATION_APPROVAL_VERSION =
  'story-source-revision-reconciliation-approval/v1' as const;
export const STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_MANIFEST_VERSION =
  'story-source-revision-blueprint-migration-manifest/v1' as const;
export const STORY_SOURCE_REVISION_PACKAGE_ASSEMBLY_MANIFEST_VERSION =
  'story-source-revision-package-assembly-manifest/v1' as const;

export const STORY_SOURCE_REVISION_RECONCILIATION_APPROVAL_EXCLUSIONS = [
  'blueprint_approval',
  'database_write',
  'deployment',
  'image_render',
  'locator_update',
  'package_approval',
  'provider_call',
  'publication',
] as const;

export const STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_EXCLUSIONS = [
  'blueprint_approval',
  'database_write',
  'deployment',
  'image_render',
  'locator_update',
  'package_approval',
  'provider_call',
  'publication',
] as const;

export const STORY_SOURCE_REVISION_PACKAGE_ASSEMBLY_EXCLUSIONS = [
  'database_write',
  'deployment',
  'image_render',
  'locator_update',
  'package_approval',
  'provider_call',
  'publication',
  'storage_write',
] as const;

const SHA256 = /^[a-f0-9]{64}$/;
const OLD_PAGE_8_SUMMARY =
  'In the cozy bedroom, the child rests on the bed with Kim beside her while the bus and settled stop remain a small quiet echo beyond the window.';
const NEW_PAGE_8_SUMMARY =
  'In the cozy bedroom, the child rests on the bed with Kim beside the child while the bus and settled stop remain a small quiet echo beyond the window.';

export interface StorySourceRevisionReconciliationApproval {
  version: typeof STORY_SOURCE_REVISION_RECONCILIATION_APPROVAL_VERSION;
  pendingManifest: {
    digest: string;
    path: string;
  };
  sourcePackage: {
    revisionDigest: string;
    path: string;
  };
  acceptedRevision: {
    revisionDigest: string;
    integratedStoryPath: string;
    integratedStorySha256: string;
  };
  projection: {
    newSnapshotDigest: string;
    newSnapshotPath: string;
    migratedTemplateDigest: string;
    migratedTemplatePath: string;
    coverageDigest: string;
    coveragePath: string;
  };
  pendingReview: {
    reconciliationDigest: string;
    reviewBundleDigest: string;
  };
  approvedReview: {
    reconciliationDigest: string;
    reconciliationPath: string;
    reviewBundleDigest: string;
    reviewBundlePath: string;
    reviewMarkdownPath: string;
    reviewMarkdownSha256: string;
    approvedBy: 'Guy';
    approvedAt: string;
  };
  authorityScope: 'story_source_revision_reconciliation_exact_content_only';
  doesNotAuthorize: typeof STORY_SOURCE_REVISION_RECONCILIATION_APPROVAL_EXCLUSIONS;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface StorySourceRevisionBlueprintMigrationManifest {
  version: typeof STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_MANIFEST_VERSION;
  stage: 'blueprint_pending';
  reconciliationApproval: {
    digest: string;
    path: string;
  };
  sourcePackageRevisionDigest: string;
  productionContextDigest: string;
  blueprint: {
    digest: string;
    authoringAuthorityDigest: string;
    candidatePath: string;
    reviewPacketDigest: string;
    reviewPacketPath: string;
    reviewMarkdownPath: string;
    contactSheetPath: string;
    validationEvidencePath: string;
    provenancePath: string;
    readyForApproval: true;
    changedFrameIds: ['frame:page:8'];
  };
  reviewedContentEdits: [{
    frameId: 'frame:page:8';
    field: 'narrative.summary';
    from: typeof OLD_PAGE_8_SUMMARY;
    to: typeof NEW_PAGE_8_SUMMARY;
  }];
  externalCounters: {
    providerCalls: 0;
    imageRenders: 0;
    audioRenders: 0;
    databaseWrites: 0;
    storageWrites: 0;
    locatorWrites: 0;
  };
  doesNotAuthorize: typeof STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_EXCLUSIONS;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface RecordedStorySourceRevisionReconciliationApproval {
  approval: StorySourceRevisionReconciliationApproval;
  approvalPath: string;
  approvedReconciliation: SourcePromptReconciliation;
  reviewBundle: ReturnType<typeof buildReconciliationReviewBundle>;
  artifacts: ReturnType<typeof persistReconciliationDraftBundle> & {
    approvalCreated: boolean;
  };
}

export interface PreparedStorySourceRevisionBlueprintMigration {
  manifest: StorySourceRevisionBlueprintMigrationManifest;
  manifestPath: string;
  context: ProductionAuthoringContext;
  authored: PreRenderBlueprintAuthoringResult;
  persisted: PersistedPreRenderBlueprintLifecycle | null;
}

export interface StorySourceRevisionPackageAssemblyManifest {
  version: typeof STORY_SOURCE_REVISION_PACKAGE_ASSEMBLY_MANIFEST_VERSION;
  stage: 'package_pending';
  blueprintMigration: {
    digest: string;
    path: string;
  };
  blueprintApproval: {
    digest: string;
    path: string;
  };
  sourcePackageRevisionDigest: string;
  productionContextDigest: string;
  package: {
    candidateDigest: string;
    candidatePath: string;
    reviewDigest: string;
    reviewPath: string;
    readyForApproval: true;
    qualificationDigest: string;
    qualificationReasonCodes: ['package_approval_missing'];
  };
  authorityReuse: {
    boardCount: number;
    boardsDigest: string;
    propReferenceCount: number;
    propReferencesDigest: string;
    exactSourcePackageMatch: true;
  };
  externalCounters: {
    providerCalls: 0;
    imageRenders: 0;
    audioRenders: 0;
    databaseWrites: 0;
    storageWrites: 0;
    locatorWrites: 0;
  };
  doesNotAuthorize: typeof STORY_SOURCE_REVISION_PACKAGE_ASSEMBLY_EXCLUSIONS;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface RecordedStorySourceRevisionBlueprintApproval {
  manifest: StorySourceRevisionBlueprintMigrationManifest;
  approval: PreRenderBlueprintApprovalAttestation;
  approvalPath: string;
  created: boolean;
}

export interface PreparedStorySourceRevisionPackageAssembly {
  manifest: StorySourceRevisionPackageAssemblyManifest;
  manifestPath: string;
  context: ProductionAuthoringContext;
  candidate: ReturnType<typeof assembleVisualPackageV4Candidate>['candidate'];
  packageReview: ReturnType<
    typeof assembleVisualPackageV4Candidate
  >['packageReview'];
  qualification: ReturnType<typeof qualifyVisualPackageV4Candidate>;
  persisted: ReturnType<typeof persistVisualPackageV4CandidateReview> | null;
}

interface LoadedApprovedMigration {
  approval: StorySourceRevisionReconciliationApproval;
  approvalPath: string;
  manifest: StorySourceRevisionPackageMigrationManifest;
  sourcePackage: VisualPackageV4;
  newSnapshot: StorySourceAuthoritySnapshot;
  migratedTemplate: BookVisualContractTemplate;
  migratedCoverage: ActionSemanticCoverageRecord[];
  approvedReconciliation: SourcePromptReconciliation;
  context: ProductionAuthoringContext;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalUtcTimestampIsValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
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

function digestPayload<T extends { digestAlgorithm: string; digest: string }>(
  value: T,
): Omit<T, 'digestAlgorithm' | 'digest'> {
  const { digestAlgorithm: _algorithm, digest: _digest, ...payload } = value;
  return payload;
}

function buildDigestArtifact<T extends Record<string, unknown>>(
  payload: T,
): T & { digestAlgorithm: 'canonical-json-sha256'; digest: string } {
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
}

function outputRootFromManifestPath(repoRoot: string, manifestPath: string): {
  absolute: string;
  relative: string;
} {
  const absoluteManifest = resolveRepoPath(repoRoot, manifestPath);
  const absolute = path.dirname(path.dirname(absoluteManifest));
  const relative = repoRelativePath(repoRoot, absolute);
  if (!relative.startsWith('outputs/')) {
    throw new Error('migration authority root escaped outputs');
  }
  return { absolute, relative };
}

function readOutputJson<T>(args: {
  repoRoot: string;
  relativePath: string;
  label: string;
}): { value: T; bytes: string } {
  const file = readContainedRegularFile({
    repoRoot: args.repoRoot,
    relativePath: args.relativePath,
    allowedRoot: 'outputs',
    label: args.label,
  });
  const bytes = file.bytes.toString('utf8');
  let value: unknown;
  try {
    value = JSON.parse(bytes) as unknown;
  } catch {
    throw new Error(`${args.label} JSON is invalid`);
  }
  return { value: value as T, bytes };
}

function persistCanonicalJson(args: {
  repoRoot: string;
  relativePath: string;
  value: unknown;
  write: boolean;
}): { path: string; created: boolean } {
  const destinationPath = resolveRepoPath(args.repoRoot, args.relativePath);
  const result = args.write
    ? writeCanonicalContentAddressedJsonArtifact({
        destinationPath,
        value: args.value,
      })
    : { created: false };
  return { path: args.relativePath, created: result.created };
}

function artifactPath(args: {
  outputRoot: string;
  category: string;
  digest: string;
  extension?: string;
}): string {
  return `${args.outputRoot}/${args.category}/${args.digest}.${args.extension ?? 'json'}`;
}

function buildApprovedReview(args: {
  pending: ReturnType<typeof loadPendingStorySourceRevisionPackageMigration>;
  approvedAt: string;
}): {
  reconciliation: SourcePromptReconciliation;
  reviewBundle: ReturnType<typeof buildReconciliationReviewBundle>;
  markdown: string;
} {
  const reconciliation = approvePendingSourcePromptReconciliation({
    pending: args.pending.pendingReconciliation,
    approvedBy: 'Guy',
    approvedAt: args.approvedAt,
  });
  const reviewBundle = buildReconciliationReviewBundle({
    reconciliation,
    sourceIdentity: args.pending.newSnapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: args.pending.newSnapshot.digest,
    rawStorySource: args.pending.newSnapshot.content.normalizedRawStorySource,
    template: args.pending.migratedTemplate,
    ...(args.pending.newSnapshot.content.authoredCoverAuthority
      ? {
          authoredCoverAuthority:
            args.pending.newSnapshot.content.authoredCoverAuthority,
        }
      : {}),
    actionSemanticCoverage: args.pending.migratedCoverage,
  });
  if (!reviewBundle.readyForApproval || reviewBundle.blockingIssues.length > 0) {
    throw new Error('approved migrated reconciliation review remains incomplete');
  }
  return {
    reconciliation,
    reviewBundle,
    markdown: renderReconciliationReviewMarkdown(reviewBundle),
  };
}

export function recordStorySourceRevisionReconciliationApproval(args: {
  repoRoot: string;
  pendingManifestPath: string;
  pendingReconciliationDigest: string;
  pendingReviewBundleDigest: string;
  approvedBy: 'Guy';
  approvedAt: string;
  write?: boolean;
}): RecordedStorySourceRevisionReconciliationApproval {
  const pending = loadPendingStorySourceRevisionPackageMigration({
    repoRoot: args.repoRoot,
    manifestPath: args.pendingManifestPath,
  });
  if (
    args.approvedBy !== 'Guy' ||
    pending.manifest.reconciliation.digest !== args.pendingReconciliationDigest ||
    pending.manifest.reconciliation.reviewBundleDigest !== args.pendingReviewBundleDigest
  ) {
    throw new Error('reconciliation approval does not bind the exact pending review');
  }
  const approved = buildApprovedReview({ pending, approvedAt: args.approvedAt });
  const outputRoot = outputRootFromManifestPath(
    args.repoRoot,
    args.pendingManifestPath,
  );
  const approvedArtifacts = persistReconciliationDraftBundle({
    repoRoot: args.repoRoot,
    outputDir: outputRoot.relative,
    reconciliation: approved.reconciliation,
    reviewBundle: approved.reviewBundle,
    markdown: approved.markdown,
    write: false,
  });
  const approval = buildDigestArtifact({
    version: STORY_SOURCE_REVISION_RECONCILIATION_APPROVAL_VERSION,
    pendingManifest: {
      digest: pending.manifest.digest,
      path: args.pendingManifestPath,
    },
    sourcePackage: {
      revisionDigest: pending.manifest.sourcePackage.revisionDigest,
      path: pending.manifest.sourcePackage.packagePath,
    },
    acceptedRevision: {
      revisionDigest: pending.manifest.acceptedRevision.revisionDigest,
      integratedStoryPath: pending.manifest.acceptedRevision.integratedStoryPath,
      integratedStorySha256:
        pending.manifest.acceptedRevision.integratedStorySha256,
    },
    projection: {
      newSnapshotDigest: pending.manifest.evidenceMigration.newSnapshotDigest,
      newSnapshotPath: pending.manifest.evidenceMigration.newSnapshotPath,
      migratedTemplateDigest: pending.manifest.projection.migratedTemplateDigest,
      migratedTemplatePath: pending.manifest.projection.migratedTemplatePath,
      coverageDigest: pending.manifest.projection.coverageDigest,
      coveragePath: pending.manifest.projection.coveragePath,
    },
    pendingReview: {
      reconciliationDigest: args.pendingReconciliationDigest,
      reviewBundleDigest: args.pendingReviewBundleDigest,
    },
    approvedReview: {
      reconciliationDigest: approved.reviewBundle.reconciliationDigest,
      reconciliationPath: approvedArtifacts.reconciliationPath,
      reviewBundleDigest: approved.reviewBundle.digest,
      reviewBundlePath: approvedArtifacts.reviewBundlePath,
      reviewMarkdownPath: approvedArtifacts.markdownPath,
      reviewMarkdownSha256: sha256(approved.markdown),
      approvedBy: 'Guy' as const,
      approvedAt: args.approvedAt,
    },
    authorityScope:
      'story_source_revision_reconciliation_exact_content_only' as const,
    doesNotAuthorize:
      STORY_SOURCE_REVISION_RECONCILIATION_APPROVAL_EXCLUSIONS,
  }) as StorySourceRevisionReconciliationApproval;
  const approvalPath = artifactPath({
    outputRoot: outputRoot.relative,
    category: 'story-source-revision-reconciliation-approvals',
    digest: approval.digest,
  });
  const plans = [
    {
      path: approvedArtifacts.reconciliationPath,
      bytes: reconciliationDraftBundleJsonBytes(approved.reconciliation),
    },
    {
      path: approvedArtifacts.reviewBundlePath,
      bytes: reconciliationDraftBundleJsonBytes(approved.reviewBundle),
    },
    { path: approvedArtifacts.markdownPath, bytes: approved.markdown },
    { path: approvalPath, bytes: canonicalContentAddressedJsonBytes(approval) },
  ];
  if (args.write === true) {
    assertStorySourceRevisionMigrationArtifactPlanIsSafe({
      repoRoot: args.repoRoot,
      outputRoot: outputRoot.absolute,
      artifacts: plans,
    });
    persistReconciliationDraftBundle({
      repoRoot: args.repoRoot,
      outputDir: outputRoot.relative,
      reconciliation: approved.reconciliation,
      reviewBundle: approved.reviewBundle,
      markdown: approved.markdown,
      write: true,
    });
  }
  const approvalArtifact = persistCanonicalJson({
    repoRoot: args.repoRoot,
    relativePath: approvalPath,
    value: approval,
    write: args.write === true,
  });
  return {
    approval,
    approvalPath,
    approvedReconciliation: approved.reconciliation,
    reviewBundle: approved.reviewBundle,
    artifacts: {
      ...approvedArtifacts,
      wrote: args.write === true,
      approvalCreated: approvalArtifact.created,
    },
  };
}

function loadMigrationManifest(args: {
  repoRoot: string;
  path: string;
  expectedDigest: string;
}): StorySourceRevisionPackageMigrationManifest {
  const loaded = readOutputJson<StorySourceRevisionPackageMigrationManifest>({
    repoRoot: args.repoRoot,
    relativePath: args.path,
    label: 'Story Source revision migration manifest',
  }).value;
  if (
    loaded.digest !== args.expectedDigest ||
    loaded.digestAlgorithm !== 'canonical-json-sha256' ||
    canonicalJsonDigest(digestPayload(loaded)) !== loaded.digest ||
    path.posix.basename(args.path) !== `${loaded.digest}.json`
  ) {
    throw new Error('Story Source revision migration manifest is invalid or stale');
  }
  return loaded;
}

function loadApprovedMigration(args: {
  repoRoot: string;
  approvalPath: string;
}): LoadedApprovedMigration {
  const loadedApproval = readOutputJson<StorySourceRevisionReconciliationApproval>({
    repoRoot: args.repoRoot,
    relativePath: args.approvalPath,
    label: 'Story Source revision reconciliation approval',
  }).value;
  if (
    !isObject(loadedApproval) ||
    !exactKeys(loadedApproval as unknown as Record<string, unknown>, [
      'acceptedRevision',
      'approvedReview',
      'authorityScope',
      'digest',
      'digestAlgorithm',
      'doesNotAuthorize',
      'pendingManifest',
      'pendingReview',
      'projection',
      'sourcePackage',
      'version',
    ]) ||
    loadedApproval.version !==
      STORY_SOURCE_REVISION_RECONCILIATION_APPROVAL_VERSION ||
    loadedApproval.digestAlgorithm !== 'canonical-json-sha256' ||
    canonicalJsonDigest(digestPayload(loadedApproval)) !== loadedApproval.digest ||
    !SHA256.test(loadedApproval.digest) ||
    path.posix.basename(args.approvalPath) !== `${loadedApproval.digest}.json` ||
    loadedApproval.approvedReview.approvedBy !== 'Guy' ||
    loadedApproval.authorityScope !==
      'story_source_revision_reconciliation_exact_content_only' ||
    canonicalJsonDigest(loadedApproval.doesNotAuthorize) !==
      canonicalJsonDigest(
        STORY_SOURCE_REVISION_RECONCILIATION_APPROVAL_EXCLUSIONS,
      )
  ) {
    throw new Error('Story Source revision reconciliation approval is invalid');
  }
  const manifest = loadMigrationManifest({
    repoRoot: args.repoRoot,
    path: loadedApproval.pendingManifest.path,
    expectedDigest: loadedApproval.pendingManifest.digest,
  });
  const sourcePackage = loadVisualPackageV4Revision({
    repoRoot: args.repoRoot,
    packagePath: loadedApproval.sourcePackage.path,
    expectedRevisionDigest: loadedApproval.sourcePackage.revisionDigest,
  });
  if (
    sourcePackage.storyKey !== manifest.storyKey ||
    sourcePackage.styleId !== manifest.styleId ||
    sourcePackage.revisionDigest !== manifest.sourcePackage.revisionDigest
  ) {
    throw new Error('source package revision does not bind the migration');
  }
  const newSnapshot = readOutputJson<StorySourceAuthoritySnapshot>({
    repoRoot: args.repoRoot,
    relativePath: loadedApproval.projection.newSnapshotPath,
    label: 'migrated Story Source snapshot',
  }).value;
  assertValidStorySourceAuthoritySnapshot(newSnapshot);
  const migratedTemplate = readOutputJson<BookVisualContractTemplate>({
    repoRoot: args.repoRoot,
    relativePath: loadedApproval.projection.migratedTemplatePath,
    label: 'migrated Visual Contract template',
  }).value;
  const migratedCoverage = readOutputJson<ActionSemanticCoverageRecord[]>({
    repoRoot: args.repoRoot,
    relativePath: loadedApproval.projection.coveragePath,
    label: 'migrated Action Semantic Coverage',
  }).value;
  if (
    newSnapshot.digest !== loadedApproval.projection.newSnapshotDigest ||
    canonicalJsonDigest(migratedTemplate) !==
      loadedApproval.projection.migratedTemplateDigest ||
    canonicalJsonDigest(migratedCoverage) !== loadedApproval.projection.coverageDigest
  ) {
    throw new Error('approved migration projection is stale');
  }
  const pendingReconciliation = readOutputJson<SourcePromptReconciliation>({
    repoRoot: args.repoRoot,
    relativePath: manifest.reconciliation.path,
    label: 'pending migrated reconciliation',
  }).value;
  const expectedApproved = approvePendingSourcePromptReconciliation({
    pending: pendingReconciliation,
    approvedBy: 'Guy',
    approvedAt: loadedApproval.approvedReview.approvedAt,
  });
  const approvedReconciliation = readOutputJson<SourcePromptReconciliation>({
    repoRoot: args.repoRoot,
    relativePath: loadedApproval.approvedReview.reconciliationPath,
    label: 'approved migrated reconciliation',
  }).value;
  if (
    canonicalJsonDigest(expectedApproved) !==
      loadedApproval.approvedReview.reconciliationDigest ||
    canonicalJsonDigest(approvedReconciliation) !==
      loadedApproval.approvedReview.reconciliationDigest ||
    approvedReconciliation.sourceAuthoritySnapshotDigest !== newSnapshot.digest ||
    canonicalJsonDigest(
      approvedReconciliation.actionSemanticCoverageAuthority.records,
    ) !== canonicalJsonDigest(migratedCoverage)
  ) {
    throw new Error('approved migrated reconciliation bytes are stale');
  }
  const reviewBundle = buildReconciliationReviewBundle({
    reconciliation: approvedReconciliation,
    sourceIdentity: newSnapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: newSnapshot.digest,
    rawStorySource: newSnapshot.content.normalizedRawStorySource,
    template: migratedTemplate,
    ...(newSnapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: newSnapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage: migratedCoverage,
  });
  const markdown = renderReconciliationReviewMarkdown(reviewBundle);
  if (
    !reviewBundle.readyForApproval ||
    reviewBundle.blockingIssues.length > 0 ||
    reviewBundle.digest !== loadedApproval.approvedReview.reviewBundleDigest ||
    sha256(markdown) !== loadedApproval.approvedReview.reviewMarkdownSha256
  ) {
    throw new Error('approved migrated reconciliation review is stale');
  }
  const persistedReview = readOutputJson<ReturnType<typeof buildReconciliationReviewBundle>>({
    repoRoot: args.repoRoot,
    relativePath: loadedApproval.approvedReview.reviewBundlePath,
    label: 'approved migrated reconciliation review bundle',
  });
  const persistedMarkdown = readContainedRegularFile({
    repoRoot: args.repoRoot,
    relativePath: loadedApproval.approvedReview.reviewMarkdownPath,
    allowedRoot: 'outputs',
    label: 'approved migrated reconciliation review markdown',
  }).bytes.toString('utf8');
  if (
    reconciliationDraftBundleJsonBytes(persistedReview.value) !==
      reconciliationDraftBundleJsonBytes(reviewBundle) ||
    persistedMarkdown !== markdown
  ) {
    throw new Error('approved migrated reconciliation review artifacts changed');
  }
  const context = buildProductionAuthoringContextFromApprovedReconciliation({
    repoRoot: args.repoRoot,
    storyKey: manifest.storyKey,
    storyPath: loadedApproval.acceptedRevision.integratedStoryPath,
    templatePath: loadedApproval.projection.migratedTemplatePath,
    reconciliationPath: loadedApproval.approvedReview.reconciliationPath,
    expectedReconciliationDigest:
      loadedApproval.approvedReview.reconciliationDigest,
    styleId: manifest.styleId,
    styleAuthorityPath: sourcePackage.styleAuthority.artifactPath,
    expectedStyleAuthorityDigest: sourcePackage.styleAuthority.digest,
  });
  if (
    context.sourceSnapshot.rawDigest !==
      loadedApproval.acceptedRevision.integratedStorySha256 ||
    context.template.identity.digest !==
      loadedApproval.projection.migratedTemplateDigest ||
    context.reconciliation.digest !==
      loadedApproval.approvedReview.reconciliationDigest
  ) {
    throw new Error('approved migration production context is stale');
  }
  return {
    approval: loadedApproval,
    approvalPath: args.approvalPath,
    manifest,
    sourcePackage,
    newSnapshot,
    migratedTemplate,
    migratedCoverage,
    approvedReconciliation,
    context,
  };
}

function loadBlueprintMigrationManifest(args: {
  repoRoot: string;
  manifestPath: string;
}): StorySourceRevisionBlueprintMigrationManifest {
  const loaded = readOutputJson<StorySourceRevisionBlueprintMigrationManifest>({
    repoRoot: args.repoRoot,
    relativePath: args.manifestPath,
    label: 'Story Source revision Blueprint migration manifest',
  });
  const manifest = loaded.value;
  if (
    !isObject(manifest) ||
    !exactKeys(manifest as unknown as Record<string, unknown>, [
      'blueprint',
      'digest',
      'digestAlgorithm',
      'doesNotAuthorize',
      'externalCounters',
      'productionContextDigest',
      'reconciliationApproval',
      'reviewedContentEdits',
      'sourcePackageRevisionDigest',
      'stage',
      'version',
    ]) ||
    !isObject(manifest.blueprint) ||
    !exactKeys(manifest.blueprint as unknown as Record<string, unknown>, [
      'authoringAuthorityDigest',
      'candidatePath',
      'changedFrameIds',
      'contactSheetPath',
      'digest',
      'provenancePath',
      'readyForApproval',
      'reviewMarkdownPath',
      'reviewPacketDigest',
      'reviewPacketPath',
      'validationEvidencePath',
    ]) ||
    manifest.version !==
      STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_MANIFEST_VERSION ||
    manifest.stage !== 'blueprint_pending' ||
    manifest.digestAlgorithm !== 'canonical-json-sha256' ||
    canonicalJsonDigest(digestPayload(manifest)) !== manifest.digest ||
    !SHA256.test(manifest.digest) ||
    path.posix.basename(args.manifestPath) !== `${manifest.digest}.json` ||
    path.posix.basename(path.posix.dirname(args.manifestPath)) !==
      'story-source-revision-blueprint-migration-manifests' ||
    loaded.bytes !== canonicalContentAddressedJsonBytes(manifest) ||
    manifest.blueprint.readyForApproval !== true ||
    canonicalJsonDigest(manifest.blueprint.changedFrameIds) !==
      canonicalJsonDigest(['frame:page:8']) ||
    canonicalJsonDigest(manifest.reviewedContentEdits) !==
      canonicalJsonDigest([{
        frameId: 'frame:page:8',
        field: 'narrative.summary',
        from: OLD_PAGE_8_SUMMARY,
        to: NEW_PAGE_8_SUMMARY,
      }]) ||
    canonicalJsonDigest(manifest.externalCounters) !==
      canonicalJsonDigest({
        providerCalls: 0,
        imageRenders: 0,
        audioRenders: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: 0,
      }) ||
    canonicalJsonDigest(manifest.doesNotAuthorize) !==
      canonicalJsonDigest(STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_EXCLUSIONS)
  ) {
    throw new Error('Story Source revision Blueprint migration manifest is invalid');
  }
  return manifest;
}

function loadBlueprintMigrationArtifacts(args: {
  repoRoot: string;
  manifest: StorySourceRevisionBlueprintMigrationManifest;
  migration: LoadedApprovedMigration;
}): {
  blueprint: PreRenderBookVisualBlueprint;
  reviewPacket: PreRenderBlueprintReviewPacket;
} {
  const candidate = readOutputJson<PreRenderBookVisualBlueprint>({
    repoRoot: args.repoRoot,
    relativePath: args.manifest.blueprint.candidatePath,
    label: 'Story Source revision Blueprint candidate',
  });
  const review = readOutputJson<PreRenderBlueprintReviewPacket>({
    repoRoot: args.repoRoot,
    relativePath: args.manifest.blueprint.reviewPacketPath,
    label: 'Story Source revision Blueprint review packet',
  });
  if (
    candidate.value.digest !== args.manifest.blueprint.digest ||
    candidate.value.identity.authoringAuthority.digest !==
      args.manifest.blueprint.authoringAuthorityDigest ||
    candidate.bytes !== serializePreRenderBookVisualBlueprint(candidate.value) ||
    review.value.digest !== args.manifest.blueprint.reviewPacketDigest ||
    review.bytes !== preRenderBlueprintLifecycleJsonBytes(review.value)
  ) {
    throw new Error('Story Source revision Blueprint candidate or review changed');
  }
  assertExactMigratedBlueprint({
    source: args.migration.sourcePackage.blueprint.content,
    migratedTemplate: args.migration.migratedTemplate,
    blueprint: candidate.value,
  });
  return { blueprint: candidate.value, reviewPacket: review.value };
}

function blueprintContentProjection(
  value: PreRenderBookVisualBlueprint,
): Record<string, unknown> {
  const {
    identity: _identity,
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...content
  } = value;
  return content;
}

function exactMigratedBlueprintProjection(
  source: PreRenderBookVisualBlueprint,
): PreRenderBookVisualBlueprint {
  const draft = structuredClone(source);
  const frame = draft.frames.find((candidate) => candidate.id === 'frame:page:8');
  if (
    !frame ||
    frame.kind !== 'page' ||
    frame.pageNumber !== 8 ||
    frame.narrative.summary !== OLD_PAGE_8_SUMMARY
  ) {
    throw new Error('source Blueprint page-8 neutral-summary pointer is stale');
  }
  frame.narrative.summary = NEW_PAGE_8_SUMMARY;
  return draft;
}

function blueprintAuthoringDraft(
  source: PreRenderBookVisualBlueprint,
): Record<string, unknown> {
  return {
    worldPlan: structuredClone(source.worldPlan),
    frames: source.frames.map((frame) => ({
      kind: frame.kind,
      pageNumber: frame.kind === 'cover' ? null : frame.pageNumber,
      narrative: structuredClone(frame.narrative),
      placements: structuredClone(frame.placements),
      camera: structuredClone(frame.camera),
      affordanceIds: [...frame.affordanceIds],
      continuity: {
        connectionId: frame.continuity.connectionId ?? null,
        carryoverRefs: structuredClone(frame.continuity.carryoverRefs),
      },
    })),
  };
}

function assertExactMigratedBlueprint(args: {
  source: PreRenderBookVisualBlueprint;
  migratedTemplate: BookVisualContractTemplate;
  blueprint: PreRenderBookVisualBlueprint;
}): void {
  const expected = blueprintContentProjection(
    exactMigratedBlueprintProjection(args.source),
  );
  expected.visualContract = structuredClone(args.migratedTemplate);
  const actual = blueprintContentProjection(args.blueprint);
  if (canonicalJsonDigest(actual) !== canonicalJsonDigest(expected)) {
    throw new Error('source-revision Blueprint contains non-authorized content drift');
  }
}

function blueprintArtifactPlan(args: {
  repoRoot: string;
  outputRoot: string;
  blueprint: PreRenderBookVisualBlueprint;
  authored: PreRenderBlueprintAuthoringResult;
  context: ProductionAuthoringContext;
  previousApproved: {
    blueprint: PreRenderBookVisualBlueprint;
    attestation: PreRenderBlueprintApprovalAttestation;
  };
}): {
  paths: {
    candidate: string;
    provenance: string;
    validationEvidence: string;
    reviewPacket: string;
    reviewMarkdown: string;
    contactSheet: string;
  };
  review: ReturnType<typeof buildPreRenderBlueprintReviewBundle>;
  plans: Array<{ path: string; bytes: string }>;
} {
  const validationEvidence = createPreRenderBlueprintValidationEvidence({
    blueprint: args.blueprint,
    context: args.context.validationContext,
  });
  const review = buildPreRenderBlueprintReviewBundle({
    blueprint: args.blueprint,
    context: args.context.validationContext,
    provenance: args.authored.provenance,
    repairAttempts: args.authored.repairAttempts,
    previousApproved: args.previousApproved,
  });
  const authorityRoot = `${args.outputRoot}/blueprint-lifecycle/authorities/${args.blueprint.identity.authoringAuthority.digest}`;
  const reviewRoot = `${authorityRoot}/reviews/${review.packet.digest}`;
  const paths = {
    candidate: `${authorityRoot}/candidates/${args.blueprint.digest}/blueprint.json`,
    provenance: `${authorityRoot}/provenance/${canonicalJsonDigest(args.authored.provenance)}.json`,
    validationEvidence: `${authorityRoot}/validation/${validationEvidence.digest}.json`,
    reviewPacket: `${reviewRoot}/review.json`,
    reviewMarkdown: `${reviewRoot}/review.${canonicalJsonDigest(review.markdown)}.md`,
    contactSheet: `${reviewRoot}/contact-sheet.${canonicalJsonDigest(review.contactSheetHtml)}.html`,
  };
  return {
    paths,
    review,
    plans: [
      { path: paths.candidate, bytes: serializePreRenderBookVisualBlueprint(args.blueprint) },
      { path: paths.provenance, bytes: preRenderBlueprintLifecycleJsonBytes(args.authored.provenance) },
      { path: paths.validationEvidence, bytes: preRenderBlueprintLifecycleJsonBytes(validationEvidence) },
      { path: paths.reviewPacket, bytes: preRenderBlueprintLifecycleJsonBytes(review.packet) },
      { path: paths.reviewMarkdown, bytes: review.markdown },
      { path: paths.contactSheet, bytes: review.contactSheetHtml },
    ],
  };
}

export async function prepareStorySourceRevisionBlueprintMigration(args: {
  repoRoot: string;
  approvalPath: string;
  write?: boolean;
}): Promise<PreparedStorySourceRevisionBlueprintMigration> {
  const migration = loadApprovedMigration({
    repoRoot: args.repoRoot,
    approvalPath: args.approvalPath,
  });
  if (
    migration.newSnapshot.content.pageImageDirections.find(
      (entry) => entry.pageNumber === 8,
    )?.imageDirection.includes('Kim curled beside the child') !== true
  ) {
    throw new Error('accepted page-8 neutral image direction is missing');
  }
  const previousApproved = {
    blueprint: migration.sourcePackage.blueprint.content,
    attestation: migration.sourcePackage.planningApproval.content,
  };
  const draft = blueprintAuthoringDraft(
    exactMigratedBlueprintProjection(previousApproved.blueprint),
  );
  let callCount = 0;
  const authored = await compilePreRenderBookVisualBlueprint(
    migration.context.validationContext,
    {
      model: 'offline-deterministic-blueprint-author/v3',
      reasoningEffort: 'none',
      maxOutputTokens: 48_000,
    },
    {
      callAuthor: async () => {
        callCount += 1;
        return structuredClone(draft);
      },
    },
  );
  if (
    callCount !== 1 ||
    authored.provenance.callCount !== 1 ||
    authored.repairAttempts.length !== 0
  ) {
    throw new Error('offline Blueprint replay used an unexpected repair path');
  }
  assertExactMigratedBlueprint({
    source: previousApproved.blueprint,
    migratedTemplate: migration.migratedTemplate,
    blueprint: authored.blueprint,
  });
  const outputRoot = outputRootFromManifestPath(
    args.repoRoot,
    migration.approval.pendingManifest.path,
  );
  const planned = blueprintArtifactPlan({
    repoRoot: args.repoRoot,
    outputRoot: outputRoot.relative,
    blueprint: authored.blueprint,
    authored,
    context: migration.context,
    previousApproved,
  });
  if (
    !planned.review.packet.readyForApproval ||
    planned.review.packet.blockers.length > 0 ||
    canonicalJsonDigest(planned.review.packet.priorApprovedDiff.changedFrameIds) !==
      canonicalJsonDigest(['frame:page:8']) ||
    planned.review.packet.priorApprovedDiff.authorityChanged !== true ||
    planned.review.packet.priorApprovedDiff.addedAffordanceIds.length !== 0 ||
    planned.review.packet.priorApprovedDiff.removedAffordanceIds.length !== 0 ||
    planned.review.packet.priorApprovedDiff.addedConnectionIds.length !== 0 ||
    planned.review.packet.priorApprovedDiff.removedConnectionIds.length !== 0
  ) {
    throw new Error('source-revision Blueprint review exposes unexpected drift');
  }
  const manifest = buildDigestArtifact({
    version: STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_MANIFEST_VERSION,
    stage: 'blueprint_pending' as const,
    reconciliationApproval: {
      digest: migration.approval.digest,
      path: migration.approvalPath,
    },
    sourcePackageRevisionDigest: migration.sourcePackage.revisionDigest,
    productionContextDigest: migration.context.digest,
    blueprint: {
      digest: authored.blueprint.digest,
      authoringAuthorityDigest:
        authored.blueprint.identity.authoringAuthority.digest,
      candidatePath: planned.paths.candidate,
      reviewPacketDigest: planned.review.packet.digest,
      reviewPacketPath: planned.paths.reviewPacket,
      reviewMarkdownPath: planned.paths.reviewMarkdown,
      contactSheetPath: planned.paths.contactSheet,
      validationEvidencePath: planned.paths.validationEvidence,
      provenancePath: planned.paths.provenance,
      readyForApproval: true as const,
      changedFrameIds: ['frame:page:8'] as ['frame:page:8'],
    },
    reviewedContentEdits: [{
      frameId: 'frame:page:8' as const,
      field: 'narrative.summary' as const,
      from: OLD_PAGE_8_SUMMARY,
      to: NEW_PAGE_8_SUMMARY,
    }],
    externalCounters: {
      providerCalls: 0 as const,
      imageRenders: 0 as const,
      audioRenders: 0 as const,
      databaseWrites: 0 as const,
      storageWrites: 0 as const,
      locatorWrites: 0 as const,
    },
    doesNotAuthorize: STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_EXCLUSIONS,
  }) as StorySourceRevisionBlueprintMigrationManifest;
  const manifestPath = artifactPath({
    outputRoot: outputRoot.relative,
    category: 'story-source-revision-blueprint-migration-manifests',
    digest: manifest.digest,
  });
  const plans = [
    ...planned.plans,
    { path: manifestPath, bytes: canonicalContentAddressedJsonBytes(manifest) },
  ];
  let persisted: PersistedPreRenderBlueprintLifecycle | null = null;
  if (args.write === true) {
    assertStorySourceRevisionMigrationArtifactPlanIsSafe({
      repoRoot: args.repoRoot,
      outputRoot: outputRoot.absolute,
      artifacts: plans,
    });
    persisted = persistPreRenderBlueprintLifecycle({
      root: path.join(outputRoot.absolute, 'blueprint-lifecycle'),
      blueprint: authored.blueprint,
      context: migration.context.validationContext,
      provenance: authored.provenance,
      repairAttempts: authored.repairAttempts,
      previousApproved,
    });
    const persistedPaths = {
      candidate: repoRelativePath(args.repoRoot, persisted.candidate.path),
      provenance: repoRelativePath(args.repoRoot, persisted.provenance.path),
      validationEvidence: repoRelativePath(
        args.repoRoot,
        persisted.validationEvidence.path,
      ),
      reviewPacket: repoRelativePath(args.repoRoot, persisted.reviewPacket.path),
      reviewMarkdown: repoRelativePath(
        args.repoRoot,
        persisted.reviewMarkdown.path,
      ),
      contactSheet: repoRelativePath(args.repoRoot, persisted.contactSheet.path),
    };
    if (
      canonicalJsonDigest(persistedPaths) !== canonicalJsonDigest(planned.paths) ||
      persisted.review.packet.digest !== planned.review.packet.digest
    ) {
      throw new Error('persisted Blueprint artifacts differ from the preflight plan');
    }
  }
  persistCanonicalJson({
    repoRoot: args.repoRoot,
    relativePath: manifestPath,
    value: manifest,
    write: args.write === true,
  });
  return {
    manifest,
    manifestPath,
    context: migration.context,
    authored,
    persisted,
  };
}

export function recordStorySourceRevisionBlueprintApproval(args: {
  repoRoot: string;
  blueprintMigrationManifestPath: string;
  blueprintDigest: string;
  reviewPacketDigest: string;
  approvedBy: 'Guy';
  approvedAt: string;
  write?: boolean;
}): RecordedStorySourceRevisionBlueprintApproval {
  if (
    args.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(args.approvedAt)
  ) {
    throw new Error('Blueprint approval requires exact Guy and canonical UTC time');
  }
  const manifest = loadBlueprintMigrationManifest({
    repoRoot: args.repoRoot,
    manifestPath: args.blueprintMigrationManifestPath,
  });
  if (
    manifest.blueprint.digest !== args.blueprintDigest ||
    manifest.blueprint.reviewPacketDigest !== args.reviewPacketDigest
  ) {
    throw new Error('Blueprint approval does not bind the reviewed migration artifacts');
  }
  const migration = loadApprovedMigration({
    repoRoot: args.repoRoot,
    approvalPath: manifest.reconciliationApproval.path,
  });
  if (
    migration.approval.digest !== manifest.reconciliationApproval.digest ||
    migration.sourcePackage.revisionDigest !==
      manifest.sourcePackageRevisionDigest ||
    migration.context.digest !== manifest.productionContextDigest
  ) {
    throw new Error('Blueprint migration manifest authority is stale');
  }
  const artifacts = loadBlueprintMigrationArtifacts({
    repoRoot: args.repoRoot,
    manifest,
    migration,
  });
  const outputRoot = outputRootFromManifestPath(
    args.repoRoot,
    args.blueprintMigrationManifestPath,
  );
  const approvalRoot = path.join(outputRoot.absolute, 'blueprint-lifecycle');
  const planned = planPreRenderBlueprintApprovalAttestation({
    root: approvalRoot,
    blueprint: artifacts.blueprint,
    context: migration.context.validationContext,
    reviewPacket: artifacts.reviewPacket,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
  });
  const approvalPath = repoRelativePath(args.repoRoot, planned.approvalPath);
  assertStorySourceRevisionMigrationArtifactPlanIsSafe({
    repoRoot: args.repoRoot,
    outputRoot: outputRoot.absolute,
    artifacts: [{
      path: approvalPath,
      bytes: preRenderBlueprintLifecycleJsonBytes(planned.attestation),
    }],
  });
  let created = false;
  if (args.write === true) {
    const written = writePreRenderBlueprintApprovalAttestation({
      root: approvalRoot,
      blueprint: artifacts.blueprint,
      context: migration.context.validationContext,
      reviewPacket: artifacts.reviewPacket,
      approvedBy: args.approvedBy,
      approvedAt: args.approvedAt,
    });
    if (
      written.attestation.digest !== planned.attestation.digest ||
      repoRelativePath(args.repoRoot, written.artifact.path) !== approvalPath
    ) {
      throw new Error('persisted Blueprint approval differs from its preflight');
    }
    created = written.artifact.created;
  }
  return {
    manifest,
    approval: planned.attestation,
    approvalPath,
    created,
  };
}

export function prepareStorySourceRevisionPackageAssembly(args: {
  repoRoot: string;
  blueprintMigrationManifestPath: string;
  blueprintApprovalPath: string;
  write?: boolean;
}): PreparedStorySourceRevisionPackageAssembly {
  const blueprintManifest = loadBlueprintMigrationManifest({
    repoRoot: args.repoRoot,
    manifestPath: args.blueprintMigrationManifestPath,
  });
  const outputRoot = outputRootFromManifestPath(
    args.repoRoot,
    args.blueprintMigrationManifestPath,
  );
  const migration = loadApprovedMigration({
    repoRoot: args.repoRoot,
    approvalPath: blueprintManifest.reconciliationApproval.path,
  });
  const artifacts = loadBlueprintMigrationArtifacts({
    repoRoot: args.repoRoot,
    manifest: blueprintManifest,
    migration,
  });
  const paths: ApprovedBlueprintLifecyclePaths = {
    blueprintPath: blueprintManifest.blueprint.candidatePath,
    authoringProvenancePath: blueprintManifest.blueprint.provenancePath,
    validationEvidencePath:
      blueprintManifest.blueprint.validationEvidencePath,
    reviewPacketPath: blueprintManifest.blueprint.reviewPacketPath,
    planningApprovalPath: args.blueprintApprovalPath,
  };
  const approvedBlueprint = loadApprovedBlueprintLifecycle({
    repoRoot: args.repoRoot,
    context: migration.context,
    paths,
  });
  if (
    approvedBlueprint.blueprint.content.digest !== artifacts.blueprint.digest ||
    approvedBlueprint.reviewPacket.content.digest !== artifacts.reviewPacket.digest ||
    approvedBlueprint.planningApproval.content.approvedBy !== 'Guy' ||
    args.blueprintApprovalPath !== repoRelativePath(
      args.repoRoot,
      path.join(
        outputRoot.absolute,
        'blueprint-lifecycle',
        'authorities',
        artifacts.blueprint.identity.authoringAuthority.digest,
        'approvals',
        artifacts.blueprint.digest,
        `${approvedBlueprint.planningApproval.content.digest}.json`,
      ),
    )
  ) {
    throw new Error('approved Blueprint lifecycle does not bind the migration');
  }
  const worldMode = migration.sourcePackage.review.worldMode;
  if (worldMode === null) {
    throw new Error('source package world-mode review authority is missing');
  }
  const reviewReality: VisualPackageReviewReality = {
    authoredBy: approvedBlueprint.authoringProvenance.content.model,
    reviewedBy: 'Guy',
    reviewedAt: approvedBlueprint.planningApproval.content.approvedAt,
    worldMode,
  };
  const assembled = assembleVisualPackageV4Candidate({
    repoRoot: args.repoRoot,
    context: migration.context,
    approvedBlueprintPaths: paths,
    review: reviewReality,
  });
  if (
    canonicalJsonDigest(assembled.candidate.content.requiredBoards) !==
      canonicalJsonDigest(migration.sourcePackage.requiredBoards) ||
    canonicalJsonDigest(assembled.candidate.content.requiredPropReferences) !==
      canonicalJsonDigest(migration.sourcePackage.requiredPropReferences)
  ) {
    throw new Error('source revision changed Board or prop authority');
  }
  const qualification = qualifyVisualPackageV4Candidate({
    repoRoot: args.repoRoot,
    candidate: assembled.candidate,
    packageReview: assembled.packageReview,
    approval: null,
  });
  if (
    !qualification.candidateValid ||
    !qualification.reviewReady ||
    qualification.approvalValid ||
    qualification.readyForPublication ||
    qualification.reasons.length !== 1 ||
    qualification.reasons[0]?.code !== 'package_approval_missing'
  ) {
    throw new Error('assembled package is not exactly ready for package approval');
  }
  const packageOutputDir = `${outputRoot.relative}/visual-package-candidate-lifecycle`;
  const persistencePlan = persistVisualPackageV4CandidateReview({
    repoRoot: args.repoRoot,
    outputDir: packageOutputDir,
    candidate: assembled.candidate,
    packageReview: assembled.packageReview,
    write: false,
  });
  const manifest = buildDigestArtifact({
    version: STORY_SOURCE_REVISION_PACKAGE_ASSEMBLY_MANIFEST_VERSION,
    stage: 'package_pending' as const,
    blueprintMigration: {
      digest: blueprintManifest.digest,
      path: args.blueprintMigrationManifestPath,
    },
    blueprintApproval: {
      digest: approvedBlueprint.planningApproval.content.digest,
      path: args.blueprintApprovalPath,
    },
    sourcePackageRevisionDigest: migration.sourcePackage.revisionDigest,
    productionContextDigest: migration.context.digest,
    package: {
      candidateDigest: assembled.candidate.digest,
      candidatePath: persistencePlan.candidatePath,
      reviewDigest: assembled.packageReview.digest,
      reviewPath: persistencePlan.packageReviewPath,
      readyForApproval: true as const,
      qualificationDigest: qualification.digest,
      qualificationReasonCodes: ['package_approval_missing'] as [
        'package_approval_missing',
      ],
    },
    authorityReuse: {
      boardCount: assembled.candidate.content.requiredBoards.length,
      boardsDigest: canonicalJsonDigest(
        assembled.candidate.content.requiredBoards,
      ),
      propReferenceCount:
        assembled.candidate.content.requiredPropReferences.length,
      propReferencesDigest: canonicalJsonDigest(
        assembled.candidate.content.requiredPropReferences,
      ),
      exactSourcePackageMatch: true as const,
    },
    externalCounters: {
      providerCalls: 0 as const,
      imageRenders: 0 as const,
      audioRenders: 0 as const,
      databaseWrites: 0 as const,
      storageWrites: 0 as const,
      locatorWrites: 0 as const,
    },
    doesNotAuthorize: STORY_SOURCE_REVISION_PACKAGE_ASSEMBLY_EXCLUSIONS,
  }) as StorySourceRevisionPackageAssemblyManifest;
  const manifestPath = artifactPath({
    outputRoot: outputRoot.relative,
    category: 'story-source-revision-package-assembly-manifests',
    digest: manifest.digest,
  });
  const plans = [
    {
      path: persistencePlan.candidatePath,
      bytes: `${JSON.stringify(assembled.candidate, null, 2)}\n`,
    },
    {
      path: persistencePlan.packageReviewPath,
      bytes: `${JSON.stringify(assembled.packageReview, null, 2)}\n`,
    },
    { path: manifestPath, bytes: canonicalContentAddressedJsonBytes(manifest) },
  ];
  assertStorySourceRevisionMigrationArtifactPlanIsSafe({
    repoRoot: args.repoRoot,
    outputRoot: outputRoot.absolute,
    artifacts: plans,
  });
  let persisted: ReturnType<typeof persistVisualPackageV4CandidateReview> | null =
    null;
  if (args.write === true) {
    persisted = persistVisualPackageV4CandidateReview({
      repoRoot: args.repoRoot,
      outputDir: packageOutputDir,
      candidate: assembled.candidate,
      packageReview: assembled.packageReview,
      write: true,
    });
    if (
      persisted.candidatePath !== persistencePlan.candidatePath ||
      persisted.packageReviewPath !== persistencePlan.packageReviewPath
    ) {
      throw new Error('persisted package artifacts differ from the preflight');
    }
  }
  persistCanonicalJson({
    repoRoot: args.repoRoot,
    relativePath: manifestPath,
    value: manifest,
    write: args.write === true,
  });
  return {
    manifest,
    manifestPath,
    context: migration.context,
    candidate: assembled.candidate,
    packageReview: assembled.packageReview,
    qualification,
    persisted,
  };
}
