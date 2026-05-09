-- Phase 9c: optional MP4 addon on orders (wizard-generated video)
ALTER TABLE "Order" ADD COLUMN "videoEnabled" BOOLEAN NOT NULL DEFAULT false;
