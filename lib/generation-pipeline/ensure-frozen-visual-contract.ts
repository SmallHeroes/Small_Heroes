/**
 * ensureFrozenVisualContract — PRODUCE → FREEZE → BIND the BookVisualContract before spend.
 *
 * Runs after text-finalization + DNA and BEFORE the cover (and, idempotently, on every resume before any paid
 * image). It:
 *   1. PRODUCES the contract — enforced Style01 materializes the exact approved local template; the legacy
 *      development path can load only checked-in artifacts. Dynamic live compilation is not reachable.
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
 *     compiler call is reachable on this branch.
 *   - Package-backed Order: the persisted immutable package authority makes freeze mandatory in every environment,
 *     including Production and flags-off; no current locator or legacy degradation is reachable.
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
import { bindApprovedPvbRuntimeAuthority } from '@/lib/visual-package/runtimeAuthority';
import {
  InvalidVisualPackageV4Error,
  evaluateVisualPackageV4Qualification,
  type FrozenVisualPackageAuthority,
} from '@/lib/visual-package/visualPackageV4';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import type { ReceiptSafeValue } from './atomic-operation';
import { requireOrderVisualPackageAuthority } from './order-visual-package-authority';
import { runtimeStoryKey } from './story-path';
import type { PipelineCache } from './types';
// `prisma` and the delivery-input barrier are LAZY-imported inside the function (below) — so importing this
// module (and unit tests that inject both) never triggers `validateEnv()` at load. Type-only here.
type WithDeliveryInputMutation = typeof import('./readiness-manifest').withDeliveryInputMutation;

const log = createLogger({ subsystem: 'chunked-gen', route: 'visual-contract-freeze' });

/** A produced-and-hashed contract, or `null` when none is available (skip the freeze). */
export interface ProducedContract {
  contract: BookVisualContract;
  contractHash: string;
  visualPackageAuthority?: FrozenVisualPackageAuthority;
}

/** Injectable seam: yield the contract to freeze for this order, or `null` to skip. */
export type ContractProducer = (order: Order, cache: PipelineCache) => Promise<ProducedContract | null>;

export interface EnsureFrozenVisualContractDeps {
  /** Override the contract source (tests). Default: bank-artifact load, else no contract. */
  produce?: ContractProducer;
  /** Override the delivery-input barrier (tests). Default: the real `withDeliveryInputMutation`. */
  withMutation?: WithDeliveryInputMutation;
  /** Prisma client (tests). Default: the shared client. */
  db?: PrismaClient;
  /** Repository root override for hermetic immutable-package tests. */
  repoRoot?: string;
}

/** Absolute dir the bank story's `<key>.visual-contract.json` artifact lives in (pairs with the story bank dir). */
function bankArtifactDir(cache: PipelineCache): string {
  return path.join(process.cwd(), 'story-bank', cache.storyDir ?? STORY_BANK_V3_DIR_NAME);
}

