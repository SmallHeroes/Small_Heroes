/**
 * Step 5 — Dini fantasy generalization probe (ONE story, NO self-leakage).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-step5-dini-fantasy-probe.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { generateStoryFromScenario } from '../lib/story-gen/generate-story';
import { loadGoldenFewShots } from '../lib/story-gen/golden-few-shots';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import { DINI_F1_HATISA_HARISHONA } from '../lib/story-gen/scenarios-dragon-dini';
import type { StoryGenModelConfig } from '../lib/story-gen/story-generation-types';
import {
  runWritersRoomBoundedLoop,
  type WritersRoomBoundedLoopReport,
} from '../lib/story-gen/writers-room-bounded-loop';

const MODEL = 'gpt-5-chat-latest';
const SCENARIO_ID = DINI_F1_HATISA_HARISHONA.id;

function lexicalTable(loop: WritersRoomBoundedLoopReport): string[] {
  const lex = loop.hebrewLexical;
  if (!lex) return ['- (lexical gate not run)'];
  const lines = [
    `| Severity | Count |`,
    `|----------|-------|`,
    `| BLOCKER | ${lex.routing.blockerCount} |`,
    `| High-severity prose REVIEW | ${lex.routing.highSeverityProseReviewCount} |`,
    `| ALLOW | ${lex.allowCount} |`,
    `| Demoted LLM BLOCKERs | ${lex.demotedLlmBlockerCount} |`,
  ];
  for (const sev of ['BLOCKER', 'REVIEW', 'ALLOW'] as const) {
    const items = lex.findings.filter((f) => f.severity === sev);
    if (!items.length) continue;
    lines.push('', `### ${sev}`, '');
    for (const f of items) {
      lines.push(
        `- p${f.page} [${f.domain}/${f.source}]: "${f.original.slice(0, 72)}" — ${f.issue.slice(0, 120)}`
      );
    }
  }
  return lines;
}

function freshnessVsDiniGolden(loop: WritersRoomBoundedLoopReport): string[] {
  const dims = loop.freshnessTest.dimensions ?? [];
  const diniHits = dims.filter(
    (d) =>
      d.nearestMatchId.includes('dragon_dini') ||
      d.nearestMatchId === 'dragon_dini_fantasy'
  );
  const eggShape = dims.filter(
    (d) =>
      /egg|wrap|ביצה|עטיפ/i.test(d.dimensionId) ||
      /egg|wrap|ביצה|עטיפ/i.test(d.nearestMatchId)
  );
  const lines: string[] = [];
  if (diniHits.length) {
    lines.push('**Nearest to Dini golden / dragon_dini:**');
    for (const h of diniHits) {
      lines.push(
        `- ${h.dimensionId}: nearest=${h.nearestMatchId} overlap=${h.overlapScore} effective=${h.effectiveScore} → ${h.recommendation}`
      );
    }
  } else {
    lines.push('- No dimension flagged nearest match to dragon_dini golden (good for shape copy).');
  }
  lines.push('', `**Freshness recommendation:** ${loop.freshnessTest.recommendation}`);
  lines.push(`**Shape overlap max:** ${loop.freshnessTest.shapeOverlapMax}`);
  if (eggShape.length) {
    lines.push('', '**Egg/wrap dimension hits (watch):**');
    for (const h of eggShape) {
      lines.push(`- ${h.dimensionId}: ${h.nearestMatchId} (${h.overlapScore})`);
    }
  }
  return lines;
}

function probeVerdict(loop: WritersRoomBoundedLoopReport): {
  pass: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const lex = loop.hebrewLexical?.routing;
  const blockers = lex?.blockerCount ?? 99;
  const proseReview = lex?.highSeverityProseReviewCount ?? 99;
  const terminalOk = [
    'bank_ready_candidate',
    'strong_draft_needs_light_human_polish',
    'post_rewrite_bank_ready_candidate_needs_human_review',
  ].includes(loop.terminal);

  if (!terminalOk) reasons.push(`terminal=${loop.terminal}`);
  if (blockers > 0) reasons.push(`lexical BLOCKERs=${blockers}`);
  if (proseReview > 2) reasons.push(`prose REVIEW count=${proseReview} (>2)`);
  if (!loop.technicalPass) reasons.push('technical FAIL');

  const shapeMax = loop.freshnessTest.shapeOverlapMax ?? 0;
  if (shapeMax >= 5) reasons.push(`freshness shapeOverlapMax=${shapeMax} (egg-copy risk)`);

  return { pass: reasons.length === 0, reasons };
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-runs',
    `step5-dini-f1-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  const scenario = resolveScenarioById(SCENARIO_ID);
  const fewShots = loadGoldenFewShots('fantasy', 3, scenario.companionId);
  const fewShotNames = fewShots.map((s) => s.filename).join(', ');

  console.log(`[step5] → ${runDir}`);
  console.log(`[step5] scenario=${SCENARIO_ID} beats=${scenario.beatCount}`);
  console.log(`[step5] few-shots (NO self-leakage): ${fewShotNames || '(none)'}`);

  const modelConfig: StoryGenModelConfig = {
    draftModel: MODEL,
    judgeModel: MODEL,
    revisionModel: MODEL,
  };

  console.log('[step5] generate + pre-loop pipeline...');
  const draft = await generateStoryFromScenario({ scenario, modelConfig });

  fs.writeFileSync(path.join(runDir, 'outline.json'), JSON.stringify(draft.outline, null, 2));
  fs.writeFileSync(path.join(runDir, 'story.draft.md'), draft.storyMarkdown);
  fs.writeFileSync(
    path.join(runDir, 'few-shot-manifest.json'),
    JSON.stringify({ excluded: 'dragon_dini_fantasy.md', used: fewShots.map((s) => s.filename) }, null, 2)
  );

  console.log('[step5] full bounded loop...');
  const loop = await runWritersRoomBoundedLoop({
    storyMarkdown: draft.storyMarkdown,
    scenario,
    outline: draft.outline,
    reportId: SCENARIO_ID,
    runLabel: 'step5-dini-f1',
    judgeModel: MODEL,
    draftModel: MODEL,
  });

  fs.writeFileSync(path.join(runDir, 'story.md'), loop.finalStoryMarkdown, 'utf8');
  fs.writeFileSync(path.join(runDir, 'story.final.md'), loop.finalStoryMarkdown, 'utf8');
  fs.writeFileSync(path.join(runDir, 'bounded-loop-report.json'), JSON.stringify(loop, null, 2));

  if (loop.authorRewriteUsed) {
    fs.writeFileSync(path.join(runDir, 'story.before-rewrite.md'), draft.storyMarkdown, 'utf8');
    fs.writeFileSync(path.join(runDir, 'story.after-rewrite.md'), loop.finalStoryMarkdown, 'utf8');
  }

  const { pass, reasons } = probeVerdict(loop);
  const taste = loop.finalTaste;

  const report = [
    '# Step 5 — Dini fantasy generalization probe',
    '',
    `Run: \`${runDir}\``,
    `Scenario: \`${SCENARIO_ID}\` · beatCount=16 · model=${MODEL}`,
    '',
    '## Self-leakage guard',
    '',
    `- Few-shot EXCLUDED: \`dragon_dini_fantasy.md\``,
    `- Few-shot USED: ${fewShotNames}`,
    '- Dini golden IN freshness corpus (comparison only)',
    '',
    '## Terminal',
    '',
    `- **Final:** ${loop.terminal}`,
    `- Taste (pre-lexical): ${loop.tasteTerminal ?? '—'}`,
    `- Taste verdict: ${taste.verdict} (${taste.confidence})`,
    `- Author rewrite: ${loop.authorRewriteUsed ? 'yes' : 'no'}`,
    `- Technical: ${loop.technicalPass ? 'PASS' : 'FAIL'}`,
    '',
    '## Lexical severity',
    '',
    ...lexicalTable(loop),
    '',
    '## Freshness vs Dini golden',
    '',
    ...freshnessVsDiniGolden(loop),
    '',
    '## Gate stages',
    '',
    ...loop.stages.map((s) => `- **${s.stage}**: ${s.pass ? 'PASS' : 'FAIL'} — ${s.summary}`),
    '',
    '## Taste highlights',
    '',
    `- Weakest: p${taste.weakestPage.page} — ${taste.weakestPage.reason}`,
    `- Weakest line: "${taste.weakestLine}"`,
    `- Strongest: "${taste.strongestLine}"`,
    ...(taste.quotableLines?.length
      ? [`- Quotable: ${taste.quotableLines.map((q) => `"${q}"`).join(' · ')}`]
      : []),
    '',
    '## Probe verdict',
    '',
    pass ? '**PASS** — fantasy direction + Dini scenario generalizes with gates holding.' : `**HOLD/FAIL** — ${reasons.join('; ')}`,
    '',
    '**HARD STOP** — one story only; artifacts not committed.',
    '',
  ];

  if (loop.authorRewriteUsed && loop.preservation) {
    report.splice(
      report.indexOf('## Freshness vs Dini golden'),
      0,
      '## Rewrite preservation',
      '',
      `- Verdict: ${loop.preservation.verdict}`,
      `- Codes: ${loop.preservation.failureCodes.join(', ') || 'none'}`,
      ...(loop.tasteBefore && loop.tasteAfter
        ? [`- Taste: ${loop.tasteBefore.verdict} → ${loop.tasteAfter.verdict}`]
        : []),
      ''
    );
  }

  fs.writeFileSync(path.join(runDir, 'step5-probe-report.md'), report.join('\n'), 'utf8');

  console.log(`[step5] terminal=${loop.terminal} lexBlockers=${loop.lexicalRouting?.blockerCount} proseReview=${loop.lexicalRouting?.highSeverityProseReviewCount}`);
  console.log(`[step5] probe ${pass ? 'PASS' : 'HOLD'} → ${runDir}/step5-probe-report.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
