/**
 * SYNTHETIC fixtures for the Milestone C resolver/lifecycle specs. Reference NO real story, child, or companion —
 * everything here is invented so the specs prove the GENERAL mechanism, never one book's shape.
 */
import {
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  type SetIdentityBoardRegistryEntry,
} from '../types';
import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import {
  computeSetBoardContentPolicyDigest,
  projectSetDefinition,
} from '../setDefinition';

export const STYLE = 'detailed_whimsical_world';

/** Deep clone so a mutated variant never aliases the base. */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Two locations share ONE set identity ('set_alpha') and REQUIRE a board; 'meadow' is its own identity and does NOT
 * (setReference:'none'). The cover is set in `room_north` (→ set_alpha), page 2 is in the meadow — so the fixture
 * exercises "a page gets its OWN set's board, and a page with no board gets none".
 */
export function makeContract(): BookVisualContract {
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
        environmentClass: 'indoor',
        setIdentityId: 'set_alpha',
        setReference: { status: 'ready' },
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
        // Must EQUAL the deterministic projection of the nodes/relations above, or the vNext validator rejects
        // the contract and `readFrozenVisualContract` returns null (these fixtures must be genuinely renderable).
        stableGeometry: [
          'doorway "main_door": a wide wooden doorway in the east wall',
          'furniture "tall_lamp": a tall brass floor lamp with a linen shade',
          '"tall_lamp" is adjacent to "main_door"',
        ],
      },
      {
        id: 'z_south',
        locationId: 'room_south',
        name: 'South Zone',
        description: 'the main south area',
        spatialNodes: [{ id: 'south_shelf', kind: 'wall', description: 'a long shelf on the south wall' }],
        // spatialRelations omitted (not `[]`) — the validator requires non-empty when the key is present.
        stableGeometry: ['wall "south_shelf": a long shelf on the south wall'],
      },
      { id: 'z_meadow', locationId: 'meadow', name: 'Meadow Zone', description: 'the open field' },
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
    humanCast: [],
    recurringProps: [
      {
        id: 'floor_lamp',
        name: 'Floor Lamp',
        description: 'a standing lamp',
        material: 'brass and linen',
        scale: "reaches the child's shoulder",
      },
    ],
    forbiddenGlobalElements: ['dragon'],
    coverContract: { worldType: 'indoor_world', locationId: 'room_north', mustShow: [], mustNotShow: [] },
    pageContracts: [
      {
        pageNumber: 1,
        locationId: 'room_north',
        zoneId: 'z_north',
        castIds: ['child_1', 'comp_1'],
        mustShow: [],
        mustNotShow: [],
        characterPresence: { child: true, companion: true },
        propState: [{ propId: 'floor_lamp', state: 'on' }],
        camera: 'wide establishing shot',
      },
      {
        pageNumber: 2,
        locationId: 'meadow',
        zoneId: 'z_meadow',
        castIds: ['child_1'],
        // An explicit move, or the validator flags an undeclared scene change.
        transition: { kind: 'after_transition', fromZoneId: 'z_north', toZoneId: 'z_meadow', cue: 'they head outside' },
        mustShow: [],
        mustNotShow: [],
        characterPresence: { child: true, companion: false },
        propState: [],
        camera: 'medium shot',
      },
    ],
  };
}

/** A fully APPROVED registry entry for `setDefinitionHash`. Overrides let a spec break exactly one field. */
export function makeApprovedEntry(
  setDefinitionHash: string,
  overrides: Partial<SetIdentityBoardRegistryEntry> = {}
): SetIdentityBoardRegistryEntry {
  const definition = projectSetDefinition(makeContract(), 'set_alpha', STYLE);
  return {
    registryVersion: SET_IDENTITY_REGISTRY_VERSION,
    boardVersion: SET_IDENTITY_BOARD_VERSION,
    storyKey: 'synthetic_story',
    setIdentityId: 'set_alpha',
    styleId: STYLE,
    setDefinitionHash,
    contentPolicyDigest: computeSetBoardContentPolicyDigest(definition),
    declaredPropIds: definition.contentPolicy.includedPropIds,
    storageKey: 'set-identity-boards/synthetic/set_alpha/board.png',
    assetSha256: 'sha-approved-bytes',
    promptHash: 'prompt-hash-1',
    model: 'gpt-image-2',
    quality: 'high',
    qaStatus: 'passed',
    qaCheckedAt: '2026-07-01T00:00:00.000Z',
    approvedBy: 'guy',
    approvedAt: '2026-07-02T00:00:00.000Z',
    ...overrides,
  };
}
