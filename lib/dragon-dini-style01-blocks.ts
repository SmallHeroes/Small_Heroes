/**
 * Dragon Dini (Benjamin & boundary-egg rewrite) — Style 01 lock blocks.
 * Extracted from style01-gptimage.ts to avoid circular imports.
 */

export type Style01SubjectScale = 'small' | 'medium' | 'large';

export type Style01CompositionSpec = {
  shotType: string;
  camera: string;
  subjectDominance: string;
  staging: string;
  pagePurpose: string;
  subjectScale: Style01SubjectScale;
};

export const DRAGON_DINI_RECURRING_OBJECT_CATALOG: Record<string, string[]> = {
  pillow_fortress: [
    'pillow fortress',
    'cushion fort',
    'blanket fort',
    'couch cushion fortress',
    'fort built from cushions',
    'מבצר כריות',
    'מבצר',
  ],
  crib: [
    'crib',
    'baby crib',
    'wooden crib',
    'baby sister crib',
    'crib rail',
    'עריסה',
  ],
  yellow_blanket: [
    'yellow blanket',
    'baby blanket',
    'small yellow blanket',
    'soft yellow blanket',
    'שמיכה צהובה',
  ],
  toy_chest: [
    'toy chest',
    'wooden toy chest',
    'deep toy chest',
    'toy chest portal',
    'ארגז צעצועים',
  ],
  t_rex_toy: [
    'plastic T-rex',
    'T-rex toy',
    'plastic dinosaur',
    'raptor toy',
    'plastic raptor',
    'T-rex scepter',
    'טי-רקס',
    'רפטור',
  ],
  green_speckled_egg: [
    'green speckled egg',
    'moss-green egg',
    'green egg with copper freckles',
    'bouncing egg',
    'dragon egg',
    'runaway egg',
    'ביצה ירוקה',
    'ביצה מנומשת',
  ],
  silver_ribbon: [
    'silver ribbon',
    'wide silver ribbon',
    'silver grass ribbon',
    'silvery reed ribbon',
    'stretchy silver ribbon',
    'סרט כסף',
  ],
  orange_moss_hills: [
    'orange moss hills',
    'orange trampoline moss',
    'springy orange moss',
    'bouncy moss landscape',
    'גבעות טחב כתומות',
    'גבעות הטרמפולינה',
  ],
  nest_of_cushions: [
    'nest of blue cushions',
    'blue spongy cushion nest',
    'cushion nest',
    'spongy nest',
    'קן כריות',
  ],
  blue_crystal_slide: [
    'blue crystal slide',
    'crystal slide',
    'long crystal toboggan',
    'smooth blue crystal slide',
    'מגלשת קריסטל',
  ],
  whisper_valley_reeds: [
    'whisper valley reeds',
    'giant fuzzy reeds',
    'fuzzy reed plants',
    'giant whispering reed plants',
    'עמק הלחישות',
    'צמחי סוף',
  ],
  marshmallow_swamp: [
    'marshmallow swamp',
    'purple sticky puddle',
    'melted marshmallow puddle',
    'sticky purple goo',
    'שלולית מרשמלו',
    'לשד מרשמלו',
  ],
  cracked_eggshell: [
    'cracked eggshell halves',
    'broken green eggshell',
    'eggshell fragments',
    'shell on snout',
    'קליפה',
    'קליפת ביצה',
  ],
};

