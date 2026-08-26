import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import {
  computeVisualContractHash,
  validateBookVisualContract,
  assertValidBookVisualContractTemplate,
  buildVisualContractPromptBlock,
  buildPvbVisualContractFactsPromptBlock,
  buildContractVisionInstruction,
  derivePageVisualContracts,
  deriveCoverVisualContract,
  projectZoneStableGeometry,
  projectPageMustShow,
  projectPageMustShowLegacySpatial,
  projectPageMustNotShow,
  projectPageMustNotShowLegacySpatial,
  projectCoverMustNotShow,
  projectPageActionProse,
  projectPageProviderPromptProse,
  type BookVisualContract,
  type PageVisualContract,
  type VisualZone,
} from '@/lib/visual-contract-compiler';
import {
  canonicalizePageActionCastGroups,
} from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';
import {
  PAGE_PROP_CONSTRAINT_VIOLATION_CODES,
  classifyPagePropConstraints,
  pagePropConstraintViolationIsValid,
} from '@/lib/visual-contract-compiler/pagePropConstraintValidation';

/**
 * Stage 3 — Contract v2 STRUCTURED SCHEMA.
 *
 * Replaces prose-as-authority with typed structure (SpatialNode / SpatialRelation / PagePropConstraint /
 * PageActionRequirement / SafetyConstraint) and makes stableGeometry / mustShow / mustNotShow / action prose
 * deterministic PROJECTIONS of that structure rather than independently-editable gate authorities.
 *
 * The money-critical invariant is unchanged from Slice B: every v2 key is OPTIONAL and OMITTED when unauthored, so
 * every shipped contract hashes BYTE-IDENTICAL and keeps validating. A tightening that rejected a shipped artifact
 * would NOT fail loudly — the freeze path catches a contract-load throw and silently degrades to the legacy path —
 * so "additive-only" here is a correctness requirement, not politeness. Hence: every check fires only when the new
 * key is PRESENT, and the canary below pins the shipped hash.
 */

/** A minimal contract that passes the BASE validator — the fixture for the mechanism tests. */
function baseContract(): BookVisualContract {
  return {
    version: 1,
    worldType: 'realistic_clinic',
    forbiddenGlobalElements: ['no outdoor nature'],
    locations: [
      {
        id: 'clinic',
        name: 'Clinic',
        description: 'a friendly clinic',
        anchors: [{ id: 'reception_desk', description: 'the reception desk' }],
      },
    ],
    zones: [{ id: 'clinic.exam', locationId: 'clinic', name: 'Exam', description: 'the exam room' }],
    cast: { child: { id: 'child:hero', role: 'child', wardrobe: { description: 'everyday outfit' } } },
    recurringProps: [{ id: 'exam_chair', name: 'Examination chair', description: 'the tall chair' }],
    coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', timeOfDay: 'day', mustShow: [], mustNotShow: [] },
    pageContracts: [
      {
        pageNumber: 1,
        locationId: 'clinic',
        zoneId: 'clinic.exam',
        sameLocationAs: null,
        mustShow: ['the child seated'],
        mustNotShow: [],
        characterPresence: { child: true, companion: false },
        propState: [{ propId: 'exam_chair', state: 'the child seated on it' }],
        camera: 'medium 3/4',
        castIds: ['child:hero'],
        transition: { kind: 'steady' },
      },
    ],
  } as unknown as BookVisualContract;
}

const NODES = [
  { id: 'floor', kind: 'floor', description: 'a pale vinyl floor' },
  { id: 'chair', kind: 'furniture', description: 'the tall examination chair', bindsTo: { kind: 'prop', id: 'exam_chair' } },
];
const RELATIONS = [{ subjectId: 'chair', relation: 'centered_in' }];

/** A zone carrying structure — with `stableGeometry` set to its own projection (the Tier-A rule). */
function structuredZone(c: BookVisualContract): VisualZone {
  const z = { ...c.zones[0], spatialNodes: NODES, spatialRelations: RELATIONS } as unknown as VisualZone;
  return { ...z, stableGeometry: projectZoneStableGeometry(z) } as VisualZone;
}

/** A page carrying structure: one required prop, one positive action beat, one hazard prohibition. */
function structuredPage(c: BookVisualContract) {
  return {
    ...c.pageContracts[0],
    propConstraints: [{ propId: 'exam_chair', visibility: 'required' }],
    actionRequirements: [
      {
        checkId: 'action:sits_on_chair',
        subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } },
        predicate: 'sits_on',
        object: { kind: 'prop', id: 'exam_chair' },
        polarity: 'must',
      },
    ],
    safetyConstraints: [
      {
        subjectId: 'child:hero',
        relation: 'must_not_sit_on',
        target: { kind: 'spatial', id: 'floor' },
        origin: { kind: 'story_evidence', page: 1, phrase: 'not on the floor' },
      },
    ],
  };
}

/**
 * Attach the prose each page's own structure projects, so Stage-4 TIER-B CONTAINMENT is satisfied.
 *
 * Stage 4 wired the rule that the stored prose must CONTAIN the structure's projection (extra hand-authored steering
 * is still allowed). These Stage-3 fixtures author structure, so they must now carry its projection too — which is
 * exactly the authoring contract Stage 9's mint script will satisfy by construction. Projections are computed
 * against the FINAL contract, since a spatial ref's label resolves through the page's own zone.
 */
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

/** A fully structured contract (structured zone + structured page), prose-complete per TIER-B containment. */
function structuredContract(): BookVisualContract {
  const c = baseContract();
  return withProjectedProse({
    ...c,
    zones: [structuredZone(c)],
    pageContracts: [structuredPage(c)],
  } as unknown as BookVisualContract);
}

const V2_PAGE_KEYS = ['propConstraints', 'actionRequirements', 'safetyConstraints'] as const;

