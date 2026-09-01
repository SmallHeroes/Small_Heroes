import { describe, expect, it, vi } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';

import { computeSetDefinitionHash } from '../setDefinition';
import {
  deriveExpectedSetBoardIdentity,
  type FrozenSetBoardAuthorityIdentity,
} from '../expectedIdentity';
import {
  assertBoardsBoundForRender,
  hasUnboundRequiredSetIdentity,
  resolveBoardBindings,
  snapshotBoardMode,
  SetIdentityBoardUnavailableError,
  type BoardResolverDeps,
} from '../resolveBoards';
import type { SetIdentityBoardBindingContext, SetIdentityBoardRegistryEntry } from '../types';
import {
  SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
  SET_IDENTITY_BOARD_VERSION,
} from '../types';
import { clone, makeApprovedEntry, makeContract, STYLE } from './board-fixtures';

const FROZEN_HASH = 'frozen-contract-hash-1';

/** The set identity the fixture requires a board for (`meadow` is setReference:'none' → not required). */
const REQUIRED_ID = 'set_alpha';

function contractWithReservedPlacement() {
  const contract = makeContract();
  contract.recurringProps.push({
    id: 'prop_page_lantern',
    name: 'Page Lantern',
    description: 'page-conditioned content',
    firstRevealPage: 1,
  });
  contract.pageContracts[0]!.actionRequirements = [{
    checkId: 'action:places-page-lantern',
    subject: {
      kind: 'entity',
      entity: { kind: 'cast', id: contract.cast.child.id },
    },
    predicate: 'places',
    object: { kind: 'prop', id: 'prop_page_lantern' },
    polarity: 'must',
  }];
  contract.pageContracts[0]!.propConstraints = [{
    propId: 'prop_page_lantern',
    visibility: 'required',
    anchorId: 'anchor_hearth',
  }];
  return contract;
}

function approvedAuthorityFor(
  contract: ReturnType<typeof makeContract>,
  boardVersion?: string,
): {
  entry: SetIdentityBoardRegistryEntry;
  frozen: FrozenSetBoardAuthorityIdentity;
} {
  const { expected } = deriveExpectedSetBoardIdentity({
    contract,
    setIdentityId: REQUIRED_ID,
    styleId: STYLE,
    ...(boardVersion ? { frozenBoardVersion: boardVersion } : {}),
  });
  const entry = makeApprovedEntry(expected.setDefinitionHash, {
    registryVersion: expected.registryVersion,
    boardVersion: expected.boardVersion,
    storyKey: expected.storyKey,
    setIdentityId: expected.setIdentityId,
    styleId: expected.styleId,
    setDefinitionHash: expected.setDefinitionHash,
    contentPolicyDigest: expected.contentPolicyDigest,
    declaredPropIds: expected.declaredPropIds,
    storageKey: `set-identity-boards/synthetic/${expected.boardVersion}/board.png`,
    assetSha256: `sha-${expected.boardVersion}`,
  });
  return {
    entry,
    frozen: {
      artifactPath: `set-identity-boards/synthetic/${expected.boardVersion}.json`,
      artifactDigest: canonicalHash(entry),
      registryVersion: entry.registryVersion,
      boardVersion: entry.boardVersion,
      storyKey: entry.storyKey,
      setIdentityId: entry.setIdentityId,
      styleId: entry.styleId,
      setDefinitionHash: entry.setDefinitionHash,
      contentPolicyDigest: entry.contentPolicyDigest,
      declaredPropIds: entry.declaredPropIds,
      storageKey: entry.storageKey,
      assetSha256: entry.assetSha256,
      approvedBy: entry.approvedBy!,
      approvedAt: entry.approvedAt!,
    },
  };
}

function hashFor(contract = makeContract(), id = REQUIRED_ID): string {
  return computeSetDefinitionHash(contract, id, STYLE);
}

/**
 * Fully-working injected deps: an approved entry, readable bytes whose sha matches, a resolvable url. Each spec
 * breaks exactly ONE of these to prove that failure alone stops the render.
 */
function makeDeps(overrides: Partial<BoardResolverDeps> = {}, entry?: SetIdentityBoardRegistryEntry | null) {
  const resolved = entry === undefined ? makeApprovedEntry(hashFor()) : entry;
  return {
    loadRegistryEntry: vi.fn(() => resolved),
    fetchAssetSha256: vi.fn(async () => resolved?.assetSha256 ?? 'sha-approved-bytes'),
    resolveDurableUrl: vi.fn(async (key: string) => `https://cdn.example/${key}`),
    ...overrides,
  } as BoardResolverDeps & Record<string, ReturnType<typeof vi.fn>>;
}

