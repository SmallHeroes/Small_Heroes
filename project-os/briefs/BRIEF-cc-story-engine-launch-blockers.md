# Story-engine launch-blocker briefs (from Codex broad audit, feat/chunked-generation @ 8cf216e2, 2026-07-12)

Codex verdict: PASS WITH REQUIRED CHANGES — not sellable-MVP (with audio + gender-correct Hebrew) until these 3. Route each to Claude Code (small, targeted — NOT one giant refactor). Codex re-gates each. Owner picks the forks.

---

## BRIEF 1 → Claude Code — Hebrew gender-marker gate (\b bug)

```
Task title: Fix the Hebrew gender-marker gate (V8 \b fails after Hebrew script) + direct tests
Why now: Codex audit — female/male marker regexes use \b (story-bank-personalization.ts:51,72), but the file itself notes V8 \b fails after Hebrew script (:142). Verified in Node: /\bהיא\b/u.test('היא מחזיקה')===false. So WRONG-GENDER Hebrew passes the PRE-SPEND personalization gate (:271). The existing gate test only passes because it checks a stale name (מיכל), not because markers work (story-bank-personalization-gate.spec.ts:17).
MVP category: launch blocker (personalization correctness — Hebrew children's books).
Assigned agent: Claude Code. Small targeted fix + tests. Codex re-gate.
Required:
  1. Replace the \b marker regexes with the SAME custom Hebrew-boundary approach already used for slash forms in this file (do NOT rely on \b for Hebrew anywhere).
  2. Normalize Hebrew gender inputs (נקבה/זכר) consistently — currently only English-ish is normalized (:122), while name-personalization has an inconsistent local Hebrew-female regex (loader:278).
  3. Direct tests, NO stale-name denylist crutch: boy story with "היא מחזיקה" → FAIL; girl story with "הוא מחזיק" → FAIL; נקבה/זכר normalize or are explicitly rejected; other/unknown gender behavior made explicit.
Allowed: lib/story-bank-personalization.ts, backend/providers/story-bank-loader.ts (Hebrew gender normalization consistency); + tests.
Forbidden: broad loadStoryFromBank refactor; render/visual-contract; payment.
Expected output: markers use a Hebrew boundary; Hebrew gender inputs normalized; direct marker tests prove fail-closed; npm run check green; pushed; Codex re-gate.
Definition of done: wrong-gender Hebrew FAILS the gate proven by DIRECT marker tests (not via a stale name); check green.
QA required: yes. Codex review required: YES. Owner approval: Guy after Codex PASS.
```

---

## BRIEF 2 → Claude Code — Narration/TTS seam merge (GATED on the audio-in-MVP decision)

```
Task title: Bring the per-page TTS fix (niqqud pass + voice_settings) onto feat/chunked-generation + re-gate
Why now: Codex audit — the fix f314e5d8 ("fix(narration): wire per-page niqqud + effective voice_settings") exists on fix/narration-accuracy but NOT on feat/chunked-generation. On the active branch generatePageAudio does NOT apply applyTtsAmbiguityNiqqudPass and does NOT pass voice_settings (audio.ts:209,222,231) → Hebrew homographs misread in per-page MP3 + mom/dad/fairy settings ignored. We shipped listen mode + a "השמע את הספר" button, so audio quality is customer-facing.
MVP category: launch blocker IF audio is in the sellable MVP (Guy decision) — else deferred.
Assigned agent: Claude Code. Cherry-pick/port f314e5d8's seam onto feat. Codex re-gate audio.ts + tts-ambiguity-niqqud.ts + narration tests only.
Required:
  1. Bring f314e5d8's change onto feat/chunked-generation: generatePageAudio applies the niqqud pass to narrationText + passes effective voice_settings (mom/dad/fairy from voices.ts).
  2. Confirm it uses the SELECTIVE partial-niqqud pass (TTS 0a proved selective = safe / 0-wrong; FULL niqqud HARMS — do NOT switch to full).
  3. Tests: per-page audio applies the niqqud pass + uses the voice's settings.
  4. NOTE this is the INTERIM seam fix; the Phase 1 selective-niqqud+alias system (from TTS 0a/0b) generalizes it later — do NOT build Phase 1 here.
Allowed: backend/providers/audio.ts, lib/story-gen-v2/tts-ambiguity-niqqud.ts (only if needed); + narration tests.
Forbidden: the Phase 1 redesign; other narration architecture; render.
Expected output: niqqud + voice_settings wired on the active branch; tests; check green; pushed; Codex re-gate (narration seam only).
Definition of done: per-page MP3 applies selective niqqud + the voice's settings; tests; check green.
QA required: yes. Codex review required: YES. Owner approval: Guy after the audio-in-MVP decision + Codex PASS.
```

