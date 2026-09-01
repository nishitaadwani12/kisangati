-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "refundStatus" TEXT;
ALTER TABLE "Payment" ADD COLUMN "refundUtr" TEXT;
ALTER TABLE "Payment" ADD COLUMN "refundedAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "refundedBy" TEXT;

-- AlterTable
ALTER TABLE "WalletTxn" ADD COLUMN "ref" TEXT;

