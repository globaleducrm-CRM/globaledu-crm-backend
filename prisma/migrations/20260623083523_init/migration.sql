/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.
  - Added the required column `schoolBoardCode` to the `School` table without a default value. This is not possible if the table is not empty.
  - Made the column `board` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addressLine` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Made the column `city` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Made the column `district` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Made the column `state` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pincode` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Made the column `country` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "public"."SchoolStatus" ADD VALUE 'PENDING';

-- DropIndex
DROP INDEX "public"."User_roleId_idx";

-- DropIndex
DROP INDEX "public"."User_schoolId_idx";

-- AlterTable
ALTER TABLE "public"."School" ADD COLUMN     "adminEmail" TEXT,
ADD COLUMN     "adminName" TEXT,
ADD COLUMN     "adminPhone" TEXT,
ADD COLUMN     "banner" TEXT,
ADD COLUMN     "ownerEmail" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "ownerPhone" TEXT,
ADD COLUMN     "principalEmail" TEXT,
ADD COLUMN     "principalPhone" TEXT,
ADD COLUMN     "schoolBoardCode" TEXT NOT NULL,
ALTER COLUMN "board" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "addressLine" SET NOT NULL,
ALTER COLUMN "city" SET NOT NULL,
ALTER COLUMN "district" SET NOT NULL,
ALTER COLUMN "state" SET NOT NULL,
ALTER COLUMN "pincode" SET NOT NULL,
ALTER COLUMN "country" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "passwordHash",
ADD COLUMN     "password" TEXT NOT NULL;
