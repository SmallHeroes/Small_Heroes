# Prompt Rewrite Diagnosis — Why v3 Stories Fail

**Source**: `scripts/generate-v3-stories.mjs` (lines 119-650)
**Status**: 6,500-token prompt. Read line-by-line.
**Conclusion**: Every failure pattern in the 40 stories I reviewed traces directly to specific prompt instructions. The fixes are surgical — we keep what works (character voice, structure, ending rules) and fix the 6 sources of fingerprint pollution.

---

## The 6 Root Causes (and where they live in the prompt)

### 🔴 Root Cause 1: The Quiet-Page Sensory Trap

**Prompt instructions (lines 482-486, "ABSTRACTION BAN — WRITER LANGUAGE")**:

> BANNED PHRASES: "השקט נהיה כבד", "האוויר רעד"...
> Children feel:
> - A charging cable going tick
> - A hoof stopping above water
> - A flipper reaching and pulling back
> - **Fingers sinking into warm dirt** ← This IS the fingerprint pattern

**The prompt simultaneously**:
- Forbids abstract writer-prose ✓ (good)
- Recommends tactile substitutes that ARE the AI-fingerprint pattern ✗ (THIS is the bug)

**Why every quiet page fails**: The model is told to be quiet AND to swap abstractions for tactile sentences. So it writes: "מַרְגִּישׁ אֶת הַחֲסַפְסוּת הַדַּקָּה וְאֶת הַקּוֹר הַחַלָּשׁ" — exactly the example pattern.

**Fix**: Quiet pages must be ONE SHORT ACTION + SPACE, not tactile-inventory. Ban the "מַרְגִּישׁ אֶת..." structure on quiet pages explicitly.

---

### 🔴 Root Cause 2: Fantasy World-Rule Examples Are Themselves The Bug

**Prompt instructions (lines 354-359, "GOOD examples" for distance endings)**:

> - "צעיף על ענף. צבעים שלא שייכים לאף אחד."
> - **"השמיים עדיין הולכים לצד. הסש שקט על כתף."** ← Used as example
> - "הדלת סגורה. בפנים, אור שלא היה לפני."

**Result**: 11/14 fantasy stories use "השמיים הולכים לצד" because **the prompt's own example is exactly this phrase**. The LLM copies examples.

**Fix**: Replace generic example with **per-companion fantasy world-rule mapping**. Each companion's fantasy rule must derive from their psychology, not the generic sky-tilt.

---

### 🔴 Root Cause 3: Sensory Budget Contradicts Quiet Pages

**Prompt instructions**:
- Lines 488-505: "Each page gets 1-2 sensory anchors"
- Line 276: Quiet page = "TWO SENTENCES MAXIMUM... One sensation"

