/**
 * Probe bodies → Phase B loop markdown for routing validation (no new generation).
 */

import fs from 'fs';
import path from 'path';

import { parseDecoySpecs } from './craft-rubric-test';
import { extractStoryBodyFromMarkdown, parseMidTierAnchorSpecs } from './craft-rubric-v2';
import { patchWritersRoomOutline } from './writers-room-artifact-patches';
import { resolveScenarioById } from './scenario-resolver';
import { BOLLY_B4_HACHEDER } from './scenarios-bolly-armadillo';
import { normalizeTasteProbeProse, parseTasteProbeSpecs } from './taste-judge';
import {
  finalizePhaseBMarkdownFromPages,
  normalizePhaseBStoryMarkdown,
} from './story-markdown-normalize';
import { pageProseOnly, parseStoryPages } from './story-page-utils';
import type { PhaseBScenario, Scenario, StoryOutline } from './story-generation-types';

/** 8-page adventure host for probe bodies that declare adventure + 8 pages. */
export const PROBE_ROUTING_ADV_8: PhaseBScenario = {
  ...BOLLY_B4_HACHEDER,
  id: 'probe_routing_adv_8',
  direction: 'adventure',
  titleHe: 'מגרש — routing probe host',
  titleSeed: '{{childName}} בוחר/ת צעד קטן',
  whyThisIsFresh: 'Synthetic host for probe routing validation only.',
};

