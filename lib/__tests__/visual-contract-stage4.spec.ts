import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  computeVisualContractHash,
  validateBookVisualContract,
  assertValidBookVisualContractTemplate,
  migrateLegacyBookVisualContractTemplateV1,
  migrateLegacyBookVisualContractTemplateV3,
  migrateBookVisualContractTemplateTimeOfDayAuthority,
  projectPageMustShow,
  projectPageMustShowLegacySpatial,
  projectPageMustNotShow,
  projectCoverMustNotShow,
  projectZoneStableGeometry,
  resolvePageCheckIds,
  sourceEvidenceErrors,
  type BookVisualContract,
  type VisualZone,
} from '@/lib/visual-contract-compiler';
import {
  appendCompilerOwnedPageProjections,
} from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';

/**
 * Stage 4 — DETERMINISTIC COMPILER REJECTIONS + TIER-B projection containment.
 *
 * Stage 3 shipped the structured schema and the projections (Tier B pure + unwired). Stage 4 makes the compiler
 * reject deterministically at AUTHORING time, and wires containment. Every error here is precise and
 * repair-loop-consumable (the bounded loop hands the LLM the exact validator errors, and it only gets 2 attempts —
 * so a vague error is a wasted attempt).
 *
 * The invariant from Stage 3 is unchanged and re-proven here: every rule fires only when the new structure is
 * PRESENT, so the shipped v1 artifacts still validate and still hash identically.
 */

function baseContract(): BookVisualContract {
  return {
    version: 1,
    worldType: 'realistic_clinic',
    forbiddenGlobalElements: ['no outdoor nature'],
    locations: [
      { id: 'clinic', name: 'Clinic', description: 'a friendly clinic', anchors: [{ id: 'reception_desk', description: 'the reception desk' }] },
    ],
    zones: [{ id: 'clinic.exam', locationId: 'clinic', name: 'Exam', description: 'the exam room' }],
    cast: {
      child: { id: 'child:hero', role: 'child', wardrobe: { description: 'everyday outfit' } },
      companion: { id: 'companion:buni', role: 'companion', wardrobe: { description: 'heart badge' } },
    },
    recurringProps: [
      { id: 'exam_chair', name: 'Examination chair', description: 'the tall chair' },
      { id: 'syringe', name: 'Syringe', description: 'the injection' },
    ],
    coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', timeOfDay: 'day', mustShow: [], mustNotShow: [] },
    pageContracts: [
      {
        pageNumber: 1,
        locationId: 'clinic',
        zoneId: 'clinic.exam',
        sameLocationAs: null,
        mustShow: [],
        mustNotShow: [],
        characterPresence: { child: true, companion: false },
        propState: [],
        camera: 'medium 3/4',
        castIds: ['child:hero'],
        transition: { kind: 'steady' },
      },
      {
        pageNumber: 2,
        locationId: 'clinic',
        zoneId: 'clinic.exam',
        sameLocationAs: 1,
        mustShow: [],
        mustNotShow: [],
        characterPresence: { child: true, companion: false },
        propState: [],
        camera: 'wide',
        castIds: ['child:hero'],
        transition: { kind: 'steady' },
      },
    ],
  } as unknown as BookVisualContract;
}

const NODES = [
  { id: 'floor', kind: 'floor', description: 'a pale vinyl floor' },
  { id: 'chair', kind: 'furniture', description: 'the tall examination chair' },
  { id: 'window', kind: 'window', description: 'a window at child height' },
];

/** Attach the prose each page's structure projects, so TIER-B containment is satisfied by construction. */
function withProjectedProse(contract: BookVisualContract): BookVisualContract {
  const projected = structuredClone(contract);
  projected.coverContract.mustNotShow = [
    ...new Set([
      ...(projected.coverContract?.mustNotShow ?? []),
      ...projectCoverMustNotShow(projected),
    ]),
  ];
  appendCompilerOwnedPageProjections(projected as never);
  return projected;
}

