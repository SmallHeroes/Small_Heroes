# BRIEF (Cursor) — Human-QA review console (Slice 2, READ-ONLY)

## 1. ROUTING + TARGET BRANCH
- **Executor:** Cursor (frontend). **Target branch:** NEW short-lived `feat/human-qa-console`, branched from `feat/chunked-generation` @ `ee670a17`, in the MAIN repo `C:\GNart\Work\Small_Heroes`.
- **Do NOT work in `C:\GNart\Work\sh-wt-style01`** — CC is running the delivery-fence work there. One agent per worktree.
- **No gate** — this slice is READ-ONLY and touches no delivery, money or hold logic. It merges back into `feat/chunked-generation` when done (all-new files ⇒ trivial merge).

## 2. SCOPE (what + why now)
When a book is held, Guy must be able to SEE why. Today he cannot — the notification spine exists (Slice 1) but there is no surface. This slice builds that surface and nothing else: **zero mutations, no buttons that do anything.** The decision actions are Slice 4 and are briefed separately.

**The screen has to answer, in one glance:** which books are waiting, what was flagged, on which page, and what the system actually saw. The motivating case: the fox render held on `safety_hold:hazard:page:4` and the page was *fine* — a false positive. Guy must be able to reach that conclusion from the screen alone.

**Two routes:**
1. `/admin/review` — list of OPEN cases: child name, order id, hold kind, human-readable reason, held-at (relative), page number when known. Newest first. Clear empty state ("no books waiting").
2. `/admin/review/[orderId]` — detail: the full book (all pages, image + text), with the flagged page(s) visually marked, and per-page **evidence**: safety hazards raised, contract-world diff, anchor confidence. Plus the case metadata (kind, raw + human reason, fingerprint, inputVersion, contract hash, held-at).

**Data sources (read-only):** `HumanQaReviewCase` (open cases), `QualityEvidence` (the per-page deliberations), `GeneratedBook`/`BookPage`/`ImageAsset` (pages + images), `Order` (child name, status, `deliveryHoldReason`). All of these now exist on staging — the migrations were applied 2026-07-18.

## 3. FILES / AREAS
- `app/admin/review/page.tsx` (list) and `app/admin/review/[orderId]/page.tsx` (detail) — new.
- A read-only data loader (server component / route handler) — new.
- **Reuse the existing admin auth gate** used by the other `app/api/admin/*` routes — do not invent a new auth scheme, and do not ship an unauthenticated page.
- Hebrew UI, RTL, consistent with the existing app styling.

## 4. ACCEPTANCE CRITERIA
- Both routes are **admin-gated**; an unauthenticated request gets no data.
- **No customer access keys** (`paymentId` / `paymeTransactionId` / `stripeSessionId`) appear in the markup, props, or any API response — this page must never become a way to reach a customer's book URL.
- **Strictly read-only:** no POST/PATCH/DELETE, no Prisma writes anywhere in this slice.
- Renders correctly with **zero** open cases, with one, and with several.
- Flagged pages are visually distinguishable from clean pages, and the evidence for a flagged page is readable without opening a console.
- Leave clearly-marked **disabled placeholders** where the Slice-4 actions will go (re-render with note / release / cancel) — so the next slice slots in without a redesign. They must not be wired to anything.
- Works on desktop; usable on mobile (Guy will get the alert on his phone).

## 5. TESTS
- Auth: unauthenticated → no data.
- No access key appears in the rendered output (assert on the serialized page/props).
- Empty / single / multiple case states render.
- A held order with evidence renders its flagged page and reasons.

## 6. WHAT NOT TO TOUCH
Anything under `lib/generation-pipeline/`, `lib/human-qa/`, `lib/generation-chunked/`, `lib/coupon/`, or `app/api/**` other than a new read-only loader. No schema changes. No changes to hold decisions, delivery, money, or the board engine.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`** (CRLF churn landmine); commit on `feat/human-qa-console`; **Guy pushes**. Keep the branch short-lived — it merges back into `feat/chunked-generation` as soon as it is reviewed.

## 8. FINAL VERIFICATION
`npm run check` green (tsc + vitest). Report the two routes, the auth reuse, the no-access-key proof, and screenshots of the empty state and a held order. Then STOP for Guy's review.
