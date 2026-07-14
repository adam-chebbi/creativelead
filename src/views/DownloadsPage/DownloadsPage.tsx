import React from 'react';
import { motion } from 'framer-motion';
import { downloadTools } from './downloadTools';
import { UploadIcon, DownloadIcon } from '@/components/icons';
import { Button, Card } from '@/components/ui';
import { fadeInUp, staggerContainer, defaultTransition } from '@/animations';

export const DownloadsPage: React.FC = () => {
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
            Extraction Tools
          </motion.div>
          <motion.h1 variants={fadeInUp} className="hero-title">
            Pick your tool,<br />
            <span>start extracting</span>
          </motion.h1>
          <motion.p variants={fadeInUp} className="hero-subtitle">
            Download the extension package to start extracting Google Maps leads locally in your browser.
          </motion.p>
        </motion.div>
      </div>

      <div className="page-content">
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Extraction Tools</h2>
            <p className="section-subtitle">Download and install the extension package manually.</p>
          </div>

          <motion.div 
            className="download-grid"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {downloadTools.map(tool => (
              <motion.div key={tool.id} variants={fadeInUp}>
                <Card className="download-card download-card-wrapper">
                  <div className="download-card-header">
                    <div className="download-card-icon">{tool.icon}</div>
                    <div>
                      <div className="download-card-title">{tool.title}</div>
                      <div className="download-card-version">{tool.version}</div>
                    </div>
                  </div>
                  <p className="download-card-desc download-card-link">{tool.desc}</p>
                  <ul className="download-card-features">
                    {tool.features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                  <a href={tool.href} download className="download-card-link">
                    <Button variant="primary" className="download-card-btn-wrapper">
                      <DownloadIcon />
                      {tool.label}
                    </Button>
                  </a>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* How it works */}
          <Card className="how-it-works-card">
            <h3 className="how-it-works-title">
              How it works
            </h3>
            <div className="how-it-works-grid">
              {[
                { step: '01', title: 'Extract', desc: 'Use the CreativeLead Extension on Google Maps' },
                { step: '02', title: 'Export', desc: 'Save as JSON — your data stays on your machine' },
                { step: '03', title: 'Import', desc: 'Upload to this site to load leads into the CRM' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="how-it-works-step">
                  <div className="how-it-works-number">
                    {step}
                  </div>
                  <div>
                    <div className="how-it-works-step-title">{title}</div>
                    <div className="how-it-works-step-desc">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="how-it-works-card" style={{ marginTop: '2rem' }}>
            <h3 className="how-it-works-title">
              How to Install
            </h3>
            <div className="how-it-works-grid">
              {[
                { step: '01', title: 'Extract ZIP', desc: 'Download the .zip file and extract it to a folder on your computer' },
                { step: '02', title: 'Extensions Page', desc: 'Open Chrome or Edge, go to the Extensions page (chrome://extensions), and enable "Developer mode"' },
                { step: '03', title: 'Load Unpacked', desc: 'Click "Load unpacked" and select the folder you just extracted' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="how-it-works-step">
                  <div className="how-it-works-number">
                    {step}
                  </div>
                  <div>
                    <div className="how-it-works-step-title">{title}</div>
                    <div className="how-it-works-step-desc">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};
