import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import { buildSetIdentityBoardPrompt } from '../boardPrompt';
import { buildBoardQaInstruction } from '../boardQa';
import {
  computeSetDefinitionHash,
  projectSetDefinition,
  SetBoardReservedPlacementAuthorityError,
} from '../setDefinition';
import {
  SET_BOARD_CONTENT_POLICY_VERSION,
  SET_BOARD_RESERVED_PAGE_CONTENT_POLICY_VERSION,
  SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
  SET_IDENTITY_BOARD_VERSION,
} from '../types';
import { clone, makeContract, STYLE } from './board-fixtures';

const SET_ID = 'set_alpha';
const PROP_ID = 'prop_page_lantern';

function addReservation(
  contract: BookVisualContract,
  args: {
    propId?: string;
    anchorId?: string;
    predicate?: 'places' | 'holds';
    polarity?: 'must' | 'must_not';
  } = {},
): BookVisualContract {
  const propId = args.propId ?? PROP_ID;
  if (!contract.recurringProps.some((prop) => prop.id === propId)) {
    contract.recurringProps.push({
      id: propId,
      name: propId === PROP_ID ? 'Page Lantern' : `Page Prop ${propId}`,
      description: 'page-conditioned content',
      firstRevealPage: 1,
    });
  }
  const page = contract.pageContracts[0]!;
  page.actionRequirements = [
    ...(page.actionRequirements ?? []),
    {
      checkId: `action:${propId}`,
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: contract.cast.child.id },
      },
      predicate: args.predicate ?? 'places',
      object: { kind: 'prop', id: propId },
      polarity: args.polarity ?? 'must',
    },
  ];
  page.propConstraints = [
    ...(page.propConstraints ?? []),
    {
      propId,
      visibility: 'required',
      anchorId: args.anchorId ?? 'anchor_hearth',
    },
  ];
  return contract;
}

function reservedDefinition(contract = addReservation(makeContract())) {
  return projectSetDefinition(contract, SET_ID, STYLE);
}

describe('Reserved Page Placement Authority — narrow deterministic projection', () => {
  it('upgrades only an exact same-page must/places/prop + one anchored required constraint', () => {
    const definition = reservedDefinition();
    expect(definition.boardVersion).toBe(
      SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
    );
    expect(definition.contentPolicy.version).toBe(
      SET_BOARD_RESERVED_PAGE_CONTENT_POLICY_VERSION,
    );
    if (
      definition.contentPolicy.version !==
      SET_BOARD_RESERVED_PAGE_CONTENT_POLICY_VERSION
    ) {
      throw new Error('expected reserved placement policy');
    }
    expect(definition.contentPolicy.reservedEmptyPlacements.placements).toEqual([
      {
        locationId: 'room_north',
        zoneId: 'z_north',
        anchorId: 'anchor_hearth',
        anchorDescription: 'a stone hearth on the west wall',
        propIds: [PROP_ID],
      },
    ]);
  });

  it('groups multiple page-conditioned props at the same physical point and sorts their identities', () => {
    const contract = addReservation(makeContract(), { propId: 'prop_zeta' });
    addReservation(contract, { propId: 'prop_alpha' });
    const definition = reservedDefinition(contract);
    if (
      definition.contentPolicy.version !==
      SET_BOARD_RESERVED_PAGE_CONTENT_POLICY_VERSION
    ) {
      throw new Error('expected reserved placement policy');
    }
    expect(definition.contentPolicy.reservedEmptyPlacements.placements).toHaveLength(1);
    expect(definition.contentPolicy.reservedEmptyPlacements.placements[0]!.propIds)
      .toEqual(['prop_alpha', 'prop_zeta']);
  });

  it.each([
    ['non-must', { polarity: 'must_not' as const }],
    ['non-places', { predicate: 'holds' as const }],
  ])('does not infer availability from %s action prose', (_label, action) => {
    const definition = projectSetDefinition(
      addReservation(makeContract(), action),
      SET_ID,
      STYLE,
    );
    expect(definition.boardVersion).toBe(SET_IDENTITY_BOARD_VERSION);
    expect(definition.contentPolicy.version).toBe(
      SET_BOARD_CONTENT_POLICY_VERSION,
    );
  });

  it('does not reserve a stable fixed prop already included on the base Board', () => {
    const definition = projectSetDefinition(
      addReservation(makeContract(), { propId: 'floor_lamp' }),
      SET_ID,
      STYLE,
    );
    expect(definition.boardVersion).toBe(SET_IDENTITY_BOARD_VERSION);
  });

  it('treats zero anchored constraints as no authority and fails closed on multiple candidates', () => {
    const missing = addReservation(makeContract());
    missing.pageContracts[0]!.propConstraints = [];
    expect(projectSetDefinition(missing, SET_ID, STYLE).boardVersion).toBe(
      SET_IDENTITY_BOARD_VERSION,
    );

    const duplicate = addReservation(makeContract());
    duplicate.pageContracts[0]!.propConstraints!.push({
      propId: PROP_ID,
      visibility: 'required',
      anchorId: 'anchor_hearth',
    });
    expect(() => reservedDefinition(duplicate)).toThrow(/got 2/);
    expect(() => reservedDefinition(duplicate)).toThrow(
      SetBoardReservedPlacementAuthorityError,
    );
  });

  it('fails closed when page zone or LocationAnchor cannot bind uniquely', () => {
    const noZone = addReservation(makeContract());
    delete noZone.pageContracts[0]!.zoneId;
    expect(() => reservedDefinition(noZone)).toThrow(/no exact page zone/);

    const wrongZone = addReservation(makeContract());
    wrongZone.pageContracts[0]!.zoneId = 'z_missing';
    expect(() => reservedDefinition(wrongZone)).toThrow(
      /does not map to exactly one stable Board area/,
    );

    const wrongAnchor = addReservation(makeContract(), {
      anchorId: 'anchor_missing',
    });
    expect(() => reservedDefinition(wrongAnchor)).toThrow(
      /is not unique in location/,
    );
  });

  it('preserves an explicit historical v6 projection while forward authority selects v7', () => {
    const contract = addReservation(makeContract());
    const forward = projectSetDefinition(contract, SET_ID, STYLE);
    const historical = projectSetDefinition(contract, SET_ID, STYLE, {
      boardVersion: SET_IDENTITY_BOARD_VERSION,
    });
    expect(forward.boardVersion).toBe(
      SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
    );
    expect(historical.boardVersion).toBe(SET_IDENTITY_BOARD_VERSION);
    expect(historical.contentPolicy.version).toBe(
      SET_BOARD_CONTENT_POLICY_VERSION,
    );
    expect(computeSetDefinitionHash(contract, SET_ID, STYLE)).not.toBe(
      computeSetDefinitionHash(contract, SET_ID, STYLE, {
        boardVersion: SET_IDENTITY_BOARD_VERSION,
      }),
    );
  });

  it('emits exact physical prose under provider-safe area/point aliases, never technical or prop ids', () => {
    const definition = reservedDefinition();
    const { prompt } = buildSetIdentityBoardPrompt(definition);
    expect(prompt).toContain(
      'Area 1, reserved placement point 1: a stone hearth on the west wall',
    );
    expect(prompt).not.toContain('anchor_hearth');
    expect(prompt).not.toContain(PROP_ID);
    expect(prompt).not.toContain('Page Lantern');

    const instruction = buildBoardQaInstruction(definition);
    const reservedSection = instruction.split(
      'RESERVED PAGE-CONTENT PLACEMENT AVAILABILITY:',
    )[1]!.split('REQUIRED AMBIENT SET DRESSING:')[0]!;
    expect(reservedSection).toContain(
      'reserved-placement-occupied:area-1:point-1',
    );
    expect(reservedSection).not.toContain('anchor_hearth');
    expect(reservedSection).not.toContain(PROP_ID);
  });
});

