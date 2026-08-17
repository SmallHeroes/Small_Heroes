# R1D Deterministic Action-Binding Normalization and Repair-Output Observability — Decision Gate

**Date:** 2026-08-17

**Status:** approved for implementation under Guy's standing instruction to
continue autonomously toward a real QA Wizard render, while preserving every
canonical and independent-QA gate

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Branch:** `codex/r1d-deterministic-action-binding-normalization`

**Exact base:** `097282d547cbbeb7aeb1db66988ef9729c7caddf`

## 1. Proposed change

Close the post-live diagnostic gap for the four compiler-owned atomic
action-binding application errors, and move the exact duplicate-beat / missing
coverage closure from a paid provider repair into a deterministic,
compiler-owned normalization before semantic grounding.

The normalizer is intentionally narrow. It handles only a complete component
in which two or more same-page actions share one valid beat ID, exactly one
same-page coverage record uses that beat, that coverage disposition is exactly
`action_requirement`, and its Source Evidence ID resolves canonically on the
same page. It keeps the first action and existing coverage binding unchanged,
assigns deterministic collision-free page-scoped IDs to the remaining actions,
and appends only the exact missing coverage records with the existing Source
Evidence ID. Full compiler validation still decides whether a candidate exists.

## 2. Why now?

The consumed live attempt at
`outputs/r1d-atomic-binding-template-fresh-097282d5-20260817T102858388Z`
proved that the canonical provider boundary was healthy but the repair design
was not. Two provider calls completed with zero transport retries and no
fallback. The first response exposed 18 action-binding diagnostics arranged as
six exact duplicate components on pages 3, 6, 7, 11 and 12. The second response
completed the strict page-repair schema but was rejected during local atomic
application. No candidate was produced.

Receipt v32
`ecc8b9ec5b6e49162731e8e81a9e9684a5e457b074e36e578f862cbd690f0de3`
records `$1.426457` nominal / `$1.569111` conservative cost. The exact local
rejection is irretrievable because the four new component errors were omitted
from the closed repair-output identity catalog and collapsed to
`unclassified`. Another paid attempt would therefore be a blind guess.

Beat IDs are temporary compiler binding keys: after successful semantic
grounding the compiler replaces them with compiler-owned check IDs and removes
the draft beat IDs from final page action requirements. Asking a reasoning
model to invent these mechanical keys adds cost and failure surface without
granting useful creative authority.

## 3. Scope

This is a general compiler and evidence change. It is not specific to Dini, the
selected story, a child, companion, page, category or language string.

Expected implementation surfaces:

- `lib/visual-contract-compiler/` deterministic normalization and closed
  repair-output identity mapping;
- focused compiler, lifecycle and receipt/readiness regressions;
- `CURRENT.md` and implementation evidence.

No Story Source, prompt prose, image generation, Reader, Wizard UI, payment,
database, deployment or production surface is in scope.

## 4. Risk of hardcoding

The solution must derive authority only from current page structure, exact
typed dispositions, canonical Source Evidence resolution, page/action indexes
and collision-checked existing IDs. It may not contain story, character,
companion, page-content or locator literals from the consumed attempt.

## 5. Nine architectural decisions

1. **Compiler ownership:** exact duplicate action-binding components are
   mechanical identity defects and are normalized by the compiler, not sent to
   the provider.
2. **Exact eligibility:** normalization requires a valid page-scoped beat, at
   least two member actions, exactly one total coverage record for that beat,
   exact `{ kind: "action_requirement" }`, and a canonical same-page Source
   Evidence resolution. Any ambiguity leaves the draft unchanged for normal
   fail-closed validation.
3. **Minimum mutation:** preserve the first member's beat and the existing
   coverage record byte-for-byte; change only later member beat IDs and append
   exactly `memberCount - 1` coverage records.
4. **Deterministic identity:** generated IDs are page-scoped, stable from
   compiler-owned component/action coordinates, collision-checked against all
   existing page action and coverage beats, and independent of authored prose.
5. **Deterministic ordering:** pages, components and members use explicit
   numeric/lexical ordering; multiple components on one page cannot depend on
   provider ordering or array-offset side effects.
6. **No budget consumption:** normalization occurs before provider repair and
   consumes no logical call, repair, transport retry or output-budget slot.
   Existing `3 / 2 / 0`, `[40000, 32000, 36000]`, no-fallback and hard `$5`
   policies remain unchanged.
7. **Full revalidation:** normalized pages traverse the ordinary source,
   action-semantic, structural, presentation, recurring-prop and final-template
   validators. No diagnostic is waived or relabeled to manufacture a candidate.
