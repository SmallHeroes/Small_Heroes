import {
  buildDraftAuthorityReferenceDiagnostics,
  draftAuthorityReferenceDiagnosticsIsValid,
  type DraftAuthorityReferenceDiagnostics,
  type DraftAuthorityReferenceIssue,
} from '@/lib/visual-contract-compiler/draftAuthorityReferenceDiagnostics';
import {
  LEGACY_TEMPLATE_REPAIR_MODE_VALUES,
  TEMPLATE_REPAIR_MODE_VALUES,
  TEMPLATE_REPAIR_OUTPUT_FAILURE_CODE_VALUES,
  TEMPLATE_REPAIR_OUTPUT_IDENTITY_V2_ADDITION_VALUES,
  TEMPLATE_REPAIR_OUTPUT_IDENTITY_V3_ADDITION_VALUES,
  TEMPLATE_REPAIR_OUTPUT_IDENTITY_V4_ADDITION_VALUES,
  TEMPLATE_REPAIR_OUTPUT_IDENTITY_V5_ADDITION_VALUES,
  templateRepairOutputIdentityIsValid,
  templateRepairOutputTargetContextIsValid,
  type LegacyTemplateRepairMode,
  type TemplateRepairMode,
  type TemplateRepairOutputFailureCode,
  type TemplateRepairOutputIdentity,
  type TemplateRepairOutputTargetContext,
} from '@/lib/visual-contract-compiler/templateRepairOutputDiagnostics';
import {
  VISUAL_CONTRACT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE,
  VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_ADMISSIBLE_INPUT_BYTES,
  VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS,
  type VisualContractAuthoringInputAccounting,
} from '@/lib/visual-contract-compiler/authoringPolicy';

import {
  MAX_PERSISTED_AUTHORING_DIAGNOSTIC_COUNT,
  authoringTerminalFailureIsValid,
  buildAuthoringTerminalFailure,
  type AuthoringDiagnosticCode,
  type AuthoringTerminalFailure,
  type AuthoringTerminalFailureCode,
} from './authoringTerminalDiagnostics';

export interface VisualContractAuthoringTerminalFailure
  extends AuthoringTerminalFailure {
  authorityReferenceDiagnostics:
    | DraftAuthorityReferenceDiagnostics
    | null;
  repairOutputDiagnostics:
    | VisualContractRepairOutputDiagnostics
    | LegacyVisualContractRepairOutputDiagnostics
    | LegacyVisualContractRepairOutputDiagnosticsV3
    | LegacyVisualContractRepairOutputDiagnosticsV2
    | LegacyVisualContractRepairOutputDiagnosticsV1
    | null;
  repairRouteAdmissionDiagnostics:
    | VisualContractRepairRouteAdmissionDiagnostics
    | LegacyVisualContractRepairRouteAdmissionDiagnostics
    | LegacyVisualContractRepairRouteAdmissionDiagnosticsV1
    | null;
}

export interface LegacyVisualContractAuthoringTerminalFailure
  extends AuthoringTerminalFailure {
  authorityReferenceDiagnostics:
    | DraftAuthorityReferenceDiagnostics
    | null;
  repairOutputDiagnostics:
    | VisualContractRepairOutputDiagnostics
    | LegacyVisualContractRepairOutputDiagnostics
    | LegacyVisualContractRepairOutputDiagnosticsV3
    | LegacyVisualContractRepairOutputDiagnosticsV2
    | LegacyVisualContractRepairOutputDiagnosticsV1
    | null;
}

export const VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION =
  'visual-contract-repair-route-admission-diagnostics/v3' as const;
export const LEGACY_VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION =
  'visual-contract-repair-route-admission-diagnostics/v2' as const;
export const LEGACY_VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION_V1 =
  'visual-contract-repair-route-admission-diagnostics/v1' as const;

const LEGACY_VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_ADMISSIBLE_INPUT_BYTES =
  59_904;
const LEGACY_VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS = 7;
const LEGACY_VISUAL_CONTRACT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE = 4_096;

export interface VisualContractRepairRouteAdmissionDiagnostics {
  version: typeof VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION;
  repairAttempt: number;
  repairMode: TemplateRepairMode;
  inputAccounting: VisualContractAuthoringInputAccounting;
  maxAdmissibleInputBytes: number;
  carriedDraftDiagnosticCount: number;
  routeAdmissionDiagnosticCount: 1;
}

