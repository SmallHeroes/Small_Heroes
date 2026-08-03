import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
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
const gitBoundary = require(
  '../../../scripts/lib/canonical-pre-live-git-invocation.cjs',
) as {
  GIT_COMMAND_IDS: readonly GitCommandId[];
  GIT_FAILURE_CLASSES: readonly GitFailureClass[];
  GIT_PROFILES: readonly GitProfile[];
  gitEnvironmentForProfile: (options: {
    profile: GitProfile;
    environment: NodeJS.ProcessEnv;
    platform: NodeJS.Platform;
  }) => NodeJS.ProcessEnv;
  profileEnvironmentNames: (
    profile: GitProfile,
    platform: NodeJS.Platform,
  ) => string[];
};
const launcher = require(
  '../../../scripts/lib/canonical-pre-live-readiness-launcher.cjs',
) as {
  canonicalBytes: (value: unknown) => string;
  runCanonicalPreLiveReadinessLauncher: (options: {
    argv: string[];
    environment: NodeJS.ProcessEnv;
    execPath: string;
    platform: NodeJS.Platform;
    expectedRepoRoot?: string;
    gitSpawnSyncImpl?: GitSpawn;
    spawnSyncImpl?: () => never;
  }) => ProbeOutcome;
};

type GitProfile = 'bootstrap_launcher' | 'private_entry';
type GitCommandId =
  | 'repository_top_level'
  | 'symbolic_branch'
  | 'upstream_ref'
  | 'head_commit'
  | 'upstream_head_commit'
  | 'divergence'
  | 'worktree_status'
  | 'output_root_ignore';
type GitFailureClass =
  | 'spawn_error'
  | 'timeout'
  | 'signal'
  | 'output_ceiling'
  | 'malformed_result'
  | 'nonzero_exit';
type GitSpawnResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
  stdout?: string;
  stderr?: string;
};
type GitSpawn = (
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
) => GitSpawnResult;
type ProbeDiagnostic = {
  profile: GitProfile;
  commandId: GitCommandId;
  failureClass: GitFailureClass | null;
  exitStatus: number | null;
  signalClass: string;
  errorClass: string;
  stderrClass: string;
  stdoutBytes: number;
  stderrBytes: number;
};
type ProbeEvidence = {
  version: 'canonical-pre-live-git-probe-evidence/v1';
  status: 'ready_for_canonical_prepare' | 'rejected';
  observations: ProbeDiagnostic[];
  pricingAuthority: 'not_checked';
  canonicalPreflight: 'not_run';
  credentialAccess: 'none';
  providerCalls: 0;
  readinessAuthority: 'none';
  liveAuthority: 'none';
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
};
type ProbeOutcome = {
  kind: 'probe' | 'failure' | 'child';
  evidence?: ProbeEvidence;
  disposition:
    | { kind: 'exit'; exitCode: number }
    | { kind: 'signal'; signal: NodeJS.Signals };
};

const tempRoots: string[] = [];
const commit = 'a'.repeat(40);

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(prefix = 'pre-live-git-probe-'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeFile(
  root: string,
  relativePath: string,
  contents: string,
): string {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), {
    recursive: true,
  });
  fs.writeFileSync(absolutePath, contents, 'utf8');
  return absolutePath;
}

function probeArguments(repoRoot: string): string[] {
  return [
    'probe-git',
    '--repo-root',
    repoRoot,
    '--output-root',
    'outputs/pre-live probe',
  ];
}

function commandOutput(
  commandId: GitCommandId,
  repoRoot: string,
): string {
  if (commandId === 'repository_top_level') {
    return `${repoRoot}\n`;
  }
  if (commandId === 'symbolic_branch') {
    return 'codex/probe-fixture\n';
  }
  if (commandId === 'upstream_ref') {
    return 'refs/remotes/origin/codex/probe-fixture\n';
  }
  if (
    commandId === 'head_commit' ||
    commandId === 'upstream_head_commit'
  ) {
    return `${commit}\n`;
  }
  if (commandId === 'divergence') return '0\t0\n';
  return '';
}

