/*
  Warnings:

  - Added the required column `shopId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopId` to the `Sku` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "town" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "shopId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminUser_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderSource" TEXT NOT NULL,
    "rawText" TEXT,
    "mediaUrl" TEXT,
    "tractorBrand" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "cancelReason" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("cancelReason", "createdAt", "deliveryFee", "id", "mediaUrl", "model", "orderSource", "rawText", "status", "subtotal", "total", "tractorBrand", "updatedAt", "userId") SELECT "cancelReason", "createdAt", "deliveryFee", "id", "mediaUrl", "model", "orderSource", "rawText", "status", "subtotal", "total", "tractorBrand", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE TABLE "new_Sku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "modelCompat" TEXT,
    "category" TEXT,
    "retailPrice" INTEGER NOT NULL,
    "mistriPrice" INTEGER,
    "wholesalePrice" INTEGER NOT NULL DEFAULT 0,
    "weightG" INTEGER NOT NULL DEFAULT 0,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sku_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Sku" ("brand", "category", "createdAt", "id", "mistriPrice", "modelCompat", "name", "retailPrice", "stockQty", "weightG", "wholesalePrice") SELECT "brand", "category", "createdAt", "id", "mistriPrice", "modelCompat", "name", "retailPrice", "stockQty", "weightG", "wholesalePrice" FROM "Sku";
DROP TABLE "Sku";
ALTER TABLE "new_Sku" RENAME TO "Sku";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "userType" TEXT NOT NULL,
    "acquisitionChannel" TEXT NOT NULL,
    "referredByMistriId" TEXT,
    "walletBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_referredByMistriId_fkey" FOREIGN KEY ("referredByMistriId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("acquisitionChannel", "createdAt", "id", "name", "phone", "referredByMistriId", "userType", "walletBalance") SELECT "acquisitionChannel", "createdAt", "id", "name", "phone", "referredByMistriId", "userType", "walletBalance" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_shopId_phone_key" ON "User"("shopId", "phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