export interface VisualContractRepairRouteAdmissionDiagnosticsInput {
  repairAttempt: number;
  repairMode: TemplateRepairMode;
  inputAccounting: VisualContractAuthoringInputAccounting;
  maxAdmissibleInputBytes: number;
  carriedDraftDiagnosticCount: number;
}

export interface LegacyVisualContractRepairRouteAdmissionDiagnostics
  extends Omit<VisualContractRepairRouteAdmissionDiagnostics, 'version'> {
  version: typeof LEGACY_VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION;
}

export interface LegacyVisualContractRepairRouteAdmissionDiagnosticsV1
  extends Omit<
    VisualContractRepairRouteAdmissionDiagnostics,
    'version' | 'repairMode'
  > {
  version: typeof LEGACY_VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION_V1;
  repairMode: LegacyTemplateRepairMode;
}

export const VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION =
  'visual-contract-repair-output-diagnostics/v5' as const;
export const LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION =
  'visual-contract-repair-output-diagnostics/v4' as const;
export const LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION_V3 =
  'visual-contract-repair-output-diagnostics/v3' as const;
export const LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION_V2 =
  'visual-contract-repair-output-diagnostics/v2' as const;
export const LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION_V1 =
  'visual-contract-repair-output-diagnostics/v1' as const;

export interface VisualContractRepairOutputDiagnostics {
  version: typeof VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION;
  repairAttempt: number;
  repairMode: TemplateRepairMode;
  failureCode: TemplateRepairOutputFailureCode;
  identity: TemplateRepairOutputIdentity;
  targetContext: TemplateRepairOutputTargetContext | null;
  carriedDraftDiagnosticCount: number;
  repairOutputDiagnosticCount: 1;
}

export interface LegacyVisualContractRepairOutputDiagnostics {
  version: typeof LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION;
  repairAttempt: number;
  repairMode: LegacyTemplateRepairMode;
  failureCode: TemplateRepairOutputFailureCode;
  identity: TemplateRepairOutputIdentity;
  carriedDraftDiagnosticCount: number;
  repairOutputDiagnosticCount: 1;
}

export interface LegacyVisualContractRepairOutputDiagnosticsV3
  extends Omit<LegacyVisualContractRepairOutputDiagnostics, 'version'> {
  version: typeof LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION_V3;
}

export interface LegacyVisualContractRepairOutputDiagnosticsV1
  extends Omit<LegacyVisualContractRepairOutputDiagnostics, 'version'> {
  version: typeof LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION_V1;
}

export interface LegacyVisualContractRepairOutputDiagnosticsV2
  extends Omit<LegacyVisualContractRepairOutputDiagnostics, 'version'> {
  version: typeof LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION_V2;
}

export interface VisualContractRepairOutputDiagnosticsInput {
  repairAttempt: number;
  repairMode: TemplateRepairMode;
  failureCode: TemplateRepairOutputFailureCode;
  identity: TemplateRepairOutputIdentity;
  targetContext?: TemplateRepairOutputTargetContext | null;
  carriedDraftDiagnosticCount: number;
}

const CURRENT_REPAIR_MODES = new Set<TemplateRepairMode>(
  TEMPLATE_REPAIR_MODE_VALUES,
);
const LEGACY_REPAIR_MODES = new Set<LegacyTemplateRepairMode>(
  LEGACY_TEMPLATE_REPAIR_MODE_VALUES,
);
const REPAIR_FAILURE_CODES =
  new Set<TemplateRepairOutputFailureCode>(
    TEMPLATE_REPAIR_OUTPUT_FAILURE_CODE_VALUES,
  );
const V2_IDENTITY_ADDITIONS = new Set<string>(
  TEMPLATE_REPAIR_OUTPUT_IDENTITY_V2_ADDITION_VALUES,
);
const V3_IDENTITY_ADDITIONS = new Set<string>(
  TEMPLATE_REPAIR_OUTPUT_IDENTITY_V3_ADDITION_VALUES,
);
const V4_IDENTITY_ADDITIONS = new Set<string>(
  TEMPLATE_REPAIR_OUTPUT_IDENTITY_V4_ADDITION_VALUES,
);
const V5_IDENTITY_ADDITIONS = new Set<string>(
  TEMPLATE_REPAIR_OUTPUT_IDENTITY_V5_ADDITION_VALUES,
);

