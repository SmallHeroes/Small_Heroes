import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import { resolveRepoPath } from '../integrity';
import {
  STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_EXCLUSIONS,
  STORY_SOURCE_REVISION_PACKAGE_ASSEMBLY_EXCLUSIONS,
  prepareStorySourceRevisionBlueprintMigration,
  prepareStorySourceRevisionPackageAssembly,
  recordStorySourceRevisionBlueprintApproval,
  recordStorySourceRevisionReconciliationApproval,
} from '../storySourceRevisionBlueprintMigrationLifecycle';
import { prepareStorySourceRevisionPackageMigration } from '../storySourceRevisionPackageMigrationLifecycle';
import { loadVisualPackageV4Revision } from '../visualPackageV4';

const REPO_ROOT = process.cwd();
const STORY_KEY = 'chameleon_koko_bedtime';
const STYLE_ID = 'soft_hand_drawn_storybook';
const LOCATOR_PATH =
  'visual-packages/approved/chameleon_koko_bedtime.soft_hand_drawn_storybook.visual-package-current.json';
const ACCEPTED_MANIFEST_PATH =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/manifest.json';
const APPROVED_AT = '2026-08-22T12:13:27.349Z';
const BLUEPRINT_APPROVED_AT = '2026-08-22T14:37:11.208Z';

function freshOutputRoot(label: string): { relative: string; absolute: string } {
  const relative = `outputs/qa-story-source-blueprint-${label}-${process.pid}-${Date.now()}`;
  return { relative, absolute: resolveRepoPath(REPO_ROOT, relative) };
}

function preparePhaseOne(outputDir: string) {
  return prepareStorySourceRevisionPackageMigration({
    repoRoot: REPO_ROOT,
    outputDir,
    storyKey: STORY_KEY,
    styleId: STYLE_ID,
    locatorPath: LOCATOR_PATH,
    acceptedRevisionManifestPath: ACCEPTED_MANIFEST_PATH,
    write: true,
  });
}

function approvePhaseOne(
  prepared: ReturnType<typeof preparePhaseOne>,
  write = true,
) {
  return recordStorySourceRevisionReconciliationApproval({
    repoRoot: REPO_ROOT,
    pendingManifestPath: prepared.artifacts.manifestPath,
    pendingReconciliationDigest: prepared.manifest.reconciliation.digest,
    pendingReviewBundleDigest:
      prepared.manifest.reconciliation.reviewBundleDigest,
    approvedBy: 'Guy',
    approvedAt: APPROVED_AT,
    write,
  });
}

async function prepareBlueprint(
  phaseOne: ReturnType<typeof preparePhaseOne>,
) {
  const reconciliationApproval = approvePhaseOne(phaseOne);
  return prepareStorySourceRevisionBlueprintMigration({
    repoRoot: REPO_ROOT,
    approvalPath: reconciliationApproval.approvalPath,
    write: true,
  });
}

function approveBlueprint(
  prepared: Awaited<ReturnType<typeof prepareBlueprint>>,
  write = true,
) {
  return recordStorySourceRevisionBlueprintApproval({
    repoRoot: REPO_ROOT,
    blueprintMigrationManifestPath: prepared.manifestPath,
    blueprintDigest: prepared.manifest.blueprint.digest,
    reviewPacketDigest: prepared.manifest.blueprint.reviewPacketDigest,
    approvedBy: 'Guy',
    approvedAt: BLUEPRINT_APPROVED_AT,
    write,
  });
}

function cleanup(absolute: string): void {
  if (!fs.existsSync(absolute)) return;
  const allowed = path.join(REPO_ROOT, 'outputs') + path.sep;
  const resolved = path.resolve(absolute);
  if (!resolved.startsWith(allowed)) throw new Error('test cleanup escaped outputs');
  fs.rmSync(resolved, { recursive: true, force: true });
}

