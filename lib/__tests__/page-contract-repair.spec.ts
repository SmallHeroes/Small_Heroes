import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
  PAGE_CONTRACT_REPAIR_INPUT_ENCODING_VERSION,
  PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
  PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION,
  PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA,
  PAGE_SPATIAL_REFERENCE_REPAIR_PROMPT_VERSION,
  PAGE_SPATIAL_REFERENCE_REPAIR_USER_PROMPT_VERSION,
  applyPageContractRepairs,
  applyPageSpatialReferenceRepairPatches,
  buildPageContractRepairSystemPrompt,
  buildPageContractRepairUserPrompt,
  decodePageContractRepairInput,
  decodePageContractRepairUserPrompt,
  encodePageContractRepairInput,
  buildPageSpatialReferenceRepairSystemPrompt,
  buildPageSpatialReferenceRepairUserPrompt,
  pageContractRepairAffectedPages,
  pageSpatialReferenceRepairTargets,
  parsePageContractRepairs,
  parsePageSpatialReferenceRepairPatches,
} from '@/lib/visual-contract-compiler/pageContractRepair';
import type { DraftValidationIssue } from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import type { ActionSemanticCoverageTemplate } from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import type { DraftAuthorityReferenceIssue } from '@/lib/visual-contract-compiler/draftAuthorityReferenceDiagnostics';

function page(pageNumber: number) {
  return {
    pageNumber,
    locationId: 'loc:home',
    zoneId: `zone:${pageNumber}`,
    sameLocationAs: null,
    mustShow: [`page ${pageNumber}`],
    mustNotShow: [],
    propState: [],
    propConstraints: [],
    actionRequirements: [],
    actionSemanticCoverage: [
      {
        beatId: `beat:p${pageNumber}:test`,
        sourceEvidenceId: `se1_${'a'.repeat(64)}`,
        disposition: {
          kind: 'non_visual',
          rationale: 'narrative_context',
        },
      },
    ],
    camera: 'portrait medium shot',
    transition: {
      kind: 'steady',
      fromZoneId: null,
      toZoneId: null,
      cue: null,
    },
  };
}

function draft() {
  return {
    worldType: 'grounded',
    locations: [{ id: 'loc:home' }],
    zones: [
      { id: 'zone:1', locationId: 'loc:home', spatialNodes: [] },
      { id: 'zone:2', locationId: 'loc:home', spatialNodes: [] },
    ],
    cast: { child: { id: 'child:hero' }, companion: null },
    humanCast: [],
    recurringProps: [{ id: 'prop:book' }],
    coverContract: { marker: 'preserved' },
    pageContracts: [page(1), page(2)],
  };
}

function spatialDraft(): Record<string, unknown> {
  const value = draft() as Record<string, unknown>;
  value.zones = [
    {
      id: 'zone:1',
      locationId: 'loc:home',
      spatialNodes: [
        {
          id: 'node:window',
          kind: 'window',
          description: 'the window beside the reading chair',
        },
        {
          id: 'node:door',
          kind: 'doorway',
          description: 'the doorway into the hall',
        },
      ],
    },
    { id: 'zone:2', locationId: 'loc:home', spatialNodes: [] },
  ];
  const pages = value.pageContracts as Array<
    Record<string, unknown>
  >;
  pages[0]!.actionRequirements = [
    {
      beatId: 'beat:p1:subject',
      subject: {
        kind: 'entity',
        entity: { kind: 'spatial', id: 'node:outside' },
      },
      predicate: 'touches',
      object: null,
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'affirmative',
      laterality: null,
    },
    {
      beatId: 'beat:p1:object',
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'touches',
      object: { kind: 'spatial', id: 'node:outside' },
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'affirmative',
      laterality: null,
    },
    {
      beatId: 'beat:p1:effect',
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'moves',
      object: null,
      spatialEffect: {
        kind: 'relation',
        relation: 'toward',
        target: { kind: 'spatial', id: 'node:outside' },
      },
      spatialConstraint: null,
      polarity: 'affirmative',
      laterality: null,
    },
    {
      beatId: 'beat:p1:constraint',
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'sits',
      object: null,
      spatialEffect: null,
      spatialConstraint: {
        relation: 'beside',
        target: { kind: 'spatial', id: 'node:outside' },
      },
      polarity: 'affirmative',
      laterality: null,
    },
  ];
  return value;
}

