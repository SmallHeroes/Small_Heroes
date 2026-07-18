# Codex consult — make the text-first visual-contract compiler reliably author VALID templates on the LIVE path

## Context
We have a text-first, offline, human-in-the-loop compiler that turns a story's text into a `BookVisualContractTemplate` CANDIDATE for human review (never on the paid/frozen path). Architecture:
- `lib/visual-contract-compiler/extractDeterministicFacts.ts` — pure facts: recurring humans, gender (Hebrew morphology), pagesPresent, laterality. NO appearance, NO worldType, NO zones.
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts` — the LLM (injected) drafts ALL descriptive fields (`worldType`, `locations`, `zones`+`stableGeometry`, `cast` wardrobe, `humanCast` appearance/garments, `recurringProps`, `coverContract`, per-page `mustShow/zoneId/...`). Deterministic facts (identity/presence/laterality) are overlaid LAST. Fail-closed: `assertValidBookVisualContractTemplate` throws on an invalid candidate (line 228).
- The design already anticipates LLM gaps: if the draft omits a human's appearance it pushes a note "needs human authoring" (line 196) and then fails validation.

## What just happened (first real LIVE run, `--live`, model `gpt-5.3-chat-latest`)
Both stories FAILED the fail-closed validator (0 written, 0 image spend — the gate worked):

**bunny_ometz_adventure (medical; has humans doctor+mother):**
- `zones` with empty/malformed `stableGeometry` (6 zones)
- `cast.child.wardrobe.description` missing; `cast.companion.wardrobe.description` missing
- `coverContract.worldType` missing
- `humanCast "human:doctor".appearance` missing structured skinTone/hairColour/hairStyle bindings; same for `human:mother`

**fox_uri_adventure (adventure; no recurring humans):**
- `coverContract.worldType` missing
- every page's `zoneId` "is not a zone of location Y" (e.g. p1 zoneId `open_ground` not a zone of location `meadow`) — the model's per-page zoneIds are internally inconsistent with the zones it defined per location.

## The gold we're measuring against
The ONE committed template `story-bank/v3-approved/bunny_ometz_adventure.visual-contract-template.json` is VALID and rich, but was produced OFFLINE from a curated fixture draft (commit `d1d724ca`, "offline materialize probe"), NOT from a live model. It uses `anchors` per location (NOT `zones`), has `worldType`/`coverContract.worldType = realistic_clinic`, `cast.*.wardrobe.description`, and `humanCast` appearance with structured `deterministic_palette` (paletteId `clinic-doctor`) / `family_profile` / `policy_default` (policyId `doctor-hair-style`) bindings. Those binding shapes look role/policy-derived, not free-invented.

## The question for Codex
The live LLM, as currently prompted (rules only, no example), cannot produce a schema-valid template. We want to make live authoring reliable WITHOUT weakening the fail-closed guarantee or the facts-authoritative invariant. Please pressure-test the approach and rule on the boundary:

1. **Inject-vs-draft boundary.** Which of these should MOVE from LLM-draft to deterministic compiler-injection (from facts/role/policy), and which must stay LLM-drafted?
   - `coverContract.worldType` (derive from `worldType`?)
   - `humanCast[].appearance` binding SKELETON by role (relative→`family_profile`; non-relative→`deterministic_palette` + a role-derived `paletteId`; `hairStyle` explicit from a policy default) — with the LLM filling only free-text (garment descriptions, hairStyle wording)?
   - `zones`+`stableGeometry` vs `anchors`: the gold uses anchors and no zones; the model invented botched zones. Should the template drop `zones` in favour of `anchors`, or keep zones but have the compiler enforce per-page zoneId∈location.zones (reject/repair)?
   - `cast.*.wardrobe.description`: keep LLM but require non-empty?

2. **Few-shot.** Is giving the model the committed bunny template as a format exemplar the right primary lever, and does it risk the model COPYING bunny's content (clinic/doctor) into an unrelated story (fox=meadow/forest)? How to few-shot the SHAPE without leaking the CONTENT?

3. **Model.** Is `gpt-5.3-chat-latest` the wrong tool for structured-JSON authoring of this complexity? Should the authoring draft use a stronger reasoning model (offline, cost is irrelevant here — 1 call/story)? Or is the prompt/architecture the constraint, not the model?

4. **Repair loop.** Should the compiler run a bounded validate→repair cycle (feed the validator errors back to the model up to N times) as part of authoring, given it's offline and cheap? Does that undermine determinism/reviewability, or is it fine since a human still signs the final candidate?

5. **Invariant safety.** Any way these changes could weaken the facts-authoritative overlay (identity/presence/laterality) or the fail-closed guarantee? Confirm the boundary keeps those intact.

## Constraints (do not break)
- Offline / human-in-the-loop only; NEVER on the paid/frozen/rendered path.
- Facts (identity/gender/presence/laterality) stay deterministic and overlaid last — the LLM must never author them.
- Fail-closed stays: an invalid candidate is never written/promoted.
- Reuse the existing modules; keep this separate from the dormant vNext `compileBookVisualContract`.

## Deliverable from Codex
A ranked recommendation: the exact inject-vs-draft field boundary, whether to few-shot (and how to avoid content leak), the model call, and whether to add a bounded repair loop — enough for a precise CC implementation brief. Cite files:lines.
```
