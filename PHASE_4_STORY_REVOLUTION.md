# Phase 4 — Story Pipeline Revolution

## The Problem (one sentence)

We ask one LLM call to invent a metaphor, build an arc, write rhythmic Hebrew,
follow 50+ constraints, avoid 30+ words, and produce magic — and it drowns,
producing flat descriptions instead of stories.

## The Solution (one sentence)

Pre-design the creative DNA (metaphor, twist, arc) per category, then let the
LLM focus ONLY on writing beautiful Hebrew prose scene-by-scene.

---

## Architecture: 3 Layers

### Layer 1: Story DNA (human-designed, stored in code)

For each challenge category, we write 3-5 **Story DNA** templates.
A Story DNA is NOT a full story. It's a structural blueprint:

```typescript
interface StoryDNA {
  id: string;
  category: ChallengeCategory;
  title_template: string;           // "הענק שהלך לאיבוד"
  metaphor: {
    what_it_is: string;             // "booms are footsteps of a lost giant"
    why_its_scary: string;          // "the booms are loud and shake the windows"
    the_twist: string;              // "the giant isn't scary — he's lost and sad"
    how_child_helps: string;        // "child approaches, talks, helps him find his way home"
  };
  arc: {
    opening: string;                // "child in bed, hears first boom"
    curiosity: string;              // "what was that? looks out window"
    encounter: string;              // "sees the giant, he's huge but his eyes are sad"
    misunderstanding: string;       // "child hides at first, thinks giant is dangerous"
    companion_role: string;         // "companion encourages child to look closer"
    discovery: string;              // "realizes giant is crying, not roaring"
    connection: string;             // "child approaches, talks to giant"
    help: string;                   // "together they find the path home"
    resolution: string;             // "giant walks away, booms get quieter"
    warm_close: string;             // "child in bed, hears a distant boom, smiles"
  };
  superpower_integration: string;   // "child's power is what helps the giant — e.g. light to show the path"
  humor_beats: string[];            // ["giant tries to tiptoe but still shakes the house", "giant sits on a tiny chair and breaks it"]
  companion_moments: string[];      // ["companion hides behind child when giant appears", "companion does funny dance to cheer giant up"]
  emotional_peak: string;           // "child touches giant's finger — giant's face softens"
  forbidden_patterns: string[];     // things this specific DNA must avoid
}
```

**Key insight:** The metaphor, the twist, and the arc are the HARD creative parts.
Humans do this better than LLMs. Once these are locked, the LLM just needs to write
beautiful prose — which it CAN do well when focused.

### Layer 2: Scene-by-Scene Generation (LLM, focused calls)

Instead of one massive call that writes 10 scenes, we make 10 small calls.
Each call gets:
- The Story DNA (the structural blueprint)
- The child's specific details (name, age, companion, superpower)
- Just THIS scene's beat from the arc
- The previous scene's text (for continuity)
- A SHORT, focused prompt (200 words max, not 3000)

```
Scene 3 prompt:
---
Story: {childName} hears booms and discovers a lost giant.
This scene: ENCOUNTER — {childName} sees the giant for the first time.

Previous scene ended with: "...והחלון רעד שוב. הפעם חזק יותר."

Beat: The giant appears. He's HUGE. But something is off — his eyes are sad.
{childName} freezes. {companionName} hides behind {childName}'s leg.

Write this scene in Hebrew. 60-80 words.
Show everything through action and body — never name emotions.
End on a moment of tension — {childName} wants to run but doesn't.
---
```

This prompt is clear, focused, and the LLM can nail it because it only has ONE job.

### Layer 3: Quality Review + Polish (LLM, 2 passes)

**Pass 1 — Story Doctor:**
Read the complete 10-scene story and check:
- Does any sentence NAME an emotion? → rewrite it
- Is any scene just description with no action? → flag it
- Does the arc actually build? → flag flat spots
- Is the companion present in the right scenes? → fix

**Pass 2 — Hebrew Rhythm:**
Read the complete story and polish:
- Break long sentences into shorter ones
- Add rhythm variation (long, short, short, very short)
- Add natural sound words where they fit
- Make dialogue feel overheard, not written
- Ensure age-appropriate vocabulary

---

## Story DNA Examples

### NIGHT_FEAR DNA #1: "השועל שאסף כוכבים"

