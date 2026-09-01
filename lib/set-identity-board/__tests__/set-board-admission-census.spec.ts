import fs from 'fs';
import path from 'path';

import { describe, expect, it, vi } from 'vitest';

import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';
import { resolveRequiredBoardArtifacts } from '@/lib/visual-package/artifacts';

import {
  assertRequiredSetBoardAdmission,
  collectRequiredSetBoardAdmissionCensus,
  RequiredSetBoardAdmissionError,
} from '../setBoardAdmission';
import { computeSetDefinitionHash } from '../setDefinition';
import {
  SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
} from '../types';
import { clone, makeContract, STYLE } from './board-fixtures';

function makeThreeSetContract() {
  const contract = clone(makeContract());
  const meadow = contract.locations.find((location) => location.id === 'meadow')!;
  meadow.setIdentityId = 'set_beta';
  meadow.setReference = { status: 'pending' };
  meadow.timeOfDay = 'night';
  meadow.lighting = 'stable moonlight';
  const meadowZone = contract.zones.find((zone) => zone.id === 'z_meadow')!;
  meadowZone.spatialNodes = [{
    id: 'route_opening',
    kind: 'doorway',
    description: 'Route opening toward the garden.',
  }];
  contract.setBoardAuthorities![0].areas[0].spatialNodes.push({
    id: 'spatial_work_table',
    kind: 'furniture',
    description: 'Fixed child-scale work table.',
  });
  contract.zones.find((zone) => zone.id === 'z_north')!.spatialNodes!.push({
    id: 'spatial_work_table',
    kind: 'furniture',
    description: 'Fixed child-scale work table.',
  });
  contract.setBoardAuthorities!.push({
    setIdentityId: 'set_beta',
    locations: [{
      locationId: 'meadow',
      name: 'Garden route',
      timeOfDay: 'night',
      lighting: 'stable moonlight',
      environmentClass: 'outdoor',
    }],
    areas: [{
      id: 'board_route',
      locationId: 'meadow',
      zoneProjection: { cardinality: 'one_to_one', zoneIds: ['z_meadow'] },
      spatialNodes: [{
        id: 'route_opening',
        kind: 'doorway',
        description: 'Route opening toward the garden.',
      }],
    }],
    fixedObjects: [],
  });
  contract.recurringProps.push({
    id: 'prop_route_labels',
    name: 'Route-label set',
    description: 'page-conditioned labels',
    firstRevealPage: 3,
  });
  contract.pageContracts[1].propConstraints = [{
    propId: 'prop_route_labels',
    visibility: 'forbidden',
  }];

  contract.locations.push({
    id: 'hallway',
    name: 'Hallway',
    description: 'a plain hallway',
    timeOfDay: 'night',
    lighting: 'stable wall light',
    environmentClass: 'indoor',
    setIdentityId: 'set_gamma',
    setReference: { status: 'pending' },
    anchors: [],
  });
  contract.zones.push({
    id: 'z_hallway',
    locationId: 'hallway',
    name: 'Hallway zone',
    description: 'the hallway',
    spatialNodes: [{
      id: 'hall_wall',
      kind: 'wall',
      description: 'Plain plaster wall.',
    }],
  });
  contract.setBoardAuthorities!.push({
    setIdentityId: 'set_gamma',
    locations: [{
      locationId: 'hallway',
      name: 'Hallway',
      timeOfDay: 'night',
      lighting: 'stable wall light',
      environmentClass: 'indoor',
    }],
    areas: [{
      id: 'board_hallway',
      locationId: 'hallway',
      zoneProjection: { cardinality: 'one_to_one', zoneIds: ['z_hallway'] },
      spatialNodes: [{
        id: 'hall_wall',
        kind: 'wall',
        description: 'Plain plaster wall.',
      }],
    }],
    fixedObjects: [],
  });
  return contract;
}

