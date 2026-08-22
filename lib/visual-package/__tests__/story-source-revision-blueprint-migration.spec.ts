import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import { resolveRepoPath } from '../integrity';
import {
  STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_EXCLUSIONS,
  prepareStorySourceRevisionBlueprintMigration,
  recordStorySourceRevisionReconciliationApproval,
} from '../storySourceRevisionBlueprintMigrationLifecycle';
import { prepareStorySourceRevisionPackageMigration } from '../storySourceRevisionPackageMigrationLifecycle';

const REPO_ROOT = process.cwd();
const STORY_KEY = 'chameleon_koko_bedtime';
const STYLE_ID = 'soft_hand_drawn_storybook';
const LOCATOR_PATH =
  'visual-packages/approved/chameleon_koko_bedtime.soft_hand_drawn_storybook.visual-package-current.json';
const ACCEPTED_MANIFEST_PATH =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/manifest.json';
const APPROVED_AT = '2026-08-22T12:13:27.349Z';

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
});
