import type { Scenario, StoryDirection, StoryOutline } from './story-generation-types';
import { DIRECTION_PAGE_COUNTS } from './story-generation-types';
import { formatScenarioPromptBlock } from './scenario-prompt-block';
import { formatAdventureDensityExemplarBlock } from './adventure-density-exemplar';
import { ADVENTURE_WORD_MAX, ADVENTURE_WORD_MIN } from './word-bands';

const ANTI_POETIC_CLOSURE = `
- Anti-poetic-closure: do NOT end pages or the story with abstract adult metaphors ("נשאר בלב", "שפת X", "נקודה רכה", "הגוף מספר") unless grounded in a visible child action in the same beat (e.g. foot on soil, hand on ball — not disembodied poetry).`.trim();

const ADVENTURE_PROSE_RULES = `
ADVENTURE PROSE (mandatory — not bedtime rhythm):
- Target ${ADVENTURE_WORD_MIN}–${ADVENTURE_WORD_MAX} Hebrew words per page (2–4 short sentences with concrete detail).
- Do NOT compress adventure into bedtime-length pages (~20–25 words). Thin pages FAIL the thinness gate.
- Every page needs at least one specific visual or movement detail (object, body part, sound, or named action).
- The group play scene MUST be concrete: name the game/play-pattern, include a specific object, a turn or rule, and a visible movement — NEVER generic "ילדים משחקים" / "kids playing" without specifics.
- Gender chips MUST differ: {male|female} options must NOT be identical (e.g. never {מנסה|מנסה}).`.trim();

const SHARED_RULES = `
You write Hebrew picture-book stories for Small Heroes (ages 3–6).
Rules:
- Partial niqqud on key words for TTS (not full vocalization).
- Gender chips: {male|female} form e.g. {רץ|רצה}, {אמר|אמרה}, {מוכן|מוכנה}.
- Every verb/adjective referring to the child MUST be either a full {male|female} chip OR genuinely gender-neutral Hebrew. Never use masculine as neutral (e.g. never "{{childName}} מוריד ראש" — use {מוריד|מורידה} or neutral wording). One verb per chip — never phrase chips like {מחייך ומניח|מחייכת ומניחה}.
- Placeholders: {{childName}} always; never a fixed child name.
- Companion must sound specific — not generic therapist voice.
- No moralizing lecture; show through action and residue ending.
- Avoid template phrases: "ואז הבין/הבינה", "בסוף הכל הסתדר", "היה/הייתה מאושר/ת".
- imageDirection lines are English, one per page, after prose.
${ANTI_POETIC_CLOSURE}
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
  const scenarioBlock = formatScenarioPromptBlock(scenario, scenario.companionId);
  return `
Companion profile (DeepProfile):
${companionBlock}

${scenarioBlock}

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
Exactly ${beatCount} beats, pages 1..${beatCount}.
${scenario.direction === 'adventure' ? `\nAdventure outline: beats MUST name a specific group game/play-pattern, a concrete object, and at least one turn or movement rule — not generic "kids playing".` : ''}`.trim();
}

export function buildProseSystemPrompt(direction: StoryDirection, phaseB = false): string {
  const pageCount = DIRECTION_PAGE_COUNTS[direction];
  const promptVersion = phaseB ? 'v5-story-gen-phase-b' : 'v5-story-gen-phase-a';
  const wordCountRule = phaseB
    ? '- Do NOT emit WORD_COUNT — a post-processor adds deterministic counts'
    : '- End with WORD_COUNT: [n1, n2, ...] = total (estimate per page word counts in Hebrew)';
  const genderRule = phaseB
    ? '- YAML gender: literal male OR female (bank metadata — NOT {male|female} chips; chips belong in prose only)'
    : '- YAML frontmatter gender field as in golden template';
  const companionIdRule = phaseB
    ? '- YAML companionId: exact bank id from scenario (e.g. baby_elephant, bolly_armadillo — no tubi_ prefix)'
    : '';
  const adventureBlock =
    direction === 'adventure'
      ? `\n${ADVENTURE_PROSE_RULES}\n\n${formatAdventureDensityExemplarBlock()}`
      : '';

  return `${SHARED_RULES}
- {{childName}} is a double-brace placeholder — NOT a gender chip. Gender chips are single-brace only: {male|female}.

You are step 2: expand a LOCKED outline into full story markdown.
Output format MUST match Small Heroes v5 golden template:
- Header comment block (# Story: ..., Generated ISO timestamp, Source, Prompt-version: ${promptVersion}, Notes)
- YAML frontmatter between --- lines (title, companionId, direction, category, timeOfDay, gender, pages: ${pageCount}, endingType: residue, worldRule, powerCard)
${genderRule}
${companionIdRule}
- Metadata lines: storyStyle, metaphor, stakes, quietPagePosition, heartLine, emotionalMistake, uncomfortableTruth, agencyTransfer
- For each page: --- Page N ---, Hebrew prose (2-5 short paragraphs), blank line, imageDirection: English scene brief
${adventureBlock}
${wordCountRule}
- Hebrew prose only — no Latin letter drift inside Hebrew words (e.g. בחצי not בחצi)

Do NOT change the outline beats or power card core. Follow the locked outline exactly.`;
}

export function buildProseUserPrompt(args: {
  companionBlock: string;
  scenario: Scenario;
  outline: StoryOutline;
  fewShotsBlock: string;
}): string {
  const { companionBlock, scenario, outline, fewShotsBlock } = args;
  const scenarioBlock = formatScenarioPromptBlock(scenario, scenario.companionId);
  return `
Companion profile (DeepProfile):
${companionBlock}

${scenarioBlock}

LOCKED OUTLINE (JSON):
${JSON.stringify(outline, null, 2)}

One golden prose sample (format reference only):
${fewShotsBlock.split('---')[0]?.trim() ?? fewShotsBlock.slice(0, 2500)}

Honor Phase B contract if present: QA line, engine/tool as action, child agency, comic beat, forbidden patterns.
${scenario.direction === 'adventure' ? 'Honor locked play-concreteness in the scenario block — use the named game, object, and turn in prose.' : ''}
Write the complete story markdown now.`.trim();
}
