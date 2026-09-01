/**
 * Set Identity Board — Milestone C: the PAID-PATH RESOLVER / BINDER. PURE-ish: every side effect is an INJECTED dep,
 * so the whole module is unit-testable with no DB, no network, and no fs.
 *
 * What the paid worker is allowed to do with a board is deliberately tiny: LOOK UP an already-approved board,
 * VERIFY it, and BIND it. It NEVER mints, NEVER renders a board, and NEVER waits for a human review. If an approved
 * board is not sitting in the registry, already vision-passed and human-signed-off, the render STOPS.
 *
 * FAIL-CLOSED, and specifically never DEGRADED. Every failure below throws `SetIdentityBoardUnavailableError`:
 *   - no set-identity → registry mapping, or no registry entry for the current `setDefinitionHash`
 *   - the entry is not `qaStatus:'passed'`, or carries no explicit human approval
 *   - style / boardVersion / setDefinitionHash / storyKey mismatch (i.e. the set CHANGED — an old board is wrong)
 *   - the object is missing/unreadable, or its bytes no longer hash to the approved sha256
 *   - the durable url cannot be resolved
 * There is deliberately NO downgrade path: not `setReference:'none'`, not topology-only, not "use a different
 * board", not a soft prompt note. A wrong-but-plausible set on a paid page is worse than a failed order, because
 * nobody catches it before the customer does.
 *
 * IDEMPOTENT BY CONSTRUCTION. A binding that is already present AND still valid for the current set definition is
 * REUSED VERBATIM — no registry re-read, no re-fetch, no re-choice. This is what makes a crash after the bind safe:
 * a resumed worker re-derives the SAME board, never a different one, and never a second candidate.
 *
 * (P0-4b) That verbatim reuse is exactly why `assertBoardsBoundForRender` RE-READS the object's sha256 rather than
 * trusting the binding's metadata: the reuse path deliberately performs no I/O, so the ONLY thing standing between
 * a swapped object and a paid page is the byte re-verification in the pre-render assert.
 */
import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import { canonicalHash } from '@/lib/canonical-json';

import {
  type SetIdentityBoardBinding,
  type SetIdentityBoardBindingContext,
  type SetIdentityBoardRegistryEntry,
} from './types';
import { listRequiredSetIdentityIds } from './setDefinition';
import {
  validateSetIdentityBoardRegistryEntry,
  verifyBoardAssetBytes,
  type ExpectedRegistryIdentity,
} from './registry';
import { collectRequiredSetBoardAdmissionCensus } from './setBoardAdmission';
import {
  deriveExpectedSetBoardIdentity,
  FrozenSetBoardAuthorityInvalidError,
  validateTrustedFrozenSetBoardAuthorities,
  type DerivedExpectedSetBoardIdentity,
  type FrozenSetBoardAuthorityIdentity,
} from './expectedIdentity';

/**
 * The single fail-closed error for "this order cannot be rendered with a trustworthy set board". Carries the set
 * identity at fault (`'*'` for an order-level fault, e.g. a snapshot pinned to the wrong frozen contract) and the
 * FULL reason list, so an operator sees every problem at once rather than one-per-retry.
 */
export class SetIdentityBoardUnavailableError extends Error {
  /** The set identity that could not be bound, or `'*'` when the fault is order-level. */
  readonly setIdentityId: string;
  /** Every reason the bind/assert failed (never truncated to the first). */
  readonly reasons: string[];

  constructor(setIdentityId: string, reasons: string[]) {
    super(
      `[set_identity_board] no approved board usable for set identity "${setIdentityId}": ${reasons.join('; ')}`
    );
    this.name = 'SetIdentityBoardUnavailableError';
    this.setIdentityId = setIdentityId;
    this.reasons = reasons;
    // Restore the prototype chain so `instanceof` survives the ES5 `extends Error` downlevel.
    Object.setPrototypeOf(this, SetIdentityBoardUnavailableError.prototype);
  }
}

/**
 * The injected I/O seam. The resolver itself does NO I/O — these three are the only doors to the outside world, and
 * each one is allowed to return "not there" (null) rather than throw; the resolver converts a null into the
 * fail-closed error with the right reason attached.
 */
