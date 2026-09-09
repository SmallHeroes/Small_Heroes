# M2b current-consumer QA and bounded timing diagnosis

2026-09-09. Base `aa3eade887ed1af0eda28c83a949bb941505db05`.
Status: bounded timing diagnostic complete; archive scan contamination fixed;
post-relocation uninstrumented LOCAL FULL GATE GREEN. Timing root cause unresolved.

## Supplied independent QA and topology

Guy supplied Claude Code's read-only PASS P0=0/P1=0/P2=0 for exactly
`f59fe086..aa3eade8`, the current-consumer validation boundary only. Codex
reconciled one commit, zero merges, 10 paths, +607/-15 and diff-check exit 0.
Claude reports independently running both typechecks, 93 focused tests,
18 additional assertions, the synthetic-Git probe and three real CLI rejection
cases. These are attributed to that supplied report, not newly run in this
diagnosis. Claude verified the failed full log's SHA/content, not a full rerun.

The positive full-validator probe uses synthetic current Git, grants no
authority, and cannot replace actual clean-parity validation. Claude's packet
path/byte attacks were short-circuited by the current Git gate; its report does
not independently prove those packet-reader paths or a real full positive path.
The exact pending M2a packet is unchanged. No earlier PASS boundary moves.

Sole writer: this existing task, branch `codex/r3b1b-semantic-recovery-m1`,
worktree `C:/GNart/Work/sh-r3b1b-semantic-m1`. Start: clean, cached ahead 12 /
behind 0. Protected d53b `768ccb2f` and accepted-intent `63ccb484` are clean,
read-only. Worktree and branch inventories were inspected. No new task,
provider, credential access, push, dependency installation or deletion. The
owned diagnostic archive's preservation-checked relocation is recorded below;
no branch or Git worktree is moved or removed.

## Question, method and unchanged policy

The previous full gate had 13 timeouts across five resource specs, versus one
in the preceding milestone. All five are unchanged by `f59fe086..aa3eade8`;
none calls the new API. The additive bridge wrapper does not establish a
cause. The requested bounded investigation asks where these tests spend time;
it does not assume an inherited failure or blame another project.

Ignored diagnostic root: `outputs/qa-m2b-timing-20260909/`.
`trace.cjs` observes native synchronous child calls only in Vitest workers,
removes its own NODE_OPTIONS before any CLI child starts, and preserves native
arguments/results without retry/substitution. It records verb, duration,
status/signal/error code, not arguments, output or environment values.
`runner.mjs` extends the unchanged cooperative runner and records per-task
wall/parent-CPU time and calls through public hooks. Its captured append writes
diagnostic rows only; it is not evidence that arbitrary writes are impossible.
Neither observer enters the sentinel-protected private CLI children.

The diagnostic config inherits the real config and overrides only the runner.
Both selected runs use two workers, matching the resource policy. They retain
all existing timeouts. Task measurements include hooks/cleanup and observer
overhead, not just the timed test body. Parent CPU excludes child CPU and is
not an independent additive partition of wall time. No source/spec/standard
runner/config/inventory/deadline changed. This opt-in observer is not a new
repository gate or production dependency.

## Results and bounded conclusion

1. Two representative tests passed: readiness resume 2725ms, bridge provenance
   9110ms. Per-task instrumentation found 52/89 Git calls taking 2374/4791ms,
   plus 2883ms in another child for the bridge. All Git calls succeeded;
   maximum Git duration 1034ms. `selected-traced.log`, exit 0.
2. All thirteen formerly failing tests passed together under the selected
   five-spec run. The name regex also selected two additional controls:
   **15 passed / 98 filtered out**, exit 0, 22.89s. Those exclusions are
   diagnostic selection, not new repository skips. Nine Git-dominated tests
   spent approximately 86-91% of task time in Git. The writer/public-entry
   cases predominantly waited for CLI children. The bridge took 7240ms,
   including 3833ms Git and 1872ms another child. Across this run: **470 Git
   calls, zero nonzero results/signals/errors**, maximum 254ms.