function successResult(
  commandId: GitCommandId,
  repoRoot: string,
): GitSpawnResult {
  return {
    status: 0,
    signal: null,
    stdout: commandOutput(commandId, repoRoot),
    stderr: '',
  };
}

function profileFromEnvironment(
  environment: NodeJS.ProcessEnv,
): GitProfile {
  return environment.NODE_ENV === 'production'
    ? 'private_entry'
    : 'bootstrap_launcher';
}

function injectedProbe(options: {
  targetProfile?: GitProfile;
  targetCommand?: GitCommandId;
  failureVariant?: FailureVariant;
  environment?: NodeJS.ProcessEnv;
} = {}): {
  outcome: ProbeOutcome;
  calls: Array<{
    profile: GitProfile;
    commandId: GitCommandId;
    executable: string;
    argv: string[];
    options: Parameters<GitSpawn>[2];
  }>;
} {
  const repoRoot = tempRoot();
  const commandIndexes: Record<GitProfile, number> = {
    bootstrap_launcher: 0,
    private_entry: 0,
  };
  const calls: Array<{
    profile: GitProfile;
    commandId: GitCommandId;
    executable: string;
    argv: string[];
    options: Parameters<GitSpawn>[2];
  }> = [];
  const gitSpawnSyncImpl: GitSpawn = (
    executable,
    argv,
    spawnOptions,
  ) => {
    const profile = profileFromEnvironment(spawnOptions.env);
    const commandId =
      gitBoundary.GIT_COMMAND_IDS[
        commandIndexes[profile]++
      ]!;
    calls.push({
      profile,
      commandId,
      executable,
      argv,
      options: spawnOptions,
    });
    if (
      profile === options.targetProfile &&
      commandId === options.targetCommand &&
      options.failureVariant
    ) {
      return failureResult(options.failureVariant);
    }
    return successResult(commandId, repoRoot);
  };
  return {
    outcome: launcher.runCanonicalPreLiveReadinessLauncher({
      argv: probeArguments(repoRoot),
      environment: options.environment ?? process.env,
      execPath: process.execPath,
      platform: 'win32',
      expectedRepoRoot: repoRoot,
      gitSpawnSyncImpl,
      spawnSyncImpl: () => {
        throw new Error(
          'dependency or private entry must be unreachable',
        );
      },
    }),
    calls,
  };
}

type FailureVariant =
  | 'throw'
  | 'spawn_error'
  | 'timeout'
  | 'signal'
  | 'output_ceiling'
  | 'malformed_result'
  | 'hostile_result'
  | 'nonzero_exit';

const failureExpectation: Record<
  FailureVariant,
  GitFailureClass
> = {
  throw: 'spawn_error',
  spawn_error: 'spawn_error',
  timeout: 'timeout',
  signal: 'signal',
  output_ceiling: 'output_ceiling',
  malformed_result: 'malformed_result',
  hostile_result: 'malformed_result',
  nonzero_exit: 'nonzero_exit',
};

