import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import { buildSetIdentityBoardPrompt } from '../boardPrompt';
import {
  collectSetBoardPositiveAuthorityIssues,
  deriveExcludedPropCanonicalTerms,
  positiveAuthorityLabelIsSafe,
  SetBoardPositiveAuthorityLeakError,
  SetBoardPositiveAuthoritySpoilerError,
} from '../positiveAuthoritySpoilerGuard';
import {
  collectSetDefinitionAdmissionIssues,
  computeSetDefinitionHash,
  projectSetDefinition,
} from '../setDefinition';
import {
  SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
} from '../types';
import { clone, makeContract, STYLE } from './board-fixtures';
import { migrateLegacySetBoardFixture } from './current-authority-fixtures';

const SET_ID = 'set_alpha';

function revealGatedContract(args: {
  propId?: string;
  propName?: string;
} = {}): BookVisualContract {
  const contract = clone(makeContract());
  const prop = {
    id: args.propId ?? 'prop_tin_bucket',
    name: args.propName ?? 'Old Tin Bucket',
    description: 'a page-conditioned object',
    firstRevealPage: 2,
  };
  contract.recurringProps.push(prop);
  contract.pageContracts[0].propState = [];
  contract.pageContracts[0].propConstraints = [
    { propId: prop.id, visibility: 'forbidden' },
  ];
  return contract;
}

function expectLeak(
  action: () => unknown,
  expected: {
    fieldPath: string | RegExp;
    matchedTerm?: string;
    excludedPropId?: string;
  },
): SetBoardPositiveAuthoritySpoilerError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(SetBoardPositiveAuthoritySpoilerError);
    const leak = error as SetBoardPositiveAuthoritySpoilerError;
    if (typeof expected.fieldPath === 'string') {
      expect(leak.fieldPath).toBe(expected.fieldPath);
    } else {
      expect(leak.fieldPath).toMatch(expected.fieldPath);
    }
    expect(leak.matchedTerm).toBe(expected.matchedTerm ?? 'bucket');
    expect(leak.excludedPropId).toBe(expected.excludedPropId ?? 'prop_tin_bucket');
    expect(leak.message).toContain(leak.setIdentityId);
    expect(leak.message).toContain(leak.provenance);
    return leak;
  }
  throw new Error('expected positive board authority to fail closed');
}

function addStableGeometryNode(
  contract: BookVisualContract,
  description: string,
  id: string,
  kind: 'furniture' | 'wall' = 'furniture',
): void {
  const authorityArea = contract.setBoardAuthorities![0].areas[0];
  const zoneId = authorityArea.zoneProjection.zoneIds[0];
  const zone = contract.zones.find((candidate) => candidate.id === zoneId)!;
  authorityArea.spatialNodes.push({ id, kind, description });
  zone.spatialNodes = [
    ...(zone.spatialNodes ?? []),
    { id, kind, description },
  ];
}