**The model resolves this contradiction** by stuffing sensory anchors into the quiet page (it's the easiest way to satisfy both rules). Hence: quiet pages are fingerprint-densest.

**Fix**: Explicit override — quiet pages have **0 sensory anchors**. The sensory budget rule applies to all OTHER pages.

---

### 🔴 Root Cause 4: Editorial Leakage From 6,500-Token Prompt

**Prompt structure**:
- 35 separate "if-not-rewrite" checks (lines 612-650)
- Multiple parentheticals like `(or remove entirely)`
- Meta-commentary inside body instructions

**Result**: The model occasionally outputs prompt-meta into the story body — `(או להסיר לגמרי)`, `לצמצם ל-1–2 עוגנים:`, `→` between sentence variants.

**Fix**:
- Trim prompt to ≤3,500 tokens
- Move all "rewrite if X" checks to a single COMPACT final block
- Remove parenthetical hedges and alternatives ("X or Y or remove")

---

### 🔴 Root Cause 5: Speech-Pattern Examples Become Fingerprint Phrases

**Prompt loads companion `speechPattern` + `humorType`** verbatim. These work well — characters DO sound distinct. BUT certain phrases like "כְּמוֹ לְחִישָׁה" (used in `sensoryPalette`) leak into prose as **descriptive language**, not character speech.

**Fix**: Separate `sensoryPalette` field into:
- **`characterSpeech`** (companion can SAY these)
- **`avoidInProse`** (LLM must NOT use these as descriptive metaphor)

This requires updates to `companion-deep-profiles.mjs` as well.

---

### 🔴 Root Cause 6: No Explicit Fingerprint Blacklist

The current prompt has a "forbidden words" section (lines 472-476) — but it only bans **emotion words** (פחד, אומץ, התמודד). The actual fingerprint phrases are NOT banned.

**Fix**: Add explicit blacklist section banning specific Hebrew phrases the editor identified:

```
FORBIDDEN PHRASES (the model trained on too many AI children's books — these reveal generation):
- "הַחֲסַפְסוּת" / "מְחֻסְפָּס" used as sensory descriptor
- "כְּמוֹ לְחִישָׁה" as metaphor (the companion can WHISPER, but prose cannot describe sounds as "like a whisper")
- "רַעַד קָטָן" / "רַעַד דַּק"
- "הָעוֹר מִצְטַמֵּר"
- "הַדּוּמִיָּה"
- "הַשֶּׁקֶט מִתְפַּשֵּׁט"
- "הָאֲוִיר מִתְמַלֵּא" / "הָאֲוִיר נוֹשֵׁף"
- "מַרְגִּישׁ אֶת [tactile noun]" as full sentence (banned in quiet pages, limited elsewhere)
- "כְּמוֹ גַּל" / "כְּמוֹ נְשִׁימָה" as metaphor
- "טַל" / "טִפּוֹת" as quiet-page anchor
```

---

## What NOT to Change

The following parts of v3 prompt work well — keep them:

✅ Character voice / speechPattern injection (lines 170-200)
✅ Coping philosophy + arcShape (lines 202-208) — drives unique arcs per companion
✅ THE RELATIONSHIP — Child ↔ Companion (lines 210-222) — bonding, not therapy
✅ Three ending types: resolution/residue/distance (lines 290-396) — premium differentiator
✅ Asymmetry enforcement (lines 363-371) — Small Heroes signature
✅ Anti-functional climax rule (line 288)
✅ Hard page count + WORD_COUNT line (lines 414-440)
✅ Forbidden emotional words (lines 472-476)
✅ Page-by-page structure (opening/rising/midpoint/climax/ending)

---

## Proposed New Prompt Structure (target: ≤3,500 tokens)

```
1. ROLE + TASK (200 tokens)
   - Israeli children's author identity
   - Hard page count contract

2. CHARACTER (800 tokens)
   - Companion identity, traits, abilities
   - speechPattern + humorType (keep verbatim)
   - characterSpeech vs avoidInProse (NEW split)
   - Coping + arcShape + sensoryPalette
   - Internal rules

3. STORY STRUCTURE (500 tokens)
   - Page ranges per direction (existing)
   - quietPage HARD position (existing)
   - Relationship arc (child helps companion)

4. WHAT MAKES THIS A SMALL HEROES STORY (400 tokens)
   - One heart moment (action, not dialog)
   - Emotional mistake mandatory
   - Uncomfortable truth mandatory
   - Three ending types (one paragraph each, not three pages)

5. FINGERPRINT BLACKLIST (400 tokens) ← NEW
   - Explicit forbidden Hebrew phrases
   - Per-page restrictions (especially quiet pages)
   - World-rule diversity per companion (replace generic example)

6. HEBREW LANGUAGE QUALITY (400 tokens)
   - Native voice (existing, condensed)
   - Forbidden emotion words (existing)
   - Nikud requirement

7. OUTPUT FORMAT (200 tokens)
   - Frontmatter shape
   - imageDirection rules

8. SELF-CHECK (400 tokens) ← CONDENSED
   - 12 checks max (not 35)
   - All "rewrite if X" → single bullet list
   - No parentheticals
```

---

## Expected Impact

Conservative estimate based on batch 1+2 patterns:

| Failure mode | v3 rate | v4 expected | Mechanism |
|---|---|---|---|
| Quiet-page fingerprint | ~95% | ~25% | Sensory budget = 0 on quiet pages |
| Side-sliding-sky fantasy | 78% | <15% | Per-companion world-rule |
| Editorial leakage | ~10% | <2% | Shorter prompt, no parentheticals |
| Companion voice break | ~5% | <5% | Keep what works |
| Below-bar overall | ~90% | ~30-40% | All of the above |

So after v4 prompt + regeneration, ~65-70% of stories should pass the 8.5/8.0 bar on first attempt. Remaining ~30% need a second pass with alt angle.

---

## Implementation Plan

1. **Write `generate-v4-stories.mjs`** (the new prompt as a separate script — keep v3 alongside as fallback)
2. **Add `worldRules` field to `companion-deep-profiles.mjs`** — per-companion fantasy world rule
3. **Add `avoidInProse` field to `companion-deep-profiles.mjs`** — split from sensoryPalette
4. **Test on 3 calibration companions** (chameleon_koko, owl_chacham, dragon_dini) — span weak/medium/strong
5. **If 3/3 pass scoring → mass-regenerate ~80-90 below-threshold stories**
6. **Re-score → iterate stragglers**
7. **Promote v3 → v3 (final)**

The world-rule field is the highest-leverage addition. Without it, fantasy stories will still converge on whatever single example we provide.

---

## Open Questions Before Writing

1. **World-rule per companion**: do you want me to draft 36 unique fantasy world-rules, or keep v4 prompt-only and add this in v5?
2. **Backward compatibility**: keep v3 generator alongside v4, or replace?
3. **Calibration set**: I propose chameleon_koko / owl_chacham / dragon_dini as the 3 tests. Approve?
