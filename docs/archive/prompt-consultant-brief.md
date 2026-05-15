# Brief: Small Heroes Story Generator Prompt — Consultant Request

**Status**: We need a fresh perspective on a Hebrew children's story generator prompt that we've iterated 3 times without reaching production quality. This brief gives you everything you need to propose a better version.

---

## Part 1: What is Small Heroes?

Small Heroes is an AI-powered platform that produces **personalized illustrated children's storybooks in Hebrew**, with the child as the protagonist. Each book is co-starring a "companion" — a small animal/creature with a specific psychological profile that mirrors a real childhood challenge (anger, night fear, separation anxiety, homesickness, sensitivity overwhelm, etc.).

**The reader**: Hebrew-speaking parents reading aloud to children aged 3-9.
**The product promise**: Stories that build emotional resilience through metaphor — not lecture, not therapy-talk, not "lessons." A real children's author + psychologist would write them.

**Critical**: The reader is an Israeli parent at bedtime. The prose must flow without ONE word that makes them pause to figure out what it means.

---

## Part 2: The Three Directions (each is a different product)

Every companion gets 3 stories — different lengths, different emotional contracts:

| Direction | Pages | Age | Energy | Ending Type | Words/page |
|---|---|---|---|---|---|
| **bedtime** | 10 | 3-4 | Slow, calm, intimate | RESOLUTION — warmth, touch, sleepy | 15-35 |
| **adventure** | 15 | 5-6 | Movement, discovery | RESIDUE — something lingers, companion slightly apart | 25-55 |
| **fantasy** | 20 | 7-9 | Imagination, world-rules | DISTANCE — magic stays unresolved, cool, open | 35-70 |

These three endings are the **product signature**. Most LLMs default to RESOLUTION ("everyone is warm together"). We must actively resist that for adventure/fantasy. The "honest asymmetry" — child calmer but companion still slightly tense, world doesn't snap back to normal — is what distinguishes our books from formulaic ones.

**Golden rule for length**: If a parent reads a page aloud and doesn't pause once for natural breath → the page is too long. 2-3 breath-pauses per page = right.

---

## Part 3: The Companion Architecture (uniqueness driver)

Each of 36 companions has a **deep profile** with these fields (already exists, prompt should USE these verbatim):

```js
{
  nameClean: 'בּוּבּוּ',                // companion's name (used 8+ times)
  species: 'ינשוף',                    // species
  personality: '...',                  // a paragraph of personality
  visualDescription: 'A small wise owl with round amber eyes...',
  speechPattern: 'משפטים ארוכים עם סוגריים. אומר "בְּעֶצֶם", "יָדוּעַ כִּי"...',
  humorType: 'קומדיה של ידע-יתר. מצטט עובדה מוזרה ברגע הלא נכון...',
  bodyLanguage: '...',                 // how emotion shows physically
  stressResponse: '...',               // signature meltdown
  comfortRitual: '...',                // self-soothing gesture
  copingStrategy: 'OVER-EXPLAIN (Verbal Armor) — when a question approaches that he can\'t answer, Chacham doesn\'t pause — he TALKS...',
  collapsePattern: 'A QUESTION THAT WON\'T BEND — the child asks something simple, and his explanations don\'t fit...',
  arcShape: 'Start in confident-explainer mode → child arrives with question → ...',
  quietPagePosition: 12,
  category: 'KNOWLEDGE_LEARNING',      // psychological category
  internalRules: [
    'תמיד מתקן עובדה לא מדויקת',
    'אסור להשתמש במילים "ביטחון עצמי" — המטאפורה היא הסיפור',
    'ADVENTURE: בסוף, ספר אחד נשאר פתוח על שולחן או סלע',
    'FANTASY: עולם של שאלות שיש להן צבע. השאלות הלא-נודעות הן הצבע הכי בהיר.',
  ],
  psychologicalContext: {
    meaning: 'Young children often build identity around "being smart"...',
    coreNeed: 'permission to say "I don\'t know" without losing identity',
    avoid: ['shaming the lecturing', 'mocking the over-explanation'],
    resolution: '"knowing is good, and not-knowing is also a real way to be"',
  }
}
```

**Key insight**: The `internalRules` array contains the per-companion FANTASY world-rule. The prompt must USE this — not invent generic fantasy rules ("sky goes sideways").

---

## Part 4: Non-Negotiable Constraints

