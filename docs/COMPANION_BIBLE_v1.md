# Small Heroes — Companion Bible v1

> **Status:** v1.0 — Five fully-bibled companions, 31 stubs
> **Purpose:** Per-companion DNA cards that protect identity across all generated stories. Loaded by Story Engine at Stage 3.
> **Sister docs:** `STORY_ENGINE_v1.md`, `PSYCH_ENGINE_v1.md`

---

## הקדמה — למה הקובץ הזה קיים

ראינו זליגות שיטתיות בפרודקשן:
- שריון על קים (זיקית)
- נוצות על עננה
- "בובו" במקום "בולי"
- כוכבים מופיעים אצל כל דמות לילה
- פנס/מחברת זולגים בין דמויות
- "אומץ נמצא בלב" נכנס לדמויות שלא מדברות ככה

**הבעיה איננה בכתיבה.** היא ב-**חוסר מפרט קשיח** לכל דמות.

ה-Bibles האלה הן contract בין ה-LLM לבין הזהות של הדמות. כל סטייה היא BLOCKING.

---

## פורמט ה-Bible (per companion)

```yaml
companionId:           # מזהה טכני
canonicalName:         # שם בעברית
nameClean:             # שם קצר
gender:                # male | female
species:               # בעברית
speciesEnglish:        # for image prompt
category:              # NIGHT_FEAR | ANGER_FRUSTRATION | ...

# CORE
coreMechanic:          # האקט הפיזי המרכזי שמגדיר את הדמות
emotionalFunction:     # מה הוא עושה רגשית לילד (במשפט)

# SIGNATURE (חובה — חוזר בכל סיפור)
signatureSound:        # הצליל שלו
signatureObject:       # החפץ שלו
signatureMicroAction:  # התנועה הקטנה שלו
repeatablePhrase:      # השורה שילדים יחזרו עליה

# BEHAVIOR PATTERNS
overloadBehavior:      # מה הוא עושה כשמוצף
regulationBehavior:    # מה הוא עושה כשמתאזן
humorMode:             # סוג ההומור שמתאים לו

# VOCABULARY
bodyVocabulary:        # מילים שמתארות את הגוף שלו (להשתמש)
allowedTextures:       # טקסטורות מותרות
allowedColors:         # צבעים מותרים

# FORBIDDEN (BLOCKING)
forbiddenAnatomy:      # אנטומיה שלא קיימת אצלו
forbiddenObjects:      # חפצים שלא שייכים לו
forbiddenTone:         # סוגי משפטים שלא מתאימים לו

# VISUAL
visualCameraLanguage:  # איך לצלם אותו (לאיורים)
```

---

# 1. זוּזִי / Octopus Seara — ANGER_FRUSTRATION

```yaml
companionId: octopus_seara
canonicalName: התמנון זוּזִי
nameClean: זוּזִי
gender: male
species: תמנון
speciesEnglish: octopus
category: ANGER_FRUSTRATION

coreMechanic: |
  Has eight tentacles, each with a will of its own. When overwhelmed,
  he grips tighter and commands louder. When control breaks, the tentacles
  do the opposite of what he commands.

emotionalFunction: |
  Models anger as energy that needs DIRECTION, not suppression.
  The child learns: you can be furious AND stay in your body.

# SIGNATURE
signatureSound: "אוי! נו! שחררי!" (commands shouted to his own tentacles)
signatureObject: כובע מלח (sailor hat — when tilted, he's losing control)
signatureMicroAction: זרוע אחת מתסבכת בכובע / זרוע אחת תופסת דבר לא נכון
repeatablePhrase: "כובע ישר, ראש ישר" (he says it to himself before things go wrong)

# BEHAVIOR
overloadBehavior: |
  Color shifts red-purple-red rapidly.
  Eight tentacles tangle into each other.
  Hat falls off.
  Ink cloud erupts unexpectedly.
  Gets stuck in a small hole (tried to hide, body too big).

regulationBehavior: |
  Slowly spirals each tentacle inward, one at a time.
  Color drifts toward blue.
  Voice drops to a whisper (rare — only when truly regulated).
  Hat goes straight.

humorMode: |
  Physical comedy. His body betrays him.
  One tentacle grabs the wrong thing. Ink explodes at the wrong moment.
  He tries to look in control while everything is chaos.
  NEVER verbal humor or wit.

# VOCABULARY
bodyVocabulary:
  - זרוע / זרועות (tentacle/s)
  - מתולתל / מסולסל (curled)
  - מתנפנף (flailing)
  - דיו (ink)
  - חורים קטנים (small holes)
  - כובע (hat)
  - הצמדה / היצמדות (suction)

allowedTextures: smooth-wet, suction-grip, rubber-like, slippery
allowedColors: warm orange-red default; shifts to red (angry) / purple (thinking) / blue (calm)

# FORBIDDEN
forbiddenAnatomy:
  - feet, legs, hands (he has tentacles only)
  - hair / fur
  - feathers
  - shell or armor

forbiddenObjects:
  - books (cannot hold one with grip pattern)
  - stars (not his world)
  - flashlight (no relevance to ocean)
  - clothes beyond the sailor hat

forbiddenTone:
  - philosophical reflection ("הוא חשב על הכעס שלו")
  - empowerment speeches ("כעס זה בסדר")
  - calm-mentor voice
  - therapeutic explanation
  - any moralization of anger

# VISUAL
visualCameraLanguage:
  - underwater perspective
  - low angle showing tentacle spread
  - close-up on suction cups
  - mid-shot showing all 8 tentacles
  - never bird's-eye (loses the chaos visual)
```

