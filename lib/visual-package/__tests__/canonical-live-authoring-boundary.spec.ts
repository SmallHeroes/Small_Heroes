import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  ContractLlmCallOptions,
} from '@/lib/visual-contract-compiler/compileBookVisualContract';
import type {
  BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';
import {
  projectPageMustShow,
} from '@/lib/visual-contract-compiler/projectContractProse';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/templateDraftSchema';
import {
  SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
  SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/sourceEvidenceIdRepair';
import type {
  BookVisualContract,
} from '@/lib/visual-contract-compiler/types';
import {
  buildStorySourceAuthoritySnapshot,
  buildVisualContractAuthoringRequest,
  canonicalJsonDigest,
  OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
  persistVisualContractAuthoringRequest,
  runVisualContractAuthoring,
  visualContractAuthoringCallPromptAuthorityIssues,
  visualContractAuthoringRequestIssues,
  type StorySourceAuthoritySnapshot,
  type VisualContractAuthoringProvider,
  type VisualContractAuthoringRequest,
} from '@/lib/visual-package';
import {
  canonicalLiveAuthoringJsonBytes,
  createCanonicalLiveAuthoringArtifactStore,
} from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';
import {
  runCanonicalLiveVisualContractAuthoring,
} from '@/lib/visual-package/canonicalLiveVisualContractAuthoring';
import {
  createGuardedOpenAIResponsesAuthoringFetch,
  createOpenAIResponsesVisualContractAuthoringAdapter,
  mapOpenAIResponsesAuthoringResponse,
  openAIResponsesAuthoringTransport,
  buildOpenAIResponsesVisualContractAuthoringBody,
  type OpenAIResponsesAuthoringTransport,
} from '@/lib/visual-package/openaiResponsesVisualContractAuthoringAdapter';
import {
  createProviderFailureBoundaryObservations,
  ProviderCallFailureDiagnosticError,
} from '@/lib/visual-package/providerFailureDiagnostics';
import type {
  CanonicalLiveAuthoringArtifactStore,
} from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';

const tempRoots: string[] = [];
const REQUESTED_AT = '2026-07-27T12:00:00.000Z';
const STORY_KEY = 'bunny_ometz_adventure';
const BANK = path.join(
  process.cwd(),
  'story-bank',
  'v3-approved',
);
const FAKE_CREDENTIAL =
  'TEST_ONLY_FAKE_OPENAI_CREDENTIAL_MUST_NOT_PERSIST';
const RAW_PROVIDER_ERROR =
  'RAW_PROVIDER_EXCEPTION_MUST_NOT_PERSIST';
const RAW_INVALID_USAGE_VALUE =
  'RAW_INVALID_USAGE_VALUE_MUST_NOT_PERSIST';
const LAUNCHER = path.join(
  process.cwd(),
  'scripts',
  'visual-contract-authoring.cjs',
);
const TOP_LEVEL_REQUEST_SCALAR_KINDS = {
  version: 'string',
  policyVersion: 'string',
  mode: 'string',
  requestId: 'string',
  requestedAt: 'string',
  sourceSnapshotDigest: 'string',
  provider: 'string',
  endpoint: 'string',
  model: 'string',
  serviceTier: 'string',
  reasoningEffort: 'string',
  toolsDisabled: 'boolean',
  noFallback: 'boolean',
  transportRetries: 'number',
  timeoutMs: 'number',
  pricingDigest: 'string',
  digestAlgorithm: 'string',
  digest: 'string',
} as const;
const TOP_LEVEL_REQUEST_SCALAR_VARIANTS = [
  'omitted',
  'wrong-type',
] as const;
const TOP_LEVEL_REQUEST_SCALAR_CASES = Object.entries(
  TOP_LEVEL_REQUEST_SCALAR_KINDS,
).flatMap(([field, kind]) =>
  TOP_LEVEL_REQUEST_SCALAR_VARIANTS.map((variant) => ({
    field,
    kind,
    variant,
  })),
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'canonical-live-authoring-'),
  );
  tempRoots.push(root);
  return root;
}

function fullyActionedDraft(
  snapshot: StorySourceAuthoritySnapshot,
): BookVisualContractTemplate & Record<string, unknown> {
  const draft = JSON.parse(
    fs.readFileSync(
      path.join(
        BANK,
        `${STORY_KEY}.visual-contract-template.json`,
      ),
      'utf8',
    ),
  ) as BookVisualContractTemplate & Record<string, unknown>;
  for (const page of draft.pageContracts) {
    const sourceEvidence = snapshot.content.sourceEvidenceCatalog.entries.find(
      (candidate) =>
        candidate.pageNumber === page.pageNumber,
    );
    if (!sourceEvidence) throw new Error('missing fixture source evidence');
    (
      page as unknown as Record<string, unknown>
    ).actionRequirements = [
      {
        beatId: `beat:p${page.pageNumber}:look`,
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        object: null,
        polarity: 'must',
        laterality: null,
      },
    ];
    (
      page as unknown as Record<string, unknown>
    ).actionSemanticCoverage = [
      {
        beatId: `beat:p${page.pageNumber}:look`,
        sourceEvidenceId: sourceEvidence.sourceEvidenceId,
        disposition: {
          kind: 'action_requirement',
        },
      },
    ];
  }
  for (const page of draft.pageContracts) {
    page.mustShow = [
      ...new Set([
        ...page.mustShow,
        ...projectPageMustShow(
          page,
          draft as unknown as BookVisualContract,
        ),
      ]),
    ];
  }
  return draft;
}

interface LiveFixture {
  repoRoot: string;
  sourceRequestPath: string;
  snapshotPath: string;
  requestPath: string;
  outputDir: string;
  snapshot: StorySourceAuthoritySnapshot;
  request: VisualContractAuthoringRequest;
  storyAbsolutePath: string;
}

function writeJson(
  repoRoot: string,
  relativePath: string,
  value: unknown,
): void {
  const absolute = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(absolute), {
    recursive: true,
  });
  fs.writeFileSync(
    absolute,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
}

function createLiveFixture(
  suffix = 'base',
): LiveFixture {
  const repoRoot = tempRoot();
  const storyPath = `stories/${STORY_KEY}.md`;
  const storyAbsolutePath = path.join(repoRoot, storyPath);
  fs.mkdirSync(path.dirname(storyAbsolutePath), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(BANK, `${STORY_KEY}.md`),
    storyAbsolutePath,
  );
  const sourceRequest = {
    repoRoot,
    storyKey: STORY_KEY,
    storyPath,
  };
  const snapshot =
    buildStorySourceAuthoritySnapshot(sourceRequest);
  const request = buildVisualContractAuthoringRequest({
    snapshot,
    mode: 'live',
    requestId: `request-live-${suffix}`,
    requestedAt: REQUESTED_AT,
  });
  const sourceRequestPath = 'inputs/source-request.json';
  const snapshotPath = 'inputs/source-snapshot.json';
  const requestPath = 'inputs/authoring-request.json';
  writeJson(repoRoot, sourceRequestPath, sourceRequest);
  writeJson(repoRoot, snapshotPath, snapshot);
  writeJson(repoRoot, requestPath, request);
  return {
    repoRoot,
    sourceRequestPath,
    snapshotPath,
    requestPath,
    outputDir: `outputs/${suffix}`,
    snapshot,
    request,
    storyAbsolutePath,
  };
}

function responseFor(
  output: unknown,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'resp_test_1',
    model: 'gpt-5.6-sol',
    status: 'completed',
    output_text:
      typeof output === 'string'
        ? output
        : JSON.stringify(output),
    usage: {
      input_tokens: 1_000,
      input_tokens_details: {
        cached_tokens: 200,
        cache_write_tokens: 0,
      },
      output_tokens: 2_000,
      output_tokens_details: {
        reasoning_tokens: 500,
      },
      total_tokens: 3_000,
    },
    ...overrides,
  };
}

function fakeAdapter(args: {
  responses: unknown[];
  readCredential?: ReturnType<typeof vi.fn>;
  transportCreate?: ReturnType<typeof vi.fn>;
}) {
  const readCredential =
    args.readCredential ??
    vi.fn(() => FAKE_CREDENTIAL);
  const transportDelegate =
    args.transportCreate ??
    vi.fn(async () => {
      const next = args.responses.shift();
      if (next instanceof Error) throw next;
      return next;
    });
  const transportCreate = vi.fn(
    async (
      request: Parameters<
        OpenAIResponsesAuthoringTransport['create']
      >[0],
    ) => {
      request.observations.transportDispatchStarted = true;
      request.observations.transportDispatchCount += 1;
      request.observations.canonicalRouteConfirmed = true;
      request.observations.canonicalModelConfirmed =
        request.body.model === 'gpt-5.6-sol';
      return transportDelegate(request);
    },
  );
  const transport: OpenAIResponsesAuthoringTransport = {
    create: transportCreate,
  };
  return {
    provider:
      createOpenAIResponsesVisualContractAuthoringAdapter({
        readCredential,
        transport,
      }),
    readCredential,
    transportCreate,
  };
}

function fixtureInput(fixture: LiveFixture) {
  return {
    repoRoot: fixture.repoRoot,
    sourceAuthorityRequestPath:
      fixture.sourceRequestPath,
    snapshotPath: fixture.snapshotPath,
    requestPath: fixture.requestPath,
    outputDir: fixture.outputDir,
  };
}

