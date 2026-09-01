import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import { resolveRepoPath } from '../integrity';
import {
  STORY_SOURCE_REVISION_BLUEPRINT_MIGRATION_EXCLUSIONS,
  STORY_SOURCE_REVISION_PACKAGE_ASSEMBLY_EXCLUSIONS,
  STORY_SOURCE_REVISION_PACKAGE_PROMOTION_EXCLUSIONS,
  publishStorySourceRevisionPackage,
  prepareStorySourceRevisionBlueprintMigration,
  prepareStorySourceRevisionPackageAssembly,
  recordStorySourceRevisionPackageApproval,
  recordStorySourceRevisionBlueprintApproval,
  recordStorySourceRevisionReconciliationApproval,
} from '../storySourceRevisionBlueprintMigrationLifecycle';
import { prepareStorySourceRevisionPackageMigration } from '../storySourceRevisionPackageMigrationLifecycle';
import { loadVisualPackageV4Revision } from '../visualPackageV4';

const REPO_ROOT = process.cwd();
const STORY_KEY = 'chameleon_koko_bedtime';
const STYLE_ID = 'soft_hand_drawn_storybook';
const HISTORICAL_PACKAGE_PATH =
  'visual-packages/approved/revisions/a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb.visual-package.json';
const HISTORICAL_PACKAGE_DIGEST =
  'a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb';
const ACCEPTED_MANIFEST_PATH =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/manifest.json';
const APPROVED_AT = '2026-08-22T12:13:27.349Z';
const BLUEPRINT_APPROVED_AT = '2026-08-22T14:37:11.208Z';
const PACKAGE_APPROVED_AT = '2026-08-22T16:21:43.109Z';
const PACKAGE_PUBLISHED_AT = '2026-08-22T16:22:07.441Z';

function freshOutputRoot(label: string): { relative: string; absolute: string } {
  const relative = `outputs/qa-story-source-blueprint-${label}-${process.pid}-${Date.now()}`;
  return { relative, absolute: resolveRepoPath(REPO_ROOT, relative) };
}

function preparePhaseOne(outputDir: string) {
  const historicalLocatorPath = `${outputDir}-historical-locator.json`;
  const historicalLocatorAbsolute = resolveRepoPath(
    REPO_ROOT,
    historicalLocatorPath,
  );
  fs.mkdirSync(path.dirname(historicalLocatorAbsolute), { recursive: true });
  fs.writeFileSync(historicalLocatorAbsolute, historicalLocatorBytes(), 'utf8');
  return prepareStorySourceRevisionPackageMigration({
    repoRoot: REPO_ROOT,
    outputDir,
    storyKey: STORY_KEY,
    styleId: STYLE_ID,
    locatorPath: historicalLocatorPath,
    acceptedRevisionManifestPath: ACCEPTED_MANIFEST_PATH,
    write: true,
  });
}