### 4.1 — Page count is a contract
- bedtime = exactly 10 pages
- adventure = exactly 15 pages
- fantasy = exactly 20 pages
- Each page MUST have: Hebrew text + `imageDirection:` line in English
- Pricing depends on this. Wrong page count = product failure.

### 4.2 — Hebrew language quality (CRITICAL — this is our hardest problem)

**The bar**: An Israeli parent reads at 22:00. **Not one word may make them stop to think.**

**Forbidden patterns** (the model keeps making these):
- Missing את before direct objects: "שָׁמַעְתִּי זֶה" ❌ → "שָׁמַעְתִּי אֶת זֶה" ✅
- High-register verbs not for kids: מַסִּיעַ, מְשַׁחֵל, מַעֲגֵן, מִשְׁתַּמֵּט, מַזְדַּקֵּף, מַרְעִים קוֹל, מְסַגֵּר, אֲזַי
- Transliterated foreign words: "קוויל" (quill) ❌ → "נוֹצָה לִכְתִיבָה" ✅
- Invented Hebrew compounds: "קפלולי", "טללון", "רלונטי"
- Wrong-word usage: "בְּעֶדֶן" (=Eden!) used instead of "בְּעֲדִינוּת"
- Academic register for child stories: "לְמַעֲשֶׂה, יָדוּעַ כִּי..."
- English-translated structures: "אֵין גָּבוֹהַ מַסְפִּיק", "שׁוֹמֵר בַּקָּרוֹב"

### 4.3 — Fingerprint blacklist (AI-prose tell-tales)

After analyzing 40+ stories from a previous prompt, these phrases appeared so often they became a recognizable signature of AI generation:

- "מַרְגִּישׁ אֶת [tactile noun]" as full sentence
- "כְּמוֹ לְחִישָׁה" / "לְחִישָׁה רַכָּה" as metaphor
- "הָעוֹר מִצְטַמֵּר", "הַחֲסַפְסוּת", "מְחֻסְפָּס"
- "רַעַד קָטָן" / "רַעַד דַּק"
- "הַדְּמָמָה" / "הַשֶּׁקֶט מִתְפַּשֵּׁט"
- "הָאֲוִיר מִתְמַלֵּא" / "הָאֲוִיר רוֹעֵד" / "הָאֲוִיר נוֹשֵׁף"
- "כְּמוֹ גַּל" / "כְּמוֹ נְשִׁימָה" as metaphor

**These appeared most heavily on "quiet pages"** — the model interpreted "slow down" as "stack sensory anchors." The fix must redefine quiet pages.

### 4.4 — The "quiet page" rule (1 page per story)

Each story has ONE "quiet page" (page 7 for bedtime, 11 for adventure, 13-15 for fantasy). This page is **action-free, sensory-free, dialogue-free** — except ONE small physical action. Maximum 12 words. The illustration carries everything else.

**Example of correct quiet page**: "דִּינִי שׁוֹכֵב עַל הַצַּד. הַסַּשׁ נָח לְיַד הָרֶגֶל."

The model's instinct will be to FILL this page with tactile description. **Resist.**

### 4.5 — Plot depth scales with direction

- **Bedtime (10p)**: ONE scene, ONE emotional arc, ONE setting. Less is more.
- **Adventure (15p)**: 2+ locations, 1 main obstacle + 1-2 minor obstacles, physical movement throughout.
- **Fantasy (20p)**: 3+ encounters with the world-rule, 2+ locations, secondary character or mystery-object, 2 distinct obstacles before climax.

Fantasy ≠ bedtime stretched to 20 pages. If you could compress it to 10p without losing content, it's not a real fantasy story.

### 4.6 — The "heart line" (one per story, mid-story)

In pages 5-6 (bedtime) or 7-9 (adv/fantasy), the companion does **ONE quietly heartbreaking action** — not dialogue. A wing that reaches and pulls back. A tongue that almost grabs something then doesn't. A color flickering to a hue nobody asked about.

**Parents must feel it. Children must see it. Nobody explains it.**

### 4.7 — Emotional mistake (one per story)

The child must make ONE emotionally wrong choice in the rising-action pages — laughing at the wrong moment, ignoring the companion, saying something unkind. **The story doesn't punish or explain it.** It just happens. Like with real children.

### 4.8 — Uncomfortable truth (one per story)

ONE moment of genuine, unresolved emotional reality. Effort that doesn't quite work. Loneliness without an answer. The story moves on without "fixing" it.

### 4.9 — No emotional vocabulary

