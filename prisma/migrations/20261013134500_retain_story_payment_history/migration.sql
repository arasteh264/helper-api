ALTER TABLE "ProviderStoryPayment"
ADD COLUMN "storyTitle" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ProviderStoryPayment"
ALTER COLUMN "storyTitle" DROP DEFAULT;

ALTER TABLE "ProviderStoryPayment"
DROP CONSTRAINT "ProviderStoryPayment_storyId_fkey";

ALTER TABLE "ProviderStoryPayment"
ALTER COLUMN "storyId" DROP NOT NULL;

ALTER TABLE "ProviderStoryPayment"
ADD CONSTRAINT "ProviderStoryPayment_storyId_fkey"
FOREIGN KEY ("storyId") REFERENCES "ProviderStory"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
