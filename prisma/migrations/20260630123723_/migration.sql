/*
  Warnings:

  - You are about to drop the column `parentId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Parent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_parentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_studentId_fkey";

-- DropIndex
DROP INDEX "public"."User_parentId_key";

-- DropIndex
DROP INDEX "public"."User_studentId_key";

-- AlterTable
ALTER TABLE "public"."Parent" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "public"."Student" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "parentId",
DROP COLUMN "studentId";

-- CreateIndex
CREATE UNIQUE INDEX "Parent_userId_key" ON "public"."Parent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "public"."Student"("userId");

-- AddForeignKey
ALTER TABLE "public"."Parent" ADD CONSTRAINT "Parent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
