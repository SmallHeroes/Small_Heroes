# SmallHeroes — Current Technical State

**Updated:** 2026-07-22
**Maintainer:** Codex
**Working branch:** `main`; feature implementation remains in `C:\GNart\Work\sh-wt-style01` on `feat/chunked-generation`

## Active task

Turn the existing visual-contract, Set Board, rendering, and QA components into one stable fail-closed image-generation path. No image render is currently authorized.

The governing brief is `docs/ai-workflow/DECISION_GATE_IMAGE_GENERATION_ARCHITECTURE_2026-07-22.md`.

## Executive finding

The repository does not need a second image architecture or another general compiler. It needs the missing lifecycle between the components already present:

```text
approved story
  → reviewed/promoted visual package
  → zero-cost render preflight
  → frozen source-bound contract + board bindings
  → bounded page render
  → uploaded candidate persisted
  → QA on the same bytes
  → accepted, verified regeneration, or hold
  → durable resume and human release
```

The immediate risk is not merely weak prompting. Product/story sellability currently permits more stories than the visual system can safely render.

## Verified repository facts

- With `ENABLE_V3_APPROVED_BANK=true` and the DB check intentionally skipped, `npm run release-check` reports **18/18 product-sellable slots**. The historical 8/18 statement is stale.
- The bank currently contains **2 visual-contract templates** (`bunny_ometz_adventure`, `fox_uri_adventure`), **1 legacy visual contract** (`bunny_ometz_adventure`), and **6 location bibles**.
- A tracked approved Set Identity Board exists for `fox_uri_adventure`.
- Offline text-first extraction/compilation, strict validation/materialization, frozen contract hashing, contract steering, world QA, and the Set Identity Board engine already exist on the common code line.
- Bank runtime does not live-compile a missing contract. With enforcement on, missing authority blocks; with enforcement off, the path degrades to legacy behavior.
- Visual-contract freeze/enforcement/steering are hard-off in Vercel production, so production cutover requires an explicit reviewed code/config milestone.
- No tool currently performs approved visual-package promotion into the bank, and `release-check` does not check contract/source/board coverage.
- The strict LLM draft schema cannot currently author `setIdentityId`/`setReference`, even though downstream contract types can represent them.
- The cover fallback can inject literal `home-night`; generic derived locations do not provide reliable set topology or references.
- The Director sees authored image direction, runs pages in parallel, and receives only a previous-page text snippet rather than authoritative previous blocking/emotion. The complete frozen page contracts already contain the better deterministic continuity plan.
- Set Board registry/storage is deliberately story-scoped. Cross-story reuse is not yet proven and will not be generalized now.

## Render-loop Phase 1 re-gate

Feature commits through `ef543312` add useful foundations: no hidden OpenAI image retry, cancellation plumbing, same-image malformed re-QA, and pre-QA uploaded-candidate persistence. `npm run check` passes.

The slice remains **NO-GO**:

1. The same-image helper returns persistent malformed QA as unverified, but the shipped Style01 caller treats unverified as regeneration-eligible and can spend a new image. That violates the requirement that only a verified visual failure may consume regeneration budget.
2. The visual-QA fetch has no dedicated AbortSignal/timeout.
3. Tests cover the helper but not the caller-level budget decision, so the green suite is false confidence for this requirement.
4. Candidate persistence has no regression test proving the shipped Style01 order: upload → persist candidate → QA.

No measurement render occurs until this is corrected and Claude Code independently re-gates it.

## Binding technical decisions

- **Two gates:** product-sellable and render-qualified are separate. Only both together permit a paid image.
- **Approved package first:** a current source-bound template, explicit `worldMode`, complete cover/page plan, and every required approved board must exist before render.
- **No runtime authoring:** contracts are compiled offline, reviewed, explicitly promoted, then frozen/materialized per order.
- **One world authority:** frozen cover/page contracts own location, zone, transition, cast, props, required/forbidden content, and reality mode.
- **Bounded Director:** runtime creative prose may choose camera/blocking only within the contract. Direction labels cannot choose or transform the world.
- **No new sequential LLM memory:** deterministic page contracts are the continuity state. Add runtime sequence only if later evidence identifies a fact that the contract cannot express.
- **QA evidence is not image failure:** malformed/error/timeout/skipped QA may retry the same candidate and then hold; it may not consume regeneration.
- **Story-scoped boards stay:** shared world kits are deferred until two reviewed stories intentionally share one canonical set.
- **Lion stays blocked:** no `lion_shaket_adventure` render until the general system passes, the story receives product review, its visual package is approved, and Guy explicitly authorizes the cost.

## Planned sequence

1. Correct render-loop Phase 1 with caller-level tests and bounded QA; run `npm run check`; Claude Code re-gate.
2. Implement visual-package promotion and all-slot render-qualification audit/release gate, with zero image calls.
3. Add `worldMode`, extend strict draft support for board bindings, and bound/remove legacy world fallbacks from the sellable path.
4. With explicit Guy approval, run one LOW page on `fox_uri_adventure` and inspect runtime artifacts.
5. Based on measurement, land the durable candidate/QA/resume state machine and prove it at a real DB/runtime boundary.
6. Compile candidates for all 18, but review/promote only Guy's chosen launch set; then consider a five-page sample and eventually one explicitly approved full book.

## Branch and worktree state

- Guy explicitly reported pushing the canonical workflow/documentation range after its handoff was prepared. `origin/main` contains that range and the later repository-topology governance commit through `6748b813` as verified on 2026-07-22.
- The earlier handoff statement "No push" was true at preparation time but was not a durable current-state claim. It is withdrawn as a description of the later repository state; the push was performed explicitly by Guy, so there was no unauthorized executor push.
- Local/remote divergence is volatile operational state. Before every implementation start, QA handoff, and PowerShell handoff, Codex reads it from Git rather than relying on this snapshot.
- Local `feat/chunked-generation` is ahead of its origin by four Phase 1 implementation commits.
- The feature worktree has a pre-existing modified `.env.example` and untracked review/checkpoint/artifact files. They are user work and remain untouched.
- Main also has pre-existing untracked `_review/`, `project-os/NOW.md`, and `scripts/check-order-anchor-readiness.ts`; they remain untouched.
- Before implementation resumes, the feature line must preserve/merge the canonical documents without sweeping unrelated work into a commit.

## Evidence recorded this turn

- Read the attached Codex architectural verdict and traced its claims through loaders, guards, compiler scripts, Director call sites, board registry/storage, tests, and feature commits.
- Ran `npm run check` on `feat/chunked-generation`: PASS, while caller review still found the regeneration-evidence bug above.
- Ran `npm run release-check` on `main` with `ENABLE_V3_APPROVED_BANK=true` and `SKIP_DB_SCHEMA_CHECK=true`: PASS and 18/18 product-sellable. This was a catalog/config check only, not a database release proof.
- Enumerated tracked contract and board artifacts from Git.
- No image, audio, external API, database write, migration, deployment, or production action was performed.
- Claude Code reviewed `b4813c04..8ba57d18` and correctly found that the post-handoff Git state no longer matched this file. Guy's preceding message establishes that he performed the push after preparation; the finding is accepted as a stale-state defect, not an authorization breach.

## Blockers

- Guy approval of the Decision Gate is required before image-generation implementation.
- Claude Code PASS is required after each implementation re-gate.
- The one-LOW-page proof requires separate explicit cost approval.
- Lion requires separate product/content acceptance; technical readiness alone is insufficient.

## Next action

After Guy approves the sequence, correct R1A only. Do not start contract-catalog authoring, render measurement, or Lion-specific work in parallel.
