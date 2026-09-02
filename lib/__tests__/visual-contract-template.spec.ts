/**
 * P0 commit 1 — Contract Template + Resolved validators (PURE; no render, no LLM, no DB).
 *
 * Proves the structured-appearance foundation:
 *  - the Template validator accepts a well-formed template and REJECTS family_profile on a non-relative (the clinic
 *    doctor), a binding missing its typed evidence origin, an empty structured slot, and an explicit binding with no
 *    value;
 *  - the Resolved validator accepts a fully-concrete contract and REJECTS an unresolved/deferred trait, a garment
 *    with no concrete colour, and a Template shape (a Template can never be frozen/rendered as a Resolved).
 */
import { describe, it, expect } from 'vitest';
import {
  validateBookVisualContractTemplate,
  assertValidBookVisualContractTemplate,
  InvalidTemplateContractError,
  validateResolvedBookVisualContract,
  assertValidResolvedBookVisualContract,
  InvalidResolvedContractError,
  VISUAL_CONTRACT_SCHEMA_VERSION,
  MATERIALIZER_VERSION,
  PALETTE_VERSION,
  projectCoverMustNotShow,
  projectPageActionProse,
  projectPageMustShow,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';

type Obj = Record<string, unknown>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ── Shared minimal clinic structure (satisfies the vNext structural checks) ──────────────────────
const SHARED = {
  version: 1,
  storyKey: 'clinic_visit',
  worldType: 'realistic_clinic',
  locations: [
    { id: 'clinic', name: 'Clinic', description: 'a small friendly clinic', environmentClass: 'indoor' },
  ],
  zones: [
    { id: 'clinic.waiting', locationId: 'clinic', name: 'Waiting', description: 'waiting area' },
    { id: 'clinic.exam', locationId: 'clinic', name: 'Exam', description: 'exam room' },
  ],
  cast: { child: { id: 'child:hero', role: 'child', wardrobe: { description: 'everyday outfit' } } },
  recurringProps: [],
  forbiddenGlobalElements: [],
  coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', mustShow: [], mustNotShow: [] },
  pageContracts: [
    {
      pageNumber: 1, locationId: 'clinic', zoneId: 'clinic.waiting', mustShow: ['x'], mustNotShow: [],
      characterPresence: { child: true, companion: false }, propState: [], camera: 'wide',
      castIds: ['child:hero', 'human:mother'], transition: { kind: 'steady' },
    },
    {
      pageNumber: 2, locationId: 'clinic', zoneId: 'clinic.exam', mustShow: ['x'], mustNotShow: [],
      characterPresence: { child: true, companion: false }, propState: [], camera: 'wide',
      castIds: ['child:hero', 'human:doctor'],
      transition: { kind: 'after_transition', fromZoneId: 'clinic.waiting', toZoneId: 'clinic.exam', cue: 'they step in' },
    },
  ],
};

// ── A valid Template: mother = family_profile (relative), doctor = deterministic_palette, garments/hair = explicit ──
function templateFixture(): Obj {
  return clone({
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    ...SHARED,
    humanCast: [
      {
        id: 'human:mother', role: 'mother', gender: 'female', aliases: ['אמא'], textEvidence: 'page 1: אמא', pagesPresent: [1], forbiddenAppearance: [],
        appearance: {
          skinTone: { mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairColour: { mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairTexture: { mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairStyle: { mode: 'explicit', value: 'medium-length, loose, side part', origin: { kind: 'story_evidence', page: 1, phrase: 'page-1 canonical hair' } },
        },
        garments: [
          { id: 'cardigan', label: 'cardigan', colour: { mode: 'explicit', value: 'sage-green', origin: { kind: 'story_evidence', page: 1, phrase: 'sage-green cardigan on page 1' } } },
        ],
      },
      {
        id: 'human:doctor', role: 'doctor', gender: 'male', aliases: ['הרופא'], textEvidence: 'page 2: הרופא', pagesPresent: [2], forbiddenAppearance: [],
        appearance: {
          skinTone: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairColour: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairTexture: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairStyle: { mode: 'explicit', value: 'short neatly combed, side part', origin: { kind: 'policy_default', policyId: 'doctor-hair', version: 'v1' } },
        },
        garments: [
          { id: 'coat', colour: { mode: 'explicit', value: 'white', origin: { kind: 'policy_default', policyId: 'doctor-coat', version: 'v1' } } },
          { id: 'scrubs', colour: { mode: 'explicit', value: 'blue', origin: { kind: 'policy_default', policyId: 'doctor-scrubs', version: 'v1' } } },
        ],
      },
    ],
  });
}

// ── A valid Resolved: everything concrete; coarseAppearance/wardrobe are concrete projections ──
function resolvedFixture(): Obj {
  return clone({
    contractKind: 'resolved',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    materializerVersion: MATERIALIZER_VERSION,
    paletteVersion: PALETTE_VERSION,
    ...SHARED,
    humanCast: [
      {
        id: 'human:mother', role: 'mother', gender: 'female', aliases: ['אמא', 'mom'], pagesPresent: [1],
        textEvidence: 'page 1: אמא',
        // coarseAppearance + wardrobe.description are the EXACT deterministic projections of the structured traits below.
        coarseAppearance: 'female mother; warm medium-brown skin tone; medium-length, loose, side part, wavy dark brown hair — the SAME appearance on every page',
        wardrobe: { description: 'sage-green cardigan — the SAME garments and colours on every page' },
        forbiddenAppearance: [],
        appearance: {
          skinTone: { value: 'warm medium-brown', mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairColour: { value: 'dark brown', mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairTexture: { value: 'wavy', mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairStyle: { value: 'medium-length, loose, side part', mode: 'explicit', origin: { kind: 'story_evidence', page: 1, phrase: 'page-1 canonical hair' } },
        },
        garments: [{ id: 'cardigan', colour: { value: 'sage-green', mode: 'explicit', origin: { kind: 'story_evidence', page: 1, phrase: 'sage-green cardigan on page 1' } } }],
      },
      {
        id: 'human:doctor', role: 'doctor', gender: 'male', aliases: ['הרופא', 'the doctor'], pagesPresent: [2],
        textEvidence: 'page 2: הרופא',
        coarseAppearance: 'male doctor; light-tan skin tone; short neatly combed, side part, straight black hair — the SAME appearance on every page',
        wardrobe: { description: 'white coat, blue scrubs — the SAME garments and colours on every page' },
        forbiddenAppearance: [],
        appearance: {
          skinTone: { value: 'light-tan', mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairColour: { value: 'black', mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairTexture: { value: 'straight', mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairStyle: { value: 'short neatly combed, side part', mode: 'explicit', origin: { kind: 'policy_default', policyId: 'doctor-hair', version: 'v1' } },
        },
        garments: [
          { id: 'coat', colour: { value: 'white', mode: 'explicit', origin: { kind: 'policy_default', policyId: 'doctor-coat', version: 'v1' } } },
          { id: 'scrubs', colour: { value: 'blue', mode: 'explicit', origin: { kind: 'policy_default', policyId: 'doctor-scrubs', version: 'v1' } } },
        ],
      },
    ],
  });
}

function validRecurringProp(id: string, firstRevealPage?: number): Obj {
  return {
    id,
    name: `Prop ${id}`,
    description: `Stable description for ${id}`,
    ...(firstRevealPage === undefined ? {} : { firstRevealPage }),
  };
}

const templateTotalityCases: Array<{
  name: string;
  expected: string;
  mutate: (template: Obj) => void;
}> = [
  {
    name: 'omitted humanCast',
    expected: 'humanCast must be an array',
    mutate: (template) => {
      delete template.humanCast;
    },
  },
  {
    name: 'non-array humanCast',
    expected: 'humanCast must be an array',
    mutate: (template) => {
      template.humanCast = 'invalid';
    },
  },
  {
    name: 'humanCast [null]',
    expected: 'humanCast[0] must be an object',
    mutate: (template) => {
      template.humanCast = [null];
    },
  },
  {
    name: 'humanCast [undefined]',
    expected: 'humanCast[0] must be an object',
    mutate: (template) => {
      template.humanCast = [undefined];
    },
  },
  {
    name: 'humanCast [{}]',
    expected: 'humanCast[0]',
    mutate: (template) => {
      template.humanCast = [{}];
    },
  },
  {
    name: 'humanCast valid plus null',
    expected: 'humanCast[2] must be an object',
    mutate: (template) => {
      template.humanCast = [...(template.humanCast as unknown[]), null];
    },
  },
  {
    name: 'humanCast mixed scalar and object entries',
    expected: 'humanCast[2] must be an object',
    mutate: (template) => {
      template.humanCast = [...(template.humanCast as unknown[]), 'invalid', {}];
    },
  },
  {
    name: 'recurringProps [null]',
    expected: 'recurringProps[0] must be an object',
    mutate: (template) => {
      template.recurringProps = [null];
    },
  },
  {
    name: 'recurringProps [{}]',
    expected: 'recurringProps[0]',
    mutate: (template) => {
      template.recurringProps = [{}];
    },
  },
  {
    name: 'recurringProps valid plus null',
    expected: 'recurringProps[1] must be an object',
    mutate: (template) => {
      template.recurringProps = [validRecurringProp('plain'), null];
    },
  },
  {
    name: 'recurringProps null plus valid',
    expected: 'recurringProps[0] must be an object',
    mutate: (template) => {
      template.recurringProps = [null, validRecurringProp('plain')];
    },
  },
  {
    name: 'recurringProps mixed scalars with valid prop',
    expected: 'recurringProps[1] must be an object',
    mutate: (template) => {
      template.recurringProps = [validRecurringProp('plain'), 'invalid', 7];
    },
  },
  {
    name: 'recurringProps lifecycle and non-lifecycle neighbors around null',
    expected: 'recurringProps[1] must be an object',
    mutate: (template) => {
      template.recurringProps = [
        validRecurringProp('future', 2),
        null,
        validRecurringProp('plain'),
      ];
    },
  },
  {
    name: 'garments [null]',
    expected: 'garments[0] must be an object',
    mutate: (template) => {
      (template.humanCast as Obj[])[0].garments = [null];
    },
  },
  {
    name: 'garments [{}]',
    expected: 'garments[0].id missing',
    mutate: (template) => {
      (template.humanCast as Obj[])[0].garments = [{}];
    },
  },
  {
    name: 'garments mixed valid and invalid entries',
    expected: 'garments[1] must be an object',
    mutate: (template) => {
      const member = (template.humanCast as Obj[])[0];
      member.garments = [
        ...((member.garments as unknown[]) ?? []),
        null,
        'invalid',
      ];
    },
  },
  {
    name: 'locations mixed valid and null',
    expected: 'locations[1] must be an object',
    mutate: (template) => {
      template.locations = [(template.locations as unknown[])[0], null];
    },
  },
  {
    name: 'zones mixed valid and null',
    expected: 'zones[2] must be an object',
    mutate: (template) => {
      template.zones = [...(template.zones as unknown[]), null];
    },
  },
  {
    name: 'pageContracts mixed valid and null',
    expected: 'pageContracts[2] must be an object',
    mutate: (template) => {
      template.pageContracts = [...(template.pageContracts as unknown[]), null];
    },
  },
  {
    name: 'forbiddenGlobalElements mixed string and null',
    expected: 'forbiddenGlobalElements[1] must be a string',
    mutate: (template) => {
      template.forbiddenGlobalElements = ['valid exclusion', null];
    },
  },
  {
    name: 'setBoardAuthorities [null]',
    expected: 'setBoardAuthorities[0] must be an object',
    mutate: (template) => {
      template.setBoardAuthorities = [null];
    },
  },
];

describe('P0 — Template validator', () => {
  it('accepts a well-formed template', () => {
    const r = validateBookVisualContractTemplate(templateFixture());
    expect(r.ok, r.ok ? '' : r.errors.join('; ')).toBe(true);
  });

  it('accepts exact 16-page coverage and rejects a truncated page-16 result', () => {
    const template = templateFixture();
    const pageNumbers = Array.from({ length: 16 }, (_, index) => index + 1);
    const firstPage = clone((template.pageContracts as Obj[])[0]!);
    template.pageContracts = pageNumbers.map((pageNumber) => ({
      ...clone(firstPage),
      pageNumber,
    }));
    const mother = clone((template.humanCast as Obj[])[0]!);
    mother.pagesPresent = pageNumbers;
    template.humanCast = [mother];
    template.provenance = {
      source: 'llm',
      compiledFromPages: 16,
    };

    const complete = validateBookVisualContractTemplate(template);
    expect(
      complete.ok,
      complete.ok ? '' : complete.errors.join('; '),
    ).toBe(true);

    const truncated = clone(template);
    (truncated.pageContracts as Obj[]).pop();
    const incomplete = validateBookVisualContractTemplate(truncated);
    expect(incomplete.ok).toBe(false);
    if (incomplete.ok) {
      throw new Error('expected the 16-page template truncation to fail');
    }
    expect(incomplete.errors.join('; ')).toMatch(
      /missing pageContract for page 16 \(expected exactly pages 1\.\.16\)/,
    );
  });

  it.each([
    {
      name: 'omitted',
      mutate: (template: Obj) => {
        delete template.recurringProps;
      },
    },
    {
      name: 'null',
      mutate: (template: Obj) => {
        template.recurringProps = null;
      },
    },
    {
      name: 'object',
      mutate: (template: Obj) => {
        template.recurringProps = { invalid: true };
      },
    },
    {
      name: 'string',
      mutate: (template: Obj) => {
        template.recurringProps = 'invalid';
      },
    },
  ])('REJECTS $name recurringProps instead of coercing it to an empty array', ({ mutate }) => {
    const template = templateFixture();
    mutate(template);
    const first = validateBookVisualContractTemplate(template);
    const second = validateBookVisualContractTemplate(template);
    expect(first).toEqual(second);
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.errors).toContain('recurringProps must be an array');
  });

  it('REJECTS malformed recurringProps array entries without throwing', () => {
    const template = templateFixture();
    template.recurringProps = [null];
    expect(() => validateBookVisualContractTemplate(template)).not.toThrow();
    const result = validateBookVisualContractTemplate(template);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('recurringProps[0] must be an object');
  });

  it.each(templateTotalityCases)(
    'is total and deterministic for malformed durable array: $name',
    ({ expected, mutate }) => {
      const template = templateFixture();
      mutate(template);

      expect(() => validateBookVisualContractTemplate(template)).not.toThrow();
      const first = validateBookVisualContractTemplate(template);
      const second = validateBookVisualContractTemplate(template);
      expect(first).toEqual(second);
      expect(first.ok).toBe(false);
      if (!first.ok) {
        expect(first.errors.join(' ')).toContain(expected);
        expect(first.errors).not.toEqual([
          'template validation could not safely inspect malformed nested input',
        ]);
      }

      let thrown: unknown;
      try {
        assertValidBookVisualContractTemplate(template);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(InvalidTemplateContractError);
      expect(thrown).not.toBeInstanceOf(TypeError);
    },
  );

  it('contains unforeseen property-access failures at the public boundary', () => {
    const explosive = Object.defineProperty(templateFixture(), 'contractKind', {
      get: () => {
        throw new TypeError('untrusted accessor');
      },
    });
    const first = validateBookVisualContractTemplate(explosive);
    const second = validateBookVisualContractTemplate(explosive);
    expect(first).toEqual(second);
    expect(first).toEqual({
      ok: false,
      errors: ['template validation could not safely inspect malformed nested input'],
      diagnosticIssues: [{
        family: 'draft_schema',
        code: 'value_type_invalid',
        locator: { kind: 'root', fieldRole: 'final_structure' },
      }],
    });
    expect(() => assertValidBookVisualContractTemplate(explosive)).toThrow(
      InvalidTemplateContractError,
    );
  });

  it('keeps recurring-prop projections total and byte-identical around malformed neighbors', () => {
    const contract = templateFixture() as unknown as BookVisualContract;
    const prop = validRecurringProp('prop:token', 2) as unknown as
      BookVisualContract['recurringProps'][number];
    contract.recurringProps = [prop];
    const page = contract.pageContracts[0];
    page.propConstraints = [{ propId: prop.id, visibility: 'required' }];
    page.actionRequirements = [
      {
        checkId: 'action:mother_holds_token',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'human:mother' },
        },
        predicate: 'holds',
        object: { kind: 'prop', id: prop.id },
        polarity: 'must',
      },
    ];
    const expectedCover = projectCoverMustNotShow(contract);
    const expectedPage = projectPageMustShow(page, contract);

    const malformed = clone(contract);
    malformed.recurringProps = [null, prop, 'invalid'] as never;
    malformed.humanCast = [null, ...(malformed.humanCast ?? [])] as never;
    expect(() => projectCoverMustNotShow(malformed)).not.toThrow();
    expect(() => projectPageMustShow(malformed.pageContracts[0], malformed)).not.toThrow();
    expect(projectCoverMustNotShow(malformed)).toEqual(expectedCover);
    expect(projectPageMustShow(malformed.pageContracts[0], malformed)).toEqual(
      expectedPage,
    );

    const invalidPredicate = clone(contract);
    invalidPredicate.pageContracts[0]!.actionRequirements![0]!.predicate =
      'flies_over' as never;
    expect(() =>
      projectPageMustShow(
        invalidPredicate.pageContracts[0]!,
        invalidPredicate,
      ),
    ).not.toThrow();
    expect(
      projectPageMustShow(
        invalidPredicate.pageContracts[0]!,
        invalidPredicate,
      ),
    ).toEqual([prop.name]);
    expect(
      projectPageActionProse(
        invalidPredicate.pageContracts[0]!,
        invalidPredicate,
      ),
    ).toBe('');
  });

  it('REJECTS family_profile on a non-relative (the clinic doctor)', () => {
    const bad = templateFixture();
    (((bad.humanCast as Obj[])[1].appearance as Obj).skinTone as Obj) = { mode: 'family_profile', origin: { kind: 'family_profile' } };
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/family_profile is illegal for non-relative role "doctor"/);
  });

  it('REJECTS a binding missing its typed evidence origin', () => {
    const bad = templateFixture();
    delete ((((bad.humanCast as Obj[])[0].appearance as Obj).hairStyle as Obj).origin);
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/origin missing/);
  });

  it('REJECTS an empty structured slot', () => {
    const bad = templateFixture();
    delete ((bad.humanCast as Obj[])[0].appearance as Obj).skinTone;
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/appearance\.skinTone missing/);
  });

  it('REJECTS an explicit garment binding with no concrete value', () => {
    const bad = templateFixture();
    (((bad.humanCast as Obj[])[0].garments as Obj[])[0].colour as Obj) = { mode: 'explicit', origin: { kind: 'story_evidence', page: 1, phrase: 'x' } };
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/explicit binding must carry a concrete value/);
  });

  it('(Fix 3) REJECTS a schemaVersion that is not the EXACT supported version', () => {
    const bad = templateFixture();
    bad.schemaVersion = 'vc-schema/v0';
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/schemaVersion must equal the supported/);
  });

  it('(Fix 3) REJECTS a missing storyKey (the deterministic palette seed must not degenerate to empty)', () => {
    const bad = templateFixture();
    delete bad.storyKey;
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/storyKey missing/);
  });

  it('(Fix 3) REJECTS an incoherent mode/origin (family_profile trait carrying a story_evidence origin)', () => {
    const bad = templateFixture();
    (((bad.humanCast as Obj[])[0].appearance as Obj).skinTone as Obj) = {
      mode: 'family_profile',
      origin: { kind: 'story_evidence', page: 1, phrase: 'fabricated phrase' },
    };
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/family_profile mode requires a family_profile origin/);
  });

  it('(round-2 Fix 1) REJECTS an explicit binding whose value is deferral/placeholder text', () => {
    const bad = templateFixture();
    (((bad.humanCast as Obj[])[0].appearance as Obj).hairStyle as Obj) = {
      mode: 'explicit',
      value: 'deferred to the family lock',
      origin: { kind: 'story_evidence', page: 1, phrase: 'x' },
    };
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/looks like deferral\/placeholder text/);
  });

  it('assertValidBookVisualContractTemplate throws on a malformed template', () => {
    expect(() => assertValidBookVisualContractTemplate({ contractKind: 'template' })).toThrow(InvalidTemplateContractError);
  });
});

