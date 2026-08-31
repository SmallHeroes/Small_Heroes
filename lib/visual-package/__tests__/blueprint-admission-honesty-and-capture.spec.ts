import { describe, expect, it } from 'vitest';

import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
  compilePreRenderBookVisualBlueprint,
  type PreRenderBookVisualBlueprint,
} from '@/lib/visual-package';
import {
  PreRenderBlueprintRepairInputNotAdmissibleError,
  buildPreRenderBlueprintAuthoringSystemPrompt,
  buildPreRenderBlueprintAuthoringUserPrompt,
  groupPreRenderBlueprintRepairDiagnostics,
  type PreRenderBlueprintRepairDiagnostic,
} from '@/lib/visual-package/preRenderBlueprintAuthoring';
import {
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  blueprintAuthoringInputAccounting,
  type BlueprintAuthoringInputAccounting,
} from '@/lib/visual-package/blueprintAuthoringPolicy';
import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION,
  BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS,
  admitBlueprintAuthoringInputTokens,
  blueprintAuthoringCountRequestProjection,
  blueprintAuthoringConservativeInputTokenUpperBound,
  blueprintAuthoringInputTokensAreAdmissible,
  blueprintAuthoringInputTokensExceedCeiling,
  blueprintAuthoringObservedInputTokensWithinBound,
  decideBlueprintAuthoringInputTokenAdmission,
  type BlueprintAuthoringExactInputTokenCountResult,
  type BlueprintAuthoringInputTokenCountRequest,
  type BlueprintAuthoringInputTokenCounter,
} from '@/lib/visual-package/blueprintAuthoringInputTokenAdmission';
import {
  BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DOES_NOT_AUTHORIZE,
  BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_SCOPE,
  BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
  LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V3,
  LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V2,
  blueprintAuthoringFailureRequiresSanitizedCapture,
  blueprintAuthoringReceiptRequiresSanitizedCapture,
  blueprintAuthoringSanitizedFailureCaptureIsValid,
  blueprintAuthoringSanitizedFailureCaptureVersionStatus,
  buildBlueprintAuthoringSanitizedCensus,
  mergeBlueprintAuthoringSanitizedCensuses,
  buildBlueprintAuthoringSanitizedFailureCapture as buildBlueprintAuthoringSanitizedFailureCaptureV4,
  legacyBlueprintAuthoringSanitizedFailureCaptureV3IsValid,
  legacyBlueprintAuthoringSanitizedFailureCaptureV2IsValid,
  sanitizeBlueprintDiagnosticFieldPath,
  type BlueprintAuthoringSanitizedFailureCapture,
  type LegacyBlueprintAuthoringSanitizedFailureCaptureV2,
  type LegacyBlueprintAuthoringSanitizedFailureCaptureV3,
} from '@/lib/visual-package/blueprintAuthoringSanitizedFailureCapture';
import {
  BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
  LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY,
  type BlueprintAuthoringAdmissionDecisionRecord,
} from '@/lib/visual-package/blueprintAuthoringAdmissionLedger';
import { blueprintAuthoringContinuationReservationMicroUsd } from '@/lib/visual-package/blueprintAuthoringCountAwareCost';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';

import { buildBlueprintFixture } from './pre-render-book-visual-blueprint.fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const CONFIG = {
  model: 'fixture-reasoning-model',
  reasoningEffort: 'medium',
  maxOutputTokens: 48_000,
  compositionPolicyVersion: null,
};

// Numbers copied verbatim from the immutable real R1D lantern receipt
// (4c33108016513c06dc6b5d12c0d8ef7c21e0b38f91edb5d71d52ea27c1ce8031.json):
// initial attempt inputAccounting + usage.inputTokens. Used to demonstrate the
// honesty property on the real incident's own numbers without touching the file.
const REAL_INCIDENT_INITIAL_ACCOUNTING: BlueprintAuthoringInputAccounting = {
  systemBytes: 2144,
  userBytes: 34507,
  schemaBytes: 20753,
  separatorBytes: 2,
  protocolAllowance: 4096,
  estimatedBytes: 61502,
};
const REAL_INCIDENT_OBSERVED_INPUT_TOKENS = 12007;

function wholeBookDraft(blueprint: PreRenderBookVisualBlueprint): unknown {
  return {
    worldPlan: clone(blueprint.worldPlan),
    frames: blueprint.frames.map((frame) => ({
      kind: frame.kind,
      pageNumber: frame.kind === 'cover' ? null : frame.pageNumber,
      narrative: clone(frame.narrative),
      placements: clone(frame.placements),
      camera: clone(frame.camera),
      affordanceIds: clone(frame.affordanceIds),
      continuity: {
        connectionId: frame.continuity.connectionId ?? null,
        carryoverRefs: clone(frame.continuity.carryoverRefs),
      },
    })),
  };
}

const hex64 = (seed: string): string => canonicalJsonDigest({ seed });

function buildBlueprintAuthoringSanitizedFailureCapture(args: {
  terminalFailureCode: string;
  terminalReceiptDigest: string;
  requestDigest: string;
  contextDigest: string;
  routes: ReadonlyArray<{
    routeKind: 'initial' | 'repair';
    ordinal: number;
    byteAccounting: BlueprintAuthoringInputAccounting;
    observedInputTokens?: number | null;
    rejectionReasonCode?: string | null;
  }>;
  diagnostics: readonly PreRenderBlueprintRepairDiagnostic[];
  attemptDiagnostics?: readonly (readonly PreRenderBlueprintRepairDiagnostic[])[];
}): BlueprintAuthoringSanitizedFailureCapture {
  const decisions = args.routes.map((route) => {
    const ordinal = route.ordinal as 0 | 1 | 2;
    const tokenRelevantRequestDigest = hex64(
      `wire:${ordinal}:${canonicalJsonDigest(route.byteAccounting)}`,
    );
    const admittedByToken =
      route.byteAccounting.estimatedBytes <= BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS;
    const continuation = admittedByToken
      ? blueprintAuthoringContinuationReservationMicroUsd({
          accountedMicroUsd: 0,
          remainingGenerationCalls: 3 - ordinal,
          laterProbeRoutes: 2 - ordinal,
        })
      : null;
    return {
      version: BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
      routeKind: route.routeKind,
      ordinal,
      generationAttempt: (ordinal + 1) as 1 | 2 | 3,
      tokenRelevantRequestDigest,
      inputAccounting: clone(route.byteAccounting),
      inputAccountingDigest: canonicalJsonDigest(route.byteAccounting),
      basis: admittedByToken
        ? 'conservative_upper_bound'
        : 'exact_count_unavailable',
      ceilingTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
      conservativeUpperBoundTokens: route.byteAccounting.estimatedBytes,
      exactInputTokens: null,
      countResult: admittedByToken
        ? null
        : {
            routeKind: 'repair' as const,
            repairOrdinal: ordinal as 1 | 2,
            countRequestDigest: tokenRelevantRequestDigest,
            outcome: 'unavailable' as const,
            inputTokens: null,
            unavailableReason: 'not_wired' as const,
            attestation: null,
          },
      probe: {
        status: admittedByToken ? ('not_required' as const) : ('not_wired' as const),
        reservationBeforeDispatchMicroUsd: null,
        debitMicroUsd: 0,
        cumulativeDebitMicroUsd: 0,
        transportDisposition: 'not_dispatched' as const,
      },
      generationAccountedMicroUsdBeforeRoute: 0,
      totalAccountedMicroUsdBeforeGeneration: 0,
      admitted: admittedByToken,
      continuationReservationMicroUsd: continuation,
      failureReason: admittedByToken ? null : ('exact_count_unavailable' as const),
    } as BlueprintAuthoringAdmissionDecisionRecord;
  });
  const attemptCensuses = (args.attemptDiagnostics ?? [args.diagnostics]).map(
    (diagnostics, index) => ({
      attempt: index + 1,
      census: buildBlueprintAuthoringSanitizedCensus(diagnostics),
    }),
  );
  const census = mergeBlueprintAuthoringSanitizedCensuses(
    attemptCensuses.map((entry) => entry.census),
  );
  return buildBlueprintAuthoringSanitizedFailureCaptureV4({
    terminalFailureCode: args.terminalFailureCode,
    terminalReceiptDigest: args.terminalReceiptDigest,
    requestDigest: args.requestDigest,
    contextDigest: args.contextDigest,
    admissionDecisions: decisions,
    census,
    attemptCensuses,
  });
}

