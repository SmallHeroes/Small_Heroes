# SmallHeroes — Current Technical State

**Updated:** 2026-07-22
**Maintainer:** Codex
**Working branch:** `codex/r1b-visual-package-promotion` in `C:\Users\guyna\.codex\worktrees\0ef3\Small_Heroes`; accepted R1A remains frozen at `C:\Users\guyna\.codex\worktrees\2d64\Small_Heroes`, and the legacy feature worktree remains untouched at `C:\GNart\Work\sh-wt-style01`

## R1B independent QA result - latest state

R1B is implemented and locally committed at `da1914cb` (`feat(visual-package): add approved promotion lifecycle`), with the implementation handoff recorded at `57291998`. Independent read-only Claude Code QA returned **PASS (R1B only)** with no blocker, major, or minor implementation defect. Codex reconciled the verdict against the live branch and Decision Gate; no fix or re-gate is required. This records the external technical gate only: Guy's accept/close decision, push authorization, and authorization to start R1C remain separate.

### Live topology at implementation

- Canonical `main`: `C:\GNart\Work\Small_Heroes`, `main` at `ed1da86c`, tracked clean with pre-existing user-owned untracked files, and 0 ahead / 0 behind `origin/main` at dispatch.
- Accepted/frozen R1A: `C:\Users\guyna\.codex\worktrees\2d64\Small_Heroes`, `codex/r1a-render-loop-phase1` at `4a5dd041`, clean and 0 ahead / 0 behind its origin at dispatch. It remained read-only.
- R1B implementation: `C:\Users\guyna\.codex\worktrees\0ef3\Small_Heroes`. The supplied worktree was detached at accepted R1A `4a5dd041` because the R1A branch was already checked out in the frozen worktree, so the existing worktree was attached to the new milestone branch `codex/r1b-visual-package-promotion`; no new worktree or merge was created.
- Frozen legacy feature line: `C:\GNart\Work\sh-wt-style01`, `feat/chunked-generation` at `ef543312`, 4 ahead / 0 behind its origin, with the pre-existing `.env.example` modification and user-owned untracked artifacts untouched.

### Implemented R1B behavior

- One versioned `visual-package/v1` manifest now carries candidate and approved lifecycle state, exact normalized story-source identity, canonical template digest/schema, cover/page coverage identity, candidate review/provenance digests, structured author/reviewer reality metadata, Guy approval, and exact approved Set Identity Board artifact identities.
- `worldMode` is reviewer-owned structured metadata (`grounded`, `grounded_with_visual_metaphor`, or `fantastical`). It is not inferred from direction and is not consumed by runtime prompts or Director logic in R1B.
- The existing offline extractor/compiler now emits source-bound candidate evidence. No second compiler or visual-contract schema was added.
- `promote-visual-package` prepares a candidate by default, validates an exact approval as a dry run, and writes only with explicit `--promote`. It rejects missing/wrong approval, wrong story, stale source/template, unsupported/invalid templates, missing cover, incomplete/duplicate/out-of-range pages, unresolved or changed boards, and review/provenance/evidence disagreement.
- Promotion and qualification reuse the existing template validator and Set Identity Board registry validation/projection. The pure board registry path builder was separated from live storage resolver dependencies so offline paths cannot reach storage.
- The reusable qualification evaluator returns structured issue codes and never counts a legacy contract or enforcement-off fallback as qualified.
- The all-slot audit emits one record for every 18 nominally sellable slots, with `productSellable` and `renderQualified` reported separately. With the v3 product flag enabled, the actual audit reports 18/18 product-sellable and 0/18 render-qualified because no real approved visual package was promoted.
- `release-check` remains report-only by default and explicitly says it is not a render-readiness claim. `--require-render-qualified` is the deliberate fail-closed strict mode.
- The shipped Style01 cover and page provider entry points are wrapped by a synchronous qualification preflight. When existing visual-contract enforcement is enabled in a non-production environment, a missing/stale/contradictory package throws before the provider callback. Enforcement off preserves the documented non-qualified legacy path, and Vercel production remains hard-off even if the flag leaks on.
- No real story, template, board, visual-package, world prompt, Director behavior, customer availability, or `0.70` resemblance threshold was changed.

### R1B validation and limitations

