# Compiler-Owned Census QA Correction — Evidence

**Date:** 2026-08-26
**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Correction base:** `6e006341799973dc6e57917d438886e695c58d8b`
**Review range:** `6e006341799973dc6e57917d438886e695c58d8b..HEAD`
**Status:** offline green; independent Claude Code re-gate required before Fresh or live spend

## Finding and root cause

Claude Code verified the preceding cast/continuity implementation as correct
but found that offline harness v2 sourced `completeIssueCount` from
`scenario.completeDiagnosticIssuesByAttempt`. A test could therefore supply
the population whose reduction it purported to prove.

The compiler already owned the relevant distinction on every failed attempt as
`diagnosticPopulation: complete | route_subset`. The defect was at the evidence
boundary: all five terminal summaries and the Candidate result stripped that
field, leaving the harness unable to distinguish the populations.

## Correction

- One public population type and one summary projector now serve all five
  terminal errors plus Candidate success. Public summaries/errors remain
  sanitized; the tracked regression fixture deliberately contains four
  sanitized structured draft outputs, as disclosed below.
- Offline harness v3 rejects the legacy caller-supplied census field before
  compilation. Complete counts come only from compiler-tagged complete
  summaries; a fully validated Candidate contributes the final complete zero.
- Summary attempt numbers and populations must align exactly. The harness
  rebuilds the canonical persisted trail from the compiler's full summary
  emissions and compares it byte-semantically before certifying any count;
  stage identity lists remain sourced from those full emissions rather than
  the trail's intentionally bounded item window.
- `complete -> route_subset` yields partial coverage, null complete deltas and
  null run-level monotonicity. Unlike populations are never compared.
- Scenario-mode CLI success is fail-closed: exit 0 requires complete coverage
  and monotonicity exactly `true`; partial, absent, null or regressed evidence
  exits 1. Capture mode retains its separate captured-sequence and
  receipt-congruence exit rule, while malformed arguments remain exit 2.
- The offline result version advances from v2 to v3. Provider request/response,
  receipt, Candidate, Wizard and render schemas do not change. The standalone
  compile-review repair-attempt JSON gains one additive population key.

## Captured proof

`lib/__tests__/fixtures/chameleon-v3-captured-corrected-frontier.json` is a
218,861-byte tracked copy of four sanitized structured draft outputs from
captured attempts 1–4, including their authored `setReference.prompt` strings.
It intentionally expands source-control test evidence; it contains no
credential, photo, PII, request, receipt, HTTP/database material or transport
envelope. Raw file SHA-256 is
`fd74c22e149b205573b62ea74f0f7f09ca852bea6b9617f6618d48d843794e9c`.
The ordinary regression hardcodes the source snapshot
`35fe04ab5601031735bd7bdd283bab7a8d897bc399427d592e39fe56aa1f6a6c`,
replay evidence
`828d16fb01ce9d5cee18c1701f9f9e61c124148e42035288a844b38bb18f6079`
and all four structured-output digests, then re-hashes each copied payload.

Ordinary tests now prove with zero provider calls:

1. captured initial + Source Evidence patch: complete `14 -> 14`, monotonic,
   next route `book_surface_patch`; Source Evidence identities disappear and
   six transition identities become evaluable;
2. captured third draft + fourth patch: complete `7 -> 2`, delta `-5`, next
   route `presentation_requirement_patch`; only page 3/item 0 and page 8/item 5
   capability gaps remain;
3. compact generic wardrobe Candidate: compiler-measured complete `3 -> 0`.
4. a 140-identity complete population remains 140 in count, returned identity
   list and terminal digest even though the persisted diagnostic trail exposes
   only its bounded 128 items; no false alignment failure occurs.

`complete` retains the existing audited compiler meaning: all collected
diagnostics for the currently evaluable validation pass. It is not presented
as an oracle for hypothetical failures hidden behind unmet prerequisites.

## Claude MINOR closure

- Cast groups are sorted by the existing shared canonicalizer after alias
  projection. Duplicates are deliberately preserved so alias collapse remains
  invalid instead of being silently repaired.
- A regression covers the load-bearing shared child/companion alias when no
  authoritative companion exists.
- A regression covers same-selector/same-old-ID/same-new-ID continuity repairs
  in both patch orders, with one atomic result and immutable input.
- The Decision Gate, original evidence and `CURRENT.md` distinguish historical
  receipt populations, current surfaced identities and compiler-tagged current
  complete populations.

## Validation

```text
9 focused files / 425 tests passed
offline harness: 29 tests passed
exact focused set: chameleon-action-representability,
  draft-action-cast-reference-projection, draft-reference-domain-hardening,
  offline-repair-harness, source-evidence-id-repair,
  visual-contract-repair-loop, visual-contract-stage3,
  canonical-live-authoring-boundary,
  visual-contract-authoring-replay-evidence
140 complete identities / 128 persisted trail items: passed
scenario CLI partial census: exit 1
scenario CLI complete monotonic Candidate: exit 0
npx --no-install tsc --noEmit: exit 0
git diff --check: exit 0
provider/network/live/render calls: 0
```

The literal final-byte `npm run check` passed both TypeScript phases. Its
ordinary phase ran 314 files: 292 passed, 17 skipped and five unchanged
fixture-reading files failed on the same nine absent ignored-output
assertions; 3,788 assertions passed and 70 skipped. Its resource phase ran 20
files: 19 passed, and one unchanged materialization file timed out in two of
21 subprocess-heavy assertions at the fixed five-second bound while 621
assertions passed; three known `onTaskUpdate` RPC timeouts also occurred. The
exact materialization file then passed **21/21** isolated, including those two
tests in 4,965ms and 4,310ms. The literal repository command therefore remains
exit 1 at the documented fixture/infrastructure baseline; it is not called a
repository PASS and no retry disguised that result.

## Boundary and next action

No prompt, provider schema, validator rule, route, model, budget, retry,
fallback, Candidate, Wizard, payment or render policy changed. No credential
was read and no runtime artifact was mutated.

Claude Code must re-gate the exact correction range read-only. Only a clean
re-gate permits push, a new Fresh root and the already-authorized single
bounded paid authoring attempt.
