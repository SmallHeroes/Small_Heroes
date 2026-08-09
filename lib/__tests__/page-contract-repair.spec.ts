import { describe, expect, it } from 'vitest';

import {
  PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
  PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
  PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION,
  applyPageContractRepairs,
  buildPageContractRepairSystemPrompt,
  buildPageContractRepairUserPrompt,
  pageContractRepairAffectedPages,
  parsePageContractRepairs,
} from '@/lib/visual-contract-compiler/pageContractRepair';
import type { DraftValidationIssue } from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import type { ActionSemanticCoverageTemplate } from '@/lib/visual-contract-compiler/actionSemanticCoverage';

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

  it('builds the v2 closed payload without prose, provider, secret, stack, or executable leakage', () => {
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
    const parsed = JSON.parse(
      buildPageContractRepairUserPrompt({
        affectedPages: affected,
      }),
    );
    expect(system).toContain('ONLY');
    expect(PAGE_CONTRACT_REPAIR_PROMPT_VERSION).toBe(
      'page-contract-repair-prompt/v2',
    );
    expect(PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION).toBe(
      'page-contract-repair-user-prompt/v2',
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
