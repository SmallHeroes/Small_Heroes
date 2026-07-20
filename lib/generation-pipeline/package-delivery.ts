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
import { isSafetyHazardOverridden, isSafetyShaMissing } from './asset-safety-signal';
import { resolveActiveRecoveryCaseInTx } from '@/lib/generation-chunked/exception-case';
import { syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';

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
 * (Fix 1) The READINESS-INDEPENDENT physical-safety gate for the whole book, computed from the durable per-artifact
 * safety signal persisted with each asset. `held` blocks `ready` + email on EVERY paid path (legacy AND manifest),
 * regardless of READINESS_MANIFEST_ENABLED. The `safety_hold:` reason is the marker start.ts + the processor key off.
 */
export interface SafetyDeliveryGate {
  held: boolean;
  reason: string | null;
}

/**
 * Resolve the book's readiness-independent safety gate from the persisted per-asset signal (ImageAsset for pages,
 * GeneratedBook for the cover). A RENDERED artifact blocks delivery when it carries a confirmed hazard OR is not
 * verified-safe (fail-closed). A confirmed hazard is reported over a merely-unverified one. Un-rendered artifacts
 * are NOT this gate's concern (integrity/anchor gates cover missing assets). Never throws → a missing book is
 * "not held" (nothing to deliver anyway).
 *
 * OPERATIONAL (deliberate, fail-closed): a book rendered with the safety QA OFF — PAGE_VISUAL_QA_ENABLED=false or a
 * missing OPENAI_API_KEY — has NO safety determination, so every asset persists safetyVerified=false and the WHOLE
 * book HOLDS at needs_human_qa. This is intended ("unconfirmed-safe never delivers"), so safety QA is a LAUNCH
 * PREREQUISITE in any delivering environment (prod/staging), alongside enabling READINESS_MANIFEST_ENABLED.
 */
export async function resolveSafetyDeliveryGate(
  prisma: PrismaClient,
  orderId: string,
): Promise<SafetyDeliveryGate> {
  const book = await prisma.generatedBook.findUnique({
    where: { orderId },
    select: {
      coverImageUrl: true,
      coverSafetyVerified: true,
      coverSafetyHazards: true,
      // (release c-ii) override columns — a confirmed hazard is cleared ONLY by an operator override BOUND to the
      // current bytes (isSafetyHazardOverridden). The detector's finding is never deleted; nothing here compares an
      // override to a promise — it compares the override SHA to the co-written content SHA, fail-closed on null.
      coverSafetyContentSha256: true,
      coverSafetyOverriddenHazards: true,
      coverSafetyOverrideSha256: true,
      pages: {
        orderBy: { pageNumber: 'asc' },
        select: {
          pageNumber: true,
          imageAsset: {
            select: {
              safetyVerified: true, safetyHazards: true,
              safetyContentSha256: true, safetyOverriddenHazards: true, safetyOverrideSha256: true,
            },
          },
        },
      },
    },
  });
  if (!book) return { held: false, reason: null };
  const hazards: string[] = [];
  const unverified: string[] = [];
  if (book.coverImageUrl) {
    if (book.coverSafetyHazards.length > 0) {
      // (F1) An override is honored ONLY on a verified-safe asset. The branch below never consults safetyVerified, so
      // it silently rested on "hazards non-empty ⇒ verified true" (writer convention, asserted nowhere). Require it
      // at the point of use: an unverified asset that somehow carries hazards can never be released.
      const overridden = book.coverSafetyVerified === true && isSafetyHazardOverridden({
        hazards: book.coverSafetyHazards, overriddenHazards: book.coverSafetyOverriddenHazards,
        contentSha256: book.coverSafetyContentSha256, overrideSha256: book.coverSafetyOverrideSha256,
      });
      // (shape C) Surface a phase-2-missed hazard distinctly: `cover:sha_missing` is NOT releasable (no override can
      // bind to unidentified bytes) vs `cover:<hazards>`, the ordinary releasable hazard hold.
      if (!overridden) {
        hazards.push(isSafetyShaMissing({ hazards: book.coverSafetyHazards, contentSha256: book.coverSafetyContentSha256 })
          ? 'cover:sha_missing'
          : `cover:${book.coverSafetyHazards.join('|')}`);
      }
    } else if (!book.coverSafetyVerified) unverified.push('cover');
  }
  for (const p of book.pages) {
    const a = p.imageAsset;
    if (!a) continue; // no rendered asset — not a safety concern (a different gate handles incompleteness)
    if (a.safetyHazards.length > 0) {
      // The hazard holds UNLESS an operator override, bound to these exact bytes, covers every found hazard. An
      // unverified asset (empty hazards, below) can never be overridden — you cannot override ignorance. (F1)
      // safetyVerified === true is required here too: an unverified-yet-hazardous asset is never releasable.
      const overridden = a.safetyVerified === true && isSafetyHazardOverridden({
        hazards: a.safetyHazards, overriddenHazards: a.safetyOverriddenHazards,
        contentSha256: a.safetyContentSha256, overrideSha256: a.safetyOverrideSha256,
      });
      // (shape C) `page:N:sha_missing` (phase-2 never landed → not releasable) is distinct from an ordinary
      // `page:N:<hazards>` hold that a byte-bound operator override can clear. Marker prefix stays `safety_hold:`.
      if (!overridden) {
        hazards.push(isSafetyShaMissing({ hazards: a.safetyHazards, contentSha256: a.safetyContentSha256 })
          ? `page:${p.pageNumber}:sha_missing`
          : `page:${p.pageNumber}:${a.safetyHazards.join('|')}`);
      }
    } else if (!a.safetyVerified) unverified.push(`page:${p.pageNumber}`);
  }
  if (hazards.length === 0 && unverified.length === 0) return { held: false, reason: null };
  const detail = hazards.length > 0 ? `hazard:${hazards.join(',')}` : `unverified:${unverified.join(',')}`;
  return { held: true, reason: `safety_hold:${detail}` };
}

export interface PackageDeliveryResult {
  mode: 'legacy' | 'manifest' | 'safety_hold';
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
    order: Pick<Order, 'id' | 'customerEmail' | 'customerName' | 'childName'>;
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

  const readinessEnabled = deps.readinessEnabled ?? isReadinessManifestEnabled;
  if (readinessEnabled()) {
    const commit = deps.commit ?? commitBaseBookReadiness;
    const manifest = await commit(prisma, {
      orderId: args.order.id,
      anchorAllowsDelivery: args.deliveryGate.sendBookReadyEmail,
      anchorOrderStatus: args.deliveryGate.orderStatus,
      anchorReason: args.deliveryGate.reason,
      anchorLowConfidence: args.anchorLowConfidence,
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
    select: { inputVersion: true, deliveryFenceVersion: true },
  });
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
