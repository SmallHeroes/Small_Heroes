import {
  BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
} from './blueprintAuthoringAdmissionLedger';
import {
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY_DIGEST,
} from './blueprintAuthoringCountAwareCost';
import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
  BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION,
  BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS,
  BLUEPRINT_AUTHORING_TOKEN_RELEVANT_REQUEST_STATIC_AUTHORITY,
} from './blueprintAuthoringInputTokenAdmission';
import {
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_REPAIRS,
  BLUEPRINT_AUTHORING_MODEL,
  BLUEPRINT_AUTHORING_NO_FALLBACK,
  BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS,
  BLUEPRINT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE,
  BLUEPRINT_AUTHORING_PROVIDER,
  BLUEPRINT_AUTHORING_REASONING_EFFORT,
  BLUEPRINT_AUTHORING_REPAIR_ORDINALS,
  BLUEPRINT_AUTHORING_SERVICE_TIER,
  BLUEPRINT_AUTHORING_STORE,
  BLUEPRINT_AUTHORING_STREAM,
  BLUEPRINT_AUTHORING_TIMEOUT_MS,
  BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
} from './blueprintAuthoringPolicy';
import { canonicalJsonDigest } from './integrity';
import {
  buildPreRenderBlueprintAuthoringSystemPrompt,
  buildPreRenderBlueprintRepairSystemPrompt,
} from './preRenderBlueprintAuthoring';
import {
  PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION,
  PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
  PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION,
  type PreRenderBlueprintAuthoringPromptVersion,
  type PreRenderBlueprintRepairPromptVersion,
} from './preRenderBlueprintAuthoringContract';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION,
} from './preRenderBlueprintDraftSchema';
import {
  PRE_RENDER_BLUEPRINT_AUTHORING_AUTHORITY_VERSION,
  PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
  PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
} from './preRenderBlueprintTypes';
import {
  PRE_RENDER_BLUEPRINT_LAYOUT_POLICY,
  PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION,
} from './preRenderBlueprintLayoutPolicy';
import {
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1,
  PRE_RENDER_BLUEPRINT_PROVIDER_WIRE_VERSION,
  PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION,
} from './preRenderBlueprintProviderWire';
import {
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
} from './openaiResponsesStructuredOutputSchemaCompatibility';
import {
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY_DIGEST,
} from './openAIResponsesTransportAuthority';

export const BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_VERSION =
  'blueprint-authoring-execution-program/v1' as const;
export const BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_ALGORITHM =
  'canonical-json-sha256' as const;
/**
 * Exact immutable program used by the persisted prompt-v6/repair-wire-v1
 * request-v5 terminals. It is replay-only after the v7/v2 cutover and can
 * never authorize a fresh dispatch.
 */
export const LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V6 =
  '634498356d69cf7bc63f2cec8d037ea4d27a9371fc9a08cd7f9607fcce0b4549' as const;
/**
 * Exact immutable program used by the persisted prompt-v7 repair-projection-v1
 * request-v5 terminals. It is replay-only after the structured diagnostic
 * projection cutover and can never authorize a fresh dispatch.
 */
export const LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V7 =
  '19c5bbb1ac157cfc4d9cffe3f4133f04870a5e6b828aafc67bc8be336fa36978' as const;

const HEX_SHA256 = /^[a-f0-9]{64}$/;

export const BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_KEYS = [
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
  'repairPromptVersion',
  'repairSystemPromptDigest',
  'repairWireVersion',
  'structuredOutputCompatibilityProfileDigest',
  'structuredOutputCompatibilityProfileVersion',
  'providerWireVersion',
  'tokenRelevantRequestStaticAuthorityDigest',
  'transportAuthorityDigest',
  'version',
] as const;

