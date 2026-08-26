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

import {
  CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
  CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_RESULT_VERSION,
  LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
  assertValidCanonicalLiveExecutionRequestMaterializationInput,
  canonicalLiveExecutionRequestMaterializationInputIssues,
  canonicalLiveExecutionRequestMaterializationRejection,
  canonicalLiveExecutionExpectedAbsentPaths,
  canonicalJsonDigest,
  materializeCanonicalLiveExecutionRequest,
  materializeCanonicalLiveRequestBundle,
  verifyCanonicalLiveExecution,
  verifyCanonicalLiveRequestBundle,
  writeCanonicalMaterializationInput,
  type CanonicalLiveExecutionRequest,
  type CanonicalLiveExecutionRequestMaterializationDependencies,
  type CanonicalLiveExecutionRequestMaterializationInput,
  type LiveRequestMaterializationInput,
} from '@/lib/visual-package';
import {
  canonicalLiveAuthoringJsonBytes,
} from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';

const REPO = process.cwd();
const MATERIALIZER = path.join(
  REPO,
  'scripts',
  'canonical-live-execution-request-materialize.cjs',
);
const MATERIALIZER_ENTRY = path.join(
  REPO,
  'scripts',
  'canonical-live-execution-request-materialize-entry.ts',
);
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
const SENTINEL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'deny-live-execution-request-materialization-boundaries.cjs',
);
const BRANCH = 'codex/materialization-fixture';
const BRANCH_REF = `refs/heads/${BRANCH}`;
const UPSTREAM_REF = `refs/remotes/origin/${BRANCH}`;
const REQUESTED_AT = '2026-07-30T09:00:00.000Z';
const MATERIALIZATION_INPUT_OUTPUT_DIR =
  'outputs/execution-materialization/input-artifacts';
const MATERIALIZATION_OUTPUT_DIR =
  'outputs/execution-materialization/result';
const tempRoots: string[] = [];
const require = createRequire(import.meta.url);

