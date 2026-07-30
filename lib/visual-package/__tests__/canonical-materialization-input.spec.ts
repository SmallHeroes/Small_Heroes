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
  vi,
} from 'vitest';

import {
  CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
  LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
  CanonicalMaterializationInputReadError,
  assertValidCanonicalLiveExecutionRequestMaterializationInput,
  assertValidLiveRequestMaterializationInput,
  materializeCanonicalLiveExecutionRequest,
  materializeCanonicalLiveRequestBundle,
  persistCanonicalMaterializationInputArtifact,
  readCanonicalMaterializationInputArtifact,
  writeCanonicalMaterializationInput,
} from '@/lib/visual-package';
import {
  canonicalLiveAuthoringJsonBytes,
} from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';

const REPO = process.cwd();
const WRITER = path.join(
  REPO,
  'scripts',
  'canonical-materialization-input.cjs',
);
const WRITER_ENTRY = path.join(
  REPO,
  'scripts',
  'canonical-materialization-input-entry.ts',
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
const BOUNDARY_SENTINEL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'deny-canonical-materialization-input-boundaries.cjs',
);
const REQUESTED_AT = '2026-07-31T08:00:00.000Z';
const require = createRequire(import.meta.url);
const tempRoots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(
  prefix = 'canonical-materialization-input-',
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return fs.realpathSync(root);
}

function storySource(): string {
  return [
    '---',
    'title: "Canonical input fixture"',
    'gender: female',
    'pages: 3',
    '---',
    '',
    ...Array.from({ length: 3 }, (_, index) => index + 1)
      .flatMap((pageNumber) => [
        `--- Page ${pageNumber} ---`,
        `A young explorer studies a shared map and chooses a calm next step ${pageNumber}.`,
        '',
        `imageDirection: A neutral reading-room composition ${pageNumber}.`,
        '',
      ]),
  ].join('\n');
}

