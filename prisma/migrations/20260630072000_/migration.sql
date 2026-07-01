-- AlterTable
ALTER TABLE "public"."Section" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "public"."Subject" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "public"."Teacher" ADD COLUMN     "sessionId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Section" ADD CONSTRAINT "Section_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subject" ADD CONSTRAINT "Subject_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Teacher" ADD CONSTRAINT "Teacher_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