```
metaphor:
  what: Stars are falling off the ceiling and the room is getting darker.
        A small fox is trying to collect them, but keeps dropping them.
  scary: The darkness grows as more stars fall. The room feels bigger and emptier.
  twist: The fox isn't causing the darkness — he's trying to fight it.
         He's been collecting stars every night to keep the room bright for the child.
  help: Child discovers that when they hold a star and blow on it gently, it floats
        back up to the ceiling and sticks. Together they restore the sky.

arc:
  opening: Child in bed. Ceiling stickers glow like always. One blinks and falls.
  curiosity: Another star falls. Tiny "tink" sound. Child looks down — a small
             fox is running between fallen stars, trying to carry them.
  encounter: Fox notices child watching. Freezes. A star slips from his mouth.
             He looks embarrassed.
  misunderstanding: Child thinks fox is STEALING the stars. "Hey! Those are mine!"
                    Fox runs, drops more stars. Room gets darker.
  companion_role: Companion (from wizard) calms child. "Wait — look at his paws."
                  Fox's paws are glowing where he touched the stars.
  discovery: Child gets out of bed. Steps on a fallen star — it's warm.
             Fox is in the corner, surrounded by stars, trying to push one up the wall.
             It keeps sliding down. He looks up at the ceiling and whimpers.
  connection: Child kneels next to fox. Picks up a star. It glows brighter in their hand.
              Child blows on it gently — it floats up and sticks to the ceiling.
              Fox's eyes go wide. His tail wags.
  help: Together they blow stars back up. Fox carries them in his mouth, child blows.
        Room gets brighter with each one. Fox does a silly spin of excitement.
  resolution: Last star goes up. The ceiling glows like before.
              Fox yawns, curls up at the foot of the bed.
  warm_close: Child pulls blanket up. Looks at the ceiling full of stars.
              Whispers "good night" to the fox. His ear twitches.

humor:
  - Fox tries to carry three stars at once, they all roll away in different directions
  - Fox tries to jump up to stick a star on the ceiling, bonks his nose
  - Fox does a victory spin when first star goes up, gets dizzy

superpower: Child's breath makes fallen stars float back up (ties to any "light" or
"imagination" power — the child's breath/focus is what activates it)
```

### NIGHT_FEAR DNA #2: "הצל שרצה חבר"

```
metaphor:
  what: The shadow on the wall isn't a monster — it's a lonely creature who only
        exists when the light is off. It's been trying to play with the child
        but doesn't know how to say hello without scaring them.
  scary: Shadow moves, grows, changes shape. Child pulls blanket up.
  twist: The shadow keeps making shapes — it's trying to make a puppet show.
         It's been practicing every night. It just wants the child to watch.
  help: Child makes a shadow puppet with their hand. The shadow copies it.
        They start making shapes together — a dialogue in shadow language.

arc:
  opening: Light goes off. Child stares at the ceiling. A shadow moves on the wall.
  curiosity: Shadow makes a shape. Was that... a rabbit? No, it collapsed.
             Shadow tries again. This time it looks like a bird. Almost.
  encounter: Child sits up. Shadow freezes — as if caught.
             Then slowly stretches into something tall. Child pulls blanket up.
  misunderstanding: Child yells "GO AWAY!" Shadow shrinks. Becomes very small.
                    Slides down to the floor. Barely visible.
  companion_role: Companion notices the shadow is shaking.
                  "Look... I think you scared HIM."
  discovery: Child peeks over bed edge. Shadow is on the floor, making a tiny shape.
             A heart. Then it falls apart. Shadow tries again. Heart. Falls apart.
  connection: Child slowly puts hand up, makes a shadow puppet on the wall.
              A dog shape. Shadow perks up. Copies it — but wobbly, funny.
  help: They take turns making shapes. Shadow gets better, more confident.
        Makes a whole scene — trees, birds, a little house.
  resolution: Shadow makes one final shape — two figures holding hands.
              Child smiles. Shadow waves.
  warm_close: Light stays off. Child watches the shadow's gentle slow dance
              on the ceiling. Like a lullaby made of shapes.

humor:
  - Shadow tries to make a cat, it looks like a blob. Tries again — worse.
  - Shadow accidentally makes itself look like a spider, panics and reshapes
  - Shadow copies child's yawn, stretches comically wide
```

### NIGHT_FEAR DNA #3: "הצלילים שברחו מהשקט"

```
metaphor:
  what: Night sounds (creaks, wind, drips) are actually tiny sound-creatures
        that escaped from the Quiet. The Quiet is a big soft creature that
        keeps all sounds safe during the night. But tonight, the sounds escaped.
  scary: Random sounds from everywhere. Each one makes the child tense.
  twist: The sounds aren't threatening — they're playful and mischievous.
         They escaped because the Quiet fell asleep on the job.
  help: Child uses their superpower to gently guide each sound back to
        the Quiet. The Quiet wakes up, yawns, and wraps around them all.

arc:
  opening: Bed. Silent. Then — "creak." From the hallway. Then "drip" from somewhere.
  curiosity: Another sound — a tiny whistle. Child looks around.
             Something small zooms past the door. Was that... a sound?
  encounter: A tiny glowing creature (a "creak") lands on the windowsill.
             It makes its sound proudly: "CREAK!" Then zips away.
  misunderstanding: Child tries to catch the sounds to make them stop.
                    Grabs at "drip" — it splashes into tiny drops and multiplies.
                    Now there are three drips. Louder.
  companion_role: Companion finds a big round soft creature sleeping in the corner.
                  "I think this is their... home?" It's the Quiet.
  discovery: Child tries to wake the Quiet. It mumbles and rolls over.
             The sounds are getting wilder — bouncing off walls, making a mess.
  connection: Child sits next to the Quiet. Gently hums. The Quiet opens one eye.
              Slowly stretches. Makes a soft "shhhhh" that ripples through the room.
  help: The sounds start slowing down. One by one, they float toward the Quiet
        and nestle into its soft body. Each one makes a tiny satisfied sigh.
  resolution: All sounds are back inside. The Quiet purrs softly.
              Room is peaceful — but not silent. A gentle hum.
  warm_close: Child in bed. The Quiet is draped over the foot of the bed
              like a warm blanket. The last sound — a tiny "creak" — peeks out,
              waves at the child, and tucks back in.

humor:
  - "drip" multiplies when grabbed, child ends up with drips everywhere
  - A "creak" sits on the companion's head and won't get off
  - The Quiet snores — which is ironic and the sounds all pause to stare
```

