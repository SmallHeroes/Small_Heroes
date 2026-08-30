import { describe, expect, it } from 'vitest';

import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
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
  BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION,
  BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS,
  blueprintAuthoringConservativeInputTokenUpperBound,
  blueprintAuthoringInputTokensAreAdmissible,
  blueprintAuthoringInputTokensExceedCeiling,
  blueprintAuthoringObservedInputTokensWithinBound,
} from '@/lib/visual-package/blueprintAuthoringInputTokenAdmission';
import {
  BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DOES_NOT_AUTHORIZE,
  BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_SCOPE,
  BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
  blueprintAuthoringSanitizedFailureCaptureIsValid,
  buildBlueprintAuthoringSanitizedFailureCapture,
  sanitizeBlueprintDiagnosticFieldPath,
  type BlueprintAuthoringSanitizedFailureCapture,
} from '@/lib/visual-package/blueprintAuthoringSanitizedFailureCapture';
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
    expect(capture.admission.routes).toHaveLength(2);
    const initialRoute = capture.admission.routes.find(
      (route) => route.routeKind === 'initial',
    )!;
    const repairRoute = capture.admission.routes.find(
      (route) => route.routeKind === 'repair',
    )!;
    expect(initialRoute.admitted).toBe(initialAdmitted);
    expect(initialRoute.observedInputTokens).toBe(
      initialAdmitted ? 12007 : null,
    );
    expect(repairRoute.admitted).toBe(false);
    expect(repairRoute.rejectionReasonCode).toBe(
      'repair_route_input_not_admissible',
    );
    expect(repairRoute.conservativeInputTokenUpperBound).toBeGreaterThan(
      BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    );
    expect(capture.census.totalEmitted).toBeGreaterThan(0);
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
    // detailDigests are unique per distinct identity.
    expect(
      new Set(capture.census.identities.map((i) => i.detailDigest)).size,
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

  it('bounds and audits an oversized census via deterministic truncation', () => {
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
    expect(capture.census.distinctIdentities).toBe(300);
    expect(capture.census.retainedIdentities).toBe(256);
    expect(capture.census.identities).toHaveLength(256);
    expect(capture.census.truncated).toBe(true);
    expect(capture.census.omittedDistinctIdentities).toBe(44);
    // The full (untruncated) census remains auditable via its digest.
    expect(capture.census.fullCensusDigest).toMatch(/^[a-f0-9]{64}$/);
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

  it('rejects a tampered version', () => {
    const capture = clone(baseCapture()) as unknown as Record<string, unknown>;
    capture.version = 'blueprint-authoring-sanitized-failure-capture/v2';
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
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

  it('rejects a route whose admitted flag disagrees with its accounting', () => {
    const capture = clone(baseCapture());
    capture.admission.routes[1]!.admitted = true; // rejected route claiming admission
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects a schema/accounting mismatch on the token bound', () => {
    const capture = clone(baseCapture());
    capture.admission.routes[0]!.conservativeInputTokenUpperBound += 1;
    const { digest: _drop, ...rest } = capture;
    (capture as { digest: string }).digest = canonicalJsonDigest(rest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(false);
  });

  it('rejects malformed route accounting', () => {
    const capture = clone(baseCapture()) as unknown as {
      admission: { routes: Array<{ byteAccounting: Record<string, number> }> };
      digest: string;
    };
    capture.admission.routes[0]!.byteAccounting.estimatedBytes = 999999;
    const { digest: _drop, ...rest } = capture as unknown as Record<string, unknown>;
    capture.digest = canonicalJsonDigest(rest);
    expect(
      blueprintAuthoringSanitizedFailureCaptureIsValid(
        capture as unknown as Record<string, unknown>,
      ),
    ).toBe(false);
  });

  it('rejects two initial routes', () => {
    const capture = clone(baseCapture());
    capture.admission.routes[1]!.routeKind = 'initial';
    capture.admission.routes[1]!.admitted = true;
    capture.admission.routes[1]!.rejectionReasonCode = null;
    capture.admission.routes[1]!.byteAccounting =
      REAL_INCIDENT_INITIAL_ACCOUNTING;
    capture.admission.routes[1]!.conservativeInputTokenUpperBound =
      REAL_INCIDENT_INITIAL_ACCOUNTING.estimatedBytes;
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
