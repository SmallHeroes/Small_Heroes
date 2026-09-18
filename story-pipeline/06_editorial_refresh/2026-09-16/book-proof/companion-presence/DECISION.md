# Source-bound companion presence correction — 2026-09-18

Implementation milestone, same task and sole writer in
`C:/GNart/Work/sh-r3b1b-semantic-m1`, branch `codex/r3b1b-semantic-recovery-m1`.
Base `3fb03452398b8724df2785ecc715114cc9d90b4b`, clean, ahead3/behind0.
Protected dependencies d53b at768ccb2f and accepted-intent-wave-2 at63ccb484 are
clean/read-only. Guy's standing continuation authority applies; no new creative
choice, paid execution, source acceptance or independent PASS is inferred.

## Observed / expected / cause

Accepted typed direction6 requires the primary companion; the legacy prose-only
extractor omits her because that page does not name her. Supporting human cast
review cannot override this vector. Expected: an explicit review-only correction
can require the already-authoritative companion on a source-supported page.

## Scope and decision

Add `require_companion_presence` to the semantic overlay, not the legacy compiler.
It carries the exact accepted visual-direction JSON bytes, verified against the
snapshot's accepted revision raw SHA, and requires typed `companionPresence: present`
on the selected page. No text/regex inference, new companion identity or removal.
Check original presence/cast before state. Update private effective facts, castIds
and characterPresence together before presentation operations; revalidate all.
Presence plans/results use v2; existing v1 packets remain byte-identical.
The ordinary preview, current consumer reconstruction and approval/bridge paths
must revalidate the same operation; a hash alone never substitutes for disk source
acceptance or current consumer validation.

## Risks / alternatives / exceptions

Reject global extractor changes (would change paid replay), arbitrary cast edits
(would bypass authority), and natural-language presence matching (ambiguous).
Exact-byte source proof increases packet size; bounded per operation and by existing
CLI/consumer limits, safe rejection for excessive input. This adds presence only:
absence, explicit conflicts and unsupported direction versions fail closed.
No Panda/page/companion name in production. No full semantic recovery claim.

## Validation / rollback / stop-check

Prove the real omission offline, immutable input, wrong source/page/identity/stale
state rejection, duplicate operations, v1 downgrade rejection, downstream packet
reconstruction, rendering-prompt presence, and old packet identity preservation.
Run focused specs, tsc and full check; retain any non-green observation. Zero
provider/key/render/audio/cost. Separate code commit; rollback by reverting that
commit, preserving original artifacts. No push. Claude should attack forged source
proofs and consumer bypasses. No owner eyeball or Cowork decision required for this
bounded technical change. Remaining cast/moment/cover/custody holds remain open.
