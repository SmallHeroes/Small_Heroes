'use strict';

const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const FAILURE_VERSION =
  'canonical-pre-live-readiness-failure/v1';
const INTERNAL_CAPABILITY_FLAG =
  '--internal-launch-capability';
const INTERNAL_ENVIRONMENT_NAMES = {
  capability: 'SMALL_HEROES_PRE_LIVE_CAPABILITY',
  npmCliSha256:
    'SMALL_HEROES_PRE_LIVE_NPM_CLI_SHA256',
  offlineInstall:
    'SMALL_HEROES_PRE_LIVE_OFFLINE_INSTALL_COMPLETED',
  prismaGeneration:
    'SMALL_HEROES_PRE_LIVE_PRISMA_GENERATION_COMPLETED',
};

const PUBLIC_FLAGS = new Set([
  '--repo-root',
  '--output-root',
  '--story-source-key',
  '--story-source-path',
  '--request-id',
  '--requested-at',
  '--credential-source-path',
]);

function canonicalValue(value) {
  if (typeof value === 'string') return value.normalize('NFC');
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    if (
      typeof value === 'number' &&
      !Number.isFinite(value)
    ) {
      throw new Error('non_finite_number');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value && typeof value === 'object') {
    const result = {};
    const entries = Object.entries(value)
      .map(([key, entry]) => [
        key.normalize('NFC'),
        entry,
      ])
      .sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      );
    for (const [key, entry] of entries) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        throw new Error('normalized_key_collision');
      }
      result[key] = canonicalValue(entry);
    }
    return result;
  }
  return value;
}

function canonicalDigest(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalValue(value)))
    .digest('hex');
}

function canonicalBytes(value) {
  return `${JSON.stringify(
    canonicalValue(value),
    null,
    2,
  )}\n`;
}

function requestIdentityDigest(parsed) {
  if (
    !parsed ||
    typeof parsed.values.get('--request-id') !== 'string' ||
    typeof parsed.values.get('--requested-at') !== 'string'
  ) {
    return null;
  }
  return canonicalDigest({
    requestId: parsed.values.get('--request-id'),
    requestedAt: parsed.values.get('--requested-at'),
  });
}

function buildLauncherFailure(options) {
  const withoutDigest = {
    version: FAILURE_VERSION,
    status: 'rejected',
    mode:
      options.mode === 'verify' ? 'verify' : 'prepare',
    phase: options.phase,
    reasonCodes: [options.reasonCode],
    authorityReasonCodes: [],
    requestIdentityDigest:
      requestIdentityDigest(options.parsed),
    pricingAuthority: 'not_checked',
    canonicalPreflight: 'not_run',
    credentialAccess: 'none',
    providerCalls: 0,
    liveAuthority: 'none',
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalDigest(withoutDigest),
  };
}

function parseCanonicalPreLiveReadinessArguments(argv) {
  const [mode, ...tokens] = argv;
  if (
    (mode !== 'prepare' && mode !== 'verify') ||
    tokens.length !== PUBLIC_FLAGS.size * 2
  ) {
    return null;
  }
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (
      typeof flag !== 'string' ||
      typeof value !== 'string' ||
      !PUBLIC_FLAGS.has(flag) ||
      flag.includes('=') ||
      values.has(flag) ||
      value.length === 0 ||
      value.startsWith('--')
    ) {
      return null;
    }
    values.set(flag, value);
  }
  if (values.size !== PUBLIC_FLAGS.size) return null;
  const repoRoot = values.get('--repo-root');
  if (!path.isAbsolute(repoRoot)) return null;
  return { mode, values, repoRoot };
}

