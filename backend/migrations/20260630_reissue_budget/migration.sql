-- #6-FIX-2: durable order:scope reissue budget. Caps total reissues across cases + fulfillmentVersions and
-- anchors the global 48h window on the first send attempt of the original delivery.
CREATE TABLE "ReissueBudget" (
  "id"            TEXT NOT NULL,
  "orderId"       TEXT NOT NULL,
  "scope"         TEXT NOT NULL,
  "count"         INTEGER NOT NULL DEFAULT 0,
  "windowStartAt" TIMESTAMP(3) NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReissueBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReissueBudget_orderId_scope_key" ON "ReissueBudget" ("orderId", "scope");

-- (#6 FIX-4c) Internal server-side table. No anon/authenticated policy is created (service-role only) — mirrors
-- ExceptionCase. Supabase requires RLS on exposed public tables; without it the table is open to client CRUD.
ALTER TABLE "ReissueBudget" ENABLE ROW LEVEL SECURITY;
