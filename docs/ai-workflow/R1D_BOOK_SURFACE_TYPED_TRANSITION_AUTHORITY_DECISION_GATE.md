# Decision Gate — BookSurface Typed Transition Authority

**Status:** approved by Guy on 2026-08-26; implemented offline; independent Claude Code QA pending
**Date:** 2026-08-26
**Owner:** Codex
**Branch/worktree:** `codex/r1d-qa-wizard-downstream-lifecycle` in
`C:\GNart\Work\sh-live-chameleon-v3`
**Diagnosis base:** `0269d3ae3f27eece591a9cd89399f5d3e4f7c18c`
**Implementation base:** `d88337288db1eeb895cb9355f40ec23385436dee`

## 1. Proposed change

Replace the under-specified transition portion of the BookSurface repair input
with one closed, typed and integrity-bound authority while preserving every
validation rule and provider-owned narrative decision.

1. Extract the existing transition checks into one pure analyzer shared by
   `validateVNextVisualContract` and BookSurface authority construction. The
   analyzer owns both the unchanged human-readable validator messages and a
   closed typed subtype for every current transition failure branch.
2. Keep the existing broad `page_transition_invalid` structural cause for
   compatibility and add the exact typed subtype to the same canonical
   `causes` array. Diagnostic identity remains strictly
   `family + code + locator`; unique counts, persistent/new/resolved state and
   route selection must not change.
3. Give BookSurface one compact ordered transition-chain authority derived from
   the exact effective compiler-canonicalized draft the validator saw. It must
   include the actual sorted predecessor/successor, current effective zone and
   transition, established zone IDs before each affected page, and the prior
   threshold edge. It must distinguish authored writable transition bytes from
   the effective read-only transition state.
4. Bind that chain, the typed subcauses and every affected page into the
   existing BookSurface authority digest. Re-derive and verify the authority
   before prompt construction and before apply. Missing, stale, ambiguous,
   duplicated, out-of-order or mismatched state fails closed.
5. The provider may change `kind` and `cue` only because `transition` is the
   explicitly writable field for that page. They remain provider-authored
   narrative authority. The compiler continues to own canonical endpoint IDs
   and does not invent or silently overwrite a narrative kind or cue.
6. Keep the BookSurface response schema/name/version byte-identical. Advance
   only the diagnostic/prompt and canonical request/Fresh authority versions
   required to prevent old consumed inputs from being reused.

No raw validator prose, rejected draft, story-source prose, credential,
provider response, attempt index or "try something different" hint enters the
repair payload.

## 2. Why now?

The second bounded paid attempt was consumed without a Candidate. Its complete
normalized issue trail was:

```text
21 -> 17 -> 12 -> 9 -> 7 -> 7 -> 7
```

BookSurface resolved transition failures on pages 4 and 7 but left pages 2, 3
and 6, while four represented-elsewhere pointers remained intentionally
deferred. Calls 6 and 7 had different user-prompt digests but the exact same
response digest. The final exact draft plus complete diagnostic fingerprint was
unchanged, so the stagnation guard stopped correctly. Another call with the
same information would be unjustified spend.

The current provider input cannot represent all facts used by the validator.
In particular, a page-3 `after_transition A -> B` can be valid after a matching
page-2 `threshold A -> B` and invalid after page 2 is merely
`after_transition A -> B`, even when page 3 sees identical previous/current/next
zone IDs. The missing previous transition and `lastThresholdEdge` make those
states provider-indistinguishable. The full established-zone history creates a
second independent counterexample.

This blocks Candidate creation, the revised Story Source, Blueprint/package
progression, the QA Wizard proof and every render.

## 3. Scope

This is a **general compiler and repair-authority change**. It is not specific
to Chameleon, Bar, Kim, bedtime, any page number, any zone name or any story.
It applies to every vNext contract using the existing transition state machine.

Expected production surfaces:

- `lib/visual-contract-compiler/draftValidationDiagnostics.ts`
- a new pure transition-analysis module under
  `lib/visual-contract-compiler/`
- `lib/visual-contract-compiler/validateVNextVisualContract.ts`
- `lib/visual-contract-compiler/bookSurfaceRepair.ts`
- canonical authoring lifecycle/materialization/Supervisor/Fresh version
  authorities and their exact tests
- focused compiler, diagnostic, repair-loop and offline-harness tests
- `CURRENT.md` and implementation evidence

`pageContractRepair.ts` remains unchanged. Investigation proved that
`compileBookVisualContractTemplate.ts` must retain the exact effective draft
and a compiler-captured expected authority digest across dispatch and apply.
That narrow scope expansion is required to prevent a caller from coherently
rehashing a downgraded target set and its replacement authority; it does not
widen repair routing or writable fields.

