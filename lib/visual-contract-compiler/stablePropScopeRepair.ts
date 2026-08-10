import { canonicalize } from '@/lib/canonical-json';

import type { DraftAuthorityReferenceIssue } from './draftAuthorityReferenceDiagnostics';

export const STABLE_PROP_SCOPE_REPAIR_SCHEMA_VERSION =
  'stable-prop-scope-repair-schema/v1' as const;
export const STABLE_PROP_SCOPE_REPAIR_SCHEMA_NAME =
  'StablePropScopeRepairPatches' as const;
export const STABLE_PROP_SCOPE_REPAIR_PROMPT_VERSION =
  'stable-prop-scope-repair-prompt/v1' as const;
export const STABLE_PROP_SCOPE_REPAIR_USER_PROMPT_VERSION =
  'stable-prop-scope-repair-user-prompt/v1' as const;

const ELIGIBLE_CODES = [
  'recurring_prop_lifecycle_gated',
  'recurring_prop_consumer_forbidden',
] as const;

export type StablePropScopeRepairReasonCode =
  (typeof ELIGIBLE_CODES)[number];

function strictObject(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

const stablePropScopePatch = strictObject({
  authorityIndex: { type: 'integer', minimum: 0 },
  areaIndex: { type: 'integer', minimum: 0 },
  nodeIndex: { type: 'integer', minimum: 0 },
  fieldRole: {
    type: 'string',
    const: 'spatialNodes.stablePropId',
  },
  stablePropId: { type: 'null' },
});

export const STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA: Record<
  string,
  unknown
> = strictObject({
  patches: {
    type: 'array',
    minItems: 1,
    items: stablePropScopePatch,
  },
});

export interface StablePropScopeRepairTarget {
  authorityIndex: number;
  areaIndex: number;
  nodeIndex: number;
  fieldRole: 'spatialNodes.stablePropId';
  reasonCodes: StablePropScopeRepairReasonCode[];
}

export interface StablePropScopeRepairPatch {
  authorityIndex: number;
  areaIndex: number;
  nodeIndex: number;
  fieldRole: 'spatialNodes.stablePropId';
  stablePropId: null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return canonicalJson(Object.keys(value).sort()) ===
    canonicalJson([...expected].sort());
}

function targetKey(value: {
  authorityIndex: number;
  areaIndex: number;
  nodeIndex: number;
  fieldRole: 'spatialNodes.stablePropId';
}): string {
  return canonicalJson([
    value.authorityIndex,
    value.areaIndex,
    value.nodeIndex,
    value.fieldRole,
  ]);
}

function nodeForTarget(args: {
  draft: Record<string, unknown>;
  target: Pick<
    StablePropScopeRepairTarget,
    'authorityIndex' | 'areaIndex' | 'nodeIndex'
  >;
}): Record<string, unknown> | null {
  const authorities = Array.isArray(args.draft.setBoardAuthorities)
    ? args.draft.setBoardAuthorities
    : [];
  const authority = recordValue(authorities[args.target.authorityIndex]);
  const areas = Array.isArray(authority?.areas) ? authority.areas : [];
  const area = recordValue(areas[args.target.areaIndex]);
  const nodes = Array.isArray(area?.spatialNodes) ? area.spatialNodes : [];
  return recordValue(nodes[args.target.nodeIndex]);
}

function eligibleIssue(
  issue: DraftAuthorityReferenceIssue,
): issue is DraftAuthorityReferenceIssue & {
  code: StablePropScopeRepairReasonCode;
  locator: Extract<
    DraftAuthorityReferenceIssue['locator'],
    { kind: 'set_area_node' }
  >;
} {
  return (
    ELIGIBLE_CODES.includes(issue.code as StablePropScopeRepairReasonCode) &&
    issue.locator.kind === 'set_area_node' &&
    issue.locator.referenceClass === 'recurring_prop' &&
    issue.locator.fieldRole === 'spatialNodes.stablePropId'
  );
}

export function stablePropScopeIssuesAreRepairable(
  issues: readonly DraftAuthorityReferenceIssue[],
): boolean {
  return issues.length > 0 && issues.every(eligibleIssue);
}

/**
 * Converts the closed issue family into one target per structural locator.
 * Authored prop IDs are deliberately neither copied nor returned.
 */
export function stablePropScopeRepairTargets(args: {
  draft: Record<string, unknown>;
  issues: readonly DraftAuthorityReferenceIssue[];
}): StablePropScopeRepairTarget[] | null {
  if (!stablePropScopeIssuesAreRepairable(args.issues)) return null;
  const targets = new Map<string, StablePropScopeRepairTarget>();
  for (const issue of args.issues) {
    if (!eligibleIssue(issue)) return null;
    const locator = issue.locator;
    const identity = {
      authorityIndex: locator.authorityIndex,
      areaIndex: locator.areaIndex,
      nodeIndex: locator.nodeIndex,
      fieldRole: 'spatialNodes.stablePropId' as const,
    };
    const node = nodeForTarget({ draft: args.draft, target: identity });
    if (
      !node ||
      typeof node.stablePropId !== 'string' ||
      node.stablePropId.length === 0
    ) {
      return null;
    }
    const key = targetKey(identity);
    const existing = targets.get(key);
    const reasonCodes = [
      ...new Set([...(existing?.reasonCodes ?? []), issue.code]),
    ].sort();
    targets.set(key, { ...identity, reasonCodes });
  }
  return [...targets.values()].sort(
    (left, right) =>
      left.authorityIndex - right.authorityIndex ||
      left.areaIndex - right.areaIndex ||
      left.nodeIndex - right.nodeIndex,
  );
}

export function buildStablePropScopeRepairSystemPrompt(): string {
  return [
    'Repair ONLY the exact stable Set Board prop-scope targets listed by the input.',
    'Return exactly one patch for every structural target and no other patch.',
    'Every stablePropId value MUST be null. Never select, copy, rename, or invent a prop ID.',
    'The compiler preserves recurring props and page-frame constraints, applies null only at each exact target, and reruns complete validation.',
    'Copy authorityIndex, areaIndex, nodeIndex, and fieldRole exactly.',
    'Do not return prose, reasonCodes, authored values, a full draft, or any extra key.',
    'Output only the JSON object required by the strict repair schema.',
  ].join('\n');
}

export function buildStablePropScopeRepairUserPrompt(args: {
  targets: readonly StablePropScopeRepairTarget[];
}): string {
  return canonicalJson({
    targets: [...args.targets]
      .sort(
        (left, right) =>
          left.authorityIndex - right.authorityIndex ||
          left.areaIndex - right.areaIndex ||
          left.nodeIndex - right.nodeIndex,
      )
      .map((target) => structuredClone(target)),
  });
}

const PATCH_KEYS = [
  'authorityIndex',
  'areaIndex',
  'nodeIndex',
  'fieldRole',
  'stablePropId',
] as const;

export function parseStablePropScopeRepairPatches(
  raw: string,
): StablePropScopeRepairPatch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('stable_prop_scope_repair_response_invalid_json');
  }
  const root = recordValue(parsed);
  if (
    !root ||
    !exactKeys(root, ['patches']) ||
    !Array.isArray(root.patches) ||
    root.patches.length === 0
  ) {
    throw new Error('stable_prop_scope_repair_response_invalid_shape');
  }
  return root.patches.map((value) => {
    const patch = recordValue(value);
    if (
      !patch ||
      !exactKeys(patch, PATCH_KEYS) ||
      !Number.isSafeInteger(patch.authorityIndex) ||
      (patch.authorityIndex as number) < 0 ||
      !Number.isSafeInteger(patch.areaIndex) ||
      (patch.areaIndex as number) < 0 ||
      !Number.isSafeInteger(patch.nodeIndex) ||
      (patch.nodeIndex as number) < 0 ||
      patch.fieldRole !== 'spatialNodes.stablePropId' ||
      patch.stablePropId !== null
    ) {
      throw new Error('stable_prop_scope_repair_patch_invalid');
    }
    return patch as unknown as StablePropScopeRepairPatch;
  });
}

