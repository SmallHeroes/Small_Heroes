# 08 — Open Questions

**Last updated:** 2026-07-06
Grouped by area. Each needs an owner decision or a routed brief. Resolved questions move to `02-decision-log`.

---

## Product
- **OQ-P1:** Which exact 8/18 slots are launch-eligible, and what's each one's QA status? (blocks G1/G3)
- **OQ-P2:** Is audio in or out of the sellable MVP promise for 07-15? (drives G5)
- **OQ-P3:** Final honest-copy pass — confirm no "in minutes", no likeness-without-photo promise, clear no-photo limitation.

## Technical
- **OQ-T1:** [ROUTED → Cursor, doc-only brief] Repo role docs conflict — `AGENTS.md` names **Codex** as CTO; `CLAUDE.md` + `AI_ROLES_AND_PROTOCOL.md` name **Claude** as CTO. DEC-008 accepted 2026-07-06; reconciliation brief at `project-os/briefs/BRIEF-cursor-role-doc-reconcile.md`. Close when merged.
- **OQ-T2:** [RESOLVED 2026-07-06 → see DEC-002] Codex round-2 = **FAIL** (3 fail-open seams). Routed to Claude Code for corrective commits → Codex re-gate. New follow-on **OQ-T5** below.
- **OQ-T5:** P1 must MODIFY `requireValidContractForRender` (`contractRenderGuards.ts:117`), not just wire it — it currently accepts a deferred Resolved contract. Do NOT start until P0 re-gate passes.
- **OQ-T3:** vNext reconciliation strategy — how to reconcile the ~45 stranded commits on `fix/visual-contract-live-wiring` without blind rebase. (Codex)
- **OQ-T4:** When/how does `feat/chunked-generation` cut over to PROD, and is env parity confirmed?

## Story / content
- **OQ-S1:** Manual QA capacity per week vs slots needed for launch — real throughput number?
- **OQ-S2:** Any slot with unresolved canon issues remaining (scarf/companion payoff notes)?

## Image generation
- **OQ-I1:** Do the 5 first-render defects all resolve via vNext, or are interim mitigations needed for launch?
- **OQ-I2:** Confirm HIGH vs LOW quality budget for the launch slot set.

## Narration / audio
- **OQ-N1:** Wire `applyTtsAmbiguityNiqqudPass` into prod narration, or defer audio? (= OQ-P2 technical side)

## Viewer
- **OQ-V1:** Any reader polish items that are launch blockers vs post-MVP?

## Payment / order
- **OQ-PA1:** Is the PayMe refund exactly-once design Codex-approved for launch, or still oscillating?
- **OQ-PA2:** Manual refund + support path — confirmed to exist and documented?

## UX / UI
- **OQ-U1:** Wizard mobile/summary final state — merged and launch-ready?
- **OQ-U2:** Order confirmation / ready / failure notifications — do they exist and are they on-brand?

## QA / PROD
- **OQ-Q1:** Admin visibility (QA queue / order dashboard) for supervised launch — exists?
- **OQ-Q2:** PROD env-var checklist owner + verification before charging.

## Launch / support
- **OQ-L1:** Intake throttle mechanism (waitlist/cap) for "first 30 families" — built or manual?
- **OQ-L2:** Go/no-go date confidence for 07-15 given engine work — realistic or slip?
- **OQ-L3:** Authorize ClickUp (+ other) connectors so Operator can sync Project OS ↔ tracker. (blocks 04 specifics)
