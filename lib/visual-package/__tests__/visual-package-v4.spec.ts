import { createHash } from 'crypto';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PRE_RENDER_BLUEPRINT_APPROVAL_VERSION,
  VISUAL_PACKAGE_V4_APPROVAL_VERSION,
  VISUAL_PACKAGE_V4_LAYOUT_POLICY,
  VISUAL_PACKAGE_V4_PACKAGE_REVIEW_VERSION,
  VISUAL_PACKAGE_V4_VERSION,
  buildFrozenVisualPackageAuthority,
  buildPreRenderBlueprintReviewBundle,
  buildVisualPackageV4Candidate,
  buildVisualPackageV4PackageReviewSummary,
  canonicalJsonDigest,
  computePreRenderBlueprintApprovalDigest,
  computeVisualPackageV4ApprovalDigest,
  computeVisualPackageV4PackageReviewDigest,
  createPreRenderBlueprintValidationEvidence,
  evaluateVisualPackageV4Qualification,
  finalizePreRenderBookVisualBlueprint,
  finalizeVisualPackageV4,
  loadCurrentVisualPackageV4,
  loadFrozenVisualPackageV4,
  publishVisualPackageV4,
  validateVisualPackageV4,
  type PreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintAuthoringProvenance,
  type PreRenderBookVisualBlueprint,
  type VisualPackageV4,
  type VisualPackageV4Approval,
  type VisualPackageV4CandidateContent,
  type VisualPackageV4Draft,
  type VisualPackageV4PackageReview,
} from '@/lib/visual-package';

import {
  buildBlueprintFixture,
  type BlueprintFixture,
  type BlueprintFixtureShape,
} from './pre-render-book-visual-blueprint.fixtures';

const roots: string[] = [];
const shapes: BlueprintFixtureShape[] = [
  'single_location',
  'multi_zone_transition',
  'journey_fantastical',
  'no_companion',
  'reveal_timeline',
];

function temporaryRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'small-heroes-v4-package-'));
  roots.push(root);
  return root;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withSupportedLayout(
  blueprint: PreRenderBookVisualBlueprint,
): PreRenderBookVisualBlueprint {
  const {
    digest: _digest,
    digestAlgorithm: _digestAlgorithm,
    ...draft
  } = clone(blueprint);
  for (const frame of draft.frames) {
    frame.textSafeRegion =
      frame.kind === 'cover'
        ? { x: 0, y: 0, width: 1000, height: 250 }
        : { x: 0, y: 750, width: 1000, height: 250 };
  }
  return finalizePreRenderBookVisualBlueprint(draft);
}

function provenanceFor(
  blueprint: PreRenderBookVisualBlueprint,
): PreRenderBlueprintAuthoringProvenance {
  return {
    version: 'pre-render-blueprint-authoring-provenance/v1',
    blueprintDigest: blueprint.digest,
    authoringAuthorityDigest:
      blueprint.identity.authoringAuthority.digest,
    model: 'synthetic-offline-fixture',
    reasoningEffort: 'medium',
    maxOutputTokens: 48_000,
    noFallback: true,
    draftSchemaVersion: 'pre-render-blueprint-draft-schema/v1',
    promptVersion: 'pre-render-blueprint-authoring-prompt/v1',
    passingAttempt: 1,
    callCount: 1,
    systemPromptDigest: 'a'.repeat(64),
    userPromptDigest: 'b'.repeat(64),
  };
}

function planningApproval(args: {
  blueprint: PreRenderBookVisualBlueprint;
  reviewPacketDigest: string;
}): PreRenderBlueprintApprovalAttestation {
  const payload = {
    version: PRE_RENDER_BLUEPRINT_APPROVAL_VERSION,
    blueprintDigest: args.blueprint.digest,
    authoringAuthorityDigest:
      args.blueprint.identity.authoringAuthority.digest,
    reviewPacketDigest: args.reviewPacketDigest,
    approvedBy: 'Guy',
    approvedAt: '2026-07-27T09:00:00.000Z',
    scope: 'blueprint_planning_approval_only',
    doesNotAuthorize: [
      'board_mint',
      'image_render',
      'visual_package_promotion',
      'runtime_cutover',
      'deployment',
      'release',
    ],
  } as const;
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: computePreRenderBlueprintApprovalDigest(payload),
  };
}

