ALTER TABLE "Order"
ADD COLUMN "paymentProvider" TEXT,
ADD COLUMN "paymentId" TEXT,
ADD COLUMN "paymeTransactionId" TEXT,
ADD COLUMN "paymeMetadata" JSONB;

CREATE UNIQUE INDEX "Order_paymeTransactionId_key" ON "Order"("paymeTransactionId");

CREATE TABLE "PaymeWebhookEvent" (
  "id" TEXT NOT NULL,
  "paymeTransactionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "orderId" TEXT,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymeWebhookEvent_paymeTransactionId_key" ON "PaymeWebhookEvent"("paymeTransactionId");
