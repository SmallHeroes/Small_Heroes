# R1D Book Surface Causal Repair Contract — Implementation Evidence

**Date:** 2026-08-18
**Owner:** Codex (technical implementation)
**Decision Gate:** `R1D_BOOK_SURFACE_CAUSAL_REPAIR_CONTRACT_DECISION_GATE.md`
**Branch:** `codex/r1d-book-surface-causal-repair-contract`
**Base:** `f9797c20169309944d0cfdd2ef37edf871a6f610`
**Gate commit:** `09ba5597288eb7fce66a09590cea2d6b2ec5d590`
**Status:** independent technical PASS after focused QA correction; push
pending

## 1. Consumed evidence and reproduced failure

The bounded live attempt at
`outputs/r1d-hint-admission-observability-fresh-f9797c20-20260817T211128482Z`
was not retried. Its canonical receipt v34 digest is
`c2d01c1ede28e2abce726c8a904c1356a61700b7930f2176ef8b629d263a276e`.
It records:

- three completed calls, two repairs, zero transport retries and no fallback;
- route `initial -> book_surface_patch -> book_surface_patch`;
- nominal/conservative cost `$1.652015 / $1.826229`;
- no candidate, reconciliation, Blueprint, Wizard or render authority;
- the first repair clearing cover, presentation and recurring-prop lifecycle;
- the second repair reintroducing action failures on four pages and recurring-
  prop lifecycle while page structural identities remained.

The causal defect was locally reproducible: Book Surface discarded the closed
subcause and authorized a whole page structural replacement. It could rewrite
already-valid `actionRequirements` and `propConstraints` without immutable
coverage or lifecycle context. Static action combinations accepted by the
shared generic response schema could also violate the closed Action Semantic
Catalog only after provider completion.

## 2. Implemented contract

### Catalog-exact bounded schemas

The Action Semantic Catalog is grouped deterministically by complete static
rule signature. Repeated field schemas are emitted through local `$defs` and
`$ref`; each predicate appears exactly once. The catalog-strict page fragment
is used only by the bounded roots that may rewrite whole action semantics:

- Structural Bundle schema v3;
- Book Surface schema v5.

The initial/full-draft schema remains exact v15 and Page Contract remains exact
v2. Corpus accounting proved that adding the strict fragment to the initial
root would place three canonical 12-page QA sources above the 64K ceiling. No
ceiling, safety margin or Story Source authority was weakened.

### Causal structural authority

Page final-structure diagnostics now carry required closed causes at a valid
page locator. Identity remains family + code + locator; causes union in stable
lexical order without changing emitted counts, unique counts or transition
identity. Book Surface derives a closed writable-field union from those causes.
All other returned fields must equal the current draft and remain visible to
the non-target comparison.

The applied field map is limited to steering, prop state, prop constraints,
action requirements and transition where their exact cause authorizes them.
Projection containment is compiler-owned. Safety, cast/presence, spatial
identity and human-presence causes make Book Surface unavailable.

### Read-only context and immutable bindings

Affected pages carry bounded read-only facts for cast/presence, location
anchors, zone spatial IDs, scrubbed safety, action-to-coverage identity,
pre-reveal prop obligations and transition topology only when writable. The
prompt excludes raw source phrases. A canonical internal authority digest binds
the complete compiler-owned authority and rejects context tamper before prompt
or apply.

Book Surface cannot change action count, ordered beat IDs, coverage indexes or
compiler-owned Source Evidence bindings. It never returns Action Semantic
Coverage. Effective post-patch recurring-prop lifecycle is checked against the
effective post-patch page constraints, so changing `firstRevealPage` cannot
erase a required pre-reveal prohibition.

### Compiler-owned projections and totality

After source grounding and overlay, the compiler appends only missing exact
`mustShow`/`mustNotShow` projections. Existing strings, order and presentation
pointer indexes are unchanged; malformed arrays remain untouched and fail full
validation. The projection is idempotent.

