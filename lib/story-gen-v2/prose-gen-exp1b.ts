/**
 * Exp1b — prose-only regeneration from locked spine + beats (read-aloud, v5 format).
 */

import { OpenAIResponsesLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import type { ExperimentSpecV2, PageBeatV2, StorySpineV2 } from './types';

const PROSE_EXP1B_SYSTEM = `You write Hebrew read-aloud picture-book stories for Small Heroes (ages 5–7).
Generator-v2 Exp1b: convert LOCKED PageBeats into LIVE children's prose — not beat-sheet Hebrew.

## Event obedience (do not change the story)
Obey every PageBeatV2 event, childAction, and complicationOrChange exactly.
The child causes the outcome. עֲנָת may guide, misread, joke, worry, fail — but does NOT solve the problem.

## Prose style — read-aloud, not literary
- Short-to-medium sentences. Concrete verbs. Natural dialogue. Physical beats.
- Start pages with motion, dialogue, interruption, or decision — NOT atmosphere.
- At most ONE small lyrical touch in the ENTIRE story, only if grounded in visible action.
- NO therapy language. NO moral lecture. NO abstract adult metaphors.

## FORBIDDEN — rhetorical page-ending questions
Max ONE rhetorical question ending a page in the whole story.
Do NOT copy pageTurnReason questions from beats (e.g. "מה יעשה עכשיו?", "האם יעז לדבר?").
End pages with action, interruption, visible next move, or someone saying/doing something that pulls forward.

BAD page ending: "האם יעז לדבר?"
GOOD page ending: "הוא החזיק את הדלי בשתי ידיים. העלה רעד עליו."

## FORBIDDEN — explicit emotion-summary sentences
Do NOT write: "רצון מתערבב בחשש", "מתח התחלף בסקרנות", "ביטחון נוצר בלבו", "מבוכה מילאה אותו".
Show through hands, feet, breath, looking away, holding an object, speaking too quietly, stopping mid-step.
The emotionalShift field in beats is for YOU — translate to body/action/dialogue, never paste as abstract summary.

## עֲנָת — character, not therapist
Name in prose: עֲנָת only (never פנדה_עֲנָת, never פַּנְדָה־עֲנָת).
Engine: slow over-literal logic, body before mind, comic physical hesitation, soft vulnerability.
Include at least TWO fresh physical/comic/vulnerable Anat beats (invent new — do NOT copy golden lines like flop-on-back, pause-stone, yellow line, chair-train).

## FORBIDDEN poetic/adult lines
Avoid: "כמעט שיר של חול", "כאילו הרוח מקשיבה", "מודדת את הזמן כמו מנגינה", "החול נוזל כמו שיר".

## Length
Do not inflate. Short strong pages OK. No padding.

## Gender chips (prose only)
Every child-gendered verb/adjective near {{childName}}: full {male|female} chip, options MUST differ.
Examples: {עשה|עשתה} {הושיט|הושיטה} {הסתכל|הסתכלה} {אמר|אמרה} {שפך|שפכה} {עמד|עמדה}
Never: {{childName}} עושה (bare masculine). Never slash forms. Never broken chips.

## v5 markdown format (mandatory)
# Story: <id> — Generator-v2 Exp1b
Generated: <ISO timestamp>
Source: Generator-v2 Exp1b prose-only (locked spine/beats)
Prompt-version: v2-event-driven-exp1b

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
powerCard:
  title: "..."
  subtitle: "..."
  coreTool: "..."
  steps:
    - "step with {male|female} chips in Hebrew"
    - ...
  companionReminder: "..."
  visualMotifs:
    - ...
---

storyStyle: ...
metaphor: ...
stakes: ...
quietPagePosition: N
heartLine: עמוד N — ...
emotionalMistake: עמוד N — ...
uncomfortableTruth: עמוד N — ...
agencyTransfer: עמוד N — ...

--- Page 1 ---
Hebrew prose (2-4 short paragraphs max per page)
imageDirection: English scene brief on same line label

--- Page 2 ---
...

Use --- Page N --- headers (NOT ### Page N). YAML between --- lines (NOT code fence).
YAML gender: literal female OR male (metadata only — chips in prose).
Do NOT emit WORD_COUNT.`.trim();

export async function generateProseExp1b(args: {
  spine: StorySpineV2;
  beats: PageBeatV2[];
  spec: ExperimentSpecV2;
  modelId: string;
}): Promise<{ storyMarkdown: string; inputTokens: number; outputTokens: number }> {
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);

  const userPrompt = `
Companion profile:
${companionBlock}

LOCKED STORY SPINE (events fixed — do not change):
${JSON.stringify(args.spine, null, 2)}

LOCKED PAGE BEATS (translate to live prose — do NOT paste emotionalShift or pageTurnReason as abstract lines or questions):
${JSON.stringify(args.beats, null, 2)}

Setting: ${args.spec.setting}
Game: ${args.spec.gameOrPlayPattern}
Key object: ${args.spec.keyObject}

FORMAT REFERENCE (structure only — different plot):
--- Page 1 ---
מִגְרַשׁ המשחקים היה מלא קולות.
{{childName}} {עמד|עמדה} ליד השער.
הרגליים רצו פנימה. העיניים רצו גם.
אבל הבטן ביקשה לחכות עוד רגע.

imageDirection: The child stands at the playground entrance...

Write the complete ${args.spec.pageCount}-page story now.
titleSeed from spine: ${args.spine.titleSeed}`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v2-prose-exp1b',
    systemPrompt: PROSE_EXP1B_SYSTEM,
    userPrompt,
    maxOutputTokens: 12000,
    temperature: 0.72,
  });

  return {
    storyMarkdown: result.text.trim(),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
