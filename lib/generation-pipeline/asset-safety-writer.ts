/**
 * (Human-QA release, shape C) The PHASE-2 second write of an asset's delivered-bytes safety SHA.
 *
 * Shape C, per the Codex ruling: the delivery-input tx writes the new URL PLUS a fail-closed safety state
 * (safetyContentSha256 = null, override cleared) via the phase-1 field-builders (asset-safety-signal.ts). Then
 * `inspectAsset` runs OUTSIDE that tx (never a network fetch / image decode while the Order row lock is held), and
 * THIS module records the SHA-bound signal in a short, standalone write.
 *
 * The write is a COMPARE-AND-SET on the exact delivered bytes: it advances safetyContentSha256 from null → the
 * inspected SHA ONLY while the row still points at the URL we inspected (COALESCE(presentationUrl,url) === the
 * delivered URL) and no SHA is bound yet. A concurrent re-render that moved the bytes changes the coalesced URL, so
 * the CAS matches 0 rows and the stale SHA never lands. A MISSED write (inspect failure / crash / lost CAS) leaves
 * safetyContentSha256 null → Gate 2's predicate fails closed → the book holds at needs_human_qa and the hazard is
 * SURFACED as `sha_missing` (isSafetyShaMissing) — never a silent ship.
 *
 * It writes ONLY the content SHA — never the detector's finding (safetyVerified/safetyHazards) and never the override
 * columns — so it cannot leave a stale override (phase-1 already reset it). That is why it is a sanctioned exception
 * to the delivery-input barrier (it is not a delivery-INPUT write) and is NOT flagged by the phase-1 writer guard.
 *
 * Always-on: Gate 2 is readiness-INDEPENDENT, and single-page-image-regen binds a SHA without ever calling the
 * flag-gated persistDeliveredQualityEvidence — so this must never depend on that producer.
 */
import type { PrismaClient, Prisma } from '@prisma/client';
import { SAFETY_SHA256_RE } from './asset-safety-signal';

export interface SafetyShaBindResult {
  /** true when the CAS bound the SHA to exactly one row (the inspected bytes are still the delivered bytes). */
  bound: boolean;
  /** Why a bind did not happen, for observability — 'malformed_sha' (never written) | 'cas_miss' (row moved / already bound). */
  reason?: 'malformed_sha' | 'cas_miss';
}

/**
 * Phase-2 for a page ImageAsset. `deliveredUrl` is presentationUrl ?? url; `presentationApplied` selects which column
 * the CAS binds against so the row must STILL carry those exact delivered bytes. Never throws on a lost CAS — a missed
 * bind is a fail-closed hold, not an error.
 */
export async function bindPageSafetySha(
  prisma: PrismaClient,
  args: { pageId: string; deliveredUrl: string; presentationApplied: boolean; sha256: string },
): Promise<SafetyShaBindResult> {
  if (!SAFETY_SHA256_RE.test(args.sha256)) return { bound: false, reason: 'malformed_sha' }; // never feed the DB CHECK garbage
  const where = args.presentationApplied
    ? { pageId: args.pageId, presentationUrl: args.deliveredUrl, safetyContentSha256: null }
    : { pageId: args.pageId, url: args.deliveredUrl, presentationUrl: null, safetyContentSha256: null };
  const { count } = await prisma.imageAsset.updateMany({ where, data: { safetyContentSha256: args.sha256 } });
  return count === 1 ? { bound: true } : { bound: false, reason: 'cas_miss' };
}

/**
 * Phase-2 for the cover (GeneratedBook). The cover has no presentation transform, so `deliveredUrl` === coverImageUrl;
 * the CAS binds only while the book still carries those cover bytes and no SHA is bound yet.
 */
export async function bindCoverSafetySha(
  prisma: PrismaClient,
  args: { orderId: string; deliveredUrl: string; sha256: string },
): Promise<SafetyShaBindResult> {
  if (!SAFETY_SHA256_RE.test(args.sha256)) return { bound: false, reason: 'malformed_sha' };
  const { count } = await prisma.generatedBook.updateMany({
    where: { orderId: args.orderId, coverImageUrl: args.deliveredUrl, coverSafetyContentSha256: null },
    data: { coverSafetyContentSha256: args.sha256 },
  });
  return count === 1 ? { bound: true } : { bound: false, reason: 'cas_miss' };
}

/**
 * (release-as-readiness-mode, 2a-2) The SINGLE sanctioned writer of an operator FALSE-POSITIVE release override —
 * BOTH gates, in the caller's (readiness) transaction. It writes ONLY the override columns:
 *   • Gate 2 (readiness-INDEPENDENT): ImageAsset.safetyOverriddenHazards + safetyOverrideSha256 (page) or the cover
 *     twins on GeneratedBook — so a future re-package honours the release (isSafetyHazardOverridden).
 *   • Gate 1: QualityEvidence.safetyOverride + safetyOverrideSha256 — so the readiness gate reads it as released.
 * It NEVER touches the detector's finding (safetyVerified / safetyHazards / the cover twins) — those stay owned by the
 * field-builders. The two structural guards (asset-safety-writer-coverage / delivery-input-writer-coverage) grant this
 * file a NARROW allowance for the override columns while STILL failing the build on any detector-field write here.
 * The SHA is validated first — a malformed override can never reach the DB CHECK.
 */
export async function writeSafetyReleaseOverride(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    /** The QualityEvidence artifactKey — 'cover' | 'page:<n>'. */
    artifactKey: string;
    /** The resolved Gate-2 target: a page ImageAsset (by pageId) or the cover (GeneratedBook by orderId). */
    target: { kind: 'page'; pageId: string } | { kind: 'cover' };
    overriddenHazards: string[];
    overrideSha256: string;
  },
): Promise<void> {
  if (!SAFETY_SHA256_RE.test(args.overrideSha256)) {
    throw new Error('[asset-safety-writer] release override SHA malformed');
  }
  if (args.target.kind === 'page') {
    await tx.imageAsset.update({
      where: { pageId: args.target.pageId },
      data: { safetyOverriddenHazards: args.overriddenHazards, safetyOverrideSha256: args.overrideSha256 },
    });
  } else {
    await tx.generatedBook.update({
      where: { orderId: args.orderId },
      data: { coverSafetyOverriddenHazards: args.overriddenHazards, coverSafetyOverrideSha256: args.overrideSha256 },
    });
  }
  // Gate 1 — QualityEvidence override. verdict/reason stay IMMUTABLE (the detector's finding is never deleted).
  await tx.qualityEvidence.update({
    where: { orderId_artifactKey: { orderId: args.orderId, artifactKey: args.artifactKey } },
    data: { safetyOverride: true, safetyOverrideSha256: args.overrideSha256 },
  });
}
