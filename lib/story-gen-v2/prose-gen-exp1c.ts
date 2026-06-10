/**
 * Exp1c — Exp1b prose + Companion Comic Bits Bank + golden-copy guard.
 */

import { OpenAIResponsesLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import {
  formatComicBitsForPrompt,
  getComicBitsForCompanion,
  PANDA_ANAT_FORBIDDEN_NEAR_GOLDEN,
} from './companion-comic-bits';
import type { ExperimentSpecV2, PageBeatV2, StorySpineV2 } from './types';

const PROSE_EXP1C_SYSTEM = `You write Hebrew read-aloud picture-book stories for Small Heroes (ages 5–7).
Generator-v2 Exp1c: convert LOCKED PageBeats into LIVE children's prose — not beat-sheet Hebrew.

## Event obedience (do not change the story)
Obey every PageBeatV2 event, childAction, and complicationOrChange exactly.
The child causes the outcome. עֲנָת may guide, misread, joke, worry, fail — but does NOT solve the problem.

## Companion comic bit bank
Use 2–3 bits from the bank below, ADAPTED naturally to the exact page events.
- Do not copy them mechanically if the scene needs light adaptation.
- At most ONE bank bit per page.
- Do not force a bit if it breaks the event.
- Do not invent a replacement by copying golden lines.
- Child remains protagonist; companion bits decorate and support the child's action.

## Prose style — read-aloud, not literary
- Short-to-medium sentences. Concrete verbs. Natural dialogue. Physical beats.
- Start pages with motion, dialogue, interruption, or decision — NOT atmosphere.
- At most ONE small lyrical touch in the ENTIRE story, only if grounded in visible action.
- NO therapy language. NO moral lecture. NO abstract adult metaphors.
- Avoid mixed child+companion plural without chips (BAD: "{{childName}} ועֲנָת נשארו"). Split into two sentences with chips on child only.

## FORBIDDEN — rhetorical page-ending questions
Max ONE rhetorical question ending a page in the whole story.
Do NOT copy pageTurnReason questions from beats.
End pages with action, interruption, visible next move, or someone saying/doing something.

## FORBIDDEN — explicit emotion-summary sentences
Do NOT write abstract emotional explanations. Show through body/action/dialogue.
Never paste emotionalShift from beats as summary lines.

## עֲנָת — character, not therapist
Name in prose: עֲנָת only (never פנדה_עֲנָת).
Use comic bits bank for fresh humor — do NOT improvise golden-copy lines.

## FORBIDDEN near-golden lines (do not use or paraphrase closely)
- כף הרגל השמאלית כבר השתכנעה / foot already convinced variants
- הרגליים רצו פנימה / הבטן ביקשה לחכות
- אבן השהייה / pause-stone / yellow line / chair-train / wheel role
- לא צריך לרוץ כדי להצטרף (as exact phrase)

## Gender chips (prose only)
Every child-gendered verb/adjective near {{childName}}: full {male|female} chip, options MUST differ.
Correct: {הרים|הרימה} {הושיט|הושיטה} {אמר|אמרה} {שפך|שפכה}
WRONG: {הרימו|הרימה} {הרים|הריםה} bare masculine after {{childName}}

## v5 markdown format (mandatory)
# Story: <id> — Generator-v2 Exp1c
Generated: <use exact ISO timestamp from user prompt>
Source: Generator-v2 Exp1c prose-only (locked spine/beats + comic bits)
Prompt-version: v2-event-driven-exp1c

---
title: "..."
companionId: panda_anat
direction: adventure
category: SOCIAL
timeOfDay: day
gender: female
pages: 12
endingType: residue
worldRule: "..."
powerCard: (title, subtitle, coreTool, 4 steps with chips, companionReminder, visualMotifs)
---

storyStyle, metaphor, stakes, quietPagePosition, heartLine, emotionalMistake, uncomfortableTruth, agencyTransfer

--- Page N ---
Hebrew prose then imageDirection: English line

Use --- Page N --- (NOT ###). YAML between --- (NOT code fence). Do NOT emit WORD_COUNT.`.trim();

export async function generateProseExp1c(args: {
  spine: StorySpineV2;
  beats: PageBeatV2[];
  spec: ExperimentSpecV2;
  modelId: string;
  generatedAt?: string;
}): Promise<{ storyMarkdown: string; inputTokens: number; outputTokens: number }> {
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);
  const comicBits = getComicBitsForCompanion(args.spec.companionId);
  const generatedAt = args.generatedAt ?? new Date().toISOString();

  const userPrompt = `
Companion profile:
${companionBlock}

COMPANION COMIC BIT BANK (human-authored — adapt 2–3 across story):
${formatComicBitsForPrompt(comicBits)}

FORBIDDEN NEAR-GOLDEN (never use):
${PANDA_ANAT_FORBIDDEN_NEAR_GOLDEN.map((l) => `- ${l}`).join('\n')}

LOCKED STORY SPINE:
${JSON.stringify(args.spine, null, 2)}

LOCKED PAGE BEATS (translate to live prose — do NOT paste emotionalShift/pageTurnReason as questions or labels):
${JSON.stringify(args.beats, null, 2)}

Setting: ${args.spec.setting}
Game: ${args.spec.gameOrPlayPattern}
Key object: ${args.spec.keyObject}

Use this exact header timestamp: ${generatedAt}
titleSeed: ${args.spine.titleSeed}
pages: ${args.spec.pageCount}

Write the complete ${args.spec.pageCount}-page story now.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v2-prose-exp1c',
    systemPrompt: PROSE_EXP1C_SYSTEM,
    userPrompt,
    maxOutputTokens: 12000,
    temperature: 0.7,
  });

  return {
    storyMarkdown: result.text.trim(),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
