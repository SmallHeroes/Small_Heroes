import { describe, expect, it } from 'vitest';

import {
  BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_KEYS,
  BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_VERSION,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_CAMERA_AUTHORITY,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_CAMERA_AUTHORITY,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V6,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V7,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_REPAIR_PROMPT_V8,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V7,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_REPAIR_PROMPT_V8,
  blueprintAuthoringEffectivePolicyProjection,
  blueprintAuthoringExecutionProgramIsCurrent,
  blueprintAuthoringExecutionProgramIsReplaySupported,
  blueprintAuthoringExecutionProgramStatus,
  buildBlueprintAuthoringExecutionProgram,
} from '../blueprintAuthoringExecutionProgram';
import {
  QA_WIZARD_BLUEPRINT_ORDINARY_EXECUTION_IDENTITY_VERSION,
  qaWizardBlueprintAuthoringProvenanceVersionsForRequest,
  qaWizardBlueprintOrdinaryExecutionIdentityDigest,
} from '../qaWizardBlueprintAuthoringLifecycle';
import { canonicalJsonDigest } from '../integrity';
import {
  buildPreRenderBlueprintAuthoringSystemPrompt,
  buildPreRenderBlueprintRepairSystemPrompt,
} from '../preRenderBlueprintAuthoring';
import {
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V5,
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5,
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6,
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V6,
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V6,
  PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V8,
  PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V8,
  PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V9,
  PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V9,
  PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V9,
  PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V9,
  PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V10,
  PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V10,
  legacyPreRenderBlueprintPromptEvidenceForSystemPromptDigest,
  preRenderBlueprintSystemPromptUtf8BytesForDigest,
} from '../preRenderBlueprintAuthoringContract';
import {
  frozenBlueprintAuthoringSystemPromptV8,
  frozenBlueprintAuthoringSystemPromptV6,
  frozenBlueprintRepairSystemPromptV9,
  frozenBlueprintRepairSystemPromptV6,
} from './fixtures/frozen-blueprint-authoring-v6-evidence';
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
    expect(program.initialPromptVersion).toBe(
      'pre-render-blueprint-authoring-prompt/v9',
    );
    expect(program.repairPromptVersion).toBe(
      'pre-render-blueprint-repair-prompt/v10',
    );
    expect(program.providerWireVersion).toBe(
      'pre-render-blueprint-provider-wire/v2',
    );
    expect(program.repairWireVersion).toBe(
      'pre-render-blueprint-repair-wire/v4',
    );
    expect(program.draftSchemaVersion).toBe(
      'pre-render-blueprint-draft-schema/v8',
    );
    expect(program.digest).toBe(
      '0944bdb56a83368e6c22feb886f0cfeed3b9a195ad01918e5ffd7d61de275f4b',
    );
    expect(canonicalJsonDigest(program)).toBe(
      '9b6684a83f4c482633bfd52da591d61f1887448f39204eb34f5f67645f385aec',
    );
    expect(blueprintAuthoringExecutionProgramIsCurrent(program)).toBe(true);
  });

  it('admits only complete immutable historical programs for replay', () => {
    const cameraAuthority =
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_CAMERA_AUTHORITY;
    const { digest: _cameraAuthorityDigest, ...cameraAuthorityPayload } =
      cameraAuthority;
    expect(canonicalJsonDigest(cameraAuthorityPayload)).toBe(
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_CAMERA_AUTHORITY,
    );
    expect(canonicalJsonDigest(cameraAuthority)).toBe(
      '5590fdaef3b853b956d6126bcb25ac1447c97cc172eaf907da88e0c399f16bb4',
    );
    expect(cameraAuthority.digest).toBe(
      '1bd60e8c172304aa8c05715e76149b69b7f36992111d37cd86a98db9da6bbe10',
    );
    expect(Object.isFrozen(cameraAuthority)).toBe(true);
    expect(blueprintAuthoringExecutionProgramStatus(cameraAuthority)).toBe(
      'legacy_immutable',
    );
    expect(
      blueprintAuthoringExecutionProgramIsReplaySupported(cameraAuthority),
    ).toBe(true);
    expect(
      blueprintAuthoringExecutionProgramIsCurrent(cameraAuthority),
    ).toBe(false);
    expect(
      qaWizardBlueprintAuthoringProvenanceVersionsForRequest({
        version: 'production-blueprint-authoring-request/v5',
        program: cameraAuthority,
      } as Parameters<
        typeof qaWizardBlueprintAuthoringProvenanceVersionsForRequest
      >[0]),
    ).toEqual({
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v7',
      promptVersion: 'pre-render-blueprint-authoring-prompt/v8',
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v9',
    });

    const formerCurrent =
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_REPAIR_PROMPT_V8;
    const { digest: _formerCurrentDigest, ...formerCurrentPayload } =
      formerCurrent;
    expect(canonicalJsonDigest(formerCurrentPayload)).toBe(
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_REPAIR_PROMPT_V8,
    );
    expect(formerCurrent.digest).toBe(
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_REPAIR_PROMPT_V8,
    );
    expect(Object.isFrozen(formerCurrent)).toBe(true);
    expect(blueprintAuthoringExecutionProgramStatus(formerCurrent)).toBe(
      'legacy_immutable',
    );
    expect(
      blueprintAuthoringExecutionProgramIsReplaySupported(formerCurrent),
    ).toBe(true);
    expect(blueprintAuthoringExecutionProgramIsCurrent(formerCurrent)).toBe(
      false,
    );
    expect(
      qaWizardBlueprintAuthoringProvenanceVersionsForRequest({
        version: 'production-blueprint-authoring-request/v5',
        program: formerCurrent,
      } as Parameters<
        typeof qaWizardBlueprintAuthoringProvenanceVersionsForRequest
      >[0]),
    ).toEqual({
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6',
      promptVersion: 'pre-render-blueprint-authoring-prompt/v7',
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v8',
    });
    const legacyV7 = LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V7;
    const { digest: _legacyV7Digest, ...legacyV7Payload } = legacyV7;
    expect(canonicalJsonDigest(legacyV7Payload)).toBe(
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V7,
    );
    expect(legacyV7.digest).toBe(
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V7,
    );
    expect(Object.isFrozen(legacyV7)).toBe(true);
    expect(legacyV7.initialPromptVersion).toBe(
      'pre-render-blueprint-authoring-prompt/v7',
    );
    expect(legacyV7.repairPromptVersion).toBe(
      'pre-render-blueprint-repair-prompt/v7',
    );
    expect(legacyV7.repairWireVersion).toBe(
      'pre-render-blueprint-repair-wire/v2',
    );
    expect(blueprintAuthoringExecutionProgramStatus(legacyV7)).toBe(
      'legacy_immutable',
    );
    expect(blueprintAuthoringExecutionProgramIsReplaySupported(legacyV7)).toBe(
      true,
    );
    expect(blueprintAuthoringExecutionProgramIsCurrent(legacyV7)).toBe(false);
    expect(
      qaWizardBlueprintAuthoringProvenanceVersionsForRequest({
        version: 'production-blueprint-authoring-request/v5',
        program: legacyV7,
      } as Parameters<
        typeof qaWizardBlueprintAuthoringProvenanceVersionsForRequest
      >[0]),
    ).toEqual({
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6',
      promptVersion: 'pre-render-blueprint-authoring-prompt/v7',
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v7',
    });

    const legacy = LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6;
    const { digest: _digest, ...payload } = legacy;
    expect(canonicalJsonDigest(payload)).toBe(
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V6,
    );
    expect(legacy.digest).toBe(
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V6,
    );
    expect(Object.isFrozen(legacy)).toBe(true);
    expect(legacy.initialPromptVersion).toBe(
      'pre-render-blueprint-authoring-prompt/v6',
    );
    expect(legacy.repairPromptVersion).toBe(
      'pre-render-blueprint-repair-prompt/v6',
    );
    expect(legacy.repairWireVersion).toBe(
      'pre-render-blueprint-repair-wire/v1',
    );
    expect(blueprintAuthoringExecutionProgramStatus(legacy)).toBe(
      'legacy_immutable',
    );
    expect(blueprintAuthoringExecutionProgramIsReplaySupported(legacy)).toBe(
      true,
    );
    expect(blueprintAuthoringExecutionProgramIsCurrent(legacy)).toBe(false);
    expect(
      qaWizardBlueprintAuthoringProvenanceVersionsForRequest({
        version: 'production-blueprint-authoring-request/v5',
        program: legacy,
      } as Parameters<
        typeof qaWizardBlueprintAuthoringProvenanceVersionsForRequest
      >[0]),
    ).toEqual({
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6',
      promptVersion: 'pre-render-blueprint-authoring-prompt/v6',
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v6',
    });
    const current = buildBlueprintAuthoringExecutionProgram();
    expect(
      qaWizardBlueprintAuthoringProvenanceVersionsForRequest({
        version: 'production-blueprint-authoring-request/v5',
        program: current,
      } as Parameters<
        typeof qaWizardBlueprintAuthoringProvenanceVersionsForRequest
      >[0]),
    ).toEqual({
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v8',
      promptVersion: 'pre-render-blueprint-authoring-prompt/v9',
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v10',
    });
    expect(
      qaWizardBlueprintAuthoringProvenanceVersionsForRequest(
        {
          version: 'production-blueprint-authoring-request/v4',
        } as Parameters<
          typeof qaWizardBlueprintAuthoringProvenanceVersionsForRequest
        >[0],
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5,
      ),
    ).toEqual({
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6',
      promptVersion: 'pre-render-blueprint-authoring-prompt/v5',
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v5',
    });
    expect(
      qaWizardBlueprintAuthoringProvenanceVersionsForRequest(
        {
          version: 'production-blueprint-authoring-request/v4',
        } as Parameters<
          typeof qaWizardBlueprintAuthoringProvenanceVersionsForRequest
        >[0],
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
      ),
    ).toEqual({
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6',
      promptVersion: 'pre-render-blueprint-authoring-prompt/v6',
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v6',
    });
    expect(() =>
      qaWizardBlueprintAuthoringProvenanceVersionsForRequest(
        {
          version: 'production-blueprint-authoring-request/v4',
        } as Parameters<
          typeof qaWizardBlueprintAuthoringProvenanceVersionsForRequest
        >[0],
        'f'.repeat(64),
      ),
    ).toThrow(
      'completed Blueprint evidence has an unknown legacy system-prompt digest',
    );
    expect(
      qaWizardBlueprintOrdinaryExecutionIdentityDigest({
        authoringAuthorityDigest: 'a'.repeat(64),
        program: legacy,
      }),
    ).not.toBe(
      qaWizardBlueprintOrdinaryExecutionIdentityDigest({
        authoringAuthorityDigest: 'a'.repeat(64),
        program: current,
      }),
    );
    expect(
      qaWizardBlueprintOrdinaryExecutionIdentityDigest({
        authoringAuthorityDigest: 'a'.repeat(64),
        program: legacyV7,
      }),
    ).not.toBe(
      qaWizardBlueprintOrdinaryExecutionIdentityDigest({
        authoringAuthorityDigest: 'a'.repeat(64),
        program: current,
      }),
    );

    for (const frozen of [
      cameraAuthority,
      formerCurrent,
      legacyV7,
      legacy,
    ]) {
      const hostile = structuredClone(frozen) as Record<string, unknown>;
      hostile.repairSystemPromptDigest = 'f'.repeat(64);
      const { digest: _oldDigest, ...hostilePayload } = hostile;
      void _oldDigest;
      hostile.digest = canonicalJsonDigest(hostilePayload);
      expect(blueprintAuthoringExecutionProgramStatus(hostile)).toBe(
        'unsupported',
      );
      expect(blueprintAuthoringExecutionProgramIsReplaySupported(hostile)).toBe(
        false,
      );
    }
  });

  it('pins every replayable prompt identity to its exact digest and UTF-8 byte length', () => {
    const currentInitial = buildPreRenderBlueprintAuthoringSystemPrompt();
    const currentRepair = buildPreRenderBlueprintRepairSystemPrompt();
    const frozenInitial = frozenBlueprintAuthoringSystemPromptV6();
    const frozenRepair = frozenBlueprintRepairSystemPromptV6();
    const cameraAuthorityInitial = frozenBlueprintAuthoringSystemPromptV8();
    const cameraAuthorityRepair = frozenBlueprintRepairSystemPromptV9();

    expect(canonicalJsonDigest(currentInitial)).toBe(
      PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V9,
    );
    expect(Buffer.byteLength(currentInitial, 'utf8')).toBe(
      PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V9,
    );
    expect(canonicalJsonDigest(currentRepair)).toBe(
      PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V10,
    );
    expect(Buffer.byteLength(currentRepair, 'utf8')).toBe(
      PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V10,
    );
    expect(canonicalJsonDigest(cameraAuthorityInitial)).toBe(
      PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V8,
    );
    expect(Buffer.byteLength(cameraAuthorityInitial, 'utf8')).toBe(
      PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V8,
    );
    expect(canonicalJsonDigest(cameraAuthorityRepair)).toBe(
      PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V9,
    );
    expect(Buffer.byteLength(cameraAuthorityRepair, 'utf8')).toBe(
      PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V9,
    );
    expect(canonicalJsonDigest(frozenInitial)).toBe(
      LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
    );
    expect(Buffer.byteLength(frozenInitial, 'utf8')).toBe(
      LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6,
    );
    expect(canonicalJsonDigest(frozenRepair)).toBe(
      LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V6,
    );
    expect(Buffer.byteLength(frozenRepair, 'utf8')).toBe(
      LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V6,
    );

    expect(
      legacyPreRenderBlueprintPromptEvidenceForSystemPromptDigest(
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
      ),
    ).toEqual({
      promptVersion: 'pre-render-blueprint-authoring-prompt/v6',
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v6',
      initialSystemPromptDigest:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
      initialSystemPromptUtf8Bytes:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6,
      repairSystemPromptDigest:
        LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V6,
      repairSystemPromptUtf8Bytes:
        LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V6,
    });
    expect(
      legacyPreRenderBlueprintPromptEvidenceForSystemPromptDigest(
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5,
      ),
    ).toMatchObject({
      initialSystemPromptUtf8Bytes:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V5,
      repairSystemPromptDigest: null,
      repairSystemPromptUtf8Bytes: null,
    });
    expect(
      preRenderBlueprintSystemPromptUtf8BytesForDigest('f'.repeat(64)),
    ).toBeNull();
    expect(
      preRenderBlueprintSystemPromptUtf8BytesForDigest(
        PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V8,
      ),
    ).toBe(PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V8);
    expect(
      preRenderBlueprintSystemPromptUtf8BytesForDigest(
        PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V9,
      ),
    ).toBe(PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V9);
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

    const cameraAuthority =
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_CAMERA_AUTHORITY;
    const identityGroups = [
      ['schema', ['draftSchemaVersion', 'draftSchemaDigest']],
      [
        'initial_prompt',
        ['initialPromptVersion', 'authoringSystemPromptDigest'],
      ],
      ['repair_prompt', ['repairPromptVersion', 'repairSystemPromptDigest']],
      ['provider_wire', ['providerWireVersion']],
      ['repair_wire', ['repairWireVersion']],
    ] as const;
    const hybrids: Array<{
      direction: 'camera_to_current' | 'current_to_camera';
      identity: (typeof identityGroups)[number][0];
      program: Record<string, unknown>;
    }> = [];
    for (const [identity, fields] of identityGroups) {
      for (const [direction, source, donor] of [
        ['current_to_camera', current, cameraAuthority],
        ['camera_to_current', cameraAuthority, current],
      ] as const) {
        const program = structuredClone(source) as unknown as Record<
          string,
          unknown
        >;
        for (const field of fields) program[field] = donor[field];
        hybrids.push({ direction, identity, program });
      }
    }
    expect(hybrids).toHaveLength(10);
    for (const { direction, identity, program: hybrid } of hybrids) {
      const { digest: _hybridDigest, ...hybridPayload } = hybrid;
      void _hybridDigest;
      hybrid.digest = canonicalJsonDigest(hybridPayload);
      const label = `${direction}:${identity}`;
      expect(
        blueprintAuthoringExecutionProgramStatus(hybrid),
        label,
      ).toBe('unsupported');
      expect(
        blueprintAuthoringExecutionProgramIsReplaySupported(hybrid),
        label,
      ).toBe(false);
      expect(blueprintAuthoringExecutionProgramIsCurrent(hybrid), label).toBe(
        false,
      );
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
