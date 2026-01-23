-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "returnReason" TEXT;
