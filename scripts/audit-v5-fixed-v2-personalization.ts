/**
 * One-shot audit: every story-bank/v5-fixed-v2/*.md for personalization readiness.
 *
 * Simulates render for (boy, Baboo) and (girl, Mika) with bolly_armadillo companion name
 * where the story file specifies that companion.
 *
 * Usage:
 *   npx tsx scripts/audit-v5-fixed-v2-personalization.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { readdirSync } from 'fs';
import path from 'path';
import {
  runStoryPersonalizationGate,
  resolveStoryBankPlaceholders,
  type WizardPersonalizationContext,
} from '../lib/story-bank-personalization';
import { STORY_BANK_V3_DIR_NAME } from '../backend/providers/story-bank-index';

const BANK_DIR = path.join(process.cwd(), 'story-bank', STORY_BANK_V3_DIR_NAME);

const SCENARIOS: Array<{ label: string; ctx: WizardPersonalizationContext }> = [
  {
    label: 'boy/Baboo',
    ctx: { childName: 'Baboo', childGender: 'boy', companionName: 'בּוֹלִי' },
  },
  {
    label: 'girl/Mika',
    ctx: { childName: 'Mika', childGender: 'girl', companionName: 'בּוֹלִי' },
  },
];

type AuditRow = {
  file: string;
  scenario: string;
  failures: string[];
};

async function dryAuditPlaceholdersOnly(filename: string): Promise<AuditRow[]> {
  const filePath = path.join(BANK_DIR, filename);
  const raw = await import('fs/promises').then((fs) => fs.readFile(filePath, 'utf8'));
  const companionMatch = raw.match(/^companionId:\s*(\S+)/m);
  const companionName = companionMatch?.[1] === 'bolly_armadillo' ? 'בּוֹלִי' : 'צפרדע';
  const pageParts = raw.split(/---\s*Page\s*(\d+)\s*---/).slice(1);
  const rows: AuditRow[] = [];

  for (const { label, ctx } of SCENARIOS) {
    const effectiveCtx = { ...ctx, companionName };
    const pages: Array<{ pageNumber: number; text: string; imagePrompt: string }> = [];
    for (let i = 0; i < pageParts.length; i += 2) {
      const pageNumber = parseInt(pageParts[i]!, 10);
      const block = pageParts[i + 1] ?? '';
      const text = block.replace(/imageDirection:.*/g, '').trim();
      const imageDirection = (block.match(/imageDirection:\s*(.+)/)?.[1] ?? '').trim();
      pages.push({
        pageNumber,
        text: resolveStoryBankPlaceholders(text, effectiveCtx),
        imagePrompt: resolveStoryBankPlaceholders(imageDirection, effectiveCtx),
      });
    }
    const failures = runStoryPersonalizationGate({ wizard: effectiveCtx, pages });
    rows.push({ file: filename, scenario: label, failures });
  }
  return rows;
}

async function main(): Promise<void> {
  const files = readdirSync(BANK_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort();
  console.log(`Auditing ${files.length} stories in ${BANK_DIR}\n`);

  const allRows: AuditRow[] = [];
  for (const file of files) {
    const rows = await dryAuditPlaceholdersOnly(file);
    allRows.push(...rows);
    for (const row of rows) {
      if (row.failures.length === 0) continue;
      console.log(`FAIL ${row.file} [${row.scenario}]`);
      for (const f of row.failures) console.log(`  - ${f}`);
    }
  }

  const failCount = allRows.filter((r) => r.failures.length > 0).length;
  const outPath = path.join(process.cwd(), 'phase2-logs', `v5-fixed-v2-personalization-audit-${Date.now()}.json`);
  await import('fs/promises').then((fs) =>
    fs.mkdir(path.dirname(outPath), { recursive: true }).then(() =>
      fs.writeFile(outPath, JSON.stringify({ failCount, rows: allRows }, null, 2) + '\n', 'utf8')
    )
  );

  console.log(`\nDone — ${failCount} failing scenario(s). Report: ${outPath}`);
  if (failCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
