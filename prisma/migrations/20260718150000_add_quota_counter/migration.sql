-- CreateTable: QuotaCounter for per-workspace per-daily metric tracking
CREATE TABLE "QuotaCounter" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaCounter_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one counter per workspace per metric per day
CREATE UNIQUE INDEX "QuotaCounter_workspaceId_metric_date_key" ON "QuotaCounter"("workspaceId", "metric", "date");

-- Index for fast per-workspace lookup by date
CREATE INDEX "QuotaCounter_workspaceId_date_idx" ON "QuotaCounter"("workspaceId", "date");

-- Add foreign key
ALTER TABLE "QuotaCounter" ADD CONSTRAINT "QuotaCounter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