/** Build a contract with a structured zone + a patched page 1, prose-completed. `ok()` → did it validate? */
function build(patch: { zone?: Record<string, unknown>; page1?: Record<string, unknown>; props?: unknown }) {
  const c = baseContract();
  const zoneBase = { ...c.zones[0], spatialNodes: NODES, ...(patch.zone ?? {}) } as unknown as VisualZone;
  const zone = { ...zoneBase, stableGeometry: projectZoneStableGeometry(zoneBase) } as VisualZone;
  const draft = {
    ...c,
    ...(patch.props !== undefined ? { recurringProps: patch.props } : {}),
    zones: [zone],
    pageContracts: [{ ...c.pageContracts[0], ...(patch.page1 ?? {}) }, c.pageContracts[1]],
  } as unknown as BookVisualContract;
  return withProjectedProse(draft);
}
const ok = (patch: Parameters<typeof build>[0]) => validateBookVisualContract(build(patch)).ok;
const errorsOf = (patch: Parameters<typeof build>[0]) => {
  const r = validateBookVisualContract(build(patch));
  return r.ok ? [] : r.errors;
};

const ACTION = { checkId: 'action:sits_on_chair', subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } }, predicate: 'sits_on', object: { kind: 'prop', id: 'exam_chair' }, polarity: 'must' };

describe('Stage 4 — the baseline still holds (additive proof)', () => {
  it('THE CANARY: the shipped bunny contract still validates and hashes to its pinned literal', () => {
    const artifact = JSON.parse(readFileSync('story-bank/v3-approved/bunny_ometz_adventure.visual-contract.json', 'utf8'));
    expect(computeVisualContractHash(artifact)).toBe('1ecfdcb2cd11477d80258da32dd09a3d42cdb693a6b4b25c28da741a37a5a0b6');
    expect(validateBookVisualContract(artifact).ok).toBe(true);
  });

  it('historical vc-schema/v1 templates cannot become current vc-schema/v4 authority', () => {
    for (const key of ['bunny_ometz_adventure', 'fox_uri_adventure']) {
      const template = JSON.parse(readFileSync(`story-bank/v3-approved/${key}.visual-contract-template.json`, 'utf8'));
      expect(() => assertValidBookVisualContractTemplate(template)).toThrow(
        /vc-schema\/v4.*vc-schema\/v1/,
      );
    }
  });

  it('migrates prior-current vc-schema/v3 offline without mutation while loaders fail closed', () => {
    const historical = JSON.parse(
      readFileSync(
        'story-bank/v3-approved/bunny_ometz_adventure.visual-contract-template.json',
        'utf8',
      ),
    );
    const priorCurrent = structuredClone(
      migrateLegacyBookVisualContractTemplateV1(historical),
    ) as unknown as Record<string, unknown>;
    const priorV2 = structuredClone(priorCurrent);
    priorV2.schemaVersion = 'vc-schema/v2';
    expect(() =>
      assertValidBookVisualContractTemplate(priorV2),
    ).toThrow(/vc-schema\/v4.*vc-schema\/v2/);
    priorCurrent.schemaVersion = 'vc-schema/v3';
    const before = structuredClone(priorCurrent);
    expect(() =>
      assertValidBookVisualContractTemplate(priorCurrent),
    ).toThrow(/vc-schema\/v4.*vc-schema\/v3/);
    const migrated = migrateLegacyBookVisualContractTemplateV3(
      priorCurrent,
    );
    expect(migrated.schemaVersion).toBe('vc-schema/v4');
    expect(priorCurrent).toEqual(before);
    const { schemaVersion: _beforeVersion, ...beforePayload } = before;
    const { schemaVersion: _afterVersion, ...afterPayload } = migrated;
    expect(afterPayload).toEqual(beforePayload);
  });

  it('migrates current-schema open time authority offline without mutating or widening any other field', () => {
    const historical = JSON.parse(
      readFileSync(
        'story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json',
        'utf8',
      ),
    );
    const current = migrateLegacyBookVisualContractTemplateV1(historical, {
      areaZoneIds: {
        set_room_balcony_night: {
          board_room_openings: ['z_room_window', 'z_window_threshold'],
          board_balcony: ['z_balcony_railing', 'z_balcony_bucket_corner'],
        },
      },
      pageZoneNodeIds: {
        z_balcony_railing: { railing: 'metal_railing' },
      },
    });
    current.locations[0]!.timeOfDay = 'evening into night' as never;
    current.coverContract.timeOfDay = 'evening' as never;
    current.setBoardAuthorities![0]!.locations[0]!.timeOfDay =
      'evening into night' as never;
    const before = structuredClone(current);

    expect(() => assertValidBookVisualContractTemplate(current)).toThrow(
      /timeOfDay/,
    );
    const migrated =
      migrateBookVisualContractTemplateTimeOfDayAuthority(current);

    expect(migrated.locations[0]!.timeOfDay).toBe('mixed');
    expect(migrated.coverContract.timeOfDay).toBe('dusk');
    expect(
      migrated.setBoardAuthorities![0]!.locations[0]!.timeOfDay,
    ).toBe('mixed');
    expect(current).toEqual(before);
    expect(migrated).not.toBe(current);
    expect(() => assertValidBookVisualContractTemplate(migrated)).not.toThrow();

    const maskTimeAuthority = (value: typeof current) => {
      const masked = structuredClone(value);
      for (const location of masked.locations) location.timeOfDay = 'day';
      masked.coverContract.timeOfDay = 'day';
      for (const authority of masked.setBoardAuthorities ?? []) {
        for (const location of authority.locations) location.timeOfDay = 'day';
      }
      return masked;
    };
    expect(maskTimeAuthority(migrated)).toEqual(maskTimeAuthority(current));
  });

  it('refuses to guess an unmappable current-schema time during offline migration', () => {
    const historical = JSON.parse(
      readFileSync(
        'story-bank/v3-approved/bunny_ometz_adventure.visual-contract-template.json',
        'utf8',
      ),
    );
    const current = migrateLegacyBookVisualContractTemplateV1(historical);
    current.locations[0]!.timeOfDay = 'purple hour' as never;
    const before = structuredClone(current);
    expect(() =>
      migrateBookVisualContractTemplateTimeOfDayAuthority(current),
    ).toThrow(/timeOfDay/);
    expect(current).toEqual(before);
  });

  it('a structure-free contract is untouched, and a well-formed structured one passes', () => {
    expect(validateBookVisualContract(baseContract()).ok).toBe(true);
    expect(ok({ page1: { propConstraints: [{ propId: 'exam_chair', visibility: 'required' }] } })).toBe(true);
  });
});

