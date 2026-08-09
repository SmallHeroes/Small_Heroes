import { describe, expect, it } from 'vitest';

import {
  PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
  applyPageContractRepairs,
  buildPageContractRepairSystemPrompt,
  buildPageContractRepairUserPrompt,
  pageContractRepairAffectedPages,
  parsePageContractRepairs,
} from '@/lib/visual-contract-compiler/pageContractRepair';
import type { DraftValidationIssue } from '@/lib/visual-contract-compiler/draftValidationDiagnostics';

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

  it('builds a bounded payload without unrelated draft sections', () => {
    const original = draft();
    const affected = pageContractRepairAffectedPages({
      draft: original,
      diagnosticIssues: [issue(1)],
    })!;
    const system = buildPageContractRepairSystemPrompt();
    const parsed = JSON.parse(
      buildPageContractRepairUserPrompt({
        draft: original,
        affectedPages: affected,
        errors: ['page 1 transition is invalid'],
      }),
    );
    expect(system).toContain('ONLY');
    expect(parsed.affectedPages).toHaveLength(1);
    expect(parsed.validatorErrors).toEqual([
      'page 1 transition is invalid',
    ]);
    expect(parsed.referenceAuthority.zoneIds).toBeUndefined();
    expect(parsed).not.toHaveProperty('worldType');
    expect(JSON.stringify(parsed)).not.toContain('preserved');
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
