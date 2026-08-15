# R1D Full-Draft Source Regeneration and Bounded Child Output — Implementation Evidence

## Scope and topology

- Base and pushed parent: `21ff6c15e37037b769aefef96e5e400f810d0baa`
- Branch: `codex/r1d-full-draft-repair-input-compaction`
- Implementation commit: `33e0bc3dce30fd8319bf268a60412d934fdf2254`
- Production files: the Visual Contract compiler and live authoring CLI only
- Test files: six existing focused suites
- External cost for implementation and validation: `$0`

The correction is general to every Story Source. It contains no Leo, child,
companion, page, source-phrase or provider-response production literal.

## Consumed-attempt evidence

The immutable output root
`outputs/r1d-leo-adventure-three-page-proof-v9-20260815-full-draft-compaction`
records a passed Fresh Readiness, pricing preparation, one canonical preflight,
one Supervisor verify and one Supervisor live invocation. The live invocation
persisted receipt
`24323260f1a29a43ab85f2892d0e75e4ecf3c6564ebb9d293ca814915ac8da37`
and readiness
`16bbff8cc0efaebcb68eef55867440ec887be64f25a6a58db890d14e39a1263f`
before its child transport exceeded the Supervisor's 64KB stdout ceiling.

The receipt records:

- status `failed` and terminal `input_token_ceiling_exceeded`;
- exactly `2` completed logical provider calls and `1` repair;
- `0` transport retries and no fallback;
- input `18,333`, cache-write `18,327`, output `25,302`, reasoning `2,194`, total `43,635`;
- nominal `$0.873634` and conservative `$0.961006`;
- no candidate or reconciliation digest.

Attempt 1 exposed seven out-of-scope references. The page-spatial repair call
completed, after which the compiler held `46` unique current typed issues (`75`
emitted), including closed-catalog capability gaps, cover projection and final
structural identities. The final full-draft request was blocked locally before
a third provider call. All artifacts under the consumed root remain unchanged.

## Implemented behavior

The final full-draft repair no longer transports a rejected provider draft or
prose validation messages. It uses:

1. the exact complete initial compiler-owned source-authoring input;
2. a closed versioned tuple containing story identity, page count and every
   canonical current typed issue;
3. dictionaries for issue codes, field roles and collection roles;
4. fixed numeric family and locator-kind catalogs.

The local decoder rejects malformed tuples, invalid indexes, invalid issue
identities, duplicate/non-canonical issue order, unused dictionary entries,
extra data and any encode/decode mismatch. It proves the complete source input
is byte-identical. The provider still returns the unchanged strict
`TEMPLATE_DRAFT_JSON_SCHEMA`, and the compiler still overlays all deterministic
authority and runs every validator.

The live CLI now returns
`canonical-visual-contract-authoring-cli-summary/v1`: a bounded sanitized
summary of status, versions, digests, counts, failure code and persisted paths.
The complete receipt/readiness remain the durable authority. The existing
Supervisor child-output guard remains unchanged and still rejects oversized or
unexpected output.

Prompt bindings advance from v11/v12 to `vc-repair-prompt/v12` and
`vc-repair-user-prompt/v13`. Historical readiness and live artifacts are
immutable and cannot authorize a future attempt.

Unchanged: `gpt-5.6-sol`, Responses API/default tier, reasoning effort, strict
output schema, 64K admission ceiling, output limit, one initial plus at most
two repairs, `$4.884/$5.00` cost fences, timeout, zero transport retries, no
fallback, compact repair eligibility, candidate semantics, Blueprint, Wizard,
render and deployment behavior.

## Quantitative proof

Reconstruction against the exact consumed Leo source snapshot and its `46`
current typed issues produced:

- repair system prompt: `8,611` UTF-8 bytes;
- repair user prompt: `33,672` UTF-8 bytes;
- strict schema: `13,473` UTF-8 bytes;
- protocol allowance: `4,096`;
- conservative total: `59,854`;
- unchanged-ceiling headroom: `4,146`.

The maximal synthetic regression retains `128` unique typed issues, roundtrips
them exactly and remains below the unchanged ceiling with more than `4,096`
units of headroom. A huge high-entropy rejected draft is never present in either
repair prompt.

## Validation

Focused validation passed:

- compiler/prompt, lifecycle, materialization and launcher: **5 files / 168 tests**;
- reference-domain typed-locator correction: **1 file / 40 tests**;
- combined unique focused scope: **6 files / 208 tests**;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

The single literal `npm run check` ran once. Both TypeScript contracts passed.
The resource-intensive phase passed **19 files** with valid diagnostics and no
timeout/RPC/IPC/reporter/launch/teardown failure. Ordinary ran **280 files** and
reported seven assertions: the exact six established missing ignored-output
fixtures plus one stale test that expected raw prose in the former full-draft
prompt. That stale assertion was corrected to decode and assert the exact typed
`page_safety_constraints` locator, after which its full file passed **40/40**.
No second repository gate was run. The six-fixture release HOLD remains and is
not an implementation finding.

## Authority and next gate

No credential, pricing lookup, network/provider call, Fresh Readiness,
preflight, live authoring, render, storage/database, production deployment or
push occurred during this implementation.

Claude Code independently reviewed exact range
`21ff6c15e37037b769aefef96e5e400f810d0baa..fe5363010106d7d2135c11dfdca7a9bdf293939d`
and returned **PASS** with zero BLOCKER, zero MAJOR and zero MINOR. It verified
source-only regeneration, every locator variant, canonical tuple and tamper
guards, the 128 cap, v12/v13 lifecycle bindings, unchanged schema/policy and
downstream semantics, the measured byte arithmetic, bounded sanitized CLI
summary and record fidelity. This document attributes that verdict to Claude
Code; Codex does not self-award it.

Advisory notes only: Claude inspected rather than reran the recorded validation;
and `localeCompare` operates only on ASCII catalog/identity strings here, so no
cross-locale ordering defect was identified. The independent PASS grants no
Fresh Readiness, provider, candidate, render or deployment authority.
