import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSettingsStore, ScoringWeights, ScoringChip, ServicePricing, DetectionThresholds, ProviderCredentials, DEFAULT_CHIPS } from '@/hooks/useSettingsStore';
import { Button } from '@/components/ui';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';
import { AiProvider, testAiConnection, PROVIDER_META, DEFAULT_MODELS, ModelOption } from '@/utils/api-client';

type SettingsTab = 'ai' | 'enrichment' | 'scoring' | 'thresholds' | 'pricing' | 'providers' | 'sheets';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'ai', label: 'AI Provider' },
  { key: 'enrichment', label: 'Contact Enrichment' },
  { key: 'scoring', label: 'Scoring Algorithm' },
  { key: 'thresholds', label: 'Opportunity Thresholds' },
  { key: 'pricing', label: 'Service Pricing' },
  { key: 'providers', label: 'Campaign Providers' },
  { key: 'sheets', label: 'Google Sheets' },
];

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();

  const [aiProvider, setAiProvider] = useState<AiProvider>(settings.aiProvider || 'gemini');
  const [aiModel, setAiModel] = useState(settings.aiModel || DEFAULT_MODELS[aiProvider]);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey);
  const [openAiKey, setOpenAiKey] = useState(settings.openAiKey);
  const [openrouterApiKey, setOpenrouterApiKey] = useState(settings.openrouterApiKey);
  const [groqApiKey, setGroqApiKey] = useState(settings.groqApiKey);
  const [anthropicApiKey, setAnthropicApiKey] = useState(settings.anthropicApiKey);
  const [mistralApiKey, setMistralApiKey] = useState(settings.mistralApiKey);
  const [cohereApiKey, setCohereApiKey] = useState(settings.cohereApiKey);
  const [customApiBase, setCustomApiBase] = useState(settings.customApiBase);
  const [customApiKey, setCustomApiKey] = useState(settings.customApiKey);
  const [customModel, setCustomModel] = useState(settings.customModel);
  const [enrichmentKey, setEnrichmentKey] = useState(settings.enrichmentKey);
  const [enrichmentProvider, setEnrichmentProvider] = useState(settings.enrichmentProvider);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(settings.googleSheetsUrl || '');
  const [sheetsTesting, setSheetsTesting] = useState(false);
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [sheetsResult, setSheetsResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [weights, setWeights] = useState<ScoringWeights>(settings.weights);
  const [scoringChips, setScoringChips] = useState<ScoringChip[]>(
    Array.isArray(settings.scoringChips) ? settings.scoringChips.map(c => ({ ...c })) : DEFAULT_CHIPS.map(c => ({ ...c }))
  );
  const [pricing, setPricing] = useState<ServicePricing>(settings.opportunityConfig.pricing);
  const [thresholds, setThresholds] = useState<DetectionThresholds>(settings.opportunityConfig.thresholds);
  const [providers, setProviders] = useState<ProviderCredentials>(settings.providers);
  const [isSaved, setIsSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ provider: AiProvider; ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  const markDirty = useCallback(() => { setIsDirty(true); setIsSaved(false); }, []);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!isDirty) return;
      const link = (e.target as HTMLElement)?.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
      e.preventDefault();
      setPendingNav(href);
      setShowUnsavedModal(true);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isDirty]);

  const activeChips = scoringChips.filter(c => c.enabled);
  const totalPoints = activeChips.reduce((s, c) => s + c.points, 0);
  const isFull = totalPoints >= 100;

  const handleChipToggle = (id: string) => {
    setScoringChips(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
    markDirty();
  };

  const handleChipPoints = (id: string, points: number) => {
    setScoringChips(prev => {
      const old = prev.find(c => c.id === id);
      if (!old) return prev;
      const otherTotal = prev.filter(c => c.id !== id && c.enabled).reduce((s, c) => s + c.points, 0);
      const capped = Math.max(1, Math.min(100, points));
      if (otherTotal + capped > 100) return prev.map(c => c.id === id ? { ...c, points: 100 - otherTotal } : c);
      return prev.map(c => c.id === id ? { ...c, points: capped } : c);
    });
    markDirty();
  };

  const handleWeightChange = (key: keyof ScoringWeights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const handlePricingChange = (key: keyof ServicePricing, value: number) => {
    setPricing(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const handleThresholdChange = (key: keyof DetectionThresholds, value: number) => {
    setThresholds(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const handleProviderChange = (key: keyof ProviderCredentials, value: string | number) => {
    setProviders(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const handleProviderField = (key: keyof ProviderCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setProviders(prev => ({ ...prev, [key]: e.target.value }));
    markDirty();
  };

  const handleTestSheetsConnection = async () => {
    if (!googleSheetsUrl) { setSheetsResult({ ok: false, message: 'Enter a Web App URL first.' }); return; }
    setSheetsTesting(true); setSheetsResult(null);
    try {
      const res = await fetch(googleSheetsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) });
      if (res.ok) setSheetsResult({ ok: true, message: '✓ Connection successful — Web App is reachable.' });
      else setSheetsResult({ ok: false, message: `× Server returned ${res.status}. Check your URL and script deployment.` });
    } catch { setSheetsResult({ ok: false, message: '× Could not reach the URL. Check the URL or network/firewall settings.' }); }
    finally { setSheetsTesting(false); }
  };

  const handleSyncAllToSheets = async () => {
    if (!googleSheetsUrl) { setSheetsResult({ ok: false, message: 'Enter a Web App URL first.' }); return; }
    setSheetsSyncing(true); setSheetsResult(null);
    try {
      const res = await fetch('/api/leads/sync-sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const json = await res.json();
      if (json.ok) setSheetsResult({ ok: true, message: `✓ Synced ${json.synced} lead(s) to Google Sheets.` });
      else setSheetsResult({ ok: false, message: `× ${json.error || 'Sync failed.'}` });
    } catch { setSheetsResult({ ok: false, message: '× Sync request failed.' }); }
    finally { setSheetsSyncing(false); }
  };

  const handleSave = () => {
    updateSettings({
      aiProvider, aiModel, geminiApiKey, openAiKey, openrouterApiKey, groqApiKey,
      anthropicApiKey, mistralApiKey, cohereApiKey, customApiBase, customApiKey, customModel,
      enrichmentKey, enrichmentProvider, googleSheetsUrl, weights, scoringChips,
      opportunityConfig: { pricing, thresholds }, providers,
    });
    setIsSaved(true); setIsDirty(false);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleDiscard = () => {
    setAiProvider(settings.aiProvider || 'gemini'); setAiModel(settings.aiModel || DEFAULT_MODELS[settings.aiProvider || 'gemini']);
    setGeminiApiKey(settings.geminiApiKey); setOpenAiKey(settings.openAiKey); setOpenrouterApiKey(settings.openrouterApiKey);
    setGroqApiKey(settings.groqApiKey); setAnthropicApiKey(settings.anthropicApiKey); setMistralApiKey(settings.mistralApiKey);
    setCohereApiKey(settings.cohereApiKey); setCustomApiBase(settings.customApiBase); setCustomApiKey(settings.customApiKey);
    setCustomModel(settings.customModel); setEnrichmentKey(settings.enrichmentKey); setEnrichmentProvider(settings.enrichmentProvider);
    setGoogleSheetsUrl(settings.googleSheetsUrl || '');
    setWeights(settings.weights); setScoringChips(Array.isArray(settings.scoringChips) ? settings.scoringChips.map(c => ({ ...c })) : DEFAULT_CHIPS.map(c => ({ ...c })));
    setPricing(settings.opportunityConfig.pricing); setThresholds(settings.opportunityConfig.thresholds);
    setProviders(settings.providers);
    setIsDirty(false); setShowUnsavedModal(false);
    if (pendingTab) { setActiveTab(pendingTab); setPendingTab(null); }
    if (pendingNav) { window.location.href = pendingNav; setPendingNav(null); }
  };

  const handleCancelNav = () => { setShowUnsavedModal(false); setPendingTab(null); setPendingNav(null); };

  const handleTabSwitch = (tab: SettingsTab) => {
    if (tab === activeTab) return;
    if (isDirty) { setPendingTab(tab); setShowUnsavedModal(true); }
    else setActiveTab(tab);
  };

  const handleTestConnection = async (provider: AiProvider) => {
    setTesting(true); setTestResult(null);
    const overrides = { aiProvider: provider, aiModel: provider === 'custom' ? customModel : aiModel, geminiApiKey, openAiKey, openrouterApiKey, groqApiKey, anthropicApiKey, mistralApiKey, cohereApiKey, customApiBase, customApiKey, customModel };
    const result = await testAiConnection(provider, overrides);
    if (result.ok) setTestResult({ provider, ok: true, message: `✓ Connection successful — ${result.model} is ready.` });
    else setTestResult({ provider, ok: false, message: result.error });
    setTesting(false);
  };

  const handleProviderSelectChange = (newProvider: AiProvider) => {
    setAiProvider(newProvider); setAiModel(DEFAULT_MODELS[newProvider]); markDirty(); setTestResult(null);
  };

  const renderActiveProviderSettings = () => {
    const meta = PROVIDER_META[aiProvider];
    if (aiProvider === 'custom') {
      return (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}><label>API Base URL</label><input type="text" className="input" placeholder="http://localhost:11434/v1" value={customApiBase} onChange={(e) => { setCustomApiBase(e.target.value); markDirty(); }} /></div>
          <div className="form-group" style={{ marginBottom: 0 }}><label>API Key</label><input type="password" className="input" placeholder="Enter API key if required..." value={customApiKey} onChange={(e) => { setCustomApiKey(e.target.value); markDirty(); }} /></div>
          <div className="form-group" style={{ marginBottom: 0 }}><label>Model ID</label><input type="text" className="input" placeholder="e.g. llama3.2" value={customModel} onChange={(e) => { setCustomModel(e.target.value); markDirty(); }} /></div>
        </div>
      );
    }
    const valueMap: Record<string, string> = { gemini: geminiApiKey, openai: openAiKey, openrouter: openrouterApiKey, groq: groqApiKey, anthropic: anthropicApiKey, mistral: mistralApiKey, cohere: cohereApiKey };
    const setterMap: Record<string, React.Dispatch<React.SetStateAction<string>>> = { gemini: setGeminiApiKey, openai: setOpenAiKey, openrouter: setOpenrouterApiKey, groq: setGroqApiKey, anthropic: setAnthropicApiKey, mistral: setMistralApiKey, cohere: setCohereApiKey };
    return (
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{meta.label} API Key <span style={{ fontSize: '0.7rem', fontWeight: 400 }}>(<a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-light)' }}>Get key here</a>)</span></label>
          <input type="password" className="input" placeholder={meta.keyPlaceholder} value={valueMap[aiProvider]} onChange={(e) => { setterMap[aiProvider](e.target.value); markDirty(); }} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Model Selection</label>
          <select className="input" value={aiModel} onChange={(e) => { setAiModel(e.target.value); markDirty(); }}>
            {meta.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        {aiProvider === 'gemini' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
            ℹ️ Free tier: <strong>30 requests/min</strong>. The app automatically retries on rate-limit errors with backoff. For higher throughput, <a href="https://aistudio.google.com/plan" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-light)' }}>upgrade to a paid plan</a>.
          </p>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    const cardStyle: React.CSSProperties = { padding: '2rem' };

    switch (activeTab) {
      case 'ai':
        return (
          <div className="card card-glow" style={cardStyle}>
            <h2 className="section-title">AI Provider</h2>
            <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>Choose which AI service powers outreach generation, enrichment estimates, and insights.</p>
            <div className="form-group">
              <label>Provider</label>
              <select className="input" value={aiProvider} onChange={(e) => handleProviderSelectChange(e.target.value as AiProvider)}>
                {(Object.entries(PROVIDER_META) as [AiProvider, typeof PROVIDER_META[AiProvider]][]).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label} {meta.tier === 'free-tier' ? '(Free models available)' : meta.tier === 'free' ? '(Free)' : '(Paid)'}</option>
                ))}
              </select>
            </div>
            {renderActiveProviderSettings()}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <Button size="sm" variant="secondary" onClick={() => handleTestConnection(aiProvider)} disabled={testing}>{testing ? 'Testing...' : 'Test Connection'}</Button>
              {testResult && testResult.provider === aiProvider && (
                <span style={{ fontSize: '0.8rem', color: testResult.ok ? 'var(--color-success)' : 'var(--color-danger)', flex: 1, minWidth: 0, marginTop: '0.25rem' }}>
                  {testResult.message}
                  {!testResult.ok && testResult.message.toLowerCase().includes('rate limit') && aiProvider === 'gemini' && (
                    <> — <a href="https://aistudio.google.com/plan" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-light)' }}>Upgrade plan</a></>
                  )}
                </span>
              )}
            </div>
          </div>
        );

      case 'enrichment':
        return (
          <div className="card card-glow" style={cardStyle}>
            <h2 className="section-title">Contact Enrichment</h2>
            <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>Configure third-party data enrichment for email, phone, and social profile discovery.</p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Enrichment API Key (For Hunter.io, Clearbit, or Apollo.io)</label>
              <input type="password" className="input" placeholder="Enter API Key..." value={enrichmentKey} onChange={(e) => { setEnrichmentKey(e.target.value); markDirty(); }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, marginTop: '0.75rem' }}>
              <label>Enrichment Provider</label>
              <select className="input" value={enrichmentProvider} onChange={(e) => { setEnrichmentProvider(e.target.value as any); markDirty(); }}>
                <option value="none">None (website scrape only)</option>
                <option value="hunter">Hunter.io (email finder)</option>
                <option value="clearbit">Clearbit (people + company data)</option>
                <option value="apollo">Apollo.io (contacts + org data)</option>
              </select>
            </div>
          </div>
        );

      case 'scoring':
        return (
          <div className="card" style={cardStyle}>
            <h2 className="section-title">AI Scoring Algorithm (Chips)</h2>
            <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>
              Select scoring factors and assign point values. The AI Score is the sum of points for each factor detected on a lead. Max 100 points total.
            </p>

            <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: isFull ? 'var(--color-success-bg, #064e3b)' : 'var(--color-bg-secondary, #1e293b)', borderRadius: '8px', textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: isFull ? 'var(--color-success, #10b981)' : 'var(--color-text)' }}>
              {totalPoints} / 100 used
              {isFull && <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400, marginTop: '0.25rem' }}>Your scoring model is fully allocated. Remove or reduce a factor to make changes.</span>}
            </div>

            <h3 style={{ fontSize: '0.9rem', color: 'var(--color-primary-light)', marginBottom: '0.75rem' }}>Active Scoring Factors ({activeChips.length})</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {scoringChips.filter(c => c.enabled).map(chip => (
                <div key={chip.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.6rem', borderRadius: '20px',
                  background: 'var(--color-primary, #3b82f6)', color: '#fff', fontSize: '0.78rem',
                }}>
                  <span>{chip.label}</span>
                  <input
                    type="number" min="1" max="100" value={chip.points}
                    onChange={e => handleChipPoints(chip.id, parseInt(e.target.value, 10) || 1)}
                    style={{ width: '40px', padding: '0.1rem 0.2rem', fontSize: '0.75rem', textAlign: 'center', border: 'none', borderRadius: '4px', background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                    disabled={isFull}
                  />
                  <button onClick={() => handleChipToggle(chip.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, padding: 0 }} title="Remove factor">×</button>
                </div>
              ))}
              {activeChips.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>No factors selected. Click chips below to add them.</p>}
            </div>

            <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Available Factors</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {scoringChips.filter(c => !c.enabled).map(chip => (
                <button
                  key={chip.id}
                  onClick={() => !isFull && handleChipToggle(chip.id)}
                  disabled={isFull}
                  title={isFull ? 'Score is fully allocated — remove or lower another factor first' : `${chip.description} (${chip.points} pts)`}
                  style={{
                    padding: '0.35rem 0.8rem', borderRadius: '20px', fontSize: '0.78rem',
                    background: isFull ? 'var(--color-bg-secondary, #1e293b)' : 'var(--color-bg-secondary, #1e293b)',
                    color: isFull ? 'var(--color-text-muted, #64748b)' : 'var(--color-text)',
                    border: '1px dashed var(--color-border, #334155)', cursor: isFull ? 'not-allowed' : 'pointer',
                  }}
                >
                  + {chip.label}
                </button>
              ))}
            </div>

            <details style={{ marginTop: '1.5rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Show old weight sliders (legacy fallback)</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
                <WeightSlider label="Website Modernization" value={weights.opportunity} onChange={(v) => handleWeightChange('opportunity', v)} />
                <WeightSlider label="Digital Presence" value={weights.competition} onChange={(v) => handleWeightChange('competition', v)} />
                <WeightSlider label="Client Value & Growth" value={weights.growth} onChange={(v) => handleWeightChange('growth', v)} />
                <WeightSlider label="SEO & Local Search" value={weights.seo} onChange={(v) => handleWeightChange('seo', v)} />
                <WeightSlider label="Performance & UX" value={weights.website} onChange={(v) => handleWeightChange('website', v)} />
                <WeightSlider label="Reputation Management" value={weights.reputation} onChange={(v) => handleWeightChange('reputation', v)} />
              </div>
            </details>
          </div>
        );

      case 'thresholds':
        return (
          <div className="card" style={cardStyle}>
            <h2 className="section-title">Opportunity Detection Thresholds</h2>
            <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>Configure the thresholds used to detect gaps on each lead.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <NumberInput label="Low Review Count" value={thresholds.lowReviewCount} onChange={(v) => handleThresholdChange('lowReviewCount', v)} />
              <NumberSlider label={`Low Rating Bar (ratings below ${thresholds.lowRatingBar}/5 are flagged)`} value={thresholds.lowRatingBar} min={1} max={5} step={0.1} onChange={(v) => handleThresholdChange('lowRatingBar', v)} displayValue={thresholds.lowRatingBar.toFixed(1) + '/5'} />
              <NumberInput label="Minimum Reviews for Rating" value={thresholds.minReviewsForRating} onChange={(v) => handleThresholdChange('minReviewsForRating', v)} />
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div className="card" style={cardStyle}>
            <h2 className="section-title">Service Pricing Table</h2>
            <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>Set base prices for each service package. These feed into the estimated deal value calculation.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <PricingInput label="Website Build (no website)" value={pricing.websiteBuild} onChange={(v) => handlePricingChange('websiteBuild', v)} />
              <PricingInput label="Website Redesign" value={pricing.websiteRedesign} onChange={(v) => handlePricingChange('websiteRedesign', v)} />
              <PricingInput label="SEO Audit (one-time)" value={pricing.seoAudit} onChange={(v) => handlePricingChange('seoAudit', v)} />
              <PricingInput label="SEO Monthly Retainer" value={pricing.seoMonthly} onChange={(v) => handlePricingChange('seoMonthly', v)} />
              <PricingInput label="Social Media Setup" value={pricing.socialSetup} onChange={(v) => handlePricingChange('socialSetup', v)} />
              <PricingInput label="Social Media Management (3 months)" value={pricing.socialManagement} onChange={(v) => handlePricingChange('socialManagement', v)} />
              <PricingInput label="Review Management" value={pricing.reviewManagement} onChange={(v) => handlePricingChange('reviewManagement', v)} />
              <PricingInput label="Local Citation Cleanup" value={pricing.localCitation} onChange={(v) => handlePricingChange('localCitation', v)} />
              <PricingInput label="Full Digital Audit" value={pricing.fullDigitalAudit} onChange={(v) => handlePricingChange('fullDigitalAudit', v)} />
            </div>
          </div>
        );

      case 'providers':
        return (
          <div className="card" style={cardStyle}>
            <h2 className="section-title">Campaign Provider Credentials</h2>
            <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>Configure sending providers for email, SMS, and WhatsApp campaigns.</p>
            <h3 style={{ fontSize: '1rem', color: 'var(--color-primary-light)', marginBottom: '0.75rem' }}>Email (SMTP / SendGrid)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>SMTP Host</label><input type="text" className="input" placeholder="smtp.sendgrid.net" value={providers.emailSmtpHost} onChange={handleProviderField('emailSmtpHost')} /></div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 2, marginBottom: 0 }}><label>SMTP Username</label><input type="text" className="input" placeholder="apikey" value={providers.emailSmtpUser} onChange={handleProviderField('emailSmtpUser')} /></div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>Port</label><input type="number" className="input" value={providers.emailSmtpPort} onChange={e => handleProviderChange('emailSmtpPort', parseInt(e.target.value, 10) || 587)} /></div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>API Key / Password</label><input type="password" className="input" placeholder="SendGrid API key" value={providers.emailSmtpPass} onChange={handleProviderField('emailSmtpPass')} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>From Email</label><input type="email" className="input" placeholder="you@yourdomain.com" value={providers.emailFromAddress} onChange={handleProviderField('emailFromAddress')} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>From Name</label><input type="text" className="input" placeholder="Your Name" value={providers.emailFromName} onChange={handleProviderField('emailFromName')} /></div>
            </div>
            <h3 style={{ fontSize: '1rem', color: 'var(--color-primary-light)', marginBottom: '0.75rem' }}>Twilio (SMS & WhatsApp)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>Account SID</label><input type="password" className="input" placeholder="AC..." value={providers.twilioAccountSid} onChange={handleProviderField('twilioAccountSid')} /></div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>Auth Token</label><input type="password" className="input" placeholder="..." value={providers.twilioAuthToken} onChange={handleProviderField('twilioAuthToken')} /></div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>SMS From Number</label><input type="text" className="input" placeholder="+15551234567" value={providers.twilioSmsFromNumber} onChange={handleProviderField('twilioSmsFromNumber')} /></div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>WhatsApp From Number</label><input type="text" className="input" placeholder="+15559876543" value={providers.twilioWhatsAppFromNumber} onChange={handleProviderField('twilioWhatsAppFromNumber')} /></div>
              </div>
            </div>
          </div>
        );

      case 'sheets':
        return (
          <div className="card card-glow" style={cardStyle}>
            <h2 className="section-title">Google Sheets Integration</h2>
            <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>Sync your leads to a Google Sheet via an Apps Script Web App.</p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Apps Script Web App URL</label>
              <input type="url" className="input" placeholder="https://script.google.com/macros/s/.../exec" value={googleSheetsUrl} onChange={(e) => { setGoogleSheetsUrl(e.target.value); markDirty(); }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <Button size="sm" variant="secondary" onClick={handleTestSheetsConnection} disabled={sheetsTesting}>{sheetsTesting ? 'Testing...' : 'Test Connection'}</Button>
              <Button size="sm" variant="primary" onClick={handleSyncAllToSheets} disabled={sheetsSyncing}>{sheetsSyncing ? 'Syncing...' : 'Sync All Leads Now'}</Button>
              {sheetsResult && <span style={{ fontSize: '0.8rem', color: sheetsResult.ok ? 'var(--color-success)' : 'var(--color-danger)', flex: 1, minWidth: 0, marginTop: '0.25rem' }}>{sheetsResult.message}</span>}
            </div>
          </div>
        );
    }
  };

  return (
    <motion.div className="page-content" variants={staggerContainer} initial="hidden" animate="visible" exit="hidden">
      <motion.div className="section-header" variants={fadeInUp}>
        <h1 className="hero-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>App <span>Settings</span></h1>
        <p className="hero-subtitle" style={{ margin: '0', textAlign: 'left', maxWidth: '100%' }}>Configure API keys, AI scoring weights, opportunity detection thresholds, and service pricing tables.</p>
      </motion.div>

      <div className="settings-tab-bar" style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabSwitch(tab.key)}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
              background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--color-primary-light)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} variants={fadeInUp} transition={defaultTransition} style={{ maxWidth: '800px' }}>
        {renderTabContent()}
      </motion.div>

      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        background: 'var(--color-bg-primary)', borderTop: '1px solid var(--color-border)',
        padding: '1rem 0', marginTop: '2rem', marginBottom: '3rem',
        display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 10,
      }}>
        <Button variant="primary" size="lg" onClick={handleSave}>Save Settings</Button>
        {isSaved && <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Saved successfully</span>}
        {isDirty && !isSaved && <span style={{ color: 'var(--color-warning)', fontSize: '0.85rem' }}>You have unsaved changes</span>}
      </div>

      {showUnsavedModal && (
        <div className="modal-backdrop" onClick={handleCancelNav} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '2rem', maxWidth: '400px', width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Unsaved Changes</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>You have unsaved changes. What would you like to do?</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => { handleSave(); handleCancelNav(); }}>Save Changes</Button>
              <Button variant="secondary" onClick={handleDiscard}>Discard Changes</Button>
              <Button variant="ghost" onClick={handleCancelNav}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

function WeightSlider({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{label}</label>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary-light)' }}>{value}</span>
      </div>
      <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{label}</label>
      <input type="number" min="0" step="1" value={value} onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))} className="input" style={{ maxWidth: '120px' }} />
    </div>
  );
}

function NumberSlider({ label, value, min, max, step, onChange, displayValue }: { label: string, value: number, min: number, max: number, step: number, onChange: (val: number) => void, displayValue: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{label}</label>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary-light)' }}>{displayValue}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
    </div>
  );
}

function PricingInput({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', flex: 1 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>$</span>
        <input type="number" min="0" step="50" value={value} onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))} className="input" style={{ maxWidth: '120px', textAlign: 'right' }} />
      </div>
    </div>
  );
}