## 4. Risk of hardcoding

The design contains no story, child, companion, page or zone literal. The
closed subtype catalog is exhaustive over the validator's existing rules, and
the shared analyzer prevents a second transition state machine from drifting.
TypeScript must force an explicit repair-authority decision for every future
subtype.

## 5. Expected authority cutover

The implementation must verify, rather than assume, this cutover census:

| Surface | Current | Proposed |
|---|---:|---:|
| Draft attempt diagnostics | v4 | v5 |
| BookSurface output schema | v7 | unchanged |
| BookSurface system/user prompts | v12/v12 | v13/v13 |
| Authoring request/receipt/readiness | v51/v53/v51 | v52/v54/v52 |
| B0 input/manifest/verification | v39/v49/v49 | v40/v50/v50 |
| Execution materialization input/result | v35/v40 | v36/v41 |
| Supervisor request/readiness/result | v45/v45/v37 | v46/v46/v38 |
| Fresh Readiness evidence | v45 | v46 |

The BookSurface output schema digest
`a1d16581b25d9af14b33fdaa21806713f739212e51afa53643ba4c030739b20f`
must remain unchanged. Template draft schema v21, authoring policy v18,
standard output budget v6, model, reasoning, seven-call limit, zero retries,
no fallback, `$10` ceiling, Candidate v9, Wizard bridge v4 and every downstream
render shape remain unchanged.

## 6. Expected behavior after change

- Every existing transition validator error keeps the exact same prose, order,
  emission count and pass/fail result.
- Every transition error also carries the broad compatibility cause plus one
  exact closed typed subtype.
- BookSurface sees the effective ordered transition state and all state the
  validator used, without raw error prose.
- Atomic adjacent-page repair can reason about coupling instead of treating
  each target as an isolated page-number neighbor.
- Only `transition` is writable for transition-only targets; all other page and
  book fields remain byte-preserved.
- Represented-elsewhere stays pure and deferred until the structural frontier
  closes. The scheduler, regression guard and stagnation guard are unchanged.
- A structurally invalid patch still fails full validation and cannot mint a
  Candidate.

## 7. Validation plan

All proof is `$0` and offline before independent QA:

1. Table-drive every current local and cross-page transition branch: invalid
   kind; steady destination; undeclared origin/destination; equal endpoints;
   before-transition destination/alignment; after-transition alignment;
   threshold alignment; opening departure; undeclared steady/before move;
   unestablished origin; discontinuous origin without valid threshold
   continuation. Assert unchanged messages/order/count and exact subtype.
2. Prove diagnostic compatibility: the broad cause remains, the issue key and
   unique count remain unchanged, subtype unions are sorted/unique, and subtype
   changes remain the same persistent identity while changing the complete
   state fingerprint.
3. Prove two information-equivalence counterexamples now diverge in decoded
   BookSurface input: prior-threshold continuation and established-zone
   history.
4. Cover effective-versus-authored transition normalization, actual sorted
   predecessor/successor, out-of-order arrays, gaps, duplicate page numbers,
   first/last pages and ambiguous topology.
5. Cover coupled adjacent targets where changing the earlier page changes the
   later page's continuity state. Use the production compiler and real
   validator; a hand-authored stub may stand in for the provider but may not
   stand in for validation.
6. Reproduce the live-shaped mixed frontier and prove a monotonic
   BookSurface-to-pure-represented-to-Candidate route with zero provider calls,
   no full-draft fallback and no extra call. Retain counterexamples proving
   regression and exact-state stagnation stops.
7. Assert decoded provider input contains no raw validation prose, rejected
   draft, attempt index, credential or hidden source material; tampering and
   stale authority fail closed.
8. Measure exact 8-page and 12-page prompt/schema input ceilings. The latest
   live BookSurface maximum was 34,461 estimated bytes, leaving 25,443 bytes of
   measured room after the protocol allowance, but the new payload must be
   measured rather than assumed safe.
9. Run focused suites, the broader compiler/lifecycle matrix,
   `npx tsc --noEmit`, `git diff --check`, and one literal `npm run check`.
10. Commit locally, update evidence, and send the immutable range to Claude
    Code for adversarial read-only QA. No Fresh or live until PASS.

Acceptance is not merely delta `<= 0`: the transition counterexamples must
reach zero real validator issues, the mixed route must reach Candidate, and no
unrelated diagnostic family may grow.

## 8. Cost impact

