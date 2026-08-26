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
  CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
  canonicalJsonDigest,
  materializeCanonicalLiveRequestBundle,
  verifyCanonicalLiveRequestBundle,
  writeCanonicalMaterializationInput,
  type LiveRequestMaterializationManifest,
} from '@/lib/visual-package';
import {
  canonicalLiveAuthoringJsonBytes,
} from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';

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
const CLI = path.join(
  REPO,
  'scripts',
  'production-visual-lifecycle.ts',
);
const BOUNDARY_SENTINEL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'deny-live-request-verification-boundaries.cjs',
);
const WRITE_PROBE = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'live-request-verification-write-probe.cjs',
);
const REQUESTED_AT = '2026-07-29T10:00:00.000Z';
const tempRoots: string[] = [];

type Materialized = ReturnType<
  typeof materializeCanonicalLiveRequestBundle
>;
type ArtifactKey =
  keyof LiveRequestMaterializationManifest['artifacts'];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(
  prefix = 'live-request-verification-',
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function storyMarkdown(pageCount = 12): string {
  return [
    '---',
    'title: "Canonical verification fixture"',
    'gender: male',
    `pages: ${pageCount}`,
    '---',
    '',
    ...Array.from(
      { length: pageCount },
      (_, index) => index + 1,
    ).flatMap((pageNumber) => [
      `--- Page ${pageNumber} ---`,
      `In a shared workshop, the child checks a paper plan on page ${pageNumber} and chooses a careful next step.`,
      '',
      `imageDirection: A general workshop composition for page ${pageNumber}, with the paper plan visible.`,
      '',
    ]),
  ].join('\n');
}

function writeFixture(): {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
} {
  const repoRoot = tempRoot();
  const storyKey = 'canonical_verification_fixture';
  const storyPath = `stories/${storyKey}.md`;
  const storyAbsolute = path.join(repoRoot, storyPath);
  fs.mkdirSync(path.dirname(storyAbsolute), {
    recursive: true,
  });
  fs.writeFileSync(
    storyAbsolute,
    storyMarkdown(),
    'utf8',
  );
  return { repoRoot, storyKey, storyPath };
}

function writeInput(
  fixture: ReturnType<typeof writeFixture>,
): string {
  return writeCanonicalMaterializationInput({
    mode: 'source-authoring-live-request',
    repoRoot: fixture.repoRoot,
    outputDir: 'inputs',
    storyKey: fixture.storyKey,
    storyPath: fixture.storyPath,
    requestId: 'canonical-verification-request-001',
    requestedAt: REQUESTED_AT,
  }).artifact.path;
}

function materialize(
  fixture: ReturnType<typeof writeFixture>,
): Materialized {
  return materializeCanonicalLiveRequestBundle({
    repoRoot: fixture.repoRoot,
    requestPath: writeInput(fixture),
    outputDir: 'outputs/canonical-live-request',
  });
}

function absoluteArtifact(
  fixture: ReturnType<typeof writeFixture>,
  relativePath: string,
): string {
  return path.join(fixture.repoRoot, relativePath);
}

function readJson<T>(
  fixture: ReturnType<typeof writeFixture>,
  relativePath: string,
): T {
  return JSON.parse(
    fs.readFileSync(
      absoluteArtifact(fixture, relativePath),
      'utf8',
    ),
  ) as T;
}

function writeCanonical(
  fixture: ReturnType<typeof writeFixture>,
  relativePath: string,
  value: unknown,
): void {
  const absolutePath = absoluteArtifact(
    fixture,
    relativePath,
  );
  fs.mkdirSync(path.dirname(absolutePath), {
    recursive: true,
  });
  fs.writeFileSync(
    absolutePath,
    canonicalLiveAuthoringJsonBytes(value),
    'utf8',
  );
}

function digestEnvelope(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = value;
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
}

function rewriteManifest(
  fixture: ReturnType<typeof writeFixture>,
  original: LiveRequestMaterializationManifest,
  mutate: (
    value: Record<string, unknown>,
  ) => void,
): string {
  const value = structuredClone(
    original,
  ) as unknown as Record<string, unknown>;
  mutate(value);
  const addressed = digestEnvelope(value);
  const manifestDigest = addressed.digest as string;
  const outputRoot = path.posix.dirname(
    path.posix.dirname(
      original.artifacts.sourceAuthorityRequest.path,
    ),
  );
  const relativePath = path.posix.join(
    outputRoot,
    'live-request-materializations',
    `${manifestDigest}.json`,
  );
  writeCanonical(fixture, relativePath, addressed);
  return relativePath;
}

function replaceAddressedRequest(
  fixture: ReturnType<typeof writeFixture>,
  materialized: Materialized,
  mutate: (
    value: Record<string, unknown>,
  ) => void,
): string {
  const originalDescriptor =
    materialized.manifest.artifacts.liveAuthoringRequest;
  const request = readJson<Record<string, unknown>>(
    fixture,
    originalDescriptor.path,
  );
  mutate(request);
  const addressedRequest = digestEnvelope(request);
  const requestDigest = addressedRequest.digest as string;
  const requestPath = path.posix.join(
    path.posix.dirname(originalDescriptor.path),
    `${requestDigest}.json`,
  );
  writeCanonical(fixture, requestPath, addressedRequest);
  return rewriteManifest(
    fixture,
    materialized.manifest,
    (manifest) => {
      const artifacts = manifest.artifacts as Record<
        string,
        Record<string, unknown>
      >;
      artifacts.liveAuthoringRequest = {
        ...artifacts.liveAuthoringRequest,
        path: requestPath,
        digest: requestDigest,
      };
      const futureLiveCommand =
        manifest.futureLiveCommand as {
          arguments: string[];
        };
      futureLiveCommand.arguments =
        futureLiveCommand.arguments.map((argument) =>
          argument === originalDescriptor.path
            ? requestPath
            : argument,
        );
    },
  );
}

function verifyArgs(args: {
  fixture: ReturnType<typeof writeFixture>;
  manifestPath: string;
}): string[] {
  return [
    'source-authoring-live-request-verify',
    '--repo-root',
    args.fixture.repoRoot,
    '--manifest',
    args.manifestPath,
  ];
}

function tsxCacheIdentity(): string {
  return typeof process.geteuid === 'function'
    ? String(process.geteuid())
    : os.userInfo().username;
}

function isolatedBoundaryRuntime(): {
  runtimeTempRoot: string;
  cacheRoot: string;
  env: NodeJS.ProcessEnv;
} {
  const runtimeTempRoot = tempRoot(
    'live-request-verification-runtime-',
  );
  const cacheRoot = path.join(
    runtimeTempRoot,
    `tsx-${tsxCacheIdentity()}`,
  );
  return {
    runtimeTempRoot,
    cacheRoot,
    env: {
      ...process.env,
      TEMP: runtimeTempRoot,
      TMP: runtimeTempRoot,
      TMPDIR: runtimeTempRoot,
      OPENAI_API_KEY: 'must-never-be-read',
      LIVE_REQUEST_VERIFICATION_SENTINEL_TEMP_ROOT:
        runtimeTempRoot,
      LIVE_REQUEST_VERIFICATION_SENTINEL_TSX_CACHE_ROOT:
        cacheRoot,
    },
  };
}

function runVerifierCli(
  args: string[],
  options: {
    traceWrites?: boolean;
  } = {},
) {
  const boundary = isolatedBoundaryRuntime();
  return spawnSync(
    process.execPath,
    [
      TSX,
      '--require',
      SHIM,
      '--require',
      BOUNDARY_SENTINEL,
      CLI,
      ...args,
    ],
    {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...boundary.env,
        LIVE_REQUEST_VERIFICATION_SENTINEL_TRACE:
          options.traceWrites ? '1' : '0',
      },
    },
  );
}