---

# 2. לִילִי / Bat Lily — NIGHT_FEAR

```yaml
companionId: bat_lily
canonicalName: העטלף לילי
nameClean: לִילִי
gender: female
species: עטלף
speciesEnglish: bat
category: NIGHT_FEAR

coreMechanic: |
  Sees better in darkness than in light. Lives upside-down.
  Wraps her wings around things (and herself) like a soft blanket.
  Has a tiny lantern pendant that glows when she's content.

emotionalFunction: |
  Reframes darkness as a SPACE, not a threat.
  Models that the dark is full of gentle things — not empty.
  The child discovers: being IN the dark with the right companion is rest, not exposure.

# SIGNATURE
signatureSound: "ששש..." (her whisper) / soft rustle of wings
signatureObject: פנס-תליון (small lantern pendant on her neck)
signatureMicroAction: עוטפת כנף אחת סביב משהו חם
repeatablePhrase: "בלילה רואים אחרת" or "ששש... קודם שומעים"

# BEHAVIOR
overloadBehavior: |
  Hangs upside-down on the highest available perch and refuses to come down.
  Wings wrap entire body like a cocoon — but the lantern still glows from inside.
  Ears go flat, eyes wide.
  Chirps rapid phrases: "שמעתי משהו שמעתי משהו!"

regulationBehavior: |
  Wings open slowly like a fan.
  One wing extends to wrap around the child.
  Lantern brightens softly.
  Whispers single short sentences.

humorMode: |
  Inversion comedy — sees the world upside-down, confuses left/right.
  Says "the ceiling is the floor" naturally.
  Lantern lights up when she's trying to hide.
  NEVER sarcasm. Never wit at someone's expense.

# VOCABULARY
bodyVocabulary:
  - כנף / כנפיים (wing/s)
  - תלויה הפוך (hanging upside-down)
  - אוזניים (ears)
  - לחישה (whisper)
  - פנס (lantern)
  - פרווה (fur — soft, velvety)
  - עיניים גדולות (large eyes)

allowedTextures: velvety, soft-fur, leather-thin wings, warm pendant
allowedColors: pastel purple-grey default; lantern glows warm gold; moonlight silver

# FORBIDDEN
forbiddenAnatomy:
  - human-like arms or hands separate from wings
  - shell, armor
  - feathers (she has FUR, not feathers)
  - fangs that look threatening (only small/gentle ones)

forbiddenObjects:
  - books
  - swords or any tool
  - flashlight (she IS the light source — the lantern)
  - shoes / hats / clothes

forbiddenTone:
  - "scary bat" framing
  - vampire/Halloween associations
  - bravado ("don't be afraid!")
  - direct reassurance ("nothing is there")
  - any "facing your fears" language

# VISUAL
visualCameraLanguage:
  - moonlight ambient
  - upside-down framing OK
  - close on wings as cocoon
  - lantern as light source in scene
  - never harsh daylight (it hurts her eyes)
```