The second run includes the first run's two tests; counts must not be added
as unique coverage. The log retains its original name `thirteen-traced.log`
although the selector matched 15 tests. `summary.json` records all 15 exact
names, timings and trace hashes. Recompute with `node
outputs/qa-m2b-timing-20260909/summarize.cjs` (the script prints JSON only).

This establishes native process cost as the dominant measured cost for these
selected tests and reproduces success at unchanged budgets. It does **not**
identify why the earlier run slowed, exclude a code contribution, establish
host contention/antivirus/cache/GC causality, prove inheritance at the prior
base, or fix intermittent reliability. CLI time is not decomposed into startup
versus work. The prior A-B-A comparison is retained in the previous execution
doc and was not rerun. No timing-policy change is justified by this evidence
alone; no deadline or worker relaxation is proposed as an implicit fix.

One complete uninstrumented `npm run check` was then run with NODE_OPTIONS
absent. It found a different concrete assertion failure, diagnosed and corrected
below. One post-correction full gate follows; this is not an unchanged-state
retry-until-green loop. The timing observer is absent from both complete runs.

## Full gate and preserved identities

First complete run: **5692 passed / 73 existing skips / one assertion failure**,
exit 1. Both typechecks passed. Ordinary: 5022 passed, 73 skipped, 368 files,
98365ms. Resource: 670 passed, one failed, 22 files, 200022ms. All thirteen
previously timed-out tests passed inside this same full run; no timeout class.
Bridge spec 15/15, its previously failing provenance test 7033ms. Inventory
390/368/22 and workers 4/2 unchanged. This run remains FAILED.
`full-check-uninstrumented.log` SHA-256:
`874348a4d95c3c430982d8aec2363e69d2710fd2b0f322f22e1d42e20a80efe1`.

### Concrete new failure and preservation-only correction

The one failed assertion is `production-qa-escape-hatches.spec.ts:40`:
the exact-root allow-list found three `skipPromptAudit` matches beneath
`outputs/qa-m2b-consumer-20260909/base-f59fe086/`. They are the archived
`lib/qa-console-run.ts`, the archived scanner spec itself and the archived
`scripts/experiments/run-0046-staging-proof-and-book2.ts`. The scanner explicitly
walks the entire root and does not exclude outputs. The baseline extraction
created by Codex after the preceding milestone's full run polluted this scan;
it was not present during that earlier thirteen-timeout run, so cannot explain
those historical timeouts. This is a demonstrated workspace-artifact cause of
the new assertion, not a production bypass or timing-root-cause discovery.

Correction: move only that owned extraction outside the active source inventory,
to `C:/GNart/Work/sh-r3b1b-diagnostic-archives/base-f59fe086-20260909`.
No scanner/code/allow-list/timeout change. Audited before moving: exact resolved
source/destination inside named diagnostic scopes, absent destination, neither
root a link, no `.git`, no archive path in the Git-worktree inventory, no
observed process using that archive. Directory rename on the same volume used
`System.IO.Directory.Move`, not recursive deletion/copy or junction traversal.

`archive-inventory.cjs` inventories regular bytes, link counts, directories and
link targets without following links. Before/after: **3191 files / 273660655
bytes / 435 directories / one node_modules junction**, exact inventory SHA
`649e688b294771dfb9669e2f10bdac0aa247a8d76d95c8e82289cc3e6e5b82d5`.
Junction target remains protected d53b's node_modules; no dependency is moved.
The original `base-f59fe086.tar` remains at its previous ignored path, SHA-256
`fcb11c508693b6679526a28c8fb83d05a47ab473e4391c407f94a4c8e3a9a4ba`.
Both generated inventory summaries have raw SHA-256
`c14d51fb0bdb56762af0c7b194879c9a72a26391b15633dca6b1d2ee72375df8`.
Nothing deleted; the archive remains usable from its new location. Rollback is
an audited move back to the now-absent source path (which would restore this
scanner failure); use the new external path for future baseline comparisons.

