# BRIEF (CC) — wire the niqqud coverage preflight into the production narration path

**⚠️ TARGET BRANCH: `feat/chunked-generation`** (the niqqud rules already landed here via `7093f890`, now in the consolidated target).
**Origin:** Codex step 6 — the contextual rules + tests shipped, and **Guy approved the vocalizations** (`סָפַר`/`סֵפֶר`, `שָׂם`/`שֵׁם`/`שָׁם`, `בְּקֶצֶב`/`הַקֶּצֶב`), BUT `criticalTtsNiqqudGaps()` / `checkTtsNiqqudCoverage()` (`lib/story-gen-v2/tts-ambiguity-niqqud.ts:~179`) has **no production caller** — the fail-closed coverage net is dead code.

## Fix — wire the preflight
- Call the coverage checker in the narration path — `buildPageNarrationTtsText` / `generatePageAudio` (`backend/providers/audio.ts:~204`), AFTER the niqqud pass, on the TTS text (not the display text).
- Behavior: **hard-block** on a `CRITICAL_AMBIGUOUS_LEMMAS` gap (the reliably-gateable set: `ספר`/`בקצב`/`הקצב`) — refuse to synthesize audio with a known-critical homograph left unniqqud; **soft-warn** (log + QA surface) on the non-critical set (`שם`, whose un-gateable `"שם."` answer is expected). Match the hard/soft split CC already curated.
- Keep the DISPLAY-strip path untouched (display stays unniqqud).

## Optional follow-up (flag, CC's own note)
- Girl-order `שמה` (put-fem `שָׂמָה` vs her-name `שְׁמָהּ`) is not covered — worth adding since we support girl personalization. Add a rule + Guy confirms the vocalization, OR flag for a later pass.

## Acceptance
- The preflight runs on the paid narration path; a critical unniqqud lemma **hard-blocks** audio synthesis (surfaced, not silent); `שם` soft-warns.
- Existing niqqud tests still pass; add a test that the wired path blocks a synthetic critical-gap page.
- `npm run check` green. Explicit pathspecs, commit on **`feat/chunked-generation`**, no push.
