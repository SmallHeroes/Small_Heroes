# Phase 3h — Prompt Consolidation & Entity/Companion Alignment

## Root Cause Analysis

Generated a test book ("הספר של לולי", night fears category). Story is flat, boring, no drama. Investigation found **3 structural problems** in the prompt system:

### Problem 1: TWO CONFLICTING STORY STRUCTURES in the same prompt

The `buildRawStoryPrompt()` user prompt contains:
- **DRAMATIC ARC** (line ~1099 in system prompt, from 3g): "Scenes 1-2: SETUP... 3-4: FIRST ATTEMPTS... 7: TURNING POINT..."
- **STORY STRUCTURE (MANDATORY – MUST FOLLOW)** (line ~1321 in user prompt): "1. Calm Beginning → 2. Disruption → 3. Fear Escalation → 4. First Attempt → 5. Intervention → 6. Movement → 7. Confrontation → 8. Resolution → 9. Return"

These are contradictory. The LLM gets confused, defaults to safe/flat. The old STORY STRUCTURE is fear-oriented and rigid — it kills adventure/humor energy.

### Problem 2: Narrative Constraint overrides all fun

For NIGHT_FEAR category, the constraint says:
> "Story stays mostly in the real environment (bedroom, bed, hallway). No separate fantasy world, portal, or long adventure arc."

This is labeled "HIGHEST PRECEDENCE" and explicitly overrides imagination/wonder rules. Result: the LLM writes a timid bedroom-bound story with no energy.

### Problem 3: Entity ≠ Companion (data collision)

- Brain stage generates an independent `entity` (could be an owl, a dog, anything)
- Wizard provides `companionForStory` (e.g., a panda named "במבו")
- Line 689 says "The JSON entity should align with this companion" but this instruction is in the OUTLINE prompt, not the Brain prompt
- The Brain has already generated a DIFFERENT entity by then
- Prose stage uses `brain.entity.personality` for scene writing — which is the Brain's invention, NOT the wizard companion
- Result: story features random owl/dog instead of the user's chosen panda

### Problem 4: Prompt is ~3000 words of contradicting rules

The user prompt has: Writing Rules, Location Rules, Entity Rules, Superpower Rules (with PLAY LOOP), Environment Rules, Imagination Rules, Humor Beats (duplicated from system prompt), Language Style, Fun/Chaos, Structure Guardrails, Climax, WOW, Ending, FORBIDDEN words, STORY STRUCTURE, STRICT REQUIREMENTS, FORBIDDEN rules — plus the Category Narrative Constraint. Many rules contradict each other. The LLM averages them into mush.

---

## Fixes (ordered)

### Fix 1: Remove old STORY STRUCTURE block

**File:** `backend/providers/pipeline.ts` — inside `buildRawStoryPrompt()` function

**Action:** DELETE the entire block from `### STORY STRUCTURE (MANDATORY – MUST FOLLOW)` through `- Do NOT make the entity passive` (lines 1321-1380 approximately).

This block starts with:
```
### STORY STRUCTURE (MANDATORY – MUST FOLLOW)

The story MUST follow this exact progression:

1. **Calm Beginning**
```

And ends with:
```
### FORBIDDEN

- Do NOT keep the story in a single room
- Do NOT resolve the story without action
- Do NOT rely only on feelings or descriptions
- Do NOT make the entity passive
```

DELETE ALL OF IT. The DRAMATIC ARC in `buildProse3ASystem()` replaces this entirely.

Keep the `narrativeConstraintProse` and `buildStoryDirectionReinforcementBlock(input)` that come after — just remove the static structure block.

The line that builds the final return should become:
```typescript
- The entity cannot fix the core problem alone; without the child's action, nothing improves.

` + narrativeConstraintProse + buildStoryDirectionReinforcementBlock(input);
```

Wait — looking at the code more carefully, the return statement is:
```typescript
- Do NOT make the entity passive` + narrativeConstraintProse + buildStoryDirectionReinforcementBlock(input);
```

Change it to end the template literal after the humor/fun section, keeping only essential FORBIDDEN items:
```typescript
FORBIDDEN anywhere:
"הרגישה" / "הרגיש" / "ידעה" / "ידע" / "חשה" / "חש"
"נשמה עמוק" / "נרגעה" / "נרגע" / "ידעה שהכל בסדר"
"הכל יסתדר" / "העולם חזר" / "הכל יהיה בסדר"
Any sentence naming an internal state, explaining a feeling, or summarizing what happened.
Any formal/literary wording such as: "מגחך", "כעת", "הביע", "התבונן", "בחוסר ביטחון", "חש תחושת", "התמלא בתחושת".

If the story feels calm, soft, or summarized — it is wrong. It must feel alive.` + narrativeConstraintProse + buildStoryDirectionReinforcementBlock(input);
```

---

### Fix 2: Force entity = companion at Brain stage

**File:** `backend/providers/pipeline.ts` — `buildBrainUserPrompt()` function (around line 605)

**Where:** After the `companionBlock` variable is built (line 675-692), it's used in the Brain user prompt. But the problem is the Brain SYSTEM prompt tells the LLM to invent an entity freely.

**Action:** Add a hard constraint to the Brain system prompt when `companionForStory` is provided.

In `generateBrain()` (line 835), AFTER `const systemWithConstraint = ...` is built, add:

```typescript
// If a wizard companion is provided, force the entity to BE that companion
const companionEntityOverride = input.companionForStory
  ? `

ENTITY IDENTITY LOCK (CANNOT BE OVERRIDDEN):
The entity in this story IS the companion character: "${input.companionForStory.name}".
- entity.name MUST be "${input.companionForStory.name}"
- entity.type MUST be "external_helper"
- entity.personality MUST align with: "${input.companionForStory.tagline}"
- entity.humor_hook MUST come from this character's nature
- Do NOT invent a different entity. The companion IS the entity.
- Visual: ${input.companionForStory.visualDescription}
`
  : '';

