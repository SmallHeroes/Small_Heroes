# R1D Visual Time-of-Day Authority Closure — Implementation Evidence

**Date:** 2026-08-21
**Branch/worktree:** `codex/qa-wizard-presentation-dispositions` / `C:\GNart\Work\sh-wt-r1d-output-budget`
**Approved base:** `cf07e5cbd70afaaf694ec665164ab553aa648ce6`
**Status:** implementation and QA correction green; Claude Code re-gate pending

## Outcome

Visual Contract authoring, stable Set Board authority, Visual Package
qualification, and runtime finalization now share one closed time-of-day domain:

`day | night | dusk | dawn | mixed`

The shared canonicalizer keeps exact values, maps one recognized cue family to
its closed value, maps `evening` to `dusk`, maps multiple distinct families to
`mixed`, and returns `null` for blank or unmappable input. Unknown prose remains
present through draft normalization and therefore fails validation rather than
acquiring a default.

The Chameleon historical phrase `evening into night` is covered by compiler
regression and becomes `mixed`; cover `evening` becomes `dusk`. Provider
structured output can no longer author arbitrary strings for location, stable
Board location, or cover time authority.

Visual Package offline qualification now runs the same runtime world-authority
validator used by finalization. Unsupported time authority produces the closed
qualification reason `world_authority_invalid` and cannot be reported ready for
publication.

## Authority cutover

- Template draft schema: `vc-draft-schema/v16`
- Template system prompt: `vc-template-prompt/v14`
- Template user prompt: unchanged `vc-template-user-prompt/v13`
- Authoring request / receipt / readiness: `v44` / `v49` / `v47`
- B0 input / manifest / verification: `v33` / `v42` / `v42`
- Execution materialization input / result: `v32` / `v36`
- Supervisor request / readiness / result: `v41` / `v41` / `v34`
- Fresh Readiness evidence: `v41`
- Visual Package offline qualification: `v4`

Immediate authoring predecessors `v43` / `v48` / `v46` remain registered as
`legacy_immutable`. Current-only B0, execution, Supervisor, and Fresh envelopes
reject their redigested immediate predecessors. Candidate v9, policy, model,
budgets, retries, fallback, runtime enum, Boards, story text, and renderer are
unchanged.

## Validation

Provider-free focused validation:

- TypeScript: `npx --no-install tsc --noEmit` — PASS.
- Time/compiler/Board/prompt suites: 4 files, 100 tests — PASS.
- Structured-output compatibility and package lifecycle: 2 files, 49 tests — PASS.
- Authoring receipt/readiness lifecycle: 1 file, 101 tests — PASS.
- B0/request/canonical authoring boundary: 3 files, 254 tests — PASS.
- Execution materialization/Fresh/Supervisor: 3 files, 77 tests — PASS.
- Total focused: 13 files, 581 tests — PASS.
- `git diff --check` — PASS before documentation closeout.

Literal `npm run check`:

- TypeScript and autonomous Story typecheck — PASS.
- Ordinary tests — 3,392 PASS, 65 skipped, 5 failures.
- Resource-intensive tests — 20 files, 610 PASS.
- The five ordinary failures are the established missing ignored-`outputs/`
  fixture assertions in four unchanged specs: `momentum-gate-koko`,
  `page-entity-qa`, `story-read-back-validation` (two assertions), and
  `child-lexicon-ages-5-8`.
- No changed or adjacent test failed.

Corrective follow-up validation after Claude Code's first review:

- Time canonicalizer, migration, diagnostic census, compiler repair loop,
  package lifecycle and runtime-world authority: 6 files, 175 tests — PASS.
- TypeScript: `npx --no-install tsc --noEmit` — PASS.
- `git diff --check` — PASS.
- A second literal `npm run check` passed TypeScript and autonomous Story
  typecheck, then reported 3,398 ordinary tests PASS, 65 skipped, and the same
  five established missing ignored-`outputs/` fixture failures in the same
  four unchanged specs. Its resource-intensive phase passed 20 files / 610
  tests. No changed or adjacent test failed.

## External-effect proof and boundaries

No authoring provider, image provider, Vision, network, credential, storage,
database, publication, locator, Wizard promotion, render, deployment, or
production action occurred. The pre-existing untracked Chameleon Set Board
directory was not edited, staged, or removed.

The approved historical Visual Contract, Blueprint, package candidate,
reviews, approvals, and locators remain immutable. This implementation does
not mint replacement authority and does not reuse an old approval against new
bytes.

## Next gate

Give Claude Code the focused corrective commit range for adversarial read-only
review. Only after technical PASS may Codex
perform the deterministic offline Chameleon rebuild and present the newly
content-addressed Blueprint and Visual Package digests to Guy for fresh exact
approval. Publication/Wizard promotion then precede one separately gated
`gpt-image-2` LOW page. Full-book rendering remains blocked until Guy inspects
and accepts that page.

## Independent QA findings and correction

Claude Code returned a technical PASS for `cf07e5cb..7e97e69f`, with one
blocking planning consequence and one bounded regex finding:

1. the new validators correctly reject the historical Chameleon template, but
   no explicit offline current-schema migration API existed; and
2. the new Hebrew dusk/dawn cue regexes could match a cue inside an unrelated
   word such as `מערב` or `שחרור`.

Both are corrected without weakening the closed domain. The shared Hebrew cue
matchers now require whole Hebrew tokens while retaining explicit common
prefix forms. Tests also close the pre-existing `ירחון`/`ירח` collision.

`migrateBookVisualContractTemplateTimeOfDayAuthority` is an explicit,
runtime-unreachable offline migration for current-schema template evidence. It
clones the source, changes only location/cover/stable-Board `timeOfDay`, rejects
unmappable values, validates the whole result, and never restamps or mutates the
historical artifact. Callers must persist the clone under a new digest and
rebuild every reconciliation, Blueprint, package review and approval bound to
the former digest.

A read-only probe against the real immutable Chameleon Candidate
`fada3965253054a5703b7c26aa727d26c54ed23b15fb6a1bcf63d90802a5968f`
proved the intended no-provider path:

- source template digest:
  `4e945dc0aeec47f21339cc780cfa6d86d87055f60a75685e8f1a25ab7b35cf31`;
- migrated template digest:
  `51901523133394266c7e5a795e2ee5b5cf471733d9d781e61107484e3460f365`;
- Town location and stable Board: `mixed`;
- cover: `dusk`;
- full template validation: PASS;
- source Candidate/template bytes: read-only and unwritten.

The authoring Candidate remains immutable evidence and is not reminted. Its
coverage is available from the already frozen Visual Package Candidate through
the existing offline production-context path; new downstream content-addressed
artifacts and fresh exact approvals are still required. No paid authoring call
is needed or authorized.
