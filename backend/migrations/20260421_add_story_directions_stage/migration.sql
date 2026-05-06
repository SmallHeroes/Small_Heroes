-- Stage 2.5: questionnaire -> story directions selection -> full generation
CREATE TYPE "StoryDirectionArchetype" AS ENUM ('connection', 'adventure', 'courage');
CREATE TYPE "StoryDirectionSetStatus" AS ENUM ('pending', 'ready', 'selected', 'failed');

CREATE TABLE "StoryDirectionSet" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "selectedStyle" "IllustrationStyle" NOT NULL,
  "status" "StoryDirectionSetStatus" NOT NULL DEFAULT 'pending',
  "selectedDirectionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryDirectionSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryDirection" (
  "id" TEXT NOT NULL,
  "directionSetId" TEXT NOT NULL,
  "archetype" "StoryDirectionArchetype" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "emotionalLabel" TEXT NOT NULL,
  "storyPremise" TEXT NOT NULL,
  "openingScenePrompt" TEXT NOT NULL,
  "previewImagePrompt" TEXT NOT NULL,
  "previewImageUrl" TEXT,
  "previewImageRawUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryDirection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryDirectionSet_orderId_key" ON "StoryDirectionSet"("orderId");
CREATE UNIQUE INDEX "StoryDirectionSet_selectedDirectionId_key" ON "StoryDirectionSet"("selectedDirectionId");
CREATE UNIQUE INDEX "StoryDirection_directionSetId_archetype_key" ON "StoryDirection"("directionSetId", "archetype");

ALTER TABLE "StoryDirectionSet"
  ADD CONSTRAINT "StoryDirectionSet_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryDirectionSet"
  ADD CONSTRAINT "StoryDirectionSet_selectedDirectionId_fkey"
  FOREIGN KEY ("selectedDirectionId") REFERENCES "StoryDirection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoryDirection"
  ADD CONSTRAINT "StoryDirection_directionSetId_fkey"
  FOREIGN KEY ("directionSetId") REFERENCES "StoryDirectionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