function pageSpatialIssue(
  fieldRole:
    | 'subject'
    | 'object'
    | 'spatialEffect.target'
    | 'spatialConstraint.target'
    | 'safetyConstraints.target',
  itemIndex = 0,
): DraftAuthorityReferenceIssue {
  return fieldRole === 'safetyConstraints.target'
    ? {
        code: 'page_spatial_reference_outside_zone',
        locator: {
          kind: 'page_spatial_safety_constraint',
          referenceClass: 'page_spatial_selection',
          fieldRole,
          pageNumber: 1,
          safetyConstraintIndex: itemIndex,
        },
      }
    : {
        code: 'page_spatial_reference_outside_zone',
        locator: {
          kind: 'page_spatial_action',
          referenceClass: 'page_spatial_selection',
          fieldRole,
          pageNumber: 1,
          actionIndex: itemIndex,
        },
      };
}

function pageSpatialDiagnostic(itemIndex = 0): DraftValidationIssue {
  return {
    family: 'draft_contract',
    code: 'out_of_scope_reference',
    locator: {
      kind: 'page_item',
      collectionRole: 'page_actions',
      fieldRole: 'reference',
      pageNumber: 1,
      itemIndex,
    },
  };
}

function pageSpatialAuthority() {
  return [
    {
      pageNumber: 1,
      zoneId: 'zone:1',
      permittedSpatialReferences: [
        {
          id: 'node:window',
          kind: 'window',
          description: 'the window beside the reading chair',
        },
        {
          id: 'node:door',
          kind: 'doorway',
          description: 'the doorway into the hall',
        },
      ],
    },
  ];
}

function issue(pageNumber: number): DraftValidationIssue {
  return {
    family: 'draft_contract',
    code: 'final_structural_invariant_invalid',
    locator: {
      kind: 'page',
      fieldRole: 'final_structure',
      pageNumber,
    },
  };
}

const representedElsewhereIssueCodes = [
  'represented_elsewhere_pointer_out_of_scope',
  'represented_elsewhere_pointer_unresolved',
  'represented_elsewhere_value_mismatch',
] as const;

function representedElsewhereIssue(
  code: (typeof representedElsewhereIssueCodes)[number],
  pageNumber: number,
): DraftValidationIssue {
  return {
    family: 'action_semantic',
    code,
    locator: {
      kind: 'page_item',
      collectionRole: 'page_action_semantic_coverage',
      fieldRole:
        code === 'represented_elsewhere_value_mismatch'
          ? 'payload'
          : 'reference',
      pageNumber,
      itemIndex: 999,
    },
  };
}

function pointerTemplate(): ActionSemanticCoverageTemplate {
  return {
    pageContracts: [
      {
        ...page(1),
        locationId: 'loc:home',
        zoneId: 'zone:1',
        actionRequirements: [],
      },
      {
        ...page(2),
        locationId: 'loc:home',
        zoneId: 'zone:2',
        actionRequirements: [],
      },
    ],
  } as unknown as ActionSemanticCoverageTemplate;
}

