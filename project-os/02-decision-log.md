# 02 — Decision Log

**Last updated:** 2026-07-06
Every meaningful product/architecture decision is logged here. Format below. `proposed` decisions are not yet approved — do not implement.

---

### Format
```
DEC-000: Title
Date:
Status: proposed / accepted / rejected / superseded
Owner:
Context:
Decision:
Why:
Rejected alternatives:
Risks:
Needs Codex review: yes/no
Revisit after:
```

---

DEC-001: BookVisualContract vNext = single source of truth for render quality
Date: 2026-07-02
Status: accepted
Owner: Guy
Context: First full-book render showed systemic continuity breaks (location leak, size drift, weak likeness). LocationBible/registry/QA were parallel, partially-overlapping mechanisms.
Decision: Make `BookVisualContract vNext` the authoritative engine; LocationBible/registry/QA become projections of it. Reconcile + complete the ~70% already built (compiler dormant in feat; ~45 commits stranded on `fix/visual-contract-live-wiring`). No blind rebase.
Why: Guy chose quality over hitting an earlier launch; continuity is the #1 sellability blocker.
Rejected alternatives: Greenfield rebuild (it's not greenfield — foundation exists); per-story manual sets (not a product solution).
Risks: Reconciliation complexity; scope creep past 07-15.
Needs Codex review: yes (reconciliation strategy)
Revisit after: P0 slice pushed + Codex round-2 pass

DEC-002: P0 visual-contract = one authoritative structured source per human trait (fail-closed)
Date: 2026-07-06
Status: accepted (Codex round-3 PASS, 2026-07-06) — P1 authorized
Owner: Guy
Codex verdict (2026-07-06): atomic/hash mechanics PASS; slice NOT fail-closed. 3 blocking gaps: (1) live freeze seam does not call `validateResolvedBookVisualContract` before hashing → can persist an invalid Resolved contract (`ensure-frozen-visual-contract.ts:117/190`); (2) frozen-contract dispatch falls to legacy validator on missing/unknown discriminant → accepts damaged Resolved shape + resume can reuse it (`readFrozenVisualContract.ts:21`); (3) Resolved validator drops Template invariants (accepts doctor `family_profile`, garment `family_profile`, malformed origins, palette version mismatch) (`validateResolvedContract.ts:41/107`). Fix = narrow corrective commits (Claude Code) + negative tests → re-gate. No revert/render. Slice already pushed to `origin/feat/chunked-generation` @ `d3c0d0c8` (feat only, not prod).
Follow-on (P1, do NOT touch now): `requireValidContractForRender` uses the weaker base validator (`contractRenderGuards.ts:117`) and accepts a deferred Resolved contract — P1 must MODIFY it, not merely wire it.
Context: Recurring humans (mother/doctor) deferred skin/hair "to per-order family lock" via page-text regex decoupled from the cast → colour drift between pages; doctor never a family role.
Decision: Replace prose deferral with a `BookVisualContractTemplate` (authored, may hold unresolved traits) → deterministically resolved per order into `ResolvedBookVisualContract` (superset of vNext contract; the ONLY thing hashed/frozen/rendered/QA'd). Structured traits authoritative; prose is a projection.
Why: Vague prose consistency is a broken mechanism; deterministic resolution eliminates free-picked colours.
Rejected alternatives: Keep regex family-lock (misses `אִמָּא`/"a parent", doctor); resolve child/companion here (out of scope — they have their own locks).
Risks: Money-adjacent (changes what the atomic freeze hashes). Green 1321 pass / 15 skip but UNPUSHED; must pass Codex before ANY P1.
Needs Codex review: yes (round-2 in progress)
Revisit after: Codex verdict

DEC-003: PayMe = primary payment rail for MVP
Date: ~2026-06 (logged 2026-07-06)
Status: accepted
Owner: Guy
Context: Israeli market MVP.
Decision: PayMe primary; Stripe later for international.
Why: Local market fit for launch.
Rejected alternatives: Stripe-first.
Risks: PayMe has no idempotency key + uncertain read-after-write → refund exactly-once is fragile (prior confirmed P1 double-refund). Refund design must be exactly-once both directions; Codex is the gate.
Needs Codex review: yes (any refund/order-lifecycle change)
Revisit after: International expansion

DEC-004: Launch = soft launch 2026-07-15, human-supervised QA
Date: 2026-06-15
Status: accepted
Owner: Guy
Context: Moved from 07-01 to add QA buffer. Reliability not yet proven for automation.
Decision: Soft/F&F launch, 8/18 slots, real payment, ~50% launch discount, Cursor + Guy only, manual QA gate on every book.
Why: Prefer supervised reliability over full automation pre-proof.
Rejected alternatives: Full public launch; full automation.
Risks: Throughput × Guy-QA is the rate-limiter; demand can outrun it → throttle intake.
Needs Codex review: no
Revisit after: Reliability proven at small scale

DEC-005: Matrix sellability gated behind `ENABLE_V3_APPROVED_BANK`
Date: ~2026-06 (logged 2026-07-06)
Status: accepted
Owner: Guy
Context: v3-approved slots (bunny bedtime, fox adventure) unsellable without the flag → matrix drops to 6/18.
Decision: `release-check` requires `ENABLE_V3_APPROVED_BANK=true`; sellable matrix = 8/18 with flag.
Why: Prevents shipping unsellable slots.
Risks: Env-var drift between environments.
Needs Codex review: no
Revisit after: More slots approved

DEC-006: Style02 stays gated (not sellable)
Date: 2026-06-14
Status: accepted
Owner: Guy
Context: Wardrobe-lock bug; impressive but not production-ready.
Decision: Do not open Style02 to customers before it's truly ready.
Why: Protect product quality.
Needs Codex review: no
Revisit after: Style02 lock contract shipped + proven

DEC-007: Color normalization ON (warm bias +5%)
Date: 2026-06-11
Status: accepted
Owner: Guy
Decision: `lib/book-color-normalize.ts` default ON, Guy-approved warm bias +5% from contact sheet.
Needs Codex review: no

DEC-008: Operating model — Claude Cowork as Project Operator/Chief of Staff
Date: 2026-07-06
Status: accepted (Guy, 2026-07-06)
Owner: Guy
Follow-up: Repo role docs (CLAUDE.md, AGENTS.md, AI_ROLES_AND_PROTOCOL.md) to be reconciled to this model via a doc-only Cursor brief (see project-os/briefs/BRIEF-cursor-role-doc-reconcile.md). Closes OQ-T1.
Context: Repo docs are inconsistent (`AGENTS.md` names Codex as CTO; `CLAUDE.md`/`AI_ROLES_AND_PROTOCOL.md` name Claude as CTO). Guy has defined a new operator model.
Decision: Claude Cowork = operator/orchestrator/chief-of-staff (this Project OS); Codex = technical gatekeeper; Claude Code = deep specialist; Cursor = frontend executor; ChatGPT = external advisor; Guy = owner/final approver.
Why: Single coordination layer + clear gatekeeping prevents agent sprawl and self-approval.
Rejected alternatives: Leaving the CTO-role ambiguity unreconciled.
Risks: Existing repo role docs contradict this — must be reconciled or they'll confuse agents (see `08-open-questions` OQ-T1).
Needs Codex review: no
Revisit after: Guy confirms + repo role docs reconciled
