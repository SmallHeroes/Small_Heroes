import fs from 'fs';
import os from 'os';
import path from 'path';

import type { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';

import { enforceMvpOrderSlot } from '@/backend/config/mvp-story-matrix';
import { resolveStoryProductTruth } from '@/backend/providers/story-product-resolver';
import { STYLE_IDS } from '@/lib/styles';
import {
  computeVisualContractHash,
  materialize,
  projectCoverMustNotShow,
  projectPageMustNotShow,
  projectPageMustShow,
  type BookVisualContract,
  type ResolvedFamilyAppearanceProfile,
} from '@/lib/visual-contract-compiler';
import {
  buildFrozenVisualPackageAuthority,
  publishVisualPackageV4,
} from '@/lib/visual-package';
import { bindApprovedPvbRuntimeAuthority } from '@/lib/visual-package/runtimeAuthority';
import { buildVisualPackageV4Fixture } from '@/lib/visual-package/__tests__/visual-package-v4.fixtures';

import { buildFrozenStoryProductTruth } from '../frozen-product-truth';
import {
  RenderQualificationPreflightError,
  requireStyle01RenderQualification,
  runWithStyle01RenderQualification,
} from '../render-qualification-preflight';

const REPO_ROOT = process.cwd();
const FAMILY: ResolvedFamilyAppearanceProfile = {
  skinTone: 'warm brown',
  hairColour: 'dark brown',
  hairTexture: 'wavy',
};

describe('Wizard/order to chunk-runner render qualification', () => {
  const temporaryRoots: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    for (const root of temporaryRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('projects the exact frozen visual-package/v5 and Blueprint authority without reaching an image provider', async () => {
    vi.stubEnv('ENABLE_V3_APPROVED_BANK', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('network must remain unreachable during qualification');
      }),
    );

    const selectedSlot = enforceMvpOrderSlot({
      challengeCategory: 'NIGHT_FEAR',
      clientDirection: 'adventure',
      clientCompanionId: 'fox_uri',
    });
    const productTruth = resolveStoryProductTruth({
      challengeCategory: selectedSlot.category,
      clientDirection: selectedSlot.direction,
      companionId: selectedSlot.companionId,
    });
    expect(productTruth).toMatchObject({
      source: 'v3_approved_binding',
      storyDirection: 'adventure',
      pages: 12,
    });
    if (!productTruth.storyFile) throw new Error('resolved Story Source is missing');

    const frozenProduct = buildFrozenStoryProductTruth({
      storyFilePath: productTruth.storyFile,
      expectedPageCount: productTruth.pages,
      storyDirection: productTruth.storyDirection,
    });
    expect(frozenProduct.selectionFilename).toBe(
      'story-bank/v3-approved/fox_uri_adventure.md',
    );
    const rawStorySource = fs.readFileSync(productTruth.storyFile, 'utf8');
    expect(rawStorySource).toContain('אוּרי נרתע.');
    expect(rawStorySource).toContain('הם ישבו ליד הדלי.');
    const { packageValue } = buildVisualPackageV4Fixture(
      'wizard_runtime_qualification',
      undefined,
      {
        rawStorySource,
        sourcePath: frozenProduct.selectionFilename,
        storyKey: 'fox_uri_adventure',
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        styleContent: {
          styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
          renderingContract: 'offline qualification fixture',
        },
        mutateTemplate(template) {
          const page6 = template.pageContracts.find(
            (page) => page.pageNumber === 6,
          )!;
          page6.actionRequirements = [
            {
              checkId: 'action:p6_uri_recoils',
              subject: {
                kind: 'entity',
                entity: { kind: 'cast', id: 'child:hero' },
              },
              predicate: 'recoils',
              polarity: 'must',
            },
          ];
          const page11 = template.pageContracts.find(
            (page) => page.pageNumber === 11,
          )!;
          const companionId = template.cast.companion?.id;
          if (!companionId) throw new Error('wizard companion is missing');
          template.recurringProps.push({
            id: 'prop:bucket',
            name: 'Bucket',
            description: 'the exact stable bucket from the Story Source',
            firstRevealPage: 11,
          });
          for (const page of template.pageContracts) {
            if (page.pageNumber >= 11) continue;
            page.propConstraints = [
              ...(page.propConstraints ?? []),
              {
                propId: 'prop:bucket',
                visibility: 'forbidden',
              },
            ];
          }
          page11.propConstraints = [
            ...(page11.propConstraints ?? []),
            {
              propId: 'prop:bucket',
              visibility: 'required',
              anchorId: 'anchor:support',
            },
          ];
          page11.actionRequirements = [
            {
              checkId: 'action:p11_seated_beside_bucket',
              subject: {
                kind: 'cast_group',
                castIds: ['child:hero', companionId],
              },
              predicate: 'sits',
              spatialConstraint: {
                relation: 'beside',
                target: { kind: 'prop', id: 'prop:bucket' },
              },
              polarity: 'must',
            },
          ];
          const projectionContract = template as unknown as BookVisualContract;
          template.coverContract.mustNotShow =
            projectCoverMustNotShow(projectionContract);
          for (const page of template.pageContracts) {
            page.mustShow = [
              `authored narrative beat ${page.pageNumber}`,
              ...projectPageMustShow(page, projectionContract),
            ];
            page.mustNotShow = projectPageMustNotShow(
              page,
              projectionContract,
            );
          }
        },
        mutateReconciliation(reconciliation, template) {
          const coverage = [{
            version: 'action-semantic-coverage/v6' as const,
            pageNumber: 1,
            beatId: 'beat:p1:visual_presentation',
            sourceEvidenceId: `se1_${'d'.repeat(64)}`,
            sourcePhrase: 'fixture presentation source evidence',
            disposition: {
              kind: 'presentation_requirement' as const,
              presentationClass: 'composition_focus' as const,
              contractPointer: '/pageContracts/0/mustShow/0',
              contractValue:
                template.pageContracts[0]!.mustShow[0]!,
            },
            reviewState: 'unreviewed' as const,
          }];
          const coverageDigest = canonicalHash(coverage);
          reconciliation.actionSemanticCoverageAuthority = {
            version:
              'action-semantic-coverage-reconciliation-authority/v1',
            actionSemanticCoverageVersion:
              'action-semantic-coverage/v6',
            actionSemanticCoverageDigest: coverageDigest,
            records: coverage,
          };
          reconciliation.presentationRequirements = {
            version: 'presentation-requirement-reconciliation/v1',
            actionSemanticCoverageVersion:
              'action-semantic-coverage/v6',
            actionSemanticCoverageDigest: coverageDigest,
            requirements: [
              {
                pageNumber: 1,
                beatId: 'beat:p1:visual_presentation',
                sourceEvidenceId: coverage[0]!.sourceEvidenceId,
                presentationClass: 'composition_focus',
                contractPointer: '/pageContracts/0/mustShow/0',
                contractValue:
                  template.pageContracts[0]!.mustShow[0]!,
              },
            ],
          };
        },
        mutateWorld({ template, affordances, frames }) {
          for (const frame of frames) {
            if (frame.kind === 'cover' || (frame.pageNumber ?? 0) < 11) {
              frame.propLifecycle.forbiddenPropIds.push('prop:bucket');
            }
          }
          const updateAction = (
            pageNumber: number,
            checkId: string,
            predicate: 'recoils' | 'sits',
          ) => {
            const frame = frames.find(
              (entry) =>
                entry.kind === 'page' && entry.pageNumber === pageNumber,
            )!;
            const actionPlacement = frame.placements.find(
              (placement) => placement.subject.kind === 'action',
            )!;
            actionPlacement.subject = { kind: 'action', checkId };
            const actionSpace = affordances.find(
              (affordance) =>
                affordance.kind === 'action_space' &&
                affordance.consumers.some(
                  (consumer) =>
                    consumer.kind === 'action' &&
                    consumer.pageNumber === pageNumber,
                ),
            );
            if (!actionSpace || actionSpace.kind !== 'action_space') {
              throw new Error(`wizard action space ${pageNumber} is missing`);
            }
            actionSpace.supportedPredicates = [predicate];
            actionSpace.consumers = [
              { kind: 'action', pageNumber, checkId },
            ];
            return { frame, actionSpace };
          };

          const recoil = updateAction(6, 'action:p6_uri_recoils', 'recoils');
          recoil.actionSpace.supportedSubjectKinds = ['cast'];
          recoil.actionSpace.supportedEntities = [
            { kind: 'cast', id: 'child:hero' },
          ];

          const seated = updateAction(
            11,
            'action:p11_seated_beside_bucket',
            'sits',
          );
          const companionId = template.cast.companion?.id;
          if (!companionId) throw new Error('wizard companion is missing');
          seated.actionSpace.supportedSubjectKinds = ['cast_group'];
          seated.actionSpace.supportedEntities = [
            { kind: 'cast', id: 'child:hero' },
            { kind: 'cast', id: companionId },
            { kind: 'prop', id: 'prop:bucket' },
          ];
          seated.actionSpace.supportedSpatialDirections = [];
          seated.actionSpace.supportedSpatialRelations = [];
          seated.actionSpace.supportedSpatialConstraintRelations = ['beside'];
          seated.actionSpace.spatialTargetRegions = [];
          seated.actionSpace.maximumActors = 2;
          const childPlacement = seated.frame.placements.find(
            (placement) =>
              placement.subject.kind === 'cast' &&
              placement.subject.castId === 'child:hero',
          )!;
          const companionPlacement = seated.frame.placements.find(
            (placement) =>
              placement.subject.kind === 'cast' &&
              placement.subject.castId === companionId,
          )!;
          childPlacement.region = {
            x: 100,
            y: 420,
            width: 100,
            height: 220,
          };
          companionPlacement.region = {
            x: 210,
            y: 420,
            width: 100,
            height: 220,
          };
          seated.frame.placements.push({
            id: 'placement:11:bucket',
            subject: { kind: 'prop', propId: 'prop:bucket' },
            region: { x: 330, y: 450, width: 80, height: 100 },
            depth: 'foreground',
            importance: 'key',
          });
          seated.frame.propLifecycle.requiredPropIds.push('prop:bucket');
          const supportId = 'affordance:placement:11:bucket';
          affordances.push({
            id: supportId,
            kind: 'placement_support',
            zoneId: seated.frame.zoneId,
            footprint: { x: 320, y: 440, width: 100, height: 120 },
            support: { kind: 'anchor', id: 'anchor:support' },
            supportedEntities: [{ kind: 'prop', id: 'prop:bucket' }],
            maximumOccupants: 1,
            consumers: [
              { kind: 'placement', pageNumber: 11, propId: 'prop:bucket' },
            ],
          });
          seated.frame.affordanceIds.push(supportId);
        },
      },
    );
    expect(packageValue.sourceSnapshot.rawDigest).toBe(
      frozenProduct.storySourceHash,
    );
    expect(
      packageValue.reconciliation.content.presentationRequirements,
    ).toMatchObject({
      actionSemanticCoverageVersion: 'action-semantic-coverage/v6',
      requirements: [
        {
          pageNumber: 1,
          presentationClass: 'composition_focus',
          contractPointer: '/pageContracts/0/mustShow/0',
        },
      ],
    });
    const bucketProp = packageValue.visualContractTemplate.content.recurringProps
      .find((prop) => prop.id === 'prop:bucket');
    const bucketRevealFrame = packageValue.blueprint.content.frames.find(
      (frame) => frame.kind === 'page' && frame.pageNumber === 11,
    )!;
    const bucketPermittedFrame = packageValue.blueprint.content.frames.find(
      (frame) => frame.kind === 'page' && frame.pageNumber === 12,
    )!;
    expect(bucketProp?.firstRevealPage).toBe(11);
    expect(
      packageValue.visualContractTemplate.content.setBoardAuthorities ?? [],
    ).toEqual([]);
    expect(
      packageValue.visualContractTemplate.content.zones
        .flatMap((zone) => zone.spatialNodes ?? [])
        .some(
          (node) =>
            node.bindsTo?.kind === 'prop' &&
            node.bindsTo.id === 'prop:bucket',
        ),
    ).toBe(false);
    expect(bucketRevealFrame.propLifecycle.requiredPropIds).toContain(
      'prop:bucket',
    );
    expect(bucketRevealFrame.placements).toContainEqual(
      expect.objectContaining({
        subject: { kind: 'prop', propId: 'prop:bucket' },
      }),
    );
    expect(
      packageValue.blueprint.content.worldPlan.affordances,
    ).toContainEqual(
      expect.objectContaining({
        kind: 'placement_support',
        zoneId: bucketRevealFrame.zoneId,
        support: { kind: 'anchor', id: 'anchor:support' },
        consumers: [
          { kind: 'placement', pageNumber: 11, propId: 'prop:bucket' },
        ],
      }),
    );
    expect(bucketPermittedFrame.propLifecycle).toEqual({
      requiredPropIds: [],
      forbiddenPropIds: [],
    });
    expect(bucketPermittedFrame.placements).not.toContainEqual(
      expect.objectContaining({
        subject: { kind: 'prop', propId: 'prop:bucket' },
      }),
    );

    const qualificationRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'small-heroes-wizard-qualification-'),
    );
    temporaryRoots.push(qualificationRoot);
    const publication = publishVisualPackageV4({
      repoRoot: qualificationRoot,
      approvedPackagesDir: path.join(
        qualificationRoot,
        'visual-packages',
        'approved',
      ),
      packageValue,
      write: true,
    });
    const frozenPackage = buildFrozenVisualPackageAuthority({
      packageValue,
      packagePath: publication.packagePath,
    });
    const contract = bindApprovedPvbRuntimeAuthority(
      materialize(
        structuredClone(packageValue.visualContractTemplate.content),
        FAMILY,
      ),
      packageValue,
      frozenPackage,
    );
    const frozenContractHash = computeVisualContractHash(contract);
    const cache = {
      storyFilePath: frozenProduct.selectionFilename,
      storyDir: 'v3-approved',
      selectionFilename: path.basename(frozenProduct.selectionFilename),
      visualPackageAuthority: frozenPackage,
      visualContract: contract as unknown as Prisma.InputJsonValue,
    };

    const runtimeAuthority = requireStyle01RenderQualification({
      illustrationStyle: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      frozenContractHash,
      storySourceHash: frozenProduct.storySourceHash,
      cache,
      repoRoot: qualificationRoot,
      pageNumbers: Array.from({ length: 13 }, (_, pageNumber) => pageNumber),
    });
    expect(runtimeAuthority).not.toBeNull();
    const { storyDir: _legacyStoryDir, ...cacheWithoutLegacyStoryDir } = cache;
    const acceptedRevisionAuthority = requireStyle01RenderQualification({
      illustrationStyle: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      frozenContractHash,
      storySourceHash: frozenProduct.storySourceHash,
      cache: {
        ...cacheWithoutLegacyStoryDir,
        storyFilePath:
          'story-pipeline/04_approved_story_sources/accepted/fox_uri_adventure/revisions/' +
          `${'a'.repeat(64)}/integrated.md`,
        storyKey: 'fox_uri_adventure',
        storySourceAuthorityKind: 'product_accepted_revision',
        selectionFilename: 'integrated.md',
      },
      repoRoot: qualificationRoot,
      pageNumbers: Array.from(
        { length: 13 },
        (_, pageNumber) => pageNumber,
      ),
    });
    expect(acceptedRevisionAuthority?.qualification.storyKey).toBe(
      'fox_uri_adventure',
    );
    expect(runtimeAuthority).toMatchObject({
      version: 'style01-runtime-authority/v6',
      qualification: {
        renderQualified: true,
        approvedPackagePath: publication.packagePath,
      },
      frozenAuthority: frozenPackage,
      contractHash: frozenContractHash,
      bookProjection: {
        version: 'runtime-blueprint-book-projection/v5',
        packageRevisionDigest: packageValue.revisionDigest,
        blueprintDigest: packageValue.blueprint.digest,
      },
    });
    expect(runtimeAuthority?.packageValue.manifestVersion).toBe(
      'visual-package/v5',
    );
    expect(runtimeAuthority?.packageValue.blueprint.content.version).toBe(
      'pre-render-book-visual-blueprint/v5',
    );
    expect(runtimeAuthority?.bookProjection.frames).toHaveLength(13);
    expect(runtimeAuthority?.bookProjection.frames.map((frame) => frame.pageNumber))
      .toEqual(Array.from({ length: 13 }, (_, pageNumber) => pageNumber));
    expect(
      runtimeAuthority?.bookProjection.frames[1].affordances.find(
        (affordance) => affordance.kind === 'action_space',
      ),
    ).toMatchObject({
      supportedPredicates: ['looks_at'],
      supportedSubjectKinds: ['cast'],
    });
    const recoilFrame = runtimeAuthority?.bookProjection.frames.find(
      (frame) => frame.pageNumber === 6,
    );
    expect(recoilFrame?.contractPage.actionRequirements).toMatchObject([
      { predicate: 'recoils', subject: { kind: 'entity' } },
    ]);
    expect(recoilFrame?.blueprintPromptBlock).toContain('"predicate":"recoils"');
    const seatedFrame = runtimeAuthority?.bookProjection.frames.find(
      (frame) => frame.pageNumber === 11,
    );
    expect(seatedFrame?.contractPage.actionRequirements).toMatchObject([
      {
        subject: {
          kind: 'cast_group',
          castIds: ['child:hero', 'companion:guide'],
        },
        predicate: 'sits',
        spatialConstraint: {
          relation: 'beside',
          target: { kind: 'prop', id: 'prop:bucket' },
        },
      },
    ]);
    expect(seatedFrame?.blueprintPromptBlock).toContain(
      '"spatialConstraint":{"relation":"beside"',
    );
    expect(
      seatedFrame?.placements.some(
        (placement) => placement.subject.kind === 'action_destination',
      ),
    ).toBe(false);

    const imageProvider = vi.fn(async () => 'paid-image');
    await expect(
      runWithStyle01RenderQualification(
        {
          illustrationStyle: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
          frozenContractHash,
          storySourceHash: '0'.repeat(64),
          cache,
          repoRoot: qualificationRoot,
          pageNumbers: [0, 1],
        },
        imageProvider,
      ),
    ).rejects.toBeInstanceOf(RenderQualificationPreflightError);
    expect(imageProvider).not.toHaveBeenCalled();

    const staleContract = structuredClone(contract) as unknown as Record<string, unknown>;
    staleContract.schemaVersion = 'vc-schema/v3';
    const staleCache = {
      ...cache,
      visualContract: staleContract as Prisma.InputJsonValue,
    };
    const staleAuthorityImageProvider = vi.fn(async () => 'paid-image');
    await expect(
      runWithStyle01RenderQualification(
        {
          illustrationStyle: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
          frozenContractHash: computeVisualContractHash(
            staleContract as unknown as BookVisualContract,
          ),
          storySourceHash: frozenProduct.storySourceHash,
          cache: staleCache,
          repoRoot: qualificationRoot,
          pageNumbers: [0, 1],
        },
        staleAuthorityImageProvider,
      ),
    ).rejects.toBeInstanceOf(RenderQualificationPreflightError);
    expect(staleAuthorityImageProvider).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();

    const chunkRunnerSource = fs.readFileSync(
      path.join(REPO_ROOT, 'lib/generation-pipeline/chunk-runner.ts'),
      'utf8',
    );
    expect(chunkRunnerSource).toMatch(/export async function processGenerationChunk/);
    expect(chunkRunnerSource).toMatch(
      /runWithStyle01RenderQualification\([\s\S]*?generateBookCover\(/,
    );
    expect(chunkRunnerSource).toMatch(
      /runWithStyle01RenderQualification\([\s\S]*?generateAllPageImages\(/,
    );
    expect(chunkRunnerSource.match(/runWithStyle01RenderQualification\(/g))
      .toHaveLength(2);
    expect(chunkRunnerSource.match(/runtimeStoryKey\(cache\)/g)).toHaveLength(2);
    expect(chunkRunnerSource).toMatch(
      /const storyFileKey = runtimeStoryKey\(cache\) \?\? undefined;[\s\S]*?resolveStyle01StoryWardrobeLock/,
    );
    expect(chunkRunnerSource).toMatch(
      /const storyFileKey = runtimeStoryKey\(cache\) \?\? undefined;[\s\S]*?resolveStyle02BookWardrobeLock/,
    );
  });
});