const CURRENT_REPAIR_OUTPUT_DIAGNOSTIC_KEYS = [
  'carriedDraftDiagnosticCount',
  'failureCode',
  'identity',
  'repairAttempt',
  'repairMode',
  'repairOutputDiagnosticCount',
  'targetContext',
  'version',
].sort();

const LEGACY_REPAIR_OUTPUT_DIAGNOSTIC_KEYS =
  CURRENT_REPAIR_OUTPUT_DIAGNOSTIC_KEYS.filter(
    (key) => key !== 'targetContext',
  );

const REPAIR_ROUTE_ADMISSION_INPUT_ACCOUNTING_KEYS = [
  'estimatedBytes',
  'protocolAllowance',
  'schemaBytes',
  'separatorBytes',
  'systemBytes',
  'userBytes',
].sort();

const REPAIR_ROUTE_ADMISSION_DIAGNOSTIC_KEYS = [
  'carriedDraftDiagnosticCount',
  'inputAccounting',
  'maxAdmissibleInputBytes',
  'repairAttempt',
  'repairMode',
  'routeAdmissionDiagnosticCount',
  'version',
].sort();

function exactObjectKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify(expected)
  );
}

export function visualContractRepairRouteAdmissionDiagnosticsIsValid(
  value: unknown,
): value is VisualContractRepairRouteAdmissionDiagnostics {
  return visualContractRepairRouteAdmissionDiagnosticsShapeIsValid(
    value,
    VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION,
  );
}

export function legacyVisualContractRepairRouteAdmissionDiagnosticsIsValid(
  value: unknown,
): value is
  | LegacyVisualContractRepairRouteAdmissionDiagnostics
  | LegacyVisualContractRepairRouteAdmissionDiagnosticsV1 {
  return (
    visualContractRepairRouteAdmissionDiagnosticsShapeIsValid(
      value,
      LEGACY_VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION,
    ) ||
    visualContractRepairRouteAdmissionDiagnosticsShapeIsValid(
      value,
      LEGACY_VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION_V1,
    )
  );
}

function visualContractRepairRouteAdmissionDiagnosticsShapeIsValid(
  value: unknown,
  version: string,
): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const diagnostics = value as Record<string, unknown>;
  const accounting = diagnostics.inputAccounting;
  if (
    !exactObjectKeys(
      diagnostics,
      REPAIR_ROUTE_ADMISSION_DIAGNOSTIC_KEYS,
    ) ||
    accounting === null ||
    typeof accounting !== 'object' ||
    Array.isArray(accounting)
  ) {
    return false;
  }
  const inputAccounting = accounting as Record<string, unknown>;
  const legacyV1 =
    version ===
    LEGACY_VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION_V1;
  const legacyVersion =
    legacyV1 ||
    version ===
      LEGACY_VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION;
  const maxCalls = legacyVersion
    ? LEGACY_VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS
    : VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS;
  const routeIdentityIsValid = legacyV1
    ? diagnostics.repairMode === 'book_surface_patch' &&
      diagnostics.repairAttempt === maxCalls
    : (diagnostics.repairMode === 'book_surface_patch' &&
        diagnostics.repairAttempt === maxCalls) ||
      (diagnostics.repairMode === 'represented_elsewhere_patch' &&
        Number.isSafeInteger(diagnostics.repairAttempt) &&
        (diagnostics.repairAttempt as number) >= 2 &&
        (diagnostics.repairAttempt as number) <= maxCalls);
  const numericAccounting = [
    inputAccounting.systemBytes,
    inputAccounting.userBytes,
    inputAccounting.schemaBytes,
    inputAccounting.separatorBytes,
    inputAccounting.protocolAllowance,
    inputAccounting.estimatedBytes,
  ];
  return (
    exactObjectKeys(
      inputAccounting,
      REPAIR_ROUTE_ADMISSION_INPUT_ACCOUNTING_KEYS,
    ) &&
    diagnostics.version === version &&
    routeIdentityIsValid &&
    diagnostics.maxAdmissibleInputBytes ===
      (legacyVersion
        ? LEGACY_VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_ADMISSIBLE_INPUT_BYTES
        : VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_ADMISSIBLE_INPUT_BYTES) &&
    Number.isSafeInteger(diagnostics.carriedDraftDiagnosticCount) &&
    (diagnostics.carriedDraftDiagnosticCount as number) >= 1 &&
    diagnostics.routeAdmissionDiagnosticCount === 1 &&
    numericAccounting.every(
      (entry) => Number.isSafeInteger(entry) && Number(entry) >= 0,
    ) &&
    inputAccounting.separatorBytes === 2 &&
    inputAccounting.protocolAllowance ===
      (legacyVersion
        ? LEGACY_VISUAL_CONTRACT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE
        : VISUAL_CONTRACT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE) &&
    inputAccounting.estimatedBytes ===
      (inputAccounting.systemBytes as number) +
        (inputAccounting.userBytes as number) +
        (inputAccounting.schemaBytes as number) +
        (inputAccounting.separatorBytes as number) +
        (inputAccounting.protocolAllowance as number) &&
    (inputAccounting.estimatedBytes as number) >
      (diagnostics.maxAdmissibleInputBytes as number)
  );
}