export const DRAGON_DINI_RECURRING_OBJECT_LOCKS: Record<string, string> = {
  pillow_fortress: `RECURRING OBJECT LOCK — PILLOW FORTRESS:
The child's fort built from couch cushions and soft blankets. Made of approx 5–7 large soft couch cushions arranged as walls, draped with one large soft blanket as a "roof." Cozy, child-scale (the child fits inside comfortably standing or sitting). Always inside the child's home — never in the dragon world. On page 20 the fortress is EXPANDED — chairs pushed outward, an additional blanket spread wider — visibly bigger than on page 1.`,

  crib: `RECURRING OBJECT LOCK — CRIB:
The same wooden baby crib in the adjacent room (visible through an open doorway). Distinctive visual signature: white-painted spindled wooden rails on all four sides, low to the floor with short legs, a small yellow blanket draped inside, soft mattress visible. Same exact crib appears in every page where present — same rail spacing, same paint, same yellow blanket inside.`,

  yellow_blanket: `RECURRING OBJECT LOCK — YELLOW BLANKET:
A small soft baby blanket, warm yellow color (like soft butter or pale sunshine), about the size of a folded large napkin. Appears in three places: (1) inside the crib in p1, p2, p20; (2) as a memory-bubble image in p12 wrapped around the baby sister; (3) actively wrapped around the baby sister by the child on p20 as the final transfer-of-learning moment. Same exact yellow blanket every time — same color, same fabric weight, same proportions.`,

  toy_chest: `RECURRING OBJECT LOCK — TOY CHEST:
A deep wooden toy chest in the child's bedroom. Distinctive visual signature: warm honey-brown wood with visible grain, hinged lid (open in scenes where it functions as portal), interior depth visible filled with wooden blocks and plush toys. On pages 3, 5, 19 the back of the chest GLOWS faintly as a portal between worlds — soft warm-light shimmer visible at the rear interior. Otherwise (p1, p2, p20) it sits as ordinary furniture.`,

  t_rex_toy: `RECURRING OBJECT LOCK — T-REX/RAPTOR TOY:
A small rigid PLASTIC toy dinosaur (T-rex shape on p1/p2/p8) — clearly artificial, matte plastic, palm-to-forearm sized, obviously inanimate. Distinctive visual signature on p1: bright orange OR bright blue plastic (NOT green — must not read as moss-green baby dragon or live Dini), darker accent stripe, articulated legs and tail. Same toy identity across pages but p1 color must be non-green for clarity. On p1 held aloft like a scepter; on p2 used as a gentle tail-probe over the crib rail. NEVER alive, NOT Dini, NOT the baby dragon, NOT moss-green scales.`,

  green_speckled_egg: `RECURRING OBJECT LOCK — GREEN SPECKLED DRAGON EGG:
The runaway dragon egg. Distinctive visual signature: oval egg shape, slightly larger than a soccer ball, base color moss-green (slightly muted, like new spring moss), covered with small copper-orange freckles in irregular cluster patterns. Surface is smooth and slightly waxy, with a soft inner glow that pulses faintly when calm. Same exact egg appears in every page where present — same green tone, same copper freckle pattern (do not redraw freckles randomly).

STATES: intact (p3 forbidden — egg unseen; pp 6–13 intact and bouncing); wrapped in silver ribbon (p13 end through p15, looks like a "burrito"); cracked open (p16 — shell fragments scattered around hatched baby).

ABSOLUTELY NEVER: blue, white, golden, gem-like, or any color other than moss-green-with-copper-freckles. NEVER on a glowing amber stone (that was the old story). NEVER cracked early.`,

  silver_ribbon: `RECURRING OBJECT LOCK — SILVER RIBBON:
A wide stretchy ribbon woven from silvery-grey reed-grass strands of the whisper valley. Distinctive visual signature: about as wide as the child's forearm, soft silver-grey CLOTH ribbon / soft woven fabric sash — matte, flexible, visible fabric weave or soft textile texture. NOT metal, NOT plastic, NOT a hard band, NOT mirror-shiny, NOT foil. Slight soft sheen like silk gauze at most. Strong but flexible. Appears in pp 12–15 as the wrap material. On p13 actively being wrapped around the egg; on p14–15 fully wrapped like a soft fabric burrito; on p16 torn open by the hatching baby.`,

  orange_moss_hills: `RECURRING OBJECT LOCK — ORANGE MOSS HILLS:
The signature landscape of Dini's dragon world. Distinctive visual signature: rolling soft hills covered in vivid orange-tangerine moss (like a sponge surface), slightly springy/trampoline-like, soft-edge gentle slopes. Sky above is a warm purple twilight (NOT day, NOT night). Same exact moss texture and color across pages 5–15 whenever the dragon-world landscape is shown. Feels safe to fall on — comforting, NOT dangerous-looking.`,

  nest_of_cushions: `RECURRING OBJECT LOCK — CUSHION NEST:
A circular nest made of approximately 8–10 round blue spongy cushions arranged in a ring on the orange moss. The cushions are sky-blue, plush, slightly shiny. The nest is shallow with a soft depression in the middle where the egg sits (or bounces out of). Appears on pp 6, possibly 14. Same exact cushion arrangement and color every appearance.`,

  blue_crystal_slide: `RECURRING OBJECT LOCK — BLUE CRYSTAL SLIDE:
A long smooth slide formed of translucent blue crystal — like an ice slide but made of solid sky-blue crystal. Curves gently downward into the whisper valley below. Surface is smooth-shiny, reflects light slightly. Appears in p10 as the action set-piece. Approximately 5–6 child-lengths long.`,

  whisper_valley_reeds: `RECURRING OBJECT LOCK — WHISPER VALLEY REEDS:
Giant fuzzy reed plants towering in the dragon-world valley (pp 11–12). Distinctive visual signature: tall as small trees (3–4 meters), main stem soft and fuzzy like cattail-fur, topped with a feathery silvery-green plume that sways gently. Several reeds visible across the valley. Same exact plant shape and color each appearance. Some reed-fronds hanging down are the source of the silver_ribbon strands.`,

  marshmallow_swamp: `RECURRING OBJECT LOCK — MARSHMALLOW SWAMP:
A small puddle of glossy sticky purple goo on the orange moss (p11). Distinctive visual signature: deep grape-purple color, glossy stretchy surface like melted-then-cooling marshmallow, irregular puddle shape about the size of a kid's wading pool. Looks soft but sticky-dangerous. The egg is heading toward it in p11 — visual threat. Not present in any other page.`,

  cracked_eggshell: `RECURRING OBJECT LOCK — CRACKED EGGSHELL:
After hatching (pp 16, 19) — the moss-green-with-copper-freckles egg has split into two large rounded halves on the orange moss. Inside surface pale cream. Shell fragments scattered around. One small piece of shell stuck on the baby dragon's snout in pp 16 + 19 (running gag). Color and freckle pattern of the shell exactly match the intact egg from earlier pages.`,

};

