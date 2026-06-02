// Usage: npx tsx scripts/check-progress.mjs <orderId>
// Shows where a book generation stands + rough ETA. Re-run to watch progress.
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: npx tsx scripts/check-progress.mjs <orderId>');
  process.exit(1);
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const job = await prisma.generationJob.findUnique({ where: { orderId } });
const book = await prisma.generatedBook.findFirst({ where: { orderId } });

if (!job && !book) {
  console.log(`No job/book found for order ${orderId}`);
  await prisma.$disconnect();
  process.exit(0);
}

let pages = [];
if (book) {
  pages = await prisma.bookPage.findMany({
    where: { bookId: book.id },
    select: { pageNumber: true, audioUrl: true, imageAsset: { select: { id: true } } },
    orderBy: { pageNumber: 'asc' },
  });
}

const total = pages.length;
const imagesDone = pages.filter((p) => p.imageAsset).length;
const audioDone = pages.filter((p) => p.audioUrl).length;
const missingImg = pages.filter((p) => !p.imageAsset).map((p) => p.pageNumber);

const now = Date.now();
const leaseActive = job?.leaseExpiresAt && new Date(job.leaseExpiresAt).getTime() > now;
const minsSinceUpdate = job ? ((now - new Date(job.updatedAt).getTime()) / 60000).toFixed(1) : '?';
const remainingImgs = Math.max(0, total - imagesDone);
const etaMin = ((remainingImgs * 40) / 60).toFixed(1); // ~40s/image

const bar = total ? '█'.repeat(Math.round((imagesDone / total) * 20)).padEnd(20, '░') : '░'.repeat(20);

console.log(`\nOrder: ${orderId}`);
console.log(`Stage:   ${job?.currentStage ?? '?'}   |   Status: ${job?.status ?? '?'}`);
console.log(`Lease:   ${leaseActive ? 'ACTIVE (worker running)' : 'expired/none'}   |   updated ${minsSinceUpdate} min ago`);
console.log(`Images:  [${bar}] ${imagesDone}/${total}`);
console.log(`Audio:   ${audioDone}/${total} pages`);
console.log(`Cover:   ${book?.coverImageUrl ? 'done' : 'pending'}   |   PDF: ${book?.pdfUrl ? 'done' : 'pending'}   |   Video: ${book?.videoUrl ? 'done' : 'pending'}`);
if (missingImg.length && missingImg.length <= 25) console.log(`Pages still needing image: ${missingImg.join(', ')}`);
if (job?.lastError) console.log(`Last error: ${job.lastError}`);

if (job?.currentStage === 'done' || job?.status === 'ready') {
  console.log(`\n✅ DONE — book ready.`);
} else if (remainingImgs > 0 && (job?.currentStage === 'page_images' || job?.currentStage === 'cover')) {
  console.log(`\n⏳ ~${remainingImgs} images left → rough ETA ${etaMin} min (at ~40s/image).`);
} else if (!leaseActive && job?.currentStage !== 'done') {
  console.log(`\n⚠️  No active lease and not done — may be stalled. If so, resume: POST /api/dev/generation/resume {orderId}`);
} else {
  console.log(`\n⏳ In progress (stage: ${job?.currentStage}). Re-run to refresh.`);
}

await prisma.$disconnect();
