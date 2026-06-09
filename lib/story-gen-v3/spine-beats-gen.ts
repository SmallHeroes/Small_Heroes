/**
 * Phase 2 — StorySpineV3 + PageBeatV3 from hardened premise (no prose).
 */

import fs from 'fs';
import path from 'path';

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import { buildHardenedPremiseP10 } from './hardened-premise-p10';
import { buildHardenedPremiseKokoP04 } from './hardened-premise-koko-p04';
import { hardenedPremiseToSpineFields, toneGuardForSpec } from './premise-to-spine';
import type { PageBeatV3, PremiseExperimentSpecV3, StoryPremiseCandidate, StorySpineV3 } from './types';
import { validateAllBeatsV3, validateStorySpineForSpec } from './structure-validator';

function buildSpineSystem(spec: PremiseExperimentSpecV3): string {
  return `You convert a LOCKED hardened StoryPremise into StorySpineV3 JSON.
You are NOT writing prose. Copy the locked arc fields faithfully — premise-specific, not generic.

FORBIDDEN generic template:
- companion over-wraps → child finds air-gap gentler way (popcorn collapse)
- abstract "needs space / release / calm understanding" only
- reassurance fable without physical events

Return ONLY StorySpineV3 JSON matching the schema exactly.
Companion: ${spec.companionId}
Theme: ${spec.resilienceTheme}`.trim();
}

function buildBeatsSystem(spec: PremiseExperimentSpecV3): string {
  return `You convert StorySpineV3 + hardened premise into page-level SCENE EVENTS for ages 5–8.
You are NOT writing Hebrew prose.

Each PageBeatV3 MUST include ALL fields:
page, event, childDoes, companionDoes, whatChanges, whatGetsFunnierOrHarder, pageTurnReason, visualAnchor

HARD FAIL if:
- whatChanges empty
- childDoes passive (only watches/feels)
- event only emotional/internal
- pageTurnReason generic ("what happens next?")
- visualAnchor abstract
- companion solves climax

REQUIRED arc shape:
1. Hook — weird/funny opening event
2. Child want — specific, child-owned
3. Companion comic misread / wrong help
4. First try-fail — visible
5. Escalation — funnier/harder
6. Child discovery — notices pattern physically
7. Brave child action — child leads
8. Visible payoff + residue pages (not lesson)

SAFETY: ${toneGuardForSpec(spec)}

Return ONLY { "beats": PageBeatV3[] } with exact page count requested.`.trim();
}

