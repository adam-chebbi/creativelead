'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';
import { apiRequest } from '@/utils/api-request';
import { readAllLeadsFromIndexedDB, readAllNotesFromIndexedDB, readAllAttachmentsFromIndexedDB, readAllFollowUpsFromIndexedDB } from '@/db';
import { readAllCampaignsFromIndexedDB, readAllLedgerFromIndexedDB } from '@/utils/campaign-db';

const MIGRATED_KEY = 'cl_migrated_v2';
const BATCH_SIZE = 200;

interface PhaseResult {
  phase: string;
  count: number;
  error?: string;
}

export const MigratePage: React.FC = () => {
  const [hasMigrated, setHasMigrated] = useState(false);
  const [status, setStatus] = useState<'idle' | 'reading' | 'migrating' | 'done' | 'error'>('idle');
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<PhaseResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setHasMigrated(localStorage.getItem(MIGRATED_KEY) === 'true');
  }, []);

  const handleMigrate = async () => {
    setStatus('reading');
    setErrorMessage(null);
    setResults([]);

    let leads: unknown[] = [];
    let notes: unknown[] = [];
    let attachments: unknown[] = [];
    let followUps: unknown[] = [];
    let campaigns: unknown[] = [];
    let ledgerEntries: unknown[] = [];

    try {
      setPhase('Reading IndexedDB…');
      [leads, notes, attachments, followUps, campaigns, ledgerEntries] = await Promise.all([
        readAllLeadsFromIndexedDB(),
        readAllNotesFromIndexedDB(),
        readAllAttachmentsFromIndexedDB(),
        readAllFollowUpsFromIndexedDB(),
        readAllCampaignsFromIndexedDB(),
        readAllLedgerFromIndexedDB(),
      ]);
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Failed to read IndexedDB.');
      return;
    }

    if (leads.length === 0 && notes.length === 0 && followUps.length === 0 && campaigns.length === 0) {
      setStatus('done');
      setResults([{ phase: 'checked', count: 0 }]);
      return;
    }

    setStatus('migrating');
    const allResults: PhaseResult[] = [];

    // Phase 1: Import leads
    if (leads.length > 0) {
      setPhase('Importing leads…');
      setProgress({ current: 0, total: leads.length });
      let imported = 0;
      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        try {
          const res = await apiRequest('/api/migrate/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batch),
          });
          if (res.ok) {
            const data = await res.json();
            imported += data.count ?? 0;
          }
        } catch {
          // ignore batch errors
        }
        setProgress({ current: Math.min(i + BATCH_SIZE, leads.length), total: leads.length });
      }
      allResults.push({ phase: 'leads', count: imported });
    }

    // Phase 2: Import entities (notes, attachments, follow-ups, campaigns, ledger)
    if (notes.length > 0 || attachments.length > 0 || followUps.length > 0 || campaigns.length > 0 || ledgerEntries.length > 0) {
      setPhase('Importing notes, attachments, follow-ups, campaigns…');
      try {
        const res = await apiRequest('/api/migrate/import-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes, attachments, followUps, campaigns, ledgerEntries }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.counts) {
            for (const [key, val] of Object.entries(data.counts)) {
              allResults.push({ phase: key, count: val as number });
            }
          }
        } else {
          allResults.push({ phase: 'entities', count: 0, error: 'Import failed' });
        }
      } catch {
        allResults.push({ phase: 'entities', count: 0, error: 'Network error' });
      }
    }

    localStorage.setItem(MIGRATED_KEY, 'true');
    setHasMigrated(true);
    setStatus('done');
    setResults(allResults);
  };

  const totalImported = results.reduce((s, r) => s + r.count, 0);

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={defaultTransition}>
      <div className="hero">
        <div className="hero-bg-grid" aria-hidden />
        <div className="hero-bg-glow" aria-hidden />
        <motion.div className="hero-content" variants={staggerContainer} initial="hidden" animate="visible">
          <motion.div variants={fadeInUp} className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Admin — One-Time Migration
          </motion.div>
          <motion.h1 variants={fadeInUp} className="hero-title">
            Migrate local data<br />
            <span>to the shared database</span>
          </motion.h1>
          <motion.p variants={fadeInUp} className="hero-subtitle">
            This reads your browser's existing local data (IndexedDB) and uploads it
            to the shared Postgres database. Run this once per browser that has local data.
          </motion.p>
        </motion.div>
      </div>

      <div className="page-content">
        <div className="section">
          {hasMigrated && (
            <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
              Migration complete — all data now served from Postgres.
            </div>
          )}

          {status === 'idle' && (
            <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="section-header">
              <h2 className="section-title">{hasMigrated ? 'Already migrated' : 'Ready to migrate'}</h2>
              <p className="section-subtitle">
                {hasMigrated
                  ? 'Your data has already been migrated. The app now reads from the shared database.'
                  : 'Click the button below to begin. Do not close this tab during migration.'}
              </p>
              {!hasMigrated && (
                <button
                  id="start-migration-btn"
                  className="btn btn-primary btn-lg"
                  style={{ marginTop: '1.5rem' }}
                  onClick={handleMigrate}
                >
                  Start Migration
                </button>
              )}
            </motion.div>
          )}

          {status === 'reading' && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Reading local database…</p>
            </div>
          )}

          {status === 'migrating' && (
            <div style={{ padding: '2rem' }}>
              <h2 className="section-title" style={{ marginBottom: '1rem' }}>
                {phase} {progress.total > 0 ? `(${progress.current}/${progress.total})` : ''}
              </h2>
              {progress.total > 0 && (
                <>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '9999px', height: '12px', overflow: 'hidden' }}>
                    <motion.div
                      style={{ background: 'var(--accent)', height: '100%', borderRadius: '9999px' }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                      transition={{ ease: 'easeOut', duration: 0.4 }}
                    />
                  </div>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{Math.round((progress.current / progress.total) * 100)}% complete</p>
                </>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="alert alert-error" style={{ margin: '1rem 0' }}>
              <strong>Migration failed:</strong> {errorMessage}
            </div>
          )}

          {status === 'done' && (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible">
              <motion.div variants={fadeInUp}>
                <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
                  <strong>Migration complete.</strong> {totalImported} items imported to Postgres.
                </div>
              </motion.div>
              {results.length > 0 && (
                <motion.div variants={fadeInUp}>
                  <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Migration log</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Phase</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Imported</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.5rem' }}>{r.phase}</td>
                          <td style={{ padding: '0.5rem' }}>{r.count}</td>
                          <td style={{ padding: '0.5rem', color: r.error ? 'var(--color-error)' : 'var(--color-success)' }}>
                            {r.error ? `Error: ${r.error}` : '✓ OK'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