function makeContextualTwoSetContract() {
  const contract = clone(makeContract());
  for (const location of contract.locations.filter((candidate) =>
    candidate.setIdentityId === 'set_alpha')) {
    location.setIdentityId = 'set_home_interior';
  }
  const homeAuthority = contract.setBoardAuthorities![0];
  homeAuthority.setIdentityId = 'set_home_interior';
  homeAuthority.areas[0].spatialNodes.push({
    id: 'node_craft_table',
    kind: 'furniture',
    description: 'Sturdy child-accessible craft table.',
  });
  contract.zones.find((zone) => zone.id === 'z_north')!.spatialNodes!.push({
    id: 'node_craft_table',
    kind: 'furniture',
    description: 'Sturdy child-accessible craft table.',
  });

  const route = contract.locations.find((location) => location.id === 'meadow')!;
  route.setIdentityId = 'set_kindergarten_route';
  route.setReference = { status: 'pending' };
  route.timeOfDay = 'day';
  route.lighting = 'stable soft daylight';
  const routeZone = contract.zones.find((zone) => zone.id === 'z_meadow')!;
  routeZone.spatialNodes = [{
    id: 'node_kindergarten_gate',
    kind: 'doorway',
    description: 'Openable kindergarten gate.',
  }];
  contract.setBoardAuthorities!.push({
    setIdentityId: 'set_kindergarten_route',
    locations: [{
      locationId: route.id,
      name: 'Garden route',
      timeOfDay: 'day',
      lighting: 'stable soft daylight',
      environmentClass: 'outdoor',
    }],
    areas: [{
      id: 'board_kindergarten_route',
      locationId: route.id,
      zoneProjection: { cardinality: 'one_to_one', zoneIds: [routeZone.id] },
      spatialNodes: [{
        id: 'node_kindergarten_gate',
        kind: 'doorway',
        description: 'Openable kindergarten gate.',
      }],
    }],
    fixedObjects: [],
  });
  contract.humanCast = [{
    id: 'human:kindergarten_guard',
    role: 'kindergarten_guard',
    aliases: ['שומרת הגן'],
    gender: 'female',
    coarseAppearance: 'adult with short dark hair',
    wardrobe: { description: 'a plain navy staff shirt and khaki trousers' },
    forbiddenAppearance: [],
    pagesPresent: [2],
    textEvidence: 'שומרת הגן',
  }];
  return contract;
}

