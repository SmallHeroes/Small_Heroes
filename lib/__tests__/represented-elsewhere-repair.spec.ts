import { describe, expect, it } from 'vitest';

import { canonicalize } from '@/lib/canonical-json';
import type { ActionSemanticCoverageTemplate } from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import type { DraftValidationIssue } from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import {
  REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA,
  REPRESENTED_ELSEWHERE_REPAIR_PROMPT_VERSION,
  REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_DIGEST,
  REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_NAME,
  REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_VERSION,
  REPRESENTED_ELSEWHERE_REPAIR_SYSTEM_PROMPT_DIGEST,
  REPRESENTED_ELSEWHERE_REPAIR_USER_PROMPT_VERSION,
  RepresentedElsewhereRepairTargetAssociationError,
  applyRepresentedElsewhereRepairPatches,
  buildRepresentedElsewhereRepairSystemPrompt,
  buildRepresentedElsewhereRepairUserPrompt,
  decodeRepresentedElsewhereRepairUserPrompt,
  parseRepresentedElsewhereRepairPatches,
  representedElsewhereRepairAuthority,
  type RepresentedElsewhereRepairAuthority,
  type RepresentedElsewhereRepairPatch,
} from '@/lib/visual-contract-compiler/representedElsewhereRepair';
import type { SourceEvidenceCatalog } from '@/lib/visual-contract-compiler/sourceEvidenceCatalog';
import { assertOpenAIResponsesStructuredOutputSchemaCompatible } from '@/lib/visual-package/openaiResponsesStructuredOutputSchemaCompatibility';

const SOURCE_A = `se1_${'a'.repeat(64)}`;
const SOURCE_B = `se1_${'b'.repeat(64)}`;
const SOURCE_C = `se1_${'c'.repeat(64)}`;

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function pointerTemplate(): ActionSemanticCoverageTemplate {
  return {
    pageContracts: [
      {
        pageNumber: 6,
        locationId: 'loc:home',
        zoneId: 'zone:bedroom',
        mustShow: [
          'the green satchel rests beside Kim',
          'Bar holds the folded map',
        ],
        camera: 'close portrait',
        actionRequirements: [],
      },
    ],
  } as unknown as ActionSemanticCoverageTemplate;
}

function draft(): Record<string, unknown> {
  return {
    worldType: 'grounded',
    coverContract: { marker: 'must remain byte-identical' },
    pageContracts: [
      {
        pageNumber: 6,
        locationId: 'loc:home',
        zoneId: 'zone:bedroom',
        mustShow: [
          'the green satchel rests beside Kim',
          'Bar holds the folded map',
        ],
        camera: 'close portrait',
        actionSemanticCoverage: [
          {
            beatId: 'beat:p6:kim_satchel',
            sourceEvidenceId: SOURCE_A,
            disposition: {
              kind: 'represented_elsewhere',
              contractPointer: '/pageContracts/9/mustShow/0',
              contractValue: 'stale satchel',
            },
          },
          {
            beatId: 'beat:p6:bar_map',
            sourceEvidenceId: SOURCE_B,
            disposition: {
              kind: 'represented_elsewhere',
              contractPointer: '/pageContracts/9/mustShow/1',
              contractValue: 'stale map',
            },
          },
          {
            beatId: 'beat:p6:quiet_pause',
            sourceEvidenceId: SOURCE_C,
            disposition: {
              kind: 'non_visual',
              rationale: 'internal_state',
            },
          },
        ],
      },
    ],
  };
}

function catalog(): SourceEvidenceCatalog {
  return {
    version: 'source-evidence-catalog/v1',
    sourceAuthority: {
      storyKey: 'chameleon_koko_bedtime',
      sourceIdentityDigest: '1'.repeat(64),
      normalizedSourceDigest: '2'.repeat(64),
      pageCount: 8,
      pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
    },
    entries: [
      {
        sourceEvidenceId: SOURCE_A,
        pageNumber: 6,
        excerptOrdinal: 1,
        startOffsetUtf16: 0,
        endOffsetUtf16: 15,
        startOffsetUtf8: 0,
        endOffsetUtf8: 15,
        excerpt: 'Kim finds a clue.',
      },
      {
        sourceEvidenceId: SOURCE_B,
        pageNumber: 6,
        excerptOrdinal: 2,
        startOffsetUtf16: 16,
        endOffsetUtf16: 31,
        startOffsetUtf8: 16,
        endOffsetUtf8: 31,
        excerpt: 'Bar opens the map.',
      },
      {
        sourceEvidenceId: SOURCE_C,
        pageNumber: 6,
        excerptOrdinal: 3,
        startOffsetUtf16: 32,
        endOffsetUtf16: 47,
        startOffsetUtf8: 32,
        endOffsetUtf8: 47,
        excerpt: 'They feel hopeful.',
      },
    ],
    digestAlgorithm: 'canonical-json-sha256',
    digest: '3'.repeat(64),
  };
}

