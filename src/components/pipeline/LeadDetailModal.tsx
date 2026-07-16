import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lead, OutreachMessages, PipelineStage, PipelineStageEntry, LeadNote, LeadAttachment, FollowUp, OpportunityGap, DealValueBreakdown, ConversionFactor } from '@/types';
import { Button, PIPELINE_STAGES, STAGE_LABELS, PipelineStageBadge } from '@/components/ui';
import { GapIndicator } from './GapIndicator';
import { ValueBreakdown } from './ValueBreakdown';
import { ConversionFactors } from './ConversionFactors';
import { generateAIScores } from '@/utils/scoring';
import { analyzeWebsite } from '@/utils/website-intelligence';
import { OUTREACH_CHANNELS, ChannelSpec } from '@/utils/outreach-generator';
import { apiRequest } from '@/utils/api-request';
import { getSettings } from '@/hooks/useSettingsStore';
import { getLeadNotes, saveLeadNote, deleteLeadNote, getLeadAttachments, saveLeadAttachment, deleteLeadAttachment, getLeadFollowUps, saveLeadFollowUp, deleteLeadFollowUp, generateId } from '@/db';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', ];

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
  onSave: (updates: Partial<Lead>) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'history' | 'notes' | 'attachments' | 'followups' | 'website'>('edit');

  // ---- Tab: Edit ----
  const [formData, setFormData] = useState({
    phone: lead.phone || lead.phone_number || '',
    website: lead.website || '',
    linkedin: lead.linkedin || '',
    facebook: lead.facebook || '',
    instagram: lead.instagram || '',
    tiktok: lead.tiktok || '',
    youtube: lead.youtube || '',
    emails: lead.emails?.join(', ') || '',
    additional_phones: lead.additional_phones?.join(', ') || '',
  });

  const [scores, setScores] = useState({
    ai_score: lead.ai_score,
    classification: lead.classification,
    opportunity_score: lead.opportunity_score,
    competition_score: lead.competition_score,
    growth_score: lead.growth_score,
    seo_weakness: lead.seo_weakness,
    website_quality: lead.website_quality,
    review_reputation: lead.review_reputation,
  });

  const [enrichment, setEnrichment] = useState({
    business_size: lead.business_size,
    revenue_estimation: lead.revenue_estimation,
    industry_classification: lead.industry_classification,
    generated_description: lead.generated_description,
  });

  const [opportunity, setOpportunity] = useState<{
    gaps: OpportunityGap[];
    service: string;
    details: string;
    value: number | null;
    breakdown: DealValueBreakdown | undefined;
    probability: number | null;
    factors: ConversionFactor[] | undefined;
    confidence: 'high' | 'medium' | 'low' | null;
  }>({
    gaps: lead.opportunity_gaps || [],
    service: lead.recommended_service || '',
    details: lead.recommended_service_details || '',
    value: lead.estimated_deal_value ?? null,
    breakdown: lead.deal_value_breakdown,
    probability: lead.conversion_probability ?? null,
    factors: lead.conversion_factors,
    confidence: lead.opportunity_confidence ?? null,
  });

  const [loadingOpportunity, setLoadingOpportunity] = useState(false);
  const [loadingEnrichment, setLoadingEnrichment] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);

  // ---- Tab: Website Analysis ----
  const [websiteIntel, setWebsiteIntel] = useState(lead.website_intelligence || null);
  const [loadingWebsiteIntel, setLoadingWebsiteIntel] = useState(false);
  const [websiteIntelError, setWebsiteIntelError] = useState<string | null>(null);
  const [outreachMsgs, setOutreachMsgs] = useState<OutreachMessages | null>(lead.outreach_messages || null);
  const [loadingOutreach, setLoadingOutreach] = useState(false);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [editingOutreachKey, setEditingOutreachKey] = useState<string | null>(null);
  const [editOutreachText, setEditOutreachText] = useState('');
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ---- Tab: Stage History ----
  const [stageHistory, setStageHistory] = useState<PipelineStageEntry[]>([]);

  // ---- Tab: Notes ----
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);

  // ---- Tab: Attachments ----
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmDeleteAttId, setConfirmDeleteAttId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Tab: Follow-ups ----
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [newFollowUpTime, setNewFollowUpTime] = useState('');
  const [newFollowUpNote, setNewFollowUpNote] = useState('');

  const leadUrl = lead.google_maps_url || '';

  useEffect(() => {
    if (!leadUrl) return;
    // Stage history
    const raw = lead._stageHistory;
    if (Array.isArray(raw)) {
      setStageHistory(raw as PipelineStageEntry[]);
    }
    // Notes
    getLeadNotes(leadUrl).then(setNotes);
    // Attachments
    getLeadAttachments(leadUrl).then(setAttachments);
    // Follow-ups
    getLeadFollowUps(leadUrl).then(setFollowUps);
  }, [leadUrl]);

  // ---- Edit Actions ----
  const handleRunAI = () => {
    const newScores = generateAIScores(lead);
    setScores(newScores as any);
  };

  const handleRunEnrichment = async () => {
    setLoadingEnrichment(true);
    setEnrichmentError(null);
    try {
      const res = await apiRequest(`/api/leads/${lead._serverId}/enrichment?force=true`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) {
        setEnrichmentError(json.error || 'Enrichment failed');
      } else if (json.data) {
        setEnrichment({
          business_size: json.data.business_size,
          revenue_estimation: json.data.revenue_estimation,
          industry_classification: json.data.industry_classification,
          generated_description: json.data.generated_description,
        });
        setFormData(prev => ({
          ...prev,
          linkedin: prev.linkedin || json.data.linkedin || '',
          facebook: prev.facebook || json.data.facebook || '',
          instagram: prev.instagram || json.data.instagram || '',
          tiktok: prev.tiktok || json.data.tiktok || '',
          youtube: prev.youtube || json.data.youtube || '',
          emails: prev.emails || json.data.emails?.join(', ') || '',
          additional_phones: prev.additional_phones || json.data.additional_phones?.join(', ') || '',
        }));
        if (json.data.enrichment_status === 'failed') {
          setEnrichmentError('Enrichment completed but found no data');
        }
      }
    } catch (err) {
      setEnrichmentError('Enrichment error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingEnrichment(false);
    }
  };

  // ---- Website Analysis ----
  const handleAnalyzeWebsite = async () => {
    if (!lead.website) {
      setWebsiteIntelError('No website URL available for this lead');
      return;
    }
    setLoadingWebsiteIntel(true);
    setWebsiteIntelError(null);
    try {
      const result = await analyzeWebsite(lead.website);
      setWebsiteIntel(result);
    } catch (err) {
      setWebsiteIntelError('Analysis error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingWebsiteIntel(false);
    }
  };

  const handleRunOpportunity = async () => {
    setLoadingOpportunity(true);
    try {
      const res = await apiRequest(`/api/leads/${lead._serverId}/opportunity`, { method: 'POST' });
      const json = await res.json();
      if (json.ok && json.data) {
        setOpportunity({
          gaps: json.data.gaps || [],
          service: json.data.service || '',
          details: json.data.details || '',
          value: json.data.value ?? null,
          breakdown: json.data.breakdown,
          probability: json.data.probability != null ? json.data.probability * 100 : null,
          factors: json.data.factors,
          confidence: json.data.confidence || null,
        });
      }
    } catch (err) {
      console.error('Opportunity analysis error:', err);
    } finally {
      setLoadingOpportunity(false);
    }
  };

  function getAiConfig() {
    const s = getSettings();
    let provider = s.aiProvider;
    let model = s.aiModel;
    let apiKey = '';
    let apiBase: string | undefined;
    if (provider === 'gemini') { apiKey = s.geminiApiKey; }
    else if (provider === 'openai') { apiKey = s.openAiKey; }
    else if (provider === 'openrouter') { apiKey = s.openrouterApiKey; }
    else if (provider === 'groq') { apiKey = s.groqApiKey; }
    else if (provider === 'anthropic') { apiKey = s.anthropicApiKey; }
    else if (provider === 'mistral') { apiKey = s.mistralApiKey; }
    else if (provider === 'cohere') { apiKey = s.cohereApiKey; }
    else if (provider === 'custom') { apiKey = s.customApiKey; model = s.customModel; apiBase = s.customApiBase; }
    return { provider, model, apiKey, apiBase };
  }

  const handleGenerateOutreach = async () => {
    setLoadingOutreach(true);
    setOutreachError(null);
    try {
      const aiConfig = getAiConfig();
      const res = await apiRequest(`/api/leads/${lead._serverId}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'all', ...aiConfig }),
      });
      const json = await res.json();
      if (json.ok && json.messages) {
        setOutreachMsgs({
          ...json.messages,
          generatedAt: new Date().toISOString(),
        });
      } else {
        setOutreachError(json.error || 'Failed. Check API key in Settings.');
      }
    } catch (err) {
      setOutreachError('Unexpected error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setLoadingOutreach(false);
    }
  };

  const handleRegenerateSingle = async (spec: ChannelSpec) => {
    setRegeneratingKey(spec.key);
    try {
      const aiConfig = getAiConfig();
      const res = await apiRequest(`/api/leads/${lead._serverId}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: spec.key, ...aiConfig }),
      });
      const json = await res.json();
      if (json.ok && json.messages) {
        setOutreachMsgs(prev => ({
          ...json.messages,
          generatedAt: new Date().toISOString(),
        }));
      } else {
        setOutreachError(json.error || 'Regeneration failed');
      }
    } finally {
      setRegeneratingKey(null);
    }
  };

  const startEditOutreach = (key: string, msg: any) => {
    setEditingOutreachKey(key);
    setEditOutreachText(msg.subject ? `Subject: ${msg.subject}\n\n${msg.body}` : msg.body);
  };

  const saveEditOutreach = (key: string) => {
    if (!outreachMsgs) return;
    let subject: string | undefined;
    let body = editOutreachText;
    if (key === 'email') {
      const sm = editOutreachText.match(/^Subject:\s*(.+?)(?:\n|$)/i);
      if (sm) { subject = sm[1].trim(); body = editOutreachText.replace(/^Subject:\s*.+?(?:\n|$)/, '').trim(); }
    }
    const updated = { ...outreachMsgs, [key]: { subject, body, edited: true }, generatedAt: new Date().toISOString() };
    setOutreachMsgs(updated);
    setEditingOutreachKey(null);
    setEditOutreachText('');
  };

  const cancelEditOutreach = () => {
    setEditingOutreachKey(null);
    setEditOutreachText('');
  };

  const copyOutreachMsg = async (msg: any) => {
    const text = msg.subject ? `Subject: ${msg.subject}\n\n${msg.body}` : msg.body;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(msg.body.slice(0, 20));
      setTimeout(() => setCopiedKey(null), 2000);
    } catch { setOutreachError('Failed to copy to clipboard'); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ---- Notes Actions ----
  const handleAddNote = async () => {
    if (!newNoteText.trim() || !leadUrl) return;
    const note: LeadNote = { id: generateId(), leadUrl, text: newNoteText.trim(), createdAt: new Date().toISOString() };
    await saveLeadNote(note);
    setNotes(prev => [note, ...prev]);
    setNewNoteText('');
  };

  const handleDeleteNote = async (id: string) => {
    await deleteLeadNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    setConfirmDeleteNoteId(null);
  };

  // ---- Attachments Actions ----
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file || !leadUrl) return;
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      setUploadError(`Invalid file type: ${file.type || 'unknown'}. Allowed: PDF, PNG, JPG, GIF, DOC, DOCX, XLS, XLSX, TXT.`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setUploadError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max 10MB.`);
      return;
    }
    const data = await fileToBase64(file);
    const attachment: LeadAttachment = {
      id: generateId(),
      leadUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      data,
      uploadedAt: new Date().toISOString(),
    };
    await saveLeadAttachment(attachment);
    setAttachments(prev => [...prev, attachment]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteAttachment = async (id: string) => {
    await deleteLeadAttachment(id);
    setAttachments(prev => prev.filter(a => a.id !== id));
    setConfirmDeleteAttId(null);
  };

  const handleDownloadAttachment = (att: LeadAttachment) => {
    const a = document.createElement('a');
    a.href = att.data;
    a.download = att.fileName;
    a.click();
  };

  // ---- Follow-Up Actions ----
  const handleAddFollowUp = async () => {
    if (!newFollowUpDate || !leadUrl) return;
    const dueAt = newFollowUpTime ? `${newFollowUpDate}T${newFollowUpTime}` : `${newFollowUpDate}T12:00:00`;
    const fu: FollowUp = {
      id: generateId(),
      leadUrl,
      dueAt: new Date(dueAt).toISOString(),
      note: newFollowUpNote.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    await saveLeadFollowUp(fu);
    setFollowUps(prev => [...prev, fu]);
    setNewFollowUpDate('');
    setNewFollowUpTime('');
    setNewFollowUpNote('');
  };

  const handleDeleteFollowUp = async (id: string) => {
    await deleteLeadFollowUp(id);
    setFollowUps(prev => prev.filter(f => f.id !== id));
  };

  const handleToggleFollowUp = async (id: string) => {
    const fu = followUps.find(f => f.id === id);
    if (!fu) return;
    fu.completed = !fu.completed;
    await saveLeadFollowUp(fu);
    setFollowUps(prev => prev.map(f => f.id === id ? fu : f));
  };

  // ---- Save ----
  const handleSubmit = () => {
    onSave({
      ...formData,
      ...scores,
      ...enrichment,
      website_intelligence: websiteIntel || undefined,
      opportunity_gaps: opportunity.gaps || undefined,
      recommended_service: opportunity.service || undefined,
      recommended_service_details: opportunity.details || undefined,
      estimated_deal_value: opportunity.value ?? undefined,
      deal_value_breakdown: opportunity.breakdown,
      conversion_probability: opportunity.probability ?? undefined,
      conversion_factors: opportunity.factors,
      opportunity_confidence: opportunity.confidence || undefined,
      outreach_messages: outreachMsgs || undefined,
      emails: formData.emails.split(',').map(s => s.trim()).filter(Boolean),
      additional_phones: formData.additional_phones.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  const currentStage = (lead._stage as PipelineStage) || 'new';
  const isTerminal = currentStage === 'won' || currentStage === 'lost';

  const tabLabels = [
    { key: 'edit' as const, label: 'Edit & AI' },
    { key: 'website' as const, label: 'Website' },
    { key: 'history' as const, label: 'History' },
    { key: 'notes' as const, label: `Notes (${notes.length})` },
    { key: 'attachments' as const, label: `Files (${attachments.length})` },
    { key: 'followups' as const, label: `Follow-ups (${followUps.filter(f => !f.completed).length})` },
  ];

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose}>
        <motion.div
          className="modal-container lead-modal lead-modal-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem' }}>{lead.business_name}</h2>
              <PipelineStageBadge stage={currentStage} />
              <span style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>|</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{lead.category || '—'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{lead.city || ''}</span>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>
          </div>

          <div className="modal-tabs">
            {tabLabels.map(t => (
              <button key={t.key} className={`modal-tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="modal-body">
            {activeTab === 'edit' && (
              <div className="lead-grid">
                <div className="lead-col">
                  <h3>AI Scoring & Analysis</h3>
                  <div className="score-panel">
                    <div className="score-row"><span>Overall AI Score:</span><strong>{scores.ai_score != null ? scores.ai_score + '/100' : 'N/A'}</strong></div>
                    <div className="score-row"><span>Opportunity:</span><span>{scores.opportunity_score != null ? scores.opportunity_score : 'N/A'}</span></div>
                    <div className="score-row"><span>Competition:</span><span>{scores.competition_score != null ? scores.competition_score : 'N/A'}</span></div>
                    <div className="score-row"><span>Growth Potential:</span><span>{scores.growth_score != null ? scores.growth_score : 'N/A'}</span></div>
                    <div className="score-row"><span>SEO Weakness:</span><span>{scores.seo_weakness != null ? scores.seo_weakness : 'N/A'}</span></div>
                    <div className="score-row"><span>Website Quality:</span><span>{scores.website_quality != null ? scores.website_quality : 'N/A'}</span></div>
                    <div className="score-row"><span>Review Reputation:</span><span>{scores.review_reputation != null ? scores.review_reputation : 'N/A'}</span></div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Based on real lead data (fields + reviews)</span>
                  </div>
                  <Button size="sm" onClick={handleRunAI}>Generate AI Scores</Button>

                  <h3 style={{ marginTop: '2rem' }}>AI Enrichment</h3>
                  <div className="enrichment-panel">
                    {loadingEnrichment ? (
                      <div className="opportunity-loading"><span className="spinner" style={{ display: 'inline-block', marginRight: '0.5rem' }} />Enriching...</div>
                    ) : (
                      <>
                        <p><strong>Size:</strong> {enrichment.business_size || '—'}</p>
                        <p><strong>Revenue:</strong> {enrichment.revenue_estimation || '—'}</p>
                        <p><strong>Industry:</strong> {enrichment.industry_classification || '—'}</p>
                        <p><strong>AI Summary:</strong> {enrichment.generated_description || '—'}</p>
                        {lead.enrichment_status && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
                            Status: {lead.enrichment_status}
                            {lead.enrichment_confidence && ` · Confidence: ${lead.enrichment_confidence}`}
                            {lead.enrichment_last_run && ` · Last run: ${new Date(lead.enrichment_last_run).toLocaleDateString()}`}
                          </p>
                        )}
                      </>
                    )}
                    {enrichmentError && <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.3rem' }}>{enrichmentError}</p>}
                  </div>
                  <Button size="sm" variant="secondary" onClick={handleRunEnrichment} disabled={loadingEnrichment}>{loadingEnrichment ? 'Enriching...' : (lead.enrichment_status === 'enriched' ? 'Re-run Enrichment' : 'Run Enrichment')}</Button>

                  <h3 style={{ marginTop: '2rem' }}>Opportunity Analysis</h3>
                  <div className="opportunity-panel">
                    {opportunity.gaps?.length ? (
                      <>
                        <div className="opportunity-gaps-list">{opportunity.gaps.map((gap, i) => <GapIndicator key={i} gap={gap} />)}</div>
                        <div className="opportunity-divider" />
                        {opportunity.service && <div className="opportunity-section"><p className="opportunity-section-label">Recommended Service</p><p className="opportunity-service-name">{opportunity.service}</p><p className="opportunity-detail">{opportunity.details}</p></div>}
                        <div className="opportunity-divider" />
                        {opportunity.value !== null && <div className="opportunity-section"><p className="opportunity-section-label">Estimated Deal Value</p><p className="opportunity-value">${opportunity.value.toLocaleString()}</p><details className="opportunity-details-toggle"><summary>Show calculation</summary><ValueBreakdown breakdown={opportunity.breakdown} /></details></div>}
                        <div className="opportunity-divider" />
                        {opportunity.probability !== null && <div className="opportunity-section"><p className="opportunity-section-label">Conversion Probability</p><div className="probability-bar-container"><div className="probability-bar-fill" style={{ width: opportunity.probability + '%', background: opportunity.probability >= 70 ? 'var(--color-success)' : opportunity.probability >= 40 ? 'var(--color-warning)' : 'var(--color-danger)' }} /></div><p className="opportunity-probability">{opportunity.probability}%</p><details className="opportunity-details-toggle"><summary>Show factors ({opportunity.factors?.length || 0})</summary><ConversionFactors factors={opportunity.factors} /></details></div>}
                      </>
                    ) : <div className="opportunity-empty"><p>Click "Run Opportunity Analysis" to detect gaps.</p></div>}
                    {loadingOpportunity && <div className="opportunity-loading"><span className="spinner" style={{ display: 'inline-block', marginRight: '0.5rem' }} />Analyzing lead data...</div>}
                  </div>
                  <Button size="sm" variant="primary" onClick={handleRunOpportunity} disabled={loadingOpportunity}>{loadingOpportunity ? 'Analyzing...' : 'Run Opportunity Analysis'}</Button>

                  <h3 style={{ marginTop: '2rem' }}>Outreach Messages</h3>
                  <div className="opportunity-panel">
                    {outreachError && <div className="alert alert-error" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>{outreachError}</div>}
                    {outreachMsgs ? (
                      <div className="outreach-card-list">
                        {OUTREACH_CHANNELS.map(spec => {
                          const msg = outreachMsgs[spec.key];
                          const isEditing = editingOutreachKey === spec.key;
                          const isRegenerating = regeneratingKey === spec.key;
                          return (
                            <div key={spec.key} className="outreach-card-mini">
                              <div className="outreach-card-mini-header">
                                <strong>{spec.label}</strong>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  {isEditing ? null : (
                                  <>
                                    <button className="outreach-mini-btn" onClick={() => startEditOutreach(spec.key, msg)} title="Edit">✎</button>
                                    <button className="outreach-mini-btn" onClick={() => handleRegenerateSingle(spec)} disabled={isRegenerating} title="Regenerate">{isRegenerating ? '⟳' : '↻'}</button>
                                    <button className="outreach-mini-btn" onClick={() => copyOutreachMsg(msg)} title="Copy">{copiedKey === msg.body.slice(0, 20) ? '✓' : '⎘'}</button>
                                  </>
                                  )}
                                </div>
                              </div>
                              {isEditing ? (
                                <div className="outreach-edit-inline">
                                  {spec.key === 'email' && <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Start with "Subject: ..." then blank line, then body.</label>}
                                  <textarea className="input" style={{ minHeight: '100px', fontSize: '0.78rem', resize: 'vertical' }} value={editOutreachText} onChange={e => setEditOutreachText(e.target.value)} />
                                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.3rem' }}><Button size="sm" onClick={() => saveEditOutreach(spec.key)}>Save</Button><Button size="sm" variant="ghost" onClick={cancelEditOutreach}>Cancel</Button></div>
                                </div>
                              ) : (
                                <div className="outreach-msg-preview">
                                  {msg.subject && <p className="outreach-preview-subject"><strong>Subject:</strong> {msg.subject}</p>}
                                  <pre className="outreach-preview-body">{msg.body.slice(0, 200)}{msg.body.length > 200 ? '...' : ''}</pre>
                                  {msg.edited && <span className="outreach-edited-badge">Edited</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {outreachMsgs.generatedAt && <p className="outreach-timestamp">Generated {new Date(outreachMsgs.generatedAt).toLocaleString()}</p>}
                      </div>
                    ) : <div className="opportunity-empty"><p>Generate personalized outreach messages.</p></div>}
                    {loadingOutreach && <div className="opportunity-loading"><span className="spinner" style={{ display: 'inline-block', marginRight: '0.5rem' }} />Generating messages...</div>}
                  </div>
                  <Button size="sm" variant="primary" onClick={handleGenerateOutreach} disabled={loadingOutreach}>{loadingOutreach ? 'Generating...' : outreachMsgs ? 'Regenerate All' : 'Generate Outreach'}</Button>
                </div>

                <div className="lead-col">
                  <h3>Contact & Socials</h3>
                  <div className="form-group"><label>Phone Number</label><input type="text" name="phone" className="input" value={formData.phone} onChange={handleChange} /></div>
                  <div className="form-group"><label>Website</label><input type="text" name="website" className="input" value={formData.website} onChange={handleChange} /></div>
                  <div className="form-group"><label>LinkedIn</label><input type="text" name="linkedin" className="input" value={formData.linkedin} onChange={handleChange} /></div>
                  <div className="form-group"><label>Facebook</label><input type="text" name="facebook" className="input" value={formData.facebook} onChange={handleChange} /></div>
                  <div className="form-group"><label>Instagram</label><input type="text" name="instagram" className="input" value={formData.instagram} onChange={handleChange} /></div>
                  <div className="form-group"><label>TikTok</label><input type="text" name="tiktok" className="input" value={formData.tiktok} onChange={handleChange} /></div>
                  <div className="form-group"><label>YouTube</label><input type="text" name="youtube" className="input" value={formData.youtube} onChange={handleChange} /></div>
                  <div className="form-group"><label>Emails (comma separated)</label><input type="text" name="emails" className="input" value={formData.emails} onChange={handleChange} /></div>
                  <div className="form-group"><label>Additional Phones</label><input type="text" name="additional_phones" className="input" value={formData.additional_phones} onChange={handleChange} /></div>
                </div>
              </div>
            )}

            {activeTab === 'website' && (
              <div className="pipeline-history-tab">
                <div className="opportunity-panel">
                  {!lead.website && (
                    <div className="opportunity-empty"><p>No website URL available for this lead.</p></div>
                  )}
                  {lead.website && (
                    <>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <p style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}><strong>Website:</strong> <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-light)' }}>{lead.website}</a></p>
                        {websiteIntel && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Last analyzed: {new Date(websiteIntel.analyzedAt).toLocaleString()}</p>
                        )}
                      </div>

                      {websiteIntelError && <div className="alert alert-error" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>{websiteIntelError}</div>}

                      {loadingWebsiteIntel ? (
                        <div className="opportunity-loading"><span className="spinner" style={{ display: 'inline-block', marginRight: '0.5rem' }} />Analyzing website...</div>
                      ) : websiteIntel ? (
                        <div className="enrichment-panel" style={{ fontSize: '0.78rem', lineHeight: '1.5' }}>
                          <h4 style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>Status</h4>
                          <p>Reachable: {websiteIntel.reachable ? '✓' : '✕'}{websiteIntel.error ? ` — ${websiteIntel.error}` : ''}</p>
                          <p>SSL: {websiteIntel.isHttps ? '✓ HTTPS' : '✕ HTTP'}{websiteIntel.sslDetails ? ` (${websiteIntel.sslDetails})` : ''}</p>
                          <p>Status code: {websiteIntel.statusCode || '—'}</p>
                          <p>Mobile viewport: {websiteIntel.hasViewportMeta ? '✓ Detected' : '✕ Missing'}</p>

                          <h4 style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.85rem' }}>Technologies</h4>
                          {websiteIntel.technologies.length === 0 ? <p>None detected</p> : (
                            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                              {websiteIntel.technologies.map((t, i) => (
                                <li key={i}>{t.name} <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>({t.category}, conf: {t.confidence})</span></li>
                              ))}
                            </ul>
                          )}

                          <h4 style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.85rem' }}>SEO Audit ({websiteIntel.seo.score}/100)</h4>
                          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                            <li style={{ color: websiteIntel.seo.hasTitle ? 'var(--color-success)' : 'var(--color-danger)' }}>{websiteIntel.seo.hasTitle ? '✓' : '✕'} Title tag{websiteIntel.seo.titleContent ? `: "${websiteIntel.seo.titleContent.slice(0, 60)}${websiteIntel.seo.titleContent.length > 60 ? '…' : ''}"` : ''}</li>
                            <li style={{ color: websiteIntel.seo.hasMetaDescription ? 'var(--color-success)' : 'var(--color-danger)' }}>{websiteIntel.seo.hasMetaDescription ? '✓' : '✕'} Meta description</li>
                            <li style={{ color: websiteIntel.seo.hasH1 ? 'var(--color-success)' : 'var(--color-danger)' }}>{websiteIntel.seo.hasH1 ? '✓' : '✕'} H1 tag{websiteIntel.seo.hasMultipleH1 ? ` (${websiteIntel.seo.headingStructure.h1} found — should be 1)` : ''}</li>
                            <li>H2: {websiteIntel.seo.headingStructure.h2}, H3: {websiteIntel.seo.headingStructure.h3}</li>
                            <li style={{ color: websiteIntel.seo.hasCanonical ? 'var(--color-success)' : 'var(--color-warning)' }}>{websiteIntel.seo.hasCanonical ? '✓' : '✕'} Canonical tag</li>
                            <li style={{ color: websiteIntel.seo.hasStructuredData ? 'var(--color-success)' : 'var(--color-warning)' }}>{websiteIntel.seo.hasStructuredData ? '✓' : '✕'} Structured data{websiteIntel.seo.structuredDataTypes.length > 0 ? ` (${websiteIntel.seo.structuredDataTypes.join(', ')})` : ''}</li>
                            <li style={{ color: websiteIntel.seo.missingAltCount > 5 ? 'var(--color-warning)' : 'var(--color-success)' }}>{websiteIntel.seo.missingAltCount} image(s) missing alt text</li>
                          </ul>

                          <h4 style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.85rem' }}>Performance ({websiteIntel.performance.score}/100)</h4>
                          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                            <li>Load time: {websiteIntel.performance.loadTimeMs}ms</li>
                            <li>Page size: {websiteIntel.performance.pageSizeFormatted}</li>
                            <li>Core Web Vitals: {websiteIntel.performance.coreWebVitals.source === 'unavailable' ? 'Not measured' : `LCP ~${websiteIntel.performance.coreWebVitals.lcp}ms, FCP ~${websiteIntel.performance.coreWebVitals.fcp}ms, TTI ~${websiteIntel.performance.coreWebVitals.tti}ms (estimated)`}</li>
                          </ul>

                          <h4 style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.85rem' }}>Tracking & Chat</h4>
                          <p>Analytics: {websiteIntel.hasAnalytics ? websiteIntel.analyticsFound.join(', ') : 'None detected'}</p>
                          <p>Chatbot: {websiteIntel.hasChatbot ? websiteIntel.chatbotFound.join(', ') : 'None detected'}</p>

                          {websiteIntel.improvementOpportunities.length > 0 && (
                            <>
                              <h4 style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.85rem' }}>Improvement Opportunities</h4>
                              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                                {websiteIntel.improvementOpportunities.map((o, i) => (
                                  <li key={i} style={{ color: 'var(--color-warning)' }}>{o}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="opportunity-empty"><p>Click "Analyze Website" to run a real fetch and audit.</p></div>
                      )}
                    </>
                  )}
                  {loadingWebsiteIntel ? null : websiteIntel ? (
                    <Button size="sm" variant="secondary" onClick={handleAnalyzeWebsite} style={{ marginTop: '0.75rem' }}>Re-analyze</Button>
                  ) : lead.website ? (
                    <Button size="sm" variant="primary" onClick={handleAnalyzeWebsite} style={{ marginTop: '0.75rem' }} disabled={loadingWebsiteIntel}>{loadingWebsiteIntel ? 'Analyzing...' : 'Analyze Website'}</Button>
                  ) : null}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="pipeline-history-tab">
                {lead._stageEnteredAt && (
                  <div className="history-meta">
                    <span className="history-label">Current stage since</span>
                    <span className="history-value">{new Date(lead._stageEnteredAt).toLocaleDateString()} {new Date(lead._stageEnteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                <h4 style={{ marginTop: '1rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Stage Timeline</h4>
                {stageHistory.length === 0 && (
                  <p className="history-empty">No stage changes recorded yet. Move this lead through the pipeline to build history.</p>
                )}
                <div className="history-timeline">
                  {stageHistory.map((entry, i) => (
                    <div key={i} className="history-entry">
                      <div className="history-dot" />
                      <div className="history-content">
                        <PipelineStageBadge stage={entry.stage} />
                        <span className="history-date">{new Date(entry.enteredAt).toLocaleDateString()} {new Date(entry.enteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="pipeline-notes-tab">
                <div className="notes-input-row">
                  <textarea className="input" rows={2} placeholder="Add a note about this lead..." value={newNoteText} onChange={e => setNewNoteText(e.target.value)} style={{ resize: 'vertical', minHeight: '50px' }} />
                  <Button size="sm" variant="primary" onClick={handleAddNote} disabled={!newNoteText.trim()}>Add Note</Button>
                </div>
                {notes.length === 0 ? (
                  <p className="history-empty" style={{ marginTop: '1rem' }}>No notes yet.</p>
                ) : (
                  <div className="notes-list">
                    {notes.map(n => (
                      <div key={n.id} className="note-item">
                        <div className="note-text">{n.text}</div>
                        <div className="note-meta">
                          <span className="note-date">{new Date(n.createdAt).toLocaleString()}</span>
                          {confirmDeleteNoteId === n.id ? (
                            <span className="note-confirm-delete">
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Delete this note?</span>
                              <button className="note-btn-confirm" onClick={() => handleDeleteNote(n.id)}>Yes</button>
                              <button className="note-btn-cancel" onClick={() => setConfirmDeleteNoteId(null)}>No</button>
                            </span>
                          ) : (
                            <button className="note-delete-btn" onClick={() => setConfirmDeleteNoteId(n.id)} title="Delete note">×</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>Notes are persisted in local database and survive page reload.</p>
              </div>
            )}

            {activeTab === 'attachments' && (
              <div className="pipeline-attachments-tab">
                <div className="attachments-input-row">
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                  <Button size="sm" variant="primary" onClick={() => fileInputRef.current?.click()}>Upload File</Button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>PDF, PNG, JPG, DOC, XLS, TXT (max 10MB)</span>
                </div>
                {uploadError && <div className="alert alert-error" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>{uploadError}</div>}
                {attachments.length === 0 ? (
                  <p className="history-empty" style={{ marginTop: '1rem' }}>No files attached.</p>
                ) : (
                  <div className="attachments-list">
                    {attachments.map(a => (
                      <div key={a.id} className="attachment-item">
                        <div className="attachment-info">
                          <span className="attachment-name">{a.fileName}</span>
                          <span className="attachment-size">{(a.fileSize / 1024).toFixed(0)}KB</span>
                        </div>
                        <div className="attachment-actions">
                          <Button size="sm" variant="ghost" onClick={() => handleDownloadAttachment(a)}>Download</Button>
                          {confirmDeleteAttId === a.id ? (
                            <span className="note-confirm-delete">
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Delete?</span>
                              <button className="note-btn-confirm" onClick={() => handleDeleteAttachment(a.id)}>Yes</button>
                              <button className="note-btn-cancel" onClick={() => setConfirmDeleteAttId(null)}>No</button>
                            </span>
                          ) : (
                            <Button size="sm" variant="danger" onClick={() => setConfirmDeleteAttId(a.id)}>Delete</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'followups' && (
              <div className="pipeline-followups-tab">
                <div className="followup-input-row">
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Date</label>
                    <input type="date" className="input" style={{ width: 'auto', flex: 1, minWidth: '130px' }} value={newFollowUpDate} onChange={e => setNewFollowUpDate(e.target.value)} />
                    <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Time</label>
                    <input type="time" className="input" style={{ width: 'auto', flex: 1, minWidth: '110px' }} value={newFollowUpTime} onChange={e => setNewFollowUpTime(e.target.value)} />
                  </div>
                  <textarea className="input" rows={2} placeholder="Follow-up note (optional)..." value={newFollowUpNote} onChange={e => setNewFollowUpNote(e.target.value)} style={{ resize: 'vertical', minHeight: '40px' }} />
                  <Button size="sm" variant="primary" onClick={handleAddFollowUp} disabled={!newFollowUpDate}>Set Follow-Up</Button>
                </div>
                {followUps.length === 0 ? (
                  <p className="history-empty" style={{ marginTop: '1rem' }}>No follow-ups scheduled.</p>
                ) : (
                  <div className="followups-list">
                    {followUps.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()).map(f => (
                      <div key={f.id} className={`followup-item ${f.completed ? 'completed' : new Date(f.dueAt).getTime() < Date.now() ? 'overdue' : 'upcoming'}`}>
                        <div className="followup-check">
                          <input type="checkbox" checked={f.completed} onChange={() => handleToggleFollowUp(f.id)} />
                        </div>
                        <div className="followup-info">
                          <span className="followup-date">{new Date(f.dueAt).toLocaleDateString()} {new Date(f.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {f.note && <span className="followup-note-text">{f.note}</span>}
                          {f.completed && <span className="followup-completed-badge">Done</span>}
                          {!f.completed && new Date(f.dueAt).getTime() < Date.now() && <span className="followup-overdue-badge">Overdue</span>}
                        </div>
                        <button className="followup-delete-btn" onClick={() => { if (window.confirm('Delete this follow-up?')) handleDeleteFollowUp(f.id); }} title="Delete">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>Overdue and upcoming follow-ups appear on the Pipeline board.</p>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <div className="modal-footer-left">
              {!isTerminal && (
                <div className="modal-stage-changer">
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginRight: '0.5rem' }}>Move to:</span>
                  {PIPELINE_STAGES.filter(s => s !== currentStage && s !== 'won' && s !== 'lost').map(s => (
                    <button key={s} className="pipeline-bulk-stage-btn" onClick={() => {
                      const history = [...(Array.isArray(lead._stageHistory) ? lead._stageHistory : []), { stage: currentStage, enteredAt: lead._stageEnteredAt || new Date().toISOString() } as PipelineStageEntry];
                      const reason = window.prompt(`Move "${lead.business_name}" to "${STAGE_LABELS[s]}"? Optional reason:`) || '';
                      onSave({ _stage: s, _stageHistory: history, _stageEnteredAt: new Date().toISOString(), _wonLostReason: reason || undefined } as Partial<Lead>);
                    }}>
                      <PipelineStageBadge stage={s} />
                    </button>
                  ))}
                </div>
              )}
              {currentStage !== 'won' && currentStage !== 'lost' && (
                <span style={{ marginLeft: '0.5rem', display: 'flex', gap: '0.25rem' }}>
                  <Button size="sm" variant="primary" onClick={() => {
                    if (!window.confirm(`Mark "${lead.business_name}" as Won? Please specify reason.`)) return;
                    const stage = [...(Array.isArray(lead._stageHistory) ? lead._stageHistory : []), { stage: currentStage, enteredAt: lead._stageEnteredAt || new Date().toISOString() } as PipelineStageEntry];
                    const reason = window.prompt('Why was this deal won?') || '';
                    onSave({ _stage: 'won', _stageHistory: stage, _stageEnteredAt: new Date().toISOString(), _wonLostReason: reason || undefined } as Partial<Lead>);
                  }}>✓ Won</Button>
                  <Button size="sm" variant="danger" onClick={() => {
                    if (!window.confirm(`Mark "${lead.business_name}" as Lost? This will close the deal.`)) return;
                    const stage = [...(Array.isArray(lead._stageHistory) ? lead._stageHistory : []), { stage: currentStage, enteredAt: lead._stageEnteredAt || new Date().toISOString() } as PipelineStageEntry];
                    const reason = window.prompt('Why was this deal lost? (Required)');
                    if (!reason) return;
                    onSave({ _stage: 'lost', _stageHistory: stage, _stageEnteredAt: new Date().toISOString(), _wonLostReason: reason } as Partial<Lead>);
                  }}>✕ Lost</Button>
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              {activeTab === 'edit' && <Button variant="primary" onClick={handleSubmit}>Save Changes</Button>}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}