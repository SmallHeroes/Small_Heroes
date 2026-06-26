#!/usr/bin/env tsx
/**
 * Pre-deploy release check — fails before ship if F&F v3 config is incomplete.
 * Does NOT run in production runtime; invoke in CI or before deploy only.
 *
 *   npm run release-check
 *   ENABLE_V3_APPROVED_BANK=true npm run release-check
 */
import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';

const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  loadEnv({ path: envLocal });
}

const DIRECTIONS = ['bedtime', 'adventure', 'fantasy'] as const;
const REQUIRED_GENERATION_JOB_COLUMNS = [
  'staleReclaimCount',
  'lastReclaimStage',
  'lastChainStatus',
  'lastChainError',
  'lastWorkerKickAt',
] as const;

async function checkGenerationJobSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log('[release-check] DB schema check skipped: DATABASE_URL is not configured');
    return;
  }
  if (process.env.SKIP_DB_SCHEMA_CHECK === 'true') {
    console.log('[release-check] DB schema check skipped: SKIP_DB_SCHEMA_CHECK=true');
    return;
  }

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'GenerationJob'
        and column_name in (
          'staleReclaimCount',
          'lastReclaimStage',
          'lastChainStatus',
          'lastChainError',
          'lastWorkerKickAt'
        )
    `;
    const existing = new Set(rows.map((row) => row.column_name));
    const missing = REQUIRED_GENERATION_JOB_COLUMNS.filter((column) => !existing.has(column));
    if (missing.length > 0) {
      console.error('');
      console.error('[release-check] FAIL - database schema is behind the code.');
      console.error(`[release-check] Missing GenerationJob columns: ${missing.join(', ')}`);
      console.error(
        '[release-check] Apply backend/migrations/20260624_generation_job_reliability/migration.sql before rendering.'
      );
      process.exit(1);
    }
    console.log('[release-check] DB schema check PASS');
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const { allMvpCategories, configuredSlotStatus, isSlotSellable } = await import(
    '../backend/config/mvp-story-matrix'
  );

  function v3ApprovedSlots(): string[] {
    const slots: string[] = [];
    for (const category of allMvpCategories()) {
      for (const direction of DIRECTIONS) {
        if (configuredSlotStatus(category, direction) === 'approved_v3') {
          slots.push(`${category}.${direction}`);
        }
      }
    }
    return slots;
  }

  function countSellable(): number {
    let n = 0;
    for (const category of allMvpCategories()) {
      for (const direction of DIRECTIONS) {
        if (isSlotSellable(category, direction)) n += 1;
      }
    }
    return n;
  }

  const flag = String(process.env.ENABLE_V3_APPROVED_BANK ?? '').trim().toLowerCase();
  const v3Enabled = flag === 'true' || flag === '1';
  const v3Slots = v3ApprovedSlots();
  const sellable = countSellable();

  console.log(`[release-check] ENABLE_V3_APPROVED_BANK=${flag || '(unset)'}`);
  console.log(`[release-check] sellable matrix slots: ${sellable}/18`);
  console.log(`[release-check] configured approved_v3 slots: ${v3Slots.join(', ') || '(none)'}`);

  if (!v3Enabled && v3Slots.length > 0) {
    console.error('');
    console.error('[release-check] FAIL — F&F config incomplete.');
    console.error(
      `[release-check] Set ENABLE_V3_APPROVED_BANK=true or v3 slots are unsellable: ${v3Slots.join(', ')}`
    );
    console.error(`[release-check] Current sellable count: ${sellable}/18 (expected 8/18 at launch)`);
    process.exit(1);
  }

  if (v3Enabled && sellable < 8) {
    console.warn(
      `[release-check] WARN — flag ON but only ${sellable}/18 sellable (expected ≥8). Check bank files + import sidecars.`
    );
  }

  await checkGenerationJobSchema();

  console.log('[release-check] PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
