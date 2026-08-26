# Compiler-Owned Cast and Continuity Evidence Binding — Implementation Evidence

**Date:** 2026-08-26
**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Implementation base:** `6bedc6a396b07c0261991b859a554e5954adcc87`
**Review range:** `6bedc6a396b07c0261991b859a554e5954adcc87..HEAD` after the focused local commit
**Status:** offline green; independent Claude Code review required before Fresh, provider/live authoring, Candidate, Wizard or render

## Outcome

The compiler now closes two deterministic identity-domain defects exposed by
the first fully captured revised-Chameleon authoring run.

1. Exact provider-wire child and companion aliases inside typed action
   references are projected onto the compiler's authoritative cast IDs before
   every assembly attempt. The projection covers entity subjects, cast-group
   subjects, cast objects, relation targets and spatial-constraint targets.
   It clones the input, preserves non-cast and unknown references, preserves
   already-authoritative IDs, and converts ambiguous or cross-role aliases to
   a non-resolving compiler sentinel instead of allowing them to validate as a
   different person.
2. The existing compact Source Evidence ID repair now carries one validated ID
   atomically to the exact same-page companion-state or wardrobe continuity
   selector when, and only when, the compiler-bound represented-elsewhere
   pointer, represented value and prior ID all agree. Mismatched associations
   cannot borrow this authority. Conflicting patches for one selector reject
   before a result is returned.

This is a general compiler correction. It contains no Chameleon, Kim, Bar,
story, page-number, wardrobe, state or known evidence-ID special case.

## Changed surfaces