- Focused lifecycle/runtime/release/compiler/board regression suite: **PASS - 11 files, 182 tests**.
- `npx --no-install tsc --noEmit`: **PASS** after the final implementation changes.
- Actual all-slot audit with `ENABLE_V3_APPROVED_BANK=true`: **18 records, 18 product-sellable, 0 render-qualified**; every current record reports structured `approved_package_missing`.
- Full remaining repository suite excluding only the five known ignored-output fixture files: **PASS - 224 files / 2,305 tests passed; 16 files / 65 tests skipped**.
- Literal `npm run check -- --silent`: TypeScript **PASS**; Vitest **FAIL - 8 tests in 7 files**. Six failures are the recurring absent ignored `outputs/` fixtures in `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and `story-read-back-validation.spec.ts`. Under the full parallel load, `qa-console-anchor-durable.spec.ts` and `generate-board-model.spec.ts` also exceeded their 5-second timeouts; both passed immediately in isolation (**2 files / 5 tests**) and passed again in the full non-fixture suite. No user-owned output artifact was copied into this worktree.
- Tests and audit used only local files and mocks. No image/audio render, live compiler, LLM, network/product API, database write, migration application, deployment, push, or production action occurred.
- The worktree had no dependency installation; validation used an ignored junction from this worktree's `node_modules` to canonical `C:\GNart\Work\Small_Heroes\node_modules`. It remains available for independent QA and is not a repository change.
- R1C runtime world authority/Director changes, R2 recovery, story/catalog authoring, Lion work, board reuse/generalization, real promotion, production cutover, and any render remain out of scope.

### Independent R1B QA verdict

- Claude Code reconciled the exact branch, clean worktree, `57291998` HEAD, `4a5dd041..57291998` range, two-commit lead over R1A, 12-commit lead over main, absent upstream, and absence of real story/template/board/package artifacts in the diff.
- It independently proved all 13 implementation claims, including the source-bound package identity, dry-run-by-default promotion, structured fail-closed qualification, all-slot accounting, strict release mode, pre-provider cover/page guards, production hard-off, offline-only dependency boundary, and exact Set Identity Board re-resolution.
- It independently ran the three load-bearing visual-package/preflight/release specs: **PASS - 28/28 tests**. The broader reported suites and baseline fixture/time-out limitations remain documented above.
- Non-blocking operational note: enabling non-production enforcement while the catalog is still 0/18 qualified deliberately hard-throws before image-provider invocation. Keep enforcement off until reviewed packages are promoted, and verify downstream order-to-hold handling before any staging enablement.
- Declared runtime limitation: provider guards are proven by code and zero-cost tests, not by a real end-to-end order or provider boundary. That later proof still requires the separately approved smallest-runtime milestone.

### R1B next gate

The independent technical gate is complete and Codex found no valid defect requiring a fix. Guy now decides whether to accept/close R1B, authorize its push, and authorize R1C as a separate zero-image execution milestone. The QA PASS is not authorization to promote a real package, enable enforcement, call a provider, run the one-LOW-page proof, or begin Lion/catalog work.

## R1A independent QA result — latest state

R1A is implemented and locally committed. Independent Claude Code adversarial QA returned **PASS (R1A only)** with no blocker, major, or minor implementation defects. Guy subsequently accepted/closed R1A and authorized R1B. This section records the external QA verdict and historical R1A evidence; it is not a Codex self-award.

### Topology and commits

- Dispatch started from a clean detached worktree at feature commit `ef543312` (4 ahead / 0 behind `origin/feat/chunked-generation` at `b4813c04`).
- Canonical `main` and `origin/main` were both `ed1da86c`; feature versus main was 4 unique feature commits / 9 unique main commits.
- The existing Codex worktree was attached to `codex/r1a-render-loop-phase1`; no additional worktree was created.
- `ec6c2ec7` — clean merge of canonical `main` through `ed1da86c`, preserving the four feature commits and governance documents.
- `f4c335f6` — `fix(render-loop): gate regeneration on verified QA`.
- `74a73863` — `fix(render-loop): persist cover candidate before QA`.
- `2d5ed60d` and `1f26cb58` — focused `CURRENT.md` implementation handoff updates.
- Claude Code independently reviewed runtime range `ec6c2ec7..74a73863` and verified topology at `1f26cb58` on `codex/r1a-render-loop-phase1` with a clean worktree.
- At that reviewed topology, the branch was 9 ahead / 0 behind both `main` and `origin/main`, and 18 ahead / 0 behind `origin/feat/chunked-generation`; it had no upstream. This `CURRENT.md` update changes documentation only.

### Implemented behavior

- Durable QA classification now distinguishes `verified_pass`, `verified_visual_failure`, and `evidence_unknown`.
- Only a verified visual defect/hazard on the persisted Style01 candidate can reserve regeneration and render replacement bytes.
- Malformed, transport/HTTP, timeout, skipped/unavailable, strict-follow-up unknown, and inconsistent evidence all hold without reserving regeneration.
- Retryable evidence failures get at most two same-candidate re-QAs; skipped/unavailable vision is not pointlessly retried in-process.
- Every primary QA and strict-crib fetch gets a fresh dedicated `AbortSignal.timeout`; the default is 30 seconds and `PAGE_VISUAL_QA_TIMEOUT_MS` can lower/override it.
- Candidate persistence failure remains non-throwing but now immediately holds before QA, budget reservation, or replacement generation.
- The shipped cover path now persists its uploaded candidate as durable page `0` before QA; pages and cover share the same upsert helper.
- The caller enforces the visible one-candidate plus two-replacement bound even if a durable reserver incorrectly keeps granting.
- Shipped ordering is covered as upload → awaited candidate persistence → QA of that exact durable URL.
- OpenAI `images.generate` and `images.edit` both have explicit request-option and live-abort coverage.
- No resemblance threshold changed; `0.70` remains intact.

### Files in the R1A commit

- `backend/providers/image.ts`
- `lib/generation-pipeline/page-visual-qa.ts`
- `lib/generation-pipeline/chunk-runner.ts`
- `lib/__tests__/image-style01-qa-regeneration.spec.ts`
- `lib/generation-pipeline/__tests__/page-visual-qa-timeout.spec.ts`
- `lib/generation-pipeline/__tests__/page-visual-qa-requa.spec.ts`
- `lib/__tests__/generate-image-cancellation.spec.ts`

### Validation evidence and limitations

- Independent Claude Code adversarial QA: **PASS (R1A only)**. It independently read the shipped page and cover paths and concluded that no evidence-unknown outcome can reserve regeneration budget or generate replacement bytes, with visual readiness both enabled and disabled. It found all 20 claims in the QA brief supported.
- Focused R1A suite: **PASS — 6 files, 65 tests**.
- `npx tsc --noEmit` / local `tsc --noEmit`: **PASS**.
- Literal `npm run check`: TypeScript **PASS**; Vitest **FAIL — 6 tests in 5 unrelated files** because this clean worktree lacks their untracked, ignored `outputs/` fixtures. The affected files are `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and `story-read-back-validation.spec.ts`. Every missing artifact is ignored by `.gitignore:65`; none is tracked.
- Full remaining suite with only those five fixture-dependent files excluded: **PASS on the first run**. A later diagnostic rerun exposed a Vitest/tinypool `ERR_IPC_CHANNEL_CLOSED` infrastructure flake, so no stronger full-suite claim is made.
- The clean worktree had no dependency directory. Validation used a temporary ignored junction to canonical `node_modules`, then verified and removed the junction. An initial `npx` attempt before that junction may have fetched a transient Vitest package into the user npm cache; it did not modify the repository or call any product/paid API.
- Zero image renders, audio renders, paid/product API calls, database writes, migrations, deployments, pushes, or production actions were performed.
- R1B/R1C, promotion/preflight, `worldMode`, Lion, story/catalog content, Set Board reuse, and full-book work remain out of scope and untouched.
- Claude Code noted one deferred recovery concern: the operator-only single-page regeneration path does not supply `onPageCandidateUploaded`, so it lacks the page/cover crash-recovery record. The R1A safety gate still applies and there is no regeneration bypass; track the recovery wiring for R2 rather than expanding R1A.
- Claude Code also noted that evidence-unknown results now hold for human review instead of being accepted by legacy behavior, which may increase human-QA volume. This is the intended fail-closed R1A tradeoff.
- No real database or paid image boundary was exercised. Candidate-persistence wiring is statically and locally tested, while a real runtime boundary remains a separately authorized later proof.

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
- R1B now provides explicit approved visual-package promotion, structured qualification, all-slot audit, and strict release qualification. No real package has been promoted, so all current slots remain unqualified.
- The strict LLM draft schema cannot currently author `setIdentityId`/`setReference`, even though downstream contract types can represent them.
- The cover fallback can inject literal `home-night`; generic derived locations do not provide reliable set topology or references.
- The Director sees authored image direction, runs pages in parallel, and receives only a previous-page text snippet rather than authoritative previous blocking/emotion. The complete frozen page contracts already contain the better deterministic continuity plan.
- Set Board registry/storage is deliberately story-scoped. Cross-story reuse is not yet proven and will not be generalized now.

