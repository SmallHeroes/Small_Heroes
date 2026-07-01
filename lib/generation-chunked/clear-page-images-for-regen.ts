import type { PrismaClient } from '@prisma/client';
import { withDeliveryInputMutation } from '@/lib/generation-pipeline/readiness-manifest';

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
