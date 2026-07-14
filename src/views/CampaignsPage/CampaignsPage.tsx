import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lead, Campaign, CampaignFollowUpStep, CampaignLedgerEntry } from '@/types';
import { Button, Badge, Spinner } from '@/components/ui';

import { useLeadStore } from '@/hooks';
import { getAllCampaigns, saveCampaign, getCampaignLedger, generateId, deleteCampaign } from '@/utils/campaign-db';
import { sendEmail, sendSms, sendWhatsApp, getRecipientFromLead } from '@/utils/campaign-sender';
import { startScheduler, stopScheduler, initializeCampaignSends, isSchedulerRunning, getTodayCount, markReplied } from '@/utils/campaign-scheduler';
import { getSettings } from '@/hooks/useSettingsStore';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';

const STEPS_DEFAULTS: CampaignFollowUpStep[] = [
  { dayOffset: 0, subjectTemplate: 'Introduction: {{business_name}}', messageTemplate: 'Hi {{business_name}}, I noticed your business in {{city}} has opportunities to grow online. Would you be open to a quick chat?', stepIndex: 0 },
  { dayOffset: 3, subjectTemplate: 'Following up', messageTemplate: 'Hi {{business_name}}, following up on my previous message. I have some ideas that could help {{category}} businesses in {{city}} attract more customers. Worth 10 minutes?', stepIndex: 1 },
  { dayOffset: 7, subjectTemplate: 'Last chance to connect', messageTemplate: 'Last note — would love to share a few growth strategies for {{business_name}} before I close this outreach. Let me know if you are interested.', stepIndex: 2 },
];

