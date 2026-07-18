# BRIEF (CC) — narration niqqud: fix homograph COVERAGE + add a fail-closed preflight

**Origin:** Codex render diagnosis. The wiring is CORRECT (selective niqqud → punctuation → `resolveVoiceSettings`; paid path calls it at `chunk-runner.ts:1764`; DISPLAY text stays unniqqud via `hebrew-text.stripNikud`). The failure is **coverage**: the rule list misses real homographs.
**Branch:** `feat/chunked-generation` (the render/narration path). **Deterministic — NO live LLM.**

## The bug
`lib/story-gen-v2/tts-ambiguity-niqqud.ts` has a 21-rule `RULES: {id, pattern, vocalized}[]` list. It does NOT cover:
- **`ספר` / `סופר`** family — the TTS reads `בר ספר בלחש` ("Bar counted quietly") wrong. Needs disambiguation: **count** (סָפַר / סוֹפֵר, context: numbers / בלחש / אחורה) vs **book** noun (סֵפֶר) vs **tell/barber** senses.
- **`שם`** — `שם עמד` / `שם נמצא` = **שָׁם** ("there"), vs שֵׁם ("name").
- **`בקצב` / `הקצב`** in a sound/rhythm context = **בְּקֶצֶב / הַקֶּצֶב** ("rhythm"), vs קַצָּב ("butcher").

## Fix
1. **Extend `RULES` with CONTEXTUAL rules** (mirror the existing `leaf_noun`/`nach_rest` lookahead pattern) for the families above. Use the same `(?<![֐-׿])…(?![֐-׿])` boundary + a context lookahead/lookbehind where the sense depends on neighbours (e.g. `ספר`/`סופר` + `בלחש|אחורה|עד|מספרים` ⇒ count; `שם` + `עמד|נמצא|היה|ישב` ⇒ שָׁם; `בקצב|הקצב` + rhythm/sound context ⇒ rhythm). **Guy confirms the exact vocalizations (native-Hebrew judge is Guy, not the model).**
2. **Audit the whole bank for other exposed homographs:** scan every story's per-page TTS text (via `buildPageNarrationTtsText`) for a maintained list of known-ambiguous lemmas that remain WITHOUT niqqud, and add rules for the real ones found. Do NOT over-niqqud unambiguous words.
3. **Fail-closed preflight (the safety net):** a maintained `KNOWN_AMBIGUOUS_LEMMAS` set. Before narration, if a lemma from that set appears in the TTS text with NO niqqud on it, **flag it** (log + surface in QA; escalate to a hard block only for a curated critical subset). This makes a future coverage gap visible instead of silently mispronounced.

## Files
- `lib/story-gen-v2/tts-ambiguity-niqqud.ts` — extend `RULES` + add the preflight/coverage checker.
- A new spec + a bank-wide test (below). Do NOT touch the display-strip path (`hebrew-text.stripNikud`) — display stays unniqqud.

## Acceptance / tests
- `applyTtsAmbiguityNiqqudToText('בר ספר בלחש')` → `ספר` vocalized as count (`סָפַר`); `שם עמד` → `שָׁם`; `בקצב` (rhythm) → `בְּקֶצֶב`.
- **Bank-wide automated test:** iterate all v3-approved stories' per-page TTS text → assert 0 known-ambiguous lemmas remain unniqqud (the preflight passes clean).
- Already-niqqud words untouched; unambiguous words untouched (no over-niqqud).
- `npm run check` green. Explicit pathspecs, commit on `feat/chunked-generation`, no push.

**Guy sign-off:** the exact niqqud choices for `ספר`/`שם`/`בקצב` etc. — Guy reads + confirms (Hebrew taste).
