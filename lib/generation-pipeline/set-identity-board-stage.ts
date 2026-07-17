/**
 * Set Identity Board — Milestone C: the CHUNK LIFECYCLE (ACTIVATE → BIND → ASSERT). The DB-touching half.
 *
 * Deliberately split from `lib/set-identity-board/*` (which stays pure/offline per Milestones A+B): everything that
 * touches Prisma or the delivery-input barrier lives HERE, mirroring `ensure-frozen-visual-contract.ts` — same lazy
 * `prisma` import (so importing this module never triggers `validateEnv()` at load), same injectable deps, same
 * single-key `jsonb_set` write.
 *
 * THE ORDERING INVARIANT — a board is bound to ONE frozen contract, before ONE paid image:
 *   fresh:  text → dna → [freeze] → [ACTIVATE] → set_refs [BIND] → cover → page_images
 *   resume: (currentStage) → [freeze] → [ASSERT] → …
 *
 * OFF IS INERT. Read this as the OFF-inertness argument in code:
 *   - `ensureSetIdentityBoardSnapshot` is the ONLY writer of `cache.setIdentityBoards`, and its FIRST line is the
 *     flag check. Flag off → no snapshot is ever written → no order ever becomes board-activated.
 *   - Every OTHER function here gates on the SNAPSHOT being `required-v1`, not on the flag. With no snapshot they
 *     return `cache` / `undefined` / do nothing, before reading the contract, before any DB call, before any I/O.
 *   - Therefore, flag off (or an order that predates activation): zero extra DB reads, zero writes, zero prompt
 *     bytes, and `deriveStartingStage` can never yield `'set_refs'`. The pipeline is byte/behaviour-identical.
 *
 * Gating the post-activation steps on the SNAPSHOT rather than the flag is not an oversight — it is the fence in
 * both directions: an activated order can never silently drop its board because someone flipped the env var off
 * mid-book (it fails closed instead), and a legacy order can never acquire a board mid-book because someone
 * flipped it on.
 *
 * (P0-1) `shouldEnterSetRefsStage` used to read the flag too, which broke that fence in the first direction: an
 * activated-but-unbound order whose flag went down would skip `set_refs` entirely and then be asserted-to-death at
 * the cover, unable to ever bind. The flag now governs snapshot CREATION and NOTHING else — the single sentence
 * this module's design rests on.
 */