Because this pass precedes total template validation, the action prose leaf is
now total over malformed runtime action shapes. Unknown predicates or unsafe
nested values are skipped rather than throwing or synthesizing out-of-catalog
prose; the original action remains in typed repair authority and the unchanged
validator rejects it with a closed cause.

Duplicate authored action check IDs receive
`page_action_check_id_collision_invalid` at the original duplicate check while
later invalid action fields restore `page_action_requirements_invalid`. Error
text, count and order are unchanged. Prop and safety collisions keep their
separate causes.

### Post-hoc request, prompt and schema binding

Every persisted attempt is re-bound to the exact current authoring request.
The attempt route determines the approved static prompt version/digest and the
complete Structured Output authority: strictness, name/version/schema digest,
compatibility profile/evidence/status and serialized digest. Validation also
binds the recorded system and schema byte counts to those exact current bytes.
The initial user-prompt digest is bound directly to Request authority.

A dynamic repair user-prompt digest is recorded as runtime-observed,
content-addressed provenance. It is not independently reconstructable after
the run because its intermediate invalid draft and raw provider response are
intentionally not persisted, and it is not used as standalone authorization.
The content-addressed chain is not represented as a cryptographic signature
against an actor able to rewrite every artifact; that stronger claim would
require a separately gated, upstream-pinned runtime signing authority.
The causal authorization boundary instead requires the exact current live
Request, static route system/schema authority, source binding, request-bound
budget, clean Supervisor output boundary and byte-exact final Candidate rebuild.

This validation runs while building Readiness, while persisting Receipt and
Readiness, while building or persisting a Candidate, at Supervisor child-output
capture, and again in the QA bridge. The Receipt root must exactly match the
Request's source, mode, provider, endpoint, model, tier, pricing and pricing
digest. Candidate minting additionally requires live request/receipt modes. A
hostile regression changes a static system-prompt digest, re-digests Receipt,
rebinds and re-digests Readiness and Candidate, renames all three
content-addressed files, and is still rejected by Supervisor. Direct hostile
tests likewise reject root provider, endpoint, model, tier and pricing changes.
A Book Surface v4 receipt therefore cannot be relabeled as v35/current
authority without matching the v5 static prompt/schema and exact current
Request.

Output-budget validation always uses the Request schedule. The only exception
is a zero-attempt failed `request_invalid` receipt, which requires an explicit
fallback schedule independently derived from the trusted source page count;
the fallback is forbidden for every ordinary receipt. Execution materialization
and Fresh Readiness also reject successful-looking predecessor B0-verification
and Supervisor-readiness envelopes before consuming their fields.

At the canonical input boundary, the observed and claimed digests plus bounded
reason codes of a rejected raw Request remain in rejected-request evidence.
The schema-filtered lifecycle copy is independently canonicalized and
re-digested before producing a zero-attempt failed Receipt/Readiness. Unknown
caller fields therefore never enter those artifacts, and current request
version/algorithm/self-digest validation needs no rejection-path exemption.

Failed `provider_policy_mismatch` attempts persist one closed scope:
`prompt_authority`, `call_options` or `provider_identity`.
The Request-side Structured Output/static authority, digest syntax and schema
bytes are always exact, and an unknown repair route is never waived. Call-
options and provider-identity scopes require full observed prompt binding. A
compiler budget-sequence inconsistency instead fails as a local invariant
without inventing a rejected attempt. Only the single final pre-provider
`prompt_authority` scope may
retain a well-formed observed rejected system/initial-user prompt identity and
its internally consistent actual byte accounting. Such a receipt is failed and
cannot mint a Candidate or satisfy successful Supervisor output authority.

## 3. Fail-closed and privacy proof

The tests reject:

