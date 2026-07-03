/**
 * ensureFrozenVisualContract (WS0b commit a) — PRODUCE → FREEZE → BIND the BookVisualContract before spend.
 *
 * Runs after text-finalization + DNA and BEFORE the cover (and, idempotently, on every resume before any paid
 * image). It:
 *   1. PRODUCES the contract — bank stories LOAD the approved artifact (no LLM at runtime); dynamic stories
 *      COMPILE once from the finalized text.
 *   2. FREEZES it atomically via the EXISTING `withDeliveryInputMutation` barrier: stamps `Order.visualContractHash`
 *      and persists the full contract into `pipelineCache.visualContract` in ONE transaction. The `operationKey`
 *      INCLUDES the contract hash, so a re-freeze of the same contract hits the receipt fence and REPLAYS (the
 *      mutation is never re-applied → NO second `inputVersion` bump; `AtomicOperationReceipt` is untouched — this
 *      module only CALLS the barrier).
 *
 * WS0b posture — non-blocking, byte-identical when off:
 *   - Gated by `VISUAL_CONTRACT_FREEZE` (default OFF, hard-off on prod). OFF → immediate no-op: no produce, no
 *     stamp, no cache write, no `inputVersion` bump → render output is byte-identical to today.
 *   - Best-effort: producing a contract must NEVER block delivery in WS0b (enforcement is OFF). A missing bank
 *     artifact (WS0c authors them) or any produce failure → SKIP the freeze and proceed on the legacy path. The
 *     blocking gate lands in WS1.
 *   - NO consumer reads `Order.visualContractHash` / `pipelineCache.visualContract` yet — this commit only binds.
 *
 * The `mutationPayload` covers 100% of what this operation authoritatively writes — `{ visualContractHash,
 * visualContract }` — so a same-`operationKey` retry carrying different content FAILS CLOSED (it cannot, since the
 * key already embeds the hash). The other `pipelineCache` fields written in the same statement are the current
 * authoritative pipeline state (owned + re-persisted by `saveCache`), never this operation's content.
 */