/** Default producer: bank artifact (no LLM). Dynamic stories have no implicit authoring path. */
async function defaultProduceContract(
  order: Order,
  cache: PipelineCache,
  repoRoot: string,
): Promise<ProducedContract | null> {
  const orderVisualPackageAuthority =
    requireOrderVisualPackageAuthority(order);
  const styleId = styleIdFromDatabaseValue(order.illustrationStyle);
  const packageRuntimeRequired = orderVisualPackageAuthority !== null;
  if (
    packageRuntimeRequired &&
    styleId !== STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK
  ) {
    throw new InvalidVisualPackageV4Error([
      `package-backed Order style ${JSON.stringify(styleId)} has no runtime authority implementation`,
    ]);
  }
  if (
    styleId === STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK &&
    (packageRuntimeRequired || isVisualContractEnforcementEnabled())
  ) {
    const storyKey = runtimeStoryKey(cache) ?? 'unknown_story';
    const qualification = evaluateVisualPackageV4Qualification({
      repoRoot,
      storyKey,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      ...(orderVisualPackageAuthority
        ? { frozenAuthority: orderVisualPackageAuthority }
        : {}),
      expectedOrderSourceRawDigest: order.storySourceHash,
    });
    if (
      !qualification.renderQualified ||
      !qualification.packageValue ||
      !qualification.frozenAuthority
    ) {
      throw new InvalidVisualPackageV4Error(qualification.reasons);
    }
    const { deriveResolvedFamilyAppearanceProfile } = await import('./resolve-family-appearance');
    const family = deriveResolvedFamilyAppearanceProfile(order, cache);
    const resolved = materialize(
      qualification.packageValue.visualContractTemplate.content,
      family,
    );
    const bound = bindApprovedPvbRuntimeAuthority(
      resolved as ResolvedBookVisualContract,
      qualification.packageValue,
      qualification.frozenAuthority,
    );
    assertValidResolvedBookVisualContract(bound);
    return {
      contract: bound,
      contractHash: computeVisualContractHash(bound),
      visualPackageAuthority: qualification.frozenAuthority,
    };
  }

  const bankKey = runtimeStoryKey(cache);
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
  return null;
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
  const orderVisualPackageAuthority =
    requireOrderVisualPackageAuthority(order);
  const packageRuntimeRequired = orderVisualPackageAuthority !== null;
  const runtimeAuthorityEnforced =
    packageRuntimeRequired ||
    (isVisualContractEnforcementEnabled() &&
      styleIdFromDatabaseValue(order.illustrationStyle) ===
        STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK);
  if (!isVisualContractFreezeEnabled() && !runtimeAuthorityEnforced) return cache;
  // Already produced + bound + cached → nothing to do (cheap resume fast-path: no LLM, no write, no fence). But ONLY
  // when the cached contract's hash MATCHES the Order stamp — a mismatched pair (a partial/failed prior freeze that
  // stamped the Order but left a stale/absent cache contract, or vice versa) must NOT be accepted as done; fall
  // through and re-freeze to reconcile. (B2: verify the pair, don't trust mere presence.)
  if (order.visualContractHash && cache.visualContract) {
    const cached = readFrozenVisualContract(cache.visualContract);
    if (cached && computeVisualContractHash(cached) === order.visualContractHash) {
      if (!runtimeAuthorityEnforced) return cache;
      if (!cache.visualPackageAuthority) {
        throw new InvalidVisualPackageV4Error([
          'frozen order visual-package/v5 authority is missing',
        ]);
      }
      if (
        orderVisualPackageAuthority &&
        canonicalJsonDigest(cache.visualPackageAuthority) !==
          canonicalJsonDigest(orderVisualPackageAuthority)
      ) {
        throw new InvalidVisualPackageV4Error([
          'pipeline cache Visual Package authority differs from frozen Order authority',
        ]);
      }
      const frozenAuthority =
        orderVisualPackageAuthority ?? cache.visualPackageAuthority;
      const qualification = evaluateVisualPackageV4Qualification({
        repoRoot: deps.repoRoot ?? process.cwd(),
        storyKey: runtimeStoryKey(cache) ?? 'unknown_story',
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        frozenAuthority,
        expectedOrderSourceRawDigest: order.storySourceHash,
      });
      if (!qualification.renderQualified) {
        throw new InvalidVisualPackageV4Error(qualification.reasons);
      }
      return cache;
    }
    // mismatch or invalid cached contract → re-freeze (fall through, do not return)
  }

  const db = deps.db ?? (await import('@/lib/prisma')).prisma;
  const produce =
    deps.produce ??
    ((o, c) => defaultProduceContract(o, c, deps.repoRoot ?? process.cwd()));
  // Named exactly `withDeliveryInputMutation` so the lexical writer-coverage scan recognizes the barrier:
  // the callee text must end with that name for the `visualContractHash` write below to register as protected.
  const withDeliveryInputMutation =
    deps.withMutation ?? (await import('./readiness-manifest')).withDeliveryInputMutation;

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

  const { contract, contractHash, visualPackageAuthority } = produced;
  if (runtimeAuthorityEnforced && !visualPackageAuthority) {
    throw new InvalidVisualPackageV4Error([
      'enforced Style01 freeze produced no immutable visual-package/v5 authority',
    ]);
  }
  if (
    orderVisualPackageAuthority &&
    visualPackageAuthority &&
    canonicalJsonDigest(visualPackageAuthority) !==
      canonicalJsonDigest(orderVisualPackageAuthority)
  ) {
    throw new InvalidVisualPackageV4Error([
      'produced Visual Package authority differs from frozen Order authority',
    ]);
  }
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
    ...(visualPackageAuthority ? { visualPackageAuthority } : {}),
  };

  await withDeliveryInputMutation(
    db,
    {
      orderId: order.id,
      reason: 'visual_contract_frozen',
      // operationKey embeds the contract hash → a re-freeze of the SAME contract replays through the receipt
      // fence (no double inputVersion bump); a genuinely different contract is a NEW key (a new freeze).
      operationKey: `delivery_input:${order.id}:visual_contract:${contractHash}`,
      // Covers 100% of what this operation authoritatively persists.
      mutationPayload: {
        visualContractHash: contractHash,
        visualContract: contract,
        ...(visualPackageAuthority ? { visualPackageAuthority } : {}),
      } as unknown as ReceiptSafeValue,
    },
    async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { visualContractHash: contractHash } });
      // (B2) Write ONLY the `visualContract` key, atomically, via jsonb_set — NEVER the whole in-memory pipelineCache
      // snapshot. The receipt fence guards the operationKey, not the GenerationJob row (runFenced locks only
      // AtomicOperationReceipt), and a plain findUnique here would NOT emit FOR UPDATE — so a read-merge would race a
      // concurrent (non-freeze) pipelineCache writer. A single-key jsonb_set has NO read-window: it reads + sets the
      // one key inside one row-locked UPDATE, so a lost-lease late freeze can never clobber newer unrelated fields.
      // The write now covers EXACTLY the mutationPayload ({ visualContractHash, visualContract }).
      if (visualPackageAuthority) {
        await tx.$executeRaw`
          UPDATE "GenerationJob"
          SET "pipelineCache" = jsonb_set(
            jsonb_set(
              COALESCE("pipelineCache", '{}'::jsonb),
              '{visualContract}',
              ${JSON.stringify(contract)}::jsonb,
              true
            ),
            '{visualPackageAuthority}',
            ${JSON.stringify(visualPackageAuthority)}::jsonb,
            true
          )
          WHERE "orderId" = ${order.id}
        `;
      } else {
        await tx.$executeRaw`
          UPDATE "GenerationJob"
          SET "pipelineCache" = jsonb_set(COALESCE("pipelineCache", '{}'::jsonb), '{visualContract}', ${JSON.stringify(contract)}::jsonb, true)
          WHERE "orderId" = ${order.id}
        `;
      }
    },
  );

  // Keep this invocation's in-memory Order stamp aligned with the atomic write. Shipped preflights compare the
  // persisted-authority stamp before provider entry; this assignment occurs only after the mutation/replay succeeds.
  order.visualContractHash = contractHash;
  return nextCache;
}