describe('Stage 3 — THE CANARY: the shipped artifacts still load, validate and hash unchanged', () => {
  it('the frozen bunny contract hashes to its pinned literal (any shape change trips this)', () => {
    // A deliberate departure from house style (no other test pins a hex literal): optional-additive fields must not
    // move a frozen hash, and this is the one change that could. Stage 9 re-mints and updates this literal ON PURPOSE.
    const artifact = JSON.parse(
      readFileSync('story-bank/v3-approved/bunny_ometz_adventure.visual-contract.json', 'utf8')
    );
    expect(computeVisualContractHash(artifact)).toBe(
      '1ecfdcb2cd11477d80258da32dd09a3d42cdb693a6b4b25c28da741a37a5a0b6'
    );
    expect(validateBookVisualContract(artifact).ok).toBe(true);
  });

  it('historical vc-schema/v1 templates remain byte-preserved but are rejected as current authority', () => {
    for (const key of ['bunny_ometz_adventure', 'fox_uri_adventure']) {
      const artifactPath = `story-bank/v3-approved/${key}.visual-contract-template.json`;
      const before = readFileSync(artifactPath);
      const template = JSON.parse(before.toString('utf8'));
      expect(() => assertValidBookVisualContractTemplate(template)).toThrow(
        /vc-schema\/v4.*vc-schema\/v1/,
      );
      expect(readFileSync(artifactPath)).toEqual(before);
    }
  });

  it('bunny is still pure-v1 — no zone authors structure, so the Tier-A switch stays OFF and its prose is untouched', () => {
    // The v1 compatibility proof. (fox is deliberately NOT here: it is the Contract-v2 PROOF slot and now
    // hand-authors structure — see fox-uri-adventure-structured-contract.spec.ts. That is exactly the per-ZONE,
    // per-artifact switch this schema was designed for: one artifact migrates without touching the others.)
    const bunny = JSON.parse(
      readFileSync('story-bank/v3-approved/bunny_ometz_adventure.visual-contract-template.json', 'utf8')
    );
    for (const z of bunny.zones) {
      expect(z.spatialNodes).toBeUndefined();
      expect(Array.isArray(z.stableGeometry)).toBe(true); // hand-authored prose, still authoritative for bunny
    }
  });
});

describe('Stage 3 — omitted-when-unauthored hash invariant, per new key', () => {
  it('omitted → byte-identical; [] → differs; null → differs; authored → re-hashes', () => {
    const c = baseContract();
    const h = computeVisualContractHash(c);

    const omitted = {
      ...c,
      zones: c.zones.map((z) => ({ ...z, spatialNodes: undefined, spatialRelations: undefined })),
      recurringProps: c.recurringProps.map((p) => ({ ...p, firstRevealPage: undefined })),
      pageContracts: c.pageContracts.map((p) => ({
        ...p,
        propConstraints: undefined,
        actionRequirements: undefined,
        safetyConstraints: undefined,
      })),
    } as unknown as BookVisualContract;
    expect(computeVisualContractHash(omitted)).toBe(h);

    // `[]` and `null` are NOT the same as omitting — they serialize, so they move the frozen hash.
    for (const key of V2_PAGE_KEYS) {
      expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 1, [key]: [] }));
      expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 1, [key]: null }));
      expect(canonicalHash({ a: 1 })).toBe(canonicalHash({ a: 1, [key]: undefined }));
    }

    // Authoring real structure re-hashes (only the authored contract moves).
    expect(computeVisualContractHash(structuredContract())).not.toBe(h);
  });
});

describe('Stage 3 — the omit rule is FAIL-CLOSED for every new array key', () => {
  const c = baseContract();
  const pageWith = (patch: Record<string, unknown>) =>
    validateBookVisualContract({ ...c, pageContracts: [{ ...c.pageContracts[0], ...patch }] } as never).ok;
  const zoneWith = (patch: Record<string, unknown>) =>
    validateBookVisualContract({ ...c, zones: [{ ...c.zones[0], ...patch }] } as never).ok;

  it('an authored [] is rejected on every new key — omit the key instead', () => {
    expect(zoneWith({ spatialNodes: [] })).toBe(false);
    expect(zoneWith({ spatialRelations: [] })).toBe(false);
    for (const key of V2_PAGE_KEYS) expect(pageWith({ [key]: [] })).toBe(false);
  });

  it('the omitted key stays valid (the v1 compat proof)', () => {
    expect(validateBookVisualContract(c).ok).toBe(true);
  });

  it('a well-formed structured contract validates', () => {
    expect(validateBookVisualContract(structuredContract()).ok).toBe(true);
  });

  it('spatialRelations without spatialNodes is rejected (a relation needs nodes to relate)', () => {
    expect(zoneWith({ spatialRelations: RELATIONS })).toBe(false);
  });
});

describe('Stage 3 — closed enums are enforced at RUNTIME, not just by the TS type', () => {
  const c = baseContract();
  const zoneWith = (patch: Record<string, unknown>) =>
    validateBookVisualContract({ ...c, zones: [{ ...c.zones[0], ...patch }] } as never).ok;
  const pageWith = (patch: Record<string, unknown>) =>
    validateBookVisualContract({ ...c, pageContracts: [{ ...c.pageContracts[0], ...patch }] } as never).ok;

  it('rejects an unknown SpatialNodeKind / SpatialRelationKind', () => {
    expect(zoneWith({ spatialNodes: [{ id: 'x', kind: 'underwater', description: 'd' }] })).toBe(false);
    expect(
      zoneWith({
        spatialNodes: [{ id: 'a', kind: 'wall', description: 'd' }, { id: 'b', kind: 'wall', description: 'd' }],
        spatialRelations: [{ subjectId: 'a', relation: 'floats_near', objectId: 'b' }],
        stableGeometry: ['ignored — the enum error fires first'],
      })
    ).toBe(false);
  });

  it('rejects an unknown PropVisibility / ActionPredicate / ActionPolarity / SafetyRelation / origin.kind', () => {
    expect(pageWith({ propConstraints: [{ propId: 'exam_chair', visibility: 'maybe' }] })).toBe(false);
    expect(
      pageWith({
        actionRequirements: [{ checkId: 'action:x', subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } }, predicate: 'hugs', polarity: 'must' }],
      })
    ).toBe(false);
    expect(
      pageWith({
        actionRequirements: [{ checkId: 'action:x', subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } }, predicate: 'holds', polarity: 'maybe' }],
      })
    ).toBe(false);
    expect(
      pageWith({
        safetyConstraints: [
          {
            subjectId: 'child:hero',
            relation: 'must_hug',
            target: { kind: 'prop', id: 'exam_chair' },
            origin: { kind: 'authored', authorNote: 'n' },
          },
        ],
      })
    ).toBe(false);
    // There is deliberately NO `derived`/`inferred` origin — a model must never be able to invent a hazard's source.
    expect(
      pageWith({
        safetyConstraints: [
          {
            subjectId: 'child:hero',
            relation: 'must_not_sit_on',
            target: { kind: 'prop', id: 'exam_chair' },
            origin: { kind: 'derived' },
          },
        ],
      })
    ).toBe(false);
  });
});

