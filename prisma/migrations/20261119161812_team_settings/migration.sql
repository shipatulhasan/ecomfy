-- AlterTable
ALTER TABLE "AdminInvite" ADD COLUMN     "staffRoleId" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "address" TEXT NOT NULL DEFAULT 'House 15, Road 7, Dhanmondi, Dhaka 1205',
ADD COLUMN     "allowedUploadTypes" TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::TEXT[],
ADD COLUMN     "contactEmail" TEXT NOT NULL DEFAULT 'hello@ecofy.com',
ADD COLUMN     "contactPhone" TEXT NOT NULL DEFAULT '+880258812345',
ADD COLUMN     "faviconUrl" TEXT,
ADD COLUMN     "freeShippingThresholdCents" INTEGER,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "ogImageUrl" TEXT,
ADD COLUMN     "pendingPaymentTtlMin" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "seoDescription" TEXT NOT NULL DEFAULT 'Fresh fruit, vegetables and organic groceries delivered.',
ADD COLUMN     "seoTitleTemplate" TEXT NOT NULL DEFAULT '%s · Ecomfy',
ADD COLUMN     "socialLinks" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "storeName" TEXT NOT NULL DEFAULT 'Ecofy';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "notificationPrefs" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "staffRoleId" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StaffRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'user',
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffRole_name_key" ON "StaffRole"("name");

-- CreateIndex
CREATE INDEX "TwoFactor_userId_idx" ON "TwoFactor"("userId");

-- CreateIndex
CREATE INDEX "TwoFactor_secret_idx" ON "TwoFactor"("secret");

-- CreateIndex
CREATE INDEX "User_staffRoleId_idx" ON "User"("staffRoleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_staffRoleId_fkey" FOREIGN KEY ("staffRoleId") REFERENCES "StaffRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_staffRoleId_fkey" FOREIGN KEY ("staffRoleId") REFERENCES "StaffRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the Control Authority roles (Add Members.png). "Super Admin" is the system
-- role behind User.role ADMIN (every permission, not editable); the rest are presets.
INSERT INTO "StaffRole" ("id", "name", "description", "icon", "permissions", "isSystem", "sortOrder", "updatedAt") VALUES
  ('role_super_admin', 'Super Admin', 'Full access, including team and store settings.', 'shield', ARRAY[]::TEXT[], true, 0, CURRENT_TIMESTAMP),
  ('role_manager', 'Manager', 'Runs orders, products and customers day to day.', 'manager',
    ARRAY['dashboard:read','orders:read','orders:update','products:read','products:create','products:update','products:delete','categories:read','customers:read','payments:read'], false, 1, CURRENT_TIMESTAMP),
  ('role_editor', 'Editor', 'Maintains the catalog: products and categories.', 'editor',
    ARRAY['dashboard:read','products:read','products:create','products:update','products:delete','categories:read','categories:create','categories:update','categories:delete'], false, 2, CURRENT_TIMESTAMP),
  ('role_support', 'Support Representative', 'Helps customers with their orders.', 'support',
    ARRAY['dashboard:read','orders:read','orders:update','customers:read','payments:read'], false, 3, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Existing staff keep exactly what STAFF could do (= Manager); admins are Super Admins.
UPDATE "User" SET "staffRoleId" = 'role_manager' WHERE "role" = 'STAFF' AND "staffRoleId" IS NULL;
UPDATE "User" SET "staffRoleId" = 'role_super_admin' WHERE "role" = 'ADMIN' AND "staffRoleId" IS NULL;
UPDATE "AdminInvite" SET "staffRoleId" = CASE WHEN "role" = 'ADMIN' THEN 'role_super_admin' ELSE 'role_manager' END
  WHERE "staffRoleId" IS NULL;
