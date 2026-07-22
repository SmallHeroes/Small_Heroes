/**
 * ensureFrozenVisualContract — PRODUCE → FREEZE → BIND the BookVisualContract before spend.
 *
 * Runs after text-finalization + DNA and BEFORE the cover (and, idempotently, on every resume before any paid
 * image). It:
 *   1. PRODUCES the contract — enforced Style01 materializes the exact approved local template; the legacy
 *      development path retains its historical artifact/dormant dynamic-compiler behavior.
 *   2. FREEZES it atomically via the EXISTING `withDeliveryInputMutation` barrier: stamps `Order.visualContractHash`
 *      and persists the full contract into `pipelineCache.visualContract` in ONE transaction. The `operationKey`
 *      INCLUDES the contract hash, so a re-freeze of the same contract hits the receipt fence and REPLAYS (the
 *      mutation is never re-applied → NO second `inputVersion` bump; `AtomicOperationReceipt` is untouched — this
 *      module only CALLS the barrier).
 *
 * Dual posture:
 *   - Enforcement OFF: `VISUAL_CONTRACT_FREEZE` remains best-effort and byte-identical when off; missing/invalid
 *     legacy artifacts still degrade to the explicitly documented development path.
 *   - Enforced non-production Style01: enforcement implies freeze, only the exact render-qualified local package
 *     template is materialized/source-bound, and every failure propagates before image spend. No live authoring or
 *     compiler call is reachable on this branch. Vercel production remains hard-off.
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
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import {
  loadVisualContractArtifact,
  tryLoadVisualContractTemplateArtifact,
  MissingContractArtifactError,
} from '@/lib/visual-contract-compiler/contractArtifact';
import { materialize } from '@/lib/visual-contract-compiler/materializeContract';
import {
  assertValidResolvedBookVisualContract,
  validateResolvedBookVisualContract,
} from '@/lib/visual-contract-compiler/validateResolvedContract';
import {
  isVisualContractEnforcementEnabled,
  isVisualContractFreezeEnabled,
} from '@/lib/visual-contract-compiler/contractRenderGuards';
import { readFrozenVisualContract } from '@/lib/visual-contract-compiler/readFrozenVisualContract';
import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';
import type { ResolvedBookVisualContract } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { STYLE_IDS, styleIdFromDatabaseValue } from '@/lib/styles';
import { bindApprovedRuntimeAuthority } from '@/lib/visual-package/runtimeAuthority';
import type { ReceiptSafeValue } from './atomic-operation';
import {
  evaluateStyle01VisualPackage,
  RenderQualificationPreflightError,
} from './render-qualification-preflight';
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

/**
 * (C1) Whether the DEFAULT producer compiles a contract for DYNAMIC (non-bank) stories on the live freeze path.
 * DORMANT (false) for launch: the dynamic compiler supplies no companion / no per-page image directions and isn't
 * crash-safe compile-once, so dynamic stories stay on the legacy path. Retained (not deleted, and kept reachable +
 * type-checked) so a future SAFE design — or a precompiled dynamic artifact — flips this ONE gate; the compiler
 * module itself is untouched. `as boolean` keeps the dormant branch reachable so it type-checks.
 */
const ENABLE_DYNAMIC_CONTRACT_COMPILE = false as boolean;

