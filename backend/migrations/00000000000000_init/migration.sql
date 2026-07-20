-- BASELINE (cutover Track-2 P0-1) — the pre-chain schema the canonical chain ASSUMES but never created.
--
-- The chain's first two migrations ALTER an existing enum (20260420_align_illustration_style_enum) and UPDATE an
-- existing "Order" table (20260420_correct_historical_style_mapping) — objects no migration in the chain creates.
-- On the original dev database they already existed, so this gap was invisible; a fresh `prisma migrate deploy`
-- from an EMPTY database fails on "type/relation does not exist". Production is now built CLEAN (new eu-central-1
-- project), so the chain MUST deploy from empty — this migration supplies exactly the missing genesis.
--
-- It establishes the pre-chain state: the 12 base tables + 4 base enums the rest of the chain builds ON TOP of.
-- Derived mechanically from backend/schema.prisma MINUS everything the chain later creates (18 models, 10 enums,
-- and the columns/enum-values that later migrations add). It sorts FIRST (00000000000000 < 20260420) so it runs
-- before the chain; NO existing migration is modified. From empty, init + the chain reproduces the target schema,
-- proven equal across all nine dimensions by lib/cutover/schema-equality.ts.
--
-- IllustrationStyle here carries its TRUE pre-chain labels — 20260424_illustration_styles_v2 later DROPs the type
-- and recreates it, so these values do not survive into the target; they exist only so 20260420's guarded
-- RENAME VALUE has something to rename (a no-op on empty either way). OrderStatus omits 'needs_human_qa' (appended
-- by 20260624). Data-only chain migrations (correct_historical_style_mapping, outbox_fence_reconcile) are no-ops
-- against the zero rows here.
--
-- DO NOT EDIT once applied anywhere — prisma records a checksum. Forward-fix only.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'pending_payment', 'paid', 'generating', 'ready', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('pending', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "StoryLength" AS ENUM ('short', 'medium', 'long');

-- CreateEnum
CREATE TYPE "IllustrationStyle" AS ENUM ('classic', 'soft', 'disney', 'watercolor');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "customerId" TEXT,
    "userId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "childAge" INTEGER,
    "childGender" TEXT,
    "childTraits" TEXT[],
    "childSuperpower" TEXT,
    "bookName" TEXT,
    "childImageUrl" TEXT,
    "characterAnchors" JSONB,
    "familyContext" JSONB,
    "topic" TEXT NOT NULL,
    "challengeItems" TEXT[],
    "challengeFree" TEXT,
    "outcomeItems" TEXT[],
    "outcomeFree" TEXT,
    "helperItems" TEXT[],
    "helperFree" TEXT,
    "avoidItems" TEXT[],
    "avoidFree" TEXT,
    "storyLength" "StoryLength" NOT NULL DEFAULT 'medium',
    "illustrationStyle" "IllustrationStyle" NOT NULL DEFAULT 'classic',
    "audioEnabled" BOOLEAN NOT NULL DEFAULT false,
    "selectedVoice" TEXT,
    "sleepMode" BOOLEAN NOT NULL DEFAULT false,
    "pdfEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bundleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" INTEGER NOT NULL,
    "addonsPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    "stripePaid" BOOLEAN NOT NULL DEFAULT false,
    "stripeMetadata" JSONB,
    "textStatus" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "imageStatus" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "audioStatus" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "packageStatus" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "errorAt" TIMESTAMP(3),
    "wizardSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedBook" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverText" TEXT,
    "pdfUrl" TEXT,
    "readUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookPage" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "textZone" TEXT,
    "lighting" TEXT,
    "textColorScheme" TEXT,
    "narrationText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rawUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "style" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "voiceLabel" TEXT,
    "sleepMode" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "stripeSessionId" TEXT,
    "stripeEventId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ils',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "textDone" BOOLEAN NOT NULL DEFAULT false,
    "imagesDone" BOOLEAN NOT NULL DEFAULT false,
    "audioDone" BOOLEAN NOT NULL DEFAULT false,
    "packaged" BOOLEAN NOT NULL DEFAULT false,
    "currentStage" TEXT NOT NULL DEFAULT 'pending',
    "lockedBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "generationVersion" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT,
    "model" TEXT,
    "quality" TEXT,
    "triggerReason" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "pipelineCache" JSONB,
    "completedPageNumbers" JSONB,
    "failedPageNumbers" JSONB,
    "pageAttempts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WizardSession_sessionId_key" ON "WizardSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_wizardSessionId_key" ON "Order"("wizardSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "OtpCode_userId_createdAt_idx" ON "OtpCode"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedBook_orderId_key" ON "GeneratedBook"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_pageId_key" ON "ImageAsset"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_idempotencyKey_key" ON "ImageAsset"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AudioAsset_bookId_key" ON "AudioAsset"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_orderId_key" ON "PaymentRecord"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationJob_orderId_key" ON "GenerationJob"("orderId");

-- CreateIndex
CREATE INDEX "GenerationJob_status_leaseExpiresAt_idx" ON "GenerationJob"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "GenerationJob_currentStage_idx" ON "GenerationJob"("currentStage");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_wizardSessionId_fkey" FOREIGN KEY ("wizardSessionId") REFERENCES "WizardSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedBook" ADD CONSTRAINT "GeneratedBook_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookPage" ADD CONSTRAINT "BookPage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "GeneratedBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "BookPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioAsset" ADD CONSTRAINT "AudioAsset_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "GeneratedBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
