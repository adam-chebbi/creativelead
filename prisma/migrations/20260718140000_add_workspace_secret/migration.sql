-- CreateTable: WorkspaceSecret for per-workspace encrypted provider credentials
CREATE TABLE "WorkspaceSecret" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSecret_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one secret key per workspace
CREATE UNIQUE INDEX "WorkspaceSecret_workspaceId_key_key" ON "WorkspaceSecret"("workspaceId", "key");

-- Index for fast per-workspace lookups
CREATE INDEX "WorkspaceSecret_workspaceId_idx" ON "WorkspaceSecret"("workspaceId");

-- Add foreign key
ALTER TABLE "WorkspaceSecret" ADD CONSTRAINT "WorkspaceSecret_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
