-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "input_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_caches" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "response_text" TEXT NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_caches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_id_key" ON "sessions"("session_id");

-- CreateIndex
CREATE INDEX "idx_sessions_status" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "idx_sessions_last_active" ON "sessions"("last_active_at");

-- CreateIndex
CREATE INDEX "idx_sessions_expires" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_messages_session" ON "messages"("session_id");

-- CreateIndex
CREATE INDEX "idx_messages_created" ON "messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_caches_cache_key_key" ON "ingredient_caches"("cache_key");

-- CreateIndex
CREATE INDEX "idx_cache_key" ON "ingredient_caches"("cache_key");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
