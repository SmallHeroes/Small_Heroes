/**
 * Set Identity Board — the GLOBAL registry: validation, byte fencing, and JSON sidecar round-trip.
 *
 * A registry entry is the record that an approved (or candidate) board EXISTS and is trustworthy. Validation is
 * FAIL-CLOSED: an entry is usable only when every identity field matches what the current contract expects, the
 * bytes match, QA passed, AND a human explicitly approved it. Code never auto-approves — a minted candidate carries
 * `approvedBy:null`/`approvedAt:null`/`qaStatus:'pending'`, and this validator rejects it.
 *
 * STORAGE-KEY POLICY: the durable authority for the board bytes is `storageKey` (environment-independent). Any
 * resolved URL is env-specific and advisory; never persist a URL as the render authority. These helpers therefore
 * round-trip the entry (which holds `storageKey`) and never a URL.
 *
 * fs I/O lives ONLY in `loadRegistryEntry` / `saveRegistryEntry`; the validators are pure.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

import type { SetIdentityBoardRegistryEntry } from './types';

/** The identity fields an entry must match to be accepted for a given contract + style + set. */
export interface ExpectedRegistryIdentity {
  registryVersion: string;
  boardVersion: string;
  storyKey: string;
  setIdentityId: string;
  styleId: string;
  setDefinitionHash: string;
  contentPolicyDigest: string;
  declaredPropIds: string[];
}

export type RegistryValidation = { ok: true } | { ok: false; errors: string[] };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Structural shape check — every required field present and of the right primitive type. */
function shapeErrors(entry: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const stringFields = [
    'registryVersion',
    'boardVersion',
    'storyKey',
    'setIdentityId',
    'styleId',
    'setDefinitionHash',
    'contentPolicyDigest',
    'storageKey',
    'assetSha256',
    'promptHash',
    'model',
    'quality',
    'qaStatus',
    'qaCheckedAt',
  ];
  for (const f of stringFields) {
    if (typeof entry[f] !== 'string') errors.push(`field "${f}" must be a string`);
  }
  if (entry.qaStatus !== undefined && !['passed', 'failed', 'pending'].includes(entry.qaStatus as string)) {
    errors.push('field "qaStatus" must be one of passed|failed|pending');
  }
  if (!Array.isArray(entry.declaredPropIds) || !entry.declaredPropIds.every((value) => typeof value === 'string')) {
    errors.push('field "declaredPropIds" must be an array of strings');
  }
  // approvedBy / approvedAt are string|null by type — reject any other type outright.
  if (!(entry.approvedBy === null || typeof entry.approvedBy === 'string')) {
    errors.push('field "approvedBy" must be a string or null');
  }
  if (!(entry.approvedAt === null || typeof entry.approvedAt === 'string')) {
    errors.push('field "approvedAt" must be a string or null');
  }
  return errors;
}

/**
 * FAIL-CLOSED validation of a registry entry against what the current contract expects. Returns the FULL list of
 * problems so a caller can log every reason at once (never short-circuits at the first miss).
 */