export interface BoardResolverDeps {
  /** The registry entry filed under this exact identity key, or null when there is none. */
  loadRegistryEntry(key: ExpectedRegistryIdentity): SetIdentityBoardRegistryEntry | null;
  /** The environment-specific url for the durable `storageKey`, or null when it cannot be resolved. */
  resolveDurableUrl(storageKey: string): Promise<string | null>;
  /** The sha256 of the bytes actually stored at `storageKey`, or null when missing/unreadable. */
  fetchAssetSha256(storageKey: string): Promise<string | null>;
}

/**
 * Derive every expected identity from one canonical owner. A fresh flow always uses forward authority. Historical
 * v6 selection is accepted only from a complete immutable-package inventory that is independently re-derived; a
 * Registry row, cached binding, or caller-supplied version string can never downgrade itself.
 */
function expectedIdentitiesFor(args: {
  contract: BookVisualContract;
  styleId: string;
  frozenRequiredBoards?: readonly FrozenSetBoardAuthorityIdentity[];
}): Map<string, DerivedExpectedSetBoardIdentity> {
  if (args.frozenRequiredBoards !== undefined) {
    return validateTrustedFrozenSetBoardAuthorities({
      contract: args.contract,
      styleId: args.styleId,
      boards: args.frozenRequiredBoards,
    });
  }
  return new Map(
    listRequiredSetIdentityIds(args.contract).map((setIdentityId) => [
      setIdentityId,
      deriveExpectedSetBoardIdentity({
        contract: args.contract,
        setIdentityId,
        styleId: args.styleId,
      }),
    ]),
  );
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function assertCompleteBoardAdmission(
  contract: BookVisualContract,
  styleId: string,
  expectedBySet: ReadonlyMap<string, DerivedExpectedSetBoardIdentity>,
): void {
  const census = collectRequiredSetBoardAdmissionCensus(contract, styleId, {
    boardVersionsBySet: new Map(
      [...expectedBySet].map(([setIdentityId, derived]) => [
        setIdentityId,
        derived.expected.boardVersion,
      ]),
    ),
  });
  if (census.admitted) return;
  throw new SetIdentityBoardUnavailableError(
    '*',
    [
      ...census.contractIssues,
      ...census.results.flatMap((result) => result.issues),
    ].map((issue) =>
      `[${issue.code}] ${issue.setIdentityId}` +
      (issue.fieldPath ? ` ${issue.fieldPath}` : '') +
      `: ${issue.message}`),
  );
}

/**
 * Whether an EXISTING binding still describes the board this contract+style currently requires. Compared against a
 * FRESHLY RECOMPUTED expectation (never against the binding's own claims), so a set edit, a style change, or a
 * board-version bump all invalidate it. A binding that passes here is reused verbatim.
 */
function isBindingStillValid(
  binding: SetIdentityBoardBinding | undefined,
  expected: ExpectedRegistryIdentity,
  frozen?: FrozenSetBoardAuthorityIdentity,
): boolean {
  if (!binding) return false;
  if (binding.setIdentityId !== expected.setIdentityId) return false;
  if (binding.setDefinitionHash !== expected.setDefinitionHash) return false;
  if (binding.contentPolicyDigest !== expected.contentPolicyDigest) return false;
  if (JSON.stringify(binding.declaredPropIds) !== JSON.stringify(expected.declaredPropIds)) return false;
  if (binding.styleId !== expected.styleId) return false;
  if (binding.boardVersion !== expected.boardVersion) return false;
  if (!isNonEmptyString(binding.storageKey)) return false;
  if (!isNonEmptyString(binding.resolvedUrl)) return false;
  if (!isNonEmptyString(binding.assetSha256)) return false;
  // A binding without an approval stamp is not a binding — it is a candidate that leaked.
  if (!isNonEmptyString(binding.approvedAt)) return false;
  if (frozen) {
    if (binding.storageKey !== frozen.storageKey) return false;
    if (binding.assetSha256 !== frozen.assetSha256) return false;
    if (binding.approvedAt !== frozen.approvedAt) return false;
  }
  return true;
}

/**
 * The ACTIVATION snapshot for a newly frozen contract: `required-v2` with ZERO bindings yet. Writing this is what
 * opts ONE order onto the board path, permanently. Called ONLY when the flag is on and only at the moment the
 * contract freezes — an order that never gets this stays legacy for life (see `set-identity-board-stage.ts`).
 */
export function snapshotBoardMode(args: { frozenContractHash: string }): SetIdentityBoardBindingContext {
  return { mode: 'required-v2', frozenContractHash: args.frozenContractHash, bindings: {} };
}

/** LOOK UP → VERIFY → BIND exactly one set identity. Every failure path throws; there is no degraded return. */
async function bindOneBoard(
  setIdentityId: string,
  expected: ExpectedRegistryIdentity,
  deps: BoardResolverDeps,
  frozen?: FrozenSetBoardAuthorityIdentity,
): Promise<SetIdentityBoardBinding> {
  const entry = deps.loadRegistryEntry(expected);
  if (!entry) {
    throw new SetIdentityBoardUnavailableError(setIdentityId, [
      `no registry entry for setDefinitionHash "${expected.setDefinitionHash}" ` +
        `(story "${expected.storyKey}", style "${expected.styleId}", ${expected.boardVersion}) — ` +
        `an approved board must be minted + human-approved OFFLINE before this order can render`,
    ]);
  }

  // Fail-closed identity + QA + human-approval gate (Milestone A). Rejects a candidate (qaStatus:'pending',
  // approvedBy:null), a failed QA, a foreign style, a stale boardVersion, and any setDefinitionHash drift.
  const validation = validateSetIdentityBoardRegistryEntry(entry, expected);
  if (!validation.ok) {
    throw new SetIdentityBoardUnavailableError(setIdentityId, validation.errors);
  }
  if (frozen && canonicalHash(entry) !== frozen.artifactDigest) {
    throw new SetIdentityBoardUnavailableError(setIdentityId, [
      `Registry artifact differs from immutable Visual Package digest "${frozen.artifactDigest}"`,
    ]);
  }

  // Byte fence BEFORE the url: an approval covers specific BYTES, not a storage location. A re-render at the same
  // key voids the approval.
  const actualSha256 = await deps.fetchAssetSha256(entry.storageKey);
  if (!isNonEmptyString(actualSha256)) {
    throw new SetIdentityBoardUnavailableError(setIdentityId, [
      `board object "${entry.storageKey}" is missing or unreadable — cannot verify the approved bytes`,
    ]);
  }
  const bytes = verifyBoardAssetBytes(entry, actualSha256);
  if (!bytes.ok) {
    throw new SetIdentityBoardUnavailableError(setIdentityId, bytes.errors);
  }

  const resolvedUrl = await deps.resolveDurableUrl(entry.storageKey);
  if (!isNonEmptyString(resolvedUrl)) {
    throw new SetIdentityBoardUnavailableError(setIdentityId, [
      `board url unresolvable for storageKey "${entry.storageKey}"`,
    ]);
  }

  return {
    setIdentityId,
    setDefinitionHash: entry.setDefinitionHash,
    contentPolicyDigest: entry.contentPolicyDigest,
    declaredPropIds: entry.declaredPropIds,
    styleId: entry.styleId,
    // storageKey is the DURABLE authority; resolvedUrl is the env-specific locator handed to the provider. Both are
    // durable descriptors — NEVER a local /tmp path (assertCacheHasNoLocalArtifactPaths would reject the cache).
    storageKey: entry.storageKey,
    resolvedUrl,
    assetSha256: entry.assetSha256,
    boardVersion: entry.boardVersion,
    // Non-empty by the validator above (human approval is explicit or the entry was rejected).
    approvedAt: entry.approvedAt as string,
  };
}

/**
 * Resolve the FULL binding set for one order's frozen contract. Rebuilt from `listRequiredSetIdentityIds` every
 * call, so an identity that stopped requiring a board drops out and a new one is bound — but any binding that is
 * still valid is carried over VERBATIM (idempotency: a retry/crash-resume never re-chooses a different board).
 *
 * The frozen contract is READ ONLY — nothing here mutates it.
 */
export async function resolveBoardBindings(
  args: {
    contract: BookVisualContract;
    styleId: string;
    frozenContractHash: string;
    existing?: SetIdentityBoardBindingContext;
    /** Trusted immutable Visual Package inventory. Never populate from Registry, cache, or an existing binding. */
    frozenRequiredBoards?: readonly FrozenSetBoardAuthorityIdentity[];
  },
  deps: BoardResolverDeps
): Promise<SetIdentityBoardBindingContext> {
  const { contract, styleId, frozenContractHash, existing } = args;
  const frozenBySet = new Map(
    (args.frozenRequiredBoards ?? []).map((board) => [
      board.setIdentityId,
      board,
    ]),
  );

  let expectedBySet: Map<string, DerivedExpectedSetBoardIdentity>;
  try {
    expectedBySet = expectedIdentitiesFor({
      contract,
      styleId,
      frozenRequiredBoards: args.frozenRequiredBoards,
    });
  } catch (error) {
    if (error instanceof FrozenSetBoardAuthorityInvalidError) {
      throw new SetIdentityBoardUnavailableError('*', [...error.reasons]);
    }
    throw error;
  }
  assertCompleteBoardAdmission(contract, styleId, expectedBySet);
  const bindings: Record<string, SetIdentityBoardBinding> = {};
  for (const setIdentityId of listRequiredSetIdentityIds(contract)) {
    const expected = expectedBySet.get(setIdentityId)!.expected;
    const prior = existing?.bindings?.[setIdentityId];
    const frozen = frozenBySet.get(setIdentityId);
    if (isBindingStillValid(prior, expected, frozen)) {
      bindings[setIdentityId] = prior as SetIdentityBoardBinding; // REUSE VERBATIM — never re-choose.
      continue;
    }
    bindings[setIdentityId] = await bindOneBoard(
      setIdentityId,
      expected,
      deps,
      frozen,
    );
  }

  return { mode: 'required-v2', frozenContractHash, bindings };
}

/**
 * Cheap PRESENCE probe used only to decide whether the `set_refs` STAGE has work left. Deliberately does NOT hash
 * anything: staleness is the pre-render assertion's job, and the stage decision must stay cheap on every resume.
 */
export function hasUnboundRequiredSetIdentity(
  contract: BookVisualContract,
  snapshot: SetIdentityBoardBindingContext
): boolean {
  return listRequiredSetIdentityIds(contract).some((id) => {
    const binding = snapshot.bindings?.[id];
    return !binding || !isNonEmptyString(binding.resolvedUrl);
  });
}

/** The ONE door `assertBoardsBoundForRender` needs: the sha256 of the bytes ACTUALLY stored at a storage key. */
export type BoardByteVerifierDeps = Pick<BoardResolverDeps, 'fetchAssetSha256'>;

/**
 * THE PRE-IMAGE ASSERTION — the last thing between a board-activated order and a paid render.
 *
 * A NO-OP for a LEGACY order (no `required-v2` snapshot) — which is every order today and every order while the
 * flag is off. It returns BEFORE it touches `deps`, so an OFF/legacy order performs zero I/O and stays
 * byte-identical. That is the whole OFF-inertness argument in one line.
 *
 * For an ACTIVATED order it is fail-closed on THREE axes:
 *   1. The snapshot must be pinned to the ACTIVE frozen contract. A snapshot from a different contract means the
 *      set may have changed under the bindings — the boards are not provably right, so we stop.
 *   2. Every currently-required set identity must have a binding that STILL matches a freshly recomputed
 *      `setDefinitionHash` (plus style/version/url/approval). A missing OR stale binding stops the render.
 *   3. (P0-4b) The BYTES at the binding's `storageKey` must STILL hash to the binding's `assetSha256`.
 *
 * Why (3) — the hole this closes: metadata is not evidence about bytes. The sha was verified once, at bind time;
 * `resolveBoardBindings` then REUSES a valid binding verbatim on every resume without re-reading storage. So
 * between the bind and the render (or across a resume days later) the object could be replaced and every check
 * above would still pass — a swapped, never-approved set on a paid page. Re-reading the sha here means an
 * approval covers BYTES, continuously, right up to the provider call. Content-addressed keys
 * (`setIdentityBoardStorageKey`) make this belt-and-braces rather than the only defence; this is the braces.
 *
 * COST SHAPE: this is the PER-CHUNK pre-render gate — one read per required identity per chunk, never per page.
 *
 * `styleId` is passed in rather than read off the binding on purpose: recomputing the expectation from the
 * binding's own `styleId` would let a wrong-style binding validate itself. It must be the SAME normalized id the
 * bind used (see `set-identity-board-stage.ts`) or bind and assert cannot agree.
 */
export async function assertBoardsBoundForRender(
  args: {
    contract: BookVisualContract;
    cache: { setIdentityBoards?: SetIdentityBoardBindingContext };
    styleId: string;
    activeFrozenContractHash: string | null;
    /** Trusted immutable Visual Package inventory. Never populate from Registry, cache, or a binding. */
    frozenRequiredBoards?: readonly FrozenSetBoardAuthorityIdentity[];
  },
  deps: BoardByteVerifierDeps
): Promise<void> {
  const snapshot = args.cache.setIdentityBoards;
  if (snapshot?.mode !== 'required-v2') return; // LEGACY order → no-op, no I/O → byte-identical.

  if (!isNonEmptyString(args.activeFrozenContractHash) || snapshot.frozenContractHash !== args.activeFrozenContractHash) {
    throw new SetIdentityBoardUnavailableError('*', [
      `board snapshot is pinned to frozen contract "${snapshot.frozenContractHash}" but the active frozen ` +
        `contract is "${args.activeFrozenContractHash ?? '(none)'}" — the set may have changed under the bindings`,
    ]);
  }

  let expectedBySet: Map<string, DerivedExpectedSetBoardIdentity>;
  const frozenBySet = new Map(
    (args.frozenRequiredBoards ?? []).map((board) => [
      board.setIdentityId,
      board,
    ]),
  );
  try {
    expectedBySet = expectedIdentitiesFor({
      contract: args.contract,
      styleId: args.styleId,
      frozenRequiredBoards: args.frozenRequiredBoards,
    });
  } catch (error) {
    if (error instanceof FrozenSetBoardAuthorityInvalidError) {
      throw new SetIdentityBoardUnavailableError('*', [...error.reasons]);
    }
    throw error;
  }
  assertCompleteBoardAdmission(args.contract, args.styleId, expectedBySet);
  for (const setIdentityId of listRequiredSetIdentityIds(args.contract)) {
    const binding = snapshot.bindings?.[setIdentityId];
    if (!binding) {
      throw new SetIdentityBoardUnavailableError(setIdentityId, [
        'required set identity has no board binding — refusing to render a paid image without its approved set board',
      ]);
    }
    const expected = expectedBySet.get(setIdentityId)!.expected;
    if (!isBindingStillValid(
      binding,
      expected,
      frozenBySet.get(setIdentityId),
    )) {
      throw new SetIdentityBoardUnavailableError(setIdentityId, [
        `board binding is stale — expected setDefinitionHash "${expected.setDefinitionHash}" / style ` +
          `"${expected.styleId}" / ${expected.boardVersion}, got "${binding.setDefinitionHash}" / ` +
          `"${binding.styleId}" / ${binding.boardVersion}`,
      ]);
    }

    // (P0-4b) The byte fence, re-run. Metadata said the right board; this says the right BYTES are still there.
    const actualSha256 = await deps.fetchAssetSha256(binding.storageKey);
    if (!isNonEmptyString(actualSha256)) {
      throw new SetIdentityBoardUnavailableError(setIdentityId, [
        `board object "${binding.storageKey}" is missing or unreadable at render time — cannot re-verify the ` +
          'approved bytes',
      ]);
    }
    if (actualSha256 !== binding.assetSha256) {
      throw new SetIdentityBoardUnavailableError(setIdentityId, [
        `board bytes changed since binding (bound sha256 "${binding.assetSha256}", stored "${actualSha256}") — ` +
          'the human approval covers the bound bytes only; approval is void',
      ]);
    }
  }
}
