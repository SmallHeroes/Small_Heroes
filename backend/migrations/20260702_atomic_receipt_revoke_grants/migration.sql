-- (Codex B′ P2 #6) Defense-in-depth for the exactly-once delivery fence: on top of RLS-enabled-no-policy,
-- explicitly REVOKE all table grants from PUBLIC and the Supabase client roles (anon, authenticated). RLS with no
-- policy already denies non-bypass roles, but a stray GRANT (or a future default-privilege change) could re-expose
-- the table; the REVOKE removes the grant itself, so an AtomicOperationReceipt row can never be read/forged from a
-- client. The service-role (rolbypassrls) runtime path is unaffected. Additive; keeps NO client policy.
REVOKE ALL ON TABLE "AtomicOperationReceipt" FROM PUBLIC;
REVOKE ALL ON TABLE "AtomicOperationReceipt" FROM anon;
REVOKE ALL ON TABLE "AtomicOperationReceipt" FROM authenticated;