function failureResult(
  variant: FailureVariant,
): GitSpawnResult {
  if (variant === 'throw') {
    throw new Error(
      'raw throw fake-secret C:\\private\\repo',
    );
  }
  if (variant === 'spawn_error') {
    return {
      status: null,
      signal: null,
      error: Object.assign(
        new Error('raw spawn fake-secret'),
        { code: 'ENOENT' },
      ),
      stdout: 'raw stdout path C:\\private\\repo',
      stderr: 'raw stderr path C:\\private\\repo',
    };
  }
  if (variant === 'timeout') {
    return {
      status: null,
      signal: 'SIGTERM',
      error: Object.assign(new Error('raw timeout'), {
        code: 'ETIMEDOUT',
      }),
      stdout: '',
      stderr: 'raw timeout stderr',
    };
  }
  if (variant === 'signal') {
    return {
      status: null,
      signal: 'SIGTERM',
      stdout: 'raw signal stdout',
      stderr: 'raw signal stderr',
    };
  }
  if (variant === 'output_ceiling') {
    return {
      status: 0,
      signal: null,
      stdout: 'x'.repeat(64 * 1024 + 1),
      stderr: '',
    };
  }
  if (variant === 'malformed_result') {
    return {
      status: null,
      signal: null,
      stdout: '',
      stderr: '',
    };
  }
  if (variant === 'hostile_result') {
    return new Proxy({} as GitSpawnResult, {
      get() {
        throw new Error(
          'raw hostile result fake-secret C:\\private\\repo',
        );
      },
    });
  }
  return {
    status: 128,
    signal: null,
    stdout: 'raw stdout must not persist',
    stderr:
      "fatal: detected dubious ownership; add safe.directory C:\\private\\repo",
  };
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

function copyProbeScripts(root: string): string {
  const files = [
    'scripts/canonical-pre-live-readiness.cjs',
    'scripts/lib/canonical-pre-live-readiness-launcher.cjs',
    'scripts/lib/canonical-pre-live-git-invocation.cjs',
  ];
  for (const relativePath of files) {
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(process.cwd(), relativePath),
      destination,
    );
  }
  return path.join(
    root,
    'scripts',
    'canonical-pre-live-readiness.cjs',
  );
}

function createRealProbeRepository(options: {
  linkedWorktree: boolean;
}): { root: string; script: string } {
  const parent = tempRoot('pre-live git probe \u05e9\u05dc\u05d5\u05dd ');
  const primary = path.join(parent, 'primary repository');
  const remote = path.join(parent, 'remote repository.git');
  fs.mkdirSync(primary, { recursive: true });
  writeFile(primary, '.gitignore', 'outputs/\nnode_modules/\n');
  copyProbeScripts(primary);
  git(primary, ['init', '-b', 'codex/probe-primary']);
  git(primary, ['config', 'user.email', 'fixture@example.test']);
  git(primary, ['config', 'user.name', 'Probe Fixture']);
  git(primary, ['add', '.']);
  git(primary, ['commit', '-m', 'probe fixture']);
  git(parent, ['init', '--bare', remote]);
  git(primary, ['remote', 'add', 'origin', remote]);
  git(primary, ['push', '-u', 'origin', 'codex/probe-primary']);
  if (!options.linkedWorktree) {
    return {
      root: fs.realpathSync(primary),
      script: path.join(
        fs.realpathSync(primary),
        'scripts',
        'canonical-pre-live-readiness.cjs',
      ),
    };
  }
  const linked = path.join(
    parent,
    'linked worktree \u05e9\u05dc\u05d5\u05dd',
  );
  git(primary, [
    'worktree',
    'add',
    '-b',
    'codex/probe-linked',
    linked,
  ]);
  git(linked, ['push', '-u', 'origin', 'codex/probe-linked']);
  return {
    root: fs.realpathSync(linked),
    script: path.join(
      fs.realpathSync(linked),
      'scripts',
      'canonical-pre-live-readiness.cjs',
    ),
  };
}

function runPublicProbe(root: string, script: string) {
  return spawnSync(
    process.execPath,
    [
      script,
      'probe-git',
      '--repo-root',
      root,
      '--output-root',
      'outputs/public probe',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    },
  );
}

