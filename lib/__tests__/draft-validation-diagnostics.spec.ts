import fs from 'fs';
import path from 'path';
import * as ts from 'typescript';

import { describe, expect, it } from 'vitest';

import {
  DRAFT_VALIDATION_FAMILIES,
  DRAFT_VALIDATION_ISSUE_CATALOG,
  MAX_DRAFT_VALIDATION_STRUCTURAL_INDEX,
  MAX_PERSISTED_DRAFT_VALIDATION_TRANSITION_ITEMS,
  PAGE_FINAL_STRUCTURAL_CAUSES,
  PAGE_TRANSITION_STRUCTURAL_CAUSES,
  buildDraftValidationDiagnosticTrail,
  draftValidationAttemptDiagnosticsIsValid,
  draftValidationDiagnosticCodesForIssues,
  draftValidationDiagnosticTrailIsValid,
  draftValidationIssueIsValid,
  draftValidationLocatorForUntrustedPage,
  draftValidationLocatorIsValid,
  normalizeDraftValidationIssues,
  type DraftValidationIssue,
  type PageFinalStructuralCause,
} from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import {
  InvalidTemplateContractError,
  validateEvidenceOrigin,
  validateBookVisualContractTemplate,
} from '@/lib/visual-contract-compiler/validateTemplateContract';
import {
  InvalidVisualContractError,
  validateBookVisualContract,
} from '@/lib/visual-contract-compiler/validateBookVisualContract';
import {
  InvalidVNextVisualContractError,
  validateVNextVisualContract,
} from '@/lib/visual-contract-compiler/validateVNextVisualContract';
import {
  visualContractDraftValidationEvidenceIsValid,
} from '@/lib/visual-package/visualContractAuthoringLifecycle';

const schemaIssue: DraftValidationIssue = {
  family: 'draft_schema',
  code: 'required_field_missing',
  locator: { kind: 'root', fieldRole: 'schema_version' },
};
const contractIssue: DraftValidationIssue = {
  family: 'draft_contract',
  code: 'coverage_invalid',
  locator: { kind: 'page', fieldRole: 'coverage', pageNumber: 2 },
};
const actionIssue: DraftValidationIssue = {
  family: 'action_semantic',
  code: 'coverage_missing',
  locator: { kind: 'page', fieldRole: 'coverage', pageNumber: 3 },
};
const capabilityGapIssue: DraftValidationIssue = {
  family: 'action_semantic',
  code: 'closed_catalog_capability_gap',
  locator: {
    kind: 'page_item',
    collectionRole: 'page_action_semantic_coverage',
    fieldRole: 'disposition',
    pageNumber: 5,
    itemIndex: 2,
  },
};
const sourceEvidenceIssue: DraftValidationIssue = {
  family: 'source_evidence_id',
  code: 'source_evidence_id_wrong_page',
  locator: {
    kind: 'source_evidence',
    fieldRole: 'source_evidence',
    pageNumber: 4,
    coverageIndex: 0,
  },
};

function pageFinalStructuralIssue(
  causes: readonly PageFinalStructuralCause[],
): DraftValidationIssue {
  return {
    family: 'draft_contract',
    code: 'final_structural_invariant_invalid',
    locator: {
      kind: 'page',
      fieldRole: 'final_structure',
      pageNumber: 7,
    },
    causes,
  };
}

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const REPAIRABLE_ERROR_CLASSES = [
  'ActionSemanticCoverageValidationError',
  'InvalidTemplateContractError',
  'InvalidVisualContractError',
  'InvalidVNextVisualContractError',
] as const;
type RepairableErrorClassName =
  (typeof REPAIRABLE_ERROR_CLASSES)[number];

