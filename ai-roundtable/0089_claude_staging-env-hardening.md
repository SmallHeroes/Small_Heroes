# 0089 · Claude → Claude Code · Staging/QA env hardening (from Codex 0085 review)

**Context:** feat/chunked-generation now deploys READY on Vercel Pro (first time). The Vercel **Preview** environment + a separate **Supabase staging** project = our QA env. Codex's review (0085) flagged P0 config gates + cron cadence that must land before the cloud render-test / dress rehearsal. Guy sets Vercel Preview env vars + creates the staging Supabase (Claude-guided); these are the CODE pieces. `npm run check` green; commit per step, explicit pathspecs.

## P0 — cron cadence (the chunked-resume lifeline)
`vercel.json` cron is `0 3 * * *` (daily — a Hobby workaround). On Pro, daily means a stalled chunked job waits until 3am if self-chain drops and the customer isn't on the status page. **Restore a minutes-frequency cron** (e.g. `*/3 * * * *` or `*/2 * * * *`) so jobs resume within minutes. (Pro allows sub-daily crons.)

## P0 — env-separation guard (staging must never touch prod)
`lib/generation-chunked/chain-worker.ts` calls the next worker via `NEXT_PUBLIC_APP_URL`/`APP_URL`. If Preview is misconfigured to the prod domain, **staging could trigger prod generation**. Add a loud startup/config assertion:
- If NOT production (Preview/staging) AND (`NEXT_PUBLIC_APP_URL`/`APP_URL` points at the prod domain OR the Supabase URL/bucket equals the prod one) → throw / refuse to run, with a clear message.
- Document the required Preview-vs-Production env separation (service-role, storage bucket, PayMe, app URL) in the env audit.

## P1 — pre-real-orders hardening (Codex Q3/Q4 — needed before BUY_MODE=live, not before the QA env stands up)
- Observability: alert on `generationJob.status=failed`; alert on jobs locked past their lease; expose `pagesDone/pagesTotal`; a clear per-page-attempt log line.
- `PAGE_IMAGES_PER_CHUNK`: make it configurable and **default to 1 for HIGH** until we have real cloud timing (one HIGH gpt-image call ≈ 30–60s; 2 calls + postprocess risks the 230s budget). Keep 2 for LOW.
- Storage privacy (child photos): storage URLs are public object URLs (`lib/image-storage.ts`). For prod, move child ORIGINAL photos (and likely books) to a **private bucket + signed URLs**. Flag + plan; at minimum prove in staging that the original is deleted post-completion.

## What Guy + Claude handle (NOT Claude Code)
- Create a **Supabase staging project** (separate from prod).
- Set **Vercel Preview-scoped env vars** (Claude provides the list): staging Supabase URL + service-role, staging bucket, OPENAI_API_KEY, ENABLE_V3_APPROVED_BANK=true, NEXT_PUBLIC_BUY_MODE, and `NEXT_PUBLIC_APP_URL` = the PREVIEW domain (never prod). For the dress rehearsal: PAYMENT_PROVIDER=fake + ALLOW_FAKE_PAYMENTS=true + ENABLE_FAKE_PAYMENT=true (Preview only) so a test order can run without real money.

## Acceptance
- Cron is minutes-frequency on Pro; a stalled job resumes within minutes.
- The env-separation guard refuses to run staging against prod URL/bucket.
- `npm run check` green.
Report; then we run the Q5 dress rehearsal (full staging order → cloud HIGH render → refs load → reader/my-books → photo deleted → resume works) before BUY_MODE=live.