export async function runPhase2SpineAndBeats(args: {
  premise: StoryPremiseCandidate;
  spec: PremiseExperimentSpecV3;
  runDir: string;
  modelId: string;
  pageCount?: number;
  sourceRunDir?: string;
}): Promise<{
  spine: StorySpineV3;
  beats: PageBeatV3[];
  spineHardFails: ReturnType<typeof validateStorySpineForSpec>;
  beatHardFails: ReturnType<typeof validateAllBeatsV3>;
}> {
  const pageCount = args.pageCount ?? 12;
  fs.mkdirSync(args.runDir, { recursive: true });

  const lockedSpine = hardenedPremiseToSpineFields(args.premise, args.spec);
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);
  const llm = new OpenAIResponsesLLM(args.modelId);

  fs.writeFileSync(
    path.join(args.runDir, 'hardened-premise.json'),
    JSON.stringify(args.premise, null, 2)
  );
  fs.writeFileSync(
    path.join(args.runDir, 'selected-premise.json'),
    JSON.stringify({ selected: args.premise, hardened: true }, null, 2)
  );
  if (args.sourceRunDir) {
    fs.writeFileSync(
      path.join(args.runDir, 'source-run.json'),
      JSON.stringify({ canonicalRun: args.sourceRunDir }, null, 2)
    );
  }

  console.log('[v3 phase2] StorySpineV3...');
  const spineResult = await llm.call({
    stage: 'v3-spine-v3',
    systemPrompt: buildSpineSystem(args.spec),
    userPrompt: `
Companion: ${companionBlock}

LOCKED SPINE FIELDS (copy faithfully into StorySpineV3 — do not genericize):
${JSON.stringify(lockedSpine, null, 2)}

FULL HARDENED PREMISE:
${JSON.stringify(args.premise, null, 2)}`.trim(),
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0.45,
  });

  let spine = parseJsonFromLLM<StorySpineV3>(spineResult.text, 'v3-spine-v3');
  spine = { ...lockedSpine, ...spine, premiseId: args.premise.id };

  console.log('[v3 phase2] PageBeatV3...');
  const beatsResult = await llm.call({
    stage: 'v3-beats-v3',
    systemPrompt: buildBeatsSystem(args.spec),
    userPrompt: `
SPINE:
${JSON.stringify(spine, null, 2)}

PREMISE:
${JSON.stringify(args.premise, null, 2)}

Generate exactly ${pageCount} PageBeatV3 entries (pages 1..${pageCount}).
Hebrew field content OK in event/childDoes/etc. — structural English OK in visualAnchor.
Return valid json only.`.trim(),
    jsonMode: true,
    maxOutputTokens: 12000,
    temperature: 0.5,
  });

  const parsed = parseJsonFromLLM<{ beats: PageBeatV3[] }>(beatsResult.text, 'v3-beats-v3');
  const beats = normalizeBeats(parsed.beats, pageCount);

  const spineHardFails = validateStorySpineForSpec(spine, args.spec, args.premise);
  const beatHardFails = validateAllBeatsV3(beats, args.spec);

  fs.writeFileSync(path.join(args.runDir, 'story-spine.json'), JSON.stringify(spine, null, 2));
  fs.writeFileSync(path.join(args.runDir, 'page-beats.json'), JSON.stringify(beats, null, 2));
  fs.writeFileSync(
    path.join(args.runDir, 'structure-validation.json'),
    JSON.stringify({ spineHardFails, beatHardFails }, null, 2)
  );

  return { spine, beats, spineHardFails, beatHardFails };
}

function normalizeBeats(beats: PageBeatV3[], pageCount: number): PageBeatV3[] {
  return beats.map((b, i) => ({
    page: b.page ?? i + 1,
    event: b.event?.trim() || 'אירוע בעמוד',
    childDoes: b.childDoes?.trim() || '{{childName}} פועל/ת',
    companionDoes: b.companionDoes?.trim(),
    whatChanges: b.whatChanges?.trim() || 'המצב משתנה',
    whatGetsFunnierOrHarder: b.whatGetsFunnierOrHarder?.trim() || 'המצב מסתבך',
    pageTurnReason: b.pageTurnReason?.trim() || 'משהו קורה בהמשך',
    visualAnchor: b.visualAnchor?.trim() || 'child and companion in scene',
  })).slice(0, pageCount);
}

export function loadPremiseFromRun(runDir: string, premiseId: string): StoryPremiseCandidate | null {
  const selectedPath = path.join(runDir, 'selected-premise.json');
  if (fs.existsSync(selectedPath)) {
    const sel = JSON.parse(fs.readFileSync(selectedPath, 'utf8')) as {
      selected: StoryPremiseCandidate;
    };
    if (sel.selected?.id === premiseId) return sel.selected;
  }
  const candidatesPath = path.join(runDir, 'premise-candidates.json');
  if (fs.existsSync(candidatesPath)) {
    const list = JSON.parse(fs.readFileSync(candidatesPath, 'utf8')) as Array<
      StoryPremiseCandidate & { _meta?: unknown }
    >;
    const found = list.find((c) => c.id === premiseId);
    if (found) {
      const { _meta: _, ...rest } = found;
      return rest;
    }
  }
  return null;
}

export function getDefaultHardenedPremise(premiseId: string): StoryPremiseCandidate {
  if (premiseId === 'dini_premise_10') return buildHardenedPremiseP10();
  if (premiseId === 'koko_premise_04') return buildHardenedPremiseKokoP04();
  throw new Error(`No hardened premise for ${premiseId}`);
}