describe('P0 — Resolved validator', () => {
  it('accepts a fully-concrete resolved contract', () => {
    const r = validateResolvedBookVisualContract(resolvedFixture());
    expect(r.ok, r.ok ? '' : r.errors.join('; ')).toBe(true);
  });

  it('REJECTS an unresolved / deferred trait', () => {
    const bad = resolvedFixture();
    (((bad.humanCast as Obj[])[0].appearance as Obj).hairColour as Obj).value = 'deferred to the family lock';
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/appearance\.hairColour is not a concrete resolved value/);
  });

  it('REJECTS a garment with no concrete colour', () => {
    const bad = resolvedFixture();
    delete (((bad.humanCast as Obj[])[1].garments as Obj[])[0].colour as Obj).value;
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/is not a concrete resolved colour/);
  });

  it('REJECTS a Template shape (a Template can never be frozen/rendered as a Resolved)', () => {
    const r = validateResolvedBookVisualContract(templateFixture());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/Template .* must not be validated\/frozen as a Resolved/);
  });

  it('(Fix 3) REJECTS an unsupported schema/materializer/palette version', () => {
    const bad = resolvedFixture();
    bad.materializerVersion = 'materializer/v0';
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/materializerVersion must equal the supported/);
  });

  it('(Fix 3) REJECTS an incoherent mode/origin on a resolved trait (palette trait with a family_profile origin)', () => {
    const bad = resolvedFixture();
    // doctor.skinTone stays mode=deterministic_palette but its origin is swapped to family_profile → incoherent.
    (((bad.humanCast as Obj[])[1].appearance as Obj).skinTone as Obj).origin = { kind: 'family_profile' };
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/deterministic_palette mode requires a deterministic_palette origin/);
  });

  it('(Fix 3) REJECTS prose that does not EQUAL the deterministic projection of the structured traits', () => {
    const bad = resolvedFixture();
    (bad.humanCast as Obj[])[0].coarseAppearance =
      'female mother; warm medium-brown skin tone; a completely different hair description — the SAME appearance on every page';
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/coarseAppearance does not EQUAL the deterministic projection/);
  });

  it('(Fix 3) REJECTS wardrobe.description that does not EQUAL the deterministic projection of the garments', () => {
    const bad = resolvedFixture();
    ((bad.humanCast as Obj[])[0].wardrobe as Obj).description = 'sage-green cardigan over a cream top, blue jeans, tan loafers';
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/wardrobe\.description does not EQUAL the deterministic projection/);
  });

  it('(round-2 Fix 3) REJECTS family_profile on a non-relative (doctor) in a Resolved contract', () => {
    const bad = resolvedFixture();
    (((bad.humanCast as Obj[])[1].appearance as Obj).skinTone as Obj) = {
      value: 'warm medium-brown', mode: 'family_profile', origin: { kind: 'family_profile' },
    };
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/family_profile is illegal for non-relative role "doctor"/);
  });

  it('(round-2 Fix 3) REJECTS a garment colour bound to family_profile (garment colours must be explicit)', () => {
    const bad = resolvedFixture();
    (((bad.humanCast as Obj[])[0].garments as Obj[])[0].colour as Obj) = {
      value: 'sage-green', mode: 'family_profile', origin: { kind: 'family_profile' },
    };
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/must be an explicit binding/);
  });

  it('(round-2 Fix 3) REJECTS an incomplete typed origin payload (policy_default missing version)', () => {
    const bad = resolvedFixture();
    (((bad.humanCast as Obj[])[1].appearance as Obj).hairStyle as Obj).origin = { kind: 'policy_default', policyId: 'doctor-hair' };
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/policy_default\)\.version missing/);
  });

  it('(round-2 Fix 3) REJECTS a deterministic_palette origin whose version != the contract paletteVersion', () => {
    const bad = resolvedFixture();
    (((bad.humanCast as Obj[])[1].appearance as Obj).skinTone as Obj).origin = {
      kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: 'palette/v0',
    };
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/deterministic_palette\)\.version .* != contract paletteVersion/);
  });

  it('assertValidResolvedBookVisualContract throws on a malformed resolved contract', () => {
    expect(() => assertValidResolvedBookVisualContract({ contractKind: 'resolved' })).toThrow(InvalidResolvedContractError);
  });
});
