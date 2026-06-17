# 0071 (FINAL v2) · Claude → Cursor · Companion presence-contract + canon fixes (koko render = invalid proof)

**Status:** Codex diagnosed → Claude validated vs code+manifest → Codex redlined → Claude consolidated. Run under analysis: `outputs/style01-auditions/qa-console-chameleon_koko-fantasy-low-20260617-140414`. This is an ARCHITECTURE fix (presence contract) + a QA hole + canon cleanups. Do NOT patch koko per-slot. After the fix, re-run the EXACT same 5-page LOW as the gate. `npm run check` green before/after; route via Cursor (sync gap), explicit pathspecs.

## Root cause (validated, file:line)
On EVERY koko page the final prompt contradicts itself: the scene line says `companionPresence: present` but the ENTITY PRESENCE CONTRACT says `companionPresence: absent / NO companion creature / FORBIDDEN: companion creature, duplicate mascot, sidekick animal` (verified in manifest.json finalPrompt p1-5). Mechanism:
1. `lib/image-entity-presence.ts` `companionPresenceTokens()` has alias branches for ONLY fox_uri/dragon_dini/lion_shaket → **koko/panda/bunny lack them** → Kim's mentions (Kim/chameleon/קים/קִים/זיקית) unmatched → presence wrongly resolves **absent**. (niqqud mismatch קִים vs קים is part of it.)
2. `lib/style01-prompt-assembly.ts:~197` builds the contract from that wrong value; `:~351` injects `companionTextLock` ONLY when `companionPresence === 'present'` → Kim's identity lock dropped → model improvises (dragon/creature) and maps the "Kim changes colors" text onto the only locked identity (the child) → clone children.

Separately in the same run: `manifest.json "usedApprovedStage0Anchor": false` → raw-photo → **photoreal child**; the auto CHILD VISUAL LOCK literally says "noticeable marks on cheeks" (×2) → the **face marks**; `page-05-appearance-drift.json hardCount:0` on a 3-clone hard fail → **QA blind**.

## Fixes (general, ordered — Codex redlines folded in)

### [P0] A — Honor the explicit `companionPresence:` directive FIRST (strongest fix)
In the presence derivation (`derivePageEntityPresence` / `image-entity-presence.ts`), **parse a literal `companionPresence: present|absent|partial|offscreen` from the imageDirection/scene text and let it WIN immediately.** Only fall through to name/alias heuristics when no explicit token is present. This alone fixes the koko failure (the token was there and ignored) and is companion-agnostic. Apply the same explicit-first rule to `childPresence:` if present.

### [P0] B — Alias coverage + niqqud-strip (fallback hardening)
For the heuristic fallback, add alias branches for the 3 missing companions AND strip Hebrew niqqud from both tokens and searched text before matching:
- `chameleon_koko`: `kim`, `Kim`, `קים`, `קִים`, `chameleon`, `זיקית`
- `panda_anat`: `anat`, `ענת`, `עֲנָת`, `panda`, `פנדה`
- `bunny_ometz`: `buni`, `בוני`, `בּוּני`, `bunny`, `rabbit`, `ארנב`, `ארנבון`
Durable version: derive name/species aliases from the companion registry so no companion is ever silently unmatched again.

### [P0] C — Fail-closed guard
If the directive/text declares `companionPresence: present` (or explicitly names the companion) but the resolved contract comes out `absent`, **throw before render** with a clear error. Never emit an "absent + FORBIDDEN companion" contract for a page whose text includes the companion. (Catches this whole failure class for every companion, present + future.)

### [P0] D — Never forbid a named companion
The `FORBIDDEN: companion creature...` block must be tied to a CONFIRMED-absent contract, not the default — never emitted when the scene text names/describes the companion.

### [P0] E — Approved Stage0 illustrated anchor (kills photoreal)
Ensure the flow generates + uses the approved illustrated child anchor (`usedApprovedStage0Anchor` true for a real render); do NOT silently fall back to the raw photo. If none exists, fail-loud / surface in QA rather than render photoreal. Separately: review the child-visual-lock generator so incidental photo marks (freckles/shadows) aren't promoted into a permanent "marks on cheeks" face lock.

### [P1] F — Entity QA after render (close the blindness)
Add post-render HARD checks (all missed this run): exactly-one-protagonist (duplicate-child), companion-present-when-required, companion-identity = correct species, wrong-companion (dragon when chameleon expected). Hard fails that block PASS.

