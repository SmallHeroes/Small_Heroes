import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  CANONICAL_PRE_LIVE_READINESS_EVIDENCE_CATEGORY,
  CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION,
  CANONICAL_PRE_LIVE_READINESS_FAILURE_CATEGORY,
  CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION,
  CANONICAL_PRE_LIVE_READINESS_HISTORICAL_FAILURE_VERSION,
  CANONICAL_PRE_LIVE_READINESS_PRIVATE_TESTING,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
  buildCanonicalPreLiveReadinessFailure,
  assertValidCanonicalPreLiveReadinessEvidence,
  canonicalJsonDigest,
  canonicalPreLiveReadinessFailureIssues,
  canonicalPreLiveReadinessArtifactPath,
  inspectCanonicalPreLiveReadinessFailure,
  prepareCanonicalPreLiveReadiness,
  verifyCanonicalLiveExecution,
  verifyCanonicalLiveRequestBundle,
  verifyCanonicalPreLiveReadiness,
  type CanonicalPreLiveReadinessInput,
  type CanonicalPreLiveReadinessLaunchAuthority,
} from '@/lib/visual-package';

const REPO = process.cwd();
const TSX = path.join(
  REPO,
  'node_modules',
  'tsx',
  'dist',
  'cli.mjs',
);
const SHIM = path.join(
  REPO,
  'scripts',
  'shims',
  'register-server-only.cjs',
);
const ENTRY = path.join(
  REPO,
  'scripts',
  'canonical-pre-live-readiness-entry.ts',
);
const SENTINEL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'deny-canonical-pre-live-readiness-boundaries.cjs',
);
const HISTORICAL_FAILURE_V2 = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'canonical-pre-live-readiness-failure-v2.json',
);
const INTERNAL_CAPABILITY_FLAG =
  '--internal-launch-capability';
const INTERNAL_CAPABILITY_ENV =
  'SMALL_HEROES_PRE_LIVE_CAPABILITY';
const INTERNAL_NPM_DIGEST_ENV =
  'SMALL_HEROES_PRE_LIVE_NPM_CLI_SHA256';
const INTERNAL_INSTALL_ENV =
  'SMALL_HEROES_PRE_LIVE_OFFLINE_INSTALL_COMPLETED';
const INTERNAL_PRISMA_ENV =
  'SMALL_HEROES_PRE_LIVE_PRISMA_GENERATION_COMPLETED';
const REQUESTED_AT = '2026-07-31T12:00:00.000Z';
const OUTPUT_ROOT =
  'outputs/canonical-pre-live-readiness';
const BRANCH =
  'codex/canonical-pre-live-readiness-fixture';
const tempRoots: string[] = [];

interface ReadinessFixture {
  parent: string;
  repoRoot: string;
  remoteRoot: string;
  input: CanonicalPreLiveReadinessInput;
  launchAuthority: CanonicalPreLiveReadinessLaunchAuthority;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(
  prefix = 'canonical-pre-live-readiness-',
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
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

function sha256(value: Buffer | string): string {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function fixtureStory(): string {
  return [
    '---',
    'title: "Readiness fixture"',
    'gender: male',
    'pages: 12',
    '---',
    '',
    ...Array.from({ length: 12 }, (_, index) => index + 1)
      .flatMap((pageNumber) => [
        `--- Page ${pageNumber} ---`,
        `A careful builder studies a neutral plan and chooses step ${pageNumber}.`,
        '',
        `imageDirection: A neutral workshop view for step ${pageNumber}.`,
        '',
      ]),
  ].join('\n');
}

function writeFile(
  root: string,
  relativePath: string,
  contents: string,
): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), {
    recursive: true,
  });
  fs.writeFileSync(absolutePath, contents, 'utf8');
}

