import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import {
  DRAFT_VALIDATION_FAMILIES,
  DRAFT_VALIDATION_ISSUE_CATALOG,
  MAX_DRAFT_VALIDATION_STRUCTURAL_INDEX,
  MAX_PERSISTED_DRAFT_VALIDATION_TRANSITION_ITEMS,
  buildDraftValidationDiagnosticTrail,
  draftValidationAttemptDiagnosticsIsValid,
  draftValidationDiagnosticCodesForIssues,
  draftValidationDiagnosticTrailIsValid,
  draftValidationIssueIsValid,
  draftValidationLocatorIsValid,
  normalizeDraftValidationIssues,
  type DraftValidationIssue,
} from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import {
  InvalidTemplateContractError,
  validateBookVisualContractTemplate,
} from '@/lib/visual-contract-compiler/validateTemplateContract';
import {
  validateBookVisualContract,
} from '@/lib/visual-contract-compiler/validateBookVisualContract';
import {
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

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
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
      'source_phenomenon_binding_mismatch',
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
    ];
    expect(
      hostileValues.every(
        (value) =>
          !draftValidationLocatorIsValid(value) &&
          !draftValidationIssueIsValid(value),
      ),
    ).toBe(true);
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
  it('keeps the closed mechanical producer map exhaustive and rejects a string-only repair error', () => {
    const producerCounts = new Map<string, number>([
      ['compileBookVisualContractTemplate.ts', 16],
      ['contractArtifact.ts', 1],
      ['contractTemplateMigration.ts', 9],
      ['validateTemplateContract.ts', 1],
    ]);
    const compilerDir = path.join(
      process.cwd(),
      'lib/visual-contract-compiler',
    );
    const actual = new Map<string, number>();
    for (const fileName of fs.readdirSync(compilerDir).sort()) {
      if (!fileName.endsWith('.ts')) continue;
      const contents = source(
        `lib/visual-contract-compiler/${fileName}`,
      );
      const count = contents.match(
        /new InvalidTemplateContractError\(/g,
      )?.length ?? 0;
      if (count > 0) actual.set(fileName, count);
    }
    expect(actual).toEqual(producerCounts);

    const templateValidator = source(
      'lib/visual-contract-compiler/validateTemplateContract.ts',
    );
    expect(templateValidator).not.toMatch(
      /diagnosticIssues:\s*readonly DraftValidationIssue\[\]\s*=/,
    );
    expect(() =>
      new (InvalidTemplateContractError as unknown as new (
        errors: string[],
      ) => InvalidTemplateContractError)(['raw prose only']),
    ).toThrow('draft validation diagnostic contract invalid');
  });

  it('emits one valid typed sibling for every base/template/vNext validation error without parsing prose', () => {
    const base = validateBookVisualContract({});
    expect(base.ok).toBe(false);
    if (!base.ok) {
      expect(base.diagnosticIssues).toHaveLength(base.errors.length);
      expect(base.diagnosticIssues.every(draftValidationIssueIsValid)).toBe(
        true,
      );
    }

    const vNext = validateVNextVisualContract({});
    expect(vNext.ok).toBe(false);
    if (!vNext.ok) {
      expect(vNext.diagnosticIssues).toHaveLength(vNext.errors.length);
      expect(vNext.diagnosticIssues.every(draftValidationIssueIsValid)).toBe(
        true,
      );
    }

    const template = validateBookVisualContractTemplate({});
    expect(template.ok).toBe(false);
    if (!template.ok) {
      expect(template.diagnosticIssues).toHaveLength(template.errors.length);
      expect(
        template.diagnosticIssues.every(draftValidationIssueIsValid),
      ).toBe(true);
    }

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