export const DRAGON_DINI_RECURRING_ENTITY_CATALOG: Record<string, string[]> = {
  baby_dragon: [
    'baby dragon',
    'green baby dragon',
    'moss-green baby',
    'hatchling',
    'newborn dragon',
    'baby with shell on snout',
    'דרקון תינוק',
  ],
  baby_sister: [
    'baby sister',
    'newborn baby',
    'tiny human baby',
    'baby in crib',
    'swaddled baby',
    'תינוקת',
    'אחות קטנה',
  ],
};

export const DRAGON_DINI_RECURRING_ENTITY_LOCKS: Record<string, string> = {
  baby_dragon: `RECURRING ENTITY LOCK — BABY DRAGON (moss-green hatchling):
The same baby dragon whenever shown — newly hatched at p16, present through p19. Distinctive visual signature:

- Scales: SOFT MOSS-GREEN (slightly muted, similar tone to spring moss), NOT copper, NOT blue, NOT yellow.

- Freckles: small copper-orange freckles dotted across the scales (matching the eggshell pattern).

- Wing membranes: peach-coral color (soft warm pink-orange), oversized for the small body (wing-span larger than body length).

- Head: large, rounded, juvenile proportions — head approx 35% of total body length.

- Top of head: TWO SOFT BUMPS where horns will eventually grow — NOT actual horns yet. Soft, round, no point.

- Eyes: large, dark amber, with a single small white highlight in each. Friendly, curious, slightly clumsy expression.

- Snout: very short and rounded, almost button-like.

- Belly: pale cream underside.

- Body size: small enough to fit comfortably in a 5-year-old child's lap — about the size of a small cat.

ANTI-MERGE with Dini (mother dragon): Dini is COPPER scales (not green). Baby is MOSS-GREEN (not copper). Color palette is the primary visual separator. NEVER recolor either to match the other.

SIGNATURE running gag: a piece of broken eggshell stuck on the baby's snout in pp 16, 19 — keep it visible.

NEVER an adult-proportioned dragon. NEVER horns developed beyond soft bumps. NEVER without the peach-coral wing color. NEVER same color as Dini.`,

  baby_sister: `RECURRING ENTITY LOCK — BABY SISTER (newborn human):
The newborn baby sister in the crib. Distinctive visual signature:

- Newborn human baby, approximately 0–3 months old in appearance.

- Head: small and round, mostly BALD with maybe a faint wisp of soft fuzz (newborn).

- Pinkish skin tone (typical newborn flush).

- Eyes: usually closed sleeping or partly squinted; when open, dark and unfocused.

- Mouth: small but capable of producing a surprisingly loud cry (described "huge mouth" in story).

- Body: very small, wrapped in pale fabric or covered with the yellow blanket.

- GREEN socks: when feet are visible, the socks are SOFT GREEN (NOT pink — neutrality choice).

- Always inside the crib, NEVER held by the child protagonist (the child only watches or wraps her in the blanket).

NEVER a toddler. NEVER an older child. NEVER walking or sitting up. ALWAYS a swaddled or blanket-wrapped newborn in the crib.`,

};

