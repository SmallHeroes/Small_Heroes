/**
 * BookVisualContract IMPORT ARTIFACTS (vNext / WS0).
 *
 * Bank stories are compiled ONCE at import time (via `compileBookVisualContract`, using the story text AND the
 * per-page image directions) and the resulting contract is written to a reviewable JSON artifact ALONGSIDE the
 * story bank. At runtime the bank path LOADS the approved artifact — there is NO LLM call on the customer path.
 * Dynamic (non-bank) stories compile once after text-finalization instead.
 *
 * Every load is FAIL-CLOSED: a missing file, unparseable JSON, or a contract that fails the vNext validator
 * throws BEFORE any spend. The artifact is DATA (human-reviewable, correctable) — never hardcoded code.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { assertValidVNextVisualContract } from './validateVNextVisualContract';
import { computeVisualContractHash } from './contractHash';
import type { BookVisualContract } from './types';

/** File suffix for a compiled, reviewable contract artifact (e.g. `bunny_bedtime.visual-contract.json`). */
export const CONTRACT_ARTIFACT_SUFFIX = '.visual-contract.json';

export class MissingContractArtifactError extends Error {
  readonly isMissingContractArtifact = true as const;
  constructor(readonly storyKey: string, readonly artifactPath: string, cause?: string) {
    super(`No BookVisualContract artifact for "${storyKey}" at ${artifactPath}${cause ? ` (${cause})` : ''}`);
    this.name = 'MissingContractArtifactError';
  }
}

/** The file path an artifact for `storyKey` lives at within `dir`. */
export function contractArtifactPath(dir: string, storyKey: string): string {
  return path.join(dir, `${storyKey}${CONTRACT_ARTIFACT_SUFFIX}`);
}

/**
 * Parse + fail-closed validate an already-loaded artifact value (JSON.parse output). Returns the validated
 * contract AND its canonical hash (so callers can stamp `Order.visualContractHash` without recomputing later).
 * Throws `InvalidVNextVisualContractError` on any structural problem.
 */
export function parseVisualContractArtifact(
  raw: unknown,
): { contract: BookVisualContract; contractHash: string } {
  assertValidVNextVisualContract(raw);
  const contract = raw as BookVisualContract;
  return { contract, contractHash: computeVisualContractHash(contract) };
}

/**
 * Load + validate a bank story's approved contract artifact from `dir`. FAIL-CLOSED: throws
 * MissingContractArtifactError when the file is absent/unreadable/unparseable, or the vNext validation error
 * when the contract is structurally invalid. No LLM, no network.
 */
export function loadVisualContractArtifact(
  dir: string,
  storyKey: string,
): { contract: BookVisualContract; contractHash: string } {
  const artifactPath = contractArtifactPath(dir, storyKey);
  let text: string;
  try {
    text = readFileSync(artifactPath, 'utf8');
  } catch (err) {
    throw new MissingContractArtifactError(storyKey, artifactPath, (err as Error).message);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new MissingContractArtifactError(storyKey, artifactPath, `invalid JSON: ${(err as Error).message}`);
  }
  return parseVisualContractArtifact(raw);
}
