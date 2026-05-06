#!/usr/bin/env node
/**
 * Batch 05 (TRANSITION) Story Generator — standalone
 * Usage:
 *   node scripts/generate-batch05.mjs                    # all 6 stories
 *   node scripts/generate-batch05.mjs --story 13a        # single story
 *   node scripts/generate-batch05.mjs --story 13a,14b    # specific stories
 *   node scripts/generate-batch05.mjs --dry-run           # show prompts only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.STORY_MODEL || 'gpt-5.3-chat-latest';
const TEMPERATURE = MODEL.startsWith('gpt-5') ? undefined : 0.85;
const MAX_TOKENS = 8192;

const BRIEFS_DIR = path.join(ROOT, 'briefs');
const OUTPUT_DIR = path.join(ROOT, 'story-bank', 'raw');
const PROMPT_PATH = path.join(BRIEFS_DIR, 'story-generation-prompt.md');

const BATCH_ID = '05';
const BATCH_NAME = 'TRANSITION';

const STORIES = [
  {
    id: '13a',
    category: 'TRANSITION (שינוי / מעבר)',
    archetype: 'connection (intimate, warm, stays in familiar space. Companion comes TO the child.)',
    assignment: `### Story 1
- storyStyle: **quiet_intimate** (warm, close, breath-close writing)
- rhythm: **slow** (long pauses, sensory detail, single-word lines)
- experienceType: energy=low, humor=light, tension=medium
- climaxType: **emotional_decision**
- Nature metaphor: **חדר ישן שמתחיל להיעלם — כל זיכרון שמרימים ממנו מוחק פריט אחד** — an old room that's disappearing. Every memory you lift from it erases one object. The walls are fading, the furniture is thinning.
- companionPersonality: an old mouse who lived in the room for years. Melancholic but warm. Speaks quietly with long pauses. Says things like "once… there was a table here. I think." Insists they can stay if they just don't touch anything.
- Stakes: the room is shrinking — if they stay inside without moving, it will disappear with them inside
- childFirstAttempt: she tries to put objects back, hold things in place to stop the disappearing
- childFailure: every object she grabs vanishes faster — holding on accelerates the erasure
- childCost: she must leave the room — not because she doesn't love it, but because staying means disappearing with it. The door is heavy and the light outside burns her eyes.
- solutionMode: **EXIT**
- requiredFinalAction: she stands up → walks toward the door → hands shaking → pulls the heavy door (it resists, she strains) → bright light pours in, stinging her eyes → she steps through → the room stops shrinking behind her → the old mouse hesitates, then runs after her through the closing gap
- forbiddenResolution: fixing the room, finding a way to keep it, waiting for it to stabilize, the room magically restoring itself
- visibleEffect: door pulled open → harsh light → she steps out → room freezes → mouse follows → outside is new, imperfect, open → she still remembers`
  },
  {
    id: '13b',
    category: 'TRANSITION (שינוי / מעבר)',
    archetype: 'connection (intimate, warm, stays in familiar space. Companion comes TO the child.)',
    assignment: `### Story 1
- storyStyle: **absurd_surreal** (weird logic, dream-like, delightfully strange)
- rhythm: **mixed** (fast surreal bursts then sudden stillness)
- experienceType: energy=medium, humor=medium, tension=medium
- climaxType: **clever_solution**
- Nature metaphor: **ארגז שמכיל את כל מה שהיה — אפשר לפתוח אותו רק אם שמים בו משהו חדש** — a box containing everything from the past. Beautiful, heavy, plays a familiar tune when touched. But every attempt to open it adds a new lock. It only opens when you put something new inside.
- companionPersonality: a fox with pockets full of lost items from other people. Sly and quick. Speaks in half-sentences, always has one crazy idea too many. "I have something! No wait, that's someone else's. Maybe anyway?" Pulls bizarre objects from pockets.
- Stakes: the box locks itself tighter with each attempt — new locks with faces grow every time someone tries to force it
- childFirstAttempt: she tries keys, force, asking nicely — every attempt adds another lock
- childFailure: now there are 17 locks and the fox has emptied all pockets for nothing
- childCost: she must give something of her own that doesn't exist yet — a drawing she makes in the moment, with dirty hands, imperfect and real
- solutionMode: **TRICK**
- requiredFinalAction: she realizes the inverted logic (trying to open adds locks → stop trying to open) → she draws something quick on a scrap with dirty fingers → slides it into a slot she found → the box doesn't add a lock — it's confused → in that moment of confusion she shoves the lid → it opens → not because she broke it, but because she tricked it
- forbiddenResolution: finding the right key, the box opening by itself, breaking it with force, the companion solving it
- visibleEffect: drawing pushed into slot → box freezes → confusion → lid shoved → opens → inside is not what she expected but something new and old together`
  },
  {
    id: '14a',
    category: 'TRANSITION (שינוי / מעבר)',
    archetype: 'adventure (leaves familiar space, enters new world, journey with challenges)',
    assignment: `### Story 1
- storyStyle: **chaotic_comedy** (things go wrong in escalating funny ways)
- rhythm: **fast** (quick dialogue, short bursts, momentum)
- experienceType: energy=high, humor=heavy, tension=medium
- climaxType: **clever_solution**
- Nature metaphor: **שביל שמחליף כיוון כל פעם שמסתובבים — אי אפשר לחזור, רק קדימה** — a path that changes direction every time you turn around. No going back, only forward. But forward keeps changing too.
- companionPersonality: a squirrel with a map that keeps changing. Hysterical and enthusiastic. Reads directions nonstop. "Left! No, right! No, up?! The map says we're inside a tree!" Folds the map backwards and starts over.
- Stakes: the path is eating itself from behind — if they stop moving, the ground swallows them
- childFirstAttempt: she tries to follow the map, picking the "right" direction
- childFailure: every direction chosen by the map leads to the same dead end — the path is the one choosing, not them
- childCost: she must damage the path itself — tear a piece from it — and create a direction that doesn't exist yet
- solutionMode: **REDIRECT**
- requiredFinalAction: she doesn't choose a direction → she tears a piece of the path itself (it's made of something — stones? leaves?) → places it in a new direction the path didn't offer → the path gets confused, stops → then follows HER → she didn't walk the path — she moved the path
- forbiddenResolution: finding the right direction, the map working, waiting for the path to settle, going back
- visibleEffect: piece torn from path → placed in new direction → path freezes → then follows her → squirrel draws new map → they walk where SHE decided`
  },
  {
    id: '14b',
    category: 'TRANSITION (שינוי / מעבר)',
    archetype: 'adventure (leaves familiar space, enters new world, journey with challenges)',
    assignment: `### Story 1
- storyStyle: **high_energy** (fast-paced, exciting, breathless)
- rhythm: **mixed** (alternating fast action with sudden stillness)
- experienceType: energy=medium, humor=medium, tension=high
- climaxType: **emotional_decision**
- Nature metaphor: **זחל שמפחד מהשינוי — כולם אומרים לו שיהיה פרפר אבל הוא אוהב להיות זחל** — a caterpillar afraid of change. Everyone says become a butterfly, but he loves being a caterpillar. Six legs, not four wings. That's an upgrade? He doesn't think so.
- companionPersonality: a green caterpillar who talks fast and refuses to cocoon. Scared and exciting simultaneously. "I'm good like this! I have six legs! Six! A butterfly has four! That's a downgrade!" Hides under leaves when anyone mentions wings.
- Stakes: the leaves he eats are running out — without change, no food, no continuation
- childFirstAttempt: she tries to feed him (doesn't work — the last leaf says "I don't want to" and rolls away)
- childFailure: talking to him doesn't work either — he refuses to change because change means losing who he is
- childCost: she must offer a conscious trade — not force, not persuasion, but an exchange. Something that preserves what he was while allowing what he'll become.
- solutionMode: **TRADE**
- requiredFinalAction: she doesn't force or give up → she proposes a deal: "try the cocoon — just try — and I'll keep your sixth leg safe" → she takes out a small scratched box from her pocket (hands trembling) → puts the last leaf inside → "this will keep who you were" → the caterpillar hesitates → touches the box → enters the cocoon → not because he was convinced, but because he got something in return for what he gave up
- forbiddenResolution: the caterpillar changing on his own, being forced, being convinced by logic, leaves magically appearing
- visibleEffect: box placed → last leaf inside → caterpillar touches box → enters cocoon → cocoon vibrates → box sits beside it → both waiting`
  },
  {
    id: '15a',
    category: 'TRANSITION (שינוי / מעבר)',
    archetype: 'courage (small brave act in magical-realist setting, reality transforms)',
    assignment: `### Story 1
- storyStyle: **dreamy_poetic** (soft, magical, flowing)
- rhythm: **slow** (long pauses, space between moments, sensory detail)
- experienceType: energy=low, humor=light, tension=medium
- climaxType: **clever_solution**
- Nature metaphor: **זרע שנפל באדמה חדשה — הכל שונה, והוא לא יודע איך לגדול פה** — a seed fallen in new soil. Everything works backwards here. Water rises, sun cools, digging fills. The old rules don't apply.
- companionPersonality: an earthworm who knows the new soil. Slow and precise. Speaks from underground, pokes head between clumps. "Here everything is upside down. Sun from below. Water from above. If you try the old way — it won't grow." Gives information but not solutions.
- Stakes: the seed is drying out — if it doesn't grow soon, it becomes dust
- childFirstAttempt: she pours water (it rises up), digs (the hole fills back), tries sunshine (it cools the seed)
- childFailure: every normal approach fails because this world's rules are inverted
- childCost: she must figure out the hidden rules and use them — counterintuitive thinking, not effort. Her hands hurt from the strange soil and her nails are black.
- solutionMode: **RULE_HACK**
- requiredFinalAction: she stops and thinks → if water rises, pour from above so it's pulled down → if sun cools, bury in darkness for warmth → she digs a small hole (hands aching, strange soil cuts) → places seed inside → covers it (darkness = heat) → pours water from above (it falls down because everything is inverted here) → the moment water touches the seed — it vibrates and cracks open
- forbiddenResolution: the soil changing to normal, someone explaining the answer, the seed growing on its own, giving up
- visibleEffect: hole dug → seed buried → covered in darkness → water poured from above → water descends → seed vibrates → crack → green sprout → small, crooked, but alive → earthworm smiles`
  },
  {
    id: '15b',
    category: 'TRANSITION (שינוי / מעבר)',
    archetype: 'courage (small brave act in magical-realist setting, reality transforms)',
    assignment: `### Story 1
- storyStyle: **wild_physical** (energetic, tactile, movement-driven)
- rhythm: **fast** (short sentences, rapid action, page-turners)
- experienceType: energy=high, humor=medium, tension=high
- climaxType: **physical_action**
- Nature metaphor: **גשם שלא מפסיק — כל דבר ישן נשטף, וצריך להחליט מה להציל** — rain that won't stop. Everything old is washing away. The garden is flooding. Objects float past like sad balloons. Must choose what to save because you can't save everything.
- companionPersonality: a frog who loves rain and doesn't understand sadness. Jumps in puddles while everything is destroyed. "More water! More! This is the best!" Doesn't get the problem until she sees the child crying.
- Stakes: the water is rising — soon the entire garden floods and nothing remains
- childFirstAttempt: she tries to collect everything, save all objects at once
- childFailure: she can't hold it all — things slip, float away, she's too small and the water is too strong
- childCost: she must choose ONE thing and hold it with everything she has — raw determination against the flood, not strategy
- solutionMode: **FORCE**
- requiredFinalAction: she doesn't try to stop the rain → doesn't try to save everything → she chooses one thing: a small tree being uprooted → she grabs the trunk → water pushes against her body, hits her face → knees sink in mud → hands slip → she digs her hands into the mud at the base → holds → doesn't stop → doesn't let go → the tree stabilizes → the rain doesn't stop but the tree doesn't fall
- forbiddenResolution: the rain stopping, finding shelter, someone helping her, a magic solution
- visibleEffect: hands on trunk → water against body → knees in mud → hands dug into base → tree stabilizes → rain continues → tree stands → frog sits quietly beside her`
  },
];


// ---------------------------------------------------------------------------
// Build prompt for a single story
// ---------------------------------------------------------------------------
function buildPrompt(masterPrompt, story) {
  let prompt = masterPrompt;

  prompt = prompt.replace(
    /Generate \d+ complete stor(ies|y)\./,
    'Generate 1 complete story.'
  );

  prompt = prompt.replace(
    /\*\*Category:\*\* .+/,
    `**Category:** ${story.category}`
  );

  prompt = prompt.replace(
    /\*\*Archetype:\*\* .+/,
    `**Archetype:** ${story.archetype}`
  );

  const assignmentStart = prompt.indexOf('## Story Assignments');
  const assignmentEnd = prompt.indexOf('\n---', assignmentStart + 1);

  if (assignmentStart === -1) {
    throw new Error('Could not find "## Story Assignments" in master prompt');
  }

  const before = prompt.substring(0, assignmentStart);
  const after = assignmentEnd !== -1 ? prompt.substring(assignmentEnd) : '';

  prompt = before + '## Story Assignments\n\n' + story.assignment + '\n' + after;
  return prompt;
}

// ---------------------------------------------------------------------------
// Call OpenAI API
// ---------------------------------------------------------------------------
async function generateStory(prompt, storyId) {
  console.log(`  [${storyId}] Calling OpenAI (${MODEL})...`);
  const start = Date.now();

  const response = await openai.chat.completions.create({
    model: MODEL,
    ...(TEMPERATURE != null && { temperature: TEMPERATURE }),
    max_completion_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content: 'You are a professional Israeli children\'s author. Follow the instructions exactly. Output in Hebrew with English imageDirection lines. CRITICAL: You systematically OVER-COUNT Hebrew words by ~10 per page. When counting, be extremely careful. Target 35-55 actual words per page. If you think a page has 35 words, it probably has 25. Write MORE than you think you need.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const usage = response.usage;
  console.log(`  [${storyId}] Done in ${elapsed}s (${usage?.prompt_tokens}→${usage?.completion_tokens} tokens)`);

  return {
    content: response.choices[0].message.content,
    usage,
    elapsed: parseFloat(elapsed),
    model: response.model,
    finishReason: response.choices[0].finish_reason
  };
}

// ---------------------------------------------------------------------------
// Save result
// ---------------------------------------------------------------------------
function saveResult(storyId, result, prompt) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const storyPath = path.join(OUTPUT_DIR, `batch-${BATCH_ID}_${storyId}.md`);
  const header = `# Story ${storyId} — Batch ${BATCH_ID} ${BATCH_NAME}
Generated: ${new Date().toISOString()}
Model: ${result.model}
Tokens: ${result.usage?.prompt_tokens}→${result.usage?.completion_tokens}
Finish: ${result.finishReason}
Time: ${result.elapsed}s

---

`;
  fs.writeFileSync(storyPath, header + result.content, 'utf-8');
  console.log(`  [${storyId}] Saved → ${path.relative(ROOT, storyPath)}`);

  const promptPath = path.join(OUTPUT_DIR, `batch-${BATCH_ID}_${storyId}_prompt.md`);
  fs.writeFileSync(promptPath, prompt, 'utf-8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  let storyFilter = null;
  const storyArg = args.find(a => a.startsWith('--story'));
  if (storyArg) {
    const idx = args.indexOf(storyArg);
    const val = storyArg.includes('=') ? storyArg.split('=')[1] : args[idx + 1];
    storyFilter = val.split(',').map(s => s.trim());
  }

  const masterPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
  console.log(`Master prompt loaded (${masterPrompt.length} chars)`);

  let stories = STORIES;
  if (storyFilter) {
    stories = stories.filter(s => storyFilter.includes(s.id));
    console.log(`Filtered to stories: ${stories.map(s => s.id).join(', ')}`);
  }

  if (stories.length === 0) {
    console.error('No stories matched the filter.');
    process.exit(1);
  }

  console.log(`\nBatch ${BATCH_ID}: ${BATCH_NAME}`);
  console.log(`Generating ${stories.length} stories (${dryRun ? 'DRY RUN' : 'LIVE'})...\n`);

  const results = [];
  const promises = stories.map(async (story) => {
    const prompt = buildPrompt(masterPrompt, story);

    if (dryRun) {
      const promptPath = path.join(OUTPUT_DIR, `batch-${BATCH_ID}_${story.id}_prompt.md`);
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(promptPath, prompt, 'utf-8');
      console.log(`  [${story.id}] Prompt saved (dry run) → ${path.relative(ROOT, promptPath)}`);
      results.push({ id: story.id, status: 'dry-run' });
      return;
    }

    try {
      const result = await generateStory(prompt, story.id);
      saveResult(story.id, result, prompt);
      results.push({ id: story.id, status: 'ok', tokens: result.usage?.completion_tokens });
    } catch (err) {
      console.error(`  [${story.id}] FAILED: ${err.message}`);
      results.push({ id: story.id, status: 'error', error: err.message });
    }
  });

  await Promise.all(promises);

  console.log(`\n=== SUMMARY — Batch ${BATCH_ID} (${BATCH_NAME}) ===`);
  for (const r of results.sort((a, b) => a.id.localeCompare(b.id))) {
    const icon = r.status === 'ok' ? '✅' : r.status === 'dry-run' ? '📝' : '❌';
    console.log(`  ${icon} ${r.id}: ${r.status}${r.tokens ? ` (${r.tokens} tokens)` : ''}${r.error ? ` — ${r.error}` : ''}`);
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status === 'error').length;
  if (!dryRun) {
    console.log(`\n${ok} succeeded, ${failed} failed.`);
    console.log(`Results in: ${path.relative(ROOT, OUTPUT_DIR)}/`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
