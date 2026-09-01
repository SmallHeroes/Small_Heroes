import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { createRequire } from 'module';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadRegistryEntry } from '@/lib/set-identity-board/registry';
import { setIdentityBoardRegistryPath } from '@/lib/set-identity-board/registryPath';
import type { BoardResolverDeps } from '@/lib/set-identity-board/resolveBoards';
import { STYLE_IDS } from '@/lib/styles';

import {
  runWizardRuntimeAuthorityPreflight,
} from '../wizard-runtime-authority-preflight';

const REPO_ROOT = process.cwd();
const STORY_KEY = 'chameleon_koko_bedtime';
const require = createRequire(import.meta.url);
const nextConfig = require('../../../next.config.js') as {
  outputFileTracingIncludes?: Record<string, string[]>;
  outputFileTracingExcludes?: Record<string, string[]>;
};

const PROVIDER_IMPORT_SENTINEL = [
  "const Module = require('node:module');",
  'const originalLoad = Module._load;',
  'Module._load = function(request, parent, isMain) {',
  "  const id = String(request).replaceAll('\\\\', '/');",
  "  if (/(^|\\/)(openai|replicate)(\\/|$)/.test(id) || id.includes('/generate-image')) {",
  "    throw new Error('forbidden_provider_import:' + id);",
  '  }',
  '  return originalLoad.call(this, request, parent, isMain);',
  '};',
].join('\n');

function localApprovedBoardDeps(): BoardResolverDeps {
  const assetShaByStorageKey = new Map<string, string>();
  return {
    loadRegistryEntry(key) {
      const entry = loadRegistryEntry(
        setIdentityBoardRegistryPath(
          key,
          path.join(REPO_ROOT, 'set-identity-boards'),
        ),
      );
      if (entry) assetShaByStorageKey.set(entry.storageKey, entry.assetSha256);
      return entry;
    },
    async resolveDurableUrl(storageKey) {
      return `https://preflight.invalid/${encodeURIComponent(storageKey)}`;
    },
    async fetchAssetSha256(storageKey) {
      return assetShaByStorageKey.get(storageKey) ?? null;
    },
  };
}