/** Default producer: bank artifact (no LLM). Dynamic (non-bank) stories are DORMANT (C1) → null (legacy path). */
async function defaultProduceContract(
  order: Order,
  cache: PipelineCache,
  db: PrismaClient,
): Promise<ProducedContract | null> {
  if (
    isVisualContractEnforcementEnabled() &&
    styleIdFromDatabaseValue(order.illustrationStyle) === STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK
  ) {
    const qualification = evaluateStyle01VisualPackage({
      illustrationStyle: order.illustrationStyle,
      cache,
    });
    if (!qualification || !qualification.renderQualified || !qualification.manifest || !qualification.template) {
      throw new RenderQualificationPreflightError(
        qualification ?? {
          storyKey: bankStoryKey(cache) ?? 'unknown_story',
          storySourcePath: cache.storyFilePath ?? cache.selectionFilename ?? 'unknown',
          approvedPackagePath: 'unknown',
          renderQualified: false,
          reasons: [{ code: 'approved_package_missing', message: 'approved Style01 package is unavailable' }],
          manifest: null,
          template: null,
        },
      );
    }
    const { deriveResolvedFamilyAppearanceProfile } = await import('./resolve-family-appearance');
    const family = deriveResolvedFamilyAppearanceProfile(order, cache);
    const resolved = materialize(qualification.template, family);
    const bound = bindApprovedRuntimeAuthority(
      resolved as ResolvedBookVisualContract,
      qualification.manifest,
    );
    assertValidResolvedBookVisualContract(bound);
    return { contract: bound, contractHash: computeVisualContractHash(bound) };
  }

  const bankKey = bankStoryKey(cache);
  if (bankKey) {
    const dir = bankArtifactDir(cache);
    // (P0) PREFER a story TEMPLATE → materialize a per-order RESOLVED contract (concrete human skin/hair/style). A
    // MISSING template cleanly falls back to the legacy vNext artifact; a present-but-INVALID template, a missing
    // family input, or any resolution gap THROWS (fail-closed — never a silent partial). The RESOLVED (not the
    // Template) is what the caller freezes/hashes.
    const templateLoaded = tryLoadVisualContractTemplateArtifact(dir, bankKey);
    if (templateLoaded) {
      const { deriveResolvedFamilyAppearanceProfile } = await import('./resolve-family-appearance');
      const family = deriveResolvedFamilyAppearanceProfile(order, cache); // fail-closed on missing family input
      const resolved = materialize(templateLoaded.template, family); // fail-closed on any resolution gap
      // (Fix 1) Validate the materialized Resolved BEFORE it is hashed/frozen/persisted. The materializer is fail-closed
      // on resolution GAPS, but the Resolved validator is the authoritative gate (origin-payload completeness,
      // mode/origin coherence, family_profile relatives-only, garment-explicit, palette-version + projection equality).
      // A throw here is caught by ensureFrozenVisualContract's WS0b guard → the freeze is skipped (legacy path); an
      // invalid Resolved is NEVER hashed or persisted.
      assertValidResolvedBookVisualContract(resolved);
      return { contract: resolved, contractHash: computeVisualContractHash(resolved) };
    }
    // No template yet: load the approved legacy artifact — NO LLM on the customer path. Missing artifact → skip.
    return loadVisualContractArtifact(dir, bankKey);
  }
  // (C1) Non-bank/dynamic → stay on the LEGACY path (no runtime freeze) for launch. Returning null →
  // ensureFrozenVisualContract no-ops → byte-identical. The dynamic compile below is retained but DORMANT behind
  // this gate: kept reachable + type-checked so a future SAFE design flips the one gate above.
  if (!ENABLE_DYNAMIC_CONTRACT_COMPILE) return null;
  const finalized = await loadFinalizedStoryText(db, order.id);
  if (!finalized) return null;
  const { compileBookVisualContract } = await import(
    '@/lib/visual-contract-compiler/compileBookVisualContract'
  );
  const contract = await compileBookVisualContract({
    fullStoryText: finalized.text,
    pageCount: cache.expectedPageCount ?? finalized.pageCount,
    childName: order.childName,
    childGender: order.childGender ?? undefined,
  });
  return { contract, contractHash: computeVisualContractHash(contract) };
}

/**
 * Freeze the BookVisualContract for `order` if it isn't already. The legacy freeze flag remains best-effort and
 * non-blocking; enforced non-production Style01 deliberately propagates authority failures before image spend.
 */