export function visualContractRepairRouteAdmissionDiagnosticsIsReadable(
  value: unknown,
): value is
  | VisualContractRepairRouteAdmissionDiagnostics
  | LegacyVisualContractRepairRouteAdmissionDiagnostics
  | LegacyVisualContractRepairRouteAdmissionDiagnosticsV1 {
  return (
    visualContractRepairRouteAdmissionDiagnosticsIsValid(value) ||
    legacyVisualContractRepairRouteAdmissionDiagnosticsIsValid(value)
  );
}

export function visualContractRepairRouteAdmissionDiagnosticsVersionStatus(
  value: unknown,
): 'current' | 'legacy_immutable' | 'unsupported' {
  if (visualContractRepairRouteAdmissionDiagnosticsIsValid(value)) {
    return 'current';
  }
  if (legacyVisualContractRepairRouteAdmissionDiagnosticsIsValid(value)) {
    return 'legacy_immutable';
  }
  return 'unsupported';
}

function buildVisualContractRepairRouteAdmissionDiagnostics(
  input: VisualContractRepairRouteAdmissionDiagnosticsInput,
): VisualContractRepairRouteAdmissionDiagnostics {
  const diagnostics: VisualContractRepairRouteAdmissionDiagnostics = {
    version:
      VISUAL_CONTRACT_REPAIR_ROUTE_ADMISSION_DIAGNOSTICS_VERSION,
    repairAttempt: input.repairAttempt,
    repairMode: input.repairMode,
    inputAccounting: { ...input.inputAccounting },
    maxAdmissibleInputBytes: input.maxAdmissibleInputBytes,
    carriedDraftDiagnosticCount: input.carriedDraftDiagnosticCount,
    routeAdmissionDiagnosticCount: 1,
  };
  if (!visualContractRepairRouteAdmissionDiagnosticsIsValid(diagnostics)) {
    throw new Error(
      'Visual Contract repair-route admission diagnostics input is invalid',
    );
  }
  return diagnostics;
}

export function visualContractRepairOutputDiagnosticCodeFor(
  failureCode: TemplateRepairOutputFailureCode,
): AuthoringDiagnosticCode {
  switch (failureCode) {
    case 'json_invalid':
      return 'repair_output_json_invalid';
    case 'shape_invalid':
      return 'repair_output_shape_invalid';
    case 'target_identity_invalid':
      return 'repair_output_target_identity_invalid';
    case 'reference_authority_invalid':
      return 'repair_output_reference_authority_invalid';
    case 'recurring_prop_invalid':
      return 'repair_output_recurring_prop_invalid';
    case 'non_target_drift':
      return 'repair_output_non_target_drift';
    case 'application_rejected':
      return 'repair_output_application_rejected';
  }
}