function issue(
  itemIndex: number,
  code:
    | 'represented_elsewhere_pointer_out_of_scope'
    | 'represented_elsewhere_pointer_unresolved'
    | 'represented_elsewhere_value_mismatch' =
    'represented_elsewhere_pointer_out_of_scope',
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
      pageNumber: 6,
      itemIndex,
    },
  };
}

function authority(): RepresentedElsewhereRepairAuthority {
  const value = representedElsewhereRepairAuthority({
    draft: draft(),
    diagnosticIssues: [issue(0), issue(1)],
    pointerTemplate: pointerTemplate(),
    sourceEvidenceCatalog: catalog(),
  });
  if (!value) throw new Error('expected represented-elsewhere authority');
  return value;
}

function patchFor(
  targetIndex: number,
  pointerChoiceIndex: number,
): RepresentedElsewhereRepairPatch {
  const target = authority().pages[0]!.targets[targetIndex]!;
  return {
    pageNumber: target.pageNumber,
    coverageIndex: target.coverageIndex,
    beatId: target.beatId,
    sourceEvidenceId: target.sourceEvidenceId,
    pointerChoiceIndex,
  };
}

function dispositionAt(
  value: Record<string, unknown>,
  coverageIndex: number,
): Record<string, unknown> {
  const page = (value.pageContracts as Array<Record<string, unknown>>)[0]!;
  const coverage = page.actionSemanticCoverage as Array<
    Record<string, unknown>
  >;
  return coverage[coverageIndex]!.disposition as Record<string, unknown>;
}

function masked(value: Record<string, unknown>): string {
  const clone = structuredClone(value);
  const page = (clone.pageContracts as Array<Record<string, unknown>>)[0]!;
  const coverage = page.actionSemanticCoverage as Array<
    Record<string, unknown>
  >;
  coverage[0]!.disposition = '__target__';
  coverage[1]!.disposition = '__target__';
  return canonicalJson(clone);
}

