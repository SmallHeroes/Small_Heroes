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
