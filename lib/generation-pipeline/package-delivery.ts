import type { Order, PrismaClient } from '@prisma/client';
import { sendBookReadyEmail } from '@/backend/lib/email';
import { listenUrlFromReadUrl } from '@/lib/routes';
import { createLogger } from '@/lib/logger';
import type { AnchorLowConfidence } from '@/lib/anchor-resemblance-gate';
import { buildQaWarningsFromAnchorHold, canUseQaSoftDeliver } from '@/lib/qa-soft-deliver';
import {
  commitBaseBookReadiness,
  isReadinessManifestEnabled,
  type CommitResult,
} from './readiness-manifest';
import { resolveActiveRecoveryCaseInTx } from '@/lib/generation-chunked/exception-case';
import { recordHumanQaHoldInTx } from '@/lib/human-qa/record-hold';
import { humanReasonForHoldKind, loadHoldEvidence } from '@/lib/human-qa/hold-kind';

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
      pages: {
        orderBy: { pageNumber: 'asc' },
        select: { pageNumber: true, imageAsset: { select: { safetyVerified: true, safetyHazards: true } } },
      },
    },
  });
  if (!book) return { held: false, reason: null };
  const hazards: string[] = [];
  const unverified: string[] = [];
  if (book.coverImageUrl) {
    if (book.coverSafetyHazards.length > 0) hazards.push(`cover:${book.coverSafetyHazards.join('|')}`);
    else if (!book.coverSafetyVerified) unverified.push('cover');
  }
  for (const p of book.pages) {
    const a = p.imageAsset;
    if (!a) continue; // no rendered asset — not a safety concern (a different gate handles incompleteness)
    if (a.safetyHazards.length > 0) hazards.push(`page:${p.pageNumber}:${a.safetyHazards.join('|')}`);
    else if (!a.safetyVerified) unverified.push(`page:${p.pageNumber}`);
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
      await tx.order.update({
        where: { id: args.order.id },
        data: { status: 'needs_human_qa', packageStatus: 'done', deliveryHoldReason: args.safetyGate.reason },
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
      // (Human-QA Slice 1) ADDITIVE: open a safety review case in this SAME safety-park tx. The Order/Job writes
      // above are byte-unchanged; non-aborting ON CONFLICT DO NOTHING can never roll them back.
      const safetyRaw = args.safetyGate.reason ?? 'safety_hold:held';
      const ev = await loadHoldEvidence(tx, args.order.id);
      await recordHumanQaHoldInTx(tx, {
        orderId: args.order.id,
        scope: 'base_book',
        kind: 'safety',
        rawReason: safetyRaw,
        humanReason: humanReasonForHoldKind('safety', safetyRaw),
        childName: ev.childName || args.order.childName,
        inputVersion: ev.inputVersion,
        contractHash: ev.visualContractHash,
        sourceManifestId: null,
        artifactRefs: null,
        now: completedAt,
      });
    });
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
  // (Human-QA Slice 1) The two legacy writes were bare (separate autocommits); wrap them in ONE tx so an anchor
  // review case commits atomically with the park. Both Order + Job write DATA are byte-identical to before — only
  // the transactional grouping is added. A case opens ONLY when this legacy path actually parks for anchor QA
  // (legacyStatus === 'needs_human_qa'); a soft-deliver/ready outcome opens nothing.
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: args.order.id },
      data: {
        status: legacyStatus,
        packageStatus: 'done',
        deliveryHoldReason: legacyHoldReason,
      },
    });
    await tx.generationJob.update({
      where: { orderId: args.order.id },
      data: {
        status: 'done',
        currentStage: 'done',
        completedAt,
        packaged: true,
      },
    });
    if (legacyStatus === 'needs_human_qa') {
      const anchorRaw = legacyHoldReason ?? 'anchor_low_confidence:held';
      const ev = await loadHoldEvidence(tx, args.order.id);
      await recordHumanQaHoldInTx(tx, {
        orderId: args.order.id,
        scope: 'base_book',
        kind: 'anchor',
        rawReason: anchorRaw,
        humanReason: humanReasonForHoldKind('anchor', anchorRaw),
        childName: ev.childName || args.order.childName,
        inputVersion: ev.inputVersion,
        contractHash: ev.visualContractHash,
        sourceManifestId: null,
        artifactRefs: null,
        now: completedAt,
      });
    }
  });

  if (!args.deliveryGate.sendBookReadyEmail && !legacySoftDeliver) {
    log.warn('Book-ready email withheld — order held for human QA', {
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
    deliveryHeld: legacySoftDeliver ? false : args.deliveryGate.held,
    manifest: null,
  };
}
