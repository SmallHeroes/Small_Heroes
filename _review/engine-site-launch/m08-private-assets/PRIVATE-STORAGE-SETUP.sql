-- REVIEW ONLY. NOT executed by Codex or RECOVER. Requires explicit infrastructure/deploy authorization.
-- Inspect existing role dependencies/policies in the target environment before applying.
BEGIN;
ALTER TABLE public."WizardSession" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."WizardSession" FROM PUBLIC, anon, authenticated;
-- Server Prisma owner/service connection remains the only metadata accessor. No permissive RLS policies.
-- Existing rows and policies must also be audited; do not give browser roles table access.
CREATE POLICY engine_site_private_server_only ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'engine-site-private')
  WITH CHECK (bucket_id <> 'engine-site-private');
-- This denies only this bucket to browser roles, including in the presence of broad permissive policies.
-- It leaves other buckets' policy behavior unchanged. Do not run twice; review existing named policy first.
COMMIT;

-- Storage prerequisite, created separately by an authorized operator:
-- bucket id/name engine-site-private, public=false, size limits appropriate to artifact kind.
-- No anon/authenticated storage.objects policy may cover this bucket, including broad pre-existing policies.
-- Server service role owns upload/download/signing. Do not use the existing public book-images bucket.
-- Runtime checks reject a missing/public bucket or publicly accessible WizardSession table.
-- Before launch: test unauthenticated storage GET denial and Data API denial against actual deployment.
