# Residual full-check correction — implementation evidence

Date: 2026-09-07. Status: **DELIVERED FULL CHECK GREEN; INDEPENDENT QA PENDING**.

## Requirement, authority and topology

Guy approved both parts of `R3B1B_RESIDUAL_CHECK_DIAGNOSIS_AND_GATE.md` together
(`יש אישור`): isolate historical authoring policy and remove test dependence on
dated ignored outputs. One local milestone/commit, one delivered full check,
no rerender, provider, real credential, payment, deployment, cleanup or push.
Codex implements; Claude independently reviews; Guy retains product acceptance.

Sole writer: this Codex task, `C:/GNart/Work/sh-r3b1b-semantic-m1`, branch
`codex/r3b1b-semantic-recovery-m1`. Base `d3e6bf7fc7e09cc7b3414fbd85b613ad3b75ff69`,
clean at start, ahead 3/behind 0 against cached `origin` at `a0344114`.
No remote refresh or propagation claim. The delivery commit is identified by
the post-commit handoff, outside its own self-referential documentation.

Read-only dependencies: d53b `768ccb2f`, accepted-intent-wave-2 `63ccb484`, detached
QA baseline `a0344114`. Fixture source worktrees and their pre-existing changes
are documented in the approved gate and fixture README; no original fixture
input was changed and no worktree was removed/reused for implementation.
Previous independent scheduling PASS covers
`3a455c48..ef7a13e8`, not this implementation or the intervening diagnosis docs.

## Implementation / architecture / unchanged behavior

Only `wizardAllStoryRenderReadiness.ts` changes runtime library behavior.
Its private shared auditor now consumes a readonly authoring policy containing
both version and admission ceiling. The closed R3B0b entry point supplies
frozen v21/16; the ordinary entry point supplies the current exported constants.
Admission, blocker prose, row evidence and decision summary use the same policy.
Both public entry points explicitly pick allowed arguments: untyped injected
policy objects cannot override the selected policy. No public compatibility
switch is added to production callers or the compiler. The report version type
accurately admits both existing policy versions.

The six previously non-portable consumers now use 14 original text/JSON files
(155457 bytes) under `lib/__tests__/fixtures/residual-gate/`, with original SHA-256
and byte-count provenance. Scoped `.gitattributes` prevents checkout EOL changes,
including the original missing final newlines in four JSON files. All original
semantic assertions remain. Lifecycle inputs are copied into unique test-owned
roots under their original logical request paths, preserving hashes and authority.
Read-back tests own temporary directories per test. The PNG transport case uses
a valid deterministic 16x16 PNG from the existing Sharp dependency, preserving
prefix/length assertions and additionally checking exact decoded bytes/metadata.
The source 3MB rendered PNG was not imported or edited.

No new canonical spec, dependency, runner/config/workload-policy, workers,
deadlines, retries, skips or approved digest pin was changed. No actual accepted
Story Source, Visual Contract, Blueprint, Board, package or original P1 output
was repaired/published. Rollback is one focused commit revert; no migration.

## Validation completed before the delivered full check

- 10 affected/Wizard suites: **77/77**, exit 0, 42.37s. This includes all nine
  previously failing suites and the current/historical Wizard controls.
- Five existing infrastructure suites: **60/60**, exit 0, 11.01s. Runner sources
  are unchanged. The controls retain assertion/timeout/hook/unhandled-error
  failures, ACK waiting and cancellation behavior.
- `npx tsc --noEmit` and `npm run story:autonomous-typecheck`: both exit 0.
- Three opt-in policy-isolation controls: **3/3**, exit 0, 10.15s. A module mock
  changes only the CURRENT ceiling to 8, not the historical report or pins.
  Current admission follows 8, while historical admission and hashes stay v21/16.
  This is deliberately outside canonical discovery; not a production override.
- All 14 fixture hashes match their original bytes; all corresponding dated
  input locations are absent in the implementation checkout. No fixture test
  reads the original source worktree path in provenance. The first diagnostic
  shell locator check needed slash normalization for Windows source paths;
  the corrected check passed without changing any fixture or test.

Exact recovered identities (pins unmodified):

- historical report: `4e0a667926639526b106bc45cd3c4e7df7c11518d7cf941e35d528d856294977`;
- review canonical: `7a8434c76f90bc96776909430e93fecb97f2c8a08800085d0ba3e55d7f97a143`;
- review raw bytes: `143ff1a7a0f67382ae5efce1deecf492761bb51809f7183cf6c8304c682d5a08`;
- correction canonical: `96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b`.

## Delivered full check

One `npm run check` completed, **exit 0**, including both typechecks:

| Phase | Files passed / failed / skipped | Tests passed / failed / skipped | Vitest duration |
| --- | --- | --- | --- |
| Ordinary, 4 workers | 347 / 0 / 17 | 4884 / 0 / 73 | 132.66s |
| Resource-intensive, 2 workers | 22 / 0 / 0 | 671 / 0 / 0 | 310.81s |

