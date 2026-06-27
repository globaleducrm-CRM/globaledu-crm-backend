/*
  Warnings:

  - A unique constraint covering the columns `[schoolId,subjectName]` on the table `Subject` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Subject" ADD COLUMN     "description" TEXT,
ADD COLUMN     "shortName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_subjectName_key" ON "public"."Subject"("schoolId", "subjectName");
