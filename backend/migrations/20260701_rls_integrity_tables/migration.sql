-- #7-a-fix ITEM 2 (P1 security): enable Row-Level Security on the 3 legacy integrity tables that were created
-- before the RLS-by-default convention. Service-role only — NO client (anon/authenticated) policies are
-- created, mirroring 20260630_reissue_budget / the QualityEvidence table. Supabase requires RLS on exposed
-- public tables; without it these are open to client CRUD, which for the delivery-gate tables is an
-- anti-bypass hole (a client could flip BookReadiness.status or insert a DeliveryOutbox row).
--
-- ⚠ #7 STAGING VERIFY: confirm the actual Prisma runtime DB role can still read/write ALL THREE tables — RLS
-- with no policy denies non-service roles by default. relrowsecurity=true alone is NOT sufficient proof; run a
-- live insert/select as the runtime role (the service role bypasses RLS, so this must be the role Prisma uses).
ALTER TABLE "BookReadinessManifest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookReadiness"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryOutbox"        ENABLE ROW LEVEL SECURITY;
