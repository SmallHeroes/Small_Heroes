import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PRE_RENDER_BLUEPRINT_APPROVAL_VERSION,
  STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
  VISUAL_PACKAGE_V4_APPROVAL_VERSION,
  assemblePreRenderBookVisualBlueprintFromDraft,
  assembleVisualPackageV4Candidate,
  buildPreRenderBlueprintReviewBundle,
  buildProductionAuthoringContext,
  buildVisualPackageV4Candidate,
  buildVisualPackageV4PackageReview,
  canonicalJsonDigest,
  computePreRenderBlueprintApprovalDigest,
  computeVisualPackageV4ApprovalDigest,
  createPreRenderBlueprintValidationEvidence,
  finalizeApprovedVisualPackageV4,
  persistVisualPackageV4CandidateReview,
  publishVisualPackageV4,
  qualifyVisualPackageV4Candidate,
  type ApprovedBlueprintLifecyclePaths,
  type PreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintAuthoringProvenance,
  type ProductionAuthoringContext,
  type VisualPackageV4Approval,
  type VisualPackageV4Candidate,
  type VisualPackageV4PackageReview,
} from '@/lib/visual-package';

import {
  buildBlueprintFixture,
  type BlueprintFixtureShape,
} from './pre-render-book-visual-blueprint.fixtures';

const roots: string[] = [];
const STYLE_ID = 'soft_hand_drawn_storybook';
const SHAPES: BlueprintFixtureShape[] = [
  'single_location',
  'multi_zone_transition',
  'journey_fantastical',
  'no_companion',
  'reveal_timeline',
];

interface MaterializedLifecycle {
  repoRoot: string;
  storyPath: string;
  templatePath: string;
  reconciliationPath: string;
  stylePath: string;
  context: ProductionAuthoringContext;
  paths: ApprovedBlueprintLifecyclePaths;
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
}

function temporaryRoot(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pvb-d0-package-lifecycle-'),
  );
  roots.push(root);
  return root;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function writeJson(root: string, relative: string, value: unknown): void {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(
    destination,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
}

function writeText(root: string, relative: string, value: string): void {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, value, 'utf8');
}

function styleAuthorityContent(): unknown {
  return JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH),
      'utf8',
    ),
  ) as unknown;
}