Forbidden words: הרגיש, פחד, אומץ, ביטחון, התמודד, "הבין ש...", "למד ש..."

Emotions must be SHOWN through body, action, object — never NAMED.

### 4.10 — imageDirection (every page, in English)

Every page MUST end with `imageDirection: [camera_angle]: [scene description in English]`. Used by Flux/Replicate for illustration generation. Must include: companion's state (color/posture/expression), child's position, specific objects from the text, lighting.

### 4.11 — Output format

```yaml
---
title: "..."
companionId: <id>
direction: <bedtime|adventure|fantasy>
category: <COMPANION_CATEGORY>
gender: male
pages: <10|15|20>
---

storyStyle: ...
metaphor: ...
stakes: ...
weirdMoment: ...
emotionalArc: ...
quietPage: <number>
heartLine: ...
emotionalMistake: ...
uncomfortableTruth: ...
endingType: <resolution|residue|distance>

--- Page 1 ---
[Hebrew with full nikud]

imageDirection: ...

[... continues for all N pages ...]

WORD_COUNT: [p1, p2, ..., pN] = TOTAL
```

---

## Part 5: What We Tried (3 iterations of v4)

### v4.0
- Added fingerprint blacklist → **worked, 95%+ reduction in fingerprint hits**
- Word count collapsed: stories came out 30-40% under target
- LLM scorer (6 dimensions) rated 78% PASS

### v4.1
- Added Pass 2 expansion (second API call for thin pages) → recovered word count
- Added per-direction word ranges
- Added "golden breath rule"

### v4.2
- Added per-direction plot depth requirements (fantasy needs 3+ events)
- Added 7 BAD/GOOD examples for grammar/diction

### v4.3 (final attempt before this brief)
- Added Pass 3 Hebrew polish (third API call to fix specific Hebrew errors)
- LLM scorer: 7/9 PASS at 8.5+ average
- **But**: dedicated Hebrew quality audit found 0/9 PASS (5 MAJOR_ISSUES, 4 REGENERATE)
- Mistakes the LLM kept making:
  - "מַסִּיעַ אוֹתוֹ" (drive him in a vehicle) instead of "מקרב"
  - "נְצָת-קְוִיל" (transliteration of "quill")
  - "בְּעֶדֶן" (in Eden) instead of "בְּעֲדִינוּת" (gently)
  - "ידוע כי, למעשה, אזי" — academic Hebrew that no parent uses
  - Text truncated mid-word

### Conclusion from 3 iterations

The model (gpt-5.3-chat-latest) **systematically over-elevates Hebrew register** when it tries to sound "literary." It produces sentences that are grammatically valid but unnatural for Hebrew children's books. The corrections we add to the prompt aren't enough — the model finds NEW high-register patterns each round.

