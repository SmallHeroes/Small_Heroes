/**
 * Write repaired Lion/Turtle STOP 2 artifacts for human read.
 *
 *   npx tsx scripts/apply-confidence-stop2-repairs.ts --story=lion|turtle|both
 */
import fs from 'fs';
import path from 'path';

import { BUNNY_OMETZ_MEDICAL, LION_SHAKET_ANGER, TURTLE_BEITI_HOMESICK } from '../lib/story-gen-v3/confidence-batch-specs';
import { runLongFormDriftGate } from '../lib/story-gen-v3/long-form-drift-gate';
import { runMomentumGateBeforeProse } from '../lib/story-gen-v3/momentum-gate';
import { renderReskinControlQuestion } from '../lib/story-gen-v3/confidence-batch-stop1';
import {
  buildLionRepairedBeats,
  buildLionRepairedSpine,
  LION_REPAIR_META,
} from '../lib/story-gen-v3/repairs/lion-stop2-repair';
import {
  buildTurtleRepairedBeats,
  buildTurtleRepairedSpine,
  TURTLE_REPAIR_META,
} from '../lib/story-gen-v3/repairs/turtle-stop2-repair';
import { validateAllBeatsV3, validateStorySpineForSpec } from '../lib/story-gen-v3/structure-validator';
import type { StoryPremiseCandidate } from '../lib/story-gen-v3/types';

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function writeLionRepair(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `${LION_SHAKET_ANGER.id}-stop2-repair-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  const sourceStop2 =
    'outputs/story-gen-v3-runs/confidence_lion_shaket_anger-stop2-2026-06-09T15-47-30-906Z';
  const premise = readJson<StoryPremiseCandidate>(
    path.join(process.cwd(), sourceStop2, 'hardened-premise.json')
  );

  const spine = buildLionRepairedSpine();
  const beats = buildLionRepairedBeats();

  const spineHardFails = validateStorySpineForSpec(spine, LION_SHAKET_ANGER, premise);
  const beatHardFails = validateAllBeatsV3(beats);
  const momentum = runMomentumGateBeforeProse({ spine, beats, premise });
  const drift = runLongFormDriftGate(beats);

  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(LION_SHAKET_ANGER, null, 2));
  fs.writeFileSync(path.join(runDir, 'hardened-premise.json'), JSON.stringify(premise, null, 2));
  fs.writeFileSync(path.join(runDir, 'story-spine.json'), JSON.stringify(spine, null, 2));
  fs.writeFileSync(path.join(runDir, 'page-beats.json'), JSON.stringify(beats, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'structure-validation.json'),
    JSON.stringify({ spineHardFails, beatHardFails }, null, 2)
  );
  fs.writeFileSync(path.join(runDir, 'momentum-report-before-prose.json'), JSON.stringify(momentum, null, 2));
  fs.writeFileSync(path.join(runDir, 'long-form-drift-report.json'), JSON.stringify(drift, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'repair-meta.json'),
    JSON.stringify(
      {
        ...LION_REPAIR_META,
        beatHardFailsAfter: beatHardFails,
        spineHardFailsAfter: spineHardFails,
      },
      null,
      2
    )
  );

  const report = `# Lion STOP 2 REPAIR — ${LION_SHAKET_ANGER.companionId}

## Turn repair (required)
- effectiveWorldRuleTurnPage: **${LION_REPAIR_META.effectiveWorldRuleTurnPage}**
- oldFalseTurnPage: **${LION_REPAIR_META.oldFalseTurnPage}**
- beatHardFailsBefore: ${JSON.stringify(LION_REPAIR_META.beatHardFailsBefore)}
- beatHardFailsAfter: ${beatHardFails.length ? JSON.stringify(beatHardFails) : '[]'}

## Reskin control
> ${renderReskinControlQuestion(LION_SHAKET_ANGER)}

## Structure (after repair)
- spine hard fails: ${spineHardFails.length}
- beat hard fails: ${beatHardFails.length}
- momentum: ${momentum.pass ? 'PASS' : 'FAIL'}

## Long-form drift (20-page)
- longFormDriftCheck: ${drift.longFormDriftCheck}
- midStoryTurnPage: ${drift.midStoryTurnPage ?? 'none'}
- repeatedBeatRuns: ${drift.repeatedBeatRuns.length ? JSON.stringify(drift.repeatedBeatRuns) : 'none'}

## Human read
Discovery MUST be on p9 (p8 = false turn). If discovery still on p13, repair failed.

Run dir: \`${runDir}\`
`;
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');
  console.log(`[repair] lion → ${runDir}`);
  return runDir;
}

function writeTurtleRepair(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `${TURTLE_BEITI_HOMESICK.id}-stop2-repair-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  const sourceStop2 =
    'outputs/story-gen-v3-runs/confidence_turtle_beiti_homesick-stop2-2026-06-09T15-48-15-719Z';
  const premise = readJson<StoryPremiseCandidate>(
    path.join(process.cwd(), sourceStop2, 'hardened-premise.json')
  );

  const spine = buildTurtleRepairedSpine();
  const beats = buildTurtleRepairedBeats();

  const spineHardFails = validateStorySpineForSpec(spine, TURTLE_BEITI_HOMESICK, premise);
  const beatHardFails = validateAllBeatsV3(beats);
  const momentum = runMomentumGateBeforeProse({ spine, beats, premise });

  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(TURTLE_BEITI_HOMESICK, null, 2));
  fs.writeFileSync(path.join(runDir, 'hardened-premise.json'), JSON.stringify(premise, null, 2));
  fs.writeFileSync(path.join(runDir, 'story-spine.json'), JSON.stringify(spine, null, 2));
  fs.writeFileSync(path.join(runDir, 'page-beats.json'), JSON.stringify(beats, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'structure-validation.json'),
    JSON.stringify({ spineHardFails, beatHardFails }, null, 2)
  );
  fs.writeFileSync(path.join(runDir, 'momentum-report-before-prose.json'), JSON.stringify(momentum, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'repair-meta.json'),
    JSON.stringify(
      {
        ...TURTLE_REPAIR_META,
        beatHardFailsAfter: beatHardFails,
        spineHardFailsAfter: spineHardFails,
      },
      null,
      2
    )
  );

  const report = `# Turtle STOP 2 REPAIR — ${TURTLE_BEITI_HOMESICK.companionId}

## Spine repair (not surface)
Replaced: child manages turtle over-holding + p13 breath climax
With: child makes new room feel like mine → sticker on shell touches shelf → gold line → one empty spot for one new thing

- beatHardFailsBefore: ${JSON.stringify(TURTLE_REPAIR_META.beatHardFailsBefore)}
- beatHardFailsAfter: ${beatHardFails.length ? JSON.stringify(beatHardFails) : '[]'}

## Reskin control
> ${renderReskinControlQuestion(TURTLE_BEITI_HOMESICK)}

## Structure (after repair)
- spine hard fails: ${spineHardFails.length}
- beat hard fails: ${beatHardFails.length}
- momentum: ${momentum.pass ? 'PASS' : 'FAIL'}

## Climax check
Material action on p9 (stars touch → gold line), p12 night light in empty circle — NOT breath, NOT convince-to-release.

Run dir: \`${runDir}\`
`;
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');
  console.log(`[repair] turtle → ${runDir}`);
  return runDir;
}

const arg = process.argv.find((a) => a.startsWith('--story='))?.split('=')[1] ?? 'both';
if (arg === 'lion' || arg === 'both') writeLionRepair();
if (arg === 'turtle' || arg === 'both') writeTurtleRepair();
