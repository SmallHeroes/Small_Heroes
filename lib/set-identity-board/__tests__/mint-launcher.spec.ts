import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { describe, expect, it, vi } from 'vitest';

import {
  CANONICAL_BOARD_MINT_COMMAND,
  DIRECT_TYPESCRIPT_ENTRYPOINT_ERROR,
  USAGE,
  parseArgs,
  runCli,
  runLiveImportPreflight,
  type LiveImportPreflightDeps,
  type MintDeps,
} from '@/scripts/mint-set-identity-board';

const REPO = process.cwd();
const LAUNCHER = path.join(REPO, 'scripts', 'mint-set-identity-board.cjs');
const TYPESCRIPT_ENTRYPOINT = path.join(REPO, 'scripts', 'mint-set-identity-board.ts');
const TSX = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const NETWORK_SENTINEL = path.join(
  REPO,
  'lib',
  'set-identity-board',
  '__tests__',
  'fixtures',
  'deny-network.cjs'
);
const OBSERVED_WRITE_ROOTS = [
  path.join(REPO, 'set-identity-boards'),
  path.join(REPO, 'set-identity-board-candidates'),
];

function snapshotTree(root: string): string[] {
  if (!existsSync(root)) return ['<absent>'];

  const entries: string[] = [];
  const visit = (current: string): void => {
    for (const name of readdirSync(current).sort()) {
      const absolute = path.join(current, name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        entries.push(`dir:${relative}`);
        visit(absolute);
      } else {
        const digest = createHash('sha256').update(readFileSync(absolute)).digest('hex');
        entries.push(`file:${relative}:${stats.size}:${digest}`);
      }
    }
  };
  visit(root);
  return entries;
}

function safeSubprocessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OPENAI_API_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  };
}

function fakePreflightDeps(overrides: Partial<LiveImportPreflightDeps> = {}): LiveImportPreflightDeps {
  return {
    loadRendererModules: vi.fn(async () => ({
      generateGPTImage: vi.fn(),
      resolveStyle01GptModel: vi.fn(() => 'synthetic-image-model'),
    })) as LiveImportPreflightDeps['loadRendererModules'],
    loadStorageModules: vi.fn(async () => ({
      uploadContentAddressedObjectNoOverwrite: vi.fn(),
    })) as LiveImportPreflightDeps['loadStorageModules'],
    inspectVisionSurface: vi.fn(() => ({
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'synthetic-vision-model',
      adapterReady: true,
    })),
    ...overrides,
  };
}

function forbiddenMintDeps(): MintDeps {
  return {
    renderBoard: vi.fn(async () => {
      throw new Error('render callback must not be reachable from preflight');
    }),
    uploadBoard: vi.fn(async () => {
      throw new Error('upload callback must not be reachable from preflight');
    }),
    runBoardQa: vi.fn(async () => {
      throw new Error('Vision callback must not be reachable from preflight');
    }),
    now: vi.fn(() => {
      throw new Error('approval/registry clock must not be reachable from preflight');
    }),
  };
}

