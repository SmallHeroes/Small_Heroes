import {
  buildDraftAuthorityReferenceDiagnostics,
  draftAuthorityReferenceDiagnosticsIsValid,
  type DraftAuthorityReferenceDiagnostics,
  type DraftAuthorityReferenceIssue,
} from '@/lib/visual-contract-compiler/draftAuthorityReferenceDiagnostics';

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
  'repairReasonCode',
].sort();

export function buildVisualContractAuthoringTerminalFailure(args: {
  code: AuthoringTerminalFailureCode;
  diagnosticInputs?: readonly unknown[];
  diagnosticCountOverride?: number;
  diagnosticCodeOverride?: AuthoringDiagnosticCode;
  issueCodes?: readonly unknown[];
  authorityReferenceIssues?: readonly DraftAuthorityReferenceIssue[];
}): VisualContractAuthoringTerminalFailure {
  if (
    args.code !== 'draft_authority_reference_domain_invalid' &&
    args.authorityReferenceIssues !== undefined
  ) {
    throw new Error(
      'Visual Contract authority/reference diagnostics require the matching terminal code',
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
  const shared = buildAuthoringTerminalFailure({
    code: args.code,
    diagnosticInputs:
      args.code === 'draft_authority_reference_domain_invalid'
        ? ['authority_reference_validation_failed']
        : args.diagnosticInputs,
    diagnosticCountOverride:
      authorityReferenceDiagnostics?.totalCount ??
      args.diagnosticCountOverride,
    diagnosticCodeOverride: args.diagnosticCodeOverride,
    issueCodes: args.issueCodes,
  });
  return {
    ...shared,
    authorityReferenceDiagnostics,
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
    ...shared
  } = extended;
  if (!authoringTerminalFailureIsValid(shared)) return false;
  if (shared.code !== 'draft_authority_reference_domain_invalid') {
    return authorityReferenceDiagnostics === null;
  }
  return (
    draftAuthorityReferenceDiagnosticsIsValid(
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
  );
}