function buildVisualContractRepairOutputDiagnostics(
  input: VisualContractRepairOutputDiagnosticsInput,
): VisualContractRepairOutputDiagnostics {
  const diagnostics: VisualContractRepairOutputDiagnostics = {
    version: VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION,
    repairAttempt: input.repairAttempt,
    repairMode: input.repairMode,
    failureCode: input.failureCode,
    identity: input.identity,
    targetContext: input.targetContext ?? null,
    carriedDraftDiagnosticCount:
      input.carriedDraftDiagnosticCount,
    repairOutputDiagnosticCount: 1,
  };
  if (!visualContractRepairOutputDiagnosticsIsValid(diagnostics)) {
    throw new Error(
      'Visual Contract repair-output diagnostics input is invalid',
    );
  }
  return diagnostics;
}

function visualContractRepairOutputDiagnosticCoreIsValid(
  diagnostics: Record<string, unknown>,
): boolean {
  return (
    Number.isSafeInteger(diagnostics.repairAttempt) &&
    (diagnostics.repairAttempt as number) >= 1 &&
    typeof diagnostics.failureCode === 'string' &&
    REPAIR_FAILURE_CODES.has(
      diagnostics.failureCode as TemplateRepairOutputFailureCode,
    ) &&
    Number.isSafeInteger(diagnostics.carriedDraftDiagnosticCount) &&
    (diagnostics.carriedDraftDiagnosticCount as number) >= 0 &&
    diagnostics.repairOutputDiagnosticCount === 1
  );
}

function legacyVisualContractRepairOutputDiagnosticsShapeIsValid(
  value: unknown,
  args: {
    version: string;
    identityIsValid: (identity: unknown) => boolean;
  },
): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const diagnostics = value as Record<string, unknown>;
  return (
    exactObjectKeys(diagnostics, LEGACY_REPAIR_OUTPUT_DIAGNOSTIC_KEYS) &&
    diagnostics.version === args.version &&
    typeof diagnostics.repairMode === 'string' &&
    LEGACY_REPAIR_MODES.has(
      diagnostics.repairMode as LegacyTemplateRepairMode,
    ) &&
    args.identityIsValid(diagnostics.identity) &&
    visualContractRepairOutputDiagnosticCoreIsValid(diagnostics)
  );
}

export function visualContractRepairOutputDiagnosticsIsValid(
  value: unknown,
): value is VisualContractRepairOutputDiagnostics {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const diagnostics = value as Record<string, unknown>;
  if (
    !exactObjectKeys(diagnostics, CURRENT_REPAIR_OUTPUT_DIAGNOSTIC_KEYS) ||
    diagnostics.version !==
      VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION ||
    typeof diagnostics.repairMode !== 'string' ||
    !CURRENT_REPAIR_MODES.has(
      diagnostics.repairMode as TemplateRepairMode,
    ) ||
    !templateRepairOutputIdentityIsValid(diagnostics.identity) ||
    !visualContractRepairOutputDiagnosticCoreIsValid(diagnostics)
  ) {
    return false;
  }
  const isRepresentedElsewhereMode =
    diagnostics.repairMode === 'represented_elsewhere_patch';
  const isRepresentedElsewhereIdentity =
    typeof diagnostics.identity === 'string' &&
    V5_IDENTITY_ADDITIONS.has(diagnostics.identity);
  if (
    isRepresentedElsewhereMode
      ? !isRepresentedElsewhereIdentity && diagnostics.identity !== 'unclassified'
      : isRepresentedElsewhereIdentity
  ) {
    return false;
  }
  if (
    diagnostics.identity !==
    'represented_elsewhere_repair_target_association_invalid'
  ) {
    return diagnostics.targetContext === null;
  }
  if (!templateRepairOutputTargetContextIsValid(diagnostics.targetContext)) {
    return false;
  }
  return diagnostics.targetContext.closedSubreason === 'choice_out_of_range'
    ? diagnostics.failureCode === 'reference_authority_invalid'
    : diagnostics.failureCode === 'target_identity_invalid';
}

export function legacyVisualContractRepairOutputDiagnosticsIsValid(
  value: unknown,
): value is LegacyVisualContractRepairOutputDiagnostics {
  return legacyVisualContractRepairOutputDiagnosticsShapeIsValid(value, {
    version: LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION,
    identityIsValid: (identity) =>
      templateRepairOutputIdentityIsValid(identity) &&
      !V5_IDENTITY_ADDITIONS.has(identity),
  });
}

