/**
 * Set Identity Board — Milestone B transport tests. SYNTHETIC fixtures only (no real story/contract/bank).
 *
 * What these lock down:
 *  - the REQUIRED priority order and its stability,
 *  - that the image role map matches the ordered array index-for-index,
 *  - that style is the ONLY droppable tier (a required prop + set survive style eviction),
 *  - that an impossible required budget THROWS before any provider call,
 *  - that a board is resolved per set identity and NEVER cross-wired to another identity,
 *  - that the flag-OFF (no tagged refs) path is an exact no-op.
 */
import { describe, expect, it } from 'vitest';

import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import {
  buildImageRoleMapBlock,
  buildImageRoleMapFromAssembly,
  buildReferenceAssetManifest,
  orderReferenceAssets,
  planReferenceAssets,
  ReferenceBudgetExceededError,
  selectBoardRefForLocation,
  SET_REFERENCE_COPY_INSTRUCTION,
  type ReferenceAsset,
} from '../referenceTransport';
import type { SetIdentityBoardBinding } from '../types';

/** Minimal synthetic asset. */
function asset(kind: ReferenceAsset['kind'], url: string, extra?: Partial<ReferenceAsset>): ReferenceAsset {
  return { kind, url, ...extra };
}

/** Minimal synthetic binding for `identityId`. */
function binding(identityId: string, url: string, sha = `sha-${identityId}`): SetIdentityBoardBinding {
  return {
    setIdentityId: identityId,
    setDefinitionHash: `hash-${identityId}`,
    styleId: 'style01',
    storageKey: `boards/${identityId}.png`,
    resolvedUrl: url,
    assetSha256: sha,
    boardVersion: 'set-board/v1',
    approvedAt: '2026-01-01T00:00:00.000Z',
  };
}

/** Minimal synthetic contract carrying only the locations these tests read. */
function contractWithLocations(
  locations: Array<{ id: string; setIdentityId?: string }>
): BookVisualContract {
  return {
    locations: locations.map((l) => ({
      id: l.id,
      description: `${l.id} description`,
      setIdentityId: l.setIdentityId,
      anchors: [],
    })),
  } as unknown as BookVisualContract;
}

describe('orderReferenceAssets', () => {
  it('follows the required priority: child -> companion -> other_character -> prop -> set -> style', () => {
    const input = [
      asset('style', 's.png'),
      asset('set', 'board.png'),
      asset('prop', 'p.png'),
      asset('other_character', 'o.png'),
      asset('companion', 'c.png'),
      asset('child', 'kid.png'),
    ];

    expect(orderReferenceAssets(input).map((a) => a.kind)).toEqual([
      'child',
      'companion',
      'other_character',
      'prop',
      'set',
      'style',
    ]);
  });

  it('is stable within a role (input order preserved) and deterministic across runs', () => {
    const input = [
      asset('style', 'style-1.png'),
      asset('companion', 'comp-1.png'),
      asset('style', 'style-2.png'),
      asset('companion', 'comp-2.png'),
      asset('child', 'kid.png'),
    ];

    const first = orderReferenceAssets(input).map((a) => a.url);
    const second = orderReferenceAssets(input).map((a) => a.url);

    expect(first).toEqual(['kid.png', 'comp-1.png', 'comp-2.png', 'style-1.png', 'style-2.png']);
    expect(second).toEqual(first); // deterministic
  });

  it('does not mutate the input array', () => {
    const input = [asset('style', 's.png'), asset('child', 'kid.png')];
    const snapshot = input.map((a) => a.url);

    orderReferenceAssets(input);

    expect(input.map((a) => a.url)).toEqual(snapshot);
  });
});

describe('buildImageRoleMapBlock', () => {
  it('emits one deterministic line per image, matching the ordered array index-for-index', () => {
    const ordered = planReferenceAssets(
      [asset('set', 'board.png'), asset('child', 'kid.png')],
      8
    ).ordered;

    const block = buildImageRoleMapBlock(ordered);

    expect(block).toBe(
      ['IMAGE ROLE MAP:', 'Image 1 -> child identity reference', 'Image 2 -> set identity board'].join('\n')
    );
    // The map's Nth line describes the Nth ordered asset.
    expect(ordered.map((a) => a.kind)).toEqual(['child', 'set']);
    expect(buildImageRoleMapBlock(ordered)).toBe(block); // deterministic
  });

  it('labels every role exactly once for a full-role list', () => {
    const ordered = orderReferenceAssets([
      asset('child', 'a'),
      asset('companion', 'b'),
      asset('other_character', 'c'),
      asset('prop', 'd'),
      asset('set', 'e'),
      asset('style', 'f'),
    ]);

    expect(buildImageRoleMapBlock(ordered).split('\n')).toEqual([
      'IMAGE ROLE MAP:',
      'Image 1 -> child identity reference',
      'Image 2 -> companion identity reference',
      'Image 3 -> other character identity reference',
      'Image 4 -> prop identity reference',
      'Image 5 -> set identity board',
      'Image 6 -> style reference',
    ]);
  });
});