Unmodified scanner rerun after relocation: **4/4 passed**, exit 0; failing
check 612ms. `scanner-after-relocation.log` SHA-256:
`1dfe8ef67c95672850d8494d37d5ec97b6e0a4edce5921f9905fe2a91f3a4575`.
The failure-before/pass-after exact-path result supports this narrow cause.
It does not establish a full repository PASS or cure timing variability.

Post-relocation complete `npm run check`: **5693 passed / 73 existing skips /
zero failed**, both typechecks, complete exit 0. Ordinary 5022 passed with
73 skips across 368 files, elapsed 93273ms. Resource 671/671 passed, 22 files,
elapsed 193274ms; bridge provenance 7130ms and unchanged scanner 4/4. Inventory
390/368/22, workers 4/2, both phases once, empty failure classes. No diagnostic
runner/preload used. `full-check-after-relocation.log` SHA-256:
`71ec9cdf6de20316626a1c24f549f047bf11a63413f248dca04f5f67e976b3bc`.
This is a fresh complete local result, not an independent repository PASS or
proof of cured timing reliability. The original 13-timeout log and this turn's
archive-contamination failed log remain failed and preserved.

Retained previous failed full-check log SHA-256, independently recomputed:
`12b7a5f2ed45766715a03182b40b9eb31a18e9345d02b9f2c3582bf8651ff856`.
Exact pending packet digest:
`b7fdd4e5fbf8f8685de7e25baa9bcefe78df95829ad30a66ab6d23981f15c1c2`;
raw SHA-256 still
`d2020e7381679502380fa44c0e1c357da4204155f73885adabb479759eb3c4ba`.
Protected P1 inventory, recomputed with the Gate's exact executable block:
14 files / 412516 bytes /
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.

Diagnostic log SHA-256 values:

- `selected-traced.log`: `061bcb14b5435a1d1f3f5de5997c2c257bb3384132d824889630cefab912dbab`
- `thirteen-traced.log`: `511459445ef699071254b30715b5c843298e517dac96681317b1901bddb83768`

## Remaining work and authority

No new runtime implementation is delivered by this diagnosis. M2b still needs
a versioned changed-coverage manifest, exact semantic approval/reconciliation
binding, and the downstream consumers. Read-only inspection reconfirmed:
`reconciliationAuthoringLifecycle.ts:639` reads the old manifest and projects
coverage from the original candidate; `qaWizardCandidateBridge.ts:3351` rebuilds
approved production context synchronously; Blueprint and package lifecycle
callers depend on that synchronous loader. A new async validation path must
reach the real consumers; simply minting a new manifest is insufficient.
Preserve v5 cover-only coverage equality and the current paid-candidate factory.

Exact packet acceptance remains Guy's; it was requested during this diagnosis
and is not inferred from generic render permission. Actual current-consumer
parity still needs authorized propagation; no origin-tracking ref is forged.
After implementation and independent QA: exact reconciliation, Blueprint,
Boards/package qualification, then the bounded LOW sample. Original P1 remains
HELD P0=0/P1=3/P2=3; M2b completion/render readiness are not awarded here.
Application spend USD 0, no image/audio/provider call, approved-artifact
creation, Blueprint/package/locator/source change, publication or payment.

No independent PASS is self-awarded for this documentation/diagnostic range.
Its final local commit and complete copy-ready inspection/optional push/Claude
review brief are recorded in the ignored diagnostic root's `HANDOFF.md`.
No new Claude review was dispatched. At handoff no diagnostic, test or reviewer
process remains running; all requested local checks finished. Independent review
of this new evidence checkpoint is pending, not a silently extended code PASS.
