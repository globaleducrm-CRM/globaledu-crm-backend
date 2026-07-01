/*
  Warnings:

  - You are about to drop the column `teacherId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Teacher" DROP CONSTRAINT "Teacher_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_teacherId_fkey";

-- DropIndex
DROP INDEX "public"."User_teacherId_key";

-- AlterTable
ALTER TABLE "public"."Section" ADD COLUMN     "classTeacherId" TEXT,
ADD COLUMN     "coClassTeacherId" TEXT;

-- AlterTable
ALTER TABLE "public"."Teacher" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "teacherId";

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "public"."Teacher"("userId");

-- AddForeignKey
ALTER TABLE "public"."Section" ADD CONSTRAINT "Section_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "public"."Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Section" ADD CONSTRAINT "Section_coClassTeacherId_fkey" FOREIGN KEY ("coClassTeacherId") REFERENCES "public"."Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