export function legacyVisualContractRepairOutputDiagnosticsV3IsValid(
  value: unknown,
): value is LegacyVisualContractRepairOutputDiagnosticsV3 {
  return legacyVisualContractRepairOutputDiagnosticsShapeIsValid(value, {
    version: LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION_V3,
    identityIsValid: (identity) =>
      templateRepairOutputIdentityIsValid(identity) &&
      !V4_IDENTITY_ADDITIONS.has(identity) &&
      !V5_IDENTITY_ADDITIONS.has(identity),
  });
}

export function legacyVisualContractRepairOutputDiagnosticsV2IsValid(
  value: unknown,
): value is LegacyVisualContractRepairOutputDiagnosticsV2 {
  return legacyVisualContractRepairOutputDiagnosticsShapeIsValid(value, {
    version: LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION_V2,
    identityIsValid: (identity) =>
      templateRepairOutputIdentityIsValid(identity) &&
      !V3_IDENTITY_ADDITIONS.has(identity) &&
      !V4_IDENTITY_ADDITIONS.has(identity) &&
      !V5_IDENTITY_ADDITIONS.has(identity),
  });
}

export function legacyVisualContractRepairOutputDiagnosticsV1IsValid(
  value: unknown,
): value is LegacyVisualContractRepairOutputDiagnosticsV1 {
  return legacyVisualContractRepairOutputDiagnosticsShapeIsValid(value, {
    version: LEGACY_VISUAL_CONTRACT_REPAIR_OUTPUT_DIAGNOSTICS_VERSION_V1,
    identityIsValid: (identity) =>
      templateRepairOutputIdentityIsValid(identity) &&
      !V2_IDENTITY_ADDITIONS.has(identity) &&
      !V3_IDENTITY_ADDITIONS.has(identity) &&
      !V4_IDENTITY_ADDITIONS.has(identity) &&
      !V5_IDENTITY_ADDITIONS.has(identity),
  });
}

export function visualContractRepairOutputDiagnosticsIsReadable(
  value: unknown,
): value is
  | VisualContractRepairOutputDiagnostics
  | LegacyVisualContractRepairOutputDiagnostics
  | LegacyVisualContractRepairOutputDiagnosticsV3
  | LegacyVisualContractRepairOutputDiagnosticsV2
  | LegacyVisualContractRepairOutputDiagnosticsV1 {
  return (
    visualContractRepairOutputDiagnosticsIsValid(value) ||
    legacyVisualContractRepairOutputDiagnosticsIsValid(value) ||
    legacyVisualContractRepairOutputDiagnosticsV3IsValid(value) ||
    legacyVisualContractRepairOutputDiagnosticsV2IsValid(value) ||
    legacyVisualContractRepairOutputDiagnosticsV1IsValid(value)
  );
}

export function visualContractRepairOutputDiagnosticsVersionStatus(
  value: unknown,
): 'current' | 'legacy_immutable' | 'unsupported' {
  if (visualContractRepairOutputDiagnosticsIsValid(value)) return 'current';
  if (
    legacyVisualContractRepairOutputDiagnosticsIsValid(value) ||
    legacyVisualContractRepairOutputDiagnosticsV3IsValid(value) ||
    legacyVisualContractRepairOutputDiagnosticsV2IsValid(value) ||
    legacyVisualContractRepairOutputDiagnosticsV1IsValid(value)
  ) {
    return 'legacy_immutable';
  }
  return 'unsupported';
}

const VISUAL_CONTRACT_TERMINAL_FAILURE_KEYS = [
  'authorityReferenceDiagnostics',
  'code',
  'diagnosticCodes',
  'diagnosticCount',
  'errorClass',
  'issues',
  'message',
  'phase',
  'repairEligibility',
  'repairOutputDiagnostics',
  'repairRouteAdmissionDiagnostics',
  'repairReasonCode',
].sort();

const LEGACY_VISUAL_CONTRACT_TERMINAL_FAILURE_KEYS =
  VISUAL_CONTRACT_TERMINAL_FAILURE_KEYS.filter(
    (key) => key !== 'repairRouteAdmissionDiagnostics',
  );

