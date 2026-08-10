import { describe, expect, it } from 'vitest';

import type { DraftAuthorityReferenceIssue } from '../visual-contract-compiler/draftAuthorityReferenceDiagnostics';
import {
  STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA,
  applyStablePropScopeRepairPatches,
  buildStablePropScopeRepairUserPrompt,
  parseStablePropScopeRepairPatches,
  stablePropScopeIssuesAreRepairable,
  stablePropScopeRepairTargets,
  type StablePropScopeRepairPatch,
} from '../visual-contract-compiler/stablePropScopeRepair';
import { assertOpenAIResponsesStructuredOutputSchemaCompatible } from '../visual-package/openaiResponsesStructuredOutputSchemaCompatibility';

function draft() {
  return {
    worldType: 'grounded',
    setBoardAuthorities: [
      {
        setIdentityId: 'set:calibration',
        areas: [
          {
            areaId: 'area:entry',
            spatialNodes: [
              { id: 'node:a', stablePropId: 'prop:portable-a' },
              { id: 'node:b', stablePropId: null },
              { id: 'node:c', stablePropId: 'prop:portable-b' },
            ],
          },
        ],
      },
    ],
  };
}

function issue(
  nodeIndex: number,
  code:
    | 'recurring_prop_lifecycle_gated'
    | 'recurring_prop_consumer_forbidden' =
    'recurring_prop_lifecycle_gated',
): DraftAuthorityReferenceIssue {
  return {
    code,
    locator: {
      kind: 'set_area_node',
      referenceClass: 'recurring_prop',
      fieldRole: 'spatialNodes.stablePropId',
      authorityIndex: 0,
      areaIndex: 0,
      nodeIndex,
    },
  };
}

function targets() {
  const value = stablePropScopeRepairTargets({
    draft: draft(),
    issues: [
      issue(0),
      issue(0, 'recurring_prop_consumer_forbidden'),
      issue(2),
    ],
  });
  if (!value) throw new Error('expected stable prop repair targets');
  return value;
}

function patches(): StablePropScopeRepairPatch[] {
  return [
    {
      authorityIndex: 0,
      areaIndex: 0,
      nodeIndex: 0,
      fieldRole: 'spatialNodes.stablePropId',
      stablePropId: null,
    },
    {
      authorityIndex: 0,
      areaIndex: 0,
      nodeIndex: 2,
      fieldRole: 'spatialNodes.stablePropId',
      stablePropId: null,
    },
  ];
}

describe('stable Set Board prop-scope compact repair', () => {
  it('uses a strict Responses-compatible schema', () => {
    expect(
      assertOpenAIResponsesStructuredOutputSchemaCompatible(
        STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA,
      ).status,
    ).toBe('compatible');
  });

  it('deduplicates exact structural locators and never exposes authored prop values', () => {
    expect(targets()).toEqual([
      {
        authorityIndex: 0,
        areaIndex: 0,
        nodeIndex: 0,
        fieldRole: 'spatialNodes.stablePropId',
        reasonCodes: [
          'recurring_prop_consumer_forbidden',
          'recurring_prop_lifecycle_gated',
        ],
      },
      {
        authorityIndex: 0,
        areaIndex: 0,
        nodeIndex: 2,
        fieldRole: 'spatialNodes.stablePropId',
        reasonCodes: ['recurring_prop_lifecycle_gated'],
      },
    ]);
    const prompt = buildStablePropScopeRepairUserPrompt({
      targets: targets(),
    });
    expect(prompt).not.toContain('prop:portable-a');
    expect(prompt).not.toContain('prop:portable-b');
    expect(prompt).not.toContain('set:calibration');
  });

  it('applies null only at the exact targets without mutating the input', () => {
    const before = draft();
    const result = applyStablePropScopeRepairPatches({
      draft: before,
      targets: targets(),
      patches: parseStablePropScopeRepairPatches(
        JSON.stringify({ patches: patches().reverse() }),
      ),
    });
    const beforeNodes = before.setBoardAuthorities[0]!.areas[0]!.spatialNodes;
    const resultNodes = (
      result.setBoardAuthorities as ReturnType<typeof draft>['setBoardAuthorities']
    )[0]!.areas[0]!.spatialNodes;
    expect(result).not.toBe(before);
    expect(beforeNodes[0]!.stablePropId).toBe('prop:portable-a');
    expect(beforeNodes[2]!.stablePropId).toBe('prop:portable-b');
    expect(resultNodes.map((node) => node.stablePropId)).toEqual([
      null,
      null,
      null,
    ]);
    expect(result.worldType).toBe(before.worldType);
  });

  it.each([
    ['invalid json', 'x', 'stable_prop_scope_repair_response_invalid_json'],
    [
      'extra root key',
      JSON.stringify({ patches: patches(), extra: true }),
      'stable_prop_scope_repair_response_invalid_shape',
    ],
    [
      'non-null value',
      JSON.stringify({
        patches: [{ ...patches()[0], stablePropId: 'prop:invented' }],
      }),
      'stable_prop_scope_repair_patch_invalid',
    ],
    [
      'extra patch key',
      JSON.stringify({
        patches: [{ ...patches()[0], propId: 'prop:leak' }],
      }),
      'stable_prop_scope_repair_patch_invalid',
    ],
  ])('rejects %s', (_label, raw, code) => {
    expect(() => parseStablePropScopeRepairPatches(raw)).toThrow(code);
  });

  it('rejects missing, duplicate, unexpected, and stale target sets', () => {
    expect(() =>
      applyStablePropScopeRepairPatches({
        draft: draft(),
        targets: targets(),
        patches: [patches()[0]!],
      }),
    ).toThrow('stable_prop_scope_repair_patch_set_incomplete');
    expect(() =>
      applyStablePropScopeRepairPatches({
        draft: draft(),
        targets: targets(),
        patches: [patches()[0]!, patches()[0]!],
      }),
    ).toThrow('stable_prop_scope_repair_patch_unexpected_or_duplicate');
    expect(() =>
      applyStablePropScopeRepairPatches({
        draft: draft(),
        targets: targets(),
        patches: [patches()[0]!, { ...patches()[1]!, nodeIndex: 1 }],
      }),
    ).toThrow('stable_prop_scope_repair_patch_unexpected_or_duplicate');
    const stale = draft();
    stale.setBoardAuthorities[0]!.areas[0]!.spatialNodes[0]!.stablePropId = null;
    expect(() =>
      applyStablePropScopeRepairPatches({
        draft: stale,
        targets: targets(),
        patches: patches(),
      }),
    ).toThrow('stable_prop_scope_repair_target_stale');
  });

  it('keeps mixed, wrong-field, and already-unbound failures terminal', () => {
    const mixed = [
      issue(0),
      {
        code: 'recurring_prop_reference_unknown',
        locator: issue(2).locator,
      },
    ] as DraftAuthorityReferenceIssue[];
    expect(stablePropScopeIssuesAreRepairable(mixed)).toBe(false);
    expect(
      stablePropScopeRepairTargets({ draft: draft(), issues: mixed }),
    ).toBeNull();
    expect(
      stablePropScopeIssuesAreRepairable([
        {
          code: 'recurring_prop_lifecycle_gated',
          locator: {
            ...issue(0).locator,
            fieldRole: 'spatialNodes.propId',
          },
        } as unknown as DraftAuthorityReferenceIssue,
      ]),
    ).toBe(false);
    expect(
      stablePropScopeRepairTargets({
        draft: draft(),
        issues: [issue(1)],
      }),
    ).toBeNull();
  });
});
