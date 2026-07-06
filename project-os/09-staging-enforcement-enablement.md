# 09 — Staging Enforcement Enablement: checklist + slot-contract-readiness audit

**Author:** Claude Code (deep specialist) · **Date:** 2026-07-06 · **Status:** audit for Guy's go/no-go
**Scope:** read-only audit + plan. No flags flipped, no env/config/code changed, no renders. The actual staging flip is **Guy's decision.**
**Depends on:** P1/OQ-T5 render gate (Codex PASS `fc1ca72d`).

---

## TL;DR — headline verdict

**NO-GO for enabling enforcement across the sellable set today.** The render gate is correct (Codex-PASS), but **the bank has almost no contract/template artifacts**: of all 18 matrix slots, **exactly one** (`bunny_ometz_adventure`) has a valid visual-contract artifact in the dir it is served from. **Zero `.visual-contract-template.json` files exist anywhere.** So the moment enforcement is on, **every slot except MEDICAL × adventure would hard-block render** (order fails before the cover) — i.e. ~7 of the 8 sellable slots.

**What IS safe now:** a **narrow mechanism-validation run** on staging using `bunny_ometz_adventure` (proves render-passes) plus any one other slot (proves block-works). That validates the enforcement plumbing end-to-end without pretending the catalog is ready.

**Precondition to broad enablement:** author a valid template (`{key}.visual-contract-template.json`) **or** legacy contract (`{key}.visual-contract.json`) in `story-bank/v3-approved/` for **every** slot you intend to sell under enforcement (the WS0c authoring work). Until then, enforcement can only be a staging mechanism test, never the live path for the sellable set.

---

## Part A — Staging-enablement checklist

