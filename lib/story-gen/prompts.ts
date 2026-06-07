import type { Scenario, StoryDirection, StoryOutline } from './story-generation-types';
import { DIRECTION_PAGE_COUNTS } from './story-generation-types';

const SHARED_RULES = `
You write Hebrew picture-book stories for Small Heroes (ages 3–6).
Rules:
- Partial niqqud on key words for TTS (not full vocalization).
- Gender chips: {male|female} form e.g. {רץ|רצה}, {אמר|אמרה}, {מוכן|מוכנה}.
- Placeholders: {{childName}} always; never a fixed child name.
- Companion must sound specific — not generic therapist voice.
- No moralizing lecture; show through action and residue ending.
- Avoid template phrases: "ואז הבין/הבינה", "בסוף הכל הסתדר", "היה/הייתה מאושר/ת".
- imageDirection lines are English, one per page, after prose.
`.trim();

export function buildOutlineSystemPrompt(): string {
  return `${SHARED_RULES}

You are step 1 of an outline-first pipeline. Output ONLY valid JSON matching the schema.
Beats are page-level summaries only — no full prose yet.`;
}

export function buildOutlineUserPrompt(args: {
  companionBlock: string;
  scenario: Scenario;
  fewShotsBlock: string;
  beatCount: number;
}): string {
  const { companionBlock, scenario, fewShotsBlock, beatCount } = args;
  return `
Companion profile:
${companionBlock}

Scenario (locked — do not drift):
- id: ${scenario.id}
- setting: ${scenario.setting}
- inciting: ${scenario.incitingIncident}
- emotional core: ${scenario.emotionalCore}
- companion role: ${scenario.companionRole}
- agency transfer: ${scenario.agencyTransfer}
- climax: ${scenario.climaxShape}
- ending residue: ${scenario.endingResidue}
- distinctness: ${scenario.distinctnessNotes}

Direction: ${scenario.direction} (${beatCount} pages)
Category: ${scenario.category}
Title seed: ${scenario.titleSeed}

Golden-tier references (match craft, not plot):
${fewShotsBlock}

Return JSON:
{
  "title": "Hebrew title with {{childName}}",
  "worldRule": "short Hebrew rule the child can reuse",
  "powerCard": {
    "title": "...",
    "subtitle": "...",
    "coreTool": "...",
    "steps": ["4 short steps with / gender where needed"],
    "companionReminder": "...",
    "visualMotifs": ["3-5 English motif tags"]
  },
  "metadata": {
    "storyStyle": "...",
    "metaphor": "...",
    "stakes": "...",
    "quietPagePosition": number,
    "heartLine": "עמוד N — ...",
    "emotionalMistake": "עמוד N — ...",
    "uncomfortableTruth": "עמוד N — ...",
    "agencyTransfer": "עמוד N — ..."
  },
  "beats": [
    { "page": 1, "beatSummary": "...", "emotionalTurn": "...", "companionBeat": "optional" }
  ]
}
Exactly ${beatCount} beats, pages 1..${beatCount}.`.trim();
}

export function buildProseSystemPrompt(direction: StoryDirection): string {
  const pageCount = DIRECTION_PAGE_COUNTS[direction];
  return `${SHARED_RULES}

You are step 2: expand a LOCKED outline into full story markdown.
Output format MUST match Small Heroes v5 golden template:
- Header comment block (# Story: ..., Generated, Source, Prompt-version: v5-story-gen-phase-a, Notes)
- YAML frontmatter between --- lines (title, companionId, direction, category, timeOfDay, gender, pages: ${pageCount}, endingType: residue, worldRule, powerCard)
- Metadata lines: storyStyle, metaphor, stakes, quietPagePosition, heartLine, emotionalMistake, uncomfortableTruth, agencyTransfer
- For each page: --- Page N ---, Hebrew prose (2-5 short paragraphs), blank line, imageDirection: English scene brief
- End with WORD_COUNT: [n1, n2, ...] = total (estimate per page word counts in Hebrew)

Do NOT change the outline beats or power card core. Follow the locked outline exactly.`;
}

export function buildProseUserPrompt(args: {
  companionBlock: string;
  scenario: Scenario;
  outline: StoryOutline;
  fewShotsBlock: string;
}): string {
  const { companionBlock, scenario, outline, fewShotsBlock } = args;
  return `
Companion profile:
${companionBlock}

Scenario id: ${scenario.id}
Companion id: ${scenario.companionId}
Direction: ${scenario.direction}

LOCKED OUTLINE (JSON):
${JSON.stringify(outline, null, 2)}

One golden prose sample (format reference only):
${fewShotsBlock.split('---')[0]?.trim() ?? fewShotsBlock.slice(0, 2500)}

Write the complete story markdown now.`.trim();
}