---

## Implementation Plan

### Step 1: Story DNA Data Structure (Cursor)
- Create `lib/storyDNA.ts` with the interface
- Store DNA templates as typed constants per category
- Start with NIGHT_FEAR (3 DNAs) as proof of concept
- Each DNA has a compatibility list for companions (which companion fits which story)

### Step 2: DNA Selection Logic (Cursor)
- In `pipeline.ts`, after Brain stage:
  - Match category → available DNAs
  - Match companion → compatible DNAs
  - Pick one (random or best-fit)
- The Brain stage STILL runs but its role changes:
  - It no longer invents the metaphor (DNA provides it)
  - It still generates: heroVisual, entityVisual, worldAnchor, tone
  - It adapts the DNA to the specific child (superpower integration, name substitution)

### Step 3: Scene-by-Scene Generation (Cursor)
- Replace `generateRawStory()` (single call) with `generateSceneByScene()`
- Each scene gets its own focused LLM call:
  - Input: DNA beat for this scene + child details + previous scene text
  - Prompt: ~200 words (not 3000)
  - Output: one scene, 60-80 Hebrew words
- Total: 10 calls × ~200 tokens each = ~2000 tokens (similar to current single call)
- Can run scenes 1-3 in sequence, then 4-7, then 8-10 (partial parallelism)

### Step 4: Quality Review Pass (Cursor)
- New `reviewStory()` function
- Single LLM call that reads all 10 scenes
- Checks for: emotion-naming, flat description, arc consistency
- Returns specific rewrites for flagged sentences
- Apply rewrites automatically

### Step 5: Hebrew Polish Pass (Cursor)
- New `polishHebrew()` function
- Single LLM call focused ONLY on Hebrew language quality
- Rhythm, sound words, dialogue naturalism, age-appropriate vocabulary
- Returns the final polished text

### Step 6: Superpower Picker in Wizard (Me + Cursor)
- New wizard step after companion selection
- 4-5 curated superpowers per category
- Each superpower is pre-designed with: visual, fail mode, success mode
- Replaces the free-text "superpower" field
- The selected superpower integrates with the DNA's `superpower_integration` field

---

## What Changes vs. Current Architecture

| Component | Current | New |
|-----------|---------|-----|
| Story concept | LLM invents everything | Human-designed DNA templates |
| Metaphor | LLM guesses | Pre-written, tested, guaranteed good |
| Arc structure | LLM follows vague "STORY SHAPE" | Concrete 10-beat arc in DNA |
| Prose generation | 1 call, 3000-word prompt | 10 focused calls, 200-word prompts |
| Quality control | None | Dedicated review + polish passes |
| Superpower | Free text or LLM-invented | Curated picker per category |
| Humor | "include humor" instruction | Pre-designed humor beats in DNA |
| Companion integration | Generic rules | DNA specifies companion moments |

## What Stays the Same

- Brain stage (visual generation, character locking)
- Outline → Composition → Shots → Image pipeline
- Visual Bible
- Image generation (Flux)
- Reader, wizard flow (mostly)

## Timeline Estimate

- Step 1 (DNA structure + NIGHT_FEAR DNAs): 1 day
- Step 2 (DNA selection logic): half day
- Step 3 (Scene-by-scene generation): 1-2 days
- Step 4 (Quality review): half day
- Step 5 (Hebrew polish): half day
- Step 6 (Superpower picker): 1 day
- Testing + iteration: 1-2 days

Total: ~5-7 working days for a fundamentally better product.

## Success Criteria

Generate a NIGHT_FEAR story and check:
1. Does a parent reading it aloud feel something? (not just "nice")
2. Does the story have a TWIST that surprises? (not predictable)
3. Does the child protagonist DO things that matter? (not just observe)
4. Is there a moment that makes a child laugh? (real humor)
5. Is there a moment that makes a child gasp? (real wonder)
6. Does the ending feel warm without being preachy? (no moral)
7. Would a parent want to read it again tomorrow? (re-read value)
8. Would a parent show it to a friend? (share value)

If the answer to all 8 is yes, we have a winning product.
