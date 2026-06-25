import { describe, expect, it } from 'vitest';

import {
  assertValidBookVisualContract,
  buildVisualContractPromptBlock,
  compileBookVisualContract,
  derivePageVisualContracts,
  isInvalidVisualContractError,
  resolveAuthoritativePageLocation,
  validateBookVisualContract,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';

/** A valid playground contract: a `gate` ZONE inside `playground_main` (NOT a new location), a
 *  companion, a forbidden dragon, and a stone-gate prop that opens. */
function validContract(): BookVisualContract {
  return {
    version: 1,
    storyKey: 'demo_playground',
    worldType: 'sunny outdoor playground',
    locations: [
      { id: 'playground_main', name: 'The Playground', description: 'a sunny neighborhood playground', timeOfDay: 'day' },
      { id: 'home_living_room', name: 'Living Room', description: 'a cozy living room', timeOfDay: 'day' },
    ],
    zones: [
      { id: 'gate', locationId: 'playground_main', name: 'Playground Gate', description: 'the painted entrance gate' },
      { id: 'sandbox', locationId: 'playground_main', name: 'Sandbox', description: 'the sandbox corner' },
    ],
    cast: {
      child: { id: 'child', role: 'child', name: 'Anat', wardrobe: { description: 'red dress, white sneakers' } },
      companion: { id: 'fox_koko', role: 'companion', name: 'Koko', wardrobe: { description: 'green scarf' } },
    },
    recurringProps: [{ id: 'stone_gate', name: 'Stone Gate', description: 'a heavy stone gate' }],
    forbiddenGlobalElements: ['dragon', 'any animal other than the companion'],
    coverContract: {
      worldType: 'sunny outdoor playground',
      locationId: 'playground_main',
      timeOfDay: 'day',
      mustShow: ['child', 'playground'],
      mustNotShow: ['night', 'bedroom'],
    },
    pageContracts: [
      {
        pageNumber: 1,
        locationId: 'playground_main',
        zoneId: 'sandbox',
        sameLocationAs: null,
        mustShow: ['child playing'],
        mustNotShow: ['gate open'],
        characterPresence: { child: true, companion: false },
        propState: [{ propId: 'stone_gate', state: 'closed' }],
        camera: 'wide establishing shot',
      },
      {
        pageNumber: 2,
        locationId: 'playground_main',
        zoneId: 'gate',
        sameLocationAs: 1,
        mustShow: ['child', 'companion', 'stone gate'],
        mustNotShow: [],
        characterPresence: { child: true, companion: true },
        propState: [{ propId: 'stone_gate', state: 'open' }],
        camera: 'low angle, child reaching toward the gate',
      },
    ],
  };
}

describe('validateBookVisualContract (fail-closed)', () => {
  it('accepts a structurally valid contract', () => {
    const r = validateBookVisualContract(validContract());
    expect(r.ok).toBe(true);
  });

  it('rejects a zone that points at the wrong location (the gate→cave class)', () => {
    const c = validContract();
    c.pageContracts[1].zoneId = 'gate';
    c.pageContracts[1].locationId = 'home_living_room'; // gate is NOT a zone of the living room
    const r = validateBookVisualContract(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/zoneId "gate" is not a zone of location "home_living_room"/);
  });

  it('rejects a page whose locationId is not a declared location', () => {
    const c = validContract();
    c.pageContracts[0].locationId = 'mystery_cave';
    const r = validateBookVisualContract(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/not a declared location/);
  });

  it('rejects missing cast.child wardrobe, empty pages, and bad version', () => {
    expect(validateBookVisualContract({ ...validContract(), version: 2 }).ok).toBe(false);
    expect(validateBookVisualContract({ ...validContract(), pageContracts: [] }).ok).toBe(false);
    const noChild = validContract() as unknown as Record<string, unknown>;
    (noChild.cast as Record<string, unknown>).child = { id: 'child', role: 'child' };
    expect(validateBookVisualContract(noChild).ok).toBe(false);
  });

  it('assertValidBookVisualContract throws InvalidVisualContractError on an invalid contract', () => {
    try {
      assertValidBookVisualContract({ version: 1 });
      throw new Error('should have thrown');
    } catch (e) {
      expect(isInvalidVisualContractError(e)).toBe(true);
    }
  });
});

describe('contract authority — beats imageDirection / extractLocationZone (gate→cave fix)', () => {
  it('resolves the page location from the contract even when the legacy hint says "cave"', () => {
    const c = validContract();
    const resolved = resolveAuthoritativePageLocation(c, 2, { locationZone: 'cave' });
    expect(resolved.locationId).toBe('playground_main');
    expect(resolved.zoneId).toBe('gate'); // a zone of playground_main, NOT a new location
    expect(resolved.source).toBe('contract');
    expect(resolved.advisoryHintIgnored).toBe('cave'); // hint recorded as ignored, never applied
  });

  it('the prompt block declares itself authoritative over imageDirection and folds in global forbiddens', () => {
    const c = validContract();
    const pages = derivePageVisualContracts(c);
    const block = buildVisualContractPromptBlock(pages[1], c);
    expect(block).toContain('AUTHORITATIVE');
    expect(block).toMatch(/overrides imageDirection/i);
    expect(block).toContain('playground_main');
    expect(block).toContain('id=gate');
    // global forbidden element appears in this page's MUST NOT SHOW even though the page set none
    expect(block).toContain('dragon');
    // companion wardrobe lock present on a companion page
    expect(block).toContain('green scarf');
  });
});

describe('derivePageVisualContracts', () => {
  it('folds forbiddenGlobalElements into every page mustNotShow and locks companion wardrobe only when present', () => {
    const c = validContract();
    const pages = derivePageVisualContracts(c);
    // page 1: companion absent → no companion lock; global forbiddens still folded in
    expect(pages[0].companionWardrobeLock).toBeUndefined();
    expect(pages[0].mustNotShow).toContain('dragon');
    // page 2: companion present → lock resolved from cast
    expect(pages[1].companionWardrobeLock).toBe('green scarf');
    expect(pages[1].mustNotShow).toContain('dragon');
  });
});

describe('normalizeRawBookVisualContract — absorbs LLM shape variations (the ענת calibration finding)', () => {
  it('coerces string wardrobe, assigns recurringProp ids from names, remaps propState by name', async () => {
    const { normalizeRawBookVisualContract, validateBookVisualContract } = await import('@/lib/visual-contract-compiler');
    const raw = {
      version: 1,
      worldType: 'bedroom at night',
      locations: [{ id: 'bedroom', name: 'Bedroom', description: 'a child bedroom at night' }],
      zones: [],
      cast: {
        child: { id: 'child', role: 'child', wardrobe: 'yellow pajamas' }, // string wardrobe
        companion: { id: 'panda', role: 'companion', wardrobe: { outfit: 'red scarf' } }, // outfit key
      },
      recurringProps: [{ name: 'blanket', description: 'a soft blanket' }], // no id
      forbiddenGlobalElements: 'dragon, monster', // string list
      coverContract: { worldType: 'bedroom at night', locationId: 'bedroom', mustShow: ['child'], mustNotShow: [] },
      pageContracts: [
        { pageNumber: 1, locationId: 'bedroom', mustShow: [], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [{ propId: 'blanket', state: 'folded' }], camera: 'wide' },
      ],
    };
    const norm = normalizeRawBookVisualContract(raw);
    const r = validateBookVisualContract(norm);
    expect(r.ok).toBe(true); // previously failed-closed; normalization makes it valid
    const n = norm as Record<string, any>;
    expect(n.cast.child.wardrobe.description).toBe('yellow pajamas');
    expect(n.cast.companion.wardrobe.description).toBe('red scarf');
    expect(n.recurringProps[0].id).toBe('blanket'); // id derived from name
    expect(n.forbiddenGlobalElements).toEqual(['dragon', 'monster']);
  });
});

describe('compileBookVisualContract (fail-closed parse + validate)', () => {
  const input = { storyKey: 'demo_playground', fullStoryText: 'Anat played at the playground...', pageCount: 2 };

  it('returns a validated contract when the LLM yields valid JSON (fenced)', async () => {
    const json = JSON.stringify(validContract());
    const contract = await compileBookVisualContract(input, {
      callLLM: async () => '```json\n' + json + '\n```',
    });
    expect(contract.worldType).toBe('sunny outdoor playground');
    expect(contract.provenance?.source).toBe('llm');
    expect(contract.storyKey).toBe('demo_playground');
  });

  it('throws (fail-closed) when the LLM returns non-JSON', async () => {
    await expect(
      compileBookVisualContract(input, { callLLM: async () => 'sorry, here is some prose with no object' })
    ).rejects.toSatisfy(isInvalidVisualContractError);
  });

  it('throws (fail-closed) when the JSON is well-formed but structurally invalid', async () => {
    const bad = { ...validContract(), pageContracts: [{ pageNumber: 1, locationId: 'nope', camera: 'x', mustShow: [], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [] }] };
    await expect(
      compileBookVisualContract(input, { callLLM: async () => JSON.stringify(bad) })
    ).rejects.toSatisfy(isInvalidVisualContractError);
  });
});
