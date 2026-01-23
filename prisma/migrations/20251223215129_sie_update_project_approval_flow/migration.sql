-- AlterEnum: Update ProjectStatus enum
-- Create new enum with desired values
CREATE TYPE "ProjectStatus_new" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- Migrate existing data (IN_ANALYSIS -> PENDING_REVIEW)
ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" 
  ALTER COLUMN "status" TYPE "ProjectStatus_new" 
  USING (
    CASE 
      WHEN "status"::text = 'IN_ANALYSIS' THEN 'PENDING_REVIEW'::text
      ELSE "status"::text
    END
  )::"ProjectStatus_new";
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Drop old enum and rename new one
DROP TYPE "ProjectStatus";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";

-- AlterEnum: Update LegalInstrumentStatus enum
-- Create new enum with simplified values
CREATE TYPE "LegalInstrumentStatus_new" AS ENUM ('PENDING', 'PARTIAL', 'FILLED');

-- Migrate existing data
ALTER TABLE "LegalInstrumentInstance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "LegalInstrumentInstance" 
  ALTER COLUMN "status" TYPE "LegalInstrumentStatus_new" 
  USING (
    CASE 
      WHEN "status"::text IN ('DRAFT', 'REJECTED') THEN 'PENDING'::text
      WHEN "status"::text = 'SENT_FOR_ANALYSIS' THEN 'PARTIAL'::text
      WHEN "status"::text = 'APPROVED' THEN 'FILLED'::text
      ELSE 'PENDING'::text
    END
  )::"LegalInstrumentStatus_new";
ALTER TABLE "LegalInstrumentInstance" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Drop old enum and rename new one
DROP TYPE "LegalInstrumentStatus";
ALTER TYPE "LegalInstrumentStatus_new" RENAME TO "LegalInstrumentStatus";

-- Add new columns to Project table for review tracking
ALTER TABLE "Project" ADD COLUMN "reviewStartedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "reviewStartedBy" TEXT;

-- Create foreign key constraint for reviewer
ALTER TABLE "Project" ADD CONSTRAINT "Project_reviewStartedBy_fkey" 
  FOREIGN KEY ("reviewStartedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index for reviewStartedBy
CREATE INDEX "Project_reviewStartedBy_idx" ON "Project"("reviewStartedBy");
