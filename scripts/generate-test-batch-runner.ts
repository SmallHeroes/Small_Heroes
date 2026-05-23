import { config as loadEnv } from 'dotenv';
import { generateStory as runPipeline } from '../lib/story-generator';
import { MVP_MATRIX as MATRIX } from '../lib/story-generator/data/mvp-matrix';

// Load environment from .env.local (wins) then .env — so OPENAI_API_KEY and
// other secrets are available without re-setting them per shell session.
// dotenv never overrides an already-set var, so .env.local is loaded first.
// The LLM key is read at call-time (not import-time), so loading here — after
// the hoisted imports, before main() runs — is in time.
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

interface ResultRow {
  key: string;
  verdict: string;
  finalStatus: string;
  editorialVerdict: string;
  editorialScoresAvg: number | null;
  editorialIssues: number;
  zodParseFailed: boolean;
  cost: number;
  editorialCost: number;
  repairs: number;
  editorialRepairs: number;
  log: string;
}

async function main() {
  const results: ResultRow[] = [];

  // v0.3.2: optional filter — set BATCH_COMPANION=bolly_armadillo and/or
  // BATCH_DIRECTION=bedtime to run a subset of the 9-story matrix.
  const companionFilter = process.env.BATCH_COMPANION?.trim();
  const directionFilter = process.env.BATCH_DIRECTION?.trim();
  const filtered = MATRIX.filter((input) => {
    if (companionFilter && input.companionId !== companionFilter) return false;
    if (directionFilter && input.direction !== directionFilter) return false;
    return true;
  });
  if (filtered.length === 0) {
    console.error(`No stories match filter (companion=${companionFilter ?? '*'}, direction=${directionFilter ?? '*'})`);
    process.exit(1);
  }
  if (filtered.length < MATRIX.length) {
    console.log(`Filtered to ${filtered.length} stories (companion=${companionFilter ?? '*'}, direction=${directionFilter ?? '*'})`);
  }

  for (const input of filtered) {
    const key = `${input.companionId}_${input.direction}`;
    console.log(`\n=== Generating ${key} ===`);
    try {
      const out = await runPipeline(input);
      const editorialAvg = out.editorialReport
        ? Number(
            (
              Object.values(out.editorialReport.scores).reduce((a, b) => a + b, 0) /
              Object.values(out.editorialReport.scores).length
            ).toFixed(2)
          )
        : null;
      const zodFailed =
        out.finalStatus === 'REVIEW_REQUIRED' && (editorialAvg === 3 || editorialAvg === null);

      const row: ResultRow = {
        key,
        verdict: out.validationReport.verdict,
        finalStatus: out.finalStatus ?? 'READY',
        editorialVerdict: out.editorialReport?.verdict ?? 'N/A',
        editorialScoresAvg: editorialAvg,
        editorialIssues: out.editorialReport?.issues.length ?? 0,
        zodParseFailed: zodFailed,
        cost: out.costUsd,
        editorialCost: (out.editorialQaCostUsd ?? 0) + (out.editorialRepairCostUsd ?? 0),
        repairs: out.repairAttempts,
        editorialRepairs: out.editorialRepairAttempts ?? 0,
        log: out.qaLogPath,
      };
      results.push(row);

      const issuesArr = out.editorialReport?.issues ?? [];
      const blocking = issuesArr.filter((i) => i.severity === 'BLOCKING').length;
      const major = issuesArr.filter((i) => i.severity === 'MAJOR').length;
      const minor = issuesArr.filter((i) => i.severity === 'MINOR').length;
      const unmatched = issuesArr.filter((i) => (i as { _unmatchedQuote?: boolean })._unmatchedQuote).length;
      const minDim = out.editorialReport
        ? Math.min(...Object.values(out.editorialReport.scores))
        : null;

      const icon = row.finalStatus === 'READY' ? '✓' : '⚠';
      const reviewReason = (out as { reviewReason?: string }).reviewReason ?? 'none';
      console.log(
        `${icon} ${key} | tech=${row.verdict} | editorial=${row.editorialVerdict} | finalStatus=${row.finalStatus}${row.finalStatus !== 'READY' ? ` (reason=${reviewReason})` : ''}`
      );
      console.log(
        `   avg=${editorialAvg ?? 'n/a'} min=${minDim ?? 'n/a'} issues=${blocking}/${major}/${minor} (B/M/m) unmatched=${unmatched} parse=${row.zodParseFailed ? 'FAILED' : 'ok'}`
      );
      console.log(
        `   $${row.cost.toFixed(3)} (editorial $${row.editorialCost.toFixed(4)}) | repairs=${row.repairs}+${row.editorialRepairs}`
      );
      console.log(`   log: ${row.log}`);
    } catch (err) {
      console.error(`✗ ${key} failed:`, err instanceof Error ? err.message : err);
      results.push({
        key,
        verdict: 'ERROR',
        finalStatus: 'FAILED_TECHNICAL',
        editorialVerdict: 'N/A',
        editorialScoresAvg: null,
        editorialIssues: 0,
        zodParseFailed: false,
        cost: 0,
        editorialCost: 0,
        repairs: -1,
        editorialRepairs: 0,
        log: '',
      });
    }
  }

  const ready = results.filter((r) => r.finalStatus === 'READY').length;
  const review = results.filter((r) => r.finalStatus === 'REVIEW_REQUIRED').length;
  const editorialRejected = results.filter((r) => r.finalStatus === 'REJECTED_EDITORIAL').length;
  const technicalFailed = results.filter((r) => r.finalStatus === 'FAILED_TECHNICAL').length;
  const zodFailures = results.filter((r) => r.zodParseFailed).length;

  console.log(`\n=== Batch complete ===`);
  console.log(`  READY:               ${ready}/${results.length}`);
  console.log(`  REVIEW_REQUIRED:     ${review}/${results.length}`);
  console.log(`  REJECTED_EDITORIAL:  ${editorialRejected}/${results.length}`);
  console.log(`  FAILED_TECHNICAL:    ${technicalFailed}/${results.length}`);
  if (zodFailures > 0) {
    console.log(`  ⚠ Zod parse failures: ${zodFailures} — editorial may be effectively bypassed`);
  }
  const avgCost = results.reduce((s, r) => s + r.cost, 0) / results.length;
  console.log(`Average cost: $${avgCost.toFixed(3)}`);

  if (ready < results.length) process.exit(1);
}

main();
