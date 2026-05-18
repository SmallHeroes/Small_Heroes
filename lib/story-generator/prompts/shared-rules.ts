import { KILL_PHRASES } from '@/lib/story-validators/data/kill-phrases';

export const KID_FIRST_PRINCIPLES = `
Kid-First principles (invisible scaffolding — never preach):
- Body Before Meaning: emotion shows in body, object, or environment before any softening words.
- Companion Swap Test: the story must REQUIRE this companion's signature sound/object/micro-action.
- No quote-card sentences parents would post online.
- Repeatable hook: sound, phrase, or micro-action the child can copy — at least twice.
- Two pacing registers: at least one quiet page and one active page.
`.trim();

export const KILL_PHRASES_BLOCK = `
Forbidden kill phrases (never write these or close paraphrases):
${KILL_PHRASES.map((p) => `- ${p}`).join('\n')}
`.trim();

export const MARKDOWN_FORMAT_RULES = `
Story markdown format (strict):
---
title: "Hebrew title"
companionId: <id>
direction: bedtime|adventure|fantasy
childGender: boy|girl
pages: N
---

--- Page 1 ---
[Hebrew prose only — no English in body]

imageDirection: [English illustration brief — shot, child position, companion position]

(repeat for every page 1..N)
`.trim();