export const DRAGON_DINI_COMPANION_LOCK = `COMPANION LOCK — DINI (female, mid-sized friendly young dragon):
Same Dini from the new Dini reference sheets (to be generated). Young FEMALE copper-scaled dragon — playful, scrappy, friendly, with the slapstick energy of a young creature still figuring out her own size. Same character every page. Same head landmarks, same horn shape, same ear-frills, same eye style, same body proportions, same wing color every page.

DINI IDENTITY (mandatory — never drift between pages):

- Sex: FEMALE. The story refers to her with feminine grammar throughout. Render with slightly softer face shape than a male war-dragon — gentle, expressive, alive.

- Age: YOUNG (juvenile-to-adolescent dragon, NOT a baby, NOT an adult, NOT a war-dragon).

- Size: MID-SIZED. Specifically: slightly larger than a golden retriever, smaller than a pony. A child could ride her playfully if she let them; she's not so huge she dwarfs the child. Approximately as tall as the child's chest when standing on four legs, or as tall as the child when she rears up on her hind legs.

- Scales: SHIMMERING COPPER-ORANGE (warm copper with sunset highlights), NOT green, NOT blue, NOT teal, NOT red.

- Wing membranes: PEACH-CORAL (warm pink-orange), small-to-medium folded close to body most of the time.

- Belly: PALE CREAM with visible soft horizontal segment lines.

- Eyes: LARGE, friendly, warm amber-brown with one small white highlight each. Curious, lively, slightly mischievous.

ANATOMY EXACT COUNT (must not drift between pages):

- Horns: EXACTLY 2 (two), both small and curved upward, on top of the head ONLY.

- Side ear-frills: EXACTLY 2 (one each side), small leaf-shaped flaps behind the cheeks.

- Back spikes: 3 or 4 small soft bumps ONLY along the neck and upper back.

- Wings: 2, peach/coral membrane, modest size (folded close to body most of the time, NOT giant spread).

- Snout: short and rounded, NOT elongated.

- Tail: short-to-medium, tapered, ending in a small curved tip. EXACTLY ONE tail — never two tails, never a forked or duplicated tail, never a second tail silhouette.

- Age read: young juvenile/adolescent dragon, clearly BIGGER than a hatchling; NOT an infant/chibi dragon, NOT baby-proportioned.

PERSONALITY ON PAGE (must be visually readable):

- Playful, scrappy, lively. NOT solemn. NOT regal. NOT a warrior.

- Slapstick-capable: in p3 she has a plastic bucket stuck on her snout — accept the comedy.

- Protective of the egg (in p6–p15) and of the child (in p10, p17–p18) — affection visible.

- Slightly clumsy at times — she trips, falls on her belly, throws ribbon-ends like a tag-team partner.

- Smile is small and warm, not toothy. NO bared teeth EVER.

FORBIDDEN DRAGON RENDERINGS:

- NOT an adult war-dragon. NOT a Skyrim-style dragon. NOT a Western heraldic dragon.

- NOT a lizard. NOT a dinosaur. NOT a salamander.

- NOT a baby dragon (anti-merge — Dini is mid-sized, baby is small-cat-sized).

- NOT copper baby OR moss-green Dini (color palettes are STRICTLY separated).

- NOT male (the story's grammar is feminine throughout).

- NOT a small pet dragon (she's mid-sized, the child can ride her in p10).

ANTI-MERGE with baby_dragon (mandatory): Dini is COPPER-ORANGE scales with PEACH-CORAL wings. Baby is MOSS-GREEN scales with COPPER FRECKLES and PEACH-CORAL wings. The wing color shared deliberately; everything else MUST be visually distinct. NEVER recolor Dini to green. NEVER recolor baby to copper.`;