export interface BlueprintAuthoringExecutionProgram {
  version: typeof BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_VERSION;
  blueprintVersion: typeof PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION;
  authoringAuthorityVersion:
    typeof PRE_RENDER_BLUEPRINT_AUTHORING_AUTHORITY_VERSION;
  authoringProvenanceVersion:
    typeof PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION;
  initialPromptVersion: typeof PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION;
  authoringSystemPromptDigest: string;
  repairPromptVersion: typeof PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION;
  repairSystemPromptDigest: string;
  providerWireVersion: typeof PRE_RENDER_BLUEPRINT_PROVIDER_WIRE_VERSION;
  repairWireVersion: typeof PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION;
  structuredOutputCompatibilityProfileVersion:
    typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
  structuredOutputCompatibilityProfileDigest: string;
  draftSchemaVersion: typeof PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION;
  draftSchemaName: typeof PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME;
  draftSchemaDigest: string;
  tokenRelevantRequestStaticAuthorityDigest: string;
  exactInputTokenResponseObject:
    typeof BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT;
  compositionPolicyVersion: typeof PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION;
  authoringPolicyDigest: string;
  inputAdmissionPolicyVersion:
    typeof BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION;
  inputTokenBoundBasis: typeof BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS;
  layoutPolicyVersion: typeof PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION;
  layoutPolicyDigest: string;
  countEvidenceVersion: typeof BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION;
  countAwareCostPolicyDigest: string;
  admissionLedgerVersion: typeof BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION;
  generationEvidenceVersion:
    typeof OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION;
  transportAuthorityDigest: string;
  digestAlgorithm: typeof BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_ALGORITHM;
  digest: string;
}

export type ReplayableBlueprintAuthoringExecutionProgram = Omit<
  BlueprintAuthoringExecutionProgram,
  'initialPromptVersion' | 'repairPromptVersion' | 'repairWireVersion'
> & {
  initialPromptVersion: PreRenderBlueprintAuthoringPromptVersion;
  repairPromptVersion: PreRenderBlueprintRepairPromptVersion;
  repairWireVersion:
    | typeof PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION
    | typeof LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1;
};

export type BlueprintAuthoringExecutionProgramStatus =
  | 'current'
  | 'legacy_immutable'
  | 'unsupported';

/**
 * Frozen complete snapshot, not reconstructed from mutable current constants.
 * This is the exact prompt-v6/wire-v1 replay-only request-v5 program admitted
 * after the v7/v2 prompt/wire cutover.
 */
export const LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6 = Object.freeze({
  admissionLedgerVersion: 'blueprint-authoring-admission-ledger/v1',
  authoringAuthorityVersion: 'pre-render-blueprint-authoring-authority/v4',
  authoringPolicyDigest:
    'a5a2052d1364685e09542fc54d25f3102621ca2fdcdb7a2b3d0a056b69da724f',
  authoringProvenanceVersion: 'pre-render-blueprint-authoring-provenance/v4',
  authoringSystemPromptDigest:
    '1b6accf0f522b02279db8aa87c388d4ef75d951e71dd21c24a93fb2babfb7051',
  blueprintVersion: 'pre-render-book-visual-blueprint/v5',
  compositionPolicyVersion: 'blueprint-composition-policy/v1',
  countAwareCostPolicyDigest:
    '0e67b4743b76ac856e14a42b1e71b2522701857ea748ed1265e71e5fc11bec19',
  countEvidenceVersion: 'openai-responses-input-tokens-count-evidence/v1',
  digest: LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V6,
  digestAlgorithm: 'canonical-json-sha256',
  draftSchemaDigest:
    '36cb86c90f11bdddae0d3ba970c73aa296e5265d178cb7fa66bdcf175e328e77',
  draftSchemaName: 'PreRenderBookVisualBlueprintWholeBookDraft',
  draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6',
  exactInputTokenResponseObject: 'response.input_tokens',
  generationEvidenceVersion: 'openai-responses-blueprint-authoring-evidence/v1',
  initialPromptVersion: 'pre-render-blueprint-authoring-prompt/v6',
  inputAdmissionPolicyVersion:
    'blueprint-authoring-conservative-input-token-admission/v1',
  inputTokenBoundBasis: 'utf8-byte-level-bpe-monotone-upper-bound',
  layoutPolicyDigest:
    'a8466698208b55f2f7c8df8e914a6a5468c6c626d1c763c100b6e01a61607c59',
  layoutPolicyVersion: 'portrait-layout-compatibility/v1',
  providerWireVersion: 'pre-render-blueprint-provider-wire/v1',
  repairPromptVersion: 'pre-render-blueprint-repair-prompt/v6',
  repairSystemPromptDigest:
    '63ada2e930c77d5cd365ad649a83aa902536e51b12daf2981cf86a2176317d33',
  repairWireVersion: LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1,
  structuredOutputCompatibilityProfileDigest:
    'c5f7cacccff01c435b15cb9d20d0b6cff9ec4c399c5978b50ee81da9fb54523a',
  structuredOutputCompatibilityProfileVersion:
    'openai-responses-structured-output-compatibility-profile/v2',
  tokenRelevantRequestStaticAuthorityDigest:
    '6b4fe1100ac3aac88fe08fe5a7d394cd6ceb51759c4704f1a968320669014491',
  transportAuthorityDigest:
    'f0a1718c6ab892bdb05375592ef6951fcb1a756ad15310a6dbda5f4212873b67',
  version: 'blueprint-authoring-execution-program/v1',
} as const satisfies ReplayableBlueprintAuthoringExecutionProgram);

