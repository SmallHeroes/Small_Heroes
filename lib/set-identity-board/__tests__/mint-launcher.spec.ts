import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

import { describe, expect, it, vi } from 'vitest';

import {
  CANONICAL_BOARD_MINT_COMMAND,
  DIRECT_TYPESCRIPT_ENTRYPOINT_ERROR,
  USAGE,
  isDirectMintCoreEntrypoint,
  parseArgs,
  runCli,
  runLiveImportPreflight,
  type LiveImportPreflightDeps,
  type MintDeps,
} from '@/scripts/mint-set-identity-board';

const nodeRequire = createRequire(import.meta.url);
const {
  BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX,
  BOARD_MINT_LAUNCH_CAPABILITY_ENV,
  resolveChildExitCode,
  runSetIdentityBoardLauncher,
} = nodeRequire('../../../scripts/lib/set-identity-board-launcher-runner.cjs') as {
  BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX: string;
  BOARD_MINT_LAUNCH_CAPABILITY_ENV: string;
  resolveChildExitCode: (
    result: { error?: unknown; signal?: string | null; status?: number | null },
    logError?: (message: string) => void
  ) => number;
  runSetIdentityBoardLauncher: (options: Record<string, unknown>) => number;
};

const REPO = process.cwd();
const LAUNCHER = path.join(REPO, 'scripts', 'mint-set-identity-board.cjs');
const PRIVATE_ENTRYPOINT = path.join(REPO, 'scripts', 'mint-set-identity-board-entry.ts');
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
const NETWORK_FAILSAFE = path.join(
  REPO,
  'lib',
  'set-identity-board',
  '__tests__',
  'fixtures',
  'deny-network-failsafe.cjs'
);
const NETWORK_ATTEMPT = path.join(
  REPO,
  'lib',
  'set-identity-board',
  '__tests__',
  'fixtures',
  'attempt-network-boundary.cjs'
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
    [BOARD_MINT_LAUNCH_CAPABILITY_ENV]: '',
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
      modelLabel: 'synthetic-vision-model',
      qaRunnerType: 'function',
      fetchType: 'function',
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

const VALID_MINT_ARGS = [
  '--story',
  'synthetic_story',
  '--identity',
  'set_alpha',
  '--style',
  'pencil_watercolor',
  '--contract',
  'synthetic-contract.json',
];

describe('canonical board-mint launcher surface', () => {
  it('parses the live-import preflight as a distinct mode and requires it to be used alone', () => {
    expect(parseArgs(['--preflight-live-imports'])).toEqual({ mode: 'preflight-live-imports' });
    expect(() => parseArgs(['--preflight-live-imports', '--render'])).toThrow(/must be used alone/);
  });

  it.each([
    {
      name: 'unknown flag',
      argv: [...VALID_MINT_ARGS, '--mystery'],
      error: /unknown flag "--mystery"/,
    },
    {
      name: 'flag=value',
      argv: ['--story=synthetic_story', ...VALID_MINT_ARGS.slice(2)],
      error: /--flag=value syntax is unsupported/,
    },
    {
      name: 'preflight flag=value',
      argv: ['--preflight-live-imports=1', ...VALID_MINT_ARGS],
      error: /--flag=value syntax is unsupported/,
    },
    {
      name: 'duplicate flag',
      argv: [...VALID_MINT_ARGS, '--story', 'other_story'],
      error: /duplicate flag "--story"/,
    },
    {
      name: 'positional argument',
      argv: [...VALID_MINT_ARGS, 'unexpected'],
      error: /unexpected positional argument/,
    },
    {
      name: 'approve-only flag on mint',
      argv: [...VALID_MINT_ARGS, '--entry', 'entry.json'],
      error: /--entry requires --approve/,
    },
  ])('fails closed on strict CLI parsing: $name', ({ argv, error }) => {
    expect(() => parseArgs(argv)).toThrow(error);
  });

  it('never routes --preflight-live-imports=1 into mint work', async () => {
    const deps = forbiddenMintDeps();
    await expect(
      runCli(['--preflight-live-imports=1', ...VALID_MINT_ARGS, '--render'], deps, fakePreflightDeps())
    ).rejects.toThrow(/--flag=value syntax is unsupported/);
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(deps.runBoardQa).not.toHaveBeenCalled();
    expect(deps.now).not.toHaveBeenCalled();
  });

  it.each([
    ['--help', '--render'],
    ['-h', '--preflight-live-imports'],
    ['--help', ...VALID_MINT_ARGS],
  ])('requires help to be the only argument: %s', async (...argv) => {
    const deps = forbiddenMintDeps();
    await expect(runCli(argv, deps, fakePreflightDeps())).rejects.toThrow(/--help must be used alone/);
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(deps.runBoardQa).not.toHaveBeenCalled();
    expect(deps.now).not.toHaveBeenCalled();
  });

  it('advertises only the canonical Node launcher, including copyable dry/mint/approve/preflight commands', () => {
    expect(CANONICAL_BOARD_MINT_COMMAND).toBe('node scripts/mint-set-identity-board.cjs');
    expect(USAGE).toContain(`${CANONICAL_BOARD_MINT_COMMAND} --story`);
    expect(USAGE).toContain(`${CANONICAL_BOARD_MINT_COMMAND} --approve`);
    expect(USAGE).toContain(`${CANONICAL_BOARD_MINT_COMMAND} --preflight-live-imports`);
    expect(USAGE).not.toContain('npx');
    expect(USAGE).not.toContain('scripts/mint-set-identity-board.ts --');
  });

  it('detects direct core invocation case-insensitively across Windows and POSIX path separators', () => {
    expect(isDirectMintCoreEntrypoint('C:\\repo\\scripts\\MINT-SET-IDENTITY-BOARD.TS')).toBe(true);
    expect(isDirectMintCoreEntrypoint('/repo/scripts/mint-set-identity-board.ts')).toBe(true);
    expect(isDirectMintCoreEntrypoint('/repo/scripts/mint-set-identity-board-entry.ts')).toBe(false);
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

  it('restores the exact original fetch after a successful in-process preflight', async () => {
    const originalFetch = globalThis.fetch;
    const result = await runLiveImportPreflight(fakePreflightDeps());

    expect(result.observedFetchAttempts).toBe(0);
    expect(globalThis.fetch).toBe(originalFetch);
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

  it('rejects overlapping in-process preflights before mutating fetch and restores after the first completes', async () => {
    const originalFetch = globalThis.fetch;
    let enterFirstLoader: (() => void) | undefined;
    let releaseFirstLoader: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => {
      enterFirstLoader = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseFirstLoader = resolve;
    });
    const deps = fakePreflightDeps({
      loadRendererModules: vi.fn(async () => {
        enterFirstLoader?.();
        await release;
        return {
          generateGPTImage: vi.fn(),
          resolveStyle01GptModel: vi.fn(() => 'synthetic-image-model'),
        } as Awaited<ReturnType<LiveImportPreflightDeps['loadRendererModules']>>;
      }),
    });

    const first = runLiveImportPreflight(deps);
    await entered;
    const firstSentinelFetch = globalThis.fetch;
    expect(firstSentinelFetch).not.toBe(originalFetch);

    await expect(runLiveImportPreflight(fakePreflightDeps())).rejects.toThrow(/already running/);
    expect(globalThis.fetch).toBe(firstSentinelFetch);

    releaseFirstLoader?.();
    await first;
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it('issues a one-time child capability after the shim argument without mutating the parent environment', () => {
    const parentEnv = { KEEP: 'yes' };
    const capability = 'a'.repeat(64);
    let spawnCall:
      | {
          command: string;
          args: string[];
          options: { env: Record<string, string>; cwd: string };
        }
      | undefined;

    const exitCode = runSetIdentityBoardLauncher({
      argv: ['--help'],
      cwd: REPO,
      env: parentEnv,
      execPath: 'node-executable',
      tsxCli: 'tsx-cli',
      shim: 'server-only-shim',
      entrypoint: 'private-entrypoint',
      createCapability: () => capability,
      spawnSyncImpl: (command: string, args: string[], options: { env: Record<string, string>; cwd: string }) => {
        spawnCall = { command, args, options };
        return { status: 0 };
      },
      logError: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(spawnCall?.command).toBe('node-executable');
    expect(spawnCall?.args).toEqual([
      'tsx-cli',
      '--require',
      'server-only-shim',
      'private-entrypoint',
      `${BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX}${capability}`,
      '--help',
    ]);
    expect(spawnCall?.options.env[BOARD_MINT_LAUNCH_CAPABILITY_ENV]).toBe(capability);
    expect(parentEnv).toEqual({ KEEP: 'yes' });
  });

  it.each([
    {
      name: 'spawn error',
      result: { error: new Error('synthetic spawn error'), status: null },
      expected: 1,
      message: /synthetic spawn error/,
    },
    {
      name: 'signal',
      result: { signal: 'SIGTERM', status: null },
      expected: 1,
      message: /terminated by signal SIGTERM/,
    },
    {
      name: 'nonstandard child status',
      result: { status: 7 },
      expected: 7,
      message: null,
    },
    {
      name: 'missing child status',
      result: { status: null },
      expected: 1,
      message: /exited without a status/,
    },
  ])('handles launcher child result: $name', ({ result, expected, message }) => {
    const messages: string[] = [];
    expect(resolveChildExitCode(result, (value) => messages.push(value))).toBe(expected);
    if (message) expect(messages.join('\n')).toMatch(message);
    else expect(messages).toEqual([]);
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

  it.each([
    {
      name: 'help',
      argv: ['--help'],
    },
    {
      name: 'dry-shaped',
      argv: [...VALID_MINT_ARGS, '--out', path.join(REPO, 'set-identity-board-candidates', 'guard-dry.json')],
    },
    {
      name: 'render-shaped',
      argv: [...VALID_MINT_ARGS, '--render'],
    },
    {
      name: 'approve-shaped',
      argv: ['--approve', '--entry', 'nonexistent-entry.json', '--approved-by', 'synthetic-reviewer'],
    },
  ])('refuses direct private entrypoint invocation before CLI work: $name', ({ argv }) => {
    const before = OBSERVED_WRITE_ROOTS.map(snapshotTree);
    const result = spawnSync(process.execPath, [TSX, PRIVATE_ENTRYPOINT, ...argv], {
      cwd: REPO,
      encoding: 'utf8',
      env: safeSubprocessEnv(),
    });
    const after = OBSERVED_WRITE_ROOTS.map(snapshotTree);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Direct invocation of scripts/mint-set-identity-board-entry.ts is unsupported');
    expect(result.stderr).toContain(CANONICAL_BOARD_MINT_COMMAND);
    expect(result.stdout).toBe('');
    expect(after).toEqual(before);
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

  it.each([
    ['fetch', 'fetch'],
    ['http.get', 'http.get'],
    ['https.get', 'https.get'],
    ['tls.connect', 'tls.connect'],
    ['net.connect.port-host', 'net.connect'],
    ['net.connect.numeric-string-host', 'net.connect'],
    ['net.connect.options', 'net.connect'],
    ['net.createConnection.port-host', 'net.createConnection'],
    ['net.createConnection.numeric-string-host', 'net.createConnection'],
    ['net.createConnection.options', 'net.createConnection'],
    ['net.Socket.connect.options', 'net.Socket.connect'],
    ['http.Agent.createConnection', 'http.Agent.createConnection'],
    ['https.Agent.createConnection', 'https.Agent.createConnection'],
  ])('blocks external network positive control %s at the primary sentinel', (boundary, expectedLabel) => {
    const result = spawnSync(
      process.execPath,
      ['--require', NETWORK_FAILSAFE, '--require', NETWORK_SENTINEL, NETWORK_ATTEMPT, boundary],
      {
        cwd: REPO,
        encoding: 'utf8',
        env: safeSubprocessEnv(),
      }
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain(`TEST_NETWORK_SENTINEL: ${expectedLabel} was invoked`);
    expect(output).not.toContain('TEST_NETWORK_FAILSAFE');
    expect(output).not.toContain('UNEXPECTED_NETWORK_BOUNDARY_NOT_BLOCKED');
  }, 20_000);

  it('allows net.connect(port) to reach only the loopback failsafe, distinguishing an omitted host from remote host', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--require',
        NETWORK_FAILSAFE,
        '--require',
        NETWORK_SENTINEL,
        NETWORK_ATTEMPT,
        'net.connect.local-default',
      ],
      {
        cwd: REPO,
        encoding: 'utf8',
        env: safeSubprocessEnv(),
      }
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('TEST_NETWORK_FAILSAFE: net.connect escaped the primary sentinel');
    expect(output).not.toContain('TEST_NETWORK_SENTINEL: net.connect was invoked');
  }, 20_000);

  it('loads the exact live graph under covered network sentinels without board-file changes', () => {
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
    expect(result.stdout).toContain('renderer function exports (typeof checked): generateGPTImage, resolveStyle01GptModel');
    expect(result.stdout).toContain(
      'storage function exports (typeof checked): uploadContentAddressedObjectNoOverwrite'
    );
    expect(result.stdout).toContain('Vision surface inspected locally:');
    expect(result.stdout).toContain('provider credentials, provider connectivity, and provider-side configuration were not validated');
    expect(result.stdout).toContain('observed fetch attempts: 0');
    expect(result.stdout).toContain(
      'render/upload/Vision/registry/approval paths are structurally unreachable from this exclusive mode'
    );
    expect(result.stdout).not.toMatch(/render=0|upload=0|Vision=0|approval writes=0/);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('TEST_NETWORK_SENTINEL');
    expect(after).toEqual(before);
  }, 20_000);
});
