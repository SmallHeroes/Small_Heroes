# Personal wizard to complete book planning: approved local pilot

## Requirement and authority
Guy explicitly requested activation of the existing recording wizard with the new
personal-story engine, authorised reuse of the existing key, and asked Codex to
implement missing connections. Codex is sole writer in this chat on
`codex/personal-book-storyboard-bridge`, base `10f54930`, clean/no upstream.
Claude's site work and the protected dependencies are not implementation targets.

## Observed / expected / cause
Cloud QA intake reports `live_flag_off`; recording alone does not start decoding.
The new wizard calls only the old manuscript endpoint, not the four-stage book
runner. Its live writer and runner are authenticated loopback-only diagnostics.
The memory ledgers cannot enforce a cross-instance cloud spending ceiling.
Claude independently HOLDs paid execution: 5k planning cap and a single 180s
writer timer, then 180s per visual call despite 32k–55k output caps. These are
predictions informed by two measured plan calls, not observed longer-run failures.

Expected: reviewed request goes to one automatic book job, using the same exact
request identity for prose, whole-story storyboard and semantic review. Edits
invalidate results. Show held diagnostics honestly, without admitting rendering.

## Scope / design / order
1. One length policy scales writer output caps and their reservation; one deadline
   policy provides each stage cap/25 tokens-per-second plus 60s prefill headroom.
   This conservative floor is a bounded engineering assumption, not latency SLA.
2. Runner and SDK use matching per-stage deadlines; distinguish timeout/cancel,
   preserve unknown usage, no retries. Move writer key access after reservation.
3. Connect summary UI to the separately gated book route (no silent writer
   fallback). Validate result identity and render manuscript plus storyboard and
   hold details; stale/unmounted jobs cancel and ignore late results.
4. Open one loopback local server using existing credentials in memory; no new
   key creation, secret file, public/cloud flag activation or deployment.

## Acceptance / verification
All 8/12/16 lengths share reservation/cap/deadline policies. Cancellation and
late failure cannot advance or alter accounting. Auth, budget and request checks
precede key reads. Browser can reach recording/decoding, editable reviewed card,
and the book action. Focused tests, tsc, full check and real browser evidence.
Synthetic test data is explicitly labelled; real provider quality remains
unproven until the parent runs and judges a completed job.

## Cost / privacy / exceptions
Intake total ceiling $1, at most eight processing jobs; book total ceiling $3,
at most one job, gpt-6-sol medium (existing priced adapter). Reservations are not
invoices; no retries/refunds of reservations. Do not restart the server to reset
spent budget. No images, narration, payments or customer release. No automatic
recording or sending of parent audio by Codex. Pilot data stays in the browser,
provider calls use store:false; diagnostic output is not a delivered book.

## Rejected alternatives / risks / rollback
Do not enable cloud live flags around process-local ledgers; do not fake decoding
or accept contradictory storyboard; do not simply raise one whole-job timer.
Keep camera variety independent of physical state. Remaining risks: model prose
quality, semantic review accuracy, large payload bounds, missing usage, long
latency, inherited RED full gate and independent QA pending. Disable pilot flags
and stop only its identified server to roll back; commits remain local.

## Stop-check / review assignment
General fix, all companions/lengths, public defaults unchanged. Guy has approved
activation/testing, not public release. Smallest proof is one recorded/text input
and one whole text/storyboard job, zero images. Claude should attack timer races,
reservation/key ordering, 16-spread policy, request revision binding, UI holds,
server-side/client import boundaries and default-off/public access. Guy judges
the manuscript's humour, child agency, dynamic causality and age-appropriate voice.
