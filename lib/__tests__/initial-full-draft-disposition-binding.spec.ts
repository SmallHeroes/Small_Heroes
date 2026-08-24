import { describe, expect, it } from 'vitest';

import {
  INITIAL_FULL_DRAFT_UNBOUND_PRESENTATION_POINTER,
  INITIAL_FULL_DRAFT_UNBOUND_REPRESENTED_POINTER,
  bindInitialFullDraftSamePageDispositions,
  initialFullDraftDispositionBindingNote,
} from '@/lib/visual-contract-compiler/initialFullDraftDispositionBinding';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_VERSION,
  TEMPLATE_REPAIR_PAGE_CONTRACT_JSON_SCHEMA,
} from '@/lib/visual-contract-compiler/templateDraftSchema';

function page(args: {
  pageNumber: number;
  locationId: string;
  mustShow?: string[];
  dispositions: Array<Record<string, unknown>>;
  duplicateValue?: string;
}): Record<string, unknown> {
  return {
    pageNumber: args.pageNumber,
    locationId: args.locationId,
    zoneId: `zone:${args.pageNumber}`,
    mustShow: args.mustShow ?? [`must:${args.pageNumber}`],
    mustNotShow: [],
    propState: args.duplicateValue
      ? [{ propId: `prop:${args.pageNumber}`, state: args.duplicateValue }]
      : [],
    propConstraints: [],
    actionRequirements: [],
    actionSemanticCoverage: args.dispositions.map(
      (disposition, index) => ({
        beatId: `beat:p${args.pageNumber}:coverage_${index}`,
        sourceEvidenceId: `se1_${String(args.pageNumber).repeat(64).slice(0, 64)}`,
        disposition,
      }),
    ),
    camera: 'medium',
    transition: {
      kind: 'steady',
      fromZoneId: null,
      toZoneId: null,
      cue: null,
    },
  };
}

function wireDraft(
  pages: Array<Record<string, unknown>>,
): Record<string, unknown> {
  return { pageContracts: pages };
}

function dispositions(
  draft: Record<string, unknown>,
  pageIndex: number,
): Array<Record<string, unknown>> {
  const pages = draft.pageContracts as Array<Record<string, unknown>>;
  return pages[pageIndex]!.actionSemanticCoverage as Array<
    Record<string, unknown>
  >;
}

function dispositionAt(
  draft: Record<string, unknown>,
  pageIndex: number,
  coverageIndex: number,
): Record<string, unknown> {
  return dispositions(draft, pageIndex)[coverageIndex]!
    .disposition as Record<string, unknown>;
}

function coverageDispositionSchema(
  pageSchema: Record<string, unknown>,
): Record<string, unknown> {
  return (((pageSchema.properties as Record<string, unknown>)
    .actionSemanticCoverage as Record<string, unknown>)
    .items as Record<string, unknown>).properties as Record<
    string,
    unknown
  >;
}

