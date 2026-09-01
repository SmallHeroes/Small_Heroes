import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import type { ExpectedRegistryIdentity } from './registry';
import {
  computeProjectedSetDefinitionHash,
  computeSetBoardContentPolicyDigest,
  listRequiredSetIdentityIds,
  projectSetDefinition,
} from './setDefinition';
import {
  SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  type SetDefinition,
} from './types';

export interface FrozenSetBoardAuthorityIdentity {
  artifactPath: string;
  artifactDigest: string;
  registryVersion: string;
  boardVersion: string;
  storyKey: string;
  setIdentityId: string;
  styleId: string;
  setDefinitionHash: string;
  contentPolicyDigest: string;
  declaredPropIds: string[];
  storageKey: string;
  assetSha256: string;
  approvedBy: string;
  approvedAt: string;
}

export interface DerivedExpectedSetBoardIdentity {
  definition: SetDefinition;
  expected: ExpectedRegistryIdentity;
}

export class FrozenSetBoardAuthorityInvalidError extends Error {
  readonly code = 'frozen_set_board_authority_invalid' as const;

  constructor(readonly reasons: readonly string[]) {
    super(`[frozen_set_board_authority_invalid] ${reasons.join('; ')}`);
    this.name = 'FrozenSetBoardAuthorityInvalidError';
  }
}

/** One canonical identity derivation for mint, Registry lookup, package qualification, bind and replay. */
export function deriveExpectedSetBoardIdentity(args: {
  contract: BookVisualContract;
  setIdentityId: string;
  styleId: string;
  /** Omit for forward authority. Supply only after trusted frozen-package validation. */
  frozenBoardVersion?: string;
}): DerivedExpectedSetBoardIdentity {
  const opts = args.frozenBoardVersion
    ? { boardVersion: args.frozenBoardVersion }
    : undefined;
  const definition = projectSetDefinition(
    args.contract,
    args.setIdentityId,
    args.styleId,
    opts,
  );
  return {
    definition,
    expected: {
      registryVersion: SET_IDENTITY_REGISTRY_VERSION,
      boardVersion: definition.boardVersion,
      storyKey: args.contract.storyKey ?? '',
      setIdentityId: args.setIdentityId,
      styleId: args.styleId,
      setDefinitionHash: computeProjectedSetDefinitionHash(definition),
      contentPolicyDigest: computeSetBoardContentPolicyDigest(definition),
      declaredPropIds: [...definition.contentPolicy.includedPropIds],
    },
  };
}

function exactStringArray(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Validate a complete approved-package Board inventory before it can select a historical projection tier.
 * Registry entries and cached bindings never call this on themselves, so neither can request a v7→v6 downgrade.
 */
export function validateTrustedFrozenSetBoardAuthorities(args: {
  contract: BookVisualContract;
  styleId: string;
  boards: readonly FrozenSetBoardAuthorityIdentity[];
}): Map<string, DerivedExpectedSetBoardIdentity> {
  const requiredIds = listRequiredSetIdentityIds(args.contract);
  const requiredSet = new Set(requiredIds);
  const reasons: string[] = [];
  const boardById = new Map<string, FrozenSetBoardAuthorityIdentity>();
  for (const board of args.boards) {
    if (!board || typeof board.setIdentityId !== 'string' || !board.setIdentityId.trim()) {
      reasons.push('frozen package contains a Board without setIdentityId');
      continue;
    }
    if (boardById.has(board.setIdentityId)) {
      reasons.push(`frozen package repeats Board ${JSON.stringify(board.setIdentityId)}`);
      continue;
    }
    boardById.set(board.setIdentityId, board);
    for (const field of [
      'artifactPath',
      'artifactDigest',
      'storageKey',
      'assetSha256',
      'approvedBy',
      'approvedAt',
    ] as const) {
      if (typeof board[field] !== 'string' || !board[field].trim()) {
        reasons.push(
          `frozen Board ${JSON.stringify(board.setIdentityId)} ${field} is missing`,
        );
      }
    }
  }
  for (const requiredId of requiredIds) {
    if (!boardById.has(requiredId)) {
      reasons.push(`frozen package omits required Board ${JSON.stringify(requiredId)}`);
    }
  }
  for (const boardId of boardById.keys()) {
    if (!requiredSet.has(boardId)) {
      reasons.push(`frozen package carries non-required Board ${JSON.stringify(boardId)}`);
    }
  }
  if (reasons.length > 0) throw new FrozenSetBoardAuthorityInvalidError(reasons);

  const derivedById = new Map<string, DerivedExpectedSetBoardIdentity>();
  for (const requiredId of requiredIds) {
    const frozen = boardById.get(requiredId)!;
    if (
      frozen.boardVersion !== SET_IDENTITY_BOARD_VERSION &&
      frozen.boardVersion !==
        SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION
    ) {
      reasons.push(
        `frozen Board ${JSON.stringify(requiredId)} uses unsupported version ${JSON.stringify(frozen.boardVersion)}`,
      );
      continue;
    }
    let derived: DerivedExpectedSetBoardIdentity;
    try {
      derived = deriveExpectedSetBoardIdentity({
        contract: args.contract,
        setIdentityId: requiredId,
        styleId: args.styleId,
        frozenBoardVersion: frozen.boardVersion,
      });
    } catch (error) {
      reasons.push(
        `frozen Board ${JSON.stringify(requiredId)} cannot be re-derived: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    const expected = derived.expected;
    if (frozen.registryVersion !== expected.registryVersion) {
      reasons.push(`frozen Board ${JSON.stringify(requiredId)} registryVersion mismatch`);
    }
    if (frozen.boardVersion !== expected.boardVersion) {
      reasons.push(`frozen Board ${JSON.stringify(requiredId)} boardVersion mismatch`);
    }
    if (frozen.storyKey !== expected.storyKey) {
      reasons.push(`frozen Board ${JSON.stringify(requiredId)} storyKey mismatch`);
    }
    if (frozen.styleId !== expected.styleId) {
      reasons.push(`frozen Board ${JSON.stringify(requiredId)} styleId mismatch`);
    }
    if (frozen.setDefinitionHash !== expected.setDefinitionHash) {
      reasons.push(`frozen Board ${JSON.stringify(requiredId)} setDefinitionHash mismatch`);
    }
    if (frozen.contentPolicyDigest !== expected.contentPolicyDigest) {
      reasons.push(`frozen Board ${JSON.stringify(requiredId)} contentPolicyDigest mismatch`);
    }
    if (!exactStringArray(frozen.declaredPropIds, expected.declaredPropIds)) {
      reasons.push(`frozen Board ${JSON.stringify(requiredId)} declaredPropIds mismatch`);
    }
    derivedById.set(requiredId, derived);
  }
  if (reasons.length > 0) throw new FrozenSetBoardAuthorityInvalidError(reasons);
  return derivedById;
}
