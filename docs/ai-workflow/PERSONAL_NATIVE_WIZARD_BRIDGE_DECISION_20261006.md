# Local wizard to native text engine — approved decision, 2026-10-06

## Runtime corrective milestone within the approved scope

On clean e5c27398 the authenticated real native GET failed with Next trying to
parse esbuild/lib/main.d.ts. The root cause is three static imports of Git-only
helpers from the offline source compiler. Correct all three edges using a
one-way Git-only core; re-export old helper names for historical callers. Do not
change Next external-package policy, ignore errors, weaken auth/source checks,
or use the legacy author as a workaround. Same task/branch, sole Codex writer.

Acceptance: the real Next native endpoint compiles and reports availability for
the staging-authenticated operator, quote/owner/source/admission tests remain
green, and an offline actual-API bundle regression excludes both the compiler
and esbuild. Typecheck and focused tests before local commit, independent Claude
review before the same one-book worker. Existing full repository RED remains a
separate release blocker. No paid attempt has yet started; same $12 maximum.
Rollback is the default-off native flag. Earlier paid evidence stays intact.

## Requirement and approval

Guy explicitly approves the proposed local connection and ONE short text-book
trial up to $12 for writing and model readings. Images, paid transcription,
deployment, push and public/QA activation are excluded. Existing OpenAI key and
native Claude login may be reused; no new credential is created. This task stays
in the existing execution worktree, sole writer Codex. Claude Code independently
reviews the committed milestone before live execution.

## Observed behavior and cause

At clean c9c3ef6b, codex/personal-book-storyboard-bridge (ahead43), the wizard
POSTs story_only to the older OpenAI book runner. The approved Opus author,
fresh Opus editor and Astra readings are a separate local CLI diagnostic. That
CLI accepts only wholly fixture-labelled eight-spread requests. Its causal edit
is not the old three-call editor receipt required by the storyboard bridge.
119/119 focused route/boundary/storyboard tests pass; they do not establish this
missing connection. Full release gate remains RED. No API was called for intake.

## General solution and scope

Add an explicitly default-off, authenticated loopback operator connector:
server-reviewed canonical request -> immutable one-approval queue -> existing
native single-book driver -> validated progress/text/readings in the wizard.
Use a native operator worker, not CLI spawning inside Next/Vercel. Retain the
existing same-process synopsis decision and one reserved plan repair. The
operator still reviews the plan; this is not autonomous customer fulfillment.
Preserve typed/transcript/chip/fixture provenance. An explicit approval- and
request-bound reviewed-text authorization admits the new mode at BOTH driver
and host boundaries; default fixture calibration is unchanged. No relabelling
real data, invented legacy receipts, new prompts, models, retries or fallbacks.

Likely files: native bridge contract/store/API/UI/worker and tests; narrow opt-in
authorization in single-book calibration and causal host; CURRENT/ROADMAP.
No database migration, new package or public route change. Existing six supported
companions only. Photos remain local previews, voice is not generated. Longer
books and storyboard/render source adaptation are separate milestones.

## Acceptance and validation

- Auth/host/origin/strict envelope before disk queue, keys or dispatch.
- Exact accepted-request/options/approval binding, unmodified fact provenance.
- ONE approval cannot fund another request/root/job, including after failure.
- Refresh/read-only polling never dispatches; stale request never displays text.
- Worker uses existing Opus/Astra transports and fresh editor conversation.
- Display is diagnostic only: original vs revised, retained findings, explicit
  partial/held/failed states and actual usage estimate, never product acceptance.
- Malformed critic evidence remains terminal; no silent clipping or retry.
- Offline tests on real queue/driver boundaries; tsc; full check with inherited
  failures distinguished; local browser checks; independent Claude adversarial QA.
- Only after QA: one source-pinned, separately configured $12 text trial. Record
  calls, estimates, unknown usage, native exit and immutable outputs. $12 is an
  estimate allowance, not guaranteed provider invoice. No image calls.

## Stop-check, alternatives, rollback and risks

General adapter, not story-specific code. Opt-in local only: other stories,
production, payments, public pages, rendering and existing calibration defaults
must remain unchanged. No fixed plot/location formula. Rejected: switch old
model flag (wrong chain), fixture-token bypass (false provenance), forge old
editor receipt (false accounting), host native Max on Vercel (wrong runtime),
add generic workflow framework (unneeded complexity).

Rollback: unset native connector flag; preserve queue and consumed families.
Never delete history to restore spend authority. Process death cannot resume a
consumed family. Queue privacy is local ignored storage without verified remote
backup; send only reviewed structured text, not audio/photo. Native internal
calls/list-equivalent cost are not invoice attestation. Malformed evidence can
still stop this first trial. Human product/story acceptance remains Guy's.

Protected topology: d53b768ccb2f; accepted-intent63ccb484; citation reviewer
3a271d97; native trial reviewer d50eaa36; Claude site32872660. No writes there.
Claude must falsify privilege escalation, mutable request/approval substitution,
duplicate worker/cross-root spending, legacy fallback, stale display, source
relabel and falsely ready partial output. No self-awarded independent PASS.
