import { afterEach, describe, expect, it } from 'vitest';

import {
  composeContractAuthoritativePrompt,
  derivePageVisualContracts,
  planPageReferences,
  evaluatePageContractQa,
  selectCalibrationPages,
  runVisualContractCalibration,
  requireValidContractForRender,
  isVisualContractEnforcementEnabled,
  isMissingVisualContractError,
  isInvalidVisualContractError,
  materialize,
  InvalidResolvedContractError,
  VISUAL_CONTRACT_SCHEMA_VERSION,
  PALETTE_VERSION,
  type BookVisualContract,
  type BookVisualContractTemplate,
  type ResolvedFamilyAppearanceProfile,
  type PageVisionObservation,
} from '@/lib/visual-contract-compiler';

function contract(): BookVisualContract {
  return {
    version: 1,
    storyKey: 'demo_playground',
    worldType: 'sunny outdoor playground',
    locations: [
      { id: 'playground_main', name: 'The Playground', description: 'a sunny playground', timeOfDay: 'day' },
      { id: 'home_living_room', name: 'Living Room', description: 'a living room', timeOfDay: 'day' },
    ],
    zones: [
      { id: 'gate', locationId: 'playground_main', name: 'Gate', description: 'the gate' },
      { id: 'sandbox', locationId: 'playground_main', name: 'Sandbox', description: 'the sandbox' },
    ],
    cast: {
      child: { id: 'child', role: 'child', name: 'Anat', wardrobe: { description: 'red dress' } },
      companion: { id: 'fox_koko', role: 'companion', name: 'Koko', wardrobe: { description: 'green scarf' } },
    },
    recurringProps: [{ id: 'stone_gate', name: 'stone gate', description: 'a stone gate' }],
    forbiddenGlobalElements: ['dragon'],
    coverContract: { worldType: 'sunny outdoor playground', locationId: 'playground_main', timeOfDay: 'day', mustShow: ['child'], mustNotShow: ['night'] },
    pageContracts: [
      { pageNumber: 1, locationId: 'playground_main', zoneId: 'sandbox', sameLocationAs: null, mustShow: ['child playing'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [{ propId: 'stone_gate', state: 'closed' }], camera: 'wide establishing shot' },
      { pageNumber: 2, locationId: 'playground_main', zoneId: 'gate', sameLocationAs: 1, mustShow: ['stone gate', 'companion'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [{ propId: 'stone_gate', state: 'open' }], camera: 'low angle, child reaching toward the gate' },
    ],
  };
}

afterEach(() => {
  delete process.env.VISUAL_CONTRACT_ENFORCEMENT;
  delete process.env.VISUAL_CONTRACT_DEV_OVERRIDE;
});

describe('referenceBudgetPlanner — set ref is guaranteed, never starved by style', () => {
  it('orders child→companion→location→style and keeps the set ref within the cap', () => {
    const pages = derivePageVisualContracts(contract());
    const plan = planPageReferences({
      page: pages[1], // companion present
      contract: contract(),
      available: {
        childAnchorUrl: 'child.png',
        companionSheetUrl: 'koko.png',
        locationSetRefUrl: 'playground-set.png',
        styleRefUrls: ['style1.png', 'style2.png', 'style3.png'],
      },
      cap: 4,
    });
    expect(plan.refs.map((r) => r.kind)).toEqual(['child', 'companion', 'location', 'style']);
    expect(plan.setRefIncluded).toBe(true);
    expect(plan.droppedStyleForSet).toBe(true); // style2/style3 dropped to keep the set
    expect(plan.refs).toHaveLength(4);
  });

  it('omits the companion slot when the companion is absent', () => {
    const pages = derivePageVisualContracts(contract());
    const plan = planPageReferences({
      page: pages[0], // companion absent
      contract: contract(),
      available: { childAnchorUrl: 'child.png', companionSheetUrl: 'koko.png', locationSetRefUrl: 'set.png', styleRefUrls: ['s1.png'] },
      cap: 4,
    });
    expect(plan.refs.map((r) => r.kind)).toEqual(['child', 'location', 'style']);
  });

  it('flags missingSetRef when a location page has no set ref available (no fabrication)', () => {
    const pages = derivePageVisualContracts(contract());
    const plan = planPageReferences({
      page: pages[0],
      contract: contract(),
      available: { childAnchorUrl: 'child.png', styleRefUrls: ['s1.png'] }, // no set ref
    });
    expect(plan.setRefIncluded).toBe(false);
    expect(plan.missingSetRef).toBe(true);
  });
});

describe('pageVisualContractQa — exactly 5 checks', () => {
  const pages = derivePageVisualContracts(contract());
  const cleanObs: PageVisionObservation = {
    locationMatchesContract: true,
    forbiddenEntitiesPresent: [],
    missingMajorProps: [],
    companionWardrobeMatches: true,
    coverWorldMatches: true,
  };

  it('passes a clean render', () => {
    expect(evaluatePageContractQa({ page: pages[1], observation: cleanObs }).pass).toBe(true);
  });

  it('fails wrong_location, forbidden_entity, missing_major_prop, companion drift', () => {
    const v = evaluatePageContractQa({
      page: pages[1],
      observation: {
        locationMatchesContract: false,
        forbiddenEntitiesPresent: ['dragon'],
        missingMajorProps: ['stone gate'],
        companionWardrobeMatches: false,
        coverWorldMatches: null,
      },
    });
    expect(v.pass).toBe(false);
    expect(v.failures.map((f) => f.check).sort()).toEqual(
      ['companion_wardrobe_drift', 'forbidden_entity', 'missing_major_prop', 'wrong_location'].sort()
    );
  });

  it('does not apply the companion check when the companion is absent', () => {
    const v = evaluatePageContractQa({ page: pages[0], observation: { ...cleanObs, companionWardrobeMatches: false } });
    expect(v.failures.find((f) => f.check === 'companion_wardrobe_drift')).toBeUndefined();
  });

  it('applies cover_world_mismatch only on the cover', () => {
    const nonCover = evaluatePageContractQa({ page: pages[0], observation: { ...cleanObs, coverWorldMatches: false } });
    expect(nonCover.pass).toBe(true);
    const cover = evaluatePageContractQa({ page: pages[0], observation: { ...cleanObs, coverWorldMatches: false }, isCover: true });
    expect(cover.failures.map((f) => f.check)).toContain('cover_world_mismatch');
  });
});

describe('selectCalibrationPages — 5 risk pages', () => {
  it('picks cover + establishing-location + zone-transition + companion + key-prop', () => {
    const sel = selectCalibrationPages(contract());
    expect(sel.pageNumbers).toContain(0); // cover
    expect(sel.establishingLocation).toBe(1);
    expect(sel.zoneTransitionSamePlace).toBe(2); // page 2 same location, different zone
    expect(sel.companionAction).toBe(2); // companion present + "reaching"
    expect(sel.keyProp).toBe(2); // stone_gate closed→open
  });
});

describe('runVisualContractCalibration — gate before full render', () => {
  const passVision = {
    observe: async (): Promise<PageVisionObservation> => ({
      locationMatchesContract: true,
      forbiddenEntitiesPresent: [],
      missingMajorProps: [],
      companionWardrobeMatches: true,
      coverWorldMatches: true,
    }),
  };

  it('all risk pages pass → allPass true', async () => {
    const res = await runVisualContractCalibration({
      contract: contract(),
      renderer: { render: async () => ({ imageUrl: 'img.png' }) },
      vision: passVision,
      maxRerolls: 1,
    });
    expect(res.allPass).toBe(true);
    expect(res.failedPages).toEqual([]);
  });

  it('rerolls a failing page and gives up after maxRerolls → allPass false', async () => {
    let calls = 0;
    const res = await runVisualContractCalibration({
      contract: contract(),
      renderer: { render: async () => ({ imageUrl: `img${calls++}.png` }) },
      vision: {
        observe: async () => ({
          locationMatchesContract: false, // always wrong location → never passes
          forbiddenEntitiesPresent: [],
          missingMajorProps: [],
          companionWardrobeMatches: true,
          coverWorldMatches: true,
        }),
      },
      maxRerolls: 2,
    });
    expect(res.allPass).toBe(false);
    expect(res.failedPages.length).toBeGreaterThan(0);
    // each failing page rendered 1 + maxRerolls times
    const first = res.results[0];
    expect(first.attempts).toBe(3);
  });

  it('throws fail-closed on an invalid contract (before any render)', async () => {
    let rendered = false;
    await expect(
      runVisualContractCalibration({
        contract: { version: 1 } as unknown as BookVisualContract,
        renderer: { render: async () => ((rendered = true), { imageUrl: 'x' }) },
        vision: passVision,
      })
    ).rejects.toSatisfy(isInvalidVisualContractError);
    expect(rendered).toBe(false);
  });
});

describe('composeContractAuthoritativePrompt — render-seam injection', () => {
  it('prepends the contract block (authoritative-first) and is idempotent', () => {
    expect(composeContractAuthoritativePrompt('CONTRACT', 'scene prompt')).toBe('CONTRACT\n\nscene prompt');
    // already-prefixed → not double-applied
    expect(composeContractAuthoritativePrompt('CONTRACT', 'CONTRACT\n\nscene prompt')).toBe('CONTRACT\n\nscene prompt');
  });
  it('returns the base prompt unchanged when no block (legacy behavior)', () => {
    expect(composeContractAuthoritativePrompt(undefined, 'scene')).toBe('scene');
    expect(composeContractAuthoritativePrompt('   ', 'scene')).toBe('scene');
  });
  it('fails closed on an exact internal marker at final image egress but permits ordinary spatial prose', () => {
    expect(() =>
      composeContractAuthoritativePrompt(
        'CONTRACT',
        'keep away from [spatial:floor]',
      ),
    ).toThrow('unresolved internal spatial reference marker');
    expect(
      composeContractAuthoritativePrompt(
        'CONTRACT',
        'spatial: awareness matters',
      ),
    ).toContain('spatial: awareness matters');
  });
});

describe('requireValidContractForRender — fail-closed migration contract', () => {
  it('production: missing contract + enforcement ON → throws MissingVisualContractError', () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    try {
      requireValidContractForRender(null, 'production');
      throw new Error('should throw');
    } catch (e) {
      expect(isMissingVisualContractError(e)).toBe(true);
    }
  });

  it('qa_audition: missing contract → clear message', () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    expect(() => requireValidContractForRender(null, 'qa_audition')).toThrow(/QA audition blocked/);
  });

  it('dev_creator: explicit override allows a missing contract', () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    process.env.VISUAL_CONTRACT_DEV_OVERRIDE = 'true';
    expect(requireValidContractForRender(null, 'dev_creator')).toBeNull();
  });

  it('a present-but-invalid contract always throws, even with enforcement OFF', () => {
    delete process.env.VISUAL_CONTRACT_ENFORCEMENT;
    expect(() => requireValidContractForRender({ version: 1 }, 'production')).toThrow();
  });

  it('layer OFF + no contract → legacy pass (no throw)', () => {
    delete process.env.VISUAL_CONTRACT_ENFORCEMENT;
    expect(requireValidContractForRender(null, 'production')).toBeNull();
  });
});