describe('canonical pre-live Git invocation probe', () => {
  it('owns the exact closed command and profile catalogs', () => {
    expect(gitBoundary.GIT_PROFILES).toEqual([
      'bootstrap_launcher',
      'private_entry',
    ]);
    expect(gitBoundary.GIT_COMMAND_IDS).toEqual([
      'repository_top_level',
      'symbolic_branch',
      'upstream_ref',
      'head_commit',
      'upstream_head_commit',
      'divergence',
      'worktree_status',
      'output_root_ignore',
    ]);
    expect(gitBoundary.GIT_FAILURE_CLASSES).toEqual([
      'spawn_error',
      'timeout',
      'signal',
      'output_ceiling',
      'malformed_result',
      'nonzero_exit',
    ]);
  });

  it('runs only exact Git argv under both unchanged environment profiles', () => {
    const { outcome, calls } = injectedProbe();
    expect(outcome).toMatchObject({
      kind: 'probe',
      evidence: {
        version: 'canonical-pre-live-git-probe-evidence/v1',
        status: 'ready_for_canonical_prepare',
        observations: expect.arrayContaining([
          expect.objectContaining({
            profile: 'bootstrap_launcher',
            commandId: 'repository_top_level',
            failureClass: null,
          }),
          expect.objectContaining({
            profile: 'private_entry',
            commandId: 'output_root_ignore',
            failureClass: null,
          }),
        ]),
        credentialAccess: 'none',
        providerCalls: 0,
        canonicalPreflight: 'not_run',
        pricingAuthority: 'not_checked',
        readinessAuthority: 'none',
        liveAuthority: 'none',
      },
      disposition: { kind: 'exit', exitCode: 0 },
    });
    expect(calls).toHaveLength(16);
    expect(calls.map((call) => call.commandId)).toEqual([
      ...gitBoundary.GIT_COMMAND_IDS,
      ...gitBoundary.GIT_COMMAND_IDS,
    ]);
    for (const call of calls) {
      expect(call.executable).toBe('git');
      expect(call.options).toMatchObject({
        shell: false,
        timeout: 20_000,
        maxBuffer: 64 * 1024,
        windowsHide: true,
      });
      expect(call.options.env.OPENAI_API_KEY).toBeUndefined();
      expect(call.options.env.NODE_OPTIONS).toBeUndefined();
    }
    expect(calls[0]!.options.env.USERPROFILE).toBeDefined();
    expect(calls[8]!.options.env.USERPROFILE).toBeUndefined();
    expect(calls[8]!.options.env.NODE_ENV).toBe('production');
    expect(calls[0]!.argv).toEqual([
      'rev-parse',
      '--show-toplevel',
    ]);
    expect(calls[4]!.argv).toEqual([
      'rev-parse',
      '--verify',
      'refs/remotes/origin/codex/probe-fixture^{commit}',
    ]);
    expect(calls[5]!.argv).toEqual([
      'rev-list',
      '--left-right',
      '--count',
      'refs/heads/codex/probe-fixture...refs/remotes/origin/codex/probe-fixture',
    ]);
    expect(calls[7]!.argv).toEqual([
      'check-ignore',
      '--quiet',
      '--no-index',
      '--',
      'outputs/pre-live probe',
    ]);
  });

  it('reads only the two fixed profile allowlists without enumeration or credential access', () => {
    const allowed = new Set([
      ...gitBoundary.profileEnvironmentNames(
        'bootstrap_launcher',
        'win32',
      ),
      ...gitBoundary.profileEnvironmentNames(
        'private_entry',
        'win32',
      ),
    ]);
    const reads: string[] = [];
    const environment = new Proxy(
      {
        PATH: 'fixture-path',
        SystemRoot: 'C:\\Windows',
        USERPROFILE: 'C:\\Users\\Fixture',
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'fake-secret',
      } as unknown as NodeJS.ProcessEnv,
      {
        get(target, property) {
          if (property === 'OPENAI_API_KEY') {
            throw new Error('credential access forbidden');
          }
          if (
            typeof property === 'string' &&
            !allowed.has(property)
          ) {
            throw new Error(`unapproved read: ${property}`);
          }
          if (typeof property === 'string') reads.push(property);
          return Reflect.get(target, property);
        },
        ownKeys() {
          throw new Error('environment enumeration forbidden');
        },
      },
    );
    const { outcome } = injectedProbe({ environment });
    expect(outcome.evidence?.status).toBe(
      'ready_for_canonical_prepare',
    );
    expect(new Set(reads)).toEqual(allowed);
  });

  const failureMatrix = gitBoundary.GIT_PROFILES.flatMap(
    (profile) =>
      gitBoundary.GIT_COMMAND_IDS.flatMap((commandId) =>
        (
          Object.keys(failureExpectation) as FailureVariant[]
        ).map((failureVariant) => ({
          profile,
          commandId,
          failureVariant,
          expectedClass: failureExpectation[failureVariant],
        })),
      ),
  );

  it.each(failureMatrix)(
    'sanitizes $profile/$commandId/$failureVariant and stops later commands',
    ({
      profile,
      commandId,
      failureVariant,
      expectedClass,
    }) => {
      const { outcome, calls } = injectedProbe({
        targetProfile: profile,
        targetCommand: commandId,
        failureVariant,
      });
      expect(outcome).toMatchObject({
        kind: 'probe',
        evidence: {
          version: 'canonical-pre-live-git-probe-evidence/v1',
          status: 'rejected',
          credentialAccess: 'none',
          providerCalls: 0,
          canonicalPreflight: 'not_run',
          pricingAuthority: 'not_checked',
          readinessAuthority: 'none',
          liveAuthority: 'none',
        },
        disposition: { kind: 'exit', exitCode: 1 },
      });
      const observations = outcome.evidence!.observations;
      const last = observations[observations.length - 1]!;
      expect(last).toMatchObject({
        profile,
        commandId,
        failureClass: expectedClass,
      });
      if (failureVariant === 'nonzero_exit') {
        expect(last).toMatchObject({
          exitStatus: 128,
          stderrClass: 'safe_directory',
        });
      }
      const profileOffset =
        profile === 'private_entry'
          ? gitBoundary.GIT_COMMAND_IDS.length
          : 0;
      const targetIndex =
        gitBoundary.GIT_COMMAND_IDS.indexOf(commandId);
      expect(calls).toHaveLength(profileOffset + targetIndex + 1);
      const bytes = launcher.canonicalBytes(outcome.evidence);
      for (const rejected of [
        'fake-secret',
        'C:\\private\\repo',
        'raw stdout',
        'raw stderr',
        'raw throw',
        'raw spawn',
        'raw timeout',
        'raw signal',
        'raw hostile',
        'dubious ownership',
        'safe.directory',
      ]) {
        expect(bytes).not.toContain(rejected);
      }
      expect(Object.keys(last).sort()).toEqual(
        [
          'profile',
          'commandId',
          'failureClass',
          'exitStatus',
          'signalClass',
          'errorClass',
          'stderrClass',
          'stdoutBytes',
          'stderrBytes',
        ].sort(),
      );
    },
  );

  it('rejects arbitrary command, argv, cwd, equals, duplicate, and positional input before Git', () => {
    const root = tempRoot();
    const valid = probeArguments(root);
    const malformed = [
      { argv: valid.slice(1), expectedKind: 'failure' },
      { argv: [...valid, '--command', 'status'], expectedKind: 'probe' },
      { argv: [...valid, '--argv', '--version'], expectedKind: 'probe' },
      { argv: [...valid, '--cwd', root], expectedKind: 'probe' },
      { argv: [...valid, '--repo-root', root], expectedKind: 'probe' },
      { argv: valid.map((token) =>
        token === '--output-root'
          ? '--output-root=outputs/probe'
          : token,
        ), expectedKind: 'probe' },
      { argv: [...valid, 'positional'], expectedKind: 'probe' },
    ];
    for (const { argv, expectedKind } of malformed) {
      let gitCalls = 0;
      const outcome =
        launcher.runCanonicalPreLiveReadinessLauncher({
          argv,
          environment: process.env,
          execPath: process.execPath,
          platform: process.platform,
          expectedRepoRoot: root,
          gitSpawnSyncImpl: () => {
            gitCalls += 1;
            return successResult('repository_top_level', root);
          },
          spawnSyncImpl: () => {
            throw new Error('child must be unreachable');
          },
        });
      expect(outcome).toMatchObject(
        expectedKind === 'probe'
          ? {
              kind: 'probe',
              evidence: {
                status: 'rejected',
                observations: [],
              },
              disposition: { kind: 'exit', exitCode: 1 },
            }
          : {
              kind: 'failure',
              disposition: { kind: 'exit', exitCode: 1 },
            },
      );
      expect(gitCalls).toBe(0);
    }
  });

  it.each([
    { linkedWorktree: false },
    { linkedWorktree: true },
  ])(
    'public subprocess passes both profiles in a Windows-safe repository shape (linked=$linkedWorktree)',
    ({ linkedWorktree }) => {
      const fixture = createRealProbeRepository({
        linkedWorktree,
      });
      const outputRoot = path.join(
        fixture.root,
        'outputs',
        'public probe',
      );
      const nodeModules = path.join(
        fixture.root,
        'node_modules',
      );
      const credentialSentinel = path.join(
        path.dirname(fixture.root),
        'opaque credential label.env',
      );
      fs.writeFileSync(
        credentialSentinel,
        'fixture bytes that the probe must not access\n',
        'utf8',
      );
      const credentialSentinelBefore = fs.readFileSync(
        credentialSentinel,
      );
      expect(fs.existsSync(outputRoot)).toBe(false);
      expect(fs.existsSync(nodeModules)).toBe(false);
      const result = runPublicProbe(
        fixture.root,
        fixture.script,
      );
      expect(result.status).toBe(0);
      expect(result.signal).toBeNull();
      expect(result.stderr).toBe('');
      const evidence = JSON.parse(
        result.stdout,
      ) as ProbeEvidence;
      expect(evidence).toMatchObject({
        version: 'canonical-pre-live-git-probe-evidence/v1',
        status: 'ready_for_canonical_prepare',
        credentialAccess: 'none',
        providerCalls: 0,
        canonicalPreflight: 'not_run',
        pricingAuthority: 'not_checked',
        readinessAuthority: 'none',
        liveAuthority: 'none',
        digestAlgorithm: 'canonical-json-sha256',
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      expect(evidence.observations).toHaveLength(16);
      const {
        digest,
        digestAlgorithm,
        ...payloadDomain
      } = evidence;
      expect(digestAlgorithm).toBe(
        'canonical-json-sha256',
      );
      expect(digest).toBe(
        crypto
          .createHash('sha256')
          .update(
            JSON.stringify(
              JSON.parse(
                launcher.canonicalBytes(payloadDomain),
              ),
            ),
          )
          .digest('hex'),
      );
      expect(fs.existsSync(outputRoot)).toBe(false);
      expect(fs.existsSync(nodeModules)).toBe(false);
      expect(fs.readFileSync(credentialSentinel)).toEqual(
        credentialSentinelBefore,
      );
      expect(
        launcher.canonicalBytes(evidence),
      ).not.toContain(fixture.root);
    },
    30_000,
  );

  it('contains no environment enumeration, credential access, arbitrary executable, shell text, or eval boundary', () => {
    const files = [
      'scripts/lib/canonical-pre-live-git-invocation.cjs',
      'scripts/lib/canonical-pre-live-readiness-launcher.cjs',
      'scripts/canonical-pre-live-readiness.cjs',
    ];
    const source = files
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    expect(source).not.toMatch(
      /Object\.(?:keys|entries)\(\s*(?:environment|process\.env)/,
    );
    expect(source).not.toContain('Reflect.ownKeys');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toContain('shell: true');
    expect(source).not.toContain("spawnSync(options.executable");
    const gitBoundarySource = fs.readFileSync(
      'scripts/lib/canonical-pre-live-git-invocation.cjs',
      'utf8',
    );
    expect(gitBoundarySource).not.toContain('options.argv');
  });
});
