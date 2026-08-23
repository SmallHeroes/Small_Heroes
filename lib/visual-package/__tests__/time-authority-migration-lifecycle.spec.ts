import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  approveTimeAuthorityMigrationReconciliation,
  approveTimeAuthorityMigratedBlueprint,
  advanceApprovedTimeAuthorityMigration,
  buildPendingTimeAuthorityMigrationReconciliation,
  buildProductionReconciliationDraftFromSourceSnapshot,
  buildReconciliationReviewBundle,
  buildStorySourceAuthoritySnapshot,
  buildTimeAuthorityMigrationProjection,
  canonicalJsonDigest,
  loadApprovedTimeAuthorityMigration,
  prepareTimeAuthorityMigrationReconciliation,
  prepareTimeAuthorityMigratedBlueprint,
  reconciliationDraftBundleJsonBytes,
  recordTimeAuthorityMigrationReconciliationApproval,
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
import {
  canonicalContentAddressedJsonBytes,
} from '@/lib/visual-package/canonicalContentAddressedJson';

const STORY_KEY = 'bunny_ometz_adventure';
const STORY_PATH = `story-bank/v3-approved/${STORY_KEY}.md`;
const APPROVED_AT = '2026-08-21T12:00:00.000Z';
const SOURCE_PACKAGE_ROOT =
  'outputs/r1d-chameleon-qa-wizard-dispositions-418fbfe4-20260820T090012541Z/visual-package-v4-text-safe';
const SOURCE_PACKAGE_CANDIDATE_PATH =
  `${SOURCE_PACKAGE_ROOT}/candidates/c3e28ae1c22ab2bfcea53dddd0e802b71d97b4adbaf6a395313a1a6445df4e82.json`;
const SOURCE_PACKAGE_REVIEW_PATH =
  `${SOURCE_PACKAGE_ROOT}/package-reviews/fc633811256c596c2fa258e58e247b17377bd64b9db1adcd6e0e2c98d3f80ee2.json`;
const SOURCE_PACKAGE_APPROVAL_PATH =
  `${SOURCE_PACKAGE_ROOT}/approvals/c3e28ae1c22ab2bfcea53dddd0e802b71d97b4adbaf6a395313a1a6445df4e82/892571e282f7b3ce568a5c2592c841f3293b0ba7ee9ce8d9f609d346c42d8fbb.json`;
const STYLE_ID = 'soft_hand_drawn_storybook';
const STYLE_AUTHORITY_PATH =
  'style-authorities/style01/soft_hand_drawn_storybook.style-authority.json';
const STYLE_AUTHORITY_DIGEST =
  '3517e8620d7b6a16abd5c4edc5284a7bc30e0f09bbfea748b07e9ef2f3ebde20';
const SOURCE_BLUEPRINT_ROOT =
  'outputs/r1d-chameleon-qa-wizard-dispositions-418fbfe4-20260820T090012541Z/blueprint-lifecycle/authorities/41f4bfe787100812f1706169ad1a71e8a61aa4233d251309582b114f3161598d';
const SOURCE_BLUEPRINT_PATH =
  `${SOURCE_BLUEPRINT_ROOT}/candidates/fc1412a3c19d627518860c053d46fae3e79d7fd60eb16bfdfb1521248e899e5f/blueprint.json`;
const SOURCE_BLUEPRINT_APPROVAL_PATH =
  `${SOURCE_BLUEPRINT_ROOT}/approvals/fc1412a3c19d627518860c053d46fae3e79d7fd60eb16bfdfb1521248e899e5f/9993a7f7771065d0b4aa2b251ce821b1bc3dcde2c59306a3b124606e5ec8b67e.json`;
const SOURCE_BLUEPRINT_DRAFT_PATH =
  'outputs/r1d-chameleon-qa-wizard-dispositions-418fbfe4-20260820T090012541Z/blueprint-inputs/1dec723cea4e2bd38cbff15641a726aaee4692f0a1d98b09f15812f018ff104c.whole-book-draft.json';