async function bindFresh(deps: BoardResolverDeps = makeDeps()): Promise<SetIdentityBoardBindingContext> {
  return resolveBoardBindings(
    { contract: makeContract(), styleId: STYLE, frozenContractHash: FROZEN_HASH, existing: snapshotBoardMode({ frozenContractHash: FROZEN_HASH }) },
    deps
  );
}

function makeContractWithLateInvalidSet() {
  const contract = makeContract();
  const meadow = contract.locations.find((location) => location.id === 'meadow')!;
  meadow.setIdentityId = 'set_beta';
  meadow.setReference = { status: 'pending' };
  meadow.timeOfDay = 'night';
  meadow.lighting = 'stable moonlight';
  const meadowZone = contract.zones.find((zone) => zone.id === 'z_meadow')!;
  meadowZone.spatialNodes = [{
    id: 'meadow_floor',
    kind: 'floor',
    description: 'Level meadow path.',
  }];
  contract.setBoardAuthorities!.push({
    setIdentityId: 'set_beta',
    locations: [{
      locationId: 'meadow',
      name: 'Meadow',
      timeOfDay: 'night',
      lighting: 'the child waits under stable moonlight',
      environmentClass: 'outdoor',
    }],
    areas: [{
      id: 'board_meadow',
      locationId: 'meadow',
      zoneProjection: { cardinality: 'one_to_one', zoneIds: ['z_meadow'] },
      spatialNodes: [{
        id: 'meadow_floor',
        kind: 'floor',
        description: 'Level meadow path.',
      }],
    }],
    fixedObjects: [],
  });
  return contract;
}

describe('resolveBoardBindings — LOOK UP → VERIFY → BIND', () => {
  it('binds every REQUIRED set identity and ignores identities that need no board', async () => {
    const ctx = await bindFresh();
    expect(Object.keys(ctx.bindings)).toEqual([REQUIRED_ID]); // 'meadow' is setReference:'none'
    const binding = ctx.bindings[REQUIRED_ID];
    expect(binding.setIdentityId).toBe(REQUIRED_ID);
    expect(binding.setDefinitionHash).toBe(hashFor());
    expect(binding.styleId).toBe(STYLE);
    expect(ctx.mode).toBe('required-v2');
    expect(ctx.frozenContractHash).toBe(FROZEN_HASH);
  });

  it('carries a DURABLE descriptor — storageKey plus a resolved url, never a local path', async () => {
    const ctx = await bindFresh();
    const binding = ctx.bindings[REQUIRED_ID];
    expect(binding.storageKey).toBe('set-identity-boards/synthetic/set_alpha/board.png');
    expect(binding.resolvedUrl).toBe('https://cdn.example/set-identity-boards/synthetic/set_alpha/board.png');
    expect(binding.assetSha256).toBe('sha-approved-bytes');
    expect(JSON.stringify(binding)).not.toMatch(/\/tmp|\/var\/task|[A-Z]:\\/);
  });

  it('NEVER mints, renders, or waits — it only reads through the injected deps', async () => {
    const deps = makeDeps();
    await bindFresh(deps);
    // Exactly one read per door, and no other door exists on the interface.
    expect(deps.loadRegistryEntry).toHaveBeenCalledTimes(1);
    expect(deps.fetchAssetSha256).toHaveBeenCalledTimes(1);
    expect(deps.resolveDurableUrl).toHaveBeenCalledTimes(1);
  });

  it('does NOT mutate the frozen contract', async () => {
    const contract = makeContract();
    const before = clone(contract);
    await resolveBoardBindings(
      { contract, styleId: STYLE, frozenContractHash: FROZEN_HASH },
      makeDeps()
    );
    expect(contract).toEqual(before);
  });
});

