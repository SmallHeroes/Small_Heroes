import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  CANONICAL_VISUAL_CONTRACT_AUTHORING_COMMAND,
  CANONICAL_VISUAL_CONTRACT_AUTHORING_CLI_SUMMARY_VERSION,
  DIRECT_VISUAL_CONTRACT_AUTHORING_CORE_ERROR,
  VISUAL_CONTRACT_AUTHORING_USAGE,
  isDirectVisualContractAuthoringCoreEntrypoint,
  parseVisualContractAuthoringArgs,
  runVisualContractAuthoringCli,
  runVisualContractAuthoringImportPreflight,
  visualContractAuthoringCliSummary,
  type VisualContractAuthoringImportPreflightDeps,
} from '@/scripts/visual-contract-authoring';

const nodeRequire = createRequire(import.meta.url);
const {
  OPENAI_RESPONSES_AUTHORING_SCRUBBED_ENV_NAMES,
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX,
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV,
  resolveVisualContractAuthoringChildExitCode,
  runVisualContractAuthoringLauncher,
} = nodeRequire(
  '../../../scripts/lib/visual-contract-authoring-launcher-runner.cjs',
) as {
  OPENAI_RESPONSES_AUTHORING_SCRUBBED_ENV_NAMES: readonly string[];
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX: string;
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV: string;
  resolveVisualContractAuthoringChildExitCode: (
    result: {
      error?: unknown;
      signal?: string | null;
      status?: number | null;
    },
    logError?: (message: string) => void,
  ) => number;
  runVisualContractAuthoringLauncher: (
    options: Record<string, unknown>,
  ) => number;
};

const REPO = process.cwd();
const LAUNCHER = path.join(
  REPO,
  'scripts',
  'visual-contract-authoring.cjs',
);
const PRIVATE_ENTRYPOINT = path.join(
  REPO,
  'scripts',
  'visual-contract-authoring-entry.ts',
);
const CORE = path.join(
  REPO,
  'scripts',
  'visual-contract-authoring.ts',
);
const TSX = path.join(
  REPO,
  'node_modules',
  'tsx',
  'dist',
  'cli.mjs',
);
const SENTINEL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'deny-live-authoring-boundaries.cjs',
);
const FAIL_TO_ARM_SENTINEL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'fail-live-authoring-sentinel-arm.cjs',
);
const NETWORK_SENTINEL = path.join(
  REPO,
  'lib',
  'set-identity-board',
  '__tests__',
  'fixtures',
  'deny-network.cjs',
);
const TEST_BOUNDARY_SENTINEL_ENV =
  'SMALL_HEROES_TEST_LIVE_AUTHORING_BOUNDARY_SENTINEL';
const POSITIVE_CONTROL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'attempt-live-authoring-boundary.cjs',
);

const VALID_LIVE = [
  'live',
  '--repo-root',
  'C:/repo with spaces/Small_Heroes',
  '--source-authority-request',
  'inputs/source request.json',
  '--snapshot',
  'outputs/review/source-snapshots/abc.json',
  '--request',
  'outputs/review/authoring-requests/def.json',
  '--out',
  'outputs/live review',
];

function safeSubprocessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OPENAI_API_KEY: '',
    [VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV]:
      '',
  };
}

function sentineledEnvironment(): NodeJS.ProcessEnv {
  const env = safeSubprocessEnv();
  env.NODE_OPTIONS = [
    env.NODE_OPTIONS,
    '--require',
    JSON.stringify(NETWORK_SENTINEL),
  ]
    .filter(Boolean)
    .join(' ');
  Object.assign(env, { NODE_ENV: 'test' });
  env.TSX_DISABLE_CACHE = '1';
  env[TEST_BOUNDARY_SENTINEL_ENV] = SENTINEL;
  return env;
}

function networkSentineledEnvironment(): NodeJS.ProcessEnv {
  const env = safeSubprocessEnv();
  env.NODE_OPTIONS = [
    env.NODE_OPTIONS,
    '--require',
    JSON.stringify(NETWORK_SENTINEL),
  ]
    .filter(Boolean)
    .join(' ');
  return env;
}

function fakeGraph(
  loader?: () => Promise<{
    adapterFactoryType: string;
    adapterBodyBuilderType: string;
    liveRunnerType: string;
    credentialEnvironmentName: string;
    providerEvidenceVersion: string;
  }>,
): VisualContractAuthoringImportPreflightDeps {
  return {
    loadExactLiveGraph:
      loader ??
      vi.fn(async () => ({
        adapterFactoryType: 'function',
        adapterBodyBuilderType: 'function',
        liveRunnerType: 'function',
        credentialEnvironmentName: 'OPENAI_API_KEY',
        providerEvidenceVersion:
          'openai-responses-authoring-evidence/v6',
      })),
  };
}

