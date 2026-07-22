# SmallHeroes — Roadmap

**Last verified:** 2026-07-22
**Product priority owner:** Guy
**Technical sequencing owner:** Codex

This roadmap records technical milestone state. Guy can change product priority at any time; Codex then updates the technical sequence, dependencies, and risks.

## Active

### R0 — Establish one engineering operating model

- **Goal:** make Codex the technical owner and primary implementer, Claude Code the independent technical QA, Claude Cowork the product/creative consultant, and Guy the product owner.
- **State:** implementation complete across workflow commit `980560a2` and the canonical-state documentation milestone; independent Claude Code QA is pending.
- **Done when:** Claude Code independently confirms that active instructions agree and Guy accepts the authority/source hierarchy.

### R1 — Complete and gate render-loop Phase 1

- **Observed repository state:** local `feat/chunked-generation` ends at `ef543312` and contains four implementation commits not in `main`. `main` now contains the ownership/source-of-truth documentation milestones that are not in the feature branch, so the branches have deliberately diverged. The feature diff changes image cancellation/retry behavior, same-image re-QA, and pre-QA page-upload candidate persistence.
- **Technical next gate:** review the full four-commit slice, run its focused tests plus `npm run check`, verify migration/runtime implications, prepare the Claude Code handoff, and merge only after technical QA and Guy's relevant product decision.
- **Do not:** merge the slice merely because it is the active feature work; review it first, and preserve the new canonical documentation during integration.

## Next

### R2 — Close the human-QA operator loop end to end

- Verify the current release/park/re-render surfaces against actual mainline code and runtime evidence.
- Confirm every hold can be discovered, acted on idempotently, audited, and either safely released, re-rendered, cancelled/refunded, or parked.
- Exercise the relevant staging paths. Payment and delivery-authority claims require concurrency/runtime evidence, not unit tests alone.

### R3 — Prove one full sellable book on the approved golden path

- First use the smallest approved calibration sample.
- Run a full fox book only with Guy's explicit cost/product approval and after the relevant technical gate.
- Judge both system behavior and product outcome: story agency, humor, ending, child/wardrobe likeness, companion identity, set continuity, text legibility, holds, and fulfillment authority.
- Fix systemic defects generally; do not patch only the fox story.

### R4 — Launch-readiness closure

- Revalidate the sellable matrix and every launch-eligible slot.
- Prove PayMe webhook verification and order/refund behavior using the approved environment and credentials; never invent a webhook secret or allowlist.
- Revalidate staging/production separation, storage, migrations, release flags, deployment protection, and `npm run release-check`.
- Guy gives the launch go/no-go after technical and product gates.

## Completed or landed on main

- Pipeline/consolidation work through `main` commit `b4813c04`.
- Read-only human-QA review console merged to main (`e5dbe700`).
- Human-QA operator-action foundation, park, and release work landed through the July 20–21 commit series ending at `8614094e`.
- Reader left-page masking correction landed at `b4813c04`.

These entries mean “present in Git,” not automatic runtime or product acceptance. `CURRENT.md` records the active verification state.

## Blocked or externally gated

- Real PayMe webhook configuration depends on approved PayMe account information. Do not guess secrets, signatures, or IPs.
- A full production-quality render spends money and needs Guy's explicit approval.
- Final technical PASS on Codex changes depends on independent Claude Code review.
- Final product PASS and launch readiness depend on Guy.

## Deferred

- Style02 customer availability
- Physical/printed fulfillment and Power Card productization
- International/Stripe rollout and non-Hebrew languages
- Fully automated product/visual acceptance
- Marketing scale beyond the supervised pilot
- Broad refactors that are not required by a verified root cause

## Out of scope for roadmap changes by Codex alone

Codex does not choose story quality, business priority, customer promise, pricing, launch timing, visual direction, or whether a feature is worth building. These require Guy's decision; Codex supplies feasibility, risk, sequencing, and implementation options.
