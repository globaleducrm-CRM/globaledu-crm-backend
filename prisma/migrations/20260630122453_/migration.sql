-- DropForeignKey
ALTER TABLE "public"."Student" DROP CONSTRAINT "Student_schoolId_fkey";

-- AlterTable
ALTER TABLE "public"."Parent" ADD COLUMN     "status" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
