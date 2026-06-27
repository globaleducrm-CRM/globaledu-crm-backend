/*
  Warnings:

  - You are about to drop the column `schoolName` on the `School` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `School` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `School` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."School_schoolName_key";

-- AlterTable
ALTER TABLE "public"."School" DROP COLUMN "schoolName",
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "School_schoolName_key" ON "public"."School"("name");