import path from 'path';
import { Prisma, type Order, type PrismaClient } from '@prisma/client';
import { createLogger } from '@/lib/logger';
import { STORY_BANK_V3_DIR_NAME } from '@/backend/providers/story-bank-index';
import {
  compileBookVisualContract,
  computeVisualContractHash,
  loadVisualContractArtifact,
  MissingContractArtifactError,
  isVisualContractFreezeEnabled,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';
import type { ReceiptSafeValue } from './atomic-operation';
import type { PipelineCache } from './types';
// `prisma` and the delivery-input barrier are LAZY-imported inside the function (below) — so importing this
// module (and unit tests that inject both) never triggers `validateEnv()` at load. Type-only here.
type WithDeliveryInputMutation = typeof import('./readiness-manifest').withDeliveryInputMutation;

const log = createLogger({ subsystem: 'chunked-gen', route: 'visual-contract-freeze' });

/** A produced-and-hashed contract, or `null` when none is available (skip the freeze). */
export interface ProducedContract {
  contract: BookVisualContract;
  contractHash: string;
}

/** Injectable seam: yield the contract to freeze for this order, or `null` to skip. */
export type ContractProducer = (order: Order, cache: PipelineCache) => Promise<ProducedContract | null>;

export interface EnsureFrozenVisualContractDeps {
  /** Override the contract source (tests). Default: bank-artifact load, else dynamic compile. */
  produce?: ContractProducer;
  /** Override the delivery-input barrier (tests). Default: the real `withDeliveryInputMutation`. */
  withMutation?: WithDeliveryInputMutation;
  /** Prisma client (tests). Default: the shared client. */
  db?: PrismaClient;
}

/** Bank stories carry a `selectionFilename`; the artifact key is that filename without the `.md` suffix. */
function bankStoryKey(cache: PipelineCache): string | null {
  const name = cache.selectionFilename?.trim();
  if (!name) return null;
  return name.replace(/\.md$/i, '');
}

/** Absolute dir the bank story's `<key>.visual-contract.json` artifact lives in (pairs with the story bank dir). */
function bankArtifactDir(cache: PipelineCache): string {
  return path.join(process.cwd(), 'story-bank', cache.storyDir ?? STORY_BANK_V3_DIR_NAME);
}

/** Assemble the finalized full-story text from persisted book pages (for dynamic compile). */
async function loadFinalizedStoryText(
  db: PrismaClient,
  orderId: string,
): Promise<{ text: string; pageCount: number } | null> {
  const book = await db.generatedBook.findUnique({
    where: { orderId },
    select: { pages: { orderBy: { pageNumber: 'asc' }, select: { text: true } } },
  });
  if (!book || book.pages.length === 0) return null;
  const text = book.pages.map((p) => p.text ?? '').join('\n\n').trim();
  if (!text) return null;
  return { text, pageCount: book.pages.length };
}

/** Default producer: bank artifact (no LLM) → else dynamic compile from the finalized text. */
async function defaultProduceContract(
  order: Order,
  cache: PipelineCache,
  db: PrismaClient,
): Promise<ProducedContract | null> {
  const bankKey = bankStoryKey(cache);
  if (bankKey) {
    // Bank story: load the approved artifact — NO LLM on the customer path. Missing artifact → skip (WS0c
    // authors the 18 artifacts; until then the freeze is a no-op and behavior is legacy).
    return loadVisualContractArtifact(bankArtifactDir(cache), bankKey);
  }
  // Dynamic story: compile once from the finalized text (fail-closed validation is inside the compiler).
  const finalized = await loadFinalizedStoryText(db, order.id);
  if (!finalized) return null;
  const contract = await compileBookVisualContract({
    fullStoryText: finalized.text,
    pageCount: cache.expectedPageCount ?? finalized.pageCount,
    childName: order.childName,
    childGender: order.childGender ?? undefined,
  });
  return { contract, contractHash: computeVisualContractHash(contract) };
}

/**
 * Freeze the BookVisualContract for `order` if it isn't already, returning the (possibly updated) cache. A no-op
 * — returning the input cache unchanged — when the flag is off, the contract is already frozen, or no contract is
 * available. NEVER throws into the pipeline: a produce failure is logged and skipped (WS0b is non-blocking).
 */
export async function ensureFrozenVisualContract(
  order: Order,
  cache: PipelineCache,
  deps: EnsureFrozenVisualContractDeps = {},
): Promise<PipelineCache> {
  if (!isVisualContractFreezeEnabled()) return cache; // flag OFF → byte-identical no-op
  // Already produced + bound + cached → nothing to do (cheap resume fast-path: no LLM, no write, no fence).
  if (order.visualContractHash && cache.visualContract) return cache;

  const db = deps.db ?? (await import('@/lib/prisma')).prisma;
  const produce = deps.produce ?? ((o, c) => defaultProduceContract(o, c, db));
  const withMutation = deps.withMutation ?? (await import('./readiness-manifest')).withDeliveryInputMutation;

  let produced: ProducedContract | null;
  try {
    produced = await produce(order, cache);
  } catch (err) {
    // Non-blocking in WS0b: a missing bank artifact is EXPECTED (WS0c authors them) — skip quietly. Any OTHER
    // failure is also skipped (legacy path) but warned so QA sees it. The blocking gate is WS1, not this freeze.
    if (!(err instanceof MissingContractArtifactError)) {
      log.warn('Visual-contract produce failed — skipping freeze (legacy path)', {
        orderId: order.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return cache;
  }
  if (!produced) return cache; // no contract available → skip (legacy)

  const { contract, contractHash } = produced;
  const nextCache: PipelineCache = {
    ...cache,
    // Stored as opaque JSON on PipelineCache (see the field's note); the value IS this BookVisualContract.
    visualContract: contract as unknown as Prisma.InputJsonValue,
  };

  await withMutation(
    db,
    {
      orderId: order.id,
      reason: 'visual_contract_frozen',
      // operationKey embeds the contract hash → a re-freeze of the SAME contract replays through the receipt
      // fence (no double inputVersion bump); a genuinely different contract is a NEW key (a new freeze).
      operationKey: `delivery_input:${order.id}:visual_contract:${contractHash}`,
      // Covers 100% of what this operation authoritatively persists.
      mutationPayload: { visualContractHash: contractHash, visualContract: contract } as unknown as ReceiptSafeValue,
    },
    async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { visualContractHash: contractHash } });
      await tx.generationJob.update({
        where: { orderId: order.id },
        data: { pipelineCache: nextCache as Prisma.InputJsonValue },
      });
    },
  );

  return nextCache;
}
