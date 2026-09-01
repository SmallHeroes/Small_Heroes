import {
  blueprintAuthoringContinuationReservationMicroUsd,
  blueprintAuthoringProbeReservationMicroUsd,
} from '../../blueprintAuthoringCountAwareCost';
import {
  blueprintAuthoringTokenRelevantRequestProjection,
} from '../../blueprintAuthoringInputTokenAdmission';
import {
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_REPAIRS,
  blueprintAuthoringInputAccounting,
} from '../../blueprintAuthoringPolicy';
import {
  buildPreRenderBlueprintAuthoringSystemPrompt,
  buildPreRenderBlueprintRepairSystemPrompt,
} from '../../preRenderBlueprintAuthoring';
import {
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6,
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V6,
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V6,
  PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V8,
  PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V8,
  PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V9,
  PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V9,
} from '../../preRenderBlueprintAuthoringContract';
import {
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1,
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2,
  serializeLegacyPreRenderBlueprintRepairWireV2,
} from '../../preRenderBlueprintProviderWire';
import {
  LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V6,
} from '../../preRenderBlueprintDraftSchema';
import type { PreRenderBlueprintValidationContext } from '../../preRenderBlueprintTypes';
import type { ProductionAuthoringProvider } from '../../productionAuthoringRunner';
import { canonicalJsonDigest } from '../../integrity';

type ProviderCall = Parameters<ProductionAuthoringProvider['call']>[0];

type MutableAdmissionDecision = Record<string, unknown> & {
  admitted: boolean;
  conservativeUpperBoundTokens: number;
  continuationReservationMicroUsd: number | null;
  countResult: (Record<string, unknown> & { countRequestDigest: string }) | null;
  generationAccountedMicroUsdBeforeRoute: number;
  inputAccounting: unknown;
  inputAccountingDigest: string;
  probe: Record<string, unknown> & {
    cumulativeDebitMicroUsd: number;
    debitMicroUsd: number;
    reservationBeforeDispatchMicroUsd: number | null;
  };
  tokenRelevantRequestDigest: string;
  totalAccountedMicroUsdBeforeGeneration: number;
};

type MutableAttempt = Record<string, unknown> & {
  inputAccounting: unknown;
  inputAdmissionDigest: string;
  systemPromptDigest: string;
  tokenRelevantRequestDigest: string;
  userPromptDigest: string;
};

const INITIAL_V7_ONLY_BLOCK = [
  'For every traversal, both footprint dimensions must be at least minimumClearance. For every opening_clearance,',
  'find every traversal named by its connection in the same zone; both clearanceRegion dimensions must be at',
  'least the greatest minimumClearance among them. Satisfy this while authoring the connection topology.',
].join('\n');

const REPAIR_V7_ONLY_BLOCK = [
  'For every traversal, both footprint dimensions must be at least minClearance. For every opening, find every',
  'traversal named by its connection in the same zone; both clearance dimensions must be at least the greatest',
  'minClearance among them. Repair zone authority and these dimensions together; do not wait for another pass.',
].join('\n');

const AUTHORING_V8_ONLY_BLOCK = [
  'Camera frame consumers are compiler-owned: every camera_access has consumers=[]; choose it only through',
  'the matching frame camera.affordanceId. Never output a frameId consumer.',
].join('\n');

const REPAIR_V9_ONLY_BLOCK = [
  'Camera frame consumers are compiler-owned: camera_access consumers must remain empty; choose the camera',
  'only through each frame camera affordanceId. Never output or restore a frameId consumer.',
].join('\n');

const AUTHORING_V9_ONLY_BLOCK = [
  'choices={a:[[page,checkId]],p:[[page,propId]],t:[page],s:[[page,subjectId,relation,targetRef]]};',
  'every non-camera affordance consumer is {kind,choiceIndex} into that matching zero-based choices list.',
  'Use action only on action_space, placement only on placement_support, transition only on traversal/',
  'opening_clearance/safe_boundary, and safety only on safe_boundary. Never copy canonical consumer IDs.',
].join('\n');