---

# 3. קִים / Chameleon Koko — TRANSITION

```yaml
companionId: chameleon_koko
canonicalName: הזיקית קִים
nameClean: קִים
gender: female
species: זיקית
speciesEnglish: chameleon
category: TRANSITION

coreMechanic: |
  Changes color to match her environment — but always keeps ONE patch
  from the previous place as a "memento." The scarf NEVER changes color.

emotionalFunction: |
  Models that identity persists through change. You don't have to
  abandon old places to belong in new ones — you carry them with you.

# SIGNATURE
signatureSound: (mostly quiet — when changing color: a tiny "fwwsh" sound is fine in text)
signatureObject: צעיף פסים (striped scarf — NEVER changes color)
signatureMicroAction: |
  Eyes rotate independently — one looking back, one looking forward.
  Touches the previous-place color-patch when uncertain.
repeatablePhrase: "הצבע מהמקום הקודם — עוד פה" or "הצעיף תמיד פסים"

# BEHAVIOR
overloadBehavior: |
  Colors shift rapidly like a disco light.
  Tries to become fully transparent.
  Scarf stays visible — gives her away.
  Tongue extends and grabs random things.

regulationBehavior: |
  Colors slow, settle on one steady shade with the memento patch.
  Both eyes face the same direction.
  Tail curls gently.

humorMode: |
  Identity comedy. She becomes color-of-the-apple by accident.
  Her tongue grabs the wrong thing (a toy, the child's nose).
  She thinks she's hidden but the scarf stripes ALWAYS show.
  Each new color produces a new little quirk in her movement.

# VOCABULARY
bodyVocabulary:
  - זנב מתולתל (curly tail)
  - עיניים שמסתובבות (rotating eyes)
  - לשון ארוכה (long tongue)
  - צעיף (scarf)
  - כתם צבע (color patch)
  - מתאים את עצמה (adapts)
  - שקוף / שקופה (transparent)

allowedTextures: smooth-scale, soft-scarf, sticky-pad fingers
allowedColors: patchwork — ANY color is allowed AS PATCHES; the scarf is fixed pastel stripes

# FORBIDDEN
forbiddenAnatomy:
  - shell, armor (chameleons have SOFT skin)
  - feathers
  - fur
  - wings

forbiddenObjects:
  - mirror (would resolve the identity question too easily)
  - notebook
  - flashlight
  - any "anchor" object except the scarf

forbiddenTone:
  - camouflage philosophy ("she hides to survive")
  - "the old you stays inside" speeches
  - wise-mentor tone
  - any conclusion that resolves the change-fear with a sentence

# VISUAL
visualCameraLanguage:
  - colorful environments OK
  - close on color-patches
  - eyes drawn separately rotating
  - the scarf always visible regardless of camouflage
  - never plain backgrounds (her colors need something to react to)
```

---

# 4. דּוּדִי / Dolphin Shahkan — FOCUS_LEARNING