function normalized(value, platform = process.platform) {
  const resolved = path.resolve(value);
  return platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

function pathsEqual(left, right, platform = process.platform) {
  return (
    normalized(left, platform) ===
    normalized(right, platform)
  );
}

function assertUniqueRegularFile(
  filePath,
  platform = process.platform,
) {
  const lexical = path.resolve(filePath);
  const real = fs.realpathSync(lexical);
  const lstat = fs.lstatSync(lexical);
  const stat = fs.statSync(real);
  if (
    !pathsEqual(lexical, real, platform) ||
    lstat.isSymbolicLink() ||
    !stat.isFile() ||
    stat.nlink !== 1
  ) {
    throw new Error('unique_regular_file_required');
  }
  return real;
}

function assertCanonicalDirectory(
  directory,
  platform = process.platform,
) {
  const lexical = path.resolve(directory);
  const real = fs.realpathSync(lexical);
  const lstat = fs.lstatSync(lexical);
  if (
    !pathsEqual(lexical, real, platform) ||
    lstat.isSymbolicLink() ||
    !lstat.isDirectory()
  ) {
    throw new Error('canonical_directory_required');
  }
  return real;
}

function fixedLocalNpmCliCandidates(
  execPath,
  platform = process.platform,
) {
  const nodeDirectory = path.dirname(path.resolve(execPath));
  const candidates =
    platform === 'win32'
      ? [
          path.join(
            nodeDirectory,
            'node_modules',
            'npm',
            'bin',
            'npm-cli.js',
          ),
        ]
      : [
          path.resolve(
            nodeDirectory,
            '..',
            'lib',
            'node_modules',
            'npm',
            'bin',
            'npm-cli.js',
          ),
          path.join(
            nodeDirectory,
            'node_modules',
            'npm',
            'bin',
            'npm-cli.js',
          ),
        ];
  return [
    ...new Set(
      candidates.map((candidate) => path.resolve(candidate)),
    ),
  ];
}

function resolveUniqueLocalNpmCli(options) {
  const candidates = (
    options.candidates ??
    fixedLocalNpmCliCandidates(
      options.execPath,
      options.platform,
    )
  ).filter((candidate) => fs.existsSync(candidate));
  if (candidates.length !== 1) {
    throw new Error('npm_cli_authority_ambiguous');
  }
  return assertUniqueRegularFile(
    candidates[0],
    options.platform,
  );
}

function inheritedValue(
  environment,
  name,
  platform = process.platform,
) {
  if (platform !== 'win32') return environment[name];
  const key = Object.keys(environment).find(
    (candidate) =>
      candidate.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : environment[key];
}

function platformEnvironmentNames(platform = process.platform) {
  return platform === 'win32'
    ? [
        'APPDATA',
        'ComSpec',
        'LOCALAPPDATA',
        'PATH',
        'PATHEXT',
        'SystemDrive',
        'SystemRoot',
        'TEMP',
        'TMP',
        'USERPROFILE',
        'WINDIR',
      ]
    : [
        'HOME',
        'LANG',
        'LC_ALL',
        'PATH',
        'TMPDIR',
        'TZ',
        'XDG_CACHE_HOME',
      ];
}

function minimalEnvironment(
  environment,
  platform = process.platform,
) {
  const result = Object.create(null);
  for (const name of platformEnvironmentNames(platform)) {
    const value = inheritedValue(
      environment,
      name,
      platform,
    );
    if (value !== undefined) result[name] = value;
  }
  return result;
}

function offlineNpmEnvironment(
  environment,
  platform = process.platform,
) {
  return {
    ...minimalEnvironment(environment, platform),
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_ignore_scripts: 'true',
    npm_config_offline: 'true',
    npm_config_update_notifier: 'false',
  };
}

function gitEnvironment(
  environment,
  platform = process.platform,
) {
  return {
    ...minimalEnvironment(environment, platform),
    GIT_OPTIONAL_LOCKS: '0',
  };
}

function runBootstrapGit(options, argv, allowStatusOne = false) {
  const result = (
    options.gitSpawnSyncImpl ?? spawnSync
  )('git', argv, {
    cwd: options.repoRoot,
    env: gitEnvironment(
      options.environment,
      options.platform,
    ),
    encoding: 'utf8',
    maxBuffer: 64 * 1024,
    shell: false,
    timeout: 20_000,
    windowsHide: true,
  });
  if (
    result.error ||
    result.signal ||
    (result.status !== 0 &&
      !(allowStatusOne && result.status === 1)) ||
    typeof result.stdout !== 'string' ||
    result.stdout.length > 64 * 1024
  ) {
    throw new Error('bootstrap_git_rejected');
  }
  return result;
}

function verifyBootstrapTopology(options) {
  const repositoryRealPath = assertCanonicalDirectory(
    options.repoRoot,
    options.platform,
  );
  const topLevel = runBootstrapGit(
    options,
    ['rev-parse', '--show-toplevel'],
  ).stdout.trim();
  if (
    !pathsEqual(
      repositoryRealPath,
      topLevel,
      options.platform,
    )
  ) {
    throw new Error('bootstrap_repository_mismatch');
  }
  const branch = runBootstrapGit(
    options,
    ['symbolic-ref', '--quiet', '--short', 'HEAD'],
  ).stdout.trim();
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/.test(branch) ||
    branch.includes('..') ||
    branch.includes('//') ||
    branch.endsWith('/') ||
    branch.endsWith('.lock') ||
    branch === 'main' ||
    branch === 'master'
  ) {
    throw new Error('bootstrap_dedicated_branch_required');
  }
  const branchRef = `refs/heads/${branch}`;
  const expectedUpstream =
    `refs/remotes/origin/${branch}`;
  const upstream = runBootstrapGit(
    options,
    [
      'rev-parse',
      '--symbolic-full-name',
      '@{upstream}',
    ],
  ).stdout.trim();
  if (upstream !== expectedUpstream) {
    throw new Error('bootstrap_same_name_upstream_required');
  }
  const head = runBootstrapGit(
    options,
    ['rev-parse', '--verify', 'HEAD^{commit}'],
  ).stdout.trim();
  const upstreamHead = runBootstrapGit(
    options,
    [
      'rev-parse',
      '--verify',
      `${upstream}^{commit}`,
    ],
  ).stdout.trim();
  if (
    !/^[a-f0-9]{40}$/.test(head) ||
    head !== upstreamHead
  ) {
    throw new Error('bootstrap_head_mismatch');
  }
  if (
    !/^0\s+0$/.test(
      runBootstrapGit(
        options,
        [
          'rev-list',
          '--left-right',
          '--count',
          `${branchRef}...${upstream}`,
        ],
      ).stdout.trim(),
    )
  ) {
    throw new Error('bootstrap_divergence_rejected');
  }
  if (
    runBootstrapGit(
      options,
      [
        'status',
        '--porcelain=v2',
        '--untracked-files=all',
      ],
    ).stdout.trim().length > 0
  ) {
    throw new Error('bootstrap_dirty_rejected');
  }
  const ignored = runBootstrapGit(
    options,
    [
      'check-ignore',
      '--quiet',
      '--no-index',
      '--',
      options.outputRoot,
    ],
    true,
  );
  if (ignored.status !== 0) {
    throw new Error('bootstrap_output_not_ignored');
  }
  return {
    repositoryRealPath,
    branchRef,
    head,
    upstreamRef: upstream,
  };
}

function entryEnvironment(options) {
  return {
    ...minimalEnvironment(options.environment, options.platform),
    TSX_DISABLE_CACHE: '1',
    [INTERNAL_ENVIRONMENT_NAMES.capability]:
      options.capability,
    [INTERNAL_ENVIRONMENT_NAMES.npmCliSha256]:
      options.npmCliSha256,
    [INTERNAL_ENVIRONMENT_NAMES.offlineInstall]: '1',
    [INTERNAL_ENVIRONMENT_NAMES.prismaGeneration]: '1',
    ...(options.additionalEnvironment ?? {}),
  };
}

function sha256File(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function localAuthorityPaths(repoRoot, platform) {
  const repositoryRealPath = assertCanonicalDirectory(
    repoRoot,
    platform,
  );
  assertUniqueRegularFile(
    path.join(repositoryRealPath, 'package.json'),
    platform,
  );
  assertUniqueRegularFile(
    path.join(repositoryRealPath, 'package-lock.json'),
    platform,
  );
  const nodeModules = path.join(
    repositoryRealPath,
    'node_modules',
  );
  const tsxCli = path.join(
    nodeModules,
    'tsx',
    'dist',
    'cli.mjs',
  );
  const prismaCli = path.join(
    nodeModules,
    'prisma',
    'build',
    'index.js',
  );
  return {
    repositoryRealPath,
    nodeModules,
    tsxCli,
    prismaCli,
    shim: path.join(
      repositoryRealPath,
      'scripts',
      'shims',
      'register-server-only.cjs',
    ),
    entrypoint: path.join(
      repositoryRealPath,
      'scripts',
      'canonical-pre-live-readiness-entry.ts',
    ),
    generatedPrismaSchema: path.join(
      nodeModules,
      '.prisma',
      'client',
      'schema.prisma',
    ),
  };
}

function verifyInstalledAuthority(paths, platform) {
  assertCanonicalDirectory(paths.nodeModules, platform);
  assertUniqueRegularFile(paths.tsxCli, platform);
  assertUniqueRegularFile(paths.prismaCli, platform);
  assertUniqueRegularFile(paths.shim, platform);
  assertUniqueRegularFile(paths.entrypoint, platform);
  assertUniqueRegularFile(
    paths.generatedPrismaSchema,
    platform,
  );
}

function spawnFixed(options) {
  return (options.spawnSyncImpl ?? spawnSync)(
    options.execPath,
    options.argv,
    {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: options.stdio,
      windowsHide: true,
    },
  );
}

function failedDisposition(result) {
  if (result.error) return true;
  if (result.signal) return true;
  return !Number.isInteger(result.status) || result.status !== 0;
}

function runCanonicalPreLiveReadinessLauncher(options) {
  const parsed = parseCanonicalPreLiveReadinessArguments(
    options.argv,
  );
  if (!parsed) {
    return {
      kind: 'failure',
      failure: buildLauncherFailure({
        mode:
          options.argv[0] === 'verify'
            ? 'verify'
            : 'prepare',
        phase: 'launcher',
        reasonCode: 'pre_live_cli_arguments_invalid',
        parsed: null,
      }),
      disposition: { kind: 'exit', exitCode: 1 },
    };
  }
  const platform = options.platform ?? process.platform;
  let paths;
  let npmCli;
  let trustedExecPath;
  try {
    trustedExecPath = assertUniqueRegularFile(
      options.execPath,
      platform,
    );
    if (options.expectedRepoRoot) {
      const expectedRepoRoot = assertCanonicalDirectory(
        options.expectedRepoRoot,
        platform,
      );
      const suppliedRepoRoot = assertCanonicalDirectory(
        parsed.repoRoot,
        platform,
      );
      if (
        !pathsEqual(
          expectedRepoRoot,
          suppliedRepoRoot,
          platform,
        )
      ) {
        throw new Error('launcher_repository_mismatch');
      }
    }
    paths = localAuthorityPaths(parsed.repoRoot, platform);
    (
      options.verifyTopologyImpl ??
      verifyBootstrapTopology
    )({
      repoRoot: paths.repositoryRealPath,
      outputRoot: parsed.values.get('--output-root'),
      environment: options.environment,
      platform,
      gitSpawnSyncImpl: options.gitSpawnSyncImpl,
    });
    npmCli = (
      options.resolveNpmCliImpl ??
      resolveUniqueLocalNpmCli
    )({
      execPath: trustedExecPath,
      platform,
      candidates: options.npmCliCandidates,
    });
  } catch {
    return {
      kind: 'failure',
      failure: buildLauncherFailure({
        mode: parsed.mode,
        phase: paths ? 'topology' : 'dependency',
        reasonCode:
          paths
            ? 'pre_live_topology_rejected'
            : 'pre_live_dependency_authority_rejected',
        parsed,
      }),
      disposition: { kind: 'exit', exitCode: 1 },
    };
  }

  if (parsed.mode === 'prepare') {
    try {
      if (fs.existsSync(paths.nodeModules)) {
        assertCanonicalDirectory(
          paths.nodeModules,
          platform,
        );
      }
    } catch {
      return {
        kind: 'failure',
        failure: buildLauncherFailure({
          mode: parsed.mode,
          phase: 'dependency',
          reasonCode:
            'pre_live_dependency_node_modules_alias_rejected',
          parsed,
        }),
        disposition: { kind: 'exit', exitCode: 1 },
      };
    }
    const install = spawnFixed({
      spawnSyncImpl: options.spawnSyncImpl,
      execPath: trustedExecPath,
      argv: [
        npmCli,
        'ci',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
      ],
      cwd: paths.repositoryRealPath,
      env: offlineNpmEnvironment(
        options.environment,
        platform,
      ),
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    if (failedDisposition(install)) {
      return {
        kind: 'failure',
        failure: buildLauncherFailure({
          mode: parsed.mode,
          phase: 'dependency',
          reasonCode:
            'pre_live_dependency_offline_install_rejected',
          parsed,
        }),
        disposition: launcherDisposition(install),
      };
    }
    try {
      assertCanonicalDirectory(
        paths.nodeModules,
        platform,
      );
      assertUniqueRegularFile(paths.prismaCli, platform);
    } catch {
      return {
        kind: 'failure',
        failure: buildLauncherFailure({
          mode: parsed.mode,
          phase: 'dependency',
          reasonCode:
            'pre_live_dependency_prisma_authority_rejected',
          parsed,
        }),
        disposition: { kind: 'exit', exitCode: 1 },
      };
    }
    const prisma = spawnFixed({
      spawnSyncImpl: options.spawnSyncImpl,
      execPath: trustedExecPath,
      argv: [
        paths.prismaCli,
        'generate',
        '--schema',
        'backend/schema.prisma',
      ],
      cwd: paths.repositoryRealPath,
      env: minimalEnvironment(
        options.environment,
        platform,
      ),
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    if (failedDisposition(prisma)) {
      return {
        kind: 'failure',
        failure: buildLauncherFailure({
          mode: parsed.mode,
          phase: 'dependency',
          reasonCode:
            'pre_live_dependency_prisma_generation_rejected',
          parsed,
        }),
        disposition: launcherDisposition(prisma),
      };
    }
  }

  try {
    verifyInstalledAuthority(paths, platform);
  } catch {
    return {
      kind: 'failure',
      failure: buildLauncherFailure({
        mode: parsed.mode,
        phase: 'dependency',
        reasonCode:
          'pre_live_dependency_authority_rejected',
        parsed,
      }),
      disposition: { kind: 'exit', exitCode: 1 },
    };
  }

  const capability = crypto.randomBytes(32).toString('hex');
  const npmCliSha256 = sha256File(npmCli);
  const child = spawnFixed({
    spawnSyncImpl: options.spawnSyncImpl,
    execPath: trustedExecPath,
    argv: [
      paths.tsxCli,
      '--require',
      paths.shim,
      paths.entrypoint,
      ...options.argv,
      INTERNAL_CAPABILITY_FLAG,
      capability,
    ],
    cwd: paths.repositoryRealPath,
    env: entryEnvironment({
      environment: options.environment,
      platform,
      capability,
      npmCliSha256,
      additionalEnvironment:
        options.additionalEntryEnvironment,
    }),
    stdio: options.entryStdio ?? 'inherit',
  });
  return {
    kind: 'child',
    child,
    disposition: launcherDisposition(child),
  };
}

function launcherDisposition(result) {
  if (result.error) return { kind: 'exit', exitCode: 1 };
  if (result.signal) {
    return { kind: 'signal', signal: result.signal };
  }
  if (Number.isInteger(result.status)) {
    return { kind: 'exit', exitCode: result.status };
  }
  return { kind: 'exit', exitCode: 1 };
}

module.exports = {
  FAILURE_VERSION,
  INTERNAL_CAPABILITY_FLAG,
  INTERNAL_ENVIRONMENT_NAMES,
  PUBLIC_FLAGS,
  assertCanonicalDirectory,
  assertUniqueRegularFile,
  buildLauncherFailure,
  canonicalBytes,
  entryEnvironment,
  fixedLocalNpmCliCandidates,
  launcherDisposition,
  minimalEnvironment,
  offlineNpmEnvironment,
  parseCanonicalPreLiveReadinessArguments,
  platformEnvironmentNames,
  resolveUniqueLocalNpmCli,
  runCanonicalPreLiveReadinessLauncher,
  verifyBootstrapTopology,
};
