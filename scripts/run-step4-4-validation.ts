/**
 * Step 4.4 — lexical routing validation + B2 final repair check (no generation).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-step4-4-validation.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { applyLexicalTerminalCap } from '../lib/story-gen/hebrew-lexical-routing';
import { runHebrewLexicalProofread } from '../lib/story-gen/hebrew-lexical-proofread';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import type { StoryOutline } from '../lib/story-gen/story-generation-types';
import { terminalFromTaste, runWritersRoomBoundedLoop } from '../lib/story-gen/writers-room-bounded-loop';

const BATCH = path.join(
  process.cwd(),
  'outputs',
  'writers-room-canary',
  'stability-batch-step4-2026-06-08T13-23-36-455Z'
);

const S1 = path.join(
  process.cwd(),
  'outputs',
  'story-gen-runs',
  '2026-06-08T12-24-41-119Z',
  'story.final.md'
);

const MODEL = 'gpt-5-chat-latest';

const STORIES = [
  { id: 'tubi_s1_ha_yarid_adv', path: S1, contentHold: false },
  {
    id: 'tubi_s4_ha_raam_bed',
    path: path.join(BATCH, 'tubi_s4_ha_raam_bed', 'story.md'),
    contentHold: true,
  },
  {
    id: 'tubi_s6_ha_sheket_bed',
    path: path.join(BATCH, 'tubi_s6_ha_sheket_bed', 'story.md'),
    contentHold: false,
  },
  {
    id: 'bolly_b5_hamishpat_bed',
    path: path.join(BATCH, 'bolly_b5_hamishpat_bed', 'story.md'),
    contentHold: false,
  },
  {
    id: 'bolly_b2_hamila_adv',
    path: path.join(BATCH, 'bolly_b2_hamila_adv', 'story.md'),
    contentHold: false,
  },
] as const;

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(BATCH, `step4-4-validation-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const summary: string[] = [
    '# Step 4.4 — Lexical routing validation',
    '',
    `Output: \`${outDir}\``,
    '',
    '## Routing policy',
    '',
    '- LLM-only BLOCKER → demoted to REVIEW (unless deterministic backs it)',
    '- `מַסַּע` → ALLOW; `לקֶטַן` → REVIEW',
    '- High-severity prose REVIEW (`unnatural_phrase`, `age_inappropriate_register` in prose) caps terminal',
    '- Slash-forms → chip-normalize gap, NOT quality REVIEW',
    '',
  ];

  let fakeGreenCount = 0;

  for (const spec of STORIES) {
    const markdown = fs.readFileSync(spec.path, 'utf8');
    console.log(`[step4.4] ${spec.id}...`);
    const lexical = await runHebrewLexicalProofread({
      storyMarkdown: markdown,
      mode: 'report_only',
      modelId: MODEL,
    });

    const storyDir = path.join(outDir, spec.id);
    fs.mkdirSync(storyDir, { recursive: true });
    fs.writeFileSync(
      path.join(storyDir, 'hebrew-lexical-report.json'),
      JSON.stringify(lexical, null, 2)
    );

    const tasteTerminal = terminalFromTaste({
      tasteVerdict: 'BANK_READY',
      technicalPass: true,
    }) as 'bank_ready_candidate';
    const routedTerminal = applyLexicalTerminalCap(tasteTerminal, lexical.routing);

    const fakeGreen =
      tasteTerminal === 'bank_ready_candidate' &&
      routedTerminal === 'bank_ready_candidate' &&
      lexical.routing.highSeverityProseReviewCount > 0;
    if (fakeGreen) fakeGreenCount += 1;

    summary.push(
      `## ${spec.id}${spec.contentHold ? ' (HOLD_CONTENT)' : ''}`,
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| BLOCKER | ${lexical.routing.blockerCount} |`,
      `| High-severity prose REVIEW | ${lexical.routing.highSeverityProseReviewCount} |`,
      `| Slash-form (chip gap) | ${lexical.routing.slashFormFindings.length} |`,
      `| Demoted LLM BLOCKERs | ${lexical.demotedLlmBlockerCount} |`,
      `| Taste terminal (hypothetical BANK_READY) | ${tasteTerminal} |`,
      `| Routed terminal | ${routedTerminal} |`,
      `| Fake green? | ${fakeGreen ? '**YES**' : 'no'} |`,
      ''
    );

    if (lexical.routing.highSeverityProseReviews.length) {
      summary.push('### High-severity prose REVIEW', '');
      for (const f of lexical.routing.highSeverityProseReviews) {
        summary.push(`- p${f.page}: "${f.original.slice(0, 60)}"`);
      }
      summary.push('');
    }

    console.log(
      `[step4.4] ${spec.id} blockers=${lexical.routing.blockerCount} proseReview=${lexical.routing.highSeverityProseReviewCount} routed=${routedTerminal}`
    );
  }

  const s1Markdown = fs.readFileSync(S1, 'utf8');
  const chipNorm = normalizePartialGenderChips(s1Markdown);
  const slashRemain = chipNorm.report.unrepaired.filter((u) =>
    u.reason.includes('slash')
  );
  summary.push(
    '## S1 slash-form chip-normalize check',
    '',
    `- Slash forms in raw story.final.md: p8 \`עוקב/ת\`, p9 \`מאבד/ת\`, p10 \`שומר/ת\``,
    `- After normalizePartialGenderChips: ${chipNorm.report.fixCount} fixes, ${slashRemain.length} unrepaired slash`,
    ...(slashRemain.map((u) => `- unrepaired p${u.page}: \`${u.token}\``)),
    `- advisoryFail: ${chipNorm.report.advisoryFail}`,
    ''
  );

  console.log('[step4.4] B2 full gate stack (final repair pass)...');
  const b2Markdown = fs.readFileSync(path.join(BATCH, 'bolly_b2_hamila_adv', 'story.md'), 'utf8');
  const outline = JSON.parse(
    fs.readFileSync(path.join(BATCH, 'bolly_b2_hamila_adv', 'outline.json'), 'utf8')
  ) as StoryOutline;
  const scenario = resolveScenarioById('bolly_b2_hamila_adv');
  const loop = await runWritersRoomBoundedLoop({
    storyMarkdown: b2Markdown,
    scenario,
    outline,
    reportId: 'bolly_b2_hamila_adv',
    runLabel: 'step4-4-b2-final',
    judgeModel: MODEL,
    draftModel: MODEL,
    skipProofread: true,
    skipAdventureEnrich: true,
  });

  fs.writeFileSync(
    path.join(outDir, 'bolly_b2_hamila_adv', 'bounded-loop-report.json'),
    JSON.stringify(loop, null, 2)
  );

  const b2Clean =
    loop.lexicalRouting &&
    loop.lexicalRouting.blockerCount === 0 &&
    loop.lexicalRouting.highSeverityProseReviewCount === 0;

  summary.push(
    '## B2 final repair — gate stack',
    '',
    `- Taste terminal: ${loop.tasteTerminal ?? '—'}`,
    `- **Final terminal: ${loop.terminal}**`,
    `- Lexical blockers: ${loop.lexicalRouting?.blockerCount ?? '—'}`,
    `- High-severity prose REVIEW: ${loop.lexicalRouting?.highSeverityProseReviewCount ?? '—'}`,
    `- Zero BLOCKER + zero prose REVIEW: ${b2Clean ? '**YES**' : '**NO**'}`,
    ''
  );

  if (!b2Clean) {
    summary.push(
      '**STOP — no 4th automated patch.** B2 should be **rerolled** (same scenario) or **hand-edited** by human.',
      ''
    );
  }

  summary.push(
    '## Verdict',
    '',
    `- Fake-green count (unresolved prose REVIEW + bank_ready): ${fakeGreenCount}`,
    `- Lexical gate blocking-ready: **${fakeGreenCount === 0 ? 'CLOSER — deterministic authority + routing cap in place' : 'NOT YET'}**`,
    '- Step 5: **BLOCKED**',
    '',
    '## chip-safety test status',
    '',
    '- `chip-safety.spec.ts` > `does not guess feminine for unrecognized slash forms` — **still failing**',
    '- Cause: `normalizePartialGenderChips` converts `מַדְגִּים/ה` via `safeConvertSlashGender` + `/ה` suffix guess → `{מדגים|מדגימה}`',
    '- Pre-existing behavior mismatch (test expects fail-closed unrepaired token); **not introduced by Step 4.4**',
    ''
  );

  fs.writeFileSync(path.join(outDir, 'summary.md'), summary.join('\n'), 'utf8');
  console.log(`[step4.4] done → ${outDir}`);
  console.log(`[step4.4] B2 terminal=${loop.terminal} clean=${b2Clean}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
