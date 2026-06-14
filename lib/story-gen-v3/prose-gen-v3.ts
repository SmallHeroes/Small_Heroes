/**
 * Generator-v3 — Hebrew prose from locked PageBeatV3 + companion comic bits.
 */

import { OpenAIResponsesLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import {
  formatComicBitsForPrompt,
  getComicBitsForCompanion,
} from '../story-gen-v2/companion-comic-bits';
import {
  buildV3ComicBitBankPromptBlock,
  getV3ForbiddenNearGolden,
  V3_COMIC_BIT_DOSAGE_INSTRUCTION,
} from './companion-comic-bits';
import { BUNNY_MEDICAL_PROSE_BLOCK } from './medical-prose-guardrails';
import type { PremiseExperimentSpecV3, PageBeatV3, StoryPremiseCandidate, StorySpineV3 } from './types';
import { toneGuardForSpec } from './premise-to-spine';
import { pageCountForSpec } from './confidence-batch-specs';

function companionDisplayRules(companionId: string): string {
  if (companionId === 'bunny_ometz') {
    return `## בוּנִי (bunny_ometz)
Masculine fixed: בוּנִי אמר, בוּנִי אמר — NO gender chips on Bunny.
Ear comedy is ONLY on בוּנִי — {{childName}} is a human child with NO rabbit ears.
${BUNNY_MEDICAL_PROSE_BLOCK}`;
  }
  if (companionId === 'lion_shaket') {
    return `## ליאו (lion_shaket)
Masculine fixed — NO gender chips on Leo.
Sound-weight comedy: roar/whisper has physical weight; tail thumps.`;
  }
  if (companionId === 'turtle_beiti') {
    return `## טוֹלִי (turtle_beiti)
Feminine fixed — NO gender chips on Turtle.
Shell-as-home comedy; physical marks/objects carry home — NO unearned slogans.`;
  }
  if (companionId === 'chameleon_koko') {
    return `## קוֹקוֹ
Feminine fixed: קוֹקוֹ אמרה, קוֹקוֹ הפכה — NO gender chips on Koko.
Color comedy is physical — panic-orange, striped-wall fail, backpack eyes.
Koko misreads transition problems; does NOT solve climax.`;
  }
  if (companionId === 'fox_uri') {
    return `## אוּרי (fox_uri)
Masculine fixed: אוּרי אמר, אוּרי לחש — NO gender chips on Uri.
Lantern/scout engine: proud wrong reads, dramatic guard duty, tail slips before words.
Tip-of-light only — child inspects fear in small steps. Uri does NOT solve climax or erase fear.`;
  }
  return `## דִּינִי
Feminine fixed: דיני אמרה — NO gender chips on Dini.
Funny, protective, literal — NOT therapist.`;
}

function buildProseSystem(spec: PremiseExperimentSpecV3, pageCount: number): string {
  return `You write Hebrew read-aloud picture-book prose for Small Heroes ages 5–8.
Generator-v3 — from LOCKED PageBeatV3 events.

## Core principle
THE STORY LEADS. Resilience rides underneath. Never state the lesson.

## Style
- Short-to-medium sentences, dialogue, sound effects, physical comedy
- Warm, silly, safe — NOT adult-literary, NOT therapy language
- Partial niqqud only on ambiguous words

## FORBIDDEN words/phrases
הבין ש, למד ש, לפעמים צריך, מרחב, לשחרר, שליטה, גבול, נשימה (as coping tool)
rhetorical page-ending questions
{{childName}} למד / כולם הרגישו / generic "new things can be good" moral

## Safety / tone
${toneGuardForSpec(spec)}

## Child agency
Child wants, tries, fails, discovers, leads brave action. Companion does NOT solve climax.

${companionDisplayRules(spec.companionId)}

## Companion comic bit bank
${V3_COMIC_BIT_DOSAGE_INSTRUCTION}
Do not invent golden-copy lines.

## Child lexicon (MANDATORY ages 5–8)
Hebrew vocabulary for ages 5–8 ONLY. No abstract/adult/technical words (דואט, קונצרט, תקשורת, גורלי, קצין, ספוט, חרישי, פעור, מסוקרן, דרמטי, נדרך).
The companion's formal-funny voice must be built from SIMPLE words a 6-year-old knows.
Physical sensations described concretely (טיפה קרירה על האצבע — not הקור הקטן).
Imagery through child-known objects: הצגה, שיר, תוף, מפלצת, משחק.
No literary possessive suffixes (פנסו, זנבו — write הפנס שלו, הזנב שלו).

## Gender chips (MANDATORY)
Every child-gendered verb/adj near {{childName}}: full {male|female} with DIFFERENT options.
CORRECT: {{childName}} {התכופף|התכופפה} {החליט|החליטה}
FORBIDDEN: {{childName}} התכופף|התכופפה (bare pipe without braces — importer cannot resolve)
FORBIDDEN: בעצמו, לבדו, שלו on child lines — use ב{עצמו|עצמה}, ל{בדו|בדה}, {שלו|שלה}
FORBIDDEN: ה{וא|יא} סגר{ה} slash/partial forms
{{childName}} stays double-braced — never a chip.

## v5 markdown format
# Story: <title> — Generator-v3
Generated: <ISO>
Source: Generator-v3 scenario
Prompt-version: v3-prose

---
title: "..."
companionId: ${spec.companionId}
direction: ${spec.direction}
category: ${spec.category ?? (spec.resilienceTheme.includes('TRANSITION') ? 'TRANSITION' : spec.resilienceTheme)}
pages: ${pageCount}
gender: female
endingType: residue
---
metadata as appropriate

--- Page N ---
imageDirection: English 25-55 words — scene only
Hebrew prose (2-4 short paragraphs max)

Do NOT emit WORD_COUNT.`.trim();
}

function comicBitsBlock(companionId: string): { bits: string; forbidden: string } {
  const v3Block = buildV3ComicBitBankPromptBlock(companionId);
  const bits = v3Block || formatComicBitsForPrompt(getComicBitsForCompanion(companionId));
  const forbidden = getV3ForbiddenNearGolden(companionId);
  return {
    bits,
    forbidden: forbidden.map((l) => `- ${l}`).join('\n'),
  };
}

function buildAnchors(premise: StoryPremiseCandidate): string {
  const lines = [
    premise.openingWeirdEvent,
    premise.childWant,
    premise.firstTry,
    premise.escalation,
    premise.childDiscovery,
    premise.braveChildAction,
    premise.bigReleasePayoff,
  ].filter(Boolean);
  return `REQUIRED STORY ANCHORS (weave naturally — all must appear in spirit):\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;
}

export async function generateProseV3(args: {
  spec: PremiseExperimentSpecV3;
  spine: StorySpineV3;
  beats: PageBeatV3[];
  premise: StoryPremiseCandidate;
  modelId: string;
  generatedAt?: string;
  /** Optional human-approved mandates appended to user prompt (structure gate, etc.). */
  proseMandates?: string;
}): Promise<{ storyMarkdown: string; inputTokens: number; outputTokens: number }> {
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);
  const { bits, forbidden } = comicBitsBlock(args.spec.companionId);
  const generatedAt = args.generatedAt ?? new Date().toISOString();

  const userPrompt = `
Companion: ${companionBlock}

COMIC BIT BANK:
${bits}

FORBIDDEN NEAR-GOLDEN:
${forbidden}

LOCKED SPINE:
${JSON.stringify(args.spine, null, 2)}

LOCKED PAGE BEATS (obey events — live prose, not beat-sheet Hebrew):
${JSON.stringify(args.beats, null, 2)}

PREMISE:
${JSON.stringify(args.premise, null, 2)}

${buildAnchors(args.premise)}

${args.proseMandates?.trim() ? `${args.proseMandates.trim()}\n\n` : ''}Generated timestamp: ${generatedAt}
titleSeed: ${args.spine.titleSeed}

${args.spec.companionId === 'lion_shaket' && args.beats.length >= 20 ? `
## LION 20-page prose watch
- Sticker goal is MET at p13. Pages 14–20 are denouement only — TIGHT, quick, no new tension.
- Do not pad. Brief wind-down: noise → movement + quiet laughter. Let back third breathe and land.` : ''}

Write complete ${args.beats.length}-page story markdown now. Return valid story only.`.trim();

  const pageCount = pageCountForSpec(args.spec);
  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v3-prose',
    systemPrompt: buildProseSystem(args.spec, pageCount),
    userPrompt,
    maxOutputTokens: 16000,
    temperature: 0.68,
  });

  return {
    storyMarkdown: result.text.trim(),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
