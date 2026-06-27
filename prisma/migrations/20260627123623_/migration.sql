/*
  Warnings:

  - You are about to drop the column `isActive` on the `Teacher` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Teacher" DROP COLUMN "isActive",
ADD COLUMN     "status" BOOLEAN NOT NULL DEFAULT true;