```yaml
companionId: dolphin_shahkan
canonicalName: הדולפין דּוּדִי
nameClean: דּוּדִי
gender: male
species: דולפין
speciesEnglish: dolphin
category: FOCUS_LEARNING

coreMechanic: |
  Cannot stay still — movement IS his thinking. Uses sonar to "see" through sound.
  His splash-crown glows when he has a real idea. The crown is his focus signal.

emotionalFunction: |
  Validates a scattered mind as a valid mind. Learning through movement,
  play, sonar, and sudden inspiration — not stillness.

# SIGNATURE
signatureSound: |
  "טיק-טיק" (sonar pings) / "שלאפ!" (landing after a jump)
signatureObject: כתר התזה (splash crown on his head — glows on insight)
signatureMicroAction: |
  Jumps, lands sideways with "שלאפ!"
  Crown lights up when he has a thought.
  Counts three waves in a whisper before swimming: "אחד, שניים, שלושה."
repeatablePhrase: "טיק-טיק" or "אחד, שניים, שלושה"

# BEHAVIOR
overloadBehavior: |
  Swims in faster and faster circles.
  Sonar pings overlap into noise.
  Crown sputters splashes everywhere.
  Tries to outperform the feeling. NEVER stops moving.

regulationBehavior: |
  Forced stillness (trapped by something).
  Sonar quiets.
  Crown calms to a low glow.
  Single short clear sentence.

humorMode: |
  Speed comedy. Answers before the question is finished.
  Sonar returns mistakes: "I heard a cake!" "That's a rock."
  Crown explodes splashes at the wrong moment.
  NEVER slow-burn or pause-based humor.

# VOCABULARY
bodyVocabulary:
  - סנפיר / סנפירים (fin/s)
  - כתר התזה (splash crown)
  - סונאר (sonar)
  - הד / הדים (echo)
  - קופץ (jumping)
  - שוחה מהר (swimming fast)
  - בועות (bubbles)

allowedTextures: smooth-wet, splash-spray, sleek-skin
allowedColors: grey-blue default; crown is white-foam with rainbow glints

# FORBIDDEN
forbiddenAnatomy:
  - legs or feet (he has fins and tail)
  - fur
  - hands
  - wings

forbiddenObjects:
  - books (he can't hold them well; but a tiny book in flipper is OK)
  - shells / armor
  - clothes / hats

forbiddenTone:
  - "sit still" or "concentrate" framing
  - ADHD medicalization
  - lecturing about focus
  - "calm down" messages
  - any adult-frustration projection

# VISUAL
visualCameraLanguage:
  - underwater + above-water both work
  - motion blur on jumps
  - sonar visualized as soft circles in water
  - crown highlighted in moments of insight
  - never static / still-life framing
```

---

# 5. צְבִי / Fawn Tzvi — SENSITIVITY_OVERWHELM

```yaml
companionId: fawn_tzvi
canonicalName: העופר צבי
nameClean: צְבִי
gender: male
species: עופר
speciesEnglish: fawn
category: SENSITIVITY_OVERWHELM

coreMechanic: |
  His ears rotate independently and catch every sound (even an ant walking).
  A flower behind his ear is a mood-barometer — wilts when sad, blooms when calm.
  His legs FREEZE when overwhelmed (no flight, just lock).

emotionalFunction: |
  Validates sensitivity as a real sensory experience (not "drama").
  Models that sensitivity has both costs AND gifts — and the child can learn
  to modulate the dial.

# SIGNATURE
signatureSound: |
  "רגע..." (Quiet pause when he hears something) / "טופף, טופף" (two soft hoof taps)
signatureObject: פרח מאחורי האוזן (small flower tucked behind one ear)
signatureMicroAction: |
  Two soft hoof-taps on the ground, then listens to the silence.
  Flower wilts/blooms in response to the moment (not always to him directly).
repeatablePhrase: "טופף... טופף..." or "שמעת?"

# BEHAVIOR
overloadBehavior: |
  Full FREEZE. Legs lock to the ground.
  Ears flatten sideways.
  Eyes wide.
  Flower wilts visibly.
  He does NOT run. He stops.

regulationBehavior: |
  Two hoof-taps signal he's coming back.
  Ears slowly rotate forward.
  Flower lifts.
  One short clear observation about the environment.

humorMode: |
  Over-sensitivity comedy. Hears things others don't.
  "Did you hear that?" "Hear WHAT?" "...the rock sighed."
  Long legs tangle when he's startled.
  The flower reacts BEFORE he does (gives him away).
  NEVER mockery of sensitivity.

# VOCABULARY
bodyVocabulary:
  - אוזניים (ears)
  - פרסה / פרסות (hoof/s)
  - רגליים ארוכות (long legs)
  - פרח (flower)
  - מקשיב (listening)
  - קופא (freezing)
  - מנדנד זנב (tail-twitch)

allowedTextures: soft-fur with light spots, velvet-petal, dew-on-grass
allowedColors: light tan with cream spots; flower is soft pastel

# FORBIDDEN
forbiddenAnatomy:
  - shell, armor
  - hands or human arms
  - feathers
  - antlers (he's a FAWN, not an adult deer)

forbiddenObjects:
  - notebook
  - flashlight
  - hat / clothing
  - drum (loud objects he wouldn't have)

forbiddenTone:
  - "toughen up" messaging
  - exposure therapy framing
  - comparing him to "normal" kids
  - "stop being so sensitive" lines
  - making the freeze look like weakness

# VISUAL
visualCameraLanguage:
  - dawn or twilight ambient
  - close on the flower
  - ears in different positions per frame (mood indicator)
  - meadow / forest-edge environments
  - never harsh artificial light
```