- catalog-invalid subject/object/effect/constraint/laterality combinations;
- missing, extra, reordered, stale or altered authority context;
- action beat, count, coverage or Source Evidence rebinding;
- unauthorized page-field, cover or recurring-prop drift;
- transition topology tamper;
- presentation source-phrase transport;
- recurring-prop lifecycle regression;
- malformed, blank or non-string projection arrays;
- provider rewriting of presentation-target `mustShow`;
- redigested current/prior receipt, readiness, B0, execution, Supervisor and
  Fresh authorities;
- direct Candidate minting from a prompt-tampered or cross-source receipt;
- re-digested Receipt root provider, endpoint, model, tier or pricing drift;
- forged zero-attempt schedules and unexpected fallback schedules;
- malformed repair routes and incomplete Structured Output authority.

Full assembly and validation remain mandatory. No diagnostic is waived and no
candidate is emitted from a partial repair.

## 4. Versions and unchanged policy

Current versions after the cutover:

| Authority | Current |
| --- | --- |
| Structural Bundle schema | v3 |
| Book Surface schema/system/user prompt | v5/v5/v5 |
| Draft-validation attempt diagnostics | v4 |
| Authoring request/receipt/readiness | v31/v35/v33 |
| B0 input/manifest/verifier | v20/v29/v29 |
| Execution materialization input/result | v19/v23 |
| Supervisor request/readiness/result | v28/v28/v21 |
| Fresh Readiness evidence | v28 |

Intentionally unchanged: initial draft v15, Page Contract v2, policy v12,
standard budget v2, candidate v9, OpenAI evidence v6, child-output authority v1
and QA bridge v2. Immediate authoring predecessors are classified immutable;
current writers never rewrite or upgrade historical artifacts.

No model, provider, tier, reasoning, timeout, standard three-call/two-repair
budget, `[40000, 32000, 36000]` output schedule, retry, fallback, candidate
semantics or hard `$5` fence changed.

## 5. Validation evidence

Focused/adjacent validation completed without credential, provider, network,
Fresh, image or render access:

- compiler/schema/repair core: 10 files / 286 tests PASS;
- prompt-table and live schema adjacency: 2 files / 28 tests PASS;
- authoring lifecycle: 1 file / 91 tests PASS;
- B0 and execution materialization: 3 files / 106 tests PASS;
- canonical authoring boundary + Fresh: 2 files / 179 tests PASS;
- Supervisor + QA Wizard bridge: 2 files / 49 tests PASS;
- reference-domain correction: 1 additional file / 48 tests PASS (paired
  Stage-4 file 37/37 also PASS).

This is 21 unique files / 787 tests PASS. `npx --no-install tsc --noEmit`,
`npm run story:autonomous-typecheck` and `git diff --check` pass.

After internal downstream adversarial review exposed post-hoc Request/Receipt
binding gaps, the corrected chain was re-run across 5 files / 211 tests:
authoring lifecycle, B0 verification, execution materialization, Supervisor and
QA Wizard bridge. Every test assertion passed. The combined Vitest process then
reported one existing `onTaskUpdate` RPC timeout and returned exit `1`; the
corrected lifecycle file also passed independently at 91/91. The chain includes
immediate predecessor v34/v32, execution materialization v18/v22, B0
verification v28/current-v29 and Supervisor result v20/current-v21 cutover
assertions. This internal review is engineering feedback, not the independent
immutable-range PASS required below.

A final individual Supervisor rerun passed all 42 assertions before reporting
the same `onTaskUpdate` RPC timeout and exit `1`; the QA bridge exited cleanly
at 7/7. No assertion failure occurred in either suite.

The literal `npm run check` was invoked exactly once. It stopped at TypeScript
because one new test accessed `causes` without narrowing the
`DraftValidationIssue` union. The assertion was narrowed and TypeScript then
passed; the literal command was not retried.

The three phases were subsequently run directly:

- TypeScript: PASS;
- autonomous-story TypeScript: PASS;
- diagnostic Vitest ordinary phase: 3,251 passed / 65 skipped / 7 failed.
  Five failures are the established missing ignored-output fixture HOLD. Two
  were stale assertions in the unchanged reference-domain suite: one omitted
  the new typed cause and one expected a third provider call even though the
  compiler-owned projection now completes after the compact spatial repair.
  They were corrected to assert the exact cause, two-call candidate and all
  three repaired spatial fields; the file then passed 48/48.