function exactOptions(
  request: VisualContractAuthoringRequest,
): ContractLlmCallOptions {
  return {
    maxOutputTokens: request.tokenBudget.maxOutputTokens,
    model: request.model,
    reasoningEffort: request.reasoningEffort,
    jsonSchema: {
      name: TEMPLATE_DRAFT_SCHEMA_NAME,
      schema: TEMPLATE_DRAFT_JSON_SCHEMA,
    },
    noFallback: request.noFallback,
    provider: request.provider,
    endpoint: request.endpoint,
    serviceTier: request.serviceTier,
    toolsDisabled: request.toolsDisabled,
    transportRetries: request.transportRetries,
    timeoutMs: request.timeoutMs,
    maxInputTokens: request.tokenBudget.maxInputTokens,
  };
}

function findConstSchemaNode(
  value: unknown,
  literal: unknown,
): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findConstSchemaNode(child, literal);
      if (found) return found;
    }
    return null;
  }
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return null;
  }
  const node = value as Record<string, unknown>;
  if (node.const === literal) return node;
  for (const child of Object.values(node)) {
    const found = findConstSchemaNode(child, literal);
    if (found) return found;
  }
  return null;
}

function redigestRequest(
  request: Record<string, unknown>,
): void {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = request;
  request.digest = canonicalJsonDigest(payload);
}

function allArtifactText(repoRoot: string): string {
  const files: string[] = [];
  function walk(directory: string): void {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {
      withFileTypes: true,
    })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else files.push(absolute);
    }
  }
  walk(path.join(repoRoot, 'outputs'));
  return files
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
}

function readRejectedEvidence(
  fixture: LiveFixture,
  result: Awaited<
    ReturnType<
      typeof runCanonicalLiveVisualContractAuthoring
    >
  >,
): {
  observedRequestDigest: string | null;
  claimedRequestDigest: string | null;
  issues: string[];
  request?: unknown;
} {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        fixture.repoRoot,
        result.persistence.authoringRequest.path,
      ),
      'utf8',
    ),
  ) as {
    observedRequestDigest: string | null;
    claimedRequestDigest: string | null;
    issues: string[];
    request?: unknown;
  };
}

