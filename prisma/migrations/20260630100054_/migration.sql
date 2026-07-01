/*
  Warnings:

  - A unique constraint covering the columns `[schoolId,fatherEmail]` on the table `Parent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[schoolId,email]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - Made the column `fatherName` on table `Parent` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fatherMobile` on table `Parent` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fatherEmail` on table `Parent` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `email` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Student" DROP CONSTRAINT "Student_schoolId_fkey";

-- AlterTable
ALTER TABLE "public"."Parent" ADD COLUMN     "city" TEXT,
ADD COLUMN     "guardianMobile" TEXT,
ADD COLUMN     "motherEmail" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT,
ALTER COLUMN "fatherName" SET NOT NULL,
ALTER COLUMN "fatherMobile" SET NOT NULL,
ALTER COLUMN "fatherEmail" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Student" ADD COLUMN     "caste" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactNumber" TEXT,
ADD COLUMN     "emergencyContactRelation" TEXT,
ADD COLUMN     "hostel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "medicalHistory" TEXT,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "nationality" TEXT DEFAULT 'India',
ADD COLUMN     "previousSchool" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "transport" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Parent_schoolId_fatherEmail_key" ON "public"."Parent"("schoolId", "fatherEmail");

-- CreateIndex
CREATE INDEX "Student_parentId_idx" ON "public"."Student"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_email_key" ON "public"."Student"("schoolId", "email");

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