const finalSystem = systemWithConstraint + companionEntityOverride;
```

Then change the `callLLM` call on line 919 from:
```typescript
const result = await callLLM(systemWithConstraint, buildBrainUserPrompt(input), 2500, 0.85, 'Brain');
```
To:
```typescript
const result = await callLLM(finalSystem, buildBrainUserPrompt(input), 2500, 0.85, 'Brain');
```

---

### Fix 3: Soften narrative constraint for NIGHT_FEAR to allow fun

**File:** `lib/categoryBranching.ts` — NIGHT_FEAR entry (line ~372)

**Change** the `narrativeConstraint` from:
```
'Story stays mostly in the real environment (bedroom, bed, hallway, night light, blanket, window). Imaginative play is allowed only as soft, brief mental images or dreamlike moments that stay tied to that same room—no separate fantasy world, portal, dimension, or long "adventure realm" arc.'
```

**To:**
```
'Story is anchored in the real home environment (bedroom, hallway, window). However, the real space CAN behave magically: shadows can become characters, blankets can become landscapes, ceiling stickers can come alive, objects can talk or move. The child stays physically in the home but the environment transforms around them in surprising, playful ways. Brief dreamlike sequences are allowed if they stay connected to the room. No full portal to a separate world — but the room itself should feel alive, reactive, and full of wonder. The story must still feel fun, surprising, and adventurous WITHIN this intimate space.'
```

---

### Fix 4: Cut prompt bloat — remove duplicate humor/structure rules from user prompt

**File:** `backend/providers/pipeline.ts` — `buildRawStoryPrompt()` function

The user prompt currently has BOTH:
- "Humor beats (required)" section (~lines 1258-1276) — 18 lines of humor rules
- "Fun, chaos, and surprise" section (~lines 1291-1295) — more humor/chaos rules

These duplicate what's already in `buildProse3ASystem()` system prompt (HUMOR RULES section).

**Action:** Replace the entire "Humor beats (required)" section AND "Fun, chaos, and surprise" section with a SHORT reference:

```
Humor and fun: Follow the HUMOR RULES and DRAMATIC ARC in the system prompt. Every 2-3 scenes needs a fun/physical moment. Entity must have comedy moments.
```

Also, the "Climax (three beats)" section (lines 1301-1307) duplicates the DRAMATIC ARC scene 7 turning point. Replace with:

```
Climax: Follow the DRAMATIC ARC. The child must take decisive action with the superpower at real risk. The entity struggles before the child acts.
```

---

### Fix 5: Remove "Superpower PLAY LOOP" duplication

**File:** `backend/providers/pipeline.ts` — `buildRawStoryPrompt()`

Lines 1230-1236 have "PLAY LOOP (MANDATORY)" which says the child must attempt the power 3 times. This conflicts with the DRAMATIC ARC timing (which has its own rhythm). The 3-attempt requirement forces repetitive "try → fail" loops — exactly the problem we see.

**Action:** Remove the PLAY LOOP block entirely (lines 1228-1236):
```
DELETE:
- PLAY LOOP (MANDATORY, inside existing structure):
  - The child must attempt using the power at least 3 times.
  - Attempt #1 outcome: clear failure.
  - Attempt #2 outcome: unexpected/funny result.
  - Attempt #3 outcome: successful use that enables resolution.
  - Each attempt must be action-based and happen at a different moment in the story flow.
```

The DRAMATIC ARC already handles power progression (scenes 3-4: first attempts go wrong, scene 7: turning point).

---

## Summary of Changes

| # | File | Action | Impact |
|---|------|--------|--------|
| 1 | pipeline.ts `buildRawStoryPrompt` | Delete STORY STRUCTURE block (lines 1321-1380) | Removes conflicting structure |
| 2 | pipeline.ts `generateBrain` | Add companion→entity lock when companion provided | Fixes owl/dog instead of panda |
| 3 | lib/categoryBranching.ts | Soften NIGHT_FEAR narrativeConstraint | Allows fun in bedroom stories |
| 4 | pipeline.ts `buildRawStoryPrompt` | Cut humor/fun/climax sections (~30 lines → 3 lines) | Reduces prompt noise |
| 5 | pipeline.ts `buildRawStoryPrompt` | Delete PLAY LOOP block | Stops forced repetitive tries |

---

## Implementation Order

1. Fix 2 (entity = companion) — highest user-visible impact, companion is central to the product
2. Fix 1 (remove old STORY STRUCTURE) — removes the contradiction that's confusing the LLM
3. Fix 5 (remove PLAY LOOP) — stops the repetitive try/fail pattern
4. Fix 3 (soften narrative constraint) — allows night stories to be fun
5. Fix 4 (cut bloat) — improves prompt signal-to-noise

---

## Testing

After implementing, generate a new book with:
- Category: NIGHT_FEAR (same as "לולי")
- Companion: any (e.g. panda "במבו")
- Child: any girl, age 5

**Check:**
- [ ] Story entity IS the wizard companion (not a random owl/dog)
- [ ] Story has clear dramatic arc (setup → escalation → turning point → resolution)
- [ ] Story has humor moments from the companion character
- [ ] No repetitive "tried X, failed / tried Y, failed / tried Z, failed" pattern
- [ ] Night story still feels intimate but is FUN and surprising (room transforms)
- [ ] Story is NOT flat/boring — things happen, child takes action, stakes exist

---

## IMPORTANT NOTE

Before running: make sure the dev server is restarted after changes. The previous test may have used cached/old code if the server wasn't restarted after the 3g commit.
