import { createHash } from 'crypto';
import {
  mkdirSync,
  mkdtempSync,
  cpSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PRE_RENDER_BLUEPRINT_APPROVAL_VERSION,
  VISUAL_PACKAGE_V4_APPROVAL_VERSION,
  VISUAL_PACKAGE_V4_APPROVAL_EXCLUSIONS,
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
  evaluateWizardVisualPackageSelection,
  finalizeVisualPackageV4,
  loadCurrentVisualPackageV4,
  loadFrozenVisualPackageV4,
  loadVisualPackageV4Revision,
  InvalidVisualPackageV4Error,
  publishVisualPackageV4,
  validateVisualPackageV4,
  visualPackageV4LayoutIssues,
  type PreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintAuthoringProvenance,
  type PreRenderBookVisualBlueprint,
  type VisualPackageV4,
  type VisualPackageV4Approval,
  type VisualPackageV4CandidateContent,
  type VisualPackageV4Draft,
  type VisualPackageV4PackageReview,
} from '@/lib/visual-package';
import { auditMvpRenderQualification } from '@/lib/visual-package/audit';
import { evaluateRenderQualificationReleaseGate } from '@/lib/visual-package/releaseGate';

import {
  buildBlueprintFixture,
  type BlueprintFixture,
  type BlueprintFixtureShape,
} from './pre-render-book-visual-blueprint.fixtures';

const roots: string[] = [];
const PRODUCT_STORY_KEY = 'chameleon_koko_bedtime';
const PRODUCT_REVISION =
  '3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a';
const LEGACY_REVISION =
  '20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb';
const PRODUCT_STORY_PATH =
  `story-pipeline/04_approved_story_sources/accepted/${PRODUCT_STORY_KEY}/` +
  `revisions/${PRODUCT_REVISION}/integrated.md`;
const LEGACY_STORY_PATH =
  `story-pipeline/04_approved_story_sources/accepted/${PRODUCT_STORY_KEY}/` +
  `revisions/${LEGACY_REVISION}/integrated.md`;
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