describe('Stage 4 — malformed referenced spatial prose stays classifiable', () => {
  it.each([
    ['omitted', undefined],
    ['null', null],
  ])(
    '%s description cannot make compiler-owned projection throw before validation',
    (_label, description) => {
      const contract = baseContract();
      const zone = {
        ...contract.zones[0],
        spatialNodes: structuredClone(NODES),
      } as unknown as VisualZone;
      const floor = zone.spatialNodes![0]! as unknown as Record<string, unknown>;
      if (description === undefined) delete floor.description;
      else floor.description = description;
      contract.zones = [zone];
      contract.pageContracts[0]!.safetyConstraints = [
        {
          subjectId: 'child:hero',
          relation: 'must_not_sit_on',
          target: { kind: 'spatial', id: 'floor' },
          origin: { kind: 'authored', authorNote: 'malformed-node totality probe' },
        },
      ];

      expect(() =>
        appendCompilerOwnedPageProjections(contract as never),
      ).not.toThrow();
      expect(contract.pageContracts[0]!.mustNotShow.join(' ')).toContain(
        'spatial:floor',
      );

      let result: ReturnType<typeof validateBookVisualContract> | undefined;
      expect(() => {
        result = validateBookVisualContract(contract as never);
      }).not.toThrow();
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.errors.join('\n')).toContain('description missing');
      }
    },
  );
});

