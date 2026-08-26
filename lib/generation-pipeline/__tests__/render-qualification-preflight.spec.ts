import fs from 'fs';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RenderQualificationPreflightError,
  runAfterPageReferencePreflight,
  runWithStyle01RenderQualification,
} from '../render-qualification-preflight';
import { PageReferenceCompatibilityError } from '../page-reference-authority';
import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import { SET_IDENTITY_BOARD_VERSION } from '@/lib/set-identity-board';

const REPO = process.cwd();
const CACHE = {
  storyFilePath: 'story-bank/v3-approved/fox_uri_adventure.md',
  storyDir: 'v3-approved',
  selectionFilename: 'fox_uri_adventure.md',
};

const PACKAGE_REVISION = 'a'.repeat(64);
const PACKAGE_SOURCE_DIGEST = 'b'.repeat(64);
const PACKAGE_SOURCE =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/' +
  `revisions/${PACKAGE_REVISION}/integrated.md`;
const PACKAGE_CACHE = {
  storyFilePath: PACKAGE_SOURCE,
  storyKey: 'chameleon_koko_bedtime',
  storySourceAuthorityKind: 'product_accepted_revision' as const,
  selectionFilename: 'integrated.md',
};
const PACKAGE_ORDER_WITHOUT_AUTHORITY = {
  selectionFilename: PACKAGE_SOURCE,
  storySourceHash: PACKAGE_SOURCE_DIGEST,
  illustrationStyle: 'soft_hand_drawn_storybook',
};

