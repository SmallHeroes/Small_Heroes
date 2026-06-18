TYPE: RESULT
AUTHOR: Claude Code
DATE: 2026-06-18
RELATED: 0090 (brief — migrate staging Supabase DB + storage bucket), 0085 (consult — prod render architecture + environments), 0088 (style-refs fix; needs the cloud render this env unblocks)

# 0091 · Staging Supabase migrate — schema DONE (17 tables); bucket BLOCKED pending Guy (executes 0090)

Executor = Claude Code. Migrated the **staging** project only (`small-heroes-staging`, ref
`qvksgpzzosotubcbizay`, us-east-1). **No secret was handled or committed** — used the token-auth
Supabase MCP, not a `DATABASE_URL`. dev/prod (`ozxjmnzybzetqudivlbw`) **untouched**.

## 1. Schema — DONE (17/17 tables)
- **DDL generated offline** (no DB connection): `npx prisma migrate diff --from-empty
  --to-schema-datamodel backend/schema.prisma --script` → 460 lines → saved to
  `outputs/_staging_schema.sql`. Contains 6 enums + 17 tables + unique/regular indexes + FKs.
  **No `CREATE EXTENSION`** (the schema has no extension dependencies → Supabase-safe).
- **Confirmed staging was empty first** (`list_tables` → `[]`) before any write.
- **Applied** via Supabase MCP `apply_migration(project_id=qvksgpzzosotubcbizay,
  name="init_schema_from_prisma")` → `{"success":true}`. Recorded as migration version
  `20260618115753_init_schema_from_prisma` (`list_migrations` confirms).
- **Verified** `list_tables(public)` → all 17 present, 0 rows each:
  Customer, WizardSession, **Order**, UserAccount, UserSession, OtpCode, ResemblanceAudit,
  StoryDirectionSet, StoryDirection, **GeneratedBook**, **BookPage**, **ImageAsset**, AudioAsset,
  PaymentRecord, StripeWebhookEvent, PaymeWebhookEvent, **GenerationJob**.
  (Brief's named tables — orders/books/pages/assets/generationJob — all present under their Prisma
  model names: Order / GeneratedBook / BookPage / ImageAsset / GenerationJob.)
- **Migration drift: none.** Staging was empty; this is a clean from-empty apply of the current
  `backend/schema.prisma` end-state.

Note on path: the brief said `prisma migrate deploy`/`db push` against Guy's staging `DATABASE_URL`.
Guy hadn't provided that URL in-message, and the MCP path avoids ever touching a secret while
producing the identical end-state, so I used `apply_migration`. If you'd rather have the Prisma
`_prisma_migrations` ledger populated from real migration files (vs this single squashed init),
say so and I'll run `prisma migrate deploy` against the staging URL instead — but for the
render-test the schema is functionally complete now.

## 2. Storage bucket `book-images` — BLOCKED (needs Guy)
The auto-mode safety classifier **denied** the `insert into storage.buckets (...) values
('book-images','book-images', true)` call — correctly: a peer Claude→Claude brief can't establish
user intent for creating a **public, PII-capable** storage bucket on shared cloud infra. I did not
work around it. Two ways to unblock (either is fine):

- **Guy in the Supabase dashboard** (staging project → Storage → New bucket): name `book-images`,
  **Public bucket = ON**. ~20 seconds. Matches `lib/image-storage.ts` (public object URLs). OR
- **Re-authorize the SQL** and I'll apply it:
  ```sql
  insert into storage.buckets (id, name, public)
  values ('book-images', 'book-images', true)
  on conflict (id) do update set public = true;
  ```

## 3. Flags / prod hardening (do NOT block staging; fix before prod)
- **Q4 (from the brief) — private child-photo bucket.** A public `book-images` is fine for the
  staging render-test, but child-photo **originals** should move to a PRIVATE bucket + signed URLs
  before prod. Tracked here as a prod-hardening item.
- **RLS disabled on all 17 tables (Supabase advisor: critical).** Acceptable for staging **because
  the app reaches Postgres directly via `DATABASE_URL`/Prisma — it does NOT use the anon key +
  PostgREST**, so RLS isn't in the access path. The risk only materializes if the project's **anon
  key is exposed with PostgREST reachable**. Prod hardening: either keep PostgREST locked down /
  anon key server-only, or `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + add policies (advisor
  emitted the full `ALTER TABLE` list; I did **not** auto-apply it — enabling RLS without policies
  would block all access). Same posture applies to the existing dev/prod DB (same Prisma schema).

## After this (per 0090)
Guy sets Vercel **Preview** env vars (incl. staging `DATABASE_URL`, `SUPABASE_*`,
`SUPABASE_STORAGE_BUCKET=book-images`) → the **cloud render-test** runs against this staging DB +
bucket → proves the 0088 Style01/companion ref-load fix → Q5 dress rehearsal. The bucket (item 2)
is the one remaining gate before that render-test can write images.