describe('Stage 3 — shared typed prop-constraint classifier parity', () => {
  function propConstraintResult(propConstraints: unknown) {
    const contract = baseContract();
    const result = validateBookVisualContract({
      ...contract,
      pageContracts: [
        { ...contract.pageContracts[0], propConstraints },
      ],
    } as never);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected invalid prop constraints');
    const indexes = result.errors.flatMap((message, index) =>
      message.startsWith('page 1.propConstraints') ? [index] : [],
    );
    return {
      errors: indexes.map((index) => result.errors[index]!),
      issues: indexes.map((index) => result.diagnosticIssues[index]!),
    };
  }

  it('pins one closed code to each of the nine existing error templates', () => {
    expect(PAGE_PROP_CONSTRAINT_VIOLATION_CODES).toEqual([
      'prop_constraints_not_array',
      'prop_constraints_empty',
      'prop_id_missing',
      'prop_id_unknown',
      'visibility_invalid',
      'visibility_self_contradiction',
      'state_id_invalid',
      'anchor_id_invalid',
      'anchor_id_unknown',
    ]);
    expect(
      classifyPagePropConstraints({
        propConstraints: 'invalid',
        propIds: new Set(['exam_chair']),
        anchorIds: new Set(['reception_desk']),
      }).violations,
    ).toEqual([{ code: 'prop_constraints_not_array' }]);
    expect(
      classifyPagePropConstraints({
        propConstraints: [],
        propIds: new Set(['exam_chair']),
        anchorIds: new Set(['reception_desk']),
      }).violations,
    ).toEqual([{ code: 'prop_constraints_empty' }]);
    expect(propConstraintResult('invalid').errors).toEqual([
      'page 1.propConstraints must be an array when present',
    ]);
    expect(propConstraintResult([]).errors).toEqual([
      'page 1.propConstraints must be a NON-EMPTY array when present — omit the key instead of []',
    ]);
  });

  it('preserves exact per-entry message order, broad diagnostic identity and last-valid related indexes', () => {
    const constraints = [
      null,
      {
        propId: 'unknown_prop',
        visibility: 'maybe',
        stateId: '',
        anchorId: 7,
      },
      {
        propId: 'exam_chair',
        visibility: 'required',
        anchorId: 'unknown_anchor',
      },
      { propId: 'exam_chair', visibility: 'forbidden' },
      { propId: 'exam_chair', visibility: 'required' },
    ];
    const classified = classifyPagePropConstraints({
      propConstraints: constraints,
      propIds: new Set(['exam_chair']),
      anchorIds: new Set(['reception_desk']),
    });
    expect(classified.violations).toEqual([
      { code: 'prop_id_missing', constraintIndex: 0 },
      { code: 'prop_id_unknown', constraintIndex: 1 },
      { code: 'visibility_invalid', constraintIndex: 1 },
      { code: 'state_id_invalid', constraintIndex: 1 },
      { code: 'anchor_id_invalid', constraintIndex: 1 },
      { code: 'anchor_id_unknown', constraintIndex: 2 },
      {
        code: 'visibility_self_contradiction',
        constraintIndex: 3,
        relatedConstraintIndex: 2,
      },
      {
        code: 'visibility_self_contradiction',
        constraintIndex: 4,
        relatedConstraintIndex: 3,
      },
    ]);
    expect(classified.visibilityByProp.get('exam_chair')).toBe('required');
    expect(classified.visibilityByProp.has('unknown_prop')).toBe(false);
    expect(classified.violations.every(pagePropConstraintViolationIsValid)).toBe(
      true,
    );
    const validated = propConstraintResult(constraints);
    expect(validated.errors).toEqual([
      'page 1.propConstraints[0].propId missing',
      'page 1.propConstraints[1] references unknown propId "unknown_prop"',
      'page 1.propConstraints[1] (unknown_prop) visibility "maybe" is not one of required | forbidden',
      'page 1.propConstraints[1] (unknown_prop) stateId must be a non-empty string when present',
      'page 1.propConstraints[1] (unknown_prop) anchorId must be a non-empty string when present',
      'page 1.propConstraints[2] (exam_chair) references unknown anchorId "unknown_anchor" of location "clinic"',
      'page 1.propConstraints declares propId "exam_chair" as both "required" and "forbidden" on the same page',
      'page 1.propConstraints declares propId "exam_chair" as both "forbidden" and "required" on the same page',
    ]);
    expect(validated.issues).toHaveLength(validated.errors.length);
    expect(
      validated.issues.every(
        (issue) =>
          issue.code === 'final_structural_invariant_invalid' &&
          'causes' in issue &&
          issue.causes.length === 1 &&
          issue.causes[0] === 'page_prop_constraints_invalid',
      ),
    ).toBe(true);
  });

  it('rejects non-canonical typed records without accepting authored or oversized data', () => {
    expect(
      pagePropConstraintViolationIsValid({
        code: 'prop_id_unknown',
        constraintIndex: 0,
        propId: 'forbidden authored value',
      }),
    ).toBe(false);
    expect(
      pagePropConstraintViolationIsValid({
        code: 'visibility_self_contradiction',
        constraintIndex: 2,
        relatedConstraintIndex: 2,
      }),
    ).toBe(false);
    expect(
      pagePropConstraintViolationIsValid({
        code: 'prop_id_missing',
        constraintIndex: 1_000_001,
      }),
    ).toBe(false);
  });
});

