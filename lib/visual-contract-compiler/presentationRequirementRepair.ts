import { canonicalize } from '@/lib/canonical-json';

import {
  PRESENTATION_REQUIREMENT_CLASS_VALUES,
  type ActionSemanticCapabilityGap,
  type PresentationRequirementClass,
} from './actionSemanticCoverage';

export const PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_VERSION =
  'presentation-requirement-repair-schema/v2' as const;
export const PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_NAME =
  'PresentationRequirementRepairPatches' as const;
export const PRESENTATION_REQUIREMENT_REPAIR_PROMPT_VERSION =
  'presentation-requirement-repair-prompt/v2' as const;
export const PRESENTATION_REQUIREMENT_REPAIR_USER_PROMPT_VERSION =
  'presentation-requirement-repair-user-prompt/v2' as const;

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

const presentationRequirementPatch = strictObject({
  pageNumber: { type: 'integer', minimum: 1 },
  coverageIndex: { type: 'integer', minimum: 0 },
  beatId: { type: 'string', pattern: '^beat:p[1-9][0-9]*:[a-z0-9_]+$' },
  sourceEvidenceId: { type: 'string', pattern: '^se1_[a-f0-9]{64}$' },
  presentationClass: {
    type: 'string',
    enum: PRESENTATION_REQUIREMENT_CLASS_VALUES,
  },
  pointerChoiceIndex: { type: 'integer', minimum: 0 },
});

export const PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA: Record<
  string,
  unknown
> = strictObject({
  patches: {
    type: 'array',
    minItems: 1,
    items: presentationRequirementPatch,
  },
});

export interface PresentationRequirementRepairPointerValue {
  contractPointer: string;
  contractValue: string;
}

export interface PresentationRequirementRepairTarget {
  pageNumber: number;
  coverageIndex: number;
  beatId: string;
  sourceEvidenceId: string;
  sourcePhrase: string;
  permittedPointerValues: PresentationRequirementRepairPointerValue[];
}