describe('Story Source revision reconciliation and Blueprint migration', () => {
  it('records exact Guy reconciliation approval and prepares one offline page-8-only Blueprint revision', async () => {
    const output = freshOutputRoot('happy');
    try {
      const phaseOne = preparePhaseOne(output.relative);
      const approval = approvePhaseOne(phaseOne);
      expect(approval.artifacts.approvalCreated).toBe(true);
      expect(approval.reviewBundle.readyForApproval).toBe(true);
      expect(approval.reviewBundle.blockingIssues).toEqual([]);
      expect(approval.approvedReconciliation.review).toEqual({
        status: 'approved',
        reviewedBy: 'Guy',
        reviewedAt: APPROVED_AT,
      });
      expect(
        approval.approvedReconciliation.presentationRequirementDispositions.entries.every(
          (entry) =>
            entry.review.status === 'approved' &&
            entry.review.reviewedBy === 'Guy' &&
            entry.review.reviewedAt === APPROVED_AT,
        ),
      ).toBe(true);

      const migrated = await prepareStorySourceRevisionBlueprintMigration({
        repoRoot: REPO_ROOT,
        approvalPath: approval.approvalPath,
        write: true,
      });
      expect(migrated.persisted?.candidate.created).toBe(true);
      expect(migrated.authored.provenance).toMatchObject({
        model: 'offline-deterministic-blueprint-author/v3',
        reasoningEffort: 'none',
        callCount: 1,
        passingAttempt: 1,
        noFallback: true,
      });
      expect(migrated.authored.repairAttempts).toEqual([]);
      expect(migrated.manifest.blueprint.changedFrameIds).toEqual([
        'frame:page:8',
      ]);
      expect(migrated.manifest.externalCounters).toEqual({
        providerCalls: 0,
        imageRenders: 0,
        audioRenders: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: 0,
      });
      expect(migrated.manifest.doesNotAuthorize).toEqual(
        STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_EXCLUSIONS,
      );
      expect(migrated.context.sourceSnapshot.identity.path).toBe(
        phaseOne.manifest.acceptedRevision.integratedStoryPath,
      );
      expect(
        migrated.authored.blueprint.frames.find(
          (frame) => frame.id === 'frame:page:8',
        )?.narrative.summary,
      ).toContain('Kim beside the child');
      expect(JSON.stringify(migrated.authored.blueprint)).not.toContain(
        'Kim beside her',
      );
      expect(fs.existsSync(resolveRepoPath(REPO_ROOT, migrated.manifestPath))).toBe(
        true,
      );
    } finally {
      cleanup(output.absolute);
    }
  });

  it('previews without writing and replays exact immutable bytes', async () => {
    const output = freshOutputRoot('replay');
    try {
      const phaseOne = preparePhaseOne(output.relative);
      const approvalPreview = approvePhaseOne(phaseOne, false);
      expect(approvalPreview.artifacts.approvalCreated).toBe(false);
      expect(fs.existsSync(resolveRepoPath(REPO_ROOT, approvalPreview.approvalPath))).toBe(
        false,
      );
      const approval = approvePhaseOne(phaseOne, true);
      const preview = await prepareStorySourceRevisionBlueprintMigration({
        repoRoot: REPO_ROOT,
        approvalPath: approval.approvalPath,
        write: false,
      });
      expect(preview.persisted).toBeNull();
      expect(fs.existsSync(resolveRepoPath(REPO_ROOT, preview.manifestPath))).toBe(
        false,
      );
      const first = await prepareStorySourceRevisionBlueprintMigration({
        repoRoot: REPO_ROOT,
        approvalPath: approval.approvalPath,
        write: true,
      });
      const inventoryBefore = fs
        .readdirSync(output.absolute, { recursive: true })
        .map(String)
        .sort();
      const manifestBytes = fs.readFileSync(
        resolveRepoPath(REPO_ROOT, first.manifestPath),
      );
      const second = await prepareStorySourceRevisionBlueprintMigration({
        repoRoot: REPO_ROOT,
        approvalPath: approval.approvalPath,
        write: true,
      });
      expect(second.persisted?.candidate.created).toBe(false);
      expect(second.manifest.digest).toBe(first.manifest.digest);
      expect(
        fs.readFileSync(resolveRepoPath(REPO_ROOT, second.manifestPath)),
      ).toEqual(manifestBytes);
      expect(
        fs.readdirSync(output.absolute, { recursive: true }).map(String).sort(),
      ).toEqual(inventoryBefore);
    } finally {
      cleanup(output.absolute);
    }
  });

  it('rejects wrong digest, approver and noncanonical time before approval writes', () => {
    const output = freshOutputRoot('approval-reject');
    try {
      const phaseOne = preparePhaseOne(output.relative);
      const approvalRoot = path.join(
        output.absolute,
        'story-source-revision-reconciliation-approvals',
      );
      expect(() =>
        recordStorySourceRevisionReconciliationApproval({
          repoRoot: REPO_ROOT,
          pendingManifestPath: phaseOne.artifacts.manifestPath,
          pendingReconciliationDigest: '0'.repeat(64),
          pendingReviewBundleDigest:
            phaseOne.manifest.reconciliation.reviewBundleDigest,
          approvedBy: 'Guy',
          approvedAt: APPROVED_AT,
          write: true,
        }),
      ).toThrow('does not bind the exact pending review');
      expect(() =>
        recordStorySourceRevisionReconciliationApproval({
          repoRoot: REPO_ROOT,
          pendingManifestPath: phaseOne.artifacts.manifestPath,
          pendingReconciliationDigest: phaseOne.manifest.reconciliation.digest,
          pendingReviewBundleDigest:
            phaseOne.manifest.reconciliation.reviewBundleDigest,
          approvedBy: 'Claude' as 'Guy',
          approvedAt: APPROVED_AT,
          write: true,
        }),
      ).toThrow('does not bind the exact pending review');
      expect(() =>
        recordStorySourceRevisionReconciliationApproval({
          repoRoot: REPO_ROOT,
          pendingManifestPath: phaseOne.artifacts.manifestPath,
          pendingReconciliationDigest: phaseOne.manifest.reconciliation.digest,
          pendingReviewBundleDigest:
            phaseOne.manifest.reconciliation.reviewBundleDigest,
          approvedBy: 'Guy',
          approvedAt: '2026-08-22T12:13:27Z',
          write: true,
        }),
      ).toThrow('identity or timestamp is invalid');
      expect(fs.existsSync(approvalRoot)).toBe(false);
    } finally {
      cleanup(output.absolute);
    }
  });

  it('rejects tampered approval and Blueprint collisions without recreating a deleted manifest', async () => {
    const output = freshOutputRoot('tamper');
    try {
      const phaseOne = preparePhaseOne(output.relative);
      const approval = approvePhaseOne(phaseOne);
      const approvalAbsolute = resolveRepoPath(REPO_ROOT, approval.approvalPath);
      fs.appendFileSync(approvalAbsolute, 'tamper', 'utf8');
      await expect(
        prepareStorySourceRevisionBlueprintMigration({
          repoRoot: REPO_ROOT,
          approvalPath: approval.approvalPath,
          write: true,
        }),
      ).rejects.toThrow();
      fs.writeFileSync(
        approvalAbsolute,
        canonicalContentAddressedJsonBytes(approval.approval),
        'utf8',
      );
      const first = await prepareStorySourceRevisionBlueprintMigration({
        repoRoot: REPO_ROOT,
        approvalPath: approval.approvalPath,
        write: true,
      });
      const candidateAbsolute = resolveRepoPath(
        REPO_ROOT,
        first.manifest.blueprint.candidatePath,
      );
      const manifestAbsolute = resolveRepoPath(REPO_ROOT, first.manifestPath);
      fs.unlinkSync(manifestAbsolute);
      fs.appendFileSync(candidateAbsolute, 'tamper', 'utf8');
      await expect(
        prepareStorySourceRevisionBlueprintMigration({
          repoRoot: REPO_ROOT,
          approvalPath: approval.approvalPath,
          write: true,
        }),
      ).rejects.toThrow(
        'migration output artifact conflicts with requested immutable bytes',
      );
      expect(fs.existsSync(manifestAbsolute)).toBe(false);
    } finally {
      cleanup(output.absolute);
    }
  });

  it('records the exact Blueprint approval and assembles one replayable package pending exact Guy approval', async () => {
    const output = freshOutputRoot('package-happy');
    try {
      const phaseOne = preparePhaseOne(output.relative);
      const blueprint = await prepareBlueprint(phaseOne);
      const approvalPreview = approveBlueprint(blueprint, false);
      expect(approvalPreview.created).toBe(false);
      expect(
        fs.existsSync(resolveRepoPath(REPO_ROOT, approvalPreview.approvalPath)),
      ).toBe(false);

      const approval = approveBlueprint(blueprint, true);
      expect(approval.created).toBe(true);
      const approvalReplay = approveBlueprint(blueprint, true);
      expect(approvalReplay.created).toBe(false);
      expect(approvalReplay.approval.digest).toBe(approval.approval.digest);

      const preview = prepareStorySourceRevisionPackageAssembly({
        repoRoot: REPO_ROOT,
        blueprintMigrationManifestPath: blueprint.manifestPath,
        blueprintApprovalPath: approval.approvalPath,
        write: false,
      });
      expect(preview.persisted).toBeNull();
      expect(
        fs.existsSync(resolveRepoPath(REPO_ROOT, preview.manifestPath)),
      ).toBe(false);
      expect(preview.qualification).toMatchObject({
        candidateValid: true,
        reviewReady: true,
        approvalValid: false,
        readyForPublication: false,
      });
      expect(preview.qualification.reasons.map((reason) => reason.code)).toEqual([
        'package_approval_missing',
      ]);
      expect(preview.manifest.externalCounters).toEqual({
        providerCalls: 0,
        imageRenders: 0,
        audioRenders: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: 0,
      });
      expect(preview.manifest.doesNotAuthorize).toEqual(
        STORY_SOURCE_REVISION_PACKAGE_ASSEMBLY_EXCLUSIONS,
      );
      const sourcePackage = loadVisualPackageV4Revision({
        repoRoot: REPO_ROOT,
        packagePath: phaseOne.manifest.sourcePackage.packagePath,
        expectedRevisionDigest: phaseOne.manifest.sourcePackage.revisionDigest,
      });
      expect(preview.candidate.content.requiredBoards).toEqual(
        sourcePackage.requiredBoards,
      );
      expect(preview.candidate.content.requiredPropReferences).toEqual(
        sourcePackage.requiredPropReferences,
      );
      expect(preview.manifest.authorityReuse).toMatchObject({
        boardCount: 2,
        propReferenceCount: 0,
        exactSourcePackageMatch: true,
      });
      expect(preview.candidate.content.sourceSnapshot.identity.path).toBe(
        phaseOne.manifest.acceptedRevision.integratedStoryPath,
      );
      expect(preview.candidate.content.blueprint.content.digest).toBe(
        blueprint.manifest.blueprint.digest,
      );

      const first = prepareStorySourceRevisionPackageAssembly({
        repoRoot: REPO_ROOT,
        blueprintMigrationManifestPath: blueprint.manifestPath,
        blueprintApprovalPath: approval.approvalPath,
        write: true,
      });
      expect(first.persisted?.wrote).toBe(true);
      const inventoryBefore = fs
        .readdirSync(output.absolute, { recursive: true })
        .map(String)
        .sort();
      const manifestBytes = fs.readFileSync(
        resolveRepoPath(REPO_ROOT, first.manifestPath),
      );
      const second = prepareStorySourceRevisionPackageAssembly({
        repoRoot: REPO_ROOT,
        blueprintMigrationManifestPath: blueprint.manifestPath,
        blueprintApprovalPath: approval.approvalPath,
        write: true,
      });
      expect(second.candidate.digest).toBe(first.candidate.digest);
      expect(second.packageReview.digest).toBe(first.packageReview.digest);
      expect(
        fs.readFileSync(resolveRepoPath(REPO_ROOT, second.manifestPath)),
      ).toEqual(manifestBytes);
      expect(
        fs.readdirSync(output.absolute, { recursive: true }).map(String).sort(),
      ).toEqual(inventoryBefore);
    } finally {
      cleanup(output.absolute);
    }
  });

  it('rejects invalid Blueprint approvals and package collisions before partial writes', async () => {
    const output = freshOutputRoot('package-reject');
    try {
      const phaseOne = preparePhaseOne(output.relative);
      const blueprint = await prepareBlueprint(phaseOne);
      const approvalRoot = path.join(output.absolute, 'blueprint-lifecycle', 'approvals');
      expect(() =>
        recordStorySourceRevisionBlueprintApproval({
          repoRoot: REPO_ROOT,
          blueprintMigrationManifestPath: blueprint.manifestPath,
          blueprintDigest: '0'.repeat(64),
          reviewPacketDigest: blueprint.manifest.blueprint.reviewPacketDigest,
          approvedBy: 'Guy',
          approvedAt: BLUEPRINT_APPROVED_AT,
          write: true,
        }),
      ).toThrow('does not bind the reviewed migration artifacts');
      expect(() =>
        recordStorySourceRevisionBlueprintApproval({
          repoRoot: REPO_ROOT,
          blueprintMigrationManifestPath: blueprint.manifestPath,
          blueprintDigest: blueprint.manifest.blueprint.digest,
          reviewPacketDigest: blueprint.manifest.blueprint.reviewPacketDigest,
          approvedBy: 'Claude' as 'Guy',
          approvedAt: BLUEPRINT_APPROVED_AT,
          write: true,
        }),
      ).toThrow('requires exact Guy and canonical UTC time');
      expect(() =>
        recordStorySourceRevisionBlueprintApproval({
          repoRoot: REPO_ROOT,
          blueprintMigrationManifestPath: blueprint.manifestPath,
          blueprintDigest: blueprint.manifest.blueprint.digest,
          reviewPacketDigest: blueprint.manifest.blueprint.reviewPacketDigest,
          approvedBy: 'Guy',
          approvedAt: '2026-08-22T14:37:11Z',
          write: true,
        }),
      ).toThrow('requires exact Guy and canonical UTC time');
      expect(fs.existsSync(approvalRoot)).toBe(false);

      const approval = approveBlueprint(blueprint, true);
      const alternateApprovalPath = `${output.relative}/alternate-approval.json`;
      fs.copyFileSync(
        resolveRepoPath(REPO_ROOT, approval.approvalPath),
        resolveRepoPath(REPO_ROOT, alternateApprovalPath),
      );
      expect(() =>
        prepareStorySourceRevisionPackageAssembly({
          repoRoot: REPO_ROOT,
          blueprintMigrationManifestPath: blueprint.manifestPath,
          blueprintApprovalPath: alternateApprovalPath,
          write: false,
        }),
      ).toThrow('approved Blueprint lifecycle does not bind the migration');
      const first = prepareStorySourceRevisionPackageAssembly({
        repoRoot: REPO_ROOT,
        blueprintMigrationManifestPath: blueprint.manifestPath,
        blueprintApprovalPath: approval.approvalPath,
        write: true,
      });
      const manifestAbsolute = resolveRepoPath(REPO_ROOT, first.manifestPath);
      const reviewAbsolute = resolveRepoPath(
        REPO_ROOT,
        first.manifest.package.reviewPath,
      );
      fs.unlinkSync(manifestAbsolute);
      fs.appendFileSync(reviewAbsolute, 'tamper', 'utf8');
      expect(() =>
        prepareStorySourceRevisionPackageAssembly({
          repoRoot: REPO_ROOT,
          blueprintMigrationManifestPath: blueprint.manifestPath,
          blueprintApprovalPath: approval.approvalPath,
          write: true,
        }),
      ).toThrow(
        'migration output artifact conflicts with requested immutable bytes',
      );
      expect(fs.existsSync(manifestAbsolute)).toBe(false);
    } finally {
      cleanup(output.absolute);
    }
  });
});