export const DRAGON_DINI_COMPOSITION_BY_PAGE: Record<number, Style01CompositionSpec> = {
  1: {
    shotType: 'wide establishing — child in fort',
    subjectScale: 'medium',
    camera: 'wide angle on the child seated inside an elaborate pillow fortress in a cozy living room',
    subjectDominance:
      'Same child as every other page in the book — identical face, hair, skin tone, age. Child centered in the fortress, holding a small bright orange-or-blue plastic T-rex toy aloft like a scepter (clearly inanimate plastic, NOT alive); cushion walls visible; open doorway reveals crib with jagged comic sound waves.',
    staging:
      "5-year-old protagonist seated cross-legged inside an elaborate pillow-and-blanket fort, holding a small rigid bright orange OR bright blue plastic T-rex toy up like a scepter — matte plastic, obviously a toy, NOT alive, NOT Dini, NOT the baby dragon. Living room interior; open doorway to baby's room with crib and stylized sound-wave shapes. Warm afternoon light. SAME child identity as pages 10/13/15/20.",
    pagePurpose:
      'Introduce child as fortress-king with serious kingdom rules; introduce the disruptive new noise from the next room',
  },
  2: {
    shotType: 'medium two-shot — child + crib',
    subjectScale: 'medium',
    camera: 'medium shot beside the crib — child on tiptoes peeking over the rail',
    subjectDominance:
      "Child stands on tiptoe at the crib rail, gently extending the tail of the T-rex toy to touch baby sister's foot; mother stands beside holding a half-empty bottle.",
    staging:
      "Wooden crib with white painted rails. Inside: tiny bald newborn baby sister wearing GREEN socks (NOT pink), small yellow blanket beside her. Child on tiptoe at the rail, leaning to touch the baby's foot with the plastic T-rex tail. Mother (tired but loving) beside holding a half-empty baby bottle. Soft daytime light.",
    pagePurpose:
      'First meeting between child and the new baby — gentle but skeptical; establishes the "she takes too much space" emotional read',
  },
  3: {
    shotType: 'medium close — toy chest discovery',
    subjectScale: 'medium',
    camera: 'medium close — child leaning over the open toy chest, light from inside',
    subjectDominance:
      "Child leaning into a deep wooden toy chest in a moonlit bedroom. From inside the chest, Dini's honey-amber eyes peek out from amid wooden blocks; a plastic bucket is stuck on her snout.",
    staging:
      "Nighttime bedroom. Child leaning over a deep wooden toy chest, lid open. Inside: wooden blocks and plush toys; Dini's two large honey-amber eyes peek up through them. Plastic bucket stuck on Dini's snout (comedy). Soft moonlight from a window.",
    pagePurpose: "Dini's first appearance — comedy debut, child's curiosity activated",
  },
  4: {
    shotType: 'medium intimate — first parley',
    subjectScale: 'medium',
    camera: 'medium shot — Dini emerging fully from the toy chest, child standing tall',
    subjectDominance:
      'Dini shaking her head joyfully (bucket flying off), sending wooden blocks scattering. She is mid-sized — slightly larger than a golden retriever, smaller than a pony. Child stands tall with hands on hips like a fortress commander.',
    staging:
      'Bedroom interior, toy chest behind Dini. Young female copper-scaled dragon, mid-sized, peach-coral wings folded, friendly expression; shaking head joyfully — three wooden blocks fly through the air. Child stands tall, hands on hips like a fortress commander. Plastic T-rex on the floor beside the child.',
    pagePurpose: 'Dini commissions the child as fortress-expert — alliance formed',
  },
  5: {
    shotType: 'wide establishing — dragon world arrival',
    subjectScale: 'small',
    camera: 'wide environmental shot — child and Dini emerging from a glowing toy-chest portal into orange moss hills',
    subjectDominance:
      'Child and Dini standing small in the lower third of the frame, having just emerged from a shimmering portal behind them. They face a vast landscape of rolling orange moss hills under purple twilight sky.',
    staging:
      'Magical landscape — soft rolling orange moss hills (springy trampoline-like), purple twilight sky above with a few distant glowing motes. The toy chest portal shimmers behind the child and Dini (faint warm light fading). Both stand small in lower-third of frame, looking out. NO cave. NO dinosaur-era scenery.',
    pagePurpose: 'Reveal of the dragon-world — establish the otherworld with movement and wonder',
  },
  6: {
    shotType: 'medium-wide action — bouncing egg',
    subjectScale: 'medium',
    camera: 'medium-wide on the cushion nest with the egg mid-bounce',
    subjectDominance:
      "A nest of round blue spongy cushions sits in a depression in the orange moss. The moss-green-with-copper-freckles egg is mid-air, having just ricocheted off Dini's wing. Dini lunges to catch it with tongue out in concentration.",
    staging:
      'Orange moss hills environment. Cushion nest of ~8 blue spongy cushions in a ring. Moss-green dragon egg with copper freckles caught in mid-air mid-bounce, having just hit Dini\'s wing. Dini lunging in a fail-attempt, tongue out. NO child in this frame — this is Dini\'s solo moment of "see the problem."',
    pagePurpose: 'Reveal the runaway egg — visually establish the bouncing-egg problem with humor',
  },
  7: {
    shotType: 'medium two-shot — egg consultation',
    subjectScale: 'medium',
    camera: 'medium-wide on Dini sprawled chin-down stopping the egg, child standing beside',
    subjectDominance:
      'Dini sprawled belly-down on the orange moss using her chin to halt the wobbling egg before a slope. Child stands beside her with arms folded, looking like a certified fortress-consultant.',
    staging:
      'Orange moss hills. Dini lying belly-down on the moss, chin pressed against the green speckled egg to halt it. Child stands beside her, arms folded, advisor-like posture. Tail-tip of Dini twitching with effort (small motion lines).',
    pagePurpose: 'Child positions as expert; emotional mirror — egg sounds like sister',
  },
  8: {
    shotType: 'medium humorous — failed roar attempt',
    subjectScale: 'medium',
    camera: 'medium shot — child mid-roar, egg launched up into air, scorched flower beside',
    subjectDominance:
      'Child gives a full-body dinosaur roar. The egg shoots up into the air with comic motion lines. Dini looks startled. A small flower beside them is freshly singed and looks indignant (slapstick comedy).',
    staging:
      'Orange moss hills. Child standing with feet apart, mouth wide open in a big dinosaur roar, body slightly hunched forward. The green speckled egg shoots upward with cartoon motion-lines. Dini\'s eyes wide with surprise. To the side, a small flower is comically scorched and looks indignant.',
    pagePurpose: "First failed attempt — humor + lesson that domination doesn't work",
  },
  9: {
    shotType: 'medium dance comedy — maracas',
    subjectScale: 'medium',
    camera: 'medium shot — child in frenetic dance shaking maracas',
    subjectDominance:
      'Child shakes two purple seed-pod maracas in a frenetic dance in front of the egg. The egg vibrates in place, motion-blurred entirely, unimpressed. Dini watches with worried curiosity.',
    staging:
      'Orange moss hills. Child in mid-dance — feet apart, knees slightly bent, both arms raised shaking two purple seed-pod maracas. The green speckled egg in front of the child is vibrating so fast it appears as a motion-blurred blob. Dini sits to the side watching, ears slightly back in worried curiosity.',
    pagePurpose: 'Second failed attempt — even more humor + reinforces that brute force fails',
  },
  10: {
    shotType: 'wide action — crystal slide ride',
    subjectScale: 'medium',
    camera: 'wide-medium on Dini belly-sliding down a long blue crystal slide, child clinging to her neck',
    subjectDominance:
      'Dini slides belly-first down a long blue crystal slide like a toboggan. Child clings to her neck, laughing and screaming. The green speckled egg careens ahead of them like a runaway ball.',
    staging:
      'Long smooth blue crystal slide from orange moss hills toward a valley. Dini belly-down on the slide, peach-coral wings folded, mid-slide. Child clings to her neck, face full of delighted terror. Green speckled egg rolls ahead just out of reach. Motion lines.',
    pagePurpose: 'Action set-piece — bonding through shared chaos',
  },
  11: {
    shotType: 'wide environmental — whisper valley threat',
    subjectScale: 'small',
    camera: 'wide shot of the whisper valley — giant fuzzy reeds, spinning egg, marshmallow swamp threat in middle distance',
    subjectDominance:
      'A whimsical valley filled with giant fuzzy reed-like plants swaying gently. The egg spins on its tip like a top, kicking up colored dust, heading toward a sticky purple puddle of melted-marshmallow goo.',
    staging:
      'Whisper valley — wide environmental shot. Giant fuzzy reed-plants towering, silvery-green plumes swaying. The green speckled egg spins on its tip in the foreground, motion-blurred to a single line of color. In the middle distance: a glossy purple marshmallow swamp puddle — a clear visual threat. Child and Dini visible small in the frame, watching anxiously.',
    pagePurpose: 'Escalating stakes — third location, real danger of egg getting stuck',
  },
  12: {
    shotType: 'medium contemplation — realization',
    subjectScale: 'medium',
    camera: 'medium shot on the child watching the spinning egg, thoughtful expression',
    subjectDominance:
      "Child watches the spinning egg with a thoughtful, dawning realization. A gentle memory-bubble shows the baby sister wrapped in a yellow blanket, peaceful. A wide silvery ribbon-grass strand hangs from a nearby reed plant within the child's reach.",
    staging:
      "Whisper valley. Child in foreground watching the spinning green egg. A soft memory-bubble (cloud-shape, slightly transparent) floats above the child's head showing the baby sister calm and wrapped in a yellow blanket. A wide silvery ribbon-grass strand hangs from a tall fuzzy reed plant just within reach of the child's hand. Dini hovers nearby attentively.",
    pagePurpose: 'Pivotal realization — child connects egg and sister; the heart-line beat',
  },
  13: {
    shotType: 'comic action — ribbon wrap',
    subjectScale: 'medium',
    camera: 'medium action shot — child half-wrapped around the spinning egg, wrestling it with the silver ribbon',
    subjectDominance:
      'The child is half-wrapped around the spinning egg, dizzy but determined, wrestling it down while wrapping it with a wide stretchy silver ribbon. Dini stands beside throwing the ribbon-end like a tag-team partner.',
    staging:
      "Whisper valley floor. Child wrapped half around the green speckled egg, dizzy but determined, looping a wide soft silver-grey CLOTH fabric ribbon around the egg (matte textile, NOT metal or plastic). Dini beside the action, mouth holding one ribbon end, eyes wide with concentration.",
    pagePurpose: 'Climax action — child solves the problem with soft physical containment',
  },
  14: {
    shotType: 'medium quiet — egg burrito',
    subjectScale: 'medium',
    camera: 'medium shot — wrapped egg on the moss, child lying on back beside it',
    subjectDominance:
      'The egg lies still on the orange moss, wrapped in the wide silver ribbon like a giant burrito. Child lies on his/her back beside it, dusty and proud. Dini looks enchanted and relieved.',
    staging:
      'Whisper valley moss floor. Green speckled egg fully wrapped in silver ribbon — looks like a giant silver-and-green burrito. Egg lies still, glowing faintly green-copper from within. Child lies on his/her back on the orange moss beside the egg, dusty (moss flecks in hair, on pajamas), arms outstretched, face proud and smiling. Dini sits nearby, peach-coral wings half-spread in relief.',
    pagePurpose: 'Quiet pride after action — the success beat',
  },
  15: {
    shotType: 'intimate quiet — heart line',
    subjectScale: 'medium',
    camera: 'intimate medium shot — Dini curled protectively around child + wrapped egg in open orange-moss shelter',
    subjectDominance:
      'Dini curls protectively around the child and the fabric-wrapped egg in a soft outdoor nest nook on orange moss — NOT a cave. Warm amber dusk light. Mid-sized Dini (golden-retriever-to-pony scale) curls AROUND the child without towering over him. EXACTLY ONE tail visible. Heart-line moment — tender, quiet.',
    staging:
      "OPEN dragon world — soft protected nest: a cushion hollow / warm orange-moss shelter / blanket-like safe nook under open purple-twilight sky with orange moss visible around. NOT a cave, NOT a stone tunnel, NOT a dragon lair, NOT rocky walls. Dini curls her mid-sized body (larger than a golden retriever, smaller than a pony — does NOT dwarf the child) around the child and silver-fabric-wrapped egg; peach-coral wings folded; EXACTLY ONE tail. Child sits in the moss, hand on the wrapped egg. Egg pulses soft glow through cloth ribbon. Dini's face soft and understanding.",
    pagePurpose: 'HEART LINE — "small things kick everywhere because the world feels too big"',
  },
  16: {
    shotType: 'medium reveal — hatching',
    subjectScale: 'medium',
    camera: 'medium shot — cracked eggshell halves, baby dragon emerging',
    subjectDominance:
      'Cracked eggshell halves on the orange moss. A baby dragon — moss-green scales with copper freckles matching the shell, peach-coral wing membranes oversized for the body, large head with two soft bumps (NOT horns yet) — sits in the shell with a piece of shell still on his snout.',
    staging:
      'Orange moss floor. Cracked silver ribbon visibly torn open (in pieces). Two large eggshell halves split apart — moss-green shell with copper freckles. Inside, a baby dragon: moss-green scales with copper freckles, peach-coral oversized wings, large round head, two soft head-bumps (NOT horns yet), large dark amber eyes wide with wonder. A small piece of shell stuck on his snout. He has just sneezed a tiny star-shaped puff cloud.',
    pagePurpose: "Reveal of baby dragon — the cause of the egg's panic was about to be born",
  },
  17: {
    shotType: 'medium playful — baby faceplant',
    subjectScale: 'medium',
    camera: "medium shot — child cross-legged, baby dragon faceplanting into child's lap",
    subjectDominance:
      "Child sits cross-legged and laughs as the baby dragon faceplants gently into his/her lap. The baby's tail wags like a puppy's. Dini approaches with a warm, proud smile.",
    staging:
      "Orange moss floor. Child sits cross-legged (a little dusty), laughing. Baby dragon (moss-green + copper freckles + peach-coral wings + shell on snout) faceplants gently into the child's lap; tail wags like a puppy. Dini approaches, mid-sized, proud warm smile (no teeth).",
    pagePurpose: 'Joyful bonding — baby chooses the child',
  },
  18: {
    shotType: 'medium tender — star sneeze',
    subjectScale: 'medium',
    camera: "medium shot — child hugging baby dragon's neck, star-cloud sneeze",
    subjectDominance:
      "Child hugs the baby dragon's neck. The baby releases a small harmless puff of smoke that bursts into a tiny star-shaped cloud. Dini glows beside them — proud, warm.",
    staging:
      "Orange moss floor. Child hugs the baby dragon's neck tenderly. The baby has just sneezed a small star-shaped cloud (visible above the baby's snout). Dini sits beside them, peach-coral wings half-extended, eyes warm and crinkled with affection. Soft amber light.",
    pagePurpose: 'Sealing the kingdom — child accepts the baby into the realm',
  },
  19: {
    shotType: 'medium farewell — portal departure',
    subjectScale: 'medium',
    camera: 'medium shot — child stepping back through shimmering toy-chest portal, Dini and baby waving',
    subjectDominance:
      "Child steps backward through a shimmering portal-shape that is the open back of the wooden toy chest. Dini and the baby dragon wave goodbye; the baby still has a piece of eggshell on his snout and is mid-faceplant, with Dini catching his tail. The magic dissolves into the child's bedroom.",
    staging:
      "A magical scene — the toy-chest portal is rendered as a soft glowing arch on the orange moss. Child steps backward through it, half-already-back-in-bedroom. Dini stands on the moss-side waving one paw, peach-coral wings spread slightly. Baby dragon mid-stumble, falling sideways with shell-piece on snout — Dini's tail wrapped around his tail catching him.",
    pagePurpose: 'Farewell — child takes the new understanding home',
  },
  20: {
    shotType: 'medium-wide home — sister wrap + expanded fortress',
    subjectScale: 'medium',
    camera: 'medium-wide — one child at crib, expanded fortress visible in same room',
    subjectDominance:
      'EXACTLY ONE child — the protagonist kneeling at the crib, gently tucking the yellow blanket around the calm baby sister. The ALREADY-expanded pillow fortress is visible in the same living room as background context (not being built). Parents watch quietly. NEVER a second child.',
    staging:
      'Home interior — same living room as p1. ONE protagonist child kneels at the wooden crib through the open doorway, gently wrapping the yellow blanket around the sleepy baby sister (not too tight, not too loose). In the same room, the pillow fortress is ALREADY visibly LARGER than p1 — chairs pushed outward, extra blanket on the roof — but NO second child building it. Parents in soft background (mom with bottle, dad with pacifier). Warm evening light. EXACTLY ONE child in the scene.',
    pagePurpose: 'FINAL — kingdom transformed with new rules and more room',
  },
};
