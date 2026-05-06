/**
 * One-time migration: add childSuperpower + familyContext columns to Order table.
 *
 * Run once from your terminal (Windows / Mac / Linux — anywhere the project runs):
 *
 *   npx ts-node scripts/migrate-add-superpower-family.ts
 *
 * It is safe to run multiple times — uses IF NOT EXISTS.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Applying migration: add childSuperpower + familyContext to Order...');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Order"
    ADD COLUMN IF NOT EXISTS "childSuperpower" TEXT,
    ADD COLUMN IF NOT EXISTS "familyContext"   JSONB;
  `);

  // Verify columns exist
  const cols = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'Order'
      AND column_name IN ('childSuperpower', 'familyContext')
    ORDER BY column_name;
  `;

  if (cols.length === 2) {
    console.log('✓ Migration complete. Columns confirmed:');
    cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  } else {
    console.error('✗ Migration may have failed — expected 2 columns, found:', cols);
    process.exit(1);
  }
}

main()
  .catch(err => { console.error('Migration error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
