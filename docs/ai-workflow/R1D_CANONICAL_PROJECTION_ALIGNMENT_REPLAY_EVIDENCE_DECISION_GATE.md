# Decision Gate — Canonical Projection Alignment and Replay Evidence

**Status:** approved by Guy on 2026-08-26; implementation complete locally;
independent Claude Code executable micro re-gate PASS; push/Fresh pending
**Date:** 2026-08-26
**Owner:** Codex
**Branch/worktree:** `codex/r1d-qa-wizard-downstream-lifecycle` in
`C:\GNart\Work\sh-live-chameleon-v3`
**Implementation base:** `eb161317414d8dc529ba4d7db392dc12c7055e69`

## 1. Proposed change

Close the compiler-created represented-elsewhere pointer defect and make every
captured response from a run that can advance replayable offline. A terminal
provider decode failure may discard an already captured prefix; that accepted
forensic-fidelity loss cannot mint a Candidate or advance the Wizard.

1. Make the initial/full-draft disposition binder enumerate the same canonical
   page projection that final Action Semantic validation resolves. Transient
   provider selectors for wardrobe and companion state may select a value, but
   the compiler must bind that value to its surviving final projection path.
2. Preserve the existing provider-owned disposition choice and contract value.
   The compiler owns only canonical pointer construction and exact value
   binding; it does not invent companion state, wardrobe, story meaning or
   presentation prose.
3. Persist every captured canonical structured provider response from a run
   that can advance as a local, content-addressed, sanitized evidence artifact
   when the live lifecycle is configured to write evidence. Bind its path and
   digest into the authoring receipt. Do not persist prompts, credentials,
   reasoning, transport headers or any unstructured provider material. On a
   terminal `provider_output_decode_failed`, discard the run's valid captured
   prefix and keep the replay locator null; this intentionally trades forensic
   fidelity for the smaller privacy surface on a run that cannot advance.
4. Add a replay loader that validates the artifact identity and feeds the same
   production compiler entry point used by live authoring. Historical receipts
   remain immutable and honestly non-replayable.
5. Keep the already implemented typed transition analyzer/authority. It
   addresses the three transition issues at the terminal F7 frontier; canonical
   projection alignment addresses the four companion-state pointer issues.

## 2. Why now?

The last bounded live run ended at the exact complete frontier:

```text
4 represented_elsewhere_pointer_unresolved
+ 3 page_transition_invalid
= 7 issues
```

The transition range addresses the latter three. Independent read-only
falsification found that the former four were manufactured by the compiler:
the binder resolved a provider-selected value against raw transient keys such
as `companionStateId`, while `overlayPage` later removed those keys and emitted
`companionStateOverride` before final validation. All 112 historical unresolved
pointer emissions occur only on the companion-transition pages 2/3/5/6 and the
wardrobe-transition page 8, matching the transient selector surface exactly.

Receipts retain diagnostics and a response digest but not the structured draft,
and the provider adapter uses `store:false`. Therefore no historical raw draft
can be replayed; synthetic fixtures were the only available proof. Continuing
without capture would repeat paid black-box diagnosis.

## 3. Scope

This is a general compiler/evidence change. It contains no Chameleon, Bar, Kim,
page-number, state-ID or wardrobe literal.

Expected production surfaces:

- `lib/visual-contract-compiler/initialFullDraftDispositionBinding.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts` only if
  the canonical projection authority must be passed explicitly
- authoring lifecycle/evidence types and validators under `lib/visual-package/`
- the existing content-addressed local artifact writer/loader boundary
- focused binder, compiler, receipt and offline-replay tests
- `CURRENT.md` and implementation evidence

The initial draft schema, provider model, call count, repair count, retry,
fallback, cost ceiling, Candidate semantics, Wizard selection and render
contracts remain frozen unless a required evidence-version cutover is proven.

## 4. Risk of hardcoding

The mapping is defined by canonical field roles, not story values. Every
supported transient selector must have one explicit surviving projection path;
unknown, duplicate, ambiguous or non-surviving candidates fail closed.

Tests must cover companion state, wardrobe, ordinary stable fields, collisions,
duplicate values, null selectors, malformed pages and legacy drafts.

## 5. Expected behavior after change

- A provider-selected companion state binds to the canonical surviving
  `companionStateOverride.stateId` path, not the deleted `companionStateId` key.
- A provider-selected wardrobe description binds to the canonical surviving
  `childWardrobeOverride.description` path, not its deleted raw selector.
- Ordinary fields that already survive projection retain byte-equivalent
  behavior.
- Binding and final validation operate on one exact domain; the compiler cannot
  create an unresolved pointer by deleting its own target.