describe('resolveBoardBindings — forward v7 and trusted frozen-v6 replay', () => {
  it('selects v7 for a fresh qualifying contract and cannot be downgraded by a v6 Registry row', async () => {
    const contract = contractWithReservedPlacement();
    const current = approvedAuthorityFor(contract);
    expect(current.entry.boardVersion).toBe(
      SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
    );
    const bound = await resolveBoardBindings(
      {
        contract,
        styleId: STYLE,
        frozenContractHash: FROZEN_HASH,
      },
      makeDeps({}, current.entry),
    );
    expect(bound.bindings[REQUIRED_ID]!.boardVersion).toBe(
      SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
    );

    const historical = approvedAuthorityFor(
      contract,
      SET_IDENTITY_BOARD_VERSION,
    );
    const deps = makeDeps({}, historical.entry);
    await expect(resolveBoardBindings(
      { contract, styleId: STYLE, frozenContractHash: FROZEN_HASH },
      deps,
    )).rejects.toThrow(/boardVersion mismatch/);
    expect(deps.fetchAssetSha256).not.toHaveBeenCalled();
  });

  it('replays v6 only from an exact complete immutable-package inventory', async () => {
    const contract = contractWithReservedPlacement();
    const historical = approvedAuthorityFor(
      contract,
      SET_IDENTITY_BOARD_VERSION,
    );
    const deps = makeDeps({}, historical.entry);
    const bound = await resolveBoardBindings(
      {
        contract,
        styleId: STYLE,
        frozenContractHash: FROZEN_HASH,
        frozenRequiredBoards: [historical.frozen],
      },
      deps,
    );
    expect(bound.bindings[REQUIRED_ID]!.boardVersion).toBe(
      SET_IDENTITY_BOARD_VERSION,
    );
    await expect(assertBoardsBoundForRender(
      {
        contract,
        cache: { setIdentityBoards: bound },
        styleId: STYLE,
        activeFrozenContractHash: FROZEN_HASH,
        frozenRequiredBoards: [historical.frozen],
      },
      { fetchAssetSha256: vi.fn(async () => historical.entry.assetSha256) },
    )).resolves.toBeUndefined();
    await expect(assertBoardsBoundForRender(
      {
        contract,
        cache: { setIdentityBoards: bound },
        styleId: STYLE,
        activeFrozenContractHash: FROZEN_HASH,
      },
      { fetchAssetSha256: vi.fn(async () => historical.entry.assetSha256) },
    )).rejects.toThrow(/stale/);
  });

  it.each([
    ['missing', (frozen: FrozenSetBoardAuthorityIdentity) => []],
    ['duplicate', (frozen: FrozenSetBoardAuthorityIdentity) => [frozen, frozen]],
    ['extra', (frozen: FrozenSetBoardAuthorityIdentity) => [
      frozen,
      { ...frozen, setIdentityId: 'set_extra' },
    ]],
    ['unsupported version', (frozen: FrozenSetBoardAuthorityIdentity) => [
      { ...frozen, boardVersion: 'set-board/v99' },
    ]],
    ['mismatched hash', (frozen: FrozenSetBoardAuthorityIdentity) => [
      { ...frozen, setDefinitionHash: 'f'.repeat(64) },
    ]],
  ])('rejects a %s frozen inventory before Registry or storage I/O', async (_label, mutate) => {
    const contract = contractWithReservedPlacement();
    const historical = approvedAuthorityFor(
      contract,
      SET_IDENTITY_BOARD_VERSION,
    );
    const deps = makeDeps({}, historical.entry);
    await expect(resolveBoardBindings(
      {
        contract,
        styleId: STYLE,
        frozenContractHash: FROZEN_HASH,
        frozenRequiredBoards: mutate(historical.frozen),
      },
      deps,
    )).rejects.toThrow(SetIdentityBoardUnavailableError);
    expect(deps.loadRegistryEntry).not.toHaveBeenCalled();
    expect(deps.fetchAssetSha256).not.toHaveBeenCalled();
    expect(deps.resolveDurableUrl).not.toHaveBeenCalled();
  });

  it('rejects a same-core rival Registry artifact before storage access', async () => {
    const contract = contractWithReservedPlacement();
    const historical = approvedAuthorityFor(
      contract,
      SET_IDENTITY_BOARD_VERSION,
    );
    const rival = {
      ...historical.entry,
      qaCheckedAt: '2026-07-03T00:00:00.000Z',
    };
    const deps = makeDeps({}, rival);
    await expect(resolveBoardBindings(
      {
        contract,
        styleId: STYLE,
        frozenContractHash: FROZEN_HASH,
        frozenRequiredBoards: [historical.frozen],
      },
      deps,
    )).rejects.toThrow(/differs from immutable Visual Package digest/);
    expect(deps.fetchAssetSha256).not.toHaveBeenCalled();
    expect(deps.resolveDurableUrl).not.toHaveBeenCalled();
  });
});

