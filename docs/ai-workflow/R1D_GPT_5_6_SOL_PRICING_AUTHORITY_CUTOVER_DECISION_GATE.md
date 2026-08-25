# R1D GPT-5.6 Sol Pricing Authority Cutover — Decision Gate

**Date:** 2026-08-25

**Status:** accepted for implementation under Guy's explicit instruction to
continue autonomously to a real Wizard-rendered book and to use the existing
credential only through the canonical Supervisor boundary

**Branch:** `codex/r1d-represented-elsewhere-narrow-patch`

**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`

## Observed mismatch

The official OpenAI pricing page now lists promotional short-context Standard
pricing for `gpt-5.6-sol` at `$4.00/M` input, `$0.40/M` cached input,
`$5.00/M` cache writes and `$20.00/M` output, with the existing 10% regional
processing uplift. The checked-in point-in-time authority still records the
older `$5.00/$0.50/$6.25/$30.00` table. The old table is spend-conservative,
but it is not current price authority and would overstate nominal receipts.

The Fresh root prepared before this discovery is therefore invalidated and
must not authorize live execution.

## Approved change

- Update only the exact dated price table and its source-grounded policy
  identity; retain OpenAI Responses, `gpt-5.6-sol`, default service tier,
  reasoning `medium`, token/output schedules, seven standard calls plus the
  existing strictly gated cleanup, zero transport retries, no fallback and
  the `$10` hard ceiling.
- Continue to reserve every possible input token at the cache-write rate and
  apply the 1.10 regional uplift. This keeps reservation independent of the
  provider-reported input partition.
- Advance the authoring policy and the nested dated pricing authority only.
  Outer request/receipt/readiness, B0, Supervisor and Fresh JSON shapes and
  versions remain unchanged; their new content digests bind the changed nested
  authority, and exact validators reject predecessor content.
- Do not alter prompts, schemas, compiler semantics, Candidate v9, provider
  evidence, Story Source, Blueprint, Wizard, package, image or render behavior.

## Expected bound

For the approved eight-page source, the unchanged output schedule
`[35556, 28444, 32000, 21333, 21333, 21333, 21333]`, 64K standard input
ceiling and 12K/1K cleanup ceiling project to `$6.541304`, below the unchanged
`$10` hard ceiling.

## Validation and falsification targets

- Exact price-table equality and digest binding remain fail closed; changing a
  price and re-digesting it does not restore authority.
- Old artifacts carrying policy v17 or the July price table cannot satisfy
  current validation even if their outer version is unchanged and their
  payload is re-digested.
- Materialization, verification, Supervisor and Fresh preserve their outer
  versions while producing new content digests from the new request authority.
- Focused lifecycle/canonical-boundary suites, TypeScript and
  `git diff --check` pass, followed by independent Claude Code QA before push.
- Only after a clean pushed head and brand-new Fresh root may one bounded live
  attempt occur.

## Cost and exclusions

This milestone costs `$0`. It performs no credential read, provider/network
call, live authoring, Candidate persistence, reconciliation, Blueprint, Board,
package publication, Wizard order, image/audio generation, render, database,
storage or deployment action.