function copyProductLineage(root: string): void {
  const relative =
    `story-pipeline/04_approved_story_sources/accepted/${PRODUCT_STORY_KEY}`;
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(path.join(process.cwd(), relative), target, { recursive: true });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function provenanceFor(
  blueprint: PreRenderBookVisualBlueprint,
): PreRenderBlueprintAuthoringProvenance {
  return {
    version: 'pre-render-blueprint-authoring-provenance/v4',
    blueprintDigest: blueprint.digest,
    authoringAuthorityDigest:
      blueprint.identity.authoringAuthority.digest,
    model: 'synthetic-offline-fixture',
    reasoningEffort: 'medium',
    maxOutputTokens: 48_000,
    noFallback: true,
    draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6',
    promptVersion: 'pre-render-blueprint-authoring-prompt/v5',
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
    doesNotAuthorize: VISUAL_PACKAGE_V4_APPROVAL_EXCLUSIONS,
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
  const blueprint = clone(originalFixture.blueprint);
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

describe('R1D-PVB-C1 immutable visual-package/v5', () => {
  it.each(shapes)(
    'qualifies the same public package path for %s',
    (shape) => {
      const packageValue = packageFor(buildBlueprintFixture(shape));
      expect(validateVisualPackageV4(packageValue)).toEqual([]);
      expect(packageValue.manifestVersion).toBe('visual-package/v5');
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

  it('rejects aliased package-path spellings at the immutable loader and the frozen-authority loader', () => {
    const root = temporaryRoot();
    const approvedPackagesDir = path.join(root, 'visual-packages', 'approved');
    const packageValue = packageFor(buildBlueprintFixture('single_location'));
    const publication = publishVisualPackageV4({
      repoRoot: root,
      approvedPackagesDir,
      packageValue,
      write: true,
    });
    const frozen = buildFrozenVisualPackageAuthority({
      packageValue,
      packagePath: publication.packagePath,
    });
    // Canonical spelling loads.
    expect(
      loadVisualPackageV4Revision({
        repoRoot: root,
        packagePath: publication.packagePath,
      }).revisionDigest,
    ).toBe(packageValue.revisionDigest);
    // Every aliased spelling of the SAME file fails closed at the loader —
    // it must never let expected authority be reconstructed from the alias.
    const aliases = [
      `./${publication.packagePath}`,
      publication.packagePath.replace(
        'visual-packages/',
        'visual-packages//',
      ),
      publication.packagePath.replace(/\//g, '\\'),
      ` ${publication.packagePath}`,
    ];
    for (const alias of aliases) {
      expect(() =>
        loadVisualPackageV4Revision({ repoRoot: root, packagePath: alias }),
      ).toThrow(InvalidVisualPackageV4Error);
      expect(() =>
        loadFrozenVisualPackageV4({
          repoRoot: root,
          frozen: { ...frozen, packagePath: alias },
        }),
      ).toThrow(InvalidVisualPackageV4Error);
    }
  });

  it('admits a current Wizard slot only while its package-bound Story Source remains exact', () => {
    const root = temporaryRoot();
    const approvedPackagesDir = path.join(root, 'visual-packages', 'approved');
    const packageValue = packageFor(buildBlueprintFixture('single_location'));
    const sourcePath = path.join(
      root,
      packageValue.sourceSnapshot.identity.path,
    );
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, packageValue.sourceSnapshot.content, 'utf8');
    const publication = publishVisualPackageV4({
      repoRoot: root,
      approvedPackagesDir,
      packageValue,
      write: true,
    });

    expect(
      evaluateWizardVisualPackageSelection({
        repoRoot: root,
        approvedPackagesDir,
        storyKey: packageValue.storyKey,
        styleId: packageValue.styleId,
      }),
    ).toMatchObject({
      renderQualified: true,
      visualPackageRequired: false,
      packagePath: publication.packagePath,
      sourcePath: packageValue.sourceSnapshot.identity.path,
      sourceRawDigest: packageValue.sourceSnapshot.rawDigest,
      pageCount: packageValue.sourceSnapshot.identity.pageCount,
      reasons: [],
    });

    writeFileSync(
      sourcePath,
      `${packageValue.sourceSnapshot.content}\nchanged`,
      'utf8',
    );
    expect(
      evaluateWizardVisualPackageSelection({
        repoRoot: root,
        approvedPackagesDir,
        storyKey: packageValue.storyKey,
        styleId: packageValue.styleId,
      }),
    ).toMatchObject({
      renderQualified: false,
      packageValue: null,
      frozenAuthority: null,
      sourcePath: null,
    });
  });

  it('requires a product-accepted lineage package to bind a final accepted revision, never its legacy predecessor', () => {
    const legacyRoot = temporaryRoot();
    copyProductLineage(legacyRoot);
    const legacySource = readFileSync(
      path.join(legacyRoot, LEGACY_STORY_PATH),
      'utf8',
    );
    const legacyPackage = packageFor(
      buildBlueprintFixture('wizard_runtime_qualification', {
        storyKey: PRODUCT_STORY_KEY,
        pageCount: 8,
        rawStorySource: legacySource,
        sourcePath: LEGACY_STORY_PATH,
      }),
    );
    publishVisualPackageV4({
      repoRoot: legacyRoot,
      approvedPackagesDir: path.join(
        legacyRoot,
        'visual-packages',
        'approved',
      ),
      packageValue: legacyPackage,
      write: true,
    });
    expect(
      evaluateWizardVisualPackageSelection({
        repoRoot: legacyRoot,
        storyKey: PRODUCT_STORY_KEY,
        styleId: legacyPackage.styleId,
      }),
    ).toMatchObject({
      renderQualified: false,
      visualPackageRequired: true,
      packageValue: null,
      frozenAuthority: null,
      reasons: expect.arrayContaining([
        'product-accepted Story Source lineage requires a package bound to a final accepted revision',
      ]),
    });

    const productRoot = temporaryRoot();
    copyProductLineage(productRoot);
    const productSource = readFileSync(
      path.join(productRoot, PRODUCT_STORY_PATH),
      'utf8',
    );
    const productPackage = packageFor(
      buildBlueprintFixture('wizard_runtime_qualification', {
        storyKey: PRODUCT_STORY_KEY,
        pageCount: 8,
        rawStorySource: productSource,
        sourcePath: PRODUCT_STORY_PATH,
      }),
    );
    publishVisualPackageV4({
      repoRoot: productRoot,
      approvedPackagesDir: path.join(
        productRoot,
        'visual-packages',
        'approved',
      ),
      packageValue: productPackage,
      write: true,
    });
    expect(
      evaluateWizardVisualPackageSelection({
        repoRoot: productRoot,
        storyKey: PRODUCT_STORY_KEY,
        styleId: productPackage.styleId,
      }),
    ).toMatchObject({
      renderQualified: true,
      visualPackageRequired: true,
      sourcePath: PRODUCT_STORY_PATH,
      reasons: [],
    });

    const audit = auditMvpRenderQualification({
      repoRoot: productRoot,
      styleId: productPackage.styleId,
    });
    const productRecord = audit.records.find(
      (record) => record.storyKey === PRODUCT_STORY_KEY,
    );
    expect(productRecord).toMatchObject({
      productSellable: true,
      renderQualified: true,
      storySourcePath: PRODUCT_STORY_PATH,
      reasons: [],
    });
    expect(productRecord?.approvedPackagePath).toContain(
      productPackage.revisionDigest,
    );
    expect(
      evaluateRenderQualificationReleaseGate(audit, true).failures.map(
        (failure) => failure.storyKey,
      ),
    ).not.toContain(PRODUCT_STORY_KEY);
  });

  it('rejects unknown current-locator keys before Wizard sellability', () => {
    const root = temporaryRoot();
    const approvedPackagesDir = path.join(root, 'visual-packages', 'approved');
    const packageValue = packageFor(buildBlueprintFixture('single_location'));
    const sourcePath = path.join(
      root,
      packageValue.sourceSnapshot.identity.path,
    );
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, packageValue.sourceSnapshot.content, 'utf8');
    const publication = publishVisualPackageV4({
      repoRoot: root,
      approvedPackagesDir,
      packageValue,
      write: true,
    });
    const locatorPath = path.join(root, publication.locatorPath);
    const hostileLocator = {
      ...(JSON.parse(readFileSync(locatorPath, 'utf8')) as Record<
        string,
        unknown
      >),
      hostileExtraKey: true,
    };
    writeFileSync(locatorPath, `${JSON.stringify(hostileLocator)}\n`, 'utf8');

    expect(() =>
      loadCurrentVisualPackageV4({
        repoRoot: root,
        locatorPath: publication.locatorPath,
        storyKey: packageValue.storyKey,
        styleId: packageValue.styleId,
      }),
    ).toThrow('current locator keys are invalid');
    expect(
      evaluateWizardVisualPackageSelection({
        repoRoot: root,
        approvedPackagesDir,
        storyKey: packageValue.storyKey,
        styleId: packageValue.styleId,
      }),
    ).toMatchObject({
      renderQualified: false,
      packageValue: null,
      frozenAuthority: null,
      sourcePath: null,
    });
  });

  it('rejects v3 masquerade, changed immutable content, stale approval, and silent layout remap', () => {
    expect(
      validateVisualPackageV4({
        manifestVersion: 'visual-package/v3',
      }),
    ).toContain('manifestVersion must be "visual-package/v5"');

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

  it('uses the shared supported range without remapping package geometry', () => {
    const packageValue = packageFor(buildBlueprintFixture('single_location'));
    const body = packageValue.blueprint.content.frames.find(
      (frame) => frame.kind === 'page',
    );
    if (!body) throw new Error('fixture body frame missing');
    body.textSafeRegion = { x: 0, y: 650, width: 1000, height: 350 };
    expect(visualPackageV4LayoutIssues(packageValue)).toEqual([]);
    expect(body.textSafeRegion).toEqual({
      x: 0,
      y: 650,
      width: 1000,
      height: 350,
    });
  });
});
