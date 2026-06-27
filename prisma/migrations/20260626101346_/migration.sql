/*
  Warnings:

  - Added the required column `sortName` to the `Class` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Class" ADD COLUMN     "sortName" TEXT NOT NULL;