describe('Stage 4 — compiler-owned page prose projection', () => {
  it('appends only missing exact projections without moving authored pointer indexes and is idempotent', () => {
    const contract = baseContract();
    const page = contract.pageContracts[0]!;
    page.propConstraints = [
      { propId: 'exam_chair', visibility: 'required' },
      { propId: 'syringe', visibility: 'forbidden' },
    ];
    page.actionRequirements = [ACTION] as never;
    const projectedShow = projectPageMustShow(page, contract);
    const projectedNotShow = projectPageMustNotShow(page, contract);
    expect(projectedShow.length).toBeGreaterThan(1);
    expect(projectedNotShow.length).toBeGreaterThan(0);
    page.mustShow = ['authored extra', projectedShow[0]!];
    page.mustNotShow = ['authored exclusion'];
    const originalShow = [...page.mustShow];
    const originalNotShow = [...page.mustNotShow];
    const expectedShow = [
      ...originalShow,
      ...projectedShow.filter((value) => !originalShow.includes(value)),
    ];
    const expectedNotShow = [
      ...originalNotShow,
      ...projectedNotShow.filter(
        (value) => !originalNotShow.includes(value),
      ),
    ];

    appendCompilerOwnedPageProjections(contract as never);
    expect(page.mustShow).toEqual(expectedShow);
    expect(page.mustNotShow).toEqual(expectedNotShow);
    expect(page.mustShow.slice(0, originalShow.length)).toEqual(
      originalShow,
    );
    expect(page.mustNotShow.slice(0, originalNotShow.length)).toEqual(
      originalNotShow,
    );
    const once = structuredClone(contract);
    appendCompilerOwnedPageProjections(contract as never);
    expect(contract).toEqual(once);
  });

  it('leaves every malformed prose array untouched so validation still fails closed', () => {
    for (const malformed of [42, [null], [''], ['   ']]) {
      const contract = baseContract();
      const page = contract.pageContracts[0]!;
      page.propConstraints = [
        { propId: 'exam_chair', visibility: 'required' },
      ];
      const stored = structuredClone(malformed);
      (page as unknown as Record<string, unknown>).mustShow = stored;

      appendCompilerOwnedPageProjections(contract as never);
      expect(
        (page as unknown as Record<string, unknown>).mustShow,
      ).toBe(stored);
      expect(validateBookVisualContract(contract).ok).toBe(false);
    }
  });

  it('upgrades duplicate same-kind legacy projections one-to-one and rebinds exact presentation values', () => {
    const contract = baseContract();
    const zone = contract.zones[0]!;
    zone.spatialNodes = [
      { id: 'rear_rail', kind: 'railing', description: 'Low fountain rim behind the stone.' },
      { id: 'forward_rail', kind: 'railing', description: 'Slim guide rail toward the gate.' },
    ];
    zone.stableGeometry = projectZoneStableGeometry(zone);
    const page = contract.pageContracts[0]!;
    page.actionRequirements = [
      {
        checkId: 'action:look_back',
        subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } },
        predicate: 'looks_at',
        object: { kind: 'spatial', id: 'rear_rail' },
        polarity: 'must',
      },
      {
        checkId: 'action:look_forward',
        subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } },
        predicate: 'looks_at',
        object: { kind: 'spatial', id: 'forward_rail' },
        polarity: 'must',
      },
    ] as never;
    page.mustShow = projectPageMustShowLegacySpatial(page, contract);
    expect(page.mustShow).toEqual([
      'the child looks at the railing',
      'the child looks at the railing',
    ]);
    const coverage = [{
      pageNumber: 1,
      disposition: {
        kind: 'presentation_requirement',
        presentationClass: 'static_state',
        contractPointer: '/pageContracts/0/mustShow/0',
        contractValue: 'the child looks at the railing',
      },
    }];

    appendCompilerOwnedPageProjections(contract as never, coverage as never);

    expect(page.mustShow).toEqual(projectPageMustShow(page, contract));
    expect(coverage[0]!.disposition.contractValue).toBe(
      'the child looks at the low fountain rim behind the stone [spatial:rear_rail]',
    );
    expect(validateBookVisualContract(contract).ok).toBe(true);
  });

  it('rejects one kind-only legacy line as authority for two distinct spatial claims', () => {
    const contract = baseContract();
    const zone = contract.zones[0]!;
    zone.spatialNodes = [
      { id: 'rear_rail', kind: 'railing', description: 'Low fountain rim behind the stone.' },
      { id: 'forward_rail', kind: 'railing', description: 'Slim guide rail toward the gate.' },
    ];
    zone.stableGeometry = projectZoneStableGeometry(zone);
    const page = contract.pageContracts[0]!;
    page.actionRequirements = [
      {
        checkId: 'action:look_back',
        subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } },
        predicate: 'looks_at',
        object: { kind: 'spatial', id: 'rear_rail' },
        polarity: 'must',
      },
      {
        checkId: 'action:look_forward',
        subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } },
        predicate: 'looks_at',
        object: { kind: 'spatial', id: 'forward_rail' },
        polarity: 'must',
      },
    ] as never;
    page.mustShow = ['the child looks at the railing'];

    const result = validateBookVisualContract(contract);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected ambiguous legacy rejection');
    expect(result.errors.join('\n')).toContain(
      'maps to 2 current spatial claims',
    );
  });
});

describe('Stage 4 — DECISION: PropVisibility "optional" is dropped', () => {
  it('"optional" is now rejected at runtime — it emitted no steering yet moved the frozen hash', () => {
    const errors = errorsOf({ page1: { propConstraints: [{ propId: 'exam_chair', visibility: 'optional' }] } });
    expect(errors.join(' ')).toContain('visibility "optional" is not one of');
    // The two survivors are the only ones that steer anything.
    expect(ok({ page1: { propConstraints: [{ propId: 'exam_chair', visibility: 'required' }] } })).toBe(true);
    expect(ok({ page1: { propConstraints: [{ propId: 'exam_chair', visibility: 'forbidden' }] } })).toBe(true);
  });
});

