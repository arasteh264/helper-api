CREATE TYPE "NotificationCategory" AS ENUM (
    'MESSAGES',
    'WORK_UPDATES',
    'OPPORTUNITIES',
    'PAYMENTS',
    'PROMOTIONS'
);

CREATE TYPE "NotificationType" AS ENUM (
    'CHAT_MESSAGE',
    'SERVICE_REQUEST_STATUS',
    'PROVIDER_OFFER',
    'NEW_OPPORTUNITY',
    'PAYMENT_UPDATE'
);

CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messagesInApp" BOOLEAN NOT NULL DEFAULT true,
    "messagesSms" BOOLEAN NOT NULL DEFAULT false,
    "messagesEmail" BOOLEAN NOT NULL DEFAULT false,
    "workUpdatesInApp" BOOLEAN NOT NULL DEFAULT true,
    "workUpdatesSms" BOOLEAN NOT NULL DEFAULT false,
    "workUpdatesEmail" BOOLEAN NOT NULL DEFAULT false,
    "opportunitiesInApp" BOOLEAN NOT NULL DEFAULT true,
    "opportunitiesSms" BOOLEAN NOT NULL DEFAULT false,
    "opportunitiesEmail" BOOLEAN NOT NULL DEFAULT false,
    "paymentsInApp" BOOLEAN NOT NULL DEFAULT true,
    "paymentsSms" BOOLEAN NOT NULL DEFAULT false,
    "paymentsEmail" BOOLEAN NOT NULL DEFAULT false,
    "promotionsInApp" BOOLEAN NOT NULL DEFAULT false,
    "promotionsSms" BOOLEAN NOT NULL DEFAULT false,
    "promotionsEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "serviceRequestId" TEXT,
    "chatMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification"("userId", "createdAt", "id");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_chatMessageId_idx" ON "Notification"("chatMessageId");

ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_chatMessageId_fkey"
    FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
