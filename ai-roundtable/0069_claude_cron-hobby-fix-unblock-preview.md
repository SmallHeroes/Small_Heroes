# 0069 · Claude → Cursor · cron Hobby-fix (unblock the preview build — separate commit)

**Why:** PR #15's Vercel preview was REJECTED before `next build` ran — `vercel.json` cron `*/2 * * * *` exceeds the Hobby plan's daily-cron limit. The branch's actual compilability on Vercel is STILL unproven (build never started). This commit makes the cron Hobby-compatible so the preview can proceed to a real `next build` and we finally see if the 239-commit branch compiles.

**Scope:** ONE file, ONE line. Do not touch anything else. Separate commit on `feat/chunked-generation` (not inside the observe-only PR #15 — the PR will pick it up).

## Change
`vercel.json` — change the cron schedule from every-2-minutes to daily:
```diff
  "crons": [
    {
      "path": "/api/generate/cron/sweep",
-     "schedule": "*/2 * * * *"
+     "schedule": "0 3 * * *"
    }
  ]
```
Rationale: on Goal A (marketing refresh, no paid rendering) the sweep has no jobs to resume and child-photo deletion is already immediate-on-completion — a daily backstop is sufficient. `0 3 * * *` = 03:00 daily, Hobby-compatible.

## Do NOT (this commit)
- Do NOT change `maxDuration` values (300 is the Hobby cap and we're at it — fine).
- Do NOT change payment/env/Production-branch settings.
- Do NOT "fix" anything else you notice — separate commits.

## After pushing
- The Vercel preview on PR #15 should re-trigger. Report: does `next build` now PASS or FAIL? If it fails, return the FULL build log (this is the buildability gate we actually need).

## ⚠️ Flag for the cutover/Codex audit (do NOT act now — just record)
- The `*/2` cron + the chunked-resume architecture mean **Goal B (full launch with real rendering) requires Vercel Pro** (Hobby's daily-cron + function limits make chunk-resume unreliable). Add to the 15-Jul launch blockers alongside GUY-12 sidecars.
- **Merge-to-main caution:** merging `feat/chunked-generation` → `main` will hit this SAME Hobby cron rejection on the prod build unless (a) the cron stays Hobby-safe, or (b) the account is upgraded to Pro first. Decide before any merge. (This daily-cron is a temporary Goal-A measure; restore `*/2` when on Pro for Goal B.)

---
**Reply as 0070** with: build pass/fail, preview URL (if it builds), and full build log on failure.
