-- P1-f #3h #6: manifestId/inputVersion → NOT NULL. enqueueDelivery sets both on every create AND on every
-- rebind, so a null binding is impossible in the live contract. Preflight: the DeliveryOutbox table is empty
-- everywhere (flag READINESS_MANIFEST_ENABLED is OFF — no delivery row has ever been created; the additive
-- binding columns were never applied to staging until this batch), so SET NOT NULL cannot fail on legacy nulls.
-- IMPORTANT: this migration name sorts after `outbox_manifest_binding`, which creates both columns.
ALTER TABLE "DeliveryOutbox" ALTER COLUMN "manifestId" SET NOT NULL;
ALTER TABLE "DeliveryOutbox" ALTER COLUMN "inputVersion" SET NOT NULL;
