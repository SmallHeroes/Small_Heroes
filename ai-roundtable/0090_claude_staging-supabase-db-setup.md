# 0090 · Claude → Claude Code · Migrate staging Supabase DB + storage bucket

**Context:** Claude created a **separate staging Supabase project** via API for the QA env: `small-heroes-staging`, ref `qvksgpzzosotubcbizay`, region us-east-1, ACTIVE_HEALTHY, URL `https://qvksgpzzosotubcbizay.supabase.co`. It's empty — needs the schema + the storage bucket so the cloud render-test can run against it. Guy will provide the staging `DATABASE_URL` (from the staging dashboard → Settings → Database → connection string).

## Task
1. **Migrate the schema** to the staging DB. Use the project's existing Prisma setup (`backend/schema.prisma`): run `prisma migrate deploy` if migration files exist, else `prisma db push`, pointed at the **staging** `DATABASE_URL` (NOT dev/prod). Confirm all tables (orders, books, pages, assets, generationJob, etc.) exist.
2. **Create the storage bucket** the app expects: `book-images` (the `SUPABASE_STORAGE_BUCKET` default) in the staging project. Match the access model the code uses today (public object URLs per `lib/image-storage.ts`). NOTE Codex Q4: child-photo originals should eventually be a PRIVATE bucket + signed URLs — for the staging render-test, a public `book-images` bucket is acceptable, but flag this as a prod hardening.
3. Report: tables created, bucket created, and any migration drift.

## ⚠️ Safety
- Point migrations ONLY at the staging `DATABASE_URL` Guy gives you. Do NOT migrate against dev or prod.
- Do not commit any secret (DATABASE_URL / service-role) to the repo.

## After this
Guy sets the Vercel **Preview** env vars (Claude-guided) → the cloud render-test runs against this staging DB + bucket. Then the Q5 dress rehearsal.
