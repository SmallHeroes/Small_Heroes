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
  type BookVisualContract,
  type PageVisionObservation,
} from '@/lib/visual-contract-compiler';

function contract(): BookVisualContract {
  return {
    version: 2,
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

describe('selectCalibrationPages — measurable face pages (no cover)', () => {
  it('excludes the cover and picks establishing + zone-transition + companion + key-prop', () => {
    const sel = selectCalibrationPages(contract());
    expect(sel.cover).toBe(false);
    expect(sel.pageNumbers).not.toContain(0); // cover is NOT a calibration target
    expect(sel.pageNumbers).toEqual([1, 2]); // the 2 face pages in this 2-page fixture (distinct)
    expect(sel.establishingLocation).toBe(1);
    expect(sel.zoneTransitionSamePlace).toBe(2);
    expect(sel.companionAction).toBe(2);
    expect(sel.keyProp).toBe(2);
  });

  it('yields 5 DISTINCT face pages (never the cover) even when the dimension picks overlap', () => {
    const sixPages: BookVisualContract = {
      ...contract(),
      pageContracts: [1, 2, 3, 4, 5, 6].map((n) => ({
        pageNumber: n,
        locationId: 'playground_main',
        zoneId: n % 2 === 0 ? 'gate' : 'sandbox',
        sameLocationAs: n > 1 ? n - 1 : null,
        mustShow: [],
        mustNotShow: [],
        characterPresence: { child: true, companion: n >= 3 },
        propState: [{ propId: 'stone_gate', state: n % 2 === 0 ? 'open' : 'closed' }],
        camera: n === 4 ? 'child reaching toward the gate' : 'wide shot',
      })),
    };
    const sel = selectCalibrationPages(sixPages);
    expect(sel.cover).toBe(false);
    expect(sel.pageNumbers).not.toContain(0);
    expect(sel.pageNumbers).toHaveLength(5);
    expect(new Set(sel.pageNumbers).size).toBe(5); // all distinct
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
