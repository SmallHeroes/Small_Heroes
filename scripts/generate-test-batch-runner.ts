import { generateStory as runPipeline } from '../lib/story-generator';
import { MVP_MATRIX as MATRIX } from '../lib/story-generator/data/mvp-matrix';

async function main() {
  const results: Array<{ key: string; verdict: string; cost: number; repairs: number; log: string }> = [];

  for (const input of MATRIX) {
    const key = `${input.companionId}_${input.direction}`;
    console.log(`\n=== Generating ${key} ===`);
    try {
      const out = await runPipeline(input);
      results.push({
        key,
        verdict: out.validationReport.verdict,
        cost: out.costUsd,
        repairs: out.repairAttempts,
        log: out.qaLogPath,
      });
      console.log(`✓ ${key} ${out.validationReport.verdict} | $${out.costUsd.toFixed(3)} | repairs=${out.repairAttempts}`);
      console.log(`  log: ${out.qaLogPath}`);
    } catch (err) {
      console.error(`✗ ${key} failed:`, err instanceof Error ? err.message : err);
      results.push({ key, verdict: 'ERROR', cost: 0, repairs: -1, log: '' });
    }
  }

  const passed = results.filter((r) => r.verdict === 'PASS').length;
  console.log(`\n=== Batch complete: ${passed}/${results.length} PASS ===`);
  const avgCost = results.reduce((s, r) => s + r.cost, 0) / results.length;
  console.log(`Average cost: $${avgCost.toFixed(3)}`);

  if (passed < results.length) process.exit(1);
}

main();
