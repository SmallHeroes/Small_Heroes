# R1D Blueprint failed-terminal diagnostic successor — implementation evidence

Status: **offline implementation locally green; awaiting independent Claude Code QA; no provider,
live authoring, Candidate mint on real artifacts, or render**

Branch/worktree: `codex/r1d-order-package-authority-binding` in
`C:\GNart\Work\sh-order-package-authority`

Immutable review base: `c0b833b36fec44c13778de1bf3ccc1bdbaadce03`; review head is the focused
commit containing this document.

## Diagnosis

The latest paid run is a valid terminal, not an orphan. Its compiler populations were
`223 -> 89 -> 5`; receipt v7 stored grouped/saturated summaries and capture v3 stored only the
aggregate census. The old raw drafts are not recoverable: provider storage was disabled, failed
materialization persists `draft:null`, and the output inventory contains no raw response. The
generation request also carries no seed. Consequently, the exact historical final five cannot be
reconstructed and a new call cannot reproduce them deterministically.

The safe objective is narrower: authorize exactly one new execution that either creates a
Candidate or, on failure, persists current receipt v8/capture v4 with ordered complete per-attempt
attribution. This is observability recovery, not a retry policy or a claim that old diagnostics
were fixed.

## Implemented authority

1. `qaWizardBlueprintDiagnosticSuccessorAuthority.ts` defines frozen v1 candidate,
   authorization and execution-claim identities. It imports no mutable runner/capture aliases and
   is directly importable without the `server-only` shim.
2. `qaWizardBlueprintAuthoringLifecycle.ts` has one total predecessor loader shared by prepare,
   authorization and first-dispatch precheck. It replays and validates the exact ordinary v2
   claim, request/program/preflight, lookup, terminal binding/manifest, v7 receipt, v3 capture and
   closed 3/2/no-retry/no-fallback topology.
3. Authorization binds one immutable global slot keyed by predecessor execution identity. Exact
   replay can recover a crash after slot publication; a changed timestamp/candidate collides.
4. Execution reuses `runBlueprintExecutionUnderClaim`; provider and exact-count factories remain
   lazy. Its distinct claim embeds exact authorization/candidate/predecessor/evidence-target
   lineage. A second paid owner is unreachable.
5. Successor recovery requires its own terminal binding. Binding-less recovery remains available
   only to the ordinary legacy lane, preventing a successor crash from adopting a superseded
   ordinary terminal with shared request lineage.
6. `qaWizardBlueprintDiagnosticSuccessorCli.ts` plus its shimmed script/package command expose
   three exact commands. Preparation and authorization are offline; execute requires a persisted
   exact Guy authorization and explicit `--write`.

Operational replay limitation: successor replay no longer requires the predecessor v7/v3
terminal evidence, but it still enters the shared manifest/request replay loader and therefore
requires the original preflight/bridge authority tree and the registered v5/v8 semantics. A
future program or request-version cutover must preserve those frozen legacy semantics before it
ships. This milestone freezes the successor v1 candidate/authorization wire identity; it does not
introduce a second independent manifest/receipt replay implementation.

Unchanged: prompt/model/reasoning, compiler/validator, request content, Story Source, three
generation calls/two repairs, $5 ceiling, count/generation transport, fallback/retry, Wizard,
payment, image/audio/render and deployment behavior.

## Adversarial proof

The focused spec uses temporary repositories and injected providers/counters. It proves:

- exact ordinary v2 + v7/v3 failed terminal -> one successor -> current v8/v4 failed terminal;
- a successful Candidate successor;
- both terminal kinds replay with zero provider/counter access, including after predecessor
  evidence is deliberately removed;
- current-v8, completed, missing-capture, torn, tampered, malformed failure/call/retry/fallback,
  non-Guy, inverted timestamp, extra-key and successor-as-predecessor states reject;
- post-authorization predecessor tamper rejects before claim/provider/counter;
- concurrent execution admits exactly one provider owner;
- crash after successor claim records the existing incident disposition and never redispatches;
- slot-without-authorization is recoverable only with the exact explicit approval timestamp;
- the strict CLI rejects ambiguous flags and mints candidate/authorization offline.

An adversarial test first exposed that generic binding-less recovery could adopt an unbound old
ordinary terminal after a successor claim crash. The implementation was corrected by adding the
lane-owned `recoverOnlyFromOwnTerminalBinding` contract, and the hostile test now passes. This was
found and closed at `$0` before any real Candidate or call.

## Validation

- Focused cross-boundary battery: **6 files / 107 tests PASS**.
- Diagnostic/replacement lifecycle alone: **28/28 PASS**.
- `npx --no-install tsc --noEmit`: exit 0.
- `git diff --check`: clean.
- Canonical operator command reaches the strict parser under the `server-only` shim.

Literal `npm run check` passed both TypeScript phases. Its ordinary partition reported **4,264
passed / 9 failed / 73 skipped** across 332 files; all nine failures are missing ignored-output
fixtures in the same five unchanged files documented before this milestone. Its resource-heavy
partition reported **618 passed / 14 timed out** across 20 files, with all 14 fixed 5s/15s timeouts
in four unchanged Git/subprocess-heavy specs plus four known Vitest `onTaskUpdate` RPC timeout
errors. The diagnostic-successor spec passed inside the literal repository run. The repository
gate remains honestly HOLD; no timeout/assertion was weakened and no fixture was fabricated.

## Remaining gates

1. Focused local commit, no automatic push.
2. Claude Code adversarial review of `c0b833b3..<focused-head>`.
3. Only after PASS and a clean pushed head: run CLI preparation against the exact real v7/v3
   terminal lookup and publish the resulting Candidate digest for Guy.
4. Exact Guy approval of that Candidate digest and explicit approval timestamp.
5. One paid successor execution, no retry. If it fails, diagnose the complete v8/v4 census as one
   population; do not patch the next surfaced symptom. If it succeeds, proceed through the
   existing Blueprint review/approval, Wizard and separately approved render gates.

No provider, credential, network, live, render, push or remote-system operation was performed by
this implementation milestone.