function runBoundaryProbe(
  mode:
    | 'cache-file-alias'
    | 'cache-root-signature'
    | 'coverage'
    | 'old-stack-shape'
    | 'paths',
  boundary = isolatedBoundaryRuntime(),
) {
  const unsafeSource = path.join(
    boundary.runtimeTempRoot,
    'unsafe-source.txt',
  );
  const unsafeTarget = path.join(
    REPO,
    'forbidden-live-request-verification-write.txt',
  );
  return spawnSync(
    process.execPath,
    [
      '--require',
      BOUNDARY_SENTINEL,
      WRITE_PROBE,
      mode,
    ],
    {
      cwd: REPO,
      encoding: 'utf8',
      env: {
        ...boundary.env,
        LIVE_REQUEST_VERIFICATION_PROBE_UNSAFE_SOURCE:
          unsafeSource,
        LIVE_REQUEST_VERIFICATION_PROBE_UNSAFE_TARGET:
          unsafeTarget,
        LIVE_REQUEST_VERIFICATION_PROBE_REPOSITORY_TARGET:
          unsafeTarget,
        LIVE_REQUEST_VERIFICATION_PROBE_OUTPUT_TARGET:
          path.join(
            REPO,
            'outputs',
            'forbidden-live-request-verification-write.txt',
          ),
        LIVE_REQUEST_VERIFICATION_PROBE_TEMP_NEIGHBOR:
          path.join(
            boundary.runtimeTempRoot,
            'tsx-neighbor',
            '123-0123456789abcdef0123456789abcdef01234567',
          ),
        LIVE_REQUEST_VERIFICATION_PROBE_ALIAS_TARGET:
          path.join(
            boundary.runtimeTempRoot,
            'tsx-cache-alias',
            '123-0123456789abcdef0123456789abcdef01234567',
          ),
      },
    },
  );
}

function parseCliResult(result: {
  stdout: string;
}): Record<string, unknown> {
  return JSON.parse(result.stdout) as Record<
    string,
    unknown
  >;
}