function provenanceFor(
  blueprintDigest: string,
  authoringAuthorityDigest: string,
): PreRenderBlueprintAuthoringProvenance {
  return {
    version: 'pre-render-blueprint-authoring-provenance/v1',
    blueprintDigest,
    authoringAuthorityDigest,
    model: 'synthetic-offline-fixture',
    reasoningEffort: 'high',
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
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  reviewPacketDigest: string;
}): PreRenderBlueprintApprovalAttestation {
  const payload = {
    version: PRE_RENDER_BLUEPRINT_APPROVAL_VERSION,
    blueprintDigest: args.blueprintDigest,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
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

function packageApproval(args: {
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
  approvedBy?: 'Guy';
}): VisualPackageV4Approval {
  const payload = {
    version: VISUAL_PACKAGE_V4_APPROVAL_VERSION,
    approvedBy: args.approvedBy ?? 'Guy',
    approvedAt: '2026-07-27T10:00:00.000Z',
    scope: 'immutable_runtime_authority_promotion',
    blueprintApprovalDigest:
      args.candidate.content.planningApproval.content.digest,
    packageCandidateDigest: args.candidate.digest,
    packageReviewDigest: args.packageReview.digest,
  } as const;
  const approval = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: '',
  } satisfies VisualPackageV4Approval;
  approval.digest = computeVisualPackageV4ApprovalDigest(approval);
  return approval;
}

function materialize(
  shape: BlueprintFixtureShape = 'single_location',
): MaterializedLifecycle {
  const repoRoot = temporaryRoot();
  const fixture = buildBlueprintFixture(shape);
  const storyKey = fixture.blueprint.identity.storyKey;
  const storyPath = fixture.context.source.path;
  const templatePath = fixture.context.templateIdentity.artifactPath;
  const reconciliationPath = fixture.context.reconciliationArtifactPath;
  const stylePath = STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH;
  writeText(repoRoot, storyPath, fixture.context.rawStorySource);
  writeJson(repoRoot, templatePath, fixture.context.template);
  writeJson(repoRoot, reconciliationPath, fixture.context.reconciliation);
  writeJson(repoRoot, stylePath, styleAuthorityContent());

  const context = buildProductionAuthoringContext({
    repoRoot,
    storyKey,
    storyPath,
    templatePath,
    reconciliationPath,
    styleId: STYLE_ID,
    styleAuthorityPath: stylePath,
  });
  const draft = {
    worldPlan: clone(fixture.blueprint.worldPlan),
    frames: clone(fixture.blueprint.frames).map((frame) => ({
      ...frame,
      pageNumber: frame.kind === 'cover' ? null : frame.pageNumber,
      textSafeRegion:
        frame.kind === 'cover'
          ? { x: 0, y: 0, width: 1000, height: 250 }
          : { x: 0, y: 750, width: 1000, height: 250 },
    })),
  };
  const blueprint = assemblePreRenderBookVisualBlueprintFromDraft({
    draft,
    context: context.validationContext,
  });
  const provenance = provenanceFor(
    blueprint.digest,
    blueprint.identity.authoringAuthority.digest,
  );
  const validationEvidence =
    createPreRenderBlueprintValidationEvidence({
      blueprint,
      context: context.validationContext,
    });
  const review = buildPreRenderBlueprintReviewBundle({
    blueprint,
    context: context.validationContext,
    provenance,
  });
  const approval = planningApproval({
    blueprintDigest: blueprint.digest,
    authoringAuthorityDigest:
      blueprint.identity.authoringAuthority.digest,
    reviewPacketDigest: review.packet.digest,
  });
  const base = `blueprints/${blueprint.digest}`;
  const paths: ApprovedBlueprintLifecyclePaths = {
    blueprintPath: `${base}.json`,
    authoringProvenancePath: `${base}.provenance.json`,
    validationEvidencePath: `${base}.validation.json`,
    reviewPacketPath: `${base}.review.json`,
    planningApprovalPath: `${base}.approval.json`,
  };
  writeJson(repoRoot, paths.blueprintPath, blueprint);
  writeJson(repoRoot, paths.authoringProvenancePath, provenance);
  writeJson(repoRoot, paths.validationEvidencePath, validationEvidence);
  writeJson(repoRoot, paths.reviewPacketPath, review.packet);
  writeJson(repoRoot, paths.planningApprovalPath, approval);

  const assembled = assembleVisualPackageV4Candidate({
    repoRoot,
    context,
    approvedBlueprintPaths: paths,
    review: {
      authoredBy: 'synthetic-offline-fixture',
      reviewedBy: 'Guy',
      reviewedAt: '2026-07-27T09:30:00.000Z',
      worldMode: fixture.context.template.worldType.includes(
        'fantastical',
      )
        ? 'fantastical'
        : 'grounded',
    },
  });
  return {
    repoRoot,
    storyPath,
    templatePath,
    reconciliationPath,
    stylePath,
    context,
    paths,
    ...assembled,
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('production visual-package/v4 candidate lifecycle', () => {
  it.each(SHAPES)(
    'assembles and dry-qualifies the general %s story shape without propagating Blueprint approval',
    (shape) => {
      const lifecycle = materialize(shape);
      const result = qualifyVisualPackageV4Candidate({
        repoRoot: lifecycle.repoRoot,
        candidate: lifecycle.candidate,
        packageReview: lifecycle.packageReview,
      });
      expect(result.zeroWrite).toBe(true);
      expect(result.candidateValid).toBe(true);
      expect(result.reviewReady).toBe(true);
      expect(result.approvalValid).toBe(false);
      expect(result.readyForPublication).toBe(false);
      expect(result.reasons.map((reason) => reason.code)).toEqual([
        'package_approval_missing',
      ]);
      expect(
        fs.existsSync(path.join(lifecycle.repoRoot, 'visual-packages')),
      ).toBe(false);
    },
  );

  it('keeps exact package approval and immutable publication as separate boundaries', () => {
    const lifecycle = materialize();
    const approval = packageApproval(lifecycle);
    const persistence = persistVisualPackageV4CandidateReview({
      repoRoot: lifecycle.repoRoot,
      outputDir: 'visual-packages/working',
      candidate: lifecycle.candidate,
      packageReview: lifecycle.packageReview,
      write: true,
    });
    const qualification = qualifyVisualPackageV4Candidate({
      repoRoot: lifecycle.repoRoot,
      candidate: lifecycle.candidate,
      packageReview: lifecycle.packageReview,
      approval,
    });
    expect(qualification.readyForPublication).toBe(true);
    const packageValue = finalizeApprovedVisualPackageV4({
      repoRoot: lifecycle.repoRoot,
      candidate: lifecycle.candidate,
      packageReview: lifecycle.packageReview,
      packageReviewArtifactPath: persistence.packageReviewPath,
      approval,
    });
    const publicationPlan = publishVisualPackageV4({
      repoRoot: lifecycle.repoRoot,
      approvedPackagesDir: path.join(
        lifecycle.repoRoot,
        'visual-packages',
        'approved',
      ),
      packageValue,
      write: false,
    });
    expect(publicationPlan.wrote).toBe(false);
    expect(fs.existsSync(path.join(lifecycle.repoRoot, publicationPlan.packagePath)))
      .toBe(false);
    expect(fs.existsSync(path.join(lifecycle.repoRoot, publicationPlan.locatorPath)))
      .toBe(false);
  });

  it.each([
    {
      expected: 'source_stale',
      mutate: (value: MaterializedLifecycle) =>
        fs.appendFileSync(
          path.join(value.repoRoot, value.storyPath),
          '\nA later source edit.\n',
          'utf8',
        ),
    },
    {
      expected: 'template_stale',
      mutate: (value: MaterializedLifecycle) => {
        const template = clone(value.context.template.content);
        template.locations[0].description += ' changed';
        writeJson(value.repoRoot, value.templatePath, template);
      },
    },
    {
      expected: 'style_stale',
      mutate: (value: MaterializedLifecycle) => {
        const style = clone(value.context.styleAuthority.content);
        style.medium.push('changed after authoring');
        writeJson(value.repoRoot, value.stylePath, style);
      },
    },
    {
      expected: 'reconciliation_stale',
      mutate: (value: MaterializedLifecycle) => {
        const reconciliation = clone(value.context.reconciliation.content) as {
          review: { reviewedAt: string };
        };
        reconciliation.review.reviewedAt =
          '2026-07-27T11:00:00.000Z';
        writeJson(
          value.repoRoot,
          value.reconciliationPath,
          reconciliation,
        );
      },
    },
    {
      expected: 'blueprint_stale',
      mutate: (value: MaterializedLifecycle) => {
        const blueprint = clone(value.candidate.content.blueprint.content);
        blueprint.digest = '0'.repeat(64);
        writeJson(value.repoRoot, value.paths.blueprintPath, blueprint);
      },
    },
  ])(
    'fails closed when an exact lifecycle dependency becomes $expected',
    ({ expected, mutate }) => {
      const lifecycle = materialize();
      mutate(lifecycle);
      const result = qualifyVisualPackageV4Candidate({
        repoRoot: lifecycle.repoRoot,
        candidate: lifecycle.candidate,
        packageReview: lifecycle.packageReview,
      });
      expect(result.readyForPublication).toBe(false);
      expect(result.reasons.map((reason) => reason.code)).toContain(
        expected,
      );
    },
  );

  it('rejects stale review/approval, self-approval, v3 fallback, and malformed package input without throwing', () => {
    const lifecycle = materialize();
    const approval = packageApproval(lifecycle);
    const changedCandidate = buildVisualPackageV4Candidate({
      ...lifecycle.candidate.content,
      review: {
        ...lifecycle.candidate.content.review,
        reviewedAt: '2026-07-27T10:30:00.000Z',
      },
    });
    const stale = qualifyVisualPackageV4Candidate({
      repoRoot: lifecycle.repoRoot,
      candidate: changedCandidate,
      packageReview: lifecycle.packageReview,
      approval,
    });
    expect(stale.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        'package_review_invalid',
        'package_approval_invalid',
      ]),
    );

    const selfApproved = {
      ...approval,
      approvedBy: 'Codex',
    };
    const selfResult = qualifyVisualPackageV4Candidate({
      repoRoot: lifecycle.repoRoot,
      candidate: lifecycle.candidate,
      packageReview: lifecycle.packageReview,
      approval: selfApproved,
    });
    expect(selfResult.reasons.map((reason) => reason.code)).toContain(
      'package_approval_invalid',
    );

    const legacy = clone(lifecycle.candidate) as unknown as {
      content: { manifestVersion: string };
    };
    legacy.content.manifestVersion = 'visual-package/v3';
    const legacyResult = qualifyVisualPackageV4Candidate({
      repoRoot: lifecycle.repoRoot,
      candidate: legacy,
      packageReview: lifecycle.packageReview,
    });
    expect(legacyResult.reasons.map((reason) => reason.code)).toContain(
      'legacy_authority_forbidden',
    );
    expect(() =>
      qualifyVisualPackageV4Candidate({
        repoRoot: lifecycle.repoRoot,
        candidate: { manifestVersion: 'visual-package/v1' },
        packageReview: null,
        approval: {},
      }),
    ).not.toThrow();
  });

  it('rejects historical Board identity and portrait-layout contradictions', () => {
    const lifecycle = materialize();
    const boardCandidate = buildVisualPackageV4Candidate({
      ...lifecycle.candidate.content,
      requiredBoards: [
        {
          artifactPath: 'legacy/board.json',
          artifactDigest: 'a'.repeat(64),
          registryVersion: 'set-identity-board-registry/v1',
          boardVersion: 'set-identity-board/v1',
          storyKey: lifecycle.context.storyKey,
          setIdentityId: 'set:legacy',
          styleId: STYLE_ID,
          setDefinitionHash: 'b'.repeat(64),
          contentPolicyDigest: 'c'.repeat(64),
          declaredPropIds: [],
          storageKey: 'legacy/board.png',
          assetSha256: 'd'.repeat(64),
          approvedBy: 'guy',
          approvedAt: '2026-07-27T08:00:00.000Z',
        },
      ],
    });
    const boardReview = buildVisualPackageV4PackageReview({
      candidate: boardCandidate,
    });
    const boardResult = qualifyVisualPackageV4Candidate({
      repoRoot: lifecycle.repoRoot,
      candidate: boardCandidate,
      packageReview: boardReview,
    });
    expect(boardResult.reasons.map((reason) => reason.code)).toContain(
      'board_stale',
    );

    const content = clone(lifecycle.candidate.content);
    content.blueprint.content.frames[1].textSafeRegion = {
      x: 0,
      y: 0,
      width: 1000,
      height: 250,
    };
    content.blueprint.content.digest = canonicalJsonDigest(
      (() => {
        const {
          digest: _digest,
          digestAlgorithm: _digestAlgorithm,
          ...draft
        } = content.blueprint.content;
        return draft;
      })(),
    );
    content.blueprint.digest = content.blueprint.content.digest;
    const layoutCandidate = buildVisualPackageV4Candidate(content);
    const layoutReview = buildVisualPackageV4PackageReview({
      candidate: layoutCandidate,
    });
    const layoutResult = qualifyVisualPackageV4Candidate({
      repoRoot: lifecycle.repoRoot,
      candidate: layoutCandidate,
      packageReview: layoutReview,
    });
    expect(layoutResult.reasons.map((reason) => reason.code)).toContain(
      'layout_incompatible',
    );
  });

  it('persists content-addressed working artifacts without overwrite', () => {
    const lifecycle = materialize();
    const first = persistVisualPackageV4CandidateReview({
      repoRoot: lifecycle.repoRoot,
      outputDir: 'working',
      candidate: lifecycle.candidate,
      packageReview: lifecycle.packageReview,
      write: true,
    });
    const second = persistVisualPackageV4CandidateReview({
      repoRoot: lifecycle.repoRoot,
      outputDir: 'working',
      candidate: lifecycle.candidate,
      packageReview: lifecycle.packageReview,
      write: true,
    });
    expect(first).toEqual(second);
    fs.writeFileSync(
      path.join(lifecycle.repoRoot, first.candidatePath),
      '{}\n',
      'utf8',
    );
    expect(() =>
      persistVisualPackageV4CandidateReview({
        repoRoot: lifecycle.repoRoot,
        outputDir: 'working',
        candidate: lifecycle.candidate,
        packageReview: lifecycle.packageReview,
        write: true,
      }),
    ).toThrow(/different bytes|immutable/i);
    expect(() =>
      persistVisualPackageV4CandidateReview({
        repoRoot: lifecycle.repoRoot,
        outputDir: '../escape',
        candidate: lifecycle.candidate,
        packageReview: lifecycle.packageReview,
        write: false,
      }),
    ).toThrow(/outside|escapes/i);
  });
});
