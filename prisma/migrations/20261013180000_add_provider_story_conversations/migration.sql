CREATE TABLE "ProviderStoryConversation" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderStoryConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderStoryMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderStoryMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderStoryConversation_storyId_customerUserId_key"
ON "ProviderStoryConversation"("storyId", "customerUserId");

CREATE INDEX "ProviderStoryConversation_providerProfileId_updatedAt_idx"
ON "ProviderStoryConversation"("providerProfileId", "updatedAt");

CREATE INDEX "ProviderStoryConversation_customerUserId_updatedAt_idx"
ON "ProviderStoryConversation"("customerUserId", "updatedAt");

CREATE INDEX "ProviderStoryMessage_conversationId_createdAt_idx"
ON "ProviderStoryMessage"("conversationId", "createdAt");

CREATE INDEX "ProviderStoryMessage_senderUserId_createdAt_idx"
ON "ProviderStoryMessage"("senderUserId", "createdAt");

ALTER TABLE "ProviderStoryConversation"
ADD CONSTRAINT "ProviderStoryConversation_storyId_fkey"
FOREIGN KEY ("storyId") REFERENCES "ProviderStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderStoryConversation"
ADD CONSTRAINT "ProviderStoryConversation_customerUserId_fkey"
FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderStoryConversation"
ADD CONSTRAINT "ProviderStoryConversation_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderStoryMessage"
ADD CONSTRAINT "ProviderStoryMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ProviderStoryConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderStoryMessage"
ADD CONSTRAINT "ProviderStoryMessage_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
