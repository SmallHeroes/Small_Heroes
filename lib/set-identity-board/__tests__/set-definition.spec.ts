import { describe, expect, it } from 'vitest';

import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import {
  computeSetDefinitionHash,
  groupLocationsBySetIdentity,
  listRequiredSetIdentityIds,
  projectSetDefinition,
} from '../setDefinition';

/** Deep clone so a mutated variant never aliases the base. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * SYNTHETIC fixture (references no real story). Two locations share ONE setIdentity ('set_alpha'); a third location
 * ('meadow') has its own identity. `room_north` requires a board (setReference pending); the others do not.
 */
function makeContract(): BookVisualContract {
  return {
    version: 1,
    storyKey: 'synthetic_story',
    worldType: 'indoor_world',
    locations: [
      {
        id: 'room_north',
        name: 'North Room',
        description: 'a plain north room with a wooden floor',
        timeOfDay: 'day',
        lighting: 'warm daylight',
        environmentClass: 'indoor',
        setIdentityId: 'set_alpha',
        setReference: { status: 'pending' },
        anchors: [{ id: 'anchor_hearth', description: 'a stone hearth on the west wall' }],
        topology: 'north room opening onto the south room',
      },
      {
        id: 'room_south',
        name: 'South Room',
        description: 'a plain south room with a tiled floor',
        timeOfDay: 'day',
        lighting: 'warm daylight',
        environmentClass: 'indoor',
        setIdentityId: 'set_alpha',
        setReference: { status: 'none' },
        anchors: [],
      },
      {
        id: 'meadow',
        name: 'Meadow',
        description: 'an open grassy meadow',
        environmentClass: 'outdoor',
        setReference: { status: 'none' },
        anchors: [],
      },
    ],
    zones: [
      {
        id: 'z_north',
        locationId: 'room_north',
        name: 'North Zone',
        description: 'the main north area',
        spatialNodes: [
          { id: 'main_door', kind: 'doorway', description: 'a wide wooden doorway in the east wall' },
          {
            id: 'tall_lamp',
            kind: 'furniture',
            description: 'a tall standing lamp',
            bindsTo: { kind: 'prop', id: 'floor_lamp' },
          },
        ],
        spatialRelations: [{ subjectId: 'tall_lamp', relation: 'adjacent_to', objectId: 'main_door' }],
      },
      {
        id: 'z_south',
        locationId: 'room_south',
        name: 'South Zone',
        description: 'the main south area',
        spatialNodes: [{ id: 'south_shelf', kind: 'wall', description: 'a long shelf on the south wall' }],
        spatialRelations: [],
      },
      {
        id: 'z_meadow',
        locationId: 'meadow',
        name: 'Meadow Zone',
        description: 'the open field',
      },
    ],
    cast: {
      child: { id: 'child_1', role: 'child', name: 'Kid', wardrobe: { description: 'a green tunic' } },
      companion: { id: 'comp_1', role: 'companion', name: 'Pal', wardrobe: { description: 'a blue scarf' } },
    },
    humanCast: [
      {
        id: 'human:guide',
        role: 'guide',
        aliases: ['the guide'],
        gender: 'unspecified',
        coarseAppearance: 'tall build, dark hair',
        wardrobe: { description: 'a grey coat' },
        forbiddenAppearance: [],
        pagesPresent: [1],
        textEvidence: 'the guide',
      },
    ],
    recurringProps: [
      {
        id: 'floor_lamp',
        name: 'Floor Lamp',
        description: 'a standing lamp',
        material: 'brass and linen',
        scale: "reaches the child's shoulder",
      },
      { id: 'wagon', name: 'Wagon', description: 'a little wagon' },
    ],
    forbiddenGlobalElements: ['dragon'],
    coverContract: { worldType: 'indoor_world', locationId: 'room_north', mustShow: [], mustNotShow: [] },
    pageContracts: [
      {
        pageNumber: 1,
        locationId: 'room_north',
        zoneId: 'z_north',
        mustShow: [],
        mustNotShow: [],
        characterPresence: { child: true, companion: true },
        propState: [{ propId: 'floor_lamp', state: 'on' }],
        camera: 'wide establishing shot',
      },
    ],
  };
}

const STYLE = 'detailed_whimsical_world';
const ID = 'set_alpha';

