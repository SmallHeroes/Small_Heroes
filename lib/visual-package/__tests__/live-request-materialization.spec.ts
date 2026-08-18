import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
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
  LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
  LIVE_REQUEST_MATERIALIZATION_MANIFEST_VERSION,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
  STORY_SOURCE_AUTHORITY_REQUEST_ARTIFACT_VERSION,
  assertValidLiveRequestMaterializationManifest,
  assertValidStorySourceAuthorityRequestArtifact,
  buildVisualContractAuthoringStandardAttemptOutputBudget,
  buildCanonicalMaterializationInputEnvelope,
  liveRequestPolicyAuthorityIssues,
  liveRequestMaterializationInputIssues,
  liveRequestMaterializationManifestIssues,
  materializeCanonicalLiveRequestBundle,
  projectedMaximumAuthoringCostWithTerminalReferenceCleanupUsd,
  storySourceAuthorityRequestArtifactIssues,
  writeCanonicalMaterializationInput,
  type LiveRequestMaterializationInput,
  type StorySourceAuthorityRequestArtifact,
  type VisualContractAuthoringRequest,
} from '@/lib/visual-package';
import {
  canonicalLiveAuthoringJsonBytes,
  createContainedContentAddressedJsonArtifactStore,
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
const EXTERNAL_BOUNDARY_SENTINEL = path.join(
  REPO,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'deny-live-request-materialization-external-boundaries.cjs',
);
const REQUESTED_AT = '2026-07-27T12:00:00.000Z';
const tempRoots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(prefix = 'live-request-materialization-'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function storyMarkdown(
  pageCount: number,
  pageNumbers = Array.from(
    { length: pageCount },
    (_, index) => index + 1,
  ),
): string {
  return [
    '---',
    'title: "General live request fixture"',
    'gender: female',
    `pages: ${pageCount}`,
    '---',
    '',
    ...pageNumbers.flatMap((pageNumber) => [
      `--- Page ${pageNumber} ---`,
      `In the shared reading room, the child studies a paper map on page ${pageNumber}, notices the window light, and chooses one calm next step.`,
      '',
      `imageDirection: A calm general composition for page ${pageNumber}, with the paper map visible.`,
      '',
    ]),
  ].join('\n');
}

function writeFixture(args: {
  pageCount?: number;
  pageNumbers?: number[];
  cover?: boolean;
} = {}): {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
} {
  const repoRoot = tempRoot();
  const storyKey = 'general_live_request_fixture';
  const storyPath = `stories/${storyKey}.md`;
  const storyAbsolute = path.join(repoRoot, storyPath);
  fs.mkdirSync(path.dirname(storyAbsolute), {
    recursive: true,
  });
  fs.writeFileSync(
    storyAbsolute,
    storyMarkdown(
      args.pageCount ?? 3,
      args.pageNumbers,
    ),
    'utf8',
  );
  if (args.cover) {
    fs.writeFileSync(
      storyAbsolute.replace(
        /\.md$/,
        '.location-bible.json',
      ),
      `${JSON.stringify(
        {
          allowedZones: [{ id: 'reading_room_window' }],
          pagePlans: [
            {
              page: 0,
              zoneId: 'reading_room_window',
              visibleAnchors: ['wide window', 'paper map'],
              forbiddenDrift: ['no hidden object on cover'],
              visualSpoilerPolicy: {
                hiddenObjects: ['covered_object'],
              },
              pageAction: 'the child studies the paper map',
            },
          ],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }
  return { repoRoot, storyKey, storyPath };
}

function inputFor(
  fixture: ReturnType<typeof writeFixture>,
  overrides: Partial<LiveRequestMaterializationInput> = {},
): LiveRequestMaterializationInput {
  return {
    version: LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
    repoRoot: fixture.repoRoot,
    storyKey: fixture.storyKey,
    storyPath: fixture.storyPath,
    requestId: 'request-general-live-001',
    requestedAt: REQUESTED_AT,
    ...overrides,
  };
}

function writeInput(
  fixture: ReturnType<typeof writeFixture>,
  value: unknown = inputFor(fixture),
): string {
  const issues = liveRequestMaterializationInputIssues(value);
  if (
    issues.length === 0 &&
    (value as LiveRequestMaterializationInput).repoRoot ===
      fixture.repoRoot
  ) {
    const input = value as LiveRequestMaterializationInput;
    return writeCanonicalMaterializationInput({
      mode: 'source-authoring-live-request',
      repoRoot: fixture.repoRoot,
      outputDir: 'inputs',
      storyKey: input.storyKey,
      storyPath: input.storyPath,
      requestId: input.requestId,
      requestedAt: input.requestedAt,
    }).artifact.path;
  }
  const envelope = buildCanonicalMaterializationInputEnvelope({
    kind: 'source-authoring-live-request',
    payloadSchemaVersion:
      LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
    payload: value,
  });
  const relativePath =
    `inputs/canonical-materialization-inputs/source-authoring-live-request/${envelope.digest}.json`;
  const absolute = path.join(
    fixture.repoRoot,
    relativePath,
  );
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(
    absolute,
    canonicalLiveAuthoringJsonBytes(envelope),
    'utf8',
  );
  return relativePath;
}

function readJson<T>(
  repoRoot: string,
  relativePath: string,
): T {
  return JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, relativePath),
      'utf8',
    ),
  ) as T;
}

function materialize(
  fixture: ReturnType<typeof writeFixture>,
  outputDir = 'outputs/live-request',
) {
  return materializeCanonicalLiveRequestBundle({
    repoRoot: fixture.repoRoot,
    requestPath: writeInput(fixture),
    outputDir,
  });
}

function runCli(args: string[]) {
  return spawnSync(
    process.execPath,
    [
      TSX,
      '--require',
      SHIM,
      '--require',
      EXTERNAL_BOUNDARY_SENTINEL,
      CLI,
      ...args,
    ],
    {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        OPENAI_API_KEY: 'must-never-be-read',
      },
    },
  );
}

function materializeCliArgs(args: {
  fixture: ReturnType<typeof writeFixture>;
  requestPath: string;
  outputDir?: string;
}): string[] {
  return [
    'source-authoring-live-request-materialize',
    '--repo-root',
    args.fixture.repoRoot,
    '--request',
    args.requestPath,
    '--out',
    args.outputDir ?? 'outputs/cli-live-request',
  ];
}

function createDirectoryLink(
  target: string,
  linkPath: string,
): boolean {
  try {
    fs.mkdirSync(path.dirname(linkPath), {
      recursive: true,
    });
    fs.symlinkSync(
      target,
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    return true;
  } catch {
    return false;
  }
}

describe('canonical live request materialization validators', () => {
  it('rejects legacy B0 materialization input versions and requires explicit current rematerialization', () => {
    const fixture = writeFixture();
    expect(
      liveRequestMaterializationInputIssues({
        ...inputFor(fixture),
        version:
          'canonical-live-request-materialization-input/v20',
      }),
    ).toContain('materialization_input_version_invalid');
    expect(LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION).toBe(
      'canonical-live-request-materialization-input/v29',
    );
    expect(
      LIVE_REQUEST_MATERIALIZATION_MANIFEST_VERSION,
    ).toBe('canonical-live-request-materialization/v38');
  });

  it.each([
    {
      label: 'non-object',
      mutate: () => null,
      issue: 'materialization_input_not_object',
    },
    {
      label: 'missing scalar',
      mutate: (value: Record<string, unknown>) => {
        delete value.requestId;
        return value;
      },
      issue: 'materialization_input_field_missing:requestId',
    },
    {
      label: 'unknown field',
      mutate: (value: Record<string, unknown>) => ({
        ...value,
        provider: 'forbidden',
      }),
      issue: 'materialization_input_unknown_field',
    },
    {
      label: 'non-canonical timestamp',
      mutate: (value: Record<string, unknown>) => ({
        ...value,
        requestedAt: '2026-07-27',
      }),
      issue: 'materialization_requested_at_invalid',
    },
    {
      label: 'impossible timestamp',
      mutate: (value: Record<string, unknown>) => ({
        ...value,
        requestedAt: '2026-02-31T12:00:00.000Z',
      }),
      issue: 'materialization_requested_at_invalid',
    },
    {
      label: 'unsafe request ID',
      mutate: (value: Record<string, unknown>) => ({
        ...value,
        requestId: 'request with spaces',
      }),
      issue: 'materialization_request_id_invalid',
    },
    {
      label: 'absolute story path',
      mutate: (value: Record<string, unknown>) => ({
        ...value,
        storyPath: path.resolve('outside.md'),
      }),
      issue: 'materialization_story_path_invalid',
    },
    {
      label: 'story traversal',
      mutate: (value: Record<string, unknown>) => ({
        ...value,
        storyPath: '../outside.md',
      }),
      issue: 'materialization_story_path_invalid',
    },
  ])(
    'rejects $label totally and deterministically',
    ({ mutate, issue }) => {
      const fixture = writeFixture();
      const original = inputFor(
        fixture,
      ) as unknown as Record<string, unknown>;
      const value = mutate({ ...original });
      expect(
        liveRequestMaterializationInputIssues(value),
      ).toContain(issue);
      expect(
        liveRequestMaterializationInputIssues(value),
      ).toEqual(
        liveRequestMaterializationInputIssues(value),
      );
    },
  );

  it('validates the source authority envelope and rejects stale or unknown authority', () => {
    const fixture = writeFixture();
    const result = materialize(fixture);
    const artifact =
      readJson<StorySourceAuthorityRequestArtifact>(
        fixture.repoRoot,
        result.persistence.sourceAuthorityRequest.path,
      );
    expect(() =>
      assertValidStorySourceAuthorityRequestArtifact(
        artifact,
      ),
    ).not.toThrow();
    expect(artifact.version).toBe(
      STORY_SOURCE_AUTHORITY_REQUEST_ARTIFACT_VERSION,
    );
    expect(
      storySourceAuthorityRequestArtifactIssues({
        ...artifact,
        storyPath: 'stories/changed.md',
      }),
    ).toContain('source_authority_request_digest_stale');
    expect(
      storySourceAuthorityRequestArtifactIssues({
        ...artifact,
        extra: true,
      }),
    ).toContain('source_authority_request_unknown_field');
  });

  it('validates the deterministic manifest and fails closed on malformed nested values', () => {
    const fixture = writeFixture({ cover: true });
    const result = materialize(fixture);
    expect(() =>
      assertValidLiveRequestMaterializationManifest(
        result.manifest,
      ),
    ).not.toThrow();
    expect(
      liveRequestMaterializationManifestIssues({
        ...result.manifest,
        sourceRevision: {
          ...result.manifest.sourceRevision,
          pageCount: Number.NaN,
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        'materialization_manifest_source_pages_invalid',
        'materialization_manifest_digest_domain_invalid',
      ]),
    );
  });
});

describe('canonical live request materialization artifacts', () => {
  it('rejects exact projected arithmetic above the hard ceiling', () => {
    const result = materialize(
      writeFixture({ pageCount: 12 }),
    );
    const policy = structuredClone(result.manifest.requestPolicy);
    const overCeilingSchedule =
      buildVisualContractAuthoringStandardAttemptOutputBudget(13);
    policy.standardAttemptOutputBudget = overCeilingSchedule;
    policy.projectedMaxUsd =
      projectedMaximumAuthoringCostWithTerminalReferenceCleanupUsd({
        standardMaxInputTokens: 64_000,
        standardAttemptOutputLimits: overCeilingSchedule.limits,
        cleanupMaxInputTokens: 12_000,
        cleanupMaxOutputTokens: 1_000,
        cleanupMaxCalls: 1,
      });
    (policy as { hardCeilingUsd: number }).hardCeilingUsd = 7;
    expect(policy.projectedMaxUsd).toBeGreaterThan(
      policy.hardCeilingUsd,
    );
    expect(
      liveRequestPolicyAuthorityIssues(policy, 'qa_policy'),
    ).toContain('qa_policy_cost_invalid');
  });

  it('materializes the exact 12-page live policy and a non-authorizing future command', () => {
    const fixture = writeFixture({
      pageCount: 12,
      cover: true,
    });
    const result = materialize(fixture);
    const request = readJson<VisualContractAuthoringRequest>(
      fixture.repoRoot,
      result.persistence.liveAuthoringRequest.path,
    );

    expect(result.status).toBe('materialized_inputs_only');
    expect(request).toMatchObject({
      version: 'visual-contract-authoring-request/v40',
      mode: 'live',
      provider: 'openai',
      endpoint: 'responses',
      model: 'gpt-5.6-sol',
      serviceTier: 'default',
      reasoningEffort: 'medium',
      toolsDisabled: true,
      noFallback: true,
      transportRetries: 0,
      timeoutMs: 1_200_000,
      tokenBudget: {
        maxInputTokens: 64_000,
        standardAttempts: {
          version:
            'visual-contract-authoring-standard-attempt-output-budget/v5',
          limits: [40_000, 32_000, 36_000, 36_000, 36_000, 36_000],
          totalPool: 216_000,
        },
        outputIncludesReasoning: true,
      },
      callBudget: {
        maxCalls: 7,
        maxRepairCount: 6,
        standardMaxCalls: 6,
        standardMaxRepairCount: 5,
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
      },
      promptAuthority: {
        initial: {
          systemPromptVersion: 'vc-template-prompt/v13',
          userPromptVersion: 'vc-template-user-prompt/v13',
        },
        repair: {
          systemPromptVersion: 'vc-repair-prompt/v13',
          userPromptVersion: 'vc-repair-user-prompt/v13',
        },
        bookSurfaceRepair: {
          systemPromptVersion: 'book-surface-repair-prompt/v10',
          userPromptVersion: 'book-surface-repair-user-prompt/v10',
        },
      },
      costBudget: {
        projectedMaxUsd: 9.883501,
        hardCeilingUsd: 10,
      },
      structuredOutput: {
        schemaName: 'BookVisualContractTemplateDraft',
        schemaVersion: 'vc-draft-schema/v15',
        compatibilityProfileVersion:
          OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
        compatibilityProfileDigest:
          OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST,
        compatibilityEvidenceVersion:
          OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION,
        compatibilityStatus: 'compatible',
      },
      bookSurfaceRepairStructuredOutput: {
        schemaName: 'BookSurfaceRepairPatch',
        schemaVersion: 'book-surface-repair-schema/v6',
        compatibilityStatus: 'compatible',
      },
    });
    expect(result.manifest).toMatchObject({
      version:
        LIVE_REQUEST_MATERIALIZATION_MANIFEST_VERSION,
      status: 'materialized_inputs_only',
      sourceRevision: {
        storyKey: fixture.storyKey,
        storyPath: fixture.storyPath,
        pageCount: 12,
        pageNumbers: Array.from(
          { length: 12 },
          (_, index) => index + 1,
        ),
        authoredCoverAuthorityPresent: true,
      },
      externalBoundaryEvidence: {
        providerCalls: 0,
        modelCalls: 0,
        transportRetriesAuthorized: 0,
        credentialLoadingAuthorized: false,
        pricingLookupPerformed: false,
      },
      structuredOutputCompatibility: {
        schemaName: request.structuredOutput.schemaName,
        schemaVersion: request.structuredOutput.schemaVersion,
        schemaDigest: request.structuredOutput.schemaDigest,
        compatibility: {
          profileVersion:
            request.structuredOutput.compatibilityProfileVersion,
          profileDigest:
            request.structuredOutput.compatibilityProfileDigest,
          evidenceVersion:
            request.structuredOutput.compatibilityEvidenceVersion,
          evidenceDigest:
            request.structuredOutput.compatibilityEvidenceDigest,
          status: 'compatible',
          serializedSchemaDigest:
            request.structuredOutput.serializedSchemaDigest,
        },
      },
      compactRepairStructuredOutputCompatibility: {
        schemaName:
          request.compactRepairStructuredOutput.schemaName,
        schemaVersion:
          request.compactRepairStructuredOutput.schemaVersion,
        schemaDigest:
          request.compactRepairStructuredOutput.schemaDigest,
        compatibility: {
          profileVersion:
            request.compactRepairStructuredOutput
              .compatibilityProfileVersion,
          profileDigest:
            request.compactRepairStructuredOutput
              .compatibilityProfileDigest,
          evidenceVersion:
            request.compactRepairStructuredOutput
              .compatibilityEvidenceVersion,
          evidenceDigest:
            request.compactRepairStructuredOutput
              .compatibilityEvidenceDigest,
          status: 'compatible',
          serializedSchemaDigest:
            request.compactRepairStructuredOutput
              .serializedSchemaDigest,
        },
      },
      pageContractRepairStructuredOutputCompatibility: {
        schemaName:
          request.pageContractRepairStructuredOutput.schemaName,
        schemaVersion:
          request.pageContractRepairStructuredOutput.schemaVersion,
        schemaDigest:
          request.pageContractRepairStructuredOutput.schemaDigest,
        compatibility: {
          profileVersion:
            request.pageContractRepairStructuredOutput
              .compatibilityProfileVersion,
          profileDigest:
            request.pageContractRepairStructuredOutput
              .compatibilityProfileDigest,
          evidenceVersion:
            request.pageContractRepairStructuredOutput
              .compatibilityEvidenceVersion,
          evidenceDigest:
            request.pageContractRepairStructuredOutput
              .compatibilityEvidenceDigest,
          status: 'compatible',
          serializedSchemaDigest:
            request.pageContractRepairStructuredOutput
              .serializedSchemaDigest,
        },
      },
      bookSurfaceRepairStructuredOutputCompatibility: {
        schemaName:
          request.bookSurfaceRepairStructuredOutput.schemaName,
        schemaVersion:
          request.bookSurfaceRepairStructuredOutput.schemaVersion,
        schemaDigest:
          request.bookSurfaceRepairStructuredOutput.schemaDigest,
        compatibility: {
          profileVersion:
            request.bookSurfaceRepairStructuredOutput
              .compatibilityProfileVersion,
          profileDigest:
            request.bookSurfaceRepairStructuredOutput
              .compatibilityProfileDigest,
          evidenceVersion:
            request.bookSurfaceRepairStructuredOutput
              .compatibilityEvidenceVersion,
          evidenceDigest:
            request.bookSurfaceRepairStructuredOutput
              .compatibilityEvidenceDigest,
          status: 'compatible',
          serializedSchemaDigest:
            request.bookSurfaceRepairStructuredOutput
              .serializedSchemaDigest,
        },
      },
    });
    expect(
      request.structuredOutput.serializedSchemaDigest,
    ).toBe(request.structuredOutput.schemaDigest);
    expect(
      request.compactRepairStructuredOutput
        .serializedSchemaDigest,
    ).toBe(request.compactRepairStructuredOutput.schemaDigest);
    expect(
      request.pageContractRepairStructuredOutput
        .serializedSchemaDigest,
    ).toBe(request.pageContractRepairStructuredOutput.schemaDigest);
    expect(
      request.bookSurfaceRepairStructuredOutput
        .serializedSchemaDigest,
    ).toBe(request.bookSurfaceRepairStructuredOutput.schemaDigest);
    expect(
      result.manifest.futureLiveCommand.arguments,
    ).toEqual([
      'scripts/visual-contract-authoring.cjs',
      'live',
      '--repo-root',
      fs.realpathSync(fixture.repoRoot),
      '--source-authority-request',
      result.persistence.sourceAuthorityRequest.path,
      '--snapshot',
      result.persistence.sourceSnapshot.path,
      '--request',
      result.persistence.liveAuthoringRequest.path,
      '--out',
      'outputs/live-request',
    ]);
    expect(
      fs.existsSync(
        path.join(
          fixture.repoRoot,
          'outputs/live-request/contract-candidates',
        ),
      ),
    ).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(
      /apiKey|OPENAI_API_KEY|Bearer|credentialValue|rawPrompt|rawResponse/i,
    );
  });

  it('is deterministic and identical-existing idempotent', () => {
    const fixture = writeFixture({ cover: true });
    const first = materialize(fixture);
    const second = materialize(fixture);
    expect(second.manifest).toEqual(first.manifest);
    expect(second.persistence).toEqual({
      sourceAuthorityRequest: {
        ...first.persistence.sourceAuthorityRequest,
        created: false,
      },
      sourceSnapshot: {
        ...first.persistence.sourceSnapshot,
        created: false,
      },
      liveAuthoringRequest: {
        ...first.persistence.liveAuthoringRequest,
        created: false,
      },
      manifest: {
        ...first.persistence.manifest,
        created: false,
      },
    });
  });

  it('keeps semantically identical historical pretty JSON byte-compatible without rewriting', () => {
    const fixture = writeFixture();
    const first = materialize(fixture);
    const snapshotPath = path.join(
      fixture.repoRoot,
      first.persistence.sourceSnapshot.path,
    );
    const snapshot = readJson<Record<string, unknown>>(
      fixture.repoRoot,
      first.persistence.sourceSnapshot.path,
    );
    const reordered = {
      digest: snapshot.digest,
      content: snapshot.content,
      version: snapshot.version,
      digestAlgorithm: snapshot.digestAlgorithm,
    };
    const historicalBytes = `${JSON.stringify(
      reordered,
      null,
      4,
    )}\n`;
    fs.writeFileSync(snapshotPath, historicalBytes, 'utf8');

    const second = materialize(fixture);
    expect(second.persistence.sourceSnapshot.created).toBe(
      false,
    );
    expect(fs.readFileSync(snapshotPath, 'utf8')).toBe(
      historicalBytes,
    );
  });

  it('rejects a true immutable content-address collision without overwriting it', () => {
    const fixture = writeFixture();
    const first = materialize(fixture);
    const requestPath = path.join(
      fixture.repoRoot,
      first.persistence.liveAuthoringRequest.path,
    );
    const collisionBytes = '{"collision":true}\n';
    fs.writeFileSync(requestPath, collisionBytes, 'utf8');
    expect(() => materialize(fixture)).toThrow(
      /immutable artifact collision/,
    );
    expect(fs.readFileSync(requestPath, 'utf8')).toBe(
      collisionBytes,
    );
  });

  it('changes snapshot, live-request, and manifest authority when the Story Source changes', () => {
    const fixture = writeFixture({ cover: true });
    const first = materialize(fixture);
    const storyAbsolute = path.join(
      fixture.repoRoot,
      fixture.storyPath,
    );
    fs.writeFileSync(
      storyAbsolute,
      fs
        .readFileSync(storyAbsolute, 'utf8')
        .replace(
          'studies a paper map on page 2',
          'studies a folded paper map on page 2',
        ),
      'utf8',
    );
    const second = materialize(fixture);
    expect(
      second.persistence.sourceAuthorityRequest.digest,
    ).toBe(first.persistence.sourceAuthorityRequest.digest);
    expect(second.persistence.sourceSnapshot.digest).not.toBe(
      first.persistence.sourceSnapshot.digest,
    );
    expect(
      second.persistence.liveAuthoringRequest.digest,
    ).not.toBe(first.persistence.liveAuthoringRequest.digest);
    expect(second.persistence.manifest.digest).not.toBe(
      first.persistence.manifest.digest,
    );
  });

  it('binds adjacent authored cover authority even when normalized Story Source bytes stay unchanged', () => {
    const fixture = writeFixture({ cover: true });
    const first = materialize(fixture);
    const firstManifest = first.manifest;
    const coverPath = path.join(
      fixture.repoRoot,
      fixture.storyPath.replace(
        /\.md$/,
        '.location-bible.json',
      ),
    );
    const cover = JSON.parse(
      fs.readFileSync(coverPath, 'utf8'),
    ) as {
      pagePlans: Array<{ visibleAnchors: string[] }>;
    };
    cover.pagePlans[0]?.visibleAnchors.push(
      'stable reading lamp',
    );
    fs.writeFileSync(
      coverPath,
      `${JSON.stringify(cover, null, 2)}\n`,
      'utf8',
    );
    const second = materialize(fixture);
    expect(
      second.manifest.sourceRevision.normalizedSourceDigest,
    ).toBe(
      firstManifest.sourceRevision.normalizedSourceDigest,
    );
    expect(second.persistence.sourceSnapshot.digest).not.toBe(
      first.persistence.sourceSnapshot.digest,
    );
    expect(
      second.persistence.liveAuthoringRequest.digest,
    ).not.toBe(first.persistence.liveAuthoringRequest.digest);
  });

  it('refuses a 13-page source before creating an output root', () => {
    const fixture = writeFixture({ pageCount: 13 });
    const requestPath = writeInput(fixture);
    expect(() =>
      materializeCanonicalLiveRequestBundle({
        repoRoot: fixture.repoRoot,
        requestPath,
        outputDir: 'outputs/too-large',
      }),
    ).toThrow(/page_budget_partition_decision_required/);
    expect(
      fs.existsSync(
        path.join(fixture.repoRoot, 'outputs/too-large'),
      ),
    ).toBe(false);
  });

  it('refuses an incomplete page map before writing', () => {
    const fixture = writeFixture({
      pageCount: 3,
      pageNumbers: [1, 3, 4],
    });
    const requestPath = writeInput(fixture);
    expect(() =>
      materializeCanonicalLiveRequestBundle({
        repoRoot: fixture.repoRoot,
        requestPath,
        outputDir: 'outputs/incomplete',
      }),
    ).toThrow(/materialization_source_page_map_incomplete/);
    expect(
      fs.existsSync(
        path.join(fixture.repoRoot, 'outputs/incomplete'),
      ),
    ).toBe(false);
  });
});

describe('live request materialization path and root safety', () => {
  it('rejects duplicate or traversal-shaped artifact categories before creating output', () => {
    const fixture = writeFixture();
    expect(() =>
      createContainedContentAddressedJsonArtifactStore({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/invalid-categories',
        categories: ['valid', '../escape'],
        errorPrefix: 'test materialization',
      }),
    ).toThrow(/artifact categories are invalid/);
    expect(() =>
      createContainedContentAddressedJsonArtifactStore({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/invalid-categories',
        categories: ['duplicate', 'duplicate'],
        errorPrefix: 'test materialization',
      }),
    ).toThrow(/artifact categories are invalid/);
    expect(
      fs.existsSync(
        path.join(
          fixture.repoRoot,
          'outputs/invalid-categories',
        ),
      ),
    ).toBe(false);
  });

  it('rejects traversal and absolute control paths', () => {
    const fixture = writeFixture();
    writeInput(fixture);
    expect(() =>
      materializeCanonicalLiveRequestBundle({
        repoRoot: fixture.repoRoot,
        requestPath: '../materialize.json',
        outputDir: 'outputs/live-request',
      }),
    ).toThrow(
      /canonical_materialization_input_filesystem_rejected/,
    );
    expect(() =>
      materializeCanonicalLiveRequestBundle({
        repoRoot: fixture.repoRoot,
        requestPath: path.join(
          fixture.repoRoot,
          'inputs/canonical-materialization-inputs/source-authoring-live-request/not-an-address.json',
        ),
        outputDir: 'outputs/live-request',
      }),
    ).toThrow(
      /canonical_materialization_input_filesystem_rejected/,
    );
  });

  it('rejects a control request rooted in a different repository', () => {
    const fixture = writeFixture();
    const otherRoot = tempRoot('other-materialization-root-');
    const requestPath = writeInput(
      fixture,
      inputFor(fixture, { repoRoot: otherRoot }),
    );
    expect(() =>
      materializeCanonicalLiveRequestBundle({
        repoRoot: fixture.repoRoot,
        requestPath,
        outputDir: 'outputs/live-request',
      }),
    ).toThrow(/materialization_input_repo_root_mismatch/);
  });

  it('rejects a Story Source directory junction that escapes the repository', () => {
    const fixture = writeFixture();
    const outside = tempRoot('outside-story-root-');
    fs.writeFileSync(
      path.join(outside, 'outside.md'),
      storyMarkdown(3),
      'utf8',
    );
    const linked = path.join(fixture.repoRoot, 'linked');
    if (!createDirectoryLink(outside, linked)) return;
    const requestPath = writeInput(
      fixture,
      inputFor(fixture, {
        storyPath: 'linked/outside.md',
      }),
    );
    expect(() =>
      materializeCanonicalLiveRequestBundle({
        repoRoot: fixture.repoRoot,
        requestPath,
        outputDir: 'outputs/live-request',
      }),
    ).toThrow(/resolves_outside_repository/);
  });

  it('rejects an output directory junction that escapes the repository', () => {
    const fixture = writeFixture();
    const outside = tempRoot('outside-output-root-');
    const linked = path.join(
      fixture.repoRoot,
      'outputs',
      'linked',
    );
    if (!createDirectoryLink(outside, linked)) return;
    const requestPath = writeInput(fixture);
    expect(() =>
      materializeCanonicalLiveRequestBundle({
        repoRoot: fixture.repoRoot,
        requestPath,
        outputDir: 'outputs/linked/bundle',
      }),
    ).toThrow(/resolves outside the repository/);
    expect(
      fs.readdirSync(outside, { withFileTypes: true }),
    ).toHaveLength(0);
  });
});

describe('production lifecycle live-request materialization CLI', () => {
  it('proves the external-boundary sentinel blocks credential, provider-module, and network positive controls', () => {
    const credential = spawnSync(
      process.execPath,
      [
        '--require',
        EXTERNAL_BOUNDARY_SENTINEL,
        '--eval',
        "'OPENAI_API_KEY' in process.env",
      ],
      { cwd: REPO, encoding: 'utf8' },
    );
    expect(credential.status).not.toBe(0);
    expect(credential.stderr).toContain(
      'credential existence boundary was invoked',
    );

    const credentialValue = spawnSync(
      process.execPath,
      [
        '--require',
        EXTERNAL_BOUNDARY_SENTINEL,
        '--eval',
        'void process.env.OPENAI_API_KEY',
      ],
      { cwd: REPO, encoding: 'utf8' },
    );
    expect(credentialValue.status).not.toBe(0);
    expect(credentialValue.stderr).toContain(
      'credential boundary was invoked',
    );

    const provider = spawnSync(
      process.execPath,
      [
        '--require',
        EXTERNAL_BOUNDARY_SENTINEL,
        '--eval',
        "require('openai')",
      ],
      { cwd: REPO, encoding: 'utf8' },
    );
    expect(provider.status).not.toBe(0);
    expect(provider.stderr).toContain(
      'provider module was imported',
    );

    const network = spawnSync(
      process.execPath,
      [
        '--require',
        EXTERNAL_BOUNDARY_SENTINEL,
        '--eval',
        "fetch('https://network.invalid')",
      ],
      { cwd: REPO, encoding: 'utf8' },
    );
    expect(network.status).not.toBe(0);
    expect(network.stderr).toMatch(
      /TEST_NETWORK_SENTINEL|network/i,
    );
  });

  it('runs the real command under throwing credential/provider/network boundaries', () => {
    const fixture = writeFixture({
      pageCount: 12,
      cover: true,
    });
    const requestPath = writeInput(fixture);
    const result = runCli(
      materializeCliArgs({ fixture, requestPath }),
    );
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(
      result.stdout,
    ) as Record<string, unknown>;
    expect(output).toMatchObject({
      mode: 'canonical_live_request_materialization',
      status: 'materialized_inputs_only',
    });
    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(
      /TEST_MATERIALIZATION_SENTINEL|TEST_NETWORK_SENTINEL/,
    );
  });

  it.each([
    {
      label: 'unknown flag',
      tokens: ['--unknown', 'value'],
    },
    {
      label: 'duplicate flag',
      tokens: [] as string[],
      duplicate: true,
    },
    {
      label: 'positional token',
      tokens: ['positional', 'value'],
    },
    {
      label: 'equals-form flag',
      tokens: ['--out=outputs/invalid', 'value'],
    },
    {
      label: 'incompatible write flag',
      tokens: ['--write', 'true'],
    },
    {
      label: 'help mixture',
      tokens: ['--help', 'true'],
    },
  ])(
    'fails closed on $label before materialization',
    ({ tokens, duplicate }) => {
      const fixture = writeFixture();
      const requestPath = writeInput(fixture);
      const valid = materializeCliArgs({
        fixture,
        requestPath,
        outputDir: 'outputs/invalid',
      });
      const args = duplicate
        ? [
            ...valid.slice(0, 3),
            '--repo-root',
            fixture.repoRoot,
            ...valid.slice(3),
          ]
        : [...valid, ...tokens];
      const result = runCli(args);
      expect(result.status).not.toBe(0);
      expect(
        fs.existsSync(
          path.join(fixture.repoRoot, 'outputs/invalid'),
        ),
      ).toBe(false);
    },
  );

  it('fails closed on a missing required flag', () => {
    const fixture = writeFixture();
    const requestPath = writeInput(fixture);
    const result = runCli([
      'source-authoring-live-request-materialize',
      '--repo-root',
      fixture.repoRoot,
      '--request',
      requestPath,
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'missing required flag: --out',
    );
  });
});

describe('stale materialized input rejection before provider construction', () => {
  it('rejects an old materialized bundle through the canonical boundary with the provider factory unreachable', async () => {
    const fixture = writeFixture({
      pageCount: 3,
      cover: true,
    });
    const materialized = materialize(fixture);
    const storyAbsolute = path.join(
      fixture.repoRoot,
      fixture.storyPath,
    );
    fs.writeFileSync(
      storyAbsolute,
      fs
        .readFileSync(storyAbsolute, 'utf8')
        .replace(
          'studies a paper map on page 1',
          'studies a newly folded paper map on page 1',
        ),
      'utf8',
    );
    const providerFactory = vi.fn(() => {
      throw new Error('provider factory must be unreachable');
    });
    const {
      runCanonicalLiveVisualContractAuthoring,
    } = await import(
      '@/lib/visual-package/canonicalLiveVisualContractAuthoring'
    );
    const rejected =
      await runCanonicalLiveVisualContractAuthoring(
        {
          repoRoot: fixture.repoRoot,
          sourceAuthorityRequestPath:
            materialized.persistence.sourceAuthorityRequest.path,
          snapshotPath:
            materialized.persistence.sourceSnapshot.path,
          requestPath:
            materialized.persistence.liveAuthoringRequest.path,
          outputDir: 'outputs/rejected-stale-bundle',
        },
        { providerFactory },
      );
    expect(rejected.status).toBe('failed');
    expect(
      rejected.persistence.authoringRequestKind,
    ).toBe('rejected_request_evidence');
    expect(providerFactory).not.toHaveBeenCalled();
    expect(rejected.persistence.candidate).toBeNull();
  });
});