const REPAIR_V10_CHOICE_BLOCK = [
  'Authority choices are a/p/t/s ordered canonical consumer lists. Every affordance starts',
  '[id,kind,zone,footprint[x,y,w,h],consumers,...kindFields]. Consumer tuples use',
  "['a',choiceIndex], ['p',choiceIndex], ['t',choiceIndex], or ['s',choiceIndex].",
  'Choose only a valid zero-based index of the matching authority list and only a consumer kind allowed by the',
  'strict schema for that affordance kind. Never copy page/check/prop/safety identity fields into a consumer.',
  'If an affordance has no compatible canonical choice, remove that unused affordance rather than inventing one.',
  'Kind fields follow the supplied output schema in schema order.',
].join('\n');

const REPAIR_V9_RAW_CONSUMER_BLOCK = [
  'Every affordance starts [id,kind,zone,footprint[x,y,w,h],consumers,...kindFields]. Consumer tuples use',
  "['a',page,checkId], ['p',page,propId], ['t',page], or",
  "['s',page,subjectId,relation,targetRef]. Kind fields follow the supplied output schema in schema order.",
].join('\n');

const CURRENT_REPAIR_CONSUMER_TUPLE_LINE =
  "['a',page,checkId], ['p',page,propId], ['t',page], or";
const LEGACY_REPAIR_CONSUMER_TUPLE_LINE =
  "['f',frameId], ['a',page,checkId], ['p',page,propId], ['t',page], or";

function removeExactCurrentOnlyBlock(prompt: string, block: string): string {
  const marker = `${block}\n`;
  if (prompt.split(marker).length !== 2) {
    throw new Error('frozen prompt-v6 fixture cannot identify the exact v7-only block');
  }
  return prompt.replace(marker, '');
}

function replaceExactCurrentOnlyLine(
  prompt: string,
  currentLine: string,
  historicalLine: string,
): string {
  if (prompt.split(currentLine).length !== 2) {
    throw new Error('frozen prompt fixture cannot identify one exact current-only line');
  }
  return prompt.replace(currentLine, historicalLine);
}

function replaceExactCurrentOnlyBlock(
  prompt: string,
  currentBlock: string,
  historicalBlock: string,
): string {
  if (prompt.split(currentBlock).length !== 2) {
    throw new Error('frozen prompt fixture cannot identify one exact current-only block');
  }
  return prompt.replace(currentBlock, historicalBlock);
}

export function frozenBlueprintAuthoringSystemPromptV8(): string {
  const prompt = removeExactCurrentOnlyBlock(
    buildPreRenderBlueprintAuthoringSystemPrompt(),
    AUTHORING_V9_ONLY_BLOCK,
  );
  if (
    canonicalJsonDigest(prompt) !==
      PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V8 ||
    Buffer.byteLength(prompt, 'utf8') !==
      PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V8
  ) {
    throw new Error('frozen authoring prompt-v8 evidence drifted');
  }
  return prompt;
}

function frozenBlueprintAuthoringSystemPromptV7(): string {
  return removeExactCurrentOnlyBlock(
    frozenBlueprintAuthoringSystemPromptV8(),
    AUTHORING_V8_ONLY_BLOCK,
  );
}

export function frozenBlueprintRepairSystemPromptV9(): string {
  const prompt = replaceExactCurrentOnlyBlock(
    buildPreRenderBlueprintRepairSystemPrompt(),
    REPAIR_V10_CHOICE_BLOCK,
    REPAIR_V9_RAW_CONSUMER_BLOCK,
  );
  if (
    canonicalJsonDigest(prompt) !==
      PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V9 ||
    Buffer.byteLength(prompt, 'utf8') !==
      PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V9
  ) {
    throw new Error('frozen repair prompt-v9 evidence drifted');
  }
  return prompt;
}

