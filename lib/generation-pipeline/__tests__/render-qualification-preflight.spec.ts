import fs from 'fs';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RenderQualificationPreflightError,
  runWithStyle01RenderQualification,
} from '../render-qualification-preflight';

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
    expect(source).toMatch(/runtimeVisualAuthority/);
  });
});