describe('SET_REFERENCE_COPY_INSTRUCTION', () => {
  it('permits set identity/geometry/materials/lighting and forbids camera/layout/framing/pose/composition', () => {
    expect(SET_REFERENCE_COPY_INSTRUCTION).toMatch(/geometry, materials, and lighting/);
    expect(SET_REFERENCE_COPY_INSTRUCTION).toMatch(
      /NEVER copy camera, page layout, framing, pose, or composition/
    );
    expect(SET_REFERENCE_COPY_INSTRUCTION).toMatch(/empty reference plate, not a page/);
  });
});

describe('planReferenceAssets — eviction', () => {
  it('evicts style FIRST under cap, last-style-first', () => {
    const { ordered, evicted } = planReferenceAssets(
      [
        asset('child', 'kid.png'),
        asset('style', 'style-1.png'),
        asset('style', 'style-2.png'),
        asset('style', 'style-3.png'),
      ],
      2
    );

    expect(ordered.map((a) => a.url)).toEqual(['kid.png', 'style-1.png']);
    // last style ref dropped first
    expect(evicted.map((a) => a.url)).toEqual(['style-3.png', 'style-2.png']);
    expect(evicted.every((a) => a.kind === 'style')).toBe(true);
  });

  it('a required prop and set SURVIVE style eviction', () => {
    const { ordered, evicted } = planReferenceAssets(
      [
        asset('style', 'style-1.png'),
        asset('set', 'board.png', { identityId: 'kitchen' }),
        asset('prop', 'lantern.png'),
        asset('child', 'kid.png'),
        asset('style', 'style-2.png'),
      ],
      3
    );

    expect(ordered.map((a) => a.kind)).toEqual(['child', 'prop', 'set']);
    expect(ordered.map((a) => a.url)).toEqual(['kid.png', 'lantern.png', 'board.png']);
    expect(evicted.map((a) => a.kind)).toEqual(['style', 'style']);
  });

  it('evicts nothing when everything already fits', () => {
    const input = [asset('child', 'kid.png'), asset('style', 's.png')];
    const { ordered, evicted } = planReferenceAssets(input, 8);

    expect(ordered).toHaveLength(2);
    expect(evicted).toEqual([]);
  });

  it('keeps exactly the required refs when the cap equals the required count', () => {
    const { ordered, evicted } = planReferenceAssets(
      [asset('child', 'kid.png'), asset('set', 'board.png'), asset('style', 's.png')],
      2
    );

    expect(ordered.map((a) => a.kind)).toEqual(['child', 'set']);
    expect(evicted.map((a) => a.kind)).toEqual(['style']);
  });
});

describe('planReferenceAssets — impossible required budget', () => {
  it('THROWS ReferenceBudgetExceededError when required refs alone exceed the cap', () => {
    const required = [
      asset('child', 'kid.png'),
      asset('companion', 'comp.png'),
      asset('prop', 'lantern.png'),
      asset('set', 'board.png'),
    ];

    expect(() => planReferenceAssets(required, 3)).toThrow(ReferenceBudgetExceededError);
  });

  it('carries the required count and the cap on the error', () => {
    const required = [
      asset('child', 'kid.png'),
      asset('companion', 'comp.png'),
      asset('prop', 'lantern.png'),
      asset('set', 'board.png'),
      asset('style', 'style.png'), // style does not count toward `required`
    ];

    try {
      planReferenceAssets(required, 3);
      expect.unreachable('planReferenceAssets must throw when required refs exceed the cap');
    } catch (error) {
      expect(error).toBeInstanceOf(ReferenceBudgetExceededError);
      const typed = error as ReferenceBudgetExceededError;
      expect(typed.required).toBe(4);
      expect(typed.cap).toBe(3);
      expect(typed.name).toBe('ReferenceBudgetExceededError');
    }
  });

  it('never silently drops an identity ref to fit the cap', () => {
    // Two identity refs, cap of 1 — the only "fitting" answer would be to drop an identity. It must throw instead.
    expect(() => planReferenceAssets([asset('child', 'kid.png'), asset('companion', 'comp.png')], 1)).toThrow(
      ReferenceBudgetExceededError
    );
  });
});

