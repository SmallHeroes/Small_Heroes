#!/usr/bin/env node
/**
 * Story Bank Generator
 *
 * Sends each story as a SEPARATE API call to OpenAI (clean context per story).
 * Reads master prompt template + per-story assignments, combines, calls API, saves results.
 *
 * Usage:
 *   node scripts/generate-stories.mjs                        # generate all stories in batch 01
 *   node scripts/generate-stories.mjs --batch 02             # generate all stories in batch 02
 *   node scripts/generate-stories.mjs --batch 02 --story 4a  # generate only story 4a from batch 02
 *   node scripts/generate-stories.mjs --story 1a,2b,3a       # generate specific stories from batch 01
 *   node scripts/generate-stories.mjs --dry-run              # show prompts without calling API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load env
dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MODEL = process.env.STORY_MODEL || 'gpt-5.3-chat-latest';
// gpt-5.3 only supports temperature=1, older models can use 0.85
const TEMPERATURE = MODEL.startsWith('gpt-5') ? undefined : 0.85;
const MAX_TOKENS = 8192;

const BRIEFS_DIR = path.join(ROOT, 'briefs');
const OUTPUT_DIR = path.join(ROOT, 'story-bank', 'raw');
const PROMPT_PATH = path.join(BRIEFS_DIR, 'story-generation-prompt.md');

// ---------------------------------------------------------------------------
// Batch registry
// ---------------------------------------------------------------------------
const BATCHES = {
  '01': { name: 'NIGHT_FEAR', stories: null },   // populated below
  '02': { name: 'ANGER_FRUSTRATION', stories: null },
  '03': { name: 'SENSITIVITY_OVERWHELM', stories: null },
  '04': { name: 'SOCIAL', stories: null },
  '05': { name: 'TRANSITION', stories: null },
};

// ---------------------------------------------------------------------------
// Story assignments — Batch 1: NIGHT_FEAR
// ---------------------------------------------------------------------------
const BATCH_01 = [
  {
    id: '1a',
    category: 'NIGHT_FEAR (פחד לילה / חושך)',
    archetype: 'connection (intimate, warm, stays in familiar space. Companion comes TO the child.)',
    assignment: `### Story 1
- storyStyle: **quiet_intimate** (warm, close, breath-close writing)
- rhythm: **slow** (long pauses, sensory detail, single-word lines)
- experienceType: energy=low, humor=light, tension=medium
- climaxType: **helping_someone**
- Nature metaphor: **צללים שנפלו מהקיר ולא מוצאים את דרכם חזרה** — they're not scary, they're lost. They used to be the shapes of familiar things (chair-shadow, lamp-shadow, toy-shadow) but they slid off the wall and now they're shapeless puddles on the floor, confused and cold.
- companionPersonality: soft-spoken, overly careful, apologizes constantly ("sorry, was that too loud?"), tries to tiptoe but always steps on something, genuinely kind but clumsy about it
- Stakes: if the shadows stay on the floor too long they'll fade completely — and the room will have no shapes at night, just flat darkness forever
- childFirstAttempt: she tries to push the shadows back onto the wall with her hands
- childFailure: the shadows slip through her fingers like water — pushing doesn't work, they just spread thinner
- childCost: she takes her nightlight (her safety object) and puts it on the floor among the shadows — giving up her own light source
- solutionMode: **HELPING**
- requiredFinalAction: she places her nightlight on the floor among the shadows → the light gives them edges → she physically picks up each shadow (they're heavy, floppy, resist) and carries/drags it to its matching object → first shadow sticks to the wrong object (chair-shadow on the lamp — looks absurd) → she peels it off, tries again → second shadow keeps slipping → she presses it against the wall with both hands until it sticks → at least 3 shadows guided home with physical struggle
- forbiddenResolution: staying in bed, watching them, waiting for morning, breathing quietly
- visibleEffect: nightlight on floor → shadows gain edges → she carries them one by one (they squirm) → wrong matches create funny shapes → correct matches click into place → room has familiar shapes again, but nightlight stays on the floor (she gave it up)`
  },
  {
    id: '1b',
    category: 'NIGHT_FEAR (פחד לילה / חושך)',
    archetype: 'connection (intimate, warm, stays in familiar space. Companion comes TO the child.)',
    assignment: `### Story 1
- storyStyle: **chaotic_comedy** (things go wrong in escalating funny ways)
- rhythm: **fast** (quick dialogue, short bursts, momentum)
- experienceType: energy=high, humor=heavy, tension=medium
- climaxType: **clever_solution**
- Nature metaphor: **שמיכה שבולעת אור** — every time light enters the room (moonlight, hallway light, phone glow), the blanket absorbs it, gets heavier, and darker. The room is getting darker BECAUSE the blanket is eating the light. The blanket isn't evil — it's cold and thinks light = warmth.
- companionPersonality: know-it-all, has a theory for EVERYTHING ("actually, according to blanket science..."), confident plans that always fail spectacularly, gets offended when wrong, eventually admits "okay, maybe YOUR idea"
- Stakes: the blanket will get so heavy from absorbed light that it'll crush everything underneath — and it's on her bed, getting bigger
- childFirstAttempt: she tries to pull the blanket off the bed (companion's "brilliant plan #1")
- childFailure: the blanket is too heavy — it absorbed so much light it weighs a ton. She can't move it. Companion's plan #2 (throw more light at it to "overload" it) makes it WORSE — blanket doubles in size
- childCost: she must turn off ALL remaining light sources — sit in complete darkness — to make the blanket release what it ate
- solutionMode: **RULE_DISCOVERY**
- requiredFinalAction: she figures out the rule (blanket eats light because it's cold → she needs to REMOVE light, not add it) → turns off hallway light, covers the window → sits in total darkness → blanket slowly releases light back into the room as it realizes there's nothing left to eat → the released light is warm and gentle
- forbiddenResolution: hiding under the blanket, waiting, asking parent for help, simply pulling harder
- visibleEffect: all lights off → blanket pulses → starts releasing stored light in soft waves → room fills with warm glow → blanket shrinks to normal size and goes soft`
  },
  {
    id: '2a',
    category: 'NIGHT_FEAR (פחד לילה / חושך)',
    archetype: 'adventure (goes outside, multiple locations, physical challenges)',
    assignment: `### Story 1
- storyStyle: **absurd_surreal** (weird logic, dream-like, delightfully strange)
- rhythm: **mixed** (fast surreal bursts then sudden stillness)
- experienceType: energy=medium, humor=medium, tension=high
- climaxType: **physical_action**
- adventureSubtype: **rescue**
- Nature metaphor: **כוכבים שנפלו ונתקעו בין ענפי העצים** — the sky is completely dark because all the stars fell down and got stuck in the forest. They're tangled in branches, buzzing like trapped fireflies, and getting dimmer. Each one makes a tiny "tik tik tik" sound, like a clock running out.
- companionPersonality: dramatic storyteller, narrates everything in third person ("and then the brave companion entered the dark forest..."), treats every small thing as EPIC, actually scared but hides it behind performance
- Stakes: the stars are dimming — if they go out while stuck in the trees, they can't be relit. The sky will stay dark forever. No more starlight for anyone.
- childFirstAttempt: she climbs a tree to untangle a star by hand
- childFailure: the star is tangled in thin branches that break when she pulls — star falls DEEPER into the tree. She almost falls herself.
- childCost: she tears her pajama sleeve to make a rope/net to catch falling stars — ruins her favorite pajamas
- solutionMode: **BUILDING**
- requiredFinalAction: she tears pajama fabric into strips → ties strips between branches to make a soft net → shakes the tree so stars fall into the net instead of deeper → carries net-full of stars to a clearing → tosses them upward one by one
- forbiddenResolution: waiting for sunrise, asking stars to fly back, simply watching them
- visibleEffect: net catches stars → she throws them up → each star re-sticks to the sky with a small "pop" → sky gradually lights up → her torn pajamas glow faintly where star-dust touched`
  },
  {
    id: '2b',
    category: 'NIGHT_FEAR (פחד לילה / חושך)',
    archetype: 'adventure (goes outside, multiple locations, physical challenges)',
    assignment: `### Story 1
- storyStyle: **high_energy** (fast-paced, exciting, breathless)
- rhythm: **fast** (short sentences, rapid action, page-turners)
- experienceType: energy=high, humor=medium, tension=high
- climaxType: **helping_someone**
- adventureSubtype: **chase**
- Nature metaphor: **ירח שהתכווץ כי אף אחד לא מביט בו** — the moon used to be big and bright, but everyone started looking at screens and stopped looking up. It shrank from loneliness. Now it's tiny, hiding behind a cloud, and refuses to come out. Without the moon, the night animals can't find their way.
- companionPersonality: hyperactive problem-solver, moves before thinking, already running before explaining the plan, accidentally makes things harder by being too fast, has to learn to slow down at the crucial moment
- Stakes: night animals are lost and crashing into things — owls flying into trees, rabbits falling into holes. Without moonlight, the forest is chaos. And the moon keeps shrinking.
- childFirstAttempt: she shouts at the moon to come out, waves her arms, tries to get its attention
- childFailure: the moon shrinks MORE — shouting felt like another demand, not care. It hides deeper behind the cloud.
- childCost: she takes off her glowing bracelet/necklace (her safety light in the dark) and holds it up toward the moon as an offering — giving up her own light source in a dark forest
- solutionMode: **HELPING**
- requiredFinalAction: she gathers small shiny objects from the forest floor (wet leaves, a beetle shell, a smooth stone) → arranges them in a circle in the clearing → places her glowing bracelet in the center as the brightest piece → the arrangement catches and reflects the moon's tiny remaining light back up → she adjusts the angle of each object with her hands, kneeling in the dirt → the reflected light reaches the moon → moon sees its own light reflected back and grows a little → she adds more objects, widens the circle → moon grows more
- forbiddenResolution: going home, calling parent, turning on a flashlight, simply looking up and waiting
- visibleEffect: shiny objects arranged → bracelet in center → light reflects upward → moon sees itself → grows incrementally → light returns to clearing → night animals find paths → moon not full-sized but bright enough → her bracelet stays in the circle (she gave it up)`
  },
  {
    id: '3a',
    category: 'NIGHT_FEAR (פחד לילה / חושך)',
    archetype: 'courage (small brave act in magical-realist setting, reality transforms)',
    assignment: `### Story 1
- storyStyle: **dreamy_poetic** (soft, magical, flowing)
- rhythm: **slow** (long pauses, space between moments, sensory detail)
- experienceType: energy=low, humor=light, tension=medium
- climaxType: **emotional_decision**
- Nature metaphor: **גן לילה סודי שפורח רק בחושך** — behind the house there's a garden that only blooms at night. But someone left a big bright lamp on, and the flowers are closing, the night-butterflies are confused, and the garden is dying in the artificial light. The lamp is too high for her to reach.
- companionPersonality: whisper-only (refuses to speak above a whisper because "the flowers are listening"), collects petals that fall, gently dramatic ("this is the saddest petal I've ever held"), treats every flower like a person
- Stakes: the night garden has been blooming for a hundred years — if the flowers close for too long under the bright light, they'll never open again. The garden will become just dirt.
- childFirstAttempt: she tries to find the lamp's cord to unplug it
- childFailure: there's no cord — the lamp is solar-powered, running on stored daylight. She can't turn it off.
- childCost: she uses her beloved blanket to cover the lamp — her comfort object, left outside in the damp night air, possibly ruined
- solutionMode: **SACRIFICE**
- requiredFinalAction: she climbs on companion's back to reach the lamp → wraps her blanket around it → the light dims → pauses (blanket is getting damp and dirty) → tucks it tighter → darkness returns → night flowers slowly start opening → she watches from below, blanket-less and cold, but the garden blooms
- forbiddenResolution: waiting for the lamp to run out, going to get parent, finding another cover
- visibleEffect: blanket over lamp → light fades → one flower opens → then another → night-butterflies return → garden fills with soft bioluminescent glow (its own natural light) → child sits in the garden's light instead of the lamp's light
- NOTE: Do NOT reuse the "cover with blanket" pattern in future batches — marked as used.`
  },
  {
    id: '3b',
    category: 'NIGHT_FEAR (פחד לילה / חושך)',
    archetype: 'courage (small brave act in magical-realist setting, reality transforms)',
    assignment: `### Story 1
- storyStyle: **wild_physical** (energetic, tactile, movement-driven)
- rhythm: **mixed** (alternating fast action with sudden calm discoveries)
- experienceType: energy=medium, humor=medium, tension=medium
- climaxType: **creative_act**
- Nature metaphor: **דלת שמופיעה בקיר חדר השינה רק בלילה** — a door that only exists in the dark. Behind it: a room made entirely of sounds. Every sound in the world lives here as a shape you can touch. But the scary sounds have gotten too big and are crushing the gentle sounds.
- companionPersonality: conductor/musician type, hears everything as music, gets lost in rhythms, taps on everything, excited by scary sounds too ("listen to the TEXTURE of that thunder!"), doesn't understand why child is afraid because to them it's all just music
- Stakes: if the gentle sounds (rain, humming, heartbeat, purring) get crushed by the scary ones (thunder, creaking, howling), the child's room will only ever have scary sounds at night
- childFirstAttempt: she tries to push the big scary sounds away physically
- childFailure: scary sounds bounce back bigger when pushed — force makes them grow
- childCost: she must touch the scariest sound (the one that sounds like footsteps in the hallway) — the one she fears most — and discover what it actually is
- solutionMode: **CREATIVE_ACT**
- requiredFinalAction: she reaches out and TOUCHES the scary footstep-sound → it vibrates → she starts humming her own sound into it → the scary shape begins changing → she shapes it with her hands like clay → molds it into something new (a drumbeat, a dance rhythm) → other scary sounds come closer and she shapes them too → room fills with music she made from fear
- forbiddenResolution: closing the door, running back to bed, covering ears, waiting for morning
- visibleEffect: touching scary sound → it softens → she molds it → new shape/sound → other sounds approach → she shapes 2-3 more → room transforms from cacophony to music → the music follows her back through the door into her bedroom`
  }
];

// ---------------------------------------------------------------------------
// Story assignments — Batch 2: ANGER_FRUSTRATION
// ---------------------------------------------------------------------------
const BATCH_02 = [
  {
    id: '4a',
    category: 'ANGER_FRUSTRATION (כעס / תסכול)',
    archetype: 'connection (intimate, warm, stays in familiar space. Companion comes TO the child.)',
    assignment: `### Story 1
- storyStyle: **high_energy** (fast-paced, exciting, breathless)
- rhythm: **fast** (short sentences, rapid action, page-turners)
- experienceType: energy=high, humor=medium, tension=high
- climaxType: **physical_action**
- Nature metaphor: **הר געש קטן שצמח באמצע החדר** — every time someone in the house gets angry (door slam, raised voice, frustrated sigh), the volcano grows a little. It's already pushing against the ceiling. Hot pebbles roll off it onto toys. It doesn't mean to destroy — it just doesn't know how to stop growing.
- companionPersonality: overly enthusiastic builder, sees EVERYTHING as a construction project ("we need scaffolding!"), carries tiny tools everywhere, talks in blueprints, gets frustrated when plans don't work but channels it into better plans
- Stakes: the volcano is about to overflow — the lava will melt her toys, her drawings, everything she cares about in the room. And every angry shout makes it grow faster.
- childFirstAttempt: she tries to push the volcano back down with her hands, pressing on the top
- childFailure: the volcano is too hot to touch for long, and pushing it down just makes it bulge sideways — it expands in a different direction
- childCost: she dismantles her favorite block tower (the one she spent days building) to use the blocks as a channel/trench to redirect the lava away from her things
- solutionMode: **BUILDING**
- requiredFinalAction: she breaks apart her block tower → uses blocks to build trenches around the volcano → the lava flows into the channels instead of spreading → she adjusts blocks as lava shifts direction (some melt, she replaces them) → companion helps design but she does the physical work → the lava reaches a bucket of water at the end of the trench → steam rises → volcano shrinks with each redirected flow → she keeps building channels even as her best blocks dissolve
- forbiddenResolution: waiting for the volcano to cool, covering it, asking parent to help, ignoring it
- visibleEffect: block tower dismantled → trenches built → lava flows in channels → blocks dissolve one by one → steam from bucket → volcano shrinks → room has hardened lava trails on floor like a strange map → her tower is gone but the room is saved`
  },
  {
    id: '4b',
    category: 'ANGER_FRUSTRATION (כעס / תסכול)',
    archetype: 'connection (intimate, warm, stays in familiar space. Companion comes TO the child.)',
    assignment: `### Story 1
- storyStyle: **quiet_intimate** (warm, close, breath-close writing)
- rhythm: **slow** (long pauses, sensory detail, single-word lines)
- experienceType: energy=low, humor=light, tension=medium
- climaxType: **emotional_decision**
- Nature metaphor: **צבעים שנשפכו מהציורים** — every negative emotion (anger, frustration, jealousy) makes one color escape from the drawings on the wall. Red fled first (anger), then blue (sadness), then yellow (jealousy). The drawings are becoming gray and flat. The colors are pooling on the floor, lost and mixing into mud.
- companionPersonality: meticulous collector, picks up every drop of color with care, labels them with tiny tags ("this red is from Tuesday's fight"), speaks softly but firmly, gets genuinely sad when a color is wasted
- Stakes: if all the colors drain from the drawings, they'll turn into blank paper — and she'll lose every picture she ever made. The colors on the floor are already starting to mix into gray mud.
- childFirstAttempt: she tries to scoop the colors off the floor and pour them back into the drawings
- childFailure: the colors won't stick — they drip right back down. You can't force a color to return to a picture it fled from.
- childCost: she takes her favorite drawing (the one of her family, the only one with all colors still intact) and lays it face-down on the floor among the escaped colors — sacrificing her best picture so the colors have somewhere familiar to go
- solutionMode: **SACRIFICE**
- requiredFinalAction: she places her family drawing face-down → the colors recognize something warm in it → they begin seeping into it from below → she watches her favorite picture absorb the muddy colors and change → the family drawing transforms — not ruined but different, with new mixed colors she didn't choose → she presses it against the wall with both hands → holds it until it sticks → the other drawings slowly start pulling their colors back from this anchor
- forbiddenResolution: waiting for colors to return, painting new pictures, covering the gray drawings, asking parent
- visibleEffect: family drawing on floor → colors seep in → picture changes (new colors, unexpected but beautiful) → she presses it to wall → other drawings slowly regain color from it → room becomes colorful again but differently than before → her family picture is now the anchor, with colors she didn't choose but that tell a truer story`
  },
  {
    id: '5a',
    categor