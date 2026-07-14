import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSettingsStore, ScoringWeights, ServicePricing, DetectionThresholds, ProviderCredentials } from '@/hooks/useSettingsStore';
import { Button } from '@/components/ui';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';
import { AiProvider, testAiConnection, PROVIDER_META, DEFAULT_MODELS, ModelOption } from '@/utils/api-client';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();

  const [aiProvider, setAiProvider] = useState<AiProvider>(settings.aiProvider || 'gemini');
  const [aiModel, setAiModel] = useState(settings.aiModel || DEFAULT_MODELS[aiProvider]);

  // Keys
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
  const [weights, setWeights] = useState<ScoringWeights>(settings.weights);
  const [pricing, setPricing] = useState<ServicePricing>(settings.opportunityConfig.pricing);
  const [thresholds, setThresholds] = useState<DetectionThresholds>(settings.opportunityConfig.thresholds);
  const [providers, setProviders] = useState<ProviderCredentials>(settings.providers);
  const [isSaved, setIsSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ provider: AiProvider; ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleWeightChange = (key: keyof ScoringWeights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
    setIsSaved(false);
  };

  const handlePricingChange = (key: keyof ServicePricing, value: number) => {
    setPricing(prev => ({ ...prev, [key]: value }));
    setIsSaved(false);
  };

  const handleThresholdChange = (key: keyof DetectionThresholds, value: number) => {
    setThresholds(prev => ({ ...prev, [key]: value }));
    setIsSaved(false);
  };

  const handleProviderChange = (key: keyof ProviderCredentials, value: string | number) => {
    setProviders(prev => ({ ...prev, [key]: value }));
    setIsSaved(false);
  };

  const handleProviderField = (key: keyof ProviderCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setProviders(prev => ({ ...prev, [key]: e.target.value }));
    setIsSaved(false);
  };

  const handleSave = () => {
    updateSettings({
      aiProvider,
      aiModel,
      geminiApiKey,
      openAiKey,
      openrouterApiKey,
      groqApiKey,
      anthropicApiKey,
      mistralApiKey,
      cohereApiKey,
      customApiBase,
      customApiKey,
      customModel,
      enrichmentKey,
      enrichmentProvider,
      weights,
      opportunityConfig: { pricing, thresholds },
      providers,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTestConnection = async (provider: AiProvider) => {
    setTesting(true);
    setTestResult(null);
    const overrides = {
      aiProvider: provider,
      aiModel: provider === 'custom' ? customModel : aiModel,
      geminiApiKey, openAiKey, openrouterApiKey, groqApiKey,
      anthropicApiKey, mistralApiKey, cohereApiKey,
      customApiBase, customApiKey, customModel,
    };

    const result = await testAiConnection(provider, overrides);
    
    if (result.ok) {
      setTestResult({ provider, ok: true, message: `✓ Connection successful — ${result.model} is ready.` });
    } else {
      setTestResult({ provider, ok: false, message: result.error });
    }
    setTesting(false);
  };

  const handleProviderSelectChange = (newProvider: AiProvider) => {
    setAiProvider(newProvider);
    setAiModel(DEFAULT_MODELS[newProvider]);
    setIsSaved(false);
    setTestResult(null);
  };

  const renderActiveProviderSettings = () => {
    const meta = PROVIDER_META[aiProvider];

    if (aiProvider === 'custom') {
      return (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>API Base URL</label>
            <input type="text" className="input" placeholder="http://localhost:11434/v1" value={customApiBase} onChange={(e) => { setCustomApiBase(e.target.value); setIsSaved(false); }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>API Key</label>
            <input type="password" className="input" placeholder="Enter API key if required..." value={customApiKey} onChange={(e) => { setCustomApiKey(e.target.value); setIsSaved(false); }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Model ID</label>
            <input type="text" className="input" placeholder="e.g. llama3.2" value={customModel} onChange={(e) => { setCustomModel(e.target.value); setIsSaved(false); }} />
          </div>
        </div>
      );
    }

    const valueMap: Record<string, string> = {
      gemini: geminiApiKey, openai: openAiKey, openrouter: openrouterApiKey, groq: groqApiKey,
      anthropic: anthropicApiKey, mistral: mistralApiKey, cohere: cohereApiKey,
    };
    const setterMap: Record<string, React.Dispatch<React.SetStateAction<string>>> = {
      gemini: setGeminiApiKey, openai: setOpenAiKey, openrouter: setOpenrouterApiKey, groq: setGroqApiKey,
      anthropic: setAnthropicApiKey, mistral: setMistralApiKey, cohere: setCohereApiKey,
    };

    const val = valueMap[aiProvider];
    const setVal = setterMap[aiProvider];

    return (
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{meta.label} API Key <span style={{ fontSize: '0.7rem', fontWeight: 400 }}>(<a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-light)' }}>Get key here</a>)</span></label>
          <input
            type="password"
            className="input"
            placeholder={meta.keyPlaceholder}
            value={val}
            onChange={(e) => { setVal(e.target.value); setIsSaved(false); }}
          />
        </div>
        
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Model Selection</label>
          <select className="input" value={aiModel} onChange={(e) => { setAiModel(e.target.value); setIsSaved(false); }}>
            {meta.models.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {aiProvider === 'gemini' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
            ℹ️ Free tier: <strong>30 requests/min</strong>. The app automatically retries on rate-limit errors with backoff.
            For higher throughput, <a href="https://aistudio.google.com/plan" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-light)' }}>upgrade to a paid plan</a>.
          </p>
        )}
      </div>
    );
  };

  return (
    <motion.div
      className="page-content"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      <motion.div className="section-header" variants={fadeInUp}>
        <h1 className="hero-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          App <span>Settings</span>
        </h1>
        <p className="hero-subtitle" style={{ margin: '0', textAlign: 'left', maxWidth: '100%' }}>
          Configure API keys, AI scoring weights, opportunity detection thresholds, and service pricing tables.
        </p>
      </motion.div>

      <motion.div variants={fadeInUp} transition={defaultTransition} className="settings-grid" style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr', maxWidth: '800px' }}>

        {/* AI Provider */}
        <div className="card card-glow" style={{ padding: '2rem' }}>
          <h2 className="section-title">AI Provider</h2>
          <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>Choose which AI service powers outreach generation, enrichment estimates, and insights. You can use free models via OpenRouter or Groq.</p>

          <div className="form-group">
            <label>Provider</label>
            <select className="input" value={aiProvider} onChange={(e) => handleProviderSelectChange(e.target.value as AiProvider)}>
              {(Object.entries(PROVIDER_META) as [AiProvider, typeof PROVIDER_META[AiProvider]][]).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label} {meta.tier === 'free-tier' ? '(Free models available)' : meta.tier === 'free' ? '(Free)' : '(Paid)'}
                </option>
              ))}
            </select>
          </div>

          {renderActiveProviderSettings()}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" onClick={() => handleTestConnection(aiProvider)} disabled={testing}>
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
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

        {/* Enrichment API Keys */}
        <div className="card card-glow" style={{ padding: '2rem' }}>
          <h2 className="section-title">Contact Enrichment</h2>
          <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>Configure third-party data enrichment for email, phone, and social profile discovery from business websites.</p>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Enrichment API Key (For Hunter.io, Clearbit, or Apollo.io)</label>
            <input
              type="password"
              className="input"
              placeholder="Enter API Key..."
              value={enrichmentKey}
              onChange={(e) => { setEnrichmentKey(e.target.value); setIsSaved(false); }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, marginTop: '0.75rem' }}>
            <label>Enrichment Provider</label>
            <select className="input" value={enrichmentProvider} onChange={(e) => { setEnrichmentProvider(e.target.value as any); setIsSaved(false); }}>
              <option value="none">None (website scrape only)</option>
              <option value="hunter">Hunter.io (email finder)</option>
              <option value="clearbit">Clearbit (people + company data)</option>
              <option value="apollo">Apollo.io (contacts + org data)</option>
            </select>
          </div>
        </div>

        {/* Scoring Weights */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 className="section-title">AI Scoring Algorithm (Weights)</h2>
          <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>
            Adjust the weight of each criteria. The final AI Score is calculated based on these multipliers.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <WeightSlider
              label="Website Modernization (Missing website, obsolete technology)"
              value={weights.opportunity}
              onChange={(v) => handleWeightChange('opportunity', v)}
            />
            <WeightSlider
              label="Digital Presence (Unclaimed profiles, poor social media)"
              value={weights.competition}
              onChange={(v) => handleWeightChange('competition', v)}
            />
            <WeightSlider
              label="Client Value & Growth (High ticket business category)"
              value={weights.growth}
              onChange={(v) => handleWeightChange('growth', v)}
            />
            <WeightSlider
              label="SEO & Local Search (Missing ranking indicators, poor maps presence)"
              value={weights.seo}
              onChange={(v) => handleWeightChange('seo', v)}
            />
            <WeightSlider
              label="Performance & UX (Mobile responsiveness, load speed, accessibility)"
              value={weights.website}
              onChange={(v) => handleWeightChange('website', v)}
            />
            <WeightSlider
              label="Reputation Management (Sub-4.0 ratings, low review volume)"
              value={weights.reputation}
              onChange={(v) => handleWeightChange('reputation', v)}
            />
          </div>
        </div>

        {/* Detection Thresholds */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 className="section-title">Opportunity Detection Thresholds</h2>
          <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>
            Configure the thresholds used to detect gaps on each lead. These values feed into the opportunity analysis engine.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <NumberInput
              label="Low Review Count (reviews below this count are flagged as low volume)"
              value={thresholds.lowReviewCount}
              onChange={(v) => handleThresholdChange('lowReviewCount', v)}
            />
            <NumberSlider
              label={`Low Rating Bar (ratings below ${thresholds.lowRatingBar}/5 are flagged)`}
              value={thresholds.lowRatingBar}
              min={1}
              max={5}
              step={0.1}
              onChange={(v) => handleThresholdChange('lowRatingBar', v)}
              displayValue={thresholds.lowRatingBar.toFixed(1) + '/5'}
            />
            <NumberInput
              label="Minimum Reviews for Rating (ignore rating signal below this review count)"
              value={thresholds.minReviewsForRating}
              onChange={(v) => handleThresholdChange('minReviewsForRating', v)}
            />
          </div>
        </div>

        {/* Service Pricing Table */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 className="section-title">Service Pricing Table</h2>
          <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>
            Set the base prices for each service package. These feed into the estimated deal value calculation.
            The formula: <code style={{ fontSize: '0.8rem', opacity: 0.7 }}>base × (1 + gaps×0.15) × categoryMultiplier</code>
          </p>

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

        {/* Provider Credentials for Campaigns */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 className="section-title">Campaign Provider Credentials</h2>
          <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>
            Configure sending providers for email, SMS, and WhatsApp campaigns. These credentials are stored locally and never sent to our servers.
          </p>

          <h3 style={{ fontSize: '1rem', color: 'var(--color-primary-light)', marginBottom: '0.75rem' }}>Email (SendGrid API Key or Resend)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>SMTP Host / API Base (SendGrid or Resend)</label>
              <input type="text" className="input" placeholder="smtp.sendgrid.net" value={providers.emailSmtpHost} onChange={handleProviderField('emailSmtpHost')} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label>SMTP Username</label>
                <input type="text" className="input" placeholder="apikey" value={providers.emailSmtpUser} onChange={handleProviderField('emailSmtpUser')} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Port</label>
                <input type="number" className="input" value={providers.emailSmtpPort} onChange={e => handleProviderChange('emailSmtpPort', parseInt(e.target.value, 10) || 587)} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>API Key / Password</label>
              <input type="password" className="input" placeholder="SendGrid API key or Resend key" value={providers.emailSmtpPass} onChange={handleProviderField('emailSmtpPass')} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>From Email</label>
              <input type="email" className="input" placeholder="you@yourdomain.com" value={providers.emailFromAddress} onChange={handleProviderField('emailFromAddress')} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>From Name</label>
              <input type="text" className="input" placeholder="Your Name" value={providers.emailFromName} onChange={handleProviderField('emailFromName')} />
            </div>
          </div>

          <h3 style={{ fontSize: '1rem', color: 'var(--color-primary-light)', marginBottom: '0.75rem' }}>Twilio (SMS & WhatsApp)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Account SID</label>
                <input type="password" className="input" placeholder="AC..." value={providers.twilioAccountSid} onChange={handleProviderField('twilioAccountSid')} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Auth Token</label>
                <input type="password" className="input" placeholder="..." value={providers.twilioAuthToken} onChange={handleProviderField('twilioAuthToken')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>SMS From Number</label>
                <input type="text" className="input" placeholder="+15551234567" value={providers.twilioSmsFromNumber} onChange={handleProviderField('twilioSmsFromNumber')} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>WhatsApp From Number</label>
                <input type="text" className="input" placeholder="+15559876543" value={providers.twilioWhatsAppFromNumber} onChange={handleProviderField('twilioWhatsAppFromNumber')} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '3rem' }}>
          <Button variant="primary" size="lg" onClick={handleSave}>
            Save Settings
          </Button>
          {isSaved && <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Saved successfully</span>}
        </div>
      </motion.div>
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
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{ width: '100%', accentColor: 'var(--color-primary)' }}
      />
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{label}</label>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
        className="input"
        style={{ maxWidth: '120px' }}
      />
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
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--color-primary)' }}
      />
    </div>
  );
}

function PricingInput({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', flex: 1 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>$</span>
        <input
          type="number"
          min="0"
          step="50"
          value={value}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
          className="input"
          style={{ maxWidth: '120px', textAlign: 'right' }}
        />
      </div>
    </div>
  );
}