export function buildVisualContractAuthoringTerminalFailure(args: {
  code: AuthoringTerminalFailureCode;
  diagnosticInputs?: readonly unknown[];
  diagnosticCountOverride?: number;
  diagnosticCodeOverride?: AuthoringDiagnosticCode;
  issueCodes?: readonly unknown[];
  authorityReferenceIssues?: readonly DraftAuthorityReferenceIssue[];
  repairOutputDiagnostics?: VisualContractRepairOutputDiagnosticsInput;
  repairRouteAdmissionDiagnostics?:
    VisualContractRepairRouteAdmissionDiagnosticsInput;
}): VisualContractAuthoringTerminalFailure {
  if (
    args.code !== 'draft_authority_reference_domain_invalid' &&
    args.authorityReferenceIssues !== undefined
  ) {
    throw new Error(
      'Visual Contract authority/reference diagnostics require the matching terminal code',
    );
  }
  if (
    args.code !== 'repair_route_input_not_admissible' &&
    args.repairRouteAdmissionDiagnostics !== undefined
  ) {
    throw new Error(
      'Visual Contract repair-route admission diagnostics require the matching terminal code',
    );
  }
  if (
    args.code === 'repair_route_input_not_admissible' &&
    args.repairRouteAdmissionDiagnostics === undefined
  ) {
    throw new Error(
      'Visual Contract repair-route admission terminal requires typed diagnostics',
    );
  }
  if (
    args.code !== 'repair_output_invalid' &&
    args.repairOutputDiagnostics !== undefined
  ) {
    throw new Error(
      'Visual Contract repair-output diagnostics require the matching terminal code',
    );
  }
  if (
    args.code === 'repair_output_invalid' &&
    args.repairOutputDiagnostics === undefined
  ) {
    throw new Error(
      'Visual Contract repair-output terminal requires typed diagnostics',
    );
  }
  const authorityReferenceDiagnostics =
    args.code === 'draft_authority_reference_domain_invalid'
      ? buildDraftAuthorityReferenceDiagnostics(
          args.authorityReferenceIssues ?? [],
        )
      : null;
  if (
    args.code === 'draft_authority_reference_domain_invalid' &&
    authorityReferenceDiagnostics?.totalCount === 0
  ) {
    throw new Error(
      'Visual Contract authority/reference terminal requires typed diagnostics',
    );
  }
  const repairOutputDiagnostics =
    args.repairOutputDiagnostics === undefined
      ? null
      : buildVisualContractRepairOutputDiagnostics(
          args.repairOutputDiagnostics,
        );
  const repairRouteAdmissionDiagnostics =
    args.repairRouteAdmissionDiagnostics === undefined
      ? null
      : buildVisualContractRepairRouteAdmissionDiagnostics(
          args.repairRouteAdmissionDiagnostics,
        );
  const shared = buildAuthoringTerminalFailure({
    code: args.code,
    diagnosticInputs:
      args.code === 'draft_authority_reference_domain_invalid'
        ? ['authority_reference_validation_failed']
        : args.diagnosticInputs,
    diagnosticCountOverride:
      repairRouteAdmissionDiagnostics !== null
        ? repairRouteAdmissionDiagnostics.carriedDraftDiagnosticCount +
          repairRouteAdmissionDiagnostics.routeAdmissionDiagnosticCount
        : repairOutputDiagnostics === null
          ? authorityReferenceDiagnostics?.totalCount ??
            args.diagnosticCountOverride
          : repairOutputDiagnostics.carriedDraftDiagnosticCount +
            repairOutputDiagnostics.repairOutputDiagnosticCount,
    diagnosticCodeOverride:
      repairOutputDiagnostics === null
        ? args.diagnosticCodeOverride
        : visualContractRepairOutputDiagnosticCodeFor(
            repairOutputDiagnostics.failureCode,
          ),
    issueCodes: args.issueCodes,
  });
  return {
    ...shared,
    authorityReferenceDiagnostics,
    repairOutputDiagnostics,
    repairRouteAdmissionDiagnostics,
  };
}

