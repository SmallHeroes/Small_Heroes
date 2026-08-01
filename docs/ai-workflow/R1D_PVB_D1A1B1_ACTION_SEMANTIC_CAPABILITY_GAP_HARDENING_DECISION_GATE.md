# R1D-PVB-D1A1B1 Action Semantic Capability-Gap Hardening Decision Gate

**Status:** APPROVED by Guy in delegated implementation Task `019f893a-73df-7ac2-b580-20761e4f25ac` on 2026-08-01
**Immutable base:** `01a117570c0ee7c4e3de8d138ae1a8db4d8a00fa`
**Implementation branch:** `codex/r1d-pvb-d1a1b1-action-semantic-capability-hardening`
**Implementation worktree:** `C:\Users\guyna\.codex\worktrees\a7ee\Small_Heroes`
**Cost boundary:** zero external calls or spend

## 1. Proposed change

Generalize the closed Action Semantic authority so a Story Source can represent:

1. an intransitive bodily action;
2. an exact same-page source-grounded environmental phenomenon acting on an entity;
3. moving an object with an explicit typed spatial result.

The implementation replaces cast-only `actorId` with a typed subject, extends the catalog with subject-kind and spatial-result authority, adds only the general predicates `sneezes` and `moves`, permits a source-grounded phenomenon subject for `touches`, and makes Blueprint authoring prove the complete typed action and destination feasibility.

## 2. Why now?

The exhausted post-Source-Evidence attempt completed one provider response and then terminated on three exact compiler-derived capability gaps: an intransitive sneeze, a drop touching a finger, and an object moving sideways. Compact Source Evidence repair correctly refused them because they were semantic capability gaps, not evidence-ID failures. No candidate or downstream authority exists.

The root cause is general: the closed catalog could express only cast subjects and object-oriented predicates, while Blueprint had no typed movement result/destination contract. Prompt prose or story-specific aliases would not create provable authority.

## 3. Scope

This is a general system change covering Action Semantic schema/catalog/compiler/validation, Source Evidence phenomenon binding, Blueprint schema/authoring/validation/feasibility, runtime projections, lifecycle/B0/execution/readiness version and digest bindings, explicit offline migration, focused fixtures/tests, and durable documentation.

It does not change Story Source bytes, model/provider configuration, token/call/repair budgets, retry/fallback/timeout/cost policy, render behavior, storage, database state, or production activation.

## 4. Risk of hardcoding

Production logic may not contain a story, child, companion, page, cast ID, prop ID, source excerpt, direction phrase, or observed failure literal. Phenomena bind to exact same-page Source Evidence IDs; all entity and spatial targets resolve through closed typed identity. Neutral synthetic fixtures establish the three semantic classes, while corpus traversal is calibration evidence only.

## 5. Files likely affected

- `lib/visual-contract-compiler/` catalog, draft schema, compiler, validation, projection, migration, and tests
- `lib/visual-package/` Blueprint, package lifecycle, production authoring, B0/execution/readiness authority, and tests
- `lib/generation-pipeline/` render qualification and runtime Blueprint projections
- `backend/providers/image.ts` current runtime-authority binder
- `scripts/` canonical readiness entry/launcher version bindings
- `CURRENT.md` and durable Decision Gate/evidence records

## 6. Expected behavior after change

- Typed subjects support visible entities and exact same-page source-grounded phenomena; there is no fuzzy/free-text identity.
- `sneezes` is cast-only and intransitive.
- `moves` requires a typed object and a closed spatial effect. It cannot compile as or be substituted by `pushes`.
- `touches` can use a phenomenon subject only when exact Source Evidence proves it on that page.
- Subject, object, and spatial target resolution is local and fail-closed, including prop reveal/forbidden state.
- Blueprint proves action space, supported subject/predicate/entities, action placement, and directional or relation-target destination feasibility.
- `maximumActors` counts unique cast subjects only.
- Visually required phenomena cannot pass through prose-only `represented_elsewhere` coverage.
- Unsupported gaps remain sanitized terminal failures and cannot activate Source Evidence compact repair.
- Historical authority stays byte-immutable and rejected as current; explicit migration creates a separately validated current in-memory value without modifying old bytes.
- The real Wizard/order path can freeze an exact `visual-package/v4`, project its Blueprint into runtime frame authority, and fail before provider reachability when a binding is stale.

## 7. Validation plan

1. Neutral catalog/compiler/validator/prose/check-ID/Source-Evidence tests for sneeze, phenomenon touch, directional movement, relation-target movement, and push non-substitution.
2. Calibration traversal with no production story literals.
3. Blueprint schema/authoring/validation tests for placement, action-space support, destination regions, relation targets, and cast-only actor capacity.
4. Lifecycle, package, B0, execution, Supervisor, readiness, and historical-version rejection tests.
5. Zero-cost Wizard/product-truth → order selection → frozen package → Blueprint book/frame projection → chunk-runner qualification test with a provider sentinel.
6. Repository-local TypeScript, focused Vitest gates, exactly one literal `npm run check`, and `git diff --check`.
7. Three explicit-path local commits, clean topology reconciliation, and read-only independent Claude Code QA.

No full book render or image sample is authorized.

## 8. Cost impact

Expected external spend: **$0.00**. Provider/model/image/Vision generations: **0**. The approved model, 64K ceiling, call/repair caps, retry/fallback policy, timeout, accounting, and hard `$5.00` ceiling remain unchanged.

## 9. Rollback plan

Revert the three focused local commits. No external state, historical artifact, database, storage object, approval, publication, or deployment requires reversal. The previous closed authority resumes rejecting these capability gaps.

## 10. Review assignment

Guy approved all nine architectural decisions and the three-commit implementation shape. Claude Code's first pass is read-only and must try to falsify typed identity, phenomenon/source binding, movement spatial-result enforcement, push non-substitution, Blueprint feasibility, cast-only capacity, version/digest completeness, immutable historical rejection, exact Wizard/runtime qualification, provider unreachability, and every unchanged budget/policy fence.

Claude Cowork review is not required for this code/schema milestone. Product and visual acceptance remain Guy's.

## 11. Do not do

No credential loading/check, pricing/network lookup, provider/model call, live authoring, real B0/readiness execution, render, image/Vision/audio, storage/database, Board action, Semantic Reconciliation, approval, publication, promotion, activation, deployment, PR, push, cleanup, story-specific production patch, fuzzy matching, prompt-only spatial authority, or budget/policy change.

## Stop-check record

- General system fix: **yes**.
- Cross-story risk controlled: **yes**, through closed typed contracts and neutral fixtures.
- Major authority change: **approved by Guy** through the delegated nine-decision brief.
- Spend/render allowance: **none**.
- Smallest proof: repository-local compiler/Blueprint/runtime tests only.
- Remaining product decision: **none for implementation**.
- Independent technical PASS: **not self-awarded; Claude Code re-gate required**.
