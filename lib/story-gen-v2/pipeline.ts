/**
 * Generator-v2 minimum path: DNA → Spine → Beats → Momentum Gate → Prose.
 */

import fs from 'fs';
import path from 'path';

import { extractGoldenStoryDNA, formatGoldenDnaMarkdown } from './golden-dna-extract';
import { loadGoldenStoryMarkdown } from './golden-story-loader';
import { generatePageBeatsV2 } from './page-beats-gen';
import { generateProseV2 } from './prose-gen';
import { runEventMomentumGate } from './event-momentum-gate';
import { generateStorySpineV2 } from './story-spine-gen';
import type { ExperimentSpecV2, StoryGenV2RunResult } from './types';

const DEFAULT_MODEL = 'gpt-5-chat-latest';

export async function runStoryGenV2Experiment(args: {
  spec: ExperimentSpecV2;
  modelId?: string;
  runDir?: string;
  skipProseOnMomentumFail?: boolean;
}): Promise<StoryGenV2RunResult> {
  const modelId = args.modelId ?? DEFAULT_MODEL;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir =
    args.runDir ??
    path.join(process.cwd(), 'outputs', 'story-gen-v2-runs', `${args.spec.id}-${timestamp}`);

  const dnaDir = path.join(runDir, 'golden-dna');
  fs.mkdirSync(dnaDir, { recursive: true });

  console.log(`[gen-v2] run → ${runDir}`);

  const goldenMarkdown = loadGoldenStoryMarkdown(args.spec.goldenDnaSourceId);

  console.log('[gen-v2] Phase 1: extract golden DNA...');
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

  console.log('[gen-v2] Phase 2: StorySpine...');
  const { spine } = await generateStorySpineV2({ dna, spec: args.spec, modelId });
  fs.writeFileSync(path.join(runDir, 'story-spine.json'), JSON.stringify(spine, null, 2));

  console.log('[gen-v2] Phase 3: PageBeats...');
  const { beats } = await generatePageBeatsV2({ spine, spec: args.spec, modelId });
  fs.writeFileSync(path.join(runDir, 'page-beats.json'), JSON.stringify(beats, null, 2));

  console.log('[gen-v2] Phase 4: Event Momentum Gate (pre-prose)...');
  const momentum = runEventMomentumGate({
    spine,
    beats,
    pageCount: args.spec.pageCount,
  });
  fs.writeFileSync(
    path.join(runDir, 'momentum-report-before-prose.json'),
    JSON.stringify(momentum, null, 2)
  );

  fs.writeFileSync(
    path.join(runDir, 'experiment-spec.json'),
    JSON.stringify(args.spec, null, 2)
  );

  if (momentum.verdict === 'FAIL' && args.skipProseOnMomentumFail !== false) {
    console.log(`[gen-v2] STOP — momentum FAIL: ${momentum.notes.join('; ')}`);
    writeBriefReport(runDir, args.spec, momentum, null);
    return {
      runDir,
      experimentId: args.spec.id,
      momentumBeforeProse: momentum,
      stoppedAt: 'momentum_fail',
    };
  }

  console.log('[gen-v2] Phase 5: prose...');
  const { storyMarkdown } = await generateProseV2({ spine, beats, spec: args.spec, modelId });
  fs.writeFileSync(path.join(runDir, 'story.md'), storyMarkdown, 'utf8');

  writeBriefReport(runDir, args.spec, momentum, storyMarkdown);

  console.log(`[gen-v2] DONE — momentum=${momentum.verdict} → ${runDir}/story.md`);
  console.log('[gen-v2] HARD STOP — human read required; do not auto-declare success.');

  return {
    runDir,
    experimentId: args.spec.id,
    momentumBeforeProse: momentum,
    storyMarkdown,
    stoppedAt: 'prose_complete',
  };
}

function writeBriefReport(
  runDir: string,
  spec: ExperimentSpecV2,
  momentum: import('./types').EventMomentumReport,
  storyMarkdown: string | null
): void {
  const lines = [
    '# Generator-v2 Experiment Report',
    '',
    `**Experiment:** ${spec.id}`,
    `**Companion:** ${spec.companionId} · **Direction:** ${spec.direction} · **Pages:** ${spec.pageCount}`,
    '',
    '## Event Momentum Gate (pre-prose)',
    '',
    `- **Verdict:** ${momentum.verdict}`,
    `- Passive child pages: ${momentum.passiveChildPages.join(', ') || 'none'}`,
    `- Static pages: ${momentum.staticPages.join(', ') || 'none'}`,
    `- Longest static run: ${momentum.longestStaticRun}`,
    ...(momentum.notes.length ? ['', ...momentum.notes.map((n) => `- ${n}`)] : []),
    '',
    '## Human verdict (fill after read)',
    '',
    'Map to chain: desire → try/fail → companion comic/vulnerable misread → child discovery → brave CHILD action → world response → residue',
    '',
    '- [ ] GOLDEN_LIKE',
    '- [ ] PROMISING_BUT_NEEDS_EDITOR',
    '- [ ] STILL_DESCRIPTIVE',
    '- [ ] FAIL',
    '',
    '**Child protagonist?** (notes)',
    '',
    storyMarkdown ? `Story: \`story.md\` (${storyMarkdown.length} chars)` : '**Prose not generated** (momentum fail).',
    '',
    '---',
    'Generator-v2 spike — not production. No bank write.',
  ];
  fs.writeFileSync(path.join(runDir, 'report.md'), lines.join('\n'), 'utf8');
}
