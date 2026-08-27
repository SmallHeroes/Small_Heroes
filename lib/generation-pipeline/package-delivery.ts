import type { Order, PrismaClient } from '@prisma/client';
import { sendBookReadyEmail } from '@/backend/lib/email';
import { listenUrlFromReadUrl } from '@/lib/routes';
import { createLogger } from '@/lib/logger';
import type { AnchorLowConfidence } from '@/lib/anchor-resemblance-gate';
import { buildQaWarningsFromAnchorHold, canUseQaSoftDeliver } from '@/lib/qa-soft-deliver';
import {
  commitBaseBookReadiness,
  isReadinessManifestEnabled,
  executeReadinessShipCas,
  type CommitResult,
} from './readiness-manifest';
import { writeOrderHoldFenced } from './order-authority';
import { resolveSafetyDeliveryGate, type SafetyDeliveryGate } from './safety-delivery-gate';
import { resolveActiveRecoveryCaseInTx } from '@/lib/generation-chunked/exception-case';
import { syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';
import {
  OrderVisualPackageAuthorityError,
  orderRequiresVisualPackageAuthority,
  requireProducingSnapshotBinding,
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

export interface PackageDeliveryGate {
  held: boolean;
  orderStatus: Order['status'];
  reason: string | null;
  sendBookReadyEmail: boolean;
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
    deliveryGate: PackageDeliveryGate;
    /** (Fix 1) The readiness-INDEPENDENT physical-safety gate (resolveSafetyDeliveryGate). Blocks BEFORE anything else. */
    safetyGate: SafetyDeliveryGate;
    readUrl: string;
    /** Book cover for the email hero (from the caller's book scope). Optional → graceful no-cover. */
    coverImageUrl?: string | null;
    pdfUrl: string | null;
    firstAudioUrl: string | null;
    anchorLowConfidence?: AnchorLowConfidence;
  },
  deps: PackageDeliveryDeps = {},
): Promise<PackageDeliveryResult> {
  // (Fix 1) UNCONDITIONAL, readiness-INDEPENDENT physical-safety gate — evaluated BEFORE choosing manifest-vs-legacy.
  // A confirmed hazard OR an unconfirmed-safe artifact blocks `ready` + email on EVERY paid path (including the
  // legacy path that runs in Production with readiness OFF). Parked at needs_human_qa with the distinct `safety_hold:`
  // marker (start.ts refuses to redrive it). This is the guarantee: an unsafe/unverified image never delivers.
  if (args.safetyGate.held) {
    const completedAt = deps.now?.() ?? new Date();
    await prisma.$transaction(async (tx) => {
      // (Codex round-5 Unit 2) The safety hard-hold goes through the shared funnel: bind + bump + precedence. Safety
      // is rank 3 (top) so it always overwrites a weaker marker; the fence bump is atomic with the hold write.
      await writeOrderHoldFenced(tx, {
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
      // human QA (a safety hold is never auto-redriven AND never auto-refunded).
      await resolveActiveRecoveryCaseInTx(tx, {
        orderId: args.order.id,
        kinds: ['infra_transient', 'integrity_blocked'],
        reason: `safety_parked:${args.safetyGate.reason ?? 'held'}`,
        now: completedAt,
      });
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

  // Caller-provenance leg of the origin matrix, computed ONCE for both branches: the CALLER'S
  // snapshot of this Order is package-shaped (accepted reference — canonical or aliased — or a
  // carried authority). A genuinely legacy delivery has a legacy caller snapshot too. On
  // readiness-ON the claim is threaded into the commit (which re-proves the fresh row + producing
  // snapshot in-tx); on readiness-OFF it is evaluated below against the fresh CAS-bound row.
  const callerVisualPackageClaim = (() => {
    try {
      return (
        orderRequiresVisualPackageAuthority(args.order) ||
        args.order.visualPackageAuthority != null
      );
    } catch {
      return true;
    }
  })();

  const readinessEnabled = deps.readinessEnabled ?? isReadinessManifestEnabled;
  if (readinessEnabled()) {
    const commit = deps.commit ?? commitBaseBookReadiness;
    const manifest = await commit(prisma, {
      orderId: args.order.id,
      anchorAllowsDelivery: args.deliveryGate.sendBookReadyEmail,
      anchorOrderStatus: args.deliveryGate.orderStatus,
      anchorReason: args.deliveryGate.reason,
      anchorLowConfidence: args.anchorLowConfidence,
      callerVisualPackageClaim,
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

  const completedAt = deps.now?.() ?? new Date();
  const softDeliver = canUseQaSoftDeliver();
  const legacySoftDeliver = softDeliver && args.deliveryGate.held;
  const legacyStatus = legacySoftDeliver ? 'ready' : args.deliveryGate.orderStatus;
  const legacyHoldReason = legacySoftDeliver
    ? `qa_soft_deliver:${args.deliveryGate.reason ?? 'held'}`
    : args.deliveryGate.reason;
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
  // Durable package-authority + producing-snapshot gate — readiness-INDEPENDENT, like the safety gate above,
  // and evaluated on the SAME FRESH row the ship CAS binds (never the caller's stale `args.order` snapshot).
  // Beyond the fresh row's own validity, a package-backed Order must prove the artifacts being shipped were
  // PRODUCED under this exact authority: the freeze-written pipeline snapshot's authority and frozen contract
  // (whose canonical hash is the Order's `visualContractHash` stamp, and whose bytes embed the producing
  // package revision) must all bind to the fresh authority — a fresh self-consistent Package B never
  // authorizes a payload rendered under Package A. The caller-supplied readUrl/cover/pdf/audio payload must
  // also equal the fresh Book row, so the email can only carry that same snapshot's artifacts. Post-read races
  // are closed by the CAS's inputVersion binding: every writer of these delivery-input fields goes through
  // withDeliveryInputMutation (writer-coverage guard) and bumps inputVersion, so a mutation after this read
  // makes the ship CAS match zero rows. The readiness-ON branch re-proves the same predicates inside its own
  // TOCTOU-fingerprinted transaction and produces the blocked-manifest evidence row instead.
  const parkAuthorityHold = async (
    holdMarker: string,
    error: unknown,
  ): Promise<PackageDeliveryResult> => {
    await prisma.$transaction(async (tx) => {
      await writeOrderHoldFenced(tx, {
        orderId: args.order.id,
        ...(cur ? { inputVersion: cur.inputVersion } : {}),
        newStatus: 'needs_human_qa',
        newHoldReason: holdMarker,
        setPackageDone: true,
      });
      await tx.generationJob.update({
        where: { orderId: args.order.id },
        data: { status: 'done', currentStage: 'done', completedAt, packaged: true },
      });
      // Mirror the safety park: never let a stale recoverable case auto-refund
      // or auto-redrive a book that must stay parked for human QA.
      await resolveActiveRecoveryCaseInTx(tx, {
        orderId: args.order.id,
        kinds: ['infra_transient', 'integrity_blocked'],
        reason: `authority_parked:${holdMarker.split(':').pop()}`,
        now: completedAt,
      });
    });
    await syncHumanQaHoldCasePostCommit(prisma, args.order.id);
    log.error(
      'Book-ready delivery withheld — fresh producing-snapshot binding failed (readiness-independent)',
      error,
      { orderId: args.order.id, holdMarker },
    );
    return { mode: 'authority_hold', deliveryHeld: true, manifest: null };
  };
  if (cur) {
    let freshPackageBacked = false;
    try {
      freshPackageBacked =
        requireProducingSnapshotBinding({
          order: cur,
          pipelineCache: cur.generationJob?.pipelineCache ?? null,
        }) !== null;
    } catch (error) {
      if (!(error instanceof OrderVisualPackageAuthorityError)) throw error;
      return parkAuthorityHold(
        'contract_world_hold:visual_package_authority_invalid',
        error,
      );
    }
    if (!freshPackageBacked) {
      // Caller-provenance leg (see the shared computation above): a package-shaped caller over a
      // genuinely legacy fresh row + producing snapshot means the frozen truth was re-pointed after
      // the caller loaded it.
      if (callerVisualPackageClaim) {
        return parkAuthorityHold(
          'contract_world_hold:delivery_snapshot_binding_invalid',
          new Error(
            'caller snapshot is package-shaped but the fresh Order and producing snapshot are legacy',
          ),
        );
      }
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
          'contract_world_hold:delivery_snapshot_binding_invalid',
          new Error(
            `delivery payload diverges from the fresh Book snapshot: ${payloadMismatches.join(', ')}`,
          ),
        );
      }
    }
  }
  let shipped = false;
  if (!cur) {
    log.error('Legacy delivery aborted — order vanished before the package write', { orderId: args.order.id });
  } else if (legacyStatus === 'ready') {
    // SHIP via the shared ready CAS: flips to ready ONLY IF no competing hold (fence unchanged, no terminal marker,
    // no payment fence, no active strong case). 0 rows ⇒ a hold landed mid-flight ⇒ NOT shipped, NO email.
    const rows = await executeReadinessShipCas(prisma, {
      orderId: args.order.id,
      inputVersion: cur.inputVersion,
      deliveryFenceVersion: cur.deliveryFenceVersion,
      deliveryHoldReason: legacyHoldReason,
    });
    shipped = rows === 1;
    if (!shipped) {
      log.warn('Legacy ship aborted — a hold landed mid-flight (fence/marker/case); not shipped, no email', {
        orderId: args.order.id,
      });
    }
  } else {
    // PARK via the shared hold funnel (bind + bump + never overwrite a stronger marker).
    await writeOrderHoldFenced(prisma, {
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
      reason: args.deliveryGate.reason,
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
                args.anchorLowConfidence,
                args.deliveryGate.reason,
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