Implementation and all validation in this gate cost `$0` in product/provider,
image and audio spend. They use no credential. This gate does not authorize a
new Fresh, provider call or render. Under the binding two-failure stop rule, a
future single bounded live attempt requires a separate explicit Guy decision
after Claude Code PASS.

## 9. Rollback plan

The change is one focused offline commit plus any separate QA correction.
Rollback is a normal revert before a new Fresh root exists. Consumed v51/v53
artifacts remain immutable historical evidence and are never rewritten,
migrated or reused. The current v7 response schema stays available unchanged.

## 10. Review assignment and decisions

Guy authorized this exact typed transition-authority design on 2026-08-26 and
confirmed that a transition-authorized repair may replace provider-owned
`kind`/`cue` while the compiler itself never chooses them.

Claude Code must try to falsify:

- completeness of the subtype catalog against every validator emission;
- exact preservation of validation rules/messages and diagnostic identity;
- use of effective rather than stale authored state;
- actual sorted topology and multi-page coupling;
- absence of raw prose, attempt-index nudging and write-authority widening;
- schema-digest preservation and full protocol cutover;
- input ceilings, tamper rejection and unchanged stop guards.

No Claude Cowork product/creative review is required: this gate preserves the
existing narrative-authority decision and changes only technical evidence
available to the repair route.

## 11. Rejected alternatives

- **More calls, budget, model changes or best-of-N:** forbidden by the stop
  rule and do not add missing information.
- **Prompt prose only:** duplicates validator semantics and can drift.
- **Raw English validator messages:** not a stable typed contract and weakens
  privacy/observability guarantees.
- **Attempt index or "try differently" hint:** encourages variation without
  supplying truth; a different response digest is not correctness.
- **Compiler-owned deterministic kind selection:** conflicts with the current
  provider-owned narrative decision and can choose the wrong visual beat.
- **Widen represented-elsewhere admission:** orthogonal to transition closure.
- **Compound represented-plus-transition route:** adds schema and scheduler
  complexity without fixing the information gap.

## 12. Do not do

- Do not run Fresh, preflight, Supervisor live, provider, image, audio, Vision,
  Wizard order, fake payment or render under this gate.
- Do not increase calls, output caps, budget, retries or fallback.
- Do not change validation rules, error messages, transition semantics,
  Candidate semantics, Wizard selection or downstream render contracts.
- Do not patch Chameleon, Bar, Kim or pages 2/3/6 specially.
- Do not reuse or mutate either consumed Fresh root.

## 13. Offline implementation outcome

The approved design is implemented locally on top of `d8833728`. The shared
analyzer covers all thirteen existing transition failure branches; the
validator emits the unchanged broad compatibility cause plus the exact closed
subcause; and BookSurface carries one effective ordered chain with the state
used by validation. The provider-visible projection omits raw diagnostic prose,
the rejected draft, credential/provider material and the private authority
digest. `kind` and `cue` remain provider-owned.

The compiler stores both the exact effective draft and the original expected
authority digest. Prompt construction and patch application independently
re-derive the authority and reject missing, stale, rehashed, downgraded,
duplicated, gapped, out-of-order or endpoint-incompatible evidence. Canonical
ordering uses an explicit lexical comparator, including mixed-case and
punctuation-bearing zone IDs.

The required cutover census matches section 5 exactly. The BookSurface schema
remains v7 with digest
`a1d16581b25d9af14b33fdaa21806713f739212e51afa53643ba4c030739b20f`.
The five-file load-bearing matrix passes 201/201 and TypeScript passes. Exact
transition-chain accounting is 26,776 bytes for eight pages and 30,631 bytes
for twelve pages plus 84 typed prop violations; both remain route-admissible
with at least 4,096 bytes of headroom. The adjacent coupled-page harness reaches
`3 -> 1 -> 0`; the historical live-shaped mixed harness remains
`19 -> 6 -> 5 -> 0`, reaches Candidate and uses zero provider calls.

Literal `npm run check` on the final bytes passes both TypeScript phases, 3,736
ordinary assertions and 613/613 resource-intensive assertions. Its exit 1 is
fully explained by nine pre-existing missing ignored-output fixture assertions
in five unchanged files plus three known Vitest `onTaskUpdate` RPC timeouts;
no changed-code assertion fails.

No Fresh, credential, provider, live authoring, Candidate publication, Wizard
order, payment, render, deployment or push occurred. The implementation is not
accepted until local implementation commit
`ee61db4d908fce3b1407734d5cb61c991e32de30` plus this post-commit documentation
reconciliation receive an independent Claude Code PASS.