import { type Order, type PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { styleIdFromDatabaseValue } from '@/lib/styles';
import {
  computeVisualContractHash,
  readFrozenVisualContract,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';
import {
  assertBoardsBoundForRender,
  createLiveBoardResolverDeps,
  hasUnboundRequiredSetIdentity,
  isSetIdentityBoardEnabled,
  resolveBoardBindings,
  selectBoardRefForLocation,
  snapshotBoardMode,
  SetIdentityBoardUnavailableError,
  type BoardResolverDeps,
  type ReferenceAsset,
  type SetIdentityBoardBindingContext,
} from '@/lib/set-identity-board';
import type { ReceiptSafeValue } from './atomic-operation';
import type { PipelineCache } from './types';
// Lazy-imported inside the functions (mirrors ensure-frozen-visual-contract.ts). Type-only here.
type WithDeliveryInputMutation = typeof import('./readiness-manifest').withDeliveryInputMutation;

export interface SetIdentityBoardStageDeps {
  /** Override the registry/storage lookup (tests). Default: the live committed-sidecar + Supabase adapter. */
  resolver?: BoardResolverDeps;
  /** Override the delivery-input barrier (tests). Default: the real `withDeliveryInputMutation`. */
  withMutation?: WithDeliveryInputMutation;
  /** Prisma client (tests). Default: the shared client. */
  db?: PrismaClient;
}

/**
 * The contract this order will actually RENDER against, plus its hash — recomputed from the cache, not read from
 * `Order.visualContractHash`. Same rationale as `renderedContractHashOf` in chunk-runner: the binding must be tied
 * to the contract in hand (structural), immune to a concurrent re-freeze of the Order stamp.
 */
function activeFrozenContract(
  cache: PipelineCache
): { contract: BookVisualContract; hash: string } | null {
  const contract = readFrozenVisualContract(cache.visualContract);
  if (!contract) return null;
  return { contract, hash: computeVisualContractHash(contract) };
}

/**
 * (P0-2) THE style id a board is keyed by — the NORMALIZED one, never the raw `Order.illustrationStyle`.
 *
 * `Order.illustrationStyle` holds a DATABASE enum value (`pencil_watercolor`, `whimsical_comic_fantasy`, …), while
 * every style AUTHORITY in the repo — including `buildSetIdentityBoardPrompt`, which is what actually renders a
 * board — is keyed by a normalized `StyleId` (`soft_hand_drawn_storybook`, …). Feeding the raw DB value into the
 * bind/assert put them in a DIFFERENT NAMESPACE from the mint tool: a board minted for `soft_hand_drawn_storybook`
 * could never validate against an order whose column says `pencil_watercolor`, so every such order failed closed
 * forever. It is also not a 1:1 rename — `pencil_watercolor` and `realistic_illustrated` BOTH normalize to
 * `soft_hand_drawn_storybook` and legitimately share one board.
 *
 * Called from the bind AND the assert AND the ref selection, so all of them agree by construction. This is the one
 * place the conversion happens; nothing downstream may re-derive it.
 */
function boardStyleIdOf(order: Order): string {
  return styleIdFromDatabaseValue(order.illustrationStyle);
}

/** A book with ANY paid image already on it. Such a book was rendered WITHOUT a board and must stay that way. */
async function hasRenderedPaidImage(db: PrismaClient, orderId: string): Promise<boolean> {
  const book = await db.generatedBook.findUnique({
    where: { orderId },
    select: {
      coverImageUrl: true,
      pages: { where: { imageAsset: { isNot: null } }, select: { id: true }, take: 1 },
    },
  });
  if (!book) return false;
  if (book.coverImageUrl?.trim()) return true;
  return book.pages.length > 0;
}

/**
 * Persist the board context as a SINGLE KEY, atomically. Copies `ensureFrozenVisualContract`'s write shape
 * verbatim and for the same reason: a single-key `jsonb_set` has NO read-window, so it reads + sets the one key
 * inside one row-locked UPDATE and can never clobber a concurrent (non-board) `pipelineCache` writer. `saveCache`
 * is a WHOLE-object overwrite and must NOT be used for this.
 *
 * The `operationKey` is content-addressed and embeds `frozenContractHash` + the canonical hash of the exact context
 * written, so: a replay of the same write hits the receipt fence (no second `inputVersion` bump), and a genuinely
 * different context is a genuinely new operation. `mutationPayload` covers 100% of what this operation writes.
 */
async function persistBoardContext(
  db: PrismaClient,
  orderId: string,
  context: SetIdentityBoardBindingContext,
  phase: 'activate' | 'bind',
  deps: SetIdentityBoardStageDeps
): Promise<void> {
  const withMutation = deps.withMutation ?? (await import('./readiness-manifest')).withDeliveryInputMutation;
  const contextHash = canonicalHash(context);
  await withMutation(
    db,
    {
      orderId,
      reason: 'set_identity_board_bound',
      operationKey: `delivery_input:${orderId}:set_identity_boards:${context.frozenContractHash}:${phase}:${contextHash}`,
      mutationPayload: { setIdentityBoards: context } as unknown as ReceiptSafeValue,
    },
    async (tx) => {
      await tx.$executeRaw`
        UPDATE "GenerationJob"
        SET "pipelineCache" = jsonb_set(COALESCE("pipelineCache", '{}'::jsonb), '{setIdentityBoards}', ${JSON.stringify(context)}::jsonb, true)
        WHERE "orderId" = ${orderId}
      `;
    }
  );
}

/**
 * ACTIVATE: write the `required-v1` snapshot for a freshly frozen contract. The ONE place an order joins the board
 * path — and it can only happen at the fresh dna→cover transition, before any paid image exists.
 *
 * No-op (returns `cache` untouched) when:
 *   - the flag is off                       → OFF-inertness
 *   - there is no frozen contract           → freeze off / no artifact → legacy order, nothing to derive a set from
 *   - the same snapshot already exists      → idempotent resume (no write, no inputVersion bump)
 *   - the book already has a paid image     → HALF-LEGACY FENCE (below)
 *
 * HALF-LEGACY FENCE: a book with a cover/page already rendered was rendered without a board. Introducing one now
 * would make page 7 disagree with page 6 — a half-boarded book is worse than an unboarded one. Such an order stays
 * legacy FOREVER, even when the env flag is on. (The stage graph makes this nearly unreachable — dna is done, so a
 * resume enters at cover, not dna — but the fence is written down structurally rather than left incidental.)
 *
 * RE-FREEZE: when a snapshot exists for a DIFFERENT contract hash and no paid image has been rendered, it is
 * REPLACED (fresh, empty bindings). Nothing was paid for against the old set, and leaving the stale snapshot in
 * place would deadlock the order forever on the pre-render assertion.
 */
export async function ensureSetIdentityBoardSnapshot(
  order: Order,
  cache: PipelineCache,
  deps: SetIdentityBoardStageDeps = {}
): Promise<PipelineCache> {
  if (!isSetIdentityBoardEnabled()) return cache; // flag OFF → byte-identical no-op

  const active = activeFrozenContract(cache);
  if (!active) return cache; // no frozen contract → never board-activated

  const existing = cache.setIdentityBoards;
  if (existing?.mode === 'required-v1' && existing.frozenContractHash === active.hash) return cache;

  const db = deps.db ?? (await import('@/lib/prisma')).prisma;
  if (await hasRenderedPaidImage(db, order.id)) return cache; // HALF-LEGACY FENCE

  const snapshot = snapshotBoardMode({ frozenContractHash: active.hash });
  await persistBoardContext(db, order.id, snapshot, 'activate', deps);
  return { ...cache, setIdentityBoards: snapshot };
}

/**
 * BIND (the `set_refs` stage body): look up + verify + bind every required board, then persist. Fail-closed —
 * `resolveBoardBindings` throws `SetIdentityBoardUnavailableError` rather than degrade.
 *
 * A LEGACY order (no snapshot) falls straight through doing NOTHING → the caller proceeds to `cover` exactly as
 * today. Gated on the snapshot, NOT the flag: an activated order that reaches this stage must bind even if the env
 * var was flipped off mid-book — the alternative is silently dropping the board.
 *
 * No write when the resolved context is byte-identical to the stored one (the crash-after-bind resume): the
 * bindings were already correct, so there is nothing to persist and no `inputVersion` to bump.
 */
export async function runSetIdentityBoardBindStage(
  order: Order,
  cache: PipelineCache,
  deps: SetIdentityBoardStageDeps = {}
): Promise<PipelineCache> {
  const snapshot = cache.setIdentityBoards;
  if (snapshot?.mode !== 'required-v1') return cache; // LEGACY → straight through to cover.

  const active = activeFrozenContract(cache);
  if (!active) {
    throw new SetIdentityBoardUnavailableError('*', [
      'the order carries a required-v1 board snapshot but no readable frozen visual contract',
    ]);
  }
  if (snapshot.frozenContractHash !== active.hash) {
    throw new SetIdentityBoardUnavailableError('*', [
      `board snapshot is pinned to frozen contract "${snapshot.frozenContractHash}" but the active frozen ` +
        `contract is "${active.hash}" — refusing to bind boards against a contract the order was not activated on`,
    ]);
  }

  const resolved = await resolveBoardBindings(
    {
      contract: active.contract,
      // (P0-2) NORMALIZED — the same id the mint tool keys a board by. Must match the assert's, below.
      styleId: boardStyleIdOf(order),
      frozenContractHash: active.hash,
      existing: snapshot,
    },
    deps.resolver ?? createLiveBoardResolverDeps()
  );

  if (canonicalHash(resolved) === canonicalHash(snapshot)) return cache; // already bound → no write

  const db = deps.db ?? (await import('@/lib/prisma')).prisma;
  await persistBoardContext(db, order.id, resolved, 'bind', deps);
  return { ...cache, setIdentityBoards: resolved };
}

/**
 * ASSERT: the pre-image gate. Called immediately after `requireRenderableFrozenContract` on BOTH the resume and
 * fresh paths, AND immediately before every cover/page provider call, so no route to a paid image can render with
 * a missing, stale, or byte-swapped binding. A NO-OP for a legacy order (no snapshot) — i.e. for everything today.
 *
 * (P0-4b) ASYNC because the assertion now RE-READS the board object's sha256 (see `assertBoardsBoundForRender`):
 * checking metadata alone let a swapped object through. The legacy short-circuit is above the dep construction, so
 * a legacy order still does zero I/O and constructs no live resolver.
 */
export async function requireSetIdentityBoardsBoundForRender(
  order: Order,
  cache: PipelineCache,
  deps: SetIdentityBoardStageDeps = {}
): Promise<void> {
  const snapshot = cache.setIdentityBoards;
  if (snapshot?.mode !== 'required-v1') return; // LEGACY → no-op, no I/O, no deps → byte-identical.

  const active = activeFrozenContract(cache);
  if (!active) {
    throw new SetIdentityBoardUnavailableError('*', [
      'the order carries a required-v1 board snapshot but no readable frozen visual contract',
    ]);
  }
  await assertBoardsBoundForRender(
    {
      contract: active.contract,
      cache,
      // (P0-2) The SAME normalized id `runSetIdentityBoardBindStage` binds with — bind and assert cannot disagree.
      styleId: boardStyleIdOf(order),
      activeFrozenContractHash: active.hash,
    },
    deps.resolver ?? createLiveBoardResolverDeps()
  );
}

/**
 * Whether the `set_refs` STAGE has work to do.
 *
 * (P0-1) THE SNAPSHOT IS THE AUTHORITY HERE — NOT THE ENV FLAG. `isSetIdentityBoardEnabled()` is deliberately NOT
 * read: it governs exactly one thing, snapshot CREATION in `ensureSetIdentityBoardSnapshot`, and nothing else.
 *
 * Why the flag read was a P0: it made the flag a live gate on a stage that an ALREADY-ACTIVATED order must pass
 * through. An order activated at `dna` (snapshot written, boards unbound) whose flag then went DOWN — a config
 * rollback, a redeploy, a worker on a differently-configured runtime — would see `shouldEnterSetRefsStage` return
 * false, fall through to `cover`, and the order could NEVER bind: the pre-render assert (correctly gated on the
 * snapshot) then throws forever. The order is bricked by an env var, which is precisely the "flipping it off
 * mid-book silently drops the board" failure the snapshot/flag split exists to prevent.
 *
 * With the flag gone, the decision is purely structural: a `required-v1` snapshot + a readable frozen contract +
 * any required identity still unbound (the required list derived from the contract via `listRequiredSetIdentityIds`
 * inside `hasUnboundRequiredSetIdentity`). OFF-inertness is UNCHANGED and now rests on one fact instead of two: a
 * legacy order has no snapshot, so this returns false at the first line, before it reads the contract — and with
 * the flag off no order can ever acquire a snapshot. Byte-identical.
 *
 * An activated order with an UNREADABLE contract returns false (→ `cover`) rather than entering a stage that cannot
 * bind; the pre-render assert then fails it closed with the precise reason. It is never silently rendered.
 */
export function shouldEnterSetRefsStage(cache: PipelineCache): boolean {
  const snapshot = cache.setIdentityBoards;
  if (snapshot?.mode !== 'required-v1') return false; // LEGACY → never → byte-identical.
  const active = activeFrozenContract(cache);
  if (!active) return false;
  return hasUnboundRequiredSetIdentity(active.contract, snapshot);
}

/**
 * The location THIS artifact is contractually set in. Page 0 = the COVER, whose location authority lives in
 * `coverContract` (it has no `pageContracts` row) — same resolution `contractPageEnvironmentClass` uses, so the
 * cover's board and the cover's style refs can never disagree about where the cover is.
 */
function contractPageLocationId(contract: BookVisualContract, pageNumber: number): string | null {
  const locationId =
    pageNumber === 0
      ? contract.coverContract?.locationId
      : contract.pageContracts?.find((p) => p.pageNumber === pageNumber)?.locationId;
  return locationId ?? null;
}

/**
 * The tagged set-board reference for ONE artifact — resolved from THAT page's own `locationId`, so a page can only
 * ever receive its OWN set's board (never another location's). LEGACY order → `undefined` → the Milestone B
 * transport in image.ts stays a no-op and the prompt/refs are byte-identical to today.
 */
export function setIdentityBoardRefsForPage(
  cache: PipelineCache,
  pageNumber: number
): ReferenceAsset[] | undefined {
  const snapshot = cache.setIdentityBoards;
  if (snapshot?.mode !== 'required-v1') return undefined; // LEGACY → byte-identical.

  const active = activeFrozenContract(cache);
  if (!active) return undefined;

  const locationId = contractPageLocationId(active.contract, pageNumber);
  if (!locationId) return undefined;

  const ref = selectBoardRefForLocation({
    contract: active.contract,
    bindings: snapshot.bindings,
    locationId,
  });
  return ref ? [ref] : undefined;
}
