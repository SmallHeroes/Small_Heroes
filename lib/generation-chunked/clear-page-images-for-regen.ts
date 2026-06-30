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