describe('resolveBoardBindings — IDEMPOTENCY (a crash after bind must never re-choose)', () => {
  it('reuses an existing valid binding VERBATIM without touching the registry or storage', async () => {
    const first = await bindFresh();
    const deps = makeDeps();
    const second = await resolveBoardBindings(
      { contract: makeContract(), styleId: STYLE, frozenContractHash: FROZEN_HASH, existing: first },
      deps
    );
    expect(second.bindings[REQUIRED_ID]).toEqual(first.bindings[REQUIRED_ID]);
    expect(second).toEqual(first);
    // The whole point: a resume does not re-read the registry, so it cannot pick a different board.
    expect(deps.loadRegistryEntry).not.toHaveBeenCalled();
    expect(deps.fetchAssetSha256).not.toHaveBeenCalled();
    expect(deps.resolveDurableUrl).not.toHaveBeenCalled();
  });

  it('re-resolving repeatedly (retry storm) converges on the SAME binding', async () => {
    let ctx = await bindFresh();
    const original = clone(ctx);
    for (let i = 0; i < 5; i++) {
      ctx = await resolveBoardBindings(
        { contract: makeContract(), styleId: STYLE, frozenContractHash: FROZEN_HASH, existing: ctx },
        makeDeps()
      );
    }
    expect(ctx).toEqual(original);
  });

  it('reuses the prior binding even if the registry has since been re-pointed at a DIFFERENT board', async () => {
    const first = await bindFresh();
    // Someone re-approves a different board for the same set. The bound order must NOT drift onto it.
    const rival = makeApprovedEntry(hashFor(), {
      storageKey: 'set-identity-boards/synthetic/set_alpha/rival.png',
      assetSha256: 'sha-rival-bytes',
    });
    const second = await resolveBoardBindings(
      { contract: makeContract(), styleId: STYLE, frozenContractHash: FROZEN_HASH, existing: first },
      makeDeps({}, rival)
    );
    expect(second.bindings[REQUIRED_ID]).toEqual(first.bindings[REQUIRED_ID]);
    expect(second.bindings[REQUIRED_ID].storageKey).not.toContain('rival');
  });

  it('re-binds when the prior binding is STALE (the set itself changed)', async () => {
    const stale = await bindFresh();
    stale.bindings[REQUIRED_ID].setDefinitionHash = 'hash-from-an-older-set';
    const deps = makeDeps();
    const next = await resolveBoardBindings(
      { contract: makeContract(), styleId: STYLE, frozenContractHash: FROZEN_HASH, existing: stale },
      deps
    );
    expect(deps.loadRegistryEntry).toHaveBeenCalledTimes(1);
    expect(next.bindings[REQUIRED_ID].setDefinitionHash).toBe(hashFor());
  });
});

