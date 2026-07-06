# 06 — Risk Register

**Last updated:** 2026-07-06
Severity: Critical / High / Med / Low · Probability: High / Med / Low · Status: open / mitigating / watching / closed

| ID | Risk | Area | Severity | Probability | Owner | Mitigation | Status |
|----|------|------|----------|-------------|-------|------------|--------|
| R1 | Full-book visual inconsistency (location leak, character size drift, weak likeness, family incoherence) makes books feel AI-generated → not sellable | Image / engine | Critical | High | Guy | Complete BookVisualContract vNext reconciliation; per-page 0.70 gate; manual QA on every book pre-launch | mitigating |
| R2 | PayMe refund not exactly-once (no idempotency key, uncertain read-after-write) → double refund or missed refund | Payment | Critical | Med | Guy/Codex | Codex-gated refund design; exactly-once both directions; prior P1s fixed & verified | mitigating |
| R3 | Demand at soft launch outruns QA throughput (Guy manual gate) → slow delivery, broken promises | Ops / launch | High | High | Guy | Throttle intake ("first 30 families"), batch, triage; honest copy on timing | open |
| R4 | Money/concurrency/security bugs under-caught by non-Codex review | Eng process | High | Med | Codex | Mandatory Codex gate on money code; never self-certify | mitigating |
| R5 | Scope creep on engine work pushes past 07-15 | Launch | High | Med | Guy | Operator separates MVP vs post-MVP; Decision Gate discipline; 8/18 slot floor | open |
| R6 | Narration niqqud homograph gap ships in audio (~16/122 bare) | Audio | Med | Med | Guy | Wire `applyTtsAmbiguityNiqqudPass` into prod OR ship audio-optional for soft launch | open |
| R7 | P0 visual-contract slice is money-adjacent (changes atomic freeze hash) and UNPUSHED | Eng | High | Low | Codex | Held for Codex round-2 before ANY P1; green 1321/15 | mitigating |
| R8 | PROD env drift (flags need redeploy; `ENABLE_V3_APPROVED_BANK` gates sellability) | PROD | High | Med | Guy | release-check gate; confirm env parity + redeploy before charging | open |
| R9 | Git EOL/CRLF churn + `git add -A` → accidental mass-commit / lost work | Repo hygiene | Med | Med | All | Explicit pathspecs only; `.gitattributes` present; commit per green milestone | mitigating |
| R10 | Cowork edit-sync gap — Operator Write/Edit may not reach Guy's Windows tree | Tooling | Med | Med | Guy | Route commit-bound changes through Cursor with exact diffs; verify git status | watching |
| R11 | Branch sprawl / unmerged work (wizard branches history) | Repo | Med | Low | Guy | Merge discipline: approved work → merge+push immediately; log unmerged in memory | mitigating |
| R12 | Story-specific patches masquerading as product solutions | Product/eng | Med | Med | ChatGPT | "Fix general systems" principle; ChatGPT challenges generality | mitigating |
| R13 | Opening Style02 / >8 slots prematurely to hit numbers | Product | Med | Low | Guy | Style02 gated (DEC-006); slot floor with flag; quality-gate discipline | watching |
| R14 | Trackers/connectors (ClickUp etc.) unauthorized → Project OS drifts from actual tasks | Process | Low | Med | Guy | Authorize connectors; Operator syncs Project OS ↔ ClickUp | open |
