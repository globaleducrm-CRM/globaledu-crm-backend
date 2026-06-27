/*
  Warnings:

  - The values [ACTIVE] on the enum `SchoolStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."SchoolStatus_new" AS ENUM ('APPROVED', 'PENDING', 'INACTIVE', 'SUSPENDED');
ALTER TABLE "public"."School" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."School" ALTER COLUMN "status" TYPE "public"."SchoolStatus_new" USING ("status"::text::"public"."SchoolStatus_new");
ALTER TYPE "public"."SchoolStatus" RENAME TO "SchoolStatus_old";
ALTER TYPE "public"."SchoolStatus_new" RENAME TO "SchoolStatus";
DROP TYPE "public"."SchoolStatus_old";
ALTER TABLE "public"."School" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
