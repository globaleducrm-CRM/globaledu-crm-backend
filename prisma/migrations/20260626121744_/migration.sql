-- CreateEnum
CREATE TYPE "public"."SectionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "public"."Section" ADD COLUMN     "status" "public"."SectionStatus" NOT NULL DEFAULT 'ACTIVE';
