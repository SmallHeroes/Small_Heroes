# R1D Blueprint traversal repair association — implementation evidence

## Outcome

The single authorized diagnostic successor was consumed once, with no retry or fallback. It
reduced the compiler population from 106 emitted / 93 distinct issues to 50 / 37 and finally
4 / 4. The final four were the same already-enforced traversal/opening clearance invariant on
two connections and two opening affordances. They were first surfaced only on the terminal third
provider output, after an association repair had made them observable.

This offline milestone closes the three general causes together:

1. resolved numeric diagnostics now target the real writable affordance property;
2. retained repair drafts and `REPAIR_WIRE` use the same compiler-normalized index space as the
   validator diagnostics;
3. initial and repair prompts state the coupled same-zone clearance rule prospectively, before a
   topology repair can unmask it after the final call.

No story-, page-, child-, companion-, or Chameleon-specific behavior was added. The provider still
owns geometry. Model, reasoning effort, three generation calls, two repairs, zero transport retry,
no fallback, and the `$5` hard ceiling are unchanged.

## Causal implementation

- `preRenderBlueprint.ts`
  - builds a unique `affordanceId -> worldPlan.affordances[index]` field map;
  - points traversal footprint failures at `.footprint` and opening failures at
    `.clearanceRegion` on the resolved affordance;
  - falls back to the real connection ID slot when an ID is duplicated/ambiguous, never to a
    fabricated property below a string ID.
- `preRenderBlueprintAuthoring.ts`
  - states the existing footprint/opening minimum-clearance invariant in both initial and repair
    system prompts;
  - retains and serializes the assembled normalized Candidate draft after validation, so positional
    diagnostics and repair tuples address the same logical object.
- Prompt identity cuts over to authoring/repair v7 and repair wire v2. Provider wire v1, draft
  schema v6, request v5, receipt v8, model, call budget, and pricing policy remain unchanged.

## Program cutover and replay boundary

The prior complete program object is frozen in source under digest
`634498356d69cf7bc63f2cec8d037ea4d27a9371fc9a08cd7f9607fcce0b4549`.
It is classified only as `legacy_immutable`:

- immutable request-v5 terminals using it remain loadable/replayable;
- a self-redigested mutation is unsupported;
- ordinary, replacement, and diagnostic-successor first dispatch all require the exact current
  program;
- current prompt-v7/repair-v7/wire-v2 program digest is
  `19c5bbb1ac157cfc4d9cffe3f4133f04870a5e6b828aafc67bc8be336fa36978`;
- execution identity continues to include the program digest, so old/new programs cannot share a
  paid slot;
- request-v5 completed provenance derives prompt/schema versions from the exact embedded
  replay-supported program rather than mutable current constants;
- request-v4 completed provenance derives its historical prompt/repair versions from an absolute
  first-attempt system-prompt-digest registry. Exact immutable prompt-v5 and prompt-v6 digests are
  supported; an unknown historical digest fails closed.

Receipt replay now additionally binds every request-v5 attempt's `systemPromptDigest` to the
embedded program: attempt 1 to `authoringSystemPromptDigest`, repairs to
`repairSystemPromptDigest`. It also binds non-null `inputAccounting.systemBytes` to an immutable
digest/UTF-8-byte prompt-evidence profile. Current v7 is pinned at 2,463/2,614 bytes and frozen v6
at 2,144/2,290 bytes. This rejects a canonically redigested v7 receipt rebound under the frozen v6
program rather than trusting an internally consistent but cross-program admission ledger. When a
raw-provider exception correctly leaves attempt accounting null, replay binds the admission
decision's retained input accounting to the same byte profile; a dedicated hostile regression
proves that failure receipts cannot use the null attempt field to bypass program binding.

Programless request-v4 evidence uses the same absolute profile. Prompt-v6 initial and repair
attempts are independently pinned. Prompt-v5 has an immutable initial identity but no durable
multi-attempt repair identity, so multi-attempt prompt-v5 history fails closed instead of inventing
one from a moving alias.

## Durable historical compatibility proof

- A byte-exact checked-in v4/v6 request/receipt fixture replays under its original digests. Hermetic
  completed request-v4 terminals under prompt-v5 and prompt-v6 each recover and replay with provider
  and count factories at zero.
- Writer-shaped frozen request-v5/program-v6 ordinary, replacement, and diagnostic-successor
  terminals do the same. Their prompt-dependent admission evidence is rebuilt from exact frozen
  prompt-v6/repair-wire-v1 bytes. Repair bodies are projected from each preceding raw provider
  draft, as the historical v6 writer did, rather than from the normalized Candidate retained by
  current v7. A reordered-affordance counterexample proves the historical projection differs from
  a naive current-call relabel, and a hostile v7-to-v6 relabel is independently rejected. The
  diagnostic predecessor capture is removed before successor recovery to prove that durable
  successor evidence is self-contained rather than accidentally reopening predecessor execution.
- Frozen predecessor prepare and authorize operations fail closed in both successor lanes. Exact
  before/after inventories prove byte-identical ledgers and no authorization, slot, claim, terminal,
  or incident residue.