function fileTreeIdentity(root: string): string {
  const entries: string[] = [];
  function walk(relativeDirectory: string): void {
    const absoluteDirectory = path.join(
      root,
      relativeDirectory,
    );
    for (const entry of fs
      .readdirSync(absoluteDirectory, {
        withFileTypes: true,
      })
      .sort((left, right) =>
        left.name.localeCompare(right.name),
      )) {
      const relativePath = path.posix.join(
        relativeDirectory.replace(/\\/g, '/'),
        entry.name,
      );
      if (entry.isDirectory()) {
        entries.push(`d:${relativePath}`);
        walk(relativePath);
      } else if (entry.isFile()) {
        const bytes = fs.readFileSync(
          path.join(root, relativePath),
        );
        entries.push(
          `f:${relativePath}:${bytes.length}:${crypto
            .createHash('sha256')
            .update(bytes)
            .digest('hex')}`,
        );
      } else {
        entries.push(`o:${relativePath}`);
      }
    }
  }
  walk('');
  return entries.join('\n');
}

function verificationResult(
  fixture: ReturnType<typeof writeFixture>,
  manifestPath: string,
) {
  return verifyCanonicalLiveRequestBundle({
    repoRoot: fixture.repoRoot,
    manifestPath,
  });
}

describe('canonical live request verification library', () => {
  it('verifies all four current canonical artifacts and emits only bounded safe authority', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const result = verificationResult(
      fixture,
      materialized.persistence.manifest.path,
    );

    expect(CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION).toBe(
      'canonical-live-request-verification/v52',
    );
    expect(result).toEqual({
      version: CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
      status: 'verified',
      zeroWrite: true,
      identities: {
        manifestDigest:
          materialized.persistence.manifest.digest,
        sourceAuthorityRequestDigest:
          materialized.persistence.sourceAuthorityRequest
            .digest,
        sourceSnapshotDigest:
          materialized.persistence.sourceSnapshot.digest,
        normalizedSourceDigest:
          materialized.manifest.sourceRevision
            .normalizedSourceDigest,
        liveAuthoringRequestDigest:
          materialized.persistence.liveAuthoringRequest.digest,
        requestId: materialized.manifest.requestId,
        storyKey:
          materialized.manifest.sourceRevision.storyKey,
      },
      requestPolicy: {
        provider: 'openai',
        endpoint: 'responses',
        model: 'gpt-5.6-sol',
        serviceTier: 'default',
        reasoningEffort: 'medium',
        maxCalls: 8,
        maxRepairCount: 7,
        standardMaxCalls: 7,
        standardMaxRepairCount: 6,
        standardAttemptOutputBudget: {
          version:
            'visual-contract-authoring-standard-attempt-output-budget/v6',
          limits: [
            40_000,
            32_000,
            36_000,
            24_000,
            24_000,
            24_000,
            24_000,
          ],
          totalPool: 204_000,
          digestAlgorithm: 'canonical-json-sha256',
          digest:
            materialized.manifest.requestPolicy
              .standardAttemptOutputBudget.digest,
        },
        terminalReferenceCleanup: {
          budgetClass: 'terminal_reference_cleanup',
          maxCalls: 1,
          maxRepairCount: 1,
          maxInputTokens: 12_000,
          maxOutputTokens: 1_000,
          eligiblePrecedingRepairModes: [
            'book_surface_patch',
            'full_draft',
          ],
          repairMode: 'page_spatial_reference_patch',
          residualFamily: 'draft_contract',
          residualCode: 'out_of_scope_reference',
        },
        transportRetries: 0,
        noFallback: true,
        projectedMaxUsd: 7.04,
        hardCeilingUsd: 10,
      },
      structuredOutputCompatibility:
        materialized.manifest.structuredOutputCompatibility,
      compactRepairStructuredOutputCompatibility:
        materialized.manifest
          .compactRepairStructuredOutputCompatibility,
      pageContractRepairStructuredOutputCompatibility:
        materialized.manifest
          .pageContractRepairStructuredOutputCompatibility,
      representedElsewhereRepairStructuredOutputCompatibility:
        materialized.manifest
          .representedElsewhereRepairStructuredOutputCompatibility,
      pageSpatialReferenceRepairStructuredOutputCompatibility:
        materialized.manifest
          .pageSpatialReferenceRepairStructuredOutputCompatibility,
      structuralBundleRepairStructuredOutputCompatibility:
        materialized.manifest
          .structuralBundleRepairStructuredOutputCompatibility,
      bookSurfaceRepairStructuredOutputCompatibility:
        materialized.manifest
          .bookSurfaceRepairStructuredOutputCompatibility,
      presentationRequirementRepairStructuredOutputCompatibility:
        materialized.manifest
          .presentationRequirementRepairStructuredOutputCompatibility,
      stablePropScopeRepairStructuredOutputCompatibility:
        materialized.manifest
          .stablePropScopeRepairStructuredOutputCompatibility,
      externalBoundaryEvidence: {
        credentialReadOrCheck: false,
        providerReachabilityCheck: false,
        pricingLookup: false,
        providerCalls: 0,
        modelCalls: 0,
      },
    });
    expect(JSON.stringify(result)).not.toContain(
      fixture.repoRoot,
    );
  });

  it('proves snapshot and live-request identities are portable while source request and manifest identities bind the worktree', () => {
    const firstFixture = writeFixture();
    const secondFixture = writeFixture();
    const first = materialize(firstFixture);
    const second = materialize(secondFixture);

    expect(
      first.persistence.sourceSnapshot.digest,
    ).toBe(second.persistence.sourceSnapshot.digest);
    expect(
      first.persistence.liveAuthoringRequest.digest,
    ).toBe(second.persistence.liveAuthoringRequest.digest);
    expect(
      first.persistence.sourceAuthorityRequest.digest,
    ).not.toBe(
      second.persistence.sourceAuthorityRequest.digest,
    );
    expect(first.persistence.manifest.digest).not.toBe(
      second.persistence.manifest.digest,
    );
    expect(
      verificationResult(
        firstFixture,
        first.persistence.manifest.path,
      ).status,
    ).toBe('verified');
    expect(
      verificationResult(
        secondFixture,
        second.persistence.manifest.path,
      ).status,
    ).toBe('verified');
  });

  it.each([
    ['manifest', null],
    ['source_authority_request', 'sourceAuthorityRequest'],
    ['source_snapshot', 'sourceSnapshot'],
    ['live_authoring_request', 'liveAuthoringRequest'],
  ] as const)(
    'rejects malformed %s JSON',
    (label, artifactKey) => {
      const fixture = writeFixture();
      const materialized = materialize(fixture);
      const relativePath =
        artifactKey === null
          ? materialized.persistence.manifest.path
          : materialized.manifest.artifacts[
              artifactKey as ArtifactKey
            ].path;
      fs.writeFileSync(
        absoluteArtifact(fixture, relativePath),
        '{',
        'utf8',
      );

      expect(
        verificationResult(
          fixture,
          materialized.persistence.manifest.path,
        ),
      ).toMatchObject({
        status: 'rejected',
        reasonCodes: [`${label}_json_invalid`],
      });
    },
  );

  it('rejects semantically identical but noncanonical artifact bytes', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const snapshotPath =
      materialized.manifest.artifacts.sourceSnapshot.path;
    const snapshot = readJson<Record<string, unknown>>(
      fixture,
      snapshotPath,
    );
    fs.writeFileSync(
      absoluteArtifact(fixture, snapshotPath),
      `${JSON.stringify(snapshot, null, 4)}\n`,
      'utf8',
    );

    expect(
      verificationResult(
        fixture,
        materialized.persistence.manifest.path,
      ),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: ['source_snapshot_bytes_noncanonical'],
    });
  });

  it('rejects the redigested immediately prior B0 authority and incompatible current authority instead of arming it', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const legacyPath = rewriteManifest(
      fixture,
      materialized.manifest,
      (value) => {
        value.version =
          'canonical-live-request-materialization/v49';
      },
    );
    expect(
      verificationResult(fixture, legacyPath),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: expect.arrayContaining([
        'manifest_schema_invalid',
      ]),
    });

    const incompatiblePath = rewriteManifest(
      fixture,
      materialized.manifest,
      (value) => {
        const authority =
          value.structuredOutputCompatibility as {
            compatibility: Record<string, unknown>;
          };
        authority.compatibility.profileDigest = '0'.repeat(64);
      },
    );
    expect(
      verificationResult(fixture, incompatiblePath),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: [
        'structured_output_compatibility_invalid',
      ],
    });

    const compactIncompatiblePath = rewriteManifest(
      fixture,
      materialized.manifest,
      (value) => {
        const authority =
          value.compactRepairStructuredOutputCompatibility as {
            compatibility: Record<string, unknown>;
          };
        authority.compatibility.profileDigest = '0'.repeat(64);
      },
    );
    expect(
      verificationResult(fixture, compactIncompatiblePath),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: [
        'structured_output_compatibility_invalid',
      ],
    });

    const staleCatalogBindingPath = rewriteManifest(
      fixture,
      materialized.manifest,
      (value) => {
        const sourceRevision = value.sourceRevision as Record<
          string,
          unknown
        >;
        sourceRevision.sourceEvidenceCatalogDigest = '0'.repeat(64);
      },
    );
    expect(
      verificationResult(fixture, staleCatalogBindingPath),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: ['manifest_source_revision_mismatch'],
    });

    const staleOutputBudgetPath = rewriteManifest(
      fixture,
      materialized.manifest,
      (value) => {
        const requestPolicy = value.requestPolicy as {
          standardAttemptOutputBudget: {
            limits: number[];
          };
        };
        requestPolicy.standardAttemptOutputBudget.limits[0] += 1;
      },
    );
    expect(
      verificationResult(fixture, staleOutputBudgetPath),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: ['manifest_schema_invalid'],
    });
  });

  it.each([
    {
      label: 'manifest',
      key: null,
      mutate(value: Record<string, unknown>) {
        value.requestId = 'stale-manifest-request';
      },
      reason: 'manifest_digest_invalid',
    },
    {
      label: 'source authority request',
      key: 'sourceAuthorityRequest',
      mutate(value: Record<string, unknown>) {
        value.storyKey = 'stale_source_authority';
      },
      reason:
        'source_authority_request_schema_or_digest_invalid',
    },
    {
      label: 'source snapshot',
      key: 'sourceSnapshot',
      mutate(value: Record<string, unknown>) {
        const content = value.content as Record<
          string,
          unknown
        >;
        content.childGender = 'changed';
      },
      reason: 'source_snapshot_schema_or_digest_invalid',
    },
    {
      label: 'live authoring request',
      key: 'liveAuthoringRequest',
      mutate(value: Record<string, unknown>) {
        value.model = 'changed-model';
      },
      reason: 'live_authoring_request_policy_invalid',
    },
  ] as const)(
    'rejects stale $label authority',
    ({ key, mutate, reason }) => {
      const fixture = writeFixture();
      const materialized = materialize(fixture);
      const relativePath =
        key === null
          ? materialized.persistence.manifest.path
          : materialized.manifest.artifacts[
              key as ArtifactKey
            ].path;
      const value = readJson<Record<string, unknown>>(
        fixture,
        relativePath,
      );
      mutate(value);
      writeCanonical(fixture, relativePath, value);

      expect(
        verificationResult(
          fixture,
          materialized.persistence.manifest.path,
        ),
      ).toMatchObject({
        status: 'rejected',
        reasonCodes: expect.arrayContaining([reason]),
      });
    },
  );

  it('rejects a changed Story Source against otherwise valid portable artifacts', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const storyPath = absoluteArtifact(
      fixture,
      fixture.storyPath,
    );
    fs.writeFileSync(
      storyPath,
      fs
        .readFileSync(storyPath, 'utf8')
        .replace(
          'checks a paper plan on page 2',
          'checks a folded paper plan on page 2',
        ),
      'utf8',
    );

    expect(
      verificationResult(
        fixture,
        materialized.persistence.manifest.path,
      ),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: [
        'source_snapshot_current_story_mismatch',
      ],
    });
  });

  it('rejects canonical-domain failure before trusting a claimed digest', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    fs.writeFileSync(
      absoluteArtifact(
        fixture,
        materialized.manifest.artifacts.sourceSnapshot
          .path,
      ),
      '{"value":1e400}\n',
      'utf8',
    );

    expect(
      verificationResult(
        fixture,
        materialized.persistence.manifest.path,
      ),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: ['source_snapshot_json_domain_invalid'],
    });
  });

  it('rejects a recomputed manifest whose request linkage no longer matches', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const manifestPath = rewriteManifest(
      fixture,
      materialized.manifest,
      (manifest) => {
        manifest.requestId = 'different-request-id';
      },
    );

    expect(
      verificationResult(fixture, manifestPath),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: ['manifest_linkage_invalid'],
    });
  });

  it.each([
    {
      label: 'provider policy',
      mutate(value: Record<string, unknown>) {
        value.serviceTier = 'priority';
      },
      reason: 'live_authoring_request_policy_invalid',
    },
    {
      label: 'repair budget',
      mutate(value: Record<string, unknown>) {
        const callBudget = value.callBudget as Record<
          string,
          unknown
        >;
        callBudget.maxRepairCount = 8;
      },
      reason: 'live_authoring_request_policy_invalid',
    },
    {
      label: 'terminal-cleanup predecessor order',
      mutate(value: Record<string, unknown>) {
        const callBudget = value.callBudget as {
          terminalReferenceCleanup: Record<string, unknown>;
        };
        callBudget.terminalReferenceCleanup.eligiblePrecedingRepairModes = [
          'full_draft',
          'book_surface_patch',
        ];
      },
      reason: 'live_authoring_request_policy_invalid',
    },
    {
      label: 'terminal-cleanup duplicate predecessor',
      mutate(value: Record<string, unknown>) {
        const callBudget = value.callBudget as {
          terminalReferenceCleanup: Record<string, unknown>;
        };
        callBudget.terminalReferenceCleanup.eligiblePrecedingRepairModes = [
          'book_surface_patch',
          'book_surface_patch',
        ];
      },
      reason: 'live_authoring_request_policy_invalid',
    },
    {
      label: 'terminal-cleanup extra predecessor',
      mutate(value: Record<string, unknown>) {
        const callBudget = value.callBudget as {
          terminalReferenceCleanup: Record<string, unknown>;
        };
        callBudget.terminalReferenceCleanup.eligiblePrecedingRepairModes = [
          'book_surface_patch',
          'full_draft',
          'page_contract_patch',
        ];
      },
      reason: 'live_authoring_request_policy_invalid',
    },
    {
      label: 'prior prompt authority',
      mutate(value: Record<string, unknown>) {
        const promptAuthority = value.promptAuthority as {
          initial: Record<string, unknown>;
          repair: Record<string, unknown>;
        };
        promptAuthority.initial.systemPromptVersion =
          'vc-template-prompt/v8';
        promptAuthority.initial.userPromptVersion =
          'vc-template-user-prompt/v8';
        promptAuthority.repair.userPromptVersion =
          'vc-repair-user-prompt/v8';
      },
      reason:
        'live_authoring_request_not_canonical_current_policy',
    },
    {
      label: 'conservative reservation',
      mutate(value: Record<string, unknown>) {
        const costBudget = value.costBudget as Record<
          string,
          unknown
        >;
        costBudget.projectedMaxUsd = 10.001;
      },
      reason: 'live_authoring_request_cost_invalid',
    },
    {
      label: 'hard ceiling',
      mutate(value: Record<string, unknown>) {
        const costBudget = value.costBudget as Record<
          string,
          unknown
        >;
        costBudget.hardCeilingUsd = 10.01;
      },
      reason: 'live_authoring_request_cost_invalid',
    },
  ])(
    'rejects a content-addressed request with wrong $label',
    ({ mutate, reason }) => {
      const fixture = writeFixture();
      const materialized = materialize(fixture);
      const manifestPath = replaceAddressedRequest(
        fixture,
        materialized,
        mutate,
      );

      expect(
        verificationResult(fixture, manifestPath),
      ).toMatchObject({
        status: 'rejected',
        reasonCodes: expect.arrayContaining([reason]),
      });
    },
  );

  it('rejects a wrong-mode request even when its payload digest and manifest are recomputed', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const manifestPath = replaceAddressedRequest(
      fixture,
      materialized,
      (request) => {
        request.mode = 'preflight';
      },
    );

    expect(
      verificationResult(fixture, manifestPath),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: ['live_authoring_request_mode_invalid'],
    });
  });

  it('rejects a recomputed manifest with a substituted future command', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const manifestPath = rewriteManifest(
      fixture,
      materialized.manifest,
      (manifest) => {
        const futureLiveCommand =
          manifest.futureLiveCommand as {
            arguments: string[];
          };
        futureLiveCommand.arguments[0] =
          'scripts/substitute.cjs';
      },
    );

    expect(
      verificationResult(fixture, manifestPath),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: ['future_live_command_invalid'],
    });
  });

  it.each([
    'pageContractRepairStructuredOutputCompatibility',
    'representedElsewhereRepairStructuredOutputCompatibility',
    'structuralBundleRepairStructuredOutputCompatibility',
    'bookSurfaceRepairStructuredOutputCompatibility',
    'stablePropScopeRepairStructuredOutputCompatibility',
  ] as const)('rejects recomputed %s drift', (authorityKey) => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const manifestPath = rewriteManifest(
      fixture,
      materialized.manifest,
      (manifest) => {
        const authority =
          manifest[authorityKey] as {
            schemaDigest: string;
          };
        authority.schemaDigest = 'f'.repeat(64);
      },
    );

    expect(
      verificationResult(fixture, manifestPath),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: [
        'structured_output_compatibility_invalid',
      ],
    });
  });

  it.each([
    'sourceAuthorityRequest',
    'sourceSnapshot',
    'liveAuthoringRequest',
  ] as const)(
    'rejects a missing referenced %s artifact',
    (artifactKey) => {
      const fixture = writeFixture();
      const materialized = materialize(fixture);
      fs.rmSync(
        absoluteArtifact(
          fixture,
          materialized.manifest.artifacts[artifactKey].path,
        ),
      );

      expect(
        verificationResult(
          fixture,
          materialized.persistence.manifest.path,
        ),
      ).toMatchObject({
        status: 'rejected',
        reasonCodes: [
          `${
            artifactKey === 'sourceAuthorityRequest'
              ? 'source_authority_request'
              : artifactKey === 'sourceSnapshot'
                ? 'source_snapshot'
                : 'live_authoring_request'
          }_missing_or_unreadable`,
        ],
      });
    },
  );

  it('rejects a manifest path escape without echoing the path or environment-shaped text', () => {
    const fixture = writeFixture();
    const unsafe =
      '../OPENAI_API_KEY=must-not-appear.json';
    const result = verifyCanonicalLiveRequestBundle({
      repoRoot: fixture.repoRoot,
      manifestPath: unsafe,
    });

    expect(result).toEqual({
      version: CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
      status: 'rejected',
      zeroWrite: true,
      reasonCodes: ['manifest_path_invalid'],
    });
    expect(JSON.stringify(result)).not.toContain(
      'OPENAI_API_KEY',
    );
    expect(JSON.stringify(result)).not.toContain('..');
  });

  it('rejects a symlinked artifact using the repository collision/alias safety semantics', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const snapshotPath = absoluteArtifact(
      fixture,
      materialized.manifest.artifacts.sourceSnapshot.path,
    );
    const outsideRoot = tempRoot(
      'live-request-verification-outside-',
    );
    const outsideSnapshot = path.join(
      outsideRoot,
      'snapshot.json',
    );
    fs.copyFileSync(snapshotPath, outsideSnapshot);
    fs.rmSync(snapshotPath);
    try {
      fs.symlinkSync(
        outsideSnapshot,
        snapshotPath,
        'file',
      );
    } catch {
      return;
    }

    expect(
      verificationResult(
        fixture,
        materialized.persistence.manifest.path,
      ),
    ).toMatchObject({
      status: 'rejected',
      reasonCodes: expect.arrayContaining([
        'source_snapshot_symlink_alias_rejected',
      ]),
    });
  });
});