describe('projectSetDefinition / computeSetDefinitionHash — set-only, personalization-invariant', () => {
  it('(a) is IDENTICAL when only cast / family appearance changes', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.cast.child.wardrobe.description = 'a completely different scarlet robe';
    variant.cast.companion!.wardrobe.description = 'a different hat';
    variant.humanCast![0].coarseAppearance = 'short, stout, red hair';
    variant.humanCast![0].wardrobe.description = 'a bright yellow raincoat';

    expect(computeSetDefinitionHash(variant, ID, STYLE)).toBe(computeSetDefinitionHash(base, ID, STYLE));
  });

  it('(a) is IDENTICAL when only page camera / action / propState changes', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.pageContracts[0].camera = 'extreme close-up on the face';
    variant.pageContracts[0].propState = [{ propId: 'floor_lamp', state: 'off' }];
    variant.pageContracts.push({
      pageNumber: 2,
      locationId: 'room_north',
      zoneId: 'z_north',
      mustShow: ['a hug'],
      mustNotShow: [],
      characterPresence: { child: true, companion: false },
      propState: [],
      camera: 'low angle',
    });

    expect(computeSetDefinitionHash(variant, ID, STYLE)).toBe(computeSetDefinitionHash(base, ID, STYLE));
  });

  it('(b) CHANGES when a zone gains a spatialNode', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.zones[0].spatialNodes!.push({
      id: 'skylight',
      kind: 'window',
      description: 'a round skylight in the ceiling',
    });
    expect(computeSetDefinitionHash(variant, ID, STYLE)).not.toBe(computeSetDefinitionHash(base, ID, STYLE));
  });

  it('(b) CHANGES when a zone gains a spatialRelation', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.zones[0].spatialRelations!.push({ subjectId: 'main_door', relation: 'centered_in' });
    expect(computeSetDefinitionHash(variant, ID, STYLE)).not.toBe(computeSetDefinitionHash(base, ID, STYLE));
  });

  it('(b) CHANGES when an opening KIND changes', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.zones[0].spatialNodes![0].kind = 'window'; // was 'doorway'
    expect(computeSetDefinitionHash(variant, ID, STYLE)).not.toBe(computeSetDefinitionHash(base, ID, STYLE));
  });

  it('(b) CHANGES with styleId, setIdentityId, and boardVersion', () => {
    const base = makeContract();
    const h = computeSetDefinitionHash(base, ID, STYLE);
    expect(computeSetDefinitionHash(base, ID, 'soft_hand_drawn_storybook')).not.toBe(h);
    expect(computeSetDefinitionHash(base, 'meadow', STYLE)).not.toBe(h);
    expect(computeSetDefinitionHash(base, ID, STYLE, { boardVersion: 'set-board/v1' })).not.toBe(h);
  });

  it('is deterministic (same inputs → same hash)', () => {
    const base = makeContract();
    expect(computeSetDefinitionHash(base, ID, STYLE)).toBe(computeSetDefinitionHash(makeContract(), ID, STYLE));
  });

  it('deterministically removes a reveal-gated prop node, dependent relations, and fixed facts', () => {
    const contract = makeContract();
    const prop = contract.recurringProps.find((candidate) => candidate.id === 'floor_lamp')!;
    prop.firstRevealPage = 2;
    contract.pageContracts[0].propConstraints = [
      { propId: prop.id, visibility: 'forbidden' },
    ];

    const definition = projectSetDefinition(contract, ID, STYLE);
    expect(definition.contentPolicy.includedPropIds).not.toContain(prop.id);
    expect(definition.contentPolicy.excludedProps).toEqual([
      { propId: prop.id, name: prop.name, reasons: ['lifecycle', 'page_forbidden'] },
    ]);
    expect(definition.zones.flatMap((zone) => zone.spatialNodes).some(
      (node) => node.bindsTo?.kind === 'prop' && node.bindsTo.id === prop.id,
    )).toBe(false);
    expect(definition.zones.flatMap((zone) => zone.spatialRelations).some(
      (relation) => relation.subjectId === 'tall_lamp' || relation.objectId === 'tall_lamp',
    )).toBe(false);
    expect(definition.fixedSetFacts.some((fact) => fact.propId === prop.id)).toBe(false);
  });

  it('keeps lifecycle-gated props off the base board even when the set is consumed only at reveal', () => {
    const contract = makeContract();
    const prop = contract.recurringProps.find((candidate) => candidate.id === 'floor_lamp')!;
    prop.firstRevealPage = 1;
    contract.coverContract.locationId = 'meadow';

    const definition = projectSetDefinition(contract, ID, STYLE);
    expect(definition.contentPolicy.excludedProps).toContainEqual({
      propId: prop.id,
      name: prop.name,
      reasons: ['lifecycle'],
    });
    expect(definition.contentPolicy.includedPropIds).not.toContain(prop.id);
  });
});

describe('groupLocationsBySetIdentity — authored grouping, never cross-wired', () => {
  it('(c) maps the two shared-identity locations to ONE group and the third to its own', () => {
    const groups = groupLocationsBySetIdentity(makeContract());
    expect(groups.size).toBe(2);
    expect(groups.get('set_alpha')?.map((l) => l.id).sort()).toEqual(['room_north', 'room_south']);
    expect(groups.get('meadow')?.map((l) => l.id)).toEqual(['meadow']);
  });

  it('(c) distinct identities never cross-wire', () => {
    const groups = groupLocationsBySetIdentity(makeContract());
    expect(groups.get('set_alpha')?.some((l) => l.id === 'meadow')).toBe(false);
    expect(groups.get('meadow')?.some((l) => l.id.startsWith('room_'))).toBe(false);
  });
});

describe('listRequiredSetIdentityIds — only pending/ready sets', () => {
  it('(d) returns only identities with a pending/ready setReference', () => {
    expect(listRequiredSetIdentityIds(makeContract())).toEqual(['set_alpha']);
  });

  it('(d) includes an identity promoted to ready and drops one demoted to none', () => {
    const c = makeContract();
    c.locations[2].setReference = { status: 'ready' }; // meadow → ready
    c.locations[0].setReference = { status: 'none' }; // room_north → none (only pending in set_alpha)
    expect(listRequiredSetIdentityIds(c)).toEqual(['meadow']);
  });

  it('(d) returns [] when nothing requires a board', () => {
    const c = makeContract();
    for (const loc of c.locations) loc.setReference = { status: 'none' };
    expect(listRequiredSetIdentityIds(c)).toEqual([]);
  });
});
