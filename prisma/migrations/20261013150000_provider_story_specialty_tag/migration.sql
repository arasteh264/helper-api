ALTER TABLE "ProviderStory"
ADD COLUMN "specialtyId" TEXT;

CREATE INDEX "ProviderStory_specialtyId_idx"
ON "ProviderStory"("specialtyId");

ALTER TABLE "ProviderStory"
ADD CONSTRAINT "ProviderStory_specialtyId_fkey"
FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
