import { describe, expect, it } from 'vitest';

import { canonicalize } from '@/lib/canonical-json';
import {
  setBoardStableAuthorityErrors,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';

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
            description: 'a tall brass floor lamp with a linen shade',
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
      },
      {
        id: 'z_meadow',
        locationId: 'meadow',
        name: 'Meadow Zone',
        description: 'the open field',
      },
    ],
    setBoardAuthorities: [
      {
        setIdentityId: 'set_alpha',
        locations: [
          {
            locationId: 'room_north',
            name: 'North Room',
            timeOfDay: 'day',
            lighting: 'stable diffuse daylight',
            environmentClass: 'indoor',
          },
          {
            locationId: 'room_south',
            name: 'South Room',
            timeOfDay: 'day',
            lighting: 'stable diffuse daylight',
            environmentClass: 'indoor',
          },
        ],
        areas: [
          {
            id: 'board_north',
            locationId: 'room_north',
            zoneProjection: { cardinality: 'one_to_one', zoneIds: ['z_north'] },
            spatialNodes: [
              { id: 'main_door', kind: 'doorway', description: 'a wide wooden doorway in the east wall' },
              {
                id: 'tall_lamp',
                kind: 'furniture',
                description: 'a tall brass floor lamp with a linen shade',
                propId: 'floor_lamp',
              },
            ],
            spatialRelations: [
              { subjectId: 'tall_lamp', relation: 'adjacent_to', objectId: 'main_door' },
            ],
          },
          {
            id: 'board_south',
            locationId: 'room_south',
            zoneProjection: { cardinality: 'one_to_one', zoneIds: ['z_south'] },
            spatialNodes: [
              { id: 'south_shelf', kind: 'wall', description: 'a long shelf on the south wall' },
            ],
          },
        ],
        fixedObjects: [
          {
            propId: 'floor_lamp',
            name: 'Floor Lamp',
            quantity: 1,
          },
        ],
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

  it('(a) CHANGES when the undeclared-prop negative authority changes', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.recurringProps.push({
      id: 'portable_lantern',
      name: 'Portable Lantern',
      description: 'a page-conditioned object',
    });
    expect(computeSetDefinitionHash(variant, ID, STYLE))
      .not.toBe(computeSetDefinitionHash(base, ID, STYLE));
  });

  it('(b) rejects drift between a stable area and its compiler-owned page-zone projection', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.zones[0].spatialNodes!.push({
      id: 'skylight',
      kind: 'window',
      description: 'a round skylight in the ceiling',
    });
    expect(() => computeSetDefinitionHash(variant, ID, STYLE)).toThrow(
      /compiler-owned area projection/,
    );
  });

  it('(b) rejects relation drift in a compiler-owned page-zone projection', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.zones[0].spatialRelations!.push({ subjectId: 'main_door', relation: 'centered_in' });
    expect(() => computeSetDefinitionHash(variant, ID, STYLE)).toThrow(
      /compiler-owned area projection/,
    );
  });

  it('(b) is IDENTICAL when page-rich location light changes', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.locations[0].lighting = 'a dramatic portable beam';
    expect(computeSetDefinitionHash(variant, ID, STYLE)).toBe(computeSetDefinitionHash(base, ID, STYLE));
  });

  it('(b) CHANGES when reviewed stable geometry changes', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.setBoardAuthorities![0].areas[0].spatialNodes[0].kind = 'window';
    variant.zones[0].spatialNodes![0].kind = 'window';
    expect(computeSetDefinitionHash(variant, ID, STYLE)).not.toBe(computeSetDefinitionHash(base, ID, STYLE));
  });

  it('(b) CHANGES when reviewed stable environmental light changes', () => {
    const base = makeContract();
    const variant = clone(base);
    variant.setBoardAuthorities![0].locations[0].lighting = 'stable overcast daylight';
    expect(computeSetDefinitionHash(variant, ID, STYLE)).not.toBe(computeSetDefinitionHash(base, ID, STYLE));
  });

  it('(b) CHANGES with styleId and boardVersion', () => {
    const base = makeContract();
    const h = computeSetDefinitionHash(base, ID, STYLE);
    expect(computeSetDefinitionHash(base, ID, 'soft_hand_drawn_storybook')).not.toBe(h);
    expect(computeSetDefinitionHash(base, ID, STYLE, { boardVersion: 'set-board/v1' })).not.toBe(h);
  });

  it('is deterministic (same inputs → same hash)', () => {
    const base = makeContract();
    expect(computeSetDefinitionHash(base, ID, STYLE)).toBe(computeSetDefinitionHash(makeContract(), ID, STYLE));
  });

  it('fails closed when reviewed stable authority includes a reveal-gated prop', () => {
    const contract = makeContract();
    const prop = contract.recurringProps.find((candidate) => candidate.id === 'floor_lamp')!;
    prop.firstRevealPage = 2;
    contract.pageContracts[0].propConstraints = [
      { propId: prop.id, visibility: 'forbidden' },
    ];

    expect(() => projectSetDefinition(contract, ID, STYLE)).toThrow(
      /lifecycle-gated and cannot be stable board content/,
    );
  });

  it('fails closed when stable authority is missing for a required set', () => {
    const contract = makeContract();
    delete contract.setBoardAuthorities;
    expect(() => projectSetDefinition(contract, ID, STYLE)).toThrow(
      /has no reviewed stable authority/,
    );
  });

  it('keeps no-board contracts schema-compatible without stable authority', () => {
    const contract = makeContract();
    for (const location of contract.locations) location.setReference = { status: 'none' };
    delete contract.setBoardAuthorities;
    expect(listRequiredSetIdentityIds(contract)).toEqual([]);
  });
});

