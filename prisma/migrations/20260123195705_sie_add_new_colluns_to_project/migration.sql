-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "approvalOpinion" TEXT,
ADD COLUMN     "classificationAnswers" JSONB,
ADD COLUMN     "proposedInstrumentType" "LegalInstrumentType";