describe('canonical board-mint launcher surface', () => {
  it('parses the live-import preflight as a distinct mode and requires it to be used alone', () => {
    expect(parseArgs(['--preflight-live-imports'])).toEqual({ mode: 'preflight-live-imports' });
    expect(() => parseArgs(['--preflight-live-imports', '--render'])).toThrow(/must be used alone/);
  });

  it('advertises only the canonical Node launcher, including copyable dry/mint/approve/preflight commands', () => {
    expect(CANONICAL_BOARD_MINT_COMMAND).toBe('node scripts/mint-set-identity-board.cjs');
    expect(USAGE).toContain(`${CANONICAL_BOARD_MINT_COMMAND} --story`);
    expect(USAGE).toContain(`${CANONICAL_BOARD_MINT_COMMAND} --approve`);
    expect(USAGE).toContain(`${CANONICAL_BOARD_MINT_COMMAND} --preflight-live-imports`);
    expect(USAGE).not.toContain('npx');
    expect(USAGE).not.toContain('scripts/mint-set-identity-board.ts --');
  });

  it('runs preflight loaders without reaching any mint, storage, QA, registry, or approval callback', async () => {
    const mintDeps = forbiddenMintDeps();
    const preflightDeps = fakePreflightDeps();

    await runCli(['--preflight-live-imports'], mintDeps, preflightDeps);

    expect(preflightDeps.loadRendererModules).toHaveBeenCalledOnce();
    expect(preflightDeps.loadStorageModules).toHaveBeenCalledOnce();
    expect(preflightDeps.inspectVisionSurface).toHaveBeenCalledOnce();
    expect(mintDeps.renderBoard).not.toHaveBeenCalled();
    expect(mintDeps.uploadBoard).not.toHaveBeenCalled();
    expect(mintDeps.runBoardQa).not.toHaveBeenCalled();
    expect(mintDeps.now).not.toHaveBeenCalled();
  });

  it('propagates import failures and restores the original fetch boundary', async () => {
    const originalFetch = globalThis.fetch;
    const failure = new Error('synthetic renderer import failure');
    const deps = fakePreflightDeps({
      loadRendererModules: vi.fn(async () => {
        throw failure;
      }),
    });

    await expect(runLiveImportPreflight(deps)).rejects.toBe(failure);
    expect(globalThis.fetch).toBe(originalFetch);
    expect(deps.loadStorageModules).not.toHaveBeenCalled();
    expect(deps.inspectVisionSurface).not.toHaveBeenCalled();
  });

  it('loads help through the canonical launcher on the real Windows-compatible Node path', () => {
    const result = spawnSync(process.execPath, [LAUNCHER, '--help'], {
      cwd: REPO,
      encoding: 'utf8',
      env: safeSubprocessEnv(),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(CANONICAL_BOARD_MINT_COMMAND);
    expect(result.stdout).toContain('--preflight-live-imports');
  }, 20_000);

  it('propagates a child CLI failure through the canonical launcher exit status', () => {
    const result = spawnSync(process.execPath, [LAUNCHER, '--preflight-live-imports', '--render'], {
      cwd: REPO,
      encoding: 'utf8',
      env: safeSubprocessEnv(),
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--preflight-live-imports must be used alone');
  }, 20_000);

  it('refuses the old direct TypeScript entrypoint instead of exposing a shimless live path', () => {
    const result = spawnSync(process.execPath, [TSX, TYPESCRIPT_ENTRYPOINT, '--help'], {
      cwd: REPO,
      encoding: 'utf8',
      env: safeSubprocessEnv(),
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(DIRECT_TYPESCRIPT_ENTRYPOINT_ERROR);
  }, 20_000);

  it('loads the exact live renderer/storage graph with shim-first ordering and no external or file side effects', () => {
    const before = OBSERVED_WRITE_ROOTS.map(snapshotTree);
    const env = safeSubprocessEnv();
    env.NODE_OPTIONS = [env.NODE_OPTIONS, '--require', JSON.stringify(NETWORK_SENTINEL)].filter(Boolean).join(' ');
    const result = spawnSync(process.execPath, [LAUNCHER, '--preflight-live-imports'], {
      cwd: REPO,
      encoding: 'utf8',
      env,
    });
    const after = OBSERVED_WRITE_ROOTS.map(snapshotTree);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('LIVE-IMPORT PREFLIGHT PASS');
    expect(result.stdout).toContain('generateGPTImage, resolveStyle01GptModel');
    expect(result.stdout).toContain('uploadContentAddressedObjectNoOverwrite');
    expect(result.stdout).toContain('external attempts: fetch=0');
    expect(result.stdout).toContain(
      'side effects invoked: render=0 upload=0 Vision=0 candidate/registry writes=0 approval writes=0'
    );
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('TEST_NETWORK_SENTINEL');
    expect(after).toEqual(before);
  }, 20_000);
});