describe('Action Semantic Catalog v3 — typed subjects, static constraints, and movement results', () => {
  function validateActions(actions: unknown[]): ReturnType<typeof validateBookVisualContract> {
    const contract = baseContract();
    const page = {
      ...contract.pageContracts[0],
      propConstraints: [
        { propId: 'exam_chair', visibility: 'required' },
      ],
      actionRequirements: actions,
    } as unknown as PageVisualContract;
    return validateBookVisualContract(
      withProjectedProse({
        ...contract,
        pageContracts: [page],
      } as unknown as BookVisualContract),
    );
  }

  const castSubject = {
    kind: 'entity',
    entity: { kind: 'cast', id: 'child:hero' },
  } as const;

  it('accepts the three neutral semantic classes through one closed action path', () => {
    const result = validateActions([
      {
        checkId: 'action:body_event',
        subject: castSubject,
        predicate: 'sneezes',
        polarity: 'must',
      },
      {
        checkId: 'action:environment_contact',
        subject: {
          kind: 'source_phenomenon',
          sourceEvidenceId: `se1_${'a'.repeat(64)}`,
          sourcePhrase: 'A cool current crossed the frame.',
        },
        predicate: 'touches',
        object: { kind: 'cast', id: 'child:hero' },
        polarity: 'must',
      },
      {
        checkId: 'action:spatial_move',
        subject: castSubject,
        predicate: 'moves',
        object: { kind: 'prop', id: 'exam_chair' },
        spatialEffect: {
          kind: 'directional',
          direction: 'sideways',
        },
        polarity: 'must',
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it('accepts recoils only as an intransitive cast reaction', () => {
    const valid = {
      checkId: 'action:recoil',
      subject: castSubject,
      predicate: 'recoils',
      polarity: 'must',
    };
    expect(validateActions([valid]).ok).toBe(true);
    for (const invalid of [
      {
        ...valid,
        subject: {
          kind: 'entity',
          entity: { kind: 'prop', id: 'exam_chair' },
        },
      },
      { ...valid, object: { kind: 'prop', id: 'exam_chair' } },
      {
        ...valid,
        spatialEffect: { kind: 'directional', direction: 'backward' },
      },
      {
        ...valid,
        spatialConstraint: {
          relation: 'beside',
          target: { kind: 'prop', id: 'exam_chair' },
        },
      },
      { ...valid, laterality: 'left' },
    ]) {
      expect(validateActions([invalid]).ok).toBe(false);
    }
  });

  it('accepts sits with no constraint or one exact static beside constraint', () => {
    const sits = {
      checkId: 'action:sits',
      subject: castSubject,
      predicate: 'sits',
      polarity: 'must',
    };
    expect(validateActions([sits]).ok).toBe(true);
    expect(
      validateActions([
        {
          ...sits,
          spatialConstraint: {
            relation: 'beside',
            target: { kind: 'prop', id: 'exam_chair' },
          },
        },
      ]).ok,
    ).toBe(true);
    for (const spatialConstraint of [
      {
        relation: 'near',
        target: { kind: 'prop', id: 'exam_chair' },
      },
      { relation: 'beside', target: { kind: 'prop', id: 'missing' } },
      { relation: 'beside', target: { kind: 'cast', id: 'child:hero' } },
      {
        relation: 'beside',
        target: { kind: 'prop', id: 'exam_chair' },
        prose: 'nearby',
      },
      {
        relation: 'beside',
        target: { kind: 'prop', id: 'exam_chair', label: 'chair' },
      },
    ]) {
      expect(
        validateActions([{ ...sits, spatialConstraint }]).ok,
      ).toBe(false);
    }
  });

  it('keeps static spatialConstraint strictly separate from movement spatialEffect', () => {
    expect(
      validateActions([
        {
          checkId: 'action:bad_static_movement',
          subject: castSubject,
          predicate: 'moves',
          object: { kind: 'prop', id: 'exam_chair' },
          spatialEffect: { kind: 'directional', direction: 'sideways' },
          spatialConstraint: {
            relation: 'beside',
            target: { kind: 'prop', id: 'exam_chair' },
          },
          polarity: 'must',
        },
      ]).ok,
    ).toBe(false);
    expect(
      validateActions([
        {
          checkId: 'action:bad_posture_movement',
          subject: castSubject,
          predicate: 'sits',
          spatialEffect: {
            kind: 'relation',
            relation: 'beside',
            target: { kind: 'prop', id: 'exam_chair' },
          },
          polarity: 'must',
        },
      ]).ok,
    ).toBe(false);
  });

  it('requires a typed result for moves and cannot coerce it to pushes', () => {
    const move = {
      checkId: 'action:spatial_move',
      subject: castSubject,
      predicate: 'moves',
      object: { kind: 'prop', id: 'exam_chair' },
      polarity: 'must',
    };
    expect(validateActions([move]).ok).toBe(false);
    expect(
      validateActions([
        {
          ...move,
          predicate: 'pushes',
          spatialEffect: {
            kind: 'directional',
            direction: 'sideways',
          },
        },
      ]).ok,
    ).toBe(false);
  });

  it('rejects free-text phenomenon identity and unresolved relation targets', () => {
    expect(
      validateActions([
        {
          checkId: 'action:bad_phenomenon',
          subject: {
            kind: 'source_phenomenon',
            sourceEvidenceId: `se1_${'b'.repeat(64)}`,
            sourcePhrase: 'Exact fixture sentence.',
            label: 'invented wind',
          },
          predicate: 'touches',
          object: { kind: 'cast', id: 'child:hero' },
          polarity: 'must',
        },
      ]).ok,
    ).toBe(false);
    expect(
      validateActions([
        {
          checkId: 'action:bad_destination',
          subject: castSubject,
          predicate: 'moves',
          object: { kind: 'prop', id: 'exam_chair' },
          spatialEffect: {
            kind: 'relation',
            relation: 'beside',
            target: { kind: 'prop', id: 'missing_prop' },
          },
          polarity: 'must',
        },
      ]).ok,
    ).toBe(false);
  });

  it('validates canonical same-page cast_group membership without dropping or selecting a member', () => {
    const contract = baseContract();
    contract.cast.companion = {
      id: 'companion:buni',
      role: 'companion',
      name: 'Buni',
      wardrobe: { description: 'heart badge' },
    };
    const validateGroup = (castIds: unknown[]) => {
      const page = {
        ...contract.pageContracts[0],
        castIds: ['child:hero', 'companion:buni'],
        characterPresence: { child: true, companion: true },
        actionRequirements: [
          {
            checkId: 'action:group_sits',
            subject: { kind: 'cast_group', castIds },
            predicate: 'sits',
            spatialConstraint: {
              relation: 'beside',
              target: { kind: 'prop', id: 'exam_chair' },
            },
            polarity: 'must',
          },
        ],
      } as unknown as PageVisualContract;
      return validateBookVisualContract(
        withProjectedProse({
          ...contract,
          pageContracts: [page],
        } as BookVisualContract),
      );
    };
    expect(
      validateGroup(['child:hero', 'companion:buni']).ok,
    ).toBe(true);
    expect(validateGroup(['child:hero']).ok).toBe(false);
    expect(
      validateGroup(['child:hero', '']).ok,
    ).toBe(false);
    expect(
      validateGroup(['child:hero', 'child:hero']).ok,
    ).toBe(false);
    expect(
      validateGroup(['companion:buni', 'child:hero']).ok,
    ).toBe(false);
    expect(
      validateGroup(['child:hero', 'cast:unknown']).ok,
    ).toBe(false);

    const absent = baseContract();
    absent.cast.companion = contract.cast.companion;
    const absentPage = {
      ...absent.pageContracts[0],
      actionRequirements: [
        {
          checkId: 'action:cross_page_group',
          subject: {
            kind: 'cast_group',
            castIds: ['child:hero', 'companion:buni'],
          },
          predicate: 'sits',
          polarity: 'must',
        },
      ],
    } as unknown as PageVisualContract;
    expect(
      validateBookVisualContract(
        withProjectedProse({
          ...absent,
          pageContracts: [absentPage],
        } as BookVisualContract),
      ).ok,
    ).toBe(false);
  });

  it('canonically projects a multi-cast seated-beside beat and does not mutate draft membership', () => {
    const draft = [
      {
        beatId: 'beat:p11:seated_beside',
        subject: {
          kind: 'cast_group',
          castIds: ['companion:buni', 'child:hero'],
        },
        predicate: 'sits',
        object: null,
        spatialEffect: null,
        spatialConstraint: {
          relation: 'beside',
          target: { kind: 'prop', id: 'exam_chair' },
        },
        polarity: 'must',
        laterality: null,
      },
    ];
    const before = structuredClone(draft);
    const normalized = canonicalizePageActionCastGroups(draft);
    expect(draft).toEqual(before);
    expect(
      (normalized[0].subject as { castIds: string[] }).castIds,
    ).toEqual(['child:hero', 'companion:buni']);
    const malformed = canonicalizePageActionCastGroups([
      {
        subject: {
          kind: 'cast_group',
          castIds: 'not-an-array',
          label: 'must survive for fail-closed validation',
        },
      },
    ]);
    expect(malformed[0]!.subject).toEqual({
      kind: 'cast_group',
      castIds: 'not-an-array',
      label: 'must survive for fail-closed validation',
    });

    const contract = baseContract();
    contract.cast.child.name = 'Hero';
    contract.cast.companion = {
      id: 'companion:buni',
      role: 'companion',
      name: 'Buni',
      wardrobe: { description: 'heart badge' },
    };
    const page = {
      ...contract.pageContracts[0],
      pageNumber: 11,
      castIds: ['child:hero', 'companion:buni'],
      characterPresence: { child: true, companion: true },
      actionRequirements: [
        {
          checkId: 'action:p11_seated_beside',
          subject: {
            kind: 'cast_group',
            castIds: ['child:hero', 'companion:buni'],
          },
          predicate: 'sits',
          spatialConstraint: {
            relation: 'beside',
            target: { kind: 'prop', id: 'exam_chair' },
          },
          polarity: 'must',
        },
      ],
    } as unknown as PageVisualContract;
    expect(projectPageActionProse(page, contract)).toBe(
      'the cast group (Hero and Buni) sits beside Examination chair',
    );
  });
});

describe('Stage 3 — single-hop id resolution + intra-page self-contradiction', () => {
  const c = baseContract();
  // Prose-complete (Stage-4 containment) so each assertion below fails for ITS OWN reason, never for missing prose.
  const pageWith = (patch: Record<string, unknown>) =>
    validateBookVisualContract(
      withProjectedProse({ ...c, pageContracts: [{ ...c.pageContracts[0], ...patch }] } as never)
    ).ok;

  it('rejects a dangling propId and an unknown anchorId', () => {
    expect(pageWith({ propConstraints: [{ propId: 'nope', visibility: 'required' }] })).toBe(false);
    expect(
      pageWith({ propConstraints: [{ propId: 'exam_chair', visibility: 'required', anchorId: 'nope' }] })
    ).toBe(false);
    expect(
      pageWith({ propConstraints: [{ propId: 'exam_chair', visibility: 'required', anchorId: 'reception_desk' }] })
    ).toBe(true);
  });

  it('rejects an actor/subject that is globally valid but ABSENT from this page (no steering for an absent actor)', () => {
    const withCompanion = {
      ...c,
      cast: { ...c.cast, companion: { id: 'companion:buni', role: 'companion', wardrobe: { description: 'heart badge' } } },
    } as unknown as BookVisualContract;
    const ok = (patch: Record<string, unknown>) =>
      validateBookVisualContract({
        ...withCompanion,
        pageContracts: [{ ...withCompanion.pageContracts[0], ...patch }],
      } as never).ok;

    // companion:buni is a declared cast member, but this page's castIds is ['child:hero'] only.
    expect(
      ok({ actionRequirements: [{ checkId: 'action:x', subject: { kind: 'entity', entity: { kind: 'cast', id: 'companion:buni' } }, predicate: 'holds', polarity: 'must' }] })
    ).toBe(false);
    expect(
      ok({
        safetyConstraints: [
          {
            subjectId: 'companion:buni',
            relation: 'must_not_sit_on',
            target: { kind: 'prop', id: 'exam_chair' },
            origin: { kind: 'authored', authorNote: 'n' },
          },
        ],
      })
    ).toBe(false);
  });

  it('rejects a duplicate checkId and a non-namespaced checkId on the same page', () => {
    const dup = (checkIds: string[]) =>
      pageWith({
        actionRequirements: checkIds.map((checkId) => ({
          checkId,
          subject: { kind: 'entity', entity: { kind: 'cast', id: 'child:hero' } },
          predicate: 'holds',
          polarity: 'must',
        })),
      });
    expect(dup(['action:a', 'action:a'])).toBe(false);
    expect(dup(['sits_on_chair'])).toBe(false); // missing the `action:` namespace
    expect(dup(['action:a', 'action:b'])).toBe(true);
  });

  it('rejects the same prop declared both required and forbidden on one page', () => {
    expect(
      pageWith({
        propConstraints: [
          { propId: 'exam_chair', visibility: 'required' },
          { propId: 'exam_chair', visibility: 'forbidden' },
        ],
      })
    ).toBe(false);
  });

  it('a spatial ref may only reach THIS page’s own zone (no cross-zone reach)', () => {
    const two = {
      ...c,
      zones: [
        structuredZone(c),
        { id: 'clinic.waiting', locationId: 'clinic', name: 'Waiting', description: 'the waiting room' },
      ],
      // the page sits in clinic.waiting, which declares NO nodes → a {kind:'spatial'} ref cannot resolve
      pageContracts: [
        {
          ...structuredPage(c),
          zoneId: 'clinic.waiting',
        },
      ],
    } as unknown as BookVisualContract;
    expect(validateBookVisualContract(two).ok).toBe(false);
  });

  it('rejects a relation whose subject/object is not a node of this zone, and centered_in with an objectId', () => {
    const zoneWith = (patch: Record<string, unknown>) =>
      validateBookVisualContract({ ...c, zones: [{ ...c.zones[0], ...patch }] } as never).ok;
    expect(
      zoneWith({
        spatialNodes: NODES,
        spatialRelations: [{ subjectId: 'ghost', relation: 'above', objectId: 'floor' }],
        stableGeometry: ['x'],
      })
    ).toBe(false);
    expect(
      zoneWith({
        spatialNodes: NODES,
        spatialRelations: [{ subjectId: 'chair', relation: 'centered_in', objectId: 'floor' }],
        stableGeometry: ['x'],
      })
    ).toBe(false);
  });

  it('firstRevealPage must be an integer >= 1 when present (page 0 is the cover → omit instead)', () => {
    const propWith = (firstRevealPage: unknown) =>
      validateBookVisualContract(
        withProjectedProse({
          ...c,
          recurringProps: [{ ...c.recurringProps[0], firstRevealPage }],
        } as never)
      ).ok;
    // 1 (not 10): this fixture is a ONE-page book, and Stage 4 additionally rejects a lifecycle that points past
    // the last page. That cross-page rule has its own coverage in visual-contract-stage4.spec.ts.
    expect(propWith(1)).toBe(true);
    expect(propWith(0)).toBe(false);
    expect(propWith(-1)).toBe(false);
    expect(propWith(1.5)).toBe(false);
    expect(propWith('10')).toBe(false);
  });
});

describe('Stage 3 — malformed structure fails CLOSED with an itemized result, never a throw', () => {
  const c = baseContract();

  // Regression: the node loop FLAGS a malformed node without filtering it, so the Tier-A block used to hand that
  // zone to the projection, which threw a TypeError. That escapes `isInvalidVisualContractError`, so no caller can
  // classify it, and the freeze path would log "cannot read properties of undefined" instead of the real problems.
  // The enum case ('underwater') did NOT catch it — a bad enum is still a string and humanizes fine.
  const MALFORMED = [
    { label: 'kind omitted', patch: { stableGeometry: ['x'], spatialNodes: [{ id: 'n1', description: 'a door' }] } },
    { label: 'null node', patch: { stableGeometry: ['x'], spatialNodes: [null] } },
    { label: 'non-array spatialRelations', patch: { stableGeometry: ['x'], spatialNodes: NODES, spatialRelations: { bogus: true } } },
    { label: 'non-string kind', patch: { stableGeometry: ['x'], spatialNodes: [{ id: 'n1', kind: 7, description: 'd' }] } },
  ];

  for (const { label, patch } of MALFORMED) {
    it(`${label} → ok:false, and validate() does NOT throw`, () => {
      let result: ReturnType<typeof validateBookVisualContract> | undefined;
      expect(() => {
        result = validateBookVisualContract({ ...c, zones: [{ ...c.zones[0], ...patch }] } as never);
      }).not.toThrow();
      expect(result?.ok).toBe(false);
    });
  }

  it('the projection is TOTAL — it never throws on input the validator is about to reject', () => {
    for (const { patch } of MALFORMED) {
      expect(() => projectZoneStableGeometry({ ...c.zones[0], ...patch } as never)).not.toThrow();
    }
  });

  it.each([
    ['omitted description', 'description', undefined],
    ['null description', 'description', null],
    ['omitted kind', 'kind', undefined],
    ['null kind', 'kind', null],
  ])(
    'keeps referenced spatial prose total for a malformed %s',
    (_label, field, value) => {
      const contract = structuredClone(structuredContract());
      const floor = contract.zones[0]!.spatialNodes![0]! as unknown as Record<
        string,
        unknown
      >;
      if (value === undefined) delete floor[field];
      else floor[field] = value;
      const page = contract.pageContracts[0]!;

      expect(() => projectPageMustNotShow(page, contract)).not.toThrow();
      expect(() =>
        projectPageMustNotShowLegacySpatial(page, contract),
      ).not.toThrow();
      const current = projectPageMustNotShow(page, contract).join(' ');
      const legacy = projectPageMustNotShowLegacySpatial(page, contract).join(
        ' ',
      );
      expect(`${current} ${legacy}`).not.toMatch(/\b(?:null|undefined)\b/u);
      if (field === 'description') expect(current).toContain('spatial:floor');
      if (field === 'kind') expect(legacy).toContain('spatial:floor');

      let result: ReturnType<typeof validateBookVisualContract> | undefined;
      expect(() => {
        result = validateBookVisualContract(contract as never);
      }).not.toThrow();
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.errors.join('\n')).toContain(
          field === 'description' ? 'description missing' : 'kind "',
        );
      }
    },
  );
});

describe('Stage 3 — TIER A: stableGeometry stops being an independent authority once structure exists', () => {
  const c = baseContract();

  it('structure present + stableGeometry EQUAL to the projection → valid', () => {
    expect(validateBookVisualContract({ ...c, zones: [structuredZone(c)] } as never).ok).toBe(true);
  });

  it('structure present + hand-edited stableGeometry that diverges → REJECTED', () => {
    const z = structuredZone(c);
    const tampered = { ...z, stableGeometry: [...(z.stableGeometry ?? []), 'a smuggled extra fact'] };
    const result = validateBookVisualContract({ ...c, zones: [tampered] } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('deterministic PROJECTION');
  });

  it('structure present + MISSING stableGeometry → rejected (the projection must be stored)', () => {
    const z = { ...c.zones[0], spatialNodes: NODES, spatialRelations: RELATIONS };
    expect(validateBookVisualContract({ ...c, zones: [z] } as never).ok).toBe(false);
  });

  it('NO structure + arbitrary hand-authored prose → still valid (the v1 compatibility switch is per-ZONE)', () => {
    const z = { ...c.zones[0], stableGeometry: ['whatever the author wrote in v1'] };
    expect(validateBookVisualContract({ ...c, zones: [z] } as never).ok).toBe(true);
  });
});

describe('Stage 3 — the projections are pure, deterministic and order-stable', () => {
  const c = baseContract();

  it('projectZoneStableGeometry: same input → identical output; nodes then relations, in declaration order', () => {
    const z = { ...c.zones[0], spatialNodes: NODES, spatialRelations: RELATIONS } as unknown as VisualZone;
    const a = projectZoneStableGeometry(z);
    const b = projectZoneStableGeometry(z);
    expect(a).toEqual(b);
    expect(a).toEqual([
      'floor "floor": a pale vinyl floor',
      'furniture "chair": the tall examination chair',
      '"chair" is centered in the zone',
    ]);
  });

  it('declaration order IS the total order — reordering the nodes reorders the projection (array order is hashed)', () => {
    const z1 = { ...c.zones[0], spatialNodes: NODES } as unknown as VisualZone;
    const z2 = { ...c.zones[0], spatialNodes: [...NODES].reverse() } as unknown as VisualZone;
    expect(projectZoneStableGeometry(z1)).not.toEqual(projectZoneStableGeometry(z2));
  });

  it('an unauthored zone projects to undefined — NOT [] (or it would move every frozen hash)', () => {
    expect(projectZoneStableGeometry(c.zones[0])).toBeUndefined();
    expect(projectZoneStableGeometry({ ...c.zones[0], spatialNodes: [] } as unknown as VisualZone)).toBeUndefined();
  });

  it('TIER B (unwired): mustShow/mustNotShow projections resolve the prop NAME and split by polarity', () => {
    const sc = structuredContract();
    const page = sc.pageContracts[0];
    // The prop NAME is load-bearing: the vision gate matches recurringProps[].name against mustShow prose.
    expect(projectPageMustShow(page, sc)).toEqual(['Examination chair', 'the child sits on Examination chair']);
    // Hazards are always prohibitions → they can only ever land in mustNotShow, never mustShow.
    expect(projectPageMustNotShow(page, sc)).toEqual([
      'the child must NOT sit on the pale vinyl floor [spatial:floor]',
    ]);
  });

  it('keeps canonical spatial identity markers while projecting marker-free provider prose without mutation', () => {
    const sc = structuredContract();
    const page = sc.pageContracts[0]!;
    const before = canonicalHash(sc);
    const provider = projectPageProviderPromptProse(page, sc);

    expect(projectPageMustNotShow(page, sc)).toEqual([
      'the child must NOT sit on the pale vinyl floor [spatial:floor]',
    ]);
    expect(provider.safety).toBe(
      'the child must NOT sit on the pale vinyl floor',
    );
    expect(provider.mustNotShow).toContain(
      'the child must NOT sit on the pale vinyl floor',
    );
    expect(JSON.stringify(provider)).not.toContain('[spatial:');
    expect(canonicalHash(sc)).toBe(before);
    expect(sc.pageContracts[0]!.mustNotShow).toContain(
      'the child must NOT sit on the pale vinyl floor [spatial:floor]',
    );

    const unresolved = structuredClone(page);
    unresolved.mustShow = ['unknown internal marker [spatial:not_in_page_zone]'];
    expect(() => projectPageProviderPromptProse(unresolved, sc)).toThrow(
      'unresolved internal spatial reference marker',
    );
  });

  it('projects spatial action prose naturally for providers while its canonical mustShow identity stays exact', () => {
    const sc = structuredContract();
    const page = structuredClone(sc.pageContracts[0]!);
    page.actionRequirements = [
      {
        checkId: 'action:looks_at_floor',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        object: { kind: 'spatial', id: 'floor' },
        polarity: 'must',
      },
    ];

    expect(projectPageMustShow(page, sc)).toContain(
      'the child looks at the pale vinyl floor [spatial:floor]',
    );
    expect(projectPageActionProse(page, sc)).toBe(
      'the child looks at the pale vinyl floor [spatial:floor]',
    );
    expect(projectPageProviderPromptProse(page, sc).action).toBe(
      'the child looks at the pale vinyl floor',
    );
  });

  it('projects two same-kind spatial nodes by exact identity and description while preserving a legacy reader', () => {
    const sc = structuredContract();
    const zone = sc.zones[0]!;
    zone.spatialNodes = [
      ...(zone.spatialNodes ?? []),
      {
        id: 'rear_rail',
        kind: 'railing',
        description: 'Low fountain rim behind the stone.',
      },
      {
        id: 'forward_rail',
        kind: 'railing',
        description: 'Slim guide rail toward the gate.',
      },
    ];
    const page = sc.pageContracts[0]!;
    page.actionRequirements = [
      {
        checkId: 'action:look_back',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        object: { kind: 'spatial', id: 'rear_rail' },
        polarity: 'must',
      },
      {
        checkId: 'action:look_forward',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        object: { kind: 'spatial', id: 'forward_rail' },
        polarity: 'must',
      },
    ];
    expect(projectPageMustShow(page, sc)).toEqual([
      'Examination chair',
      'the child looks at the low fountain rim behind the stone [spatial:rear_rail]',
      'the child looks at the slim guide rail toward the gate [spatial:forward_rail]',
    ]);
    expect(projectPageMustShowLegacySpatial(page, sc)).toEqual([
      'Examination chair',
      'the child looks at the railing',
      'the child looks at the railing',
    ]);
  });

  it('TIER B (unwired): the cover no-spoiler projection reads the prop lifecycle', () => {
    const withLifecycle = {
      ...c,
      recurringProps: [{ ...c.recurringProps[0], firstRevealPage: 10 }],
    } as unknown as BookVisualContract;
    expect(projectCoverMustNotShow(withLifecycle)).toEqual([
      'Examination chair (first revealed on page 10 — no spoiler)',
    ]);
    // No lifecycle authored → nothing to hide.
    expect(projectCoverMustNotShow(c)).toEqual([]);
  });
});

describe('Stage 3 — TIER C: the prompt block gains the projected lines ONLY when structure is authored', () => {
  it('a structure-free contract yields a BYTE-IDENTICAL block (no new labels)', () => {
    const c = baseContract();
    const [page] = derivePageVisualContracts(c);
    const block = buildVisualContractPromptBlock(page, c);
    for (const label of ['ACTION BEATS', 'SAFETY (never render)']) expect(block).not.toContain(label);
  });

  it('an authored contract emits ACTION BEATS + SAFETY, before the AUTHORITY closer', () => {
    const sc = structuredContract();
    const [page] = derivePageVisualContracts(sc);
    const block = buildVisualContractPromptBlock(page, sc);
    expect(block).toContain('ACTION BEATS: the child sits on Examination chair');
    expect(block).toContain(
      'SAFETY (never render): the child must NOT sit on the pale vinyl floor',
    );
    expect(block).not.toContain('[spatial:');
    // The projected geometry rides the existing per-page (own-zone only) STABLE GEOMETRY line.
    expect(block).toContain('STABLE GEOMETRY: floor "floor": a pale vinyl floor');
    // AUTHORITY must close the block so "THIS contract wins" covers the new lines too.
    expect(block.indexOf('SAFETY (never render)')).toBeLessThan(
      block.indexOf('AUTHORITY: runtime presentation'),
    );
  });

  it('the active PVB facts block projects spatial safety without internal markers', () => {
    const sc = structuredContract();
    const [page] = derivePageVisualContracts(sc);
    const block = buildPvbVisualContractFactsPromptBlock(page, sc);
    expect(block).toContain(
      'SAFETY BOUNDARIES (never violate): the child must NOT sit on the pale vinyl floor',
    );
    expect(block).not.toContain('[spatial:');
  });

  it('the provider vision instruction receives marker-free mustShow prose', () => {
    const sc = structuredContract();
    const [page] = derivePageVisualContracts(sc);
    page.mustShow = [
      'Examination chair beside the pale vinyl floor [spatial:floor]',
    ];
    const instruction = buildContractVisionInstruction(page, sc);
    expect(instruction).toContain(
      'Required to be visible: Examination chair beside the pale vinyl floor.',
    );
    expect(instruction).not.toContain('[spatial:');
  });

  it('the COVER carries no page-level structure (it has no page contract) → no ACTION/SAFETY lines', () => {
    const sc = structuredContract();
    // deriveCoverVisualContract builds the cover's page-shaped projection from a literal (no `...page` spread), so
    // per-page v2 structure is deliberately absent on the cover — its no-spoiler authority is the prop lifecycle.
    const block = buildVisualContractPromptBlock(deriveCoverVisualContract(sc), sc);
    expect(block).not.toContain('ACTION BEATS');
    expect(block).not.toContain('SAFETY (never render)');
  });
});