/**
 * Frozen complete snapshot for prompt-v7 / repair-wire-v2 terminals written
 * before transition/composition repair diagnostics gained closed expected/actual
 * evidence. The wire format itself remains v2; repair-prompt v8 identifies the
 * new diagnostic projection that precedes REPAIR_WIRE.
 */
export const LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V7 = Object.freeze({
  admissionLedgerVersion: 'blueprint-authoring-admission-ledger/v1',
  authoringAuthorityVersion: 'pre-render-blueprint-authoring-authority/v4',
  authoringPolicyDigest:
    'a5a2052d1364685e09542fc54d25f3102621ca2fdcdb7a2b3d0a056b69da724f',
  authoringProvenanceVersion: 'pre-render-blueprint-authoring-provenance/v4',
  authoringSystemPromptDigest:
    '1cbf39920dba3241dee18e6e0a464a811f009c32d7031d2dde53bace8aa0a21b',
  blueprintVersion: 'pre-render-book-visual-blueprint/v5',
  compositionPolicyVersion: 'blueprint-composition-policy/v1',
  countAwareCostPolicyDigest:
    '0e67b4743b76ac856e14a42b1e71b2522701857ea748ed1265e71e5fc11bec19',
  countEvidenceVersion: 'openai-responses-input-tokens-count-evidence/v1',
  digest: LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_PROMPT_V7,
  digestAlgorithm: 'canonical-json-sha256',
  draftSchemaDigest:
    '36cb86c90f11bdddae0d3ba970c73aa296e5265d178cb7fa66bdcf175e328e77',
  draftSchemaName: 'PreRenderBookVisualBlueprintWholeBookDraft',
  draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6',
  exactInputTokenResponseObject: 'response.input_tokens',
  generationEvidenceVersion: 'openai-responses-blueprint-authoring-evidence/v1',
  initialPromptVersion: 'pre-render-blueprint-authoring-prompt/v7',
  inputAdmissionPolicyVersion:
    'blueprint-authoring-conservative-input-token-admission/v1',
  inputTokenBoundBasis: 'utf8-byte-level-bpe-monotone-upper-bound',
  layoutPolicyDigest:
    'a8466698208b55f2f7c8df8e914a6a5468c6c626d1c763c100b6e01a61607c59',
  layoutPolicyVersion: 'portrait-layout-compatibility/v1',
  providerWireVersion: 'pre-render-blueprint-provider-wire/v1',
  repairPromptVersion: 'pre-render-blueprint-repair-prompt/v7',
  repairSystemPromptDigest:
    'fdb174b64a7836bfe1dfc76323b62a9bd157bab5f188b4b2b74932435b8fcb8a',
  repairWireVersion: 'pre-render-blueprint-repair-wire/v2',
  structuredOutputCompatibilityProfileDigest:
    'c5f7cacccff01c435b15cb9d20d0b6cff9ec4c399c5978b50ee81da9fb54523a',
  structuredOutputCompatibilityProfileVersion:
    'openai-responses-structured-output-compatibility-profile/v2',
  tokenRelevantRequestStaticAuthorityDigest:
    '6b4fe1100ac3aac88fe08fe5a7d394cd6ceb51759c4704f1a968320669014491',
  transportAuthorityDigest:
    'f0a1718c6ab892bdb05375592ef6951fcb1a756ad15310a6dbda5f4212873b67',
  version: 'blueprint-authoring-execution-program/v1',
} as const satisfies ReplayableBlueprintAuthoringExecutionProgram);

function exactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort())
  );
}

export function blueprintAuthoringEffectivePolicyProjection() {
  return {
    provider: BLUEPRINT_AUTHORING_PROVIDER,
    model: BLUEPRINT_AUTHORING_MODEL,
    serviceTier: BLUEPRINT_AUTHORING_SERVICE_TIER,
    reasoningEffort: BLUEPRINT_AUTHORING_REASONING_EFFORT,
    store: BLUEPRINT_AUTHORING_STORE,
    stream: BLUEPRINT_AUTHORING_STREAM,
    noFallback: BLUEPRINT_AUTHORING_NO_FALLBACK,
    transportRetries: BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
    timeoutMs: BLUEPRINT_AUTHORING_TIMEOUT_MS,
    maxInputTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    maxOutputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
    maxCalls: BLUEPRINT_AUTHORING_MAX_CALLS,
    maxRepairs: BLUEPRINT_AUTHORING_MAX_REPAIRS,
    repairOrdinals: BLUEPRINT_AUTHORING_REPAIR_ORDINALS,
    hardCostCeilingUsd: BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
    promptProtocolAllowance: BLUEPRINT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE,
    priceAssumptions: BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS,
  } as const;
}

