import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

const require = createRequire(import.meta.url);
const launcher = require(
  '../../../scripts/lib/canonical-pre-live-readiness-launcher.cjs',
) as {
  INTERNAL_CAPABILITY_FLAG: string;
  INTERNAL_ENVIRONMENT_NAMES: Record<string, string>;
  assertCanonicalDirectory: (
    value: string,
    platform?: NodeJS.Platform,
  ) => string;
  canonicalBytes: (value: unknown) => string;
  entryEnvironment: (options: {
    environment: NodeJS.ProcessEnv;
    platform: NodeJS.Platform;
    capability: string;
    npmCliSha256: string;
  }) => NodeJS.ProcessEnv;
  fixedLocalNpmCliCandidates: (
    execPath: string,
    platform?: NodeJS.Platform,
  ) => string[];
  launcherDisposition: (result: {
    error?: Error;
    signal: NodeJS.Signals | null;
    status: number | null;
  }) =>
    | { kind: 'exit'; exitCode: number }
    | { kind: 'signal'; signal: NodeJS.Signals };
  minimalEnvironment: (
    environment: NodeJS.ProcessEnv,
    platform?: NodeJS.Platform,
  ) => NodeJS.ProcessEnv;
  platformEnvironmentNames: (
    platform?: NodeJS.Platform,
  ) => string[];
  offlineNpmEnvironment: (
    environment: NodeJS.ProcessEnv,
    platform?: NodeJS.Platform,
  ) => NodeJS.ProcessEnv;
  parseCanonicalPreLiveReadinessArguments: (
    argv: string[],
  ) => {
    mode: 'prepare' | 'verify';
    repoRoot: string;
    values: Map<string, string>;
  } | null;
  resolveUniqueLocalNpmCli: (options: {
    execPath: string;
    platform: NodeJS.Platform;
    candidates?: string[];
  }) => string;
  verifyBootstrapTopology: (options: {
    repoRoot: string;
    outputRoot: string;
    environment: NodeJS.ProcessEnv;
    platform: NodeJS.Platform;
  }) => {
    repositoryRealPath: string;
    branchRef: string;
    head: string;
    upstreamRef: string;
  };
  runCanonicalPreLiveReadinessLauncher: (options: {
    argv: string[];
    environment: NodeJS.ProcessEnv;
    execPath: string;
    platform: NodeJS.Platform;
    expectedRepoRoot?: string;
    verifyTopologyImpl?: () => unknown;
    resolveNpmCliImpl?: () => string;
    verifyInstalledAuthorityImpl?: () => void;
    gitSpawnSyncImpl?: (
      executable: string,
      argv: string[],
      options: {
        cwd: string;
        env: NodeJS.ProcessEnv;
        encoding: string;
        maxBuffer: number;
        shell: boolean;
        timeout: number;
        windowsHide: boolean;
      },
    ) => {
      status: number | null;
      signal: NodeJS.Signals | null;
      error?: Error;
      stdout?: string;
    };
    spawnSyncImpl?: (
      executable: string,
      argv: string[],
      options: {
        cwd: string;
        env: NodeJS.ProcessEnv;
        shell: boolean;
        stdio: unknown;
        windowsHide: boolean;
      },
    ) => {
      status: number | null;
      signal: NodeJS.Signals | null;
      error?: Error;
    };
  }) => {
    kind: 'child' | 'failure';
    failure?: Record<string, unknown>;
    disposition:
      | { kind: 'exit'; exitCode: number }
      | { kind: 'signal'; signal: NodeJS.Signals };
  };
};

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(
  prefix = 'pre-live-launcher-',
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeFile(
  root: string,
  relativePath: string,
  contents = 'fixture\n',
): string {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), {
    recursive: true,
  });
  fs.writeFileSync(absolutePath, contents, 'utf8');
  return absolutePath;
}

