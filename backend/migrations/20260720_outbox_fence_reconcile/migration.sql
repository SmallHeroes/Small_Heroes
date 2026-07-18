-- (delivery fence — Codex round-6 Unit D) Cutover reconciliation for the Outbox delivery fence.
--
-- 20260719_zz_outbox_delivery_fence added DeliveryOutbox."deliveryFenceVersion" with DEFAULT 0, backfilling EVERY
-- existing row to 0. That is safe ONLY while the matching Order is also at fence 0. But the moment the fenced-hold
-- code path is live, any hold bumps Order."deliveryFenceVersion" above 0 — and a still-unsent Outbox row left at the
-- defaulted 0 can NEVER satisfy the send-time CAS (casClaimSendSlot requires
-- ord."deliveryFenceVersion" = o."deliveryFenceVersion"), so a paid book is stranded: it is silently never sent.
--
-- This migration re-derives the fence for every not-yet-sent row from its Order's CURRENT value, then FAILS LOUDLY
-- if any deliverable (ready-order) unsent row is still mismatched — so a bad cutover aborts the deploy instead of
-- stranding books in production.
--
-- Scope: only rows the sender/reconciler will still attempt — "sendAttempted" = false AND "status" IN
-- (scheduled, processing, delivery_blocked). 'sent' is terminal; 'failed' rows are reissued with a FRESH fence
-- (reissueConfirmedFailedDelivery now threads Order."deliveryFenceVersion" — round-6 Unit A); 'invalid_payload' is
-- refreshed by repairInvalidPayloadDelivery (also Unit A); 'superseded_by_manifest'/'delivery_revoked' are terminal.
-- So those are correctly left untouched. Idempotent: re-running only re-aligns rows that still differ.
-- Sorts AFTER 20260719_zz_outbox_delivery_fence (date-ordered), so the column exists when this runs.

UPDATE "DeliveryOutbox" AS ob
   SET "deliveryFenceVersion" = o."deliveryFenceVersion"
  FROM "Order" AS o
 WHERE ob."orderId" = o."id"
   AND ob."sendAttempted" = false
   AND ob."status" IN ('scheduled', 'processing', 'delivery_blocked')
   AND ob."deliveryFenceVersion" <> o."deliveryFenceVersion";

-- Fail-loud stranding check: after reconciliation, NO unsent row bound to a READY order may still carry a fence that
-- disagrees with its Order — such a row would be rejected by the send CAS forever despite the book being deliverable.
DO $$
DECLARE stranded INTEGER;
BEGIN
  SELECT COUNT(*) INTO stranded
    FROM "DeliveryOutbox" ob
    JOIN "Order" o ON o."id" = ob."orderId"
   WHERE ob."sendAttempted" = false
     AND ob."status" IN ('scheduled', 'processing')
     AND o."status" = 'ready'
     AND ob."deliveryFenceVersion" <> o."deliveryFenceVersion";
  IF stranded > 0 THEN
    RAISE EXCEPTION 'delivery-fence Unit D reconcile: % unsent Outbox row(s) still stranded (ready order, fence mismatch)', stranded;
  END IF;
END $$;
