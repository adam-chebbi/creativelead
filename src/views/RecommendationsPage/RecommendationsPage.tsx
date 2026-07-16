import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Lead, PipelineStage } from '@/types';
import { useLeadStore } from '@/hooks';
import { Button, Badge, Spinner } from '@/components/ui';
import { PipelineStageBadge, STAGE_LABELS } from '@/components/ui';
import { generateAIScores } from '@/utils/scoring';
import { computeRecommendations } from '@/utils/recommendation-engine';
import { RecommendationEngineResult, SmartFilterKey, SMART_FILTER_DEFS } from '@/utils/recommendation-types';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';

const LeadDetailModal = lazy(() => import('@/components/pipeline/LeadDetailModal').then(m => ({ default: m.LeadDetailModal })));

const RecLeadCard = React.memo(function RecLeadCard({ ranked, lead, index, onClick }: { ranked: any; lead: Lead; index: number; onClick: () => void }) {
  const scores = generateAIScores(lead);
  const stage = (lead._stage as PipelineStage) || 'new';
  return (
    <div className="rec-card" onClick={onClick}>
      <div className="rec-card-rank">#{ranked.rank}</div>
      <div className="rec-card-main">
        <div className="rec-card-header">
          <span className="rec-card-name">{lead.business_name}</span>
          {lead.estimated_deal_value && <span className="rec-card-value">${lead.estimated_deal_value.toLocaleString()}</span>}
        </div>
        <div className="rec-card-meta">{lead.category} · {lead.city || ''} · <PipelineStageBadge stage={stage} /> · AI {scores.ai_score ?? 'N/A'}</div>
        <div className="rec-card-explanation">{ranked.explanation}</div>
      </div>
    </div>
  );
});

