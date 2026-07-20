# BRIEF → Claude Code #03 — TTS Phase 0b (winning controls on real sentences, mom+dad)

**Status:** READY TO SEND · narration feature track · PARALLEL · small cost · then Guy listens → Codex locks Phase 1

## 0a results that decided this (data-backed, 208/212 marked, "both samples" rule)
- IPA inline + pron-dict-IPA = **DEAD** (0/18) → dropped.
- Full niqqud = **HARMS** (12 wrong) → dropped.
- Selective niqqud = safe (9/18 OK, **0 wrong**) · raw = strong baseline (12/18) but fails on homograph-in-context + some names · alias = moderate (8/18, names).
- Pauses: `[pause]` tags ≥ ellipsis hack. voice_settings on/off inconclusive (n=8).
- Hard cases nothing fixed: דוד, בוני, נועם → need manual dictionary lock + human verify.

```
Task title: TTS Phase 0b — winning controls on real sentences, mom + dad voices
Why now: 0a (fairy) decided the winners. IPA (inline + dict) is DEAD (0/18) → dropped. Full niqqud HARMS (12 wrong) → dropped. Winners = selective niqqud (0 wrong, safe) + alias (names) + raw baseline. 0a tested sentences only on raw/full/pauses — must now test the winners IN CONTEXT + on mom/dad.
Assigned agent: Claude Code (reuse the existing harness). Staging/local only, no prod.
Run: scripts/tts-preflight-phase0.ts --stage 0b --live --variants raw,niqqud-selective,pron-dict-alias
Must include: the REAL sentences (sent-medical, sent-bedtime, sent-homographs) — apply selective niqqud + alias to the risk words IN those sentences (the gap 0a left). Voices: mom + dad. 2 samples/cell, fixed seed, pause via [short pause]/[pause] tags (not ellipsis). Also carry the hard names (דוד, בוני, נועם) to see if selective niqqud/alias rescues them on mom/dad.
Output: MP3s + manifest + the embedded self-contained player (like 0a — Guy listens offline). Print billed chars.
Do not: re-run IPA or full-niqqud; touch prod/narration pipeline.
Definition of done: 0b player ready for Guy; billed-char note; committed.
Owner approval: Guy approves the (small) cost.
```

## Phase 1 signal (for Codex, after 0b)
Mechanism = selective-niqqud-only (never full) + alias dictionary for names/characters + NO IPA + pause tags (sparingly) + human-lock for hard cases (דוד/בוני/נועם) + validation. Dramatically smaller scope than the original (no IPA/CMU route).