## Historical render-loop Phase 1 re-gate (before the R1A fix)

Feature commits through `ef543312` add useful foundations: no hidden OpenAI image retry, cancellation plumbing, same-image malformed re-QA, and pre-QA uploaded-candidate persistence. `npm run check` passes.

At `ef543312`, the slice remained **NO-GO**:

1. The same-image helper returns persistent malformed QA as unverified, but the shipped Style01 caller treats unverified as regeneration-eligible and can spend a new image. That violates the requirement that only a verified visual failure may consume regeneration budget.
2. The visual-QA fetch has no dedicated AbortSignal/timeout.
3. Tests cover the helper but not the caller-level budget decision, so the green suite is false confidence for this requirement.
4. Candidate persistence has no regression test proving the shipped Style01 order: upload → persist candidate → QA.

That historical blocker was corrected by `f4c335f6` and `74a73863`, then independently PASSed for R1A. This does not itself authorize a measurement render.

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

1. Correct render-loop Phase 1 with caller-level tests and bounded QA; run `npm run check`; Claude Code re-gate. **Complete locally; independent R1A PASS received.**
2. Implement visual-package promotion and all-slot render-qualification audit/release gate, with zero image calls. **Complete locally at `da1914cb`; independent R1B QA PASS received with no implementation defects.**
3. Consume reviewer-owned `worldMode` at runtime, extend strict draft support for board bindings, and bound/remove legacy world fallbacks from the sellable path.
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

