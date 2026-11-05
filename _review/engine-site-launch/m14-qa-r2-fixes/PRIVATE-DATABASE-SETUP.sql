-- REVIEW ONLY. No migration, RECOVER step or service execution is authorized by this file.
-- Inspect the matching target, server-role access and existing client dependencies before applying.
BEGIN;
DO $$
DECLARE table_name text; column_names text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['WizardSession','Order','GenerationJob','UserSession','OtpCode','UserAccount','Customer','PaymentRecord','PaymeWebhookEvent'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',table_name);
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO column_names
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=table_name AND a.attnum>0 AND NOT a.attisdropped;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      column_names,column_names,column_names,column_names,table_name);
  END LOOP;
END $$;
COMMIT;
-- Retain M08's private bucket/restrictive storage.objects policy; this does not replace it.
-- After authorized application, prove anonymous/cross-parent denial in the protected target.