export function buildBlueprintAuthoringExecutionProgram(): BlueprintAuthoringExecutionProgram {
  const payload = {
    version: BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_VERSION,
    blueprintVersion: PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
    authoringAuthorityVersion:
      PRE_RENDER_BLUEPRINT_AUTHORING_AUTHORITY_VERSION,
    authoringProvenanceVersion:
      PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
    initialPromptVersion: PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION,
    authoringSystemPromptDigest: canonicalJsonDigest(
      buildPreRenderBlueprintAuthoringSystemPrompt(),
    ),
    repairPromptVersion: PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION,
    repairSystemPromptDigest: canonicalJsonDigest(
      buildPreRenderBlueprintRepairSystemPrompt(),
    ),
    providerWireVersion: PRE_RENDER_BLUEPRINT_PROVIDER_WIRE_VERSION,
    repairWireVersion: PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION,
    structuredOutputCompatibilityProfileVersion:
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
    structuredOutputCompatibilityProfileDigest: canonicalJsonDigest(
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE,
    ),
    draftSchemaVersion: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION,
    draftSchemaName: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
    draftSchemaDigest: canonicalJsonDigest(PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA),
    tokenRelevantRequestStaticAuthorityDigest: canonicalJsonDigest(
      BLUEPRINT_AUTHORING_TOKEN_RELEVANT_REQUEST_STATIC_AUTHORITY,
    ),
    exactInputTokenResponseObject:
      BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
    compositionPolicyVersion: PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
    authoringPolicyDigest: canonicalJsonDigest(
      blueprintAuthoringEffectivePolicyProjection(),
    ),
    inputAdmissionPolicyVersion:
      BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION,
    inputTokenBoundBasis: BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS,
    layoutPolicyVersion: PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION,
    layoutPolicyDigest: canonicalJsonDigest(PRE_RENDER_BLUEPRINT_LAYOUT_POLICY),
    countEvidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
    countAwareCostPolicyDigest:
      BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY_DIGEST,
    admissionLedgerVersion: BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
    generationEvidenceVersion:
      OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
    transportAuthorityDigest: OPENAI_RESPONSES_TRANSPORT_AUTHORITY_DIGEST,
    digestAlgorithm: BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_ALGORITHM,
  } as const;
  return {
    ...payload,
    digest: canonicalJsonDigest(payload),
  };
}

function blueprintAuthoringExecutionProgramHasValidDigest(
  value: unknown,
): value is ReplayableBlueprintAuthoringExecutionProgram {
  if (!exactKeys(value, BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_KEYS)) {
    return false;
  }
  const candidate = value as unknown as ReplayableBlueprintAuthoringExecutionProgram;
  if (
    candidate.digestAlgorithm !==
      BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_ALGORITHM ||
    typeof candidate.digest !== 'string' ||
    !HEX_SHA256.test(candidate.digest)
  ) {
    return false;
  }
  const { digest, ...payload } = candidate;
  return digest === canonicalJsonDigest(payload);
}

export function blueprintAuthoringExecutionProgramStatus(
  value: unknown,
): BlueprintAuthoringExecutionProgramStatus {
  if (!blueprintAuthoringExecutionProgramHasValidDigest(value)) {
    return 'unsupported';
  }
  if (
    canonicalJsonDigest(value) ===
    canonicalJsonDigest(buildBlueprintAuthoringExecutionProgram())
  ) {
    return 'current';
  }
  const valueDigest = canonicalJsonDigest(value);
  return [
    LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V7,
    LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
  ].some((program) => canonicalJsonDigest(program) === valueDigest)
    ? 'legacy_immutable'
    : 'unsupported';
}

export function blueprintAuthoringExecutionProgramIsCurrent(
  value: unknown,
): value is BlueprintAuthoringExecutionProgram {
  return blueprintAuthoringExecutionProgramStatus(value) === 'current';
}

export function blueprintAuthoringExecutionProgramIsReplaySupported(
  value: unknown,
): value is ReplayableBlueprintAuthoringExecutionProgram {
  return blueprintAuthoringExecutionProgramStatus(value) !== 'unsupported';
}
