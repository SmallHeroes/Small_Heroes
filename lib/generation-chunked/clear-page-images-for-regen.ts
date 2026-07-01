import type { Prisma, PrismaClient } from '@prisma/client';
import { withDeliveryInputMutation, isReadinessManifestEnabled } from '@/lib/generation-pipeline/readiness-manifest';
import {
  QUALITY_REGEN_BUDGET,
  coverArtifactKey,
  pageNumberFromArtifactKey,
  ensureQualityEvidenceRow,
} from '@/lib/generation-pipeline/quality-evidence';

// NOTE: every GeneratedBook/ImageAsset/Order write below is INLINED inside a withDeliveryInputMutation callback
// (param `tx`) — the delivery-input-writer-coverage guard verifies barrier protection LEXICALLY, so these must
// not be extracted into tx-taking helpers.

/** Remove stored page images so chunked generation will regenerate them. */
export async function clearOrderPageImages(
  prisma: PrismaClient,
  orderId: string,
  pageNumbers: number[]
): Promise<number> {
  if (pageNumbers.length === 0) return 0;
  const result = await withDeliveryInputMutation(
    prisma,
    { orderId, reason: 'page_assets_cleared' },
    async (tx) => {
      const book = await tx.generatedBook.findUnique({
        where: { orderId },
        select: {
          pages: {
            where: { pageNumber: { in: pageNumbers } },
            select: { id: true },
          },
        },
      });
      if (!book?.pages.length) return 0;
      const pageIds = book.pages.map((p) => p.id);
      const deleted = await tx.imageAsset.deleteMany({ where: { pageId: { in: pageIds } } });
      return deleted.count;
    },
  );
  return result.value;
}

/**
 * (#7-a 6 regen-rescue) Clear the stored cover so chunked generation re-renders it. The cover-render gate
 * (chunk-runner) skips when GeneratedBook.coverImageUrl is a valid URL, so nulling it (+ the Order legacy
 * mirror) re-drives the cover render. Routed through the write barrier so readiness invalidates atomically.
 */
export async function clearOrderCover(prisma: PrismaClient, orderId: string): Promise<boolean> {
  const result = await withDeliveryInputMutation(
    prisma,
    { orderId, reason: 'cover_asset_changed' },
    async (tx) => {
      const book = await tx.generatedBook.findUnique({ where: { orderId }, select: { id: true } });
      if (!book) return false;
      await tx.generatedBook.update({ where: { id: book.id }, data: { coverImageUrl: null } });
      await tx.order.update({ where: { id: orderId }, data: { coverImageUrl: null } });
      return true;
    },
  );
  return result.value;
}

/**
 * (#6-fix-3, Codex-ratified) ATOMICALLY, as ONE write-barrier tx for a single artifact (cover | page:<n>):
 *   1. reserve one durable regen (conditional regenCount++ < budget),
 *   2. mark the row durably `regenPending`,
 *   3. clear the delivered asset.
 * Then the caller dispatches the redrive SEPARATELY. Returns `{ granted: false }` WITHOUT clearing when the budget
 * is already spent (regenCount >= budget) → the artifact stays failed-terminal and the recommit refunds it.
 *
 * BLOCKER 2 — the RESCUE itself reserves the budget (step 1), so "≤ QUALITY_REGEN_BUDGET replacements then refund"
 *   is enforced at the rescue level regardless of whether an in-loop re-render happens to pass (which consumed 0
 *   budget before this fix). The shared durable regenCount caps total in-loop + rescue replacements at the budget.
 * BLOCKER 3 — the `regenPending` marker and the destructive clear commit in the SAME tx, so a redrive that fails
 *   to start never destroys an asset without a retry path: the marker survives and the next recovery tick
 *   re-dispatches from it. Reserve BEFORE the clear, so a spent budget can never destroy the delivered bytes.
 * The marker is cleared when the re-rendered bytes are re-QA'd (persistDeliveredQualityEvidence overwrites evidence).
 */
export async function reserveMarkAndClearRegen(
  prisma: PrismaClient,
  args: { orderId: string; artifactKey: string; budget?: number },
): Promise<{ granted: boolean }> {
  if (!isReadinessManifestEnabled()) return { granted: false }; // flag OFF → no rescue (legacy path)
  const budget = args.budget ?? QUALITY_REGEN_BUDGET;
  const isCover = args.artifactKey === coverArtifactKey();
  const pageNumber = isCover ? null : pageNumberFromArtifactKey(args.artifactKey);
  if (!isCover && pageNumber == null) return { granted: false }; // malformed artifact key
  const result = await withDeliveryInputMutation(
    prisma,
    { orderId: args.orderId, reason: isCover ? 'cover_asset_changed' : 'page_assets_cleared' },
    async (tx) => {
      // 1) Ensure a row, then atomically reserve one regen. BEFORE any destructive clear, so a spent budget can
      //    never destroy the delivered asset (it stays failed-terminal → the recommit refunds it).
      await ensureQualityEvidenceRow(tx, { orderId: args.orderId, artifactKey: args.artifactKey });
      const bumped = await tx.qualityEvidence.updateMany({
        where: { orderId: args.orderId, artifactKey: args.artifactKey, regenCount: { lt: budget } },
        data: { regenCount: { increment: 1 } },
      });
      if (bumped.count !== 1) return { granted: false };
      // 2) Mark durably regen-pending — merged into the evidence JSON, preserving the real qaContext (BLOCKER 1).
      const row = await tx.qualityEvidence.findUnique({
        where: { orderId_artifactKey: { orderId: args.orderId, artifactKey: args.artifactKey } },
        select: { evidence: true },
      });
      const base =
        row?.evidence && typeof row.evidence === 'object' && !Array.isArray(row.evidence)
          ? (row.evidence as Record<string, unknown>)
          : {};
      await tx.qualityEvidence.update({
        where: { orderId_artifactKey: { orderId: args.orderId, artifactKey: args.artifactKey } },
        data: { evidence: { ...base, regenPending: true } as unknown as Prisma.InputJsonValue },
      });
      // 3) Clear the delivered asset (inlined so the barrier guard sees it) so the redrive re-renders it.
      if (isCover) {
        const book = await tx.generatedBook.findUnique({ where: { orderId: args.orderId }, select: { id: true } });
        if (book) {
          await tx.generatedBook.update({ where: { id: book.id }, data: { coverImageUrl: null } });
          await tx.order.update({ where: { id: args.orderId }, data: { coverImageUrl: null } });
        }
      } else {
        const book = await tx.generatedBook.findUnique({
          where: { orderId: args.orderId },
          select: { pages: { where: { pageNumber: pageNumber as number }, select: { id: true } } },
        });
        const pageIds = book?.pages.map((p) => p.id) ?? [];
        if (pageIds.length) await tx.imageAsset.deleteMany({ where: { pageId: { in: pageIds } } });
      }
      return { granted: true };
    },
  );
  return result.value;
}
