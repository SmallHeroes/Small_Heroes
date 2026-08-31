import { describe, expect, it } from 'vitest';

import {
  BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_KEYS,
  BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_VERSION,
  blueprintAuthoringEffectivePolicyProjection,
  blueprintAuthoringExecutionProgramIsCurrent,
  buildBlueprintAuthoringExecutionProgram,
} from '../blueprintAuthoringExecutionProgram';
import {
  QA_WIZARD_BLUEPRINT_ORDINARY_EXECUTION_IDENTITY_VERSION,
  qaWizardBlueprintOrdinaryExecutionIdentityDigest,
} from '../qaWizardBlueprintAuthoringLifecycle';
import { canonicalJsonDigest } from '../integrity';
import {
  buildPreRenderBlueprintAuthoringSystemPrompt,
  buildPreRenderBlueprintRepairSystemPrompt,
} from '../preRenderBlueprintAuthoring';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
} from '../preRenderBlueprintDraftSchema';
import {
  PRE_RENDER_BLUEPRINT_LAYOUT_POLICY,
  PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION,
} from '../preRenderBlueprintLayoutPolicy';
import {
  BLUEPRINT_AUTHORING_TOKEN_RELEVANT_REQUEST_STATIC_AUTHORITY,
} from '../blueprintAuthoringInputTokenAdmission';
import { BLUEPRINT_AUTHORING_REPAIR_ORDINALS } from '../blueprintAuthoringPolicy';
import {
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY,
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY_DIGEST,
} from '../blueprintAuthoringCountAwareCost';
import {
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
} from '../openaiResponsesStructuredOutputSchemaCompatibility';
import {
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY,
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY_DIGEST,
  openAIResponsesTransportSemanticsProjection,
} from '../openAIResponsesTransportAuthority';

const EXPECTED_PROGRAM_KEYS = [
  'admissionLedgerVersion',
  'authoringAuthorityVersion',
  'authoringPolicyDigest',
  'authoringProvenanceVersion',
  'authoringSystemPromptDigest',
  'blueprintVersion',
  'compositionPolicyVersion',
  'countAwareCostPolicyDigest',
  'countEvidenceVersion',
  'digest',
  'digestAlgorithm',
  'draftSchemaDigest',
  'draftSchemaName',
  'draftSchemaVersion',
  'exactInputTokenResponseObject',
  'generationEvidenceVersion',
  'initialPromptVersion',
  'inputAdmissionPolicyVersion',
  'inputTokenBoundBasis',
  'layoutPolicyDigest',
  'layoutPolicyVersion',
  'providerWireVersion',
  'repairPromptVersion',
  'repairSystemPromptDigest',
  'repairWireVersion',
  'structuredOutputCompatibilityProfileDigest',
  'structuredOutputCompatibilityProfileVersion',
  'tokenRelevantRequestStaticAuthorityDigest',
  'transportAuthorityDigest',
  'version',
] as const;

