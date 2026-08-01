import fs from 'fs';
import os from 'os';
import path from 'path';

import type { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enforceMvpOrderSlot } from '@/backend/config/mvp-story-matrix';
import { resolveStoryProductTruth } from '@/backend/providers/story-product-resolver';
import { STYLE_IDS } from '@/lib/styles';
import {
  computeVisualContractHash,
  materialize,
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

  it('projects the exact frozen visual-package/v4 and Blueprint authority without reaching an image provider', async () => {
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
      challengeCategory: 'MEDICAL_PROCEDURE',
      clientDirection: 'adventure',
      clientCompanionId: 'bunny_ometz',
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
      'story-bank/v3-approved/bunny_ometz_adventure.md',
    );
    const rawStorySource = fs.readFileSync(productTruth.storyFile, 'utf8');
    const { packageValue } = buildVisualPackageV4Fixture(
      'wizard_runtime_qualification',
      undefined,
      {
        rawStorySource,
        sourcePath: frozenProduct.selectionFilename,
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        styleContent: {
          styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
          renderingContract: 'offline qualification fixture',
        },
      },
    );
    expect(packageValue.sourceSnapshot.rawDigest).toBe(
      frozenProduct.storySourceHash,
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
    expect(runtimeAuthority).toMatchObject({
      version: 'style01-runtime-authority/v5',
      qualification: {
        renderQualified: true,
        approvedPackagePath: publication.packagePath,
      },
      frozenAuthority: frozenPackage,
      contractHash: frozenContractHash,
      bookProjection: {
        version: 'runtime-blueprint-book-projection/v2',
        packageRevisionDigest: packageValue.revisionDigest,
        blueprintDigest: packageValue.blueprint.digest,
      },
    });
    expect(runtimeAuthority?.packageValue.manifestVersion).toBe(
      'visual-package/v4',
    );
    expect(runtimeAuthority?.packageValue.blueprint.content.version).toBe(
      'pre-render-book-visual-blueprint/v3',
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
  });
});