- Claude Code independently reviewed `ec6c2ec7..74a73863` plus the handoff/topology at `1f26cb58` and returned **PASS (R1A only)** with no blocker, major, or minor implementation defects.
- Claude Code independently reviewed R1B range `4a5dd041..57291998` and returned **PASS (R1B only)** with all 13 claims proven, 28/28 independently run load-bearing tests passing, and no finding requiring a Codex fix or re-gate.
- The independent report explicitly confirmed the load-bearing page and cover claim across readiness ON/OFF: only verified visual failure can reserve regeneration or create replacement bytes; malformed/error/timeout/skipped/unavailable evidence holds without either action.
- Its non-blocking observations are preserved above; neither its later LOW-page recommendation nor the PASS itself is treated as render authorization.
- Read the attached Codex architectural verdict and traced its claims through loaders, guards, compiler scripts, Director call sites, board registry/storage, tests, and feature commits.
- Ran `npm run check` on `feat/chunked-generation`: PASS, while caller review still found the regeneration-evidence bug above.
- Ran `npm run release-check` on `main` with `ENABLE_V3_APPROVED_BANK=true` and `SKIP_DB_SCHEMA_CHECK=true`: PASS and 18/18 product-sellable. This was a catalog/config check only, not a database release proof.
- Enumerated tracked contract and board artifacts from Git.
- No image, audio, external API, database write, migration, deployment, or production action was performed.
- Claude Code reviewed `b4813c04..8ba57d18` and correctly found that the post-handoff Git state no longer matched this file. Guy's preceding message establishes that he performed the push after preparation; the finding is accepted as a stale-state defect, not an authorization breach.
- Claude Code separately PASSed the repository-topology rules in `8ba57d18..6748b813`, then issued PASS WITH MINOR NOTES for the state-reconciliation range through `6f82ef84`, closing the authorized-push defect. The resulting explicit-deletion-approval follow-up is isolated in `4ea19395` for its own micro re-gate; no runtime or product scope is implied.

## Blockers

- Guy accepted/closed R1A and authorized R1B under the image-generation architecture Decision Gate.
- R1B has independent technical PASS and requires Guy's accept/close, push, and R1C authorization decisions before the workflow advances.
- The one-LOW-page proof requires separate explicit cost approval.
- Lion requires separate product/content acceptance; technical readiness alone is insufficient.

## Next action

Guy reviews the independent R1B PASS and decides whether to accept/close R1B, push `codex/r1b-visual-package-promotion`, and authorize a separate R1C execution thread. Until that explicit decision: do not push, start R1C/R2, promote a real package, import ignored user fixtures, render, exercise a real database boundary, change production flags, or begin Lion/catalog work. The one-LOW-page proof remains a later, separately cost-approved milestone.