describe('canonical OpenAI Responses authoring adapter', () => {
  it('does not read credentials or construct transport work at adapter creation', () => {
    const readCredential = vi.fn(() => FAKE_CREDENTIAL);
    const transportCreate = vi.fn();
    createOpenAIResponsesVisualContractAuthoringAdapter({
      readCredential,
      transport: { create: transportCreate },
    });
    expect(readCredential).not.toHaveBeenCalled();
    expect(transportCreate).not.toHaveBeenCalled();
  });

  it('maps the compact repair schema without changing the locked provider policy', () => {
    const fixture = createLiveFixture('compact-schema-body');
    const options = exactOptions(fixture.request);
    options.jsonSchema = {
      name: SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
      schema: SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
    };

    const body = buildOpenAIResponsesVisualContractAuthoringBody({
      systemPrompt: 'compact-system',
      userPrompt: 'compact-user',
      options,
    });

    expect(body).toMatchObject({
      model: 'gpt-5.6-sol',
      service_tier: 'default',
      max_output_tokens: 36_000,
      text: {
        format: {
          type: 'json_schema',
          name: SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
          schema: SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
          strict: true,
        },
      },
      tools: [],
      tool_choice: 'none',
      store: false,
    });
  });

  it('maps the exact request body, zero-retry transport options, and complete provider evidence', async () => {
    const fixture = createLiveFixture('mapping');
    const draft = fullyActionedDraft(fixture.snapshot);
    const adapter = fakeAdapter({
      responses: [responseFor(draft)],
    });
    const result = await runVisualContractAuthoring({
      request: fixture.request,
      snapshot: fixture.snapshot,
      provider: adapter.provider,
      requiredMode: 'live',
      requiredProviderEvidenceVersion:
        OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
    });

    expect(result.receipt.status).toBe('completed');
    expect(result.receipt.version).toBe(
      'visual-contract-authoring-receipt/v13',
    );
    expect(result.receipt.executionAttestation).toEqual({
      evidenceKind: 'canonical_adapter_observed',
      logicalProviderCalls: 1,
      transportDispatchCount: 1,
      transportRetryCount: 0,
      fallbackUsed: false,
      canonicalRouteConfirmed: true,
      canonicalModelConfirmed: true,
    });
    expect(adapter.readCredential).toHaveBeenCalledTimes(1);
    expect(adapter.transportCreate).toHaveBeenCalledTimes(1);
    const transportRequest =
      adapter.transportCreate.mock.calls[0]?.[0];
    expect(transportRequest).toMatchObject({
      apiKey: FAKE_CREDENTIAL,
      requestOptions: {
        maxRetries: 0,
        timeout: 1_200_000,
      },
      body: {
        model: 'gpt-5.6-sol',
        service_tier: 'default',
        max_output_tokens: 36_000,
        reasoning: { effort: 'medium' },
        text: {
          format: {
            type: 'json_schema',
            name: TEMPLATE_DRAFT_SCHEMA_NAME,
            strict: true,
          },
        },
        tools: [],
        tool_choice: 'none',
        store: false,
      },
    });
    expect(transportRequest.body.input).toHaveLength(2);
    expect(result.receipt.aggregateUsage).toEqual({
      inputTokens: 1_000,
      cachedInputTokens: 200,
      cacheWriteInputTokens: 0,
      outputTokens: 2_000,
      reasoningTokens: 500,
      totalTokens: 3_000,
    });
    expect(result.receipt.attempts[0]).toMatchObject({
      responseId: 'resp_test_1',
      provider: 'openai',
      model: 'gpt-5.6-sol',
      providerEvidenceVersion:
        OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
      usageEvidenceKind: 'canonical_provider_reported',
      completionStatus: 'completed',
      usageEvidenceComplete: true,
      executionAttestation:
        result.receipt.executionAttestation,
      status: 'response_received',
    });
  });

  it.each([
    {
      label: 'zero cache write',
      cacheWriteTokens: 0,
    },
    {
      label: 'nonzero cache write',
      cacheWriteTokens: 300,
    },
  ])(
    'maps raw Responses usage with $label evidence',
    ({ cacheWriteTokens }) => {
      const mapped =
        mapOpenAIResponsesAuthoringResponse({
          id: 'resp_usage_fixture',
          model: 'gpt-5.6-sol',
          status: 'completed',
          output_text: '{}',
          usage: {
            input_tokens: 1_000,
            input_tokens_details: {
              cached_tokens: 200,
              cache_write_tokens: cacheWriteTokens,
            },
            output_tokens: 2_000,
            output_tokens_details: {
              reasoning_tokens: 500,
            },
            total_tokens: 3_000,
          },
        });
      expect(mapped.receipt.usage).toEqual({
        input_tokens: 1_000,
        cached_input_tokens: 200,
        cache_write_input_tokens: cacheWriteTokens,
        output_tokens: 2_000,
        reasoning_tokens: 500,
        total_tokens: 3_000,
      });
      expect(
        mapped.receipt.usageEvidenceComplete,
      ).toBe(true);
    },
  );

  it('rejects an incompatible fully serialized schema before credential, SDK, or transport reachability', async () => {
    const fixture = createLiveFixture(
      'adapter-schema-compatibility',
    );
    const readCredential = vi.fn(() => FAKE_CREDENTIAL);
    const transportCreate = vi.fn();
    const provider =
      createOpenAIResponsesVisualContractAuthoringAdapter({
        readCredential,
        transport: { create: transportCreate },
      });
    const constNode = findConstSchemaNode(
      TEMPLATE_DRAFT_JSON_SCHEMA,
      'action_requirement',
    );
    expect(constNode).not.toBeNull();
    const originalType = constNode!.type;
    let caught: unknown;
    delete constNode!.type;
    try {
      await provider.call({
        attempt: 1,
        kind: 'initial',
        systemPrompt: 'system',
        userPrompt: 'user',
        options: exactOptions(fixture.request),
      });
    } catch (error) {
      caught = error;
    } finally {
      constNode!.type = originalType;
    }

    expect(caught).toBeInstanceOf(
      ProviderCallFailureDiagnosticError,
    );
    const diagnosticError =
      caught as ProviderCallFailureDiagnosticError;
    expect(diagnosticError.diagnostic).toMatchObject({
      phase: 'request_body_validation',
      failureClass: 'local_request_validation',
      adapterInvoked: true,
      credentialReadSucceeded: false,
      transportDispatchStarted: false,
      httpResponseReceived: false,
      requestBodyDigest: null,
    });
    expect(
      diagnosticError.structuredOutputCompatibilityEvidence,
    ).toMatchObject({
      status: 'incompatible',
      issues: expect.arrayContaining([
        {
          path: expect.stringMatching(/^root(?:\.|$)/),
          ruleId: 'OAI_SO_CONST_TYPE_REQUIRED',
        },
      ]),
    });
    expect(
      JSON.stringify(
        diagnosticError.structuredOutputCompatibilityEvidence,
      ),
    ).not.toContain('action_requirement');
    expect(readCredential).not.toHaveBeenCalled();
    expect(transportCreate).not.toHaveBeenCalled();
  });

  it('treats adapter schema incompatibility as terminal without consuming a semantic repair', async () => {
    const fixture = createLiveFixture(
      'adapter-schema-terminal',
    );
    const readCredential = vi.fn(() => FAKE_CREDENTIAL);
    const transportCreate = vi.fn();
    const adapter =
      createOpenAIResponsesVisualContractAuthoringAdapter({
        readCredential,
        transport: { create: transportCreate },
      });
    const constNode = findConstSchemaNode(
      TEMPLATE_DRAFT_JSON_SCHEMA,
      'action_requirement',
    );
    expect(constNode).not.toBeNull();
    const originalType = constNode!.type;
    const provider: VisualContractAuthoringProvider = {
      call: async (args) => {
        delete constNode!.type;
        try {
          return await adapter.call(args);
        } finally {
          constNode!.type = originalType;
        }
      },
    };

    const result = await runVisualContractAuthoring({
      request: fixture.request,
      snapshot: fixture.snapshot,
      provider,
      requiredMode: 'live',
      requiredProviderEvidenceVersion:
        OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
    });
    expect(result.receipt).toMatchObject({
      status: 'failed',
      callCount: 1,
      repairCount: 0,
      failure: { code: 'provider_call_failed' },
    });
    expect(result.compileResult).toBeNull();
    expect(readCredential).not.toHaveBeenCalled();
    expect(transportCreate).not.toHaveBeenCalled();
  });

  it('guards the final HTTPS Responses destination and refuses redirect or identity authority', async () => {
    const delegated = vi.fn(
      async () =>
        new Response('{}', {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }),
    );
    const guarded =
      createGuardedOpenAIResponsesAuthoringFetch(
        delegated,
      );
    await guarded(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
      },
    );
    expect(delegated).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
      }),
    );
    await expect(
      guarded('https://redirect.invalid/v1/responses', {
        method: 'POST',
      }),
    ).rejects.toThrow(/unauthorized destination/);
    await expect(
      guarded('https://api.openai.com/v1/responses/', {
        method: 'POST',
      }),
    ).rejects.toThrow(/unauthorized destination/);
    await expect(
      guarded('https://api.openai.com/v1/responses', {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'OpenAI-Organization': 'org-marker',
        },
      }),
    ).rejects.toThrow(/unauthorized identity headers/);
    expect(delegated).toHaveBeenCalledTimes(1);
  });

  it('pins actual SDK routing and identity options against injected environment defaults', async () => {
    const fixture = createLiveFixture('sdk-env-pin');
    vi.stubEnv(
      'OPENAI_BASE_URL',
      'https://redirect.invalid/v1',
    );
    vi.stubEnv('OPENAI_ORG_ID', 'org-marker');
    vi.stubEnv('OPENAI_PROJECT_ID', 'project-marker');
    vi.stubEnv(
      'OPENAI_WEBHOOK_SECRET',
      'webhook-marker',
    );
    const delegated = vi.fn(
      async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url = new URL(
          input instanceof Request ? input.url : input,
        );
        expect(url.href).toBe(
          'https://api.openai.com/v1/responses',
        );
        expect(init?.redirect).toBe('error');
        const headers = new Headers(
          input instanceof Request
            ? input.headers
            : init?.headers,
        );
        expect(
          headers.has('openai-organization'),
        ).toBe(false);
        expect(headers.has('openai-project')).toBe(false);
        expect(
          headers.has('openai-webhook-secret'),
        ).toBe(false);
        const body = JSON.parse(
          String(init?.body),
        ) as Record<string, unknown>;
        expect(body.store).toBe(false);
        expect(JSON.stringify(body)).not.toMatch(
          /redirect\.invalid|org-marker|project-marker|webhook-marker/,
        );
        return new Response(
          JSON.stringify(
            responseFor(
              fullyActionedDraft(fixture.snapshot),
            ),
          ),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      },
    );
    vi.stubGlobal('fetch', delegated);
    const body =
      buildOpenAIResponsesVisualContractAuthoringBody({
        systemPrompt: 'system',
        userPrompt: 'user',
        options: exactOptions(fixture.request),
      });
    const observations =
      createProviderFailureBoundaryObservations({
        adapterInvoked: true,
        credentialReadSucceeded: true,
        requestBodyDigest: canonicalJsonDigest(body),
        requestOptionsDigest: canonicalJsonDigest({
          maxRetries: 0,
          timeout: 1_200_000,
        }),
        canonicalModelConfirmed:
          body.model === 'gpt-5.6-sol',
      });
    await openAIResponsesAuthoringTransport.create({
      apiKey: FAKE_CREDENTIAL,
      body,
      requestOptions: {
        maxRetries: 0,
        timeout: 1_200_000,
      },
      observations,
    });
    expect(delegated).toHaveBeenCalledTimes(1);
    expect(observations).toMatchObject({
      transportDispatchStarted: true,
      transportDispatchCount: 1,
      canonicalRouteConfirmed: true,
      canonicalModelConfirmed: true,
      httpResponseReceived: true,
    });
  });

  it.each([
    ['model', { model: 'gpt-substitute' }],
    ['provider', { provider: 'alternate' }],
    ['endpoint', { endpoint: 'chat.completions' }],
    ['service tier', { serviceTier: 'priority' }],
    ['reasoning', { reasoningEffort: 'high' }],
    ['tools', { toolsDisabled: false }],
    ['fallback', { noFallback: false }],
    ['retry', { transportRetries: 1 }],
    ['timeout', { timeoutMs: 1_199_999 }],
    ['input budget', { maxInputTokens: 63_999 }],
    ['output budget', { maxOutputTokens: 31_999 }],
    [
      'schema name',
      {
        jsonSchema: {
          name: 'other-schema',
          schema: TEMPLATE_DRAFT_JSON_SCHEMA,
        },
      },
    ],
    [
      'schema body',
      {
        jsonSchema: {
          name: TEMPLATE_DRAFT_SCHEMA_NAME,
          schema: { type: 'object' },
        },
      },
    ],
  ])(
    'rejects an invalid %s option before credential and transport reachability',
    async (_label, mutation) => {
      const fixture = createLiveFixture(
        `adapter-policy-${_label}`,
      );
      const adapter = fakeAdapter({
        responses: [
          responseFor(
            fullyActionedDraft(fixture.snapshot),
          ),
        ],
      });
      await expect(
        adapter.provider.call({
          attempt: 1,
          kind: 'initial',
          systemPrompt: 'system',
          userPrompt: 'user',
          options: {
            ...exactOptions(fixture.request),
            ...mutation,
          } as ContractLlmCallOptions,
        }),
      ).rejects.toThrow(
        /visual_contract_authoring_adapter_policy_mismatch/,
      );
      expect(adapter.readCredential).not.toHaveBeenCalled();
      expect(adapter.transportCreate).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'missing usage',
      { usage: undefined },
      'usage_invalid',
    ],
    [
      'missing cached usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cache_write_tokens: 0,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 3_000,
        },
      },
      'usage_invalid',
    ],
    [
      'missing cache-write usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 0,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 3_000,
        },
      },
      'usage_invalid',
    ],
    [
      'negative cache-write usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens: -1,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 3_000,
        },
      },
      'usage_invalid',
    ],
    [
      'fractional cache-write usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens: 0.5,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 3_000,
        },
      },
      'usage_invalid',
    ],
    [
      'non-finite cache-write usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens:
              Number.POSITIVE_INFINITY,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 3_000,
        },
      },
      'usage_invalid',
    ],
    [
      'unsafe cache-write usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens:
              Number.MAX_SAFE_INTEGER + 1,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 3_000,
        },
      },
      'usage_invalid',
    ],
    [
      'wrong-type cache-write usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens: RAW_INVALID_USAGE_VALUE,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 3_000,
        },
      },
      'usage_invalid',
    ],
    [
      'inconsistent cached-read/cache-write partition',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 600,
            cache_write_tokens: 401,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 3_000,
        },
      },
      'usage_invalid',
    ],
    [
      'malformed reasoning usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens: 0,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 'five hundred',
          },
          total_tokens: 3_000,
        },
      },
      'usage_invalid',
    ],
    [
      'inconsistent total usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens: 0,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 3_001,
        },
      },
      'usage_invalid',
    ],
    [
      'overflow input usage',
      {
        usage: {
          input_tokens: 64_001,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens: 0,
          },
          output_tokens: 2_000,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 66_001,
        },
      },
      'usage_invalid',
    ],
    [
      'overflow output usage',
      {
        usage: {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens: 0,
          },
          output_tokens: 36_001,
          output_tokens_details: {
            reasoning_tokens: 500,
          },
          total_tokens: 37_001,
        },
      },
      'usage_invalid',
    ],
    [
      'incomplete status',
      { status: 'incomplete' },
      'completion_status_invalid',
    ],
    [
      'failed status',
      { status: 'failed' },
      'completion_status_invalid',
    ],
    [
      'missing completion status',
      { status: undefined },
      'completion_status_invalid',
    ],
    [
      'missing response id',
      { id: undefined },
      'provider_evidence_invalid',
    ],
    [
      'empty response',
      { output_text: '' },
      'provider_evidence_invalid',
    ],
    [
      'model substitution',
      { model: 'gpt-substitute' },
      'provider_policy_mismatch',
    ],
  ])(
    'fails closed on %s while retaining only sanitized evidence',
    async (label, override, expectedCode) => {
      const fixture = createLiveFixture(
        `response-${label}`,
      );
      const adapter = fakeAdapter({
        responses: [
          responseFor(
            fullyActionedDraft(fixture.snapshot),
            override,
          ),
        ],
      });
      const result = await runVisualContractAuthoring({
        request: fixture.request,
        snapshot: fixture.snapshot,
        provider: adapter.provider,
      });
      expect(result.receipt.failure?.code).toBe(
        expectedCode,
      );
      expect(result.receipt.callCount).toBe(1);
      expect(result.compileResult).toBeNull();
      expect(JSON.stringify(result.receipt)).not.toMatch(
        /output_text|"systemPrompt":|"userPrompt":|apiKey|Bearer/i,
      );
      expect(JSON.stringify(result.receipt)).not.toContain(
        RAW_INVALID_USAGE_VALUE,
      );
    },
  );

  it('discards provider exceptions and credential values from the receipt', async () => {
    const fixture = createLiveFixture('provider-failure');
    const adapter = fakeAdapter({
      responses: [
        new Error(
          `${RAW_PROVIDER_ERROR} ${FAKE_CREDENTIAL}`,
        ),
      ],
    });
    const result = await runVisualContractAuthoring({
      request: fixture.request,
      snapshot: fixture.snapshot,
      provider: adapter.provider,
    });
    expect(result.receipt.failure?.code).toBe(
      'provider_call_failed',
    );
    const serialized = JSON.stringify(result.receipt);
    expect(serialized).not.toContain(RAW_PROVIDER_ERROR);
    expect(serialized).not.toContain(FAKE_CREDENTIAL);
    expect(serialized).not.toContain('stack');
    expect(result.providerFailureEvidence).toMatchObject({
      version: 'provider-call-failure-evidence/v2',
      failureClass: 'unclassified_adapter_failure',
      phase: 'unknown_adapter',
      adapterInvoked: true,
      credentialReadSucceeded: true,
      transportDispatchStarted: true,
      httpResponseReceived: false,
      httpStatus: null,
      billingState: 'unknown_no_usage',
      executionAttestation: {
        evidenceKind: 'canonical_adapter_observed',
        logicalProviderCalls: 1,
        transportDispatchCount: 1,
        transportRetryCount: 0,
        fallbackUsed: false,
        canonicalRouteConfirmed: true,
        canonicalModelConfirmed: true,
      },
      authoringRequestDigest: fixture.request.digest,
      sourceSnapshotDigest: fixture.snapshot.digest,
      authoringReceiptDigest: result.receipt.digest,
    });
    expect(
      JSON.stringify(result.providerFailureEvidence),
    ).not.toContain(RAW_PROVIDER_ERROR);
    expect(
      JSON.stringify(result.providerFailureEvidence),
    ).not.toContain(FAKE_CREDENTIAL);
  });

  it('records an unknown injected provider without invented credential, transport, or HTTP observations', async () => {
    const fixture = createLiveFixture(
      'unknown-injected-provider-failure',
    );
    const provider: VisualContractAuthoringProvider = {
      call: vi.fn(async () => {
        throw new Error(
          `${RAW_PROVIDER_ERROR} ${FAKE_CREDENTIAL}`,
        );
      }),
    };
    const result = await runVisualContractAuthoring({
      request: fixture.request,
      snapshot: fixture.snapshot,
      provider,
    });
    expect(result.receipt.failure?.code).toBe(
      'provider_call_failed',
    );
    expect(result.receipt.attempts[0]?.providerReached).toBe(
      true,
    );
    expect(result.providerFailureEvidence).toMatchObject({
      phase: 'unknown_adapter',
      failureClass: 'unclassified_adapter_failure',
      adapterInvoked: true,
      credentialReadSucceeded: false,
      transportDispatchStarted: false,
      httpResponseReceived: false,
      httpStatus: null,
      sdkErrorKind: 'unknown',
      providerCodeClass: 'unknown',
      parameterClass: 'unknown',
      requestBodyDigest: null,
      providerRequestIdDigest: null,
    });
    const serialized = JSON.stringify(
      result.providerFailureEvidence,
    );
    expect(serialized).not.toContain(RAW_PROVIDER_ERROR);
    expect(serialized).not.toContain(FAKE_CREDENTIAL);
  });

  it.each(['missing', 'wrong'])(
    'requires the branded evidence contract on the canonical lifecycle seam: %s',
    async (brandKind) => {
      const fixture = createLiveFixture(
        `evidence-brand-${brandKind}`,
      );
      const output = JSON.stringify(
        fullyActionedDraft(fixture.snapshot),
      );
      const provider = {
        call: vi.fn(async () => ({
          output,
          receipt: {
            provider: 'openai',
            model: 'gpt-5.6-sol',
            responseId: 'resp_brand_test',
            usage: {
              input_tokens: 10,
              cached_input_tokens: 0,
              cache_write_input_tokens: 0,
              output_tokens: 20,
              reasoning_tokens: 5,
              total_tokens: 30,
            },
            ...(brandKind === 'wrong'
              ? {
                  evidenceVersion:
                    'openai-responses-authoring-evidence/v2',
                }
              : {}),
            completionStatus: 'completed',
            usageEvidenceComplete: true,
          },
        })),
      };
      const result = await runVisualContractAuthoring({
        request: fixture.request,
        snapshot: fixture.snapshot,
        provider:
          provider as unknown as VisualContractAuthoringProvider,
        requiredMode: 'live',
        requiredProviderEvidenceVersion:
          OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
      });
      expect(result.receipt.failure?.code).toBe(
        'provider_evidence_invalid',
      );
      expect(
        result.receipt.attempts[0]
          ?.validationDiagnostics.codes,
      ).toContain('provider_execution_evidence_invalid');
      if (brandKind === 'wrong') {
        expect(
          result.receipt.attempts[0]
            ?.providerEvidenceVersion,
        ).toBe(
          'openai-responses-authoring-evidence/v2',
        );
      }
    },
  );

  it('fails prompt version and digest mismatches before provider reachability', () => {
    const fixture = createLiveFixture('prompt-authority');
    const request = structuredClone(fixture.request);
    request.promptDigests.system =
      canonicalJsonDigest('approved-system');
    request.promptDigests.user =
      canonicalJsonDigest('approved-user');
    request.promptAuthority.initial.systemPromptDigest =
      request.promptDigests.system;
    request.promptAuthority.initial.userPromptDigest =
      request.promptDigests.user;
    expect(
      visualContractAuthoringCallPromptAuthorityIssues({
        request,
        kind: 'initial',
        systemPrompt: 'changed-system',
        userPrompt: 'approved-user',
        promptAuthority: {
          kind: 'initial',
          systemPromptVersion:
            request.promptAuthority.initial
              .systemPromptVersion,
          userPromptVersion: 'wrong-prompt-version',
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        'initial_prompt_authority_mismatch',
      ]),
    );
  });
});