export interface ProbeRoutingFixture {
  probeId: string;
  label: string;
  scenario: Scenario;
  outline: StoryOutline;
  storyMarkdown: string;
  expectNoRewrite?: boolean;
  /** Skip author rewrite even when taste says REWRITE (engine/age wrong probes). */
  blockAuthorRewrite?: boolean;
  expectNeverBankReady?: boolean;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function loadOutline(scenarioId: string, outlineFolder: string): StoryOutline {
  const raw = readJson<StoryOutline>(
    path.join(process.cwd(), outlineFolder, 'outline.json')
  );
  return patchWritersRoomOutline(scenarioId, raw);
}

function probeBodyToLoopMarkdown(args: {
  rawBody: string;
  scenario: Scenario;
  outline: StoryOutline;
}): string {
  const normalized = normalizeTasteProbeProse(args.rawBody);
  const body = extractStoryBodyFromMarkdown(normalized);
  const pages = parseStoryPages(body);
  const pageSection = pages
    .map(({ page, body: pageBody }) => {
      const prose = pageProseOnly(pageBody);
      return `--- Page ${page} ---\n${prose}\n\nimageDirection: Routing probe page ${page} — child and companion in scene.`;
    })
    .join('\n\n');

  return finalizePhaseBMarkdownFromPages({
    scenario: args.scenario,
    outline: args.outline,
    pageSection,
  });
}

function hostBedtime8(): { scenario: Scenario; outline: StoryOutline } {
  const scenario = resolveScenarioById('bolly_b4_hacheder_bed');
  const outline = loadOutline(
    'bolly_b4_hacheder_bed',
    'outputs/story-gen-runs/2026-06-07T19-11-50-756Z'
  );
  return { scenario, outline };
}

function hostAdventure8(): { scenario: Scenario; outline: StoryOutline } {
  const scenario = PROBE_ROUTING_ADV_8;
  const outline = loadOutline(
    'bolly_b4_hacheder_bed',
    'outputs/story-gen-runs/2026-06-07T19-11-50-756Z'
  );
  return { scenario, outline };
}

export function loadProbeRoutingFixtures(): ProbeRoutingFixture[] {
  const midtierPath = path.join(
    process.cwd(),
    'outputs',
    'craft-decoys',
    'craft-judge-midtier-anchors.md'
  );
  const decoysPath = path.join(
    process.cwd(),
    'outputs',
    'craft-decoys',
    'craft-judge-decoys.md'
  );
  const tastePath = path.join(
    process.cwd(),
    'outputs',
    'craft-decoys',
    'taste-boring-samples.md'
  );

  const midSpecs = parseMidTierAnchorSpecs(fs.readFileSync(midtierPath, 'utf8'));
  const snail = midSpecs.find((s) => s.id === 'midtier_1');
  if (!snail) throw new Error('midtier_1 not found in mid-tier anchors');

  const decoy = parseDecoySpecs(fs.readFileSync(decoysPath, 'utf8'))[0];
  if (!decoy) throw new Error('decoy_1 not found');

  const tasteProbes = parseTasteProbeSpecs(fs.readFileSync(tastePath, 'utf8'));
  const boring1 = tasteProbes.find((p) => p.id === 'boring_1');
  const boring2 = tasteProbes.find((p) => p.id === 'boring_2');
  const moth = tasteProbes.find((p) => p.id === 'beautiful_but_wrong_moths_song');
  if (!boring1 || !boring2 || !moth) throw new Error('taste probe missing');

  const bedtime = hostBedtime8();
  const adventure = hostAdventure8();

  const fixtures: ProbeRoutingFixture[] = [
    {
      probeId: 'midtier_1',
      label: 'Quiet Snail',
      ...bedtime,
      storyMarkdown: probeBodyToLoopMarkdown({
        rawBody: snail.storyBody,
        scenario: bedtime.scenario,
        outline: bedtime.outline,
      }),
      expectNeverBankReady: true,
    },
    {
      probeId: 'boring_1',
      label: 'Pleasant Owl',
      ...bedtime,
      storyMarkdown: probeBodyToLoopMarkdown({
        rawBody: boring1.storyBody,
        scenario: bedtime.scenario,
        outline: bedtime.outline,
      }),
      expectNeverBankReady: true,
    },
    {
      probeId: 'boring_2',
      label: 'Checklist Cat',
      ...adventure,
      storyMarkdown: probeBodyToLoopMarkdown({
        rawBody: boring2.storyBody,
        scenario: adventure.scenario,
        outline: adventure.outline,
      }),
      expectNeverBankReady: true,
    },
    {
      probeId: 'beautiful_but_wrong_moths_song',
      label: "Moth's Song",
      ...bedtime,
      storyMarkdown: probeBodyToLoopMarkdown({
        rawBody: moth.storyBody,
        scenario: bedtime.scenario,
        outline: bedtime.outline,
      }),
      expectNoRewrite: true,
      blockAuthorRewrite: true,
      expectNeverBankReady: true,
    },
    {
      probeId: 'decoy_1',
      label: 'Lecturing Owl',
      ...bedtime,
      storyMarkdown: probeBodyToLoopMarkdown({
        rawBody: decoy.storyBody,
        scenario: bedtime.scenario,
        outline: bedtime.outline,
      }),
      expectNeverBankReady: true,
    },
  ];

  const phaseAPath = path.join(
    process.cwd(),
    'outputs',
    'story-gen-runs',
    '2026-06-07T10-21-49-454Z',
    'story.md'
  );
  const bollyB1 = resolveScenarioById('bolly_b1_lahitraf_adv');
  const bollyB1Outline = loadOutline(
    'bolly_b1_lahitraf_adv',
    'outputs/story-gen-runs/2026-06-07T18-49-32-189Z'
  );
  fixtures.push({
    probeId: 'bolly_phase_a',
    label: 'Phase-A Bolly',
    scenario: bollyB1,
    outline: bollyB1Outline,
    storyMarkdown: normalizePhaseBStoryMarkdown({
      rawMarkdown: fs.readFileSync(phaseAPath, 'utf8'),
      scenario: bollyB1,
      outline: bollyB1Outline,
    }),
    expectNeverBankReady: true,
  });

  return fixtures;
}

export function loadBollyB4FinalArtifact(): string {
  const filePath = path.join(
    process.cwd(),
    'outputs',
    'writers-room-canary',
    '2026-06-08T07-38-12-119Z',
    'bolly_b4_hacheder_bed',
    'story.after-patch.md'
  );
  return fs.readFileSync(filePath, 'utf8');
}

export type InjectedFaultKind = 'bare_child_gender' | 'identical_chip';

export function injectDeterministicFault(
  storyMarkdown: string,
  kind: InjectedFaultKind
): string {
  if (kind === 'bare_child_gender') {
    return storyMarkdown.replace(
      /(--- Page 1 ---\r?\n)/,
      `$1{{childName}} מוריד ראש.\n`
    );
  }
  return storyMarkdown.replace(
    /(--- Page 2 ---\r?\n)/,
    `$1{{childName}} {מחייך|מחייךת} בשקט.\n`
  );
}

export function classifyDeterministicGate(failures: string[]): string {
  if (failures.some((f) => f.startsWith('CHIP_SAFETY'))) return 'CHIP_SAFETY';
  if (failures.some((f) => f.startsWith('BARE_CHILD_GENDER'))) return 'BARE_CHILD_GENDER';
  if (failures.some((f) => f.startsWith('HEBREW_SANITY'))) return 'HEBREW_SANITY';
  if (failures.some((f) => f.startsWith('POWERCARD_SANITIZER'))) return 'POWERCARD_SANITIZER';
  if (failures.some((f) => f.startsWith('CHIP_NORMALIZE'))) return 'CHIP_SAFETY';
  if (failures.some((f) => f.toLowerCase().includes('identical'))) return 'VALIDATOR';
  if (failures.length > 0) return 'VALIDATOR';
  return 'NONE';
}

export function describeTasteDelta(
  before: { verdict: string },
  after: { verdict: string }
): 'improved' | 'preserved' | 'worsened' {
  const rank: Record<string, number> = {
    FAIL: 0,
    HUMAN_REVIEW: 1,
    REWRITE: 2,
    STRONG_DRAFT: 3,
    BANK_READY: 4,
  };
  const b = rank[before.verdict] ?? 0;
  const a = rank[after.verdict] ?? 0;
  if (a > b) return 'improved';
  if (a < b) return 'worsened';
  return 'preserved';
}
