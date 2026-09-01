import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import {
  InvalidSetBoardStableAuthorityError,
  setBoardStableAuthorityErrors,
} from '@/lib/visual-contract-compiler/setBoardStableAuthority';

import {
  SetBoardPositiveAuthorityLeakError,
  SetBoardPositiveAuthoritySpoilerError,
  type SetBoardPositiveAuthorityIssue,
} from './positiveAuthoritySpoilerGuard';
import {
  collectSetDefinitionAdmissionIssues,
  listRequiredSetIdentityIds,
  projectSetDefinition,
} from './setDefinition';
import type { SetBoardPositiveAuthorityPolicyVersion } from './types';

export const SET_BOARD_ADMISSION_CENSUS_VERSION =
  'set-board-admission-census/v1' as const;

export interface SetBoardAdmissionIssue {
  setIdentityId: string;
  code:
    | 'set_board_positive_authority_spoiler_leak'
    | 'set_board_positive_authority_leak'
    | 'set_board_stable_authority_invalid'
    | 'set_board_projection_failed';
  message: string;
  fieldPath?: string;
  provenance?: string;
  category?: 'policy' | 'cast' | 'undeclared_prop' | 'action';
  matchedTerm?: string;
  blockedIdentity?: string;
  excludedPropId?: string;
  excludedPropName?: string;
  details?: string[];
}

export interface SetBoardAdmissionResult {
  setIdentityId: string;
  status: 'admitted' | 'rejected';
  policyVersion: SetBoardPositiveAuthorityPolicyVersion | null;
  issues: SetBoardAdmissionIssue[];
}

export interface RequiredSetBoardAdmissionCensus {
  version: typeof SET_BOARD_ADMISSION_CENSUS_VERSION;
  styleId: string;
  requiredSetIdentityIds: string[];
  contractIssues: SetBoardAdmissionIssue[];
  admittedSetIdentityIds: string[];
  rejectedSetIdentityIds: string[];
  results: SetBoardAdmissionResult[];
  issueCount: number;
  admitted: boolean;
}

function authoritySetIdentityId(value: unknown): string | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }
  const candidate = (value as { setIdentityId?: unknown }).setIdentityId;
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate
    : null;
}

function contractScopedToRequiredSet(
  contract: BookVisualContract,
  setIdentityId: string,
): BookVisualContract {
  const scoped = structuredClone(contract);
  for (const location of scoped.locations) {
    if (
      location.setIdentityId !== setIdentityId &&
      (location.setReference?.status === 'pending' ||
        location.setReference?.status === 'ready')
    ) {
      location.setReference = { status: 'none' };
    }
  }
  const rawAuthorities = (
    scoped as BookVisualContract & { setBoardAuthorities?: unknown }
  ).setBoardAuthorities;
  if (Array.isArray(rawAuthorities)) {
    const targetAuthorities = rawAuthorities.filter(
      (authority) => authoritySetIdentityId(authority) === setIdentityId,
    );
    if (targetAuthorities.length > 0) {
      scoped.setBoardAuthorities = targetAuthorities;
    } else {
      delete scoped.setBoardAuthorities;
    }
  } else if (rawAuthorities !== undefined) {
    delete scoped.setBoardAuthorities;
  }
  return scoped;
}

function contractScopedToResidualAuthorities(
  contract: BookVisualContract,
  requiredSetIdentityIds: readonly string[],
): BookVisualContract {
  const scoped = structuredClone(contract);
  for (const location of scoped.locations) {
    if (
      location.setReference?.status === 'pending' ||
      location.setReference?.status === 'ready'
    ) {
      location.setReference = { status: 'none' };
    }
  }
  const required = new Set(requiredSetIdentityIds);
  const rawAuthorities = (
    scoped as BookVisualContract & { setBoardAuthorities?: unknown }
  ).setBoardAuthorities;
  if (Array.isArray(rawAuthorities)) {
    if (rawAuthorities.length === 0) {
      // Preserve an explicitly present empty collection so the contract-scope
      // validator can report it. Deleting it would silently turn malformed
      // input into the valid "no board authority declared" shape.
      return scoped;
    }
    const residual = rawAuthorities.filter((authority) => {
      const setIdentityId = authoritySetIdentityId(authority);
      return setIdentityId === null || !required.has(setIdentityId);
    });
    if (residual.length > 0) {
      scoped.setBoardAuthorities = residual;
    } else {
      delete scoped.setBoardAuthorities;
    }
  }
  return scoped;
}

