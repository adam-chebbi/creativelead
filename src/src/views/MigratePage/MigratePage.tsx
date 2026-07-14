'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { apiRequest } from '@/utils/api-request';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';

interface BatchResult {
  batchIndex: number;
  sent: number;
  imported: number;
  error?: string;
}

interface MigrationSummary {
  totalLeads: number;
  totalImported: number;
  batches: BatchResult[];
  completedAt: string;
}

const BATCH_SIZE = 200;
const DB_NAME = 'CreativeLeadDB';
const STORE_NAME = 'leads';

async function readAllFromIndexedDB(): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onerror = () => reject(new Error('Could not open IndexedDB database. It may not exist in this browser.'));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        db.close();
        resolve(getAllRequest.result ?? []);
      };
      getAllRequest.onerror = () => reject(new Error('Failed to read from IndexedDB.'));
    };
  });
}

export const MigratePage: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'reading' | 'migrating' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleMigrate = async () => {
    setStatus('reading');
    setErrorMessage(null);
    setSummary(null);

    let allLeads: unknown[] = [];
    try {
      allLeads = await readAllFromIndexedDB();
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Failed to read IndexedDB.');
      return;
    }

    if (allLeads.length === 0) {
      setStatus('done');
      setSummary({ totalLeads: 0, totalImported: 0, batches: [], completedAt: new Date().toISOString() });
      return;
    }

    setStatus('migrating');
    setProgress({ current: 0, total: allLeads.length });

    const batches: BatchResult[] = [];
    let totalImported = 0;

    for (let i = 0; i < allLeads.length; i += BATCH_SIZE) {
      const batch = allLeads.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE);

      try {
        const res = await apiRequest('/api/migrate/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Server error ${res.status}`);
        }

        const data = await res.json();
        const result: BatchResult = { batchIndex, sent: batch.length, imported: data.count ?? 0 };
        batches.push(result);
        totalImported += result.imported;
      } catch (e) {
        batches.push({ batchIndex, sent: batch.length, imported: 0, error: e instanceof Error ? e.message : 'Unknown error' });
      }

      setProgress({ current: Math.min(i + BATCH_SIZE, allLeads.length), total: allLeads.length });
    }

    setStatus('done');
    setSummary({ totalLeads: allLeads.length, totalImported, batches, completedAt: new Date().toISOString() });
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

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
            This reads your browser's existing local lead data (IndexedDB) and uploads it
            to the shared Postgres database. Run this once per browser that has local data.
          </motion.p>
        </motion.div>
      </div>

      <div className="page-content">
        <div className="section">
          {status === 'idle' && (
            <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="section-header">
              <h2 className="section-title">Ready to migrate</h2>
              <p className="section-subtitle">Click the button below to begin. Do not close this tab during migration.</p>
              <button
                id="start-migration-btn"
                className="btn btn-primary btn-lg"
                style={{ marginTop: '1.5rem' }}
                onClick={handleMigrate}
              >
                Start Migration
              </button>
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
                Migrating {progress.current} / {progress.total} leads…
              </h2>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '9999px', height: '12px', overflow: 'hidden' }}>
                <motion.div
                  style={{ background: 'var(--accent)', height: '100%', borderRadius: '9999px' }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ ease: 'easeOut', duration: 0.4 }}
                />
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{progressPercent}% complete</p>
            </div>
          )}

          {status === 'error' && (
            <div className="alert alert-error" style={{ margin: '1rem 0' }}>
              <strong>Migration failed:</strong> {errorMessage}
            </div>
          )}

          {status === 'done' && summary && (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible">
              <motion.div variants={fadeInUp}>
                <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
                  <strong>Migration complete.</strong> {summary.totalImported} of {summary.totalLeads} leads imported to Postgres.
                </div>
              </motion.div>
              {summary.batches.length > 0 && (
                <motion.div variants={fadeInUp}>
                  <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Batch log</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Batch</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Sent</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Imported</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.batches.map((b) => (
                        <tr key={b.batchIndex} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.5rem' }}>#{b.batchIndex + 1}</td>
                          <td style={{ padding: '0.5rem' }}>{b.sent}</td>
                          <td style={{ padding: '0.5rem' }}>{b.imported}</td>
                          <td style={{ padding: '0.5rem', color: b.error ? 'var(--color-error)' : 'var(--color-success)' }}>
                            {b.error ? `Error: ${b.error}` : '✓ OK'}
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