interface MaterializationFixture {
  parent: string;
  repoRoot: string;
  remoteRoot: string;
  head: string;
  manifestPath: string;
  manifestDigest: string;
  preservationPath: string;
  expectedAbsentPath: string;
  expectedAbsentPaths: string[];
  credentialPath: string;
  input: CanonicalLiveExecutionRequestMaterializationInput;
  inputPath: string;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(
  prefix = 'canonical-execution-request-materialization-',
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function git(
  cwd: string,
  argv: string[],
): string {
  const result = spawnSync('git', argv, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `git fixture command failed: ${argv.join(' ')}\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function sha256(bytes: Buffer | string): string {
  return crypto
    .createHash('sha256')
    .update(bytes)
    .digest('hex');
}

function writeCanonical(
  absolutePath: string,
  value: unknown,
): void {
  fs.mkdirSync(path.dirname(absolutePath), {
    recursive: true,
  });
  fs.writeFileSync(
    absolutePath,
    canonicalLiveAuthoringJsonBytes(value),
    'utf8',
  );
}

function fixtureStory(): string {
  return [
    '---',
    'title: "Materialization fixture"',
    'gender: male',
    'pages: 12',
    '---',
    '',
    ...Array.from({ length: 12 }, (_, index) => index + 1)
      .flatMap((pageNumber) => [
        `--- Page ${pageNumber} ---`,
        `A young planner studies a workshop map on page ${pageNumber} and chooses a careful next step.`,
        '',
        `imageDirection: A neutral workshop view for page ${pageNumber}, with the shared map visible.`,
        '',
      ]),
  ].join('\n');
}

function writeMaterializationInput(
  fixture: MaterializationFixture,
  input = fixture.input,
): string {
  fixture.input = input;
  const result = writeCanonicalMaterializationInput({
    mode: 'canonical-live-execution-request',
    repoRoot: fixture.repoRoot,
    outputDir: MATERIALIZATION_INPUT_OUTPUT_DIR,
    requestId: input.requestId,
    requestedAt: input.requestedAt,
    manifestPath: input.manifestPath,
    materializationOutputDir: input.outputDir,
    preservationPaths: input.preservationPaths,
    expectedAbsentPaths: input.expectedAbsentPaths,
    credentialSourcePath: input.credentialSourcePath,
  });
  fixture.inputPath = result.artifact.path;
  return result.artifact.path;
}

function createFixture(
  unicodePath = false,
): MaterializationFixture {
  const parent = tempRoot();
  const repoRoot = path.join(
    parent,
    unicodePath
      ? 'repository with spaces ×©×œ×•×'
      : 'repository',
  );
  const remoteRoot = path.join(
    parent,
    unicodePath ? 'bare remote Î©.git' : 'remote.git',
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
    'Materialization Fixture',
  ]);
  fs.writeFileSync(
    path.join(repoRoot, '.gitignore'),
    'outputs/\n',
    'utf8',
  );
  const storyPath = 'stories/materialization_fixture.md';
  fs.mkdirSync(path.join(repoRoot, 'stories'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(repoRoot, storyPath),
    fixtureStory(),
    'utf8',
  );
  git(repoRoot, ['add', '.gitignore', storyPath]);
  git(repoRoot, ['commit', '-m', 'fixture']);
  git(parent, ['init', '--bare', remoteRoot]);
  git(repoRoot, ['remote', 'add', 'origin', remoteRoot]);
  git(repoRoot, ['push', '-u', 'origin', BRANCH]);
  const head = git(repoRoot, ['rev-parse', 'HEAD']);
  const canonicalRepoRoot = fs.realpathSync(repoRoot);

  const b0Input: LiveRequestMaterializationInput = {
    version: LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
    repoRoot: canonicalRepoRoot,
    storyKey: 'materialization_fixture',
    storyPath,
    requestId: 'materialization-b0-request-001',
    requestedAt: REQUESTED_AT,
  };
  const b0InputPath = writeCanonicalMaterializationInput({
    mode: 'source-authoring-live-request',
    repoRoot,
    outputDir: 'outputs/b0/input-artifacts',
    storyKey: b0Input.storyKey,
    storyPath: b0Input.storyPath,
    requestId: b0Input.requestId,
    requestedAt: b0Input.requestedAt,
  }).artifact.path;
  const materialized = materializeCanonicalLiveRequestBundle({
    repoRoot,
    requestPath: b0InputPath,
    outputDir: 'outputs/b0/live-request',
  });
  const preservationPath =
    'outputs/preservation/exact-control.bin';
  fs.mkdirSync(
    path.dirname(path.join(repoRoot, preservationPath)),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(repoRoot, preservationPath),
    Buffer.from('preserve exact materialization bytes\n', 'utf8'),
  );
  const expectedAbsentPath =
    'outputs/b0/live-request/contract-candidates';
  const expectedAbsentPaths =
    canonicalLiveExecutionExpectedAbsentPaths(
      'outputs/b0/live-request',
    );
  const credentialPath = path.join(
    parent,
    unicodePath
      ? 'credential source ×¡×•×“×™.env'
      : 'credential-source.env',
  );
  const input: CanonicalLiveExecutionRequestMaterializationInput =
    {
      version:
        CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
      requestId: 'execution-materialization-request-001',
      requestedAt: REQUESTED_AT,
      manifestPath:
        materialized.persistence.manifest.path,
      outputDir: MATERIALIZATION_OUTPUT_DIR,
      preservationPaths: [preservationPath],
      expectedAbsentPaths,
      credentialSourcePath: credentialPath,
    };
  const fixture: MaterializationFixture = {
    parent,
    repoRoot: canonicalRepoRoot,
    remoteRoot,
    head,
    manifestPath: materialized.persistence.manifest.path,
    manifestDigest: materialized.persistence.manifest.digest,
    preservationPath,
    expectedAbsentPath,
    expectedAbsentPaths,
    credentialPath,
    input,
    inputPath: '',
  };
  writeMaterializationInput(fixture);
  return fixture;
}

function requestPathFromDigest(digest: string): string {
  return `${MATERIALIZATION_OUTPUT_DIR}/canonical-live-execution-requests/${digest}.json`;
}

function readRequest(
  fixture: MaterializationFixture,
  requestPath: string,
): CanonicalLiveExecutionRequest {
  return JSON.parse(
    fs.readFileSync(
      path.join(fixture.repoRoot, requestPath),
      'utf8',
    ),
  ) as CanonicalLiveExecutionRequest;
}

function materializationOutputFiles(
  fixture: MaterializationFixture,
): string[] {
  const directory = path.join(
    fixture.repoRoot,
    MATERIALIZATION_OUTPUT_DIR,
    'canonical-live-execution-requests',
  );
  return fs.existsSync(directory)
    ? fs.readdirSync(directory).sort()
    : [];
}

function rejectionFor(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return canonicalLiveExecutionRequestMaterializationRejection(
      error,
    );
  }
  throw new Error('expected materialization rejection');
}

describe('canonical live execution request materialization', () => {
  it('derives Git, verified B0, preservation, credential policy, and exact future command into canonical bytes', () => {
    const fixture = createFixture(true);
    const result = materializeCanonicalLiveExecutionRequest({
      repoRoot: fixture.repoRoot,
      inputPath: fixture.inputPath,
    });

    expect(
      CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
    ).toBe(
      'canonical-live-execution-request-materialization-input/v37',
    );
    expect(
      CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_RESULT_VERSION,
    ).toBe(
      'canonical-live-execution-request-materialization-result/v42',
    );
    expect(result).toMatchObject({
      version:
        CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_RESULT_VERSION,
      status: 'materialized',
      request: { created: true },
      verification: { status: 'ready' },
      externalBoundaryEvidence: {
        canonicalPreflightRuns: 0,
        credentialReadsOrChecks: 0,
        providerCalls: 0,
        networkCalls: 0,
        externalStorageWrites: 0,
        databaseWrites: 0,
      },
    });
    expect(result.request.path).toBe(
      requestPathFromDigest(result.request.digest),
    );
    const request = readRequest(
      fixture,
      result.request.path,
    );
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(fixture.repoRoot, fixture.manifestPath),
        'utf8',
      ),
    ) as {
      futureLiveCommand: {
        executable: string;
        arguments: string[];
      };
      structuredOutputCompatibility:
        typeof request.canonicalBundle.structuredOutputCompatibility;
      compactRepairStructuredOutputCompatibility:
        typeof request.canonicalBundle.compactRepairStructuredOutputCompatibility;
      pageContractRepairStructuredOutputCompatibility:
        typeof request.canonicalBundle.pageContractRepairStructuredOutputCompatibility;
      representedElsewhereRepairStructuredOutputCompatibility:
        typeof request.canonicalBundle.representedElsewhereRepairStructuredOutputCompatibility;
      pageSpatialReferenceRepairStructuredOutputCompatibility:
        typeof request.canonicalBundle.pageSpatialReferenceRepairStructuredOutputCompatibility;
      structuralBundleRepairStructuredOutputCompatibility:
        typeof request.canonicalBundle.structuralBundleRepairStructuredOutputCompatibility;
      bookSurfaceRepairStructuredOutputCompatibility:
        typeof request.canonicalBundle.bookSurfaceRepairStructuredOutputCompatibility;
      presentationRequirementRepairStructuredOutputCompatibility:
        typeof request.canonicalBundle.presentationRequirementRepairStructuredOutputCompatibility;
      stablePropScopeRepairStructuredOutputCompatibility:
        typeof request.canonicalBundle.stablePropScopeRepairStructuredOutputCompatibility;
      requestPolicy:
        typeof request.canonicalBundle.requestPolicy;
    };
    expect(request.repository).toEqual({
      realPath: fixture.repoRoot,
      expectedBranch: BRANCH_REF,
      expectedHead: fixture.head,
      expectedTrackedChanges: 0,
      expectedUntrackedChanges: 0,
      refs: [
        {
          name: BRANCH_REF,
          expectedCommit: fixture.head,
        },
        {
          name: UPSTREAM_REF,
          expectedCommit: fixture.head,
        },
      ],
      divergence: [
        {
          localRef: BRANCH_REF,
          upstreamRef: UPSTREAM_REF,
          expectedAhead: 0,
          expectedBehind: 0,
        },
      ],
    });
    expect(request.canonicalBundle).toEqual({
      manifestPath: fixture.manifestPath,
      manifestDigest: fixture.manifestDigest,
      verificationVersion:
        'canonical-live-request-verification/v50',
      structuredOutputCompatibility:
        manifest.structuredOutputCompatibility,
      compactRepairStructuredOutputCompatibility:
        manifest.compactRepairStructuredOutputCompatibility,
      pageContractRepairStructuredOutputCompatibility:
        manifest.pageContractRepairStructuredOutputCompatibility,
      representedElsewhereRepairStructuredOutputCompatibility:
        manifest.representedElsewhereRepairStructuredOutputCompatibility,
      pageSpatialReferenceRepairStructuredOutputCompatibility:
        manifest.pageSpatialReferenceRepairStructuredOutputCompatibility,
      structuralBundleRepairStructuredOutputCompatibility:
        manifest.structuralBundleRepairStructuredOutputCompatibility,
      bookSurfaceRepairStructuredOutputCompatibility:
        manifest.bookSurfaceRepairStructuredOutputCompatibility,
      presentationRequirementRepairStructuredOutputCompatibility:
        manifest.presentationRequirementRepairStructuredOutputCompatibility,
      stablePropScopeRepairStructuredOutputCompatibility:
        manifest.stablePropScopeRepairStructuredOutputCompatibility,
      requestPolicy: manifest.requestPolicy,
    });
    const preserved = fs.readFileSync(
      path.join(fixture.repoRoot, fixture.preservationPath),
    );
    expect(request.preservationFences).toEqual([
      {
        path: fixture.preservationPath,
        byteLength: preserved.length,
        sha256: sha256(preserved),
      },
    ]);
    expect(request.expectedAbsentPaths).toEqual(
      fixture.expectedAbsentPaths,
    );
    expect(request.credentialIsolation).toMatchObject({
      sourcePath: fixture.credentialPath,
      variableName: 'OPENAI_API_KEY',
      assignmentPolicy: 'single-line-start-assignment/v1',
      rejectAmbientCredential: true,
      childEnvironmentPolicy:
        'minimal-platform-allowlist/v1',
    });
    expect(request.futureLiveCommand).toEqual({
      executable: 'node',
      arguments: manifest.futureLiveCommand.arguments,
      identitySha256: canonicalJsonDigest({
        executable: manifest.futureLiveCommand.executable,
        arguments: manifest.futureLiveCommand.arguments,
      }),
    });
    const raw = fs.readFileSync(
      path.join(fixture.repoRoot, result.request.path),
      'utf8',
    );
    expect(raw).toBe(canonicalLiveAuthoringJsonBytes(request));
    expect(request.digest).toBe(result.request.digest);
    expect(
      verifyCanonicalLiveExecution({
        repoRoot: fixture.repoRoot,
        requestPath: result.request.path,
      }),
    ).toMatchObject({
      status: 'ready',
      zeroWrite: true,
      requestDigest: request.digest,
    });
    expect(fs.existsSync(fixture.credentialPath)).toBe(false);
  });

  it('is identical-byte idempotent and rejects a differing same-address collision without overwrite', () => {
    const fixture = createFixture();
    const first = materializeCanonicalLiveExecutionRequest({
      repoRoot: fixture.repoRoot,
      inputPath: fixture.inputPath,
    });
    const absolute = path.join(
      fixture.repoRoot,
      first.request.path,
    );
    const original = fs.readFileSync(absolute);
    const replay = materializeCanonicalLiveExecutionRequest({
      repoRoot: fixture.repoRoot,
      inputPath: fixture.inputPath,
    });
    expect(replay.request).toEqual({
      path: first.request.path,
      digest: first.request.digest,
      created: false,
    });
    expect(fs.readFileSync(absolute)).toEqual(original);

    fs.writeFileSync(
      absolute,
      Buffer.from('different collision bytes\n', 'utf8'),
    );
    const rejection = rejectionFor(() =>
      materializeCanonicalLiveExecutionRequest({
        repoRoot: fixture.repoRoot,
        inputPath: fixture.inputPath,
      }),
    );
    expect(rejection.reasonCodes).toEqual([
      'execution_request_materialization_collision',
    ]);
    expect(fs.readFileSync(absolute, 'utf8')).toBe(
      'different collision bytes\n',
    );
  });

  it('uses fixed Git argv and never accepts expected values, executable, argv, shell, eval, or child environment from input', () => {
    const fixture = createFixture();
    const calls: string[][] = [];
    const runGit: CanonicalLiveExecutionRequestMaterializationDependencies['runGit'] =
      (argv, options) => {
        calls.push(Array.from(argv));
        const result = spawnSync('git', Array.from(argv), {
          cwd: options.cwd,
          env: options.env,
          encoding: 'utf8',
          shell: false,
          windowsHide: true,
        });
        return {
          status: result.status,
          signal: result.signal,
          error: result.error !== undefined,
          stdout:
            typeof result.stdout === 'string'
              ? result.stdout
              : '',
        };
      };
    materializeCanonicalLiveExecutionRequest({
      repoRoot: fixture.repoRoot,
      inputPath: fixture.inputPath,
      dependencies: { runGit },
    });
    expect(calls.map((entry) => entry.slice(3))).toEqual([
      ['rev-parse', '--show-toplevel'],
      ['symbolic-ref', '--quiet', 'HEAD'],
      ['rev-parse', '--verify', 'HEAD^{commit}'],
      [
        'status',
        '--porcelain=v2',
        '--untracked-files=all',
      ],
      [
        'rev-parse',
        '--symbolic-full-name',
        '--verify',
        '@{upstream}',
      ],
      [
        'rev-parse',
        '--verify',
        '--end-of-options',
        `${UPSTREAM_REF}^{commit}`,
      ],
      [
        'rev-list',
        '--left-right',
        '--count',
        '--end-of-options',
        `${BRANCH_REF}...${UPSTREAM_REF}`,
      ],
    ]);
    expect(
      canonicalLiveExecutionRequestMaterializationInputIssues({
        ...fixture.input,
        executable: 'powershell',
        arguments: ['-Command', 'Invoke-Expression'],
        shell: true,
        eval: 'raw',
        childEnvironment: { OPENAI_API_KEY: 'raw-secret' },
        expectedHead: fixture.head,
      }),
    ).toContain(
      'execution_request_materialization_input_fields_invalid',
    );
  });
});

describe('public materializer command and external boundary', () => {
  it('preserves Windows-safe paths with spaces/Unicode and immediately proves the result through supervisor verify', () => {
    const fixture = createFixture(true);
    const result = spawnSync(
      process.execPath,
      [
        MATERIALIZER,
        '--repo-root',
        fixture.repoRoot,
        '--input',
        fixture.inputPath,
      ],
      {
        cwd: REPO,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      },
    );
    expect(result.status).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    const evidence = JSON.parse(result.stdout) as {
      status: string;
      request: { path: string };
      verification: { status: string };
    };
    expect(evidence.status).toBe('materialized');
    expect(evidence.verification.status).toBe('ready');
    expect(
      verifyCanonicalLiveExecution({
        repoRoot: fixture.repoRoot,
        requestPath: evidence.request.path,
      }).status,
    ).toBe('ready');
  });

  it.each([
    ['equals', ['--repo-root=x', '--input', 'x']],
    [
      'duplicate',
      ['--repo-root', 'x', '--repo-root', 'y'],
    ],
    ['unknown', ['--repo-root', 'x', '--request', 'y']],
    ['positional', ['materialize', '--repo-root', 'x']],
    ['missing', ['--repo-root', 'x']],
  ] as const)('strictly rejects %s CLI syntax', (_name, argv) => {
    const result = spawnSync(
      process.execPath,
      [MATERIALIZER, ...argv],
      {
        cwd: REPO,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      },
    );
    expect(result.status).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(
      canonicalLiveExecutionRequestMaterializationRejection(
        'execution_request_materialization_cli_arguments_invalid',
      ),
    );
  });

  it('scrubs ambient credential/routing/arbitrary environment and propagates exact launcher exit/signal dispositions', () => {
    const launcher = require(
      '../../../scripts/lib/canonical-live-execution-request-materialize-launcher.cjs',
    ) as {
      materializerEnvironment(
        env: NodeJS.ProcessEnv,
      ): NodeJS.ProcessEnv;
      canonicalLiveExecutionRequestMaterializerLauncherDisposition(
        result: {
          error?: Error;
          signal?: NodeJS.Signals | null;
          status?: number | null;
        },
      ):
        | { kind: 'exit'; exitCode: number }
        | { kind: 'signal'; signal: NodeJS.Signals };
    };
    const environment = launcher.materializerEnvironment({
      ...process.env,
      OPENAI_API_KEY: 'must-not-cross',
      OPENAI_BASE_URL: 'must-not-cross',
      NODE_OPTIONS: '--require malicious',
      UNRELATED_SECRET: 'must-not-cross',
    });
    expect(environment.OPENAI_API_KEY).toBeUndefined();
    expect(environment.OPENAI_BASE_URL).toBeUndefined();
    expect(environment.NODE_OPTIONS).toBeUndefined();
    expect(environment.UNRELATED_SECRET).toBeUndefined();
    expect(environment.TSX_DISABLE_CACHE).toBe('1');
    expect(
      launcher.canonicalLiveExecutionRequestMaterializerLauncherDisposition(
        { status: 23 },
      ),
    ).toEqual({ kind: 'exit', exitCode: 23 });
    expect(
      launcher.canonicalLiveExecutionRequestMaterializerLauncherDisposition(
        { signal: 'SIGTERM' },
      ),
    ).toEqual({ kind: 'signal', signal: 'SIGTERM' });
    expect(
      launcher.canonicalLiveExecutionRequestMaterializerLauncherDisposition(
        { error: new Error('raw-secret-error') },
      ),
    ).toEqual({ kind: 'exit', exitCode: 1 });
    expect(
      launcher.canonicalLiveExecutionRequestMaterializerLauncherDisposition(
        {},
      ),
    ).toEqual({ kind: 'exit', exitCode: 1 });
  });

  it('runs the real public entry under credential/provider/network/preflight/live/storage/database sentinels with positive controls', () => {
    const fixture = createFixture(true);
    const allowedOutputRoot = path.join(
      fixture.repoRoot,
      MATERIALIZATION_OUTPUT_DIR,
    );
    const baseEnv = {
      ...process.env,
      TSX_DISABLE_CACHE: '1',
      OPENAI_API_KEY: 'ambient-fake-must-not-be-read',
      LIVE_EXECUTION_MATERIALIZATION_DENIED_CREDENTIAL_PATH:
        fixture.credentialPath,
      LIVE_EXECUTION_MATERIALIZATION_ALLOWED_OUTPUT_ROOT:
        allowedOutputRoot,
    };
    const result = spawnSync(
      process.execPath,
      [
        TSX,
        '--require',
        SHIM,
        '--require',
        SENTINEL,
        MATERIALIZER_ENTRY,
        '--repo-root',
        fixture.repoRoot,
        '--input',
        fixture.inputPath,
      ],
      {
        cwd: REPO,
        env: baseEnv,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'materialized',
      verification: { status: 'ready' },
      externalBoundaryEvidence: {
        canonicalPreflightRuns: 0,
        credentialReadsOrChecks: 0,
        providerCalls: 0,
        networkCalls: 0,
        externalStorageWrites: 0,
        databaseWrites: 0,
      },
    });
    expect(`${result.stdout}${result.stderr}`).not.toContain(
      'ambient-fake-must-not-be-read',
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain(
      fixture.credentialPath,
    );

    for (const control of [
      'credential',
      'provider',
      'database',
      'storage',
      'network',
      'write',
      'preflight',
      'live_spawn',
    ]) {
      const positive = spawnSync(
        process.execPath,
        ['--require', SENTINEL, '-e', 'void 0'],
        {
          cwd: REPO,
          env: {
            ...baseEnv,
            LIVE_EXECUTION_MATERIALIZATION_SENTINEL_POSITIVE_CONTROL:
              control,
          },
          encoding: 'utf8',
          shell: false,
          windowsHide: true,
        },
      );
      expect(positive.status).not.toBe(0);
      expect(positive.stderr).toMatch(
        /TEST_(?:LIVE_EXECUTION_REQUEST_MATERIALIZATION|NETWORK)_SENTINEL/,
      );
    }
  });
});

describe('fail-closed input, filesystem, Git, and B0 boundaries', () => {
  it('rejects noncanonical bytes, unknown fields, traversal, globs, duplicates, and relative credential paths', () => {
    const fixture = createFixture();
    expect(
      canonicalLiveExecutionRequestMaterializationInputIssues({
        ...fixture.input,
        version:
          'canonical-live-execution-request-materialization-input/v36',
      }),
    ).toContain(
      'execution_request_materialization_input_version_invalid',
    );
    const variants: unknown[] = [
      {
        ...fixture.input,
        version:
          'canonical-live-execution-request-materialization-input/v36',
      },
      { ...fixture.input, unknown: true },
      { ...fixture.input, manifestPath: '../manifest.json' },
      { ...fixture.input, outputDir: 'outputs/**/escape' },
      {
        ...fixture.input,
        preservationPaths: [
          fixture.preservationPath,
          fixture.preservationPath,
        ],
      },
      {
        ...fixture.input,
        expectedAbsentPaths: ['outputs\\noncanonical'],
      },
      {
        ...fixture.input,
        credentialSourcePath: 'relative.env',
      },
    ];
    for (const variant of variants) {
      expect(
        canonicalLiveExecutionRequestMaterializationInputIssues(
          variant,
        ).length,
      ).toBeGreaterThan(0);
      expect(() =>
        assertValidCanonicalLiveExecutionRequestMaterializationInput(
          variant,
        ),
      ).toThrow();
    }
    fs.writeFileSync(
      path.join(
        fixture.repoRoot,
        fixture.inputPath,
      ),
      JSON.stringify(fixture.input),
      'utf8',
    );
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: fixture.repoRoot,
          inputPath: fixture.inputPath,
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_input_rejected',
    ]);
    expect(materializationOutputFiles(fixture)).toEqual([]);
  });

  it('rejects preservation hard links and input hard links before creating authority', () => {
    const fixture = createFixture();
    const preservationAbsolute = path.join(
      fixture.repoRoot,
      fixture.preservationPath,
    );
    const hardLinkPath =
      'outputs/preservation/hard-link-control.bin';
    fs.linkSync(
      preservationAbsolute,
      path.join(fixture.repoRoot, hardLinkPath),
    );
    writeMaterializationInput(fixture, {
      ...fixture.input,
      preservationPaths: [hardLinkPath],
    });
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: fixture.repoRoot,
          inputPath: fixture.inputPath,
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_filesystem_rejected',
    ]);
    expect(materializationOutputFiles(fixture)).toEqual([]);

    fs.unlinkSync(path.join(fixture.repoRoot, hardLinkPath));
    const inputAbsolute = path.join(
      fixture.repoRoot,
      fixture.inputPath,
    );
    const originalInput =
      'outputs/execution-materialization/original-input.json';
    fs.renameSync(
      inputAbsolute,
      path.join(fixture.repoRoot, originalInput),
    );
    fs.linkSync(
      path.join(fixture.repoRoot, originalInput),
      inputAbsolute,
    );
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: fixture.repoRoot,
          inputPath: fixture.inputPath,
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_filesystem_rejected',
    ]);
  });

  it('rejects symlink/junction output aliases and expected-path presence without partial authority', () => {
    const fixture = createFixture();
    const aliasTarget = path.join(
      fixture.parent,
      'external-output-target',
    );
    fs.mkdirSync(aliasTarget, { recursive: true });
    const aliasRelative =
      'outputs/execution-materialization/alias-output';
    const aliasAbsolute = path.join(
      fixture.repoRoot,
      aliasRelative,
    );
    fs.mkdirSync(path.dirname(aliasAbsolute), {
      recursive: true,
    });
    let aliasCreated = false;
    try {
      fs.symlinkSync(
        aliasTarget,
        aliasAbsolute,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      aliasCreated = true;
    } catch {
      // Host policy may deny link creation; hard-link coverage remains.
    }
    if (aliasCreated) {
      writeMaterializationInput(fixture, {
        ...fixture.input,
        outputDir: aliasRelative,
      });
      expect(
        rejectionFor(() =>
          materializeCanonicalLiveExecutionRequest({
            repoRoot: fixture.repoRoot,
            inputPath: fixture.inputPath,
          }),
        ).reasonCodes,
      ).toEqual([
        'execution_request_materialization_output_rejected',
      ]);
      expect(fs.readdirSync(aliasTarget)).toEqual([]);
    }

    writeMaterializationInput(fixture, {
      ...fixture.input,
      outputDir: MATERIALIZATION_OUTPUT_DIR,
    });
    fs.mkdirSync(
      path.join(
        fixture.repoRoot,
        fixture.expectedAbsentPath,
      ),
      { recursive: true },
    );
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: fixture.repoRoot,
          inputPath: fixture.inputPath,
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_verification_rejected',
    ]);
    expect(materializationOutputFiles(fixture)).toEqual([]);
  });

  it('rejects tracked/untracked dirt and requires a configured upstream', () => {
    const tracked = createFixture();
    fs.appendFileSync(
      path.join(tracked.repoRoot, '.gitignore'),
      '# dirty\n',
      'utf8',
    );
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: tracked.repoRoot,
          inputPath: tracked.inputPath,
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_git_rejected',
    ]);
    expect(materializationOutputFiles(tracked)).toEqual([]);

    const untracked = createFixture();
    fs.writeFileSync(
      path.join(untracked.repoRoot, 'untracked.txt'),
      'dirty',
      'utf8',
    );
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: untracked.repoRoot,
          inputPath: untracked.inputPath,
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_git_rejected',
    ]);

    const noUpstream = createFixture();
    git(noUpstream.repoRoot, [
      'branch',
      '--unset-upstream',
    ]);
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: noUpstream.repoRoot,
          inputPath: noUpstream.inputPath,
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_git_rejected',
    ]);
  });

  it('rejects branch/HEAD/ref/divergence movement during immediate verification and removes staged/new authority', () => {
    for (const movement of ['branch', 'upstream'] as const) {
      const fixture = createFixture();
      const movedCommit = git(fixture.repoRoot, [
        'commit-tree',
        `${fixture.head}^{tree}`,
        '-p',
        fixture.head,
        '-m',
        `moved ${movement}`,
      ]);
      let verificationCalls = 0;
      const verifyExecution: CanonicalLiveExecutionRequestMaterializationDependencies['verifyExecution'] =
        (args) => {
          verificationCalls += 1;
          if (verificationCalls === 1) {
            git(fixture.repoRoot, [
              'update-ref',
              movement === 'branch'
                ? BRANCH_REF
                : UPSTREAM_REF,
              movedCommit,
            ]);
          }
          return verifyCanonicalLiveExecution(args);
        };
      expect(
        rejectionFor(() =>
          materializeCanonicalLiveExecutionRequest({
            repoRoot: fixture.repoRoot,
            inputPath: fixture.inputPath,
            dependencies: { verifyExecution },
          }),
        ).reasonCodes,
      ).toEqual([
        'execution_request_materialization_verification_rejected',
      ]);
      expect(verificationCalls).toBe(1);
      expect(materializationOutputFiles(fixture)).toEqual([]);
      const staging = path.join(
        fixture.repoRoot,
        MATERIALIZATION_OUTPUT_DIR,
        '.canonical-live-execution-request-staging',
      );
      expect(
        fs.existsSync(staging)
          ? fs.readdirSync(staging)
          : [],
      ).toEqual([]);
    }
  });

  it('removes staging and newly published authority when public verification throws unexpectedly', () => {
    for (const failingCall of [1, 2]) {
      const fixture = createFixture();
      let calls = 0;
      const verifyExecution: CanonicalLiveExecutionRequestMaterializationDependencies['verifyExecution'] =
        (args) => {
          calls += 1;
          if (calls === failingCall) {
            throw new Error(
              'RAW_VERIFY_EXCEPTION_OPENAI_API_KEY=never-serialize',
            );
          }
          return verifyCanonicalLiveExecution(args);
        };
      expect(
        rejectionFor(() =>
          materializeCanonicalLiveExecutionRequest({
            repoRoot: fixture.repoRoot,
            inputPath: fixture.inputPath,
            dependencies: { verifyExecution },
          }),
        ).reasonCodes,
      ).toEqual([
        'execution_request_materialization_verification_rejected',
      ]);
      expect(materializationOutputFiles(fixture)).toEqual([]);
      const staging = path.join(
        fixture.repoRoot,
        MATERIALIZATION_OUTPUT_DIR,
        '.canonical-live-execution-request-staging',
      );
      expect(
        fs.existsSync(staging)
          ? fs.readdirSync(staging)
          : [],
      ).toEqual([]);
    }
  });

  it('rejects B0 corruption, post-verification future-command drift, and preservation drift without output authority', () => {
    const corrupt = createFixture();
    fs.appendFileSync(
      path.join(corrupt.repoRoot, corrupt.manifestPath),
      'corrupt',
      'utf8',
    );
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: corrupt.repoRoot,
          inputPath: corrupt.inputPath,
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_b0_rejected',
    ]);

    const commandDrift = createFixture();
    const verifyBundle: CanonicalLiveExecutionRequestMaterializationDependencies['verifyBundle'] =
      (args) => {
        const result = verifyCanonicalLiveRequestBundle(args);
        const manifestAbsolute = path.join(
          commandDrift.repoRoot,
          commandDrift.manifestPath,
        );
        const manifest = JSON.parse(
          fs.readFileSync(manifestAbsolute, 'utf8'),
        ) as {
          futureLiveCommand: { arguments: string[] };
        };
        manifest.futureLiveCommand.arguments.push(
          '--caller-command-drift',
        );
        writeCanonical(manifestAbsolute, manifest);
        return result;
      };
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: commandDrift.repoRoot,
          inputPath: commandDrift.inputPath,
          dependencies: { verifyBundle },
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_b0_rejected',
    ]);

    const preservationDrift = createFixture();
    let calls = 0;
    const verifyExecution: CanonicalLiveExecutionRequestMaterializationDependencies['verifyExecution'] =
      (args) => {
        calls += 1;
        if (calls === 1) {
          fs.appendFileSync(
            path.join(
              preservationDrift.repoRoot,
              preservationDrift.preservationPath,
            ),
            'drift',
            'utf8',
          );
        }
        return verifyCanonicalLiveExecution(args);
      };
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: preservationDrift.repoRoot,
          inputPath: preservationDrift.inputPath,
          dependencies: { verifyExecution },
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_verification_rejected',
    ]);
    expect(materializationOutputFiles(preservationDrift)).toEqual(
      [],
    );
  }, 30_000);

  it('emits only bounded rejection evidence without raw secret, path, exception, command, or stack text', () => {
    const fixture = createFixture(true);
    const rawSecret = 'OPENAI_API_KEY=raw-never-serialize';
    const rawCommand = 'powershell -Command Invoke-Expression';
    const result = spawnSync(
      process.execPath,
      [
        TSX,
        '--require',
        SHIM,
        MATERIALIZER_ENTRY,
        '--repo-root',
        fixture.repoRoot,
        '--input',
        'outputs/missing-raw-sensitive-input.json',
      ],
      {
        cwd: REPO,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          OPENAI_API_KEY: rawSecret,
          RAW_COMMAND_SENTINEL: rawCommand,
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    const evidence = JSON.parse(result.stdout) as unknown;
    expect(evidence).toEqual(
      canonicalLiveExecutionRequestMaterializationRejection(
        'execution_request_materialization_filesystem_rejected',
      ),
    );
    const serialized = `${result.stdout}${result.stderr}`;
    expect(serialized).not.toContain(rawSecret);
    expect(serialized).not.toContain(rawCommand);
    expect(serialized).not.toContain(fixture.repoRoot);
    expect(serialized).not.toContain(fixture.credentialPath);
    expect(evidence).not.toHaveProperty('error');
    expect(evidence).not.toHaveProperty('message');
    expect(evidence).not.toHaveProperty('path');
    expect(evidence).not.toHaveProperty('stack');
  });

  it('rejects immediate-predecessor B0 and Supervisor verification envelopes even when their statuses are successful', () => {
    const priorB0 = createFixture();
    const verifyBundle: CanonicalLiveExecutionRequestMaterializationDependencies['verifyBundle'] =
      (args) =>
        ({
          ...verifyCanonicalLiveRequestBundle(args),
          version: 'canonical-live-request-verification/v49',
        }) as unknown as ReturnType<
          typeof verifyCanonicalLiveRequestBundle
        >;
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: priorB0.repoRoot,
          inputPath: priorB0.inputPath,
          dependencies: { verifyBundle },
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_b0_rejected',
    ]);

    const priorSupervisor = createFixture();
    const verifyExecution: CanonicalLiveExecutionRequestMaterializationDependencies['verifyExecution'] =
      (args) =>
        ({
          ...verifyCanonicalLiveExecution(args),
          version: 'canonical-live-execution-readiness/v46',
        }) as unknown as ReturnType<
          typeof verifyCanonicalLiveExecution
        >;
    expect(
      rejectionFor(() =>
        materializeCanonicalLiveExecutionRequest({
          repoRoot: priorSupervisor.repoRoot,
          inputPath: priorSupervisor.inputPath,
          dependencies: { verifyExecution },
        }),
      ).reasonCodes,
    ).toEqual([
      'execution_request_materialization_verification_rejected',
    ]);
  });

  it('contains no selected Story Source, story, child, companion, page, prop, or reveal special-case literal in shared production code', () => {
    const source = fs.readFileSync(
      path.join(
        REPO,
        'lib',
        'visual-package',
        'liveExecutionRequestMaterialization.ts',
      ),
      'utf8',
    );
    for (const literal of [
      'fox_uri_adventure',
      'lion_shaket_adventure',
      'dini',
      'dobi',
      'prop_tin_bucket',
      'pageNumber',
      'revealTimeline',
      'storyKey',
      'companionId',
      'childName',
      'shell: true',
      'eval(',
      'Invoke-Expression',
    ]) {
      expect(source).not.toContain(literal);
    }
  });
});
