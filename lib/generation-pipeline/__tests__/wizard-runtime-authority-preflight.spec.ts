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

  it('proves the real Chameleon package, contract, Boards and every frame without provider or database reachability', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    const fetchSpy = vi.fn(() => {
      throw new Error('network must remain unreachable with injected Board deps');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const boardResolverDeps = localApprovedBoardDeps();
    const boardByteRead = vi.spyOn(boardResolverDeps, 'fetchAssetSha256');
    const result = await runWizardRuntimeAuthorityPreflight(
      {
        repoRoot: REPO_ROOT,
        storyKey: STORY_KEY,
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      },
      { boardResolverDeps },
    );

    expect(result).toMatchObject({
      version: 'wizard-runtime-authority-preflight/v1',
      status: 'passed',
      storyKey: STORY_KEY,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      packageRevisionDigest:
        'a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb',
      sourceRawDigest:
        '2d00d37e8aa290e5353bfe1b94fa2dc498d7200c46f6204bfe7903a033e685d4',
      checkedPageNumbers: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      effects: {
        databaseReads: 0,
        databaseWrites: 0,
        providerCalls: 0,
        imageWrites: 0,
        audioWrites: 0,
        retries: 0,
        fallback: false,
        storageReads: 4,
      },
    });
    expect(result.contractHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.packageAuthorityDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.blueprintDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.boardBindings.map((entry) => entry.setIdentityId)).toEqual([
      'set_child_home_night',
      'set_town_night',
    ]);
    expect(
      result.boardBindings.every((entry) =>
        [
          entry.setDefinitionHash,
          entry.contentPolicyDigest,
          entry.assetSha256,
        ].every((digest) => /^[a-f0-9]{64}$/.test(digest)),
      ),
    ).toBe(true);
    expect(boardByteRead).toHaveBeenCalledTimes(4);
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

  it('fails closed on malformed keys and on approved Board-byte drift', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    await expect(
      runWizardRuntimeAuthorityPreflight({
        repoRoot: REPO_ROOT,
        storyKey: '../escape',
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      }),
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
      code: 'board_binding_failed',
    });
    expect(boardByteReadCount).toBe(3);
  });

  it('bundles every filesystem authority required by the deployed preflight', () => {
    expect(
      nextConfig.outputFileTracingIncludes?.[
        '/api/dev/runtime-authority-preflight'
      ],
    ).toEqual([
      './story-bank/**/*',
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