describe('production lifecycle canonical verification subprocess', () => {
  it('proves credential, provider, network, and write sentinels with positive controls', () => {
    const controls = [
      "'OPENAI_API_KEY' in process.env",
      "require('openai')",
      "fetch('https://network.invalid')",
      "require('node:fs').writeFileSync('forbidden.txt','x')",
    ];
    for (const control of controls) {
      const boundary = isolatedBoundaryRuntime();
      const result = spawnSync(
        process.execPath,
        [
          '--require',
          BOUNDARY_SENTINEL,
          '--eval',
          control,
        ],
        {
          cwd: REPO,
          encoding: 'utf8',
          env: boundary.env,
        },
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(
        /TEST_MATERIALIZATION_SENTINEL|TEST_NETWORK_SENTINEL|TEST_VERIFICATION_WRITE_SENTINEL/,
      );
    }
  });

  it('covers every installed synchronous, callback, stream, and promise write boundary', () => {
    const expectedTopLevel = [
      'appendFile',
      'appendFileSync',
      'chmod',
      'chmodSync',
      'chown',
      'chownSync',
      'copyFile',
      'copyFileSync',
      'cp',
      'cpSync',
      'createWriteStream',
      'link',
      'linkSync',
      'mkdir',
      'mkdirSync',
      'mkdtemp',
      'mkdtempSync',
      'rename',
      'renameSync',
      'rm',
      'rmSync',
      'rmdir',
      'rmdirSync',
      'symlink',
      'symlinkSync',
      'truncate',
      'truncateSync',
      'unlink',
      'unlinkSync',
      'utimes',
      'utimesSync',
      'writeFile',
      'writeFileSync',
    ];
    const expectedPromises = [
      'appendFile',
      'chmod',
      'chown',
      'copyFile',
      'cp',
      'link',
      'mkdir',
      'mkdtemp',
      'rename',
      'rm',
      'rmdir',
      'symlink',
      'truncate',
      'unlink',
      'utimes',
      'writeFile',
    ];
    const result = runBoundaryProbe('coverage');

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      fs: expectedTopLevel,
      promises: expectedPromises,
    });
  });

  it('rejects repository, output, temp-neighbor, traversal, alias, and multi-path writes', () => {
    const boundary = isolatedBoundaryRuntime();
    const cacheAlias = path.join(
      boundary.runtimeTempRoot,
      'tsx-cache-alias',
    );
    try {
      fs.symlinkSync(
        boundary.cacheRoot,
        cacheAlias,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      // The normalized alias target remains an explicit denied
      // neighbor even when this host cannot create directory links.
    }

    const result = runBoundaryProbe('paths', boundary);

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      'repository',
      'output',
      'temp_neighbor',
      'cache_traversal',
      'alias',
      'copy_source_escape',
      'copy_target_escape',
      'rename_target_escape',
      'link_target_escape',
      'symlink_target_escape',
      'multi_path_cache_only',
      'promise_cache_traversal',
      'promise_alias',
    ]);
    expect(
      fs.existsSync(
        path.join(
          REPO,
          'forbidden-live-request-verification-write.txt',
        ),
      ),
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(
          REPO,
          'outputs',
          'forbidden-live-request-verification-write.txt',
        ),
      ),
    ).toBe(false);
  });

  it('rejects an application write even when its stack contains a tsx source frame', () => {
    const result = runBoundaryProbe('old-stack-shape');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'TEST_VERIFICATION_WRITE_SENTINEL:fs:writeFileSync',
    );
    expect(result.stderr).toContain(
      'node_modules/tsx/application-write-frame.cjs',
    );
    expect(
      fs.existsSync(
        path.join(
          REPO,
          'forbidden-live-request-verification-write.txt',
        ),
      ),
    ).toBe(false);
  });

  it('rejects an existing cache-root junction or reparse alias', () => {
    const boundary = isolatedBoundaryRuntime();
    const actualCacheRoot = path.join(
      boundary.runtimeTempRoot,
      'actual-cache-root',
    );
    fs.mkdirSync(actualCacheRoot);
    fs.symlinkSync(
      actualCacheRoot,
      boundary.cacheRoot,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const result = runBoundaryProbe(
      'cache-root-signature',
      boundary,
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'TEST_VERIFICATION_WRITE_SENTINEL:fs:mkdirSync',
    );
  });

  it('rejects an existing cache-file hard-link alias', () => {
    const boundary = isolatedBoundaryRuntime();
    fs.mkdirSync(boundary.cacheRoot);
    const outsideTarget = path.join(
      boundary.runtimeTempRoot,
      'outside-cache-target.txt',
    );
    const original = 'must-remain-unchanged';
    fs.writeFileSync(outsideTarget, original);
    fs.linkSync(
      outsideTarget,
      path.join(
        boundary.cacheRoot,
        '12345-0123456789abcdef0123456789abcdef01234567',
      ),
    );

    const result = runBoundaryProbe(
      'cache-file-alias',
      boundary,
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'TEST_VERIFICATION_WRITE_SENTINEL:promises:writeFile',
    );
    expect(fs.readFileSync(outsideTarget, 'utf8')).toBe(
      original,
    );
  });

  it('runs the exact script file through local tsx and the server-only shim without credentials, network, or writes', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const before = fileTreeIdentity(fixture.repoRoot);
    const result = runVerifierCli(
      verifyArgs({
        fixture,
        manifestPath:
          materialized.persistence.manifest.path,
      }),
    );
    const after = fileTreeIdentity(fixture.repoRoot);

    expect(result.status, result.stderr).toBe(0);
    expect(parseCliResult(result)).toMatchObject({
      version: CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
      status: 'verified',
      zeroWrite: true,
      identities: {
        manifestDigest:
          materialized.persistence.manifest.digest,
      },
    });
    expect(after).toBe(before);
    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(
      /must-never-be-read|TEST_MATERIALIZATION_SENTINEL|TEST_NETWORK_SENTINEL|TEST_VERIFICATION_WRITE_SENTINEL/,
    );
  });

  it('proves the real tsx subprocess writes only its exact isolated cache namespace', () => {
    const fixture = writeFixture();
    const materialized = materialize(fixture);
    const result = runVerifierCli(
      verifyArgs({
        fixture,
        manifestPath:
          materialized.persistence.manifest.path,
      }),
      { traceWrites: true },
    );

    expect(result.status, result.stderr).toBe(0);
    const traceLine = result.stderr
      .split(/\r?\n/)
      .find((line) =>
        line.startsWith(
          'TEST_VERIFICATION_TSX_WRITE_TRACE:',
        ),
      );
    expect(traceLine).toBeDefined();
    const events = JSON.parse(
      traceLine!.slice(
        'TEST_VERIFICATION_TSX_WRITE_TRACE:'.length,
      ),
    ) as Array<{
      scope: string;
      method: string;
      target: string;
    }>;
    const cachePrefix = `tsx-${tsxCacheIdentity()}/`;

    expect(events).toEqual(
      expect.arrayContaining([
        {
          scope: 'fs',
          method: 'mkdirSync',
          target: `tsx-${tsxCacheIdentity()}`,
        },
      ]),
    );
    expect(
      events.some(
        (event) =>
          event.scope === 'promises' &&
          event.method === 'writeFile',
      ),
    ).toBe(true);
    for (const event of events) {
      if (
        event.scope === 'fs' &&
        event.method === 'mkdirSync'
      ) {
        expect(event.target).toBe(
          `tsx-${tsxCacheIdentity()}`,
        );
        continue;
      }
      expect(event.scope).toBe('promises');
      expect(['writeFile', 'unlink']).toContain(
        event.method,
      );
      expect(event.target).toMatch(
        new RegExp(
          `^${cachePrefix.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
          )}\\d{1,12}-[a-f0-9]{40}$`,
        ),
      );
    }
  });

  it.each([
    {
      label: 'unknown flag',
      tokens: ['--unknown', 'value'],
    },
    {
      label: 'duplicate flag',
      tokens: ['--repo-root', 'duplicate'],
    },
    {
      label: 'equals-form',
      tokens: ['--manifest=invalid', 'value'],
    },
    {
      label: 'positional input',
      tokens: ['positional', 'value'],
    },
    {
      label: 'missing value',
      tokens: ['--manifest'],
    },
    {
      label: 'missing required flag',
      replace: [
        'source-authoring-live-request-verify',
        '--repo-root',
      ],
    },
    {
      label: 'wrong public mode',
      tokens: ['--mode', 'live'],
    },
  ])(
    'rejects $label with one bounded parser result',
    ({ tokens = [], replace }) => {
      const fixture = writeFixture();
      const materialized = materialize(fixture);
      const base = verifyArgs({
        fixture,
        manifestPath:
          materialized.persistence.manifest.path,
      });
      const args = replace
        ? [...replace, fixture.repoRoot]
        : [...base, ...tokens];
      const result = runVerifierCli(args);

      expect(result.status).not.toBe(0);
      expect(parseCliResult(result)).toEqual({
        version:
          CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
        status: 'rejected',
        zeroWrite: true,
        reasonCodes: [
          'verification_cli_arguments_invalid',
        ],
      });
      expect(result.stderr).toBe('');
    },
  );

  it('returns deterministic repeated failure without path, stack, secret, or provider payload leakage', () => {
    const fixture = writeFixture();
    const unsafeManifest =
      '../OPENAI_API_KEY=secret-provider-payload.json';
    const args = verifyArgs({
      fixture,
      manifestPath: unsafeManifest,
    });
    const first = runVerifierCli(args);
    const second = runVerifierCli(args);

    expect(first.status).not.toBe(0);
    expect(second.status).not.toBe(0);
    expect(first.stdout).toBe(second.stdout);
    expect(first.stderr).toBe('');
    expect(second.stderr).toBe('');
    expect(first.stdout).not.toContain(fixture.repoRoot);
    expect(first.stdout).not.toMatch(
      /OPENAI_API_KEY|secret-provider-payload|stack|at\s+\w+/i,
    );
    expect(parseCliResult(first)).toEqual({
      version: CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
      status: 'rejected',
      zeroWrite: true,
      reasonCodes: ['manifest_path_invalid'],
    });
  });
});