describe('Stage 4 — TIER-B containment: projection ⊆ stored (never equality)', () => {
  const c = baseContract();
  const structured = {
    ...c,
    pageContracts: [{ ...c.pageContracts[0], propConstraints: [{ propId: 'exam_chair', visibility: 'required' }] }, c.pageContracts[1]],
  } as unknown as BookVisualContract;

  it('projection ⊆ stored → passes', () => {
    expect(validateBookVisualContract(withProjectedProse(structured)).ok).toBe(true);
  });

  it('a projected requirement DROPPED from stored → rejected, naming what is missing', () => {
    // stored prose says nothing about the chair, though the structure REQUIRES it.
    const r = validateBookVisualContract(structured);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join(' ')).toContain('does not CONTAIN its structure’s projection'.replace('’', "'"));
      expect(r.errors.join(' ')).toContain('Examination chair');
    }
  });

  it('EXTRA stored steering is allowed — containment, not equality (zone exclusions / style guards survive)', () => {
    const withExtra = withProjectedProse(structured);
    const padded = {
      ...withExtra,
      pageContracts: [
        {
          ...withExtra.pageContracts[0],
          mustShow: [...withExtra.pageContracts[0].mustShow, 'warm afternoon light', 'no nature visible'],
          mustNotShow: [...withExtra.pageContracts[0].mustNotShow, 'trees'],
        },
        withExtra.pageContracts[1],
      ],
    } as unknown as BookVisualContract;
    expect(validateBookVisualContract(padded).ok).toBe(true);
  });

  it('the COVER must contain the prop-lifecycle projection (a revealed-later prop IS a cover spoiler)', () => {
    const spoiler = {
      ...c,
      recurringProps: [c.recurringProps[0], { ...c.recurringProps[1], firstRevealPage: 2 }],
      pageContracts: [
        {
          ...c.pageContracts[0],
          propConstraints: [{ propId: 'syringe', visibility: 'forbidden' }],
        },
        c.pageContracts[1],
      ],
    } as unknown as BookVisualContract;
    expect(validateBookVisualContract(spoiler).ok).toBe(false);
    expect(validateBookVisualContract(withProjectedProse(spoiler)).ok).toBe(true);
  });
});

describe('Stage 4 — reject rule: prop lifecycle (firstRevealPage)', () => {
  it('requires an explicit forbidden constraint on every pre-reveal page', () => {
    const c = baseContract();
    const contract = {
      ...c,
      recurringProps: [{ ...c.recurringProps[0], firstRevealPage: 2 }, c.recurringProps[1]],
    } as unknown as BookVisualContract;
    const result = validateBookVisualContract(withProjectedProse(contract));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('must explicitly FORBID');
  });

  it('a prop REQUIRED before its firstRevealPage → rejected', () => {
    const errors = errorsOf({
      props: [{ id: 'exam_chair', name: 'Examination chair', description: 'c', firstRevealPage: 2 }],
      page1: { propConstraints: [{ propId: 'exam_chair', visibility: 'required' }] },
    });
    expect(errors.join(' ')).toContain('BEFORE its firstRevealPage');
  });

  it('the SAME prop required ON/after its firstRevealPage → allowed', () => {
    const c = baseContract();
    const contract = {
      ...c,
      recurringProps: [{ ...c.recurringProps[0], firstRevealPage: 2 }, c.recurringProps[1]],
      pageContracts: [
        {
          ...c.pageContracts[0],
          propConstraints: [{ propId: 'exam_chair', visibility: 'forbidden' }],
        },
        { ...c.pageContracts[1], propConstraints: [{ propId: 'exam_chair', visibility: 'required' }] },
      ],
    } as unknown as BookVisualContract;
    expect(validateBookVisualContract(withProjectedProse(contract)).ok).toBe(true);
  });

  it('a firstRevealPage beyond the last page → rejected', () => {
    const errors = errorsOf({ props: [{ id: 'exam_chair', name: 'Examination chair', description: 'c', firstRevealPage: 99 }] });
    expect(errors.join(' ')).toContain('beyond the book');
  });
});

