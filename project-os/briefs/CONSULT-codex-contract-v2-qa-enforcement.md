# Codex consult — pressure-test the "Contract v2 + QA enforcement" spec BEFORE it goes to CC

**Purpose:** This is the BIG focused fix for the render NO-GO. It's derived from YOUR diagnosis + Cowork's prioritization + one pushback. **Review it before we route to CC** — validate the schema, the compiler-rejection rules, the QA-enforcement plan, and flag anything missing or any money/lifecycle/hash risk.

## The root cause you established (restating so we're aligned)
The pipeline ran, but the book should have failed QA. Three compounding layers:
1. **The contract is too SOFT/ambiguous** — prose not structured; contradictory options in one identity (`window` AND `window/door threshold`); weak forbids ("real notebook not required" instead of "forbidden"); reveal-timing contradicts the source (`No bucket visible` pages 1–3, but the template allows the bucket "offside" at p4).
2. **QA is impoverished** — the QA adapter (`adapters.ts:466`) forwards only zone description + object identity + global forbids; it DROPS `stableGeometry`, per-page prop state, `mustShow`, `mustNotShow`, action-attribution, and safety. And the judge is instructed to be lenient on pose/state (`page-world-qa.ts:44`). So child-on-railing / wrong bucket position / notebook-on-wrong-actor all pass.
3. **Validation is structural only** — `stableGeometry`/`propState` are free text; "18/18 valid" ≠ faithful+safe.

## Proposed spec (for your review)

### A. Structured contract fields (replace prose with machine-checkable structure)
- `openingType` — a SINGLE enum per opening scene (`low_window` | `balcony_door` | …), never "window or door" in one identity.
- **Spatial-anchor graph** — a per-location topology with fixed relations (wall / drip / chair / slipper / railing / bucket-slot positions) referenced by every page of that location, so position is deterministic across pages.
- **Prop lifecycle** — per prop: `firstRevealPage`, allowed visibility per page; the compiler forbids a prop appearing before its `firstRevealPage`.
- **`actor / action / object` binding** — structured per page (e.g. `{actor: companion:fox_uri, action: writes, object: imaginary_notebook}`), so the notebook can't be given to the child.
- **Body-hazard safety relations** — hard booleans, e.g. `child.feetOnFloor = true`, `child.onRailing = false`, per page. Not a vague "unsafe balcony hazards" string.

### B. Compiler rejections (fail-closed at authoring)
Reject a template that: has an ambiguous `openingType`; allows a prop before its `firstRevealPage`; uses a weak forbid ("not required") where the source implies a hard "not visible"; or contradicts an explicit source cue (`No bucket visible`).

### C. QA enforcement (the biggest gap)
Pass the FULL contract to the page-QA adapter (stop dropping fields at `adapters.ts:466`): `stableGeometry`, per-page prop state/visibility, `mustShow`, `mustNotShow`, `actor/action/object`, and safety relations. Make the judge **BLOCK** (not lenient-pass) on: safety violation, wrong-actor action, a prop visible out of its lifecycle, a `mustShow` missing, and gross topology violation. (Keep leniency only for camera angle / minor pose.)

### D. Cross-page continuity check
A deterministic check that the position RELATIONSHIPS (bucket↔wall, chair, drip, railing) hold across pages of the same location — WITHOUT requiring the same camera angle. Changes allowed only where a declared transition exists.

### E. Set anchor — **PUSHBACK on your item 5 (please weigh in):**
You proposed an approved **set plate as a topology anchor attached to every page** of a location. Guy's standing guardrail (from earlier work): **a composed room/scene reference on every page DRAGS composition** — he explicitly prefers *isolated object refs / a set BOARD / approved seeds* over a composed-room-ref-per-page. **Proposal:** anchor topology via the STRUCTURED spatial-anchor graph (A) + isolated object refs + a spoiler-gated set BOARD — NOT a full composed plate on every page. Do you agree this achieves the topology lock without the composition-drag risk, or is a plate genuinely needed? This is the key design fork.

## Priority / phasing (Cowork's proposal — validate)
- **P0 (safety, ship first, standalone):** the body-hazard safety relations (A) + QA blocking on safety (C-safety). A children's product cannot ship the railing pose.
- **P1 (the core):** the rest of A + B + C + D + E.
- **Money/lifecycle note:** changing the contract schema changes what's hashed/frozen. Flag any atomic-freeze / resolved-hash / re-mint implications (all 18 templates would be re-minted under the new schema).

## Validation loop (agreed)
After the fixes: a **5-page LOW sample** (opening / window→balcony transition / counting / page-before-bucket-reveal / reveal). Only if they pass contract + safety + continuity + narration → justify another full render.

## Deliverable from Codex
Go/adjust on the spec: confirm the field schema + rejection rules + QA-enforcement plan; rule on the set-plate-vs-board fork (E); flag any missing enforcement, any money/hash/re-mint risk, and whether P0-safety can truly ship standalone ahead of the rest. Then Cowork turns it into the CC implementation brief. Cite files:lines.
