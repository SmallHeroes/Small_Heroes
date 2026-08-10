import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA,
  applyPresentationRequirementRepairPatches,
  buildPresentationRequirementRepairUserPrompt,
  parsePresentationRequirementRepairPatches,
  presentationRequirementRepairTargets,
} from '../visual-contract-compiler/presentationRequirementRepair';
import { assertOpenAIResponsesStructuredOutputSchemaCompatible } from '../visual-package/openaiResponsesStructuredOutputSchemaCompatibility';

const SOURCE_EVIDENCE_ID = `se1_${'a'.repeat(64)}`;

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
    contractPointer: '/pageContracts/0/mustShow/0',
  };
}

describe('presentation requirement compact repair', () => {
  it('uses a Responses-compatible strict schema', () => {
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
        draft: draft(), targets: targets(), patches: [{ ...patch(), contractPointer: '/pageContracts/0/mustShow/9' }],
      }),
    ).toThrow('presentation_requirement_repair_pointer_not_permitted');
    const stale = draft();
    stale.pageContracts[0]!.actionSemanticCoverage[0]!.beatId = 'beat:p4:other';
    expect(() =>
      applyPresentationRequirementRepairPatches({
        draft: stale, targets: targets(), patches: [patch()],
      }),
    ).toThrow('presentation_requirement_repair_target_stale');
  });

  it('keeps mixed or unsafe capability gaps terminal by refusing authority', () => {
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
      }),
    ).toBeNull();
  });
});