function frozenBlueprintRepairSystemPromptV8(): string {
  return replaceExactCurrentOnlyLine(
    removeExactCurrentOnlyBlock(
      frozenBlueprintRepairSystemPromptV9(),
      REPAIR_V9_ONLY_BLOCK,
    ),
    CURRENT_REPAIR_CONSUMER_TUPLE_LINE,
    LEGACY_REPAIR_CONSUMER_TUPLE_LINE,
  );
}

export function frozenBlueprintAuthoringSystemPromptV6(): string {
  const prompt = removeExactCurrentOnlyBlock(
    frozenBlueprintAuthoringSystemPromptV7(),
    INITIAL_V7_ONLY_BLOCK,
  );
  if (
    canonicalJsonDigest(prompt) !==
      LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6 ||
    Buffer.byteLength(prompt, 'utf8') !==
      LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6
  ) {
    throw new Error('frozen authoring prompt-v6 evidence drifted');
  }
  return prompt;
}

export function frozenBlueprintRepairSystemPromptV6(): string {
  const prompt = removeExactCurrentOnlyBlock(
    frozenBlueprintRepairSystemPromptV8(),
    REPAIR_V7_ONLY_BLOCK,
  );
  if (
    canonicalJsonDigest(prompt) !==
      LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V6 ||
    Buffer.byteLength(prompt, 'utf8') !==
      LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V6
  ) {
    throw new Error('frozen repair prompt-v6 evidence drifted');
  }
  return prompt;
}

const REPAIR_WIRE_MARKER = 'REPAIR_WIRE:\n';

export function frozenBlueprintRepairUserPromptV6(args: {
  currentCall: ProviderCall;
  context: PreRenderBlueprintValidationContext;
  previousRawDraft: unknown;
}): string {
  if (args.currentCall.kind !== 'repair') {
    throw new Error('frozen repair projection requires a repair call');
  }
  const markerIndex = args.currentCall.userPrompt.indexOf(REPAIR_WIRE_MARKER);
  if (
    markerIndex < 0 ||
    args.currentCall.userPrompt.indexOf(
      REPAIR_WIRE_MARKER,
      markerIndex + REPAIR_WIRE_MARKER.length,
    ) >= 0
  ) {
    throw new Error('current repair call does not expose one canonical wire marker');
  }
  const diagnosticPrefix = args.currentCall.userPrompt.slice(
    0,
    markerIndex + REPAIR_WIRE_MARKER.length,
  );
  const historicalWire = serializeLegacyPreRenderBlueprintRepairWireV2({
    context: args.context,
    // Prompt-v6/repair-wire-v1 was authored before the retained-draft cutover:
    // its wire carried the raw parsed provider draft, not the normalized Candidate.
    previousDraft: args.previousRawDraft,
  })
    .split(LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2)
    .join(LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1);
  if (
    historicalWire.includes(LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2) ||
    !historicalWire.includes(LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1)
  ) {
    throw new Error('frozen repair-wire/v1 projection is invalid');
  }
  return `${diagnosticPrefix}${historicalWire}`;
}

function frozenProviderCallV6(args: {
  call: ProviderCall;
  context: PreRenderBlueprintValidationContext;
  previousRawDraft: unknown | null;
}): Pick<
  ProviderCall,
  'systemPrompt' | 'userPrompt'
> {
  if (args.call.kind === 'initial') {
    return {
      systemPrompt: frozenBlueprintAuthoringSystemPromptV6(),
      userPrompt: args.call.userPrompt,
    };
  }
  if (args.previousRawDraft === null) {
    throw new Error('frozen repair call lacks its preceding raw provider draft');
  }
  return {
    systemPrompt: frozenBlueprintRepairSystemPromptV6(),
    userPrompt: frozenBlueprintRepairUserPromptV6({
      currentCall: args.call,
      context: args.context,
      previousRawDraft: args.previousRawDraft,
    }),
  };
}