describe('represented-elsewhere narrow repair', () => {
  it('publishes a strict Responses-compatible v1 schema with no raw pointer/value output', () => {
    expect(REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_NAME).toBe(
      'RepresentedElsewhereRepairPatches',
    );
    expect(REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_VERSION).toBe(
      'represented-elsewhere-repair-schema/v1',
    );
    expect(REPRESENTED_ELSEWHERE_REPAIR_PROMPT_VERSION).toBe(
      'represented-elsewhere-repair-prompt/v1',
    );
    expect(REPRESENTED_ELSEWHERE_REPAIR_USER_PROMPT_VERSION).toBe(
      'represented-elsewhere-repair-user-prompt/v1',
    );
    expect(REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_DIGEST).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(REPRESENTED_ELSEWHERE_REPAIR_SYSTEM_PROMPT_DIGEST).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(
      assertOpenAIResponsesStructuredOutputSchemaCompatible(
        REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA,
      ).status,
    ).toBe('compatible');
    expect(JSON.stringify(REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA)).not
      .toContain('contractPointer');
    expect(JSON.stringify(REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA)).not
      .toContain('contractValue');
    expect(buildRepresentedElsewhereRepairSystemPrompt()).toContain(
      'page-level choice domain',
    );
  });

  it('keeps two same-page same-code targets distinct under one ordered page domain', () => {
    const value = authority();
    expect(value.pages).toHaveLength(1);
    expect(value.pages[0]!.targets).toEqual([
      expect.objectContaining({
        pageNumber: 6,
        coverageIndex: 0,
        beatId: 'beat:p6:kim_satchel',
        sourceEvidenceId: SOURCE_A,
        sourcePhrase: 'Kim finds a clue.',
        failureCode: 'represented_elsewhere_pointer_out_of_scope',
      }),
      expect.objectContaining({
        pageNumber: 6,
        coverageIndex: 1,
        beatId: 'beat:p6:bar_map',
        sourceEvidenceId: SOURCE_B,
        sourcePhrase: 'Bar opens the map.',
        failureCode: 'represented_elsewhere_pointer_out_of_scope',
      }),
    ]);
    expect(value.pages[0]!.permittedPointerValues.length).toBeGreaterThan(1);
    const userPrompt = buildRepresentedElsewhereRepairUserPrompt({
      authority: value,
    });
    expect(decodeRepresentedElsewhereRepairUserPrompt(userPrompt)).toEqual(
      value,
    );
    expect(userPrompt).not.toContain('worldType');
    expect(userPrompt).not.toContain('coverContract');
  });

  it('maps adjacent global diagnostic indices through canonical page order to distinct local targets', () => {
    const value = draft();
    const pageSix = (
      value.pageContracts as Array<Record<string, unknown>>
    )[0]!;
    const precedingCoverage = Array.from({ length: 14 }, (_, index) => ({
      beatId: `beat:p2:preceding_${index}`,
      sourceEvidenceId: `se1_${String(index).padStart(64, '0')}`,
      disposition: {
        kind: 'non_visual',
        rationale: 'narrative_context',
      },
    }));
    const pageTwo = {
      pageNumber: 2,
      locationId: 'loc:home',
      zoneId: 'zone:hall',
      actionSemanticCoverage: precedingCoverage,
    };
    // Draft order is deliberately not used as the global-index authority.
    value.pageContracts = [pageSix, pageTwo];
    const template = pointerTemplate() as unknown as {
      pageContracts: Array<Record<string, unknown>>;
    };
    template.pageContracts = [
      {
        pageNumber: 2,
        locationId: 'loc:home',
        zoneId: 'zone:hall',
        actionRequirements: [],
      },
      template.pageContracts[0]!,
    ];
    const mapped = representedElsewhereRepairAuthority({
      draft: value,
      diagnosticIssues: [issue(14), issue(15)],
      pointerTemplate: template as ActionSemanticCoverageTemplate,
      sourceEvidenceCatalog: catalog(),
    });
    expect(mapped?.pages[0]!.targets).toEqual([
      expect.objectContaining({
        pageNumber: 6,
        coverageIndex: 0,
        beatId: 'beat:p6:kim_satchel',
      }),
      expect.objectContaining({
        pageNumber: 6,
        coverageIndex: 1,
        beatId: 'beat:p6:bar_map',
      }),
    ]);
    expect(
      representedElsewhereRepairAuthority({
        draft: value,
        diagnosticIssues: [issue(0)],
        pointerTemplate: template as ActionSemanticCoverageTemplate,
        sourceEvidenceCatalog: catalog(),
      }),
    ).toBeNull();
    if (!mapped) throw new Error('expected globally rebound authority');
    const patches = [...mapped.pages[0]!.targets]
      .reverse()
      .map((target, index) => ({
        pageNumber: target.pageNumber,
        coverageIndex: target.coverageIndex,
        beatId: target.beatId,
        sourceEvidenceId: target.sourceEvidenceId,
        pointerChoiceIndex: index,
      }));
    const repaired = applyRepresentedElsewhereRepairPatches({
      draft: value,
      authority: mapped,
      patches,
      pointerTemplate: template as ActionSemanticCoverageTemplate,
    });
    expect(dispositionAt(repaired, 0).kind).toBe('represented_elsewhere');
    expect(dispositionAt(repaired, 1).kind).toBe('represented_elsewhere');
  });

  it('parses exact-key output and applies an order-independent exact patch set locally', () => {
    const value = draft();
    const auth = authority();
    const firstChoice = auth.pages[0]!.permittedPointerValues.findIndex(
      (candidate) => candidate.contractValue === 'loc:home',
    );
    const secondChoice = auth.pages[0]!.permittedPointerValues.findIndex(
      (candidate) => candidate.contractValue === 'zone:bedroom',
    );
    expect(firstChoice).toBeGreaterThanOrEqual(0);
    expect(secondChoice).toBeGreaterThanOrEqual(0);
    const raw = JSON.stringify({
      patches: [
        patchFor(1, secondChoice),
        patchFor(0, firstChoice),
      ],
    });
    expect(raw).not.toContain('contractPointer');
    expect(raw).not.toContain('contractValue');
    const before = canonicalJson(value);
    const repaired = applyRepresentedElsewhereRepairPatches({
      draft: value,
      authority: auth,
      pointerTemplate: pointerTemplate(),
      patches: parseRepresentedElsewhereRepairPatches(raw),
    });

    expect(canonicalJson(value)).toBe(before);
    expect(dispositionAt(repaired, 0)).toEqual({
      kind: 'represented_elsewhere',
      ...auth.pages[0]!.permittedPointerValues[firstChoice],
    });
    expect(dispositionAt(repaired, 1)).toEqual({
      kind: 'represented_elsewhere',
      ...auth.pages[0]!.permittedPointerValues[secondChoice],
    });
    expect(dispositionAt(repaired, 2)).toEqual(dispositionAt(value, 2));
    expect(masked(repaired)).toBe(masked(value));
  });

  it.each([
    [
      'invalid json',
      'x',
      'represented_elsewhere_repair_response_invalid_json',
    ],
    [
      'empty patch array',
      JSON.stringify({ patches: [] }),
      'represented_elsewhere_repair_response_invalid_shape',
    ],
    [
      'extra root key',
      JSON.stringify({ patches: [patchFor(0, 0)], extra: true }),
      'represented_elsewhere_repair_response_invalid_shape',
    ],
    [
      'raw pointer output',
      JSON.stringify({
        patches: [
          {
            ...patchFor(0, 0),
            contractPointer: '/pageContracts/0/mustShow/0',
          },
        ],
      }),
      'represented_elsewhere_repair_patch_invalid',
    ],
    [
      'extra patch key',
      JSON.stringify({ patches: [{ ...patchFor(0, 0), extra: true }] }),
      'represented_elsewhere_repair_patch_invalid',
    ],
  ])('rejects %s', (_label, raw, expectedError) => {
    expect(() => parseRepresentedElsewhereRepairPatches(raw)).toThrow(
      expectedError,
    );
  });

  it('refuses empty domains, duplicate diagnostics, mixed diagnostics, and already-valid originals before dispatch', () => {
    const emptyTemplate: ActionSemanticCoverageTemplate = {
      pageContracts: [{ pageNumber: 6, actionRequirements: [] }],
    };
    expect(
      representedElsewhereRepairAuthority({
        draft: draft(),
        diagnosticIssues: [issue(0)],
        pointerTemplate: emptyTemplate,
        sourceEvidenceCatalog: catalog(),
      }),
    ).toBeNull();
    expect(
      representedElsewhereRepairAuthority({
        draft: draft(),
        diagnosticIssues: [issue(0), issue(0)],
        pointerTemplate: pointerTemplate(),
        sourceEvidenceCatalog: catalog(),
      }),
    ).toBeNull();
    expect(
      representedElsewhereRepairAuthority({
        draft: draft(),
        diagnosticIssues: [
          issue(0),
          {
            family: 'action_semantic',
            code: 'coverage_missing',
            locator: { kind: 'page', fieldRole: 'coverage', pageNumber: 6 },
          },
        ],
        pointerTemplate: pointerTemplate(),
        sourceEvidenceCatalog: catalog(),
      }),
    ).toBeNull();

    const alreadyValid = draft();
    const validChoice = authority().pages[0]!.permittedPointerValues[0]!;
    const page = (
      alreadyValid.pageContracts as Array<Record<string, unknown>>
    )[0]!;
    const coverage = page.actionSemanticCoverage as Array<
      Record<string, unknown>
    >;
    coverage[0]!.disposition = {
      kind: 'represented_elsewhere',
      ...validChoice,
    };
    expect(
      representedElsewhereRepairAuthority({
        draft: alreadyValid,
        diagnosticIssues: [issue(0)],
        pointerTemplate: pointerTemplate(),
        sourceEvidenceCatalog: catalog(),
      }),
    ).toBeNull();
  });

  it('rejects missing, duplicate, and unexpected patch identities before mutation', () => {
    const value = draft();
    const before = canonicalJson(value);
    const auth = authority();
    expect(() =>
      applyRepresentedElsewhereRepairPatches({
        draft: value,
        authority: auth,
        pointerTemplate: pointerTemplate(),
        patches: [patchFor(0, 0)],
      }),
    ).toThrow('represented_elsewhere_repair_patch_set_incomplete');
    expect(() =>
      applyRepresentedElsewhereRepairPatches({
        draft: value,
        authority: auth,
        pointerTemplate: pointerTemplate(),
        patches: [patchFor(0, 0), patchFor(0, 1)],
      }),
    ).toThrow(
      'represented_elsewhere_repair_patch_unexpected_or_duplicate',
    );
    expect(() =>
      applyRepresentedElsewhereRepairPatches({
        draft: value,
        authority: auth,
        pointerTemplate: pointerTemplate(),
        patches: [
          patchFor(0, 0),
          { ...patchFor(1, 1), coverageIndex: 9 },
        ],
      }),
    ).toThrow(
      'represented_elsewhere_repair_patch_unexpected_or_duplicate',
    );
    expect(canonicalJson(value)).toBe(before);
  });

  it.each([
    [
      'kind_drift',
      (value: Record<string, unknown>) => {
        const page = (
          value.pageContracts as Array<Record<string, unknown>>
        )[0]!;
        const coverage = page.actionSemanticCoverage as Array<
          Record<string, unknown>
        >;
        coverage[1]!.disposition = {
          kind: 'non_visual',
          rationale: 'internal_state',
        };
      },
    ],
    [
      'beat_drift',
      (value: Record<string, unknown>) => {
        const page = (
          value.pageContracts as Array<Record<string, unknown>>
        )[0]!;
        const coverage = page.actionSemanticCoverage as Array<
          Record<string, unknown>
        >;
        coverage[1]!.beatId = 'beat:p6:changed';
      },
    ],
    [
      'source_drift',
      (value: Record<string, unknown>) => {
        const page = (
          value.pageContracts as Array<Record<string, unknown>>
        )[0]!;
        const coverage = page.actionSemanticCoverage as Array<
          Record<string, unknown>
        >;
        coverage[1]!.sourceEvidenceId = SOURCE_C;
      },
    ],
    [
      'target_stale',
      (value: Record<string, unknown>) => {
        const validChoice = authority().pages[0]!
          .permittedPointerValues[0]!;
        const page = (
          value.pageContracts as Array<Record<string, unknown>>
        )[0]!;
        const coverage = page.actionSemanticCoverage as Array<
          Record<string, unknown>
        >;
        coverage[1]!.disposition = {
          kind: 'represented_elsewhere',
          ...validChoice,
        };
      },
    ],
  ])('reports sanitized %s context and leaves a two-target draft atomic', (
    subreason,
    mutate,
  ) => {
    const value = draft();
    mutate(value);
    const before = canonicalJson(value);
    let thrown: unknown;
    try {
      applyRepresentedElsewhereRepairPatches({
        draft: value,
        authority: authority(),
        pointerTemplate: pointerTemplate(),
        patches: [patchFor(0, 0), patchFor(1, 1)],
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(
      RepresentedElsewhereRepairTargetAssociationError,
    );
    expect(thrown).toMatchObject({
      message: 'represented_elsewhere_repair_target_association_invalid',
      pageNumber: 6,
      coverageIndex: 1,
      closedSubreason: subreason,
    });
    expect(JSON.stringify(thrown)).not.toContain('stale map');
    expect(JSON.stringify(thrown)).not.toContain('/pageContracts/9');
    expect(canonicalJson(value)).toBe(before);
  });

  it('rejects an out-of-range choice with sanitized context before any target mutates', () => {
    const value = draft();
    const before = canonicalJson(value);
    let thrown: unknown;
    try {
      applyRepresentedElsewhereRepairPatches({
        draft: value,
        authority: authority(),
        pointerTemplate: pointerTemplate(),
        patches: [patchFor(0, 0), patchFor(1, 999)],
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      message: 'represented_elsewhere_repair_target_association_invalid',
      pageNumber: 6,
      coverageIndex: 1,
      closedSubreason: 'choice_out_of_range',
    });
    expect(canonicalJson(value)).toBe(before);
  });

  it('rejects stale page-level pointer authority before mutation', () => {
    const value = draft();
    const before = canonicalJson(value);
    const staleTemplate = pointerTemplate() as unknown as {
      pageContracts: Array<Record<string, unknown>>;
    };
    staleTemplate.pageContracts[0]!.zoneId = 'zone:different';
    expect(() =>
      applyRepresentedElsewhereRepairPatches({
        draft: value,
        authority: authority(),
        pointerTemplate: staleTemplate as ActionSemanticCoverageTemplate,
        patches: [patchFor(0, 0), patchFor(1, 0)],
      }),
    ).toThrow('represented_elsewhere_repair_target_association_invalid');
    expect(canonicalJson(value)).toBe(before);
  });
});
