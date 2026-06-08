/**
 * Bounded loop routing validation — REWRITE / HUMAN_REVIEW / FAIL + no-fail-open.
 * Existing probe artifacts only. No new story generation.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-bounded-loop-routing-validation.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import {
  classifyDeterministicGate,
  describeTasteDelta,
  injectDeterministicFault,
  loadBollyB4FinalArtifact,
  loadProbeRoutingFixtures,
} from '../lib/story-gen/probe-loop-fixtures';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import { patchWritersRoomOutline } from '../lib/story-gen/writers-room-artifact-patches';
import type { StoryOutline } from '../lib/story-gen/story-generation-types';
import { DEFAULT_STORY_GEN_MODELS } from '../lib/story-gen/story-generation-types';
import {
  formatWritersRoomRoutingTable,
  runWritersRoomBoundedLoop,
  type WritersRoomBoundedLoopReport,
} from '../lib/story-gen/writers-room-bounded-loop';

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function initialTasteVerdict(report: WritersRoomBoundedLoopReport): string {
  return report.tasteBefore?.verdict ?? report.finalTaste.verdict;
}

function preservationSummary(report: WritersRoomBoundedLoopReport): string {
  if (!report.authorRewriteUsed) return '—';
  if (!report.preservation) return 'missing';
  return report.preservation.verdict;
}

function preservationCodes(report: WritersRoomBoundedLoopReport): string {
  if (!report.preservation?.failureCodes.length) return '—';
  return report.preservation.failureCodes.join(', ');
}

function routingRow(report: WritersRoomBoundedLoopReport): string {
  const initial = initialTasteVerdict(report);
  const rewrite = report.authorRewriteUsed ? 'yes' : 'no';
  const postRewriteTaste =
    report.tasteAfter?.verdict ?? (report.authorRewriteUsed ? '—' : report.finalTaste.verdict);
  return `| ${report.scenarioId} | ${initial} | ${rewrite} | ${postRewriteTaste} | ${preservationSummary(report)} | ${preservationCodes(report)} | ${report.terminal} | tech=${report.technicalPass ? 'PASS' : 'FAIL'} |`;
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rootOut = path.join(
    process.cwd(),
    'outputs',
    'writers-room-canary',
    `routing-validation-${timestamp}`
  );
  fs.mkdirSync(rootOut, { recursive: true });

  console.log(`[routing-val] → ${rootOut}`);

  const partAReports: WritersRoomBoundedLoopReport[] = [];
  const violations: string[] = [];
  const surprises: string[] = [];

  for (const fixture of loadProbeRoutingFixtures()) {
    console.log(`[routing-val] Part A: ${fixture.probeId}...`);
    const report = await runWritersRoomBoundedLoop({
      storyMarkdown: fixture.storyMarkdown,
      scenario: fixture.scenario,
      outline: fixture.outline,
      reportId: fixture.probeId,
      runLabel: `routing-val-${fixture.probeId}`,
      skipProofread: true,
      skipAdventureEnrich: true,
      ignoreWordBandThinness: true,
      blockAuthorRewrite: fixture.blockAuthorRewrite,
    });

    partAReports.push(report);

    const outDir = path.join(rootOut, fixture.probeId);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'report.json'),
      JSON.stringify(report, null, 2),
      'utf8'
    );

    const initial = initialTasteVerdict(report);
    if (
      (fixture.expectNoRewrite ||
        ['HUMAN_REVIEW', 'FAIL'].includes(initial)) &&
      report.authorRewriteUsed
    ) {
      violations.push(`${fixture.probeId}: must NOT trigger author rewrite (got rewrite)`);
    }
    if (
      fixture.expectNeverBankReady &&
      report.terminal === 'bank_ready_candidate' &&
      !report.authorRewriteUsed
    ) {
      violations.push(`${fixture.probeId}: must NOT route bank_ready_candidate on initial pass`);
    }
    if (report.authorRewriteUsed && report.terminal === 'bank_ready_candidate') {
      violations.push(
        `${fixture.probeId}: post-rewrite must NOT terminal as bank_ready_candidate (got ${report.terminal})`
      );
    }
    if (
      report.authorRewriteUsed &&
      report.preservation?.verdict === 'fail' &&
      report.terminal !== 'needs_human_review'
    ) {
      violations.push(
        `${fixture.probeId}: preservation FAIL must route needs_human_review (got ${report.terminal})`
      );
    }
    if (
      fixture.probeId === 'boring_1' &&
      report.authorRewriteUsed &&
      report.preservation?.verdict !== 'fail' &&
      report.preservation?.failureCodes.some((c) =>
        ['COMPANION_LAUNDERING', 'COMPANION_IDENTITY_CHANGED', 'SPECIES_CHANGED'].includes(c)
      ) === false &&
      report.finalTaste.verdict === 'BANK_READY'
    ) {
      surprises.push(
        `boring_1: post-rewrite BANK_READY without companion laundering codes — verify prose identity manually`
      );
    }
    if (fixture.probeId === 'midtier_1' && initial !== 'REWRITE') {
      surprises.push(`midtier_1: taste ${initial} (calibration expected REWRITE) — still routes STRONG_DRAFT terminal without rewrite`);
    }
    if (
      fixture.probeId === 'beautiful_but_wrong_moths_song' &&
      !['HUMAN_REVIEW', 'FAIL'].includes(initial)
    ) {
      surprises.push(
        `beautiful_but_wrong: taste ${initial} not HUMAN_REVIEW/FAIL — rewrite blocked by fixture; terminal=${report.terminal}`
      );
    }
    if (
      ['HUMAN_REVIEW', 'FAIL'].includes(initial) &&
      report.authorRewriteUsed
    ) {
      violations.push(
        `${fixture.probeId}: HUMAN_REVIEW/FAIL must not trigger rewrite (initial=${initial})`
      );
    }

    console.log(
      `[routing-val] ${fixture.probeId}: initial=${initial} rewrite=${report.authorRewriteUsed} terminal=${report.terminal}`
    );
  }

  console.log('[routing-val] Part B: no-fail-open (bare child gender injection on B4)...');
  const b4Scenario = resolveScenarioById('bolly_b4_hacheder_bed');
  const b4Outline = patchWritersRoomOutline(
    'bolly_b4_hacheder_bed',
    readJson<StoryOutline>(
      path.join(
        process.cwd(),
        'outputs',
        'story-gen-runs',
        '2026-06-07T19-11-50-756Z',
        'outline.json'
      )
    )
  );
  const cleanB4 = loadBollyB4FinalArtifact();
  const corruptedB4 = injectDeterministicFault(cleanB4, 'bare_child_gender');

  const partBReport = await runWritersRoomBoundedLoop({
    storyMarkdown: corruptedB4,
    scenario: b4Scenario,
    outline: b4Outline,
    reportId: 'part_b_b4_bare_gender_fault',
    runLabel: 'routing-val-no-fail-open',
    skipProofread: true,
    skipAdventureEnrich: true,
  });

  const rawTaste = partBReport.tasteBefore?.verdict ?? partBReport.finalTaste.verdict;
  const blockingGate = classifyDeterministicGate(partBReport.technicalFailures);
  const tastePassLike = rawTaste === 'BANK_READY' || rawTaste === 'STRONG_DRAFT';
  const terminalBlocked = !['bank_ready_candidate', 'strong_draft_needs_light_human_polish'].includes(
    partBReport.terminal
  );

  if (!partBReport.technicalPass) {
    // expected
  } else {
    violations.push('Part B: expected technical FAIL on injected fault');
  }
  if (!terminalBlocked) {
    violations.push(
      `Part B: terminal must not be ship-ready (got ${partBReport.terminal})`
    );
  }
  if (!tastePassLike) {
    violations.push(
      `Part B: expected raw taste BANK_READY or STRONG_DRAFT (got ${rawTaste}) — injection should not change taste`
    );
  }

  fs.writeFileSync(
    path.join(rootOut, 'part-b-report.json'),
    JSON.stringify(
      {
        rawTasteVerdict: rawTaste,
        blockingGate,
        terminal: partBReport.terminal,
        technicalPass: partBReport.technicalPass,
        technicalFailures: partBReport.technicalFailures,
        tastePassDespiteTechFail: tastePassLike && !partBReport.technicalPass,
        blockedDespiteTastePass: tastePassLike && terminalBlocked,
      },
      null,
      2
    ),
    'utf8'
  );

  const routingTableHeader =
    '| item | initial taste | rewrite? | post-rewrite taste | preservation | failure codes | terminal | technical |';
  const routingTableSep =
    '| --- | --- | --- | --- | --- | --- | --- | --- |';
  const routingRows = partAReports.map(routingRow);
  const partBRow = routingRow(partBReport);

  const rewriteNotes = partAReports
    .filter((r) => r.authorRewriteUsed)
    .map((r) => {
      const delta = r.tasteAfter
        ? describeTasteDelta(r.tasteBefore!, r.tasteAfter)
        : 'unknown';
      const techAfter = r.technicalPass ? 'PASS' : 'FAIL';
      const pres = r.preservation
        ? `${r.preservation.verdict} [${r.preservation.failureCodes.join(', ') || 'none'}]`
        : 'n/a';
      const presReasons = r.preservation?.reasons.slice(0, 2).join(' · ') ?? '';
      return `- **${r.scenarioId}**: before=${r.tasteBefore?.verdict} after=${r.finalTaste.verdict} (${delta}); tech=${techAfter}; preservation=${pres}; terminal=${r.terminal}${presReasons ? `; ${presReasons}` : ''}`;
    });

  const postRewriteBankReady = partAReports.filter(
    (r) =>
      r.authorRewriteUsed &&
      r.finalTaste.verdict === 'BANK_READY'
  );
  const anyPostRewriteBankReadyCandidate = partAReports.some(
    (r) => r.authorRewriteUsed && r.terminal === 'bank_ready_candidate'
  );

  const reportMd = [
    '# Bounded Loop — Routing Validation',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Model: ${DEFAULT_STORY_GEN_MODELS.judgeModel}`,
    `Gate: ${violations.length === 0 ? 'PASS' : 'FAIL'}`,
    '',
    '## Part A — routing table',
    '',
    routingTableHeader,
    routingTableSep,
    ...routingRows,
    '',
    '## Part B — no-fail-open (B4 + bare masculine verb)',
    '',
    routingTableHeader,
    routingTableSep,
    partBRow,
    '',
    `- **Raw taste verdict (corrupted story):** ${rawTaste}`,
    `- **Blocking gate:** ${blockingGate}`,
    `- **Technical failures:** ${partBReport.technicalFailures.join('; ') || '(none)'}`,
    `- **Final terminal:** ${partBReport.terminal}`,
    `- **Confirmation:** final state is **${terminalBlocked ? 'BLOCKED' : 'NOT BLOCKED'}** even though raw taste is **${rawTaste}** (${tastePassLike ? 'PASS-like' : 'not PASS-like'}).`,
  ];

  reportMd.push(
    '',
    '## Confirmations',
    '',
    `- No post-rewrite item terminaled as normal \`bank_ready_candidate\`: **${anyPostRewriteBankReadyCandidate ? 'FAIL' : 'PASS'}**`,
    `- Post-rewrite BANK_READY count: ${postRewriteBankReady.length} (must route to post_rewrite_bank_ready_candidate_needs_human_review or needs_human_review)`,
    `- HUMAN_REVIEW/FAIL rewrite triggers: checked per item`,
    `- Max one rewrite per item: enforced by loop`,
    `- Part B no-fail-open: ${terminalBlocked && !partBReport.technicalPass ? 'PASS' : 'see violations'}`,
  );

  if (rewriteNotes.length) {
    reportMd.push('', '## Rewrite before/after', '', ...rewriteNotes);
  } else {
    reportMd.push('', '## Rewrite before/after', '', '(no Part A items triggered author rewrite)');
  }

  if (surprises.length) {
    reportMd.push('', '## Surprises', '', ...surprises.map((s) => `- ${s}`));
  }

  if (violations.length) {
    reportMd.push('', '## Violations', '', ...violations.map((v) => `- ${v}`));
  }

  reportMd.push(
    '',
    '## Recommendation',
    violations.length === 0
      ? 'Routing + no-fail-open validated. Ready for ONE truly-new generated story through the full machine.'
      : 'Fix violations before generating new stories.',
    '',
    '**HARD STOP** — no new story generation in this run.'
  );

  fs.writeFileSync(path.join(rootOut, 'summary.md'), reportMd.join('\n'), 'utf8');

  console.log('\n' + routingTableHeader);
  console.log(routingTableSep);
  for (const row of routingRows) console.log(row);
  console.log('\nPart B:');
  console.log(partBRow);
  console.log(`\n[routing-val] Gate: ${violations.length === 0 ? 'PASS' : 'FAIL'}`);
  if (violations.length) console.log(violations.join('\n'));
  console.log(`[routing-val] Wrote ${rootOut}/summary.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