describe('canonical Visual Contract authoring launcher', () => {
  it('accepts only exclusive preflight and the exact live path shape', () => {
    expect(
      parseVisualContractAuthoringArgs(['preflight']),
    ).toEqual({ mode: 'preflight' });
    expect(
      parseVisualContractAuthoringArgs(VALID_LIVE),
    ).toEqual({
      mode: 'live',
      repoRoot: 'C:/repo with spaces/Small_Heroes',
      sourceAuthorityRequestPath:
        'inputs/source request.json',
      snapshotPath:
        'outputs/review/source-snapshots/abc.json',
      requestPath:
        'outputs/review/authoring-requests/def.json',
      outputDir: 'outputs/live review',
    });
  });

  it.each([
    {
      name: 'preflight with output authority',
      argv: ['preflight', '--out', 'outputs/review'],
      error: /preflight is exclusive/,
    },
    {
      name: 'unknown command',
      argv: ['author'],
      error: /unknown or unexpected positional command/,
    },
    {
      name: 'unknown flag',
      argv: [...VALID_LIVE, '--credential', 'fake'],
      error: /unknown flag "--credential"/,
    },
    {
      name: 'equals form',
      argv: [
        'live',
        '--repo-root=C:/repo',
        ...VALID_LIVE.slice(3),
      ],
      error: /--flag=value syntax is unsupported/,
    },
    {
      name: 'duplicate',
      argv: [
        ...VALID_LIVE,
        '--out',
        'outputs/other',
      ],
      error: /duplicate flag "--out"/,
    },
    {
      name: 'positional',
      argv: [
        'live',
        'unexpected',
        ...VALID_LIVE.slice(1),
      ],
      error: /unexpected positional argument/,
    },
    {
      name: 'missing required flag',
      argv: VALID_LIVE.slice(0, -2),
      error: /missing required flag "--out"/,
    },
  ])('fails closed on strict parsing: $name', ({
    argv,
    error,
  }) => {
    expect(() =>
      parseVisualContractAuthoringArgs(argv),
    ).toThrow(error);
  });

  it.each([
    ['--help', 'preflight'],
    ['help', 'live'],
    ['-h', '--out'],
  ])(
    'requires help to be the only argument',
    async (...argv) => {
      await expect(
        runVisualContractAuthoringCli(argv),
      ).rejects.toThrow(/help must be used alone/);
    },
  );

  it('advertises one canonical Node command and no npx/global/direct-ts route', () => {
    expect(
      CANONICAL_VISUAL_CONTRACT_AUTHORING_COMMAND,
    ).toBe('node scripts/visual-contract-authoring.cjs');
    expect(VISUAL_CONTRACT_AUTHORING_USAGE).toContain(
      `${CANONICAL_VISUAL_CONTRACT_AUTHORING_COMMAND} preflight`,
    );
    expect(VISUAL_CONTRACT_AUTHORING_USAGE).toContain(
      `${CANONICAL_VISUAL_CONTRACT_AUTHORING_COMMAND} live`,
    );
    expect(VISUAL_CONTRACT_AUTHORING_USAGE).not.toMatch(
      /npx|tsx\s+scripts|visual-contract-authoring\.ts\s+(?:preflight|live)/,
    );
  });

  it('projects an arbitrarily large sanitized result to a bounded authoritative CLI summary', () => {
    const summary = visualContractAuthoringCliSummary({
      mode: 'canonical_visual_contract_live_authoring',
      status: 'failed',
      receipt: {
        version: 'visual-contract-authoring-receipt/v21',
        status: 'failed',
        digest: 'a'.repeat(64),
        callCount: 3,
        repairCount: 2,
        candidateDigest: null,
        failure: {
          code: 'draft_validation_repair_exhausted',
          issues: Array.from(
            { length: 128 },
            (_, index) => `sensitive-diagnostic-${index}-${'x'.repeat(1_000)}`,
          ),
        },
      },
      readiness: {
        version: 'visual-contract-authoring-readiness/v18',
        digest: 'b'.repeat(64),
        authoringOutcome: { status: 'failed' },
        blueprintAuthoringReady: false,
        d1a1Authorized: false,
      },
      persistence: {
        sourceSnapshot: null,
        authoringRequest: {
          path: 'outputs/request.json',
          digest: 'c'.repeat(64),
          created: true,
        },
        authoringRequestKind: 'approved_live_request',
        authoringReceipt: {
          path: 'outputs/receipt.json',
          digest: 'a'.repeat(64),
          created: true,
        },
        providerFailureEvidence: null,
        readiness: {
          path: 'outputs/readiness.json',
          digest: 'b'.repeat(64),
          created: true,
        },
        candidate: null,
      },
      processInterruptionLimitation: 'not emitted',
    } as never);
    const bytes = Buffer.byteLength(JSON.stringify(summary), 'utf8');

    expect(summary.version).toBe(
      CANONICAL_VISUAL_CONTRACT_AUTHORING_CLI_SUMMARY_VERSION,
    );
    expect(bytes).toBeLessThan(8 * 1_024);
    expect(JSON.stringify(summary)).not.toContain(
      'sensitive-diagnostic',
    );
    expect(summary).toMatchObject({
      receipt: {
        callCount: 3,
        repairCount: 2,
        failureCode: 'draft_validation_repair_exhausted',
      },
      persistence: {
        authoringRequestKind: 'approved_live_request',
      },
    });
  });

  it('detects direct core invocation across Windows and POSIX path separators', () => {
    expect(
      isDirectVisualContractAuthoringCoreEntrypoint(
        'C:\\repo\\scripts\\VISUAL-CONTRACT-AUTHORING.TS',
      ),
    ).toBe(true);
    expect(
      isDirectVisualContractAuthoringCoreEntrypoint(
        '/repo/scripts/visual-contract-authoring.ts',
      ),
    ).toBe(true);
    expect(
      isDirectVisualContractAuthoringCoreEntrypoint(
        '/repo/scripts/visual-contract-authoring-entry.ts',
      ),
    ).toBe(false);
  });

  it('places the exact local tsx CLI before the child shim, private entry, and one-time capability', () => {
    const capability = 'a'.repeat(64);
    const parentEnv = { KEEP: 'yes' };
    let call:
      | {
          command: string;
          args: string[];
          options: {
            cwd: string;
            env: Record<string, string>;
          };
        }
      | undefined;
    const result = runVisualContractAuthoringLauncher({
      argv: ['preflight'],
      cwd: REPO,
      env: parentEnv,
      execPath: 'exact-node',
      tsxCli: 'exact-local-tsx',
      shim: 'server-only-shim',
      entrypoint: 'private-entry',
      createCapability: () => capability,
      spawnSyncImpl: (
        command: string,
        args: string[],
        options: {
          cwd: string;
          env: Record<string, string>;
        },
      ) => {
        call = {
          command,
          args,
          options: {
            ...options,
            env: { ...options.env },
          },
        };
        return { status: 0 };
      },
      logError: vi.fn(),
    });

    expect(result).toBe(0);
    expect(call?.command).toBe('exact-node');
    expect(call?.args).toEqual([
      'exact-local-tsx',
      '--require',
      'server-only-shim',
      'private-entry',
      `${VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX}${capability}`,
      'preflight',
    ]);
    expect(
      call?.options.env[
        VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV
      ],
    ).toBe(capability);
    expect(parentEnv).toEqual({ KEEP: 'yes' });
  });

  it('passes the existing environment through without enumerating or copying a credential value', () => {
    const credentialRead = vi.fn(() => {
      throw new Error('credential was read by launcher');
    });
    const target = {
      OPENAI_API_KEY: 'must-remain-opaque',
      KEEP: 'yes',
    };
    const environment = new Proxy(target, {
      get(object, property, receiver) {
        if (property === 'OPENAI_API_KEY') {
          return credentialRead();
        }
        return Reflect.get(object, property, receiver);
      },
    });
    let childEnvironment: unknown;

    expect(
      runVisualContractAuthoringLauncher({
        argv: ['preflight'],
        cwd: REPO,
        env: environment,
        execPath: 'exact-node',
        tsxCli: 'exact-local-tsx',
        shim: 'server-only-shim',
        entrypoint: 'private-entry',
        createCapability: () => 'b'.repeat(64),
        spawnSyncImpl: (
          _command: string,
          _args: string[],
          options: { env: unknown },
        ) => {
          childEnvironment = options.env;
          return { status: 0 };
        },
        logError: vi.fn(),
      }),
    ).toBe(0);
    expect(childEnvironment).toBe(environment);
    expect(credentialRead).not.toHaveBeenCalled();
    expect(target).toEqual({
      OPENAI_API_KEY: 'must-remain-opaque',
      KEEP: 'yes',
    });
  });

  it('scrubs SDK routing and identity defaults while preserving only the key authority', () => {
    const environment: Record<string, string> = {
      ...Object.fromEntries(
        OPENAI_RESPONSES_AUTHORING_SCRUBBED_ENV_NAMES.map(
          (name) => [name, `marker-${name}`],
        ),
      ),
      OPENAI_API_KEY: 'fake-key-marker',
      OPENAI_BASE_URL: 'https://redirect.invalid/v1',
      OPENAI_ORG_ID: 'org-marker',
      OPENAI_PROJECT_ID: 'project-marker',
      OPENAI_WEBHOOK_SECRET: 'webhook-marker',
      OPENAI_LOG: 'debug',
      KEEP: 'yes',
    };
    let childEnvironment:
      | Record<string, string>
      | undefined;
    expect(
      runVisualContractAuthoringLauncher({
        argv: ['preflight'],
        cwd: REPO,
        env: environment,
        execPath: 'exact-node',
        tsxCli: 'exact-local-tsx',
        shim: 'server-only-shim',
        entrypoint: 'private-entry',
        createCapability: () => 'c'.repeat(64),
        spawnSyncImpl: (
          _command: string,
          _args: string[],
          options: { env: Record<string, string> },
        ) => {
          childEnvironment = {
            ...options.env,
          };
          return { status: 0 };
        },
        logError: vi.fn(),
      }),
    ).toBe(0);
    expect(childEnvironment).toMatchObject({
      OPENAI_API_KEY: 'fake-key-marker',
      KEEP: 'yes',
    });
    for (const name of
      OPENAI_RESPONSES_AUTHORING_SCRUBBED_ENV_NAMES) {
      expect(childEnvironment).not.toHaveProperty(name);
      expect(environment).toHaveProperty(name);
    }
  });

  it.each([
    {
      result: {
        error: new Error('synthetic spawn error'),
        status: null,
      },
      expected: 1,
      message: /synthetic spawn error/,
    },
    {
      result: { signal: 'SIGTERM', status: null },
      expected: 1,
      message: /terminated by signal SIGTERM/,
    },
    {
      result: { status: 9 },
      expected: 9,
      message: null,
    },
    {
      result: { status: null },
      expected: 1,
      message: /exited without a status/,
    },
  ])(
    'propagates child error/signal/status deterministically',
    ({ result, expected, message }) => {
      const messages: string[] = [];
      expect(
        resolveVisualContractAuthoringChildExitCode(
          result,
          (value) => messages.push(value),
        ),
      ).toBe(expected);
      if (message) {
        expect(messages.join('\n')).toMatch(message);
      } else {
        expect(messages).toEqual([]);
      }
    },
  );

  it('runs help from a cwd containing spaces while resolving dependencies beside the launcher', () => {
    const cwd = fs.mkdtempSync(
      path.join(os.tmpdir(), 'small heroes launcher '),
    );
    try {
      const result = spawnSync(
        process.execPath,
        [LAUNCHER, '--help'],
        {
          cwd,
          encoding: 'utf8',
          env: safeSubprocessEnv(),
        },
      );
      expect(
        result.status,
        `${result.stdout}\n${result.stderr}`,
      ).toBe(0);
      expect(result.stdout).toContain(
        CANONICAL_VISUAL_CONTRACT_AUTHORING_COMMAND,
      );
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  }, 20_000);

  it.each([
    {
      name: 'private entry',
      script: PRIVATE_ENTRYPOINT,
      expected:
        'Direct invocation of scripts/visual-contract-authoring-entry.ts is unsupported',
    },
    {
      name: 'core',
      script: CORE,
      expected:
        DIRECT_VISUAL_CONTRACT_AUTHORING_CORE_ERROR,
    },
  ])(
    'blocks direct $name invocation under external boundary sentinels',
    ({ script, expected }) => {
      const result = spawnSync(
        process.execPath,
        [TSX, script, 'preflight'],
        {
          cwd: REPO,
          encoding: 'utf8',
          env: networkSentineledEnvironment(),
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(expected);
      expect(result.stdout).toBe('');
      expect(
        `${result.stdout}\n${result.stderr}`,
      ).not.toMatch(
        /TEST_LIVE_AUTHORING_SENTINEL|TEST_NETWORK_SENTINEL/,
      );
    },
    20_000,
  );

  it.each([
    ['credential', 'credential OPENAI_API_KEY'],
    ['write', 'fs.writeFileSync'],
    ['fetch', 'fetch'],
  ])(
    'proves the %s sentinel with a real positive control',
    (boundary, expected) => {
      const result = spawnSync(
        process.execPath,
        [
          '--require',
          SENTINEL,
          POSITIVE_CONTROL,
          boundary,
        ],
        {
          cwd: REPO,
          encoding: 'utf8',
          env: safeSubprocessEnv(),
        },
      );
      const output = `${result.stdout}\n${result.stderr}`;
      expect(result.status).toBe(1);
      if (boundary === 'fetch') {
        expect(output).toContain(
          'TEST_NETWORK_SENTINEL: fetch was invoked',
        );
      } else {
        expect(output).toContain(
          `TEST_LIVE_AUTHORING_SENTINEL: ${expected} was invoked`,
        );
      }
      expect(
        fs.existsSync(
          path.join(REPO, 'sentinel-must-not-exist.txt'),
        ),
      ).toBe(false);
    },
    20_000,
  );

  it('imports the exact future live graph in a real canonical subprocess under network/credential/write sentinels', () => {
    const result = spawnSync(
      process.execPath,
      [LAUNCHER, 'preflight'],
      {
        cwd: REPO,
        encoding: 'utf8',
        env: sentineledEnvironment(),
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status, output).toBe(0);
    expect(result.stdout).toContain(
      'LIVE-AUTHORING IMPORT PREFLIGHT PASS',
    );
    expect(result.stdout).toContain(
      'checked adapter factory export: function',
    );
    expect(result.stdout).toContain(
      'checked canonical live runner export: function',
    );
    expect(result.stdout).toContain(
      'checked credential environment name label: OPENAI_API_KEY',
    );
    expect(result.stdout).toContain(
      'checked canonical private-entry credential/write sentinel arming: armed',
    );
    expect(result.stdout).toContain(
      'this exclusive mode checked imports and function/version labels only',
    );
    expect(result.stdout).not.toMatch(
      /zero (?:provider|credential|write|network) calls|calls:\s*0/i,
    );
    expect(output).not.toMatch(
      /TEST_LIVE_AUTHORING_SENTINEL|TEST_NETWORK_SENTINEL/,
    );
  }, 30_000);

  it('fails a non-arming private-entry sentinel before the CLI core import tripwire can fire', () => {
    const env = safeSubprocessEnv();
    Object.assign(env, { NODE_ENV: 'test' });
    env.TSX_DISABLE_CACHE = '1';
    env[TEST_BOUNDARY_SENTINEL_ENV] =
      FAIL_TO_ARM_SENTINEL;
    const result = spawnSync(
      process.execPath,
      [LAUNCHER, 'preflight'],
      {
        cwd: REPO,
        encoding: 'utf8',
        env,
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status, output).toBe(1);
    expect(output).toContain(
      'credential/write sentinel did not arm through the private entry hook',
    );
    expect(output).not.toContain(
      'TEST_LIVE_AUTHORING_CORE_IMPORT_TRIPWIRE',
    );
    expect(result.stdout).not.toContain(
      'LIVE-AUTHORING IMPORT PREFLIGHT PASS',
    );
  }, 20_000);

  it('restores the exact original fetch after success and import failure', async () => {
    const originalFetch = globalThis.fetch;
    await runVisualContractAuthoringImportPreflight(
      fakeGraph(),
    );
    expect(globalThis.fetch).toBe(originalFetch);

    await expect(
      runVisualContractAuthoringImportPreflight(
        fakeGraph(async () => {
          throw new Error('synthetic import failure');
        }),
      ),
    ).rejects.toThrow(/synthetic import failure/);
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it('rejects overlap before replacing the first sentinel and restores after completion', async () => {
    const originalFetch = globalThis.fetch;
    let entered: (() => void) | undefined;
    let release: (() => void) | undefined;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first =
      runVisualContractAuthoringImportPreflight(
        fakeGraph(async () => {
          entered?.();
          await releasePromise;
          return {
            adapterFactoryType: 'function',
            adapterBodyBuilderType: 'function',
            liveRunnerType: 'function',
            credentialEnvironmentName:
              'OPENAI_API_KEY',
            providerEvidenceVersion:
              'openai-responses-authoring-evidence/v6',
          };
        }),
      );
    await enteredPromise;
    const activeSentinel = globalThis.fetch;
    expect(activeSentinel).not.toBe(originalFetch);
    await expect(
      runVisualContractAuthoringImportPreflight(
        fakeGraph(),
      ),
    ).rejects.toThrow(/already running/);
    expect(globalThis.fetch).toBe(activeSentinel);
    release?.();
    await first;
    expect(globalThis.fetch).toBe(originalFetch);
  });
});
