import { Campaign, CampaignLedgerEntry } from '../types';
import { getAllCampaigns, getCampaignLedger, saveLedgerEntry, getPendingSends, updateLedgerStatus, getCampaign, saveCampaign, generateId } from './campaign-db';
import { sendEmail, sendSms, sendWhatsApp, getRecipientFromLead } from './campaign-sender';
import { fetchLeadsFromApi } from '../hooks/useLeadStore';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export function startScheduler(onTick?: (results: { campaignId: string; leadUrl: string; stepIndex: number; ok: boolean; error?: string }[]) => void) {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const results = await processPendingSends();
      if (onTick && results.length > 0) onTick(results);
    } finally {
      isRunning = false;
    }
  }, 60000);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}

async function processPendingSends(): Promise<{ campaignId: string; leadUrl: string; stepIndex: number; ok: boolean; error?: string }[]> {
  const pending = await getPendingSends();
  if (pending.length === 0) return [];

  const leads = await fetchLeadsFromApi();
  const leadMap = new Map(leads.map(l => [l.google_maps_url || l.business_name, l]));

  const results: { campaignId: string; leadUrl: string; stepIndex: number; ok: boolean; error?: string }[] = [];

  for (const entry of pending) {
    const campaign = await getCampaign(entry.campaignId);
    if (!campaign || campaign.status !== 'running') continue;

    const lead = leadMap.get(entry.leadUrl);
    if (!lead) {
      await updateLedgerStatus(entry.id, 'failed', { errorMessage: 'Lead not found in database' });
      results.push({ campaignId: entry.campaignId, leadUrl: entry.leadUrl, stepIndex: entry.stepIndex, ok: false, error: 'Lead not found' });
      continue;
    }

    const recipient = getRecipientFromLead(lead, entry.channel);
    if (!recipient) {
      await updateLedgerStatus(entry.id, 'failed', { errorMessage: `No ${entry.channel} contact available for this lead` });
      results.push({ campaignId: entry.campaignId, leadUrl: entry.leadUrl, stepIndex: entry.stepIndex, ok: false, error: 'No contact info' });
      continue;
    }

    const step = campaign.followUpSteps[entry.stepIndex];
    let sendResult;

    if (entry.channel === 'email') {
      const subject = step?.subjectTemplate || campaign.subjectTemplate || 'Introduction';
      sendResult = await sendEmail(recipient, subject, entry.messageBody || step?.messageTemplate || campaign.messageTemplate);
    } else if (entry.channel === 'whatsapp') {
      sendResult = await sendWhatsApp(recipient, entry.messageBody || step?.messageTemplate || campaign.messageTemplate);
    } else {
      sendResult = await sendSms(recipient, entry.messageBody || step?.messageTemplate || campaign.messageTemplate);
    }

    if (sendResult.ok) {
      await updateLedgerStatus(entry.id, 'sent', { sentAt: new Date().toISOString() });
      results.push({ campaignId: entry.campaignId, leadUrl: entry.leadUrl, stepIndex: entry.stepIndex, ok: true });

      // Schedule next follow-up step
      const nextStepIndex = entry.stepIndex + 1;
      if (nextStepIndex < campaign.followUpSteps.length && campaign.status === 'running') {
        const nextStep = campaign.followUpSteps[nextStepIndex];
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + nextStep.dayOffset);

        await saveLedgerEntry({
          id: generateId(),
          campaignId: entry.campaignId,
          leadUrl: entry.leadUrl,
          stepIndex: nextStepIndex,
          channel: entry.channel,
          status: 'pending',
          nextScheduledAt: scheduledAt.toISOString(),
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      await updateLedgerStatus(entry.id, 'failed', { errorMessage: sendResult.error });
      results.push({ campaignId: entry.campaignId, leadUrl: entry.leadUrl, stepIndex: entry.stepIndex, ok: false, error: sendResult.error });
    }
  }

  return results;
}

export async function initializeCampaignSends(campaign: Campaign): Promise<void> {
  const entries: CampaignLedgerEntry[] = [];
  const leads = await fetchLeadsFromApi();
  const targetLeads = leads.filter(l => campaign.recipientLeadUrls.includes(l.google_maps_url || ''));

  for (const lead of targetLeads) {
    const firstStep = campaign.followUpSteps[0];
    let scheduledAt: string | undefined;
    if (campaign.scheduleType === 'scheduled' && campaign.scheduledAt) {
      scheduledAt = campaign.scheduledAt;
    }

    const messageBody = resolveMessageTemplate(firstStep.messageTemplate || campaign.messageTemplate, lead, campaign);

    entries.push({
      id: generateId(),
      campaignId: campaign.id,
      leadUrl: lead.google_maps_url || '',
      stepIndex: firstStep.stepIndex,
      channel: campaign.channel,
      status: 'pending',
      messageBody,
      nextScheduledAt: scheduledAt,
      createdAt: new Date().toISOString(),
    });
  }

  const { saveLedgerEntries } = await import('./campaign-db');
  await saveLedgerEntries(entries);

  campaign.stats.leadsInCampaign = targetLeads.length;
  campaign.stats.followUpsTotal = targetLeads.length * campaign.followUpSteps.length;
  await saveCampaign(campaign);
}

function resolveMessageTemplate(template: string, lead: any, campaign: Campaign): string {
  return template
    .replace(/\{\{business_name\}\}/g, lead.business_name || '')
    .replace(/\{\{name\}\}/g, lead.business_name || '')
    .replace(/\{\{category\}\}/g, lead.category || '')
    .replace(/\{\{city\}\}/g, lead.city || lead.location || '')
    .replace(/\{\{campaign_name\}\}/g, campaign.name)
    .replace(/\{\{recommended_service\}\}/g, lead.recommended_service || 'digital services');
}

export async function markReplied(entryId: string): Promise<void> {
  await updateLedgerStatus(entryId, 'replied');
}

export async function getTodayCount(): Promise<number> {
  const { getTodayFollowUps } = await import('./campaign-db');
  const items = await getTodayFollowUps();
  return items.length;
}