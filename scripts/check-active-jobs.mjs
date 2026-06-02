// Usage: npx tsx scripts/check-active-jobs.mjs
// Shows recent generation jobs + which are ACTIVE right now (to spot 2 books generating at once).
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const jobs = await prisma.generationJob.findMany({
  orderBy: { updatedAt: 'desc' },
  take: 12,
  include: { order: { select: { childName: true, childGender: true } } },
});

const now = Date.now();
const fmt = (j) => {
  const done = Array.isArray(j.completedPageNumbers) ? j.completedPageNumbers.length : 0;
  const leaseActive = j.leaseExpiresAt && new Date(j.leaseExpiresAt).getTime() > now;
  const active = j.currentStage !== 'done' && j.currentStage !== 'failed';
  return {
    orderId: j.orderId,
    child: j.order?.childName ?? '?',
    status: j.status,
    stage: j.currentStage,
    pagesDone: done,
    lockedBy: j.lockedBy ?? null,
    leaseActive: Boolean(leaseActive),
    updated: new Date(j.updatedAt).toISOString(),
    ACTIVE: active,
  };
};

const rows = jobs.map(fmt);
console.table(rows);

const activeNow = rows.filter((r) => r.ACTIVE && (r.leaseActive || r.status === 'pending' || r.status === 'running'));
console.log(`\nActive (not done/failed): ${rows.filter((r) => r.ACTIVE).length}`);
console.log(`Currently locked / in-flight: ${rows.filter((r) => r.leaseActive).length}`);
if (rows.filter((r) => r.leaseActive).length > 1) {
  console.log('⚠️  More than one job holds an active lease — TWO books may be generating at once.');
} else {
  console.log('OK — at most one job holds an active lease.');
}

await prisma.$disconnect();