describe('deployed Wizard runtime-authority preflight', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects the legacy current Chameleon package before Boards, provider or database reachability', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    const fetchSpy = vi.fn(() => {
      throw new Error('network must remain unreachable with injected Board deps');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const boardResolverDeps = localApprovedBoardDeps();
    const boardByteRead = vi.spyOn(boardResolverDeps, 'fetchAssetSha256');
    await expect(
      runWizardRuntimeAuthorityPreflight(
        {
          repoRoot: REPO_ROOT,
          storyKey: STORY_KEY,
          styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        },
        { boardResolverDeps },
      ),
    ).rejects.toMatchObject({
      code: 'visual_package_not_qualified',
      reasons: expect.arrayContaining([
        'product-accepted Story Source lineage requires a package bound to a final accepted revision',
      ]),
    });
    expect(boardByteRead).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails before package or Board work when enforcement is not exact true', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    await expect(
      runWizardRuntimeAuthorityPreflight(
        {
          repoRoot: REPO_ROOT,
          storyKey: STORY_KEY,
          styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        },
        { boardResolverDeps: localApprovedBoardDeps() },
      ),
    ).rejects.toMatchObject({
      code: 'enforcement_disabled',
    });
  });

  it('fails closed on malformed keys and never reaches Board-byte drift behind an ineligible product package', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    await expect(
      runWizardRuntimeAuthorityPreflight(
        {
          repoRoot: REPO_ROOT,
          storyKey: '../escape',
          styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        },
        { boardResolverDeps: localApprovedBoardDeps() },
      ),
    ).rejects.toMatchObject({
      code: 'request_invalid',
    });

    const deps = localApprovedBoardDeps();
    const originalFetchAssetSha256 = deps.fetchAssetSha256;
    let boardByteReadCount = 0;
    await expect(
      runWizardRuntimeAuthorityPreflight(
        {
          repoRoot: REPO_ROOT,
          storyKey: STORY_KEY,
          styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        },
        {
          boardResolverDeps: {
            ...deps,
            async fetchAssetSha256(storageKey) {
              boardByteReadCount += 1;
              if (boardByteReadCount > 2) return '0'.repeat(64);
              return originalFetchAssetSha256(storageKey);
            },
          },
        },
      ),
    ).rejects.toMatchObject({
      code: 'visual_package_not_qualified',
    });
    expect(boardByteReadCount).toBe(0);
  });

  it('bundles every filesystem authority required by the deployed preflight', () => {
    for (const route of [
      '/api/generate',
      '/api/generate/worker',
      '/api/generate/cron/sweep',
      '/api/dev/generation/resume',
      '/api/dev/runtime-authority-preflight',
      '/api/debug/regen-page',
      '/api/wizard/product-truth',
    ]) {
      expect(nextConfig.outputFileTracingIncludes?.[route]).toContain(
        './story-pipeline/04_approved_story_sources/accepted/**/*',
      );
    }
    expect(
      nextConfig.outputFileTracingIncludes?.[
        '/api/dev/runtime-authority-preflight'
      ],
    ).toEqual([
      './story-bank/**/*',
      './story-pipeline/04_approved_story_sources/accepted/**/*',
      './visual-packages/approved/**/*',
      './set-identity-boards/**/*',
      './style-references/01/**/*',
      './style-references/01-child-template/**/*',
      './public/companions/*/style01-sheets/**/*',
    ]);
    expect(
      nextConfig.outputFileTracingExcludes?.[
        '/api/dev/runtime-authority-preflight'
      ],
    ).toEqual([
      'node_modules/@ffmpeg-installer/**',
      'node_modules/@ffprobe-installer/**',
      'node_modules/@sparticuz/chromium/**',
      'node_modules/puppeteer-core/**',
      'public/companions/**/*.jpg',
      'style-references/02/**',
      'style-references/style-02-locked-samples/**',
    ]);
  });

  it('keeps the public route non-production-only and its transitive load graph provider-free', () => {
    const routeSource = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'app/api/dev/runtime-authority-preflight/route.ts',
      ),
      'utf8',
    );
    const moduleSource = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'lib/generation-pipeline/wizard-runtime-authority-preflight.ts',
      ),
      'utf8',
    );
    expect(routeSource).toMatch(/if \(!isDevEnvironment\(\)\) return devOnlyJsonError\(\)/);
    expect(`${routeSource}\n${moduleSource}`).not.toMatch(
      /generateImage|generateBookCover|generateAllPageImages|prisma|@\/lib\/prisma|@\/backend\/providers\/image/,
    );

    const routeImport = [
      PROVIDER_IMPORT_SENTINEL,
      "import('./app/api/dev/runtime-authority-preflight/route.ts')",
      "  .then(() => process.stdout.write('provider-import-isolated'))",
      '  .catch((error) => { console.error(error); process.exitCode = 1; });',
    ].join('\n');
    const output = execFileSync(
      process.execPath,
      [
        '--require',
        './scripts/shims/register-server-only.cjs',
        '--import',
        'tsx',
        '--eval',
        routeImport,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(output).toBe('provider-import-isolated');

    const sentinelControl = [
      PROVIDER_IMPORT_SENTINEL,
      "import('./lib/generate-image.ts')",
      '  .then(() => process.exitCode = 2)',
      '  .catch((error) => { console.error(error.message); process.exitCode = 1; });',
    ].join('\n');
    const control = spawnSync(
      process.execPath,
      [
        '--require',
        './scripts/shims/register-server-only.cjs',
        '--import',
        'tsx',
        '--eval',
        sentinelControl,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(control.status).toBe(1);
    expect(control.stderr).toContain('forbidden_provider_import:');
    expect(control.stderr).toContain('generate-image.ts');
  });
});
