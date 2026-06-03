import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: '.env.local' });

async function main() {
  const orderId = process.argv[2];
  const p = new PrismaClient();
  const j = await p.generationJob.findUnique({ where: { orderId } });
  const o = await p.order.findUnique({
    where: { id: orderId },
    select: { status: true, textStatus: true, imageStatus: true },
  });
  console.log(JSON.stringify({ job: j, order: o }, null, 2));
  await p.$disconnect();
}

main();