function normalizeIssue(
  setIdentityId: string,
  candidate: SetBoardPositiveAuthorityIssue | unknown,
): SetBoardAdmissionIssue {
  if (candidate instanceof SetBoardPositiveAuthoritySpoilerError) {
    return {
      setIdentityId,
      code: candidate.code,
      message: candidate.message,
      fieldPath: candidate.fieldPath,
      provenance: candidate.provenance,
      matchedTerm: candidate.matchedTerm,
      excludedPropId: candidate.excludedPropId,
      excludedPropName: candidate.excludedPropName,
    };
  }
  if (candidate instanceof SetBoardPositiveAuthorityLeakError) {
    return {
      setIdentityId,
      code: candidate.code,
      message: candidate.message,
      fieldPath: candidate.fieldPath,
      provenance: candidate.provenance,
      category: candidate.category,
      matchedTerm: candidate.matchedTerm,
      ...(candidate.blockedIdentity
        ? { blockedIdentity: candidate.blockedIdentity }
        : {}),
    };
  }
  if (candidate instanceof InvalidSetBoardStableAuthorityError) {
    return {
      setIdentityId,
      code: candidate.code,
      message: candidate.message,
      details: candidate.errors.slice(),
    };
  }
  return {
    setIdentityId,
    code: 'set_board_projection_failed',
    message: candidate instanceof Error ? candidate.message : String(candidate),
  };
}

/**
 * Pure, collect-all admission proof. Every required Set is evaluated before a
 * caller is allowed to consult Registry state, so one bad Set or field cannot
 * mask the remainder of the deterministic authority census.
 */
export function collectRequiredSetBoardAdmissionCensus(
  contract: BookVisualContract,
  styleId: string,
  opts?: { boardVersionsBySet?: ReadonlyMap<string, string> },
): RequiredSetBoardAdmissionCensus {
  const requiredSetIdentityIds = listRequiredSetIdentityIds(contract);
  const contractIssues = setBoardStableAuthorityErrors(
    contractScopedToResidualAuthorities(contract, requiredSetIdentityIds),
  ).map((message): SetBoardAdmissionIssue => ({
    setIdentityId: '*',
    code: 'set_board_stable_authority_invalid',
    message: `[set_board_stable_authority_invalid] ${message}`,
    details: [message],
  }));
  const results: SetBoardAdmissionResult[] = [];
  for (const setIdentityId of requiredSetIdentityIds) {
    try {
      const scopedContract = contractScopedToRequiredSet(
        contract,
        setIdentityId,
      );
      const issues = collectSetDefinitionAdmissionIssues(
        scopedContract,
        setIdentityId,
        styleId,
        opts?.boardVersionsBySet?.has(setIdentityId)
          ? { boardVersion: opts.boardVersionsBySet.get(setIdentityId)! }
          : undefined,
      ).map((candidate) => normalizeIssue(setIdentityId, candidate));
      if (issues.length > 0) {
        results.push({
          setIdentityId,
          status: 'rejected',
          policyVersion: null,
          issues,
        });
        continue;
      }
      const definition = projectSetDefinition(
        scopedContract,
        setIdentityId,
        styleId,
        opts?.boardVersionsBySet?.has(setIdentityId)
          ? { boardVersion: opts.boardVersionsBySet.get(setIdentityId)! }
          : undefined,
      );
      results.push({
        setIdentityId,
        status: 'admitted',
        policyVersion: definition.positiveAuthorityPolicy.version,
        issues: [],
      });
    } catch (error) {
      results.push({
        setIdentityId,
        status: 'rejected',
        policyVersion: null,
        issues: [normalizeIssue(setIdentityId, error)],
      });
    }
  }
  const admittedSetIdentityIds = results
    .filter((result) => result.status === 'admitted')
    .map((result) => result.setIdentityId);
  const rejectedSetIdentityIds = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.setIdentityId);
  const issueCount = results.reduce(
    (count, result) => count + result.issues.length,
    contractIssues.length,
  );
  return {
    version: SET_BOARD_ADMISSION_CENSUS_VERSION,
    styleId,
    requiredSetIdentityIds,
    contractIssues,
    admittedSetIdentityIds,
    rejectedSetIdentityIds,
    results,
    issueCount,
    admitted:
      contractIssues.length === 0 && rejectedSetIdentityIds.length === 0,
  };
}

export class RequiredSetBoardAdmissionError extends Error {
  readonly code = 'required_set_board_admission_failed' as const;

  constructor(readonly census: RequiredSetBoardAdmissionCensus) {
    super(
      `[required_set_board_admission_failed] ${census.issueCount} issue(s); ` +
      `${census.contractIssues.length} contract-scope issue(s); ` +
      `${census.rejectedSetIdentityIds.length} rejected required Set(s): ` +
      (census.rejectedSetIdentityIds.join(', ') || '(none)'),
    );
    this.name = 'RequiredSetBoardAdmissionError';
  }
}

export function assertRequiredSetBoardAdmission(
  census: RequiredSetBoardAdmissionCensus,
): void {
  if (!census.admitted) throw new RequiredSetBoardAdmissionError(census);
}