describe('Set Board positive free-text spoiler guard', () => {
  it('derives full phrases and one semantic head while dropping the prop_ namespace', () => {
    expect(deriveExcludedPropCanonicalTerms({
      propId: 'prop_tin_bucket',
      name: 'Old Tin Bucket',
    })).toEqual(['old tin bucket', 'tin bucket', 'bucket']);
    expect(deriveExcludedPropCanonicalTerms({
      propId: 'prop_key',
      name: 'Key',
    })).toEqual(['key']);
    expect(deriveExcludedPropCanonicalTerms({
      propId: 'prop_globe',
      name: 'Globe',
    })).not.toContain('prop');
    expect(deriveExcludedPropCanonicalTerms({
      propId: 'prop_route_labels',
      name: 'Route-label set',
    }, SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION)).toEqual([
      'route label set',
      'route labels',
      'labels',
      'label',
    ]);
    expect(deriveExcludedPropCanonicalTerms({
      propId: 'prop_lantern',
      name: 'Old Lamp',
    }, SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION)).toEqual([
      'old lamp',
      'lantern',
      'lamp',
    ]);
  });

  it('uses v3 only for a v2 false collision and keeps clean v2 identity bytes stable', () => {
    const clean = projectSetDefinition(makeContract(), SET_ID, STYLE);
    expect(clean.positiveAuthorityPolicy.version).toBe(
      SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
    );
    expect(computeSetDefinitionHash(makeContract(), SET_ID, STYLE)).toBe(
      'f4e271938edf91beb3b12c7b8634e43564edfbfecfd5a6d66eee42b747101f50',
    );

    const physicalScale = makeContract();
    addStableGeometryNode(
      physicalScale,
      'Fixed child-scale work table.',
      'spatial_work_table',
    );
    const precise = projectSetDefinition(physicalScale, SET_ID, STYLE);
    expect(precise.positiveAuthorityPolicy.version).toBe(
      SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION,
    );
    expect(() => buildSetIdentityBoardPrompt(precise)).not.toThrow();
    expect(computeSetDefinitionHash(physicalScale, SET_ID, STYLE)).not.toBe(
      'f4e271938edf91beb3b12c7b8634e43564edfbfecfd5a6d66eee42b747101f50',
    );
  });

  it('bounds the child-scale exemption to physical fields and still catches a real child occurrence', () => {
    for (const [description, id] of [
      ['Fixed child-scale craft table.', 'spatial_craft_table'],
      ['Child-scale bed beside the wall.', 'spatial_bed'],
    ] as const) {
      const contract = makeContract();
      addStableGeometryNode(contract, description, id);
      expect(() => projectSetDefinition(contract, SET_ID, STYLE)).not.toThrow();
    }
    for (const modifier of ['scale', 'scaled', 'sized']) {
      const contract = makeContract();
      addStableGeometryNode(
        contract,
        `Fixed child-${modifier} work table.`,
        'spatial_work_table',
      );
      expect(() => projectSetDefinition(contract, SET_ID, STYLE)).not.toThrow();
    }

    const actualCast = makeContract();
    addStableGeometryNode(
      actualCast,
      'Fixed child-scale bed with a child sleeping beside it.',
      'unsafe_bed',
    );
    expect(() => projectSetDefinition(actualCast, SET_ID, STYLE)).toThrow(
      /set_board_positive_authority_leak/,
    );

    for (const description of [
      'Fixed person-sized bed.',
      'Fixed child-sized person sculpture.',
      'Fixed child-scale table beside Kid.',
      'The child scaled the wall.',
      'The child sized the table.',
      'The child scale model was moved.',
    ]) {
      const hostile = makeContract();
      addStableGeometryNode(hostile, description, 'hostile_scale_phrase');
      expect(() => projectSetDefinition(hostile, SET_ID, STYLE)).toThrow(
        /set_board_positive_authority_leak/,
      );
    }

    const nonGeometry = makeContract();
    addStableGeometryNode(
      nonGeometry,
      'Fixed child-scale work table.',
      'safe_table',
    );
    nonGeometry.setBoardAuthorities![0].locations[0].lighting =
      'child-scale warm lighting';
    expect(() => projectSetDefinition(nonGeometry, SET_ID, STYLE)).toThrow(
      /set_board_positive_authority_leak/,
    );

    const precise = makeContract();
    addStableGeometryNode(
      precise,
      'Fixed child-scale work table.',
      'spatial_work_table',
    );
    const preciseDefinition = projectSetDefinition(precise, SET_ID, STYLE);
    expect(positiveAuthorityLabelIsSafe(
      preciseDefinition,
      'Child-scale room',
    )).toBe(false);
  });

  it('binds the scale exception to a closed furniture head and exact node suffix', () => {
    for (const representation of [
      'portrait',
      'statue',
      'photo',
      'silhouette',
    ]) {
      const hostile = makeContract();
      addStableGeometryNode(
        hostile,
        `Fixed child-scale ${representation}.`,
        `spatial_${representation}`,
      );
      expect(() => projectSetDefinition(hostile, SET_ID, STYLE)).toThrow(
        /set_board_positive_authority_leak/,
      );
    }

    for (const representation of [
      'portrait',
      'statue',
      'photo',
      'silhouette',
    ]) {
      const disguised = makeContract();
      addStableGeometryNode(
        disguised,
        `Fixed child-scale ${representation} table.`,
        `spatial_${representation}_table`,
      );
      expect(() => projectSetDefinition(disguised, SET_ID, STYLE)).toThrow(
        /set_board_positive_authority_leak/,
      );
    }

    const wrongKind = makeContract();
    addStableGeometryNode(
      wrongKind,
      'Fixed child-scale bed.',
      'spatial_bed',
      'wall',
    );
    expect(() => projectSetDefinition(wrongKind, SET_ID, STYLE)).toThrow(
      /set_board_positive_authority_leak/,
    );

    for (const [id, description] of [
      ['spatial_bed', 'Fixed child-scale portrait.'],
      ['spatial_portrait', 'Fixed child-scale bed.'],
    ] as const) {
      const mismatch = makeContract();
      addStableGeometryNode(mismatch, description, id);
      expect(() => projectSetDefinition(mismatch, SET_ID, STYLE)).toThrow(
        /set_board_positive_authority_leak/,
      );
    }
  });

  it('allows environmental route geometry while keeping route-label prop authority closed', () => {
    const contract = revealGatedContract({
      propId: 'prop_route_labels',
      propName: 'Route-label set',
    });
    addStableGeometryNode(
      contract,
      'Route opening toward the market.',
      'route_threshold',
    );
    const definition = projectSetDefinition(contract, SET_ID, STYLE);
    expect(definition.positiveAuthorityPolicy.version).toBe(
      SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION,
    );

    for (const leak of [
      'Route-label set attached to the wall.',
      'Route labels attached to the wall.',
      'Single label attached to the wall.',
    ]) {
      const hostile = clone(definition);
      hostile.zones[0].geometry[0] = leak;
      expect(() => buildSetIdentityBoardPrompt(hostile)).toThrow(
        /set_board_positive_authority_spoiler_leak/,
      );
    }

    const actualRouteProp = revealGatedContract({
      propId: 'prop_route',
      propName: 'Route',
    });
    addStableGeometryNode(
      actualRouteProp,
      'Route opening toward the market.',
      'actual_route_prop_leak',
    );
    expect(() => projectSetDefinition(actualRouteProp, SET_ID, STYLE)).toThrow(
      /set_board_positive_authority_spoiler_leak/,
    );
  });

  it('does not let a v3 scale exception weaken an unrelated excluded-prop head', () => {
    for (const evidence of [
      {
        propId: 'prop_lantern',
        propName: 'Old Lamp',
        description: 'Fixed child-scale table beside an old lamp.',
        matchedTerm: 'old lamp',
      },
      {
        propId: 'prop_treasure_chest',
        propName: 'Treasure Box',
        description: 'Fixed child-scale table beside a treasure alcove.',
        matchedTerm: 'treasure',
      },
    ]) {
      const contract = revealGatedContract(evidence);
      addStableGeometryNode(
        contract,
        evidence.description,
        'spatial_table',
      );
      expect(() => projectSetDefinition(contract, SET_ID, STYLE)).toThrow(
        /set_board_positive_authority_spoiler_leak/,
      );
      expect(collectSetDefinitionAdmissionIssues(
        contract,
        SET_ID,
        STYLE,
      )).toEqual(expect.arrayContaining([
        expect.objectContaining({
          excludedPropId: evidence.propId,
          matchedTerm: evidence.matchedTerm,
        }),
      ]));
    }
  });

  it('collects every positive-authority field issue while the direct projector stays fail-closed', () => {
    const contract = revealGatedContract();
    contract.setBoardAuthorities![0].locations[0].lighting =
      'bucket glow beside the child';
    addStableGeometryNode(
      contract,
      'bucket-plated shelf where the child waits',
      'hostile_shelf',
    );
    const issues = collectSetDefinitionAdmissionIssues(
      contract,
      SET_ID,
      STYLE,
    );
    expect(issues.map((candidate) => candidate.fieldPath)).toEqual([
      'locations[0].lighting',
      'zones[0].geometry[2]',
      'locations[0].lighting',
      'zones[0].geometry[2]',
    ]);
    expect(new Set(issues.map((candidate) => candidate.code))).toEqual(
      new Set([
        'set_board_positive_authority_spoiler_leak',
        'set_board_positive_authority_leak',
      ]),
    );
    expect(() => projectSetDefinition(contract, SET_ID, STYLE)).toThrow(
      SetBoardPositiveAuthoritySpoilerError,
    );

    const precise = clone(projectSetDefinition(
      (() => {
        const safe = makeContract();
        addStableGeometryNode(safe, 'Fixed child-scale table.', 'spatial_table');
        return safe;
      })(),
      SET_ID,
      STYLE,
    ));
    precise.zones[0].geometry.push('the child waits');
    expect(collectSetBoardPositiveAuthorityIssues(precise)).toHaveLength(1);
  });

  it('keeps distinct blocked identities visible when they share one label', () => {
    const definition = clone(projectSetDefinition(makeContract(), SET_ID, STYLE));
    definition.positiveAuthorityPolicy.version =
      SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION;
    definition.positiveAuthorityPolicy.blockedProps = [
      { propId: 'prop_spare_label', name: 'Spare Label' },
      { propId: 'prop_terminal_label', name: 'Terminal Label' },
    ];
    definition.zones[0].geometry.push('Single label attached to the wall.');
    expect(collectSetBoardPositiveAuthorityIssues(definition)
      .filter((candidate): candidate is SetBoardPositiveAuthorityLeakError =>
        candidate instanceof SetBoardPositiveAuthorityLeakError &&
        candidate.category === 'undeclared_prop')
      .map((candidate) => candidate.blockedIdentity)).toEqual([
      'prop_spare_label',
      'prop_terminal_label',
    ]);
  });

  it('projects an unsafe metadata-only location name without weakening excluded-prop authority', () => {
    const contract = revealGatedContract();
    contract.setBoardAuthorities![0].locations[0].name = 'Bucket Supply Room';
    const definition = projectSetDefinition(contract, SET_ID, STYLE);
    const { prompt, negativePrompt } = buildSetIdentityBoardPrompt(definition);
    expect(prompt).not.toContain('Bucket Supply Room');
    expect(prompt).toMatch(/location_[a-f0-9]{64}/);
    expect(negativePrompt).toContain('NO Old Tin Bucket');
  });

  it('rejects the validated partial lighting leak with precise field provenance', () => {
    const contract = revealGatedContract();
    contract.setBoardAuthorities![0].locations[0].lighting = 'FLASHLIGHT on the bucket!';

    const leak = expectLeak(
      () => projectSetDefinition(contract, SET_ID, STYLE),
      { fieldPath: 'locations[0].lighting' },
    );
    expect(leak.provenance).toContain('positive lighting facet');
    expect(leak.excludedPropName).toBe('Old Tin Bucket');
  });

  it('projects metadata identity while rejecting adjacent geometry and fixed-object material leaks', () => {
    const identityLeak = projectSetDefinition(revealGatedContract(), SET_ID, STYLE);
    identityLeak.setIdentityId = 'set_bucket_gallery';
    const identityPrompt = buildSetIdentityBoardPrompt(identityLeak).prompt;
    expect(identityPrompt).not.toContain('set_bucket_gallery');
    expect(identityPrompt).toMatch(/SET IDENTITY: set_[a-f0-9]{64}/);

    const geometryLeak = revealGatedContract();
    geometryLeak.setBoardAuthorities![0].areas[1].spatialNodes.push({
      id: 'clean_shelf_extension',
      kind: 'furniture',
      description: 'a narrow shelf directly above the bucket',
    });
    geometryLeak.zones[1].spatialNodes!.push({
      id: 'clean_shelf_extension',
      kind: 'furniture',
      description: 'a narrow shelf directly above the bucket',
    });
    expectLeak(
      () => projectSetDefinition(geometryLeak, SET_ID, STYLE),
      { fieldPath: /zones\[\d+\]\.geometry\[\d+\]/ },
    );

    const materialLeak = projectSetDefinition(
      revealGatedContract(),
      SET_ID,
      STYLE,
    );
    materialLeak.fixedSetFacts[0].material = 'bucket-plated brass';
    expectLeak(
      () => buildSetIdentityBoardPrompt(materialLeak),
      { fieldPath: /fixedSetFacts\[\d+\]\.material/ },
    );
  });

  it('checks the registered positive style block and direct prompt-builder inputs', () => {
    const styleLeak = revealGatedContract({
      propId: 'prop_world',
      propName: 'World',
    });
    expectLeak(
      () => projectSetDefinition(styleLeak, SET_ID, STYLE),
      {
        fieldPath: 'styles["detailed_whimsical_world"].setBoard',
        matchedTerm: 'world',
        excludedPropId: 'prop_world',
      },
    );

    const directDefinition = projectSetDefinition(revealGatedContract(), SET_ID, STYLE);
    directDefinition.locations[0].lighting = 'flashlight on the bucket';
    expectLeak(
      () => buildSetIdentityBoardPrompt(directDefinition),
      { fieldPath: 'locations[0].lighting' },
    );
  });

  it('allows intentional NO lines while preserving exact negative authority', () => {
    const definition = projectSetDefinition(revealGatedContract(), SET_ID, STYLE);
    const { prompt, negativePrompt } = buildSetIdentityBoardPrompt(definition);
    const bucketLines = prompt.split(/\r?\n/).filter((line) => /bucket/i.test(line));

    expect(bucketLines).toEqual([]);
    expect(negativePrompt).toContain('NO Old Tin Bucket');
  });

  it('uses whole canonical words: punctuation/case and short names match, substrings do not', () => {
    const partial = revealGatedContract();
    partial.setBoardAuthorities![0].locations[0].lighting =
      'a cathedral-like glow with proper proportions';
    expect(() => projectSetDefinition(partial, SET_ID, STYLE)).not.toThrow();

    const punctuation = revealGatedContract();
    punctuation.setBoardAuthorities![0].locations[0].lighting = 'FLASHLIGHT ON THE BUCKET!';
    expectLeak(
      () => projectSetDefinition(punctuation, SET_ID, STYLE),
      { fieldPath: 'locations[0].lighting' },
    );

    const shortClean = revealGatedContract({ propId: 'prop_x', propName: 'X' });
    shortClean.setBoardAuthorities![0].locations[0].lighting = 'xylophone-colored daylight';
    expect(() => projectSetDefinition(shortClean, SET_ID, STYLE)).not.toThrow();

    const shortLeak = revealGatedContract({ propId: 'prop_x', propName: 'X' });
    shortLeak.setBoardAuthorities![0].locations[0].lighting = 'marker X.';
    expectLeak(
      () => projectSetDefinition(shortLeak, SET_ID, STYLE),
      {
        fieldPath: 'locations[0].lighting',
        matchedTerm: 'x',
        excludedPropId: 'prop_x',
      },
    );

    const prefixClean = revealGatedContract({ propId: 'prop_globe', propName: 'Globe' });
    prefixClean.setBoardAuthorities![0].locations[0].lighting =
      'proper proportions and a prop layout guide';
    expect(() => projectSetDefinition(prefixClean, SET_ID, STYLE)).not.toThrow();
  });

  it('keeps the existing Fox projection valid and spoiler-neutral', () => {
    const repoRoot = process.cwd();
    const fox = migrateLegacySetBoardFixture(
      JSON.parse(fs.readFileSync(path.join(
        repoRoot,
        'story-bank',
        'v3-approved',
        'fox_uri_adventure.visual-contract-template.json',
      ), 'utf8')) as BookVisualContract,
      {
        board_room_openings: ['z_room_window', 'z_window_threshold'],
        board_balcony: ['z_balcony_railing', 'z_balcony_bucket_corner'],
      },
    );

    const definition = projectSetDefinition(
      fox,
      'set_room_balcony_night',
      'soft_hand_drawn_storybook',
    );
    const { prompt, negativePrompt } = buildSetIdentityBoardPrompt(definition);
    const spoilerLines = prompt.split(/\r?\n/).filter((line) => /bucket|drip source/i.test(line));
    expect(spoilerLines).toEqual([]);
    expect(negativePrompt).toContain('NO old tin bucket');
  });
});
