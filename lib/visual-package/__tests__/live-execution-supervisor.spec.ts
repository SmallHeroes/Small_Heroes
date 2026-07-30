import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  CANONICAL_LIVE_EXECUTION_READINESS_VERSION,
  CANONICAL_LIVE_EXECUTION_REQUEST_VERSION,
  CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
  LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
  assertValidCanonicalLiveExecutionReadiness,
  buildCanonicalLiveExecutionRequest,
  canonicalJsonDigest,
  canonicalLiveExecutionExitDisposition,
  canonicalLiveExecutionReadinessIssues,
  canonicalLiveExecutionRequestIssues,
  materializeCanonicalLiveRequestBundle,
  minimalPlatformInheritedEnvironmentNames,
  runCanonicalLiveExecution,
  runCanonicalLiveExecutionProbe,
  verifyCanonicalLiveExecution,
  verifyCanonicalLiveRequestBundle,
  type CanonicalLiveExecutionDependencies,
  type CanonicalLiveExecutionRequest,
  type LiveRequestMaterializationInput,
} from '@/lib/visual-package';
import {
  canonicalLiveAuthoringJsonBytes,
} from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';

const REPO = process.cwd();
const SUPERVISOR = path.join(
  REPO,
  'scripts',
  'canonical-live-execution-supervisor.cjs',
);
const SUPERVISOR_ENTRY = path.join(
  REPO,
  'scripts',
  'canonical-live-execution-supervisor-entry.ts',
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
const VERIFY_SENTINEL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'deny-live-execution-verify-boundaries.cjs',
);
const ENTRY_OUTPUT_THROW_SENTINEL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'throw-live-execution-entry-output-once.cjs',
);
const REQUEST_PATH =
  'outputs/live-execution/request.json';
const BRANCH = 'codex/execution-fixture';
const BRANCH_REF = `refs/heads/${BRANCH}`;
const UPSTREAM_REF = `refs/remotes/origin/${BRANCH}`;
const REQUESTED_AT = '2026-07-30T08:00:00.000Z';
const tempRoots: string[] = [];
const require = createRequire(import.meta.url);