function sourceFixture(unicode = false): {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
} {
  const parent = tempRoot();
  const repoRoot = path.join(
    parent,
    unicode ? 'repository with spaces שלום' : 'repository',
  );
  const storyKey = 'canonical_input_fixture';
  const storyPath = `stories/${storyKey}.md`;
  fs.mkdirSync(path.join(repoRoot, 'stories'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(repoRoot, storyPath),
    storySource(),
    'utf8',
  );
  return {
    repoRoot: fs.realpathSync(repoRoot),
    storyKey,
    storyPath,
  };
}

function sourceArgs(
  fixture: ReturnType<typeof sourceFixture>,
): string[] {
  return [
    'source-authoring-live-request',
    '--repo-root',
    fixture.repoRoot,
    '--out',
    'outputs/input-writer',
    '--story-key',
    fixture.storyKey,
    '--story-path',
    fixture.storyPath,
    '--request-id',
    'canonical-source-request-001',
    '--requested-at',
    REQUESTED_AT,
  ];
}

function executionArgs(
  fixture: ReturnType<typeof sourceFixture>,
): string[] {
  return [
    'canonical-live-execution-request',
    '--repo-root',
    fixture.repoRoot,
    '--out',
    'outputs/input-writer',
    '--request-id',
    'canonical-execution-request-001',
    '--requested-at',
    REQUESTED_AT,
    '--manifest-path',
    'outputs/b0/live-request-materializations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json',
    '--materialization-output-dir',
    'outputs/execution',
    '--preserve',
    'outputs/preserve/z.json',
    '--preserve',
    'outputs/preserve/a.json',
    '--expected-absence',
    'outputs/absent/z',
    '--expected-absence',
    'outputs/absent/a',
    '--credential-source-path',
    path.join(fixture.repoRoot, 'opaque credential.env'),
  ];
}

function runWriter(tokens: string[], env = process.env) {
  return spawnSync(process.execPath, [WRITER, ...tokens], {
    cwd: REPO,
    env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: 30_000,
  });
}

function sourceWrite(
  fixture: ReturnType<typeof sourceFixture>,
) {
  return writeCanonicalMaterializationInput({
    mode: 'source-authoring-live-request',
    repoRoot: fixture.repoRoot,
    outputDir: 'outputs/input-writer',
    storyKey: fixture.storyKey,
    storyPath: fixture.storyPath,
    requestId: 'canonical-source-request-001',
    requestedAt: REQUESTED_AT,
  });
}

describe('canonical materialization input writer and reader', () => {
  it('writes, content-addresses, re-reads, and idempotently replays both validated payload kinds', () => {
    const fixture = sourceFixture(true);
    const source = sourceWrite(fixture);
    const sourceReplay = sourceWrite(fixture);
    expect(source.artifact.created).toBe(true);
    expect(sourceReplay.artifact).toEqual({
      ...source.artifact,
      created: false,
    });
    expect(source.artifact.path).toBe(
      `outputs/input-writer/canonical-materialization-inputs/source-authoring-live-request/${source.artifact.digest}.json`,
    );
    const sourceEnvelope =
      readCanonicalMaterializationInputArtifact({
        repoRoot: fixture.repoRoot,
        inputPath: source.artifact.path,
        expectedKind: 'source-authoring-live-request',
        expectedPayloadSchemaVersion:
          LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
        validatePayload:
          assertValidLiveRequestMaterializationInput,
      });
    expect(sourceEnvelope.payload.repoRoot).toBe(
      fixture.repoRoot,
    );

    const execution = writeCanonicalMaterializationInput({
      mode: 'canonical-live-execution-request',
      repoRoot: fixture.repoRoot,
      outputDir: 'outputs/input-writer',
      requestId: 'canonical-execution-request-001',
      requestedAt: REQUESTED_AT,
      manifestPath:
        'outputs/b0/live-request-materializations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json',
      materializationOutputDir: 'outputs/execution',
      preservationPaths: [
        'outputs/preserve/z.json',
        'outputs/preserve/a.json',
      ],
      expectedAbsentPaths: [
        'outputs/absent/z',
        'outputs/absent/a',
      ],
      credentialSourcePath: path.join(
        fixture.repoRoot,
        'opaque credential.env',
      ),
    });
    const executionEnvelope =
      readCanonicalMaterializationInputArtifact({
        repoRoot: fixture.repoRoot,
        inputPath: execution.artifact.path,
        expectedKind: 'canonical-live-execution-request',
        expectedPayloadSchemaVersion:
          CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
        validatePayload:
          assertValidCanonicalLiveExecutionRequestMaterializationInput,
      });
    expect(executionEnvelope.payload.preservationPaths).toEqual([
      'outputs/preserve/a.json',
      'outputs/preserve/z.json',
    ]);
    expect(
      execution.externalBoundaryControlFlowEvidence,
    ).toEqual({
      evidenceKind: 'invariant-and-control-flow/v1',
      credentialSourceReadsOrChecks: 0,
      networkCalls: 0,
      providerCalls: 0,
      externalStorageWrites: 0,
      databaseWrites: 0,
    });
  });

  it('makes arbitrary CLI flag order and repeated-field order byte/path invariant', () => {
    const fixture = sourceFixture(true);
    const first = runWriter(sourceArgs(fixture));
    expect(first.status, first.stderr).toBe(0);
    const firstResult = JSON.parse(first.stdout) as {
      artifact: { path: string; digest: string; created: boolean };
    };
    const reordered = sourceArgs(fixture);
    const pairs = reordered.slice(1).reduce<string[][]>(
      (result, value, index, values) => {
        if (index % 2 === 0) {
          result.push([value, values[index + 1]!]);
        }
        return result;
      },
      [],
    );
    const second = runWriter([
      reordered[0]!,
      ...pairs.reverse().flat(),
    ]);
    expect(second.status, second.stderr).toBe(0);
    const secondResult = JSON.parse(second.stdout) as {
      artifact: { path: string; digest: string; created: boolean };
    };
    expect(secondResult.artifact).toEqual({
      ...firstResult.artifact,
      created: false,
    });

    const executionFirst = runWriter(executionArgs(fixture));
    expect(executionFirst.status, executionFirst.stderr).toBe(0);
    const executionTokens = executionArgs(fixture);
    const preserveA = executionTokens.indexOf('--preserve');
    const preserveB = executionTokens.lastIndexOf('--preserve');
    const firstValue = executionTokens[preserveA + 1]!;
    executionTokens[preserveA + 1] =
      executionTokens[preserveB + 1]!;
    executionTokens[preserveB + 1] = firstValue;
    const executionSecond = runWriter(executionTokens);
    expect(executionSecond.status, executionSecond.stderr).toBe(0);
    const firstExecutionArtifact = (
      JSON.parse(executionFirst.stdout) as {
        artifact: { path: string; digest: string };
      }
    ).artifact;
    const secondExecutionArtifact = (
      JSON.parse(executionSecond.stdout) as {
        artifact: {
          path: string;
          digest: string;
          created: boolean;
        };
      }
    ).artifact;
    expect(secondExecutionArtifact).toMatchObject({
      path: firstExecutionArtifact.path,
      digest: firstExecutionArtifact.digest,
      created: false,
    });
  });

  it('runs the real writer entry with opaque credential and every external/child/write boundary denied', () => {
    const fixture = sourceFixture(true);
    const credentialPath = path.join(
      fixture.repoRoot,
      'must never be accessed credential.env',
    );
    const outputRoot = path.join(
      fixture.repoRoot,
      'outputs',
      'input-writer',
    );
    fs.mkdirSync(outputRoot, { recursive: true });
    const tokens = executionArgs(fixture);
    tokens[
      tokens.indexOf('--credential-source-path') + 1
    ] = credentialPath;
    const baseEnv = {
      ...process.env,
      OPENAI_API_KEY: 'raw-secret-must-not-appear',
      CANONICAL_INPUT_DENIED_CREDENTIAL_PATH:
        credentialPath,
      CANONICAL_INPUT_ALLOWED_OUTPUT_ROOT: outputRoot,
      TSX_DISABLE_CACHE: '1',
    };
    const run = spawnSync(
      process.execPath,
      [
        TSX,
        '--require',
        SHIM,
        '--require',
        BOUNDARY_SENTINEL,
        WRITER_ENTRY,
        ...tokens,
      ],
      {
        cwd: REPO,
        env: baseEnv,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      },
    );
    expect(run.status, `${run.stderr}\n${run.stdout}`).toBe(0);
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout)).toMatchObject({
      status: 'written',
      externalBoundaryControlFlowEvidence: {
        evidenceKind: 'invariant-and-control-flow/v1',
        credentialSourceReadsOrChecks: 0,
        networkCalls: 0,
        providerCalls: 0,
        externalStorageWrites: 0,
        databaseWrites: 0,
      },
    });
    expect(run.stdout).not.toContain(credentialPath);
    expect(run.stdout).not.toContain(
      'raw-secret-must-not-appear',
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
      'child',
      'child_sync',
      'write',
    ]) {
      const positive = spawnSync(
        process.execPath,
        [
          TSX,
          '--require',
          SHIM,
          '--require',
          BOUNDARY_SENTINEL,
          WRITER_ENTRY,
          ...tokens,
        ],
        {
          cwd: REPO,
          env: {
            ...baseEnv,
            CANONICAL_INPUT_SENTINEL_POSITIVE_CONTROL:
              control,
          },
          encoding: 'utf8',
          shell: false,
          windowsHide: true,
        },
      );
      expect(positive.status).not.toBe(0);
      expect(positive.stderr).toMatch(
        /TEST_(?:CANONICAL_MATERIALIZATION_INPUT|NETWORK)_SENTINEL/,
      );
    }
  });

  it.each([
    ['unknown', ['--unknown', 'x']],
    ['equals', ['--repo-root=x']],
    ['positional', ['positional']],
    ['missing value', ['--repo-root']],
    [
      'duplicate scalar',
      ['--request-id', 'duplicate-request'],
    ],
    [
      'duplicate repeated value',
      ['--preserve', 'outputs/preserve/a.json'],
    ],
  ])('rejects %s CLI syntax with one sanitized result', (
    _label,
    suffix,
  ) => {
    const fixture = sourceFixture();
    const base =
      _label.includes('repeated')
        ? executionArgs(fixture)
        : sourceArgs(fixture);
    const result = runWriter([...base, ...suffix]);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      version:
        'canonical-materialization-input-write-result/v1',
      status: 'rejected',
      reasonCodes: [
        'canonical_materialization_input_write_cli_rejected',
      ],
      artifact: null,
    });
  });

  it('rejects noncanonical bytes, digest/filename/kind/schema mismatches, hard links, and source replacement', () => {
    const fixture = sourceFixture();
    const written = sourceWrite(fixture);
    const absolute = path.join(
      fixture.repoRoot,
      written.artifact.path,
    );
    const canonical = fs.readFileSync(absolute, 'utf8');
    const envelope = JSON.parse(canonical) as Record<
      string,
      unknown
    >;
    const read = (overrides: {
      inputPath?: string;
      kind?:
        | 'source-authoring-live-request'
        | 'canonical-live-execution-request';
      schema?: string;
      hooks?: {
        afterOpen?: (absolutePath: string) => void;
      };
    } = {}) =>
      readCanonicalMaterializationInputArtifact({
        repoRoot: fixture.repoRoot,
        inputPath:
          overrides.inputPath ?? written.artifact.path,
        expectedKind:
          overrides.kind ?? 'source-authoring-live-request',
        expectedPayloadSchemaVersion:
          overrides.schema ??
          LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
        validatePayload:
          assertValidLiveRequestMaterializationInput,
        hooks: overrides.hooks,
      });

    expect(() =>
      read({ kind: 'canonical-live-execution-request' }),
    ).toThrow(
      /canonical_materialization_input_kind_mismatch/,
    );
    expect(() => read({ schema: 'unrelated-input/v1' })).toThrow(
      /canonical_materialization_input_payload_schema_mismatch/,
    );

    fs.writeFileSync(
      absolute,
      JSON.stringify(envelope),
      'utf8',
    );
    expect(() => read()).toThrow(
      /canonical_materialization_input_bytes_noncanonical/,
    );
    fs.writeFileSync(absolute, canonical, 'utf8');

    const stale = {
      ...envelope,
      payload: {
        ...(envelope.payload as Record<string, unknown>),
        requestId: 'changed-request',
      },
    };
    fs.writeFileSync(
      absolute,
      canonicalLiveAuthoringJsonBytes(stale),
      'utf8',
    );
    expect(() => read()).toThrow(
      /canonical_materialization_input_digest_mismatch/,
    );
    fs.writeFileSync(absolute, canonical, 'utf8');

    const wrongAddress = written.artifact.path.replace(
      `${written.artifact.digest}.json`,
      `${'b'.repeat(64)}.json`,
    );
    fs.copyFileSync(
      absolute,
      path.join(fixture.repoRoot, wrongAddress),
    );
    expect(() => read({ inputPath: wrongAddress })).toThrow(
      /canonical_materialization_input_content_address_mismatch/,
    );

    const original = `${absolute}.original`;
    fs.renameSync(absolute, original);
    fs.linkSync(original, absolute);
    expect(() => read()).toThrow(
      /canonical_materialization_input_filesystem_rejected/,
    );
    fs.unlinkSync(absolute);
    fs.renameSync(original, absolute);

    const symlinkTarget = `${absolute}.symlink-target`;
    fs.renameSync(absolute, symlinkTarget);
    let symlinkCreated = false;
    try {
      fs.symlinkSync(symlinkTarget, absolute, 'file');
      symlinkCreated = true;
    } catch {
      fs.renameSync(symlinkTarget, absolute);
    }
    if (symlinkCreated) {
      expect(() => read()).toThrow(
        /canonical_materialization_input_filesystem_rejected/,
      );
      fs.unlinkSync(absolute);
      fs.renameSync(symlinkTarget, absolute);
    }

    expect(() =>
      read({
        hooks: {
          afterOpen: (inputPath) => {
            fs.appendFileSync(inputPath, ' ');
          },
        },
      }),
    ).toThrow(
      CanonicalMaterializationInputReadError,
    );
  });

  it('rejects a differing same-address collision without overwrite', () => {
    const fixture = sourceFixture();
    const first = sourceWrite(fixture);
    const absolute = path.join(
      fixture.repoRoot,
      first.artifact.path,
    );
    fs.writeFileSync(absolute, 'collision\n', 'utf8');
    expect(() => sourceWrite(fixture)).toThrow(
      /canonical_materialization_input_write_collision/,
    );
    expect(fs.readFileSync(absolute, 'utf8')).toBe(
      'collision\n',
    );
  });

  it('removes a newly created exact artifact when post-write verification fails', () => {
    const fixture = sourceFixture();
    let artifactPath = '';
    expect(() =>
      persistCanonicalMaterializationInputArtifact({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/post-write-failure',
        kind: 'source-authoring-live-request',
        payloadSchemaVersion:
          LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
        payload: {
          version: LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
          repoRoot: fixture.repoRoot,
          storyKey: fixture.storyKey,
          storyPath: fixture.storyPath,
          requestId: 'post-write-failure-request',
          requestedAt: REQUESTED_AT,
        },
        validatePayload:
          assertValidLiveRequestMaterializationInput,
        hooks: {
          beforePostWriteVerification: (value) => {
            artifactPath = value.artifactPath;
            throw new Error('forced_post_write_failure');
          },
        },
      }),
    ).toThrow(
      /canonical_materialization_input_post_write_verification_rejected/,
    );
    expect(artifactPath).not.toBe('');
    expect(
      fs.existsSync(path.join(fixture.repoRoot, artifactPath)),
    ).toBe(false);
  });

  it('lets the B0 consumer materialize only real public-writer output and rejects manual legacy/noncanonical input', () => {
    const fixture = sourceFixture();
    const input = sourceWrite(fixture);
    const materialized = materializeCanonicalLiveRequestBundle({
      repoRoot: fixture.repoRoot,
      requestPath: input.artifact.path,
      outputDir: 'outputs/b0',
    });
    expect(materialized.status).toBe(
      'materialized_inputs_only',
    );
    const legacyPath =
      `outputs/manual/canonical-materialization-inputs/source-authoring-live-request/${'a'.repeat(64)}.json`;
    fs.mkdirSync(
      path.dirname(path.join(fixture.repoRoot, legacyPath)),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(fixture.repoRoot, legacyPath),
      canonicalLiveAuthoringJsonBytes({
        version: LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
        repoRoot: fixture.repoRoot,
        storyKey: fixture.storyKey,
        storyPath: fixture.storyPath,
        requestId: 'manual-request',
        requestedAt: REQUESTED_AT,
      }),
      'utf8',
    );
    expect(() =>
      materializeCanonicalLiveRequestBundle({
        repoRoot: fixture.repoRoot,
        requestPath: legacyPath,
        outputDir: 'outputs/rejected',
      }),
    ).toThrow();
    expect(
      fs.existsSync(
        path.join(fixture.repoRoot, 'outputs/rejected'),
      ),
    ).toBe(false);

    const executionLegacyPath =
      `outputs/manual/canonical-materialization-inputs/canonical-live-execution-request/${'b'.repeat(64)}.json`;
    fs.mkdirSync(
      path.dirname(
        path.join(fixture.repoRoot, executionLegacyPath),
      ),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(fixture.repoRoot, executionLegacyPath),
      canonicalLiveAuthoringJsonBytes({
        version:
          CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
        requestId: 'legacy-execution-input',
        requestedAt: REQUESTED_AT,
        manifestPath:
          'outputs/b0/live-request-materializations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json',
        outputDir: 'outputs/execution',
        preservationPaths: ['outputs/preserve/a.json'],
        expectedAbsentPaths: ['outputs/absent/a'],
        credentialSourcePath: path.join(
          fixture.repoRoot,
          'opaque.env',
        ),
      }),
      'utf8',
    );
    expect(() =>
      materializeCanonicalLiveExecutionRequest({
        repoRoot: fixture.repoRoot,
        inputPath: executionLegacyPath,
      }),
    ).toThrow(
      /execution_request_materialization_input_rejected/,
    );
  });

  it('keeps selected story, child, companion, page, prop, and reveal data out of shared production code', () => {
    const source = [
      'lib/visual-package/canonicalMaterializationInput.ts',
      'lib/visual-package/canonicalMaterializationInputWriter.ts',
      'scripts/canonical-materialization-input-entry.ts',
      'scripts/canonical-materialization-input.cjs',
      'scripts/lib/canonical-materialization-input-launcher.cjs',
    ]
      .map((relativePath) =>
        fs.readFileSync(path.join(REPO, relativePath), 'utf8'),
      )
      .join('\n');
    for (const forbidden of [
      'fox_uri_adventure',
      'lion_shaket_adventure',
      'dini',
      'dobi',
      'prop_tin_bucket',
      'revealTimeline',
      'companionId',
      'childName',
      'pageNumber',
      'shell: true',
      'eval(',
      'Invoke-Expression',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe('canonical materialization input launcher', () => {
  it('uses exact local argv, shell:false, minimal environment, and exact exit/signal dispositions', () => {
    const launcher = require(
      '../../../scripts/lib/canonical-materialization-input-launcher.cjs',
    ) as {
      canonicalMaterializationInputEnvironment: (
        environment: NodeJS.ProcessEnv,
        platform: NodeJS.Platform,
      ) => NodeJS.ProcessEnv;
      canonicalMaterializationInputLauncherDisposition: (
        result: {
          error?: Error;
          signal?: NodeJS.Signals | null;
          status?: number | null;
        },
      ) =>
        | { kind: 'exit'; exitCode: number }
        | { kind: 'signal'; signal: NodeJS.Signals };
      runCanonicalMaterializationInputLauncher: (
        options: Record<string, unknown>,
      ) => unknown;
    };
    const spawn = vi.fn(() => ({
      status: 37,
      signal: null,
    }));
    launcher.runCanonicalMaterializationInputLauncher({
      argv: ['source-authoring-live-request', '--out', 'a b'],
      cwd: 'C:\\repo with spaces',
      env: {
        PATH: 'safe-path',
        OPENAI_API_KEY: 'secret',
        NODE_OPTIONS: '--inspect',
        ARBITRARY: 'drop',
      },
      platform: 'win32',
      execPath: 'C:\\node\\node.exe',
      tsxCli: 'C:\\repo\\node_modules\\tsx\\cli.mjs',
      shim: 'C:\\repo\\scripts\\shim.cjs',
      entrypoint: 'C:\\repo\\scripts\\entry שלום.ts',
      spawnSyncImpl: spawn,
    });
    expect(spawn).toHaveBeenCalledWith(
      'C:\\node\\node.exe',
      [
        'C:\\repo\\node_modules\\tsx\\cli.mjs',
        '--require',
        'C:\\repo\\scripts\\shim.cjs',
        'C:\\repo\\scripts\\entry שלום.ts',
        'source-authoring-live-request',
        '--out',
        'a b',
      ],
      expect.objectContaining({
        shell: false,
        windowsHide: true,
        env: {
          PATH: 'safe-path',
          TSX_DISABLE_CACHE: '1',
        },
      }),
    );
    expect(
      launcher.canonicalMaterializationInputEnvironment(
        {
          NODE_ENV: 'test',
          PATH: 'safe',
          OPENAI_API_KEY: 'drop',
          NODE_OPTIONS: 'drop',
          HTTPS_PROXY: 'drop',
        },
        'linux',
      ),
    ).toEqual({
      PATH: 'safe',
      TSX_DISABLE_CACHE: '1',
    });
    expect(
      launcher.canonicalMaterializationInputLauncherDisposition({
        status: 37,
      }),
    ).toEqual({ kind: 'exit', exitCode: 37 });
    expect(
      launcher.canonicalMaterializationInputLauncherDisposition({
        signal: 'SIGTERM',
      }),
    ).toEqual({ kind: 'signal', signal: 'SIGTERM' });
    expect(
      launcher.canonicalMaterializationInputLauncherDisposition({
        error: new Error('spawn failed'),
        status: 37,
      }),
    ).toEqual({ kind: 'exit', exitCode: 1 });
    expect(
      launcher.canonicalMaterializationInputLauncherDisposition({
        status: null,
      }),
    ).toEqual({ kind: 'exit', exitCode: 1 });
  });
});