function historicalLocatorBytes(): string {
  return `${JSON.stringify({
    version: 'visual-package-current-locator/v3',
    storyKey: STORY_KEY,
    styleId: STYLE_ID,
    packagePath: HISTORICAL_PACKAGE_PATH,
    revisionDigest: HISTORICAL_PACKAGE_DIGEST,
  }, null, 2)}\n`;
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

async function preparePackage(outputDir: string) {
  const phaseOne = preparePhaseOne(outputDir);
  const blueprint = await prepareBlueprint(phaseOne);
  const blueprintApproval = approveBlueprint(blueprint);
  const packageAssembly = prepareStorySourceRevisionPackageAssembly({
    repoRoot: REPO_ROOT,
    blueprintMigrationManifestPath: blueprint.manifestPath,
    blueprintApprovalPath: blueprintApproval.approvalPath,
    write: true,
  });
  return { phaseOne, blueprint, blueprintApproval, packageAssembly };
}

function approvePackage(
  prepared: Awaited<ReturnType<typeof preparePackage>>,
  write = true,
) {
  return recordStorySourceRevisionPackageApproval({
    repoRoot: REPO_ROOT,
    packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
    packageCandidateDigest: prepared.packageAssembly.candidate.digest,
    packageReviewDigest: prepared.packageAssembly.packageReview.digest,
    approvedBy: 'Guy',
    approvedAt: PACKAGE_APPROVED_AT,
    write,
  });
}

function prepareApprovedPackagesDirectory(output: {
  relative: string;
  absolute: string;
}): { relative: string; absolute: string; locatorPath: string } {
  const relative = `${output.relative}/approved-packages`;
  const absolute = resolveRepoPath(REPO_ROOT, relative);
  fs.mkdirSync(absolute, { recursive: true });
  const locatorPath = `${relative}/${STORY_KEY}.${STYLE_ID}.visual-package-current.json`;
  fs.writeFileSync(
    resolveRepoPath(REPO_ROOT, locatorPath),
    historicalLocatorBytes(),
    'utf8',
  );
  return { relative, absolute, locatorPath };
}

function cleanup(absolute: string): void {
  const allowed = path.join(REPO_ROOT, 'outputs') + path.sep;
  const resolved = path.resolve(absolute);
  if (!resolved.startsWith(allowed)) throw new Error('test cleanup escaped outputs');
  if (fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  const historicalLocator = `${resolved}-historical-locator.json`;
  if (fs.existsSync(historicalLocator)) fs.unlinkSync(historicalLocator);
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

  it('binds the legacy semantic-consumer migration producer through current choices in one call without identity drift', async () => {
    const output = freshOutputRoot('consumer-choice-producer');
    try {
      const phaseOne = preparePhaseOne(output.relative);
      const approval = approvePhaseOne(phaseOne);
      const sourcePackage = loadVisualPackageV4Revision({
        repoRoot: REPO_ROOT,
        packagePath: phaseOne.manifest.sourcePackage.packagePath,
        expectedRevisionDigest: phaseOne.manifest.sourcePackage.revisionDigest,
      });
      const sourceAffordances =
        sourcePackage.blueprint.content.worldPlan.affordances;
      expect(
        sourceAffordances.some((affordance) =>
          affordance.consumers.some(
            (consumer) =>
              consumer.kind !== 'frame' &&
              !Object.prototype.hasOwnProperty.call(consumer, 'choiceIndex'),
          ),
        ),
      ).toBe(true);

      const migrated = await prepareStorySourceRevisionBlueprintMigration({
        repoRoot: REPO_ROOT,
        approvalPath: approval.approvalPath,
        write: false,
      });

      expect(migrated.authored.provenance).toMatchObject({
        callCount: 1,
        passingAttempt: 1,
        draftSchemaVersion: 'pre-render-blueprint-draft-schema/v8',
        promptVersion: 'pre-render-blueprint-authoring-prompt/v9',
      });
      expect(migrated.authored.repairAttempts).toEqual([]);
      expect(migrated.authored.blueprint.worldPlan.affordances).toEqual(
        sourceAffordances,
      );
      expect(
        JSON.stringify(migrated.authored.blueprint.worldPlan.affordances),
      ).not.toContain('choiceIndex');
      for (const frame of migrated.authored.blueprint.frames) {
        const cameraAffordance =
          migrated.authored.blueprint.worldPlan.affordances.find(
            (affordance) => affordance.id === frame.camera.affordanceId,
          );
        expect(cameraAffordance?.kind).toBe('camera_access');
        expect(cameraAffordance?.consumers).toContainEqual({
          kind: 'frame',
          frameId: frame.id,
        });
      }
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

  it('records exact package approval and atomically publishes one replayable immutable revision', async () => {
    const output = freshOutputRoot('package-promotion-happy');
    try {
      const prepared = await preparePackage(output.relative);
      const approvalPreview = approvePackage(prepared, false);
      expect(approvalPreview.created).toBe(false);
      expect(
        fs.existsSync(resolveRepoPath(REPO_ROOT, approvalPreview.approvalPath)),
      ).toBe(false);
      const approval = approvePackage(prepared, true);
      expect(approval.created).toBe(true);
      const approvalReplay = approvePackage(prepared, true);
      expect(approvalReplay.created).toBe(false);
      expect(approvalReplay.approval.digest).toBe(approval.approval.digest);

      const approved = prepareApprovedPackagesDirectory(output);
      const predecessorBytes = fs.readFileSync(
        resolveRepoPath(REPO_ROOT, approved.locatorPath),
        'utf8',
      );
      const preview = publishStorySourceRevisionPackage({
        repoRoot: REPO_ROOT,
        packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
        packageApprovalPath: approval.approvalPath,
        publishedAt: PACKAGE_PUBLISHED_AT,
        approvedPackagesDir: approved.absolute,
        write: false,
      });
      expect(preview.locatorChanged).toBe(false);
      expect(preview.manifestCreated).toBe(false);
      expect(preview.manifest.externalCounters).toEqual({
        providerCalls: 0,
        imageRenders: 0,
        audioRenders: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: 1,
      });
      expect(preview.manifest.doesNotAuthorize).toEqual(
        STORY_SOURCE_REVISION_PACKAGE_PROMOTION_EXCLUSIONS,
      );
      expect(
        fs.readFileSync(resolveRepoPath(REPO_ROOT, approved.locatorPath), 'utf8'),
      ).toBe(predecessorBytes);
      expect(fs.existsSync(resolveRepoPath(REPO_ROOT, preview.packagePath))).toBe(
        false,
      );
      expect(
        fs.existsSync(resolveRepoPath(REPO_ROOT, preview.manifestPath)),
      ).toBe(false);

      const first = publishStorySourceRevisionPackage({
        repoRoot: REPO_ROOT,
        packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
        packageApprovalPath: approval.approvalPath,
        publishedAt: PACKAGE_PUBLISHED_AT,
        approvedPackagesDir: approved.absolute,
        write: true,
      });
      expect(first.locatorChanged).toBe(true);
      expect(first.manifestCreated).toBe(true);
      expect(fs.existsSync(resolveRepoPath(REPO_ROOT, first.packagePath))).toBe(
        true,
      );
      expect(fs.existsSync(resolveRepoPath(REPO_ROOT, first.manifestPath))).toBe(
        true,
      );
      const locatorBytes = fs.readFileSync(
        resolveRepoPath(REPO_ROOT, first.locatorPath),
      );
      const packageBytes = fs.readFileSync(
        resolveRepoPath(REPO_ROOT, first.packagePath),
      );
      const inventoryBefore = fs
        .readdirSync(output.absolute, { recursive: true })
        .map(String)
        .sort();
      expect(() =>
        publishStorySourceRevisionPackage({
          repoRoot: REPO_ROOT,
          packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
          packageApprovalPath: approval.approvalPath,
          publishedAt: '2026-08-22T16:22:07.442Z',
          approvedPackagesDir: approved.absolute,
          write: true,
        }),
      ).toThrow('already has a different timestamp or manifest');
      const replay = publishStorySourceRevisionPackage({
        repoRoot: REPO_ROOT,
        packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
        packageApprovalPath: approval.approvalPath,
        publishedAt: PACKAGE_PUBLISHED_AT,
        approvedPackagesDir: approved.absolute,
        write: true,
      });
      expect(replay.locatorChanged).toBe(false);
      expect(replay.manifestCreated).toBe(false);
      expect(replay.manifest.digest).toBe(first.manifest.digest);
      expect(fs.readFileSync(resolveRepoPath(REPO_ROOT, replay.locatorPath))).toEqual(
        locatorBytes,
      );
      expect(fs.readFileSync(resolveRepoPath(REPO_ROOT, replay.packagePath))).toEqual(
        packageBytes,
      );
      expect(
        fs.readdirSync(output.absolute, { recursive: true }).map(String).sort(),
      ).toEqual(inventoryBefore);
    } finally {
      cleanup(output.absolute);
    }
  }, 30_000);

  it('rejects package approval drift, stale locators, collisions and concurrent publication without partial writes', async () => {
    const output = freshOutputRoot('package-promotion-reject');
    try {
      const prepared = await preparePackage(output.relative);
      const approvalRoot = path.join(
        output.absolute,
        'visual-package-candidate-lifecycle',
        'package-approvals',
      );
      expect(() =>
        recordStorySourceRevisionPackageApproval({
          repoRoot: REPO_ROOT,
          packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
          packageCandidateDigest: '0'.repeat(64),
          packageReviewDigest: prepared.packageAssembly.packageReview.digest,
          approvedBy: 'Guy',
          approvedAt: PACKAGE_APPROVED_AT,
          write: true,
        }),
      ).toThrow('does not bind the reviewed package artifacts');
      expect(() =>
        recordStorySourceRevisionPackageApproval({
          repoRoot: REPO_ROOT,
          packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
          packageCandidateDigest: prepared.packageAssembly.candidate.digest,
          packageReviewDigest: prepared.packageAssembly.packageReview.digest,
          approvedBy: 'Claude' as 'Guy',
          approvedAt: PACKAGE_APPROVED_AT,
          write: true,
        }),
      ).toThrow('requires exact Guy and canonical UTC time');
      expect(() =>
        recordStorySourceRevisionPackageApproval({
          repoRoot: REPO_ROOT,
          packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
          packageCandidateDigest: prepared.packageAssembly.candidate.digest,
          packageReviewDigest: prepared.packageAssembly.packageReview.digest,
          approvedBy: 'Guy',
          approvedAt: '2026-08-22T16:21:43Z',
          write: true,
        }),
      ).toThrow('requires exact Guy and canonical UTC time');
      expect(fs.existsSync(approvalRoot)).toBe(false);

      const approval = approvePackage(prepared);
      const approved = prepareApprovedPackagesDirectory(output);
      const preview = publishStorySourceRevisionPackage({
        repoRoot: REPO_ROOT,
        packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
        packageApprovalPath: approval.approvalPath,
        publishedAt: PACKAGE_PUBLISHED_AT,
        approvedPackagesDir: approved.absolute,
        write: false,
      });
      const locatorAbsolute = resolveRepoPath(REPO_ROOT, preview.locatorPath);
      const packageAbsolute = resolveRepoPath(REPO_ROOT, preview.packagePath);
      const manifestAbsolute = resolveRepoPath(REPO_ROOT, preview.manifestPath);
      const predecessorBytes = fs.readFileSync(locatorAbsolute, 'utf8');

      const alternateApprovalPath = `${output.relative}/alternate-package-approval.json`;
      fs.copyFileSync(
        resolveRepoPath(REPO_ROOT, approval.approvalPath),
        resolveRepoPath(REPO_ROOT, alternateApprovalPath),
      );
      expect(() =>
        publishStorySourceRevisionPackage({
          repoRoot: REPO_ROOT,
          packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
          packageApprovalPath: alternateApprovalPath,
          publishedAt: PACKAGE_PUBLISHED_AT,
          approvedPackagesDir: approved.absolute,
          write: true,
        }),
      ).toThrow('invalid or noncanonical');
      expect(fs.existsSync(packageAbsolute)).toBe(false);
      expect(fs.existsSync(manifestAbsolute)).toBe(false);

      fs.writeFileSync(locatorAbsolute, '{}\n', 'utf8');
      expect(() =>
        publishStorySourceRevisionPackage({
          repoRoot: REPO_ROOT,
          packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
          packageApprovalPath: approval.approvalPath,
          publishedAt: PACKAGE_PUBLISHED_AT,
          approvedPackagesDir: approved.absolute,
          write: true,
        }),
      ).toThrow('locator changed after reviewed assembly');
      expect(fs.existsSync(packageAbsolute)).toBe(false);
      expect(fs.existsSync(manifestAbsolute)).toBe(false);

      fs.writeFileSync(locatorAbsolute, predecessorBytes, 'utf8');
      fs.mkdirSync(path.dirname(packageAbsolute), { recursive: true });
      fs.writeFileSync(packageAbsolute, 'collision\n', 'utf8');
      expect(() =>
        publishStorySourceRevisionPackage({
          repoRoot: REPO_ROOT,
          packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
          packageApprovalPath: approval.approvalPath,
          publishedAt: PACKAGE_PUBLISHED_AT,
          approvedPackagesDir: approved.absolute,
          write: true,
        }),
      ).toThrow('approved package revision conflicts');
      expect(fs.readFileSync(locatorAbsolute, 'utf8')).toBe(predecessorBytes);
      expect(fs.existsSync(manifestAbsolute)).toBe(false);
      fs.unlinkSync(packageAbsolute);

      const lockPath = `${locatorAbsolute}.story-source-revision-promotion.lock`;
      fs.writeFileSync(lockPath, 'held\n', 'utf8');
      expect(() =>
        publishStorySourceRevisionPackage({
          repoRoot: REPO_ROOT,
          packageAssemblyManifestPath: prepared.packageAssembly.manifestPath,
          packageApprovalPath: approval.approvalPath,
          publishedAt: PACKAGE_PUBLISHED_AT,
          approvedPackagesDir: approved.absolute,
          write: true,
        }),
      ).toThrow();
      expect(fs.readFileSync(lockPath, 'utf8')).toBe('held\n');
      expect(fs.readFileSync(locatorAbsolute, 'utf8')).toBe(predecessorBytes);
      expect(fs.existsSync(packageAbsolute)).toBe(false);
      expect(fs.existsSync(manifestAbsolute)).toBe(false);
    } finally {
      cleanup(output.absolute);
    }
  }, 30_000);
});