export function visualContractAuthoringTerminalFailureIsValid(
  value: unknown,
): value is VisualContractAuthoringTerminalFailure {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const extended = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(extended).sort()) !==
    JSON.stringify(VISUAL_CONTRACT_TERMINAL_FAILURE_KEYS)
  ) {
    return false;
  }
  const {
    authorityReferenceDiagnostics,
    repairOutputDiagnostics,
    repairRouteAdmissionDiagnostics,
    ...shared
  } = extended;
  if (!authoringTerminalFailureIsValid(shared)) return false;
  const authorityDiagnosticsAreValid =
    shared.code === 'draft_authority_reference_domain_invalid'
      ? draftAuthorityReferenceDiagnosticsIsValid(
          authorityReferenceDiagnostics,
        ) &&
        authorityReferenceDiagnostics.totalCount > 0 &&
        shared.diagnosticCount ===
          Math.min(
            authorityReferenceDiagnostics.totalCount,
            MAX_PERSISTED_AUTHORING_DIAGNOSTIC_COUNT,
          ) &&
        shared.diagnosticCodes.includes(
          'authority_reference_validation_failed',
        )
      : authorityReferenceDiagnostics === null;
  if (!authorityDiagnosticsAreValid) return false;
  if (shared.code === 'repair_route_input_not_admissible') {
    return (
      repairOutputDiagnostics === null &&
      visualContractRepairRouteAdmissionDiagnosticsIsReadable(
        repairRouteAdmissionDiagnostics,
      ) &&
      shared.diagnosticCount ===
        Math.min(
          repairRouteAdmissionDiagnostics.carriedDraftDiagnosticCount +
            repairRouteAdmissionDiagnostics.routeAdmissionDiagnosticCount,
          MAX_PERSISTED_AUTHORING_DIAGNOSTIC_COUNT,
        ) &&
      shared.diagnosticCodes.includes(
        'repair_route_input_not_admissible',
      )
    );
  }
  if (repairRouteAdmissionDiagnostics !== null) return false;
  if (shared.code !== 'repair_output_invalid') {
    return repairOutputDiagnostics === null;
  }
  return (
    visualContractRepairOutputDiagnosticsIsReadable(
      repairOutputDiagnostics,
    ) &&
    shared.diagnosticCount ===
      Math.min(
        repairOutputDiagnostics.carriedDraftDiagnosticCount +
          repairOutputDiagnostics.repairOutputDiagnosticCount,
        MAX_PERSISTED_AUTHORING_DIAGNOSTIC_COUNT,
      ) &&
    shared.diagnosticCodes.includes(
      visualContractRepairOutputDiagnosticCodeFor(
        repairOutputDiagnostics.failureCode,
      ),
    )
  );
}

export function legacyVisualContractAuthoringTerminalFailureIsValid(
  value: unknown,
): value is LegacyVisualContractAuthoringTerminalFailure {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const extended = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(extended).sort()) !==
    JSON.stringify(LEGACY_VISUAL_CONTRACT_TERMINAL_FAILURE_KEYS)
  ) {
    return false;
  }
  const {
    authorityReferenceDiagnostics,
    repairOutputDiagnostics,
    ...shared
  } = extended;
  if (
    !authoringTerminalFailureIsValid(shared) ||
    shared.code === 'repair_route_input_not_admissible'
  ) {
    return false;
  }
  const authorityDiagnosticsAreValid =
    shared.code === 'draft_authority_reference_domain_invalid'
      ? draftAuthorityReferenceDiagnosticsIsValid(
          authorityReferenceDiagnostics,
        ) &&
        authorityReferenceDiagnostics.totalCount > 0 &&
        shared.diagnosticCount ===
          Math.min(
            authorityReferenceDiagnostics.totalCount,
            MAX_PERSISTED_AUTHORING_DIAGNOSTIC_COUNT,
          ) &&
        shared.diagnosticCodes.includes(
          'authority_reference_validation_failed',
        )
      : authorityReferenceDiagnostics === null;
  if (!authorityDiagnosticsAreValid) return false;
  if (shared.code !== 'repair_output_invalid') {
    return repairOutputDiagnostics === null;
  }
  return (
    visualContractRepairOutputDiagnosticsIsReadable(
      repairOutputDiagnostics,
    ) &&
    shared.diagnosticCount ===
      Math.min(
        repairOutputDiagnostics.carriedDraftDiagnosticCount +
          repairOutputDiagnostics.repairOutputDiagnosticCount,
        MAX_PERSISTED_AUTHORING_DIAGNOSTIC_COUNT,
      ) &&
    shared.diagnosticCodes.includes(
      visualContractRepairOutputDiagnosticCodeFor(
        repairOutputDiagnostics.failureCode,
      ),
    )
  );
}
