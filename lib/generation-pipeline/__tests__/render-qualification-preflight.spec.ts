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

  it('Vercel production remains hard-off even if the enforcement variable leaks on', async () => {
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

  it('the shipped chunk runner wraps both cover and page provider entry points', () => {
    const source = fs.readFileSync(path.join(REPO, 'lib/generation-pipeline/chunk-runner.ts'), 'utf8');
    expect(source).toMatch(/runWithStyle01RenderQualification\([\s\S]*?generateBookCover\(/);
    expect(source).toMatch(/runWithStyle01RenderQualification\([\s\S]*?generateAllPageImages\(/);
    expect(source.match(/runWithStyle01RenderQualification\(/g)).toHaveLength(2);
    expect(source).toMatch(/pageNumbers:\s*\[0\]/);
    expect(source).toMatch(/pageNumbers:\s*pagesForGen\.map/);
  });

  it('the operator single-page regeneration path preflights before fallback work and rechecks adjacent to render', () => {
    const source = fs.readFileSync(path.join(REPO, 'lib/single-page-image-regen.ts'), 'utf8');
    const earlyGate = source.indexOf('const earlyRuntimeAuthority = requireStyle01RenderQualification');
    const legacySelection = source.indexOf('selectCompanionStory(');
    const renderWrapper = source.indexOf('runWithStyle01RenderQualification(');
    const provider = source.indexOf('generateAllPageImages(');
    expect(earlyGate).toBeGreaterThan(-1);
    expect(earlyGate).toBeLessThan(legacySelection);
    expect(renderWrapper).toBeLessThan(provider);
    expect(source).toMatch(/pageNumbers:\s*\[pageNumber\]/);
    expect(source).toMatch(/runtimeVisualAuthority/);
  });
});
