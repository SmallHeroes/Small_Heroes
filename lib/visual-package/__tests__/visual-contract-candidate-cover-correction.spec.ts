import { describe, expect, it } from 'vitest';

import type {
  BookVisualContractTemplate,
} from '../../visual-contract-compiler';
import {
  applyCoverVisibleRecurringPropOperations,
  buildCandidateCoverCorrectionApproval,
  candidateCoverCorrectionApprovalIsStructurallyValid,
  type CoverVisibleRecurringPropOperation,
} from '../visualContractCandidateCoverCorrection';

function templateFixture(): BookVisualContractTemplate {
  return {
    contractKind: 'template',
    schemaVersion: 'vc-schema/v4',
    version: '1.0',
    storyKey: 'fixture_story',
    worldType: 'fixture world',
    locations: [],
    zones: [],
    cast: {
      child: {
        id: 'child:hero',
        role: 'child',
        wardrobe: { description: 'fixed', forbidden: [] },
      },
    },
    humanCast: [],
    recurringProps: [
      {
        id: 'prop_lantern',
        name: 'Paper lantern',
        description: 'A paper lantern',
        firstRevealPage: 1,
      },
      {
        id: 'prop_cart',
        name: 'Small cart',
        description: 'A small cart',
        firstRevealPage: 1,
      },
      {
        id: 'prop_later',
        name: 'Later clue',
        description: 'A later clue',
        firstRevealPage: 4,
      },
    ],
    forbiddenGlobalElements: ['unrelated forbidden'],
    coverContract: {
      worldType: 'fixture world',
      locationId: 'loc_cover',
      zoneId: 'zone_cover',
      castIds: ['child:hero'],
      timeOfDay: 'dusk',
      mustShow: [
        'Child beside the paper lantern',
        'Small cart carrying the paper lantern',
      ],
      mustNotShow: [
        'unrelated cover prohibition',
        'Paper lantern (first revealed on page 1 — no spoiler)',
        'Small cart (first revealed on page 1 — no spoiler)',
        'Later clue (first revealed on page 4 — no spoiler)',
      ],
    },
    pageContracts: [],
  } as unknown as BookVisualContractTemplate;
}

function operations(): CoverVisibleRecurringPropOperation[] {
  return [
    {
      kind: 'cover_visible_recurring_prop',
      propId: 'prop_lantern',
      expectedFirstRevealPage: 1,
      expectedCoverMustShowIndex: 0,
      expectedCoverMustShowValue: 'Child beside the paper lantern',
      expectedCoverMustNotShowIndex: 1,
      expectedCoverMustNotShowValue:
        'Paper lantern (first revealed on page 1 — no spoiler)',
      decisionBasis: 'cover_hero_object_intentionally_visible',
    },
    {
      kind: 'cover_visible_recurring_prop',
      propId: 'prop_cart',
      expectedFirstRevealPage: 1,
      expectedCoverMustShowIndex: 1,
      expectedCoverMustShowValue: 'Small cart carrying the paper lantern',
      expectedCoverMustNotShowIndex: 2,
      expectedCoverMustNotShowValue:
        'Small cart (first revealed on page 1 — no spoiler)',
      decisionBasis: 'cover_hero_object_intentionally_visible',
    },
  ];
}

function approvalPacketFixture(): Parameters<
  typeof buildCandidateCoverCorrectionApproval
>[0]['packet'] {
  const digest = (value: string) => value.repeat(64);
  const subject = {
    storyKey: 'fixture_story',
    storyPath: 'story/fixture.md',
    sourceSnapshotDigest: digest('1'),
    candidateDigest: digest('2'),
    candidatePath: `outputs/candidates/${digest('2')}.json`,
    candidateValidationAttestationDigest: digest('3'),
    candidateValidationAttestationPath:
      `outputs/attestations/${digest('3')}.json`,
    templateDigest: digest('4'),
  };
  return {
    plan: { subject, digest: digest('5') },
    correction: {
      digest: digest('6'),
      effective: { templateDigest: digest('7') },
    },
    review: { digest: digest('8') },
    markdown: '# exact review\n',
    artifacts: {
      plan: { path: `outputs/plans/${digest('5')}.json` },
      correction: { path: `outputs/corrections/${digest('6')}.json` },
      review: { path: `outputs/reviews/${digest('8')}.json` },
      markdown: { path: `outputs/reviews/${digest('8')}.md` },
    },
  } as unknown as Parameters<
    typeof buildCandidateCoverCorrectionApproval
  >[0]['packet'];
}