- diagnostic Vitest resource phase: 20 files / 599 tests PASS, followed by two
  Vitest `onTaskUpdate` RPC timeouts and exit `1`.

No second repository-wide run was made. The known fixture HOLD and runner RPC
timeouts remain recorded and unwaived.

### Independent-QA correction

Claude Code's first immutable-range report used a `PASS` headline but listed
two `MAJOR` findings and explicitly required both before Fresh Readiness. This
evidence treats that result as `HOLD`.

The first finding identified a real non-convergence risk but proposed an
over-broad correction. `page_steering_invalid` authorizes the union of
`mustShow`, `mustNotShow` and `camera`; its presence does not establish which
leaf is malformed. The corrected authority builder instead inspects the
current frozen `mustShow` on a presentation-overlap page. It returns no Book
Surface authority when that array is non-array, contains a non-string, or
contains a blank/whitespace-only string. When current `mustShow` is valid, the
builder continues to remove it from the writable set while preserving an
authorized camera or `mustNotShow` repair. Direct tests prove both branches.
No failed page is relabelled and full compiler validation remains mandatory.

The second finding identified a genuine measurement gap. The direct
production encode/decode regression now carries exactly 115 normalized
structural validation hints across 12 pages, plus one presentation target. All
115 hints survive exactly. Canonical input accounting is 32,435 bytes, leaving
27,469 bytes under the 59,904-byte route-admission limit. Separately, the richer
12-page lifecycle fixture carries 123 structural hints plus its exact
presentation targets at 42,865 bytes, leaving 17,039 bytes, and still completes
the bounded `initial -> book_surface_patch -> book_surface_patch` candidate
path in three calls/two repairs.

Correction validation is **3 files / 155 tests PASS**. Deterministic TypeScript,
autonomous-story TypeScript and `git diff --check` pass. The literal
`npm run check` was not rerun: its previously recorded execution and separate
five-fixture repository HOLD are unchanged, and no file in that HOLD entered
this correction.

### Independent re-gate

Claude Code independently reviewed immutable correction range
`eeac8634a76c36becc3af73fcdd66557f91f040c..1b3387ceb546fab81f8625678c55b638babd740b`
and returned **PASS with zero BLOCKER, MAJOR or MINOR findings**. It verified the
single-commit topology, exact five-file scope, no package/lockfile change and
both original finding closures. It independently reproduced **3 files / 155
tests PASS**, `npx --no-install tsc --noEmit` and range `git diff --check`.

The reviewer confirmed the precise malformed-`mustShow` refusal, admissible
camera-only overlap, non-target drift enforcement, exact 115-hint
encode/decode, the richer 123-hint live-shaped lifecycle, both hard accounting
values and the unchanged cap schedule. No prompt, schema, version, policy,
model, tier, reasoning, budget, retry, fallback, timeout or hard-$5 behavior
changed.

One advisory is intentionally non-gating: the closed
`page_steering_invalid` cause still combines camera, `mustShow` and
`mustNotShow`. A well-formed but semantically invalid frozen `mustShow` may
therefore consume a repair before full validation fails closed. A future
evidence-backed milestone may split those causes; this correction does not
guess at finer identity without supporting diagnostics.

## 6. Exclusions and next gate

Implementation/provider/image cost is `$0`. No credential, provider, Fresh
Readiness, preflight, live authoring, candidate, image, Vision, render,
storage/database, deployment, production or push action occurred.

This evidence now includes the independent technical PASS. It accompanies the
focused implementation commit and its separate QA correction commit. Push
remains Guy's decision. A new Fresh package and one bounded live attempt remain
forbidden until the reviewed branch is pushed cleanly and the new pushed-head
Fresh package passes every spend gate.