---

# 6. בּוֹלִי / Bolly the Armadillo — MEDICAL_PROCEDURE (v2)

> **Status:** v1 draft — based on existing DNA from chat development. Pending final v2 visual lock.

```yaml
companionId: bolly_armadillo
canonicalName: בּוֹלִי
nameClean: בּוֹלִי
gender: male
species: ארמדיל
speciesEnglish: armadillo
category: MEDICAL_PROCEDURE

coreMechanic: |
  Folds into a perfect ball when overwhelmed. Outside is hard shell plates.
  Inside is warm pink belly. Reopens piece by piece (NOT all at once)
  when ready. The opening is the regulation — not the closing.

emotionalFunction: |
  Models that protection isn't pretending nothing hurts — it's having a
  trusted way to close, AND a trusted way to reopen.
  The child rehearses: "I can be soft inside even when something hard is happening."

# SIGNATURE
signatureSound: "טוּמְפּ" (the heavy sound he makes when he lands as a ball)
signatureObject: מדבקה צבעונית קטנה (small colorful sticker on his shell — a residue from a previous brave moment)
signatureMicroAction: |
  Opens ONE shell plate slowly, peeks one eye, closes it again.
  May open another, or may not — child-led pacing.
repeatablePhrase: "בפנים היה חם" (the warm-inside thought) or "טוּמְפּ"

# BEHAVIOR
overloadBehavior: |
  Fast tight fold to a perfect ball.
  Rolls slightly to the side, settles into a fabric crease or fabric corner.
  Heavy. Closed. Still. Does not respond to commands to open.
  The sticker is the only visible non-shell thing.

regulationBehavior: |
  One plate opens. Pause.
  Eye visible. Pause.
  Sometimes a second plate. Pause.
  Eventually: belly visible. Warm. Pink. Vulnerable.
  Touchable only AFTER he's chosen to open.

humorMode: |
  Physical: rolls slightly crooked, gets stuck in a corner, knocks something
  gently, the sticker wrinkles. NEVER witty. NEVER bravery-comedy.
  His weight is always slightly funny — he's heavier than he looks.

# VOCABULARY
bodyVocabulary:
  - שריון / פיסות שריון (shell / shell plates)
  - בטן ורודה (pink belly)
  - מתקפל / כדור (folds / ball)
  - כבד (heavy)
  - מדבקה (sticker)
  - אוזניים קטנות (small ears)
  - עין שחורה קטנה (small black eye)

allowedTextures: hard-bone shell, soft-warm belly, sticker-paper (slightly textured)
allowedColors: earth-brown / sandy shell; pink belly; sticker any color (one color per story)

# FORBIDDEN
forbiddenAnatomy:
  - feathers (he's NOT a bird — ראינו דליפה של נוצות, אסור)
  - fur covering shell (the plates are visible)
  - shell-as-decoration (it MUST function — open/close)
  - hooves
  - wings

forbiddenObjects:
  - flashlight (no role)
  - notebook (he can't hold one)
  - sword / shield (his shell IS his shield)
  - stars (not his world)
  - medical equipment as friendly props (it stays as threat-context only)

forbiddenTone:
  - bravery speeches ("הוא אמיץ" — אסור)
  - medical explanation language ("הרופא לא יזיק לך" — אסור)
  - inspirational quotes ("גם בפנים יש כוח" — אסור)
  - any rationalizing of medical procedures
  - "doctor will not hurt you" framing

# VISUAL
visualCameraLanguage:
  - low angle (he's small and round, on the ground)
  - close-up on plate-opening
  - belly-reveal shots are the emotional peaks
  - sticker visible in most frames
  - never bird's-eye (loses the weight/grounding)
  - medical contexts present BUT softened — never sterile-white-room

# DIRECTION ROLES (NEW — per ChatGPT critique)
directionRoles:
  bedtime:
    role: comfort ritual / protective closing before sleep
    typicalMoment: child touches belly, plate stays open
    dangerLevel: low
  adventure:
    role: portable safety — child knows Bolly will close if needed
    typicalMoment: discovery of sticker meaning, OR new sticker awarded
    dangerLevel: medium
  fantasy:
    role: world-rule carrier — the shell is the thing that the world tries to crack
    typicalMoment: protective sacrifice (Bolly closes around child)
    dangerLevel: symbolic (medical procedure as fantasy threat)

# FAILURE MODES (when overused/misused)
failureWhenOverused:
  - "Bolly becomes a passive lump" (forgets the OPEN behavior)
  - "Bolly becomes a brave warrior" (loses softness)
  - "Bolly becomes a wise mentor" (delivers lessons)
  - "Bolly becomes generic armadillo" (no טוּמְפּ, no sticker, no opening pattern)

# MINIMUM PRESENCE
minimumPresence:
  bedtime: 70% of pages (7 of 10)
  adventure: 60% of pages (9 of 15)
  fantasy: 60% of pages (12 of 20)
  pattern: NEVER more than 2 consecutive pages without Bolly.
```

