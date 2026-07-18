-- Create CampaignLedgerEntry table for server-side campaign send tracking

CREATE TABLE "CampaignLedgerEntry" (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES "Campaign"(id) ON DELETE CASCADE,
    lead_url TEXT,
    business_name TEXT,
    channel TEXT,
    recipient TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    subject TEXT,
    body TEXT,
    next_scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_ledger_entry_campaign_id ON "CampaignLedgerEntry"(campaign_id);
CREATE INDEX idx_campaign_ledger_entry_status ON "CampaignLedgerEntry"(status);
