import fs from 'fs';
import path from 'path';

import { scanChipSafety } from '../lib/story-gen/chip-safety';
import { runStoryAliveGate } from '../lib/story-gen-v3/story-alive-gate';
import { validateStoryMdReadBack } from '../lib/story-gen-v3/story-read-back-validation';
import type { PageBeatV3, StoryPremiseCandidate } from '../lib/story-gen-v3/types';

const runDir = path.resolve(process.argv[2] ?? '');
const md = fs.readFileSync(path.join(runDir, 'story.md'), 'utf8');
const beats = JSON.parse(fs.readFileSync(path.join(runDir, 'page-beats.json'), 'utf8')) as PageBeatV3[];
const premise = JSON.parse(
  fs.readFileSync(path.join(runDir, 'hardened-premise.json'), 'utf8')
) as StoryPremiseCandidate;

const chipSafety = scanChipSafety(md);
const alive = runStoryAliveGate({
  storyMarkdown: md,
  beats,
  chipSafety,
  companionId: 'chameleon_koko',
  premise,
  endingProfile: 'koko_transition',
});
const readBack = validateStoryMdReadBack({
  storyMarkdownPath: path.join(runDir, 'story.md'),
  endingProfile: 'koko_transition',
});

fs.writeFileSync(path.join(runDir, 'story-alive-report.json'), JSON.stringify(alive, null, 2));
fs.writeFileSync(path.join(runDir, 'read-back-validation.json'), JSON.stringify(readBack, null, 2));

console.log('StoryAlive:', alive.verdict);
console.log('read-back completedEnding:', readBack.completedEnding);
if (readBack.failures.length) console.log('failures:', readBack.failures);
if (alive.hardFails.length) console.log('hardFails:', alive.hardFails);
