TYPE: RESULT
From: cursor
To: roundtable
Re: 0069 — cron Hobby-fix + PR #15 preview rebuild
Date: 2026-06-17

# 0070 — Cron Hobby-fix → preview rebuild result

## Commit (cron only)
- `cd7eb62a` — `fix(vercel): daily cron schedule for Hobby plan (0 3 * * *)`
- Change: `vercel.json` `*/2 * * * *` → `0 3 * * *` (one line only)

## PR #15 preview rebuild
- **PR:** https://github.com/SmallHeroes/Small_Heroes/pull/15
- **Head:** `cd7eb62a740e1e63eb151c826455e2b1cbf2bf4f`
- **Vercel deployment:** `dpl_8eaYTqLCYvkpSihFMi6e5M413t8d` — https://vercel.com/smallheroes-projects/small-heroes/8eaYTqLCYvkpSihFMi6e5M413t8d
- **GitHub status:** `Vercel: failure`
- **Preview URL:** none (deploy did not complete)

## `next build` result: **PASS** (compile succeeded)

Cron gate cleared. Build ran to completion:

```
✓ Compiled successfully in 26.4s
Skipping validation of types
✓ Generating static pages (29/29)
Build Completed in /vercel/output [54s]
```

## Deploy result: **FAIL** (post-build, serverless size limit)

```
Max serverless function size was exceeded for 9 functions
```

Functions analyzed with large bundled deps (companions + style-references + story-bank zone-sheets, ~250MB per function tree):

- `api/dev/fake-payment/confirm.js`
- `api/generate.js`
- `api/generate/status.js`
- `api/orders.js`
- `api/payme/return.js`
- `api/webhooks/payme.js`
- `api/debug/regen-page.js`
- `api/dev/generation/resume.js`
- `api/generate/cron/sweep.js`
- `api/generate/worker.js`
- `api/webhooks/stripe.js` (includes `@ffmpeg-installer/linux-x64` 65MB)
- `api/dev/story-bank.js`

Warning (non-fatal):
```
Provided `memory` setting in `vercel.json` is ignored on Active CPU billing.
```

## Full build log

Retrieved via `vercel inspect dpl_8eaYTqLCYvkpSihFMi6e5M413t8d --logs` (743 lines). Key excerpt above; full log available in Vercel dashboard at deployment URL.

### Log head (clone + next build start)

```
Running build in Washington, D.C., USA (East) – iad1
Cloning github.com/SmallHeroes/Small_Heroes (Branch: feat/chunked-generation, Commit: cd7eb62)
Running "next build"
▲ Next.js 15.5.18
Creating an optimized production build ...
```

### Log tail (failure)

```
Max serverless function size was exceeded for 9 functions
Created all serverless functions in: 3.743s
Build Completed in /vercel/output [54s]
Deploying outputs...
status ● Error
```

## Takeaway

- **0069 goal met:** cron no longer blocks Hobby preview at config-validation time.
- **Branch compiles on Vercel** (`next build` green).
- **Preview still unavailable:** deployment fails on Vercel serverless function size cap (separate issue — not in 0069 scope).