function maskedDraft(args: {
  draft: Record<string, unknown>;
  targets: readonly StablePropScopeRepairTarget[];
}): unknown {
  const masked = structuredClone(args.draft);
  for (const target of args.targets) {
    const node = nodeForTarget({ draft: masked, target });
    if (!node || !Object.prototype.hasOwnProperty.call(node, 'stablePropId')) {
      throw new Error('stable_prop_scope_repair_target_stale');
    }
    node.stablePropId = '__stable_prop_scope_repair_target__';
  }
  return canonicalize(masked);
}

export function applyStablePropScopeRepairPatches(args: {
  draft: Record<string, unknown>;
  targets: readonly StablePropScopeRepairTarget[];
  patches: readonly StablePropScopeRepairPatch[];
}): Record<string, unknown> {
  if (args.targets.length === 0) {
    throw new Error('stable_prop_scope_repair_target_set_empty');
  }
  const expected = new Map<string, StablePropScopeRepairTarget>();
  for (const target of args.targets) {
    const key = targetKey(target);
    if (expected.has(key)) {
      throw new Error('stable_prop_scope_repair_target_duplicate');
    }
    expected.set(key, target);
  }
  if (args.patches.length !== expected.size) {
    throw new Error('stable_prop_scope_repair_patch_set_incomplete');
  }
  const patches = new Map<string, StablePropScopeRepairPatch>();
  for (const patch of args.patches) {
    const key = targetKey(patch);
    if (!expected.has(key) || patches.has(key)) {
      throw new Error('stable_prop_scope_repair_patch_unexpected_or_duplicate');
    }
    patches.set(key, patch);
  }

  const beforeMasked = maskedDraft(args);
  const result = structuredClone(args.draft);
  for (const target of args.targets) {
    const node = nodeForTarget({ draft: result, target });
    const patch = patches.get(targetKey(target));
    if (
      !node ||
      typeof node.stablePropId !== 'string' ||
      node.stablePropId.length === 0 ||
      !patch ||
      patch.stablePropId !== null
    ) {
      throw new Error('stable_prop_scope_repair_target_stale');
    }
    node.stablePropId = null;
  }
  const afterMasked = maskedDraft({ draft: result, targets: args.targets });
  if (canonicalJson(beforeMasked) !== canonicalJson(afterMasked)) {
    throw new Error('stable_prop_scope_repair_non_target_drift');
  }
  return result;
}