describe('isVisualContractEnforcementEnabled — flag + non-production hard gate', () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  it('OFF by default (no flag)', () => {
    delete process.env.VISUAL_CONTRACT_ENFORCEMENT;
    delete process.env.VERCEL_ENV;
    expect(isVisualContractEnforcementEnabled()).toBe(false);
  });

  it('ON in non-production (preview/local) when the flag is set', () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    process.env.VERCEL_ENV = 'preview';
    expect(isVisualContractEnforcementEnabled()).toBe(true);
  });

  it('NEVER enabled on Vercel Production, even with the flag set (leak-proof)', () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    process.env.VERCEL_ENV = 'production';
    expect(isVisualContractEnforcementEnabled()).toBe(false);
  });

  it('on prod runtime, flag set + missing contract → legacy pass (enforcement is off on prod)', () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    process.env.VERCEL_ENV = 'production';
    expect(requireValidContractForRender(null, 'production')).toBeNull();
  });
});

// ── P1/OQ-T5 — the render guard must hard-block an INVALID Resolved (the base validator was too weak) ──
const P1_FAMILY: ResolvedFamilyAppearanceProfile = { skinTone: 'warm medium-brown', hairColour: 'dark brown', hairTexture: 'wavy' };

function p1ResolvedTemplate(): BookVisualContractTemplate {
  return JSON.parse(JSON.stringify({
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    version: 1,
    storyKey: 'clinic_visit',
    worldType: 'realistic_clinic',
    locations: [{ id: 'clinic', name: 'Clinic', description: 'a clinic', environmentClass: 'indoor' }],
    zones: [
      { id: 'clinic.waiting', locationId: 'clinic', name: 'Waiting', description: 'waiting' },
      { id: 'clinic.exam', locationId: 'clinic', name: 'Exam', description: 'exam' },
    ],
    cast: { child: { id: 'child:hero', role: 'child', wardrobe: { description: 'outfit' } } },
    recurringProps: [],
    forbiddenGlobalElements: [],
    coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', mustShow: [], mustNotShow: [] },
    pageContracts: [
      { pageNumber: 1, locationId: 'clinic', zoneId: 'clinic.waiting', mustShow: ['x'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero', 'human:mother'], transition: { kind: 'steady' } },
      { pageNumber: 2, locationId: 'clinic', zoneId: 'clinic.exam', mustShow: ['x'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero', 'human:doctor'], transition: { kind: 'after_transition', fromZoneId: 'clinic.waiting', toZoneId: 'clinic.exam', cue: 'in' } },
    ],
    humanCast: [
      { id: 'human:mother', role: 'mother', gender: 'female', aliases: ['אמא'], textEvidence: 'p1 אמא', pagesPresent: [1], forbiddenAppearance: [], appearance: { skinTone: { mode: 'family_profile', origin: { kind: 'family_profile' } }, hairColour: { mode: 'family_profile', origin: { kind: 'family_profile' } }, hairTexture: { mode: 'family_profile', origin: { kind: 'family_profile' } }, hairStyle: { mode: 'explicit', value: 'medium-length, loose, side part', origin: { kind: 'story_evidence', page: 1, phrase: 'p1' } } }, garments: [{ id: 'cardigan', colour: { mode: 'explicit', value: 'sage-green', origin: { kind: 'story_evidence', page: 1, phrase: 'p1' } } }] },
      { id: 'human:doctor', role: 'doctor', gender: 'male', aliases: ['הרופא'], textEvidence: 'p2 הרופא', pagesPresent: [2], forbiddenAppearance: [], appearance: { skinTone: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'd', version: PALETTE_VERSION } }, hairColour: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'd', version: PALETTE_VERSION } }, hairTexture: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'd', version: PALETTE_VERSION } }, hairStyle: { mode: 'explicit', value: 'short combed, side part', origin: { kind: 'policy_default', policyId: 'h', version: 'v1' } } }, garments: [{ id: 'coat', colour: { mode: 'explicit', value: 'white', origin: { kind: 'policy_default', policyId: 'c', version: 'v1' } } }] },
    ],
  })) as BookVisualContractTemplate;
}

