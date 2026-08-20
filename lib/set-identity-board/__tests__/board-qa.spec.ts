/**
 * Set Identity Board — character-free QA pass. SYNTHETIC only: the vision call is injected, so no network.
 *
 * (P1-6) What these exist to lock down: this gate decides whether an image may become an APPROVED reference that every
 * page of a set is then rendered against. A malformed or absent verdict must land on the SAME side as "contaminated" —
 * never `passed`. The bug this replaces coerced any non-array `flags` to `[]`, which read as "no contamination found"
 * and passed the board, so a vision adapter that changed shape or returned an error envelope silently approved
 * unchecked images.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  boardContaminationFlags,
  buildBoardQaInstruction,
  qaSetIdentityBoardImage,
  QA_CALL_FAILED_FLAG,
  QA_RESPONSE_MALFORMED_FLAG,
} from '../boardQa';
import {
  SET_BOARD_CONTENT_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  SET_IDENTITY_BOARD_VERSION,
  type SetDefinition,
} from '../types';

/** Minimal synthetic SET projection — invented, references no real story. */
function makeDef(): SetDefinition {
  return {
    boardVersion: SET_IDENTITY_BOARD_VERSION,
    storyKey: 'synthetic_story',
    styleId: 'style01',
    setIdentityId: 'set_alpha',
    locations: [{ id: 'room_north', name: 'North Room' }],
    zones: [
      {
        id: 'z_north',
        locationId: 'room_north',
        spatialNodes: [{ id: 'main_door', kind: 'doorway', description: 'a wide wooden doorway' }],
        spatialRelations: [],
        geometry: ['doorway "main_door": a wide wooden doorway'],
      },
    ],
    fixedSetFacts: [],
    contentPolicy: {
      version: SET_BOARD_CONTENT_POLICY_VERSION,
      includedPropIds: [],
      excludedProps: [],
    },
    positiveAuthorityPolicy: {
      version: SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
      blockedCast: [],
      blockedProps: [],
    },
  };
}

/** Run the QA pass against a vision fn that returns exactly `response` (typed loose — that IS the untrusted seam). */
function qaWith(response: unknown) {
  return qaSetIdentityBoardImage(
    { imageUrl: 'https://cdn/board.png', def: makeDef() },
    { callVision: async () => response }
  );
}

describe('qaSetIdentityBoardImage — well-formed responses', () => {
  it('PASSES a well-formed clean response (an affirmative empty flag list)', async () => {
    const result = await qaWith({ flags: [] });

    expect(result.qaStatus).toBe('passed');
    expect(result.qaFlags).toEqual([]);
  });

  it('FAILS a well-formed contaminated response and reports the flags verbatim', async () => {
    const result = await qaWith({ flags: ['people', 'text'] });

    expect(result.qaStatus).toBe('failed');
    expect(result.qaFlags).toEqual(['people', 'text']);
  });

  it('passes the instruction built from the def to the vision call', async () => {
    const callVision = vi.fn(async (_args: { imageUrl: string; instruction: string }) => ({
      flags: [] as string[],
    }));
    await qaSetIdentityBoardImage({ imageUrl: 'https://cdn/board.png', def: makeDef() }, { callVision });

    expect(callVision).toHaveBeenCalledTimes(1);
    const args = callVision.mock.calls[0][0];
    expect(args.imageUrl).toBe('https://cdn/board.png');
    expect(args.instruction).toContain('set_alpha');
  });

  it('asks QA to verify excluded props plus exact fixed-prop count and placement', () => {
    const def = makeDef();
    def.fixedSetFacts = [{
      propId: 'prop_table',
      name: 'Stone Table',
      quantity: 1,
      placements: [{ zoneId: 'z_north', nodeId: 'table', nodeKind: 'furniture' }],
    }];
    def.contentPolicy = {
      version: SET_BOARD_CONTENT_POLICY_VERSION,
      includedPropIds: ['prop_table'],
      excludedProps: [{ propId: 'prop_later', name: 'Covered Parcel', reasons: ['lifecycle'] }],
    };
    def.positiveAuthorityPolicy.blockedProps = [
      { propId: 'prop_later', name: 'Covered Parcel' },
      { propId: 'prop_portable', name: 'Portable Lantern' },
    ];
    const instruction = buildBoardQaInstruction(def);
    expect(instruction).toContain('exactly 1');
    expect(instruction).toContain('Area 1');
    expect(instruction).toContain('doorway "main_door": a wide wooden doorway');
    expect(instruction).toContain('require a distinct, recognizable physical instance of that prop');
    expect(instruction).toContain('stripe, pattern, texture, material, or shape');
    expect(instruction).toContain('Covered Parcel');
    expect(instruction).toContain('Portable Lantern');
  });
});