describe('reviewed stable Set Board authority validation', () => {
  it('accepts a canonical key-sorted persistence round trip while preserving exact projection checks', () => {
    const source = makeContract();
    const persisted = JSON.parse(
      JSON.stringify(canonicalize(source)),
    ) as BookVisualContract;

    expect(Object.keys(persisted.zones[0]!.spatialNodes![0]!)).not.toEqual(
      Object.keys(source.zones[0]!.spatialNodes![0]!),
    );
    expect(Object.keys(persisted.setBoardAuthorities![0]!.fixedObjects[0]!)).not.toEqual(
      Object.keys(source.setBoardAuthorities![0]!.fixedObjects[0]!),
    );
    expect(setBoardStableAuthorityErrors(persisted)).toEqual([]);

    const nodeTampered = clone(persisted);
    nodeTampered.zones[0]!.spatialNodes![0]!.description = 'a different doorway';
    expect(setBoardStableAuthorityErrors(nodeTampered).join(' ')).toMatch(
      /spatialNodes do not equal the compiler-owned area projection/,
    );

    const arrayOrderTampered = clone(persisted);
    arrayOrderTampered.zones[0]!.spatialNodes!.reverse();
    expect(setBoardStableAuthorityErrors(arrayOrderTampered).join(' ')).toMatch(
      /spatialNodes do not equal the compiler-owned area projection/,
    );

    const objectTampered = clone(persisted);
    objectTampered.setBoardAuthorities![0]!.fixedObjects[0]!.name = 'Different Lamp';
    expect(setBoardStableAuthorityErrors(objectTampered).join(' ')).toMatch(
      /must equal its compiler-owned recurring-prop projection/,
    );
  });

  it('keeps final v4 compatible with multiple stable nodes describing one persistent fixed installation', () => {
    const contract = makeContract();
    contract.setBoardAuthorities![0]!.areas[1]!.spatialNodes.push({
      id: 'lamp_feed',
      kind: 'wall',
      description: 'the fixed conduit feeding the same installed floor lamp',
      propId: 'floor_lamp',
    });
    contract.zones[1]!.spatialNodes!.push({
      id: 'lamp_feed',
      kind: 'wall',
      description: 'the fixed conduit feeding the same installed floor lamp',
      bindsTo: { kind: 'prop', id: 'floor_lamp' },
    });

    expect(setBoardStableAuthorityErrors(contract)).toEqual([]);
  });

  it('requires complete authority for every pending/ready physical set', () => {
    const missing = makeContract();
    delete missing.setBoardAuthorities;
    expect(setBoardStableAuthorityErrors(missing).join(' ')).toMatch(
      /requires a Set Board.*no reviewed stable authority/,
    );

    const partial = makeContract();
    partial.setBoardAuthorities![0].locations.pop();
    expect(setBoardStableAuthorityErrors(partial).join(' ')).toMatch(
      /locations must cover exactly the physical-set locations/,
    );
  });

  it('keeps no-board stories compatible when the stable authority field is absent', () => {
    const contract = makeContract();
    for (const location of contract.locations) location.setReference = { status: 'none' };
    delete contract.setBoardAuthorities;
    expect(setBoardStableAuthorityErrors(contract)).toEqual([]);
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
