#!/usr/bin/env npx tsx
/**
 * audit-power-cards.ts — validate powerCard frontmatter on golden shelf stories.
 *
 * Usage:
 *   npx tsx scripts/audit-power-cards.ts
 *   npx tsx scripts/audit-power-cards.ts --json
 *   npx tsx scripts/audit-power-cards.ts --warnings   # include warnings in exit code
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  GOLDEN_SHELF_POWER_CARD_SLUGS,
  GOLDEN_SHELF_STORY_DIR,
  goldenShelfStoryFilename,
  parseAndValidateStoryPowerCard,
  type PowerCardValidationIssue,
} from '../lib/power-cards';

const JSON_FLAG = process.argv.includes('--json');
const WARNINGS_FAIL = process.argv.includes('--warnings');

interface AuditRow {
  slug: string;
  ok: boolean;
  title?: string;
  issues: PowerCardValidationIssue[];
}

function formatIssue(issue: PowerCardValidationIssue): string {
  const tag = issue.severity === 'error' ? 'ERROR' : 'WARN';
  return `[${tag}] ${issue.path}: ${issue.message}`;
}

function main(): number {
  const storyDir = path.join(process.cwd(), GOLDEN_SHELF_STORY_DIR);
  const rows: AuditRow[] = [];

  for (const slug of GOLDEN_SHELF_POWER_CARD_SLUGS) {
    const filePath = path.join(storyDir, goldenShelfStoryFilename(slug));
    if (!fs.existsSync(filePath)) {
      rows.push({
        slug,
        ok: false,
        issues: [
          {
            path: slug,
            severity: 'error',
            message: `Story file not found: ${goldenShelfStoryFilename(slug)}`,
          },
        ],
      });
      continue;
    }

    const markdown = fs.readFileSync(filePath, 'utf8');
    const result = parseAndValidateStoryPowerCard(markdown, slug);
    const blocking = result.issues.filter(
      (i) => i.severity === 'error' || (WARNINGS_FAIL && i.severity === 'warning'),
    );
    rows.push({
      slug,
      ok: blocking.length === 0 && result.spec != null,
      title: result.spec?.title,
      issues: result.issues,
    });
  }

  const failed = rows.filter((r) => !r.ok);
  const warned = rows.filter((r) => r.ok && r.issues.some((i) => i.severity === 'warning'));

  if (JSON_FLAG) {
    console.log(JSON.stringify({ total: rows.length, failed: failed.length, rows }, null, 2));
  } else {
    console.log(`Power Card audit — golden shelf (${rows.length} stories)\n`);
    for (const row of rows) {
      const status = row.ok ? (row.issues.length ? 'OK (warnings)' : 'OK') : 'FAIL';
      console.log(`${status.padEnd(14)} ${row.slug}${row.title ? ` — ${row.title}` : ''}`);
      for (const issue of row.issues) {
        console.log(`  ${formatIssue(issue)}`);
      }
    }
    console.log(`\nSummary: ${rows.length - failed.length}/${rows.length} passed`);
    if (warned.length > 0 && !WARNINGS_FAIL) {
      console.log(`${warned.length} passed with warnings (use --warnings to fail on warnings)`);
    }
    if (failed.length > 0) {
      console.log('\nFix the errors above in the story frontmatter powerCard: block.');
    }
  }

  return failed.length > 0 ? 1 : 0;
}

process.exit(main());
