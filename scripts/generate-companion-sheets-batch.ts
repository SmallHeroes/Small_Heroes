/**
 * Batch-generate companion Style 01 character sheets.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheets-batch.ts dragon_dini fox_uri
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheets-batch.ts --pilot
 */
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const PILOT_IDS = ['dragon_dini', 'fox_uri', 'octopus_seara'];

async function main() {
  const publish = process.argv.includes('--publish');
  const rawArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const ids =
    rawArgs.includes('--pilot') || rawArgs.length === 0
      ? PILOT_IDS
      : rawArgs;

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required');
    process.exit(1);
  }

  const { spawn } = await import('child_process');
  const script = 'scripts/generate-companion-sheet.ts';
  const shim = './scripts/shims/register-server-only.cjs';

  for (const companionId of ids) {
    console.log(`\n=== Batch: ${companionId} ===\n`);
    const args = ['tsx', '--require', shim, script, companionId];
    if (publish) args.push('--publish');

    await new Promise<void>((resolve, reject) => {
      const child = spawn('npx', args, {
        stdio: 'inherit',
        shell: true,
        cwd: process.cwd(),
      });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${companionId} exited ${code}`));
      });
    });
  }

  console.log('\n[batch] All companions finished.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
