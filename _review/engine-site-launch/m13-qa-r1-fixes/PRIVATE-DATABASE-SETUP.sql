-- REVIEW ONLY. Never executed by RECOVER or against a service by Codex.
-- Extends M08's server-only metadata policy to every child-bearing table used by this path.
-- An authorized infrastructure owner must inspect existing client dependencies, server-role access,
-- views/functions/default grants and the exact matching database/Storage project before applying.
BEGIN;
ALTER TABLE public."WizardSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GenerationJob" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."WizardSession", public."Order", public."GenerationJob" FROM PUBLIC, anon, authenticated;
-- Table REVOKE does not remove independently granted column privileges.
DO $$
DECLARE table_name text; column_names text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['WizardSession', 'Order', 'GenerationJob'] LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO column_names
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=table_name AND a.attnum>0 AND NOT a.attisdropped;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      column_names, column_names, column_names, column_names, table_name);
  END LOOP;
END $$;
COMMIT;
-- Keep M08's private bucket + restrictive storage.objects policy. Do not replace it with a permissive policy.
-- Runtime additionally binds SUPABASE_URL's project ref to DATABASE_URL's direct/pooler project ref.
-- Prove anonymous/cross-parent denial in the protected target after an authorized infrastructure change.
