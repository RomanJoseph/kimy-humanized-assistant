-- CreateTable
CREATE TABLE "contact_memories" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "facts" TEXT NOT NULL DEFAULT '',
    "last_processed_message_id" TEXT,
    "message_count_since_update" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_memories_contact_id_key" ON "contact_memories"("contact_id");

-- AddForeignKey
ALTER TABLE "contact_memories" ADD CONSTRAINT "contact_memories_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
