import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA,
  PRESENTATION_REQUIREMENT_REPAIR_ELIGIBILITY_VERSION,
  PRESENTATION_REQUIREMENT_REPAIR_PROMPT_VERSION,
  PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_VERSION,
  PRESENTATION_REQUIREMENT_REPAIR_USER_PROMPT_VERSION,
  applyPresentationRequirementRepairPatches,
  buildPresentationRequirementRepairUserPrompt,
  parsePresentationRequirementRepairPatches,
  presentationRequirementRepairTargets,
} from '../visual-contract-compiler/presentationRequirementRepair';
import { assertOpenAIResponsesStructuredOutputSchemaCompatible } from '../visual-package/openaiResponsesStructuredOutputSchemaCompatibility';

const SOURCE_EVIDENCE_ID = `se1_${'a'.repeat(64)}`;

function eligibility(args: {
  pageNumber?: number;
  beatId?: string;
  sourceEvidenceId?: string;
  presentationClass?: 'graphic_sound_cue' | 'lighting_state';
  values?: Array<{ contractPointer: string; contractValue: string }>;
} = {}) {
  return {
    version: PRESENTATION_REQUIREMENT_REPAIR_ELIGIBILITY_VERSION,
    pageNumber: args.pageNumber ?? 4,
    beatId: args.beatId ?? 'beat:p4:echo_returns',
    sourceEvidenceId: args.sourceEvidenceId ?? SOURCE_EVIDENCE_ID,
    presentationClass: args.presentationClass ?? 'graphic_sound_cue',
    permittedPointerValues: args.values ?? [
      {
        contractPointer: '/pageContracts/0/mustShow/0',
        contractValue: 'visible sound lettering near the railing',
      },
      {
        contractPointer: '/pageContracts/0/mustShow/1',
        contractValue: 'the child listens',
      },
    ],
  } as const;
}

function draft() {
  return {
    worldType: 'grounded',
    pageContracts: [
      {
        pageNumber: 4,
        mustShow: ['visible sound lettering near the railing', 'the child listens'],
        actionSemanticCoverage: [
          {
            beatId: 'beat:p4:echo_returns',
            sourceEvidenceId: SOURCE_EVIDENCE_ID,
            disposition: {
              kind: 'unsupported',
              reason: 'closed_action_catalog_gap',
            },
          },
        ],
      },
    ],
  };
}

function targets() {
  const value = presentationRequirementRepairTargets({
    draft: draft(),
    gaps: [
      {
        pageNumber: 4,
        coverageIndex: 0,
        beatId: 'beat:p4:echo_returns',
        sourceEvidenceId: SOURCE_EVIDENCE_ID,
        sourcePhrase: 'The echo returns.',
        reason: 'closed_action_catalog_gap',
      },
    ],
    eligibilities: [eligibility()],
  });
  if (!value) throw new Error('expected repair targets');
  return value;
}

function patch() {
  return {
    pageNumber: 4,
    coverageIndex: 0,
    beatId: 'beat:p4:echo_returns',
    sourceEvidenceId: SOURCE_EVIDENCE_ID,
    presentationClass: 'graphic_sound_cue' as const,
    pointerChoiceIndex: 0,
  };
}