describe('Reserved Page Placement Authority — production-scale offline harness', () => {
  const candidatePath = path.join(
    process.cwd(),
    'outputs',
    'r1d-lantern-blueprint-wire-20260830T044048214Z',
    'bridge-corrected',
    'candidate-template-projections',
    'd96336715724d498a19792df094bfb5f085309f2cf946c853d4e6443c4528f2e.json',
  );

  it('proves d963 as home v6 unchanged + route 10 events grouped into exactly 6 v7 reservations', () => {
    const contract = JSON.parse(
      fs.readFileSync(candidatePath, 'utf8'),
    ) as BookVisualContract;
    const home = projectSetDefinition(
      contract,
      'set_home_interior',
      'soft_hand_drawn_storybook',
    );
    expect(home.boardVersion).toBe(SET_IDENTITY_BOARD_VERSION);
    expect(computeSetDefinitionHash(
      contract,
      'set_home_interior',
      'soft_hand_drawn_storybook',
    )).toBe('48bf9d53437746e27026a9b975b5fb6d35954f4a46782bb2f064380147fa0926');
    expect(buildSetIdentityBoardPrompt(home).promptHash).toBe(
      '5013469b5941b74f94691d99300bbf74556b0b0c389fe90e6fdc64cec6811748',
    );

    const route = projectSetDefinition(
      contract,
      'set_kindergarten_route',
      'soft_hand_drawn_storybook',
    );
    expect(route.boardVersion).toBe(
      SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
    );
    expect(route.positiveAuthorityPolicy.version).toBe(
      'set-board-positive-authority/v4',
    );
    expect(computeSetDefinitionHash(
      contract,
      'set_kindergarten_route',
      'soft_hand_drawn_storybook',
    )).toBe('38870567284b295c73cfea594ec3ab837b4a7ea221cf3df0c1de36404270071a');
    expect(buildSetIdentityBoardPrompt(route).promptHash).toBe(
      'ee55e313d67f3c4f4601d3b7b3c4983cc7f31d9ecf20d3bf28dad1bef05fa1e2',
    );
    if (
      route.contentPolicy.version !==
      SET_BOARD_RESERVED_PAGE_CONTENT_POLICY_VERSION
    ) {
      throw new Error('expected route reservation policy');
    }
    const placements = route.contentPolicy.reservedEmptyPlacements.placements;
    const qualifyingActionEvents = contract.pageContracts.flatMap((page) =>
      (page.actionRequirements ?? []).filter(
        (action) =>
          action.polarity === 'must' &&
          action.predicate === 'places' &&
          action.object?.kind === 'prop',
      ),
    );
    expect(qualifyingActionEvents).toHaveLength(10);
    expect(placements).toHaveLength(6);
    // Page 4 and page 5 both place the same green label at the same fountain stone; Board availability is one
    // physical association, not authored twice by chronology.
    expect(placements.reduce(
      (count, placement) => count + placement.propIds.length,
      0,
    )).toBe(9);
    expect(placements.map((placement) => placement.anchorId)).toEqual([
      'anchor_fountain_stone',
      'anchor_gate_path',
      'anchor_hedge_path_surface',
      'anchor_courtyard_hanging_hook',
      'anchor_courtyard_path',
      'anchor_market_cartway',
    ]);
    expect(() => buildSetIdentityBoardPrompt(route)).not.toThrow();
    expect(() => buildBoardQaInstruction(route)).not.toThrow();
  });
});