/**
 * Every malformed shape must be NOT passed. Parameterised so a new shape is one line — the rule is "anything that is
 * not `{flags: string[]}` fails", not "these six cases fail".
 */
describe('qaSetIdentityBoardImage — malformed responses FAIL CLOSED', () => {
  const MALFORMED: Array<[label: string, response: unknown]> = [
    ['{} (no flags key)', {}],
    ['{flags: null}', { flags: null }],
    ['{flags: undefined}', { flags: undefined }],
    ["{flags: 'x'} (string, not array)", { flags: 'x' }],
    ['{flags: [1]} (non-string entry)', { flags: [1] }],
    ['{flags: {}} (object, not array)', { flags: {} }],
    ['null', null],
    ['undefined', undefined],
    ['a bare string', 'clean'],
    ['a bare array', ['people']],
    ['an error envelope', { error: 'vision timed out' }],
  ];

  it.each(MALFORMED)('never passes on %s', async (_label, response) => {
    const result = await qaWith(response);

    expect(result.qaStatus).not.toBe('passed');
    expect(result.qaStatus).toBe('failed');
  });

  it.each(MALFORMED)('explains WHY it failed on %s', async (_label, response) => {
    const result = await qaWith(response);

    expect(result.qaFlags).toHaveLength(1);
    expect(result.qaFlags[0]).toContain(QA_RESPONSE_MALFORMED_FLAG);
  });

  it('does NOT silently filter a partly-readable flag list into a pass', async () => {
    // The old coercion would have filtered [1] to [] and passed. The list being unreadable means the response is not
    // the shape we think it is — the flags we CAN read may not be all of them.
    const result = await qaWith({ flags: [1, 'people'] });

    expect(result.qaStatus).toBe('failed');
    expect(result.qaFlags[0]).toContain(QA_RESPONSE_MALFORMED_FLAG);
  });
});

describe('qaSetIdentityBoardImage — a vision call that never returns a verdict FAILS CLOSED', () => {
  it('FAILS when the vision call rejects', async () => {
    const result = await qaSetIdentityBoardImage(
      { imageUrl: 'https://cdn/board.png', def: makeDef() },
      { callVision: async () => Promise.reject(new Error('vision 503')) }
    );

    expect(result.qaStatus).toBe('failed');
    expect(result.qaFlags[0]).toContain(QA_CALL_FAILED_FLAG);
    expect(result.qaFlags[0]).toContain('vision 503');
  });

  it('FAILS when the vision call throws synchronously', async () => {
    const result = await qaSetIdentityBoardImage(
      { imageUrl: 'https://cdn/board.png', def: makeDef() },
      {
        callVision: () => {
          throw new Error('adapter misconfigured');
        },
      }
    );

    expect(result.qaStatus).toBe('failed');
    expect(result.qaFlags[0]).toContain(QA_CALL_FAILED_FLAG);
    expect(result.qaFlags[0]).toContain('adapter misconfigured');
  });

  it('FAILS on a non-Error throw', async () => {
    const result = await qaSetIdentityBoardImage(
      { imageUrl: 'https://cdn/board.png', def: makeDef() },
      { callVision: async () => Promise.reject('string rejection') }
    );

    expect(result.qaStatus).toBe('failed');
    expect(result.qaFlags[0]).toContain(QA_CALL_FAILED_FLAG);
  });
});

/** The pure classifier stays independently testable (no network, no vision fn). */
describe('boardContaminationFlags — pure classifier', () => {
  it('flags observed terms that are contamination for a set plate', () => {
    expect(boardContaminationFlags(['a small child', 'wooden floor', 'speech bubble'])).toEqual([
      'a small child',
      'speech bubble',
    ]);
  });

  it('returns nothing for a clean set observation', () => {
    expect(boardContaminationFlags(['wooden floor', 'stone hearth', 'warm daylight'])).toEqual([]);
  });

  it('is case-insensitive and ignores non-string entries', () => {
    expect(boardContaminationFlags(['A CHILD', 42 as unknown as string, 'Panel border'])).toEqual([
      'A CHILD',
      'Panel border',
    ]);
  });
});
