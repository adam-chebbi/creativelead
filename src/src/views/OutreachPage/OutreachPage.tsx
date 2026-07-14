import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lead, OutreachMessages, OutreachMessage } from '@/types';
import { Button, Badge, Card, Spinner } from '@/components/ui';
import { useLeadStore } from '@/hooks';
import { generateMessage, generateAllMessages, OUTREACH_CHANNELS, ChannelSpec } from '@/utils/outreach-generator';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';

export const OutreachPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<OutreachMessages | null>(null);
  const [loading, setLoading] = useState<'idle' | 'single' | 'all'>('idle');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { getAllLeads, updateLead } = useLeadStore();

  React.useEffect(() => {
    getAllLeads().then(setLeads);
  }, []);

  const filteredLeads = leads.filter(l =>
    l.business_name.toLowerCase().includes(search.toLowerCase()) ||
    (l.city || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setMessages(lead.outreach_messages || null);
    setError(null);
    setEditingKey(null);
  };

  const handleGenerateAll = async () => {
    if (!selectedLead) return;
    setLoading('all');
    setError(null);
    try {
      const result = await generateAllMessages(selectedLead);
      if (result.ok) {
        setMessages(result.messages);
        if (selectedLead.google_maps_url) {
          await updateLead(selectedLead.google_maps_url, {
            outreach_messages: result.messages,
          });
        }
      } else {
        const errs = Object.values(result.errors).join('; ');
        setError(errs || 'Failed to generate messages. Check API key in Settings.');
      }
    } catch (err) {
      setError('Unexpected error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setLoading('idle');
    }
  };

  const handleGenerateSingle = async (spec: ChannelSpec) => {
    if (!selectedLead) return;
    setRegeneratingKey(spec.key);
    setError(null);
    try {
      const result = await generateMessage(spec, selectedLead);
      if (result.ok) {
        const updated: OutreachMessages = {
          ...(messages || { email: { body: '', edited: false }, linkedin: { body: '', edited: false }, whatsapp: { body: '', edited: false }, proposalIntro: { body: '', edited: false }, generatedAt: new Date().toISOString() }),
          [spec.key]: result.message,
          generatedAt: new Date().toISOString(),
        };
        setMessages(updated);
        if (selectedLead.google_maps_url) {
          await updateLead(selectedLead.google_maps_url, { outreach_messages: updated });
        }
      } else {
        setError(result.error);
      }
    } finally {
      setRegeneratingKey(null);
    }
  };

  const startEdit = (key: string, msg: OutreachMessage) => {
    setEditingKey(key);
    setEditText(msg.subject ? `Subject: ${msg.subject}\n\n${msg.body}` : msg.body);
  };

  const saveEdit = (key: string) => {
    if (!messages) return;
    let subject: string | undefined;
    let body = editText;
    if (['email'].includes(key)) {
      const sm = editText.match(/^Subject:\s*(.+?)(?:\n|$)/i);
      if (sm) { subject = sm[1].trim(); body = editText.replace(/^Subject:\s*.+?(?:\n|$)/, '').trim(); }
    }
    const updated = {
      ...messages,
      [key]: { subject, body, edited: true },
      generatedAt: new Date().toISOString(),
    };
    setMessages(updated);
    setEditingKey(null);
    if (selectedLead?.google_maps_url) {
      updateLead(selectedLead.google_maps_url, { outreach_messages: updated });
    }
  };

  const cancelEdit = () => { setEditingKey(null); setEditText(''); };

  const copyToClipboard = async (msg: OutreachMessage) => {
    const text = msg.subject ? `Subject: ${msg.subject}\n\n${msg.body}` : msg.body;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(msg.body.slice(0, 20));
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const renderMessageCard = (spec: ChannelSpec) => {
    if (!messages) return null;
    const msg = messages[spec.key];
    const isEditing = editingKey === spec.key;
    const isRegenerating = regeneratingKey === spec.key;

    return (
      <div key={spec.key} className="outreach-card">
        <div className="outreach-card-header">
          <h4>{spec.label}</h4>
          <div className="outreach-card-actions">
            {isEditing ? null : (
              <>
                <Button size="sm" variant="ghost" onClick={() => startEdit(spec.key, msg)} disabled={isRegenerating}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleGenerateSingle(spec)} disabled={isRegenerating}>
                  {isRegenerating ? 'Generating...' : 'Regenerate'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(msg)}>
                  {copiedKey === msg.body.slice(0, 20) ? 'Copied!' : 'Copy'}
                </Button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="outreach-edit-area">
            {spec.requiresSubject && (
              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>
                Start with "Subject: Your Subject Here" then a blank line, then the body.
              </label>
            )}
            <textarea
              className="outreach-textarea"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={8}
            />
            <div className="outreach-edit-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button size="sm" variant="primary" onClick={() => saveEdit(spec.key)}>Save</Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="outreach-message-body">
            {msg.subject && <p className="outreach-subject-line"><strong>Subject:</strong> {msg.subject}</p>}
            <pre className="outreach-body-text">{msg.body}</pre>
            {msg.edited && <span className="outreach-edited-badge">Edited</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      className="page-content"
      initial={false}
      variants={staggerContainer}
      animate="visible"
      exit="hidden"
    >
      <motion.div className="section-header" variants={fadeInUp}>
        <h1 className="hero-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          Outreach <span>Generator</span>
        </h1>
        <p className="hero-subtitle" style={{ margin: '0', textAlign: 'left', maxWidth: '100%' }}>
          Select a lead and generate personalized outreach messages across email, LinkedIn, WhatsApp, and proposals.
        </p>
      </motion.div>

      <div className="outreach-layout">
        {/* Left panel: lead selector */}
        <motion.div className="outreach-lead-selector" variants={fadeInUp}>
          <input
            type="text"
            className="input"
            placeholder="Search leads by name, city, or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: '1rem' }}
          />
          <div className="outreach-lead-list">
            {filteredLeads.map(lead => (
              <div
                key={lead.google_maps_url || lead.business_name}
                className={`outreach-lead-item ${selectedLead?.google_maps_url === lead.google_maps_url ? 'active' : ''}`}
                onClick={() => selectLead(lead)}
              >
                <strong>{lead.business_name}</strong>
                <span className="outreach-lead-meta">
                  {lead.city || lead.location || ''}{lead.category ? ` · ${lead.category}` : ''}
                </span>
                {lead.outreach_messages && <span className="outreach-lead-check">✓ Generated</span>}
              </div>
            ))}
            {filteredLeads.length === 0 && (
              <p className="outreach-empty">No leads found. Import leads first.</p>
            )}
          </div>
        </motion.div>

        {/* Right panel: outreach messages */}
        <motion.div className="outreach-content" variants={fadeInUp} transition={defaultTransition}>
          {!selectedLead ? (
            <div className="outreach-placeholder">
              <h3>Select a lead to begin</h3>
              <p>Choose a lead from the left panel to generate AI-powered outreach messages tailored to their specific gaps and opportunities.</p>
            </div>
          ) : (
            <>
              <div className="outreach-lead-header">
                <div>
                  <h3>{selectedLead.business_name}</h3>
                  <p className="outreach-lead-details">
                    {selectedLead.category} · {selectedLead.city || selectedLead.location || ''}
                    {selectedLead.rating != null ? ` · ${selectedLead.rating}/5 (${selectedLead.review_count || 0} reviews)` : ''}
                  </p>
                </div>
                <div className="outreach-header-actions">
                  <Button variant="primary" size="sm" onClick={handleGenerateAll} disabled={loading === 'all'}>
                    {loading === 'all' ? 'Generating...' : messages ? 'Regenerate All' : 'Generate All'}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              <div className="outreach-messages-grid">
                {OUTREACH_CHANNELS.map(renderMessageCard)}
              </div>

              {loading === 'all' && !error && (
                <div className="outreach-loading">
                  <span className="spinner" style={{ display: 'inline-block', marginRight: '0.5rem' }} />
                  Generating all messages...
                </div>
              )}

              {!messages && loading !== 'all' && (
                <div className="outreach-placeholder" style={{ marginTop: '2rem' }}>
                  <p>Click "Generate All" to create personalized outreach messages, or use individual regenerate buttons for specific channels.</p>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};