describe('planReferenceAssets — flag-OFF / no tagged refs', () => {
  it('yields empty ordered + evicted for an empty asset list', () => {
    const { ordered, evicted } = planReferenceAssets([], 8);

    expect(ordered).toEqual([]);
    expect(evicted).toEqual([]);
  });

  it('buildImageRoleMapBlock([]) is the empty string (prepending it changes no prompt bytes)', () => {
    expect(buildImageRoleMapBlock([])).toBe('');
  });

  it('buildReferenceAssetManifest([]) is empty', () => {
    expect(buildReferenceAssetManifest([])).toEqual([]);
  });
});

describe('buildReferenceAssetManifest', () => {
  it('carries role, 1-indexed order, identityId and assetSha256', () => {
    const ordered = planReferenceAssets(
      [
        asset('set', 'board.png', { identityId: 'kitchen', assetSha256: 'sha-kitchen' }),
        asset('child', 'kid.png', { assetSha256: 'sha-kid' }),
      ],
      8
    ).ordered;

    expect(buildReferenceAssetManifest(ordered)).toEqual([
      { order: 1, role: 'child', url: 'kid.png', assetSha256: 'sha-kid', identityId: undefined },
      { order: 2, role: 'set', url: 'board.png', assetSha256: 'sha-kitchen', identityId: 'kitchen' },
    ]);
  });

  it('order matches the Image N lines of the role map', () => {
    const ordered = orderReferenceAssets([asset('style', 's.png'), asset('child', 'kid.png')]);
    const manifest = buildReferenceAssetManifest(ordered);
    const mapLines = buildImageRoleMapBlock(ordered).split('\n').slice(1); // drop the header

    for (const entry of manifest) {
      expect(mapLines[entry.order - 1]).toContain(`Image ${entry.order} -> `);
    }
    expect(manifest.map((m) => m.order)).toEqual([1, 2]);
  });
});

describe('selectBoardRefForLocation', () => {
  it('returns the board for a location whose setIdentityId is bound', () => {
    const contract = contractWithLocations([{ id: 'loc-kitchen-morning', setIdentityId: 'kitchen' }]);
    const bindings = { kitchen: binding('kitchen', 'https://cdn/kitchen.png') };

    expect(
      selectBoardRefForLocation({ contract, bindings, locationId: 'loc-kitchen-morning' })
    ).toEqual({
      kind: 'set',
      url: 'https://cdn/kitchen.png',
      assetSha256: 'sha-kitchen',
      identityId: 'kitchen',
    });
  });

  it('falls back to the location id as its own identity when setIdentityId is absent', () => {
    const contract = contractWithLocations([{ id: 'loc-attic' }]);
    const bindings = { 'loc-attic': binding('loc-attic', 'https://cdn/attic.png') };

    expect(selectBoardRefForLocation({ contract, bindings, locationId: 'loc-attic' })?.identityId).toBe(
      'loc-attic'
    );
  });

  it('resolves two locations sharing one setIdentityId to the SAME board', () => {
    const contract = contractWithLocations([
      { id: 'loc-kitchen-morning', setIdentityId: 'kitchen' },
      { id: 'loc-kitchen-night', setIdentityId: 'kitchen' },
    ]);
    const bindings = { kitchen: binding('kitchen', 'https://cdn/kitchen.png') };

    const morning = selectBoardRefForLocation({ contract, bindings, locationId: 'loc-kitchen-morning' });
    const night = selectBoardRefForLocation({ contract, bindings, locationId: 'loc-kitchen-night' });

    expect(morning).toEqual(night);
  });

  it('returns undefined for an unknown location', () => {
    const contract = contractWithLocations([{ id: 'loc-kitchen', setIdentityId: 'kitchen' }]);
    const bindings = { kitchen: binding('kitchen', 'https://cdn/kitchen.png') };

    expect(
      selectBoardRefForLocation({ contract, bindings, locationId: 'loc-does-not-exist' })
    ).toBeUndefined();
  });

  it('returns undefined for a known but UNBOUND location', () => {
    const contract = contractWithLocations([{ id: 'loc-garden', setIdentityId: 'garden' }]);
    const bindings = { kitchen: binding('kitchen', 'https://cdn/kitchen.png') };

    expect(selectBoardRefForLocation({ contract, bindings, locationId: 'loc-garden' })).toBeUndefined();
  });

  it('returns undefined when the binding has no usable url', () => {
    const contract = contractWithLocations([{ id: 'loc-kitchen', setIdentityId: 'kitchen' }]);

    const noUrl = { kitchen: { ...binding('kitchen', ''), resolvedUrl: undefined } };
    const blankUrl = { kitchen: binding('kitchen', '   ') };

    expect(selectBoardRefForLocation({ contract, bindings: noUrl, locationId: 'loc-kitchen' })).toBeUndefined();
    expect(
      selectBoardRefForLocation({ contract, bindings: blankUrl, locationId: 'loc-kitchen' })
    ).toBeUndefined();
  });

  it('NEVER returns another identity\'s board (cross-wire)', () => {
    const contract = contractWithLocations([
      { id: 'loc-kitchen', setIdentityId: 'kitchen' },
      { id: 'loc-garden', setIdentityId: 'garden' },
    ]);
    const bindings = {
      kitchen: binding('kitchen', 'https://cdn/kitchen.png'),
      garden: binding('garden', 'https://cdn/garden.png'),
    };

    const kitchenRef = selectBoardRefForLocation({ contract, bindings, locationId: 'loc-kitchen' });
    const gardenRef = selectBoardRefForLocation({ contract, bindings, locationId: 'loc-garden' });

    expect(kitchenRef?.url).toBe('https://cdn/kitchen.png');
    expect(kitchenRef?.identityId).toBe('kitchen');
    expect(gardenRef?.url).toBe('https://cdn/garden.png');
    expect(gardenRef?.identityId).toBe('garden');
    // The garden location must never be handed the kitchen board.
    expect(gardenRef?.url).not.toBe(kitchenRef?.url);
  });

  it('REJECTS a mis-filed binding whose own setIdentityId disagrees with its key', () => {
    const contract = contractWithLocations([{ id: 'loc-garden', setIdentityId: 'garden' }]);
    // Filed under "garden" but self-declares "kitchen" — a mis-wire. Fail closed rather than render the wrong room.
    const bindings = { garden: binding('kitchen', 'https://cdn/kitchen.png') };

    expect(selectBoardRefForLocation({ contract, bindings, locationId: 'loc-garden' })).toBeUndefined();
  });
});

