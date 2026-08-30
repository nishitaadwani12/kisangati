/*
  Warnings:

  - Added the required column `matchKey` to the `Sku` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
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
INSERT INTO "new_Sku" ("brand", "category", "createdAt", "id", "mistriPrice", "modelCompat", "name", "retailPrice", "shopId", "stockQty", "weightG", "wholesalePrice") SELECT "brand", "category", "createdAt", "id", "mistriPrice", "modelCompat", "name", "retailPrice", "shopId", "stockQty", "weightG", "wholesalePrice" FROM "Sku";
DROP TABLE "Sku";
ALTER TABLE "new_Sku" RENAME TO "Sku";
CREATE UNIQUE INDEX "Sku_shopId_matchKey_key" ON "Sku"("shopId", "matchKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
