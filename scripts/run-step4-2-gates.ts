/**
 * Step 4.2 — lexical + companion-chip gates on existing artifacts (report mode).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-step4-2-gates.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { scanCompanionFixedGenderChips } from '../lib/story-gen/companion-fixed-gender-chips';
import { runHebrewLexicalProofread } from '../lib/story-gen/hebrew-lexical-proofread';
import { sanitizePowerCardMetadata } from '../lib/story-gen/powercard-metadata-sanitizer';

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

const STORIES = [
  { id: 'tubi_s4_ha_raam_bed', path: path.join(BATCH, 'tubi_s4_ha_raam_bed', 'story.md') },
  { id: 'tubi_s6_ha_sheket_bed', path: path.join(BATCH, 'tubi_s6_ha_sheket_bed', 'story.md') },
  { id: 'bolly_b2_hamila_adv', path: path.join(BATCH, 'bolly_b2_hamila_adv', 'story.md') },
  { id: 'bolly_b5_hamishpat_bed', path: path.join(BATCH, 'bolly_b5_hamishpat_bed', 'story.md') },
  { id: 'tubi_s1_ha_yarid_adv', path: S1 },
] as const;

const MODEL = 'gpt-5-chat-latest';

const B2_KNOWN = [
  'מצטמצ',
  'מצמיץ',
  'מצציץ',
  'מצטץ',
  'החולש',
  "ריצ'רוץ",
  'גלידות',
  'פתחוני קפיץ',
];

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(BATCH, `step4-2-gates-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const summary: string[] = [
    '# Step 4.2 — Hebrew lexical + companion-chip gates',
    '',
    `Output: \`${outDir}\``,
    '',
  ];

  for (const spec of STORIES) {
    const markdown = fs.readFileSync(spec.path, 'utf8');
    console.log(`[step4.2] lexical ${spec.id}...`);
    const lexical = await runHebrewLexicalProofread({
      storyMarkdown: markdown,
      mode: 'report_only',
      modelId: MODEL,
    });

    const companionChips = scanCompanionFixedGenderChips(markdown);
    const companionId =
      markdown.match(/companionId:\s*(\S+)/)?.[1] ?? 'unknown';
    const powerCard = sanitizePowerCardMetadata({
      storyMarkdown: markdown,
      companionId,
    });

    const storyDir = path.join(outDir, spec.id);
    fs.mkdirSync(storyDir, { recursive: true });
    fs.writeFileSync(
      path.join(storyDir, 'hebrew-lexical-report.json'),
      JSON.stringify(lexical, null, 2)
    );
    fs.writeFileSync(
      path.join(storyDir, 'companion-chip-report.json'),
      JSON.stringify(companionChips, null, 2)
    );
    fs.writeFileSync(
      path.join(storyDir, 'powercard-sanitizer-report.json'),
      JSON.stringify(powerCard.report, null, 2)
    );

    summary.push(`## ${spec.id}`, '');
    summary.push(
      `- Lexical hits: ${lexical.hits.length} (det=${lexical.deterministicHitCount}, llm=${lexical.llmHitCount})`
    );
    summary.push(`- Companion-chip hits: ${companionChips.hitCount}`);
    summary.push(
      `- PowerCard sanitizer fail: ${powerCard.report.advisoryFail} (${powerCard.report.hits.length} hits)`
    );

    if (lexical.hits.length) {
      summary.push('', '### Lexical findings', '');
      for (const h of lexical.hits) {
        summary.push(
          `- p${h.page} [${h.source}]: "${h.original}" — ${h.issue} → ${h.suggestedMinimalFix}`
        );
      }
    }

    if (companionChips.hits.length) {
      summary.push('', '### Companion-chip hits', '');
      for (const h of companionChips.hits) {
        summary.push(
          `- p${h.page} (${h.reason}): ${h.token} → suggest: ${h.suggestedDechip}`
        );
      }
    }

    if (spec.id === 'bolly_b2_hamila_adv') {
      const caught = B2_KNOWN.filter((needle) =>
        lexical.hits.some((h) =>
          `${h.original} ${h.issue} ${h.suggestedMinimalFix}`.includes(needle)
        )
      );
      summary.push(
        '',
        `### B2 calibration: caught ${caught.length}/${B2_KNOWN.length} known defects: ${caught.join(', ') || '(none)'}`
      );
    }

    if (spec.id === 'tubi_s6_ha_sheket_bed') {
      const p4 = companionChips.hits.filter((h) => h.page === 4);
      summary.push(
        '',
        `### S6 p4 companion chips (after polish): ${p4.length} hits (expect 0)`
      );
    }

    summary.push('');
    console.log(
      `[step4.2] ${spec.id} lexical=${lexical.hits.length} companionChips=${companionChips.hitCount}`
    );
  }

  const calLines = ['## Calibration summary', ''];
  for (const id of ['tubi_s6_ha_sheket_bed', 'bolly_b5_hamishpat_bed', 'tubi_s1_ha_yarid_adv']) {
    const report = JSON.parse(
      fs.readFileSync(path.join(outDir, id, 'hebrew-lexical-report.json'), 'utf8')
    );
    calLines.push(`- **${id}** false-positive proxy: ${report.hits.length} lexical hits`);
  }
  summary.push(...calLines);

  fs.writeFileSync(path.join(outDir, 'summary.md'), summary.join('\n'), 'utf8');
  console.log(`[step4.2] done → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
