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
 *     return `cache` / `undefined` / do nothing, before reading the contract, before any DB call.
 *   - Therefore, flag off (or an order that predates activation): zero extra DB reads, zero writes, zero prompt
 *     bytes, and `deriveStartingStage` can never yield `'set_refs'`. The pipeline is byte/behaviour-identical.
 *
 * Gating the post-activation steps on the SNAPSHOT rather than the flag is not an oversight — it is the fence in
 * both directions: an activated order can never silently drop its board because someone flipped the env var off
 * mid-book (it fails closed instead), and a legacy order can never acquire a board mid-book because someone
 * flipped it on.
 */
import { type Order, type PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
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
      styleId: order.illustrationStyle,
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
 * fresh paths, so a worker that resumes DIRECTLY at `cover` or `page_images` cannot render with a missing or stale
 * binding. A NO-OP for a legacy order (no snapshot) — i.e. for everything today.
 */
export function requireSetIdentityBoardsBoundForRender(order: Order, cache: PipelineCache): void {
  const snapshot = cache.setIdentityBoards;
  if (snapshot?.mode !== 'required-v1') return; // LEGACY → no-op → byte-identical.

  const active = activeFrozenContract(cache);
  if (!active) {
    throw new SetIdentityBoardUnavailableError('*', [
      'the order carries a required-v1 board snapshot but no readable frozen visual contract',
    ]);
  }
  assertBoardsBoundForRender({
    contract: active.contract,
    cache,
    styleId: order.illustrationStyle,
    activeFrozenContractHash: active.hash,
  });
}

/** Whether the `set_refs` STAGE has work to do. Flag-gated FIRST → flag off does zero work and never enters. */
export function shouldEnterSetRefsStage(cache: PipelineCache): boolean {
  if (!isSetIdentityBoardEnabled()) return false;
  const snapshot = cache.setIdentityBoards;
  if (snapshot?.mode !== 'required-v1') return false;
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
