import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import { buildSetIdentityBoardPrompt } from '../boardPrompt';
import {
  deriveExcludedPropCanonicalTerms,
  SetBoardPositiveAuthoritySpoilerError,
} from '../positiveAuthoritySpoilerGuard';
import { projectSetDefinition } from '../setDefinition';
import { clone, makeContract, STYLE } from './board-fixtures';

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
  contract.zones[0].spatialNodes!.push({
    id: 'transient_object',
    kind: 'furniture',
    description: 'page-rich transient object placement',
    bindsTo: { kind: 'prop', id: prop.id },
  });
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
  });

  it('rejects an excluded prop leaking through a positive location name', () => {
    const contract = revealGatedContract();
    contract.setBoardAuthorities![0].locations[0].name = 'Bucket Supply Room';

    expectLeak(
      () => projectSetDefinition(contract, SET_ID, STYLE),
      { fieldPath: 'locations[0].name' },
    );
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

  it('rejects adjacent leaks through set identity, projected geometry, and fixed-object material', () => {
    const identityLeak = projectSetDefinition(revealGatedContract(), SET_ID, STYLE);
    identityLeak.setIdentityId = 'set_bucket_gallery';
    expectLeak(
      () => buildSetIdentityBoardPrompt(identityLeak),
      { fieldPath: 'setIdentityId' },
    );

    const geometryLeak = revealGatedContract();
    geometryLeak.setBoardAuthorities![0].areas[1].spatialNodes.push({
      id: 'clean_shelf_extension',
      kind: 'furniture',
      description: 'a narrow shelf directly above the bucket',
    });
    expectLeak(
      () => projectSetDefinition(geometryLeak, SET_ID, STYLE),
      { fieldPath: /zones\[\d+\]\.geometry\[\d+\]/ },
    );

    const materialLeak = revealGatedContract();
    materialLeak.setBoardAuthorities![0].fixedObjects[0].material = 'bucket-plated brass';
    expectLeak(
      () => projectSetDefinition(materialLeak, SET_ID, STYLE),
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
    const fox = JSON.parse(fs.readFileSync(path.join(
      repoRoot,
      'story-bank',
      'v3-approved',
      'fox_uri_adventure.visual-contract-template.json',
    ), 'utf8')) as BookVisualContract;

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
