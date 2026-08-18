# R1D bounded incomplete PageContract correction — Decision Gate

**Status:** approved under Guy's 2026-08-18 standing instruction to complete
the new-story Wizard path and render when valid authority exists.

## Evidence

The sole canonical root
`outputs/r1d-recurring-lifecycle-fresh-ee7cdbf1-20260818T133535132Z`
ended fail-closed and is not replayed. Receipt v41
`f34d6267f4ee231edc1d04dfb9f5d1b41585a2514b4ed732a4d3cb41138b4a5b`
proves the recurring-prop lifecycle error is closed. It records two completed
calls, route `initial -> page_contract_patch`, and terminal identity
`page_contract_repair_patch_set_incomplete`. The second response used 13,698
of its 32,000 output-token cap, so this was neither truncation nor a transport,
timeout, model, budget or infrastructure failure.

## Decision

When and only when the first bounded `page_contract_patch` response is rejected
before mutation with exact identity
`page_contract_repair_patch_set_incomplete`, preserve the original draft and
consume the already-reserved final standard repair call with the same exact
PageContract authority. A second incomplete response remains terminal. No
fourth call, transport retry, schema/prompt/version change or relaxed applier is
admitted.

## Invariants

- the incomplete response applies zero pages and cannot leak partial state;
- the next call has the same repair mode, authority and standard schedule;
- all missing/extra/duplicate/reordered/overreaching response checks remain;
- every non-incomplete repair-output failure remains terminal;
- calls/repairs stay bounded at 3/2, retry/fallback stay 0/none, and the hard
  `$5` fence is unchanged;
- Candidate, Wizard and render remain unavailable until full validation passes.

## Required proof

- incomplete then complete reaches a Candidate in exactly 3 calls/2 repairs;
- incomplete then incomplete is terminal after exactly 3 calls, with no fourth;
- exact prompt authority is unchanged between correction calls;
- focused lifecycle, compiler, TypeScript and diff-check pass;
- a new Fresh package and one live invocation only.