function createDependencyAuthority(repoRoot: string): void {
  const packages = {
    tsx: '4.22.2',
    typescript: '6.0.3',
    prisma: '6.19.3',
    '@prisma/client': '6.19.3',
  };
  writeFile(
    repoRoot,
    'package.json',
    `${JSON.stringify(
      {
        name: 'pre-live-readiness-fixture',
        private: true,
        devDependencies: {
          prisma: packages.prisma,
          tsx: packages.tsx,
          typescript: packages.typescript,
        },
        dependencies: {
          '@prisma/client': packages['@prisma/client'],
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFile(
    repoRoot,
    'package-lock.json',
    `${JSON.stringify(
      {
        name: 'pre-live-readiness-fixture',
        lockfileVersion: 3,
        requires: true,
        packages: {
          '': {},
          'node_modules/tsx': { version: packages.tsx },
          'node_modules/typescript': {
            version: packages.typescript,
          },
          'node_modules/prisma': {
            version: packages.prisma,
          },
          'node_modules/@prisma/client': {
            version: packages['@prisma/client'],
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  const packageFiles = [
    {
      packagePath: 'node_modules/tsx/package.json',
      version: packages.tsx,
      authorityPath: 'node_modules/tsx/dist/cli.mjs',
    },
    {
      packagePath:
        'node_modules/typescript/package.json',
      version: packages.typescript,
      authorityPath:
        'node_modules/typescript/lib/tsc.js',
    },
    {
      packagePath: 'node_modules/prisma/package.json',
      version: packages.prisma,
      authorityPath:
        'node_modules/prisma/build/index.js',
    },
    {
      packagePath:
        'node_modules/@prisma/client/package.json',
      version: packages['@prisma/client'],
      authorityPath:
        'node_modules/@prisma/client/default.js',
    },
  ];
  for (const entry of packageFiles) {
    writeFile(
      repoRoot,
      entry.packagePath,
      `${JSON.stringify({
        name: entry.packagePath,
        version: entry.version,
      })}\n`,
    );
    writeFile(
      repoRoot,
      entry.authorityPath,
      `// ${entry.version}\n`,
    );
  }
  writeFile(
    repoRoot,
    'node_modules/.prisma/client/schema.prisma',
    'generator client { provider = "prisma-client-js" }\n',
  );
}

function createFixture(unicode = false): ReadinessFixture {
  const parent = tempRoot();
  const repoRoot = path.join(
    parent,
    unicode
      ? 'repository with spaces שלום'
      : 'repository',
  );
  const remoteRoot = path.join(
    parent,
    unicode ? 'remote Ω.git' : 'remote.git',
  );
  fs.mkdirSync(repoRoot, { recursive: true });
  git(repoRoot, ['init', '-b', BRANCH]);
  git(repoRoot, [
    'config',
    'user.email',
    'fixture@example.test',
  ]);
  git(repoRoot, [
    'config',
    'user.name',
    'Readiness Fixture',
  ]);
  writeFile(
    repoRoot,
    '.gitignore',
    'node_modules/\noutputs/\n',
  );
  writeFile(
    repoRoot,
    'stories/readiness_fixture.md',
    fixtureStory(),
  );
  createDependencyAuthority(repoRoot);
  git(repoRoot, [
    'add',
    '.gitignore',
    'package.json',
    'package-lock.json',
    'stories/readiness_fixture.md',
  ]);
  git(repoRoot, ['commit', '-m', 'fixture']);
  git(parent, ['init', '--bare', remoteRoot]);
  git(repoRoot, ['remote', 'add', 'origin', remoteRoot]);
  git(repoRoot, ['push', '-u', 'origin', BRANCH]);
  const canonicalRoot = fs.realpathSync(repoRoot);
  return {
    parent,
    repoRoot: canonicalRoot,
    remoteRoot,
    input: {
      repoRoot: canonicalRoot,
      outputRoot: OUTPUT_ROOT,
      storySourceKey: 'readiness_fixture',
      storySourcePath: 'stories/readiness_fixture.md',
      requestId: 'readiness-fixture-001',
      requestedAt: REQUESTED_AT,
      credentialSourcePath: path.join(
        parent,
        unicode
          ? 'opaque credential source סודי.env'
          : 'opaque-credential-source.env',
      ),
    },
    launchAuthority: {
      npmCliSha256: 'a'.repeat(64),
      offlineInstallCompleted: true,
      prismaGenerationCompleted: true,
    },
  };
}

function workingTreeSnapshot(root: string): string {
  const records: Array<{
    path: string;
    bytes: number;
    sha256: string;
  }> = [];
  const visit = (directory: string): void => {
    for (const name of fs.readdirSync(directory).sort()) {
      if (name === '.git') continue;
      const absolutePath = path.join(directory, name);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isDirectory()) {
        visit(absolutePath);
      } else {
        const bytes = fs.readFileSync(absolutePath);
        records.push({
          path: path
            .relative(root, absolutePath)
            .split(path.sep)
            .join('/'),
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      }
    }
  };
  visit(root);
  return JSON.stringify(records);
}

function prepare(fixture: ReadinessFixture) {
  return prepareCanonicalPreLiveReadiness({
    input: fixture.input,
    launchAuthority: fixture.launchAuthority,
  });
}

function verify(fixture: ReadinessFixture) {
  return verifyCanonicalPreLiveReadiness({
    input: fixture.input,
    launchAuthority: fixture.launchAuthority,
  });
}

function publicTokens(
  input: CanonicalPreLiveReadinessInput,
  mode: 'prepare' | 'verify',
): string[] {
  return [
    mode,
    '--repo-root',
    input.repoRoot,
    '--output-root',
    input.outputRoot,
    '--story-source-key',
    input.storySourceKey,
    '--story-source-path',
    input.storySourcePath,
    '--request-id',
    input.requestId,
    '--requested-at',
    input.requestedAt,
    '--credential-source-path',
    input.credentialSourcePath,
  ];
}

function privateEntry(
  fixture: ReadinessFixture,
  options: {
    mode?: 'prepare' | 'verify';
    positiveControl?: string;
  } = {},
) {
  const capability = 'b'.repeat(64);
  return spawnSync(
    process.execPath,
    [
      TSX,
      '--require',
      SHIM,
      '--require',
      SENTINEL,
      ENTRY,
      ...publicTokens(
        fixture.input,
        options.mode ?? 'prepare',
      ),
      INTERNAL_CAPABILITY_FLAG,
      capability,
    ],
    {
      cwd: REPO,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        TSX_DISABLE_CACHE: '1',
        [INTERNAL_CAPABILITY_ENV]: capability,
        [INTERNAL_NPM_DIGEST_ENV]:
          fixture.launchAuthority.npmCliSha256,
        [INTERNAL_INSTALL_ENV]: '1',
        [INTERNAL_PRISMA_ENV]: '1',
        CANONICAL_PRE_LIVE_DENIED_CREDENTIAL_PATH:
          fixture.input.credentialSourcePath,
        CANONICAL_PRE_LIVE_ALLOWED_OUTPUT_ROOT:
          path.join(
            fixture.repoRoot,
            fixture.input.outputRoot,
          ),
        ...(options.positiveControl
          ? {
              CANONICAL_PRE_LIVE_SENTINEL_POSITIVE_CONTROL:
                options.positiveControl,
            }
          : {}),
      },
    },
  );
}

function injectedGitResult(
  commandId:
    | 'repository_top_level'
    | 'symbolic_branch'
    | 'upstream_ref'
    | 'head_commit'
    | 'upstream_head_commit'
    | 'divergence'
    | 'worktree_status'
    | 'output_root_ignore',
  repositoryRealPath: string,
): {
  status: number;
  signal: null;
  stdout: string;
  stderr: string;
} {
  const commit = 'a'.repeat(40);
  const stdout = {
    repository_top_level: repositoryRealPath,
    symbolic_branch: BRANCH,
    upstream_ref: `refs/remotes/origin/${BRANCH}`,
    head_commit: commit,
    upstream_head_commit: commit,
    divergence: '0 0',
    worktree_status: '',
    output_root_ignore: '',
  }[commandId];
  return {
    status: 0,
    signal: null,
    stdout: `${stdout}${stdout.length > 0 ? '\n' : ''}`,
    stderr: '',
  };
}

describe('canonical pre-live readiness orchestrator', () => {
  it('composes the existing Writer, B0, Execution Request, and Supervisor authorities into ready evidence', () => {
    const fixture = createFixture(true);
    const result = prepare(fixture);

    expect(result, JSON.stringify(result, null, 2)).toMatchObject({
      version:
        CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION,
      status: 'ready_for_spend_gate',
      pricingAuthority: 'not_checked',
      canonicalPreflight: 'not_run',
      credentialAccess: 'none',
      providerCalls: 0,
      liveAuthority: 'none',
      request: {
        requestId: fixture.input.requestId,
        requestedAt: fixture.input.requestedAt,
        storySourceKey: fixture.input.storySourceKey,
        storySourcePath: fixture.input.storySourcePath,
        outputRoot: fixture.input.outputRoot,
        childRequestIds: {
          b0: `${fixture.input.requestId}:b0`,
          execution: `${fixture.input.requestId}:execution`,
        },
      },
      repositoryAuthority: {
        branchRef: `refs/heads/${BRANCH}`,
        upstreamRef: `refs/remotes/origin/${BRANCH}`,
        ahead: 0,
        behind: 0,
      },
      canonicalAuthorities: {
        b0: {
          verificationVersion:
            'canonical-live-request-verification/v44',
          structuredOutputCompatibility: {
            schemaName: 'BookVisualContractTemplateDraft',
            schemaVersion: 'vc-draft-schema/v18',
            compatibility: {
              profileVersion:
                OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
              profileDigest:
                OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST,
              evidenceVersion:
                OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION,
              status: 'compatible',
            },
          },
          compactRepairStructuredOutputCompatibility: {
            schemaName: 'SourceEvidenceIdRepairPatches',
            compatibility: {
              status: 'compatible',
            },
          },
          pageContractRepairStructuredOutputCompatibility: {
            schemaName: 'PageContractRepairPatches',
            compatibility: {
              status: 'compatible',
            },
          },
          bookSurfaceRepairStructuredOutputCompatibility: {
            schemaName: 'BookSurfaceRepairPatch',
            compatibility: {
              status: 'compatible',
            },
          },
          requestPolicy: {
            standardAttemptOutputBudget: {
              limits: [40_000, 32_000, 36_000, 24_000, 24_000, 24_000, 24_000],
              totalPool: 204_000,
            },
            projectedMaxUsd: 9.9275,
            hardCeilingUsd: 10,
          },
        },
        supervisorVerification: {
          version:
            'canonical-live-execution-readiness/v42',
        },
      },
    });
    if (result.status !== 'ready_for_spend_gate') {
      throw new Error('fixture preparation failed');
    }
    expect(
      result.canonicalAuthorities.b0
        .structuredOutputCompatibility.compatibility
        .serializedSchemaDigest,
    ).toEqual(
      result.canonicalAuthorities.b0
        .structuredOutputCompatibility.schemaDigest,
    );
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain(
      fixture.input.credentialSourcePath,
    );
    const evidencePath =
      canonicalPreLiveReadinessArtifactPath({
        outputRoot: fixture.input.outputRoot,
        result,
      });
    expect(evidencePath).toBe(
      `${OUTPUT_ROOT}/${CANONICAL_PRE_LIVE_READINESS_EVIDENCE_CATEGORY}/${result.digest}.json`,
    );
    expect(
      fs.readFileSync(
        path.join(fixture.repoRoot, evidencePath),
        'utf8',
      ),
    ).toContain(result.digest);
    expect(
      git(fixture.repoRoot, ['status', '--porcelain']),
    ).toBe('');
  });

  it('integrates the private-entry Git diagnostic without raw data or later work', () => {
    const fixture = createFixture();
    const repositoryRealPath = fs.realpathSync(
      fixture.repoRoot,
    );
    const commandIds: string[] = [];
    let writeCalls = 0;
    const result = prepareCanonicalPreLiveReadiness({
      input: fixture.input,
      launchAuthority: fixture.launchAuthority,
      dependencies: {
        gitResultProvider: ({ commandId }) => {
          commandIds.push(commandId);
          if (commandId === 'upstream_head_commit') {
            return {
              status: 128,
              signal: null,
              stdout: 'raw stdout C:\\private\\repo',
              stderr:
                'fatal: detected dubious ownership; configure safe.directory fake-secret',
            };
          }
          return injectedGitResult(
            commandId,
            repositoryRealPath,
          );
        },
        writeMaterializationInput: () => {
          writeCalls += 1;
          throw new Error('write must be unreachable');
        },
      },
    });
    expect(result).toMatchObject({
      version: CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION,
      status: 'rejected',
      phase: 'topology',
      reasonCodes: ['pre_live_topology_git_rejected'],
      gitDiagnostic: {
        profile: 'private_entry',
        commandId: 'upstream_head_commit',
        failureClass: 'nonzero_exit',
        exitStatus: 128,
        signalClass: 'none',
        errorClass: 'none',
        stderrClass: 'safe_directory',
        stdoutBytes: 26,
        stderrBytes: 71,
      },
      credentialAccess: 'none',
      providerCalls: 0,
      canonicalPreflight: 'not_run',
      pricingAuthority: 'not_checked',
      liveAuthority: 'none',
    });
    expect(commandIds).toEqual([
      'repository_top_level',
      'symbolic_branch',
      'upstream_ref',
      'head_commit',
      'upstream_head_commit',
    ]);
    expect(writeCalls).toBe(0);
    const serialized = JSON.stringify(result);
    for (const rejected of [
      'raw stdout',
      'C:\\private\\repo',
      'dubious ownership',
      'safe.directory',
      'fake-secret',
    ]) {
      expect(serialized).not.toContain(rejected);
    }
    expect(
      inspectCanonicalPreLiveReadinessFailure(result),
    ).toMatchObject({ authority: 'current' });
    expect(
      canonicalPreLiveReadinessFailureIssues(result),
    ).toEqual([]);
    if (result.status !== 'rejected') {
      throw new Error('expected failure fixture');
    }
    const diagnostic = result.gitDiagnostic!;
    const malformedDiagnostics = [
      { ...diagnostic, profile: 'arbitrary_profile' },
      { ...diagnostic, commandId: 'git status --raw' },
      { ...diagnostic, failureClass: null },
      { ...diagnostic, failureClass: 'raw_failure' },
      { ...diagnostic, exitStatus: 256 },
      { ...diagnostic, signalClass: 'SIGSEGV' },
      { ...diagnostic, errorClass: 'raw_error' },
      { ...diagnostic, stderrClass: 'raw stderr' },
      { ...diagnostic, stdoutBytes: 65_538 },
      { ...diagnostic, stderrBytes: -1 },
      { ...diagnostic, rawMessage: 'fake-secret' },
    ];
    for (const malformedDiagnostic of malformedDiagnostics) {
      expect(() =>
        buildCanonicalPreLiveReadinessFailure({
          mode: 'prepare',
          phase: 'topology',
          reasonCodes: ['pre_live_topology_git_rejected'],
          gitDiagnostic: malformedDiagnostic as never,
        }),
      ).toThrow('pre_live_git_diagnostic_invalid');
    }
  });

  it('rejects immediate-predecessor B0 and Supervisor verification envelopes despite successful statuses', () => {
    const priorB0 = createFixture();
    const b0Result = prepareCanonicalPreLiveReadiness({
      input: priorB0.input,
      launchAuthority: priorB0.launchAuthority,
      dependencies: {
        verifyB0: (args) =>
          ({
            ...verifyCanonicalLiveRequestBundle(args),
            version: 'canonical-live-request-verification/v42',
          }) as unknown as ReturnType<
            typeof verifyCanonicalLiveRequestBundle
          >,
      },
    });
    expect(b0Result).toMatchObject({
      status: 'rejected',
      phase: 'b0_verification',
      reasonCodes: ['pre_live_b0_verification_rejected'],
    });

    const priorSupervisor = createFixture();
    const supervisorResult = prepareCanonicalPreLiveReadiness({
      input: priorSupervisor.input,
      launchAuthority: priorSupervisor.launchAuthority,
      dependencies: {
        verifyExecution: (args) =>
          ({
            ...verifyCanonicalLiveExecution(args),
            version: 'canonical-live-execution-readiness/v41',
          }) as unknown as ReturnType<
            typeof verifyCanonicalLiveExecution
          >,
      },
    });
    expect(supervisorResult).toMatchObject({
      status: 'rejected',
      phase: 'supervisor_verification',
      reasonCodes: [
        'pre_live_supervisor_verification_rejected',
      ],
    });
  }, 15_000);

  it('reads immutable v2 failure bytes only as historical evidence', () => {
    const bytes = fs.readFileSync(HISTORICAL_FAILURE_V2);
    expect(sha256(bytes)).toBe(
      '53ed113572a0d4f971dac7d20c424b498ca7646f7bee8261d8fd66de6b7141ba',
    );
    const failure = JSON.parse(
      bytes.toString('utf8'),
    ) as unknown;
    expect(
      inspectCanonicalPreLiveReadinessFailure(failure),
    ).toMatchObject({
      authority: 'historical_evidence',
      failure: {
        version:
          CANONICAL_PRE_LIVE_READINESS_HISTORICAL_FAILURE_VERSION,
        digest:
          'aa9a75d8b07b8706dcaf9cae440b2770a1d5e5c671ef703ab2ee803bda9fd59f',
      },
    });
    expect(
      canonicalPreLiveReadinessFailureIssues(failure),
    ).toContain('pre_live_failure_version_not_current');
    expect(
      canonicalPreLiveReadinessFailureIssues(failure, {
        allowHistorical: true,
      }),
    ).toEqual([]);
  });

  it('is byte-idempotent on replay and verify is write-free', () => {
    const fixture = createFixture();
    const first = prepare(fixture);
    expect(first.status, JSON.stringify(first, null, 2)).toBe(
      'ready_for_spend_gate',
    );
    const afterFirst = workingTreeSnapshot(
      fixture.repoRoot,
    );

    const replay = prepare(fixture);
    expect(replay).toEqual(first);
    expect(workingTreeSnapshot(fixture.repoRoot)).toBe(
      afterFirst,
    );

    const beforeVerify = workingTreeSnapshot(
      fixture.repoRoot,
    );
    const verified = verify(fixture);
    expect(verified).toEqual(first);
    expect(workingTreeSnapshot(fixture.repoRoot)).toBe(
      beforeVerify,
    );
  }, 30_000);

  it('rejects redigested immediately prior pre-live readiness evidence as current authority', () => {
    const fixture = createFixture();
    const current = prepare(fixture);
    expect(current.status).toBe('ready_for_spend_gate');
    const prior = structuredClone(current) as unknown as Record<string, unknown>;
    prior.version = 'canonical-pre-live-readiness-evidence/v41';
    const {
      digestAlgorithm: _algorithm,
      digest: _digest,
      ...payload
    } = prior;
    const redigested = {
      ...payload,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(payload),
    };

    expect(() =>
      assertValidCanonicalPreLiveReadinessEvidence(redigested),
    ).toThrow(/pre_live_evidence_rejected/);
  });

  it('rejects redigested Fresh Readiness evidence with a tampered per-attempt output schedule', () => {
    const fixture = createFixture();
    const current = prepare(fixture);
    if (current.status !== 'ready_for_spend_gate') {
      throw new Error('expected current readiness evidence');
    }
    const tampered = structuredClone(current);
    const limits = tampered.canonicalAuthorities.b0.requestPolicy
      .standardAttemptOutputBudget.limits as unknown as number[];
    limits[0] = limits[0]! + 1;
    const {
      digestAlgorithm: _algorithm,
      digest: _digest,
      ...payload
    } = tampered;
    expect(() =>
      assertValidCanonicalPreLiveReadinessEvidence({
        ...payload,
        digestAlgorithm: 'canonical-json-sha256',
        digest: canonicalJsonDigest(payload),
      }),
    ).toThrow(/pre_live_evidence_rejected/);
  });

  it('fails closed on immutable evidence collision without overwriting it', () => {
    const fixture = createFixture();
    const first = prepare(fixture);
    expect(first.status, JSON.stringify(first, null, 2)).toBe(
      'ready_for_spend_gate',
    );
    const evidencePath = path.join(
      fixture.repoRoot,
      canonicalPreLiveReadinessArtifactPath({
        outputRoot: fixture.input.outputRoot,
        result: first,
      }),
    );
    const drifted = fs
      .readFileSync(evidencePath, 'utf8')
      .replace(
        '"pricingAuthority": "not_checked"',
        '"pricingAuthority": "changed"',
      );
    fs.writeFileSync(evidencePath, drifted, 'utf8');

    const replay = prepare(fixture);
    expect(replay).toMatchObject({
      version:
        CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION,
      status: 'rejected',
      mode: 'prepare',
      phase: 'evidence',
      reasonCodes: [
        'pre_live_evidence_persistence_rejected',
      ],
    });
    expect(fs.readFileSync(evidencePath, 'utf8')).toBe(
      drifted,
    );
    const failurePath = path.join(
      fixture.repoRoot,
      fixture.input.outputRoot,
      CANONICAL_PRE_LIVE_READINESS_FAILURE_CATEGORY,
      `${replay.digest}.json`,
    );
    expect(fs.existsSync(failurePath)).toBe(true);
  }, 30_000);

  it('makes one attempt per phase and can resume safely after local correction', () => {
    const fixture = createFixture();
    let materializationCalls = 0;
    const failed =
      prepareCanonicalPreLiveReadiness({
        input: fixture.input,
        launchAuthority: fixture.launchAuthority,
        dependencies: {
          materializeB0: () => {
            materializationCalls += 1;
            throw new Error(
              'raw exception and command output must be sanitized',
            );
          },
        },
      });
    expect(materializationCalls).toBe(1);
    expect(failed).toMatchObject({
      version:
        CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION,
      status: 'rejected',
      phase: 'b0_materialization',
      reasonCodes: [
        'pre_live_b0_materialization_rejected',
      ],
    });
    expect(JSON.stringify(failed)).not.toContain(
      'raw exception',
    );
    const sourceInputDirectory = path.join(
      fixture.repoRoot,
      fixture.input.outputRoot,
      'materialization-inputs',
      'canonical-materialization-inputs',
      'source-authoring-live-request',
    );
    expect(fs.readdirSync(sourceInputDirectory)).toHaveLength(
      1,
    );

    const corrected = prepare(fixture);
    expect(corrected.status).toBe(
      'ready_for_spend_gate',
    );
    expect(fs.readdirSync(sourceInputDirectory)).toHaveLength(
      1,
    );
  });

  it('verify rejects B0, Execution Request, dependency, and topology drift without writing', () => {
    const cases = [
      'b0',
      'execution',
      'dependency',
      'topology',
    ] as const;
    for (const drift of cases) {
      const fixture = createFixture();
      const prepared = prepare(fixture);
      expect(
        prepared.status,
        JSON.stringify(prepared, null, 2),
      ).toBe(
        'ready_for_spend_gate',
      );
      if (prepared.status !== 'ready_for_spend_gate') {
        throw new Error('fixture preparation failed');
      }
      if (drift === 'b0') {
        const manifestPath =
          prepared.canonicalAuthorities.b0.manifestPath;
        fs.appendFileSync(
          path.join(fixture.repoRoot, manifestPath),
          ' ',
          'utf8',
        );
      } else if (drift === 'execution') {
        fs.appendFileSync(
          path.join(
            fixture.repoRoot,
            prepared.canonicalAuthorities.executionRequest
              .path,
          ),
          ' ',
          'utf8',
        );
      } else if (drift === 'dependency') {
        fs.appendFileSync(
          path.join(
            fixture.repoRoot,
            'node_modules/tsx/dist/cli.mjs',
          ),
          '// drift\n',
          'utf8',
        );
      } else {
        git(fixture.repoRoot, [
          'update-ref',
          `refs/remotes/origin/${BRANCH}`,
          'HEAD~0',
        ]);
        writeFile(
          fixture.repoRoot,
          'tracked-drift.txt',
          'drift\n',
        );
      }
      const before = workingTreeSnapshot(
        fixture.repoRoot,
      );
      const result = verify(fixture);
      expect(result.status).toBe('rejected');
      expect(result.version).toBe(
        CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION,
      );
      expect(workingTreeSnapshot(fixture.repoRoot)).toBe(
        before,
      );
    }
  }, 30_000);

  it('requires a clean non-main branch with a same-name origin upstream at exact parity before writes', () => {
    for (const rejection of [
      'missing-upstream',
      'different-upstream',
      'dirty',
      'ahead',
    ] as const) {
      const fixture = createFixture();
      if (rejection === 'missing-upstream') {
        git(fixture.repoRoot, [
          'branch',
          '--unset-upstream',
        ]);
      } else if (rejection === 'different-upstream') {
        git(fixture.repoRoot, [
          'branch',
          '--set-upstream-to',
          `origin/${BRANCH}`,
        ]);
        git(fixture.repoRoot, [
          'update-ref',
          'refs/remotes/origin/different-branch',
          'HEAD',
        ]);
        git(fixture.repoRoot, [
          'branch',
          '--set-upstream-to',
          'origin/different-branch',
        ]);
      } else if (rejection === 'dirty') {
        writeFile(
          fixture.repoRoot,
          'untracked.txt',
          'dirty\n',
        );
      } else {
        writeFile(
          fixture.repoRoot,
          'ahead.txt',
          'ahead\n',
        );
        git(fixture.repoRoot, ['add', 'ahead.txt']);
        git(fixture.repoRoot, [
          'commit',
          '-m',
          'local ahead',
        ]);
      }
      const result = prepare(fixture);
      expect(result).toMatchObject({
        status: 'rejected',
        phase: 'topology',
      });
      expect(
        fs.existsSync(
          path.join(
            fixture.repoRoot,
            fixture.input.outputRoot,
          ),
        ),
      ).toBe(false);
    }
  }, 30_000);

  it('runs the real private entry under credential, provider, network, child, and write sentinels with positive controls', () => {
    const fixture = createFixture(true);
    const direct = spawnSync(
      process.execPath,
      [
        TSX,
        '--require',
        SHIM,
        ENTRY,
        ...publicTokens(fixture.input, 'prepare'),
      ],
      {
        cwd: REPO,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          TSX_DISABLE_CACHE: '1',
        },
      },
    );
    expect(direct.status).toBe(1);
    expect(
      JSON.parse(direct.stdout) as {
        phase: string;
        reasonCodes: string[];
      },
    ).toMatchObject({
      phase: 'launcher',
      reasonCodes: ['pre_live_private_entry_rejected'],
    });
    expect(direct.stdout).not.toContain(
      fixture.input.credentialSourcePath,
    );

    const success = privateEntry(fixture);
    expect(
      success.status,
      `${success.stdout}\n${success.stderr}`,
    ).toBe(0);
    expect(
      JSON.parse(success.stdout) as { status: string },
    ).toMatchObject({
      status: 'ready_for_spend_gate',
    });
    expect(success.stdout).not.toContain(
      fixture.input.credentialSourcePath,
    );

    for (const control of [
      'credential_exists',
      'credential_stat',
      'credential_lstat',
      'credential_realpath',
      'credential_open',
      'credential_read',
      'provider',
      'database',
      'storage',
      'network',
      'preflight',
      'live_child',
      'write',
    ]) {
      const controlledFixture = createFixture();
      const result = privateEntry(controlledFixture, {
        positiveControl: control,
      });
      expect(result.status).not.toBe(0);
      expect(
        `${result.stdout}${result.stderr}`,
      ).toMatch(
        /TEST_(?:CANONICAL_PRE_LIVE_READINESS|NETWORK)_SENTINEL/,
      );
    }
  }, 60_000);

  it('keeps selected story, child, companion, page, prop, and reveal literals out of shared production code', () => {
    const files = [
      'lib/visual-package/canonicalPreLiveReadiness.ts',
      'scripts/canonical-pre-live-readiness-entry.ts',
      'scripts/canonical-pre-live-readiness.cjs',
      'scripts/lib/canonical-pre-live-readiness-launcher.cjs',
    ];
    const text = files
      .map((file) =>
        fs.readFileSync(path.join(REPO, file), 'utf8'),
      )
      .join('\n')
      .toLowerCase();
    for (const literal of [
      'fox_uri',
      'lion_shaket',
      'baby_dragon',
      'broken_crayon',
      'home-night',
      'page 1',
      'reveal:',
    ]) {
      expect(text).not.toContain(literal);
    }
  });

  it('derives only neutral output and absence paths', () => {
    const fixture = createFixture();
    const derived =
      CANONICAL_PRE_LIVE_READINESS_PRIVATE_TESTING.layout(
        fixture.input,
      );
    expect(derived).toEqual({
      inputRoot: `${OUTPUT_ROOT}/materialization-inputs`,
      b0Root: `${OUTPUT_ROOT}/b0`,
      executionRoot: `${OUTPUT_ROOT}/execution`,
      expectedAbsentPaths: [
        `${OUTPUT_ROOT}/b0/authoring-receipts`,
        `${OUTPUT_ROOT}/b0/contract-candidates`,
        `${OUTPUT_ROOT}/b0/provider-call-failure-evidence`,
        `${OUTPUT_ROOT}/b0/readiness-evidence`,
        `${OUTPUT_ROOT}/b0/rejected-authoring-requests`,
      ],
    });
  });
});
