-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "specialtyId" TEXT;

-- CreateIndex
CREATE INDEX "ServiceRequest_specialtyId_status_idx" ON "ServiceRequest"("specialtyId", "status");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