describe('page-contract compact repair', () => {
  it('uses the exact exported page-contract member schema', () => {
    const properties = PAGE_CONTRACT_REPAIR_JSON_SCHEMA.properties as {
      pageContracts: { items: unknown };
    };
    expect(properties.pageContracts.items).toBeTruthy();
    expect(PAGE_CONTRACT_REPAIR_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  it('canonically round-trips compact JSON input independent of object key order', () => {
    const left = {
      affectedPages: [
        {
          pageNumber: 1,
          repeated: 'repeatable-authority-value',
          nested: { z: true, a: 'repeatable-authority-value' },
        },
      ],
    };
    const right = {
      affectedPages: [
        {
          nested: { a: 'repeatable-authority-value', z: true },
          repeated: 'repeatable-authority-value',
          pageNumber: 1,
        },
      ],
    };
    const encoded = encodePageContractRepairInput(left);
    expect(encoded.encodingVersion).toBe(
      PAGE_CONTRACT_REPAIR_INPUT_ENCODING_VERSION,
    );
    expect(encoded).toEqual(encodePageContractRepairInput(right));
    expect(decodePageContractRepairInput(encoded)).toEqual(right);
  });

  it.each([
    ['extra envelope key', (value: any) => ({ ...value, extra: true })],
    [
      'duplicate dictionary value',
      (value: any) => ({
        ...value,
        stringDictionary: ['duplicate-value', 'duplicate-value'],
      }),
    ],
    [
      'unsorted dictionary',
      (value: any) => ({
        ...value,
        stringDictionary: ['z-repeat-value', 'a-repeat-value'],
      }),
    ],
    [
      'unsorted object shape',
      (value: any) => ({ ...value, objectShapes: [['z', 'a']] }),
    ],
    [
      'unsorted shape table',
      (value: any) => ({
        ...value,
        objectShapes: [['z'], ['a']],
      }),
    ],
    [
      'out-of-range string reference',
      (value: any) => ({ ...value, rootTuple: ['s', 999] }),
    ],
    [
      'out-of-range shape reference',
      (value: any) => ({ ...value, rootTuple: ['o', 999] }),
    ],
    [
      'malformed tuple tag',
      (value: any) => ({ ...value, rootTuple: ['x', 0] }),
    ],
  ])('rejects %s in compact input fail-closed', (_label, mutate) => {
    const encoded = encodePageContractRepairInput({ value: 'safe' });
    expect(() => decodePageContractRepairInput(mutate(encoded))).toThrow(
      'page_contract_repair_input_encoding_invalid',
    );
  });

  it('rejects non-JSON and cyclic input before prompt serialization', () => {
    expect(() => encodePageContractRepairInput({ value: NaN })).toThrow(
      'page_contract_repair_input_non_json',
    );
    expect(() =>
      encodePageContractRepairInput({ value: undefined }),
    ).toThrow('page_contract_repair_input_non_json');
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => encodePageContractRepairInput(cyclic)).toThrow(
      'page_contract_repair_input_non_json',
    );
  });

  it('losslessly compacts a 12-page Fox-shaped authority with at least 4K admission headroom', () => {
    const template = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'story-bank',
          'v3-approved',
          'fox_uri_adventure.visual-contract-template.json',
        ),
        'utf8',
      ),
    ) as { pageContracts: Array<Record<string, unknown>> };
    const affectedPages = template.pageContracts.map((pageContract) => ({
      pageNumber: pageContract.pageNumber as number,
      pageContract,
      repairTargets: [
        {
          family: 'draft_contract' as const,
          code: 'final_structural_invariant_invalid' as const,
          pageNumber: pageContract.pageNumber as number,
        },
      ],
      permittedPointerValues: [],
    }));
    const raw = JSON.stringify({ affectedPages });
    const compact = buildPageContractRepairUserPrompt({ affectedPages });
    expect(decodePageContractRepairUserPrompt(compact)).toEqual({
      affectedPages,
    });
    expect(Buffer.byteLength(compact, 'utf8')).toBeLessThan(
      Buffer.byteLength(raw, 'utf8'),
    );
    const admittedUpperBound =
      Buffer.byteLength(
        [
          buildPageContractRepairSystemPrompt(),
          compact,
          JSON.stringify(PAGE_CONTRACT_REPAIR_JSON_SCHEMA),
        ].join('\n'),
        'utf8',
      ) + 4_096;
    expect(admittedUpperBound).toBeLessThanOrEqual(64_000);
    expect(64_000 - admittedUpperBound).toBeGreaterThanOrEqual(4_096);
  });

  it('selects only an all-page final-structure diagnostic set', () => {
    const affected = pageContractRepairAffectedPages({
      draft: draft(),
      diagnosticIssues: [issue(2), issue(1), issue(2)],
    });
    expect(affected?.map((value) => value.pageNumber)).toEqual([1, 2]);
    expect(
      pageContractRepairAffectedPages({
        draft: draft(),
        diagnosticIssues: [
          issue(1),
          {
            family: 'draft_contract',
            code: 'unresolved_reference',
            locator: {
              kind: 'page',
              fieldRole: 'reference',
              pageNumber: 1,
            },
          },
        ],
      }),
    ).toBeNull();
  });

  it.each(representedElsewhereIssueCodes)(
    'directly admits the closed %s identity from its typed pageNumber',
    (code) => {
      const affected = pageContractRepairAffectedPages({
        draft: draft(),
        diagnosticIssues: [representedElsewhereIssue(code, 2)],
        pointerTemplate: pointerTemplate(),
      });
      expect(affected).toMatchObject([
        {
          pageNumber: 2,
          repairTargets: [
            { family: 'action_semantic', code, pageNumber: 2 },
          ],
        },
      ]);
      expect(affected?.[0]?.permittedPointerValues).toContainEqual({
        contractPointer: '/pageContracts/1/locationId',
        contractValue: 'loc:home',
      });
      expect(
        JSON.stringify(affected?.[0]?.repairTargets),
      ).not.toContain('999');
    },
  );

  it.each([
    ['subject', 0],
    ['object', 1],
    ['spatialEffect.target', 2],
    ['spatialConstraint.target', 3],
  ] as const)(
    'builds the closed field-scoped %s target with exact zone authority',
    (fieldRole, actionIndex) => {
      const affected = pageSpatialReferenceRepairTargets({
        draft: spatialDraft(),
        issues: [pageSpatialIssue(fieldRole, actionIndex)],
        authority: pageSpatialAuthority(),
      });
      expect(affected).toMatchObject([
        {
          pageNumber: 1,
          actionIndex,
          fieldRole,
          permittedSpatialReferences: [
            {
              id: 'node:door',
              kind: 'doorway',
              description: 'the doorway into the hall',
            },
            {
              id: 'node:window',
              kind: 'window',
              description: 'the window beside the reading chair',
            },
          ],
        },
      ]);
      expect(JSON.stringify(affected)).not.toContain('node:outside');
    },
  );

  it('keeps safety constraints and malformed or authority-less targets off the field-scoped route', () => {
    expect(
      pageSpatialReferenceRepairTargets({
        draft: spatialDraft(),
        issues: [pageSpatialIssue('safetyConstraints.target')],
        authority: pageSpatialAuthority(),
      }),
    ).toBeNull();
    expect(
      pageSpatialReferenceRepairTargets({
        draft: spatialDraft(),
        issues: [
          {
            code: 'recurring_prop_consumer_forbidden',
            locator: {
              kind: 'set_area_node',
              referenceClass: 'recurring_prop',
              fieldRole: 'spatialNodes.stablePropId',
              authorityIndex: 0,
              areaIndex: 0,
              nodeIndex: 0,
            },
          },
        ],
        authority: pageSpatialAuthority(),
      }),
    ).toBeNull();
    expect(
      pageSpatialReferenceRepairTargets({
        draft: spatialDraft(),
        issues: [pageSpatialIssue('object', 99)],
        authority: pageSpatialAuthority(),
      }),
    ).toBeNull();
    expect(
      pageSpatialReferenceRepairTargets({
        draft: spatialDraft(),
        issues: [pageSpatialIssue('object', 1)],
        authority: [
          {
            pageNumber: 1,
            zoneId: 'zone:1',
            permittedSpatialReferences: [],
          },
        ],
      }),
    ).toBeNull();
  });

  it('uses a strict field-patch schema and sanitized bounded prompt', () => {
    const targets = pageSpatialReferenceRepairTargets({
      draft: spatialDraft(),
      issues: [pageSpatialIssue('object', 1)],
      authority: pageSpatialAuthority(),
    })!;
    const prompt = buildPageSpatialReferenceRepairUserPrompt({ targets });
    expect(PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['patches'],
    });
    expect(PAGE_SPATIAL_REFERENCE_REPAIR_PROMPT_VERSION).toBe(
      'page-spatial-reference-repair-prompt/v1',
    );
    expect(PAGE_SPATIAL_REFERENCE_REPAIR_USER_PROMPT_VERSION).toBe(
      'page-spatial-reference-repair-user-prompt/v1',
    );
    expect(buildPageSpatialReferenceRepairSystemPrompt()).toContain(
      'ONLY the exact page-spatial reference targets',
    );
    expect(prompt).toContain('node:door');
    expect(prompt).not.toContain('node:outside');
    expect(prompt).not.toContain('pageContracts');
    expect(prompt).not.toContain('beat:p1:object');
  });

  it('applies all four target roles exactly and preserves every non-target byte canonically', () => {
    const original = spatialDraft();
    const snapshot = structuredClone(original);
    const targets = pageSpatialReferenceRepairTargets({
      draft: original,
      issues: [
        pageSpatialIssue('subject', 0),
        pageSpatialIssue('object', 1),
        pageSpatialIssue('spatialEffect.target', 2),
        pageSpatialIssue('spatialConstraint.target', 3),
      ],
      authority: pageSpatialAuthority(),
    })!;
    const patches = targets.map((target, index) => ({
      pageNumber: target.pageNumber,
      actionIndex: target.actionIndex,
      fieldRole: target.fieldRole,
      spatialReferenceId:
        index % 2 === 0 ? 'node:door' : 'node:window',
    }));
    const result = applyPageSpatialReferenceRepairPatches({
      draft: original,
      targets,
      patches,
    });
    expect(original).toEqual(snapshot);
    const actions = (
      (result.pageContracts as Record<string, unknown>[])[0]!
        .actionRequirements as Record<string, unknown>[]
    );
    expect(
      ((actions[0]!.subject as Record<string, unknown>)
        .entity as Record<string, unknown>).id,
    ).toBe('node:door');
    expect((actions[1]!.object as Record<string, unknown>).id).toBe(
      'node:window',
    );
    expect(
      ((actions[2]!.spatialEffect as Record<string, unknown>)
        .target as Record<string, unknown>).id,
    ).toBe('node:door');
    expect(
      ((actions[3]!.spatialConstraint as Record<string, unknown>)
        .target as Record<string, unknown>).id,
    ).toBe('node:window');
  });

  it('parses exact patches and rejects malformed and unsafe patch sets fail-closed', () => {
    const original = spatialDraft();
    const targets = pageSpatialReferenceRepairTargets({
      draft: original,
      issues: [pageSpatialIssue('object', 1)],
      authority: pageSpatialAuthority(),
    })!;
    const valid = {
      pageNumber: 1,
      actionIndex: 1,
      fieldRole: 'object' as const,
      spatialReferenceId: 'node:door',
    };
    expect(
      parsePageSpatialReferenceRepairPatches(
        JSON.stringify({ patches: [valid] }),
      ),
    ).toEqual([valid]);
    expect(() =>
      parsePageSpatialReferenceRepairPatches('not json'),
    ).toThrow('page_spatial_repair_response_invalid_json');
    expect(() =>
      parsePageSpatialReferenceRepairPatches('{}'),
    ).toThrow('page_spatial_repair_response_invalid_shape');
    expect(() =>
      parsePageSpatialReferenceRepairPatches(
        JSON.stringify({ patches: [{ ...valid, extra: true }] }),
      ),
    ).toThrow('page_spatial_repair_patch_invalid');
    expect(() =>
      parsePageSpatialReferenceRepairPatches(
        JSON.stringify({
          patches: [{ ...valid, fieldRole: 'safetyConstraints.target' }],
        }),
      ),
    ).toThrow('page_spatial_repair_patch_invalid');
    const { spatialReferenceId: _spatialReferenceId, ...missingId } =
      valid;
    expect(() =>
      parsePageSpatialReferenceRepairPatches(
        JSON.stringify({ patches: [missingId] }),
      ),
    ).toThrow('page_spatial_repair_patch_invalid');
    expect(() =>
      applyPageSpatialReferenceRepairPatches({
        draft: original,
        targets,
        patches: [],
      }),
    ).toThrow('page_spatial_repair_patch_set_incomplete');
    expect(() =>
      applyPageSpatialReferenceRepairPatches({
        draft: original,
        targets,
        patches: [{ ...valid, actionIndex: 0 }],
      }),
    ).toThrow('page_spatial_repair_patch_unexpected_or_duplicate');
    expect(() =>
      applyPageSpatialReferenceRepairPatches({
        draft: original,
        targets,
        patches: [{ ...valid, spatialReferenceId: 'node:outside' }],
      }),
    ).toThrow('page_spatial_repair_reference_not_permitted');
  });

  it('rejects duplicate targets, duplicate patches, and stale typed targets', () => {
    const original = spatialDraft();
    const targets = pageSpatialReferenceRepairTargets({
      draft: original,
      issues: [
        pageSpatialIssue('object', 1),
        pageSpatialIssue('spatialEffect.target', 2),
      ],
      authority: pageSpatialAuthority(),
    })!;
    expect(() =>
      applyPageSpatialReferenceRepairPatches({
        draft: original,
        targets: [targets[0]!, targets[0]!],
        patches: [],
      }),
    ).toThrow('page_spatial_repair_target_duplicate');

    const firstPatch = {
      pageNumber: targets[0]!.pageNumber,
      actionIndex: targets[0]!.actionIndex,
      fieldRole: targets[0]!.fieldRole,
      spatialReferenceId: 'node:door',
    };
    expect(() =>
      applyPageSpatialReferenceRepairPatches({
        draft: original,
        targets,
        patches: [firstPatch, firstPatch],
      }),
    ).toThrow('page_spatial_repair_patch_unexpected_or_duplicate');

    const stale = structuredClone(original);
    const staleActions = (
      (stale.pageContracts as Record<string, unknown>[])[0]!
        .actionRequirements as Record<string, unknown>[]
    );
    staleActions[1]!.object = { kind: 'cast', id: 'child:hero' };
    expect(() =>
      applyPageSpatialReferenceRepairPatches({
        draft: stale,
        targets: [targets[0]!],
        patches: [firstPatch],
      }),
    ).toThrow('page_spatial_repair_target_stale');
  });

  it.each([
    [
      'page locator',
      {
        family: 'action_semantic',
        code: 'represented_elsewhere_pointer_unresolved',
        locator: { kind: 'page', fieldRole: 'reference', pageNumber: 1 },
      },
    ],
    [
      'wrong page-item collection',
      {
        family: 'action_semantic',
        code: 'represented_elsewhere_pointer_unresolved',
        locator: {
          kind: 'page_item',
          collectionRole: 'page_actions',
          fieldRole: 'reference',
          pageNumber: 1,
          itemIndex: 0,
        },
      },
    ],
    [
      'collection item without page identity',
      {
        family: 'action_semantic',
        code: 'represented_elsewhere_pointer_unresolved',
        locator: {
          kind: 'collection_item',
          collectionRole: 'page_action_semantic_coverage',
          fieldRole: 'reference',
          itemIndex: 0,
        },
      },
    ],
    [
      'source-evidence locator',
      {
        family: 'action_semantic',
        code: 'represented_elsewhere_pointer_unresolved',
        locator: {
          kind: 'source_evidence',
          fieldRole: 'source_evidence',
          pageNumber: 1,
          coverageIndex: 0,
        },
      },
    ],
    [
      'wrong field role',
      {
        family: 'action_semantic',
        code: 'represented_elsewhere_value_mismatch',
        locator: {
          kind: 'page_item',
          collectionRole: 'page_action_semantic_coverage',
          fieldRole: 'reference',
          pageNumber: 1,
          itemIndex: 0,
        },
      },
    ],
    [
      'non-positive page',
      {
        family: 'action_semantic',
        code: 'represented_elsewhere_pointer_out_of_scope',
        locator: {
          kind: 'page_item',
          collectionRole: 'page_action_semantic_coverage',
          fieldRole: 'reference',
          pageNumber: 0,
          itemIndex: 0,
        },
      },
    ],
    [
      'invalid persisted item index',
      {
        family: 'action_semantic',
        code: 'represented_elsewhere_pointer_out_of_scope',
        locator: {
          kind: 'page_item',
          collectionRole: 'page_action_semantic_coverage',
          fieldRole: 'reference',
          pageNumber: 1,
          itemIndex: -1,
        },
      },
    ],
  ])('rejects the %s locator shape fail-closed', (_label, candidate) => {
    expect(
      pageContractRepairAffectedPages({
        draft: draft(),
        diagnosticIssues: [candidate as DraftValidationIssue],
        pointerTemplate: pointerTemplate(),
      }),
    ).toBeNull();
  });

  it('rejects mixed, unsafe, unlocatable, and projection-less sets', () => {
    expect(
      pageContractRepairAffectedPages({
        draft: draft(),
        diagnosticIssues: [
          issue(1),
          representedElsewhereIssue(
            'represented_elsewhere_pointer_unresolved',
            1,
          ),
        ],
        pointerTemplate: pointerTemplate(),
      }),
    ).toBeNull();
    expect(
      pageContractRepairAffectedPages({
        draft: draft(),
        diagnosticIssues: [
          representedElsewhereIssue(
            'represented_elsewhere_pointer_unresolved',
            1,
          ),
          {
            family: 'action_semantic',
            code: 'closed_catalog_capability_gap',
            locator: {
              kind: 'page_item',
              collectionRole: 'page_action_semantic_coverage',
              fieldRole: 'disposition',
              pageNumber: 1,
              itemIndex: 0,
            },
          },
        ],
        pointerTemplate: pointerTemplate(),
      }),
    ).toBeNull();
    expect(
      pageContractRepairAffectedPages({
        draft: draft(),
        diagnosticIssues: [
          representedElsewhereIssue(
            'represented_elsewhere_value_mismatch',
            1,
          ),
        ],
      }),
    ).toBeNull();
    expect(
      pageContractRepairAffectedPages({
        draft: draft(),
        diagnosticIssues: [
          representedElsewhereIssue(
            'represented_elsewhere_value_mismatch',
            3,
          ),
        ],
        pointerTemplate: pointerTemplate(),
      }),
    ).toBeNull();
  });

  it('builds the v5 closed payload without prose, provider, secret, stack, or executable leakage', () => {
    const original = draft();
    Object.assign(original, {
      unrelatedStorySource: 'RAW_STORY_SOURCE_PROSE_SENTINEL',
      providerMaterial: 'PROVIDER_RESPONSE_SENTINEL',
      credential: 'SECRET_CREDENTIAL_SENTINEL',
      stack: 'STACK_TRACE_SENTINEL',
      executable: 'powershell -Command REMOVE_SENTINEL',
    });
    const affected = pageContractRepairAffectedPages({
      draft: original,
      diagnosticIssues: [issue(1)],
    })!;
    const system = buildPageContractRepairSystemPrompt();
    const rawPrompt = buildPageContractRepairUserPrompt({
      affectedPages: affected,
    });
    const encoded = JSON.parse(rawPrompt);
    const parsed = decodePageContractRepairUserPrompt(rawPrompt);
    expect(system).toContain('ONLY');
    expect(encoded.encodingVersion).toBe(
      PAGE_CONTRACT_REPAIR_INPUT_ENCODING_VERSION,
    );
    expect(PAGE_CONTRACT_REPAIR_PROMPT_VERSION).toBe(
      'page-contract-repair-prompt/v5',
    );
    expect(PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION).toBe(
      'page-contract-repair-user-prompt/v5',
    );
    expect(parsed.affectedPages).toHaveLength(1);
    expect(parsed.affectedPages[0].repairTargets).toEqual([
      {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        pageNumber: 1,
      },
    ]);
    expect(parsed.affectedPages[0].permittedPointerValues).toEqual([]);
    expect(parsed.affectedPages[0]).not.toHaveProperty(
      'permittedSpatialReferences',
    );
    expect(parsed).not.toHaveProperty('validatorErrors');
    expect(parsed).not.toHaveProperty('referenceAuthority');
    expect(parsed).not.toHaveProperty('worldType');
    const serialized = JSON.stringify(parsed);
    for (const sentinel of [
      'RAW_STORY_SOURCE_PROSE_SENTINEL',
      'PROVIDER_RESPONSE_SENTINEL',
      'SECRET_CREDENTIAL_SENTINEL',
      'STACK_TRACE_SENTINEL',
      'REMOVE_SENTINEL',
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it('replaces exactly the affected page and never mutates its input', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const affected = pageContractRepairAffectedPages({
      draft: original,
      diagnosticIssues: [issue(2)],
    })!;
    const replacement = page(2);
    replacement.camera = 'corrected portrait shot';
    const result = applyPageContractRepairs({
      draft: original,
      affectedPages: affected,
      pageContracts: [replacement],
    });
    const resultPages = result.pageContracts as unknown[];
    expect(original).toEqual(snapshot);
    expect(resultPages[0]).toEqual(snapshot.pageContracts[0]);
    expect(resultPages[1]).toEqual(replacement);
    expect({ ...result, pageContracts: undefined }).toEqual({
      ...snapshot,
      pageContracts: undefined,
    });
  });

  it.each([
    ['invalid JSON', 'not json', 'page_contract_repair_response_invalid_json'],
    ['wrong root', '{}', 'page_contract_repair_response_invalid_shape'],
    [
      'extra root key',
      '{"pageContracts":[],"extra":true}',
      'page_contract_repair_response_invalid_shape',
    ],
    [
      'invalid page identity',
      '{"pageContracts":[{"pageNumber":0}]}',
      'page_contract_repair_page_invalid',
    ],
  ])('rejects %s fail-closed', (_label, raw, code) => {
    expect(() => parsePageContractRepairs(raw)).toThrow(code);
  });

  it('accepts exact page keys and rejects extra or missing page keys', () => {
    const valid = page(1);
    expect(
      parsePageContractRepairs(
        JSON.stringify({ pageContracts: [valid] }),
      ),
    ).toEqual([valid]);
    expect(() =>
      parsePageContractRepairs(
        JSON.stringify({
          pageContracts: [{ ...valid, unexpected: true }],
        }),
      ),
    ).toThrow('page_contract_repair_page_invalid');
    const { camera: _camera, ...missingCamera } = valid;
    expect(() =>
      parsePageContractRepairs(
        JSON.stringify({ pageContracts: [missingCamera] }),
      ),
    ).toThrow('page_contract_repair_page_invalid');
  });

  it('rejects incomplete, extra, duplicate, and non-unique page sets', () => {
    const original = draft();
    const affected = pageContractRepairAffectedPages({
      draft: original,
      diagnosticIssues: [issue(1), issue(2)],
    })!;
    expect(() =>
      applyPageContractRepairs({
        draft: original,
        affectedPages: affected,
        pageContracts: [page(1)],
      }),
    ).toThrow('page_contract_repair_patch_set_incomplete');
    expect(() =>
      applyPageContractRepairs({
        draft: original,
        affectedPages: [affected[0]!],
        pageContracts: [page(3)],
      }),
    ).toThrow('page_contract_repair_page_unexpected_or_duplicate');
    expect(() =>
      applyPageContractRepairs({
        draft: original,
        affectedPages: [affected[0]!],
        pageContracts: [page(1), page(1)],
      }),
    ).toThrow('page_contract_repair_patch_set_incomplete');
    const duplicated = draft();
    duplicated.pageContracts.push(page(1));
    expect(
      pageContractRepairAffectedPages({
        draft: duplicated,
        diagnosticIssues: [issue(1)],
      }),
    ).toBeNull();
  });
});