describe('Stage 4 — reject rule: relation coherence', () => {
  it('a node related to ITSELF → rejected', () => {
    expect(errorsOf({ zone: { spatialRelations: [{ subjectId: 'chair', relation: 'above', objectId: 'chair' }] } }).join(' '))
      .toContain('to itself');
  });

  it('the SAME fact declared twice (incl. via the inverse spelling) → rejected as a duplicate', () => {
    expect(errorsOf({ zone: { spatialRelations: [
      { subjectId: 'window', relation: 'above', objectId: 'chair' },
      { subjectId: 'window', relation: 'above', objectId: 'chair' },
    ] } }).join(' ')).toContain('duplicates the relation');
    // below(chair, window) IS above(window, chair) — canonicalized, so the duplicate is caught.
    expect(errorsOf({ zone: { spatialRelations: [
      { subjectId: 'window', relation: 'above', objectId: 'chair' },
      { subjectId: 'chair', relation: 'below', objectId: 'window' },
    ] } }).join(' ')).toContain('duplicates the relation');
    // ...and a symmetric relation is order-independent.
    expect(errorsOf({ zone: { spatialRelations: [
      { subjectId: 'window', relation: 'adjacent_to', objectId: 'chair' },
      { subjectId: 'chair', relation: 'adjacent_to', objectId: 'window' },
    ] } }).join(' ')).toContain('duplicates the relation');
  });

  it('contradictory relations → rejected (each above the other; same-wall AND opposite)', () => {
    expect(errorsOf({ zone: { spatialRelations: [
      { subjectId: 'window', relation: 'above', objectId: 'chair' },
      { subjectId: 'chair', relation: 'above', objectId: 'window' },
    ] } }).join(' ')).toContain('cannot each be above the other');
    expect(errorsOf({ zone: { spatialRelations: [
      { subjectId: 'window', relation: 'on_same_wall_as', objectId: 'chair' },
      { subjectId: 'window', relation: 'opposite_to', objectId: 'chair' },
    ] } }).join(' ')).toContain('cannot both hold');
  });

  it('coherent relations → allowed', () => {
    expect(ok({ zone: { spatialRelations: [
      { subjectId: 'window', relation: 'above', objectId: 'chair' },
      { subjectId: 'chair', relation: 'centered_in' },
    ] } })).toBe(true);
  });
});

describe('Stage 4 — reject rule: a required action conflicting with a visibility or safety constraint', () => {
  it('enforces catalog object-kind and laterality rules for corpus-derived predicates', () => {
    const common = {
      checkId: 'action:catalog_rule',
      subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } },
      polarity: 'must',
    };
    expect(errorsOf({ page1: { actionRequirements: [{
      ...common,
      predicate: 'opens',
    }] } }).join(' ')).toContain('object is required');
    expect(errorsOf({ page1: { actionRequirements: [{
      ...common,
      predicate: 'walks',
      object: { kind: 'prop', id: 'exam_chair' },
    }] } }).join(' ')).toContain('object is forbidden');
    expect(errorsOf({ page1: { actionRequirements: [{
      ...common,
      predicate: 'places',
      object: { kind: 'cast', id: 'child:hero' },
    }] } }).join(' ')).toContain('object.kind "cast" is not allowed');
    expect(errorsOf({ page1: { actionRequirements: [{
      ...common,
      predicate: 'looks_at',
      laterality: 'left',
    }] } }).join(' ')).toContain('laterality is forbidden');
  });

  it('a REQUIRED action on a FORBIDDEN prop → rejected', () => {
    expect(errorsOf({ page1: {
      propConstraints: [{ propId: 'exam_chair', visibility: 'forbidden' }],
      actionRequirements: [ACTION],
    } }).join(' ')).toContain('FORBIDS that prop on this page');
  });

  it('a REQUIRED action that is exactly what a hazard prohibits → rejected', () => {
    expect(errorsOf({ page1: {
      actionRequirements: [ACTION],
      safetyConstraints: [{
        subjectId: 'child:hero',
        relation: 'must_not_sit_on',
        target: { kind: 'prop', id: 'exam_chair' },
        origin: { kind: 'authored', authorNote: 'the chair is not a seat here' },
      }],
    } }).join(' ')).toContain('requires the hazard it forbids');
  });

  it('the same beat declared BOTH must and must_not → rejected', () => {
    expect(errorsOf({ page1: { actionRequirements: [ACTION, { ...ACTION, checkId: 'action:not_sits', polarity: 'must_not' }] } }).join(' '))
      .toContain('BOTH must and must_not');
  });

  it('a hazard on a DIFFERENT target than the required action → allowed (no false positive)', () => {
    expect(ok({ page1: {
      actionRequirements: [ACTION],
      safetyConstraints: [{
        subjectId: 'child:hero',
        relation: 'must_not_sit_on',
        target: { kind: 'spatial', id: 'floor' },
        origin: { kind: 'authored', authorNote: 'not on the floor' },
      }],
    } })).toBe(true);
  });
});

