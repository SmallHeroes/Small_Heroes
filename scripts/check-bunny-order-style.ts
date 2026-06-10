/** Gap 2 diagnosis: what style is stored on the failed bunny order and where did it come from. */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findUnique({
    where: { id: 'cmq82b5f300024wyolypqecob' },
    select: {
      id: true,
      illustrationStyle: true,
      createdAt: true,
      topic: true,
      storyDirection: true,
      storyLength: true,
      status: true,
      customerEmail: true,
      childName: true,
      wizardSessionId: true,
      stripeMetadata: true,
    },
  });
  console.log(JSON.stringify(order, null, 2));

  const book = await prisma.generatedBook.findUnique({
    where: { orderId: 'cmq82b5f300024wyolypqecob' },
    select: { id: true, pages: { select: { id: true, pageNumber: true }, orderBy: { pageNumber: 'asc' } } },
  });
  if (!book) return;
  const assets = await prisma.imageAsset.findMany({
    where: { pageId: { in: book.pages.map((p) => p.id) } },
    select: { pageId: true, style: true, prompt: true, createdAt: true },
  });
  const pageNumById = new Map(book.pages.map((p) => [p.id, p.pageNumber]));
  for (const a of assets.sort((x, y) => (pageNumById.get(x.pageId) ?? 0) - (pageNumById.get(y.pageId) ?? 0))) {
    const head = (a.prompt ?? '').slice(0, 200).replace(/\n/g, ' | ');
    const s01 = /STYLE 01|Style 01/i.test(a.prompt ?? '');
    const s02 = /STYLE 02|Style 02/i.test(a.prompt ?? '');
    console.log(
      `page=${pageNumById.get(a.pageId)} style=${a.style} mentionsStyle01=${s01} mentionsStyle02=${s02} created=${a.createdAt.toISOString()}\n  head: ${head}\n`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
