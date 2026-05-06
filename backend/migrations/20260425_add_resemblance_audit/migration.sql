-- CreateTable
CREATE TABLE "ResemblanceAudit" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "candidateIndex" INTEGER,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "seed" INTEGER,
    "model" TEXT,
    "styleId" TEXT,
    "resemblanceScore" DOUBLE PRECISION,
    "allCandidateScores" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "threshold" DOUBLE PRECISION,
    "minAcceptableScore" DOUBLE PRECISION,
    "softFailBand" DOUBLE PRECISION,
    "extremeMargin" DOUBLE PRECISION,
    "selectionGap" DOUBLE PRECISION,
    "resemblanceStatus" TEXT,
    "resemblanceConfidence" TEXT,
    "inputStrength" TEXT,
    "sanityDisagreement" BOOLEAN,
    "lowDiversity" BOOLEAN,
    "extremeMismatch" BOOLEAN,
    "reason" TEXT,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "faceDetectConfidence" DOUBLE PRECISION,
    "faceAreaRatio" DOUBLE PRECISION,
    "brightness" DOUBLE PRECISION,
    "sharpness" DOUBLE PRECISION,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResemblanceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResemblanceAudit_orderId_createdAt_idx" ON "ResemblanceAudit"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "ResemblanceAudit" ADD CONSTRAINT "ResemblanceAudit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
