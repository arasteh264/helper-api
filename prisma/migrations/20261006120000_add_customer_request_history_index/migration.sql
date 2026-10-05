CREATE INDEX "ServiceRequest_customerId_status_createdAt_id_idx"
ON "ServiceRequest"("customerId", "status", "createdAt", "id");