describe('Blueprint authoring execution program identity', () => {
  it('binds exact prompt, schema, wire, compiler, admission, cost, and policy evidence', () => {
    const program = buildBlueprintAuthoringExecutionProgram();
    expect(program.version).toBe(BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_VERSION);
    expect(Object.keys(program).sort()).toEqual(
      [...EXPECTED_PROGRAM_KEYS].sort(),
    );
    expect([...BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_KEYS].sort()).toEqual(
      [...EXPECTED_PROGRAM_KEYS].sort(),
    );
    expect(program.authoringSystemPromptDigest).toBe(
      canonicalJsonDigest(buildPreRenderBlueprintAuthoringSystemPrompt()),
    );
    expect(program.repairSystemPromptDigest).toBe(
      canonicalJsonDigest(buildPreRenderBlueprintRepairSystemPrompt()),
    );
    expect(program.draftSchemaDigest).toBe(
      canonicalJsonDigest(PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA),
    );
    expect(program.draftSchemaName).toBe(PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME);
    expect(program.layoutPolicyVersion).toBe(
      PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION,
    );
    expect(program.layoutPolicyDigest).toBe(
      canonicalJsonDigest(PRE_RENDER_BLUEPRINT_LAYOUT_POLICY),
    );
    expect(program.structuredOutputCompatibilityProfileVersion).toBe(
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
    );
    expect(program.structuredOutputCompatibilityProfileDigest).toBe(
      canonicalJsonDigest(
        OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE,
      ),
    );
    expect(program.tokenRelevantRequestStaticAuthorityDigest).toBe(
      canonicalJsonDigest(
        BLUEPRINT_AUTHORING_TOKEN_RELEVANT_REQUEST_STATIC_AUTHORITY,
      ),
    );
    expect(program.transportAuthorityDigest).toBe(
      OPENAI_RESPONSES_TRANSPORT_AUTHORITY_DIGEST,
    );
    expect(OPENAI_RESPONSES_TRANSPORT_AUTHORITY).toEqual({
      version: 'openai-responses-transport-authority/v1',
      generation: {
        baseUrl: 'https://api.openai.com/v1',
        endpointUrl: 'https://api.openai.com/v1/responses',
        method: 'POST',
        redirect: 'error',
        maxDispatches: 1,
        sdkIdentity: {
          organization: null,
          project: null,
        },
        forbiddenIdentityHeaders: [
          'openai-organization',
          'openai-project',
          'openai-webhook-secret',
        ],
      },
      inputTokenCount: {
        baseUrl: 'https://api.openai.com/v1',
        endpointUrl: 'https://api.openai.com/v1/responses/input_tokens',
        method: 'POST',
        redirect: 'error',
        maxDispatches: 1,
        sdkIdentity: {
          organization: null,
          project: null,
        },
        forbiddenIdentityHeaders: [
          'openai-organization',
          'openai-project',
          'openai-webhook-secret',
        ],
      },
    });
    expect(program.transportAuthorityDigest).toBe(
      canonicalJsonDigest(openAIResponsesTransportSemanticsProjection()),
    );
    expect(openAIResponsesTransportSemanticsProjection()).not.toHaveProperty(
      'version',
    );
    expect(
      openAIResponsesTransportSemanticsProjection().generation
        .forbiddenIdentityHeaders,
    ).toEqual(
      [...OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.forbiddenIdentityHeaders]
        .map((value) => value.toLowerCase())
        .sort(),
    );
    expect(Object.isFrozen(OPENAI_RESPONSES_TRANSPORT_AUTHORITY)).toBe(true);
    expect(Object.isFrozen(OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation)).toBe(
      true,
    );
    expect(
      Object.isFrozen(
        OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.sdkIdentity,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(
        OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount
          .forbiddenIdentityHeaders,
      ),
    ).toBe(true);
    expect(program.countAwareCostPolicyDigest).toBe(
      BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY_DIGEST,
    );
    expect(program.countAwareCostPolicyDigest).toBe(
      canonicalJsonDigest(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY),
    );
    expect(Object.isFrozen(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY)).toBe(
      true,
    );
    expect(
      Object.isFrozen(
        BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.inputTokenProbe,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(
        BLUEPRINT_AUTHORING_TOKEN_RELEVANT_REQUEST_STATIC_AUTHORITY,
      ),
    ).toBe(true);
    expect(
      BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.inputTokenProbe
        .largePromptInputTokenThreshold,
    ).toBe(272_000);
    expect(
      BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.inputTokenProbe
        .largePromptInputMultiplier,
    ).toBe(2);
    expect(blueprintAuthoringEffectivePolicyProjection()).not.toHaveProperty(
      'endpoint',
    );
    expect(blueprintAuthoringEffectivePolicyProjection()).not.toHaveProperty(
      'toolsDisabled',
    );
    expect(blueprintAuthoringEffectivePolicyProjection()).toMatchObject({
      repairOrdinals: [1, 2],
      maxRepairs: 2,
    });
    expect(blueprintAuthoringEffectivePolicyProjection()).not.toHaveProperty(
      'maxCountProbes',
    );
    expect(
      blueprintAuthoringEffectivePolicyProjection().priceAssumptions,
    ).not.toHaveProperty('version');
    expect(
      blueprintAuthoringEffectivePolicyProjection().priceAssumptions,
    ).not.toHaveProperty('currency');
    expect(
      blueprintAuthoringEffectivePolicyProjection().priceAssumptions,
    ).not.toHaveProperty('source');
    expect(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY).not.toHaveProperty(
      'version',
    );
    expect(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY).not.toHaveProperty(
      'unit',
    );
    expect(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY).not.toHaveProperty(
      'microUsdPerUsd',
    );
    expect(Object.isFrozen(BLUEPRINT_AUTHORING_REPAIR_ORDINALS)).toBe(true);
    expect(program.digest).toBe(
      '634498356d69cf7bc63f2cec8d037ea4d27a9371fc9a08cd7f9607fcce0b4549',
    );
    expect(blueprintAuthoringExecutionProgramIsCurrent(program)).toBe(true);
  });

  it('rejects missing, added, stale, and self-redigested noncanonical program evidence', () => {
    const current = buildBlueprintAuthoringExecutionProgram();
    const missing = structuredClone(current) as unknown as Record<
      string,
      unknown
    >;
    delete missing.repairWireVersion;
    expect(blueprintAuthoringExecutionProgramIsCurrent(missing)).toBe(false);

    const added = { ...current, callerRetryNonce: 'forbidden' };
    expect(blueprintAuthoringExecutionProgramIsCurrent(added)).toBe(false);

    const stale = structuredClone(current) as typeof current;
    stale.authoringSystemPromptDigest = '0'.repeat(64);
    expect(blueprintAuthoringExecutionProgramIsCurrent(stale)).toBe(false);

    const selfRedigested = structuredClone(current) as typeof current;
    selfRedigested.draftSchemaDigest = '1'.repeat(64);
    const { digest: _digest, ...payload } = selfRedigested;
    selfRedigested.digest = canonicalJsonDigest(payload);
    expect(blueprintAuthoringExecutionProgramIsCurrent(selfRedigested)).toBe(
      false,
    );

    for (const field of [
      'countAwareCostPolicyDigest',
      'transportAuthorityDigest',
      'tokenRelevantRequestStaticAuthorityDigest',
    ] as const) {
      const hostile = structuredClone(current);
      hostile[field] = '2'.repeat(64);
      const { digest: _hostileDigest, ...hostilePayload } = hostile;
      void _hostileDigest;
      hostile.digest = canonicalJsonDigest(hostilePayload);
      expect(blueprintAuthoringExecutionProgramIsCurrent(hostile)).toBe(false);
    }
  });

  it('keeps digest-bearing runtime authorities immutable after their digests are cached', () => {
    const before = buildBlueprintAuthoringExecutionProgram();
    expect(
      Reflect.set(
        BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.inputTokenProbe,
        'largePromptInputTokenThreshold',
        1,
      ),
    ).toBe(false);
    expect(
      Reflect.set(
        OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation,
        'endpointUrl',
        'https://example.invalid/v1/responses',
      ),
    ).toBe(false);
    expect(buildBlueprintAuthoringExecutionProgram()).toEqual(before);
  });

  it('derives one slot from content plus program and excludes operator request metadata', () => {
    const program = buildBlueprintAuthoringExecutionProgram();
    const authoringAuthorityDigest = 'a'.repeat(64);
    const first = qaWizardBlueprintOrdinaryExecutionIdentityDigest({
      authoringAuthorityDigest,
      program,
    });
    const second = qaWizardBlueprintOrdinaryExecutionIdentityDigest({
      authoringAuthorityDigest,
      program: structuredClone(program),
    });
    expect(first).toBe(second);
    expect(first).not.toBe(authoringAuthorityDigest);
    expect(first).toBe(
      canonicalJsonDigest({
        version: QA_WIZARD_BLUEPRINT_ORDINARY_EXECUTION_IDENTITY_VERSION,
        authoringAuthorityDigest,
        executionProgramDigest: program.digest,
      }),
    );
    expect(
      qaWizardBlueprintOrdinaryExecutionIdentityDigest({
        authoringAuthorityDigest: 'b'.repeat(64),
        program,
      }),
    ).not.toBe(first);
  });
});