/**
 * The LIVE path's map must be index-aligned with the ASSEMBLED provider array, not the tagged subset. The assembly
 * (zone-sheets `rebuildPaths`) orders: child → companion → setAppearanceBoard → contractSetSheets → objectAnchors →
 * otherCharacters → style. A subset-derived map would claim `Image 1 -> set identity board` while image 1 is the
 * child anchor — a confidently WRONG map steers worse than none, so this is locked down.
 */
describe('buildImageRoleMapFromAssembly — index-aligned with the ACTUAL provider array', () => {
  const ASSEMBLED = ['child.png', 'comp.png', 'board.png', 'style1.png'];
  const BREAKDOWN: Record<string, string[]> = {
    style: ['style1.png'],
    child: ['child.png'],
    companion: ['comp.png'],
    otherCharacters: [],
    contractSetSheets: ['board.png'],
  };

  it('labels every slot from the assembled order', () => {
    expect(buildImageRoleMapFromAssembly(ASSEMBLED, BREAKDOWN)).toBe(
      [
        'IMAGE ROLE MAP:',
        'Image 1 -> child identity reference',
        'Image 2 -> companion identity reference',
        'Image 3 -> set identity board',
        'Image 4 -> style reference',
      ].join('\n')
    );
  });

  it('never claims Image 1 is the set board when image 1 is the child anchor', () => {
    const map = buildImageRoleMapFromAssembly(ASSEMBLED, BREAKDOWN);
    expect(map).toContain('Image 1 -> child identity reference');
    expect(map).not.toContain('Image 1 -> set identity board');
  });

  it('disagrees with the subset-derived map (that is the bug it exists to prevent)', () => {
    const subset = buildImageRoleMapBlock([{ kind: 'set', url: 'board.png' }]);
    expect(subset).toContain('Image 1 -> set identity board'); // wrong for the live array
    expect(buildImageRoleMapFromAssembly(ASSEMBLED, BREAKDOWN)).not.toBe(subset);
  });

  it('is a no-op on an empty array and neutral-labels an unknown path', () => {
    expect(buildImageRoleMapFromAssembly([], {})).toBe('');
    expect(buildImageRoleMapFromAssembly(['mystery.png'], {})).toContain('Image 1 -> reference');
  });
});
