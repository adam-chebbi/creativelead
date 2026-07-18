import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { Lead, PipelineStage, PipelineStageEntry, FollowUp } from '@/types';
import { useLeadsQuery, useLeadUpdateMutation } from '@/hooks';
import { Button, PipelineStageBadge, PIPELINE_STAGES, STAGE_LABELS, Badge, Spinner } from '@/components/ui';
import { aggregateSentiment, SENTIMENT_LABEL, SENTIMENT_COLOR } from '@/sentiment';
import { countRealReviews } from '@/utils/reviews';
import { formatRating } from '@/utils/format';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';
import { getAllFollowUps, markFollowUpCompleted } from '@/db';

const LeadDetailModal = lazy(() => import('../../components/pipeline/LeadDetailModal').then(m => ({ default: m.LeadDetailModal })));

export const PipelinePage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [showFollowUpsView, setShowFollowUpsView] = useState(false);
  const [dragLead, setDragLead] = useState<string | null>(null);

  const { data: leads = [], isLoading, isError, error, refetch } = useLeadsQuery();
  const updateLeadMutation = useLeadUpdateMutation();

  const handleUpdateLead = useCallback((id: string, data: Partial<Lead>) => {
    updateLeadMutation.mutate({ id, data });
  }, [updateLeadMutation]);

  const handleDeleteLead = useCallback(async (lead: Lead, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const serverId = lead._serverId || (lead.google_maps_url || '').replace('server:', '');
    if (!serverId) return;
    if (!window.confirm(`Delete "${lead.business_name}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/leads/${serverId}`, { method: 'DELETE' });
      refetch();
    } catch {
      console.error('Failed to delete lead');
    }
  }, [refetch]);

  const reloadFollowUps = useCallback(async () => {
    const all = await getAllFollowUps();
    setFollowUps(all);
  }, []);

  useEffect(() => { reloadFollowUps(); }, []);

  // Group leads by stage — memoized to avoid re-filtering on every render
  const grouped = useMemo(() => PIPELINE_STAGES.reduce((acc, s) => {
    const stageLeads = leads.filter(l => {
      const stage = (l._stage as PipelineStage) || 'new';
      return stage === s;
    });
    const filtered = search ? stageLeads.filter(l =>
      (l.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.city || '').toLowerCase().includes(search.toLowerCase())
    ) : stageLeads;
    acc[s] = filtered;
    return acc;
  }, {} as Record<PipelineStage, Lead[]>), [leads, search]);

  const pipelineValue = useMemo(() => leads.reduce((sum, l) => sum + (l.estimated_deal_value || 0), 0), [leads]);

  const followUpsByLead = useMemo(() => followUps.reduce((acc, f) => {
    if (!acc[f.leadUrl]) acc[f.leadUrl] = [];
    acc[f.leadUrl].push(f);
    return acc;
  }, {} as Record<string, FollowUp[]>), [followUps]);

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent, url: string) => {
    setDragLead(url);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    const url = e.dataTransfer.getData('text/plain');
    if (!url) return;
    const lead = leads.find(l => l.google_maps_url === url);
    if (!lead) return;
    const currentStage = (lead._stage as PipelineStage) || 'new';
    if (currentStage === targetStage) return;
    if (currentStage === 'won' || currentStage === 'lost') return;

    const stageEntry: PipelineStageEntry = { stage: currentStage, enteredAt: lead._stageEnteredAt || new Date().toISOString() };
    const history = Array.isArray(lead._stageHistory) ? [...lead._stageHistory, stageEntry] : [stageEntry];

    handleUpdateLead(url, { _stage: targetStage, _stageHistory: history, _stageEnteredAt: new Date().toISOString() } as Partial<Lead>);
    setDragLead(null);
    refetch();
  };

  const handleStageChangeInModal = async (updates: Partial<Lead>) => {
    const url = activeLead?.google_maps_url;
    if (!url) return;
    handleUpdateLead(url, updates);
    refetch();
    setActiveLead(null);
  };

  const now = useMemo(() => Date.now(), []);
  const overdue = useMemo(() => followUps.filter(f => !f.completed && new Date(f.dueAt).getTime() < now).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()), [followUps, now]);
  const upcoming = useMemo(() => followUps.filter(f => !f.completed && new Date(f.dueAt).getTime() >= now && new Date(f.dueAt).getTime() <= new Date(now + 7 * 86400000).getTime()).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()), [followUps, now]);
  const overdueCount = overdue.length;
  const upcomingCount = upcoming.length;

  const nonTerminalStages: PipelineStage[] = useMemo(() => ['new', 'contacted', 'qualified', 'proposal', 'negotiation'], []);
  const activeLeadsCount = useMemo(() => nonTerminalStages.reduce((sum, s) => sum + grouped[s].length, 0), [nonTerminalStages, grouped]);
  const wonLeads = grouped['won'];
  const lostLeads = grouped['lost'];

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={defaultTransition}
    >
      <div className="hero">
        <div className="hero-bg-grid" aria-hidden />
        <div className="hero-bg-glow" aria-hidden />
        <motion.div className="hero-content" variants={staggerContainer} initial="hidden" animate="visible">
          <motion.div variants={fadeInUp} className="hero-eyebrow"><span className="hero-eyebrow-dot" />CRM Pipeline</motion.div>
          <motion.h1 variants={fadeInUp} className="hero-title">Your leads,<br /><span>all in one place</span></motion.h1>
          <motion.p variants={fadeInUp} className="hero-subtitle">All locally stored. Drag leads between stages, track history, add notes and files — everything stays on your machine.</motion.p>
        </motion.div>
      </div>

      <div className="page-content">
        {/* Pipeline stats bar */}
        <div className="kanban-stats-bar">
          <div className="kanban-stat"><span className="kanban-stat-value">{leads.length}</span><span className="kanban-stat-label">Total Leads</span></div>
          <div className="kanban-stat"><span className="kanban-stat-value">{activeLeadsCount}</span><span className="kanban-stat-label">Active</span></div>
          <div className="kanban-stat"><span className="kanban-stat-value">${pipelineValue.toLocaleString()}</span><span className="kanban-stat-label">Pipeline Value</span></div>
          <div className="kanban-stat"><span className="kanban-stat-value">{wonLeads.length}</span><span className="kanban-stat-label">Won</span></div>
          <div className="kanban-stat"><span className="kanban-stat-value">{lostLeads.length}</span><span className="kanban-stat-label">Lost</span></div>
          <div className="kanban-stat"><span className="kanban-stat-value" style={{ color: overdueCount > 0 ? 'var(--color-danger)' : undefined }}>{overdueCount}</span><span className="kanban-stat-label">Overdue</span></div>
        </div>

        {/* Search and controls */}
        <div className="kanban-controls">
          <div className="kanban-search">
            <input type="text" className="input" placeholder="Search leads by name, category, or city..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '280px' }} />
            {search && <button className="kanban-search-clear" onClick={() => setSearch('')}>×</button>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button size="sm" variant={showFollowUpsView ? 'primary' : 'ghost'} onClick={() => setShowFollowUpsView(!showFollowUpsView)}>
              {showFollowUpsView ? 'Board View' : `Follow-ups (${overdueCount + upcomingCount})`}
            </Button>
            
          </div>
        </div>

        {isLoading ? (
          <div className="pipeline-empty-state"><Spinner className="spinner-block" /><p>Loading leads…</p></div>
        ) : isError ? (
          <div className="pipeline-empty-state">
            <p className="pipeline-empty-title" style={{ color: 'var(--color-danger)' }}>Failed to load leads</p>
            <p className="pipeline-empty-desc">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
            <Button variant="primary" onClick={() => refetch()} style={{ marginTop: '1rem' }}>Retry</Button>
          </div>
        ) : showFollowUpsView ? (
          <div className="followups-full-view">
            {overdue.length > 0 && (
              <div className="followups-section">
                <h3 style={{ color: 'var(--color-danger)', marginBottom: '0.75rem' }}>Overdue ({overdue.length})</h3>
                <div className="followups-full-list">
                  {overdue.slice(0, 20).map(f => {
                    const lead = leads.find(l => l.google_maps_url === f.leadUrl);
                    return (
                      <div key={f.id} className="followup-full-card overdue">
                        <div className="followup-full-lead">{lead?.business_name || f.leadUrl.slice(0, 30)}</div>
                        <div className="followup-full-date">Due {new Date(f.dueAt).toLocaleDateString()} {new Date(f.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        {f.note && <div className="followup-full-note">{f.note}</div>}
                        <div className="followup-full-actions">
                          <Button size="sm" variant="primary" onClick={async () => { await markFollowUpCompleted(f.id); reloadFollowUps(); }}>Mark Done</Button>
                          {lead && <Button size="sm" variant="ghost" onClick={() => setActiveLead(lead)}>Open Lead</Button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="followups-section">
                <h3 style={{ color: 'var(--color-warning)', marginBottom: '0.75rem' }}>Upcoming (next 7 days) ({upcoming.length})</h3>
                <div className="followups-full-list">
                  {upcoming.slice(0, 20).map(f => {
                    const lead = leads.find(l => l.google_maps_url === f.leadUrl);
                    return (
                      <div key={f.id} className="followup-full-card">
                        <div className="followup-full-lead">{lead?.business_name || f.leadUrl.slice(0, 30)}</div>
                        <div className="followup-full-time">Due {new Date(f.dueAt).toLocaleDateString()} {new Date(f.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        {f.note && <div className="followup-full-note">{f.note}</div>}
                        <div className="followup-full-actions">
                          <Button size="sm" variant="primary" onClick={async () => { await markFollowUpCompleted(f.id); reloadFollowUps(); }}>Mark Done</Button>
                          {lead && <Button size="sm" variant="ghost" onClick={() => setActiveLead(lead)}>Open Lead</Button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {overdue.length === 0 && upcoming.length === 0 && (
              <div className="pipeline-empty-state"><p>No follow-ups due. Set follow-ups from lead detail view.</p></div>
            )}
          </div>
        ) : leads.length === 0 ? (
          <div className="pipeline-empty-state"><p className="pipeline-empty-title">No leads found.</p><p className="pipeline-empty-desc">Import a file first from the Import page.</p></div>
        ) : (
          <div className="kanban-board">
            {PIPELINE_STAGES.map(stage => {
              const stageLeads = grouped[stage];
              const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimated_deal_value || 0), 0);
              return (
                <div key={stage} className="kanban-column" onDragOver={handleDragOver} onDrop={e => handleDrop(e, stage)}>
                  <div className="kanban-column-header">
                    <PipelineStageBadge stage={stage} />
                    <span className="kanban-column-count">{stageLeads.length}</span>
                    {stageValue > 0 && <span className="kanban-column-value">${stageValue.toLocaleString()}</span>}
                  </div>
                  <div className="kanban-column-body">
                    {stageLeads.length === 0 && <div className="kanban-column-empty">No leads</div>}
                    {stageLeads.map(lead => {
                      const url = lead.google_maps_url || '';
                      const stageLeadFollowUps = followUpsByLead[url] || [];
                      const overdueFu = stageLeadFollowUps.filter(f => !f.completed && new Date(f.dueAt).getTime() < Date.now());
                      const hasOverdue = overdueFu.length > 0;
                      const sentiment = aggregateSentiment(lead.reviews || []);
                      const realReviews = countRealReviews(lead.reviews);
                      const isDragging = dragLead === url;
                      return (
                        <div
                          key={url}
                          className={`kanban-card ${isDragging ? 'dragging' : ''} ${lead._stage === 'won' ? 'won' : lead._stage === 'lost' ? 'lost' : ''}`}
                          draggable={lead._stage !== 'won' && lead._stage !== 'lost'}
                          onDragStart={e => handleDragStart(e, url)}
                          onClick={() => setActiveLead(lead)}
                        >
                          <div className="kanban-card-header">
                            <span className="kanban-card-name">{lead.business_name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                              {hasOverdue && <span className="kanban-card-overdue-badge">{overdueFu.length}</span>}
                              <button
                                className="kanban-card-delete-btn"
                                onClick={(e) => handleDeleteLead(lead, e)}
                                title="Delete lead"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--color-text-muted)', padding: '0.1rem 0.2rem', lineHeight: 1, borderRadius: '4px', opacity: 0, transition: 'opacity 0.1s' }}
                                onMouseEnter={e => (e.target as HTMLElement).style.opacity = '1'}
                                onMouseLeave={e => (e.target as HTMLElement).style.opacity = '0'}
                              >🗑</button>
                            </div>
                          </div>
                          <div className="kanban-card-meta">
                            {lead.category && <span className="kanban-card-cat">{lead.category}</span>}
                            {lead.city && <span className="kanban-card-city">{lead.city}</span>}
                          </div>
                          <div className="kanban-card-stats-row">
                            {lead.rating != null && <span className="kanban-card-stat">{formatRating(lead.rating)}</span>}
                            {realReviews > 0 && <span className="kanban-card-stat">{realReviews} rev</span>}
                            {lead.estimated_deal_value != null && <span className="kanban-card-stat-value">${lead.estimated_deal_value.toLocaleString()}</span>}
                          </div>
                          {lead._wonLostReason && (
                            <div className="kanban-card-reason">{lead._wonLostReason}</div>
                          )}
                          {lead.ai_score != null && (
                            <div style={{ marginTop: '0.3rem', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                              Score: {lead.ai_score} · {lead.classification || '—'}
                            </div>
                          )}
                          {lead._stageEnteredAt && (
                            <div style={{ marginTop: '0.2rem', fontSize: '0.6rem', color: 'var(--color-text-muted)', opacity: 0.6 }}>
                              Since {new Date(lead._stageEnteredAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Won/Lost report zone */}
        {!isLoading && !showFollowUpsView && (wonLeads.length > 0 || lostLeads.length > 0) && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Closed Deals Summary</h3>
            {wonLeads.length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Won ({wonLeads.length}): ${wonLeads.reduce((s, l) => s + (l.estimated_deal_value || 0), 0).toLocaleString()}</span>
                {wonLeads.filter(l => l._wonLostReason).map(l => (
                  <div key={l.google_maps_url} style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '1rem' }}>{l.business_name}: "{l._wonLostReason}"</div>
                ))}
              </div>
            )}
            {lostLeads.length > 0 && (
              <div>
                <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>Lost ({lostLeads.length})</span>
                {lostLeads.filter(l => l._wonLostReason).map(l => (
                  <div key={l.google_maps_url} style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '1rem' }}>{l.business_name}: "{l._wonLostReason}"</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {activeLead && (
        <Suspense fallback={null}>
          <LeadDetailModal
            lead={activeLead}
            onClose={() => setActiveLead(null)}
            onSave={async (updates) => {
              const url = activeLead.google_maps_url || activeLead.maps_url;
              if (url) {
                if (updates._stage) {
                  const history = Array.isArray(activeLead._stageHistory) ? [...activeLead._stageHistory] : [];
                  history.push({ stage: (activeLead._stage as PipelineStage) || 'new', enteredAt: activeLead._stageEnteredAt || new Date().toISOString() });
                  updates._stageHistory = history;
                }
                handleUpdateLead(url, updates);
                refetch();
              }
              setActiveLead(null);
            }}
          />
        </Suspense>
      )}
    </motion.div>
  );
};