describe('required Set Board admission census', () => {
  it('admits the exact contextual home and kindergarten authority shapes under v4', () => {
    const contract = makeContextualTwoSetContract();
    const first = collectRequiredSetBoardAdmissionCensus(contract, STYLE);
    const replay = collectRequiredSetBoardAdmissionCensus(contract, STYLE);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      requiredSetIdentityIds: [
        'set_home_interior',
        'set_kindergarten_route',
      ],
      admittedSetIdentityIds: [
        'set_home_interior',
        'set_kindergarten_route',
      ],
      rejectedSetIdentityIds: [],
      contractIssues: [],
      issueCount: 0,
      admitted: true,
    });
    expect(first.results.map((result) => result.policyVersion)).toEqual([
      SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION,
      SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION,
    ]);
  });

  it('admits every Candidate-shaped Set with deterministic v2/v3 policy selection', () => {
    const contract = makeThreeSetContract();
    const first = collectRequiredSetBoardAdmissionCensus(contract, STYLE);
    const replay = collectRequiredSetBoardAdmissionCensus(contract, STYLE);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      styleId: STYLE,
      contractIssues: [],
      requiredSetIdentityIds: ['set_alpha', 'set_beta', 'set_gamma'],
      admittedSetIdentityIds: ['set_alpha', 'set_beta', 'set_gamma'],
      rejectedSetIdentityIds: [],
      issueCount: 0,
      admitted: true,
    });
    expect(first.results.map((result) => [
      result.setIdentityId,
      result.policyVersion,
    ])).toEqual([
      ['set_alpha', SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION],
      ['set_beta', SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION],
      ['set_gamma', SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION],
    ]);
  });

  it('collects all rejected Sets and fields before any Registry filesystem read', () => {
    const contract = makeThreeSetContract();
    contract.setBoardAuthorities![0].areas[0].spatialNodes[2].description =
      'Fixed child-scale table with the child waiting.';
    contract.zones.find((zone) => zone.id === 'z_north')!
      .spatialNodes![2].description =
      'Fixed child-scale table with the child waiting.';
    contract.setBoardAuthorities![1].areas[0].spatialNodes[0].description =
      'Route-label set mounted above the opening.';
    contract.zones.find((zone) => zone.id === 'z_meadow')!
      .spatialNodes![0].description =
      'Route-label set mounted above the opening.';
    contract.setBoardAuthorities![2].locations[0].lighting =
      'the companion waits under stable wall light';

    const exists = vi.spyOn(fs, 'existsSync');
    const resolved = resolveRequiredBoardArtifacts({
      repoRoot: process.cwd(),
      boardRegistryRoot: 'must-not-be-read',
      template: contract as unknown as BookVisualContractTemplate,
      styleId: STYLE,
    });

    expect(exists).not.toHaveBeenCalled();
    expect(resolved.boards).toEqual([]);
    expect(resolved.issues.every((issue) =>
      issue.code === 'board_authority_invalid')).toBe(true);
    expect(new Set(resolved.issues.map((issue) =>
      String(issue.field).split('.')[1]))).toEqual(
      new Set(['set_alpha', 'set_beta', 'set_gamma']),
    );
    expect(resolved.issues.map((issue) => issue.field)).toEqual([
      'requiredBoards.set_alpha.zones[0].geometry[2]',
      'requiredBoards.set_beta.zones[0].geometry[0]',
      'requiredBoards.set_gamma.locations[0].lighting',
    ]);
    exists.mockRestore();
  });

  it('accepts a contract with no required Set without inventing work', () => {
    const contract = makeContract();
    for (const location of contract.locations) {
      location.setReference = { status: 'none' };
    }
    delete contract.setBoardAuthorities;
    expect(collectRequiredSetBoardAdmissionCensus(contract, STYLE)).toMatchObject({
      requiredSetIdentityIds: [],
      styleId: STYLE,
      results: [],
      issueCount: 0,
      admitted: true,
    });
  });

  it('preserves stable-authority diagnostics and rejects the aggregate proof', () => {
    const contract = makeContract();
    delete contract.setBoardAuthorities;
    const census = collectRequiredSetBoardAdmissionCensus(contract, STYLE);
    expect(census).toMatchObject({
      styleId: STYLE,
      admitted: false,
      rejectedSetIdentityIds: ['set_alpha'],
      results: [{
        setIdentityId: 'set_alpha',
        status: 'rejected',
        issues: [{
          code: 'set_board_stable_authority_invalid',
          details: expect.arrayContaining([
            expect.stringContaining('no reviewed stable authority'),
          ]),
        }],
      }],
    });
    expect(() => assertRequiredSetBoardAdmission(census)).toThrow(
      RequiredSetBoardAdmissionError,
    );
  });

  it('isolates stable and semantic failures per Set without cross-Set masking', () => {
    const contract = makeThreeSetContract();
    contract.setBoardAuthorities![0].areas[0].spatialNodes[2].description =
      'Fixed child-scale work table with the child waiting.';
    contract.zones.find((zone) => zone.id === 'z_north')!
      .spatialNodes![2].description =
      'Fixed child-scale work table with the child waiting.';
    contract.setBoardAuthorities![1].areas = [];
    const census = collectRequiredSetBoardAdmissionCensus(contract, STYLE);
    expect(census.admitted).toBe(false);
    expect(census.rejectedSetIdentityIds).toEqual([
      'set_alpha',
      'set_beta',
    ]);
    expect(census.admittedSetIdentityIds).toEqual(['set_gamma']);
    expect(census.results[0].issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'set_board_positive_authority_leak',
        category: 'cast',
      }),
    ]));
    expect(census.results[1].issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'set_board_stable_authority_invalid',
        details: expect.arrayContaining([
          expect.stringContaining('set_beta'),
        ]),
      }),
    ]));
    expect(census.results[2]).toMatchObject({
      setIdentityId: 'set_gamma',
      status: 'admitted',
      issues: [],
    });
    expect(census.issueCount).toBe(
      census.results.reduce(
        (count, result) => count + result.issues.length,
        0,
      ),
    );
  });

  it('collects orphan authority failures at contract scope before Registry I/O', () => {
    const contract = makeThreeSetContract();
    contract.setBoardAuthorities!.push({
      setIdentityId: 'set_orphan',
      locations: [],
      areas: [],
      fixedObjects: [],
    });

    const census = collectRequiredSetBoardAdmissionCensus(contract, STYLE);
    expect(census).toMatchObject({
      admitted: false,
      admittedSetIdentityIds: ['set_alpha', 'set_beta', 'set_gamma'],
      rejectedSetIdentityIds: [],
    });
    expect(census.contractIssues.length).toBeGreaterThan(0);
    expect(census.contractIssues.every((issue) =>
      issue.setIdentityId === '*' &&
      issue.code === 'set_board_stable_authority_invalid')).toBe(true);
    expect(census.contractIssues.map((issue) => issue.message).join('\n'))
      .toContain('set_orphan');
    expect(census.issueCount).toBe(census.contractIssues.length);
    expect(() => assertRequiredSetBoardAdmission(census)).toThrow(
      /contract-scope issue\(s\)/,
    );

    const exists = vi.spyOn(fs, 'existsSync');
    try {
      const resolved = resolveRequiredBoardArtifacts({
        repoRoot: process.cwd(),
        boardRegistryRoot: 'must-not-be-read',
        template: contract as unknown as BookVisualContractTemplate,
        styleId: STYLE,
      });
      expect(exists).not.toHaveBeenCalled();
      expect(resolved.boards).toEqual([]);
      expect(resolved.issues).toHaveLength(census.contractIssues.length);
      expect(resolved.issues.every((issue) =>
        issue.code === 'board_authority_invalid' &&
        issue.field === 'requiredBoards')).toBe(true);
    } finally {
      exists.mockRestore();
    }
  });

  it('keeps malformed residual authorities visible to the contract census', () => {
    const contract = makeThreeSetContract();
    contract.setBoardAuthorities!.push(
      {} as NonNullable<BookVisualContract['setBoardAuthorities']>[number],
    );

    const census = collectRequiredSetBoardAdmissionCensus(contract, STYLE);
    expect(census.admitted).toBe(false);
    expect(census.rejectedSetIdentityIds).toEqual([]);
    expect(census.contractIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        setIdentityId: '*',
        code: 'set_board_stable_authority_invalid',
        message: expect.stringContaining('setIdentityId missing'),
      }),
    ]));
  });

  it('does not erase an explicitly empty authority collection', () => {
    const contract = makeContract();
    for (const location of contract.locations) {
      location.setReference = { status: 'none' };
    }
    contract.setBoardAuthorities = [];

    const census = collectRequiredSetBoardAdmissionCensus(contract, STYLE);
    expect(census).toMatchObject({
      requiredSetIdentityIds: [],
      rejectedSetIdentityIds: [],
      results: [],
      admitted: false,
      issueCount: 1,
      contractIssues: [{
        setIdentityId: '*',
        code: 'set_board_stable_authority_invalid',
        message: expect.stringContaining('must be a non-empty array'),
      }],
    });
  });

  it('preserves the already-approved Chameleon v2 Registry identities exactly', () => {
    const approved = JSON.parse(fs.readFileSync(path.join(
      process.cwd(),
      'visual-packages',
      'approved',
      'revisions',
      '2b488f2db44702106f49ad80c257b88269972ffb8ebbc92cced95f81c13d98a6.visual-package.json',
    ), 'utf8')) as {
      styleId: string;
      visualContractTemplate: { content: BookVisualContractTemplate };
      requiredBoards: Array<{
        setIdentityId: string;
        boardVersion: string;
        setDefinitionHash: string;
      }>;
    };
    const contract = approved.visualContractTemplate.content as unknown as BookVisualContract;
    const boardVersionsBySet = new Map(
      approved.requiredBoards.map((board) => [
        board.setIdentityId,
        board.boardVersion,
      ]),
    );
    const census = collectRequiredSetBoardAdmissionCensus(
      contract,
      approved.styleId,
      { boardVersionsBySet },
    );
    expect(census.results.map((result) => result.policyVersion)).toEqual([
      SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
      SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
    ]);
    expect(census.results.map((result) => ({
      setIdentityId: result.setIdentityId,
      setDefinitionHash: computeSetDefinitionHash(
        contract,
        result.setIdentityId,
        approved.styleId,
        { boardVersion: boardVersionsBySet.get(result.setIdentityId)! },
      ),
    }))).toEqual(approved.requiredBoards.map((board) => ({
      setIdentityId: board.setIdentityId,
      setDefinitionHash: board.setDefinitionHash,
    })).sort((left, right) =>
      left.setIdentityId.localeCompare(right.setIdentityId)));
  });
});
