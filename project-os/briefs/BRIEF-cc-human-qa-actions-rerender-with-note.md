# BRIEF (CC) — Human-QA operator actions: re-render WITH NOTE + release (Slices 3+4)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first. ONE agent in this worktree.
- **QUEUED — do not start until** the delivery-fence work (`BRIEF-cc-fence-round5-continuation.md`) has passed the Codex re-gate, and the Slice-2 console has merged. This brief exists so the design is settled, not to run in parallel.
- **Gate: [CODEX-GATE]** — these endpoints release held books and inject operator text into image prompts. Commit locally; STOP for the re-gate.

## 2. SCOPE (what + why now)
Guy is the sole operator for the soft launch. He gets an alert, opens the console (Slice 2), sees the flagged pages and the reasons, and then must be able to **act**. Two actions, both audited:

**Action A — RE-RENDER WITH AN OPERATOR NOTE (Guy: mandatory).** This is the difference between rolling the dice again and fixing the actual problem. Re-rendering a false positive with the same prompt is a gamble; re-rendering with *"the child is well away from the railing"* is a correction.
**⚠️ The note is GUIDANCE, NOT AUTHORITY.** It is appended as additional guidance to the page prompt and can never override, weaken or disable a safety constraint or the visual contract. If a note could remove a safety constraint we would have built a back door around everything closed this month. Specifically:
- the note is injected in a clearly-delimited guidance section, never into the constraint/contract section;
- the re-rendered image runs the **full** safety + contract QA again before it can clear the hold — a re-render never auto-releases;
- if the re-render fails QA again, the order stays held (a new case revision), it does not fall through;
- the note text, actor and timestamp are persisted on the case (`decisionNote`) and appear in the audit trail;
- basic abuse guards: length cap, no prompt-control tokens, stored verbatim for audit.

**Action B — RELEASE ("leave as is").** For `anchor` and `contract_world` holds this is a normal operator judgement — one click, audited. **For `safety` holds, default to re-render.** ⚠️ **A Codex ruling is pending on whether a safety release button should exist at all.** Until it returns, implement the cautious form: a safety release requires an explicit typed confirmation plus a mandatory written reason, and is recorded distinctly in the audit trail. If Codex rules it out entirely, remove the path for safety holds.

**Out of scope — CANCEL + REFUND (Guy's decision 2026-07-18).** Refunds are performed **manually** for the soft launch. Refund code is where a P1 double-refund already occurred; at 18 orders a manual PayMe refund is two minutes and avoids opening the most dangerous path before launch. Do not build an automated cancel/refund button.

## 3. FILES / AREAS
- New admin action endpoints (release / re-render) — admin-gated, alongside the existing `app/api/admin/anchor-hold-release/route.ts` (reuse its authorization pattern: lock, exact marker, active-case guards, fence-bound CAS).
- `lib/single-page-image-regen.ts` — the re-render path, extended to accept the operator note.
- The prompt assembly for a page re-render — the delimited guidance section.
- `lib/human-qa/*` — case resolution + audit fields (`decisionNote`, `resolvedActor`, `resolvedAt`), new case revision on a failed re-render.
- The Slice-2 console — wire its disabled placeholders to these endpoints.

## 4. ACCEPTANCE CRITERIA
- Every action is **fence-bound and audited**: actor, timestamp, decision, note. No unaudited state change.
- A re-render **never** auto-releases: the new image must pass full safety + contract QA; a failure re-holds with a new case revision.
- An operator note **cannot** weaken a safety constraint or the visual contract — prove this with a test that attempts it and shows the constraint still enforced.
- Release respects hold precedence: a stronger active hold or case blocks it (409), on both flag states.
- Actions are idempotent — a double click cannot double-act.
- No automated refund path exists.
- `npm run check` green; money math untouched.

## 5. TESTS
- Note injection: a note attempting to disable a safety constraint → the constraint still applies; the note is stored verbatim for audit.
- Re-render that fails QA again → order stays held, new case revision, no delivery.
- Re-render that passes → hold clears through the normal fence-bound path, audited.
- Safety release (if permitted by the Codex ruling): requires typed confirmation + reason; audited distinctly.
- Release blocked by a stronger active case → 409, no delivery.
- Double-submit of each action → exactly one effect.

## 6. WHAT NOT TO TOUCH
Hold DECISION functions; money/coupon math; refund code (nothing automated); the board engine; Stage-1 safety semantics; the delivery fence primitives.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; commit per action unit on `feat/chunked-generation`; **Guy pushes**.

## 8. FINAL VERIFICATION
`npm run check` green. Report: the prompt-injection boundary (show the assembled prompt with a note, proving the constraint section is untouched), the audit fields written per action, the re-render QA loop, and the release precedence proof. **Then STOP for the Codex re-gate.**
