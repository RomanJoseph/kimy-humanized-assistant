-- DropIndex (remove 1:1 unique constraint)
DROP INDEX "google_calendar_auth_contact_id_key";

-- AlterTable (add label column)
ALTER TABLE "google_calendar_auth" ADD COLUMN "label" TEXT;

-- CreateIndex (add composite unique for multi-account)
CREATE UNIQUE INDEX "google_calendar_auth_contact_id_email_key" ON "google_calendar_auth"("contact_id", "email");
