# Book sequence continuity diagnosis and implementation gate

Owner request2026-09-19: investigate and fix book-wide identity, physical situation
and continuity drift, not another page-specific prompt. Current task sole writer,
semantic-m1 worktree/branch; base4ee9afc1 clean/ahead8. Protected d53b768ccb2f and
accepted-intent63ccb484 clean, read-only. Continue here, no new overlapping task.

## Observed vs expected / verified causes

Paid Panda p2 relocates the driver and ticket child to an invented box. QA caught
it in the second run. Expected: same station and occupants unless source allows
movement; camera, expression and framing may change. Existing preview continuity
tracks entity appearance and string attribute changes, not inherited physical
relationships. Page staging is repeated free prose, not a cross-page invariant.
Generator receives only identity/prop refs; preceding pages reach QA only. Both
owner-draft and run-local-story-preview have this asymmetry. Selection of prop
pixels did not eliminate invented boxes, so leakage alone is not the cause.
The current owner lane is diagnostic; production has different structured spatial
contracts and legacy scene-memory paths. Those are not missing globally and must
not be silently replaced or given new runtime authority by this change.

## Proposed general solution / acceptance

Add an optional hash-bound, whole-book sequence sidecar to the actual owner sample
entry. Complete page coverage; stable typed entity relations, explicit scene visits,
visible cast, current beat and book premise. Carry hidden entities' state without
requiring them to appear. Every relation change requires exact before/after values
and a same-page source excerpt. Scene cuts require source evidence too; same scene
does not permit a location reset. Appearance attributes are frozen unless explicitly
declared mutable; ordinary prose cannot change the sequence ledger. This is a
structural/evidence-binding check, not semantic proof that an excerpt entails a change.

Compile all pages before key access. Project one effective packet for renderer and
QA: book intent, prior narrative progress, current visible relations, allowed deltas,
current identity/state locks. Future pages are validated but not visual-reference
instructions. Use the adjacent diagnostically passed image only within the same
scene visit, bound by hash/review, and never as canonical identity or new prop truth.
Repair target replaces that fourth image to preserve input caps. Stop on any hold.
No reference across scene cut or from cover, held/unknown/stale/missing predecessor.

## Files / sequence / compatibility

New lib/local-book-sequence.ts + focused spec; owner-draft entry + real-entry tests;
offline Panda sidecar preparation/witness; CURRENT and this gate/handoff. Existing
plans/small sample identities remain unchanged when sidecar is absent. New policy
version for sequence runs. Sequence mode requires consecutive body pages beginning
at a scene boundary; no legacy render/qa downgrade. No automatic migration of old
paid roots. Prior evidence immutable. Future full local-preview/canonical integration
requires its own reviewed adapter; no claim of fixing paths not called here.

## Stop-check, risks, rejected alternatives

General data-driven implementation, no story names or page exceptions in code.
New user request explicitly authorizes technical correction; no unresolved creative
change, story edit, production deployment or authority expansion. No paid calls or
key read needed for proof. Rejected: blanket freeze (kills acting), whole-board per
page (future leakage), previous image as authority (drift accumulation), more prompt
prose alone, relaxed QA, and claiming deterministic code guarantees model compliance.
Risks: bad upstream authored state, false-positive/negative vision, copying prior
camera and prior hallucinations. Structural tests cannot establish pixel quality.
QA must attack transitions, coverage, source binding, cast inventory, hidden state,
cross-scene/cover reuse, failed predecessor, input mutation, actual request refs,
repair cap, legacy replay, and provider-unreachable preflight failures.

## Validation / cost / rollback

Focused adversarial tests and real entry with mocked providers; accepted-source
Panda offline witness with deliberate driver relocation rejected; tsc and fullcheck.
No render/audio/API spend; cost$0. Rollback focused commit, preserve all paid roots.
Next empirical validation after code review is a bounded same-scene pair, not a
full book or repeated blind retries. Guy judges actual quality; Claude independent
technical PASS pending. Existing canonical semantic HOLD remains untouched.
