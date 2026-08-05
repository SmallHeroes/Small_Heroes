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
import { assertValidBookVisualContractTemplate, InvalidTemplateContractError } from './validateTemplateContract';
import { computeVisualContractHash } from './contractHash';
import type { BookVisualContract } from './types';
import type { BookVisualContractTemplate } from './contractTemplateTypes';

/** File suffix for a compiled, reviewable contract artifact (e.g. `bunny_bedtime.visual-contract.json`). */
export const CONTRACT_ARTIFACT_SUFFIX = '.visual-contract.json';

/** File suffix for a story-level TEMPLATE artifact (typed bindings; materialized per order — NEVER frozen directly). */
export const CONTRACT_TEMPLATE_ARTIFACT_SUFFIX = '.visual-contract-template.json';

/** The path a TEMPLATE artifact for `storyKey` lives at within `dir`. */
export function contractTemplateArtifactPath(dir: string, storyKey: string): string {
  return path.join(dir, `${storyKey}${CONTRACT_TEMPLATE_ARTIFACT_SUFFIX}`);
}

/**
 * FAIL-CLOSED artifact-key/storyKey agreement (Fix 3): the loaded template's own `storyKey` must EQUAL the bank key
 * it was loaded under. A mismatch means the palette seed (`hash(… | storyKey | castId)`) would be driven by the wrong
 * story — throw rather than silently seed the deterministic appearance from a different story's key.
 */
function assertTemplateStoryKeyAgrees(template: BookVisualContractTemplate, storyKey: string, artifactPath: string): void {
  if (template.storyKey !== storyKey) {
    throw new InvalidTemplateContractError([
      `storyKey mismatch: artifact at ${artifactPath} declares storyKey ${JSON.stringify(template.storyKey)} but was loaded as "${storyKey}" (artifact-key/storyKey must agree so the deterministic palette seed is stable)`,
    ], [{
      family: 'draft_contract',
      code: 'cover_source_fidelity_invalid',
      locator: { kind: 'root', fieldRole: 'identity' },
    }]);
  }
}

/**
 * Load + fail-closed validate a story's Template artifact. FAIL-CLOSED: throws MissingContractArtifactError when the
 * file is absent/unreadable/unparseable, or InvalidTemplateContractError when it is structurally invalid. This is a
 * DISTINCT loader — a Template is NEVER read via `loadVisualContractArtifact`/`readFrozenVisualContract` (a Template
 * holds unresolved bindings and must never be frozen/rendered). No LLM, no network.
 */
export function loadVisualContractTemplateArtifact(
  dir: string,
  storyKey: string,
): { template: BookVisualContractTemplate } {
  const artifactPath = contractTemplateArtifactPath(dir, storyKey);
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
  assertValidBookVisualContractTemplate(raw);
  const template = raw as BookVisualContractTemplate;
  assertTemplateStoryKeyAgrees(template, storyKey, artifactPath);
  return { template };
}

/**
 * Load a Template if one exists. Returns `null` ONLY when the file is genuinely ABSENT (so a story without a Template
 * cleanly falls back to the legacy vNext artifact); a present-but-INVALID Template THROWS (fail-closed — never
 * silently skipped). No LLM, no network.
 */
export function tryLoadVisualContractTemplateArtifact(
  dir: string,
  storyKey: string,
): { template: BookVisualContractTemplate } | null {
  const artifactPath = contractTemplateArtifactPath(dir, storyKey);
  let text: string;
  try {
    text = readFileSync(artifactPath, 'utf8');
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return null; // absent → legacy fallback
    throw new MissingContractArtifactError(storyKey, artifactPath, (err as Error).message);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new MissingContractArtifactError(storyKey, artifactPath, `invalid JSON: ${(err as Error).message}`);
  }
  assertValidBookVisualContractTemplate(raw);
  const template = raw as BookVisualContractTemplate;
  assertTemplateStoryKeyAgrees(template, storyKey, artifactPath);
  return { template };
}

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
