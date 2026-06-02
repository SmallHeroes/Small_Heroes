// Usage: npx tsx scripts/check-dup-assets.mjs <orderId>
// Verifies no duplicate paid ImageAssets for one order.
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: npx tsx scripts/check-dup-assets.mjs <orderId>');
  process.exit(1);
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const rows = await prisma.$queryRaw`
  select
    count(*)::int                                              as image_assets,
    count(*) filter (where ia."idempotencyKey" is null)::int   as null_keys,
    (count(*) - count(distinct ia."idempotencyKey"))::int      as duplicate_keys
  from "ImageAsset" ia
  join "BookPage" bp on bp.id = ia."pageId"
  join "GeneratedBook" gb on gb.id = bp."bookId"
  where gb."orderId" = ${orderId};
`;

console.log('Order:', orderId);
console.log(JSON.stringify(rows[0], null, 2));
console.log(
  rows[0].duplicate_keys === 0 && rows[0].null_keys === 0
    ? 'PASS — no duplicate paid generation'
    : 'FAIL — investigate duplicates / null keys'
);

await prisma.$disconnect();