function packageApproval(
  blueprintApprovalDigest: string,
  packageCandidateDigest: string,
  packageReviewDigest: string,
  note?: string,
): VisualPackageV4Approval {
  const payload = {
    version: VISUAL_PACKAGE_V4_APPROVAL_VERSION,
    approvedBy: 'Guy',
    approvedAt: '2026-07-27T10:00:00.000Z',
    scope: 'immutable_runtime_authority_promotion',
    blueprintApprovalDigest,
    packageCandidateDigest,
    packageReviewDigest,
    ...(note ? { note } : {}),
  } as const;
  const approval = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: '',
  } satisfies VisualPackageV4Approval;
  approval.digest = computeVisualPackageV4ApprovalDigest(approval);
  return approval;
}

function packageFor(
  originalFixture: BlueprintFixture,
  note?: string,
): VisualPackageV4 {
  const blueprint = withSupportedLayout(originalFixture.blueprint);
  const context = {
    ...originalFixture.context,
    template: blueprint.visualContract,
  };
  const provenance = provenanceFor(blueprint);
  const evidence = createPreRenderBlueprintValidationEvidence({
    blueprint,
    context,
  });
  const review = buildPreRenderBlueprintReviewBundle({
    blueprint,
    context,
    provenance,
  });
  const approval = planningApproval({
    blueprint,
    reviewPacketDigest: review.packet.digest,
  });
  const sourceRawDigest = createHash('sha256')
    .update(context.rawStorySource, 'utf8')
    .digest('hex');
  const candidateContent: VisualPackageV4CandidateContent = {
    manifestVersion: VISUAL_PACKAGE_V4_VERSION,
    storyKey: blueprint.identity.storyKey,
    styleId: blueprint.identity.styleId,
    sourceSnapshot: {
      identity: context.source,
      rawDigestAlgorithm: 'sha256-utf8',
      rawDigest: sourceRawDigest,
      content: context.rawStorySource,
    },
    blueprint: {
      artifactPath: `blueprints/${blueprint.digest}.json`,
      digestAlgorithm: 'canonical-json-sha256',
      digest: blueprint.digest,
      content: blueprint,
    },
    authoringProvenance: {
      artifactPath: `blueprints/${blueprint.digest}.provenance.json`,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(provenance),
      content: provenance,
    },
    validationEvidence: {
      artifactPath: `blueprints/${blueprint.digest}.validation.json`,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(evidence),
      content: evidence,
    },
    reviewPacket: {
      artifactPath: `blueprints/${blueprint.digest}.review.json`,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(review.packet),
      content: review.packet,
    },
    planningApproval: {
      artifactPath: `blueprints/${blueprint.digest}.approval.json`,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(approval),
      content: approval,
    },
    styleAuthority: {
      ...context.style,
      content: context.styleContent,
    },
    visualContractTemplate: {
      artifactPath: context.templateIdentity.artifactPath,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(context.template),
      content: context.template,
      identity: context.templateIdentity,
    },
    reconciliation: {
      artifactPath: context.reconciliationArtifactPath,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(context.reconciliation),
      content: context.reconciliation,
      identity: blueprint.identity.authoringAuthority.reconciliation,
    },
    authoredCoverAuthority: context.authoredCoverAuthority ?? null,
    review: {
      authoredBy: 'synthetic-offline-fixture',
      reviewedBy: 'Guy',
      reviewedAt: '2026-07-27T09:00:00.000Z',
      worldMode: blueprint.visualContract.worldType.includes('fantastical')
        ? 'fantastical'
        : 'grounded',
    },
    requiredBoards: [],
    requiredPropReferences: [],
    layoutPolicy: VISUAL_PACKAGE_V4_LAYOUT_POLICY,
  };
  const candidate = buildVisualPackageV4Candidate(candidateContent);
  const packageReview = {
    version: VISUAL_PACKAGE_V4_PACKAGE_REVIEW_VERSION,
    storyKey: candidate.content.storyKey,
    styleId: candidate.content.styleId,
    packageCandidateDigest: candidate.digest,
    summary: buildVisualPackageV4PackageReviewSummary(candidate.content),
    blockers: [],
    readyForApproval: true,
    doesNotAuthorize: [
      'image_render',
      'publication',
      'locator_update',
      'production_activation',
      'deployment',
      'release',
    ],
    digestAlgorithm: 'canonical-json-sha256',
    digest: '',
  } satisfies VisualPackageV4PackageReview;
  packageReview.digest =
    computeVisualPackageV4PackageReviewDigest(packageReview);
  const draft: VisualPackageV4Draft = {
    ...candidate.content,
    state: 'approved',
    packageReview: {
      artifactPath: `package-reviews/${packageReview.digest}.json`,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(packageReview),
      content: packageReview,
    },
    packageApproval: packageApproval(
      approval.digest,
      candidate.digest,
      packageReview.digest,
      note,
    ),
  };
  return finalizeVisualPackageV4(draft);
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('R1D-PVB-C1 immutable visual-package/v4', () => {
  it.each(shapes)(
    'qualifies the same public package path for %s',
    (shape) => {
      const packageValue = packageFor(buildBlueprintFixture(shape));
      expect(validateVisualPackageV4(packageValue)).toEqual([]);
      expect(packageValue.manifestVersion).toBe('visual-package/v4');
      expect(packageValue.blueprint.content.frames.every((frame) =>
        frame.kind === 'cover'
          ? frame.textSafeRegion.y === 0
          : frame.textSafeRegion.y + frame.textSafeRegion.height === 1000,
      )).toBe(true);
    },
  );

  it('publishes immutable revisions while a current locator remains only a selector', () => {
    const root = temporaryRoot();
    const approvedPackagesDir = path.join(root, 'visual-packages', 'approved');
    const first = packageFor(buildBlueprintFixture('single_location'));
    const firstPublication = publishVisualPackageV4({
      repoRoot: root,
      approvedPackagesDir,
      packageValue: first,
      write: true,
    });
    const frozen = buildFrozenVisualPackageAuthority({
      packageValue: first,
      packagePath: firstPublication.packagePath,
    });
    const second = packageFor(
      buildBlueprintFixture('single_location'),
      'new immutable package revision',
    );
    const secondPublication = publishVisualPackageV4({
      repoRoot: root,
      approvedPackagesDir,
      packageValue: second,
      write: true,
    });

    expect(second.revisionDigest).not.toBe(first.revisionDigest);
    expect(secondPublication.packagePath).not.toBe(firstPublication.packagePath);
    expect(
      loadCurrentVisualPackageV4({
        repoRoot: root,
        locatorPath: secondPublication.locatorPath,
        storyKey: second.storyKey,
        styleId: second.styleId,
      }).packageValue.revisionDigest,
    ).toBe(second.revisionDigest);
    expect(
      loadFrozenVisualPackageV4({ repoRoot: root, frozen }).revisionDigest,
    ).toBe(first.revisionDigest);
    expect(
      evaluateVisualPackageV4Qualification({
        repoRoot: root,
        storyKey: first.storyKey,
        styleId: first.styleId,
        frozenAuthority: frozen,
        expectedOrderSourceRawDigest: first.sourceSnapshot.rawDigest,
      }),
    ).toMatchObject({
      renderQualified: true,
      packagePath: firstPublication.packagePath,
      frozenAuthority: frozen,
    });
    expect(
      evaluateVisualPackageV4Qualification({
        repoRoot: root,
        storyKey: first.storyKey,
        styleId: first.styleId,
        frozenAuthority: frozen,
        expectedOrderSourceRawDigest: 'f'.repeat(64),
      }),
    ).toMatchObject({
      renderQualified: false,
      reasons: [
        'order Story Source snapshot does not match immutable package source identity',
      ],
    });
    expect(
      readFileSync(path.join(root, firstPublication.packagePath), 'utf8'),
    ).toContain(first.revisionDigest);
  });

  it('rejects v3 masquerade, changed immutable content, stale approval, and silent layout remap', () => {
    expect(
      validateVisualPackageV4({
        manifestVersion: 'visual-package/v3',
      }),
    ).toContain('manifestVersion must be "visual-package/v4"');

    const valid = packageFor(buildBlueprintFixture('reveal_timeline'));
    const sourceChanged = clone(valid);
    sourceChanged.sourceSnapshot.content += '\nchanged';
    expect(validateVisualPackageV4(sourceChanged)).toContain(
      'Story Source raw snapshot digest mismatch',
    );

    const approvalChanged = clone(valid);
    approvalChanged.planningApproval.content.approvedAt =
      '2026-07-28T09:00:00.000Z';
    expect(
      validateVisualPackageV4(approvalChanged).some((issue) =>
        issue.includes('planning approval'),
      ),
    ).toBe(true);

    const remapped = clone(valid);
    const body = remapped.blueprint.content.frames.find(
      (frame) => frame.kind === 'page',
    );
    if (!body) throw new Error('fixture body frame missing');
    body.textSafeRegion = { x: 0, y: 0, width: 1000, height: 250 };
    remapped.blueprint.digest = canonicalJsonDigest(remapped.blueprint.content);
    remapped.blueprint.content.digest = remapped.blueprint.digest;
    expect(
      validateVisualPackageV4(remapped).some((issue) =>
        issue.includes('body bottom text-safe band'),
      ),
    ).toBe(true);
  });
});