describe('presentation requirement compact repair', () => {
  it('uses a Responses-compatible strict schema', () => {
    expect(PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_VERSION).toBe(
      'presentation-requirement-repair-schema/v3',
    );
    expect(PRESENTATION_REQUIREMENT_REPAIR_PROMPT_VERSION).toBe(
      'presentation-requirement-repair-prompt/v3',
    );
    expect(PRESENTATION_REQUIREMENT_REPAIR_USER_PROMPT_VERSION).toBe(
      'presentation-requirement-repair-user-prompt/v3',
    );
    expect(
      assertOpenAIResponsesStructuredOutputSchemaCompatible(
        PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA,
      ).status,
    ).toBe('compatible');
  });

  it('projects exact same-page mustShow authority without global draft fields', () => {
    expect(targets()).toEqual([
      expect.objectContaining({
        pageNumber: 4,
        coverageIndex: 0,
        beatId: 'beat:p4:echo_returns',
        permittedPointerValues: [
          {
            contractPointer: '/pageContracts/0/mustShow/0',
            contractValue: 'visible sound lettering near the railing',
          },
          {
            contractPointer: '/pageContracts/0/mustShow/1',
            contractValue: 'the child listens',
          },
        ],
      }),
    ]);
    const prompt = buildPresentationRequirementRepairUserPrompt({
      targets: targets(),
    });
    expect(prompt).not.toContain('worldType');
    expect(prompt).toContain(SOURCE_EVIDENCE_ID);
    expect(prompt).toContain('permittedPointerValues');
  });

  it('parses exact-key patches and applies only the targeted disposition', () => {
    const before = draft();
    const parsed = parsePresentationRequirementRepairPatches(
      JSON.stringify({ patches: [patch()] }),
    );
    const repaired = applyPresentationRequirementRepairPatches({
      draft: before,
      targets: targets(),
      patches: parsed,
    });
    const repairedPage = (
      repaired.pageContracts as ReturnType<typeof draft>['pageContracts']
    )[0]!;
    expect(repaired).not.toBe(before);
    expect(before.pageContracts[0]!.actionSemanticCoverage[0]!.disposition)
      .toEqual({
        kind: 'unsupported',
        reason: 'closed_action_catalog_gap',
      });
    expect(
      repairedPage.actionSemanticCoverage[0]!.disposition,
    ).toEqual({
      kind: 'presentation_requirement',
      presentationClass: 'graphic_sound_cue',
      contractPointer: '/pageContracts/0/mustShow/0',
      contractValue: 'visible sound lettering near the railing',
    });
    expect(repaired.worldType).toBe(before.worldType);
    expect(repairedPage.mustShow).toEqual(
      before.pageContracts[0]!.mustShow,
    );
  });

  it('keeps the dedicated lane identity-keyed and order-independent across pages', () => {
    const value = draft();
    const secondSourceEvidenceId = `se1_${'b'.repeat(64)}`;
    value.pageContracts.push({
      pageNumber: 5,
      mustShow: ['the lantern glows', 'the doorway is visible'],
      actionSemanticCoverage: [
        {
          beatId: 'beat:p5:lantern_glows',
          sourceEvidenceId: secondSourceEvidenceId,
          disposition: {
            kind: 'unsupported',
            reason: 'closed_action_catalog_gap',
          },
        },
      ],
    });
    const selected = presentationRequirementRepairTargets({
      draft: value,
      gaps: [
        {
          pageNumber: 4,
          coverageIndex: 0,
          beatId: 'beat:p4:echo_returns',
          sourceEvidenceId: SOURCE_EVIDENCE_ID,
          sourcePhrase: 'The echo returns.',
          reason: 'closed_action_catalog_gap',
        },
        {
          pageNumber: 5,
          coverageIndex: 0,
          beatId: 'beat:p5:lantern_glows',
          sourceEvidenceId: secondSourceEvidenceId,
          sourcePhrase: 'The lantern glows.',
          reason: 'closed_action_catalog_gap',
        },
      ],
      eligibilities: [
        eligibility(),
        eligibility({
          pageNumber: 5,
          beatId: 'beat:p5:lantern_glows',
          sourceEvidenceId: secondSourceEvidenceId,
          presentationClass: 'lighting_state',
          values: [
            {
              contractPointer: '/pageContracts/1/mustShow/0',
              contractValue: 'the lantern glows',
            },
            {
              contractPointer: '/pageContracts/1/mustShow/1',
              contractValue: 'the doorway is visible',
            },
          ],
        }),
      ],
    });
    if (!selected) throw new Error('expected multi-page repair targets');
    const repaired = applyPresentationRequirementRepairPatches({
      draft: value,
      targets: selected,
      patches: [
        {
          pageNumber: 5,
          coverageIndex: 0,
          beatId: 'beat:p5:lantern_glows',
          sourceEvidenceId: secondSourceEvidenceId,
          presentationClass: 'lighting_state',
          pointerChoiceIndex: 1,
        },
        { ...patch(), pointerChoiceIndex: 1 },
      ],
    });
    const pages = repaired.pageContracts as Array<{
      actionSemanticCoverage: Array<{ disposition: Record<string, unknown> }>;
    }>;
    expect(pages[0]!.actionSemanticCoverage[0]!.disposition).toMatchObject({
      contractPointer: '/pageContracts/0/mustShow/1',
      contractValue: 'the child listens',
    });
    expect(pages[1]!.actionSemanticCoverage[0]!.disposition).toMatchObject({
      contractPointer: '/pageContracts/1/mustShow/1',
      contractValue: 'the doorway is visible',
    });
  });

  it.each([
    ['invalid json', 'x', 'presentation_requirement_repair_response_invalid_json'],
    ['extra root key', JSON.stringify({ patches: [patch()], extra: true }), 'presentation_requirement_repair_response_invalid_shape'],
    ['extra patch key', JSON.stringify({ patches: [{ ...patch(), contractValue: 'forbidden' }] }), 'presentation_requirement_repair_patch_invalid'],
  ])('rejects %s', (_label, raw, code) => {
    expect(() => parsePresentationRequirementRepairPatches(raw)).toThrow(code);
  });

  it('rejects incomplete, duplicate, stale, and out-of-domain patches fail-closed', () => {
    expect(() =>
      applyPresentationRequirementRepairPatches({
        draft: draft(), targets: targets(), patches: [],
      }),
    ).toThrow('presentation_requirement_repair_patch_set_incomplete');
    expect(() =>
      applyPresentationRequirementRepairPatches({
        draft: draft(), targets: targets(), patches: [patch(), patch()],
      }),
    ).toThrow('presentation_requirement_repair_patch_unexpected_or_duplicate');
    expect(() =>
      applyPresentationRequirementRepairPatches({
        draft: draft(), targets: targets(), patches: [{ ...patch(), pointerChoiceIndex: 9 }],
      }),
    ).toThrow(
      'presentation_requirement_repair_pointer_choice_not_permitted',
    );
    expect(() =>
      applyPresentationRequirementRepairPatches({
        draft: draft(),
        targets: targets(),
        patches: [{ ...patch(), presentationClass: 'invalid' }] as never,
      }),
    ).toThrow('presentation_requirement_repair_class_invalid');
    const stale = draft();
    stale.pageContracts[0]!.actionSemanticCoverage[0]!.beatId = 'beat:p4:other';
    expect(() =>
      applyPresentationRequirementRepairPatches({
        draft: stale, targets: targets(), patches: [patch()],
      }),
    ).toThrow('presentation_requirement_repair_target_stale');
  });

  it('keeps mixed or unsafe capability gaps terminal by refusing authority', () => {
    expect(
      presentationRequirementRepairTargets({
        draft: draft(),
        gaps: [
          {
            pageNumber: 4,
            coverageIndex: 0,
            beatId: 'beat:p4:echo_returns',
            sourceEvidenceId: SOURCE_EVIDENCE_ID,
            sourcePhrase: 'The echo returns.',
            reason: 'closed_action_catalog_gap',
          },
        ],
      }),
    ).toBeNull();
    const noMustShow = draft();
    noMustShow.pageContracts[0]!.mustShow = [];
    expect(
      presentationRequirementRepairTargets({
        draft: noMustShow,
        gaps: [
          {
            pageNumber: 4,
            coverageIndex: 0,
            beatId: 'beat:p4:echo_returns',
            sourceEvidenceId: SOURCE_EVIDENCE_ID,
            sourcePhrase: 'The echo returns.',
            reason: 'closed_action_catalog_gap',
          },
        ],
        eligibilities: [eligibility()],
      }),
    ).toBeNull();
  });

  it('rejects extra-key, unused, and multiply-consumed eligibility authority', () => {
    const gap = {
      pageNumber: 4,
      coverageIndex: 0,
      beatId: 'beat:p4:echo_returns',
      sourceEvidenceId: SOURCE_EVIDENCE_ID,
      sourcePhrase: 'The echo returns.',
      reason: 'closed_action_catalog_gap' as const,
    };
    expect(
      presentationRequirementRepairTargets({
        draft: draft(),
        gaps: [gap],
        eligibilities: [{ ...eligibility(), injectedApproval: true } as never],
      }),
    ).toBeNull();
    expect(
      presentationRequirementRepairTargets({
        draft: draft(),
        gaps: [gap],
        eligibilities: [
          eligibility(),
          eligibility({
            beatId: 'beat:p4:unused',
            sourceEvidenceId: `se1_${'c'.repeat(64)}`,
          }),
        ],
      }),
    ).toBeNull();
    expect(
      presentationRequirementRepairTargets({
        draft: draft(),
        gaps: [gap, { ...gap, coverageIndex: 1 }],
        eligibilities: [eligibility()],
      }),
    ).toBeNull();
  });
});
