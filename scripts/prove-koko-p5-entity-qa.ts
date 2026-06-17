/**
 * 0074 gate proof — run hardened entity QA on a local page image (no re-render).
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/prove-koko-p5-entity-qa.ts \
 *     outputs/style01-auditions/qa-console-chameleon_koko-fantasy-low-20260617-150039/page-05.png
 */
import { readFileSync } from 'fs';
import path from 'path';

import './shims/register-server-only.cjs';

import { evaluatePageEntityQa, entityQaHardFailSummary } from '../lib/generation-pipeline/page-entity-qa';

async function main(): Promise<void> {
  const arg = process.argv[2]?.trim();
  if (!arg) {
    console.error('Usage: prove-koko-p5-entity-qa.ts <path-or-url-to-page-05.png>');
    process.exit(1);
  }

  let imageUrl: string;
  if (arg.startsWith('http://') || arg.startsWith('https://')) {
    imageUrl = arg;
  } else {
    const abs = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
    const buf = readFileSync(abs);
    imageUrl = `data:image/png;base64,${buf.toString('base64')}`;
    console.log(`[prove] local file ${abs} (${buf.length} bytes)`);
  }

  const result = await evaluatePageEntityQa({
    imageUrl,
    companionId: 'chameleon_koko',
    companionName: 'קים',
    expectsCompanion: true,
    expectsChild: true,
  });

  console.log('\n=== Entity QA proof ===');
  console.log(`Image: ${arg}`);
  console.log(`Status: ${result.status}`);
  console.log(`Passed: ${result.passed}`);
  console.log(`Hard failures: ${result.hardFailures.join(', ') || '(none)'}`);
  console.log(`Summary: ${entityQaHardFailSummary(result)}`);
  if (result.raw) console.log(`Raw: ${JSON.stringify(result.raw, null, 2)}`);

  if (result.status !== 'fail' || !result.hardFailures.includes('duplicate_companion')) {
    console.error('\nExpected hard-fail duplicate_companion on 3-Kim image');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
