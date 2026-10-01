# Claude landing changes for QA

Guy asked Codex to check and push Claude's latest work to QA. This milestone
imports only the personal landing changes, not the local engine or paid services.
Codex is the sole writer in the existing QA integration checkout. There is no
unresolved product decision for this narrow preview promotion.

## Observations and scope

QA is deployed at `50eb17e5`. The clean integration checkout is at `c3db7a85`,
a local documentation closeout over that deployment. Claude's clean source is
`claude/personal-landing-clarity-20261002` at `ae502594`, based on `87b0d196`.
The complete missing landing delta is three commits from common base `86ca47e8`:
`be82efb7`, `87b0d196`, `ae502594`. The first two extend the existing sky
background; the third clarifies the product, adds a labelled hand-written
example and topic-free companion descriptions. Seven source paths differ.

The root cause of the version gap is separate branches, not a broken engine.
A whole-branch merge is unnecessary. Port the three focused commits without
replacing destination wizard tests or importing engine history. Correct the
inherited development note: QA live processing is off for everyone, while
authorized local pilots are a separate environment.

Relevant worktrees, verified clean before editing:

- Source, read-only: `C:/GNart/Work/sh-landing-clarity-20261002`, `ae502594`.
- Sole integration writer: `C:/Users/guyna/.codex/worktrees/personal-site-qa/Small_Heroes`, `c3db7a85`.
- QA release: `C:/GNart/Work/sh-release-reader-final`, `50eb17e5`, remote equal.
- Local engine, excluded: `personal-story-product/Small_Heroes`, `2ec333a3`.
- Protected checkouts: `d53b` at `768ccb2f`, accepted-intent-wave-2 at `63ccb484`.

## Plan and acceptance

Stay in this task; this is one small integration milestone, not a new execution
task. Port only landing TSX/CSS/content, the three source tests and source handoff.
No migration or package change. Preserve public landing markup, `/start`, QA
middleware/noindex fences, the new recording wizard, API routes, ledgers and paid
OFF flags. Verify the real shared component's public/preview rendering, source
assets, type checks, focused tests, full stability check and config-only release
check. Record native exits and limitations; do not call existing red gates green.
After a focused local commit, recheck the QA remote, fast-forward only the named
QA branch, await its READY Git preview and verify the stable alias and paid-off
HTTP responses. Production deployment identity must remain unchanged.

## Risks and review

Preview code still ships in the shared client bundle even when not rendered.
The example demonstrates the writing direction, not measured engine output or
clinical benefit. Public markup isolation and mobile layout are separate checks.
Claude's source browser evidence is not a fresh Codex measurement. Independent
Claude QA of Codex's port is pending; no self-awarded independent PASS.

Stop-check: general preview integration; no story-specific runtime patch;
no image/prompt/anchor/style-reference/payment/QA-threshold changes; no provider
cost or render allowance. Guy should inspect the resulting QA design. No new
creative consultation is needed to port the design he requested.

## Rollback and exclusions

Rollback the additive integration commit with a reviewed revert on QA or restore
the prior QA preview alias through a separately authorized operation. Preserve
the prior READY preview `dpl_8nhVmZT5hasBEmCzWL5iTbrGJrqc`. Never force-push,
change production, relax protection, activate live cloud writing, read keys,
reset pilot claims, render images, run DB mutations or clean worktrees.