function countedResult(
  request: BlueprintAuthoringInputTokenCountRequest,
  inputTokens: number,
): BlueprintAuthoringExactInputTokenCountResult {
  return {
    routeKind: 'repair',
    repairOrdinal: request.repairOrdinal,
    countRequestDigest: canonicalJsonDigest(
      blueprintAuthoringCountRequestProjection(request),
    ),
    outcome: 'counted',
    inputTokens,
    unavailableReason: null,
    attestation: {
      provider: 'openai',
      model: request.model,
      route: 'responses_input_tokens',
      evidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
      transportDispatchCount: 1,
      transportRetryCount: 0,
      canonicalRouteConfirmed: true,
      canonicalModelConfirmed: true,
    },
  };
}

function initialAccountingFor(
  fixture: ReturnType<typeof buildBlueprintFixture>,
): BlueprintAuthoringInputAccounting {
  return blueprintAuthoringInputAccounting({
    systemPrompt: buildPreRenderBlueprintAuthoringSystemPrompt(),
    userPrompt: buildPreRenderBlueprintAuthoringUserPrompt(fixture.context),
    schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  });
}

function baseCapture(): BlueprintAuthoringSanitizedFailureCapture {
  const diagnostics: PreRenderBlueprintRepairDiagnostic[] = [
    {
      code: 'schema_invalid',
      field: 'frames[0].placements[0]',
      message: 'placement missing a required identity',
      expected: { id: 'placement' },
      actual: null,
    },
    {
      code: 'reference_unresolved',
      field: 'worldPlan.affordances[2].openingSpatialNodeId',
      message: 'affordance opening references an unknown node',
    },
  ];
  return buildBlueprintAuthoringSanitizedFailureCapture({
    terminalFailureCode: 'repair_route_input_not_admissible',
    terminalReceiptDigest: hex64('receipt'),
    requestDigest: hex64('request'),
    contextDigest: hex64('context'),
    routes: [
      {
        routeKind: 'initial',
        ordinal: 0,
        byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
        observedInputTokens: REAL_INCIDENT_OBSERVED_INPUT_TOKENS,
      },
      {
        routeKind: 'repair',
        ordinal: 1,
        byteAccounting: {
          systemBytes: 2200,
          userBytes: 70000,
          schemaBytes: 20753,
          separatorBytes: 2,
          protocolAllowance: 4096,
          estimatedBytes: 97051,
        },
        rejectionReasonCode: 'repair_route_input_not_admissible',
      },
    ],
    diagnostics,
  });
}

describe('blueprint conservative input-token admission authority', () => {
  it('derives the conservative token upper bound equal to the byte accounting sum', () => {
    expect(
      blueprintAuthoringConservativeInputTokenUpperBound(
        REAL_INCIDENT_INITIAL_ACCOUNTING,
      ),
    ).toBe(REAL_INCIDENT_INITIAL_ACCOUNTING.estimatedBytes);
    expect(BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS).toBe(
      'utf8-byte-level-bpe-monotone-upper-bound',
    );
    expect(BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION).toBe(
      'blueprint-authoring-conservative-input-token-admission/v1',
    );
  });

  it('admits like-for-like: a conservative token bound within the token ceiling', () => {
    expect(
      blueprintAuthoringInputTokensAreAdmissible(REAL_INCIDENT_INITIAL_ACCOUNTING),
    ).toBe(true);
    expect(
      blueprintAuthoringInputTokensExceedCeiling(REAL_INCIDENT_INITIAL_ACCOUNTING),
    ).toBe(false);
  });

  it('rejects an over-ceiling bound for a precise same-unit reason on both routes', () => {
    const overCeiling: BlueprintAuthoringInputAccounting = {
      systemBytes: 2200,
      userBytes: 70000,
      schemaBytes: 20753,
      separatorBytes: 2,
      protocolAllowance: 4096,
      estimatedBytes: 97051,
    };
    // The SAME authority gates both the initial and repair routes: an over-ceiling
    // conservative token upper bound is rejected identically regardless of route.
    expect(blueprintAuthoringInputTokensAreAdmissible(overCeiling)).toBe(false);
    expect(blueprintAuthoringInputTokensExceedCeiling(overCeiling)).toBe(true);
    expect(overCeiling.estimatedBytes).toBeGreaterThan(
      BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    );
  });

  it('proves the bound is conservative: the real observed token count is far below it', () => {
    expect(
      blueprintAuthoringObservedInputTokensWithinBound({
        accounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
        observedInputTokens: REAL_INCIDENT_OBSERVED_INPUT_TOKENS,
      }),
    ).toBe(true);
    // The wrong-unit era read 61502 as a limit quantity; the honest bound is a
    // proven >= over the real 12007 tokens — 49495 tokens of conservative slack.
    expect(
      REAL_INCIDENT_INITIAL_ACCOUNTING.estimatedBytes -
        REAL_INCIDENT_OBSERVED_INPUT_TOKENS,
    ).toBe(49495);
    // An observed count above the bound would be unsound and must fail closed.
    expect(
      blueprintAuthoringObservedInputTokensWithinBound({
        accounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
        observedInputTokens:
          REAL_INCIDENT_INITIAL_ACCOUNTING.estimatedBytes + 1,
      }),
    ).toBe(false);
  });

  it('fails closed on structurally invalid accounting', () => {
    expect(blueprintAuthoringInputTokensAreAdmissible(null)).toBe(false);
    expect(blueprintAuthoringInputTokensExceedCeiling(undefined)).toBe(true);
    expect(() =>
      blueprintAuthoringConservativeInputTokenUpperBound({
        ...REAL_INCIDENT_INITIAL_ACCOUNTING,
        estimatedBytes: 1,
      }),
    ).toThrow();
  });
});

