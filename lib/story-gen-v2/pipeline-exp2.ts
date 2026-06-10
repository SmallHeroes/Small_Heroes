/**
 * Generator-v2 Dini Exp2 — final fantasy spike pipeline.
 */

import fs from 'fs';
import path from 'path';

import { DRAGON_DINI_COMIC_BITS } from './companion-comic-bits';
import { extractGoldenStoryDNA, formatGoldenDnaMarkdown } from './golden-dna-extract';
import { loadGoldenStoryMarkdown } from './golden-story-loader';
import { runEventMomentumGate } from './event-momentum-gate';
import { generatePageBeatsExp2 } from './page-beats-gen-exp2';
import { generateProseExp2 } from './prose-gen-exp2';
import { formatExp2SelfCheckMarkdown, runProseExp2SelfCheck } from './prose-exp2-self-check';
import { applyProseV2ArtifactFixes } from './prose-v2-artifact-fix';
import { generateStorySpineExp2 } from './story-spine-gen-exp2';
import { applyTtsAmbiguityNiqqudPass } from './tts-ambiguity-niqqud';
import type { ExperimentSpecV2, StoryGenV2RunResult } from './types';

const DEFAULT_MODEL = 'gpt-5-chat-latest';

export async function runStoryGenV2Exp2(args: {
  spec: ExperimentSpecV2;
  modelId?: string;
  runDir?: string;
}): Promise<StoryGenV2RunResult & { selfCheckPath?: string }> {
  const modelId = args.modelId ?? DEFAULT_MODEL;
  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, '-');
  const runDir =
    args.runDir ??
    path.join(process.cwd(), 'outputs', 'story-gen-v2-runs', `${args.spec.id}-${timestamp}`);

  const dnaDir = path.join(runDir, 'golden-dna');
  fs.mkdirSync(dnaDir, { recursive: true });

  console.log(`[gen-v2-exp2] FINAL SPIKE → ${runDir}`);

  const goldenMarkdown = loadGoldenStoryMarkdown(args.spec.goldenDnaSourceId);

  console.log('[gen-v2-exp2] Phase 1: golden DNA...');
  const { dna } = await extractGoldenStoryDNA({
    goldenMarkdown,
    sourceStoryId: args.spec.goldenDnaSourceId,
    companionId: args.spec.companionId,
    direction: args.spec.direction,
    modelId,
  });
  fs.writeFileSync(
    path.join(dnaDir, `${args.spec.goldenDnaSourceId}.story-dna.json`),
    JSON.stringify(dna, null, 2)
  );
  fs.writeFileSync(
    path.join(dnaDir, `${args.spec.goldenDnaSourceId}.story-dna.md`),
    formatGoldenDnaMarkdown(dna),
    'utf8'
  );

  console.log('[gen-v2-exp2] Phase 2: StorySpine (child-led fantasy)...');
  const { spine } = await generateStorySpineExp2({ dna, spec: args.spec, modelId });
  fs.writeFileSync(path.join(runDir, 'story-spine.json'), JSON.stringify(spine, null, 2));

  console.log('[gen-v2-exp2] Phase 3: PageBeats...');
  const { beats } = await generatePageBeatsExp2({ spine, spec: args.spec, modelId });
  fs.writeFileSync(path.join(runDir, 'page-beats.json'), JSON.stringify(beats, null, 2));

  console.log('[gen-v2-exp2] Phase 4: Event Momentum Gate...');
  const momentum = runEventMomentumGate({
    spine,
    beats,
    pageCount: args.spec.pageCount,
  });
  fs.writeFileSync(
    path.join(runDir, 'momentum-report-before-prose.json'),
    JSON.stringify(momentum, null, 2)
  );

  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(args.spec, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'companion-comic-bits.json'),
    JSON.stringify(DRAGON_DINI_COMIC_BITS, null, 2)
  );

  if (momentum.verdict === 'FAIL') {
    console.log(`[gen-v2-exp2] STOP — momentum FAIL`);
    writeExp2Report(runDir, args.spec, momentum, null, null);
    return {
      runDir,
      experimentId: args.spec.id,
      momentumBeforeProse: momentum,
      stoppedAt: 'momentum_fail',
    };
  }

  console.log('[gen-v2-exp2] Phase 5: prose (Exp2 constraints + comic bits)...');
  const { storyMarkdown: rawMd } = await generateProseExp2({
    spine,
    beats,
    spec: args.spec,
    modelId,
    generatedAt,
  });

  const { markdown: fixedMd, fixes } = applyProseV2ArtifactFixes({
    storyMarkdown: rawMd,
    pageCount: args.spec.pageCount,
    storyId: args.spec.id,
    generatedAt,
    promptVersion: 'v2-event-driven-exp2',
  });

  console.log('[gen-v2-exp2] Phase 6: TTS ambiguity niqqud pass...');
  const { markdown: storyMarkdown, applied: ttsApplied, rulesHit } =
    applyTtsAmbiguityNiqqudPass(fixedMd);

  fs.writeFileSync(path.join(runDir, 'story.md'), storyMarkdown, 'utf8');
  if (fixes.length) {
    fs.writeFileSync(path.join(runDir, 'artifact-fixes.json'), JSON.stringify(fixes, null, 2));
  }
  fs.writeFileSync(
    path.join(runDir, 'tts-niqqud-applied.json'),
    JSON.stringify({ applied: ttsApplied, rulesHit }, null, 2)
  );

  const selfCheck = runProseExp2SelfCheck({
    storyMarkdown,
    spine,
    beats,
    momentum,
    ttsRulesHit: ttsApplied,
    expectedPageCount: args.spec.pageCount,
  });
  fs.writeFileSync(path.join(runDir, 'self-check.json'), JSON.stringify(selfCheck, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'self-check.md'),
    formatExp2SelfCheckMarkdown(selfCheck, runDir),
    'utf8'
  );

  writeExp2Report(runDir, args.spec, momentum, selfCheck, storyMarkdown);

  console.log(`[gen-v2-exp2] DONE → ${runDir}/story.md`);
  console.log('[gen-v2-exp2] HARD STOP — human read. No Exp3. Return to launch.');

  return {
    runDir,
    experimentId: args.spec.id,
    momentumBeforeProse: momentum,
    storyMarkdown,
    stoppedAt: 'prose_complete',
    selfCheckPath: path.join(runDir, 'self-check.md'),
  };
}

