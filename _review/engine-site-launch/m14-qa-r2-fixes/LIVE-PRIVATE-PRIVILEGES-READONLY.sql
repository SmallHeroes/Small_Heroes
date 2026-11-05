-- PREPARED ONLY. Infra/Guy chooses and verifies the target. Codex did not execute a live query.
-- Catalog booleans only: no session tokens, OTPs, child/contact data, keys or row contents.
BEGIN READ ONLY;
WITH required(name) AS (VALUES ('WizardSession'),('Order'),('GenerationJob'),('UserSession'),('OtpCode'),
  ('UserAccount'),('Customer'),('PaymentRecord'),('PaymeWebhookEvent'))
SELECT r.name AS table_name,c.oid IS NOT NULL AS table_present,COALESCE(c.relrowsecurity,false) AS rls_enabled,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END AS anon_table_access,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END AS authenticated_table_access,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') END AS anon_column_access,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') END AS authenticated_column_access
FROM required r LEFT JOIN pg_namespace n ON n.nspname='public'
LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=r.name AND c.relkind IN ('r','p')
ORDER BY r.name;
-- Every required table must be present, RLS enabled, and all four client-access booleans false.
ROLLBACK;
-- This is catalog evidence, not a full Data API / views / security-definer / cross-owner access test.
