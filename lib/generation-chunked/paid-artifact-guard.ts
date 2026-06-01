import type { PrismaClient } from '@prisma/client';
import { isValidImageAssetUrl } from './artifact-keys';

/** Same lookup the chunked worker uses before any paid page-image call. */
export async function findExistingPageImageAsset(
  prisma: PrismaClient,
  input: { pageId: string; idempotencyKey: string }
): Promise<{ id: string; url: string; idempotencyKey: string | null } | null> {
  return prisma.imageAsset.findFirst({
    where: {
      OR: [{ pageId: input.pageId }, { idempotencyKey: input.idempotencyKey }],
    },
    select: { id: true, url: true, idempotencyKey: true },
  });
}

export function shouldSkipPaidPageImageRegen(
  asset: { url: string } | null | undefined
): boolean {
  return Boolean(asset && isValidImageAssetUrl(asset.url));
}
