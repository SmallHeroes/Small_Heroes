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
- **OQ-T2:** Codex round-2 = FAIL → Claude Code fixed all 3 seams, pushed `32dcfe3a` (green 1333/15). **Now awaiting Codex round-3 re-gate.** CC's verify-list for Codex: no hash regression (materializeContract untouched); Fix-2 resolved-shape detection keys on materializerVersion/paletteVersion; the one retargeted dispatch test (tightening not weakening); Fix-3 mirrors Template invariants. Close when Codex verdict in.
- **OQ-T6:** Push governance — Claude Code pushed `32dcfe3a` itself (clean fast-forward, DoD required it), which conflicts with `03-agent-roles` "only Guy pushes". **Guy to decide:** push stays Guy-only, OR executors may fast-forward-push feature branches (never main/prod). Recommendation: allow FF-push on feat, Guy-only for main/prod.
- **OQ-T5:** [RESOLVED 2026-07-06 — Codex PASS] `fc1ca72d` Codex-PASS, zero findings (verdict from the independent Codex CLI — CC did NOT self-certify its own commit; the model worked). Render-gate laundering bypass closed via shared `classifyFrozenContract`. **Engine now fail-closed at BOTH the freeze seam (P0) and the render gate (P1).** Enforcement still OFF everywhere. Go-decision → OQ-T7. Note-for-later: invalid-contract failure classified retryable/infra_transient (bounded 3) — arguably should be permanent-fail.
- **OQ-T7:** [AUDIT DONE — see `09-staging-enforcement-enablement.md`] CC audit: **0 templates, 1 contract (`bunny_ometz_adventure`) repo-wide.** With `ENABLE_V3_APPROVED_BANK=true` all 18 slots serve from `v3-approved`; freeze looks there → **1 slot renders, 17 block (7/8 sellable block).** **NO-GO for broad enablement.** Recommended (CC): a **narrow mechanism-validation run** on staging — 1 bunny-adventure order (render passes) + 1 gap-slot order (block works) — to prove plumbing without pretending the catalog is ready. Flags: `VISUAL_CONTRACT_ENFORCEMENT` + `VISUAL_CONTRACT_FREEZE` + `ENABLE_V3_APPROVED_BANK`, staging `VERCEL_ENV=preview` (prod is hard-off), redeploy, rollback = flags off + redeploy. Real blocker → OQ-T8.
- **OQ-T8:** [OPEN — the real launch-gating content track] **WS0c artifact authoring:** author a valid visual-contract **template/contract** in `story-bank/v3-approved/{slot}.visual-contract*.json` for every intended-sellable slot. **0 exist today** (only bunny_ometz_adventure). Without one, a slot renders via the inconsistent **legacy** path (enforcement off) or **blocks** (enforcement on) — i.e. **the #1 visual-consistency blocker is UNSOLVED for the catalog until these are authored; the engine is only the mechanism.** Precondition: pin the 8 slots (OQ-P1) to bound the list. Re-assess authoring effort vs the 2026-07-15 launch.
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
