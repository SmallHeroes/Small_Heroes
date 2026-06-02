import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

async function main() {
  const orderId = process.argv[2]?.trim();
  const pageArg = process.argv[3]?.trim() || '1,4,8,13,20';
  if (!orderId) {
    console.error('Usage: npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-focused-chunked-identity-test.ts <orderId> [pagesCsv]');
    process.exit(1);
  }

  const pages = pageArg
    .split(/[,\s]+/)
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (pages.length === 0) throw new Error('No valid pages');

  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.CHUNKED_IMAGE_PAGE_FILTER = pages.join(',');

  const { prisma } = await import('@/lib/prisma');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');

  const maxAttempts = 120;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts += 1;
    const res = await runGenerationWorkerInvocation(orderId);
    const rows = await prisma.bookPage.findMany({
      where: { book: { orderId }, pageNumber: { in: pages } },
      orderBy: { pageNumber: 'asc' },
      select: { pageNumber: true, imageAsset: { select: { url: true } } },
    });
    const donePages = rows.filter((r) => !!r.imageAsset?.url).map((r) => r.pageNumber);
    console.log(JSON.stringify({ attempt: attempts, worker: res, donePages }, null, 2));
    if (pages.every((p) => donePages.includes(p))) break;
    await new Promise((r) => setTimeout(r, 800));
  }

  const finalRows = await prisma.bookPage.findMany({
    where: { book: { orderId }, pageNumber: { in: pages } },
    orderBy: { pageNumber: 'asc' },
    select: { pageNumber: true, imageAsset: { select: { url: true, provider: true } } },
  });
  const final = finalRows.map((r) => ({
    page: r.pageNumber,
    ok: Boolean(r.imageAsset?.url),
    url: r.imageAsset?.url ?? null,
    provider: r.imageAsset?.provider ?? null,
  }));
  console.log(JSON.stringify({ orderId, pages, final }, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

