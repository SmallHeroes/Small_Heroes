import type { PrismaClient } from '@prisma/client';

/** Remove stored page images so chunked generation will regenerate them. */
export async function clearOrderPageImages(
  prisma: PrismaClient,
  orderId: string,
  pageNumbers: number[]
): Promise<number> {
  if (pageNumbers.length === 0) return 0;
  const book = await prisma.generatedBook.findUnique({
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
  const result = await prisma.imageAsset.deleteMany({ where: { pageId: { in: pageIds } } });
  return result.count;
}