export const RecommendationsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationEngineResult | null>(null);
  const [activeTab, setActiveTab] = useState<'ranked' | 'similar' | 'nearby' | 'gaps' | 'conversion' | 'filters'>('ranked');
  const [selectedLeadUrl, setSelectedLeadUrl] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<Set<SmartFilterKey>>(new Set());
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const { getAllLeads, updateLead } = useLeadStore();

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const all = await getAllLeads();
      setLeads(all);
      const res = computeRecommendations(all, undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  }, [getAllLeads]);

  useEffect(() => { loadData(); }, [loadData]);

  const recompute = useCallback((allLeads: Lead[], refUrl: string) => {
    const res = computeRecommendations(allLeads, refUrl || undefined);
    setResult(res);
  }, []);

  const handleRefChange = (url: string) => {
    setSelectedLeadUrl(url);
    recompute(leads, url);
  };

  const toggleFilter = (key: SmartFilterKey) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const activeFilterLeads = useMemo(() => {
    if (!result) return [];
    if (activeFilters.size === 0) return result.rankedLeads;
    const filterResults = result.smartFilters.filter(f => activeFilters.has(f.filterKey as SmartFilterKey));
    let matches = result.rankedLeads;
    for (const fr of filterResults) {
      const filterUrls = new Set(fr.leads.map(l => l.lead.google_maps_url));
      matches = matches.filter(r => filterUrls.has(r.lead.google_maps_url));
    }
    return matches;
  }, [result, activeFilters]);

  const rankedLeads = result?.rankedLeads || [];

  return (
    <motion.div initial={false} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={defaultTransition}>
      <div className="hero">
        <div className="hero-bg-grid" aria-hidden />
        <div className="hero-bg-glow" aria-hidden />
        <motion.div className="hero-content" variants={staggerContainer} initial="hidden" animate="visible">
          <motion.div variants={fadeInUp} className="hero-eyebrow"><span className="hero-eyebrow-dot" />Lead Recommendation Engine</motion.div>
          <motion.h1 variants={fadeInUp} className="hero-title">Smart <span>Recommendations</span></motion.h1>
          <motion.p variants={fadeInUp} className="hero-subtitle">Ranked by AI Score, conversion probability, deal value, recency, and detected gaps. All data from your imported leads — no fabricated companies.</motion.p>
        </motion.div>
      </div>

      <div className="page-content">
        {result && (
          <div className="kanban-stats-bar">
            <div className="kanban-stat"><span className="kanban-stat-value">{result.stats.totalLeads}</span><span className="kanban-stat-label">Total Leads</span></div>
            <div className="kanban-stat"><span className="kanban-stat-value">{result.stats.leadsWithScore}</span><span className="kanban-stat-label">Scored</span></div>
            <div className="kanban-stat"><span className="kanban-stat-value">{result.stats.leadsWithCoordinates}</span><span className="kanban-stat-label">With Coordinates</span></div>
            <div className="kanban-stat"><span className="kanban-stat-value">{result.stats.leadsWithWebsite}</span><span className="kanban-stat-label">With Website</span></div>
            <div className="kanban-stat"><span className="kanban-stat-value">{result.stats.leadsWithDealValue}</span><span className="kanban-stat-label">Has Deal Value</span></div>
          </div>
        )}

        <div className="rec-controls">
          <div className="rec-reference-picker">
            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginRight: '0.5rem' }}>Reference lead:</label>
            <select className="input" style={{ width: '240px' }} value={selectedLeadUrl} onChange={e => handleRefChange(e.target.value)}>
              <option value="">— None (use top-ranked) —</option>
              {leads.slice(0, 50).map(l => (
                <option key={l.google_maps_url} value={l.google_maps_url}>{l.business_name} — {l.city || ''}</option>
              ))}
              {leads.length > 50 && <option disabled>… {leads.length - 50} more …</option>}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="pipeline-empty-state"><Spinner className="spinner-block" /><p>Computing recommendations…</p></div>
        ) : error ? (
          <div className="pipeline-empty-state">
            <p className="pipeline-empty-title" style={{ color: 'var(--color-danger)' }}>Failed to load recommendations</p>
            <p className="pipeline-empty-desc">{error}</p>
            <Button variant="primary" onClick={loadData} style={{ marginTop: '1rem' }}>Retry</Button>
          </div>
        ) : !result || result.rankedLeads.length === 0 ? (
          <div className="pipeline-empty-state"><p className="pipeline-empty-title">No leads found.</p><p className="pipeline-empty-desc">Import leads first to see recommendations.</p></div>
        ) : (
          <>
            <div className="modal-tabs" style={{ marginBottom: '1.5rem' }}>
              <button className={`modal-tab ${activeTab === 'ranked' ? 'active' : ''}`} onClick={() => setActiveTab('ranked')}>Top Ranked ({rankedLeads.slice(0, 10).length})</button>
              <button className={`modal-tab ${activeTab === 'conversion' ? 'active' : ''}`} onClick={() => setActiveTab('conversion')}>High Conversion ({result.highConversionLeads.length})</button>
              <button className={`modal-tab ${activeTab === 'similar' ? 'active' : ''}`} onClick={() => setActiveTab('similar')}>Similar {Array.isArray(result.similarCompanies) ? `(${result.similarCompanies.length})` : ''}</button>
              <button className={`modal-tab ${activeTab === 'nearby' ? 'active' : ''}`} onClick={() => setActiveTab('nearby')}>Nearby</button>
              <button className={`modal-tab ${activeTab === 'gaps' ? 'active' : ''}`} onClick={() => setActiveTab('gaps')}>Market Gaps</button>
              <button className={`modal-tab ${activeTab === 'filters' ? 'active' : ''}`} onClick={() => setActiveTab('filters')}>Smart Filters</button>
            </div>

            {activeTab === 'ranked' && (
              <div className="rec-section">
                <h3 className="rec-section-title">Top Recommended Leads</h3>
                <p className="rec-section-subtitle">Weighted rank: AI Score (45%) + conversion probability (20%) + deal value (15%) + recency (10%) + gaps (10%). Won/Lost leads deprioritized.</p>
                <div className="rec-lead-list">
                  {rankedLeads.slice(0, 10).map((r, i) => <RecLeadCard key={r.lead.google_maps_url} ranked={r} lead={r.lead} index={i} onClick={() => setActiveLead(r.lead)} />)}
                </div>
              </div>
            )}

            {activeTab === 'conversion' && (
              <div className="rec-section">
                <h3 className="rec-section-title">High-Conversion Predictions ({result.highConversionLeads.length})</h3>
                <p className="rec-section-subtitle">Leads with highest conversion probability from the Opportunity Detector (phone/email/review/rating/gap analysis). Not a separate score.</p>
                {result.highConversionLeads.length === 0 ? (
                  <p className="rec-empty">Run Opportunity Analysis on leads to populate conversion probability.</p>
                ) : (
                  <div className="rec-lead-list">{result.highConversionLeads.map((r, i) => <RecLeadCard key={r.lead.google_maps_url} ranked={r} lead={r.lead} index={i} onClick={() => setActiveLead(r.lead)} />)}</div>
                )}
              </div>
            )}

            {activeTab === 'similar' && (
              <div className="rec-section">
                <h3 className="rec-section-title">Similar Companies</h3>
                <p className="rec-section-subtitle">Matched on category, same city, proximity (&lt;10 km = +20 pts, &lt;50 km = +10 pts), and rating similarity.</p>
                {Array.isArray(result.similarCompanies) ? (
                  <div className="rec-lead-list">{result.similarCompanies.map((s, i) => (
                    <div key={s.lead.google_maps_url} className="rec-card" onClick={() => setActiveLead(s.lead)}>
                      <div className="rec-card-header">
                        <span className="rec-card-name">{s.lead.business_name}</span>
                        <span className="rec-card-value">{s.similarityScore}/100</span>
                      </div>
                      <div className="rec-card-meta">{s.lead.category} · {s.lead.city || ''}</div>
                      <div className="rec-card-explanation">{s.explanation}</div>
                    </div>
                  ))}</div>
                ) : (
                  <div className="rec-empty-box"><p>{result.similarCompanies.reason}</p><p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Select a reference lead above.</p></div>
                )}
              </div>
            )}

            {activeTab === 'nearby' && (
              <div className="rec-section">
                <h3 className="rec-section-title">Nearby Opportunities</h3>
                <p className="rec-section-subtitle">Real Haversine distance from reference lead's coordinates. Only leads with valid lat/lng included.</p>
                {Array.isArray(result.nearbyOpportunities) ? (
                  <div className="rec-lead-list">{result.nearbyOpportunities.map(n => (
                    <div key={n.lead.google_maps_url} className="rec-card" onClick={() => setActiveLead(n.lead)}>
                      <div className="rec-card-header">
                        <span className="rec-card-name">{n.lead.business_name}</span>
                        <span className="rec-card-distance">{n.distanceKm} km</span>
                      </div>
                      <div className="rec-card-meta">{n.lead.category} · {n.lead.city || n.lead.address || ''}</div>
                      <div className="rec-card-explanation">{n.explanation}</div>
                    </div>
                  ))}</div>
                ) : (
                  <div className="rec-empty-box"><p>{result.nearbyOpportunities.reason}</p></div>
                )}
              </div>
            )}

            {activeTab === 'gaps' && (
              <div className="rec-section">
                <h3 className="rec-section-title">Market Gap Opportunities</h3>
                <p className="rec-section-subtitle">Categories under-represented in a city despite high avg rating/review counts in the dataset. Only real imported data used.</p>
                {Array.isArray(result.marketGaps) ? (
                  <div className="rec-gap-list">{result.marketGaps.map((g, i) => (
                    <div key={`${g.city}-${g.category}`} className="rec-gap-card">
                      <div className="rec-gap-header"><span className="rec-gap-category">{g.category}</span><span className="rec-gap-city">{g.city}</span></div>
                      <div className="rec-gap-stats">
                        <span className="rec-gap-stat">{g.leadCount} lead(s) in city</span>
                        <span className="rec-gap-stat">{g.avgRating}/5 avg rating</span>
                        <span className="rec-gap-stat">{g.avgReviewCount} avg reviews</span>
                        {g.avgDealValue > 0 && <span className="rec-gap-stat">${g.avgDealValue.toLocaleString()} avg value</span>}
                      </div>
                      <div className="rec-card-explanation">{g.explanation}</div>
                    </div>
                  ))}</div>
                ) : (
                  <div className="rec-empty-box"><p>{result.marketGaps.reason}</p></div>
                )}
              </div>
            )}

            {activeTab === 'filters' && (
              <div className="rec-section">
                <h3 className="rec-section-title">Smart Filters</h3>
                <p className="rec-section-subtitle">Combinable filters querying real computed fields. Apply multiple to intersect results.</p>
                <div className="rec-filter-bar">
                  {SMART_FILTER_DEFS.map(def => (
                    <button key={def.key} className={`rec-filter-btn ${activeFilters.has(def.key) ? 'active' : ''}`} onClick={() => toggleFilter(def.key)} title={def.description}>
                      {def.label} ({result.smartFilters.find(f => f.filterKey === def.key)?.count ?? 0})
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {activeFilters.size === 0 ? 'No filters active — showing all ranked leads.' : `${activeFilters.size} filter(s) active. Showing intersection.`}
                </div>
                <div className="rec-lead-list" style={{ marginTop: '0.75rem' }}>
                  {activeFilterLeads.slice(0, 25).map(r => <RecLeadCard key={r.lead.google_maps_url} ranked={r} lead={r.lead} index={0} onClick={() => setActiveLead(r.lead)} />)}
                  {activeFilterLeads.length === 0 && activeFilters.size > 0 && <p className="rec-empty">No leads match all active filters.</p>}
                </div>
              </div>
            )}
          </>
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
                await updateLead(url, updates);
                const all = await getAllLeads();
                setLeads(all);
                const res = computeRecommendations(all, selectedLeadUrl);
                setResult(res);
              }
              setActiveLead(null);
            }}
          />
        </Suspense>
      )}
    </motion.div>
  );
};