import React from 'react';
import { motion } from 'framer-motion';
import { useFileImport, useLeadStats } from '@/hooks';
import { Button, Dropzone } from '@/components/ui';
import { CheckIcon, TrashIcon } from '@/components/icons';
import { LeadPreviewTable, ImportSummaryStats, ImportErrorsList } from '@/components/lead-import';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';

export const ImportPage: React.FC = () => {
  const { result, importing, importSuccess, onDrop, handleImport, handleReset } = useFileImport();
  const { totalLeads, totalErrors, totalReviews } = useLeadStats(result);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={defaultTransition}
    >
      <div className="hero">
        <div className="hero-bg-grid" aria-hidden />
        <div className="hero-bg-glow" aria-hidden />
        <motion.div 
          className="hero-content"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeInUp} className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Import Leads
          </motion.div>
          <motion.h1 variants={fadeInUp} className="hero-title">
            Turn extractions into<br />
            <span>CRM-ready leads</span>
          </motion.h1>
          <motion.p variants={fadeInUp} className="hero-subtitle">
            Upload a JSON file exported from the CreativeLead Chrome Extension.
            We'll validate, preview, and save your leads — including all 20 reviews per business.
          </motion.p>
        </motion.div>
      </div>

      <div className="page-content">
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Upload File</h2>
            <p className="section-subtitle">Drag and drop your extraction file, or click to browse</p>
          </div>

          <Dropzone 
            onDrop={onDrop}
            multiple={false}
          />
        </div>

        {result && <ImportErrorsList errors={result.errors} />}

        {importSuccess && (
          <motion.div 
            className="section section-alert" 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="alert alert-success">
              <CheckIcon />
              <strong>Successfully imported {totalLeads} lead{totalLeads !== 1 ? 's' : ''} into the CRM.</strong>
            </div>
          </motion.div>
        )}

        {result && result.leads.length > 0 && !importSuccess && (
          <motion.div 
            className="section"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeInUp} className="section-header section-header-flex">
              <div>
                <h2 className="section-title">Preview — {result.fileName}</h2>
                <p className="section-subtitle">Review your data before importing</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset} title="Clear file">
                <TrashIcon /> Clear
              </Button>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <ImportSummaryStats 
                totalLeads={totalLeads}
                totalErrors={totalErrors}
                totalReviews={totalReviews}
                source={result.source}
              />
            </motion.div>

            <motion.div variants={fadeInUp}>
              <LeadPreviewTable result={result} />
            </motion.div>

            <motion.div variants={fadeInUp} className="btn-actions">
              <Button variant="ghost" onClick={handleReset}>Cancel</Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleImport}
                loading={importing}
              >
                {!importing && <CheckIcon />} 
                {importing ? 'Importing…' : `Import ${totalLeads} Leads`}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