export const CampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [ledgers, setLedgers] = useState<Record<string, CampaignLedgerEntry[]>>({});
  const [tab, setTab] = useState<'list' | 'create' | 'detail'>('list');
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [schedulerOn, setSchedulerOn] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sendingInProgress, setSendingInProgress] = useState(false);

  const { getAllLeads: fetchLeads } = useLeadStore();

  // New campaign form
  const [formName, setFormName] = useState('');
  const [formChannel, setFormChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [formSubject, setFormSubject] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formRecipients, setFormRecipients] = useState<'stage' | 'filter' | 'all'>('all');
  const [formStage, setFormStage] = useState<string>('new');
  const [formScheduleType, setFormScheduleType] = useState<'immediate' | 'scheduled'>('immediate');
  const [formScheduleDate, setFormScheduleDate] = useState('');
  const [formFollowUpSteps, setFormFollowUpSteps] = useState<CampaignFollowUpStep[]>(STEPS_DEFAULTS);
  const [selectedLeadUrls, setSelectedLeadUrls] = useState<Set<string>>(new Set());
  const [leadSearch, setLeadSearch] = useState('');

  const [creating, setCreating] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [c, l] = await Promise.all([getAllCampaigns(), fetchLeads()]);
      setCampaigns(c);
      setLeads(l);
      setTodayCount(await getTodayCount());
    } catch (err) {
      setError('Failed to load campaigns: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  }, [fetchLeads]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const wasRunning = sessionStorage.getItem('campaign_scheduler') === 'true';
    if (wasRunning && !schedulerOn) {
      startScheduler(handleSchedulerTick);
      setSchedulerOn(true);
    }
  }, []);

  const handleSchedulerTick = async () => {
    await reload();
    setTodayCount(await getTodayCount());
  };

  const toggleScheduler = () => {
    if (schedulerOn) {
      stopScheduler();
      setSchedulerOn(false);
      sessionStorage.removeItem('campaign_scheduler');
    } else {
      startScheduler(handleSchedulerTick);
      setSchedulerOn(true);
      sessionStorage.setItem('campaign_scheduler', 'true');
    }
  };

  const filteredLeads = leads.filter(l => {
    const q = leadSearch.toLowerCase();
    if (!q) return true;
    return l.business_name.toLowerCase().includes(q) ||
           (l.city || '').toLowerCase().includes(q) ||
           (l.category || '').toLowerCase().includes(q);
  });

  const getRecipientLeads = (): string[] => {
    if (formRecipients === 'all') return leads.map(l => l.google_maps_url || '').filter(Boolean);
    if (formRecipients === 'stage') return leads.filter(l => l['_stage'] === formStage).map(l => l.google_maps_url || '').filter(Boolean);
    return Array.from(selectedLeadUrls);
  };

  const handleCreateCampaign = async () => {
    if (!formName.trim()) { setCampaignError('Campaign name is required.'); return; }
    if (!formMessage.trim()) { setCampaignError('Message template is required.'); return; }
    const recipientUrls = getRecipientLeads();
    if (recipientUrls.length === 0) { setCampaignError('No recipients selected. Import leads first.'); return; }

    const settings = getSettings();
    const p = settings.providers;
    if (formChannel === 'email' && !p.emailSmtpHost && !p.emailSmtpUser) { setCampaignError('Email provider not configured. Go to Settings and set SMTP/SendGrid credentials.'); return; }
    if (formChannel === 'sms' && (!p.twilioAccountSid || !p.twilioSmsFromNumber)) { setCampaignError('SMS provider (Twilio) not configured. Go to Settings.'); return; }
    if (formChannel === 'whatsapp' && (!p.twilioAccountSid || !p.twilioWhatsAppFromNumber)) { setCampaignError('WhatsApp provider (Twilio) not configured. Go to Settings.'); return; }

    setCreating(true);
    setCampaignError(null);
    try {
      const campaign: Campaign = {
        id: generateId(),
        name: formName.trim(),
        channel: formChannel,
        messageTemplate: formMessage.trim(),
        subjectTemplate: formSubject.trim() || undefined,
        recipientLeadUrls: recipientUrls,
        scheduleType: formScheduleType,
        scheduledAt: formScheduleType === 'scheduled' ? new Date(formScheduleDate).toISOString() : undefined,
        followUpSteps: formFollowUpSteps,
        status: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: { sentCount: 0, failedCount: 0, replyCount: 0, leadsInCampaign: 0, followUpsCompleted: 0, followUpsTotal: 0 },
      };

      await saveCampaign(campaign);
      await initializeCampaignSends(campaign);
      await reload();
      resetForm();
      setTab('list');
    } catch (err) {
      setCampaignError('Failed to create campaign: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormChannel('email');
    setFormSubject('');
    setFormMessage('');
    setFormRecipients('all');
    setFormStage('new');
    setFormScheduleType('immediate');
    setFormScheduleDate('');
    setFormFollowUpSteps(STEPS_DEFAULTS);
    setSelectedLeadUrls(new Set());
    setLeadSearch('');
  };

  const viewCampaign = async (c: Campaign) => {
    setDetailCampaign(c);
    const ledger = await getCampaignLedger(c.id);
    setLedgers(prev => ({ ...prev, [c.id]: ledger }));
    setTab('detail');
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Delete this campaign and all its send history?')) return;
    await deleteCampaign(id);
    if (detailCampaign?.id === id) setTab('list');
    await reload();
  };

  const handleSendTest = async (channel: string) => {
    if (!formMessage.trim()) { setCampaignError('Write a message template first.'); return; }
    setSendingInProgress(true);
    setCampaignError(null);
    try {
      const firstRecipient = getRecipientLeads()[0];
      const lead = leads.find(l => l.google_maps_url === firstRecipient);
      if (!lead) { setCampaignError('No lead selected to test with.'); return; }
      const recipient = getRecipientFromLead(lead, channel as any);
      if (!recipient) { setCampaignError(`Selected lead has no ${channel} contact info.`); return; }

      const resolved = formMessage.replace(/\{\{business_name\}\}/g, lead.business_name).replace(/\{\{name\}\}/g, lead.business_name);

      let result;
      if (channel === 'email') result = await sendEmail(recipient, formSubject || 'Test', resolved);
      else if (channel === 'whatsapp') result = await sendWhatsApp(recipient, resolved);
      else result = await sendSms(recipient, resolved);

      if (result.ok) {
        setCampaignError(null);
        alert('Test message sent successfully!');
      } else {
        setCampaignError(result.error);
      }
    } finally {
      setSendingInProgress(false);
    }
  };

  const handleMarkReplied = async (entryId: string, campaignId: string) => {
    await markReplied(entryId);
    const ledger = await getCampaignLedger(campaignId);
    setLedgers(prev => ({ ...prev, [campaignId]: ledger }));
    await reload();
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = { draft: 'var(--color-text-muted)', running: 'var(--color-success)', paused: 'var(--color-warning)', completed: 'var(--color-primary-light)', cancelled: 'var(--color-danger)' };
    return <span className="campaign-badge" style={{ background: (colors[s] || '#666') + '20', color: colors[s] || '#666', border: '1px solid ' + (colors[s] || '#666') }}>{s}</span>;
  };

  const calculateStats = (c: Campaign, entries: CampaignLedgerEntry[]) => {
    if (!entries) return c.stats;
    return {
      sentCount: entries.filter(e => e.status === 'sent').length,
      failedCount: entries.filter(e => e.status === 'failed').length,
      replyCount: entries.filter(e => e.status === 'replied').length,
      leadsInCampaign: c.stats.leadsInCampaign,
      followUpsCompleted: entries.filter(e => e.status !== 'pending').length,
      followUpsTotal: c.stats.followUpsTotal,
    };
  };

  return (
    <motion.div className="page-content" variants={staggerContainer} initial="hidden" animate="visible" exit="hidden">
      <motion.div className="section-header" variants={fadeInUp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="hero-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
            Campaign<span>s</span>
          </h1>
          <p className="hero-subtitle" style={{ margin: '0', textAlign: 'left', maxWidth: '100%' }}>
            Create and run outbound campaigns across email, WhatsApp, and SMS with follow-up automation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {todayCount > 0 ? `📅 ${todayCount} follow-up(s) today` : 'No sends scheduled'}
          </span>
          <Button size="sm" variant={schedulerOn ? 'primary' : 'secondary'} onClick={toggleScheduler} title="Runs every 15 seconds while active">
            {schedulerOn ? 'Scheduler On' : 'Start Scheduler'}
          </Button>
          {tab === 'list' && <Button size="sm" variant="primary" onClick={() => { resetForm(); setTab('create'); }}>New Campaign</Button>}
          {tab === 'detail' && <Button size="sm" variant="ghost" onClick={() => setTab('list')}>Back to List</Button>}
        </div>
      </motion.div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {tab === 'list' && (
        <motion.div variants={fadeInUp} transition={defaultTransition}>
          {campaigns.length === 0 ? (
            <div className="outreach-placeholder" style={{ marginTop: '1rem' }}>
              <h3>No campaigns yet</h3>
              <p>Create your first outbound campaign to start sending personalized messages to your leads.</p>
              <div style={{ marginTop: '1rem' }}><Button variant="primary" onClick={() => { resetForm(); setTab('create'); }}>Create Campaign</Button></div>
            </div>
          ) : (
            <div className="campaign-list">
              {campaigns.map(c => (
                <div key={c.id} className="campaign-card" onClick={() => viewCampaign(c)}>
                  <div className="campaign-card-header">
                    <div>
                      <strong>{c.name}</strong>
                      <span className="campaign-channel-badge">{c.channel.toUpperCase()}</span>
                      {statusBadge(c.status)}
                      {c.scheduleType === 'scheduled' && <span className="campaign-channel-badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>Scheduled</span>}
                    </div>
                    <span className="campaign-date">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="campaign-card-stats">
                    <span>{c.stats.leadsInCampaign} leads</span>
                    <span>{c.stats.sentCount} sent</span>
                    <span>{c.stats.replyCount} replies</span>
                    <span>{c.stats.failedCount} failed</span>
                    <span>{c.followUpSteps.length} step(s)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === 'create' && (
        <motion.div variants={fadeInUp} transition={defaultTransition}>
          <div className="card" style={{ padding: '2rem', maxWidth: '800px' }}>
            {campaignError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{campaignError}</div>}

            <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>Create Campaign</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Campaign Name</label>
                <input className="input" placeholder="e.g., February Website Outreach" value={formName} onChange={e => setFormName(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Channel</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['email', 'whatsapp', 'sms'] as const).map(ch => (
                    <button key={ch} className={`campaign-channel-btn ${formChannel === ch ? 'active' : ''}`} onClick={() => setFormChannel(ch)}>
                      {ch.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Recipients</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {(['all', 'stage', 'filter'] as const).map(r => (
                    <button key={r} className={`campaign-channel-btn ${formRecipients === r ? 'active' : ''}`} onClick={() => setFormRecipients(r)}>
                      {r === 'all' ? 'All Leads' : r === 'stage' ? 'Pipeline Stage' : 'Select Manually'}
                    </button>
                  ))}
                </div>
                {formRecipients === 'stage' && (
                  <select className="input" value={formStage} onChange={e => setFormStage(e.target.value)}>
                    {['new', 'contacted', 'qualified', 'closed'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                )}
                {formRecipients === 'filter' && (
                  <div>
                    <input type="text" className="input" placeholder="Search leads..." value={leadSearch} onChange={e => setLeadSearch(e.target.value)} style={{ marginBottom: '0.5rem' }} />
                    <div className="campaign-lead-picker">
                      {filteredLeads.slice(0, 20).map(l => {
                        const url = l.google_maps_url || '';
                        const isSelected = selectedLeadUrls.has(url);
                        return (
                          <label key={url} className={`campaign-pick-item ${isSelected ? 'selected' : ''}`}>
                            <input type="checkbox" checked={isSelected} onChange={() => {
                              const next = new Set(selectedLeadUrls);
                              isSelected ? next.delete(url) : next.add(url);
                              setSelectedLeadUrls(next);
                            }} />
                            <span>{l.business_name} <small>{l.city || ''}</small></span>
                          </label>
                        );
                      })}
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{selectedLeadUrls.size} selected</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Schedule</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {(['immediate', 'scheduled'] as const).map(s => (
                    <button key={s} className={`campaign-channel-btn ${formScheduleType === s ? 'active' : ''}`} onClick={() => setFormScheduleType(s)}>
                      {s === 'immediate' ? 'Start Now' : 'Schedule for Later'}
                    </button>
                  ))}
                </div>
                {formScheduleType === 'scheduled' && (
                  <input type="datetime-local" className="input" value={formScheduleDate} onChange={e => setFormScheduleDate(e.target.value)} />
                )}
              </div>

              <div className="form-group">
                <label>{formChannel === 'email' ? 'Subject Template' : 'Message Template'}</label>
                {formChannel === 'email' && (
                  <input type="text" className="input" placeholder="Subject: Introduction to {{business_name}}" value={formSubject} onChange={e => setFormSubject(e.target.value)} />
                )}
                <label style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Message body. Use {'{{business_name}}'}, {'{{category}}'}, {'{{city}}'} as placeholders.
                </label>
                <textarea className="input campaign-msg-input" rows={4} placeholder="Hi {{business_name}}, ..." value={formMessage} onChange={e => setFormMessage(e.target.value)} />
                <div style={{ marginTop: '0.5rem' }}>
                  <Button size="sm" variant="secondary" onClick={() => handleSendTest(formChannel)} disabled={sendingInProgress}>
                    {sendingInProgress ? 'Sending...' : 'Send Test Message'}
                  </Button>
                </div>
              </div>

              <div className="form-group">
                <label>Follow-Up Sequence</label>
                <div className="campaign-followup-list">
                  {formFollowUpSteps.map((step, i) => (
                    <div key={i} className="campaign-followup-step">
                      <div className="followup-header">
                        <strong>Step {i + 1}</strong>
                        <span>Day {step.dayOffset}</span>
                        <button className="campaign-remove-step" onClick={() => setFormFollowUpSteps(prev => prev.filter((_, j) => j !== i))} disabled={formFollowUpSteps.length <= 1}>✕</button>
                      </div>
                      {step.subjectTemplate && <input type="text" className="input" placeholder="Subject" value={step.subjectTemplate} onChange={e => {
                        const next = [...formFollowUpSteps];
                        next[i] = { ...next[i], subjectTemplate: e.target.value };
                        setFormFollowUpSteps(next);
                      }} />}
                      <textarea className="input" rows={2} placeholder="Message..." value={step.messageTemplate} onChange={e => {
                        const next = [...formFollowUpSteps];
                        next[i] = { ...next[i], messageTemplate: e.target.value };
                        setFormFollowUpSteps(next);
                      }} />
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setFormFollowUpSteps(prev => [...prev, { dayOffset: prev.length > 0 ? prev[prev.length - 1].dayOffset + 3 : 3, messageTemplate: prev.length > 0 ? prev[prev.length - 1].messageTemplate : '{{business_name}} - follow up', stepIndex: prev.length }])}>
                    + Add Step
                  </Button>
                </div>
              </div>

              <div className="btn-actions">
                <Button variant="ghost" onClick={() => setTab('list')}>Cancel</Button>
                <Button variant="primary" onClick={handleCreateCampaign} disabled={creating}>
                  {creating ? 'Creating...' : 'Launch Campaign'}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {tab === 'detail' && detailCampaign && (
        <motion.div variants={fadeInUp} transition={defaultTransition}>
          <div className="campaign-detail">
            <div className="campaign-detail-header">
              <div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{detailCampaign.name}</h3>
                {statusBadge(detailCampaign.status)}
                <span className="campaign-channel-badge" style={{ marginLeft: '0.5rem' }}>{detailCampaign.channel.toUpperCase()}</span>
                {detailCampaign.scheduleType === 'scheduled' && detailCampaign.scheduledAt && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                    Scheduled: {new Date(detailCampaign.scheduledAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button size="sm" variant="danger" onClick={() => handleDeleteCampaign(detailCampaign.id)}>Delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setTab('list')}>Back</Button>
              </div>
            </div>

            <div className="campaign-analytics">
              {ledgers[detailCampaign.id] ? (() => {
                const stats = calculateStats(detailCampaign, ledgers[detailCampaign.id]);
                return (
                  <>
                    <div className="stat-item"><span className="stat-value">{stats.leadsInCampaign}</span><span className="stat-label">Leads</span></div>
                    <div className="stat-divider" />
                    <div className="stat-item"><span className="stat-value">{stats.sentCount}</span><span className="stat-label">Sent</span></div>
                    <div className="stat-divider" />
                    <div className="stat-item"><span className="stat-value" style={{ color: stats.failedCount > 0 ? 'var(--color-danger)' : undefined }}>{stats.failedCount}</span><span className="stat-label">Failed</span></div>
                    <div className="stat-divider" />
                    <div className="stat-item"><span className="stat-value" style={{ color: stats.replyCount > 0 ? 'var(--color-success)' : undefined }}>{stats.replyCount}</span><span className="stat-label">Replies</span></div>
                    <div className="stat-divider" />
                    <div className="stat-item"><span className="stat-value">{stats.followUpsCompleted}/{stats.followUpsTotal}</span><span className="stat-label">Steps Done</span></div>
                  </>
                );
              })() : <div className="spinner" style={{ margin: '1rem auto' }} />}
            </div>

            <div className="campaign-ledger-table-wrapper">
              <h3 style={{ marginBottom: '0.75rem' }}>Send Log</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Step</th>
                    <th>Status</th>
                    <th>Sent At</th>
                    <th>Error</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(ledgers[detailCampaign.id] || []).map(e => {
                    const lead = leads.find(l => l.google_maps_url === e.leadUrl);
                    return (
                      <tr key={e.id}>
                        <td className="td-name">{lead?.business_name || e.leadUrl.slice(0, 20)}</td>
                        <td>{e.stepIndex + 1}</td>
                        <td>{statusBadge(e.status)}</td>
                        <td style={{ fontSize: '0.75rem' }}>{e.sentAt ? new Date(e.sentAt).toLocaleString() : '-'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--color-danger)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.errorMessage || '-'}</td>
                        <td>
                          {e.status === 'sent' && (
                            <Button size="sm" variant="ghost" onClick={() => handleMarkReplied(e.id, detailCampaign.id)}>Mark Replied</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Follow-Up Steps</h3>
              <div className="campaign-followup-list">
                {detailCampaign.followUpSteps.map((s, i) => (
                  <div key={i} className="campaign-followup-step">
                    <div className="followup-header">
                      <strong>Step {i + 1}</strong> — <span>Day {s.dayOffset}</span>
                    </div>
                    {s.subjectTemplate && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Subject: {s.subjectTemplate}</p>}
                    <p className="outreach-body-text" style={{ fontSize: '0.85rem' }}>{s.messageTemplate}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};