8. **Closed observability:** all four compiler-owned component application
   errors enter the sanitized identity catalog with exact broad-code mappings;
   unknown exceptions still collapse to `unclassified`, and component errors
   remain terminal rather than entering the legacy scalar scope retry.
9. **Compatibility and rollback:** historical artifacts remain immutable and
   readable under their existing versions. Repair-output diagnostics v2 is the
   sole current writer authority; exact v1 artifacts remain read-only under the
   frozen pre-v2 identity domain. Request v29, receipt v32, readiness v30 and
   authoring policy v12 remain unchanged because their envelope shapes and
   operational policy do not change. No database migration or artifact rewrite
   occurs. Rollback is a focused code/documentation revert; any future readiness
   on the reverted head becomes inapplicable.

## 6. Expected behavior after change

For the exact six-component topology observed live, assembly performs one
zero-cost local normalization, then exposes any remaining genuine
book-surface/action/presentation defects to the existing bounded repair router.
The provider never receives a request whose only job is to echo invented beat
IDs and duplicate an already-authoritative Source Evidence binding.

Malformed, unresolved, mixed-disposition, duplicate-coverage, cross-page,
collision, non-record, partial or otherwise ambiguous components remain
unchanged and fail through existing validators. Final candidate semantics and
downstream approval gates do not change.

## 7. Validation plan

The smallest proof is entirely zero-cost:

- direct pure-function tests for one component and six live-shaped components;
- two components on the same page and deterministic rerun/idempotency;
- collision, malformed beat, malformed/unresolved Source Evidence, multiple or
  non-action coverage, partial/mixed component and input non-mutation negatives;
- end-to-end lifecycle proof that the six components require no page-contract
  provider call and that the next genuine repair receives the unchanged second
  output budget;
- exact diagnostic mapping and receipt/readiness round-trip tests for all four
  component errors;
- adjacent compiler/lifecycle suites, deterministic TypeScript and
  `git diff --check`;
- one literal `npm run check`, without retry, followed by independent Claude
  Code read-only QA and any required re-gate.

No paid live or render validation is part of this implementation milestone.

## 8. Cost impact

Implementation and validation cost `$0`. The production path is expected to
save one text-provider repair call whenever the exact component pattern occurs.
No model, tier, reasoning, pricing, timeout, retry, fallback, call cap, repair
cap or output cap changes.

## 9. Rollback plan

Revert the focused normalization/diagnostic commit and its documentation
closeout. Historical failed receipt/readiness artifacts remain byte-immutable.
No data, package, lockfile, database or external-state rollback is required.

## 10. Review assignment and owner decision

Guy already authorized autonomous technical continuation to a real QA Wizard
render, with the explicit requirement not to bypass canonical or independent
QA gates. This gate introduces no new visual, story, pricing or product choice,
so no additional owner checkpoint is required before implementation.

Claude Code must try to falsify exact eligibility, collision freedom,
determinism, input immutability, multi-component ordering, no provider-call
consumption, unchanged budgets/policies, full revalidation, closed diagnostic
mapping, terminal/no-legacy-retry behavior and historical artifact
compatibility. Claude Cowork review is not required because this is not a
product/creative/UX decision.

## 11. Do not do

- Do not access credentials or `.env` during implementation/QA.
- Do not make provider/network/pricing calls, Fresh Readiness, preflight or live
  authoring calls before the implementation is committed, independently
  QA-passed and pushed.
- Do not render images, use Vision, publish a Visual Package, touch Board,
  storage/database, QA deployment or production.
- Do not change Story Source, prompts, schemas, model/tier/reasoning, token
  budgets, call/repair budget, timeout, retry, fallback, `$5` fence, candidate
  semantics or downstream approval authority.
- Do not rewrite or recompute the consumed live artifacts.

## Stop-check result

1. General system fix: yes.
2. Cross-story risk: bounded by exact structural eligibility and full
   revalidation.
3. Production behavior affected: yes, only compiler handling of mechanical
   duplicate bindings; therefore Decision Gate and independent QA are required.
4. Spend: `$0` for implementation; expected future savings.
5. Smallest validation: pure/unit plus one lifecycle simulation; no provider or
   image.
6. Guy decision: standing autonomous authorization is sufficient; no new
   product decision.
7. Claude target: falsify authority, determinism, collision and budget claims.
8. Cowork: not required.
9. Guy eyeball: only the later rendered page/book, after all downstream gates.
