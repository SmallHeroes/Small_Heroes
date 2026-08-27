import type { Order, PrismaClient } from '@prisma/client';
import { sendBookReadyEmail } from '@/backend/lib/email';
import { listenUrlFromReadUrl } from '@/lib/routes';
import { createLogger } from '@/lib/logger';
import { deriveAnchorDeliveryDisposition } from '@/lib/anchor-resemblance-gate';
import { buildQaWarningsFromAnchorHold, canUseQaSoftDeliver } from '@/lib/qa-soft-deliver';
import {
  commitBaseBookReadiness,
  isReadinessManifestEnabled,
  executeReadinessShipCas,
  type CommitResult,
} from './readiness-manifest';
import { writeOrderHoldFenced, type HoldWriteResult } from './order-authority';
import { resolveSafetyDeliveryGate, type SafetyDeliveryGate } from './safety-delivery-gate';
import { resolveActiveRecoveryCaseInTx } from '@/lib/generation-chunked/exception-case';
import { syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';
import {
  DeliverySnapshotIdentityError,
  OrderVisualPackageAuthorityError,
  orderPackageIdentity,
  requireConsistentProducingIdentity,
} from './order-visual-package-authority';

const log = createLogger({ subsystem: 'package-delivery' });

export type SafetyStatus = 'safe' | 'hazard' | 'unverified';
/**
 * (Stage 1 FIX) The safety check reached a POSITIVE determination (safe or hazard) → verified. Absent / 'unverified'
 * → false (fail-closed: an image whose safety could not be confirmed is never treated as verified-safe).
 */
export function isSafetyVerified(status: SafetyStatus | null | undefined): boolean {
  return status === 'safe' || status === 'hazard';
}

/**
 * (Fix 1) The READINESS-INDEPENDENT physical-safety gate for the whole book. The ONE implementation now lives in
 * `safety-delivery-gate.ts` (a pure evaluator + its DB load), re-exported here so existing callers are unchanged. The
 * in-tx false-positive release recompute (safety-release) shares that same evaluator — so the marker the release moves
 * is only ever cleared when the gate that PRODUCES it agrees. (2a-2 re-gate P1.)
 */
export { resolveSafetyDeliveryGate };
export type { SafetyDeliveryGate };

export interface PackageDeliveryResult {
  mode: 'legacy' | 'manifest' | 'safety_hold' | 'authority_hold';
  deliveryHeld: boolean;
  manifest: CommitResult | null;
}

/**
 * (Codex round-5 finding 3) An authority/safety/anchor PARK lost its hold write — writeOrderHoldFenced returned
 * `input_drift` or `lost`, meaning NO hold landed (the inputs moved, or the fence churned past the retry budget).
 * The park transaction rolls back with this error so the job is NEVER marked done/packaged without a durable
 * terminal disposition; the chunk runner's standard failure path (job failed + retryable + infra_transient case)
 * then owns the redrive, which re-evaluates everything FRESH. Never reported as an applied hold.
 */
export class AuthorityHoldRaceError extends Error {
  constructor(
    readonly orderId: string,
    readonly holdResult: HoldWriteResult,
    readonly holdMarker: string,
  ) {
    super(`[package-delivery] hold write lost the race (${holdResult}) for ${holdMarker} on ${orderId}`);
    this.name = 'AuthorityHoldRaceError';
  }
}

interface PackageDeliveryDeps {
  readinessEnabled?: () => boolean;
  commit?: typeof commitBaseBookReadiness;
  send?: typeof sendBookReadyEmail;
  now?: () => Date;
}

/**
 * Finalize package delivery at the single package boundary.
 * Flag-on: Manifest + readiness + Outbox only; never a direct email.
 * Flag-off: preserve the legacy status/job/direct-email behavior exactly.
 *
 * (Codex round-5) THE TOTAL SNAPSHOT INVARIANT lives here and in the readiness commit, identically:
 *   - IDENTITY: the caller's snapshot identity (exact package revision, or legacy) must equal the
 *     authoritative fresh row + producing snapshot identity (`requireConsistentProducingIdentity`).
 *     A≠B, package↔legacy in both directions, and an invalid caller snapshot all hard-hold.
 *   - DISPOSITION: the anchor delivery disposition is DERIVED from the fresh producing snapshot
 *     (`pipelineCache.childAnchorLowConfidence`), never accepted from the caller — a stale caller
 *     gate can never say "allow" over a fresh hard_band. The OFF ship CAS additionally binds the
 *     observed disposition source, and the readiness commit re-derives inside its own load.
 */
export async function finalizePackageDelivery(
  prisma: PrismaClient,
  args: {
    order: Pick<
      Order,
      | 'id'
      | 'customerEmail'
      | 'customerName'
      | 'childName'
      | 'selectionFilename'
      | 'storySourceHash'
      | 'illustrationStyle'
      | 'visualPackageAuthority'
    >;
    /** (Fix 1) The readiness-INDEPENDENT physical-safety gate (resolveSafetyDeliveryGate). Blocks BEFORE anything else. */
    safetyGate: SafetyDeliveryGate;
    readUrl: string;
    /** Book cover for the email hero (from the caller's book scope). Optional → graceful no-cover. */
    coverImageUrl?: string | null;
    pdfUrl: string | null;
    firstAudioUrl: string | null;
  },
  deps: PackageDeliveryDeps = {},
): Promise<PackageDeliveryResult> {
  const completedAt = deps.now?.() ?? new Date();

  /**
   * (Codex round-5 finding 3) Result-checked terminal park through the shared funnel. `applied` and
   * `superseded` are both DURABLE terminal dispositions (superseded = a STRONGER marker already
   * governs — never overwritten, and the recovery-case cleanup is left to that marker's owner);
   * `input_drift`/`lost` mean NO hold landed → throw, rolling back the surrounding transaction so
   * the job is never marked done without a disposition.
   */
  const writeTerminalParkOrThrow = async (
    db: Parameters<typeof writeOrderHoldFenced>[0],
    p: Parameters<typeof writeOrderHoldFenced>[1],
  ): Promise<Extract<HoldWriteResult, 'applied' | 'superseded'>> => {
    const held = await writeOrderHoldFenced(db, p);
    if (held === 'input_drift' || held === 'lost') {
      throw new AuthorityHoldRaceError(p.orderId, held, p.newHoldReason);
    }
    return held;
  };

  // (Fix 1) UNCONDITIONAL, readiness-INDEPENDENT physical-safety gate — evaluated BEFORE choosing manifest-vs-legacy.
  // A confirmed hazard OR an unconfirmed-safe artifact blocks `ready` + email on EVERY paid path (including the
  // legacy path that runs in Production with readiness OFF). Parked at needs_human_qa with the distinct `safety_hold:`
  // marker (start.ts refuses to redrive it). This is the guarantee: an unsafe/unverified image never delivers.
  if (args.safetyGate.held) {
    await prisma.$transaction(async (tx) => {
      // (Codex round-5 Unit 2) The safety hard-hold goes through the shared funnel: bind + bump + precedence. Safety
      // is rank 3 (top) so it always overwrites a weaker marker; the fence bump is atomic with the hold write.
      const held = await writeTerminalParkOrThrow(tx, {
        orderId: args.order.id,
        newStatus: 'needs_human_qa',
        newHoldReason: args.safetyGate.reason ?? 'safety_hold:held',
        setPackageDone: true,
      });
      await tx.generationJob.update({
        where: { orderId: args.order.id },
        data: { status: 'done', currentStage: 'done', completedAt, packaged: true },
      });
      // (Fix 5) Mirror the readiness-commit hard-hold park: RESOLVE any active recoverable case so a stale,
      // budget-exhausted infra_transient/integrity case can never auto-REFUND a book that must stay parked for
      // human QA (a safety hold is never auto-redriven AND never auto-refunded). On `superseded` the stronger
      // marker's own writer manages the case lifecycle — never touched from here.
      if (held === 'applied') {
        await resolveActiveRecoveryCaseInTx(tx, {
          orderId: args.order.id,
          kinds: ['infra_transient', 'integrity_blocked'],
          reason: `safety_parked:${args.safetyGate.reason ?? 'held'}`,
          now: completedAt,
        });
      }
    });
    // (Human-QA Slice 1, re-gate P0-1) POST-COMMIT: open the safety review case in its OWN tx. NEVER inside the
    // safety-park tx — a case-write rejection there would roll back the park itself (an unheld unsafe book = a
    // safety regression). Best-effort; the reconciler is the guaranteed repair for a missed write.
    await syncHumanQaHoldCasePostCommit(prisma, args.order.id);
    log.warn('Book-ready email withheld — physical-safety hard hold (readiness-independent)', {
      orderId: args.order.id,
      reason: args.safetyGate.reason,
    });
    return { mode: 'safety_hold', deliveryHeld: true, manifest: null };
  }

  // (Codex round-5) Caller-identity leg of the total snapshot invariant, computed ONCE for both
  // branches: the EXACT delivery identity of the caller's snapshot — its package revision digest,
  // or null for a genuinely legacy caller. An INVALID caller snapshot (mixed/malformed) can never
  // be granted an identity and always parks.
  let callerPackageRevisionDigest: string | null;
  try {
    callerPackageRevisionDigest = orderPackageIdentity(args.order);
  } catch (error) {
    if (!(error instanceof OrderVisualPackageAuthorityError)) throw error;
    return parkAuthorityHold(
      prisma,
      args.order.id,
      null,
      completedAt,
      'contract_world_hold:visual_package_authority_invalid',
      error,
      writeTerminalParkOrThrow,
    );
  }

  const readinessEnabled = deps.readinessEnabled ?? isReadinessManifestEnabled;
  if (readinessEnabled()) {
    const commit = deps.commit ?? commitBaseBookReadiness;
    // (Codex round-5) The commit derives the anchor/delivery disposition from ITS OWN fresh load of
    // the producing snapshot — no caller-supplied gate is accepted — and proves the identity leg
    // against this caller digest in-decision.
    const manifest = await commit(prisma, {
      orderId: args.order.id,
      callerPackageRevisionDigest,
    });
    // (Human-QA Slice 1, re-gate P0-1) POST-COMMIT: reconcile the review case AFTER commitBaseBookReadiness commits
    // its readiness tx. Opens an anchor case when the manifest parked for anchor QA; resolves it on a ready outcome.
    // Best-effort in its own tx — the reconciler repairs a missed write.
    await syncHumanQaHoldCasePostCommit(prisma, args.order.id);
    return {
      mode: 'manifest',
      deliveryHeld: manifest.orderStatus !== 'ready',
      manifest,
    };
  }

  // (Codex round-5 P0-2) The legacy (readiness OFF) path is the LIVE customer delivery path in Production. Its
  // writes are now fence-bound CAS writes — a hold that landed after safetyGate was read cannot be silently
  // overwritten, and the email is gated on the ship CAS winning. Read fence + inputVersion to bind the CAS.
  const cur = await prisma.order.findUnique({
    where: { id: args.order.id },
    select: {
      inputVersion: true,
      deliveryFenceVersion: true,
      selectionFilename: true,
      storySourceHash: true,
      illustrationStyle: true,
      visualPackageAuthority: true,
      visualContractHash: true,
      coverImageUrl: true,
      generationJob: { select: { pipelineCache: true } },
      book: {
        select: {
          readUrl: true,
          coverImageUrl: true,
          pdfUrl: true,
          pages: {
            orderBy: { pageNumber: 'asc' as const },
            select: { audioUrl: true },
          },
        },
      },
    },
  });
  // Durable identity + producing-snapshot gate — readiness-INDEPENDENT, like the safety gate above,
  // and evaluated on the SAME FRESH row the ship CAS binds (never the caller's stale `args.order`
  // snapshot). Beyond the fresh row's own validity, the caller's snapshot identity must BE the fresh
  // producing identity (exact package revision, or legacy — both directions), and a package-backed
  // Order must prove the artifacts being shipped were PRODUCED under this exact authority. The
  // caller-supplied readUrl/cover/pdf/audio payload must also equal the fresh Book row, so the email
  // can only carry that same snapshot's artifacts. Post-read races are closed by the CAS's
  // inputVersion binding plus (round-5) the producing anchor-disposition bind. The readiness-ON
  // branch re-proves the same predicates inside its own TOCTOU-fingerprinted transaction.
  const producingCacheOf = (row: typeof cur): unknown =>
    row?.generationJob?.pipelineCache ?? null;
  if (cur) {
    let freshPackageBacked = false;
    try {
      freshPackageBacked =
        requireConsistentProducingIdentity({
          callerPackageRevisionDigest,
          order: cur,
          pipelineCache: producingCacheOf(cur),
        }) !== null;
    } catch (error) {
      if (!(error instanceof OrderVisualPackageAuthorityError)) throw error;
      return parkAuthorityHold(
        prisma,
        args.order.id,
        cur.inputVersion,
        completedAt,
        error instanceof DeliverySnapshotIdentityError
          ? 'contract_world_hold:delivery_snapshot_binding_invalid'
          : 'contract_world_hold:visual_package_authority_invalid',
        error,
        writeTerminalParkOrThrow,
      );
    }
    if (freshPackageBacked) {
      // Payload ↔ fresh-snapshot binding: the email may only carry the exact
      // artifacts of the row the gate just validated. The cover keeps the
      // caller's book-then-order fallback; every field is byte-compared.
      const freshFirstAudio =
        cur.book?.pages.find((page) => page.audioUrl?.trim())?.audioUrl ?? null;
      const expectedCover = cur.book?.coverImageUrl ?? cur.coverImageUrl ?? null;
      const payloadMismatches: string[] = [];
      if (args.readUrl !== (cur.book?.readUrl ?? null)) {
        payloadMismatches.push('readUrl');
      }
      if ((args.coverImageUrl ?? null) !== expectedCover) {
        payloadMismatches.push('coverImageUrl');
      }
      if ((args.pdfUrl ?? null) !== (cur.book?.pdfUrl ?? null)) {
        payloadMismatches.push('pdfUrl');
      }
      if ((args.firstAudioUrl ?? null) !== freshFirstAudio) {
        payloadMismatches.push('firstAudioUrl');
      }
      if (payloadMismatches.length > 0) {
        return parkAuthorityHold(
          prisma,
          args.order.id,
          cur.inputVersion,
          completedAt,
          'contract_world_hold:delivery_snapshot_binding_invalid',
          new Error(
            `delivery payload diverges from the fresh Book snapshot: ${payloadMismatches.join(', ')}`,
          ),
          writeTerminalParkOrThrow,
        );
      }
    }
  }

  // (Codex round-5) The anchor delivery DISPOSITION — derived from the authoritative fresh
  // producing snapshot, never from a caller gate. A vanished row derives from null (fail-open is
  // impossible: the ship CAS below matches zero rows for a missing order anyway).
  const { gate: freshGate, lowConfidence: freshLowConfidence } =
    deriveAnchorDeliveryDisposition(producingCacheOf(cur));
  const softDeliver = canUseQaSoftDeliver();
  const legacySoftDeliver = softDeliver && freshGate.held;
  const legacyStatus = legacySoftDeliver ? 'ready' : freshGate.orderStatus;
  const legacyHoldReason = legacySoftDeliver
    ? `qa_soft_deliver:${freshGate.reason ?? 'held'}`
    : freshGate.reason;

  let shipped = false;
  if (!cur) {
    log.error('Legacy delivery aborted — order vanished before the package write', { orderId: args.order.id });
  } else if (legacyStatus === 'ready') {
    // SHIP via the shared ready CAS: flips to ready ONLY IF no competing hold (fence unchanged, no terminal marker,
    // no payment fence, no active strong case) AND (round-5) the producing snapshot still carries the exact
    // anchor-disposition source this ship was derived from. 0 rows ⇒ a hold/flip landed mid-flight ⇒ NOT shipped,
    // NO email.
    const producingCache = producingCacheOf(cur);
    const observedAnchorSource =
      producingCache && typeof producingCache === 'object' && !Array.isArray(producingCache)
        ? ((producingCache as Record<string, unknown>).childAnchorLowConfidence ?? null)
        : null;
    const rows = await executeReadinessShipCas(prisma, {
      orderId: args.order.id,
      inputVersion: cur.inputVersion,
      deliveryFenceVersion: cur.deliveryFenceVersion,
      deliveryHoldReason: legacyHoldReason,
      producingAnchorBind: { childAnchorLowConfidence: observedAnchorSource },
    });
    shipped = rows === 1;
    if (!shipped) {
      log.warn('Legacy ship aborted — a hold landed mid-flight (fence/marker/case/anchor-source); not shipped, no email', {
        orderId: args.order.id,
      });
    }
  } else {
    // PARK via the shared hold funnel (bind + bump + never overwrite a stronger marker), result-checked:
    // a lost/drifted hold write must never fall through to the job-done write below.
    await writeTerminalParkOrThrow(prisma, {
      orderId: args.order.id,
      inputVersion: cur.inputVersion,
      newStatus: legacyStatus,
      newHoldReason: legacyHoldReason ?? 'anchor_low_confidence:held',
      setPackageDone: true,
    });
  }
  await prisma.generationJob.update({
    where: { orderId: args.order.id },
    data: {
      status: 'done',
      currentStage: 'done',
      completedAt,
      packaged: true,
    },
  });
  // POST-COMMIT: open the anchor review case in its own tx when this legacy path parked for anchor QA. A
  // soft-deliver/ready outcome is not held, so syncHumanQaHoldCase re-reads and no-ops.
  await syncHumanQaHoldCasePostCommit(prisma, args.order.id);

  // (Codex round-5 P0-2) The email is gated on the ship CAS having WON — never sent on a park, and never sent when
  // the CAS lost to a mid-flight hold.
  if (!shipped) {
    log.warn('Book-ready email withheld — not shipped (held for human QA or a hold landed mid-flight)', {
      orderId: args.order.id,
      reason: freshGate.reason,
    });
  } else {
    try {
      const send = deps.send ?? sendBookReadyEmail;
      await send({
        to: args.order.customerEmail,
        customerName: args.order.customerName ?? args.order.childName,
        childName: args.order.childName,
        readUrl: args.readUrl,
        ...(listenUrlFromReadUrl(args.readUrl, args.order.id) ? { listenUrl: listenUrlFromReadUrl(args.readUrl, args.order.id) } : {}),
        ...(args.coverImageUrl ? { coverImageUrl: args.coverImageUrl } : {}),
        audioUrl: args.firstAudioUrl ?? undefined,
        pdfUrl: args.pdfUrl ?? undefined,
        ...(legacySoftDeliver
          ? {
              qaWarnings: buildQaWarningsFromAnchorHold(
                freshLowConfidence,
                freshGate.reason,
              ),
            }
          : {}),
      });
    } catch (error) {
      log.error('Ready email failed (non-fatal)', error, { orderId: args.order.id });
    }
  }

  return {
    mode: 'legacy',
    deliveryHeld: !shipped,
    manifest: null,
  };
}

/**
 * Terminal authority park through the shared funnel, result-checked (round-5 finding 3): the job is
 * marked done/packaged only when a durable terminal disposition exists — either this park applied,
 * or a STRONGER marker already governs (`superseded`, whose owner keeps its own case lifecycle). A
 * lost/drifted hold write aborts the whole transaction via AuthorityHoldRaceError.
 */
async function parkAuthorityHold(
  prisma: PrismaClient,
  orderId: string,
  observedInputVersion: number | null,
  completedAt: Date,
  holdMarker: string,
  error: unknown,
  writeTerminalParkOrThrow: (
    db: Parameters<typeof writeOrderHoldFenced>[0],
    p: Parameters<typeof writeOrderHoldFenced>[1],
  ) => Promise<Extract<HoldWriteResult, 'applied' | 'superseded'>>,
): Promise<PackageDeliveryResult> {
  await prisma.$transaction(async (tx) => {
    const held = await writeTerminalParkOrThrow(tx, {
      orderId,
      ...(observedInputVersion !== null ? { inputVersion: observedInputVersion } : {}),
      newStatus: 'needs_human_qa',
      newHoldReason: holdMarker,
      setPackageDone: true,
    });
    await tx.generationJob.update({
      where: { orderId },
      data: { status: 'done', currentStage: 'done', completedAt, packaged: true },
    });
    // Mirror the safety park: never let a stale recoverable case auto-refund
    // or auto-redrive a book that must stay parked for human QA. On
    // `superseded` the stronger marker's owner manages the case lifecycle.
    if (held === 'applied') {
      await resolveActiveRecoveryCaseInTx(tx, {
        orderId,
        kinds: ['infra_transient', 'integrity_blocked'],
        reason: `authority_parked:${holdMarker.split(':').pop()}`,
        now: completedAt,
      });
    }
  });
  await syncHumanQaHoldCasePostCommit(prisma, orderId);
  log.error(
    'Book-ready delivery withheld — total snapshot invariant failed (readiness-independent)',
    error,
    { orderId, holdMarker },
  );
  return { mode: 'authority_hold', deliveryHeld: true, manifest: null };
}
