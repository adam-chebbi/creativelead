-- Phase 0: Introduce the workspace concept
--
-- 1. Rename Organization → Workspace (existing tenant table)
-- 2. Rename OrganizationSettings → WorkspaceSettings
-- 3. Rename organizationId → workspaceId on all tenant-scoped tables
-- 4. Add WorkspaceMember join table
-- 5. Create a default workspace and backfill existing data

-- Rename existing tables
ALTER TABLE "Organization" RENAME TO "Workspace";
ALTER TABLE "OrganizationSettings" RENAME TO "WorkspaceSettings";

-- Rename columns on Lead
ALTER TABLE "Lead" RENAME COLUMN "organizationId" TO "workspaceId";

-- Rename columns on Campaign
ALTER TABLE "Campaign" RENAME COLUMN "organizationId" TO "workspaceId";

-- Rename columns on AuditLog
ALTER TABLE "AuditLog" RENAME COLUMN "organizationId" TO "workspaceId";

-- Rename columns on WorkspaceSettings (was OrganizationSettings)
ALTER TABLE "WorkspaceSettings" RENAME COLUMN "organizationId" TO "workspaceId";

-- Drop old foreign key constraints
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_organizationId_fkey";
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_organizationId_fkey";
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_organizationId_fkey";
ALTER TABLE "WorkspaceSettings" DROP CONSTRAINT IF EXISTS "OrganizationSettings_organizationId_fkey";

-- Drop old indexes that will be recreated with new names
DROP INDEX IF EXISTS "Lead_organizationId_pipelineStage_idx";
DROP INDEX IF EXISTS "Lead_organizationId_aiScore_idx";
DROP INDEX IF EXISTS "Campaign_organizationId_idx";
DROP INDEX IF EXISTS "AuditLog_organizationId_createdAt_idx";

-- The unique constraint on OrganizationSettings needs to be dropped and recreated
ALTER TABLE "WorkspaceSettings" DROP CONSTRAINT IF EXISTS "OrganizationSettings_organizationId_key";

-- The unique constraint on Lead (organizationId + phone) needs the same treatment
-- Prisma creates unique constraints as indexes, so we drop and recreate
DROP INDEX IF EXISTS "Lead_organizationId_phone_key";

-- Recreate foreign keys pointing to Workspace
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceSettings" ADD CONSTRAINT "WorkspaceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recreate indexes with new names
CREATE INDEX "Lead_workspaceId_pipelineStage_idx" ON "Lead"("workspaceId", "pipelineStage");
CREATE INDEX "Lead_workspaceId_aiScore_idx" ON "Lead"("workspaceId", "aiScore");
CREATE UNIQUE INDEX "Lead_workspaceId_phone_key" ON "Lead"("workspaceId", "phone");
CREATE INDEX "Campaign_workspaceId_idx" ON "Campaign"("workspaceId");
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "WorkspaceSettings_workspaceId_key" ON "WorkspaceSettings"("workspaceId");

-- Create WorkspaceMember table
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create a default workspace if one doesn't exist
INSERT INTO "Workspace" ("id", "name", "createdAt")
SELECT 'ws_default', 'Default Workspace', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Workspace" WHERE "id" = 'ws_default');

-- Backfill any existing rows that need a workspace reference
UPDATE "Lead" SET "workspaceId" = 'ws_default' WHERE "workspaceId" IS NULL OR "workspaceId" = '';
UPDATE "Campaign" SET "workspaceId" = 'ws_default' WHERE "workspaceId" IS NULL OR "workspaceId" = '';
UPDATE "AuditLog" SET "workspaceId" = 'ws_default' WHERE "workspaceId" IS NULL OR "workspaceId" = '';
UPDATE "WorkspaceSettings" SET "workspaceId" = 'ws_default' WHERE "workspaceId" IS NULL OR "workspaceId" = '';