export async function ensureFrozenVisualContract(
  order: Order,
  cache: PipelineCache,
  deps: EnsureFrozenVisualContractDeps = {},
): Promise<PipelineCache> {
  const runtimeAuthorityEnforced =
    isVisualContractEnforcementEnabled() &&
    styleIdFromDatabaseValue(order.illustrationStyle) === STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
  if (!isVisualContractFreezeEnabled() && !runtimeAuthorityEnforced) return cache;
  // Already produced + bound + cached → nothing to do (cheap resume fast-path: no LLM, no write, no fence). But ONLY
  // when the cached contract's hash MATCHES the Order stamp — a mismatched pair (a partial/failed prior freeze that
  // stamped the Order but left a stale/absent cache contract, or vice versa) must NOT be accepted as done; fall
  // through and re-freeze to reconcile. (B2: verify the pair, don't trust mere presence.)
  if (order.visualContractHash && cache.visualContract) {
    const cached = readFrozenVisualContract(cache.visualContract);
    if (cached && computeVisualContractHash(cached) === order.visualContractHash) return cache;
    // mismatch or invalid cached contract → re-freeze (fall through, do not return)
  }

  const db = deps.db ?? (await import('@/lib/prisma')).prisma;
  const produce = deps.produce ?? ((o, c) => defaultProduceContract(o, c, db));
  const withMutation = deps.withMutation ?? (await import('./readiness-manifest')).withDeliveryInputMutation;

  let produced: ProducedContract | null;
  try {
    produced = await produce(order, cache);
  } catch (err) {
    if (runtimeAuthorityEnforced) throw err;
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
  if (!produced) {
    if (runtimeAuthorityEnforced) {
      throw new Error('[runtime_world_authority] enforced Style01 path produced no frozen contract');
    }
    return cache;
  }

  const { contract, contractHash } = produced;
  // (Fix 1 — belt, before :persist) Defense-in-depth on the money fence: never hash/persist a resolved-shaped contract
  // that fails validation, whatever producer yielded it. Non-throwing (WS0b must NEVER throw into the pipeline) — an
  // invalid Resolved is logged and degrades to the legacy path rather than being frozen. Legacy vNext contracts (no
  // `contractKind: 'resolved'`) are unaffected; they were already fail-closed validated on their own load path.
  if ((contract as { contractKind?: unknown }).contractKind === 'resolved') {
    const check = validateResolvedBookVisualContract(contract);
    if (!check.ok) {
      if (runtimeAuthorityEnforced) {
        throw new Error(`[runtime_world_authority] invalid resolved contract: ${check.errors.join('; ')}`);
      }
      log.warn('Refusing to freeze an invalid Resolved contract — skipping freeze (legacy path)', {
        orderId: order.id,
        errors: check.errors,
      });
      return cache;
    }
  }
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
      // (B2) Write ONLY the `visualContract` key, atomically, via jsonb_set — NEVER the whole in-memory pipelineCache
      // snapshot. The receipt fence guards the operationKey, not the GenerationJob row (runFenced locks only
      // AtomicOperationReceipt), and a plain findUnique here would NOT emit FOR UPDATE — so a read-merge would race a
      // concurrent (non-freeze) pipelineCache writer. A single-key jsonb_set has NO read-window: it reads + sets the
      // one key inside one row-locked UPDATE, so a lost-lease late freeze can never clobber newer unrelated fields.
      // The write now covers EXACTLY the mutationPayload ({ visualContractHash, visualContract }).
      await tx.$executeRaw`
        UPDATE "GenerationJob"
        SET "pipelineCache" = jsonb_set(COALESCE("pipelineCache", '{}'::jsonb), '{visualContract}', ${JSON.stringify(contract)}::jsonb, true)
        WHERE "orderId" = ${order.id}
      `;
    },
  );

  // Keep this invocation's in-memory Order stamp aligned with the atomic write. Shipped preflights compare the
  // persisted-authority stamp before provider entry; this assignment occurs only after the mutation/replay succeeds.
  order.visualContractHash = contractHash;
  return nextCache;
}