**Hypotheses worth exploring** (we don't know which is right):
1. The prompt is too long (currently ~5,500 tokens) — model gets confused
2. The companion profiles inject English text (e.g. "OVER-EXPLAIN (Verbal Armor)") that bleeds into Hebrew output
3. We need a different model (gpt-4o, claude-3.5-sonnet) for Hebrew specifically
4. The prompt needs MORE concrete examples and FEWER abstract rules
5. The prompt needs to be written entirely in Hebrew, not Hebrew+English
6. We need a different generation approach (e.g., outline first → then prose, instead of prose in one shot)

---

## Part 6: What the New Prompt Must Achieve

A successful prompt produces stories where:

1. **Hebrew quality audit** (Layer 1 dedicated audit catching invented words, transliterations, missing את, wrong-word usage): 7+/9 PASS or MINOR_ISSUES
2. **LLM rubric scorer** (6 dimensions, threshold 8.5 avg + 8.0 min): 8+/9 PASS
3. **Fingerprint phrases**: 0 hits per story on the blacklist
4. **Page count**: 100% match exactly (10/15/20)
5. **Companion voice**: distinct per character — a parent can identify the companion in 2 sentences without seeing the name
6. **Emotional payoff**: at least 2 reviewers (out of 3) say "this would actually help my child" when reading it to a child

---

## Part 7: Concrete BAD vs GOOD examples from our experience

```hebrew
# Quiet page (page 7 of bedtime)

BAD (v3 output — fingerprint-heavy):
"{{childName}} מַנִּיחַ יָד עַל הָרִצְפָּה הַקָּרָה, מַרְגִּישׁ אֶת הַחֲסַפְסוּת הַדַּקָּה וְאֶת הַקֹּר הַחַלָּשׁ, נְשִׁימָה אִטִּית, וְהַדְּמָמָה מִתְפַּשֶּׁטֶת..."

GOOD (target):
"דִּינִי שׁוֹכֵב עַל הַצַּד. הַסַּשׁ נָח לְיַד הָרֶגֶל."

# Heart line (page 5-7)

BAD:
"דִּינִי מַרְגִּישׁ עָצוּב וְהַכְּנָפַיִם שֶׁלּוֹ רוֹעֲדוֹת."  (explains feeling)

GOOD:
"דִּינִי מֵרִים כָּנָף קְטַנָּה אֶל הָאֶפְרוֹחַ — וְעוֹצֵר בָּאֲוִיר. הוּא מַחֲזִיר אוֹתָהּ לַחָזֶה."  (shows action)

# Companion voice (Bubu the owl who over-explains)

BAD (academic register):
"לְמַעֲשֶׂה, יָדוּעַ כִּי כּוֹכָבִים הֵם כַּדּוּרֵי גַּז (וְגַם פְּלַזְמָה)..."

GOOD (his natural over-explainer voice without academic-Hebrew):
"בְּעֶצֶם, כּוֹכָבִים הֵם כַּדּוּרִים שֶׁל גַּז זוֹהֵר (וְגַם אוֹר, אֲבָל גַּם לֹא בְּדִיּוּק)..."

# Fantasy world rule

BAD (generic):
"הַשָּׁמַיִם הוֹלְכִים הַצִּדָּה..."   (used in 11 of 14 fantasy stories we generated!)

GOOD (per-companion, from owl_chacham's internalRules):
"שְׁאֵלוֹת נוֹפְלוֹת כְּעַלִּים. אֲדֻמּוֹת, כְּחֻלּוֹת, יְרֻקּוֹת. וְהַשְּׁאֵלוֹת הַבְּהִירוֹת הֵן אֵלֶּה שֶׁאֵין לָהֶן תְּשׁוּבָה."
```

---

## Part 8: Critical Questions for the Consultant

We genuinely don't know the answers — appreciate honest takes:

1. **Should the prompt be entirely in Hebrew, or Hebrew-with-English-technical-instructions?** Currently it's mixed. Does mixed cause register confusion?

2. **Should we generate in two stages** (outline → prose) instead of one shot? Would a 2-stage approach produce more native Hebrew?

3. **Is gpt-5.3-chat-latest the right model for Hebrew children's books?** Or should we try claude-sonnet-4 / gpt-4o / a Hebrew-specialized model?

4. **How many BAD/GOOD examples are too many in the prompt?** We added 7 — did this help or just make the prompt unwieldy?

5. **Is a "polish pass" (3rd API call to fix Hebrew errors) the right strategy** or are we papering over a fundamental generation issue?

6. **The companion profile contains English text** ("OVER-EXPLAIN (Verbal Armor)"). Should we translate that to Hebrew before injecting? Does English in the prompt cause the model to think in English?

7. **The "quiet page" rule** keeps getting violated despite many warnings. Should it be a separate prompt-step entirely (generate non-quiet pages first, then add quiet page as a constraint)?

---

## Part 9: What we'd love from you

A revised prompt (or prompt strategy) that:
- Produces Hebrew that feels written by an Israeli children's author, not translated
- Honors the 3 ending types and the structural constraints (page counts, word counts, quiet page)
- Uses the companion's deep profile to drive a UNIQUE story per companion
- Avoids the AI-prose fingerprints documented above
- Builds emotional resilience through metaphor — not lecture
- Doesn't break on edge cases (idea-heavy companions in short formats)

Feel free to challenge our assumptions. We've been deep in the weeds — if you think the whole approach is wrong, say so. We'd rather hear that than incremental fixes.

---

## Appendix: Files in the codebase you might want to look at

- `scripts/generate-v4-stories.mjs` — current generator (3-pass: generate → expand → polish)
- `scripts/score-stories.mjs` — 6-dimension LLM rubric scorer
- `scripts/audit-hebrew-quality.mjs` — Hebrew-quality audit (catches specific Hebrew errors)
- `briefs/companion-deep-profiles.mjs` — 36 companion profiles
- `story-bank/v4/` — current best attempt (9 calibration stories — passable scorer, failed audit)
- `audits-v4/_summary.md` — the audit report showing what's wrong with v4.2

If helpful, we can share any of these files directly.