export interface PresentationRequirementRepairPatch {
  pageNumber: number;
  coverageIndex: number;
  beatId: string;
  sourceEvidenceId: string;
  presentationClass: PresentationRequirementClass;
  pointerChoiceIndex: number;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return canonicalJson(Object.keys(value).sort()) ===
    canonicalJson([...expected].sort());
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function targetKey(value: {
  pageNumber: number;
  coverageIndex: number;
  beatId: string;
  sourceEvidenceId: string;
}): string {
  return canonicalJson([
    value.pageNumber,
    value.coverageIndex,
    value.beatId,
    value.sourceEvidenceId,
  ]);
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Builds the only repair authority accepted by this lane. Every gap must bind
 * one exact unsupported record and at least one same-page mustShow string.
 * Mixed, stale, ambiguous, or prose-only authority returns null and remains
 * terminal.
 */
export function presentationRequirementRepairTargets(args: {
  draft: Record<string, unknown>;
  gaps: readonly ActionSemanticCapabilityGap[];
}): PresentationRequirementRepairTarget[] | null {
  if (args.gaps.length === 0) return null;
  const pages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts
    : [];
  const targets: PresentationRequirementRepairTarget[] = [];
  const seen = new Set<string>();

  for (const gap of args.gaps) {
    const matchingPages = pages
      .map((page, pageIndex) => ({ page: recordValue(page), pageIndex }))
      .filter(({ page }) => page?.pageNumber === gap.pageNumber);
    if (matchingPages.length !== 1) return null;
    const { page, pageIndex } = matchingPages[0]!;
    if (!page) return null;
    const coverage = Array.isArray(page.actionSemanticCoverage)
      ? page.actionSemanticCoverage
      : [];
    const record = recordValue(coverage[gap.coverageIndex]);
    const disposition = recordValue(record?.disposition);
    if (
      !record ||
      record.beatId !== gap.beatId ||
      record.sourceEvidenceId !== gap.sourceEvidenceId ||
      disposition?.kind !== 'unsupported' ||
      disposition.reason !== 'closed_action_catalog_gap'
    ) {
      return null;
    }
    const mustShow = Array.isArray(page.mustShow) ? page.mustShow : [];
    const permittedPointerValues = mustShow
      .map((value, index) =>
        typeof value === 'string' && value.trim().length > 0
          ? {
              contractPointer: `/pageContracts/${pageIndex}/mustShow/${index}`,
              contractValue: value,
            }
          : null,
      )
      .filter(
        (value): value is PresentationRequirementRepairPointerValue =>
          value !== null,
      )
      .sort(
        (left, right) =>
          lexicalCompare(left.contractPointer, right.contractPointer) ||
          lexicalCompare(left.contractValue, right.contractValue),
      );
    if (permittedPointerValues.length === 0) return null;
    const target: PresentationRequirementRepairTarget = {
      pageNumber: gap.pageNumber,
      coverageIndex: gap.coverageIndex,
      beatId: gap.beatId,
      sourceEvidenceId: gap.sourceEvidenceId,
      sourcePhrase: gap.sourcePhrase,
      permittedPointerValues,
    };
    const key = targetKey(target);
    if (seen.has(key)) return null;
    seen.add(key);
    targets.push(target);
  }

  return targets.sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      left.coverageIndex - right.coverageIndex ||
      lexicalCompare(left.beatId, right.beatId),
  );
}

export function buildPresentationRequirementRepairSystemPrompt(): string {
  return [
    'You repair ONLY closed Action Semantic Catalog gaps that are presentation requirements rather than physical actions.',
    'Return exactly one patch for every target and no other patch.',
    'Choose one closed presentationClass and one zero-based pointerChoiceIndex into that target\'s ordered permittedPointerValues array.',
    'Use static_state for visible pose/state, lighting_state for illumination, composition_focus for framing/emphasis, graphic_sound_cue for visible sound lettering, and ambient_event for a depictable environmental occurrence.',
    'Do not use this lane to disguise a physical action, spatial action, or unsupported predicate.',
    'Copy all target identities exactly. Never return a raw contractPointer; the compiler resolves the selected pointer and contractValue locally.',
    'Do not return prose, contractPointer, contractValue, a full draft, or any extra key.',
    'Output only the JSON patch object required by the schema.',
  ].join('\n');
}

export function buildPresentationRequirementRepairUserPrompt(args: {
  targets: readonly PresentationRequirementRepairTarget[];
}): string {
  return canonicalJson({ targets: args.targets });
}

export function parsePresentationRequirementRepairPatches(
  raw: string,
): PresentationRequirementRepairPatch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('presentation_requirement_repair_response_invalid_json');
  }
  const root = recordValue(parsed);
  if (!root || !exactKeys(root, ['patches']) || !Array.isArray(root.patches)) {
    throw new Error('presentation_requirement_repair_response_invalid_shape');
  }
  return root.patches.map((value) => {
    const patch = recordValue(value);
    if (
      !patch ||
      !exactKeys(patch, [
        'pageNumber',
        'coverageIndex',
        'beatId',
        'sourceEvidenceId',
        'presentationClass',
        'pointerChoiceIndex',
      ]) ||
      !Number.isSafeInteger(patch.pageNumber) ||
      (patch.pageNumber as number) < 1 ||
      !Number.isSafeInteger(patch.coverageIndex) ||
      (patch.coverageIndex as number) < 0 ||
      typeof patch.beatId !== 'string' ||
      typeof patch.sourceEvidenceId !== 'string' ||
      !Number.isSafeInteger(patch.pointerChoiceIndex) ||
      (patch.pointerChoiceIndex as number) < 0
    ) {
      throw new Error('presentation_requirement_repair_patch_invalid');
    }
    if (
      !PRESENTATION_REQUIREMENT_CLASS_VALUES.includes(
        patch.presentationClass as PresentationRequirementClass,
      )
    ) {
      throw new Error('presentation_requirement_repair_class_invalid');
    }
    return patch as unknown as PresentationRequirementRepairPatch;
  });
}

