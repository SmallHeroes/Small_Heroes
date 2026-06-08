/**
 * Step 4.3 — lexical severity calibration + B2 revalidation (no generation).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-step4-3-calibration.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { runHebrewLexicalProofread } from '../lib/story-gen/hebrew-lexical-proofread';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import type { StoryOutline } from '../lib/story-gen/story-generation-types';
import { runWritersRoomBoundedLoop } from '../lib/story-gen/writers-room-bounded-loop';

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
  { id: 'tubi_s4_ha_raam_bed', path: path.join(BATCH, 'tubi_s4_ha_raam_bed', 'story.md'), contentHold: true },
  { id: 'tubi_s6_ha_sheket_bed', path: path.join(BATCH, 'tubi_s6_ha_sheket_bed', 'story.md'), contentHold: false },
  { id: 'bolly_b5_hamishpat_bed', path: path.join(BATCH, 'bolly_b5_hamishpat_bed', 'story.md'), contentHold: false },
  { id: 'bolly_b2_hamila_adv', path: path.join(BATCH, 'bolly_b2_hamila_adv', 'story.md'), contentHold: false },
] as const;

const B2_KNOWN = [
  'מצטמצ',
  'מצמיץ',
  'מצציץ',
  'מצטץ',
  'החולש',
  'גלידות',
  'פתחוני קפיץ',
  "ריצ'רוץ",
];

function severityTable(report: Awaited<ReturnType<typeof runHebrewLexicalProofread>>): string[] {
  const lines: string[] = [
    `| Severity | Count |`,
    `|----------|-------|`,
    `| BLOCKER | ${report.blockerCount} |`,
    `| REVIEW | ${report.reviewCount} |`,
    `| ALLOW | ${report.allowCount} |`,
  ];
  for (const sev of ['BLOCKER', 'REVIEW', 'ALLOW'] as const) {
    const items = report.findings.filter((f) => f.severity === sev);
    if (!items.length) continue;
    lines.push('', `### ${sev}`, '');
    for (const f of items) {
      lines.push(
        `- p${f.page} [${f.domain}/${f.source}]: "${f.original.slice(0, 80)}" — ${f.issue}`
      );
    }
  }
  return lines;
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(BATCH, `step4-3-calibration-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const summary: string[] = [
    '# Step 4.3 — Lexical severity calibration',
    '',
    `Output: \`${outDir}\``,
    '',
  ];

  let totalFalseBlockers = 0;

  for (const spec of STORIES) {
    const markdown = fs.readFileSync(spec.path, 'utf8');
    console.log(`[step4.3] lexical ${spec.id}...`);
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

    summary.push(`## ${spec.id}${spec.contentHold ? ' (HOLD_CONTENT — not promoted)' : ''}`, '');
    summary.push(...severityTable(lexical));

    if (['tubi_s1_ha_yarid_adv', 'tubi_s6_ha_sheket_bed', 'bolly_b5_hamishpat_bed', 'tubi_s4_ha_raam_bed'].includes(spec.id)) {
      const fp = lexical.blockers.filter(
        (b) =>
          b.domain !== 'non_word' &&
          b.domain !== 'malformed_inflection' &&
          b.domain !== 'broken_chip_word'
      );
      totalFalseBlockers += fp.length;
      if (lexical.blockerCount > 0) {
        summary.push('', `**False BLOCKER proxy:** ${lexical.blockerCount} blocker(s) on near-clean story`);
      }
    }

    if (spec.id === 'bolly_b2_hamila_adv') {
      const caught = B2_KNOWN.filter((needle) =>
        lexical.findings
          .filter((f) => f.severity !== 'ALLOW')
          .some((f) => `${f.original} ${f.issue}`.includes(needle))
      );
      summary.push(
        '',
        `**B2 known-defect recall (pre-repair artifact now repaired):** ${caught.length}/${B2_KNOWN.length} in severity≠ALLOW findings`
      );
    }

    summary.push('');
    console.log(
      `[step4.3] ${spec.id} BLOCKER=${lexical.blockerCount} REVIEW=${lexical.reviewCount} ALLOW=${lexical.allowCount}`
    );
  }

  console.log('[step4.3] B2 full gate revalidation...');
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
    runLabel: 'step4-3-b2-reval',
    judgeModel: MODEL,
    draftModel: MODEL,
    skipProofread: true,
    skipAdventureEnrich: true,
  });

  fs.writeFileSync(
    path.join(outDir, 'bolly_b2_hamila_adv', 'bounded-loop-report.json'),
    JSON.stringify(loop, null, 2)
  );

  const b2LexicalAfter = await runHebrewLexicalProofread({
    storyMarkdown: b2Markdown,
    mode: 'report_only',
    modelId: MODEL,
  });
  fs.writeFileSync(
    path.join(outDir, 'bolly_b2_hamila_adv', 'hebrew-lexical-after-repair.json'),
    JSON.stringify(b2LexicalAfter, null, 2)
  );

  summary.push('## B2 after minimal repair — full gate stack', '');
  summary.push(`- Terminal: **${loop.terminal}**`);
  summary.push(`- Technical: ${loop.technicalPass ? 'PASS' : 'FAIL'}`);
  summary.push(`- Taste: ${loop.finalTaste.verdict}`);
  summary.push(
    `- Lexical BLOCKERs after repair: ${b2LexicalAfter.blockerCount} | REVIEW: ${b2LexicalAfter.reviewCount}`
  );
  if (!loop.technicalPass) {
    summary.push('', 'Technical failures:', ...loop.technicalFailures.map((f) => `- ${f}`));
  }

  summary.push(
    '',
    '## Calibration verdict',
    '',
    `- False BLOCKER proxy (S1/S4/S6/B5): ${totalFalseBlockers}`,
    `- Lexical gate blocking-ready: **${b2LexicalAfter.blockerCount === 0 && totalFalseBlockers === 0 ? 'CLOSER — verify LLM stability' : 'NOT YET — remaining BLOCKERs or false positives'}**`,
    '- Step 5: **BLOCKED**'
  );

  fs.writeFileSync(path.join(outDir, 'summary.md'), summary.join('\n'), 'utf8');
  console.log(`[step4.3] done → ${outDir}`);
  console.log(`[step4.3] B2 terminal=${loop.terminal} lexicalBlockers=${b2LexicalAfter.blockerCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
