import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  computeVisualContractHash,
  validateBookVisualContract,
  assertValidBookVisualContractTemplate,
  projectPageMustShow,
  projectPageMustNotShow,
  projectCoverMustNotShow,
  projectZoneStableGeometry,
  resolvePageCheckIds,
  sourceEvidenceErrors,
  type BookVisualContract,
  type VisualZone,
} from '@/lib/visual-contract-compiler';

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
  const pageContracts = contract.pageContracts.map((p) => ({
    ...p,
    mustShow: [...(p.mustShow ?? []), ...projectPageMustShow(p, contract)],
    mustNotShow: [...(p.mustNotShow ?? []), ...projectPageMustNotShow(p, contract)],
  }));
  const coverContract = {
    ...contract.coverContract,
    mustNotShow: [...(contract.coverContract?.mustNotShow ?? []), ...projectCoverMustNotShow(contract)],
  };
  return { ...contract, pageContracts, coverContract } as unknown as BookVisualContract;
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

const ACTION = { checkId: 'action:sits_on_chair', actorId: 'child:hero', predicate: 'sits_on', object: { kind: 'prop', id: 'exam_chair' }, polarity: 'must' };

describe('Stage 4 — the baseline still holds (additive proof)', () => {
  it('THE CANARY: the shipped bunny contract still validates and hashes to its pinned literal', () => {
    const artifact = JSON.parse(readFileSync('story-bank/v3-approved/bunny_ometz_adventure.visual-contract.json', 'utf8'));
    expect(computeVisualContractHash(artifact)).toBe('1ecfdcb2cd11477d80258da32dd09a3d42cdb693a6b4b25c28da741a37a5a0b6');
    expect(validateBookVisualContract(artifact).ok).toBe(true);
  });

  it('both shipped TEMPLATES still validate (bunny authors no structure; fox is the hand-authored proof slot)', () => {
    for (const key of ['bunny_ometz_adventure', 'fox_uri_adventure']) {
      const template = JSON.parse(readFileSync(`story-bank/v3-approved/${key}.visual-contract-template.json`, 'utf8'));
      expect(() => assertValidBookVisualContractTemplate(template)).not.toThrow();
    }
  });

  it('a structure-free contract is untouched, and a well-formed structured one passes', () => {
    expect(validateBookVisualContract(baseContract()).ok).toBe(true);
    expect(ok({ page1: { propConstraints: [{ propId: 'exam_chair', visibility: 'required' }] } })).toBe(true);
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
      actorId: 'child:hero',
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
  it('two claims colliding on one resolved checkId → rejected (Stage 5 binds exactly one result per id)', () => {
    // The same prop + visibility twice mints one id twice.
    expect(errorsOf({ page1: { propConstraints: [
      { propId: 'exam_chair', visibility: 'required' },
      { propId: 'exam_chair', visibility: 'required' },
    ] } }).join(' ')).toContain('the same checkId');
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
