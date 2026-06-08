/**
 * Step 4.5 — retire S4, S6 allowlist verify, B2 single reroll (no batch).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-step4-5-finalize.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { generateStoryFromScenario } from '../lib/story-gen/generate-story';
import { applyLexicalTerminalCap } from '../lib/story-gen/hebrew-lexical-routing';
import { runHebrewLexicalProofread } from '../lib/story-gen/hebrew-lexical-proofread';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import { STEP4_ARTIFACT_STATUS } from '../lib/story-gen/step4-artifact-status';
import type { StoryGenModelConfig } from '../lib/story-gen/story-generation-types';
import {
  runWritersRoomBoundedLoop,
  terminalFromTaste,
  type WritersRoomBoundedLoopReport,
} from '../lib/story-gen/writers-room-bounded-loop';

const MODEL = 'gpt-5-chat-latest';
const BATCH = path.join(
  process.cwd(),
  'outputs',
  'writers-room-canary',
  'stability-batch-step4-2026-06-08T13-23-36-455Z'
);
const S6_PATH = path.join(BATCH, 'tubi_s6_ha_sheket_bed', 'story.md');
const S4_PATH = path.join(BATCH, 'tubi_s4_ha_raam_bed', 'story.md');
const B2_OLD_PATH = path.join(BATCH, 'bolly_b2_hamila_adv', 'story.md');
const B2_SCENARIO = 'bolly_b2_hamila_adv';

function gateTable(loop: WritersRoomBoundedLoopReport): string[] {
  const lex = loop.hebrewLexical?.routing;
  return [
    `| Gate | Value |`,
    `|------|-------|`,
    `| **Terminal** | ${loop.terminal} |`,
    `| Taste terminal (pre-lexical) | ${loop.tasteTerminal ?? '—'} |`,
    `| Taste verdict | ${loop.finalTaste.verdict} |`,
    `| Technical | ${loop.technicalPass ? 'PASS' : 'FAIL'} |`,
    `| Lexical BLOCKER | ${lex?.blockerCount ?? '—'} |`,
    `| High-severity prose REVIEW | ${lex?.highSeverityProseReviewCount ?? '—'} |`,
    `| Author rewrite | ${loop.authorRewriteUsed ? 'yes' : 'no'} |`,
    `| Preservation | ${loop.preservation?.verdict ?? 'n/a'} |`,
    `| Craft v2.1 | ${loop.craftV21.overall} / ${loop.craftV21.ladderPlacement} |`,
    `| Swap | ${loop.swapTest.verdict} |`,
    `| Freshness | ${loop.freshnessTest.recommendation} |`,
    ...loop.stages.map((s) => `| ${s.stage} | ${s.pass ? 'PASS' : 'FAIL'} — ${s.summary} |`),
  ];
}

function conceptualBeatCheck(markdown: string): string[] {
  const bare = markdown.replace(/[\u0591-\u05C7]/g, '');
  const checks: Array<{ label: string; ok: boolean }> = [
    {
      label: 'הצצה אחת נחשבת',
      ok: /הצצה אחת נחשבת/.test(bare),
    },
    {
      label: 'לא כל בולי בבת אחת',
      ok: /לא כל בולי בבת אחת/.test(bare),
    },
    {
      label: 'child whispers name / one word (שם chip or בקול רך)',
      ok: /\{שם\|שמה\}|בקול רך|השם/.test(markdown) || /לוחש.*שם/.test(bare),
    },
    {
      label: 'classroom / talking stick / מקל',
      ok: /מקל|מעגל|כיתה/.test(bare),
    },
    {
      label: 'no generic loud courage',
      ok: !/בקול גדול.*אומר|צועק בגאווה/.test(bare),
    },
  ];
  return checks.map((c) => `- ${c.label}: ${c.ok ? '✓' : '✗'}`);
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(BATCH, `step4-5-finalize-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const summary: string[] = [
    '# Step 4.5 — Finalize Step 4 decisions',
    '',
    `Output: \`${outDir}\``,
    '',
  ];

  // --- S4 retire ---
  const s4Status = {
    scenarioId: 'tubi_s4_ha_raam_bed',
    status: STEP4_ARTIFACT_STATUS.tubi_s4_ha_raam_bed,
    reason:
      'Thunder too close to Shiru/whale territory; Tubi engine is choose-one-sound-among-many, not reframe-one-boom.',
    doNotBank: true,
    doNotPatch: true,
    artifactPath: S4_PATH,
    markedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(BATCH, 'tubi_s4_ha_raam_bed', 'step4-status.json'),
    JSON.stringify(s4Status, null, 2)
  );
  summary.push('## S4 — RETIRED', '', `- Status: \`${s4Status.status}\``, '');

  // --- S6 lexical re-run ---
  console.log('[step4.5] S6 lexical re-run...');
  const s6Markdown = fs.readFileSync(S6_PATH, 'utf8');
  const s6Lexical = await runHebrewLexicalProofread({
    storyMarkdown: s6Markdown,
    mode: 'report_only',
    modelId: MODEL,
  });
  const s6TasteTerminal = terminalFromTaste({
    tasteVerdict: 'BANK_READY',
    technicalPass: true,
  }) as 'bank_ready_candidate';
  const s6Routed = applyLexicalTerminalCap(s6TasteTerminal, s6Lexical.routing);

  fs.writeFileSync(
    path.join(outDir, 'tubi_s6_lexical.json'),
    JSON.stringify(s6Lexical, null, 2)
  );
  fs.writeFileSync(
    path.join(BATCH, 'tubi_s6_ha_sheket_bed', 'step4-status.json'),
    JSON.stringify(
      {
        scenarioId: 'tubi_s6_ha_sheket_bed',
        status: STEP4_ARTIFACT_STATUS.tubi_s6_ha_sheket_bed,
        lexicalBlockers: s6Lexical.routing.blockerCount,
        proseReview: s6Lexical.routing.highSeverityProseReviewCount,
        routedTerminal: s6Routed,
        note: 'Pipeline preserved clean candidate after calibrated gates + approved safe polish — not first-pass clean generation.',
        markedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  summary.push(
    '## S6 — candidate (human sign-off pending)',
    '',
    `- BLOCKER: ${s6Lexical.routing.blockerCount}`,
    `- High-severity prose REVIEW: ${s6Lexical.routing.highSeverityProseReviewCount}`,
    `- Routed terminal (hypothetical BANK_READY taste): **${s6Routed}**`,
    '- Note: proves pipeline can preserve/route a clean candidate after gates + polish, not first-pass generation.',
    ''
  );

  // --- B2 reroll ---
  console.log('[step4.5] B2 reroll (one fresh generation)...');
  const b2RunDir = path.join(outDir, 'bolly_b2_reroll');
  fs.mkdirSync(b2RunDir, { recursive: true });

  const scenario = resolveScenarioById(B2_SCENARIO);
  const modelConfig: StoryGenModelConfig = {
    draftModel: MODEL,
    judgeModel: MODEL,
    revisionModel: MODEL,
  };

  const draft = await generateStoryFromScenario({ scenario, modelConfig });
  fs.writeFileSync(path.join(b2RunDir, 'outline.json'), JSON.stringify(draft.outline, null, 2));
  fs.writeFileSync(path.join(b2RunDir, 'story.draft.md'), draft.storyMarkdown);

  const loop = await runWritersRoomBoundedLoop({
    storyMarkdown: draft.storyMarkdown,
    scenario,
    outline: draft.outline,
    reportId: B2_SCENARIO,
    runLabel: 'step4-5-b2-reroll',
    judgeModel: MODEL,
    draftModel: MODEL,
  });

  fs.writeFileSync(path.join(b2RunDir, 'story.md'), loop.finalStoryMarkdown, 'utf8');
  fs.writeFileSync(path.join(b2RunDir, 'story.final.md'), loop.finalStoryMarkdown, 'utf8');
  fs.writeFileSync(path.join(b2RunDir, 'bounded-loop-report.json'), JSON.stringify(loop, null, 2));

  const b2Verdict =
    (loop.lexicalRouting?.blockerCount ?? 1) === 0 &&
    (loop.lexicalRouting?.highSeverityProseReviewCount ?? 1) === 0 &&
    loop.technicalPass &&
    (loop.finalTaste.verdict === 'BANK_READY' || loop.finalTaste.verdict === 'STRONG_DRAFT')
      ? 'b2_reroll_ready_for_human_literary_review'
      : 'b2_scenario_fragile_needs_human_authoring_or_recipe_change';

  const b2Status = {
    scenarioId: B2_SCENARIO,
    status: b2Verdict,
    oldArtifactPath: B2_OLD_PATH,
    rerollPath: b2RunDir,
    terminal: loop.terminal,
    tasteTerminal: loop.tasteTerminal,
    lexicalBlockers: loop.lexicalRouting?.blockerCount,
    proseReview: loop.lexicalRouting?.highSeverityProseReviewCount,
    markedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(b2RunDir, 'step4-status.json'), JSON.stringify(b2Status, null, 2));

  summary.push(
    '## B2 reroll',
    '',
    `- Old artifact (kept): \`${B2_OLD_PATH}\``,
    `- Reroll folder: \`${b2RunDir}\``,
    `- Verdict: **\`${b2Verdict}\`**`,
    '',
    '### Gate table',
    '',
    ...gateTable(loop),
    '',
    '### Conceptual comparison (reroll vs old concept)',
    '',
    ...conceptualBeatCheck(loop.finalStoryMarkdown),
    '',
    '### Literary notes (manual)',
    '',
    '- Compare reroll `story.md` to old B2: Bolly specificity, peek engine, residue ending.',
    '- No further automated patches on either artifact.',
    ''
  );

  if (b2Verdict === 'b2_scenario_fragile_needs_human_authoring_or_recipe_change') {
    summary.push(
      '**STOP** — B2 reroll still has lexical prose issues or gate failures. Human authoring or recipe change required.',
      ''
    );
  }

  fs.writeFileSync(
    path.join(outDir, 'step4-5-decisions.json'),
    JSON.stringify(
      {
        s4: s4Status,
        s6: { routedTerminal: s6Routed, ...s6Lexical.routing },
        b2: b2Status,
        b5: { status: STEP4_ARTIFACT_STATUS.bolly_b5_hamishpat_bed },
      },
      null,
      2
    )
  );

  fs.writeFileSync(path.join(outDir, 'summary.md'), summary.join('\n'), 'utf8');
  console.log(`[step4.5] done → ${outDir}`);
  console.log(`[step4.5] S6 routed=${s6Routed} B2 verdict=${b2Verdict} terminal=${loop.terminal}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
