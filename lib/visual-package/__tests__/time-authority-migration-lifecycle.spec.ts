import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  approveTimeAuthorityMigrationReconciliation,
  buildPendingTimeAuthorityMigrationReconciliation,
  buildProductionReconciliationDraftFromSourceSnapshot,
  buildReconciliationReviewBundle,
  buildStorySourceAuthoritySnapshot,
  buildTimeAuthorityMigrationProjection,
  canonicalJsonDigest,
  sourcePromptReconciliationIssues,
  TIME_AUTHORITY_MIGRATION_APPROVAL_VERSION,
  TIME_AUTHORITY_MIGRATION_DOES_NOT_AUTHORIZE,
  TIME_AUTHORITY_MIGRATION_MANIFEST_VERSION,
  TIME_AUTHORITY_MIGRATION_VERSION,
  timeAuthorityMigrationApprovalIsValid,
  timeAuthorityMigrationManifestIsValid,
  type TimeAuthorityMigrationApproval,
  type TimeAuthorityMigrationManifest,
  type SourcePromptReconciliation,
} from '@/lib/visual-package';
import {
  migrateLegacyBookVisualContractTemplateV1,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';

const STORY_KEY = 'bunny_ometz_adventure';
const STORY_PATH = `story-bank/v3-approved/${STORY_KEY}.md`;
const APPROVED_AT = '2026-08-21T12:00:00.000Z';

function redigest<T extends { digestAlgorithm: string; digest: string }>(
  value: T,
): T {
  const clone = structuredClone(value);
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = clone;
  clone.digest = canonicalJsonDigest(payload);
  return clone;
}

function pendingManifest(): TimeAuthorityMigrationManifest {
  return redigest({
    version: TIME_AUTHORITY_MIGRATION_MANIFEST_VERSION,
    stage: 'reconciliation_pending',
    source: {
      storyKey: STORY_KEY,
      storyPath: STORY_PATH,
      sourceSnapshotDigest: '1'.repeat(64),
      sourceSnapshotPath: `outputs/source-snapshots/${'1'.repeat(64)}.json`,
      sourcePackageCandidateDigest: '2'.repeat(64),
      sourcePackageCandidatePath: `outputs/candidates/${'2'.repeat(64)}.json`,
      sourcePackageReviewDigest: '3'.repeat(64),
      sourcePackageReviewPath: `outputs/reviews/${'3'.repeat(64)}.json`,
      sourcePackageApprovalDigest: '4'.repeat(64),
      sourcePackageApprovalPath: `outputs/approvals/${'4'.repeat(64)}.json`,
      actionSemanticCoverageDigest: '5'.repeat(64),
    },
    migration: {
      version: TIME_AUTHORITY_MIGRATION_VERSION,
      sourceTemplateDigest: '6'.repeat(64),
      migratedTemplateDigest: '7'.repeat(64),
      migratedTemplatePath: `outputs/templates/${'7'.repeat(64)}.json`,
      nonTimeProjectionDigest: '8'.repeat(64),
      changes: [{
        path: '/coverContract/timeOfDay',
        before: 'evening',
        after: 'dusk',
      }],
    },
    reconciliation: {
      version: 'source-prompt-reconciliation/v3',
      digest: '9'.repeat(64),
      path: `outputs/reconciliations/${'9'.repeat(64)}.json`,
      reviewBundleDigest: 'a'.repeat(64),
      reviewBundlePath: `outputs/reviews/${'a'.repeat(64)}.json`,
      reviewMarkdownPath: `outputs/reviews/${'a'.repeat(64)}.md`,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      approvalDigest: null,
      approvalPath: null,
    },
    productionContext: null,
    doesNotAuthorize: [...TIME_AUTHORITY_MIGRATION_DOES_NOT_AUTHORIZE],
    digestAlgorithm: 'canonical-json-sha256',
    digest: '',
  });
}

function migrationApproval(
  manifest: TimeAuthorityMigrationManifest,
): TimeAuthorityMigrationApproval {
  return redigest({
    version: TIME_AUTHORITY_MIGRATION_APPROVAL_VERSION,
    pendingManifestDigest: manifest.digest,
    migratedTemplateDigest: manifest.migration.migratedTemplateDigest,
    reconciliationDigest: 'b'.repeat(64),
    reconciliationPath: `outputs/reconciliations/${'b'.repeat(64)}.json`,
    reviewBundleDigest: 'c'.repeat(64),
    reviewBundlePath: `outputs/reviews/${'c'.repeat(64)}.json`,
    reviewMarkdownPath: `outputs/reviews/${'c'.repeat(64)}.md`,
    reviewMarkdownSha256: 'd'.repeat(64),
    approvedBy: 'Guy',
    approvedAt: APPROVED_AT,
    authorityScope:
      'time_authority_migration_reconciliation_exact_content_only',
    doesNotAuthorize: [...TIME_AUTHORITY_MIGRATION_DOES_NOT_AUTHORIZE],
    digestAlgorithm: 'canonical-json-sha256',
    digest: '',
  });
}

function openTimeTemplate(): BookVisualContractTemplate {
  const legacy = JSON.parse(
    fs.readFileSync(
      `story-bank/v3-approved/${STORY_KEY}.visual-contract-template.json`,
      'utf8',
    ),
  );
  const template = migrateLegacyBookVisualContractTemplateV1(legacy);
  template.locations[0]!.timeOfDay = 'evening into night' as never;
  template.coverContract.timeOfDay = 'evening' as never;
  return template;
}

function approveSourceReconciliation(args: {
  reconciliation: SourcePromptReconciliation;
  template: BookVisualContractTemplate;
}): SourcePromptReconciliation {
  const approved = structuredClone(args.reconciliation);
  approved.review = {
    status: 'approved',
    reviewedBy: 'Guy',
    reviewedAt: '2026-08-20T12:00:00.000Z',
  };
  for (const frame of approved.frames) {
    const pageIndex = frame.frameKind === 'page'
      ? args.template.pageContracts.findIndex(
          (page) => page.pageNumber === frame.pageNumber,
        )
      : -1;
    for (const [index, requirement] of frame.sourceRequirements.entries()) {
      const historical =
        requirement.sourceKind === 'historical_image_direction';
      const pointer = historical
        ? `/pageContracts/${pageIndex}/camera`
        : frame.frameKind === 'cover' && index === 0
          ? '/coverContract'
        : frame.frameKind === 'cover'
          ? '/coverContract/mustShow/0'
          : `/pageContracts/${pageIndex}/mustShow/0`;
      const value = historical
        ? args.template.pageContracts[pageIndex]!.camera
        : frame.frameKind === 'cover' && index === 0
          ? args.template.coverContract
        : frame.frameKind === 'cover'
          ? args.template.coverContract.mustShow[0]
          : args.template.pageContracts[pageIndex]!.mustShow[0];
      requirement.visualBeats = [{
        id: `migration-review:${frame.frameKind}:${frame.pageNumber}:${index}`,
        description: 'Exact preserved source meaning for migration regression',
        aspects: historical ? ['camera'] : ['narrative_meaning'],
        disposition: 'preserved',
        contractEvidence: [{ path: pointer, value }],
        justification: null,
        supersessionReview: null,
      }];
    }
  }
  return approved;
}

describe('offline time-authority migration lifecycle', () => {
  it('preserves approved decisions as pending content while requiring entirely fresh review authority', () => {
    const snapshot = buildStorySourceAuthoritySnapshot({
      repoRoot: process.cwd(),
      storyKey: STORY_KEY,
      storyPath: STORY_PATH,
    });
    const sourceTemplate = openTimeTemplate();
    const sourceDraft =
      buildProductionReconciliationDraftFromSourceSnapshot({
        snapshot,
        template: sourceTemplate,
        actionSemanticCoverage: [],
      }).reconciliation;
    const sourceApproved = approveSourceReconciliation({
      reconciliation: sourceDraft,
      template: sourceTemplate,
    });
    const sourceReview = buildReconciliationReviewBundle({
      reconciliation: sourceApproved,
      sourceIdentity: snapshot.content.sourceIdentity,
      sourceAuthoritySnapshotDigest: snapshot.digest,
      rawStorySource: snapshot.content.normalizedRawStorySource,
      template: sourceTemplate,
      actionSemanticCoverage: [],
    });
    expect(sourceReview.readyForApproval).toBe(true);

    const projection =
      buildTimeAuthorityMigrationProjection(sourceTemplate);
    expect(projection.changes).toEqual([
      {
        path: '/locations/0/timeOfDay',
        before: 'evening into night',
        after: 'mixed',
      },
      {
        path: '/coverContract/timeOfDay',
        before: 'evening',
        after: 'dusk',
      },
    ]);
    expect(projection.digest).not.toBe(canonicalJsonDigest(sourceTemplate));

    const pending = buildPendingTimeAuthorityMigrationReconciliation(
      sourceApproved,
      sourceTemplate,
      projection.template,
    );
    expect(pending.review).toEqual({
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
    });
    expect(pending.templateDigest).toBe(projection.digest);
    const pendingCoverEvidence = pending.frames
      .find((frame) => frame.frameKind === 'cover')!
      .sourceRequirements[0]!.visualBeats[0]!.contractEvidence[0]!;
    const sourceCoverEvidence = sourceApproved.frames
      .find((frame) => frame.frameKind === 'cover')!
      .sourceRequirements[0]!.visualBeats[0]!.contractEvidence[0]!;
    expect(pendingCoverEvidence.path).toBe('/coverContract');
    expect(
      (pendingCoverEvidence.value as { timeOfDay: string }).timeOfDay,
    ).toBe('dusk');
    expect(
      (sourceCoverEvidence.value as { timeOfDay: string }).timeOfDay,
    ).toBe('evening');
    expect(
      pending.frames
        .filter((frame) => frame.frameKind === 'page')
        .map((frame) => frame.sourceRequirements),
    ).toEqual(
      sourceApproved.frames
        .filter((frame) => frame.frameKind === 'page')
        .map((frame) => frame.sourceRequirements),
    );
    expect(sourceApproved.review.status).toBe('approved');

    const approvalResetProbe = structuredClone(sourceApproved);
    const supersededBeat = approvalResetProbe.frames[0]!
      .sourceRequirements[0]!.visualBeats[0]!;
    supersededBeat.disposition = 'intentionally_superseded';
    supersededBeat.contractEvidence = [];
    supersededBeat.justification = 'Exact reviewer-owned supersession';
    supersededBeat.supersessionReview = {
      status: 'approved',
      reviewedBy: 'Guy',
      reviewedAt: '2026-08-20T12:00:00.000Z',
    };
    approvalResetProbe.presentationRequirementDispositions.entries = [{
      pageNumber: 1,
      beatId: 'beat:1',
      sourceEvidenceId: 'source-evidence:1',
      kind: 'superseded',
      reboundPointer: null,
      reboundValue: null,
      justification: 'Exact reviewer-owned presentation supersession',
      review: {
        status: 'approved',
        reviewedBy: 'Guy',
        reviewedAt: '2026-08-20T12:00:00.000Z',
      },
    }];
    const resetPending = buildPendingTimeAuthorityMigrationReconciliation(
      approvalResetProbe,
      sourceTemplate,
      projection.template,
    );
    expect(supersededBeat.supersessionReview?.status).toBe('approved');
    expect(
      resetPending.frames[0]!.sourceRequirements[0]!.visualBeats[0]!
        .supersessionReview,
    ).toEqual({ status: 'pending', reviewedBy: null, reviewedAt: null });
    expect(
      resetPending.presentationRequirementDispositions.entries[0]!.review,
    ).toEqual({ status: 'pending', reviewedBy: null, reviewedAt: null });
    expect(() => approveTimeAuthorityMigrationReconciliation(
      sourceApproved,
      APPROVED_AT,
    )).toThrow(/not exact pending review/);
    expect(
      sourcePromptReconciliationIssues({
        raw: pending,
        storyKey: STORY_KEY,
        sourceIdentity: snapshot.content.sourceIdentity,
        sourceAuthoritySnapshotDigest: snapshot.digest,
        rawStorySource: snapshot.content.normalizedRawStorySource,
        template: projection.template,
        templateDigest: projection.digest,
        actionSemanticCoverage: [],
        requireComplete: false,
      }),
    ).toEqual([]);

    const freshApproved = approveTimeAuthorityMigrationReconciliation(
      pending,
      APPROVED_AT,
    );
    const freshReview = buildReconciliationReviewBundle({
      reconciliation: freshApproved,
      sourceIdentity: snapshot.content.sourceIdentity,
      sourceAuthoritySnapshotDigest: snapshot.digest,
      rawStorySource: snapshot.content.normalizedRawStorySource,
      template: projection.template,
      actionSemanticCoverage: [],
    });
    expect(freshReview.readyForApproval).toBe(true);
    expect(freshApproved.review).toEqual({
      status: 'approved',
      reviewedBy: 'Guy',
      reviewedAt: APPROVED_AT,
    });
    expect(freshReview.reconciliationDigest)
      .not.toBe(sourceReview.reconciliationDigest);
  });

  it('refuses no-op and unmappable migrations rather than manufacturing replacement authority', () => {
    const noOp = openTimeTemplate();
    noOp.locations[0]!.timeOfDay = 'mixed';
    noOp.coverContract.timeOfDay = 'dusk';
    expect(() => buildTimeAuthorityMigrationProjection(noOp))
      .toThrow(/no authority change/);

    const invalid = openTimeTemplate();
    invalid.coverContract.timeOfDay = 'purple hour' as never;
    expect(() => buildTimeAuthorityMigrationProjection(invalid))
      .toThrow(/timeOfDay/);
  });

  it('rejects stale evidence rather than silently rebinding unrelated review content', () => {
    const snapshot = buildStorySourceAuthoritySnapshot({
      repoRoot: process.cwd(),
      storyKey: STORY_KEY,
      storyPath: STORY_PATH,
    });
    const sourceTemplate = openTimeTemplate();
    const source = approveSourceReconciliation({
      reconciliation: buildProductionReconciliationDraftFromSourceSnapshot({
        snapshot,
        template: sourceTemplate,
        actionSemanticCoverage: [],
      }).reconciliation,
      template: sourceTemplate,
    });
    const stale = structuredClone(source);
    const evidence = stale.frames
      .find((frame) => frame.frameKind === 'cover')!
      .sourceRequirements[0]!.visualBeats[0]!.contractEvidence[0]!;
    (evidence.value as { timeOfDay: string }).timeOfDay = 'night';
    const migrated = buildTimeAuthorityMigrationProjection(sourceTemplate);
    expect(() => buildPendingTimeAuthorityMigrationReconciliation(
      stale,
      sourceTemplate,
      migrated.template,
    )).toThrow(/contract evidence is stale or unmappable/);
  });

  it('validates exact manifest and approval shapes even after hostile redigests', () => {
    const manifest = pendingManifest();
    const approval = migrationApproval(manifest);
    expect(timeAuthorityMigrationManifestIsValid(manifest)).toBe(true);
    expect(timeAuthorityMigrationApprovalIsValid(approval)).toBe(true);

    const extraKey = redigest({
      ...manifest,
      unexpected: true,
    });
    expect(timeAuthorityMigrationManifestIsValid(extraKey)).toBe(false);

    const duplicateChange = structuredClone(manifest);
    duplicateChange.migration.changes.push(
      structuredClone(duplicateChange.migration.changes[0]!),
    );
    expect(
      timeAuthorityMigrationManifestIsValid(redigest(duplicateChange)),
    ).toBe(false);

    const escapedPath = structuredClone(manifest);
    escapedPath.migration.migratedTemplatePath = '../outside.json';
    expect(
      timeAuthorityMigrationManifestIsValid(redigest(escapedPath)),
    ).toBe(false);

    const falseApproval = structuredClone(approval);
    falseApproval.doesNotAuthorize = falseApproval.doesNotAuthorize.slice(1);
    expect(
      timeAuthorityMigrationApprovalIsValid(redigest(falseApproval)),
    ).toBe(false);
  });
});