function repairableProducerCensus(): {
  producers: Record<RepairableErrorClassName, Record<string, number>>;
  constructors: Record<
    RepairableErrorClassName,
    Array<{ name: string; hasInitializer: boolean }>
  >;
} {
  const compilerDir = path.join(
    process.cwd(),
    'lib/visual-contract-compiler',
  );
  const producerMaps = Object.fromEntries(
    REPAIRABLE_ERROR_CLASSES.map((name) => [name, new Map<string, number>()]),
  ) as Record<RepairableErrorClassName, Map<string, number>>;
  const constructors = Object.fromEntries(
    REPAIRABLE_ERROR_CLASSES.map((name) => [name, []]),
  ) as unknown as Record<
    RepairableErrorClassName,
    Array<{ name: string; hasInitializer: boolean }>
  >;
  const classNames = new Set<string>(REPAIRABLE_ERROR_CLASSES);

  for (const fileName of fs.readdirSync(compilerDir).sort()) {
    if (!fileName.endsWith('.ts')) continue;
    const contents = source(`lib/visual-contract-compiler/${fileName}`);
    const sourceFile = ts.createSourceFile(
      fileName,
      contents,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        classNames.has(node.expression.text)
      ) {
        const name = node.expression.text as RepairableErrorClassName;
        producerMaps[name].set(
          fileName,
          (producerMaps[name].get(fileName) ?? 0) + 1,
        );
      }
      if (
        ts.isClassDeclaration(node) &&
        node.name &&
        classNames.has(node.name.text)
      ) {
        const name = node.name.text as RepairableErrorClassName;
        const constructor = node.members.find(ts.isConstructorDeclaration);
        if (constructor) {
          constructors[name] = constructor.parameters.map((parameter) => ({
            name: parameter.name.getText(sourceFile),
            hasInitializer: parameter.initializer !== undefined,
          }));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return {
    producers: Object.fromEntries(
      REPAIRABLE_ERROR_CLASSES.map((name) => [
        name,
        Object.fromEntries(producerMaps[name]),
      ]),
    ) as Record<RepairableErrorClassName, Record<string, number>>,
    constructors,
  };
}

describe('closed draft-validation issue contract', () => {
  it('freezes the exhaustive family/code catalog without an unknown or prose bucket', () => {
    expect(DRAFT_VALIDATION_FAMILIES).toEqual([
      'draft_schema',
      'draft_contract',
      'action_semantic',
      'source_evidence_id',
    ]);
    expect(Object.keys(DRAFT_VALIDATION_ISSUE_CATALOG)).toEqual(
      DRAFT_VALIDATION_FAMILIES,
    );
    expect(Object.keys(DRAFT_VALIDATION_ISSUE_CATALOG.draft_schema)).toEqual([
      'required_field_missing',
      'value_type_invalid',
      'value_domain_invalid',
      'array_shape_invalid',
      'array_member_invalid',
      'schema_version_invalid',
      'binding_shape_invalid',
      'binding_mode_invalid',
      'binding_origin_invalid',
      'binding_mode_origin_incoherent',
      'binding_value_required',
      'binding_value_forbidden',
      'binding_value_placeholder',
    ]);
    expect(Object.keys(DRAFT_VALIDATION_ISSUE_CATALOG.draft_contract)).toEqual([
      'topology_empty',
      'topology_malformed',
      'duplicate_identity',
      'unresolved_reference',
      'ambiguous_reference',
      'out_of_scope_reference',
      'relation_arity_invalid',
      'coverage_invalid',
      'cardinality_invalid',
      'world_type_missing',
      'cover_projection_invalid',
      'cover_source_fidelity_invalid',
      'cast_authority_mismatch',
      'fact_authority_mismatch',
      'source_evidence_phrase_invalid',
      'lifecycle_invariant_invalid',
      'consumer_invariant_invalid',
      'continuity_authority_invalid',
      'final_structural_invariant_invalid',
    ]);
    expect(Object.keys(DRAFT_VALIDATION_ISSUE_CATALOG.action_semantic)).toEqual([
      'coverage_missing',
      'beat_identity_missing',
      'beat_identity_out_of_scope',
      'beat_identity_duplicate',
      'disposition_kind_invalid',
      'disposition_reason_invalid',
      'disposition_payload_invalid',
      'action_binding_missing',
      'action_binding_cardinality_invalid',
      'represented_elsewhere_pointer_out_of_scope',
      'represented_elsewhere_pointer_unresolved',
      'represented_elsewhere_value_mismatch',
      'presentation_requirement_pointer_out_of_scope',
      'presentation_requirement_pointer_unresolved',
      'presentation_requirement_value_mismatch',
      'source_phenomenon_binding_mismatch',
      'closed_catalog_capability_gap',
    ]);
    expect(
      Object.keys(DRAFT_VALIDATION_ISSUE_CATALOG.source_evidence_id),
    ).toEqual([
      'source_evidence_id_malformed',
      'source_evidence_id_unknown',
      'source_evidence_id_wrong_page',
    ]);
    const allCodes = Object.values(DRAFT_VALIDATION_ISSUE_CATALOG)
      .flatMap((catalog) => Object.keys(catalog));
    expect(
      allCodes.filter((code) => /unknown/i.test(code)),
    ).toEqual(['source_evidence_id_unknown']);
    expect(allCodes.some((code) => /other|fallback/i.test(code))).toBe(
      false,
    );
  });

  it('accepts only exact enum/integer locators and rejects hostile authored-shaped keys or values', () => {
    expect([
      schemaIssue,
      contractIssue,
      actionIssue,
      sourceEvidenceIssue,
    ].every(draftValidationIssueIsValid)).toBe(true);
    expect(
      draftValidationLocatorIsValid({
        kind: 'page_item',
        collectionRole: 'page_actions',
        fieldRole: 'action_binding',
        pageNumber: 1,
        itemIndex: MAX_DRAFT_VALIDATION_STRUCTURAL_INDEX,
      }),
    ).toBe(true);

    const hostileValues: unknown[] = [
      { kind: 'page', fieldRole: 'coverage', pageNumber: 0 },
      { kind: 'page', fieldRole: 'coverage', pageNumber: '1' },
      {
        kind: 'collection_item',
        collectionRole: 'zones',
        fieldRole: 'topology',
        itemIndex: MAX_DRAFT_VALIDATION_STRUCTURAL_INDEX + 1,
      },
      {
        kind: 'root',
        fieldRole: 'root',
        path: 'C:\\credentials\\provider-key.txt',
      },
      {
        kind: 'root',
        fieldRole: 'DROP_TABLE_סוד',
      },
      {
        family: 'draft_contract',
        code: 'provider_stack_or_secret',
        locator: { kind: 'root', fieldRole: 'root' },
      },
      {
        family: 'source_evidence_id',
        code: 'source_evidence_id_unknown',
        locator: { kind: 'root', fieldRole: 'source_evidence' },
      },
      {
        family: 'source_evidence_id',
        code: 'source_evidence_id_unknown',
        locator: {
          kind: 'collection_item',
          collectionRole: 'locations',
          fieldRole: 'name',
          itemIndex: 0,
        },
      },
    ];
    expect(
      hostileValues.every(
        (value) =>
          !draftValidationLocatorIsValid(value) &&
          !draftValidationIssueIsValid(value),
      ),
    ).toBe(true);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['string', '1'],
    ['missing', undefined],
  ])(
    'uses a closed collection-item fallback for an unusable $0 page without retaining it',
    (_label, pageNumber) => {
      const pageLocator = draftValidationLocatorForUntrustedPage({
        positiveKind: 'page',
        pageNumber,
        fieldRole: 'cast_presence',
        fallbackCollectionRole: 'page_contracts',
        itemIndex: 4,
      });
      const sourceEvidenceLocator =
        draftValidationLocatorForUntrustedPage({
          positiveKind: 'source_evidence',
          pageNumber,
          fieldRole: 'source_evidence',
          fallbackCollectionRole: 'page_action_semantic_coverage',
          itemIndex: 2,
        });
      expect(pageLocator).toEqual({
        kind: 'collection_item',
        collectionRole: 'page_contracts',
        fieldRole: 'cast_presence',
        itemIndex: 4,
      });
      expect(sourceEvidenceLocator).toEqual({
        kind: 'collection_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole: 'source_evidence',
        itemIndex: 2,
      });
      expect(JSON.stringify([pageLocator, sourceEvidenceLocator])).not.toContain(
        'pageNumber',
      );
      expect(
        draftValidationIssueIsValid({
          family: 'source_evidence_id',
          code: 'source_evidence_id_unknown',
          locator: sourceEvidenceLocator,
        }),
      ).toBe(true);
    },
  );

  it('retains a safe positive page and degrades an unusable structural index to the closed collection root', () => {
    expect(
      draftValidationLocatorForUntrustedPage({
        positiveKind: 'page',
        pageNumber: 1,
        fieldRole: 'identity',
        fallbackCollectionRole: 'page_contracts',
        itemIndex: 0,
      }),
    ).toEqual({
      kind: 'page',
      fieldRole: 'identity',
      pageNumber: 1,
    });
    expect(
      draftValidationLocatorForUntrustedPage({
        positiveKind: 'source_evidence',
        pageNumber: 1,
        fieldRole: 'source_evidence',
        fallbackCollectionRole: 'page_action_semantic_coverage',
        itemIndex: 3,
      }),
    ).toEqual({
      kind: 'source_evidence',
      fieldRole: 'source_evidence',
      pageNumber: 1,
      coverageIndex: 3,
    });
    expect(
      draftValidationLocatorForUntrustedPage({
        positiveKind: 'page',
        pageNumber: 0,
        fieldRole: 'identity',
        fallbackCollectionRole: 'page_contracts',
        itemIndex: MAX_DRAFT_VALIDATION_STRUCTURAL_INDEX + 1,
      }),
    ).toEqual({
      kind: 'collection',
      collectionRole: 'page_contracts',
      fieldRole: 'identity',
    });
  });

  it('normalizes and deduplicates by family + code + canonical locator independent of emission/key order', () => {
    const reordered = {
      locator: {
        pageNumber: 2,
        fieldRole: 'coverage',
        kind: 'page',
      },
      code: 'coverage_invalid',
      family: 'draft_contract',
    } as DraftValidationIssue;
    const first = normalizeDraftValidationIssues([
      actionIssue,
      reordered,
      contractIssue,
      schemaIssue,
    ]);
    const second = normalizeDraftValidationIssues([
      schemaIssue,
      contractIssue,
      actionIssue,
    ]);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(draftValidationDiagnosticCodesForIssues(first)).toEqual([
      'action_semantic_validation_failed',
      'draft_contract_validation_failed',
      'draft_schema_validation_failed',
    ]);
  });

  it('unions closed page structural causes without changing issue identity or transition counts', () => {
    expect(PAGE_FINAL_STRUCTURAL_CAUSES).toEqual([
      'page_spatial_binding_invalid',
      'page_steering_invalid',
      'page_character_presence_invalid',
      'page_prop_state_invalid',
      'page_cast_state_invalid',
      'page_prop_constraints_invalid',
      'page_action_requirements_invalid',
      'page_safety_constraints_invalid',
      'page_action_constraint_conflict_invalid',
      'page_action_check_id_collision_invalid',
      'page_prop_check_id_collision_invalid',
      'page_safety_check_id_collision_invalid',
      'page_projection_containment_invalid',
      'page_cast_binding_invalid',
      'page_human_presence_binding_invalid',
      'page_transition_invalid',
      ...PAGE_TRANSITION_STRUCTURAL_CAUSES,
    ]);
    const steering = pageFinalStructuralIssue(['page_steering_invalid']);
    const spatial = pageFinalStructuralIssue([
      'page_spatial_binding_invalid',
    ]);
    const normalized = normalizeDraftValidationIssues([
      steering,
      spatial,
      steering,
    ]);
    expect(normalized).toEqual([
      pageFinalStructuralIssue([
        'page_spatial_binding_invalid',
        'page_steering_invalid',
      ]),
    ]);

    const trail = buildDraftValidationDiagnosticTrail([
      [steering, spatial],
      [pageFinalStructuralIssue(['page_transition_invalid'])],
    ]);
    expect(trail[0]).toMatchObject({
      version: 'draft-validation-attempt-diagnostics/v5',
      emittedCount: 2,
      currentUniqueCount: 1,
      newlyIntroducedCount: 1,
    });
    expect(trail[1]).toMatchObject({
      emittedCount: 1,
      currentUniqueCount: 1,
      newlyIntroducedCount: 0,
      persistentCount: 1,
      resolvedCount: 0,
      items: [
        {
          state: 'persistent',
          issue: pageFinalStructuralIssue(['page_transition_invalid']),
        },
      ],
    });
  });

  it('keeps every closed page structural cause backed by a validator producer', () => {
    const producedCauses = new Set<string>();
    for (const relativePath of [
      'lib/visual-contract-compiler/validateBookVisualContract.ts',
      'lib/visual-contract-compiler/validateVNextVisualContract.ts',
      'lib/visual-contract-compiler/transitionAnalysis.ts',
    ]) {
      const sourceFile = ts.createSourceFile(
        relativePath,
        source(relativePath),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'pageFinalStructuralIssue' &&
          node.arguments.length === 3 &&
          ts.isStringLiteral(node.arguments[2])
        ) {
          producedCauses.add(node.arguments[2].text);
        }
        if (
          relativePath.endsWith('transitionAnalysis.ts') &&
          ts.isPropertyAssignment(node) &&
          ((ts.isIdentifier(node.name) && node.name.text === 'cause') ||
            (ts.isStringLiteral(node.name) && node.name.text === 'cause')) &&
          ts.isStringLiteral(node.initializer)
        ) {
          producedCauses.add(node.initializer.text);
        }
        if (
          relativePath.endsWith('validateVNextVisualContract.ts') &&
          ts.isStringLiteral(node) &&
          node.text === 'page_transition_invalid'
        ) {
          producedCauses.add(node.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    expect([...producedCauses].sort()).toEqual(
      [...PAGE_FINAL_STRUCTURAL_CAUSES].sort(),
    );
  });

  it('requires canonical closed causes only on page-scoped final structural issues', () => {
    const valid = pageFinalStructuralIssue([
      'page_spatial_binding_invalid',
      'page_steering_invalid',
    ]);
    expect(draftValidationIssueIsValid(valid)).toBe(true);
    expect(
      draftValidationIssueIsValid(
        pageFinalStructuralIssue(['page_transition_invalid']),
      ),
    ).toBe(true);
    expect(
      draftValidationIssueIsValid(
        pageFinalStructuralIssue([
          'page_transition_no_move_zone_changed',
        ]),
      ),
    ).toBe(false);
    expect(
      draftValidationIssueIsValid(
        pageFinalStructuralIssue([
          'page_transition_invalid',
          'page_transition_no_move_zone_changed',
        ].sort() as PageFinalStructuralCause[]),
      ),
    ).toBe(true);

    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        delete value.causes;
      },
      (value) => {
        value.causes = [];
      },
      (value) => {
        value.causes = [
          'page_steering_invalid',
          'page_spatial_binding_invalid',
        ];
      },
      (value) => {
        value.causes = [
          'page_spatial_binding_invalid',
          'page_spatial_binding_invalid',
        ];
      },
      (value) => {
        value.causes = ['raw_provider_error'];
      },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(valid) as unknown as Record<
        string,
        unknown
      >;
      mutate(candidate);
      expect(draftValidationIssueIsValid(candidate)).toBe(false);
    }

    expect(
      draftValidationIssueIsValid({
        ...contractIssue,
        causes: ['page_steering_invalid'],
      }),
    ).toBe(false);
    expect(
      draftValidationIssueIsValid({
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        locator: {
          kind: 'collection_item',
          collectionRole: 'page_contracts',
          fieldRole: 'final_structure',
          itemIndex: 0,
        },
      }),
    ).toBe(true);
  });
});

describe('canonical per-attempt transitions', () => {
  it('records initial, new, persistent, resolved, and final state in chronological attempt order', () => {
    const trail = buildDraftValidationDiagnosticTrail([
      [contractIssue, schemaIssue, contractIssue],
      [sourceEvidenceIssue, contractIssue],
      [contractIssue, actionIssue],
    ]);

    expect(trail).toHaveLength(3);
    expect(trail[0]).toMatchObject({
      emittedCount: 3,
      currentUniqueCount: 2,
      newlyIntroducedCount: 2,
      persistentCount: 0,
      resolvedCount: 0,
      finalAttempt: false,
      truncated: false,
    });
    expect(trail[1]).toMatchObject({
      emittedCount: 2,
      currentUniqueCount: 2,
      newlyIntroducedCount: 1,
      persistentCount: 1,
      resolvedCount: 1,
      finalAttempt: false,
    });
    expect(trail[2]).toMatchObject({
      emittedCount: 2,
      currentUniqueCount: 2,
      newlyIntroducedCount: 1,
      persistentCount: 1,
      resolvedCount: 1,
      finalAttempt: true,
    });
    expect(draftValidationDiagnosticTrailIsValid(trail)).toBe(true);
  });

  it('marks a repaired success as a zero-current final attempt that resolves the preceding set', () => {
    const trail = buildDraftValidationDiagnosticTrail([
      [schemaIssue, contractIssue],
      [],
    ]);
    expect(trail[1]).toMatchObject({
      emittedCount: 0,
      currentUniqueCount: 0,
      newlyIntroducedCount: 0,
      persistentCount: 0,
      resolvedCount: 2,
      finalAttempt: true,
      truncated: false,
    });
    expect(
      trail[1]?.items.every((item) => item.state === 'resolved'),
    ).toBe(true);
  });

  it('caps persisted items at 128 while retaining complete truthful counts and truncation', () => {
    const emitted = Array.from(
      { length: MAX_PERSISTED_DRAFT_VALIDATION_TRANSITION_ITEMS + 1 },
      (_, index): DraftValidationIssue => ({
        family: 'draft_contract',
        code: 'coverage_invalid',
        locator: {
          kind: 'page',
          fieldRole: 'coverage',
          pageNumber: index + 1,
        },
      }),
    );
    const [attempt] = buildDraftValidationDiagnosticTrail([emitted]);
    expect(attempt).toMatchObject({
      emittedCount: 129,
      currentUniqueCount: 129,
      newlyIntroducedCount: 129,
      persistentCount: 0,
      resolvedCount: 0,
      truncated: true,
    });
    expect(attempt?.items).toHaveLength(128);
    expect(draftValidationAttemptDiagnosticsIsValid(attempt)).toBe(true);
  });

  it('normalizes duplicate capability gaps and rejects structural or envelope tampering', () => {
    const [attempt] = buildDraftValidationDiagnosticTrail([
      [capabilityGapIssue, capabilityGapIssue],
    ]);
    expect(attempt).toMatchObject({
      emittedCount: 2,
      currentUniqueCount: 1,
      newlyIntroducedCount: 1,
      items: [
        {
          state: 'newly_introduced',
          issue: capabilityGapIssue,
        },
      ],
      finalAttempt: true,
      truncated: false,
    });
    expect(draftValidationAttemptDiagnosticsIsValid(attempt)).toBe(true);

    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        const items = value.items as Array<Record<string, unknown>>;
        const issue = items[0]!.issue as Record<string, unknown>;
        issue.code = 'open_ended_capability_gap';
      },
      (value) => {
        const items = value.items as Array<Record<string, unknown>>;
        const issue = items[0]!.issue as Record<string, unknown>;
        const locator = issue.locator as Record<string, unknown>;
        locator.pageNumber = 0;
      },
      (value) => {
        const items = value.items as Array<Record<string, unknown>>;
        const issue = items[0]!.issue as Record<string, unknown>;
        const locator = issue.locator as Record<string, unknown>;
        locator.itemIndex = -1;
      },
      (value) => {
        const items = value.items as Array<Record<string, unknown>>;
        const issue = items[0]!.issue as Record<string, unknown>;
        const locator = issue.locator as Record<string, unknown>;
        locator.fieldRole = 'raw_provider_field';
      },
      (value) => {
        value.currentUniqueCount = 2;
      },
      (value) => {
        value.truncated = true;
      },
      (value) => {
        value.version = 'draft-validation-attempt-diagnostics/v4';
      },
      (value) => {
        value.version = 'draft-validation-attempt-diagnostics/v3';
      },
      (value) => {
        value.version = 'draft-validation-attempt-diagnostics/v2';
      },
      (value) => {
        value.version = 'draft-validation-attempt-diagnostics/v1';
      },
      (value) => {
        value.rawProviderMessage = 'must-not-be-accepted';
      },
      (value) => {
        delete value.items;
      },
    ];
    for (const mutate of mutations) {
      const forged = structuredClone(
        attempt,
      ) as unknown as Record<string, unknown>;
      mutate(forged);
      expect(
        draftValidationAttemptDiagnosticsIsValid(forged),
      ).toBe(false);
    }
  });

  it('rejects extra keys, noncanonical ordering, false counts, and invalid status/trail combinations', () => {
    const trail = buildDraftValidationDiagnosticTrail([
      [schemaIssue, contractIssue],
    ]);
    const extraKey = {
      ...structuredClone(trail[0]),
      rawError: 'provider stack and secret',
    };
    expect(draftValidationAttemptDiagnosticsIsValid(extraKey)).toBe(false);

    const falseCount = structuredClone(trail[0]!);
    falseCount.currentUniqueCount += 1;
    expect(draftValidationAttemptDiagnosticsIsValid(falseCount)).toBe(false);

    const reversed = structuredClone(trail[0]!);
    reversed.items = [...reversed.items].reverse();
    expect(draftValidationAttemptDiagnosticsIsValid(reversed)).toBe(false);

    expect(
      visualContractDraftValidationEvidenceIsValid({
        status: 'completed',
        attempts: [trail[0], null],
      }),
    ).toBe(false);
    expect(
      visualContractDraftValidationEvidenceIsValid({
        status: 'repair_exhausted',
        attempts: [trail[0]],
        rawDraft: { secret: true },
      }),
    ).toBe(false);
  });
});

describe('repairable producer census and typed-only boundary', () => {
  it('keeps the AST-based producer map exhaustive and every typed parameter required', () => {
    const census = repairableProducerCensus();
    expect(census.producers).toEqual({
      ActionSemanticCoverageValidationError: {},
      InvalidTemplateContractError: {
        'compileBookVisualContractTemplate.ts': 14,
        'contractArtifact.ts': 1,
        'contractTemplateMigration.ts': 11,
        'validateTemplateContract.ts': 1,
      },
      InvalidVisualContractError: {
        'compileBookVisualContract.ts': 3,
        'contractRenderGuards.ts': 2,
        'validateBookVisualContract.ts': 1,
      },
      InvalidVNextVisualContractError: {
        'validateVNextVisualContract.ts': 1,
      },
    });
    expect(census.constructors).toEqual({
      ActionSemanticCoverageValidationError: [
        { name: 'errors', hasInitializer: false },
        { name: 'diagnosticIssues', hasInitializer: false },
        { name: 'pointerTemplate', hasInitializer: false },
        {
          name: 'sourceEvidenceAffectedRecords',
          hasInitializer: false,
        },
      ],
      InvalidTemplateContractError: [
        { name: 'errors', hasInitializer: false },
        { name: 'diagnosticIssues', hasInitializer: false },
      ],
      InvalidVisualContractError: [
        { name: 'errors', hasInitializer: false },
        { name: 'diagnosticIssues', hasInitializer: false },
      ],
      InvalidVNextVisualContractError: [
        { name: 'errors', hasInitializer: false },
        { name: 'diagnosticIssues', hasInitializer: false },
      ],
    });

    for (const ErrorClass of [
      InvalidTemplateContractError,
      InvalidVisualContractError,
      InvalidVNextVisualContractError,
    ]) {
      expect(() =>
        new (ErrorClass as unknown as new (
          errors: string[],
        ) => Error)(['raw prose only']),
      ).toThrow('draft validation diagnostic contract invalid');
    }
  });

  it('gives every repairable rejection a non-empty valid typed sibling without requiring one issue per prose error', () => {
    const base = validateBookVisualContract({});
    expect(base.ok).toBe(false);
    if (!base.ok) {
      expect(base.diagnosticIssues.length).toBeGreaterThan(0);
      expect(base.diagnosticIssues.every(draftValidationIssueIsValid)).toBe(
        true,
      );
    }

    const vNext = validateVNextVisualContract({});
    expect(vNext.ok).toBe(false);
    if (!vNext.ok) {
      expect(vNext.diagnosticIssues.length).toBeGreaterThan(0);
      expect(vNext.diagnosticIssues.every(draftValidationIssueIsValid)).toBe(
        true,
      );
    }

    const template = validateBookVisualContractTemplate({});
    expect(template.ok).toBe(false);
    if (!template.ok) {
      expect(template.diagnosticIssues.length).toBeGreaterThan(0);
      expect(
        template.diagnosticIssues.every(draftValidationIssueIsValid),
      ).toBe(true);
    }

    const originErrors: string[] = [];
    const originIssues: DraftValidationIssue[] = [];
    expect(
      validateEvidenceOrigin(
        'fixture.binding',
        { kind: 'policy_default' },
        originErrors,
        originIssues,
      ),
    ).toBe('policy_default');
    expect(originErrors).toEqual([
      'fixture.binding.origin(policy_default).policyId missing',
      'fixture.binding.origin(policy_default).version missing',
    ]);
    expect(originIssues).toEqual([
      {
        family: 'draft_schema',
        code: 'binding_origin_invalid',
        locator: { kind: 'root', fieldRole: 'binding_origin' },
      },
    ]);
    expect(originIssues.every(draftValidationIssueIsValid)).toBe(true);

    const lifecycle = source(
      'lib/visual-package/visualContractAuthoringLifecycle.ts',
    );
    expect(lifecycle).not.toMatch(
      /error\.attempts\.flatMap\([\s\S]{0,120}?\.errors/,
    );
    expect(lifecycle).not.toContain('diagnosticCodeFor(');
  });

  it('serializes only the closed issue identity and safe structural locator', () => {
    const hostile = [
      'AUTHORED_NAME_Guy',
      'source phrase with a secret',
      'C:\\Users\\operator\\.env',
      'sk-provider-secret',
      'Error: provider failed\n    at private.ts:99',
      'response_raw_payload',
    ];
    const serialized = JSON.stringify(
      buildDraftValidationDiagnosticTrail([
        [schemaIssue, contractIssue, actionIssue, sourceEvidenceIssue],
      ]),
    );
    for (const forbidden of hostile) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).toMatch(
      /draft_schema|draft_contract|action_semantic|source_evidence_id/,
    );
  });
});
