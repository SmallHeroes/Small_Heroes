# Phase 0 — Hebrew TTS feasibility harness (throwaway, staging/local ONLY)

Empirically probes how ElevenLabs **`eleven_v3`** (`language_code:'he'`) actually reads Hebrew, so the
real preflight (Phase 1) is designed on evidence. **It never touches prod:** no Supabase upload, no
order/DB writes, no narration-pipeline wiring. It only calls the ElevenLabs TTS API and writes MP3s +
a manifest + a self-contained HTML listening player to `outputs/tts-preflight/{runId}/`.

## What it answers (Guy's ear on the player)
- Does v3(he) respect **selective niqqud**? Does **whole-word niqqud** help or harm (vs selective)?
- Do **pronunciation dictionaries** (IPA rule vs alias rule) affect `he` reliably?
- Is **inline IPA** usable for `he` names, or too brittle?
- Do **`[short pause]` / `[pause]`** tags read more naturally than the prod ellipsis hack?
- Are **mom / dad / fairy** good enough in `he`, or is recasting needed?
- Does passing **`voice_settings`** materially improve quality (prod omits them today)?

## Run it

```bash
# DRY RUN (default) — builds the matrix, writes manifest.json + player.html, prints exact
# char/request cost. NO API calls, NO cost. Use this to review + approve before spending.
npx tsx --env-file=.env.local scripts/tts-preflight-phase0.ts --stage 0a

# LIVE — actually generates audio (spends ElevenLabs credits). Needs the staging key.
npx tsx --env-file=.env.local scripts/tts-preflight-phase0.ts --stage 0a --live
```

> If `npx` is flaky in your shell, run via node directly:
> `node node_modules/tsx/dist/cli.mjs scripts/tts-preflight-phase0.ts --stage 0a`

**Env:** the script reads `ELEVENLABS_API_KEY` (the **staging** key) from `.env.staging.local`, then
`.env.local`, then process env. Point `--env-file` at whichever holds the staging key. It also creates
ElevenLabs **pronunciation dictionaries** on that account (for the dict variants) — staging only.

### Stages (staged to keep Guy's listening tractable)
- **`--stage 0a`** — voice = **fairy** only, all applicable variants × all items × 2 samples, plus a tiny
  `voice_settings` WITH-vs-WITHOUT add-on. **212 clips / ~3,409 characters.** Find which controls v3 respects.
- **`--stage 0b`** — voices = **mom + dad**. Re-run only the **winning** controls from 0a and focus on the
  real sentences: `--stage 0b --live --variants raw,niqqud-full` (pick the winners). Full 0b (all variants) is
  408 clips / ~6,560 chars — the winners subset is much smaller.

Other flags: `--variants a,b,c` (restrict variants), `--voice-settings` (force the add-on), `--run-id <id>`.

## Record judgments
1. Open `outputs/tts-preflight/{runId}/player.html` in a browser.
   - Clips play from `./clips/` by relative path. If the browser blocks `file://` media, run
     `python -m http.server` **inside the run dir** and open `http://localhost:8000/player.html`.
2. For each cell: press ▶ (two samples per cell), pick **correct / wrong / unnatural / unclear**, add notes.
   Marks autosave to `localStorage`.
3. Click **⬇ Export judgments (JSON)** → downloads `judgments-{runId}.json` (the manifest with your
   `resultByHuman` + `notes` filled). Send that back — it feeds Codex to lock the Phase 1 spec.

## Manifest (per clip)
`{ clipId, itemId, category, voiceId, elevenlabsVoiceId, variant, voiceSettings, sampleIdx, seed,
inputText, expectedReading, gloss, usesContext, mp3Path, chars, error?, resultByHuman:"", notes:"" }`

## Methodology notes (for a valid A/B)
- **Fixed per-item seed:** sample 0 of every variant of an item uses the same seed, so variant differences
  are attributable to the *input*, not to v3 nondeterminism. Sample 1 shifts the seed (+100000) to expose
  variance. (If v3 ignores `seed`, the two samples are just independent draws — still informative.)
- **In-context sentences** additionally pass `previous_text` / `next_text` (marked `(+context)`).
- **`voice_settings`** off = matches prod (which omits them); the add-on runs `raw` + `niqqud-full` WITH
  settings on for a few items to quantify the gap.

## Design decisions (documented, not hidden)
- **Inline IPA (variant 5)** uses the ElevenLabs `<phoneme alphabet="ipa" ph="…">word</phoneme>` tag — the
  documented inline-phoneme mechanism. If v3 doesn't support it, the clip will read the tag literally (a
  clear "wrong" result) — that *is* the finding.
- **Alias respelling (brief variant 4)** is folded into the **pronunciation-dictionary alias rule**
  (`pron-dict-alias`, which substitutes the word with its vocalized form). A bare inline "alias respelling"
  for Hebrew converges on the niqqud already tested by variants 2/3, so an inline-alias variant would just
  duplicate `niqqud-full`. The distinct alias *mechanism* (a dictionary substitution) is what's tested.
- **Pronunciation-dictionary IPA rules** are historically model-restricted (v2-family). If `eleven_v3`
  rejects them, dictionary creation fails and every dict clip records that error — again, a finding.
- Linguistics (niqqud / IPA / vocalized forms) are **editable data** at the top of the script and are shown
  verbatim as `inputText` in the player, so any authoring error is visible while judging and easy to fix.

## Safety / scope
Standalone throwaway. No prod Supabase, no order/receipt/refund/readiness, no narration-pipeline change,
no `lib/tts-preflight/` package (that's Phase 1). Only ElevenLabs TTS calls + local file writes.