describe('initial/full-draft same-page disposition binding', () => {
  it('publishes a pointer-free v21 wire schema while narrow repairs retain canonical pointer/value authority', () => {
    expect(TEMPLATE_DRAFT_SCHEMA_VERSION).toBe('vc-draft-schema/v21');
    const initialPage = ((TEMPLATE_DRAFT_JSON_SCHEMA.properties as Record<
      string,
      unknown
    >).pageContracts as Record<string, unknown>).items as Record<
      string,
      unknown
    >;
    const initialDisposition = coverageDispositionSchema(initialPage)
      .disposition as Record<string, unknown>;
    const repairDisposition = coverageDispositionSchema(
      TEMPLATE_REPAIR_PAGE_CONTRACT_JSON_SCHEMA,
    ).disposition as Record<string, unknown>;

    expect(JSON.stringify(initialDisposition)).not.toContain(
      'contractPointer',
    );
    expect(JSON.stringify(initialDisposition)).not.toContain(
      'contractValue',
    );
    expect(JSON.stringify(initialDisposition)).toContain(
      'representedValue',
    );
    expect(JSON.stringify(initialDisposition)).toContain(
      'mustShowIndex',
    );
    expect(JSON.stringify(repairDisposition)).toContain(
      'contractPointer',
    );
  });

  it('materializes exact compiler-owned pointer/value pairs without mutating the wire draft', () => {
    const input = wireDraft([
      page({
        pageNumber: 1,
        locationId: 'location:one',
        mustShow: ['a warm lamp', 'the open doorway'],
        dispositions: [
          {
            kind: 'represented_elsewhere',
            representedValue: 'location:one',
          },
          {
            kind: 'presentation_requirement',
            presentationClass: 'lighting_state',
            mustShowIndex: 1,
          },
        ],
      }),
    ]);
    const before = structuredClone(input);

    const result = bindInitialFullDraftSamePageDispositions(input);

    expect(input).toEqual(before);
    expect(dispositionAt(result.draft, 0, 0)).toEqual({
      kind: 'represented_elsewhere',
      contractPointer: '/pageContracts/0/locationId',
      contractValue: 'location:one',
    });
    expect(dispositionAt(result.draft, 0, 1)).toEqual({
      kind: 'presentation_requirement',
      presentationClass: 'lighting_state',
      contractPointer: '/pageContracts/0/mustShow/1',
      contractValue: 'the open doorway',
    });
    expect(result.stats).toMatchObject({
      representedBound: 1,
      presentationBound: 1,
      representedUnbound: 0,
      representedAmbiguous: 0,
      presentationInvalid: 0,
    });
  });

  it('does not self-bind, cross-bind across pages, or accept a provider-authored raw pointer', () => {
    const result = bindInitialFullDraftSamePageDispositions(
      wireDraft([
        page({
          pageNumber: 1,
          locationId: 'location:one',
          dispositions: [
            {
              kind: 'represented_elsewhere',
              representedValue: 'only-inside-selector',
            },
            {
              kind: 'represented_elsewhere',
              representedValue: 'location:two',
            },
            {
              kind: 'represented_elsewhere',
              contractPointer: '/pageContracts/1/locationId',
              contractValue: 'location:two',
            },
          ],
        }),
        page({
          pageNumber: 2,
          locationId: 'location:two',
          dispositions: [{ kind: 'non_visual', rationale: 'sound_only' }],
        }),
      ]),
    );

    for (const coverageIndex of [0, 1, 2]) {
      expect(dispositionAt(result.draft, 0, coverageIndex)).toEqual({
        kind: 'represented_elsewhere',
        contractPointer:
          INITIAL_FULL_DRAFT_UNBOUND_REPRESENTED_POINTER,
        contractValue: '__compiler_unbound_represented_value__',
      });
    }
    expect(JSON.stringify(result.draft)).not.toContain(
      '/pageContracts/1/locationId',
    );
    expect(result.stats.representedUnbound).toBe(3);
  });

  it('fails closed on duplicate same-page values instead of choosing one occurrence', () => {
    const result = bindInitialFullDraftSamePageDispositions(
      wireDraft([
        page({
          pageNumber: 1,
          locationId: 'duplicate:value',
          duplicateValue: 'duplicate:value',
          dispositions: [
            {
              kind: 'represented_elsewhere',
              representedValue: 'duplicate:value',
            },
          ],
        }),
      ]),
    );

    expect(dispositionAt(result.draft, 0, 0).contractPointer).toBe(
      INITIAL_FULL_DRAFT_UNBOUND_REPRESENTED_POINTER,
    );
    expect(result.stats.representedAmbiguous).toBe(1);
  });

  it.each([-1, 1.5, 99, '0'])('fails closed on invalid mustShowIndex %s', (mustShowIndex) => {
    const result = bindInitialFullDraftSamePageDispositions(
      wireDraft([
        page({
          pageNumber: 1,
          locationId: 'location:one',
          mustShow: ['visible item'],
          dispositions: [
            {
              kind: 'presentation_requirement',
              presentationClass: 'static_state',
              mustShowIndex,
            },
          ],
        }),
      ]),
    );

    expect(dispositionAt(result.draft, 0, 0).contractPointer).toBe(
      INITIAL_FULL_DRAFT_UNBOUND_PRESENTATION_POINTER,
    );
    expect(result.stats.presentationInvalid).toBe(1);
  });

  it('emits only bounded counts in normalization evidence', () => {
    const note = initialFullDraftDispositionBindingNote({
      representedBound: 2,
      representedUnbound: 1,
      representedAmbiguous: 3,
      presentationBound: 4,
      presentationInvalid: 5,
    });
    expect(note).toBe(
      'compiler materialized initial/full-draft same-page disposition bindings represented_bound=2 represented_unbound=1 represented_ambiguous=3 presentation_bound=4 presentation_invalid=5',
    );
    expect(note).not.toContain('contractPointer');
    expect(note).not.toContain('representedValue');
  });
});