describe('shipped Style01 render-qualification preflight', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('blocks before the first image-provider callback when non-production enforcement is enabled', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    const provider = vi.fn(async () => 'paid-image');

    await expect(
      runWithStyle01RenderQualification(
        {
          illustrationStyle: 'soft_hand_drawn_storybook',
          cache: CACHE,
          repoRoot: REPO,
        },
        provider,
      ),
    ).rejects.toBeInstanceOf(RenderQualificationPreflightError);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ['cover', [0]],
    ['batch/resume', [1]],
    ['single-page/rerender', [1]],
  ])('blocks a forbidden reference before the %s callback is reachable', async (_label, pageNumbers) => {
    const contract = {
      locations: [{ id: 'loc_room', setIdentityId: 'set_room' }],
      recurringProps: [{
        id: 'prop_reveal',
        name: 'Covered Parcel',
        description: 'a parcel',
        firstRevealPage: 2,
      }],
      coverContract: { locationId: 'loc_room' },
      pageContracts: [{
        pageNumber: 1,
        locationId: 'loc_room',
        propConstraints: [{ propId: 'prop_reveal', visibility: 'forbidden' }],
      }],
    } as unknown as BookVisualContract;
    const authority = {
      repoRoot: REPO,
      contract,
      boardBindings: {
        mode: 'required-v2' as const,
        frozenContractHash: 'fixture-hash',
        bindings: {
          set_room: {
            setIdentityId: 'set_room',
            setDefinitionHash: 'fixture-definition',
            contentPolicyDigest: 'fixture-policy',
            declaredPropIds: ['prop_reveal'],
            styleId: 'soft_hand_drawn_storybook',
            storageKey: 'fixture-board',
            resolvedUrl: 'https://fixtures.invalid/board.png',
            assetSha256: 'fixture-sha',
            boardVersion: SET_IDENTITY_BOARD_VERSION,
            approvedAt: '2026-07-22T00:00:00.000Z',
          },
        },
      },
      packageValue: { requiredPropReferences: [] },
    };
    const provider = vi.fn(async () => 'paid-image');
    await expect(
      runAfterPageReferencePreflight(authority as never, pageNumbers, provider),
    ).rejects.toBeInstanceOf(PageReferenceCompatibilityError);
    expect(provider).not.toHaveBeenCalled();
  });

  it('enforcement off preserves the explicitly non-qualified legacy/dev path', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    const provider = vi.fn(async () => 'legacy-image');
    await expect(
      runWithStyle01RenderQualification(
        { illustrationStyle: 'soft_hand_drawn_storybook', cache: CACHE, repoRoot: REPO },
        provider,
      ),
    ).resolves.toBe('legacy-image');
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('legacy Vercel production remains hard-off even if the enforcement variable leaks on', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    const provider = vi.fn(async () => 'production-legacy-image');
    await expect(
      runWithStyle01RenderQualification(
        { illustrationStyle: 'soft_hand_drawn_storybook', cache: CACHE, repoRoot: REPO },
        provider,
      ),
    ).resolves.toBe('production-legacy-image');
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['preview with enforcement off', 'preview', 'false'],
    ['Production even when enforcement is on', 'production', 'true'],
  ])(
    'package-backed Order fails before the provider in %s when its durable authority is missing',
    async (_label, vercelEnv, enforcement) => {
      vi.stubEnv('VERCEL_ENV', vercelEnv);
      vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', enforcement);
      const provider = vi.fn(async () => 'paid-image');

      await expect(
        runWithStyle01RenderQualification(
          {
            illustrationStyle: 'soft_hand_drawn_storybook',
            order: PACKAGE_ORDER_WITHOUT_AUTHORITY,
            cache: PACKAGE_CACHE,
            repoRoot: REPO,
            pageNumbers: [0, 1],
          },
          provider,
        ),
      ).rejects.toMatchObject({
        qualification: {
          renderQualified: false,
          orderVisualPackageAuthorityRequired: true,
          reasons: [
            expect.objectContaining({ code: 'frozen_authority_mismatch' }),
          ],
        },
      });
      expect(provider).not.toHaveBeenCalled();
    },
  );

  it('the shipped chunk runner wraps both cover and page provider entry points', () => {
    const source = fs.readFileSync(path.join(REPO, 'lib/generation-pipeline/chunk-runner.ts'), 'utf8');
    expect(source).toMatch(/runWithStyle01RenderQualification\([\s\S]*?generateBookCover\(/);
    expect(source).toMatch(/runWithStyle01RenderQualification\([\s\S]*?generateAllPageImages\(/);
    expect(source.match(/runWithStyle01RenderQualification\(/g)).toHaveLength(2);
    expect(
      source.match(
        /runWithStyle01RenderQualification\(\s*\{[\s\S]*?storySourceHash:[^\n]+\n\s*order,\s*\n\s*cache,/g,
      ),
    ).toHaveLength(2);
    expect(source.match(/runtimeVisualAuthorityRequired,/g)).toHaveLength(2);
    expect(source).toMatch(/pageNumbers:\s*\[0\]/);
    expect(source).toMatch(/pageNumbers:\s*pagesForGen\.map/);
    expect(
      source.match(/runtimeAuthorityObservability:/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(6);
    expect(source).toMatch(
      /runtimeBlueprintEvidence\?\.layoutPolicy\.textZone[\s\S]*?does not match approved Blueprint frame/,
    );
    expect(source.match(/sourceSnapshot\.content/g)).toHaveLength(2);
    expect(source).toMatch(
      /if \(!earlyRuntimeAuthority\) \{[\s\S]*?resolveBookShotPlan[\s\S]*?ensureStoryLocationPlan[\s\S]*?resolveSceneMemoryPlan/,
    );
    expect(source).toMatch(
      /if \(earlyRuntimeAuthority\) \{[\s\S]*?frame\.safeScenePrompt[\s\S]*?frame\.castIds/,
    );
    expect(source).toMatch(
      /storyTitle: earlyRuntimeAuthority \? '' : story\.title/,
    );
  });

  it('the operator single-page regeneration path preflights before fallback work and rechecks adjacent to render', () => {
    const source = fs.readFileSync(path.join(REPO, 'lib/single-page-image-regen.ts'), 'utf8');
    const earlyGate = source.indexOf('const earlyRuntimeAuthority = requireStyle01RenderQualification');
    const legacySelection = source.indexOf('selectCompanionStory(');
    const renderWrapper = source.indexOf('runWithStyle01RenderQualification(');
    const provider = source.indexOf(
      'generateSinglePageWithRuntimeCanvas({',
      renderWrapper,
    );
    expect(earlyGate).toBeGreaterThan(-1);
    expect(earlyGate).toBeLessThan(legacySelection);
    expect(renderWrapper).toBeLessThan(provider);
    expect(source).toMatch(/pageNumbers:\s*\[pageNumber\]/);
    expect(source).toMatch(/runtimeVisualAuthority/);
    expect(source.match(/order,\s*\n\s*cache: pipelineCache,/g)).toHaveLength(2);
    expect(source).toMatch(/runtimeVisualAuthorityRequired,/);
    expect(source).toMatch(
      /loadStoryFromBankContent\([\s\S]*?sourceSnapshot\.content/,
    );
    expect(source).toMatch(
      /provider result is missing or mismatched exact Blueprint-frame evidence/,
    );
    expect(source).toMatch(
      /runtimeAuthorityObservability[\s\S]*?persistQualityContext/,
    );
    expect(source).toMatch(
      /runtimeAuthorityKeySuffix[\s\S]*?frameProjectionDigest/,
    );
    expect(source).toMatch(
      /pageAssetOperationKey\([\s\S]*?runtimeAuthorityKeySuffix/,
    );
    expect(source).toMatch(
      /provider text zone[\s\S]*?does not match approved Blueprint frame/,
    );
    expect(source).toMatch(
      /const pageForGeneration = approvedBlueprintFrame[\s\S]*?approvedBlueprintFrame\.safeScenePrompt[\s\S]*?: \(\(\) => \{[\s\S]*?deriveLayout/,
    );
    expect(source).toMatch(
      /const dna = earlyRuntimeAuthority[\s\S]*?: await generateStoryBankCharacterDNA/,
    );
    expect(source).toMatch(
      /if \(!approvedBlueprintFrame && order\.childImageUrl\)/,
    );
    expect(source).toMatch(
      /generateSinglePageWithRuntimeCanvas\(\{[\s\S]*?approvedBlueprintFrame,[\s\S]*?orderPdfEnabled:\s*order\.pdfEnabled/,
    );
  });
});