describe('resolveBoardBindings — FAIL-CLOSED (§6), never a downgrade', () => {
  /** Every row must THROW. A returned context — of any shape — would be a silent downgrade. */
  const cases: Array<[string, () => BoardResolverDeps]> = [
    ['no registry entry at all', () => makeDeps({}, null)],
    [
      'a candidate that no human approved (approvedBy/approvedAt null)',
      () => makeDeps({}, makeApprovedEntry(hashFor(), { approvedBy: null, approvedAt: null, qaStatus: 'pending' })),
    ],
    [
      'approved by a human but vision QA did not pass',
      () => makeDeps({}, makeApprovedEntry(hashFor(), { qaStatus: 'failed' })),
    ],
    [
      'vision QA still pending',
      () => makeDeps({}, makeApprovedEntry(hashFor(), { qaStatus: 'pending' })),
    ],
    [
      'a board approved for a DIFFERENT style',
      () => makeDeps({}, makeApprovedEntry(hashFor(), { styleId: 'some_other_style' })),
    ],
    [
      'a stale boardVersion',
      () => makeDeps({}, makeApprovedEntry(hashFor(), { boardVersion: 'set-board/v0' })),
    ],
    [
      'a stale registryVersion',
      () => makeDeps({}, makeApprovedEntry(hashFor(), { registryVersion: 'set-registry/v0' })),
    ],
    [
      'a setDefinitionHash mismatch (the set changed under an approved board)',
      () => makeDeps({}, makeApprovedEntry('hash-of-a-different-set')),
    ],
    [
      'a board filed under a different story',
      () => makeDeps({}, makeApprovedEntry(hashFor(), { storyKey: 'another_story' })),
    ],
    [
      'the object is missing/unreadable',
      () => makeDeps({ fetchAssetSha256: vi.fn(async () => null) }),
    ],
    [
      'the bytes changed since approval (SHA mismatch)',
      () => makeDeps({ fetchAssetSha256: vi.fn(async () => 'sha-of-some-other-bytes') }),
    ],
    ['the url is unresolvable', () => makeDeps({ resolveDurableUrl: vi.fn(async () => null) })],
    ['the url resolves blank', () => makeDeps({ resolveDurableUrl: vi.fn(async () => '   ') })],
  ];

  for (const [label, mkDeps] of cases) {
    it(`throws SetIdentityBoardUnavailableError: ${label}`, async () => {
      await expect(bindFresh(mkDeps())).rejects.toThrow(SetIdentityBoardUnavailableError);
    });
  }

  it('the error names the set identity and carries every reason (no silent note, no fallback board)', async () => {
    const err = await bindFresh(makeDeps({}, null)).catch((e) => e);
    expect(err).toBeInstanceOf(SetIdentityBoardUnavailableError);
    expect(err.setIdentityId).toBe(REQUIRED_ID);
    expect(err.reasons.length).toBeGreaterThan(0);
    expect(err.message).toContain('set_alpha');
  });

  it('a missing identity mapping (the required set has no locations to project) still fails closed', async () => {
    // The location group is gone but a page still requires the identity → nothing to hash against → no entry.
    const contract = makeContract();
    contract.locations = contract.locations.filter((l) => l.setIdentityId !== REQUIRED_ID);
    contract.locations.push({
      id: 'phantom',
      name: 'Phantom',
      description: 'a location whose set identity has no registry mapping',
      setIdentityId: REQUIRED_ID,
      setReference: { status: 'pending' },
      anchors: [],
    });
    await expect(
      resolveBoardBindings(
        { contract, styleId: STYLE, frozenContractHash: FROZEN_HASH },
        makeDeps({}, null)
      )
    ).rejects.toThrow(/set_board_stable_authority_invalid/);
  });

  it('censuses every required Set before touching Registry or storage deps', async () => {
    const deps = makeDeps();
    await expect(resolveBoardBindings(
      {
        contract: makeContractWithLateInvalidSet(),
        styleId: STYLE,
        frozenContractHash: FROZEN_HASH,
      },
      deps,
    )).rejects.toThrow(/set_board_positive_authority_leak/);
    expect(deps.loadRegistryEntry).not.toHaveBeenCalled();
    expect(deps.fetchAssetSha256).not.toHaveBeenCalled();
    expect(deps.resolveDurableUrl).not.toHaveBeenCalled();
  });
});