function git(cwd: string, argv: string[]): string {
  const result = spawnSync('git', argv, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `fixture Git failed: ${argv.join(' ')}\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function publicArguments(
  repoRoot: string,
  mode: 'prepare' | 'verify' = 'prepare',
): string[] {
  return [
    mode,
    '--repo-root',
    repoRoot,
    '--output-root',
    'outputs/readiness',
    '--story-source-key',
    'launcher_fixture',
    '--story-source-path',
    'stories/launcher_fixture.md',
    '--request-id',
    'launcher-fixture-001',
    '--requested-at',
    '2026-07-31T12:00:00.000Z',
    '--credential-source-path',
    path.join(
      path.dirname(repoRoot),
      'opaque credential source.env',
    ),
  ];
}

function createLauncherFixture(
  unicode = false,
): {
  root: string;
  npmCli: string;
  execPath: string;
} {
  const parent = tempRoot();
  const root = path.join(
    parent,
    unicode
      ? 'repository with spaces שלום'
      : 'repository',
  );
  fs.mkdirSync(root, { recursive: true });
  writeFile(root, 'package.json', '{}\n');
  writeFile(
    root,
    'package-lock.json',
    '{"lockfileVersion":3}\n',
  );
  writeFile(
    root,
    'scripts/shims/register-server-only.cjs',
  );
  writeFile(
    root,
    'scripts/canonical-pre-live-readiness-entry.ts',
  );
  const npmCli = writeFile(
    parent,
    'node-install/node_modules/npm/bin/npm-cli.js',
  );
  const execPath = writeFile(
    parent,
    'node-install/node.exe',
  );
  return {
    root: fs.realpathSync(root),
    npmCli: fs.realpathSync(npmCli),
    execPath: fs.realpathSync(execPath),
  };
}

function createInstalledAuthority(root: string): void {
  writeFile(root, 'node_modules/tsx/dist/cli.mjs');
  writeFile(root, 'node_modules/prisma/build/index.js');
  writeFile(
    root,
    'node_modules/.prisma/client/schema.prisma',
  );
}

function hostileWindowsEnvironment(): {
  environment: NodeJS.ProcessEnv;
  reads: string[];
} {
  const reads: string[] = [];
  const allowed = new Set(
    launcher.platformEnvironmentNames('win32'),
  );
  const source: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    PATH: 'hostile-path',
    SystemRoot: 'C:\\Windows',
    TEMP: 'C:\\Temp',
    USERPROFILE: 'C:\\Users\\Fixture',
    OPENAI_API_KEY: 'fake-secret-must-not-be-read',
    UNAPPROVED_BOOTSTRAP_ENV:
      'unapproved-environment-value',
  };
  return {
    environment: new Proxy(source, {
      get(target, property) {
        if (property === 'OPENAI_API_KEY') {
          throw new Error(
            'credential environment access forbidden',
          );
        }
        if (
          typeof property === 'string' &&
          !allowed.has(property)
        ) {
          throw new Error(
            `unapproved environment read: ${property}`,
          );
        }
        if (typeof property === 'string') {
          reads.push(property);
        }
        return Reflect.get(target, property);
      },
      ownKeys() {
        throw new Error('environment enumeration forbidden');
      },
    }),
    reads,
  };
}

function expectSanitizedBootstrapFailure(
  outcome: {
    kind: 'child' | 'failure';
    failure?: Record<string, unknown>;
    disposition:
      | { kind: 'exit'; exitCode: number }
      | { kind: 'signal'; signal: NodeJS.Signals };
  },
  phase: string,
  reasonCode: string,
): Record<string, unknown> {
  expect(outcome).toMatchObject({
    kind: 'failure',
    failure: {
      version: 'canonical-pre-live-readiness-failure/v2',
      status: 'rejected',
      mode: 'verify',
      phase,
      reasonCodes: [reasonCode],
      authorityReasonCodes: [],
      requestIdentityDigest: expect.stringMatching(
        /^[a-f0-9]{64}$/,
      ),
      pricingAuthority: 'not_checked',
      canonicalPreflight: 'not_run',
      credentialAccess: 'none',
      providerCalls: 0,
      liveAuthority: 'none',
      digestAlgorithm: 'canonical-json-sha256',
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    },
    disposition: { kind: 'exit', exitCode: 1 },
  });
  expect(Object.keys(outcome.failure ?? {}).sort()).toEqual(
    [
      'authorityReasonCodes',
      'canonicalPreflight',
      'credentialAccess',
      'digest',
      'digestAlgorithm',
      'liveAuthority',
      'mode',
      'phase',
      'pricingAuthority',
      'providerCalls',
      'reasonCodes',
      'requestIdentityDigest',
      'status',
      'version',
    ].sort(),
  );
  return outcome.failure!;
}

describe('canonical pre-live readiness built-in launcher', () => {
  it('cold-starts before node_modules with exact offline npm and exact local Prisma argv', () => {
    const fixture = createLauncherFixture(true);
    const calls: Array<{
      executable: string;
      argv: string[];
      options: {
        cwd: string;
        env: NodeJS.ProcessEnv;
        shell: boolean;
        stdio: unknown;
        windowsHide: boolean;
      };
    }> = [];
    const spawnSyncImpl = (
      executable: string,
      argv: string[],
      options: {
        cwd: string;
        env: NodeJS.ProcessEnv;
        shell: boolean;
        stdio: unknown;
        windowsHide: boolean;
      },
    ) => {
      calls.push({ executable, argv, options });
      if (calls.length === 1) {
        writeFile(
          fixture.root,
          'node_modules/prisma/build/index.js',
        );
        writeFile(
          fixture.root,
          'node_modules/tsx/dist/cli.mjs',
        );
      }
      if (calls.length === 2) {
        writeFile(
          fixture.root,
          'node_modules/.prisma/client/schema.prisma',
        );
      }
      return { status: 0, signal: null };
    };

    const outcome =
      launcher.runCanonicalPreLiveReadinessLauncher({
        argv: publicArguments(fixture.root),
        environment: {
          NODE_ENV: 'test',
          PATH: 'platform-path',
          SystemRoot: 'C:\\Windows',
          TEMP: path.join(fixture.root, 'temp'),
          USERPROFILE: fixture.root,
          OPENAI_API_KEY: 'must-not-cross',
          NODE_OPTIONS: '--require forbidden.cjs',
          npm_config_registry:
            'https://registry.example.invalid',
          HTTPS_PROXY: 'https://proxy.example.invalid',
        },
        execPath: fixture.execPath,
        platform: 'win32',
        expectedRepoRoot: fixture.root,
        verifyTopologyImpl: () => ({}),
        resolveNpmCliImpl: () => fixture.npmCli,
        spawnSyncImpl,
      });

    expect(outcome).toMatchObject({
      kind: 'child',
      disposition: { kind: 'exit', exitCode: 0 },
    });
    expect(calls).toHaveLength(3);
    expect(calls[0]!.executable).toBe(fixture.execPath);
    expect(calls[0]!.argv).toEqual([
      fixture.npmCli,
      'ci',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ]);
    expect(calls[0]!.options).toMatchObject({
      cwd: fixture.root,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    expect(calls[0]!.options.env).toMatchObject({
      npm_config_offline: 'true',
      npm_config_ignore_scripts: 'true',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    });
    expect(calls[1]!.argv).toEqual([
      path.join(
        fixture.root,
        'node_modules',
        'prisma',
        'build',
        'index.js',
      ),
      'generate',
      '--schema',
      'backend/schema.prisma',
    ]);
    expect(calls[2]!.argv[0]).toBe(
      path.join(
        fixture.root,
        'node_modules',
        'tsx',
        'dist',
        'cli.mjs',
      ),
    );
    expect(calls[2]!.argv).toContain(
      launcher.INTERNAL_CAPABILITY_FLAG,
    );
    for (const call of calls) {
      expect(call.options.shell).toBe(false);
      expect(call.options.env.OPENAI_API_KEY).toBeUndefined();
      expect(call.options.env.NODE_OPTIONS).toBeUndefined();
      expect(
        call.options.env.npm_config_registry,
      ).toBeUndefined();
      expect(call.options.env.HTTPS_PROXY).toBeUndefined();
    }
  });

  it('uses only direct allowlisted environment reads on success and sanitized diagnostic failure paths', () => {
    const successFixture = createLauncherFixture();
    const successEnvironment = hostileWindowsEnvironment();
    const successCalls: string[][] = [];
    const success =
      launcher.runCanonicalPreLiveReadinessLauncher({
        argv: publicArguments(successFixture.root),
        environment: successEnvironment.environment,
        execPath: successFixture.execPath,
        platform: 'win32',
        expectedRepoRoot: successFixture.root,
        verifyTopologyImpl: () => ({}),
        resolveNpmCliImpl: () => successFixture.npmCli,
        spawnSyncImpl: (_executable, argv) => {
          successCalls.push(argv);
          if (successCalls.length === 1) {
            writeFile(
              successFixture.root,
              'node_modules/prisma/build/index.js',
            );
            writeFile(
              successFixture.root,
              'node_modules/tsx/dist/cli.mjs',
            );
          }
          if (successCalls.length === 2) {
            writeFile(
              successFixture.root,
              'node_modules/.prisma/client/schema.prisma',
            );
          }
          return { status: 0, signal: null };
        },
      });
    expect(success.kind).toBe('child');
    expect(successCalls).toHaveLength(3);
    expect(
      new Set(successEnvironment.reads),
    ).toEqual(
      new Set(
        launcher.platformEnvironmentNames('win32'),
      ),
    );

    const failureFixture = createLauncherFixture();
    const failureEnvironment = hostileWindowsEnvironment();
    const failure =
      launcher.runCanonicalPreLiveReadinessLauncher({
        argv: publicArguments(
          failureFixture.root,
          'verify',
        ),
        environment: failureEnvironment.environment,
        execPath: failureFixture.execPath,
        platform: 'win32',
        expectedRepoRoot: failureFixture.root,
        gitSpawnSyncImpl: () => ({
          status: null,
          signal: null,
          error: Object.assign(
            new Error(
              'raw message fake-secret C:\\private\\repo',
            ),
            {
              stack:
                'fake stack UNAPPROVED_BOOTSTRAP_ENV',
            },
          ),
        }),
        resolveNpmCliImpl: () => {
          throw new Error('npm resolution must be unreachable');
        },
        spawnSyncImpl: () => {
          throw new Error('child spawn must be unreachable');
        },
      });
    const failureRecord = expectSanitizedBootstrapFailure(
      failure,
      'topology',
      'pre_live_topology_git_rejected',
    );
    expect(
      new Set(failureEnvironment.reads),
    ).toEqual(
      new Set(
        launcher.platformEnvironmentNames('win32'),
      ),
    );
    const bytes = launcher.canonicalBytes(failureRecord);
    for (const rejected of [
      'fake-secret',
      'C:\\private\\repo',
      'fake stack',
      'raw message',
      'UNAPPROVED_BOOTSTRAP_ENV',
      'unapproved-environment-value',
    ]) {
      expect(bytes).not.toContain(rejected);
    }

    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'scripts/lib/canonical-pre-live-readiness-launcher.cjs',
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /Object\.(?:keys|entries)\(\s*environment/,
    );
    expect(source).not.toContain('Reflect.ownKeys');
    expect(source).not.toContain('OPENAI_API_KEY');
  });

  it('attributes launcher, topology, dependency, and npm CLI failures to fixed fail-closed boundaries', () => {
    const fixture = createLauncherFixture();
    createInstalledAuthority(fixture.root);
    const argv = publicArguments(fixture.root, 'verify');
    const base = {
      argv,
      environment: {} as NodeJS.ProcessEnv,
      execPath: fixture.execPath,
      platform: 'win32' as const,
    };

    let topologyCalls = 0;
    let npmCalls = 0;
    let dependencyCalls = 0;
    let spawnCalls = 0;
    const launcherFailure =
      launcher.runCanonicalPreLiveReadinessLauncher({
        ...base,
        expectedRepoRoot: tempRoot(),
        verifyTopologyImpl: () => {
          topologyCalls += 1;
        },
        resolveNpmCliImpl: () => {
          npmCalls += 1;
          return fixture.npmCli;
        },
        verifyInstalledAuthorityImpl: () => {
          dependencyCalls += 1;
        },
        spawnSyncImpl: () => {
          spawnCalls += 1;
          return { status: 0, signal: null };
        },
      });
    expectSanitizedBootstrapFailure(
      launcherFailure,
      'launcher',
      'pre_live_launcher_repository_authority_rejected',
    );
    expect({
      topologyCalls,
      npmCalls,
      dependencyCalls,
      spawnCalls,
    }).toEqual({
      topologyCalls: 0,
      npmCalls: 0,
      dependencyCalls: 0,
      spawnCalls: 0,
    });

    const topologyCases = [
      [
        'bootstrap_repository_mismatch',
        'pre_live_topology_repository_mismatch',
      ],
      [
        'bootstrap_dedicated_branch_required',
        'pre_live_topology_dedicated_branch_required',
      ],
      [
        'bootstrap_same_name_upstream_required',
        'pre_live_topology_same_name_origin_required',
      ],
      [
        'bootstrap_head_mismatch',
        'pre_live_topology_head_mismatch',
      ],
      [
        'bootstrap_divergence_rejected',
        'pre_live_topology_divergence_rejected',
      ],
      [
        'bootstrap_dirty_rejected',
        'pre_live_topology_dirty_rejected',
      ],
      [
        'bootstrap_output_not_ignored',
        'pre_live_output_root_must_be_ignored',
      ],
      [
        'bootstrap_git_rejected',
        'pre_live_topology_git_rejected',
      ],
      [
        'raw unknown message fake-secret C:\\private\\repo',
        'pre_live_topology_rejected',
      ],
    ] as const;
    for (const [internalReason, publicReason] of topologyCases) {
      npmCalls = 0;
      dependencyCalls = 0;
      spawnCalls = 0;
      const error = new Error(internalReason);
      error.stack =
        'fake stack UNAPPROVED_BOOTSTRAP_ENV';
      const outcome =
        launcher.runCanonicalPreLiveReadinessLauncher({
          ...base,
          expectedRepoRoot: fixture.root,
          verifyTopologyImpl: () => {
            throw error;
          },
          resolveNpmCliImpl: () => {
            npmCalls += 1;
            return fixture.npmCli;
          },
          verifyInstalledAuthorityImpl: () => {
            dependencyCalls += 1;
          },
          spawnSyncImpl: () => {
            spawnCalls += 1;
            return { status: 0, signal: null };
          },
        });
      const failure = expectSanitizedBootstrapFailure(
        outcome,
        'topology',
        publicReason,
      );
      expect({ npmCalls, dependencyCalls, spawnCalls }).toEqual({
        npmCalls: 0,
        dependencyCalls: 0,
        spawnCalls: 0,
      });
      const bytes = launcher.canonicalBytes(failure);
      expect(bytes).not.toContain('fake stack');
      expect(bytes).not.toContain('UNAPPROVED_BOOTSTRAP_ENV');
      if (publicReason === 'pre_live_topology_rejected') {
        expect(bytes).not.toContain('raw unknown message');
        expect(bytes).not.toContain('fake-secret');
        expect(bytes).not.toContain('C:\\private\\repo');
      }
    }

    topologyCalls = 0;
    dependencyCalls = 0;
    spawnCalls = 0;
    const npmFailure =
      launcher.runCanonicalPreLiveReadinessLauncher({
        ...base,
        expectedRepoRoot: fixture.root,
        verifyTopologyImpl: () => {
          topologyCalls += 1;
        },
        resolveNpmCliImpl: () => {
          throw new Error(
            'raw npm resolver failure C:\\private\\npm-cli.js',
          );
        },
        verifyInstalledAuthorityImpl: () => {
          dependencyCalls += 1;
        },
        spawnSyncImpl: () => {
          spawnCalls += 1;
          return { status: 0, signal: null };
        },
      });
    const npmFailureRecord =
      expectSanitizedBootstrapFailure(
        npmFailure,
        'dependency',
        'pre_live_dependency_npm_cli_resolution_rejected',
      );
    expect({ topologyCalls, dependencyCalls, spawnCalls }).toEqual({
      topologyCalls: 1,
      dependencyCalls: 0,
      spawnCalls: 0,
    });
    expect(
      launcher.canonicalBytes(npmFailureRecord),
    ).not.toContain('raw npm resolver failure');

    topologyCalls = 0;
    npmCalls = 0;
    spawnCalls = 0;
    const dependencyFailure =
      launcher.runCanonicalPreLiveReadinessLauncher({
        ...base,
        expectedRepoRoot: fixture.root,
        verifyTopologyImpl: () => {
          topologyCalls += 1;
        },
        resolveNpmCliImpl: () => {
          npmCalls += 1;
          return fixture.npmCli;
        },
        verifyInstalledAuthorityImpl: () => {
          throw new Error(
            'raw dependency failure C:\\private\\node_modules',
          );
        },
        spawnSyncImpl: () => {
          spawnCalls += 1;
          return { status: 0, signal: null };
        },
      });
    const dependencyFailureRecord =
      expectSanitizedBootstrapFailure(
        dependencyFailure,
        'dependency',
        'pre_live_dependency_authority_rejected',
      );
    expect({ topologyCalls, npmCalls, spawnCalls }).toEqual({
      topologyCalls: 1,
      npmCalls: 1,
      spawnCalls: 0,
    });
    expect(
      launcher.canonicalBytes(dependencyFailureRecord),
    ).not.toContain('raw dependency failure');
  });

  it('verify is read-only at the launcher and starts only the private entry', () => {
    const fixture = createLauncherFixture();
    createInstalledAuthority(fixture.root);
    const calls: string[][] = [];
    const outcome =
      launcher.runCanonicalPreLiveReadinessLauncher({
        argv: publicArguments(fixture.root, 'verify'),
        environment: process.env,
        execPath: fixture.execPath,
        platform: 'win32',
        expectedRepoRoot: fixture.root,
        verifyTopologyImpl: () => ({}),
        resolveNpmCliImpl: () => fixture.npmCli,
        spawnSyncImpl: (
          _executable: string,
          argv: string[],
        ) => {
          calls.push(argv);
          return { status: 0, signal: null };
        },
      });

    expect(outcome.kind).toBe('child');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('verify');
    expect(calls[0]).not.toContain('ci');
    expect(calls[0]).not.toContain('generate');
  });

  it('checks clean same-name origin parity before dependency writes and uses no network Git command', () => {
    const fixture = createLauncherFixture();
    const remote = path.join(
      tempRoot(),
      'remote with spaces.git',
    );
    writeFile(
      fixture.root,
      '.gitignore',
      'node_modules/\noutputs/\n',
    );
    git(fixture.root, [
      'init',
      '-b',
      'codex/bootstrap-topology-fixture',
    ]);
    git(fixture.root, [
      'config',
      'user.email',
      'fixture@example.test',
    ]);
    git(fixture.root, [
      'config',
      'user.name',
      'Bootstrap Fixture',
    ]);
    git(fixture.root, ['add', '.']);
    git(fixture.root, ['commit', '-m', 'fixture']);
    git(path.dirname(remote), ['init', '--bare', remote]);
    git(fixture.root, ['remote', 'add', 'origin', remote]);
    git(fixture.root, [
      'push',
      '-u',
      'origin',
      'codex/bootstrap-topology-fixture',
    ]);

    const before = fs.existsSync(
      path.join(fixture.root, 'node_modules'),
    );
    const topology = launcher.verifyBootstrapTopology({
      repoRoot: fixture.root,
      outputRoot: 'outputs/readiness',
      environment: process.env,
      platform: process.platform,
    });
    expect(topology).toMatchObject({
      branchRef:
        'refs/heads/codex/bootstrap-topology-fixture',
      upstreamRef:
        'refs/remotes/origin/codex/bootstrap-topology-fixture',
      head: expect.stringMatching(/^[a-f0-9]{40}$/),
    });
    expect(
      fs.existsSync(
        path.join(fixture.root, 'node_modules'),
      ),
    ).toBe(before);

    git(fixture.root, ['branch', '--unset-upstream']);
    expect(() =>
      launcher.verifyBootstrapTopology({
        repoRoot: fixture.root,
        outputRoot: 'outputs/readiness',
        environment: process.env,
        platform: process.platform,
      }),
    ).toThrow();
  });

  it('fails closed on ambiguous, linked, or missing local tool authority', () => {
    const fixture = createLauncherFixture();
    const secondNpm = writeFile(
      path.dirname(fixture.npmCli),
      '../alternate/npm-cli.js',
    );
    expect(() =>
      launcher.resolveUniqueLocalNpmCli({
        execPath: fixture.execPath,
        platform: 'win32',
        candidates: [fixture.npmCli, secondNpm],
      }),
    ).toThrow();
    expect(() =>
      launcher.resolveUniqueLocalNpmCli({
        execPath: fixture.execPath,
        platform: 'win32',
        candidates: [
          path.join(fixture.root, 'missing-npm-cli.js'),
        ],
      }),
    ).toThrow();

    const target = path.join(
      tempRoot(),
      'real-node-modules',
    );
    fs.mkdirSync(target, { recursive: true });
    const alias = path.join(
      tempRoot(),
      'node_modules-alias',
    );
    let aliasCreated = false;
    try {
      fs.symlinkSync(
        target,
        alias,
        process.platform === 'win32'
          ? 'junction'
          : 'dir',
      );
      aliasCreated = true;
    } catch {
      // Platform privilege can make the alias case unavailable.
    }
    if (aliasCreated) {
      expect(() =>
        launcher.assertCanonicalDirectory(
          alias,
          process.platform,
        ),
      ).toThrow();
    }

    const otherRepository = tempRoot();
    fs.mkdirSync(otherRepository, { recursive: true });
    const mismatched =
      launcher.runCanonicalPreLiveReadinessLauncher({
        argv: publicArguments(fixture.root),
        environment: process.env,
        execPath: fixture.execPath,
        platform: 'win32',
        expectedRepoRoot: otherRepository,
        verifyTopologyImpl: () => ({}),
        resolveNpmCliImpl: () => fixture.npmCli,
        spawnSyncImpl: () => {
          throw new Error('must not spawn');
        },
      });
    expect(mismatched).toMatchObject({
      kind: 'failure',
      failure: {
        phase: 'launcher',
        reasonCodes: [
          'pre_live_launcher_repository_authority_rejected',
        ],
      },
    });
  });

  it('rejects unknown, duplicate, equals-form, positional, and missing public arguments before bootstrap', () => {
    const fixture = createLauncherFixture();
    const valid = publicArguments(fixture.root);
    const malformed = [
      valid.slice(1),
      [...valid, '--unknown', 'x'],
      [...valid, '--repo-root', fixture.root],
      valid.map((value) =>
        value === '--output-root'
          ? '--output-root=outputs/readiness'
          : value,
      ),
      [...valid, 'positional'],
    ];
    for (const argv of malformed) {
      const outcome =
        launcher.runCanonicalPreLiveReadinessLauncher({
          argv,
          environment: process.env,
          execPath: fixture.execPath,
          platform: 'win32',
          expectedRepoRoot: fixture.root,
          verifyTopologyImpl: () => ({}),
          resolveNpmCliImpl: () => fixture.npmCli,
          spawnSyncImpl: () => {
            throw new Error('bootstrap must be unreachable');
          },
        });
      expect(outcome).toMatchObject({
        kind: 'failure',
        failure: {
          version:
            'canonical-pre-live-readiness-failure/v2',
          status: 'rejected',
          phase: 'launcher',
          reasonCodes: [
            'pre_live_cli_arguments_invalid',
          ],
          pricingAuthority: 'not_checked',
          canonicalPreflight: 'not_run',
          credentialAccess: 'none',
          providerCalls: 0,
          liveAuthority: 'none',
        },
        disposition: { kind: 'exit', exitCode: 1 },
      });
      expect(
        launcher.canonicalBytes(outcome.failure),
      ).not.toContain('bootstrap must be unreachable');
    }
  });

  it('preserves exact private-entry exit and signal disposition', () => {
    const fixture = createLauncherFixture();
    createInstalledAuthority(fixture.root);
    for (const terminal of [
      { status: 27, signal: null },
      {
        status: null,
        signal: 'SIGTERM' as NodeJS.Signals,
      },
    ]) {
      const outcome =
        launcher.runCanonicalPreLiveReadinessLauncher({
          argv: publicArguments(fixture.root, 'verify'),
          environment: process.env,
          execPath: fixture.execPath,
          platform: 'win32',
          expectedRepoRoot: fixture.root,
          verifyTopologyImpl: () => ({}),
          resolveNpmCliImpl: () => fixture.npmCli,
          spawnSyncImpl: () => terminal,
        });
      expect(outcome.disposition).toEqual(
        terminal.signal
          ? { kind: 'signal', signal: terminal.signal }
          : { kind: 'exit', exitCode: terminal.status },
      );
    }
  });

  it('derives npm CLI candidates only from process.execPath and uses a minimal environment', () => {
    expect(
      launcher.fixedLocalNpmCliCandidates(
        'C:\\Program Files\\nodejs\\node.exe',
        'win32',
      ),
    ).toEqual([
      path.resolve(
        'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
      ),
    ]);
    const environment = launcher.offlineNpmEnvironment(
      {
        NODE_ENV: 'test',
        PATH: 'path',
        SystemRoot: 'root',
        USERPROFILE: 'profile',
        OPENAI_API_KEY: 'secret',
        NODE_OPTIONS: 'forbidden',
        npm_config_registry: 'forbidden',
      },
      'win32',
    );
    expect(environment.PATH).toBe('path');
    expect(environment.SystemRoot).toBe('root');
    expect(environment.USERPROFILE).toBe('profile');
    expect(environment.npm_config_offline).toBe('true');
    expect(environment.OPENAI_API_KEY).toBeUndefined();
    expect(environment.NODE_OPTIONS).toBeUndefined();
    expect(environment.npm_config_registry).toBeUndefined();
  });
});