describe('Visual Contract Candidate cover correction', () => {
  it('removes only the reviewed lifecycle projections and preserves the original bytes', () => {
    const original = templateFixture();
    const before = JSON.stringify(original);
    const result = applyCoverVisibleRecurringPropOperations({
      template: original,
      operations: operations(),
    });

    expect(JSON.stringify(original)).toBe(before);
    expect(result.template.recurringProps).toEqual([
      {
        id: 'prop_lantern',
        name: 'Paper lantern',
        description: 'A paper lantern',
      },
      {
        id: 'prop_cart',
        name: 'Small cart',
        description: 'A small cart',
      },
      {
        id: 'prop_later',
        name: 'Later clue',
        description: 'A later clue',
        firstRevealPage: 4,
      },
    ]);
    expect(result.template.coverContract.mustShow).toEqual(
      original.coverContract.mustShow,
    );
    expect(result.template.coverContract.mustNotShow).toEqual([
      'unrelated cover prohibition',
      'Later clue (first revealed on page 4 — no spoiler)',
    ]);
    expect(result.template.forbiddenGlobalElements).toEqual([
      'unrelated forbidden',
    ]);
    expect(result.changes).toHaveLength(2);
  });

  it.each([
    ['prop identity', (value: CoverVisibleRecurringPropOperation) => ({ ...value, propId: 'prop_other' })],
    ['lifecycle', (value: CoverVisibleRecurringPropOperation) => ({ ...value, expectedFirstRevealPage: 2 })],
    ['mustShow index', (value: CoverVisibleRecurringPropOperation) => ({ ...value, expectedCoverMustShowIndex: 1 })],
    ['mustShow value', (value: CoverVisibleRecurringPropOperation) => ({ ...value, expectedCoverMustShowValue: 'invented' })],
    ['mustNotShow index', (value: CoverVisibleRecurringPropOperation) => ({ ...value, expectedCoverMustNotShowIndex: 0 })],
    ['mustNotShow value', (value: CoverVisibleRecurringPropOperation) => ({ ...value, expectedCoverMustNotShowValue: 'invented' })],
  ])('rejects stale or cross-bound %s authority', (_label, mutate) => {
    const [first, second] = operations();
    expect(() =>
      applyCoverVisibleRecurringPropOperations({
        template: templateFixture(),
        operations: [mutate(first!), second!],
      }),
    ).toThrow('before-state is stale or cross-bound');
  });

  it('rejects duplicate operations and a replay against already-corrected authority', () => {
    const [first] = operations();
    expect(() =>
      applyCoverVisibleRecurringPropOperations({
        template: templateFixture(),
        operations: [first!, { ...first! }],
      }),
    ).toThrow('operations are duplicated');

    const corrected = applyCoverVisibleRecurringPropOperations({
      template: templateFixture(),
      operations: operations(),
    }).template;
    expect(() =>
      applyCoverVisibleRecurringPropOperations({
        template: corrected,
        operations: operations(),
      }),
    ).toThrow('before-state is stale or cross-bound');
  });

  it('rejects extra operation keys and an empty operation set', () => {
    expect(() =>
      applyCoverVisibleRecurringPropOperations({
        template: templateFixture(),
        operations: [],
      }),
    ).toThrow('operations are invalid');
    expect(() =>
      applyCoverVisibleRecurringPropOperations({
        template: templateFixture(),
        operations: [
          {
            ...operations()[0]!,
            hostileExtraKey: true,
          } as unknown as CoverVisibleRecurringPropOperation,
        ],
      }),
    ).toThrow('operation is invalid');
  });

  it('builds one closed exact Guy approval envelope', () => {
    const approval = buildCandidateCoverCorrectionApproval({
      packet: approvalPacketFixture(),
      approvedBy: 'Guy',
      approvedAt: '2026-08-29T17:30:00.000Z',
    });

    expect(candidateCoverCorrectionApprovalIsStructurallyValid(approval))
      .toBe(true);
    expect(approval.decision).toBe('approved');
    expect(approval.approvedBy).toBe('Guy');
    expect(approval.doesNotAuthorize).toContain('reconciliation_approval');
    expect(approval.doesNotAuthorize).not.toContain(
      'candidate_cover_correction_approval',
    );
  });

  it('rejects noncanonical approval identity, time, shape and binding fields', () => {
    const packet = approvalPacketFixture();
    expect(() =>
      buildCandidateCoverCorrectionApproval({
        packet,
        approvedBy: 'Codex' as 'Guy',
        approvedAt: '2026-08-29T17:30:00.000Z',
      }),
    ).toThrow('identity or timestamp is invalid');
    expect(() =>
      buildCandidateCoverCorrectionApproval({
        packet,
        approvedBy: 'Guy',
        approvedAt: '2026-02-30T17:30:00.000Z',
      }),
    ).toThrow('identity or timestamp is invalid');

    const approval = buildCandidateCoverCorrectionApproval({
      packet,
      approvedBy: 'Guy',
      approvedAt: '2026-08-29T17:30:00.000Z',
    });
    for (const hostile of [
      { ...approval, hostileExtraKey: true },
      { ...approval, approvedAt: '2026-08-29T17:30:00Z' },
      { ...approval, doesNotAuthorize: [] },
      {
        ...approval,
        subject: { ...approval.subject, candidateDigest: 'bad' },
      },
    ]) {
      expect(
        candidateCoverCorrectionApprovalIsStructurallyValid(hostile),
      ).toBe(false);
    }
  });
});