describe('assertBoardsBoundForRender — the pre-image gate', () => {
  /** The byte-verifier door. Default: the object still holds the approved bytes. */
  function verifier(sha: string | null = 'sha-approved-bytes') {
    return { fetchAssetSha256: vi.fn(async () => sha) };
  }

  it('censuses every required Set before re-reading any bound asset bytes', async () => {
    const deps = verifier();
    await expect(assertBoardsBoundForRender(
      {
        contract: makeContractWithLateInvalidSet(),
        cache: {
          setIdentityBoards: snapshotBoardMode({
            frozenContractHash: FROZEN_HASH,
          }),
        },
        styleId: STYLE,
        activeFrozenContractHash: FROZEN_HASH,
      },
      deps,
    )).rejects.toThrow(/set_board_positive_authority_leak/);
    expect(deps.fetchAssetSha256).not.toHaveBeenCalled();
  });

  it('is a NO-OP for a LEGACY order (no snapshot) — this is the flag-off path', async () => {
    const deps = verifier();
    await expect(
      assertBoardsBoundForRender(
        { contract: makeContract(), cache: {}, styleId: STYLE, activeFrozenContractHash: FROZEN_HASH },
        deps
      )
    ).resolves.toBeUndefined();
    // OFF-inertness is not just "does not throw" — it is "does not touch storage at all".
    expect(deps.fetchAssetSha256).not.toHaveBeenCalled();
  });

  it('passes for a correctly bound order', async () => {
    const ctx = await bindFresh();
    await expect(
      assertBoardsBoundForRender(
        {
          contract: makeContract(),
          cache: { setIdentityBoards: ctx },
          styleId: STYLE,
          activeFrozenContractHash: FROZEN_HASH,
        },
        verifier()
      )
    ).resolves.toBeUndefined();
  });

  it('THROWS when a required identity has no binding (the activation snapshot was never bound)', async () => {
    await expect(
      assertBoardsBoundForRender(
        {
          contract: makeContract(),
          cache: { setIdentityBoards: snapshotBoardMode({ frozenContractHash: FROZEN_HASH }) },
          styleId: STYLE,
          activeFrozenContractHash: FROZEN_HASH,
        },
        verifier()
      )
    ).rejects.toThrow(SetIdentityBoardUnavailableError);
  });

  it('THROWS when the per-order snapshot is pinned to a contract that is not the active frozen one', async () => {
    const ctx = await bindFresh();
    await expect(
      assertBoardsBoundForRender(
        {
          contract: makeContract(),
          cache: { setIdentityBoards: ctx },
          styleId: STYLE,
          activeFrozenContractHash: 'a-different-frozen-contract',
        },
        verifier()
      )
    ).rejects.toThrow(/pinned to frozen contract/);
  });

  it('THROWS when there is no active frozen contract hash at all', async () => {
    const ctx = await bindFresh();
    await expect(
      assertBoardsBoundForRender(
        {
          contract: makeContract(),
          cache: { setIdentityBoards: ctx },
          styleId: STYLE,
          activeFrozenContractHash: null,
        },
        verifier()
      )
    ).rejects.toThrow(SetIdentityBoardUnavailableError);
  });

  it('THROWS when the set changed after binding (recomputed setDefinitionHash no longer matches)', async () => {
    const ctx = await bindFresh();
    const edited = makeContract();
    edited.setBoardAuthorities![0].areas[0].spatialNodes[0].description =
      'a completely different fixed doorway';
    edited.zones[0].spatialNodes![0].description =
      'a completely different fixed doorway';
    await expect(
      assertBoardsBoundForRender(
        {
          contract: edited,
          cache: { setIdentityBoards: ctx },
          styleId: STYLE,
          activeFrozenContractHash: FROZEN_HASH,
        },
        verifier()
      )
    ).rejects.toThrow(/stale/);
  });

  it('THROWS when the order style no longer matches the bound board (never self-validates off the binding)', async () => {
    const ctx = await bindFresh();
    await expect(
      assertBoardsBoundForRender(
        {
          contract: makeContract(),
          cache: { setIdentityBoards: ctx },
          styleId: 'some_other_style',
          activeFrozenContractHash: FROZEN_HASH,
        },
        verifier()
      )
    ).rejects.toThrow(SetIdentityBoardUnavailableError);
  });

  it('THROWS when a bound board lost its url or its approval stamp', async () => {
    for (const mutate of [
      (c: SetIdentityBoardBindingContext) => { c.bindings[REQUIRED_ID].resolvedUrl = ''; },
      (c: SetIdentityBoardBindingContext) => { c.bindings[REQUIRED_ID].approvedAt = ''; },
      (c: SetIdentityBoardBindingContext) => { c.bindings[REQUIRED_ID].boardVersion = 'set-board/v0'; },
    ]) {
      const ctx = await bindFresh();
      mutate(ctx);
      await expect(
        assertBoardsBoundForRender(
          {
            contract: makeContract(),
            cache: { setIdentityBoards: ctx },
            styleId: STYLE,
            activeFrozenContractHash: FROZEN_HASH,
          },
          verifier()
        )
      ).rejects.toThrow(SetIdentityBoardUnavailableError);
    }
  });

  it('does NOT mutate the frozen contract', async () => {
    const ctx = await bindFresh();
    const contract = makeContract();
    const before = clone(contract);
    await assertBoardsBoundForRender(
      {
        contract,
        cache: { setIdentityBoards: ctx },
        styleId: STYLE,
        activeFrozenContractHash: FROZEN_HASH,
      },
      verifier()
    );
    expect(contract).toEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P0-4b — the pre-render assert re-verifies BYTES, not just metadata
// ─────────────────────────────────────────────────────────────────────────────

describe('assertBoardsBoundForRender — SHA re-verification (P0-4b: bytes are not swappable)', () => {
  /**
   * THE HAZARD, spelled out: the binding below is PERFECT. Right set hash, right style, right version, right url,
   * a real human approval stamp. Every metadata check passes. The only thing wrong is that the OBJECT at the
   * storage key now holds different bytes than the human approved — the exact state an overwrite produces. Before
   * P0-4b this rendered a paid page against an unapproved, unreviewed set image and nothing noticed.
   */
  it('detects a SWAPPED object — same key, different bytes → fails closed', async () => {
    const ctx = await bindFresh();
    expect(ctx.bindings[REQUIRED_ID].assetSha256).toBe('sha-approved-bytes'); // the bind verified these bytes…

    const err = await assertBoardsBoundForRender(
      {
        contract: makeContract(),
        cache: { setIdentityBoards: ctx },
        styleId: STYLE,
        activeFrozenContractHash: FROZEN_HASH,
      },
      // …and someone replaced the object under that key since.
      { fetchAssetSha256: vi.fn(async () => 'sha-of-SWAPPED-bytes') }
    ).catch((e) => e);

    expect(err).toBeInstanceOf(SetIdentityBoardUnavailableError);
    expect(err.setIdentityId).toBe(REQUIRED_ID);
    expect(err.reasons.join(' ')).toMatch(/bytes changed since binding/);
    expect(err.reasons.join(' ')).toMatch(/approval is void/);
  });

  it('fails closed when the object has become missing/unreadable since the bind', async () => {
    const ctx = await bindFresh();
    const err = await assertBoardsBoundForRender(
      {
        contract: makeContract(),
        cache: { setIdentityBoards: ctx },
        styleId: STYLE,
        activeFrozenContractHash: FROZEN_HASH,
      },
      { fetchAssetSha256: vi.fn(async () => null) }
    ).catch((e) => e);
    expect(err).toBeInstanceOf(SetIdentityBoardUnavailableError);
    expect(err.reasons.join(' ')).toMatch(/missing or unreadable at render time/);
  });

  it('re-reads the sha from the BINDING\'s storageKey — not from anything the caller supplies', async () => {
    const ctx = await bindFresh();
    const fetchAssetSha256 = vi.fn(async () => 'sha-approved-bytes');
    await assertBoardsBoundForRender(
      {
        contract: makeContract(),
        cache: { setIdentityBoards: ctx },
        styleId: STYLE,
        activeFrozenContractHash: FROZEN_HASH,
      },
      { fetchAssetSha256 }
    );
    expect(fetchAssetSha256).toHaveBeenCalledTimes(1);
    expect(fetchAssetSha256).toHaveBeenCalledWith(ctx.bindings[REQUIRED_ID].storageKey);
  });

  /**
   * The end-to-end shape of the P0-4 hazard through the REAL resolver: bind once, then resume. The resume path
   * reuses the binding VERBATIM and performs no I/O by design (see resolveBoardBindings) — so if the assert did
   * not re-read the bytes, a swap between the two would be completely invisible. It is not.
   */
  it('a resume that reuses a binding verbatim STILL catches a swap that happened in between', async () => {
    const first = await bindFresh();
    const deps = makeDeps();
    const resumed = await resolveBoardBindings(
      { contract: makeContract(), styleId: STYLE, frozenContractHash: FROZEN_HASH, existing: first },
      deps
    );
    expect(deps.fetchAssetSha256).not.toHaveBeenCalled(); // the reuse path is deliberately blind…

    await expect(
      assertBoardsBoundForRender(
        {
          contract: makeContract(),
          cache: { setIdentityBoards: resumed },
          styleId: STYLE,
          activeFrozenContractHash: FROZEN_HASH,
        },
        { fetchAssetSha256: vi.fn(async () => 'sha-of-SWAPPED-bytes') }
      )
    ).rejects.toThrow(SetIdentityBoardUnavailableError); // …so THIS is the only thing that catches it.
  });
});

describe('hasUnboundRequiredSetIdentity — the stage-work probe', () => {
  it('is true for a fresh activation snapshot and false once bound', async () => {
    expect(
      hasUnboundRequiredSetIdentity(makeContract(), snapshotBoardMode({ frozenContractHash: FROZEN_HASH }))
    ).toBe(true);
    expect(hasUnboundRequiredSetIdentity(makeContract(), await bindFresh())).toBe(false);
  });

  it('is true when a binding exists but carries no usable url', async () => {
    const ctx = await bindFresh();
    ctx.bindings[REQUIRED_ID].resolvedUrl = '';
    expect(hasUnboundRequiredSetIdentity(makeContract(), ctx)).toBe(true);
  });
});