describe('canonical live authoring executable boundary', () => {
  it('returns a nonzero canonical child status after persisting a handled invalid-request failure', () => {
    const fixture = createLiveFixture(
      'canonical-child-failure',
    );
    const request = structuredClone(
      fixture.request,
    ) as unknown as Record<string, unknown>;
    request.provider = 'alternate';
    redigestRequest(request);
    writeJson(
      fixture.repoRoot,
      fixture.requestPath,
      request,
    );
    const result = spawnSync(
      process.execPath,
      [
        LAUNCHER,
        'live',
        '--repo-root',
        fixture.repoRoot,
        '--source-authority-request',
        fixture.sourceRequestPath,
        '--snapshot',
        fixture.snapshotPath,
        '--request',
        fixture.requestPath,
        '--out',
        fixture.outputDir,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          OPENAI_API_KEY: '',
        },
      },
    );
    expect(
      result.status,
      `${result.stdout}\n${result.stderr}`,
    ).toBe(1);
    const output = JSON.parse(result.stdout) as {
      status: string;
      persistence: {
        authoringRequestKind: string;
        authoringReceipt: { path: string };
        readiness: { path: string };
      };
    };
    expect(output.status).toBe('failed');
    expect(
      output.persistence.authoringRequestKind,
    ).toBe('rejected_request_evidence');
    expect(
      fs.existsSync(
        path.join(
          fixture.repoRoot,
          output.persistence.authoringReceipt.path,
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          fixture.repoRoot,
          output.persistence.readiness.path,
        ),
      ),
    ).toBe(true);
    expect(result.stderr).toBe('');
  }, 30_000);

  it.each([
    ['provider', (request: Record<string, unknown>) => {
      request.provider = 'alternate';
    }],
    ['endpoint', (request: Record<string, unknown>) => {
      request.endpoint = 'chat.completions';
    }],
    ['model', (request: Record<string, unknown>) => {
      request.model = 'gpt-substitute';
    }],
    ['service tier', (request: Record<string, unknown>) => {
      request.serviceTier = 'priority';
    }],
    ['reasoning', (request: Record<string, unknown>) => {
      request.reasoningEffort = 'high';
    }],
    ['schema', (request: Record<string, unknown>) => {
      (
        request.structuredOutput as Record<string, unknown>
      ).schemaDigest = '0'.repeat(64);
    }],
    ['prompt digest', (request: Record<string, unknown>) => {
      (
        request.promptDigests as Record<string, unknown>
      ).system = '0'.repeat(64);
    }],
    ['prompt authority', (request: Record<string, unknown>) => {
      const authority = request.promptAuthority as {
        repair: Record<string, unknown>;
      };
      authority.repair.systemPromptVersion =
        'unapproved-repair-prompt/v1';
    }],
    ['pricing digest', (request: Record<string, unknown>) => {
      request.pricingDigest = '0'.repeat(64);
    }],
    ['pricing version', (request: Record<string, unknown>) => {
      (
        request.pricing as Record<string, unknown>
      ).version = 'unapproved-price-version';
      request.pricingDigest = canonicalJsonDigest(
        request.pricing,
      );
    }],
    ['cost ceiling', (request: Record<string, unknown>) => {
      (
        request.costBudget as Record<string, unknown>
      ).hardCeilingUsd = 6;
    }],
    ['retry', (request: Record<string, unknown>) => {
      request.transportRetries = 1;
    }],
    ['timeout', (request: Record<string, unknown>) => {
      request.timeoutMs = 1_199_999;
    }],
    ['tools', (request: Record<string, unknown>) => {
      request.toolsDisabled = false;
    }],
    ['fallback', (request: Record<string, unknown>) => {
      request.noFallback = false;
    }],
    ['input budget', (request: Record<string, unknown>) => {
      (
        request.tokenBudget as Record<string, unknown>
      ).maxInputTokens = 63_999;
    }],
    ['output budget', (request: Record<string, unknown>) => {
      (
        request.tokenBudget as Record<string, unknown>
      ).maxOutputTokens = 35_999;
    }],
    ['call budget', (request: Record<string, unknown>) => {
      (
        request.callBudget as Record<string, unknown>
      ).maxCalls = 4;
    }],
    ['repair budget', (request: Record<string, unknown>) => {
      (
        request.callBudget as Record<string, unknown>
      ).maxRepairCount = 3;
    }],
    ['unknown field', (request: Record<string, unknown>) => {
      request.credential = FAKE_CREDENTIAL;
    }],
  ])(
    'blocks a stale or invalid %s request before credential/provider reachability',
    async (label, mutate) => {
      const fixture = createLiveFixture(
        `request-boundary-${label}`,
      );
      const request = structuredClone(
        fixture.request,
      ) as unknown as Record<string, unknown>;
      mutate(request);
      redigestRequest(request);
      writeJson(
        fixture.repoRoot,
        fixture.requestPath,
        request,
      );
      const adapter = fakeAdapter({
        responses: [
          responseFor(
            fullyActionedDraft(fixture.snapshot),
          ),
        ],
      });
      const result =
        await runCanonicalLiveVisualContractAuthoring(
          fixtureInput(fixture),
          { provider: adapter.provider },
        );
      expect(result.status).toBe('failed');
      expect(result.receipt.failure?.code).toBe(
        'request_invalid',
      );
      expect(adapter.readCredential).not.toHaveBeenCalled();
      expect(adapter.transportCreate).not.toHaveBeenCalled();
      expect(result.persistence.candidate).toBeNull();
      expect(result.persistence.authoringReceipt.created).toBe(
        true,
      );
      expect(result.persistence.readiness.created).toBe(true);
      expect(result.persistence.authoringRequest.created).toBe(
        true,
      );
      expect(
        result.persistence.authoringRequestKind,
      ).toBe('rejected_request_evidence');
      expect(allArtifactText(fixture.repoRoot)).not.toContain(
        FAKE_CREDENTIAL,
      );
    },
  );

  it('blocks preflight promotion and stale source/snapshot authority before credential reachability', async () => {
    const preflight = createLiveFixture('preflight-promotion');
    const preflightRequest =
      buildVisualContractAuthoringRequest({
        snapshot: preflight.snapshot,
        mode: 'preflight',
        requestId: 'request-preflight',
        requestedAt: REQUESTED_AT,
      });
    writeJson(
      preflight.repoRoot,
      preflight.requestPath,
      preflightRequest,
    );
    const preflightAdapter = fakeAdapter({
      responses: [],
    });
    const promotion =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(preflight),
        { provider: preflightAdapter.provider },
      );
    expect(promotion.receipt.failure?.issues).toContain(
      'request_mode_must_be_live',
    );
    const rejectedEvidence = JSON.parse(
      fs.readFileSync(
        path.join(
          preflight.repoRoot,
          promotion.persistence.authoringRequest.path,
        ),
        'utf8',
      ),
    ) as {
      issues: string[];
      request?: unknown;
    };
    expect(rejectedEvidence.issues).toContain(
      'request_mode_must_be_live',
    );
    expect(rejectedEvidence.issues.length).toBeGreaterThan(0);
    expect(new Set(rejectedEvidence.issues).size).toBe(
      rejectedEvidence.issues.length,
    );
    expect(rejectedEvidence).not.toHaveProperty('request');
    expect(
      preflightAdapter.readCredential,
    ).not.toHaveBeenCalled();

    const stale = createLiveFixture('stale-source');
    fs.appendFileSync(
      stale.storyAbsolutePath,
      '\nStale source mutation.\n',
      'utf8',
    );
    const staleAdapter = fakeAdapter({ responses: [] });
    const staleResult =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(stale),
        { provider: staleAdapter.provider },
      );
    expect(staleResult.receipt.failure?.issues).toEqual(
      expect.arrayContaining([
        'supplied_source_snapshot_content_mismatch',
        'supplied_live_request_content_mismatch',
      ]),
    );
    expect(staleAdapter.readCredential).not.toHaveBeenCalled();

    const badSnapshot = createLiveFixture('bad-snapshot');
    const suppliedSnapshot = structuredClone(
      badSnapshot.snapshot,
    ) as unknown as Record<string, unknown>;
    suppliedSnapshot.digest = '0'.repeat(64);
    writeJson(
      badSnapshot.repoRoot,
      badSnapshot.snapshotPath,
      suppliedSnapshot,
    );
    const snapshotAdapter = fakeAdapter({ responses: [] });
    const snapshotResult =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(badSnapshot),
        { provider: snapshotAdapter.provider },
      );
    expect(snapshotResult.receipt.failure?.issues).toEqual(
      expect.arrayContaining([
        'supplied_source_snapshot_invalid',
        'supplied_source_snapshot_content_mismatch',
      ]),
    );
    expect(
      snapshotAdapter.readCredential,
    ).not.toHaveBeenCalled();
  });

  it('rejects escaping, symlinked, and unwritable output authority before credentials or provider work', async () => {
    const escaping = createLiveFixture('output-escape');
    const escapingAdapter = fakeAdapter({ responses: [] });
    await expect(
      runCanonicalLiveVisualContractAuthoring(
        {
          ...fixtureInput(escaping),
          outputDir: '../outside',
        },
        { provider: escapingAdapter.provider },
      ),
    ).rejects.toThrow(/escapes repository root/);
    expect(
      escapingAdapter.readCredential,
    ).not.toHaveBeenCalled();

    const symlinked = createLiveFixture(
      'output-symlink',
    );
    const outside = tempRoot();
    const symlinkPath = path.join(
      symlinked.repoRoot,
      'linked-output',
    );
    fs.symlinkSync(outside, symlinkPath, 'junction');
    const symlinkAdapter = fakeAdapter({ responses: [] });
    await expect(
      runCanonicalLiveVisualContractAuthoring(
        {
          ...fixtureInput(symlinked),
          outputDir: 'linked-output',
        },
        { provider: symlinkAdapter.provider },
      ),
    ).rejects.toThrow(/outside the repository/);
    expect(
      symlinkAdapter.readCredential,
    ).not.toHaveBeenCalled();

    const unwritable = createLiveFixture(
      'output-unwritable',
    );
    const unwritableAdapter = fakeAdapter({ responses: [] });
    const persist = vi.fn();
    await expect(
      runCanonicalLiveVisualContractAuthoring(
        fixtureInput(unwritable),
        {
          provider: unwritableAdapter.provider,
          artifactStoreFactory: () => ({
            prepare() {
              throw new Error(
                'canonical live authoring output is not writable',
              );
            },
            persist,
          }),
        },
      ),
    ).rejects.toThrow(/not writable/);
    expect(persist).not.toHaveBeenCalled();
    expect(
      unwritableAdapter.readCredential,
    ).not.toHaveBeenCalled();
  });

  it('persists intent before provider reachability and receipt before all other post-call evidence', async () => {
    const fixture = createLiveFixture('write-order');
    const events: string[] = [];
    const store: CanonicalLiveAuthoringArtifactStore = {
      prepare() {
        events.push('prepare');
      },
      persist({ category, digest }) {
        events.push(`persist:${category}`);
        return {
          path: `synthetic/${category}/${digest}.json`,
          digest,
          created: true,
        };
      },
    };
    const adapter = fakeAdapter({
      responses: [
        responseFor(
          fullyActionedDraft(fixture.snapshot),
        ),
      ],
      readCredential: vi.fn(() => {
        events.push('credential');
        return FAKE_CREDENTIAL;
      }),
      transportCreate: vi.fn(async () => {
        events.push('provider');
        return responseFor(
          fullyActionedDraft(fixture.snapshot),
        );
      }),
    });
    const result =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        {
          provider: adapter.provider,
          artifactStoreFactory: () => store,
        },
      );
    expect(result.status).toBe('completed');
    expect(events).toEqual([
      'prepare',
      'persist:source-snapshots',
      'persist:authoring-requests',
      'credential',
      'provider',
      'persist:authoring-receipts',
      'persist:readiness-evidence',
      'persist:contract-candidates',
    ]);
    expect(
      result.persistence.providerFailureEvidence,
    ).toBeNull();
  });

  it('persists provider failure evidence between receipt and readiness and writes no candidate', async () => {
    const fixture = createLiveFixture(
      'provider-failure-write-order',
    );
    const events: string[] = [];
    const store: CanonicalLiveAuthoringArtifactStore = {
      prepare() {
        events.push('prepare');
      },
      persist({ category, digest }) {
        events.push(`persist:${category}`);
        return {
          path: `synthetic/${category}/${digest}.json`,
          digest,
          created: true,
        };
      },
    };
    const provider: VisualContractAuthoringProvider = {
      call: vi.fn(async () => {
        events.push('provider');
        throw new Error(RAW_PROVIDER_ERROR);
      }),
    };
    const result =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        {
          provider,
          artifactStoreFactory: () => store,
        },
      );
    expect(result.status).toBe('failed');
    expect(events).toEqual([
      'prepare',
      'persist:source-snapshots',
      'persist:authoring-requests',
      'provider',
      'persist:authoring-receipts',
      'persist:provider-call-failure-evidence',
      'persist:readiness-evidence',
    ]);
    expect(
      result.persistence.providerFailureEvidence,
    ).toMatchObject({ created: true });
    expect(result.persistence.candidate).toBeNull();
  });

  it('stops before readiness and candidate when provider failure evidence persistence fails', async () => {
    const fixture = createLiveFixture(
      'provider-failure-sidecar-write-failure',
    );
    const events: string[] = [];
    const store: CanonicalLiveAuthoringArtifactStore = {
      prepare() {
        events.push('prepare');
      },
      persist({ category, digest }) {
        events.push(`persist:${category}`);
        if (category === 'provider-call-failure-evidence') {
          throw new Error(
            'injected provider failure sidecar write failure',
          );
        }
        return {
          path: `synthetic/${category}/${digest}.json`,
          digest,
          created: true,
        };
      },
    };
    const provider: VisualContractAuthoringProvider = {
      call: vi.fn(async () => {
        throw new Error(RAW_PROVIDER_ERROR);
      }),
    };
    await expect(
      runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        {
          provider,
          artifactStoreFactory: () => store,
        },
      ),
    ).rejects.toThrow(
      /provider failure sidecar write failure/,
    );
    expect(events).toEqual([
      'prepare',
      'persist:source-snapshots',
      'persist:authoring-requests',
      'persist:authoring-receipts',
      'persist:provider-call-failure-evidence',
    ]);
    expect(events).not.toContain(
      'persist:readiness-evidence',
    );
    expect(events).not.toContain(
      'persist:contract-candidates',
    );
  });

  it('persists a deterministic linked failure sidecar with canonical no-overwrite behavior', async () => {
    const fixture = createLiveFixture(
      'provider-failure-sidecar-determinism',
    );
    const provider: VisualContractAuthoringProvider = {
      call: vi.fn(async () => {
        throw new Error(
          `${RAW_PROVIDER_ERROR} ${FAKE_CREDENTIAL}`,
        );
      }),
    };
    const first =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { provider },
      );
    const second =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { provider },
      );
    expect(
      first.persistence.providerFailureEvidence,
    ).toMatchObject({ created: true });
    expect(
      second.persistence.providerFailureEvidence,
    ).toMatchObject({
      created: false,
      digest:
        first.persistence.providerFailureEvidence?.digest,
      path: first.persistence.providerFailureEvidence?.path,
    });
    const sidecarPath = path.join(
      fixture.repoRoot,
      first.persistence.providerFailureEvidence!.path,
    );
    const sidecar = JSON.parse(
      fs.readFileSync(sidecarPath, 'utf8'),
    ) as Record<string, unknown>;
    expect(sidecar).toMatchObject({
      version: 'provider-call-failure-evidence/v2',
      authoringRequestDigest: fixture.request.digest,
      sourceSnapshotDigest: fixture.snapshot.digest,
      authoringReceiptDigest: first.receipt.digest,
      attempt: { index: 1, kind: 'initial' },
      billingState: 'unknown_no_usage',
    });
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...payload
    } = sidecar;
    expect(sidecar.digest).toBe(
      canonicalJsonDigest(payload),
    );
    const serialized = JSON.stringify(sidecar);
    expect(serialized).not.toContain(RAW_PROVIDER_ERROR);
    expect(serialized).not.toContain(FAKE_CREDENTIAL);
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('cause');

    const original = fs.readFileSync(sidecarPath, 'utf8');
    fs.writeFileSync(
      sidecarPath,
      '{"collision":true}\n',
      'utf8',
    );
    await expect(
      runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { provider },
      ),
    ).rejects.toThrow(/immutable artifact collision/);
    fs.writeFileSync(sidecarPath, original, 'utf8');
  });

  it('persists real SDK quota evidence while legacy providerReached remains adapter-invocation compatibility only', async () => {
    const fixture = createLiveFixture(
      'provider-failure-real-sdk-quota',
    );
    const rawRequestId =
      'req_RAW_REAL_SDK_ID_MUST_NOT_PERSIST';
    const rawProviderMessage =
      'RAW_REAL_SDK_MESSAGE_MUST_NOT_PERSIST';
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            message: rawProviderMessage,
            code: 'insufficient_quota',
            param: null,
          },
        }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'x-request-id': rawRequestId,
          },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const provider =
      createOpenAIResponsesVisualContractAuthoringAdapter({
        readCredential: () => FAKE_CREDENTIAL,
      });
    const result =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { provider },
      );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.receipt).toMatchObject({
      status: 'failed',
      callCount: 1,
      repairCount: 0,
      nominalEstimatedCostUsd: 0,
      aggregateUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      failure: { code: 'provider_call_failed' },
      attempts: [
        {
          providerReached: true,
          usage: null,
          nominalEstimatedCostUsd: null,
          conservativeAccountedCostUsd: null,
        },
      ],
    });
    expect(
      Math.abs(result.receipt.conservativeAccountedCostUsd),
    ).toBe(0);
    const sidecarPath = path.join(
      fixture.repoRoot,
      result.persistence.providerFailureEvidence!.path,
    );
    const sidecar = JSON.parse(
      fs.readFileSync(sidecarPath, 'utf8'),
    ) as Record<string, unknown>;
    expect(sidecar).toMatchObject({
      phase: 'http_response',
      failureClass: 'provider_quota_exhausted',
      adapterInvoked: true,
      credentialReadSucceeded: true,
      transportDispatchStarted: true,
      httpResponseReceived: true,
      httpStatus: 429,
      sdkErrorKind: 'rate_limit_error',
      providerCodeClass: 'insufficient_quota',
      billingState: 'unknown_no_usage',
      providerRequestIdDigest:
        canonicalJsonDigest(rawRequestId),
      executionAttestation: {
        evidenceKind: 'canonical_adapter_observed',
        logicalProviderCalls: 1,
        transportDispatchCount: 1,
        transportRetryCount: 0,
        fallbackUsed: false,
        canonicalRouteConfirmed: true,
        canonicalModelConfirmed: true,
      },
    });
    expect(result.receipt.executionAttestation).toEqual(
      sidecar.executionAttestation,
    );
    expect(result.readiness.executionAttestation).toEqual(
      result.receipt.executionAttestation,
    );
    expect(sidecar.requestBodyDigest).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(sidecar.requestOptionsDigest).toMatch(
      /^[a-f0-9]{64}$/,
    );
    const serialized = JSON.stringify(sidecar);
    expect(serialized).not.toContain(rawRequestId);
    expect(serialized).not.toContain(rawProviderMessage);
    expect(serialized).not.toContain(FAKE_CREDENTIAL);
  });

  it('uses canonical byte equality for D1A1 evidence key order and Unicode normalization', () => {
    const firstValue = {
      z: 'e\u0301',
      a: { second: 2, first: 1 },
    };
    const equivalentValue = {
      a: { first: 1, second: 2 },
      z: '\u00e9',
    };
    expect(
      canonicalLiveAuthoringJsonBytes(firstValue),
    ).toBe(
      canonicalLiveAuthoringJsonBytes(equivalentValue),
    );

    const repoRoot = tempRoot();
    const store =
      createCanonicalLiveAuthoringArtifactStore({
        repoRoot,
        outputDir: 'outputs/canonical',
      });
    store.prepare();
    const digest = canonicalJsonDigest(firstValue);
    expect(
      store.persist({
        category: 'authoring-receipts',
        digest,
        value: firstValue,
      }).created,
    ).toBe(true);
    expect(
      store.persist({
        category: 'authoring-receipts',
        digest,
        value: equivalentValue,
      }).created,
    ).toBe(false);
    expect(() =>
      store.persist({
        category: 'authoring-receipts',
        digest,
        value: { different: true },
      }),
    ).toThrow(/immutable artifact collision/);
  });

  it('uses one repository real-path basis for containment and artifact labels through a root alias', async () => {
    const fixture = createLiveFixture('real-root-alias');
    const aliasParent = tempRoot();
    const aliasRoot = path.join(aliasParent, 'repository-alias');
    try {
      fs.symlinkSync(
        fixture.repoRoot,
        aliasRoot,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch (error) {
      expect(
        (error as NodeJS.ErrnoException).code,
      ).toMatch(/^(EACCES|EINVAL|ENOTSUP|EPERM)$/);
      const providerFactory = vi.fn();
      await expect(
        runCanonicalLiveVisualContractAuthoring(
          {
            ...fixtureInput(fixture),
            repoRoot: aliasRoot,
          },
          { providerFactory },
        ),
      ).rejects.toThrow();
      expect(providerFactory).not.toHaveBeenCalled();
      return;
    }

    const adapter = fakeAdapter({
      responses: [
        responseFor(fullyActionedDraft(fixture.snapshot)),
      ],
    });
    const result =
      await runCanonicalLiveVisualContractAuthoring(
        {
          ...fixtureInput(fixture),
          repoRoot: aliasRoot,
        },
        { provider: adapter.provider },
      );
    expect(result.status).toBe('completed');
    for (const artifact of [
      result.persistence.sourceSnapshot!,
      result.persistence.authoringRequest,
      result.persistence.authoringReceipt,
      result.persistence.readiness,
      result.persistence.candidate!,
    ]) {
      expect(path.isAbsolute(artifact.path)).toBe(false);
      expect(artifact.path).not.toMatch(/^\.\./);
      expect(
        fs.existsSync(
          path.join(fixture.repoRoot, artifact.path),
        ),
      ).toBe(true);
    }
  });

  it.each([
    'structuredOutput',
    'tokenBudget',
    'callBudget',
    'costBudget',
    'promptDigests',
    'promptAuthority',
    'actionSemanticAuthority',
    'pricing',
  ] as const)(
    'preserves the exact camelCase rejection code for unknown %s fields',
    async (field) => {
      const fixture = createLiveFixture(
        `reason-code-${field}`,
      );
      const request = structuredClone(
        fixture.request,
      ) as unknown as Record<string, unknown>;
      (
        request[field] as Record<string, unknown>
      ).untrustedExtra = RAW_PROVIDER_ERROR;
      redigestRequest(request);
      writeJson(
        fixture.repoRoot,
        fixture.requestPath,
        request,
      );
      const providerFactory = vi.fn();
      const result =
        await runCanonicalLiveVisualContractAuthoring(
          fixtureInput(fixture),
          { providerFactory },
        );
      const evidence = readRejectedEvidence(
        fixture,
        result,
      );
      expect(evidence.issues).toContain(
        `unexpected_request_field:${field}`,
      );
      expect(evidence.issues).not.toContain(
        'request_rejected',
      );
      expect(allArtifactText(fixture.repoRoot)).not.toContain(
        RAW_PROVIDER_ERROR,
      );
      expect(providerFactory).not.toHaveBeenCalled();
    },
  );

  it('rejects non-finite request numbers before digest, persistence of raw input, or provider construction', async () => {
    const fixture = createLiveFixture('non-finite-request');
    const requestText = fs.readFileSync(
      path.join(fixture.repoRoot, fixture.requestPath),
      'utf8',
    );
    const finiteField =
      `"timeoutMs": ${fixture.request.timeoutMs}`;
    expect(requestText).toContain(finiteField);
    fs.writeFileSync(
      path.join(fixture.repoRoot, fixture.requestPath),
      requestText.replace(
        finiteField,
        '"timeoutMs": 1e400',
      ),
      'utf8',
    );
    expect(() =>
      canonicalJsonDigest({ value: Number.POSITIVE_INFINITY }),
    ).toThrow(/non_finite_number/);
    expect(() =>
      canonicalLiveAuthoringJsonBytes({
        value: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(/non_finite_number/);

    const providerFactory = vi.fn();
    const result =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { providerFactory },
      );
    const evidence = readRejectedEvidence(fixture, result);
    expect(evidence.observedRequestDigest).toBeNull();
    expect(evidence.issues).toEqual(
      expect.arrayContaining([
        'request_json_non_finite_number',
        'request_field_non_finite:timeoutMs',
      ]),
    );
    expect(evidence).not.toHaveProperty('request');
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it('persists stale v2 and missing prompt authority as structured immutable rejection evidence', async () => {
    const fixture = createLiveFixture(
      'stale-v2-missing-prompt-authority',
    );
    const request = structuredClone(
      fixture.request,
    ) as unknown as Record<string, unknown>;
    request.version = 'visual-contract-authoring-request/v2';
    delete request.promptAuthority;
    redigestRequest(request);
    writeJson(
      fixture.repoRoot,
      fixture.requestPath,
      request,
    );

    const providerFactory = vi.fn();
    const result =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { providerFactory },
      );
    const evidence = readRejectedEvidence(fixture, result);
    expect(result.status).toBe('failed');
    expect(evidence.issues).toEqual(
      expect.arrayContaining([
        'request_version_mismatch',
        'request_field_invalid:promptAuthority',
        'supplied_live_request_content_mismatch',
      ]),
    );
    expect(evidence.observedRequestDigest).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(evidence).not.toHaveProperty('request');
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it('defines the complete non-vacuous top-level request scalar rejection matrix', () => {
    expect(
      Object.keys(TOP_LEVEL_REQUEST_SCALAR_KINDS),
    ).toHaveLength(18);
    expect(TOP_LEVEL_REQUEST_SCALAR_VARIANTS).toHaveLength(
      2,
    );
    expect(TOP_LEVEL_REQUEST_SCALAR_CASES).toHaveLength(36);
    expect(
      new Set(
        TOP_LEVEL_REQUEST_SCALAR_CASES.map(
          ({ field, variant }) => `${field}:${variant}`,
        ),
      ),
    ).toHaveLength(36);
  });

  it.each(TOP_LEVEL_REQUEST_SCALAR_CASES)(
    'totally rejects top-level request scalar $field when $variant with stable evidence',
    async ({ field, kind, variant }) => {
      const fixture = createLiveFixture(
        `total-top-level-scalar-${field}-${variant}`,
      );
      const request = structuredClone(
        fixture.request,
      ) as unknown as Record<string, unknown>;
      if (variant === 'omitted') {
        delete request[field];
      } else {
        request[field] =
          kind === 'string'
            ? { invalid: true }
            : kind === 'boolean'
              ? 'true'
              : '1';
      }
      writeJson(
        fixture.repoRoot,
        fixture.requestPath,
        request,
      );
      const providerFactory = vi.fn();
      const result =
        await runCanonicalLiveVisualContractAuthoring(
          fixtureInput(fixture),
          { providerFactory },
        );
      const evidence = readRejectedEvidence(fixture, result);
      expect(evidence.issues).toContain(
        `request_field_invalid:${field}`,
      );
      expect(evidence.issues.length).toBeGreaterThan(0);
      expect(evidence).not.toHaveProperty('request');
      expect(providerFactory).not.toHaveBeenCalled();
    },
  );

  it('accepts legacy D1A0 pretty bytes as semantically identical at a D1A1 content address', () => {
    const repoRoot = tempRoot();
    const store =
      createCanonicalLiveAuthoringArtifactStore({
        repoRoot,
        outputDir: 'outputs/shared',
      });
    store.prepare();
    const legacyValue = {
      z: 'e\u0301',
      a: { second: 2, first: 1 },
    };
    const canonicalValue = {
      a: { first: 1, second: 2 },
      z: '\u00e9',
    };
    const digest = canonicalJsonDigest(legacyValue);
    const destination = path.join(
      repoRoot,
      'outputs',
      'shared',
      'authoring-receipts',
      `${digest}.json`,
    );
    fs.writeFileSync(
      destination,
      `${JSON.stringify(legacyValue, null, 2)}\n`,
      'utf8',
    );
    expect(
      store.persist({
        category: 'authoring-receipts',
        digest,
        value: canonicalValue,
      }),
    ).toMatchObject({ created: false, digest });
    expect(fs.readFileSync(destination, 'utf8')).toBe(
      `${JSON.stringify(legacyValue, null, 2)}\n`,
    );
    expect(() =>
      store.persist({
        category: 'authoring-receipts',
        digest,
        value: { actually: 'different' },
      }),
    ).toThrow(/immutable artifact collision/);

    const fixture = createLiveFixture(
      'd1a0-d1a1-shared-writer',
    );
    const requestStore =
      createCanonicalLiveAuthoringArtifactStore({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/shared-request',
      });
    requestStore.prepare();
    expect(
      requestStore.persist({
        category: 'authoring-requests',
        digest: fixture.request.digest,
        value: fixture.request,
      }).created,
    ).toBe(true);
    expect(
      persistVisualContractAuthoringRequest({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/shared-request',
        request: fixture.request,
        write: true,
      }).created,
    ).toBe(false);
  });

  it('accepts 12 pages under the current fence and rejects page 13 before provider reachability', async () => {
    const twelve = createLiveFixture('page-12');
    expect(twelve.snapshot.content.pages).toHaveLength(12);
    expect(
      visualContractAuthoringRequestIssues({
        request: twelve.request,
        snapshot: twelve.snapshot,
      }),
    ).not.toContain(
      'page_budget_partition_decision_required',
    );

    const thirteen = createLiveFixture('page-13');
    fs.appendFileSync(
      thirteen.storyAbsolutePath,
      '\n--- Page 13 ---\nThe child takes one more brave step with clear source prose.\n',
      'utf8',
    );
    const sourceRequest = {
      repoRoot: thirteen.repoRoot,
      storyKey: STORY_KEY,
      storyPath: `stories/${STORY_KEY}.md`,
    };
    const snapshot =
      buildStorySourceAuthoritySnapshot(sourceRequest);
    const request = buildVisualContractAuthoringRequest({
      snapshot,
      mode: 'live',
      requestId: 'request-live-page-13',
      requestedAt: REQUESTED_AT,
    });
    writeJson(
      thirteen.repoRoot,
      thirteen.snapshotPath,
      snapshot,
    );
    writeJson(
      thirteen.repoRoot,
      thirteen.requestPath,
      request,
    );
    expect(snapshot.content.pages).toHaveLength(13);
    expect(
      visualContractAuthoringRequestIssues({
        request,
        snapshot,
      }),
    ).toContain(
      'page_budget_partition_decision_required',
    );
    const adapter = fakeAdapter({ responses: [] });
    const result =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(thirteen),
        { provider: adapter.provider },
      );
    expect(result.receipt.failure?.issues).toContain(
      'page_budget_partition_decision_required',
    );
    expect(adapter.readCredential).not.toHaveBeenCalled();
    expect(adapter.transportCreate).not.toHaveBeenCalled();
  });

  it('cannot opt the canonical runner out of branded Responses evidence', async () => {
    const fixture = createLiveFixture(
      'canonical-brand-required',
    );
    const provider: VisualContractAuthoringProvider = {
      call: vi.fn(async () => ({
        output: JSON.stringify(
          fullyActionedDraft(fixture.snapshot),
        ),
        receipt: {
          provider: 'openai',
          model: 'gpt-5.6-sol',
          responseId: 'resp_unbranded',
          usage: {
            input_tokens: 10,
            cached_input_tokens: 0,
            cache_write_input_tokens: 0,
            output_tokens: 20,
            reasoning_tokens: 5,
            total_tokens: 30,
          },
          completionStatus: 'completed',
          usageEvidenceComplete: true,
        },
      })),
    };
    const result =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { provider },
      );
    expect(result.receipt.failure?.code).toBe(
      'provider_evidence_invalid',
    );
    expect(result.persistence.candidate).toBeNull();
  });

  it.each([0, 1, 2])(
    'completes after %i semantic repair(s) within the three-call fence',
    async (repairCount) => {
      const fixture = createLiveFixture(
        `repairs-${repairCount}`,
      );
      const valid = fullyActionedDraft(fixture.snapshot);
      const invalid = structuredClone(valid);
      invalid.recurringProps[0].material = '';
      const outputs = [
        ...Array.from({ length: repairCount }, () =>
          responseFor(invalid),
        ),
        responseFor(valid),
      ];
      const adapter = fakeAdapter({
        responses: outputs,
      });
      const result =
        await runCanonicalLiveVisualContractAuthoring(
          fixtureInput(fixture),
          { provider: adapter.provider },
        );
      expect(result.status).toBe('completed');
      expect(
        result.persistence.authoringRequestKind,
      ).toBe('approved_live_request');
      expect(result.receipt.callCount).toBe(
        repairCount + 1,
      );
      expect(result.receipt.repairCount).toBe(repairCount);
      expect(adapter.readCredential).toHaveBeenCalledTimes(
        repairCount + 1,
      );
      expect(result.receipt.attempts[0]
        ?.reservedExposureBeforeCallUsd).toBe(4.884);
      expect(result.persistence.candidate).not.toBeNull();
      expect(result.readiness).toMatchObject({
        visualContractCandidate: {
          status: 'candidate',
        },
        semanticReconciliation: { status: 'absent' },
        humanSourceApproval: { status: 'absent' },
        blueprintAuthoringReady: false,
        d1a1Authorized: false,
      });
    },
  );

  it('aggregates disjoint cached-read, cache-write, and ordinary input partitions with exact nominal cost across repair attempts', async () => {
    const fixture = createLiveFixture(
      'partitioned-repair-cost',
    );
    const valid = fullyActionedDraft(fixture.snapshot);
    const invalid = structuredClone(valid);
    invalid.recurringProps[0].material = '';
    const adapter = fakeAdapter({
      responses: [
        responseFor(invalid, {
          usage: {
            input_tokens: 1_000,
            input_tokens_details: {
              cached_tokens: 200,
              cache_write_tokens: 300,
            },
            output_tokens: 2_000,
            output_tokens_details: {
              reasoning_tokens: 500,
            },
            total_tokens: 3_000,
          },
        }),
        responseFor(valid, {
          usage: {
            input_tokens: 1_200,
            input_tokens_details: {
              cached_tokens: 100,
              cache_write_tokens: 400,
            },
            output_tokens: 1_000,
            output_tokens_details: {
              reasoning_tokens: 250,
            },
            total_tokens: 2_200,
          },
        }),
      ],
    });

    const result =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { provider: adapter.provider },
      );

    expect(result.status).toBe('completed');
    expect(result.receipt.callCount).toBe(2);
    expect(result.receipt.aggregateUsage).toEqual({
      inputTokens: 2_200,
      cachedInputTokens: 300,
      cacheWriteInputTokens: 700,
      outputTokens: 3_000,
      reasoningTokens: 750,
      totalTokens: 5_200,
    });
    expect(
      result.receipt.attempts.map(
        (attempt) => attempt.nominalEstimatedCostUsd,
      ),
    ).toEqual([0.064475, 0.03605]);
    expect(result.receipt.nominalEstimatedCostUsd).toBe(
      0.100525,
    );
    expect(
      result.receipt.conservativeAccountedCostUsd,
    ).toBe(0.114125);
    expect(
      result.receipt.attempts.every(
        (attempt) =>
          attempt.usageEvidenceKind ===
          'canonical_provider_reported',
      ),
    ).toBe(true);
    expect(result.persistence.candidate).not.toBeNull();
  });

  it('fails after exactly two semantic repairs and persists no candidate', async () => {
    const fixture = createLiveFixture('repair-exhaustion');
    const invalid = fullyActionedDraft(fixture.snapshot);
    invalid.recurringProps[0].material = '';
    const adapter = fakeAdapter({
      responses: [
        responseFor(invalid),
        responseFor(invalid),
        responseFor(invalid),
      ],
    });
    const result =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { provider: adapter.provider },
      );
    expect(result.status).toBe('failed');
    expect(result.receipt.failure?.code).toBe(
      'draft_validation_repair_exhausted',
    );
    expect(result.receipt.callCount).toBe(3);
    expect(result.receipt.repairCount).toBe(2);
    expect(result.persistence.candidate).toBeNull();
    expect(
      result.receipt.attempts.map(
        (attempt) =>
          attempt.reservedExposureBeforeCallUsd,
      ),
    ).toEqual([4.884, 3.328875, 1.77375]);
  });

  it('writes sanitized content-addressed evidence, is byte-idempotent, and fails closed on each evidence collision', async () => {
    const fixture = createLiveFixture('immutable');
    const draft = fullyActionedDraft(fixture.snapshot);
    const adapter = fakeAdapter({
      responses: [
        responseFor(draft),
        responseFor(draft),
        responseFor(draft),
        responseFor(draft),
        responseFor(draft),
      ],
    });
    const first =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { provider: adapter.provider },
      );
    const second =
      await runCanonicalLiveVisualContractAuthoring(
        fixtureInput(fixture),
        { provider: adapter.provider },
      );
    expect(first.persistence.authoringReceipt.created).toBe(
      true,
    );
    expect(first.persistence.readiness.created).toBe(true);
    expect(first.persistence.candidate?.created).toBe(true);
    expect(
      first.persistence.providerFailureEvidence,
    ).toBeNull();
    expect(second.persistence.authoringReceipt.created).toBe(
      false,
    );
    expect(second.persistence.readiness.created).toBe(false);
    expect(second.persistence.candidate?.created).toBe(false);
    expect(
      second.persistence.providerFailureEvidence,
    ).toBeNull();
    expect(
      fs.readdirSync(
        path.join(
          fixture.repoRoot,
          fixture.outputDir,
          'provider-call-failure-evidence',
        ),
      ),
    ).toEqual([]);

    const serialized = allArtifactText(fixture.repoRoot);
    expect(serialized).not.toContain(FAKE_CREDENTIAL);
    expect(serialized).not.toContain(RAW_PROVIDER_ERROR);
    expect(serialized).not.toMatch(
      /"systemPrompt"|"userPrompt"|"output_text"|"apiKey"|"headers"|"stack"/i,
    );

    for (const evidence of [
      first.persistence.authoringReceipt,
      first.persistence.readiness,
      first.persistence.candidate!,
    ]) {
      const original = fs.readFileSync(
        path.join(fixture.repoRoot, evidence.path),
        'utf8',
      );
      fs.writeFileSync(
        path.join(fixture.repoRoot, evidence.path),
        '{"collision":true}\n',
        'utf8',
      );
      await expect(
        runCanonicalLiveVisualContractAuthoring(
          fixtureInput(fixture),
          { provider: adapter.provider },
        ),
      ).rejects.toThrow(/immutable artifact collision/);
      fs.writeFileSync(
        path.join(fixture.repoRoot, evidence.path),
        original,
        'utf8',
      );
    }
  });
});