/**
 * Rebuilds every prompt-dependent receipt field from the exact frozen v6/v1
 * request body. It is intentionally test-only: unlike a coordinated digest
 * relabel, the resulting evidence is a shape the historical writer could have
 * emitted for these deterministic provider calls.
 */
export function rebindReceiptPromptEvidenceToFrozenV6(args: {
  receipt: Record<string, unknown> & {
    admissionDecisions: MutableAdmissionDecision[];
    attempts: MutableAttempt[];
  };
  calls: readonly ProviderCall[];
  context: PreRenderBlueprintValidationContext;
  rawDrafts: readonly unknown[];
}): void {
  if (
    args.receipt.attempts.length !== args.calls.length ||
    args.receipt.admissionDecisions.length !== args.calls.length ||
    args.rawDrafts.length !== args.calls.length
  ) {
    throw new Error('frozen receipt evidence topology is incomplete');
  }
  for (const [index, attempt] of args.receipt.attempts.entries()) {
    const call = args.calls[index]!;
    const decision = args.receipt.admissionDecisions[index]!;
    const frozen = frozenProviderCallV6({
      call,
      context: args.context,
      previousRawDraft: index === 0 ? null : args.rawDrafts[index - 1]!,
    });
    const accounting = blueprintAuthoringInputAccounting({
      systemPrompt: frozen.systemPrompt,
      userPrompt: frozen.userPrompt,
      schema: LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V6,
    });
    const tokenRelevantRequestDigest = canonicalJsonDigest(
      blueprintAuthoringTokenRelevantRequestProjection({
        model: call.options.model,
        systemPrompt: frozen.systemPrompt,
        userPrompt: frozen.userPrompt,
        reasoningEffort: call.options.reasoningEffort,
        schemaName: call.options.jsonSchema.name,
        schema: LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V6,
      }),
    );
    decision.tokenRelevantRequestDigest = tokenRelevantRequestDigest;
    decision.inputAccounting = accounting;
    decision.inputAccountingDigest = canonicalJsonDigest(accounting);
    decision.conservativeUpperBoundTokens = accounting.estimatedBytes;
    if (decision.countResult) {
      decision.countResult.countRequestDigest = tokenRelevantRequestDigest;
    }
    if (decision.probe.reservationBeforeDispatchMicroUsd !== null) {
      decision.probe.reservationBeforeDispatchMicroUsd =
        blueprintAuthoringProbeReservationMicroUsd({
          accountedMicroUsd:
            decision.generationAccountedMicroUsdBeforeRoute +
            decision.probe.cumulativeDebitMicroUsd -
            decision.probe.debitMicroUsd,
          provenUpperBoundTokens: accounting.estimatedBytes,
          remainingGenerationCalls: BLUEPRINT_AUTHORING_MAX_CALLS - index,
          laterProbeRoutes: BLUEPRINT_AUTHORING_MAX_REPAIRS - index,
        });
    }
    if (decision.admitted) {
      decision.continuationReservationMicroUsd =
        blueprintAuthoringContinuationReservationMicroUsd({
          accountedMicroUsd: decision.totalAccountedMicroUsdBeforeGeneration,
          remainingGenerationCalls: BLUEPRINT_AUTHORING_MAX_CALLS - index,
          laterProbeRoutes: BLUEPRINT_AUTHORING_MAX_REPAIRS - index,
        });
    }
    attempt.systemPromptDigest = canonicalJsonDigest(frozen.systemPrompt);
    attempt.userPromptDigest = canonicalJsonDigest(frozen.userPrompt);
    attempt.inputAccounting = accounting;
    attempt.tokenRelevantRequestDigest = tokenRelevantRequestDigest;
    attempt.inputAdmissionDigest = canonicalJsonDigest(decision);
  }
}