function writeExp2Report(
  runDir: string,
  spec: ExperimentSpecV2,
  momentum: import('./types').EventMomentumReport,
  selfCheck: import('./prose-exp2-self-check').ProseExp2SelfCheck | null,
  storyMarkdown: string | null
): void {
  const lines = [
    '# Generator-v2 Dini Exp2 — FINAL SPIKE',
    '',
    `**Experiment:** ${spec.id}`,
    `**Companion:** ${spec.companionId} · **Direction:** ${spec.direction} · **Pages:** ${spec.pageCount}`,
    '',
    '## Event Momentum Gate (pre-prose)',
    `- **Verdict:** ${momentum.verdict}`,
    `- Passive child pages (beats): ${momentum.passiveChildPages.join(', ') || 'none'}`,
    '',
    selfCheck
      ? [
          '## Machine self-check (preliminary)',
          '',
          `- Who owns climax: **${selfCheck.whoOwnsClimax}**`,
          `- Child try-fail: **${selfCheck.childTryFailPresent ? 'yes' : 'no'}**`,
          `- Visible payoff/release: **${selfCheck.visiblePayoffRelease ? 'yes' : 'no'}**`,
          `- Comic bits used: ${selfCheck.comicBitHits.map((h) => h.bitId).join(', ') || 'none'}`,
          `- Coping-tool language count: ${selfCheck.copingToolLanguageCount.total}`,
          `- Forbidden near-golden: ${selfCheck.forbiddenNearGoldenHits.length ? 'yes' : 'no'}`,
          '',
        ].join('\n')
      : '',
    '## Human verdict (fill after read)',
    '',
    '- [ ] VALIDATED — child-led fantasy works; store learning; return to launch',
    '- [ ] PROMISING — needs author pass but architecture holds',
    '- [ ] FAIL — Dini/baby-dragon-led or descriptive; fantasy not safe yet',
    '',
    '**No Exp3. No production wiring. No bank write.**',
    '',
    storyMarkdown ? `Story: \`story.md\`` : '**Prose not generated**',
  ];
  fs.writeFileSync(path.join(runDir, 'report.md'), lines.filter(Boolean).join('\n'), 'utf8');
}