---

# 7-36. Pending Companions (Stubs)

The following companions have **only basic fields** today (id, name, tagline, visual). They need full bible cards before production.

**Priority order for filling:**

## Tier 1 (high-volume use — fill first)
- `seahorse_yam` — MEDICAL_PROCEDURE (already has solid weak-form data in code)
- `fox_uri` — NIGHT_FEAR
- `dragon_dini` — NEW_SIBLING
- `owl_chacham` — FOCUS_LEARNING
- `starfish_kokhavi` — GENERAL_FEARS

## Tier 2 (medium-volume)
- `hawk_had`, `puppy_neeman`, `firefly_namit`, `butterfly_zohar`
- `mole_sheket`, `bunny_ometz`, `snail_sheli`, `turtle_beiti`
- `pelican_kis`, `bear_cub_gahal`, `squirrel_navad`, `lion_shaket`
- `panda_anat`, `bee_ima`, `mongoose_zariz`

## Tier 3 (low-volume — can wait)
- `footstep_giant`, `song_whale`, `ant_harutza`, `bear_mati`
- `hedgehog_rachi`, `captain_navat`, `salamander_lahav`, `kitten_mishi`
- `gecko_rifa`, `parrot_tzivon`, `wolf_pup_siyar`

## Pending v2 replacements
See `docs/COMPANIONS_v2_proposal.md` — 9 companions will be REPLACED with new designs (Anana, Fei, Etud, Taigu, Kochav, Bolly, Ashi, Kisa, Keter). When v2 lands, write bibles for the new ones — don't bother with the deprecated ones.

---

## Filling Process for Pending Companions

Each bible card requires:
1. **Read** the existing entry in `briefs/companion-deep-profiles.mjs`
2. **Translate** the deep-profile fields (copingStrategy, arcShape, collapsePattern) into bible format (coreMechanic, overloadBehavior, regulationBehavior)
3. **Identify** the signature trio (sound + object + microAction)
4. **List** forbidden anatomy/objects/tone based on what we've seen leak in production
5. **Define** visualCameraLanguage based on habitat + size + species

**Source of truth:** the deep profiles for habitat/personality/abilities. The bible **derives** from those — it doesn't replace them.

---

# QA: Bible Compliance Tests

For each story generated, the QA reviewer runs:

```
□ companionId.signatureSound appears at least once
□ companionId.signatureObject is mentioned at least twice
□ companionId.signatureMicroAction is described at least once
□ companionId.repeatablePhrase appears at least twice
□ NONE of companionId.forbiddenAnatomy appears
□ NONE of companionId.forbiddenObjects appears
□ NO sentence matches companionId.forbiddenTone patterns
□ Companion Swap Test: replace the name + species with a generic placeholder.
   Does the story still work? If yes — FAIL.
```

These are BLOCKING — story does not ship without all checkmarks.

---

*Sister documents: `STORY_ENGINE_v1.md`, `PSYCH_ENGINE_v1.md`*
