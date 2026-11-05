-- PREPARE/REVIEW ONLY. Apply only after explicit target/owner authorization; never from RECOVER.
-- This application uses server Prisma sessions, not anon/authenticated Data API table access.
-- Inventory every public object/client consumer first. Keep authenticated server/service access intact.
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
DO $$
DECLARE t record; column_names text; ddl_owner text;
BEGIN
  FOR t IN SELECT c.oid,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') LOOP
    IF t.relkind IN ('r','p') THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.relname); END IF;
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO column_names
      FROM pg_attribute a WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped;
    IF column_names IS NOT NULL THEN
      EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
        column_names,column_names,column_names,column_names,t.relname);
    END IF;
  END LOOP;
  -- Defaults are per object-creator. Cover the current role and every current public table owner.
  -- A future new migration role must repeat this before creating objects; runtime guard fails closed otherwise.
  FOR ddl_owner IN SELECT current_user UNION SELECT DISTINCT pg_get_userbyid(c.relowner)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated',ddl_owner);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated',ddl_owner);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated',ddl_owner);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated',ddl_owner);
  END LOOP;
END $$;
COMMIT;
-- Keep M08's private bucket/restrictive storage.objects policy. Inventory SECURITY DEFINER/RPC access separately.
-- After authorized application: run catalog preflight, anon/cross-parent denial and actual server queries.