describe('P1/OQ-T5 — requireValidContractForRender hard-blocks an invalid Resolved before render', () => {
  it('a VALID Resolved is allowed (dispatches to the FULL Resolved validator, which passes)', () => {
    const resolved = materialize(p1ResolvedTemplate(), P1_FAMILY);
    expect(requireValidContractForRender(resolved, 'production')).toBeTruthy();
  });

  it('an INVALID Resolved is BLOCKED — full validator, NO legacy fall-through to the weaker base validator', () => {
    const bad = JSON.parse(JSON.stringify(materialize(p1ResolvedTemplate(), P1_FAMILY)));
    bad.humanCast[0].appearance.skinTone.value = 'deferred to the family lock'; // passes the base validator, fails Resolved
    expect(() => requireValidContractForRender(bad, 'production')).toThrow(InvalidResolvedContractError);
  });

  it('a genuine LEGACY contract (no resolved discriminant) is still allowed (base validator)', () => {
    expect(requireValidContractForRender(contract(), 'production')).toBeTruthy();
  });

  // ── re-gate: no non-exact-"resolved" discriminant may launder through the base validator ──
  it('(re-gate) a discriminant-STRIPPED Resolved is BLOCKED (carries Resolved fingerprints → not laundered as legacy)', () => {
    const bad = JSON.parse(JSON.stringify(materialize(p1ResolvedTemplate(), P1_FAMILY)));
    delete bad.contractKind; // still carries materializerVersion/paletteVersion → resolved-shaped, must NOT render
    expect(() => requireValidContractForRender(bad, 'production')).toThrow(/not a renderable frozen contract/);
  });

  it('(re-gate) an UNKNOWN contractKind is BLOCKED (no base-validator fall-through)', () => {
    const bad = JSON.parse(JSON.stringify(materialize(p1ResolvedTemplate(), P1_FAMILY)));
    bad.contractKind = 'resolvedx';
    expect(() => requireValidContractForRender(bad, 'production')).toThrow(/not a renderable frozen contract/);
  });

  it('(re-gate) a Template (contractKind="template") is BLOCKED (a Template is never renderable)', () => {
    expect(() => requireValidContractForRender(p1ResolvedTemplate(), 'production')).toThrow(/not a renderable frozen contract/);
  });
});
