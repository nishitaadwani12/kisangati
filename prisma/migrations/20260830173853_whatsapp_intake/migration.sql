-- AlterTable
ALTER TABLE "Order" ADD COLUMN "waMessageId" TEXT;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "whatsappPhoneNumberId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_waMessageId_key" ON "Order"("waMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_whatsappPhoneNumberId_key" ON "Shop"("whatsappPhoneNumberId");

