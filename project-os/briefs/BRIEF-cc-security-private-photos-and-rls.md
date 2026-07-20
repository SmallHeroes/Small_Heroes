# BRIEF (CC) — Track 4 security: private child photos + the canonical RLS migration

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first. ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**.
- **Gate: [CODEX-GATE]** for Unit 2 (RLS can lock the application out of the database). Unit 1 is application code and carries no schema risk.
- **Runs in parallel with Track 2** — this touches storage and grants, not the bridge.

## 2. SCOPE (what + why now)
**Unit 1 — child photos are in a PUBLIC bucket. This is the highest reputational exposure in the entire audit, and it is not blocked by anything.**
`book-images` is public in both environments. The child's uploaded photo is returned as a public URL (`app/api/upload-photo/route.ts`) and stored as one (`lib/image-storage.ts:625`), and the post-generation deletion is **non-fatal** (`lib/child-photo-deletion.ts:174`) — so every past deletion failure has left a photograph of a child at a publicly reachable URL. Table RLS does not protect a bucket; disabling the Data API (done 2026-07-19) does not either — Storage is a separate service.

Required:
1. **A private bucket** for child-photo *source* images. Uploads go there, never to a public bucket.
2. **Store a storage key**, not a URL. A URL in the database is a durable public handle; a key is not.
3. **Signed URLs generated at use time**, with a short expiry — never persisted.
4. **An audit + cleanup of what is already exposed**: enumerate existing child-photo objects in the public bucket, migrate or delete them, and report the count. Assume prior deletion failures left residue; prove otherwise rather than hoping.
5. **Deletion must stop being silently non-fatal** — a failed deletion must surface (log + metric at minimum) so it can be retried, not swallowed.
6. Rendered book pages and covers may stay as they are; **this unit is about the source photograph of a child**, which is categorically more sensitive.

**Unit 2 — the canonical RLS / grants migration (authored now, applied POST-cutover).**
Per the Track-2 decision, Track 4 lands **after** the cutover as a normal pending migration. The Track-1.1 freeze means it **must not enter the canonical chain now** — author it, test it, hold it. State clearly in the file where it sits in the eventual order.

Content, per Supabase's guidance:
- `ENABLE ROW LEVEL SECURITY` on the legacy tables that lack it (production has 17 tables with RLS off, including `Order`, `PaymentRecord`, `Customer`, `OtpCode`).
- Revoke `anon` / `authenticated` grants.
- Revoke **default privileges** for future tables and functions, so exposure becomes opt-in rather than automatic.
- **Never enable RLS without a verified access path.** Verified facts to build on: every table in both environments is owned by `postgres`, `FORCE ROW LEVEL SECURITY` is false everywhere, and staging already runs 13 RLS-enabled, policy-less tables that the application actively writes to (`AtomicOperationReceipt`: RLS on, 0 policies, 111 rows). So the owner-bypass path is empirically proven — **but only if production's runtime `DATABASE_URL` connects as the owner.** That is the same open question as Track-2 P0-5; reuse its preflight rather than duplicating it, and make this migration depend on it.

## 3. FILES / AREAS
`app/api/upload-photo/route.ts` · `lib/image-storage.ts` · `lib/child-photo-deletion.ts` · the wizard/order paths that persist a photo reference · a new audit/cleanup script · a new (held) migration under `backend/migrations/` for Unit 2 · the Supabase bucket configuration (Guy applies in the console; the brief specifies what it must be).

## 4. ACCEPTANCE CRITERIA
- No child-photo source object is reachable without a signed URL, in either environment.
- No child-photo URL is persisted anywhere — the database holds a key.
- Signed URLs are short-lived and generated per use.
- The audit reports exactly what was already exposed and what was done with it.
- A failed photo deletion is observable, not silent.
- Unit 2's migration is authored, tested against a throwaway database, and **not** added to the canonical chain while the freeze holds.
- Unit 2 asserts the runtime-role precondition before enabling RLS; it fails closed.
- `npm run check` green; no change to delivery, money, hold decisions, or the frozen legacy path.

## 5. TESTS
- A stored photo reference is a key, never a URL.
- A generated signed URL expires; an unsigned request to the object is refused.
- The audit script finds a deliberately planted public object.
- A simulated deletion failure produces a log/metric rather than silence.
- Unit 2 against a throwaway DB: after the migration the application's role can still read and write every affected table; a non-owner role cannot.

## 6. WHAT NOT TO TOUCH
Delivery, money/coupon math, hold decisions, the delivery-fence primitives, the frozen legacy path, the bridge, the quarantine script. Do not add Unit 2's migration to the canonical chain during the freeze.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; commit per unit on `feat/chunked-generation`; commit locally, **Guy pushes**.

## 8. FINAL VERIFICATION
`npm run check` green. Report: the new bucket/key/signed-URL flow, the audit's findings (how many objects were exposed and their disposition), the deletion-observability change, and Unit 2's migration with its role-precondition and where it sits in the eventual chain order. **Then STOP** — Unit 2 goes to the Codex re-gate before it is ever applied.