describe('production-scale offline overflow admission (>=8-page whole book)', () => {
  it('stops before a second provider call when the exact repair wire exceeds the token ceiling', async () => {
    const fixture = buildBlueprintFixture('journey_fantastical', {
      pageCount: 8,
    });
    expect(fixture.context.source.pageCount).toBeGreaterThanOrEqual(8);
    const oversized = wholeBookDraft(fixture.blueprint) as {
      frames: Array<{ narrative: { summary: string }; camera: unknown }>;
    };
    oversized.frames[0]!.narrative.summary = 'x'.repeat(80_000);
    oversized.frames[1]!.camera = null;
    let calls = 0;
    let caught: unknown;
    try {
      await compilePreRenderBookVisualBlueprint(fixture.context, CONFIG, {
        callAuthor: async () => {
          calls += 1;
          return oversized;
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PreRenderBlueprintRepairInputNotAdmissibleError);
    const failure = caught as PreRenderBlueprintRepairInputNotAdmissibleError;
    // Same-unit rejection: the conservative token bound exceeds the token ceiling.
    expect(
      blueprintAuthoringInputTokensExceedCeiling(failure.inputAccounting),
    ).toBe(true);
    expect(failure.inputAccounting.estimatedBytes).toBeGreaterThan(
      BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    );
    // No provider factory / credential is reachable: the only async boundary is the
    // injected pure callAuthor, and it was invoked exactly once (the initial call).
    expect(calls).toBe(1);
    // Structured diagnostics were threaded through for a future capture.
    expect(failure.attempts).toHaveLength(1);
    expect(failure.attempts[0]!.diagnostics ?? []).not.toHaveLength(0);
  });

  it('builds a valid sanitized capture end-to-end from the real failed 8-page compile', async () => {
    const fixture = buildBlueprintFixture('journey_fantastical', {
      pageCount: 8,
    });
    const oversized = wholeBookDraft(fixture.blueprint) as {
      frames: Array<{ narrative: { summary: string }; camera: unknown }>;
    };
    oversized.frames[0]!.narrative.summary = 'x'.repeat(80_000);
    oversized.frames[1]!.camera = null;
    let caught: PreRenderBlueprintRepairInputNotAdmissibleError | null = null;
    try {
      await compilePreRenderBookVisualBlueprint(fixture.context, CONFIG, {
        callAuthor: async () => oversized,
      });
    } catch (error) {
      if (error instanceof PreRenderBlueprintRepairInputNotAdmissibleError) {
        caught = error;
      }
    }
    expect(caught).not.toBeNull();
    const error = caught!;
    // Mirror exactly the runner's failure-path derivation from real evidence.
    const initialAccounting = initialAccountingFor(fixture);
    const initialAdmitted =
      blueprintAuthoringInputTokensAreAdmissible(initialAccounting);
    const capture = buildBlueprintAuthoringSanitizedFailureCapture({
      terminalFailureCode: 'repair_route_input_not_admissible',
      terminalReceiptDigest: hex64('terminal'),
      requestDigest: hex64('req'),
      contextDigest: hex64('ctx'),
      routes: [
        {
          routeKind: 'initial',
          ordinal: 0,
          byteAccounting: initialAccounting,
          observedInputTokens: 12007,
        },
        {
          routeKind: 'repair',
          ordinal: 1,
          byteAccounting: error.inputAccounting,
          rejectionReasonCode: 'repair_route_input_not_admissible',
        },
      ],
      diagnostics: error.attempts.flatMap(
        (attempt) => attempt.diagnostics ?? [],
      ),
    });
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);
    expect(capture.admission.decisions).toHaveLength(2);
    const initialRoute = capture.admission.decisions.find(
      (route) => route.routeKind === 'initial',
    )!;
    const repairRoute = capture.admission.decisions.find(
      (route) => route.routeKind === 'repair',
    )!;
    expect(initialRoute.admitted).toBe(initialAdmitted);
    expect(initialRoute.basis).toBe('conservative_upper_bound');
    expect(repairRoute.admitted).toBe(false);
    expect(repairRoute.failureReason).toBe('exact_count_unavailable');
    expect(repairRoute.conservativeUpperBoundTokens).toBeGreaterThan(
      BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    );
    expect(capture.census.totalEmitted).toBeGreaterThan(0);
  });
});

describe('exact provider-count admission (one honest token quantity, both routes)', () => {
  const OVER_CEILING: BlueprintAuthoringInputAccounting = {
    systemBytes: 2200,
    userBytes: 70000,
    schemaBytes: 20753,
    separatorBytes: 2,
    protocolAllowance: 4096,
    estimatedBytes: 97051,
  };

  const countRequest: BlueprintAuthoringInputTokenCountRequest = {
    routeKind: 'repair',
    repairOrdinal: 1,
    systemPrompt: 'SYSTEM',
    userPrompt: 'USER',
    schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    model: CONFIG.model,
    reasoningEffort: CONFIG.reasoningEffort,
    schemaName: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
  };

  it('decides on ONE token quantity: proven bound, exact count, or fail-closed', () => {
    // 1. Conservative bound within ceiling -> admit without consulting any count.
    expect(
      decideBlueprintAuthoringInputTokenAdmission({
        accounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
      }),
    ).toMatchObject({
      admitted: true,
      basis: 'conservative_upper_bound',
      exactInputTokens: null,
    });
    // 2. Bound over ceiling, exact count under ceiling -> admit on the exact tokens.
    expect(
      decideBlueprintAuthoringInputTokenAdmission({
        accounting: OVER_CEILING,
        exactInputTokens: 50_000,
      }),
    ).toMatchObject({
      admitted: true,
      basis: 'exact_provider_count',
      exactInputTokens: 50_000,
    });
    // 3. Bound over ceiling, exact count over ceiling -> reject on the exact tokens.
    expect(
      decideBlueprintAuthoringInputTokenAdmission({
        accounting: OVER_CEILING,
        exactInputTokens: 70_000,
      }),
    ).toMatchObject({ admitted: false, basis: 'exact_provider_count' });
    // 4. Bound over ceiling, no exact count -> fail closed.
    expect(
      decideBlueprintAuthoringInputTokenAdmission({ accounting: OVER_CEILING }),
    ).toMatchObject({ admitted: false, basis: 'exact_count_unavailable' });
    // Invalid accounting -> fail closed.
    expect(
      decideBlueprintAuthoringInputTokenAdmission({ accounting: null }).admitted,
    ).toBe(false);
  });

  it('never consumes forged, contradictory, extra-key, or out-of-bound count evidence', async () => {
    const valid = countedResult(countRequest, 50_000);
    const hostile: unknown[] = [
      { ...valid, routeKind: 'initial' },
      { ...valid, repairOrdinal: 2 },
      { ...valid, countRequestDigest: '0'.repeat(64) },
      { ...valid, unavailableReason: 'count_response_invalid' },
      { ...valid, attestation: null },
      { ...valid, inputTokens: OVER_CEILING.estimatedBytes + 1 },
      { ...valid, hostileExtraKey: true },
      null,
    ];
    for (const raw of hostile) {
      const decision = await admitBlueprintAuthoringInputTokens({
        accounting: OVER_CEILING,
        request: countRequest,
        counter: async () =>
          raw as BlueprintAuthoringExactInputTokenCountResult,
      });
      expect(decision.admitted).toBe(false);
      expect(decision.basis).toBe('exact_count_unavailable');
      expect(decision.countResult).toMatchObject({
        outcome: 'unavailable',
        unavailableReason: 'count_evidence_invalid',
      });
    }
  });

  it('opens the repair lane on an exact count below the ceiling (bytes exceed it) and reaches the second author call', async () => {
    const fixture = buildBlueprintFixture('journey_fantastical', {
      pageCount: 8,
    });
    const oversized = wholeBookDraft(fixture.blueprint) as {
      frames: Array<{ narrative: { summary: string }; camera: unknown }>;
    };
    oversized.frames[0]!.narrative.summary = 'x'.repeat(80_000);
    oversized.frames[1]!.camera = null;
    const validSecondDraft = wholeBookDraft(fixture.blueprint);
    let calls = 0;
    const counterRoutes: string[] = [];
    const counter: BlueprintAuthoringInputTokenCounter = async (request) => {
      counterRoutes.push(request.routeKind);
      // Exact provider count is well under the 64000 token ceiling even though the
      // repair wire's byte bound is far above it.
      return countedResult(request, 50_000);
    };
    const result = await compilePreRenderBookVisualBlueprint(
      fixture.context,
      CONFIG,
      {
        inputTokenCounter: counter,
        callAuthor: async () => {
          calls += 1;
          return calls === 1 ? oversized : validSecondDraft;
        },
      },
    );
    // The repair route was admitted on the exact count, so the SECOND author call ran.
    expect(calls).toBe(2);
    expect(counterRoutes).toContain('repair');
    expect(result.blueprint.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects the repair route before the second author call when the exact count exceeds the ceiling', async () => {
    const fixture = buildBlueprintFixture('journey_fantastical', {
      pageCount: 8,
    });
    const oversized = wholeBookDraft(fixture.blueprint) as {
      frames: Array<{ narrative: { summary: string }; camera: unknown }>;
    };
    oversized.frames[0]!.narrative.summary = 'x'.repeat(80_000);
    oversized.frames[1]!.camera = null;
    let calls = 0;
    const counter: BlueprintAuthoringInputTokenCounter = async (request) =>
      countedResult(request, 70_000);
    let caught: unknown;
    try {
      await compilePreRenderBookVisualBlueprint(fixture.context, CONFIG, {
        inputTokenCounter: counter,
        callAuthor: async () => {
          calls += 1;
          return oversized;
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PreRenderBlueprintRepairInputNotAdmissibleError);
    expect(calls).toBe(1);
  });

  it('fails closed when the exact counter is unavailable and bytes exceed the ceiling', async () => {
    const fixture = buildBlueprintFixture('journey_fantastical', {
      pageCount: 8,
    });
    const oversized = wholeBookDraft(fixture.blueprint) as {
      frames: Array<{ narrative: { summary: string }; camera: unknown }>;
    };
    oversized.frames[0]!.narrative.summary = 'x'.repeat(80_000);
    oversized.frames[1]!.camera = null;
    let calls = 0;
    const counter: BlueprintAuthoringInputTokenCounter = async (request) => ({
      routeKind: 'repair',
      repairOrdinal: request.repairOrdinal,
      countRequestDigest: canonicalJsonDigest(
        blueprintAuthoringCountRequestProjection(request),
      ),
      outcome: 'unavailable',
      inputTokens: null,
      unavailableReason: 'not_wired',
      attestation: null,
    });
    let caught: unknown;
    try {
      await compilePreRenderBookVisualBlueprint(fixture.context, CONFIG, {
        inputTokenCounter: counter,
        callAuthor: async () => {
          calls += 1;
          return oversized;
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PreRenderBlueprintRepairInputNotAdmissibleError);
    expect(calls).toBe(1);
  });
});

describe('sanitized failure capture — census completeness and prose/PII freedom', () => {
  it('carries a complete bounded census that distinguishes repeated from unique defects', () => {
    // 86 emitted symptoms across an 8-page book, echoing the real incident count,
    // with deliberate repetition so repeated-vs-unique is explicit.
    const diagnostics: PreRenderBlueprintRepairDiagnostic[] = [];
    for (let page = 0; page < 8; page += 1) {
      // A repeated placement collision on each page (repetition within identity).
      for (let repeat = 0; repeat < 3; repeat += 1) {
        diagnostics.push({
          code: 'text_safe_collision',
          field: `frames[${page}].placements[0]`,
          message: 'placement overlaps the reserved text-safe region',
          expected: { maximumY: 750 },
          actual: { y: 800 },
        });
      }
      // A distinct reference defect per page.
      diagnostics.push({
        code: 'reference_unresolved',
        field: `frames[${page}].continuity.connectionId`,
        message: 'continuity connection references an unknown connection',
      });
    }
    // Pad to exactly 86 emitted with an additional repeated schema defect.
    while (diagnostics.length < 86) {
      diagnostics.push({
        code: 'schema_invalid',
        field: 'worldPlan.affordances[0].id',
        message: 'affordance id must be a non-empty string',
        expected: 'string',
        actual: null,
      });
    }
    expect(diagnostics).toHaveLength(86);

    const capture = buildBlueprintAuthoringSanitizedFailureCapture({
      terminalFailureCode: 'draft_validation_repair_exhausted',
      terminalReceiptDigest: hex64('r'),
      requestDigest: hex64('q'),
      contextDigest: hex64('c'),
      routes: [
        {
          routeKind: 'initial',
          ordinal: 0,
          byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
          observedInputTokens: 12007,
        },
      ],
      diagnostics,
    });
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);

    const grouped = groupPreRenderBlueprintRepairDiagnostics(diagnostics);
    expect(capture.census.totalEmitted).toBe(86);
    expect(capture.census.distinctIdentities).toBe(grouped.length);
    expect(capture.census.retainedIdentities).toBe(grouped.length);
    expect(capture.census.truncated).toBe(false);
    expect(capture.census.omittedDistinctIdentities).toBe(0);
    // No dropped or duplicated diagnostics: retained repetition counts sum to 86.
    expect(
      capture.census.identities.reduce(
        (sum, identity) => sum + identity.repetitionCount,
        0,
      ),
    ).toBe(86);
    // identityDigests are unique per distinct sanitized identity.
    expect(
      new Set(capture.census.identities.map((i) => i.identityDigest)).size,
    ).toBe(capture.census.identities.length);
    // A repeated identity is explicitly counted, not silently collapsed.
    const repeated = capture.census.identities.find(
      (identity) => identity.repetitionCount === 3,
    );
    expect(repeated).toBeDefined();
    expect(repeated!.fieldPath).not.toBeNull();
  });

  it('retains topology (IDs / indices / presence) but never narrative prose or PII', () => {
    const diagnostics: PreRenderBlueprintRepairDiagnostic[] = [
      {
        code: 'companion_state_prose_conflict',
        field: 'frames[3].narrative.summary',
        // Deliberately hostile: a real narrative sentence with a child + family name.
        message: 'Chameleon Bar hugged his mother Sarah in the moonlit clearing',
        expected: { companionPresent: true },
        actual: { name: 'Sarah', companion: 'the mother of Chameleon' },
      },
    ];
    const capture = buildBlueprintAuthoringSanitizedFailureCapture({
      terminalFailureCode: 'draft_validation_repair_exhausted',
      terminalReceiptDigest: hex64('r'),
      requestDigest: hex64('q'),
      contextDigest: hex64('c'),
      routes: [
        {
          routeKind: 'initial',
          ordinal: 0,
          byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
          observedInputTokens: 12007,
        },
      ],
      diagnostics,
    });
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);
    const serialized = JSON.stringify(capture);
    for (const forbidden of [
      'Chameleon',
      'Sarah',
      'mother',
      'moonlit',
      'hugged',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    // The structural identity survives: code, safe field path, presence flags.
    const identity = capture.census.identities[0]!;
    expect(identity.code).toBe('companion_state_prose_conflict');
    expect(identity.fieldPath).toEqual([
      'frames',
      '[3]',
      'narrative',
      'summary',
    ]);
    expect(identity.expectedPresent).toBe(true);
    expect(identity.actualPresent).toBe(true);
  });

  it('retains a large census COMPLETELY (no silent truncation)', () => {
    const diagnostics: PreRenderBlueprintRepairDiagnostic[] = [];
    for (let index = 0; index < 300; index += 1) {
      diagnostics.push({
        code: 'schema_invalid',
        field: `frames[${index}].placements[0].id`,
        message: `distinct defect ${index}`,
      });
    }
    const capture = buildBlueprintAuthoringSanitizedFailureCapture({
      terminalFailureCode: 'draft_validation_repair_exhausted',
      terminalReceiptDigest: hex64('r'),
      requestDigest: hex64('q'),
      contextDigest: hex64('c'),
      routes: [
        {
          routeKind: 'initial',
          ordinal: 0,
          byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
          observedInputTokens: 12007,
        },
      ],
      diagnostics,
    });
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);
    // Complete: every distinct identity is retained, nothing omitted.
    expect(capture.census.distinctIdentities).toBe(300);
    expect(capture.census.retainedIdentities).toBe(300);
    expect(capture.census.identities).toHaveLength(300);
    expect(capture.census.truncated).toBe(false);
    expect(capture.census.omittedDistinctIdentities).toBe(0);
    expect(capture.census.fullCensusDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails closed above the hard census bound rather than minting an incomplete census', () => {
    // > 4096 distinct identities: no capture may be minted at all.
    const diagnostics: PreRenderBlueprintRepairDiagnostic[] = [];
    for (let index = 0; index < 4_097; index += 1) {
      diagnostics.push({
        code: 'schema_invalid',
        field: `frames[${index}].placements[0].id`,
        message: `distinct defect ${index}`,
      });
    }
    expect(() =>
      buildBlueprintAuthoringSanitizedFailureCapture({
        terminalFailureCode: 'draft_validation_repair_exhausted',
        terminalReceiptDigest: hex64('r'),
        requestDigest: hex64('q'),
        contextDigest: hex64('c'),
        routes: [
          {
            routeKind: 'initial',
            ordinal: 0,
            byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
            observedInputTokens: 12007,
          },
        ],
        diagnostics,
      }),
    ).toThrow(/refusing to mint an incomplete census/);
  });

  it('rejects a hand-crafted capture that claims truncation/omission', () => {
    const capture = clone(baseCapture()) as unknown as {
      census: {
        truncated: boolean;
        omittedDistinctIdentities: number;
        distinctIdentities: number;
        retainedIdentities: number;
        totalEmitted: number;
      };
      digest: string;
    };
    // Claim one identity was omitted while leaving the retained list intact.
    capture.census.truncated = true;
    capture.census.omittedDistinctIdentities = 1;
    capture.census.distinctIdentities =
      capture.census.retainedIdentities + 1;
    capture.census.totalEmitted += 1;
    const { digest: _drop, ...rest } = capture as unknown as Record<string, unknown>;
    capture.digest = canonicalJsonDigest(rest);
    expect(
      blueprintAuthoringSanitizedFailureCaptureIsValid(
        capture as unknown as Record<string, unknown>,
      ),
    ).toBe(false);
  });

  it('rejects a forged census.fullCensusDigest even with a recomputed outer digest', () => {
    const capture = clone(baseCapture()) as unknown as {
      census: { fullCensusDigest: string };
      digest: string;
    };
    // Forge the inner full-census digest to a well-formed but WRONG hex value, then
    // recompute the outer capture digest so only the inner digest is inconsistent with
    // the actual identities. This must still fail: fullCensusDigest is now exact-checked
    // against canonicalJsonDigest(identities), not merely regex-validated.
    expect(capture.census.fullCensusDigest).toMatch(/^[a-f0-9]{64}$/);
    capture.census.fullCensusDigest = hex64('forged-full-census');
    const { digest: _drop, ...rest } = capture as unknown as Record<string, unknown>;
    capture.digest = canonicalJsonDigest(rest);
    expect(
      blueprintAuthoringSanitizedFailureCaptureIsValid(
        capture as unknown as Record<string, unknown>,
      ),
    ).toBe(false);
  });

  it('sanitizes an unsafe field into a redaction marker rather than leaking it', () => {
    expect(
      sanitizeBlueprintDiagnosticFieldPath('frames[2].placements[0]'),
    ).toEqual({
      present: true,
      path: ['frames', '[2]', 'placements', '[0]'],
      redacted: false,
    });
    expect(sanitizeBlueprintDiagnosticFieldPath(undefined)).toEqual({
      present: false,
      path: null,
      redacted: false,
    });
    // A field carrying a raw phrase / colon marker cannot be tokenized safely.
    const unsafe = sanitizeBlueprintDiagnosticFieldPath(
      'reference:prop:the lantern Sarah carries',
    );
    expect(unsafe.present).toBe(true);
    expect(unsafe.path).toBeNull();
    expect(unsafe.redacted).toBe(true);
  });

  it('redacts an arbitrary identifier-shaped key segment instead of retaining it', () => {
    // Hostile: a child/pet name used AS an object key in an otherwise valid path.
    // Every non-vocabulary key must be replaced by the redaction sentinel.
    const sanitized = sanitizeBlueprintDiagnosticFieldPath(
      'frames[0].Bar.privateThing',
    );
    expect(sanitized.present).toBe(true);
    expect(sanitized.path).toEqual(['frames', '[0]', '#redacted', '#redacted']);
    expect(sanitized.redacted).toBe(true);
    expect(sanitized.path).not.toContain('Bar');
    expect(sanitized.path).not.toContain('privateThing');
  });

  it('never retains an ASCII child/family name that appears in a syntactically valid path position', () => {
    const diagnostics: PreRenderBlueprintRepairDiagnostic[] = [
      {
        code: 'schema_invalid',
        // ASCII-only names as identifier keys, structurally valid, must be redacted.
        field: 'frames[2].Sarah.Chameleon',
        message: 'a value was invalid',
      },
    ];
    const capture = buildBlueprintAuthoringSanitizedFailureCapture({
      terminalFailureCode: 'draft_validation_repair_exhausted',
      terminalReceiptDigest: hex64('r'),
      requestDigest: hex64('q'),
      contextDigest: hex64('c'),
      routes: [
        {
          routeKind: 'initial',
          ordinal: 0,
          byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
          observedInputTokens: 12007,
        },
      ],
      diagnostics,
    });
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);
    const serialized = JSON.stringify(capture);
    expect(serialized).not.toContain('Sarah');
    expect(serialized).not.toContain('Chameleon');
    const identity = capture.census.identities[0]!;
    expect(identity.fieldPath).toEqual(['frames', '[2]', '#redacted', '#redacted']);
    expect(identity.fieldRedacted).toBe(true);
  });

  it('re-enforces the closed vocabulary on reload (an out-of-vocabulary key never validates)', () => {
    const capture = clone(baseCapture());
    // Smuggle an arbitrary identifier segment into a retained path.
    (capture.census.identities[0]!.fieldPath as string[]) = [
      'frames',
      '[0]',
      'Sarah',
    ];
    capture.census.identities[0]!.fieldPathDepth = 3;
    capture.census.identities[0]!.fieldRedacted = false;
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('groups and counts by the SANITIZED identity (distinct raw prose collapses)', () => {
    // Two raw diagnostics with the SAME code + field projection + presence, differing
    // ONLY in the (never-retained) message, are ONE sanitized identity with count 2.
    const diagnostics: PreRenderBlueprintRepairDiagnostic[] = [
      {
        code: 'schema_invalid',
        field: 'frames[0].placements[0]',
        message: 'first prose',
      },
      {
        code: 'schema_invalid',
        field: 'frames[0].placements[0]',
        message: 'second, different prose',
      },
    ];
    // Raw grouping keeps them separate (byte-distinct messages).
    expect(groupPreRenderBlueprintRepairDiagnostics(diagnostics)).toHaveLength(2);
    const capture = buildBlueprintAuthoringSanitizedFailureCapture({
      terminalFailureCode: 'draft_validation_repair_exhausted',
      terminalReceiptDigest: hex64('r'),
      requestDigest: hex64('q'),
      contextDigest: hex64('c'),
      routes: [
        {
          routeKind: 'initial',
          ordinal: 0,
          byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
          observedInputTokens: 12007,
        },
      ],
      diagnostics,
    });
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);
    // One sanitized identity, truthfully counting BOTH emissions.
    expect(capture.census.distinctIdentities).toBe(1);
    expect(capture.census.retainedIdentities).toBe(1);
    expect(capture.census.totalEmitted).toBe(2);
    expect(capture.census.identities[0]!.repetitionCount).toBe(2);
  });

  it('no persisted value equals a dictionary-attack digest of the raw diagnostic tuple', () => {
    // Exact regression for the removed raw-tuple digest: schema_invalid at
    // frames[0].<name> with an EMPTY message and NO expected/actual — the shape an
    // attacker enumerates over a short candidate name list.
    const NAME = 'Bar';
    const CANDIDATES = ['Avi', 'Bar', 'Dan', 'Sarah'];
    const diagnostics: PreRenderBlueprintRepairDiagnostic[] = [
      { code: 'schema_invalid', field: `frames[0].${NAME}`, message: '' },
    ];
    const capture = buildBlueprintAuthoringSanitizedFailureCapture({
      terminalFailureCode: 'draft_validation_repair_exhausted',
      terminalReceiptDigest: hex64('r'),
      requestDigest: hex64('q'),
      contextDigest: hex64('c'),
      routes: [
        {
          routeKind: 'initial',
          ordinal: 0,
          byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
          observedInputTokens: 12007,
        },
      ],
      diagnostics,
    });
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);

    const serialized = JSON.stringify(capture);
    // The name never survives; the field segment is redacted to the sentinel.
    for (const name of CANDIDATES) {
      expect(serialized).not.toContain(name);
    }
    const identity = capture.census.identities[0]!;
    expect(identity.fieldPath).toEqual(['frames', '[0]', '#redacted']);
    expect(identity.fieldRedacted).toBe(true);

    // The digest an attacker computes from the RAW tuple for each candidate — exactly
    // how the removed detailDigest was derived — must not appear anywhere persisted.
    const rawTupleDigest = (name: string): string =>
      canonicalJsonDigest([
        'schema_invalid',
        `frames[0].${name}`,
        '',
        [0, null],
        [0, null],
      ]);
    for (const name of CANDIDATES) {
      const guess = rawTupleDigest(name);
      expect(serialized).not.toContain(guess);
      expect(
        capture.census.identities.some((i) => i.identityDigest === guess),
      ).toBe(false);
    }
    // The persisted identity digest is a function of the SANITIZED projection ONLY.
    expect(identity.identityDigest).toBe(
      canonicalJsonDigest({
        code: 'schema_invalid',
        fieldPresent: true,
        fieldPath: ['frames', '[0]', '#redacted'],
        fieldPathDepth: 3,
        fieldRedacted: true,
        expectedPresent: false,
        actualPresent: false,
      }),
    );
  });
});

describe('sanitized failure capture v4 — ordered attempt attribution', () => {
  function trajectoryCapture(): BlueprintAuthoringSanitizedFailureCapture {
    const attemptDiagnostics = [
      Array.from({ length: 223 }, () => ({
        code: 'schema_invalid',
        field: 'frames',
        message: 'initial symptom',
      } satisfies PreRenderBlueprintRepairDiagnostic)),
      Array.from({ length: 89 }, () => ({
        code: 'reference_unresolved',
        field: 'worldPlan',
        message: 'repair symptom',
      } satisfies PreRenderBlueprintRepairDiagnostic)),
      Array.from({ length: 5 }, () => ({
        code: 'draft_assembly_failed',
        field: 'pages',
        message: 'final symptom',
      } satisfies PreRenderBlueprintRepairDiagnostic)),
    ];
    return buildBlueprintAuthoringSanitizedFailureCapture({
      terminalFailureCode: 'draft_validation_repair_exhausted',
      terminalReceiptDigest: hex64('trajectory-receipt'),
      requestDigest: hex64('trajectory-request'),
      contextDigest: hex64('trajectory-context'),
      routes: [0, 1, 2].map((ordinal) => ({
        routeKind: ordinal === 0 ? ('initial' as const) : ('repair' as const),
        ordinal,
        byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
      })),
      diagnostics: attemptDiagnostics.flat(),
      attemptDiagnostics,
    });
  }

  it('retains 223 -> 89 -> 5 as three complete censuses and one truthful aggregate', () => {
    const capture = trajectoryCapture();
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);
    expect(capture.attemptCensuses.map((entry) => entry.attempt)).toEqual([1, 2, 3]);
    expect(
      capture.attemptCensuses.map((entry) => entry.census.totalEmitted),
    ).toEqual([223, 89, 5]);
    expect(capture.census.totalEmitted).toBe(317);
    expect(capture.attemptCensuses[2]!.census.identities).toHaveLength(1);
    for (const entry of capture.attemptCensuses) {
      expect(entry.census).toMatchObject({
        truncated: false,
        omittedDistinctIdentities: 0,
      });
    }
    expect(JSON.stringify(capture)).not.toMatch(/initial symptom|repair symptom|final symptom/);
  });

  it.each([
    ['missing attempt', (entries: unknown[]) => entries.splice(1, 1)],
    ['duplicate attempt', (entries: any[]) => { entries[1].attempt = 1; }],
    ['reordered attempts', (entries: any[]) => { [entries[1], entries[2]] = [entries[2], entries[1]]; }],
    ['zero ordinal', (entries: any[]) => { entries[0].attempt = 0; }],
    ['empty census', (entries: any[]) => {
      entries[1].census = buildBlueprintAuthoringSanitizedCensus([]);
    }],
  ] as const)('rejects noncanonical attempt topology: %s', (_label, mutate) => {
    const capture = clone(trajectoryCapture());
    mutate(capture.attemptCensuses as unknown[]);
    const { digest: _drop, ...withoutDigest } = capture;
    capture.digest = canonicalJsonDigest(withoutDigest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects a fourth attempt and an attempt with no admitted generation authority', () => {
    const fourthAttempt = clone(trajectoryCapture());
    fourthAttempt.attemptCensuses.push({
      attempt: 4,
      census: clone(fourthAttempt.attemptCensuses[2]!.census),
    });
    fourthAttempt.census = mergeBlueprintAuthoringSanitizedCensuses(
      fourthAttempt.attemptCensuses.map((entry) => entry.census),
    );
    const { digest: _fourthDigest, ...fourthPayload } = fourthAttempt;
    fourthAttempt.digest = canonicalJsonDigest(fourthPayload);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(fourthAttempt)).toBe(
      false,
    );

    const missingAdmission = clone(trajectoryCapture());
    missingAdmission.admission.decisions.pop();
    const { digest: _missingDigest, ...missingPayload } = missingAdmission;
    missingAdmission.digest = canonicalJsonDigest(missingPayload);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(missingAdmission)).toBe(
      false,
    );
  });

  it('rejects name-like runtime diagnostic and terminal codes outside the closed catalogs', () => {
    expect(() =>
      buildBlueprintAuthoringSanitizedCensus([
        {
          code: 'bar',
          message: 'must never persist',
        } as unknown as PreRenderBlueprintRepairDiagnostic,
      ]),
    ).toThrow(/closed catalog/);
    expect(() =>
      buildBlueprintAuthoringSanitizedFailureCapture({
        terminalFailureCode: 'bar',
        terminalReceiptDigest: hex64('closed-terminal-receipt'),
        requestDigest: hex64('closed-terminal-request'),
        contextDigest: hex64('closed-terminal-context'),
        routes: [
          {
            routeKind: 'initial',
            ordinal: 0,
            byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
          },
        ],
        diagnostics: [
          {
            code: 'schema_invalid',
            message: 'safe structural diagnostic',
          },
        ],
      }),
    ).toThrow(/closed authoring catalog/);
  });
});

describe('sanitized failure capture — fail-closed no-authority and hostile regressions', () => {
  it('validates a well-formed capture and its no-authority semantics', () => {
    const capture = baseCapture();
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);
    expect(capture.version).toBe(
      BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
    );
    expect(capture.scope).toBe(
      BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_SCOPE,
    );
    expect(capture.doesNotAuthorize).toEqual([
      ...BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DOES_NOT_AUTHORIZE,
    ]);
    expect(capture.doesNotAuthorize).toContain('provider_dispatch');
    expect(capture.doesNotAuthorize).toContain('replacement_authorization');
  });

  it('rejects a tampered content digest', () => {
    const capture = clone(baseCapture());
    capture.digest = hex64('tampered-digest');
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects a superseded or tampered version (legacy v1 never validates)', () => {
    // v1 carried the removed raw-tuple detailDigest; it must be rejected cleanly so a
    // legacy artifact can never reintroduce the PII fingerprint under current v4 semantics.
    const capture = clone(baseCapture()) as unknown as Record<string, unknown>;
    capture.version = 'blueprint-authoring-sanitized-failure-capture/v1';
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('validates the exact aggregate-only legacy v3 shape without inventing attempts', () => {
    const current = clone(baseCapture());
    const { attemptCensuses: _attemptCensuses, digest: _digest, ...shared } = current;
    void _attemptCensuses;
    void _digest;
    const withoutDigest: Omit<
      LegacyBlueprintAuthoringSanitizedFailureCaptureV3,
      'digest'
    > = {
      ...shared,
      version: LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V3,
    };
    const legacy: LegacyBlueprintAuthoringSanitizedFailureCaptureV3 = {
      ...withoutDigest,
      digest: canonicalJsonDigest(withoutDigest),
    };
    expect(
      blueprintAuthoringSanitizedFailureCaptureVersionStatus(legacy.version),
    ).toBe('legacy_immutable');
    expect(legacyBlueprintAuthoringSanitizedFailureCaptureV3IsValid(legacy)).toBe(
      true,
    );
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(legacy)).toBe(false);
    expect('attemptCensuses' in legacy).toBe(false);
  });

  it('freezes the immutable v7/v3 admission-ledger-v1 policy inputs', () => {
    expect(Object.isFrozen(LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY)).toBe(
      true,
    );
    expect(LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY).toStrictEqual({
      model: 'gpt-5.6-sol',
      countEvidenceVersion: 'openai-responses-input-tokens-count-evidence/v1',
      inputTokenCeiling: 64_000,
      inputAccountingProtocolAllowance: 4_096,
      maxGenerationCalls: 3,
      maxProbeRoutes: 2,
      hardCeilingMicroUsd: 5_000_000,
      inputRateNumeratorTenthsMicroUsd: 55,
      outputRateNumeratorTenthsMicroUsd: 220,
      rateDivisor: 10,
      largePromptInputTokenThreshold: 272_000,
      largePromptInputMultiplier: 2,
      maxGenerationMicroUsd: 1_408_000,
      maxSuccessfulProbeMicroUsd: 352_000,
    });
  });

  it('validates the exact legacy v2 shape only through its immutable validator', () => {
    const current = baseCapture();
    const withoutDigest: Omit<
      LegacyBlueprintAuthoringSanitizedFailureCaptureV2,
      'digest'
    > = {
      version: LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V2,
      scope: current.scope,
      doesNotAuthorize: [...current.doesNotAuthorize],
      terminalFailureCode: current.terminalFailureCode,
      linkage: clone(current.linkage),
      admission: {
        policyVersion: BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION,
        boundBasis: BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS,
        ceilingTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
        routes: [
          {
            routeKind: 'initial',
            ordinal: 0,
            byteAccounting: clone(REAL_INCIDENT_INITIAL_ACCOUNTING),
            conservativeInputTokenUpperBound:
              REAL_INCIDENT_INITIAL_ACCOUNTING.estimatedBytes,
            admitted: true,
            observedInputTokens: REAL_INCIDENT_OBSERVED_INPUT_TOKENS,
            rejectionReasonCode: null,
          },
        ],
      },
      census: clone(current.census),
      digestAlgorithm: current.digestAlgorithm,
    };
    const legacy: LegacyBlueprintAuthoringSanitizedFailureCaptureV2 = {
      ...withoutDigest,
      digest: canonicalJsonDigest(withoutDigest),
    };

    expect(
      blueprintAuthoringSanitizedFailureCaptureVersionStatus(legacy.version),
    ).toBe('legacy_immutable');
    expect(legacyBlueprintAuthoringSanitizedFailureCaptureV2IsValid(legacy)).toBe(
      true,
    );
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(legacy)).toBe(false);
  });

  it('rejects an extra top-level key', () => {
    const capture = clone(baseCapture()) as unknown as Record<string, unknown>;
    capture.smuggled = 'x';
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects weakened no-authority semantics', () => {
    const capture = clone(baseCapture());
    capture.doesNotAuthorize = capture.doesNotAuthorize.filter(
      (entry) => entry !== 'provider_dispatch',
    );
    // Re-stamp so only the semantics differ, not the digest.
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects a decision whose admitted flag disagrees with its evidence', () => {
    const capture = clone(baseCapture());
    capture.admission.decisions[1]!.admitted = true;
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects a schema/accounting mismatch on the token bound', () => {
    const capture = clone(baseCapture());
    capture.admission.decisions[0]!.conservativeUpperBoundTokens += 1;
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects malformed route accounting', () => {
    const capture = clone(baseCapture()) as unknown as {
      admission: { decisions: Array<{ inputAccounting: Record<string, number> }> };
      digest: string;
    };
    capture.admission.decisions[0]!.inputAccounting.estimatedBytes = 999999;
    const { digest: _drop, ...rest } = capture as unknown as Record<string, unknown>;
    capture.digest = canonicalJsonDigest(rest);
    expect(
      blueprintAuthoringSanitizedFailureCaptureIsValid(
        capture as unknown as Record<string, unknown>,
      ),
    ).toBe(false);
  });

  it('rejects two initial decisions', () => {
    const capture = clone(baseCapture());
    capture.admission.decisions[1]!.routeKind = 'initial';
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects a linkage digest that is not a canonical sha256', () => {
    const capture = clone(baseCapture());
    capture.linkage.terminalReceiptDigest = 'not-a-digest';
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects a census whose counts contradict its identities', () => {
    const capture = clone(baseCapture());
    capture.census.totalEmitted += 5; // claim more emitted than retained
    capture.census.truncated = false;
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects planted prose smuggled into a census identity', () => {
    const capture = clone(baseCapture());
    (capture.census.identities[0] as { code: string }).code =
      'Chameleon met his mother Sarah';
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects a planted prose string anywhere via the recursive leak scan', () => {
    const capture = clone(baseCapture()) as unknown as {
      terminalFailureCode: string;
      digest: string;
    };
    capture.terminalFailureCode = 'a sentence with spaces and a Name';
    const { digest: _drop, ...rest } = capture as unknown as Record<string, unknown>;
    capture.digest = canonicalJsonDigest(rest);
    expect(
      blueprintAuthoringSanitizedFailureCaptureIsValid(
        capture as unknown as Record<string, unknown>,
      ),
    ).toBe(false);
  });

  it('rejects an over-count of admission routes at build time', () => {
    const routes = Array.from({ length: 9 }, (_unused, index) => ({
      routeKind: index === 0 ? ('initial' as const) : ('repair' as const),
      ordinal: index,
      byteAccounting: REAL_INCIDENT_INITIAL_ACCOUNTING,
    }));
    expect(() =>
      buildBlueprintAuthoringSanitizedFailureCapture({
        terminalFailureCode: 'repair_route_input_not_admissible',
        terminalReceiptDigest: hex64('r'),
        requestDigest: hex64('q'),
        contextDigest: hex64('c'),
        routes,
        diagnostics: [],
      }),
    ).toThrow();
  });
});

describe('canonical receipt-evidence capture requirement', () => {
  const attempt = (count: number, codes: readonly string[]) => ({
    validationDiagnostics: { count, codes },
  });

  it('requires a capture for a mandatory failure code alone (no attempts)', () => {
    expect(
      blueprintAuthoringFailureRequiresSanitizedCapture(
        'repair_route_input_not_admissible',
      ),
    ).toBe(true);
    expect(
      blueprintAuthoringReceiptRequiresSanitizedCapture({
        failure: { code: 'draft_validation_repair_exhausted' },
        attempts: [],
      }),
    ).toBe(true);
  });

  it('requires a capture for a NON-mandatory code that carries prior grouped diagnostics', () => {
    // The MAJOR B path: an initial invalid draft produced grouped validation
    // diagnostics, then a repair-time provider_call_failed. The code alone is not
    // mandatory, but the receipt evidence makes a capture required.
    expect(
      blueprintAuthoringFailureRequiresSanitizedCapture('provider_call_failed'),
    ).toBe(false);
    expect(
      blueprintAuthoringReceiptRequiresSanitizedCapture({
        failure: { code: 'provider_call_failed' },
        attempts: [
          attempt(3, ['draft_contract_validation_failed']),
          attempt(0, []),
        ],
      }),
    ).toBe(true);
  });

  it('requires a capture for a local_processing_failed receipt with a diagnostic-bearing attempt', () => {
    expect(
      blueprintAuthoringReceiptRequiresSanitizedCapture({
        failure: { code: 'local_processing_failed' },
        attempts: [attempt(2, ['draft_schema_validation_failed'])],
      }),
    ).toBe(true);
  });

  it('does NOT require a capture for a first-call diagnostic-less provider/boundary failure', () => {
    expect(
      blueprintAuthoringReceiptRequiresSanitizedCapture({
        failure: { code: 'provider_call_failed' },
        attempts: [attempt(0, [])],
      }),
    ).toBe(false);
    expect(
      blueprintAuthoringReceiptRequiresSanitizedCapture({
        failure: { code: 'provider_policy_mismatch' },
        attempts: [],
      }),
    ).toBe(false);
  });

  it('fails closed to not-required only for empty / malformed evidence', () => {
    expect(blueprintAuthoringReceiptRequiresSanitizedCapture(null)).toBe(false);
    expect(blueprintAuthoringReceiptRequiresSanitizedCapture(undefined)).toBe(false);
    expect(
      blueprintAuthoringReceiptRequiresSanitizedCapture({
        failure: null,
        attempts: null,
      }),
    ).toBe(false);
    // A codes-present-but-count-zero attempt still counts as diagnostic-bearing.
    expect(
      blueprintAuthoringReceiptRequiresSanitizedCapture({
        failure: { code: 'provider_call_failed' },
        attempts: [attempt(0, ['draft_contract_validation_failed'])],
      }),
    ).toBe(true);
  });
});