const REAL_PACKAGE_AVAILABLE = [
  SOURCE_PACKAGE_CANDIDATE_PATH,
  SOURCE_PACKAGE_REVIEW_PATH,
  SOURCE_PACKAGE_APPROVAL_PATH,
  SOURCE_BLUEPRINT_PATH,
  SOURCE_BLUEPRINT_APPROVAL_PATH,
  SOURCE_BLUEPRINT_DRAFT_PATH,
].every((artifactPath) => fs.existsSync(path.join(process.cwd(), artifactPath)));

function blueprintContentProjection(value: Record<string, unknown>): unknown {
  const {
    identity: _identity,
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...content
  } = value;
  return content;
}

function changedJsonPaths(before: unknown, after: unknown, pointer = ''): string[] {
  if (Object.is(before, after)) return [];
  if (
    before === null ||
    after === null ||
    typeof before !== 'object' ||
    typeof after !== 'object' ||
    Array.isArray(before) !== Array.isArray(after)
  ) {
    return [pointer || '/'];
  }
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  return [...new Set([
    ...Object.keys(beforeRecord),
    ...Object.keys(afterRecord),
  ])]
    .sort()
    .flatMap((key) => changedJsonPaths(
      beforeRecord[key],
      afterRecord[key],
      `${pointer}/${key}`,
    ));
}

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
  it('shares the existing insertion-ordered reconciliation writer form without redefining historical bytes', () => {
    const value = {
      version: 'writer-form-probe/v1',
      zeta: { value: 1 },
      alpha: { value: 2 },
    };
    expect(reconciliationDraftBundleJsonBytes(value)).toBe(
      '{\n' +
      '  "version": "writer-form-probe/v1",\n' +
      '  "zeta": {\n' +
      '    "value": 1\n' +
      '  },\n' +
      '  "alpha": {\n' +
      '    "value": 2\n' +
      '  }\n' +
      '}\n',
    );
    expect(reconciliationDraftBundleJsonBytes(value)).not.toBe(
      canonicalContentAddressedJsonBytes(value),
    );
  });

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

    const hostileTemplate = structuredClone(migrated.template);
    hostileTemplate.coverContract.mustShow[0] =
      'HOSTILE_INJECTED_NON_TIME_ELEMENT';
    expect(() => buildPendingTimeAuthorityMigrationReconciliation(
      source,
      sourceTemplate,
      hostileTemplate,
    )).toThrow(/not the exact time-authority projection/);
  });

  it.skipIf(!REAL_PACKAGE_AVAILABLE)(
    'persists, reloads, approves, and advances the real package with exact writer bytes and no source mutation',
    async () => {
      const repoRoot = process.cwd();
      const outputsRoot = path.join(repoRoot, 'outputs');
      fs.mkdirSync(outputsRoot, { recursive: true });
      const outputRoot = fs.mkdtempSync(
        path.join(outputsRoot, '.time-authority-migration-test-'),
      );
      const outputDir = path.relative(repoRoot, outputRoot).replace(/\\/g, '/');
      const sourcePaths = [
        SOURCE_PACKAGE_CANDIDATE_PATH,
        SOURCE_PACKAGE_REVIEW_PATH,
        SOURCE_PACKAGE_APPROVAL_PATH,
        SOURCE_BLUEPRINT_PATH,
        SOURCE_BLUEPRINT_APPROVAL_PATH,
        SOURCE_BLUEPRINT_DRAFT_PATH,
      ];
      const sourceBytesBefore = sourcePaths.map((artifactPath) =>
        fs.readFileSync(path.join(repoRoot, artifactPath)),
      );

      try {
        const prepared = prepareTimeAuthorityMigrationReconciliation({
          repoRoot,
          outputDir,
          sourcePackageCandidatePath: SOURCE_PACKAGE_CANDIDATE_PATH,
          sourcePackageReviewPath: SOURCE_PACKAGE_REVIEW_PATH,
          sourcePackageApprovalPath: SOURCE_PACKAGE_APPROVAL_PATH,
          write: true,
        });
        expect(prepared.manifest.stage).toBe('reconciliation_pending');
        expect(prepared.manifestArtifact.created).toBe(true);
        expect(prepared.migratedTemplateArtifact.created).toBe(true);
        expect(prepared.reconciliationArtifacts.wrote).toBe(true);
        expect(() => loadApprovedTimeAuthorityMigration({
          repoRoot,
          approvedManifestPath: prepared.manifestArtifact.path,
        })).toThrow(/reconciliation is not approved/);

        const pendingReconciliationAbsolute = path.join(
          repoRoot,
          prepared.reconciliationArtifacts.reconciliationPath,
        );
        const pendingReviewAbsolute = path.join(
          repoRoot,
          prepared.reconciliationArtifacts.reviewBundlePath,
        );
        const pendingReconciliationBytes = fs.readFileSync(
          pendingReconciliationAbsolute,
          'utf8',
        );
        const pendingReviewBytes = fs.readFileSync(
          pendingReviewAbsolute,
          'utf8',
        );
        expect(pendingReconciliationBytes).toBe(
          reconciliationDraftBundleJsonBytes(
            JSON.parse(pendingReconciliationBytes),
          ),
        );
        expect(pendingReviewBytes).toBe(
          reconciliationDraftBundleJsonBytes(JSON.parse(pendingReviewBytes)),
        );

        const recorded =
          recordTimeAuthorityMigrationReconciliationApproval({
            repoRoot,
            outputDir,
            pendingManifestPath: prepared.manifestArtifact.path,
            approvedBy: 'Guy',
            approvedAt: APPROVED_AT,
            write: true,
          });
        expect(recorded.approvalArtifact.created).toBe(true);
        expect(recorded.approvedReconciliationArtifacts.wrote).toBe(true);
        expect(recorded.approval.approvedAt).toBe(APPROVED_AT);

        const advanced = advanceApprovedTimeAuthorityMigration({
          repoRoot,
          outputDir,
          pendingManifestPath: prepared.manifestArtifact.path,
          approvalPath: recorded.approvalArtifact.path,
          styleId: STYLE_ID,
          styleAuthorityPath: STYLE_AUTHORITY_PATH,
          expectedStyleAuthorityDigest: STYLE_AUTHORITY_DIGEST,
          write: true,
        });
        expect(advanced.manifest.stage).toBe('reconciliation_approved');
        expect(advanced.manifestArtifact.created).toBe(true);
        expect(advanced.manifest.productionContext).toEqual({
          version: advanced.context.version,
          digest: advanced.context.digest,
          styleId: STYLE_ID,
          styleAuthorityPath: STYLE_AUTHORITY_PATH,
          styleAuthorityDigest: STYLE_AUTHORITY_DIGEST,
        });
        expect(advanced.context.template.identity.digest).toBe(
          prepared.manifest.migration.migratedTemplateDigest,
        );

        const reloaded = loadApprovedTimeAuthorityMigration({
          repoRoot,
          approvedManifestPath: advanced.manifestArtifact.path,
        });
        expect(reloaded.manifest).toEqual(advanced.manifest);
        expect(reloaded.context).toEqual(advanced.context);

        const sourceBlueprint = JSON.parse(fs.readFileSync(
          path.join(repoRoot, SOURCE_BLUEPRINT_PATH),
          'utf8',
        )) as Record<string, unknown>;
        const sourceBlueprintDraft = JSON.parse(fs.readFileSync(
          path.join(repoRoot, SOURCE_BLUEPRINT_DRAFT_PATH),
          'utf8',
        ));
        const migratedBlueprint = await prepareTimeAuthorityMigratedBlueprint({
          repoRoot,
          approvedManifestPath: advanced.manifestArtifact.path,
          draft: sourceBlueprintDraft,
          outputRoot: `${outputDir}/blueprint-lifecycle`,
          authoringConfig: {
            model: 'offline-deterministic-blueprint-author/v2',
            reasoningEffort: 'none',
            maxOutputTokens: 48_000,
            compositionPolicyVersion: null,
          },
        });
        expect(migratedBlueprint.manifest.digest).toBe(
          advanced.manifest.digest,
        );
        expect(migratedBlueprint.context.digest).toBe(advanced.context.digest);
        expect(migratedBlueprint.authored.repairAttempts).toEqual([]);
        expect(migratedBlueprint.persisted.evidence.valid).toBe(true);
        expect(migratedBlueprint.persisted.review.packet.readyForApproval)
          .toBe(true);
        expect(migratedBlueprint.persisted.review.packet.priorApprovedDiff)
          .toEqual({
            status: 'compared',
            previousBlueprintDigest: sourceBlueprint.digest,
            previousApprovalDigest:
              '9993a7f7771065d0b4aa2b251ce821b1bc3dcde2c59306a3b124606e5ec8b67e',
            changedFrameIds: [],
            addedConnectionIds: [],
            removedConnectionIds: [],
            addedAffordanceIds: [],
            removedAffordanceIds: [],
            authorityChanged: true,
          });
        expect(changedJsonPaths(
          blueprintContentProjection(sourceBlueprint),
          blueprintContentProjection(
            migratedBlueprint.authored.blueprint as unknown as Record<string, unknown>,
          ),
        )).toEqual([
          '/visualContract/coverContract/timeOfDay',
          '/visualContract/locations/0/timeOfDay',
          '/visualContract/setBoardAuthorities/0/locations/0/timeOfDay',
        ]);
        expect(fs.existsSync(migratedBlueprint.persisted.candidate.path))
          .toBe(true);
        expect(fs.existsSync(migratedBlueprint.persisted.reviewPacket.path))
          .toBe(true);
        const migratedAuthorityRoot = path.dirname(path.dirname(path.dirname(
          migratedBlueprint.persisted.candidate.path,
        )));
        expect(fs.existsSync(path.join(migratedAuthorityRoot, 'approvals')))
          .toBe(false);

        expect(() => approveTimeAuthorityMigratedBlueprint({
          repoRoot,
          approvedManifestPath: advanced.manifestArtifact.path,
          outputRoot: `${outputDir}/blueprint-lifecycle`,
          candidatePath: path.relative(
            repoRoot,
            migratedBlueprint.persisted.candidate.path,
          ),
          reviewPath: path.relative(
            repoRoot,
            migratedBlueprint.persisted.reviewPacket.path,
          ),
          approvedBy: 'Guy',
          approvedAt: '2026',
        })).toThrow(/canonical UTC ISO timestamp/);
        expect(fs.existsSync(path.join(migratedAuthorityRoot, 'approvals')))
          .toBe(false);

        const migratedApproval = approveTimeAuthorityMigratedBlueprint({
          repoRoot,
          approvedManifestPath: advanced.manifestArtifact.path,
          outputRoot: `${outputDir}/blueprint-lifecycle`,
          candidatePath: path.relative(
            repoRoot,
            migratedBlueprint.persisted.candidate.path,
          ),
          reviewPath: path.relative(
            repoRoot,
            migratedBlueprint.persisted.reviewPacket.path,
          ),
          approvedBy: 'Guy',
          approvedAt: APPROVED_AT,
          note: 'test-only time-authority Blueprint planning approval',
        });
        expect(migratedApproval.manifest.digest).toBe(
          advanced.manifest.digest,
        );
        expect(migratedApproval.context.digest).toBe(advanced.context.digest);
        expect(migratedApproval.attestation).toMatchObject({
          blueprintDigest: migratedBlueprint.authored.blueprint.digest,
          authoringAuthorityDigest:
            migratedBlueprint.authored.blueprint.identity.authoringAuthority.digest,
          reviewPacketDigest:
            migratedBlueprint.persisted.review.packet.digest,
          approvedBy: 'Guy',
          approvedAt: APPROVED_AT,
          scope: 'blueprint_planning_approval_only',
        });
        expect(migratedApproval.artifact.created).toBe(true);
        expect(fs.existsSync(migratedApproval.artifact.path)).toBe(true);
        const migratedApprovalReplay = approveTimeAuthorityMigratedBlueprint({
          repoRoot,
          approvedManifestPath: advanced.manifestArtifact.path,
          outputRoot: `${outputDir}/blueprint-lifecycle`,
          candidatePath: path.relative(
            repoRoot,
            migratedBlueprint.persisted.candidate.path,
          ),
          reviewPath: path.relative(
            repoRoot,
            migratedBlueprint.persisted.reviewPacket.path,
          ),
          approvedBy: 'Guy',
          approvedAt: APPROVED_AT,
          note: 'test-only time-authority Blueprint planning approval',
        });
        expect(migratedApprovalReplay.attestation).toEqual(
          migratedApproval.attestation,
        );
        expect(migratedApprovalReplay.artifact.created).toBe(false);

        const nonTimeDriftDraft = structuredClone(sourceBlueprintDraft);
        nonTimeDriftDraft.frames[0].narrative.summary =
          'HOSTILE NON-TIME BLUEPRINT DRIFT';
        await expect(prepareTimeAuthorityMigratedBlueprint({
          repoRoot,
          approvedManifestPath: advanced.manifestArtifact.path,
          draft: nonTimeDriftDraft,
          outputRoot: `${outputDir}/hostile-blueprint-lifecycle`,
          authoringConfig: {
            model: 'offline-deterministic-blueprint-author/v2',
            reasoningEffort: 'none',
            maxOutputTokens: 48_000,
            compositionPolicyVersion: null,
          },
        })).rejects.toThrow(/non-time content drift/);
        expect(fs.existsSync(path.join(
          outputRoot,
          'hostile-blueprint-lifecycle',
        ))).toBe(false);

        const hostileApproved = structuredClone(advanced.manifest);
        hostileApproved.productionContext!.digest = 'e'.repeat(64);
        const hostileRedigested = redigest(hostileApproved);
        const hostileManifestPath = path.join(
          outputRoot,
          'time-authority-migration-manifests',
          `${hostileRedigested.digest}.json`,
        );
        fs.writeFileSync(
          hostileManifestPath,
          canonicalContentAddressedJsonBytes(hostileRedigested),
          'utf8',
        );
        expect(() => loadApprovedTimeAuthorityMigration({
          repoRoot,
          approvedManifestPath: path.relative(repoRoot, hostileManifestPath),
        })).toThrow(/reconstructed context/);

        sourcePaths.forEach((artifactPath, index) => {
          expect(fs.readFileSync(path.join(repoRoot, artifactPath))).toEqual(
            sourceBytesBefore[index],
          );
        });

        fs.writeFileSync(
          pendingReconciliationAbsolute,
          canonicalContentAddressedJsonBytes(
            JSON.parse(pendingReconciliationBytes),
          ),
          'utf8',
        );
        expect(() => recordTimeAuthorityMigrationReconciliationApproval({
          repoRoot,
          outputDir,
          pendingManifestPath: prepared.manifestArtifact.path,
          approvedBy: 'Guy',
          approvedAt: '2026-08-21T12:01:00.000Z',
          write: false,
        })).toThrow(/bytes do not match its writer/);
      } finally {
        const resolvedOutputRoot = path.resolve(outputRoot);
        if (
          resolvedOutputRoot.startsWith(
            `${path.resolve(outputsRoot)}${path.sep}`,
          )
        ) {
          fs.rmSync(resolvedOutputRoot, { recursive: true, force: true });
        }
      }
      expect(fs.existsSync(outputRoot)).toBe(false);
    },
  );

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

    for (const approvedAt of [
      '2026',
      '2026-08',
      '2026-08-21',
      '2026-02-30T00:00:00.000Z',
    ]) {
      expect(timeAuthorityMigrationApprovalIsValid(redigest({
        ...approval,
        approvedAt,
      }))).toBe(false);
    }
  });
});