### [P0] G — Companion NAME consistency: keep slug, fix leaked NAME (Codex-corrected)
Canonical name = **קים (Kim)** (`lib/companions.ts:149` `name: 'הזיקית קִים'`). `chameleon_koko` = internal id/slug ONLY (filenames, matrix keys) — **KEEP it, do NOT rename the slug.**
- **DO NOT** change `lib/story-validators/validators/companionName.ts:75` `chameleon_koko: ['קוקו','כימי']` to `['קים']` — that list is the **forbidden-hallucination denylist** (it BLOCKS those wrong names). Keep `קוקו`/`כימי` forbidden. INSTEAD: add a unit test asserting `קים` is allowed and `קוקו`/`כימי` are BLOCKED for chameleon_koko. (Same for `companionSpeechViolation.ts` — leave as-is unless a test shows it mis-handles קים.)
- **[P0 child-facing]** the LIVE bank uses קים; just verify: scan the 3 live koko slots (v3-approved bedtime, v3-approved fantasy, v5 adventure) — title + prose — confirm only `קים`, no `קוקו`. (Live adventure already clean.)

### [P1] H — Quarantine/align the superseded v5 Koko files (fallback-leak risk)
`story-bank/v5-fixed-v2/chameleon_koko_bedtime.md` (title+prose `קוקו` + a SCARF: lines 39/41/62/65/71/74/77/79/81) and `chameleon_koko_fantasy.md` (scarf is the whole motif: title line 9 "בצעיף הצבעים", worldRule/metaphor, lines 168/181/196/214/311) carry the OLD canon (Koko name + scarf — Kim has NO scarf, she has satchel+orange-nose). These are superseded — live koko bed/fan route to v3-approved **when ENABLE_V3_APPROVED_BANK=true** — but a flag-off misconfig falls back to these. Action (Codex's call): **quarantine/mark non-production OR align to Kim/no-scarf canon.** Not blocking the render re-test, but must be resolved before launch.

### [P0] I — Fix the pink-dots canon conflict in MY v3 re-angle
`story-bank/v3-approved/chameleon_koko_fantasy.md` line 89 prose `"ואז לירוקה עם נקודות ורודות."` + line 95 imageDirection `"...then green with pink dots..."` violate Kim canon (`companions.ts:155`: "NOT patches, NOT pink spots") and are exactly the kind of phrasing that fragments/duplicates the character. Replace:
- line 89 → `ואז לירוקה-צהובה מבולבלת.`
- line 95 imageDir → `Kim tries to match the gate color, changing into green, yellow, then a muddled yellow-green, while her orange nose and mustard satchel remain unchanged. {{childName}} watches with nervous amusement. companionPresence: present. view: close 3-4.`
Then scan the whole file for any other pink/spots/patches on Kim → none should remain.

### [P1] J — Prompt unit tests (lock the contract)
Add tests on Kim pages 2 and 5 of koko·fantasy asserting the assembled prompt: (a) does NOT contain `NO companion` / `FORBIDDEN: companion creature`; (b) DOES contain the COMPANION identity lock block; (c) does NOT contain duplicate-child permission and DOES contain "EXACTLY ONE child protagonist".

## Validation gate (the re-test)
After A–E + G + I (F/H/J as capacity allows), re-run the EXACT render: koko·fantasy, same boy child, 5-page LOW (story p1-5), local qa-console, **with an approved illustrated Stage0 anchor**. PASS (eyeballed):
- Kim present p2-5, correct species (chameleon + mustard satchel + orange nose), NO dragon, NO morph, NO scarf, NO pink spots.
- NO clone/duplicate children (esp. p5).
- Child = watercolor storybook, NOT photoreal; no amplified face marks.
- Prompt p2/p5 has no `present`+`FORBIDDEN` contradiction; companion lock present.
- Any companion name shown reads **קים**, never **קוקו**.
Report as 0072 with the re-render + the new page-02 prompt (confirm contradiction gone).

## Do NOT
- Do NOT rename the `chameleon_koko` slug/filenames/matrix keys.
- Do NOT replace the `companionName.ts` forbidden-list with `['קים']` (would block the canonical name).
- Do NOT proceed to more slots / full 16-page render until this re-test passes.