- The terminal F7 shape can proceed through typed BookSurface transition repair
  and, when necessary, the existing pure represented-elsewhere lane.
- Every newly captured canonical structured response from a run that can
  advance can be loaded and replayed offline with verified bytes and digest,
  including a response received before a terminal post-response cost-ceiling
  classification. A run ending in `provider_output_decode_failed` remains
  fail-closed with no Candidate and intentionally retains no captured prefix.

## 6. Validation plan

All implementation proof remains `$0` and offline until independent QA passes.

1. Reproduce the historical defect with a transient companion state and prove
   the pre-fix target disappears from the final projection.
2. Prove the corrected binder targets the surviving companion and wardrobe
   paths and final Action Semantic validation returns zero pointer issues.
3. Cover duplicate/colliding values, wrong page, null/empty selectors,
   unsupported transient fields, stale authority and tampering.
4. Use the real revised-story source snapshot `35fe04ab...1f6a6c` and its actual
   companion/wardrobe continuity plan. No story-specific production branch is
   allowed.
5. Retain the production compiler harness proof for
   `BookSurface -> represented_elsewhere -> Candidate`, and add the canonical
   projection regression to that same entry point.
6. Write one structured draft artifact into a temporary output root; verify
   exact keys, content address, immutable replay, tamper rejection and receipt
   binding. Assert absence of prompt, credential, reasoning and transport data.
7. Prove Candidate-shaped output passes the existing offline bridge/package
   qualification boundary without publication.
8. Run focused suites, broader relevant lifecycle suites,
   `npx --no-install tsc --noEmit`, `git diff --check`, and literal
   `npm run check` with baseline failures reported honestly.
9. Commit locally and obtain independent Claude Code PASS before Fresh, live,
   Candidate publication, Wizard progression or render.

## 7. Cost impact

The offline milestone costs `$0`. After Claude Code PASS, Guy authorizes one
bounded live authoring attempt using the existing local `OPENAI_API_KEY` and,
if it produces a valid approved package and passes downstream gates, one full
paid book render through the QA Wizard for Bar, age 5, with mother narration.

No budget/model/call/retry/fallback increase is authorized. If the live attempt
fails, no second paid attempt occurs before replaying the newly captured draft
offline and identifying one proven root cause.

## 8. Rollback plan

The projection/evidence change is a focused commit after the two existing local
transition commits. It can be reverted normally before a new Fresh root is
consumed. Captured evidence is local, content-addressed and never promoted as a
Candidate. Historical receipts and consumed Fresh roots are never rewritten.

## 9. Review assignment

Guy approved implementation, reuse of the existing API key, one bounded live
authoring attempt after QA, and one full paid render after package/Wizard
qualification.

Claude Code must falsify:

- equality of binder and validator pointer domains;
- compiler-created unresolved pointers for every transient selector;
- ambiguity/collision and tamper behavior;
- capture privacy, content addressing, immutability and exact receipt binding;
- use of the production compiler/replay path rather than duplicate test logic;
- preservation of transition `kind`/`cue` as provider authority;
- unchanged model, budget, retries, fallback, Candidate, Wizard and render
  contracts.

Claude Cowork is not required for this engineering correction. Guy remains the
product/visual reviewer of the rendered book.

## 10. Rejected alternatives

- **Discard the typed transition range:** rejected; its three target issues are
  exactly part of the terminal F7 frontier and its shared analyzer is sound.
- **Derive transition `kind`:** rejected; the same zone sequence can legally be
  staged as threshold or after-transition. `kind` and `cue` are narrative.
- **Put diagnostic causes into issue identity as the primary fix:** rejected;
  stagnation already fingerprints causes and the pointer defect is independent.
- **Derive every Action Semantic disposition:** rejected; disposition is
  creative authority. Only IDs, pointers and exact domains are compiler-owned.
- **Another paid probe without capture:** rejected; it would repeat the same
  non-replayable black-box process.
- **Use the old approved package as proof of the revised story:** rejected. It
  proves Wizard/render mechanics and a valid 98-record coverage witness, but it
  is bound to the older walking-bus-stop source revision, not the current
  kindergarten story.

## 11. Do not do

- Do not patch one story, companion, state ID, page or wardrobe literal.
- Do not expose or commit credentials or captured drafts.
- Do not persist prompts, reasoning, transport metadata or provider secrets.
- Do not mutate historical receipts, Fresh roots or approved packages.
- Do not run live/provider/render before offline proof and Claude Code PASS.
- Do not run a second paid authoring attempt after a failure without offline
  replay of the captured draft.