describe('Stage 4 — reject rule: every enforcement-relevant claim resolves to a UNIQUE checkId', () => {
  it('attributes a duplicate authored action checkId to the closed action-collision cause', () => {
    const result = validateBookVisualContract(build({
      page1: {
        actionRequirements: [
          ACTION,
          {
            ...ACTION,
            predicate: 'looks_at',
            object: undefined,
          },
        ],
      },
    }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected duplicate action rejection');
    expect(result.errors).toEqual([
      expect.stringContaining('actionRequirements duplicate checkId'),
    ]);
    expect(result.diagnosticIssues).toEqual([{
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: 1,
      },
      causes: ['page_action_check_id_collision_invalid'],
    }]);
  });

  it('restores action-requirements attribution after a duplicate action checkId', () => {
    const result = validateBookVisualContract(build({
      page1: {
        actionRequirements: [
          ACTION,
          {
            ...ACTION,
            polarity: 'invalid',
          },
        ],
      },
    }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected duplicate invalid action rejection');
    expect(result.errors).toEqual([
      expect.stringContaining('actionRequirements duplicate checkId'),
      expect.stringContaining("polarity \"invalid\" must be 'must' or 'must_not'"),
    ]);
    expect(
      result.diagnosticIssues.map((issue) =>
        'causes' in issue ? issue.causes : null,
      ),
    ).toEqual([
      ['page_action_check_id_collision_invalid'],
      ['page_action_requirements_invalid'],
    ]);
  });

  it('two claims colliding on one resolved checkId → rejected (Stage 5 binds exactly one result per id)', () => {
    // The same prop + visibility twice mints one id twice.
    expect(errorsOf({ page1: { propConstraints: [
      { propId: 'exam_chair', visibility: 'required' },
      { propId: 'exam_chair', visibility: 'required' },
    ] } }).join(' ')).toContain('the same checkId');
  });

  it('keeps prop and safety resolved-check collisions separately attributed', () => {
    const propResult = validateBookVisualContract(build({
      page1: {
        propConstraints: [
          { propId: 'exam_chair', visibility: 'required' },
          { propId: 'exam_chair', visibility: 'required' },
        ],
      },
    }));
    expect(propResult.ok).toBe(false);
    if (propResult.ok) throw new Error('expected prop collision rejection');
    expect(propResult.errors).toEqual([
      expect.stringContaining('the same checkId'),
    ]);
    expect(propResult.diagnosticIssues).toEqual([{
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: 1,
      },
      causes: ['page_prop_check_id_collision_invalid'],
    }]);

    const safety = {
      subjectId: 'child:hero',
      relation: 'must_not_sit_on',
      target: { kind: 'prop', id: 'exam_chair' },
      origin: { kind: 'authored', authorNote: 'keep the child safe' },
    };
    const safetyResult = validateBookVisualContract(build({
      page1: {
        safetyConstraints: [safety, structuredClone(safety)],
      },
    }));
    expect(safetyResult.ok).toBe(false);
    if (safetyResult.ok) throw new Error('expected safety collision rejection');
    expect(safetyResult.errors).toEqual([
      expect.stringContaining('the same checkId'),
    ]);
    expect(safetyResult.diagnosticIssues).toEqual([{
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: 1,
      },
      causes: ['page_safety_check_id_collision_invalid'],
    }]);
  });

  it('resolvePageCheckIds mints stable, namespaced, disjoint ids for prop / action / safety claims', () => {
    const page = {
      propConstraints: [{ propId: 'exam_chair', visibility: 'required' }],
      actionRequirements: [ACTION],
      safetyConstraints: [{
        subjectId: 'child:hero',
        relation: 'must_not_sit_on',
        target: { kind: 'spatial', id: 'floor' },
        origin: { kind: 'authored', authorNote: 'n' },
      }],
    } as never;
    const ids = resolvePageCheckIds(page).map((c) => c.checkId);
    expect(ids).toEqual(['prop:required_exam_chair', 'action:sits_on_chair', 'safety:must_not_sit_on_child_hero_spatial_floor']);
    // deterministic
    expect(resolvePageCheckIds(page).map((c) => c.checkId)).toEqual(ids);
    // total over unvalidated input — never throws (the validator calls it mid-validation)
    expect(() => resolvePageCheckIds({ propConstraints: [null], safetyConstraints: [{ target: 7 }] } as never)).not.toThrow();
  });

  it('a page with no structure resolves to no checks (a v1 page has nothing to enforce)', () => {
    expect(resolvePageCheckIds(baseContract().pageContracts[0])).toEqual([]);
  });
});

describe('Stage 4 — reject rule: a source-evidence quote must occur on its claimed page', () => {
  const PAGES = [
    { pageNumber: 1, text: 'נֹעַם יָשַׁב עַל הַכִּסֵּא, לֹא עַל הָרִצְפָּה.' },
    { pageNumber: 2, text: 'הָרוֹפֵא חִיֵּךְ.' },
  ];
  const contractCiting = (origin: unknown) =>
    ({
      pageContracts: [
        { pageNumber: 1, safetyConstraints: [{ subjectId: 'child:hero', relation: 'must_not_sit_on', target: { kind: 'spatial', id: 'floor' }, origin }] },
      ],
    }) as unknown as BookVisualContract;

  it('a quote that IS on the cited page → no error (niqqud-insensitive)', () => {
    // The authored phrase carries no niqqud; the source does. Both are stripped before matching.
    expect(sourceEvidenceErrors(contractCiting({ kind: 'story_evidence', page: 1, phrase: 'לא על הרצפה' }), PAGES)).toEqual([]);
  });

  it('a quote that is NOT on the cited page → rejected', () => {
    const errors = sourceEvidenceErrors(contractCiting({ kind: 'story_evidence', page: 2, phrase: 'לא על הרצפה' }), PAGES);
    expect(errors.join(' ')).toContain('does not occur on page 2');
  });

  it('a citation of a page the story does not have → rejected', () => {
    expect(sourceEvidenceErrors(contractCiting({ kind: 'story_evidence', page: 9, phrase: 'x' }), PAGES).join(' '))
      .toContain('not one of the story');
  });

  it('non-story origins are not source-checked, and a structure-free contract yields nothing', () => {
    expect(sourceEvidenceErrors(contractCiting({ kind: 'authored', authorNote: 'n' }), PAGES)).toEqual([]);
    expect(sourceEvidenceErrors(baseContract(), PAGES)).toEqual([]);
  });
});

describe('Stage 4 — Stage-3 flag: mustShow / cover validation tightened (carefully)', () => {
  const c = baseContract();

  it('a BLANK entry is rejected on page mustShow/mustNotShow and on the cover', () => {
    const pageWith = (patch: Record<string, unknown>) =>
      validateBookVisualContract({ ...c, pageContracts: [{ ...c.pageContracts[0], ...patch }, c.pageContracts[1]] } as never).ok;
    expect(pageWith({ mustShow: [''] })).toBe(false);
    expect(pageWith({ mustNotShow: ['   '] })).toBe(false);
    const coverWith = (patch: Record<string, unknown>) =>
      validateBookVisualContract({ ...c, coverContract: { ...c.coverContract, ...patch } } as never).ok;
    expect(coverWith({ mustShow: [''] })).toBe(false);
    expect(coverWith({ mustNotShow: [''] })).toBe(false);
  });

  it('the cover is now validated AT ALL (it was validated nowhere)', () => {
    const coverWith = (patch: Record<string, unknown>) =>
      validateBookVisualContract({ ...c, coverContract: { ...c.coverContract, ...patch } } as never).ok;
    expect(coverWith({ mustShow: 'not an array' })).toBe(false);
    expect(coverWith({ mustNotShow: 42 })).toBe(false);
  });

  it('`[]` STAYS LEGAL — 2 of the 3 shipped artifacts author mustNotShow: [] and a load throw degrades silently', () => {
    const pageWith = (patch: Record<string, unknown>) =>
      validateBookVisualContract({ ...c, pageContracts: [{ ...c.pageContracts[0], ...patch }, c.pageContracts[1]] } as never).ok;
    expect(pageWith({ mustNotShow: [] })).toBe(true);
    expect(pageWith({ mustShow: [] })).toBe(true);
    expect(validateBookVisualContract({ ...c, coverContract: { ...c.coverContract, mustNotShow: [] } } as never).ok).toBe(true);
  });
});
