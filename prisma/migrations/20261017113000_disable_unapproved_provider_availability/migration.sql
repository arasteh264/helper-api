UPDATE "ProviderProfile"
SET "isAvailable" = false
WHERE "verificationStatus" <> 'APPROVED';