export function validateSetIdentityBoardRegistryEntry(
  entry: unknown,
  expected: ExpectedRegistryIdentity
): RegistryValidation {
  const identityValidation = registryIdentityErrors(entry, expected);
  if (identityValidation.shapeInvalid) {
    return { ok: false, errors: identityValidation.errors };
  }

  const typed = entry as SetIdentityBoardRegistryEntry;
  const errors = [...identityValidation.errors];
  if (typed.qaStatus !== 'passed') {
    errors.push(`qaStatus must be "passed" (got "${typed.qaStatus}")`);
  }
  // Human approval is EXPLICIT — both fields must be non-empty. A candidate (null/null) is rejected here.
  if (!isNonEmptyString(typed.approvedBy)) {
    errors.push('approvedBy is empty — a human must explicitly approve this board');
  }
  if (!isNonEmptyString(typed.approvedAt)) {
    errors.push('approvedAt is empty — a human must explicitly approve this board');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Validate the immutable identity/content portion of a rendered candidate without requiring QA or human approval.
 * This is the only validator suitable for the same-byte recheck path: the full live validator must continue to
 * reject the exact failed/unapproved candidate that a recheck is allowed to inspect.
 */
export function validateSetIdentityBoardRegistryIdentity(
  entry: unknown,
  expected: ExpectedRegistryIdentity
): RegistryValidation {
  const validation = registryIdentityErrors(entry, expected);
  return validation.errors.length === 0 ? { ok: true } : { ok: false, errors: validation.errors };
}

function registryIdentityErrors(
  entry: unknown,
  expected: ExpectedRegistryIdentity,
): { errors: string[]; shapeInvalid: boolean } {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return { errors: ['entry is not an object'], shapeInvalid: true };
  }
  const e = entry as Record<string, unknown>;

  const errors = shapeErrors(e);
  // If the shape is already broken, further field comparisons would be noise — report shape problems alone.
  if (errors.length > 0) return { errors, shapeInvalid: true };

  const typed = entry as SetIdentityBoardRegistryEntry;

  if (typed.registryVersion !== expected.registryVersion) {
    errors.push(
      `registryVersion mismatch (expected "${expected.registryVersion}", got "${typed.registryVersion}")`
    );
  }
  if (typed.boardVersion !== expected.boardVersion) {
    errors.push(`boardVersion mismatch (expected "${expected.boardVersion}", got "${typed.boardVersion}")`);
  }
  if (typed.storyKey !== expected.storyKey) {
    errors.push(`storyKey mismatch (expected "${expected.storyKey}", got "${typed.storyKey}")`);
  }
  if (typed.setIdentityId !== expected.setIdentityId) {
    errors.push(
      `setIdentityId mismatch (expected "${expected.setIdentityId}", got "${typed.setIdentityId}")`
    );
  }
  if (typed.styleId !== expected.styleId) {
    errors.push(`styleId mismatch (expected "${expected.styleId}", got "${typed.styleId}")`);
  }
  if (typed.setDefinitionHash !== expected.setDefinitionHash) {
    errors.push('setDefinitionHash mismatch (the set changed — an old board must not be reused)');
  }
  if (typed.contentPolicyDigest !== expected.contentPolicyDigest) {
    errors.push('contentPolicyDigest mismatch (the declared visible board content changed)');
  }
  if (JSON.stringify(typed.declaredPropIds) !== JSON.stringify(expected.declaredPropIds)) {
    errors.push('declaredPropIds mismatch (the board prop-content declaration changed)');
  }

  return { errors, shapeInvalid: false };
}

/**
 * Byte fence: the actual bytes fetched from `storageKey` must hash to the value the entry recorded. A re-render that
 * changed the image (even at the same storageKey) fails here — an approval covers specific bytes, not a location.
 */
export function verifyBoardAssetBytes(
  entry: SetIdentityBoardRegistryEntry,
  actualSha256: string
): RegistryValidation {
  if (!isNonEmptyString(actualSha256)) {
    return { ok: false, errors: ['actualSha256 is empty'] };
  }
  if (actualSha256 !== entry.assetSha256) {
    return {
      ok: false,
      errors: [
        `board bytes changed (expected sha256 "${entry.assetSha256}", got "${actualSha256}") — approval is void`,
      ],
    };
  }
  return { ok: true };
}

/** Read + parse a registry sidecar. Returns null when missing or unparseable (never throws). */
export function loadRegistryEntry(filePath: string): SetIdentityBoardRegistryEntry | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as SetIdentityBoardRegistryEntry;
  } catch {
    return null;
  }
}

/** Write a registry sidecar as pretty JSON, creating the parent directory if needed. */
export function saveRegistryEntry(filePath: string, entry: SetIdentityBoardRegistryEntry): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(entry, null, 2));
}

/**
 * The GLOBAL logical key for an entry: `(storyKey, setIdentityId, styleId, setDefinitionHash, boardVersion)` joined.
 * Same story + same set + same style + same set-hash + same board version → same board, shared across all orders.
 */
export function computeExpectedRegistryKey(entry: SetIdentityBoardRegistryEntry): string {
  return [
    entry.storyKey,
    entry.setIdentityId,
    entry.styleId,
    entry.setDefinitionHash,
    entry.boardVersion,
  ].join('|');
}