Total **5555 passed, 73 skipped, zero failed** across the unchanged 386-file
inventory (364 ordinary + 22 resource-intensive). The ordinary 73 skipped tests
remain the existing skips; the formerly setup-blocked 11 lifecycle cases now
run and pass. Both phase diagnostics have `exitCode: 0`, `diagnosticProtocolOk:
true`, empty `classes`, and `gateStatus: passed`. Overall summary is passed.
Each phase ran once; no second full run, worker/deadline change or new skip.

The previously reviewed runner/control surfaces also passed in the delivered
run, including Supervisor 48/48, real-candidate bridge 15/15 (233.262s suite),
Wizard 15/15 and cooperative runner 16/16. This is local repository test evidence,
not independent Claude PASS, production release or product/visual acceptance.

## Post-check controls and preservation

The new fixture-integrity assertion was run with a read-only in-memory mock
that flips one byte of the lexicon fixture without changing its length or disk
contents. The real canonical spec failed at its SHA-256 assertion, as required:
Vitest exit 1, one intentionally failed test (the three unselected tests are
skipped by the opt-in name filter only). The diagnostic wrapper required that
exact failure and exited 0. This is a successful negative control, not a residual
failure or a second full check. No canonical code changed after the delivered run.

Original P1 after the full check: 14 files, 412516 bytes, raw inventory
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`, unchanged.
The original source fixtures and imported fixtures were rechecked against all
14 provenance hashes. No original source input was removed. Cleanup performed
by existing/fixed tests is restricted to their disposable test-owned outputs.

Staging exposed original trailing spaces in two imported Markdown snapshots;
the first staged `git diff --cached --check` exited 2. Inspection found 51
two-space endings in lexicon and 68 endings in read-back (66 two-space hard
breaks, two single-space metadata endings). Byte preservation forbids trimming
these inputs. Only the two exact fixture paths receive `whitespace=-blank-at-eol`
in their scoped Git attributes; all other whitespace rules and all code checks
remain. Their SHA-256 tests continue to enforce every original byte. This
packaging-only adjustment occurred after the delivered full run; no test,
runtime code or fixture bytes changed and the full check was not rerun.

## Evidence and limitations

Logs and opt-in controls: `outputs/qa-residual-gate-fix-20260907/`.
`focused.log`, `infrastructure.log`, `typecheck.log`, `autonomous-typecheck.log`,
`policy-isolation.log`, `policy-isolation.fixture.ts`, `isolation.config.ts`,
`fixture-independence.json`, `npm-run-check-delivered.log`,
`fixture-corruption-negative.log`, `fixture-corruption.setup.ts`,
`corruption.config.ts`, `p1-inventory-after-check.json` and topology snapshots.
These are ignored local evidence, not runtime authority. Historical diagnostic
counterfactual tests under the older output root describe the pre-fix failure;
they were not rerun and must not be mistaken for post-fix acceptance controls.

Frozen SHA-256 values:

| Evidence | SHA-256 |
| --- | --- |
| `npm-run-check-delivered.log` | `5d1c6df492be7f6eab8194431240c0435d700b00669629f89f70a7374ced7fe3` |
| `focused.log` | `d501b73f44d3982266a82ca9f676503ab88862c973c4d6fe71e99d8c7de93d77` |
| `infrastructure.log` | `286b60fe388af671a28eeaf355c00965da0a191caacf408dbfc91b6543416e4e` |
| `policy-isolation.log` | `74d1ec4935619da8b7d4ab751a4a4b764e41c23721d6b079f196f30b103a1771` |
| `policy-isolation.fixture.ts` | `f75b46b7f577438cfc9513af439666e24c8ee9d897a30cc1eb978bdfad6262b0` |
| `fixture-corruption-negative.log` | `392aec6c2d002e390082b526f8fd44ef3bb9c9c2f425f0e1017b073a18a9e587` |
| `fixture-corruption.setup.ts` | `73d374d6fb66e414ea45b79f224caaead93afb15c945f152b75c6e6802cc836b` |
| `fixture-independence.json` | `48498903a87e7efb151453de328dafa81abae9d64bba2dc2c6a17b9c80f0b086` |

No Linux/fresh-clone execution, live API, browser, release, real semantic recovery
or visual QA is claimed. Byte preservation is verified locally and enforced by
Git attributes, not inferred to be a completed cross-platform CI run.
P1 remains semantically **HELD P0=0/P1=3/P2=3**. Remaining M1b/M2 and render
qualification are incomplete. External spend $0. Independent QA remains pending.

## Claude first-pass falsification targets

Read-only on the exact base-to-delivery-commit range in the handoff:

1. Can a current policy change still alter historical admission/digests, or can
   an untyped caller inject the private policy? Check every consumer, not labels.
2. Do the untouched review/correction validators reproduce all original identities
   and still reject altered provenance, authority, collisions and publication?
3. Are the fixtures exactly original bytes, portable under Git EOL conversion,
   with no hidden dated-output fallback, approval extension or weakened assertion?
4. Does PNG transport still exercise real local-file-to-data-URL conversion?
   Do read-back/lifecycle tests isolate and clean only their owned temporary data?
5. Verify the one delivered full log, inventory, phase count, workers, exit status
   and any residual failure honestly; do not infer all-green from focused tests.
6. Check original P1 integrity, untouched sources, worktree ownership, prior PASS
   boundary and absence of provider/render/spend/push authority by implication.
