import { describe, expect, it } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';
import {
  ACTION_BINDING_COMPONENT_NORMALIZATION_VERSION,
  ACTION_MISSING_BINDING_NORMALIZATION_VERSION,
  normalizeExactActionBindingComponents,
} from '@/lib/visual-contract-compiler/actionBindingComponentNormalization';
import {
  buildSourceEvidenceCatalog,
  type SourceEvidenceCatalog,
} from '@/lib/visual-contract-compiler/sourceEvidenceCatalog';

function catalog(sourceVariant = 'normalization fixture'): SourceEvidenceCatalog {
  const pageNumbers = Array.from({ length: 8 }, (_value, index) => index + 1);
  return buildSourceEvidenceCatalog({
    storyKey: 'normalization_fixture',
    sourceIdentity: {
      version: 'story-source-identity/v1',
      path: 'story-bank/normalization-fixture.md',
      digestAlgorithm: 'sha256',
      digest: canonicalHash(sourceVariant),
      pageCount: pageNumbers.length,
      pageNumbers,
    },
    pages: pageNumbers.map((pageNumber) => ({
      pageNumber,
      text: `${sourceVariant}: source sentence for page ${pageNumber}.`,
    })),
  });
}

function sourcePhenomenonAction(
  beatId: string,
  evidenceId: string,
): Record<string, unknown> {
  return {
    beatId,
    subject: {
      kind: 'source_phenomenon',
      sourceEvidenceId: evidenceId,
    },
    predicate: 'looks_at',
    object: null,
    spatialEffect: null,
    spatialConstraint: null,
    polarity: 'must',
    laterality: null,
  };
}

function sourceEvidenceId(
  sourceEvidenceCatalog: SourceEvidenceCatalog,
  pageNumber: number,
): string {
  const entry = sourceEvidenceCatalog.entries.find(
    (candidate) => candidate.pageNumber === pageNumber,
  );
  if (!entry) throw new Error(`missing source evidence for page ${pageNumber}`);
  return entry.sourceEvidenceId;
}

function action(beatId: string, predicate: string): Record<string, unknown> {
  return {
    beatId,
    subject: { kind: 'entity', entity: { kind: 'cast', id: 'cast:child' } },
    predicate,
    polarity: 'positive',
  };
}

function coverage(
  beatId: string,
  evidenceId: string,
  disposition: Record<string, unknown> = { kind: 'action_requirement' },
): Record<string, unknown> {
  return {
    beatId,
    sourceEvidenceId: evidenceId,
    disposition,
  };
}

function page(args: {
  pageNumber: number;
  actionBeatIds: readonly string[];
  coverageRecords: readonly Record<string, unknown>[];
}): Record<string, unknown> {
  return {
    pageNumber: args.pageNumber,
    locationId: 'loc:fixture',
    zoneId: 'zone:fixture',
    actionRequirements: args.actionBeatIds.map((beatId, index) =>
      action(beatId, `action_${index}`),
    ),
    actionSemanticCoverage: structuredClone(args.coverageRecords),
  };
}