- `lib/visual-contract-compiler/draftActionCastReferenceProjection.ts` — new
  pure provider-wire cast-reference projection.
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts` — invokes
  that projection before every deterministic normalization/assembly attempt
  and records count-only notes.
- `lib/visual-contract-compiler/sourceEvidenceIdRepair.ts` — exact atomic
  continuity-selector association and conflict handling.
- `lib/__tests__/draft-action-cast-reference-projection.spec.ts` — all five
  provider-wire reference positions, preservation, no-companion and hostile
  collision cases.
- `lib/__tests__/source-evidence-id-repair.spec.ts` — companion/wardrobe
  propagation, stale/mismatched/no-borrow cases, conflict rejection and input
  immutability.
- `lib/__tests__/visual-contract-repair-loop.spec.ts` — the production compiler
  accepts a raw child/companion alias draft in one attempt and emits only
  authoritative action identities.
- `lib/__tests__/offline-repair-harness.spec.ts` — compact wardrobe evidence
  route reaches `2 -> 0`, a synthetic in-memory Candidate and zero provider
  calls while the production compiler materializes the repaired evidence
  phrase.
- `lib/__tests__/vitest-workload-classifier.spec.ts` — canonical test census
  advances from 333 to 334 and proves the new spec remains in the ordinary
  partition.
- `CURRENT.md` and the Decision Gate record the current gate and boundaries.

## Exact captured replay

The historical failed run remains immutable under
`outputs/r1d-chameleon-v3-fresh-readiness-20260826T042742202Z`. Its exact
content-addressed inputs are:

- snapshot `b0/source-snapshots/35fe04ab5601031735bd7bdd283bab7a8d897bc399427d592e39fe56aa1f6a6c.json`;
- request `b0/authoring-requests/da6e337616e4cfd4bcb92a6074be6810a6789d8fb14b9cbe55cf6871b82a2056.json`;
- receipt `b0/authoring-receipts/5bfda0c0cb94ceaeeec7d882f596aa30b22005c8c5c36b257509291d6189bf4e.json`;
- captured responses `b0/structured-draft-replay-evidence/828d16fb01ce9d5cee18c1701f9f9e61c124148e42035288a844b38bb18f6079.json`.

Running those responses through the corrected production compiler made zero
provider calls. The new route was:

```text
initial -> source_evidence_id_patch -> book_surface_patch
```

The historical third response was authored against the former `full_draft`
route, so the corrected replay rejects that response as
`repair_output_invalid`. This is expected falsification, not a claim that the
old receipt remains congruent after a causal code correction. Before that
terminal, the surfaced census moved `14 -> 14`: every Source Evidence ID,
source-evidence phrase and continuity-authority issue disappeared while six
previously masked transition failures surfaced. The next route changed from
the historical broad `full_draft` request to the existing narrow
`book_surface_patch`. The runner explicitly reports
`providerCalls: 0`, `exactCapturedCallSequence: false` and
`receiptOutcomeCongruent: false` because the old third response no longer has
the schema selected by the corrected compiler.

A second zero-provider diagnostic starts from the historical third captured
full draft and applies the historical fourth Source Evidence patch. On the
corrected compiler it moves the surfaced census `7 -> 2`; the only remaining
issues are the genuine capability gaps at page 3/item 0 and page 8/item 5, and
the next route is the existing `presentation_requirement_patch`. The harness
then stops because no new response was supplied. This is an offline frontier
probe, not a Candidate claim.

The cast projection is independently exercised both as a pure function and
through `compileBookVisualContractTemplate`; the compact continuity repair is
independently exercised through the offline harness and the production
compiler. No historical artifact was rewritten to manufacture congruence.

## Validation

Final focused run:

```text
5 test files passed
137 tests passed
```

The final count includes permanent positive regressions for both a redundant
raw human entry carrying the canonical child ID and the exact captured shape
where raw human cast repeats the provider child alias even though authoritative
human facts are empty. The exported projection requires the authoritative
human-ID set at the type boundary; raw provider human cast cannot veto it.

It includes the four changed compiler/repair specs plus the workload
classifier. The broader relevant compiler/action/replay matrix passed 9 files
and 186 tests before the final census-only test correction; the directly
affected tests were then rerun on the final bytes. `npx --no-install tsc
--noEmit` exits 0 and `git diff --check` exits 0.

A literal `npm run check` ran both TypeScript phases and the full canonical
334-file Vitest partition on the initial implementation, before the final raw
human-collision correction and census update. It reported 3,775 ordinary
assertions passing, ten failing and 70 skipped. Nine failures are the
established missing ignored-output fixture baseline across five unchanged
files: four Visual Directions acceptance assertions, two story read-back
assertions, and one assertion each in child lexicon, page entity QA and
momentum. The only assertion failure attributable to this milestone was the
expected inventory count `333` versus actual `334`. After the census correction
and the later production collision correction, the classifier and complete
focused set pass 137/137, the exact captured replays above pass their intended
offline assertions, TypeScript passes and diff-check is clean. The
resource-intensive full-check partition passed all 623 assertions and
reproduced the three known Vitest `onTaskUpdate` RPC timeout events. The literal
full command exited 1 for documented fixture/runtime baseline reasons and was
not rerun; no changed production assertion failed in that run.

## Preserved authority

No response schema, prompt or user-prompt version, schema digest, model,
reasoning effort, service tier, input/output allowance, seven-call/six-repair
fence, retry count, fallback policy, `$10` ceiling, validator rule, action
catalog, Candidate format, Wizard contract, payment behavior or render policy
changed. The complete-census regression and stagnation guards are untouched.

No credential was read. No provider, network, live authoring, Candidate mint,
approval, Wizard order, fake payment, image, Vision, narration, full-book
render, storage/database write, deployment or push occurred. The consumed
historical Fresh root remains exhausted and cannot authorize a rerun.

## Binding next action

Claude Code must adversarially review the immutable base-to-HEAD range. Only a
PASS permits pushing this milestone, creating a new Fresh root at exact origin
parity and consuming at most one new paid authoring attempt. A failure from
that attempt returns to offline replay; it does not authorize another paid
call. Render remains downstream of a valid Candidate, reviewed and published
package, and QA Wizard qualification.