### A1. Flags to set (STAGING env only — never Production in this task)
| Env var | Value | Why | Prod safety |
|---|---|---|---|
| `VISUAL_CONTRACT_ENFORCEMENT` | `true` | Turns the render gate ON (blocks an absent/invalid contract). | Hard-off on Vercel Production via `isVercelProductionRuntime()` — even if set, it stays OFF on prod. |
| `VISUAL_CONTRACT_FREEZE` | `true` | Produces + freezes the contract before the cover, so a contract EXISTS to enforce. **Required** — with freeze off, nothing is frozen and the gate blocks *everything*. | Same hard-off-on-prod gate. |
| `ENABLE_V3_APPROVED_BANK` | `true` | Required for sellability (release-check) AND it routes serving to `story-bank/v3-approved/` (where the one artifact lives). | n/a |
| `VISUAL_CONTRACT_STEERING` | leave **unset/false** | Steering changes render *output*; the validation run is about the *gate*, not steering. (It also requires enforcement, so it can't leak on alone.) | Hard-off on prod. |

**Reference:** `lib/visual-contract-compiler/contractRenderGuards.ts:28-50` (enforcement + freeze flags, prod hard-gate).

### A2. Redeploy (flags do not take effect until you redeploy)
1. Set A1's vars on the **staging** Vercel project/environment (the separate staging Supabase + Preview env).
2. **Redeploy staging.** Vercel reads env at runtime, but a running deployment does not pick up new env vars — a redeploy is required.
3. Confirm the staging deployment's `VERCEL_ENV` is **`preview`** (NOT `production`) — otherwise `isVisualContractEnforcementEnabled()` returns false and enforcement never engages (the prod hard-gate). This is the #1 gotcha.

### A3. Post-deploy verification (before trusting the run)
1. **Enforcement is actually on:** verify on staging that a request path evaluates `isVisualContractEnforcementEnabled() === true` (i.e. `VERCEL_ENV=preview` + flag set). If it reads false, you're testing nothing.
2. **Positive path (renders):** place a staging order for **MEDICAL_PROCEDURE × adventure** (`bunny_ometz` / `bunny_ometz_adventure`). Expected: freeze loads `bunny_ometz_adventure.visual-contract.json` → gate passes → cover + pages render → held `needs_human_qa` as usual.
3. **Negative path (blocks):** place a staging order for any other slot (e.g. **NIGHT_FEAR × bedtime**, `fox_uri_bedtime`). Expected: freeze finds no artifact → no frozen contract → gate throws `MissingVisualContractError` → the generation fails **before any paid image**. Confirm in logs and that the order lands in a clean failed/hold state (see A5).
4. **Logs:** look for the render-gate throw and, if a slot ever has an invalid Resolved, the freeze's `"Refusing to freeze an invalid Resolved contract"` warn.

### A4. Rollback (fast, no data migration)
- Set `VISUAL_CONTRACT_ENFORCEMENT=false` (and optionally `VISUAL_CONTRACT_FREEZE=false`) on staging → **redeploy** → render returns to byte-identical legacy behavior.
- No cleanup needed: nothing is frozen on prod; staging frozen contracts are content-addressed and harmless. Failed staging orders are disposable test orders.

### A5. Verify BEFORE the run (open risk to confirm, not assert)
- **Failure landing:** the gate throws inside the chunk-runner `try`; confirm the pipeline's catch treats `MissingVisualContractError` as a **clean terminal failure** (correct order state, no partial paid spend, no infinite redrive, refund/QA-hold per G8). This is money-adjacent and should be eyeballed on the first blocked staging order — it was not changed by the P1 work but it is where the block lands.

---

## Part B — Slot-contract-readiness audit

**How to read this:** with `ENABLE_V3_APPROVED_BANK=true`, `resolveStoryProductTruth` (Step 1) serves **every** slot from `story-bank/v3-approved/` (all 18 `{companion}_{direction}.md` exist there), and `text-finalization.ts:50-58` stamps `cache.storyDir='v3-approved'`. So for **every** slot the freeze needs `story-bank/v3-approved/{companion}_{direction}.visual-contract-template.json` OR `…​.visual-contract.json`. **Repo-wide, only one such file exists.**

### B1. Artifact inventory (ground truth, entire repo)
- `.visual-contract-template.json`: **0 files** (no templates authored yet).
- `.visual-contract.json`: **1 file** → `story-bank/v3-approved/bunny_ometz_adventure.visual-contract.json` (legacy vNext, no `contractKind`; validated by `lib/__tests__/bunny-ometz-adventure-visual-contract.spec.ts:75-77`).
- `story-bank/v5-fixed-v2/`: **0** contract/template artifacts.

### B2. Per-slot table (all 18 slots; served dir = `v3-approved` with the flag on)

| # | Category | Companion | Direction | Configured | Artifact in `v3-approved`? | Under enforcement |
|---|---|---|---|---|---|---|
| 1 | NIGHT_FEAR | fox_uri | bedtime | approved | ❌ none | **BLOCK** |
| 2 | NIGHT_FEAR | fox_uri | adventure | approved_v3 | ❌ none | **BLOCK** |
| 3 | NIGHT_FEAR | fox_uri | fantasy | approved_v3 | ❌ none | **BLOCK** |
| 4 | SOCIAL | panda_anat | bedtime | approved_v3 | ❌ none | **BLOCK** |
| 5 | SOCIAL | panda_anat | adventure | approved | ❌ none | **BLOCK** |
| 6 | SOCIAL | panda_anat | fantasy | approved_v3 | ❌ none | **BLOCK** |
| 7 | MEDICAL_PROCEDURE | bunny_ometz | bedtime | approved_v3 | ❌ none | **BLOCK** |
| 8 | **MEDICAL_PROCEDURE** | **bunny_ometz** | **adventure** | **approved** | ✅ `bunny_ometz_adventure.visual-contract.json` (valid vNext) | ✅ **RENDER** |
| 9 | MEDICAL_PROCEDURE | bunny_ometz | fantasy | approved_v3 | ❌ none | **BLOCK** |
| 10 | NEW_SIBLING | dragon_dini | bedtime | approved_v3 | ❌ none | **BLOCK** |
| 11 | NEW_SIBLING | dragon_dini | adventure | approved_v3 | ❌ none | **BLOCK** |
| 12 | NEW_SIBLING | dragon_dini | fantasy | approved | ❌ none | **BLOCK** |
| 13 | TRANSITION | chameleon_koko | bedtime | approved_v3 | ❌ none | **BLOCK** |
| 14 | TRANSITION | chameleon_koko | adventure | approved | ❌ none | **BLOCK** |
| 15 | TRANSITION | chameleon_koko | fantasy | approved_v3 | ❌ none | **BLOCK** |
| 16 | ANGER_FRUSTRATION | lion_shaket | bedtime | approved_v3 | ❌ none | **BLOCK** |
| 17 | ANGER_FRUSTRATION | lion_shaket | adventure | approved | ❌ none | **BLOCK** |
| 18 | ANGER_FRUSTRATION | lion_shaket | fantasy | approved_v3 | ❌ none | **BLOCK** |

**Result: 1 renders, 17 block.**

### B3. Mapped onto the sellable set (OQ-P1 caveat)
The exact launch-eligible 8/18 is **OQ-P1 (open)**. Using the DEC-005 reading (6 golden `approved` + `bunny_ometz_bedtime` + `fox_uri_adventure`), the sellable-slot outcome under enforcement is:

| Sellable slot (DEC-005 reading) | Outcome |
|---|---|
| MEDICAL × adventure (`bunny_ometz_adventure`) | ✅ RENDER |
| NIGHT_FEAR × bedtime (`fox_uri_bedtime`) | ❌ BLOCK |
| SOCIAL × adventure (`panda_anat_adventure`) | ❌ BLOCK |
| NEW_SIBLING × fantasy (`dragon_dini_fantasy`) | ❌ BLOCK |
| TRANSITION × adventure (`chameleon_koko_adventure`) | ❌ BLOCK |
| ANGER × adventure (`lion_shaket_adventure`) | ❌ BLOCK |
| MEDICAL × bedtime (`bunny_ometz_bedtime`, v3) | ❌ BLOCK |
| NIGHT_FEAR × adventure (`fox_uri_adventure`, v3) | ❌ BLOCK |

**7 of 8 sellable slots block. Every ❌ row is a blocking gap.** (Whichever subset OQ-P1 lands on, at most 1 slot — bunny adventure — has an artifact, so the conclusion is subset-independent.)

---

## Part C — What must happen before enforcement covers the sellable set

1. **Author artifacts (WS0c) for every sellable slot**, in `story-bank/v3-approved/`:
   - Preferred: a `{key}.visual-contract-template.json` (P0 template → deterministic Resolved). **None exist yet — this is the bulk of the work.**
   - Or interim: a valid `{key}.visual-contract.json` legacy vNext contract (like the bunny one), each guarded by a validity test.
   - Each must pass its validator at load or the freeze silently degrades → the slot blocks under enforcement anyway.
2. **Confirm the exact sellable set (OQ-P1)** so the authoring list is bounded — author for those first.
3. **Re-run this audit** after authoring: table should show RENDER for every intended-sellable slot before enforcement goes past a mechanism test.
4. **Then** the staging validation run is meaningful across the catalog; prod cutover is a further, separate Guy decision (env parity + release-check, per G7).

### Recommended immediate step (safe, high-signal)
Do the **narrow mechanism-validation run** described in A3 (bunny adventure passes + one gap slot blocks). It proves the enforcement plumbing works end-to-end on staging **now**, and it makes the coverage gap concrete, without implying the catalog is ready. Hold broad enablement until WS0c artifacts exist.

---

## Open items to route (not decided here)
- **OQ-P1** — pin the exact sellable 8/18 (bounds the authoring list).
- **New: WS0c artifact authoring** — 0 templates today; author template-or-contract per sellable slot in `v3-approved/`. This is the true blocker to enforcement, and a launch blocker if enforcement is on launch's critical path.
- **A5 failure-landing check** — confirm a gate block fails an order cleanly (money-path eyeball on staging).
