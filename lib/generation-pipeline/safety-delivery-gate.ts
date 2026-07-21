import 'server-only';

import type { Prisma, PrismaClient } from '@prisma/client';

import { isSafetyHazardOverridden, isSafetyShaMissing } from './asset-safety-signal';

/**
 * (Fix 1) The READINESS-INDEPENDENT physical-safety gate for the whole book, computed from the durable per-artifact
 * safety signal persisted with each asset (ImageAsset for pages, GeneratedBook for the cover). `held` blocks `ready` +
 * email on EVERY paid path (legacy AND manifest), regardless of READINESS_MANIFEST_ENABLED. The `safety_hold:` reason
 * is the marker `start.ts` + the processor key off.
 *
 * This module holds the ONE implementation of the gate, split into a pure evaluator (`evaluateSafetyDeliveryGate`) and
 * its DB load (`loadSafetyGateInputs`). `resolveSafetyDeliveryGate` (package-delivery) is load+evaluate; the in-tx
 * false-positive release recompute (safety-release) is load+PROJECT+evaluate — same evaluator, so the marker the
 * release moves is only ever cleared when the gate that PRODUCES it agrees. (2a-2 re-gate P1.)
 */
export interface SafetyDeliveryGate {
  held: boolean;
  reason: string | null;
}

/** The per-page ImageAsset safety columns Gate 2 reads. */
export interface SafetyGatePageAsset {
  safetyVerified: boolean | null;
  safetyHazards: string[];
  safetyContentSha256: string | null;
  safetyOverriddenHazards: string[];
  safetyOverrideSha256: string | null;
}
export interface SafetyGatePage {
  pageNumber: number;
  imageAsset: SafetyGatePageAsset | null;
}
/** The cover (GeneratedBook) + pages safety shape — the ONLY inputs the gate reads. */
export interface SafetyGateInputs {
  coverImageUrl: string | null;
  coverSafetyVerified: boolean | null;
  coverSafetyHazards: string[];
  coverSafetyContentSha256: string | null;
  coverSafetyOverriddenHazards: string[];
  coverSafetyOverrideSha256: string | null;
  pages: SafetyGatePage[];
}

/**
 * Load the gate's inputs (cover + every page's asset safety). Accepts a PrismaClient OR a TransactionClient, so the
 * in-tx release recompute reads the SAME shape as production. Never throws → a missing book is handled by the evaluator.
 */
export async function loadSafetyGateInputs(
  client: PrismaClient | Prisma.TransactionClient,
  orderId: string,
): Promise<SafetyGateInputs | null> {
  const book = await client.generatedBook.findUnique({
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
  return (book as SafetyGateInputs | null) ?? null;
}

/**
 * PURE. The single evaluation of the readiness-independent safety gate. A RENDERED artifact blocks delivery when it
 * carries a confirmed hazard OR is not verified-safe (fail-closed). A confirmed hazard is reported over a merely-
 * unverified one. Un-rendered artifacts are NOT this gate's concern (integrity/anchor gates cover missing assets). A
 * missing book is "not held" (nothing to deliver anyway).
 *
 * OPERATIONAL (deliberate, fail-closed): a book rendered with the safety QA OFF — PAGE_VISUAL_QA_ENABLED=false or a
 * missing OPENAI_API_KEY — has NO safety determination, so every asset persists safetyVerified=false and the WHOLE
 * book HOLDS at needs_human_qa. This is intended ("unconfirmed-safe never delivers"), so safety QA is a LAUNCH
 * PREREQUISITE in any delivering environment (prod/staging), alongside enabling READINESS_MANIFEST_ENABLED.
 */
export function evaluateSafetyDeliveryGate(book: SafetyGateInputs | null): SafetyDeliveryGate {
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

/**
 * Project an operator's release override onto a COPY of the gate inputs — exactly the two override columns the Gate-2
 * writer would persist for the target artifact (safetyOverriddenHazards + safetyOverrideSha256), and NOTHING else — so
 * `evaluateSafetyDeliveryGate` can be recomputed WITHOUT writing. Non-target artifacts are untouched; the raw inputs
 * are never mutated. A null book (or a page target with no rendered asset) is returned unchanged, so the recompute
 * still sees whatever else holds.
 */
export function projectSafetyOverrideOntoGateInputs(
  book: SafetyGateInputs | null,
  target: { kind: 'cover' } | { kind: 'page'; pageNumber: number },
  override: { overriddenHazards: string[]; overrideSha256: string },
): SafetyGateInputs | null {
  if (!book) return null;
  if (target.kind === 'cover') {
    return {
      ...book,
      coverSafetyOverriddenHazards: override.overriddenHazards,
      coverSafetyOverrideSha256: override.overrideSha256,
    };
  }
  return {
    ...book,
    pages: book.pages.map((p) =>
      p.pageNumber === target.pageNumber && p.imageAsset
        ? {
            ...p,
            imageAsset: {
              ...p.imageAsset,
              safetyOverriddenHazards: override.overriddenHazards,
              safetyOverrideSha256: override.overrideSha256,
            },
          }
        : p,
    ),
  };
}

/**
 * Resolve the book's readiness-independent safety gate from the DB (load + evaluate). Behaviour is byte-identical to
 * the prior inline implementation; production callers (chunk-runner, single-page-image-regen, package-delivery) are
 * unchanged. Never throws → a missing book is "not held".
 */
export async function resolveSafetyDeliveryGate(prisma: PrismaClient, orderId: string): Promise<SafetyDeliveryGate> {
  return evaluateSafetyDeliveryGate(await loadSafetyGateInputs(prisma, orderId));
}
