import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: '.env.local' });

async function main() {
  const orderId = process.argv[2] ?? 'bebec41b-669f-4a62-b801-188672e97e5f';
  const p = new PrismaClient();
  const book = await p.generatedBook.findUnique({
    where: { orderId },
    include: { pages: { take: 2, orderBy: { pageNumber: 'asc' } } },
  });
  const job = await p.generationJob.findUnique({ where: { orderId } });
  const pageCount = await p.bookPage.count({ where: { book: { orderId } } });
  console.log(
    JSON.stringify(
      {
        pageCount,
        sampleText: book?.pages?.[0]?.text?.slice(0, 120),
        pipelineCache: job?.pipelineCache,
        childGender: (await p.order.findUnique({ where: { id: orderId }, select: { childGender: true } }))
          ?.childGender,
      },
      null,
      2
    )
  );
  await p.$disconnect();
}

main();