describe('compiler-owned action-binding component normalization', () => {
  it('appends one exact missing source-phenomenon binding without changing any authored byte', () => {
    const sourceCatalog = catalog();
    const evidenceId = sourceEvidenceId(sourceCatalog, 1);
    const beatId = 'beat:p1:source_glow';
    const input = [page({
      pageNumber: 1,
      actionBeatIds: [],
      coverageRecords: [],
    })];
    input[0]!.actionRequirements = [
      sourcePhenomenonAction(beatId, evidenceId),
    ];
    const before = structuredClone(input);

    const result = normalizeExactActionBindingComponents({
      pages: input,
      sourceEvidenceCatalog: sourceCatalog,
    });

    expect(input).toEqual(before);
    expect(result.normalizations).toEqual([]);
    expect(result.missingBindingNormalizations).toEqual([{
      version: ACTION_MISSING_BINDING_NORMALIZATION_VERSION,
      pageNumber: 1,
      actionIndex: 0,
      beatId,
      sourceEvidenceId: evidenceId,
      coverageIndex: 0,
    }]);
    expect(result.pages[0]!.actionRequirements).toEqual(
      before[0]!.actionRequirements,
    );
    expect(result.pages[0]!.actionSemanticCoverage).toEqual([{
      beatId,
      sourceEvidenceId: evidenceId,
      disposition: { kind: 'action_requirement' },
    }]);

    const rerun = normalizeExactActionBindingComponents({
      pages: result.pages,
      sourceEvidenceCatalog: sourceCatalog,
    });
    expect(rerun.normalizations).toEqual([]);
    expect(rerun.missingBindingNormalizations).toEqual([]);
    expect(rerun.pages).toEqual(result.pages);
  });

  it('restores four live-shaped missing bindings in deterministic page order', () => {
    const sourceCatalog = catalog();
    const pageNumbers = [8, 1, 6, 3];
    const pages = pageNumbers.map((pageNumber) => {
      const evidenceId = sourceEvidenceId(sourceCatalog, pageNumber);
      const result = page({
        pageNumber,
        actionBeatIds: [],
        coverageRecords: [],
      });
      result.actionRequirements = [sourcePhenomenonAction(
        `beat:p${pageNumber}:source_event`,
        evidenceId,
      )];
      return result;
    });

    const result = normalizeExactActionBindingComponents({
      pages,
      sourceEvidenceCatalog: sourceCatalog,
    });

    expect(
      result.missingBindingNormalizations.map(
        (normalization) => normalization.pageNumber,
      ),
    ).toEqual([1, 3, 6, 8]);
    for (const normalizedPage of result.pages) {
      expect(normalizedPage.actionSemanticCoverage).toHaveLength(1);
    }
    const rerun = normalizeExactActionBindingComponents({
      pages: result.pages,
      sourceEvidenceCatalog: sourceCatalog,
    });
    expect(rerun.normalizations).toEqual([]);
    expect(rerun.missingBindingNormalizations).toEqual([]);
    expect(rerun.pages).toEqual(result.pages);
  });

  it('composes missing-binding closure with duplicate-component closure without changing their authorities', () => {
    const sourceCatalog = catalog();
    const evidenceId = sourceEvidenceId(sourceCatalog, 1);
    const duplicateBeatId = 'beat:p1:shared';
    const missingBeatId = 'beat:p1:source_event';
    const inputPage = page({
      pageNumber: 1,
      actionBeatIds: [duplicateBeatId, duplicateBeatId],
      coverageRecords: [coverage(duplicateBeatId, evidenceId)],
    });
    (inputPage.actionRequirements as unknown[]).push(
      sourcePhenomenonAction(missingBeatId, evidenceId),
    );

    const result = normalizeExactActionBindingComponents({
      pages: [inputPage],
      sourceEvidenceCatalog: sourceCatalog,
    });

    expect(result.normalizations).toHaveLength(1);
    expect(result.missingBindingNormalizations).toHaveLength(1);
    expect(result.missingBindingNormalizations[0]).toMatchObject({
      actionIndex: 2,
      beatId: missingBeatId,
      coverageIndex: 2,
    });
    expect(result.pages[0]!.actionSemanticCoverage).toHaveLength(3);
    const rerun = normalizeExactActionBindingComponents({
      pages: result.pages,
      sourceEvidenceCatalog: sourceCatalog,
    });
    expect(rerun.normalizations).toEqual([]);
    expect(rerun.missingBindingNormalizations).toEqual([]);
    expect(rerun.pages).toEqual(result.pages);
  });

  it.each([
    ['duplicate action ownership', (sourceCatalog: SourceEvidenceCatalog) => {
      const evidenceId = sourceEvidenceId(sourceCatalog, 1);
      const beatId = 'beat:p1:source_event';
      const candidate = page({
        pageNumber: 1,
        actionBeatIds: [],
        coverageRecords: [],
      });
      candidate.actionRequirements = [
        sourcePhenomenonAction(beatId, evidenceId),
        sourcePhenomenonAction(beatId, evidenceId),
      ];
      return [candidate];
    }],
    ['existing same-beat non-action coverage', (sourceCatalog: SourceEvidenceCatalog) => {
      const evidenceId = sourceEvidenceId(sourceCatalog, 1);
      const beatId = 'beat:p1:source_event';
      const candidate = page({
        pageNumber: 1,
        actionBeatIds: [],
        coverageRecords: [coverage(beatId, evidenceId, {
          kind: 'non_visual',
          rationale: 'narrative_context',
        })],
      });
      candidate.actionRequirements = [
        sourcePhenomenonAction(beatId, evidenceId),
      ];
      return [candidate];
    }],
    ['extra action key', (sourceCatalog: SourceEvidenceCatalog) => {
      const evidenceId = sourceEvidenceId(sourceCatalog, 1);
      const candidate = page({
        pageNumber: 1,
        actionBeatIds: [],
        coverageRecords: [],
      });
      candidate.actionRequirements = [{
        ...sourcePhenomenonAction('beat:p1:source_event', evidenceId),
        unexpected: true,
      }];
      return [candidate];
    }],
    ['extra subject key', (sourceCatalog: SourceEvidenceCatalog) => {
      const evidenceId = sourceEvidenceId(sourceCatalog, 1);
      const candidate = page({
        pageNumber: 1,
        actionBeatIds: [],
        coverageRecords: [],
      });
      const actionRecord = sourcePhenomenonAction(
        'beat:p1:source_event',
        evidenceId,
      );
      actionRecord.subject = {
        kind: 'source_phenomenon',
        sourceEvidenceId: evidenceId,
        sourcePhrase: 'provider-authored prose is forbidden here',
      };
      candidate.actionRequirements = [actionRecord];
      return [candidate];
    }],
    ['wrong-page source evidence', (sourceCatalog: SourceEvidenceCatalog) => {
      const candidate = page({
        pageNumber: 1,
        actionBeatIds: [],
        coverageRecords: [],
      });
      candidate.actionRequirements = [sourcePhenomenonAction(
        'beat:p1:source_event',
        sourceEvidenceId(sourceCatalog, 2),
      )];
      return [candidate];
    }],
    ['unknown source evidence', () => {
      const candidate = page({
        pageNumber: 1,
        actionBeatIds: [],
        coverageRecords: [],
      });
      candidate.actionRequirements = [sourcePhenomenonAction(
        'beat:p1:source_event',
        `se1_${'f'.repeat(64)}`,
      )];
      return [candidate];
    }],
    ['invalid page-scoped beat', (sourceCatalog: SourceEvidenceCatalog) => {
      const candidate = page({
        pageNumber: 1,
        actionBeatIds: [],
        coverageRecords: [],
      });
      candidate.actionRequirements = [sourcePhenomenonAction(
        'beat:p2:source_event',
        sourceEvidenceId(sourceCatalog, 1),
      )];
      return [candidate];
    }],
  ] as const)(
    'leaves an ineligible missing binding with %s byte-identical',
    (_name, buildPages) => {
      const sourceCatalog = catalog();
      const input = buildPages(sourceCatalog);
      const before = structuredClone(input);

      const result = normalizeExactActionBindingComponents({
        pages: input,
        sourceEvidenceCatalog: sourceCatalog,
      });

      expect(result.normalizations).toEqual([]);
      expect(result.missingBindingNormalizations).toEqual([]);
      expect(result.pages).toEqual(before);
      expect(input).toEqual(before);
    },
  );

  it('closes one exact component with the minimum deterministic diff and does not mutate its input', () => {
    const sourceCatalog = catalog();
    const evidenceId = sourceEvidenceId(sourceCatalog, 1);
    const sourceBeatId = 'beat:p1:shared';
    const input = [
      page({
        pageNumber: 1,
        actionBeatIds: [sourceBeatId, sourceBeatId, sourceBeatId],
        coverageRecords: [coverage(sourceBeatId, evidenceId)],
      }),
    ];
    const before = structuredClone(input);

    const result = normalizeExactActionBindingComponents({
      pages: input,
      sourceEvidenceCatalog: sourceCatalog,
    });

    expect(input).toEqual(before);
    expect(result.normalizations).toHaveLength(1);
    expect(result.normalizations[0]).toMatchObject({
      version: ACTION_BINDING_COMPONENT_NORMALIZATION_VERSION,
      pageNumber: 1,
      sourceBeatId,
      memberActionIndexes: [0, 1, 2],
      sourceCoverageIndex: 0,
      sourceEvidenceId: evidenceId,
    });
    const normalizedPage = result.pages[0]!;
    const normalizedActions = normalizedPage.actionRequirements as Array<
      Record<string, unknown>
    >;
    const normalizedCoverage =
      normalizedPage.actionSemanticCoverage as Array<Record<string, unknown>>;
    expect(normalizedActions[0]).toEqual(
      (before[0]!.actionRequirements as unknown[])[0],
    );
    expect(normalizedActions.map((candidate) => candidate.predicate)).toEqual([
      'action_0',
      'action_1',
      'action_2',
    ]);
    expect(normalizedActions.map((candidate) => candidate.beatId)).toEqual([
      sourceBeatId,
      expect.stringMatching(/^beat:p1:compiler_action_[a-f0-9]{64}$/),
      expect.stringMatching(/^beat:p1:compiler_action_[a-f0-9]{64}$/),
    ]);
    expect(new Set(normalizedActions.map((candidate) => candidate.beatId)).size)
      .toBe(3);
    expect(normalizedCoverage[0]).toEqual(
      (before[0]!.actionSemanticCoverage as unknown[])[0],
    );
    expect(normalizedCoverage.slice(1)).toEqual(
      normalizedActions.slice(1).map((candidate) => ({
        beatId: candidate.beatId,
        sourceEvidenceId: evidenceId,
        disposition: { kind: 'action_requirement' },
      })),
    );

    const rerun = normalizeExactActionBindingComponents({
      pages: result.pages,
      sourceEvidenceCatalog: sourceCatalog,
    });
    expect(rerun.normalizations).toEqual([]);
    expect(rerun.missingBindingNormalizations).toEqual([]);
    expect(rerun.pages).toEqual(result.pages);
  });

  it('derives generated beat IDs from compiler coordinates rather than authored source prose', () => {
    const firstCatalog = catalog('first authored wording');
    const secondCatalog = catalog('completely different authored wording');
    const sourceBeatId = 'beat:p1:shared';

    const normalizeWith = (sourceCatalog: SourceEvidenceCatalog) =>
      normalizeExactActionBindingComponents({
        pages: [
          page({
            pageNumber: 1,
            actionBeatIds: [sourceBeatId, sourceBeatId],
            coverageRecords: [
              coverage(
                sourceBeatId,
                sourceEvidenceId(sourceCatalog, 1),
              ),
            ],
          }),
        ],
        sourceEvidenceCatalog: sourceCatalog,
      });

    const first = normalizeWith(firstCatalog);
    const second = normalizeWith(secondCatalog);

    expect(sourceEvidenceId(firstCatalog, 1)).not.toBe(
      sourceEvidenceId(secondCatalog, 1),
    );
    expect(first.normalizations[0]!.generatedBindings).toEqual(
      second.normalizations[0]!.generatedBindings,
    );
  });

  it('normalizes six components across pages in explicit order and resolves collisions against every coverage disposition', () => {
    const sourceCatalog = catalog();
    const page1Evidence = sourceEvidenceId(sourceCatalog, 1);
    const page2Evidence = sourceEvidenceId(sourceCatalog, 2);
    const sourceBeatA = 'beat:p1:component_b';
    const sourceBeatB = 'beat:p1:component_a';
    const baseline = normalizeExactActionBindingComponents({
      pages: [
        page({
          pageNumber: 1,
          actionBeatIds: [sourceBeatA, sourceBeatA],
          coverageRecords: [coverage(sourceBeatA, page1Evidence)],
        }),
      ],
      sourceEvidenceCatalog: sourceCatalog,
    });
    const collidingGeneratedBeat =
      baseline.normalizations[0]!.generatedBindings[0]!.beatId;
    const pages = [
      page({
        pageNumber: 2,
        actionBeatIds: [
          'beat:p2:component_c',
          'beat:p2:component_c',
          'beat:p2:component_d',
          'beat:p2:component_d',
          'beat:p2:component_e',
          'beat:p2:component_e',
          'beat:p2:component_f',
          'beat:p2:component_f',
        ],
        coverageRecords: [
          coverage('beat:p2:component_c', page2Evidence),
          coverage('beat:p2:component_d', page2Evidence),
          coverage('beat:p2:component_e', page2Evidence),
          coverage('beat:p2:component_f', page2Evidence),
        ],
      }),
      page({
        pageNumber: 1,
        actionBeatIds: [sourceBeatA, sourceBeatA, sourceBeatB, sourceBeatB],
        coverageRecords: [
          coverage(sourceBeatA, page1Evidence),
          coverage(sourceBeatB, page1Evidence),
          coverage(collidingGeneratedBeat, page1Evidence, {
            kind: 'non_visual',
            rationale: 'narrative_context',
          }),
        ],
      }),
    ];

    const first = normalizeExactActionBindingComponents({
      pages,
      sourceEvidenceCatalog: sourceCatalog,
    });
    const second = normalizeExactActionBindingComponents({
      pages,
      sourceEvidenceCatalog: sourceCatalog,
    });

    expect(first).toEqual(second);
    expect(
      first.normalizations.map((normalization) => [
        normalization.pageNumber,
        normalization.sourceBeatId,
      ]),
    ).toEqual([
      [1, sourceBeatB],
      [1, sourceBeatA],
      [2, 'beat:p2:component_c'],
      [2, 'beat:p2:component_d'],
      [2, 'beat:p2:component_e'],
      [2, 'beat:p2:component_f'],
    ]);
    expect(first.normalizations).toHaveLength(6);
    const pageOneActionBeats = (
      first.pages[1]!.actionRequirements as Array<Record<string, unknown>>
    ).map((candidate) => candidate.beatId);
    expect(pageOneActionBeats).not.toContain(collidingGeneratedBeat);
    expect(pageOneActionBeats).toContain(`${collidingGeneratedBeat}_1`);
    expect(
      first.normalizations.flatMap(
        (normalization) => normalization.generatedBindings,
      ),
    ).toHaveLength(6);
  });

  it.each([
    ['multiple coverage records', (sourceCatalog: SourceEvidenceCatalog) => {
      const evidenceId = sourceEvidenceId(sourceCatalog, 1);
      const beatId = 'beat:p1:shared';
      return page({
        pageNumber: 1,
        actionBeatIds: [beatId, beatId],
        coverageRecords: [
          coverage(beatId, evidenceId),
          coverage(beatId, evidenceId, {
            kind: 'non_visual',
            rationale: 'narrative_context',
          }),
        ],
      });
    }],
    ['non-action coverage', (sourceCatalog: SourceEvidenceCatalog) => {
      const evidenceId = sourceEvidenceId(sourceCatalog, 1);
      const beatId = 'beat:p1:shared';
      return page({
        pageNumber: 1,
        actionBeatIds: [beatId, beatId],
        coverageRecords: [
          coverage(beatId, evidenceId, {
            kind: 'non_visual',
            rationale: 'narrative_context',
          }),
        ],
      });
    }],
    ['coverage with an extra key', (sourceCatalog: SourceEvidenceCatalog) => {
      const evidenceId = sourceEvidenceId(sourceCatalog, 1);
      const beatId = 'beat:p1:shared';
      return page({
        pageNumber: 1,
        actionBeatIds: [beatId, beatId],
        coverageRecords: [
          { ...coverage(beatId, evidenceId), extra: true },
        ],
      });
    }],
    ['malformed source evidence', () => {
      const beatId = 'beat:p1:shared';
      return page({
        pageNumber: 1,
        actionBeatIds: [beatId, beatId],
        coverageRecords: [coverage(beatId, 'se1_bad')],
      });
    }],
    ['wrong-page source evidence', (sourceCatalog: SourceEvidenceCatalog) => {
      const beatId = 'beat:p1:shared';
      return page({
        pageNumber: 1,
        actionBeatIds: [beatId, beatId],
        coverageRecords: [
          coverage(beatId, sourceEvidenceId(sourceCatalog, 2)),
        ],
      });
    }],
    ['invalid page-scoped beat', (sourceCatalog: SourceEvidenceCatalog) => {
      const evidenceId = sourceEvidenceId(sourceCatalog, 1);
      const beatId = 'beat:p2:shared';
      return page({
        pageNumber: 1,
        actionBeatIds: [beatId, beatId],
        coverageRecords: [coverage(beatId, evidenceId)],
      });
    }],
  ])('leaves an ineligible %s component byte-identical', (_name, buildPage) => {
    const sourceCatalog = catalog();
    const input = [buildPage(sourceCatalog)];
    const before = structuredClone(input);

    const result = normalizeExactActionBindingComponents({
      pages: input,
      sourceEvidenceCatalog: sourceCatalog,
    });

    expect(result.normalizations).toEqual([]);
    expect(result.pages).toEqual(before);
    expect(input).toEqual(before);
  });

  it('leaves duplicate page authority unchanged', () => {
    const sourceCatalog = catalog();
    const evidenceId = sourceEvidenceId(sourceCatalog, 1);
    const beatId = 'beat:p1:shared';
    const repeated = page({
      pageNumber: 1,
      actionBeatIds: [beatId, beatId],
      coverageRecords: [coverage(beatId, evidenceId)],
    });
    const input = [repeated, structuredClone(repeated)];

    const result = normalizeExactActionBindingComponents({
      pages: input,
      sourceEvidenceCatalog: sourceCatalog,
    });

    expect(result.normalizations).toEqual([]);
    expect(result.pages).toEqual(input);
  });
});