function maskedDraft(args: {
  draft: Record<string, unknown>;
  targets: readonly PresentationRequirementRepairTarget[];
}): Record<string, unknown> {
  const clone = structuredClone(args.draft);
  const pages = Array.isArray(clone.pageContracts) ? clone.pageContracts : [];
  for (const target of args.targets) {
    const page = pages
      .map(recordValue)
      .find((candidate) => candidate?.pageNumber === target.pageNumber);
    const coverage = Array.isArray(page?.actionSemanticCoverage)
      ? page.actionSemanticCoverage
      : [];
    const record = recordValue(coverage[target.coverageIndex]);
    if (record) record.disposition = '__presentation_requirement_repair_target__';
  }
  return clone;
}

export function applyPresentationRequirementRepairPatches(args: {
  draft: Record<string, unknown>;
  targets: readonly PresentationRequirementRepairTarget[];
  patches: readonly PresentationRequirementRepairPatch[];
}): Record<string, unknown> {
  const expected = new Map(args.targets.map((target) => [targetKey(target), target]));
  if (expected.size !== args.targets.length) {
    throw new Error('presentation_requirement_repair_target_duplicate');
  }
  const patchKeys = args.patches.map(targetKey);
  if (new Set(patchKeys).size !== patchKeys.length) {
    throw new Error('presentation_requirement_repair_patch_unexpected_or_duplicate');
  }
  if (args.patches.length !== expected.size) {
    throw new Error('presentation_requirement_repair_patch_set_incomplete');
  }
  const beforeMasked = canonicalJson(maskedDraft(args));
  const draft = structuredClone(args.draft);
  const pages = Array.isArray(draft.pageContracts) ? draft.pageContracts : [];
  const seen = new Set<string>();

  for (const patch of args.patches) {
    const key = targetKey(patch);
    const target = expected.get(key);
    if (!target || seen.has(key)) {
      throw new Error('presentation_requirement_repair_patch_unexpected_or_duplicate');
    }
    seen.add(key);
    if (
      !PRESENTATION_REQUIREMENT_CLASS_VALUES.includes(
        patch.presentationClass as PresentationRequirementClass,
      )
    ) {
      throw new Error('presentation_requirement_repair_class_invalid');
    }
    const selection =
      Number.isSafeInteger(patch.pointerChoiceIndex) &&
      patch.pointerChoiceIndex >= 0
        ? target.permittedPointerValues[patch.pointerChoiceIndex]
        : undefined;
    if (!selection) {
      throw new Error(
        'presentation_requirement_repair_pointer_choice_not_permitted',
      );
    }
    const matchingPages = pages
      .map(recordValue)
      .filter((page) => page?.pageNumber === patch.pageNumber);
    if (matchingPages.length !== 1) {
      throw new Error('presentation_requirement_repair_page_not_unique');
    }
    const coverage = Array.isArray(matchingPages[0]!.actionSemanticCoverage)
      ? matchingPages[0]!.actionSemanticCoverage
      : [];
    const record = recordValue(coverage[patch.coverageIndex]);
    const disposition = recordValue(record?.disposition);
    if (
      !record ||
      record.beatId !== patch.beatId ||
      record.sourceEvidenceId !== patch.sourceEvidenceId ||
      disposition?.kind !== 'unsupported' ||
      disposition.reason !== 'closed_action_catalog_gap'
    ) {
      throw new Error('presentation_requirement_repair_target_stale');
    }
    record.disposition = {
      kind: 'presentation_requirement',
      presentationClass: patch.presentationClass,
      contractPointer: selection.contractPointer,
      contractValue: selection.contractValue,
    };
  }
  if (seen.size !== expected.size) {
    throw new Error('presentation_requirement_repair_patch_set_incomplete');
  }
  if (canonicalJson(maskedDraft({ draft, targets: args.targets })) !== beforeMasked) {
    throw new Error('presentation_requirement_repair_non_target_drift');
  }
  return draft;
}
