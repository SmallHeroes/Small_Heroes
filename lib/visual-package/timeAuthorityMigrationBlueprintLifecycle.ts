import { readFileSync } from 'fs';

import {
  compilePreRenderBookVisualBlueprint,
  type PreRenderBlueprintAuthoringConfig,
  type PreRenderBlueprintAuthoringResult,
} from './preRenderBlueprintAuthoring';
import {
  persistPreRenderBlueprintLifecycle,
  PRE_RENDER_BLUEPRINT_APPROVER,
  writePreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintArtifactWrite,
  type PreRenderBlueprintReviewPacket,
  type PersistedPreRenderBlueprintLifecycle,
} from './preRenderBlueprintLifecycle';
import { canonicalJsonDigest, resolveRepoPath } from './integrity';
import type { PreRenderBookVisualBlueprint } from './preRenderBlueprintTypes';
import {
  loadApprovedTimeAuthorityMigration,
  type TimeAuthorityMigrationManifest,
} from './timeAuthorityMigrationLifecycle';
import type { ProductionAuthoringContext } from './productionAuthoringContext';

function blueprintContentProjection(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const {
    identity: _identity,
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...content
  } = value;
  return content;
}

export interface PrepareTimeAuthorityMigratedBlueprintArgs {
  repoRoot: string;
  approvedManifestPath: string;
  draft: unknown;
  outputRoot: string;
  authoringConfig: PreRenderBlueprintAuthoringConfig;
}

export interface PreparedTimeAuthorityMigratedBlueprint {
  manifest: TimeAuthorityMigrationManifest;
  context: ProductionAuthoringContext;
  authored: PreRenderBlueprintAuthoringResult;
  persisted: PersistedPreRenderBlueprintLifecycle;
}

export interface ApproveTimeAuthorityMigratedBlueprintArgs {
  repoRoot: string;
  approvedManifestPath: string;
  outputRoot: string;
  candidatePath: string;
  reviewPath: string;
  approvedBy: typeof PRE_RENDER_BLUEPRINT_APPROVER;
  approvedAt: string;
  note?: string;
}

export interface ApprovedTimeAuthorityMigratedBlueprint {
  manifest: TimeAuthorityMigrationManifest;
  context: ProductionAuthoringContext;
  attestation: PreRenderBlueprintApprovalAttestation;
  artifact: PreRenderBlueprintArtifactWrite;
}

function readJson<T>(filePath: string, label: string): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    throw new Error(`${label} is missing or invalid JSON`);
  }
}

function canonicalUtcTimestampIsValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function assertExactTimeAuthorityBlueprint(args: {
  source: PreRenderBookVisualBlueprint;
  migratedTemplate: ProductionAuthoringContext['template']['content'];
  blueprint: PreRenderBookVisualBlueprint;
}): void {
  const expectedContent = blueprintContentProjection(
    args.source as unknown as Record<string, unknown>,
  );
  expectedContent.visualContract = structuredClone(args.migratedTemplate);
  const actualContent = blueprintContentProjection(
    args.blueprint as unknown as Record<string, unknown>,
  );
  if (
    canonicalJsonDigest(actualContent) !== canonicalJsonDigest(expectedContent)
  ) {
    throw new Error(
      'time-authority migrated Blueprint contains non-time content drift',
    );
  }
}

/**
 * Prepare a fresh Blueprint candidate/review from an approved time migration.
 * This lane is offline-only: its author callback returns the caller-supplied
 * recorded draft and has no provider, network, credential, or transport-retry
 * boundary.
 */
export async function prepareTimeAuthorityMigratedBlueprint(
  args: PrepareTimeAuthorityMigratedBlueprintArgs,
): Promise<PreparedTimeAuthorityMigratedBlueprint> {
  const migration = loadApprovedTimeAuthorityMigration({
    repoRoot: args.repoRoot,
    approvedManifestPath: args.approvedManifestPath,
  });
  const authored = await compilePreRenderBookVisualBlueprint(
    migration.context.validationContext,
    args.authoringConfig,
    {
      callAuthor: async () => structuredClone(args.draft),
    },
  );
  assertExactTimeAuthorityBlueprint({
    source: migration.previousApproved.blueprint,
    migratedTemplate: migration.context.template.content,
    blueprint: authored.blueprint,
  });
  const persisted = persistPreRenderBlueprintLifecycle({
    root: resolveRepoPath(args.repoRoot, args.outputRoot),
    blueprint: authored.blueprint,
    context: migration.context.validationContext,
    provenance: authored.provenance,
    repairAttempts: authored.repairAttempts,
    previousApproved: migration.previousApproved,
  });
  return {
    manifest: migration.manifest,
    context: migration.context,
    authored,
    persisted,
  };
}

/**
 * Record Guy's exact-digest planning approval for a Blueprint prepared from
 * the same approved time migration. The production context and historical
 * Blueprint authority are reconstructed from the approved manifest; callers
 * cannot substitute either one.
 */
export function approveTimeAuthorityMigratedBlueprint(
  args: ApproveTimeAuthorityMigratedBlueprintArgs,
): ApprovedTimeAuthorityMigratedBlueprint {
  if (!canonicalUtcTimestampIsValid(args.approvedAt)) {
    throw new Error('approvedAt must be a canonical UTC ISO timestamp');
  }
  const migration = loadApprovedTimeAuthorityMigration({
    repoRoot: args.repoRoot,
    approvedManifestPath: args.approvedManifestPath,
  });
  const blueprint = readJson<PreRenderBookVisualBlueprint>(
    resolveRepoPath(args.repoRoot, args.candidatePath),
    'time-authority migrated Blueprint candidate',
  );
  const reviewPacket = readJson<PreRenderBlueprintReviewPacket>(
    resolveRepoPath(args.repoRoot, args.reviewPath),
    'time-authority migrated Blueprint review',
  );
  assertExactTimeAuthorityBlueprint({
    source: migration.previousApproved.blueprint,
    migratedTemplate: migration.context.template.content,
    blueprint,
  });
  const approved = writePreRenderBlueprintApprovalAttestation({
    root: resolveRepoPath(args.repoRoot, args.outputRoot),
    blueprint,
    context: migration.context.validationContext,
    reviewPacket,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    ...(args.note !== undefined ? { note: args.note } : {}),
  });
  return {
    manifest: migration.manifest,
    context: migration.context,
    attestation: approved.attestation,
    artifact: approved.artifact,
  };
}
