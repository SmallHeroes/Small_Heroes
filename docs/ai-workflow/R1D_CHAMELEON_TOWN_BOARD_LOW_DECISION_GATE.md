# R1D Chameleon Town Board LOW — Decision Gate

**Date:** 2026-08-21

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Technical base:** pushed gender-inclusive Set Board commit `8075ec8369e1876deeae497dc5ce0ea2b425b756`

## 1. Proposed change

Mint one canonical Set Identity Board for `chameleon_koko_bedtime` / `set_town_night` / `soft_hand_drawn_storybook` through the existing v6 Set Board launcher at `gpt-image-2` LOW. The command performs one image generation, one content-addressed no-overwrite upload, and ordinary Vision QA. It writes an unapproved Registry entry and then stops for Guy's visual decision.

No production code, prompt, schema, model, quality, retry, approval, Wizard, page or book-render behavior changes in this milestone.

## 2. Why now?

The Chameleon candidate requires exactly two set identities. The Home Board is now QA-passed and product-approved. `set_town_night` is the only remaining board authority required before the candidate can pass the Set Board binding gate and continue through the real Wizard-connected path.

## 3. Scope

This is one bounded QA runtime proof over existing general infrastructure and story-specific frozen contract data. It is not a story-specific code patch.

## 4. Risk of hardcoding

No code is added. The exact story/set identifiers select frozen contract authority. The Board prompt remains derived from the six Town areas and the general v6 ambient policy. The result does not become reusable production authority until QA and Guy separately approve the exact bytes.

## 5. Files and artifacts affected

- no production or test file change;
- one ignored provider-free Town preview already exists;
- one new content-addressed PNG object if the render succeeds;
- one ignored v6 Town Registry sidecar, always initially unapproved;
- one ignored local downloaded proof copy for byte and visual inspection;
- `CURRENT.md` and this tracked Decision Gate document record state.

## 6. Expected behavior

The image is one continuous, empty nighttime-town establishing view. It must preserve all six connected areas and their fixed geometry: civic route/bakery/fountain/playground, garden, nighttime street, quiet curb bay, residential alleys and street corner. It may add only physically appropriate inanimate ambient dressing. It must not introduce people, animals, actions, story props, signage or readable text.

The sleeping-room priority is conditional and must not make the Town acquire bedroom-only dressing. Palette guidance applies only if a palette-sensitive surface happens to be physically appropriate; it does not require bedding, a doll or toys.

## 7. Validation plan

Provider-free gates:

1. HEAD equals pushed `8075ec83`, tracked state clean and independent Claude PASS recorded;
2. exact Town dry identity remains Set Definition `5b1917ce...b9dc`, content policy `18dbeae6...97b9`, prompt `6250ada1...87c`;
3. the dry prompt contains all six authored areas, no story/cast/action authority, and conditional sleeping-room wording;
4. v6 Town Registry target is absent before the call;
5. canonical live-import preflight passes with zero fetches and required credentials are present without exposing them.

If explicitly authorized, live validation is exactly one canonical LOW mint. Accept technical completion only if rendering, no-overwrite upload and ordinary Vision QA all succeed, then download the exact object, require its SHA-256 to equal the Registry, visually inspect it, and stop unapproved for Guy.

## 8. Cost impact

One `gpt-image-2` LOW 1024×1024 generation and one ordinary Vision QA call. No manual retry or second variant is authorized by this gate.

## 9. Rollback

The new object is content-addressed and cannot replace another board. Until explicit approval, the new Registry entry is not usable by live orders. A rejected image remains isolated evidence; the previously approved Home Board is unaffected.

## 10. Review assignment

Guy owns the Town image spend decision and final visual acceptance. Claude Code must verify this gate against the immutable contract, existing v6 prompt, approved Home evidence and repository topology before spend. After rendering, Guy must eyeball spatial coherence, physical appropriateness, town readability, absence of characters/story props/text, and overall visual quality.

## 11. Do not do

- no prompt/code change inside this runtime milestone;
- no second Town generation or same-byte Vision recheck;
- no automatic approval;
- no Wizard promotion, page render, full-book render, deployment or production action;
- no deletion, rewrite or staging of existing Home/v4/v5 Registry evidence.
