# BRIEF (CC) — fix companion-presence detection + add the cross-field fail-closed validator (blocks render proof)

**Origin:** Codex render-integration audit = **NO-GO**. Runtime/schema compat is PASS (materializer/validators byte-identical across branches; all 18 materialize→resolve→freeze), but the fox asset has a **semantic cross-field contradiction that survives every validator** and would reach the image prompt. Cowork blast-radius: **11 true contradictions, concentrated in fox_uri** (fox_uri_fantasy 10 pages, fox_uri_adventure p4). Root cause is a general detector bug.
**Branch:** engine fixes on `feat/live-authoring-fix`.

## The bug (verified)
On a page where the prose names the companion by SHORT name ("Uri") and the imageDirection has no explicit `companionPresence: present`, the presence detector — which matches the full roster display name ("the fox Uri") or an explicit directive — MISSES it (`extractDeterministicFacts.ts:335`). The deterministic overlay then forces `companion:false` + drops it from `castIds` (`compileBookVisualContractTemplate.ts:334`), while the LLM-drafted `mustShow` (which read the prose) still positively requires the companion. The prompt builder emits `CAST PRESENT: child` AND `MUST SHOW: Uri…` independently (`buildVisualContractPromptBlock.ts:84`). No validator checks `mustShow`/prose against `castIds`/presence (`validateVNextVisualContract.ts:258`) → it ships.

## Fix 1 — alias-aware companion presence detection (the root fix)
In `extractDeterministicFacts` companion-presence detection, match the companion's **aliases / short names** (e.g. "Uri", "אורי", "אוּרי"), not only the full roster display name. Reuse the existing `lib/companion-presence-aliases.ts` (`companionPresenceTokens(name, id)`) — the same alias source used elsewhere — so "Uri" is detected as `companion:fox_uri` present. Keep the explicit `companionPresence:` directive as an override. **This is the primary fix: correct presence → castIds includes the companion → mustShow is consistent.**

## Fix 2 — cross-field fail-closed validator (the safety net — this class must NEVER ship again)
Add a validator rule (template + resolved): if a page's `mustShow` (or the source prose) **positively references a cast member** (companion or a human) that the page's `castIds`/`characterPresence` declares ABSENT → **reject (fail-closed)**. This closes the "structurally valid but semantically contradictory" gap that let fox p4 pass. (Negative references — mustNotShow "companion not yet present" — are fine; only positive mustShow references to an absent member fail.)

## Fix 3 — port `parent` to the render branch (fleet compatibility, Q5)
`RELATIVE_ROLES` includes `parent` on the engine branch but NOT on `feat/chunked-generation` (`contractTemplateTypes.ts:37`). A `parent + family_profile` template passes on engine but is REJECTED by chunked's validators. None of the current 18 use `parent`, but port this one change to `feat/chunked-generation` so the branches agree.

## Then — re-mint + verify
Re-mint ALL 18 (`gpt-5.5`, to `_review/vc-live-cheap`) with the fixed detector. Acceptance: **0 positive contradictions** (companion/human in mustShow while declared absent) across all 18 — the new validator must pass them, and a re-scan finds none. fox_uri_fantasy (worst, 10) and fox_uri_adventure p4 must be clean.

## Tests
- Detector: a page naming the companion only by short name ("Uri") → presence detected, `castIds` includes `companion:fox_uri`.
- Validator: a template with `mustShow: ["Uri …"]` but `castIds:[child]`/`companion:false` → **rejected** (reproduce fox p4 + a fox_fantasy page).
- Regression: negative reference (mustNotShow "no companion yet") is NOT rejected.
- `npm run check` green. Branch `feat/live-authoring-fix`, explicit pathspecs, no push.

## Follow-ups (flag, do NOT block this brief)
- **Q3 provenance gap:** `origin.paletteId` isn't validated to equal cast id (selection ignores it, but it feeds the frozen hash) — add an equality assert later.
- **Q2 render preflight:** the freeze derives a family appearance profile unconditionally even for a no-humans story (`ensure-frozen-visual-contract.ts:121`); the staging render order must carry concrete skin/hair/texture evidence (defaults are rejected, `resolve-family-appearance.ts:33`). Operational note for the render phase; consider skipping family derivation when no family roles exist.

## After this lands
Re-verify (Cowork scan + optionally Codex re-gate) → then the render proof (`PLAN-render-proof-first-slot.md`) from `feat/chunked-generation`.