- A final-WIP read-only census loaded the five real on-disk populations without mutation:
  terminal `2094d486...` (request v4 / receipt v6), replacement terminal `14d8bbae...` (v4/v6),
  orphan preflight `e47371cb...` (v4), ordinary terminal `befe40dc...` (request v5 / receipt v7), and
  diagnostic-successor terminal `b02f67c9...` (request v5 / receipt v8).

One separate, non-active authority-policy debt is deliberately not disguised as closed: if a
successor is authorized while a program is current and that program changes before first execution,
the current design rejects execution after the cutover while the immutable lifetime slot remains
consumed. There is no such pending or stranded authorization in the current artifact set. Choosing
between one authorization identity and one paid execution across future program cutovers changes
product authority semantics and therefore requires a dedicated Decision Gate; this milestone does
not silently void, release, or re-key that authority.

## Hostile offline proof

- Exact numeric boundary: 180 passes, 179 fails.
- Unique numeric failures point to `worldPlan.affordances[index].footprint|clearanceRegion` with
  exact expected/actual values.
- Two traversals by two openings produce all four Cartesian numeric diagnostics.
- Duplicate traversal/opening IDs produce `reference_duplicate` and fall back to the connection's
  real ID slots without invented nested properties.
- Deliberately reversed raw connections, affordances, frames and ID arrays remain unmutated; the
  retained attempt and compact repair wire are canonically ordered, and every affordance diagnostic
  index selects the same repair tuple.
- Injected outputs prove association-invalid -> numeric-clearance-invalid -> valid in exactly
  three calls/two repairs. The numeric issue is absent while association masks it, then appears on
  the second attempt at a writable `.clearanceRegion` target, and closes on the third.
- The pinned approved eight-page package `2b488f2d...` runs the production compiler offline with
  86 first-draft diagnostics, exact repair accounting of 75,112 bytes, one exact 50,000-token
  count, three admitted generations, two repairs, and every count/generation reservation within
  5,000,000 micro-USD. External-boundary sentinels forbid network, credential and external
  provider-module access while the injected offline provider exercises all three logical calls.
- Exact frozen request-v5 preflight loads but cannot mint an ordinary fresh claim; provider and
  count factories stay at zero. Fresh replacement and diagnostic-successor production prechecks
  use the same exact-current predicate, while predecessor inspection/replay accepts only the
  registered frozen object.
- Real immutable replay proof on disk: preflight `acecf1ed...` returned terminal `befe40dc...` and
  receipt `9b3b3f1f...` with `replayed:true`, provider factory 0, and count factory 0. No artifact was
  rewritten.

## Validation

- Cross-boundary focused battery: **15 files / 659 tests PASS**, serial forks, zero failures.
  It includes compiler/validator, authoring, execution program, production-scale harness, runner,
  count/cost/admission, generation/count adapters, canonical live boundary/launcher, ordinary
  lifecycle, replacement lifecycle, and diagnostic-successor lifecycle.
- `npx --no-install tsc --noEmit`: exit 0.
- `git diff --check`: clean.
- Claude Code independently re-gated immutable range
  `cfee4dcba4d1528d62fd292afb2e2c81c9555c49..903b5f9c201f50ad318ce8b56b1d99b3f48765cb`
  and returned **PASS — 0 BLOCKER / 0 MAJOR**, explicitly closing D1, D4, completed-attempt and
  raw-provider-exception cross-program relabels, frozen replay reachability, and current-only
  dispatch isolation. Its two MINOR notes were evidence limitations rather than code defects.
- After that PASS, Codex reran the exact focused matrix on final committed bytes: **659/659 PASS**;
  TypeScript and `git diff --check` remained clean.
- Literal `npm run check` passed both TypeScript phases. Ordinary completed at **4,280 PASS / 73
  skipped / 9 failed**, where all nine are the established absent ignored-output fixtures in five
  unchanged files. Resource-intensive completed at **632/632 PASS** and emitted three known Vitest
  worker `onTaskUpdate` RPC timeouts. No changed production or focused test failed.

## Post-PASS fresh ordinary preflight

- Exact current-program request:
  `3232af557a75239f0395343636e4efaf2670ce4e2cc85e59bacb4b0bf36f3a19`.
- Exact preflight manifest:
  `512e61ccd5a2e8f158e7fc79d623b652154039f2bf83df8c6f76616c1edcf8ad`.
- Exact derived ordinary execution identity:
  `59717a794965945124d2fa4bf9558cc031ca26680f3d8bac1bafb0ab1085bffd`.
- Preview and immutable write both reported credential access `none`, provider/image/audio calls 0,
  and database/production writes 0. The derived identity is absent from every compiler-ledger
  category, including claims, terminal lookups/bindings, incidents, replacement/diagnostic slots,
  authorizations, proposals, reviews and approval decisions.

## Boundaries and next gate

No credential, network, count endpoint, provider, paid generation, Candidate, image, audio, render,
deployment, database, or remote mutation was performed during this implementation or preflight.
The earlier diagnostic successor authorization is consumed and cannot authorize another run.

Next: push the three focused local commits only after Guy's explicit push instruction; prove exact
same-name origin parity and produce canonical Fresh Readiness from that pushed HEAD; then require a
new exact Guy authorization bound to the request/preflight above before one paid ordinary attempt.
No retry or render is implied by that authoring authorization.