---

## BRIEF 3 → Claude Code — Live LLM story-correction policy on the paid path

```
Task title: Constrain live LLM story-correction on paid v3-approved generation (disable free rewrite OR strict guardrails)
Why now: Codex audit — live LLM correction (gender swap + name personalization) on PAID v3-approved generation validates only page-COUNT, not meaning/diff/imageDirection (story-bank-loader.ts:734,883,294 warning-only), runs non-deterministic (temp 0.1/0.45), so it can (a) change plot/tone / remove personalization / desync text↔images while "passing"; (b) drift across retry under the same atomic-receipt operationKey → ReceiptPayloadMismatchError strands generation (text-finalization.ts:168; atomic-operation.ts:54,190).
MVP category: launch blocker (text↔image integrity + reliability).
Assigned agent: Claude Code. Codex re-gate.
Fork (Guy picks; Cowork lean = B):
  (A) STRICT GUARDRAILS on the live path: diff budget, required name counts (fail-CLOSED not warning), no page loss, no template markers, no imageDirection loss, gender re-check with the FIXED Hebrew boundary (Brief 1), no-new-entities/semantic check; + persist the exact LLM artifact BEFORE the receipt-fenced mutation so retry is deterministic (no payload mismatch).
  (B) DISABLE live LLM rewrite for paid v3-approved; do name/gender personalization via a DETERMINISTIC validated patch (substitution + the strict checks above), no free-form LLM rewrite in paid generation.
Cowork lean: B — v3-approved bank stories are already authored/approved; a free live LLM rewrite on the PAID path is the wrong risk. Deterministic substitution + strict validation keeps personalization without the desync/drift/strand risk.
Allowed: backend/providers/story-bank-loader.ts (correction path), lib/generation-pipeline/text-finalization.ts (determinism / artifact persistence); + tests.
Forbidden: broad loader refactor; offline authoring tooling (post-MVP); render; payment.
Expected output: live paid rewrite constrained per the chosen fork; deterministic replay (no payload mismatch on retry); tests (wrong page count → fail; name removed → fail; meaning changed beyond diff budget → fail; retry determinism); check green; pushed; Codex re-gate.
Definition of done: paid v3-approved generation cannot ship a text↔image-desynced / wrong-personalization book, and retry is deterministic; tests; check green.
QA required: yes. Codex review required: YES. Owner approval: Guy picks the fork + after Codex PASS.
```

---

## Should-fix-if-fast (not full briefs — fold into Brief 1/2 or a cleanup pass)
- Status route derives page total from direction/storyLength, not frozen `Order.expectedPageCount` (status/route.ts:13,181) — wrong progress for noncanonical stories. Canonical launch slots OK.
- Escape `childName` (regex metachars) in the post-name-personalization count (story-bank-loader.ts:290).

## Post-MVP (do NOT touch pre-launch)
- Broad `loadStoryFromBank` refactor (too many responsibilities).
- Offline story preflight + deterministic signed story artifacts (the real fix for Brief 3's class).
- Legacy dynamic story-generator cleanup.