interface ExecutionFixture {
  parent: string;
  repoRoot: string;
  remoteRoot: string;
  head: string;
  credentialPath: string;
  preservationPath: string;
  expectedAbsentPath: string;
  materialized: ReturnType<
    typeof materializeCanonicalLiveRequestBundle
  >;
  request: CanonicalLiveExecutionRequest;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(
  prefix = 'canonical-live-execution-',
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function git(
  cwd: string,
  args: string[],
): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `git fixture command failed: ${args.join(' ')}\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function fixtureStory(pageCount = 12): string {
  return [
    '---',
    'title: "Execution fixture"',
    'gender: male',
    `pages: ${pageCount}`,
    '---',
    '',
    ...Array.from(
      { length: pageCount },
      (_, index) => index + 1,
    ).flatMap((pageNumber) => [
      `--- Page ${pageNumber} ---`,
      `A child studies a shared workshop plan on page ${pageNumber} and chooses a careful next step.`,
      '',
      `imageDirection: A neutral workshop composition for page ${pageNumber}, with the plan visible.`,
      '',
    ]),
  ].join('\n');
}

function sha256Bytes(bytes: Buffer | string): string {
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

function executionRequestPayload(
  fixture: Omit<ExecutionFixture, 'request'>,
  overrides: {
    head?: string;
    branchRefCommit?: string;
    upstreamRefCommit?: string;
    expectedAhead?: number;
    expectedBehind?: number;
    preservationFences?: CanonicalLiveExecutionRequest['preservationFences'];
    expectedAbsentPaths?: string[];
    credentialPath?: string;
  } = {},
): Omit<
  CanonicalLiveExecutionRequest,
  'digest' | 'digestAlgorithm'
> {
  const command = fixture.materialized.manifest.futureLiveCommand;
  const preservationBytes = fs.readFileSync(
    path.join(fixture.repoRoot, fixture.preservationPath),
  );
  const head = overrides.head ?? fixture.head;
  return {
    version: CANONICAL_LIVE_EXECUTION_REQUEST_VERSION,
    requestId: 'execution-fixture-request-001',
    requestedAt: REQUESTED_AT,
    repository: {
      realPath: fixture.repoRoot,
      expectedBranch: BRANCH_REF,
      expectedHead: head,
      expectedTrackedChanges: 0,
      expectedUntrackedChanges: 0,
      refs: [
        {
          name: BRANCH_REF,
          expectedCommit:
            overrides.branchRefCommit ?? head,
        },
        {
          name: UPSTREAM_REF,
          expectedCommit:
            overrides.upstreamRefCommit ?? fixture.head,
        },
      ],
      divergence: [
        {
          localRef: BRANCH_REF,
          upstreamRef: UPSTREAM_REF,
          expectedAhead: overrides.expectedAhead ?? 0,
          expectedBehind: overrides.expectedBehind ?? 0,
        },
      ],
    },
    canonicalBundle: {
      manifestPath:
        fixture.materialized.persistence.manifest.path,
      manifestDigest:
        fixture.materialized.persistence.manifest.digest,
      verificationVersion:
        CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
    },
    preservationFences:
      overrides.preservationFences ?? [
        {
          path: fixture.preservationPath,
          byteLength: preservationBytes.length,
          sha256: sha256Bytes(preservationBytes),
        },
      ],
    expectedAbsentPaths:
      overrides.expectedAbsentPaths ?? [
        fixture.expectedAbsentPath,
      ],
    credentialIsolation: {
      sourcePath:
        overrides.credentialPath ?? fixture.credentialPath,
      variableName: 'OPENAI_API_KEY',
      assignmentPolicy: 'single-line-start-assignment/v1',
      rejectAmbientCredential: true,
      childEnvironmentPolicy:
        'minimal-platform-allowlist/v1',
      inheritedEnvironmentNames:
        minimalPlatformInheritedEnvironmentNames(),
    },
    futureLiveCommand: {
      executable: 'node',
      arguments: command.arguments.slice(),
      identitySha256: canonicalJsonDigest({
        executable: command.executable,
        arguments: command.arguments,
      }),
    },
  };
}

function persistRequest(
  fixture: ExecutionFixture,
  request: CanonicalLiveExecutionRequest,
): void {
  fixture.request = request;
  writeCanonical(
    path.join(fixture.repoRoot, REQUEST_PATH),
    request,
  );
}

function rebuildRequest(
  fixture: ExecutionFixture,
  overrides: Parameters<typeof executionRequestPayload>[1] = {},
): CanonicalLiveExecutionRequest {
  const request = buildCanonicalLiveExecutionRequest(
    executionRequestPayload(fixture, overrides),
  );
  persistRequest(fixture, request);
  return request;
}

function createExecutionFixture(
  unicodePath = false,
): ExecutionFixture {
  const parent = tempRoot();
  const repoRoot = path.join(
    parent,
    unicodePath ? 'repo with spaces שלום' : 'repo',
  );
  const remoteRoot = path.join(
    parent,
    unicodePath ? 'bare remote Ω.git' : 'remote.git',
  );
  fs.mkdirSync(repoRoot, { recursive: true });
  git(repoRoot, ['init', '-b', BRANCH]);
  git(repoRoot, ['config', 'user.email', 'fixture@example.test']);
  git(repoRoot, ['config', 'user.name', 'Execution Fixture']);
  fs.writeFileSync(
    path.join(repoRoot, '.gitignore'),
    'outputs/\n',
    'utf8',
  );
  const storyPath = 'stories/execution_fixture.md';
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

  const inputPath =
    'outputs/b0/materialization-input.json';
  const input: LiveRequestMaterializationInput = {
    version: LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
    repoRoot: fs.realpathSync(repoRoot),
    storyKey: 'execution_fixture',
    storyPath,
    requestId: 'execution-b0-request-001',
    requestedAt: REQUESTED_AT,
  };
  writeCanonical(path.join(repoRoot, inputPath), input);
  const materialized = materializeCanonicalLiveRequestBundle({
    repoRoot,
    requestPath: inputPath,
    outputDir: 'outputs/b0/live-request',
  });
  const preservationPath =
    'outputs/preservation/control.bin';
  fs.mkdirSync(
    path.dirname(path.join(repoRoot, preservationPath)),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(repoRoot, preservationPath),
    Buffer.from('preserve these exact bytes\n', 'utf8'),
  );
  const fixtureWithoutRequest = {
    parent,
    repoRoot: fs.realpathSync(repoRoot),
    remoteRoot,
    head,
    credentialPath: path.join(
      parent,
      'missing credential source.env',
    ),
    preservationPath,
    expectedAbsentPath:
      'outputs/b0/live-request/contract-candidates',
    materialized,
  };
  const request = buildCanonicalLiveExecutionRequest(
    executionRequestPayload(fixtureWithoutRequest),
  );
  const fixture: ExecutionFixture = {
    ...fixtureWithoutRequest,
    request,
  };
  persistRequest(fixture, request);
  return fixture;
}

function verifyFixture(
  fixture: ExecutionFixture,
  dependencies?: Partial<CanonicalLiveExecutionDependencies>,
) {
  return verifyCanonicalLiveExecution({
    repoRoot: fixture.repoRoot,
    requestPath: REQUEST_PATH,
    dependencies,
  });
}

function treeIdentity(root: string): string {
  const entries: string[] = [];
  function walk(directory: string): void {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) =>
        left.name.localeCompare(right.name),
      )) {
      const absolute = path.join(directory, entry.name);
      const relative = path
        .relative(root, absolute)
        .replace(/\\/g, '/');
      if (entry.isDirectory()) {
        entries.push(`d:${relative}`);
        walk(absolute);
      } else if (entry.isFile()) {
        const bytes = fs.readFileSync(absolute);
        entries.push(
          `f:${relative}:${bytes.length}:${sha256Bytes(bytes)}`,
        );
      } else {
        entries.push(`o:${relative}`);
      }
    }
  }
  walk(root);
  return entries.join('\n');
}

function fakeChild(args: {
  kind: 'error' | 'exit' | 'signal';
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: (signal?: NodeJS.Signals) => boolean;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  process.nextTick(() => {
    if (args.stdout) child.stdout.write(args.stdout);
    if (args.stderr) child.stderr.write(args.stderr);
    child.stdout.end();
    child.stderr.end();
    if (args.kind === 'error') {
      child.emit('error', new Error('raw spawn failure'));
    } else if (args.kind === 'signal') {
      child.emit('close', null, 'SIGTERM');
    } else {
      child.emit('close', args.exitCode ?? 0, null);
    }
  });
  return child;
}

function fakeCredential(
  value: string,
  state: { cleared: boolean },
) {
  return {
    value,
    clear() {
      state.cleared = true;
    },
  };
}

describe('canonical live execution request and readiness', () => {
  it('builds canonical v1 request bytes/digest and emits canonical bounded readiness', () => {
    const fixture = createExecutionFixture(true);
    const before = treeIdentity(fixture.repoRoot);
    const readiness = verifyFixture(fixture);

    expect(
      canonicalLiveExecutionRequestIssues(fixture.request),
    ).toEqual([]);
    expect(readiness.version).toBe(
      CANONICAL_LIVE_EXECUTION_READINESS_VERSION,
    );
    expect(readiness.status, JSON.stringify(readiness)).toBe(
      'ready',
    );
    expect(readiness.zeroWrite).toBe(true);
    expect(readiness.b0).toMatchObject({
      status: 'verified',
      verificationVersion:
        CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
      manifestDigest:
        fixture.materialized.persistence.manifest.digest,
      reasonCodes: [],
    });
    expect(readiness.git).toMatchObject({
      status: 'verified',
      refCount: 2,
      divergenceCount: 1,
      branchMatched: true,
      headMatched: true,
      trackedChanges: 0,
      untrackedChanges: 0,
    });
    expect(readiness.preservation).toEqual({
      status: 'verified',
      checkedFileCount: 1,
    });
    expect(readiness.expectedAbsence).toEqual({
      status: 'verified',
      checkedPathCount: 1,
    });
    expect(readiness.credentialIsolation).toEqual({
      policy: 'minimal-platform-allowlist/v1',
      sourcePathDigest: sha256Bytes(
        Buffer.from(fixture.credentialPath, 'utf8'),
      ),
      sourceRead: false,
      ambientCredentialInherited: false,
    });
    expect(
      canonicalLiveExecutionReadinessIssues(readiness),
    ).toEqual([]);
    expect(() =>
      assertValidCanonicalLiveExecutionReadiness(readiness),
    ).not.toThrow();
    expect(
      canonicalLiveAuthoringJsonBytes(
        JSON.parse(
          fs.readFileSync(
            path.join(fixture.repoRoot, REQUEST_PATH),
            'utf8',
          ),
        ) as unknown,
      ),
    ).toBe(
      fs.readFileSync(
        path.join(fixture.repoRoot, REQUEST_PATH),
        'utf8',
      ),
    );
    const serialized = JSON.stringify(readiness);
    expect(serialized).not.toContain(fixture.repoRoot);
    expect(serialized).not.toContain(fixture.credentialPath);
    expect(serialized).not.toContain('execution_fixture');
    expect(treeIdentity(fixture.repoRoot)).toBe(before);
  });

  it('rejects noncanonical request bytes, stale digests, and unknown schema fields with one bounded code', () => {
    const fixture = createExecutionFixture();
    const requestAbsolute = path.join(
      fixture.repoRoot,
      REQUEST_PATH,
    );
    fs.writeFileSync(
      requestAbsolute,
      JSON.stringify(fixture.request),
      'utf8',
    );
    expect(verifyFixture(fixture)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['execution_request_rejected'],
    });

    persistRequest(fixture, {
      ...fixture.request,
      digest: '0'.repeat(64),
    });
    expect(verifyFixture(fixture)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['execution_request_rejected'],
    });

    const withExtra = {
      ...fixture.request,
      unexpected: true,
    } as Record<string, unknown>;
    const {
      digestAlgorithm: _algorithm,
      digest: _digest,
      ...payload
    } = withExtra;
    writeCanonical(requestAbsolute, {
      ...payload,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(payload),
    });
    const rejected = verifyFixture(fixture);
    expect(rejected.reasonCodes).toEqual([
      'execution_request_rejected',
    ]);
    expect(rejected.reasonCodes.every((code) =>
      /^[a-z0-9_:-]{1,128}$/.test(code),
    )).toBe(true);
  });

  it('detects readiness digest corruption and status/reason inconsistencies', () => {
    const fixture = createExecutionFixture();
    const readiness = verifyFixture(fixture);
    expect(
      canonicalLiveExecutionReadinessIssues({
        ...readiness,
        digest: '0'.repeat(64),
      }),
    ).toContain('execution_readiness_digest_invalid');
    const invalid = {
      ...readiness,
      status: 'rejected',
      reasonCodes: [],
    };
    const {
      digestAlgorithm: _algorithm,
      digest: _digest,
      ...payload
    } = invalid;
    expect(
      canonicalLiveExecutionReadinessIssues({
        ...payload,
        digestAlgorithm: 'canonical-json-sha256',
        digest: canonicalJsonDigest(payload),
      }),
    ).toContain('execution_readiness_header_invalid');
  });
});

describe('exact Git/topology authority', () => {
  it('uses exact fixed argv with no request-supplied command surface', () => {
    const fixture = createExecutionFixture();
    const observed: string[][] = [];
    const runGit = (
      args: readonly string[],
      options: { cwd: string; env: NodeJS.ProcessEnv },
    ) => {
      observed.push(Array.from(args));
      const result = spawnSync('git', Array.from(args), {
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
    expect(verifyFixture(fixture, { runGit }).status).toBe(
      'ready',
    );
    expect(observed).toEqual([
      [
        '--no-optional-locks',
        '-C',
        fixture.repoRoot,
        'rev-parse',
        '--show-toplevel',
      ],
      [
        '--no-optional-locks',
        '-C',
        fixture.repoRoot,
        'symbolic-ref',
        '--quiet',
        'HEAD',
      ],
      [
        '--no-optional-locks',
        '-C',
        fixture.repoRoot,
        'rev-parse',
        '--verify',
        'HEAD^{commit}',
      ],
      [
        '--no-optional-locks',
        '-C',
        fixture.repoRoot,
        'status',
        '--porcelain=v2',
        '--untracked-files=all',
      ],
      ...fixture.request.repository.refs.map((ref) => [
        '--no-optional-locks',
        '-C',
        fixture.repoRoot,
        'rev-parse',
        '--verify',
        '--end-of-options',
        `${ref.name}^{commit}`,
      ]),
      [
        '--no-optional-locks',
        '-C',
        fixture.repoRoot,
        'rev-list',
        '--left-right',
        '--count',
        '--end-of-options',
        `${BRANCH_REF}...${UPSTREAM_REF}`,
      ],
    ]);
    expect(JSON.stringify(observed)).not.toContain('shell');
    expect(
      canonicalLiveExecutionRequestIssues({
        ...fixture.request,
        repository: {
          ...fixture.request.repository,
          expectedBranch: '--upload-pack=malicious',
        },
      }),
    ).toContain('execution_repository_branch_invalid');

    expect(
      verifyFixture(fixture, {
        runGit() {
          return {
            status: null,
            signal: 'SIGTERM',
            error: false,
            stdout: 'raw git output must not escape',
          };
        },
      }),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: ['git_command_failed'],
    });
  });

  it('fails closed on wrong branch and wrong HEAD', () => {
    const branchFixture = createExecutionFixture();
    git(branchFixture.repoRoot, ['switch', '-c', 'other']);
    expect(verifyFixture(branchFixture)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['git_branch_mismatch'],
    });

    const headFixture = createExecutionFixture();
    rebuildRequest(headFixture, {
      head: '0'.repeat(40),
      branchRefCommit: '0'.repeat(40),
    });
    expect(verifyFixture(headFixture)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['git_head_mismatch'],
    });
  });

  it('distinguishes tracked and untracked dirt and rejects each', () => {
    const tracked = createExecutionFixture();
    fs.appendFileSync(
      path.join(tracked.repoRoot, 'stories/execution_fixture.md'),
      '\ntracked change\n',
    );
    expect(verifyFixture(tracked)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['git_cleanliness_mismatch'],
    });

    const untracked = createExecutionFixture();
    fs.writeFileSync(
      path.join(untracked.repoRoot, 'unexpected.txt'),
      'untracked',
    );
    expect(verifyFixture(untracked)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['git_cleanliness_mismatch'],
    });
  });

  it('rejects explicit ref and divergence mismatches', () => {
    const wrongRef = createExecutionFixture();
    rebuildRequest(wrongRef, {
      upstreamRefCommit: '0'.repeat(40),
    });
    expect(verifyFixture(wrongRef)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['git_ref_mismatch'],
    });

    const divergence = createExecutionFixture();
    fs.writeFileSync(
      path.join(divergence.repoRoot, 'second.txt'),
      'second commit',
    );
    git(divergence.repoRoot, ['add', 'second.txt']);
    git(divergence.repoRoot, ['commit', '-m', 'local ahead']);
    const newHead = git(divergence.repoRoot, [
      'rev-parse',
      'HEAD',
    ]);
    rebuildRequest(divergence, {
      head: newHead,
      branchRefCommit: newHead,
      upstreamRefCommit: divergence.head,
      expectedAhead: 0,
      expectedBehind: 0,
    });
    expect(verifyFixture(divergence)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['git_divergence_mismatch'],
    });
  });
});

describe('B0 composition and explicit filesystem fences', () => {
  it('uses the existing canonical B0 verifier once and preserves its corruption codes', () => {
    const fixture = createExecutionFixture();
    let verifierCalls = 0;
    const pass = verifyFixture(fixture, {
      verifyBundle(args) {
        verifierCalls += 1;
        return verifyCanonicalLiveRequestBundle(args);
      },
    });
    expect(pass.status).toBe('ready');
    expect(verifierCalls).toBe(1);
    const thrown = verifyFixture(fixture, {
      verifyBundle() {
        throw new Error('raw B0 exception');
      },
    });
    expect(thrown).toMatchObject({
      status: 'rejected',
      reasonCodes: ['b0_verification_failed'],
      b0: { status: 'rejected' },
    });
    expect(JSON.stringify(thrown)).not.toContain(
      'raw B0 exception',
    );

    const manifestPath = path.join(
      fixture.repoRoot,
      fixture.materialized.persistence.manifest.path,
    );
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf8'),
    ) as Record<string, unknown>;
    writeCanonical(manifestPath, {
      ...manifest,
      status: 'corrupted',
    });
    const rejected = verifyFixture(fixture);
    expect(rejected).toMatchObject({
      status: 'rejected',
      reasonCodes: ['b0_verification_rejected'],
      b0: {
        status: 'rejected',
      },
    });
    expect(rejected.b0.reasonCodes.length).toBeGreaterThan(0);
    expect(
      JSON.stringify(rejected.b0.reasonCodes),
    ).toMatch(/manifest/);
  });

  it('rejects a request-supplied command identity that differs from the verified manifest command', () => {
    const fixture = createExecutionFixture();
    const payload = executionRequestPayload(fixture);
    payload.futureLiveCommand = {
      executable: 'node',
      arguments: [
        ...payload.futureLiveCommand.arguments,
        '--unauthorized-extra',
      ],
      identitySha256: canonicalJsonDigest({
        executable: 'node',
        arguments: [
          ...payload.futureLiveCommand.arguments,
          '--unauthorized-extra',
        ],
      }),
    };
    persistRequest(
      fixture,
      buildCanonicalLiveExecutionRequest(payload),
    );
    expect(verifyFixture(fixture)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['future_live_command_mismatch'],
      futureLiveCommand: { status: 'rejected' },
    });
  });

  it('rejects missing, byte-length-mismatched, and SHA-mismatched preservation files', () => {
    const missing = createExecutionFixture();
    fs.unlinkSync(
      path.join(missing.repoRoot, missing.preservationPath),
    );
    expect(verifyFixture(missing)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['contained_path_missing_or_unreadable'],
      preservation: { status: 'rejected' },
    });

    const bytes = createExecutionFixture();
    const byteFence = {
      ...bytes.request.preservationFences[0]!,
      byteLength:
        bytes.request.preservationFences[0]!.byteLength + 1,
    };
    rebuildRequest(bytes, {
      preservationFences: [byteFence],
    });
    expect(verifyFixture(bytes).reasonCodes).toEqual([
      'preservation_byte_length_mismatch',
    ]);

    const digest = createExecutionFixture();
    rebuildRequest(digest, {
      preservationFences: [
        {
          ...digest.request.preservationFences[0]!,
          sha256: '0'.repeat(64),
        },
      ],
    });
    expect(verifyFixture(digest).reasonCodes).toEqual([
      'preservation_sha256_mismatch',
    ]);
  });

  it('rejects traversal, glob syntax, duplicate aliases, and present downstream paths at schema/core boundaries', () => {
    const fixture = createExecutionFixture();
    for (const unsafe of [
      '../escape',
      'outputs/*.json',
      'outputs/[alias].json',
      'outputs\\alias.json',
    ]) {
      const payload = executionRequestPayload(fixture, {
        preservationFences: [
          {
            path: unsafe,
            byteLength: 1,
            sha256: '0'.repeat(64),
          },
        ],
      });
      expect(() =>
        buildCanonicalLiveExecutionRequest(payload),
      ).toThrow('canonical_live_execution_request_invalid');
    }
    expect(() =>
      buildCanonicalLiveExecutionRequest(
        executionRequestPayload(fixture, {
          preservationFences: [
            fixture.request.preservationFences[0]!,
            fixture.request.preservationFences[0]!,
          ],
        }),
      ),
    ).toThrow('canonical_live_execution_request_invalid');

    const present = path.join(
      fixture.repoRoot,
      fixture.expectedAbsentPath,
    );
    fs.mkdirSync(path.dirname(present), { recursive: true });
    fs.writeFileSync(present, 'must remain absent');
    expect(verifyFixture(fixture)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['expected_absent_path_present'],
      expectedAbsence: { status: 'rejected' },
    });
  });

  it('rejects symlink/junction and hard-link escape authority where the host supports it', () => {
    const hardLink = createExecutionFixture();
    const external = path.join(
      hardLink.parent,
      'external-preservation.bin',
    );
    fs.writeFileSync(external, 'external bytes');
    const contained = path.join(
      hardLink.repoRoot,
      'outputs/preservation/hard-link.bin',
    );
    fs.linkSync(external, contained);
    const hardBytes = fs.readFileSync(contained);
    rebuildRequest(hardLink, {
      preservationFences: [
        {
          path: 'outputs/preservation/hard-link.bin',
          byteLength: hardBytes.length,
          sha256: sha256Bytes(hardBytes),
        },
      ],
    });
    expect(verifyFixture(hardLink)).toMatchObject({
      status: 'rejected',
      reasonCodes: [
        'contained_path_not_unique_regular_file',
      ],
    });

    const alias = createExecutionFixture();
    const outsideDirectory = path.join(
      alias.parent,
      'outside-directory',
    );
    fs.mkdirSync(outsideDirectory);
    fs.writeFileSync(
      path.join(outsideDirectory, 'aliased.bin'),
      'aliased bytes',
    );
    const aliasDirectory = path.join(
      alias.repoRoot,
      'outputs',
      'alias-directory',
    );
    let aliasCreated = false;
    try {
      fs.symlinkSync(
        outsideDirectory,
        aliasDirectory,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      aliasCreated = true;
    } catch {
      // Some Windows hosts deny symlink creation. Hard-link rejection above
      // remains the mandatory alias control on those hosts.
    }
    if (aliasCreated) {
      const aliasBytes = fs.readFileSync(
        path.join(aliasDirectory, 'aliased.bin'),
      );
      rebuildRequest(alias, {
        preservationFences: [
          {
            path: 'outputs/alias-directory/aliased.bin',
            byteLength: aliasBytes.length,
            sha256: sha256Bytes(aliasBytes),
          },
        ],
      });
      expect(verifyFixture(alias)).toMatchObject({
        status: 'rejected',
        reasonCodes: ['contained_path_escape'],
      });
    }

    const fileAlias = createExecutionFixture();
    const outsideFile = path.join(
      fileAlias.parent,
      'outside-file.bin',
    );
    fs.writeFileSync(outsideFile, 'outside file bytes');
    const linkedFile = path.join(
      fileAlias.repoRoot,
      'outputs/preservation/symlink-file.bin',
    );
    let fileAliasCreated = false;
    try {
      fs.symlinkSync(outsideFile, linkedFile, 'file');
      fileAliasCreated = true;
    } catch {
      // File symlinks require an elevated/developer-mode Windows host.
    }
    if (fileAliasCreated) {
      const linkedBytes = fs.readFileSync(linkedFile);
      rebuildRequest(fileAlias, {
        preservationFences: [
          {
            path: 'outputs/preservation/symlink-file.bin',
            byteLength: linkedBytes.length,
            sha256: sha256Bytes(linkedBytes),
          },
        ],
      });
      expect(verifyFixture(fileAlias)).toMatchObject({
        status: 'rejected',
        reasonCodes: ['contained_path_escape'],
      });
    }
  });
});

describe('verify boundary and public Node contract', () => {
  it('does not inspect a missing/denied credential source or reach the live child', () => {
    const fixture = createExecutionFixture();
    let credentialReads = 0;
    let childSpawns = 0;
    const result = verifyFixture(fixture, {
      readCredential() {
        credentialReads += 1;
        throw new Error('credential read reached');
      },
      spawnTrusted() {
        childSpawns += 1;
        throw new Error('child spawn reached');
      },
    });
    expect(result.status).toBe('ready');
    expect(result.credentialIsolation.sourceRead).toBe(false);
    expect(result.externalBoundaryEvidence).toEqual({
      canonicalPreflightRuns: 0,
      credentialReads: 0,
      providerCalls: 0,
      networkCalls: 0,
      storageWrites: 0,
      databaseWrites: 0,
    });
    expect(credentialReads).toBe(0);
    expect(childSpawns).toBe(0);
    expect(fs.existsSync(fixture.credentialPath)).toBe(false);
  });

  it('runs the real verify entry beneath credential/provider/network/write sentinels with positive controls', () => {
    const fixture = createExecutionFixture();
    const baseEnv = {
      ...process.env,
      TSX_DISABLE_CACHE: '1',
      LIVE_EXECUTION_DENIED_CREDENTIAL_PATH:
        fixture.credentialPath,
    };
    const result = spawnSync(
      process.execPath,
      [
        TSX,
        '--require',
        SHIM,
        '--require',
        VERIFY_SENTINEL,
        SUPERVISOR_ENTRY,
        'verify',
        '--repo-root',
        fixture.repoRoot,
        '--request',
        REQUEST_PATH,
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
    expect(
      JSON.parse(result.stdout) as Record<string, unknown>,
    ).toMatchObject({ status: 'ready', zeroWrite: true });

    for (const control of [
      'credential',
      'provider',
      'network',
      'write',
      'promise_write',
    ]) {
      const positive = spawnSync(
        process.execPath,
        ['--require', VERIFY_SENTINEL, '-e', 'void 0'],
        {
          cwd: REPO,
          env: {
            ...baseEnv,
            LIVE_EXECUTION_SENTINEL_POSITIVE_CONTROL:
              control,
          },
          encoding: 'utf8',
          shell: false,
          windowsHide: true,
        },
      );
      expect(positive.status).not.toBe(0);
      expect(positive.stderr).toMatch(
        /TEST_(?:LIVE_EXECUTION_VERIFY|NETWORK)_SENTINEL/,
      );
    }
  });

  it.each([
    'unknown_mode',
    'equals_form',
    'duplicate_flag',
    'positional',
    'missing_flag',
  ] as const)(
    'exposes only verify/live and rejects %s',
    (variant) => {
    const fixture = createExecutionFixture();
      const invalidArgv =
        variant === 'unknown_mode'
          ? [
              'probe',
              '--repo-root',
              fixture.repoRoot,
              '--request',
              REQUEST_PATH,
            ]
          : variant === 'equals_form'
            ? [
                'verify',
                `--repo-root=${fixture.repoRoot}`,
                '--request',
                REQUEST_PATH,
              ]
            : variant === 'duplicate_flag'
              ? [
        'verify',
        '--repo-root',
        fixture.repoRoot,
        '--repo-root',
        fixture.repoRoot,
                ]
              : variant === 'positional'
                ? [
                    'verify',
                    'positional',
                    fixture.repoRoot,
                    '--request',
                    REQUEST_PATH,
                  ]
                : ['verify', '--repo-root', fixture.repoRoot];
      const result = spawnSync(
        process.execPath,
        [SUPERVISOR, ...invalidArgv],
        {
          cwd: REPO,
          encoding: 'utf8',
          shell: false,
          windowsHide: true,
        },
      );
      expect(result.status).toBe(1);
      const value = JSON.parse(result.stdout) as {
        reasonCodes: string[];
      };
      expect(value.reasonCodes).toEqual([
        'execution_cli_arguments_invalid',
      ]);
      expect(result.stderr).toBe('');
    },
  );

  it.each(['verify', 'live'] as const)(
    'attributes an unexpected outer entry throw to requested %s mode',
    (mode) => {
      const missingRequestPath =
        'outputs/live-execution/unexpected-throw-missing.json';
      const result = spawnSync(
        process.execPath,
        [
          TSX,
          '--require',
          SHIM,
          '--require',
          ENTRY_OUTPUT_THROW_SENTINEL,
          SUPERVISOR_ENTRY,
          mode,
          '--repo-root',
          REPO,
          '--request',
          missingRequestPath,
        ],
        {
          cwd: REPO,
          env: {
            ...process.env,
            TSX_DISABLE_CACHE: '1',
          },
          encoding: 'utf8',
          shell: false,
          windowsHide: true,
        },
      );

      expect(result.status).toBe(1);
      expect(result.signal).toBeNull();
      expect(result.stderr).toBe('');
      const evidence = JSON.parse(result.stdout) as unknown;
      assertValidCanonicalLiveExecutionReadiness(evidence);
      expect(evidence).toMatchObject({
        version: CANONICAL_LIVE_EXECUTION_READINESS_VERSION,
        mode,
        status: 'rejected',
        zeroWrite: true,
        requestDigest: null,
        reasonCodes: ['execution_cli_arguments_invalid'],
        externalBoundaryEvidence: {
          canonicalPreflightRuns: 0,
          credentialReads: 0,
          providerCalls: 0,
          networkCalls: 0,
          storageWrites: 0,
          databaseWrites: 0,
        },
      });
      expect(evidence).not.toHaveProperty('error');
      expect(evidence).not.toHaveProperty('message');
      expect(evidence).not.toHaveProperty('path');
      expect(evidence).not.toHaveProperty('stack');
      expect(`${result.stdout}${result.stderr}`).not.toContain(
        'ENTRY_UNEXPECTED_RAW_SECRET',
      );
      expect(`${result.stdout}${result.stderr}`).not.toContain(
        'OPENAI_API_KEY=fake-never-leak',
      );
      expect(`${result.stdout}${result.stderr}`).not.toContain(
        'C:\\sensitive\\credential.env',
      );
    },
  );

  it('scrubs ambient credential/routing/arbitrary environment from the public launcher and verifies successfully', () => {
    const fixture = createExecutionFixture();
    const runner = require(
      '../../../scripts/lib/canonical-live-execution-supervisor-launcher.cjs',
    ) as {
      canonicalLiveExecutionSupervisorLauncherDisposition(
        result: {
          error?: Error;
          signal?: NodeJS.Signals | null;
          status?: number | null;
        },
      ):
        | { kind: 'exit'; exitCode: number }
        | { kind: 'signal'; signal: NodeJS.Signals };
      supervisorEnvironment(
        env: NodeJS.ProcessEnv,
      ): NodeJS.ProcessEnv;
    };
    const filtered = runner.supervisorEnvironment({
      ...process.env,
      OPENAI_API_KEY: 'must-not-cross',
      OPENAI_BASE_URL: 'must-not-cross',
      NODE_OPTIONS: '--require malicious',
      UNRELATED_SECRET: 'must-not-cross',
    });
    expect(filtered.OPENAI_API_KEY).toBeUndefined();
    expect(filtered.OPENAI_BASE_URL).toBeUndefined();
    expect(filtered.NODE_OPTIONS).toBeUndefined();
    expect(filtered.UNRELATED_SECRET).toBeUndefined();
    expect(filtered.TSX_DISABLE_CACHE).toBe('1');
    expect(
      runner.canonicalLiveExecutionSupervisorLauncherDisposition({
        status: 23,
      }),
    ).toEqual({ kind: 'exit', exitCode: 23 });
    expect(
      runner.canonicalLiveExecutionSupervisorLauncherDisposition({
        signal: 'SIGTERM',
      }),
    ).toEqual({ kind: 'signal', signal: 'SIGTERM' });
    expect(
      runner.canonicalLiveExecutionSupervisorLauncherDisposition({
        error: new Error('raw'),
      }),
    ).toEqual({ kind: 'exit', exitCode: 1 });

    const result = spawnSync(
      process.execPath,
      [
        SUPERVISOR,
        'verify',
        '--repo-root',
        fixture.repoRoot,
        '--request',
        REQUEST_PATH,
      ],
      {
        cwd: REPO,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          OPENAI_API_KEY: 'ambient-must-be-scrubbed',
          OPENAI_BASE_URL: 'https://example.invalid',
          UNRELATED_SECRET: 'ambient-secret',
        },
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'ready',
      zeroWrite: true,
    });
    expect(result.stdout).not.toContain(
      'ambient-must-be-scrubbed',
    );
    expect(result.stdout).not.toContain('ambient-secret');
  });
});

describe('future live test boundary', () => {
  it('re-verifies immediately, reads only the declared fake key, and spawns exact manifest argv with a minimal environment', async () => {
    const fixture = createExecutionFixture(true);
    const fakeKey = 'sk-fake-live-key-123456789';
    const state = { cleared: false };
    const captured: {
      executable?: string;
      argv?: readonly string[];
      options?: Record<string, unknown>;
      env?: NodeJS.ProcessEnv;
    } = {};
    let liveEnvironmentReference:
      | NodeJS.ProcessEnv
      | undefined;
    let verifierCalls = 0;
    const events: string[] = [];
    const inherited =
      minimalPlatformInheritedEnvironmentNames();
    const ambient = {
      NODE_ENV: 'test',
      OPENAI_BASE_URL: 'must-not-cross',
      UNRELATED_SECRET: 'must-not-cross',
    } as NodeJS.ProcessEnv;
    for (const name of inherited) ambient[name] = `${name}-value`;

    const result = await runCanonicalLiveExecution({
      repoRoot: fixture.repoRoot,
      requestPath: REQUEST_PATH,
      dependencies: {
        env: ambient,
        verifyBundle(args) {
          verifierCalls += 1;
          events.push('verify');
          return verifyCanonicalLiveRequestBundle(args);
        },
        readCredential(sourcePath, variableName) {
          expect(events).toEqual(['verify']);
          events.push('credential');
          expect(sourcePath).toBe(fixture.credentialPath);
          expect(variableName).toBe('OPENAI_API_KEY');
          return fakeCredential(fakeKey, state);
        },
        spawnTrusted(executable, argv, options) {
          expect(events).toEqual(['verify', 'credential']);
          events.push('spawn');
          captured.executable = executable;
          captured.argv = argv;
          captured.options =
            options as unknown as Record<string, unknown>;
          liveEnvironmentReference = options.env;
          captured.env = {
            ...options.env,
          } as unknown as NodeJS.ProcessEnv;
          return fakeChild({
            kind: 'exit',
            exitCode: 0,
            stdout: fakeKey,
            stderr: fakeKey,
          }) as never;
        },
      },
    });

    expect(verifierCalls).toBe(1);
    expect(events).toEqual(['verify', 'credential', 'spawn']);
    expect(result.status).toBe('child_completed');
    expect(result.readiness).toMatchObject({
      mode: 'live',
      status: 'ready',
      credentialIsolation: { sourceRead: false },
    });
    expect(captured.executable).toBe(process.execPath);
    expect(captured.argv).toEqual(
      fixture.materialized.manifest.futureLiveCommand
        .arguments,
    );
    expect(captured.options).toMatchObject({
      cwd: fixture.repoRoot,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(Object.keys(captured.env!).sort()).toEqual(
      [...inherited, 'OPENAI_API_KEY'].sort(),
    );
    expect(captured.env!.OPENAI_API_KEY).toBe(fakeKey);
    expect(captured.env!.OPENAI_BASE_URL).toBeUndefined();
    expect(captured.env!.UNRELATED_SECRET).toBeUndefined();
    expect(
      liveEnvironmentReference!.OPENAI_API_KEY,
    ).toBeUndefined();
    expect(state.cleared).toBe(true);
    expect(result.credential).toEqual({
      sourceAccessAttempted: true,
      sourceReadSucceeded: true,
      authorityCleared: true,
    });
    expect(JSON.stringify(result)).not.toContain(fakeKey);
    expect(result.child).toMatchObject({
      stdout: 'suppressed',
      stderr: 'suppressed',
    });
  });

  it('rejects ambient credential authority before source access', async () => {
    const fixture = createExecutionFixture();
    let credentialReads = 0;
    let childSpawns = 0;
    const result = await runCanonicalLiveExecution({
      repoRoot: fixture.repoRoot,
      requestPath: REQUEST_PATH,
      dependencies: {
        env: {
          NODE_ENV: 'test',
          OPENAI_API_KEY: 'ambient-forbidden',
        },
        readCredential() {
          credentialReads += 1;
          throw new Error('must not run');
        },
        spawnTrusted() {
          childSpawns += 1;
          throw new Error('must not run');
        },
      },
    });
    expect(result).toMatchObject({
      status: 'credential_rejected',
      reasonCodes: ['ambient_credential_authority_present'],
      credential: {
        sourceAccessAttempted: false,
        sourceReadSucceeded: false,
        authorityCleared: true,
      },
      child: null,
    });
    expect(credentialReads).toBe(0);
    expect(childSpawns).toBe(0);
  });

  it('reads only one fake OPENAI_API_KEY assignment from the declared source and copies no neighboring assignment', async () => {
    const fixture = createExecutionFixture();
    const fakeKey = 'sk-fake-source-file-key-123456';
    const credentialPath = path.join(
      fixture.parent,
      'declared fake credential.env',
    );
    fs.writeFileSync(
      credentialPath,
      [
        'NEIGHBOR_SECRET=must-not-cross',
        `OPENAI_API_KEY=${fakeKey}`,
        'OPENAI_PROJECT_ID=must-not-cross',
        '',
      ].join('\n'),
      'utf8',
    );
    rebuildRequest(fixture, { credentialPath });
    let capturedEnvironment:
      | NodeJS.ProcessEnv
      | undefined;
    const result = await runCanonicalLiveExecution({
      repoRoot: fixture.repoRoot,
      requestPath: REQUEST_PATH,
      dependencies: {
        env: { NODE_ENV: 'test' },
        spawnTrusted(_executable, _argv, options) {
          capturedEnvironment = Object.assign(
            { NODE_ENV: 'test' },
            options.env,
          ) as NodeJS.ProcessEnv;
          return fakeChild({
            kind: 'exit',
            exitCode: 0,
          }) as never;
        },
      },
    });
    expect(result.status).toBe('child_completed');
    expect(capturedEnvironment!.OPENAI_API_KEY).toBe(fakeKey);
    expect(capturedEnvironment!.NEIGHBOR_SECRET).toBeUndefined();
    expect(capturedEnvironment!.OPENAI_PROJECT_ID).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(fakeKey);
    expect(JSON.stringify(result)).not.toContain(
      'must-not-cross',
    );
  });

  it('fails closed on multiple fake key assignments and never spawns', async () => {
    const fixture = createExecutionFixture();
    const credentialPath = path.join(
      fixture.parent,
      'ambiguous fake credential.env',
    );
    fs.writeFileSync(
      credentialPath,
      [
        'OPENAI_API_KEY=sk-first-fake-key',
        'OPENAI_API_KEY=sk-second-fake-key',
        '',
      ].join('\n'),
      'utf8',
    );
    rebuildRequest(fixture, { credentialPath });
    let spawns = 0;
    const result = await runCanonicalLiveExecution({
      repoRoot: fixture.repoRoot,
      requestPath: REQUEST_PATH,
      dependencies: {
        env: { NODE_ENV: 'test' },
        spawnTrusted() {
          spawns += 1;
          throw new Error('must not spawn');
        },
      },
    });
    expect(result).toMatchObject({
      status: 'credential_rejected',
      reasonCodes: ['credential_source_rejected'],
      credential: {
        sourceAccessAttempted: true,
        sourceReadSucceeded: false,
        authorityCleared: true,
      },
    });
    expect(spawns).toBe(0);
  });

  it('kills and rejects a child that exceeds the bounded output allowance without serializing output', async () => {
    const fixture = createExecutionFixture();
    const state = { cleared: false };
    const raw = 'sensitive-output'.repeat(8_000);
    const result = await runCanonicalLiveExecution({
      repoRoot: fixture.repoRoot,
      requestPath: REQUEST_PATH,
      dependencies: {
        env: { NODE_ENV: 'test' },
        readCredential() {
          return fakeCredential(
            'sk-fake-output-limit-key',
            state,
          );
        },
        spawnTrusted() {
          return fakeChild({
            kind: 'exit',
            exitCode: 0,
            stdout: raw,
          }) as never;
        },
      },
    });
    expect(result).toMatchObject({
      status: 'child_failed',
      reasonCodes: ['child_output_limit_exceeded'],
      child: {
        termination: { kind: 'output_limit' },
        stdout: 'suppressed',
        stderr: 'suppressed',
      },
    });
    expect(state.cleared).toBe(true);
    expect(JSON.stringify(result)).not.toContain(
      'sensitive-output',
    );
  });

  it.each([
    {
      name: 'nonstandard exit',
      child: { kind: 'exit' as const, exitCode: 23 },
      reason: 'child_nonzero_exit',
      disposition: { kind: 'exit', exitCode: 23 },
    },
    {
      name: 'signal',
      child: { kind: 'signal' as const },
      reason: 'child_signal',
      disposition: { kind: 'signal', signal: 'SIGTERM' },
    },
    {
      name: 'spawn error',
      child: { kind: 'error' as const },
      reason: 'child_spawn_error',
      disposition: { kind: 'exit', exitCode: 1 },
    },
  ])(
    'propagates $name without retry or raw output',
    async ({ child, reason, disposition }) => {
      const fixture = createExecutionFixture();
      const state = { cleared: false };
      let spawns = 0;
      const result = await runCanonicalLiveExecution({
        repoRoot: fixture.repoRoot,
        requestPath: REQUEST_PATH,
        dependencies: {
          env: { NODE_ENV: 'test' },
          readCredential() {
            return fakeCredential(
              'sk-fake-propagation-key',
              state,
            );
          },
          spawnTrusted() {
            spawns += 1;
            return fakeChild({
              ...child,
              stdout: 'raw child stdout',
              stderr: 'raw child stderr',
            }) as never;
          },
        },
      });
      expect(result.status).toBe('child_failed');
      expect(result.reasonCodes).toEqual([reason]);
      expect(canonicalLiveExecutionExitDisposition(result)).toEqual(
        disposition,
      );
      expect(spawns).toBe(1);
      expect(state.cleared).toBe(true);
      expect(JSON.stringify(result)).not.toContain(
        'raw child stdout',
      );
      expect(JSON.stringify(result)).not.toContain(
        'raw child stderr',
      );
    },
  );
});

describe('fixed repository-owned process probe', () => {
  it('preserves Windows-safe spaces/Unicode argv and isolates environment through the same runner', async () => {
    const probePath =
      'C:\\Path with spaces\\ילד\\Ω\\probe.json';
    const result = await runCanonicalLiveExecutionProbe({
      repoRoot: REPO,
      probePath,
      scenario: 'success',
      dependencies: {
        env: {
          NODE_ENV: 'test',
          OPENAI_API_KEY: 'must-not-cross',
          UNRELATED_SECRET: 'must-not-cross',
          ...Object.fromEntries(
            minimalPlatformInheritedEnvironmentNames().map(
              (name) => [name, `${name}-value`],
            ),
          ),
        },
      },
    });
    expect(result.status).toBe('completed');
    expect(result.termination).toEqual({
      kind: 'exit',
      exitCode: 0,
    });
    expect(result.evidence).toMatchObject({
      argvCount: 6,
      probePathUtf8Bytes: Buffer.byteLength(
        probePath,
        'utf8',
      ),
      probePathSha256: sha256Bytes(
        Buffer.from(probePath, 'utf8'),
      ),
      credentialPresent: false,
    });
    expect(result.evidence!.environmentNames).not.toContain(
      'OPENAI_API_KEY',
    );
    expect(result.evidence!.environmentNames).not.toContain(
      'UNRELATED_SECRET',
    );
  });

  it('propagates the fixed probe nonzero, signal, and injected spawn-error paths', async () => {
    const nonzero = await runCanonicalLiveExecutionProbe({
      repoRoot: REPO,
      probePath: 'fixed',
      scenario: 'nonzero',
    });
    expect(nonzero).toMatchObject({
      status: 'failed',
      reasonCodes: ['probe_nonzero_exit'],
      termination: { kind: 'exit', exitCode: 23 },
    });

    const signal = await runCanonicalLiveExecutionProbe({
      repoRoot: REPO,
      probePath: 'fixed',
      scenario: 'signal',
    });
    expect(signal.status).toBe('failed');
    expect(['probe_signal', 'probe_nonzero_exit']).toContain(
      signal.reasonCodes[0],
    );

    const error = await runCanonicalLiveExecutionProbe({
      repoRoot: REPO,
      probePath: 'fixed',
      scenario: 'success',
      dependencies: {
        spawnTrusted() {
          throw new Error('injected raw spawn error');
        },
      },
    });
    expect(error).toMatchObject({
      status: 'failed',
      reasonCodes: ['probe_spawn_error'],
      termination: { kind: 'spawn_error' },
      evidence: null,
    });
    expect(JSON.stringify(error)).not.toContain(
      'injected raw spawn error',
    );
  });

  it('keeps the probe child fixed and distinct from the manifest future live command', () => {
    const fixture = createExecutionFixture();
    const source = fs.readFileSync(
      path.join(
        REPO,
        'lib/visual-package/liveExecutionSupervisor.ts',
      ),
      'utf8',
    );
    expect(source).toContain(
      'canonical-live-execution-probe-child.cjs',
    );
    expect(
      fixture.materialized.manifest.futureLiveCommand
        .arguments[0],
    ).toBe('scripts/visual-contract-authoring.cjs');
    expect(source).not.toContain('fox_uri_adventure');
    expect(source).not.toContain('bunny_ometz_adventure');
    expect(source).not.toContain('lion_shaket_adventure');
  });
});
