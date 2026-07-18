# BRIEF (CC) — make the text-first visual-contract compiler author VALID templates on the LIVE path

**Origin:** Codex architecture ruling (2026-07-13, "Ruling: Proceed with an architecture fix, not a prompt-only fix"). Cowork consolidated + verified against code. This is the launch-critical authoring engine ([[live_authoring_blocked]]).
**Branch:** off `feat/chunked-generation`. **Offline / human-in-the-loop only — NEVER the paid/frozen/render path.**

## Problem (proven)
First real `--live` mint failed the fail-closed validator on BOTH bunny + fox. Root causes: the authoring call is undersized (support model `gpt-5.3-chat-latest`, no reasoning, generic `json_object`, 4,000-token cap → a 12-page relational doc truncates), AND several fields the LLM shouldn't own are left to it (worldType silent-defaults to `"unspecified"`; humanCast appearance bindings; zone/location IDs restated inconsistently — fox: per-page zoneId ∉ its location's zones).

## Verified facts (use these — do not re-discover)
- Stronger model exists + wired: `gpt-5.3-pro` (`backend/providers/pipeline.ts:556`). Current authoring call uses the support default `gpt-5.3-chat-latest` (`:557`), reasoning supported at `:670`, and `if (jsonMode) response_format = { type: 'json_object' }` at `:728` (NO `json_schema` support yet — adding it is part of this work).
- Silent default to fix: `compileBookVisualContractTemplate.ts:215` `... ?? 'unspecified'`.
- `RELATIVE_ROLES = ['child','mother','father','sibling','grandparent']` (`contractTemplateTypes.ts:38`) — **excludes `parent`**, which the extractor can emit (`extractDeterministicFacts.ts:255`). The `parent` trap must be handled.
- Palette selection hashes `schemaVersion|paletteVersion|storyKey|castId` and does NOT read `origin.paletteId` (`appearancePalette.ts:56`). Do NOT invent role-derived paletteId strings — add/use a canonical palette identifier or change semantics deliberately.
- Committed bunny template has 3 top-level `zones` with non-empty `stableGeometry`, every page resolves to a zone. Zones are consumed per-page by `derivePageVisualContracts.ts:43`. **Do NOT drop zones.** Keep bunny as a regression FIXTURE (not prompt content).

## Field ownership boundary (Codex ruling — implement exactly)
| Field | Owner |
|---|---|
| identity/role/gender/aliases/evidence/pagesPresent; page castIds/presence/laterality | **Deterministic facts** — preserve overlay-last; NEVER expose as repairable |
| top-level `worldType` | LLM+human — semantic; **missing → repair/fail, NOT `"unspecified"`** |
| `coverContract.worldType` | **Compiler** — copy from finalized top-level worldType + add equality invariant |
| locations/anchors/topology; zones+stableGeometry; wardrobe; garments; mustShow/mustNotShow/camera/bodyState | LLM+human (descriptive) — validate; wardrobe must be non-empty, NO generic filler |
| location/zone IDs + all references | **Compiler** — canonicalize IDs + rewrite page/transition refs from ONE graph |
| human appearance binding modes/origins | **Compiler policy** — inject from a closed, versioned role policy |
| human appearance concrete prose | policy or LLM per field (see appearance rules) |

**Appearance injection rules:** relative role → inject `family_profile` for skin/hairColour/hairTexture; known non-relative → inject `deterministic_palette` for those three; hairStyle → inject concrete value + provenance from an approved role-policy table (do NOT let the LLM invent wording while claiming `policy_default`); **unknown role → defer/fail for human authoring** (never treat "not in relative list" as automatically non-relative). Classify `parent` as family-profile-eligible OR fail-pending — do not let it fall through.

**stableGeometry contract (preserve):** omitted = valid; present = non-empty string[]; empty/null may normalize to omitted; malformed semantic content → repair/fail (`validateBookVisualContract.ts:86`).

## Build order (staged — re-mint bunny as the gate after each stage)

### Stage 1 — the authoring model call (biggest single lever; ship + measure first)
Give the `VisualContractTemplate` compile a DEDICATED authoring call (not the support default):
- model `gpt-5.3-pro`; reasoning `medium`; **strict `json_schema` structured output** (add `json_schema` support to the Responses path in `pipeline.ts` — currently only `json_object`); token budget ~12,000 for 12 pages, scale by pageCount, cap ~20,000; record provenance (actual model, prompt/schema version, policy version, attempt #); **no silent model fallback**.
- **Checkpoint:** re-mint bunny `--live` → measure how many failures remain before building Stage 2. Report the delta.

### Stage 2 — compiler-owned redundancies + policy bindings
- Remove the `'unspecified'` silent default → missing worldType routes to repair/fail.
- Compiler copies `coverContract.worldType` from the finalized top-level worldType + equality invariant.
- Inject humanCast appearance binding skeleton from the role policy (rules above), incl. the `parent` classification + a canonical palette identifier. LLM no longer authors appearance modes/origins.
- **Topology graph:** LLM describes ONE semantic location/zone graph; compiler then (1) canonicalizes location + zone IDs, (2) rewrites page + transition references against that graph, (3) accepts a reference only with one unambiguous target, (4) sends ambiguity to repair — never guesses a page's location. (Fixes the fox failure; preserves zone-membership + transition continuity per `validateBookVisualContract.ts:163`.)

### Stage 3 — bounded repair loop (safety net)
At most **2 semantic repair attempts** after the initial call. Each repair receives: the invalid DESCRIPTIVE draft, the exact validator errors, the authoritative facts, and an **explicit allowlist of editable fields that EXCLUDES all compiler-owned + facts fields** (appearance modes/origins, IDs, castIds/presence/laterality, worldType-copy). After every attempt: reassemble → reapply compiler policy → overlay facts last → `assertCastIsFactAuthoritative` → full template validator → **write nothing unless all pass**. Persist raw attempts + validator errors beside the `.visual-contract-review.md` (reviewability; byte-determinism not required — offline + human-approved).

## Do NOT touch
- The facts overlay + `assertCastIsFactAuthoritative` + the fail-closed validator (they stay the final authority).
- The paid/frozen/rendered path; the dormant vNext `compileBookVisualContract`.
- Zones (keep them). The committed bunny template (regression fixture only).

## Acceptance
- **Gate: re-mint bunny `--live` produces a VALID template** (ideally structurally ≈ the committed one), THEN fox_uri_adventure produces a valid template. Output to `_review/vc-live` (NOT the bank).
- Unit tests: worldType-missing → fail (not `'unspecified'`); coverContract.worldType equality invariant; appearance injection per role (relative / known non-relative / `parent` / unknown-role-fails); no fabricated paletteId; topology canonicalization + ambiguous-ref → repair (not guess); stableGeometry omitted-valid / present-non-empty; wardrobe non-empty; repair loop caps at 2 + writes nothing on failure; provenance recorded; no silent fallback.
- `npm run check` green (tsc --noEmit + vitest), incl. the new tests. Keep the bunny fixture spec passing.

## Git hygiene & verify
- Stage with explicit pathspecs (NEVER `git add -A`). Commit per stage/green milestone. Do NOT push until Guy says so.
- Report per stage: the re-mint bunny result (valid? diff vs committed), `npm run check` summary, and the file diff. Flag anything ambiguous back to Guy — do not guess on the ownership boundary.
```
