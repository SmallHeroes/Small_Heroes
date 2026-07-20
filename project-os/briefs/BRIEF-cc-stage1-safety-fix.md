# BRIEF (CC) — Stage 1 FIX: make the safety hold universal, readiness-independent, fail-closed

**⚠️ TARGET BRANCH: `feat/chunked-generation`.** Fixes commit `eb4694ae`. **[CODEX-GATE]** — safety-critical; do NOT self-certify; stop for Guy→Codex re-gate.
**Origin:** Codex Stage-1 re-gate = FAIL. The nominal `safety:` path is correct, but "an unsafe image can never deliver" is NOT yet true — 4 P0 fail-opens. Fix all 4 + the design ruling.

## Fix 1 — safety is READINESS-INDEPENDENT (the core architectural fix)
Today safety enforcement rides `READINESS_MANIFEST_ENABLED`, which the producer no-ops when off (`quality-evidence-producer.ts:270`, `readiness-manifest.ts:51`) — and it is **OFF in Production** (live Vercel 2026-07-15). Legacy `package-delivery.ts:54` considers only the anchor gate and can set `ready` + send email.
- The safety hold must fire **regardless of readiness**. Add an **unconditional safety check at the package/email delivery boundary** (`package-delivery.ts:54`), evaluated BEFORE choosing manifest-vs-legacy delivery — a known/there-unverified hazard blocks `ready`+email on EVERY paid path.

## Fix 2 — `safety_unverified` is NON-soft-deliverable (fail-closed)
Missing key / HTTP error / malformed response currently return `passed:true`, `evidence_unknown`, **no safety tag** (`page-visual-qa.ts:362`, `:428`), and the image loop accepts them without regen (`image.ts:3145`).
- Treat a safety evaluation that could NOT confirm safety as **`safety_unverified` → non-soft-deliverable** (regen within budget, else hard-hold). "Can't confirm safe" must never deliver. Carry a distinct tag so it reaches the hold path.

## Fix 3 — a hash/integrity failure must PRESERVE the safety hold
A failed hash downgrades `failed → evidence_unknown` while keeping `safety:` in `reason`, but `contractHardHold` is set only for `verdict===failed` after hash checks, and integrity-block forces `contractHardHold:false` (`quality-evidence.ts:137`, `readiness-manifest.ts:626`) → with soft-deliver on it becomes `ready` (`readiness-manifest.ts:378`).
- A row carrying a `safety:` (or `safety_unverified`) reason must **hard-hold even under integrity-block / `evidence_unknown`** — safety survives the integrity path; never downgraded to soft-deliverable.

## Fix 4 — persist known raw safety ATOMICALLY + apply on every exit
- The asset transaction persists context but not `rawSafety`; delivered evidence is written later, outside the transaction (`chunk-runner.ts:1637`, `:1650`) → a crash loses the known hazard; recovery may overwrite it after a false-negative re-QA. **Persist known `rawSafety` atomically WITH the asset.**
- `applySafety` must run on **every** producer exit, including the `no_delivered_url` early return (`quality-evidence-producer.ts:146`).

## Fix 5 — distinct `safety_hold:` marker (Codex design ruling)
Sharing `contract_world_hold:` misclassifies a universal child-safety invariant as contract drift (`start.ts:60` even reports "contract-world drift").
- Introduce a typed **`hardHoldKind: safety | contract_world`**; emit a distinct **`safety_hold:`** top-level marker; update **`start.ts`** (redrive refusal) and the **exception-processor** to park BOTH kinds. Keep the existing `contract_world` behavior intact.

## Operational (Guy — launch prerequisite, NOT sufficient alone)
Enable `READINESS_MANIFEST_ENABLED` in **Production** (Vercel). Necessary but not sufficient — the architectural fixes above are the real fix. (Not on fire today: no paid prod orders yet, and staging/preview has it on. Must be on before any paid launch order.)

## Acceptance
- The full adversarial matrix has **NO fail-open**: {transform / transform-less / cover} × {soft on/off} × {budget left/exhausted} × {readiness on/off} × {hash ok/fail} × {safety verified / unverified}. Every unsafe-or-unverified image → hard hold, no `ready`/soft-deliver/`passed`/email.
- The `safety_hold:` marker reaches the persisted reason + top-level hold in every path (including readiness-off, no-URL, crash-recovery).
- `contract_world` hold + behavior unchanged; regression tests for each of the 4 fail-opens.
- `npm run check` green. Explicit pathspecs, commit on **`feat/chunked-generation`**, no push. **Run your adversarial self-review again, then STOP for Guy→Codex re-gate.**
