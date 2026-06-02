// Usage: npx tsx scripts/cancel-job.mjs <orderId>
// Cleanly stops a generation job: marks failed, releases lease so nothing resumes it.
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: npx tsx scripts/cancel-job.mjs <orderId>');
  process.exit(1);
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const updated = await prisma.generationJob.updateMany({
  where: { orderId },
  data: {
    status: 'failed',
    currentStage: 'failed',
    lockedBy: null,
    leaseExpiresAt: null,
    retryable: false,
    lastError: 'manually cancelled (duplicate/abandoned run)',
  },
});

console.log(`Cancelled ${updated.count} job(s) for order ${orderId}.`);
console.log('Note: an in-flight worker may finish its current image, then stop on the next state check.');
await prisma.$disconnect();
