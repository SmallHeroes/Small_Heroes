# PLAN — render proof: first engine-authored contract → a real (sampled) book

**Goal:** prove the payoff — a **faithful, engine-authored visual contract produces a CONSISTENT rendered book.** Authoring is proven (18/18 valid, faithful, cheap). This is the separate, higher gate: does the contract-driven render hold consistency? **Valid contract ≠ consistent book — this phase tests the second half.**

**Decision Gate (per CLAUDE.md):** this enables existing flags on STAGING (no render-code change; enforcement is hard-off on prod) + promotes one asset + spends a SMALL image budget. **5-page sample only — NOT a full book.** Guy approves before Phase 3 spends any image.

**First slot = `fox_uri_adventure`** — Cowork-verified faithful (night-fear balcony/bucket/flashlight), NO humans (simplest), unified set (1 location / 5 zones), and a launch slot. (Alternatives if preferred: `lion_shaket_adventure` 1/3 = simplest set; `panda_anat_adventure` 1/6.)

---

## Phase 1 — Promote the reviewed fox contract into the bank. Owner: CC. (copy-paste)
The render path lives on `feat/chunked-generation` and already consumes `{key}.visual-contract-template.json` (bunny's committed template renders today). We only need the fox template as an asset there — NOT a merge of the authoring-engine branch.

```
TASK: Promote the Cowork-reviewed fox_uri_adventure visual-contract template into the render bank + guard it.

BRANCH: feat/chunked-generation (the render/golden path — NOT feat/live-authoring-fix).
1. Copy `_review/vc-live-cheap/fox_uri_adventure.visual-contract-template.json`
   → `story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json` (verbatim; do NOT hand-edit fields).
2. Add a validity test mirroring the bunny one (lib/__tests__/bunny-ometz-adventure-*visual-contract*.spec.ts):
   load the fox template, assert validateBookVisualContractTemplate passes, and assert it materializes to a
   valid ResolvedBookVisualContract. Name: lib/__tests__/fox-uri-adventure-visual-contract.spec.ts.
FILES: the template json (new) + the spec (new). DO NOT TOUCH render/enforcement code or any other slot.
ACCEPTANCE: npm run check green (incl. the new spec). GIT: explicit pathspecs, commit on feat/chunked-generation, do NOT push until Guy says.
```

## Phase 2 — Enable enforcement on STAGING. Owner: Guy. (ref: `project-os/09-staging-enforcement-enablement.md`)
On the **staging** Vercel env only (prod is hard-off): set
`VISUAL_CONTRACT_FREEZE=true`, `VISUAL_CONTRACT_ENFORCEMENT=true`, `VISUAL_CONTRACT_STEERING=true`, `ENABLE_V3_APPROVED_BANK=true`, `GPT_IMAGE_QUALITY=low`.
Then **redeploy staging** (flags only take effect on redeploy). Confirm the deployment `VERCEL_ENV=preview` (NOT production — the #1 gotcha; if it reads production, enforcement never engages).

## Phase 3 — Render a 5-page SAMPLE of fox. Owner: Guy. (Guy-approved; small spend)
Place a `fox_uri_adventure` order on staging via the wizard (NIGHT_FEAR × adventure), LOW quality. Render a **5-page sample**, not the full book. The chain runs: promoted template → freeze/materialize → enforce → steer → images → reader.
- **Positive control (optional):** a bunny_ometz_adventure order (has a template) should also render.
- **Negative control (optional):** a slot with NO promoted template should hard-block (proves enforcement is truly on).
Rollback: flags off → redeploy → byte-identical legacy behavior.

## Phase 4 — Eyeball vs the consistency bar. Owner: Guy + Cowork. The real verdict.
Review the 5 sampled fox pages against the 5 known first-render defect classes: location leak, size drift, companion identity/presence, family/mom likeness, child likeness. Since fox has no humans, the live risks are **location/zone consistency + companion (Uri) + child likeness**.
- **PASS** → a faithful contract yields a consistent book → the engine is proven end-to-end → scale: promote + render the launch slots.
- **DEFECT** → log the class; the fix routes to the contract (a template field) vs the render/steering — cheaply, on ONE slot, before the whole catalog.

---

## After the render proof
- Guy reviews the other 17 candidates (in `_review/vc-live-cheap`) for fidelity before promoting each.
- Consolidate: `feat/live-authoring-fix` (the offline engine, 7 commits, pushed) merges toward `feat` per the branch-consolidation plan.
- Cost: authoring is now ~cents/contract on `gpt-5.5`; set `VISUAL_CONTRACT_AUTHOR_MODEL=gpt-5.5` as the default.

**Full-book render stays gated** until the 5-page sample passes Guy's eyeball.
