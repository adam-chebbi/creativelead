import React from 'react';
import { ChromeIcon, ZipIcon } from '@/components/icons';

export interface DownloadTool {
  id: string;
  icon: React.ReactNode;
  title: string;
  version: string;
  desc: string;
  features: string[];
  href?: string;
  label: string;
}

export const downloadTools: DownloadTool[] = [
  {
    id: 'extension-zip',
    icon: React.createElement(ZipIcon),
    title: 'CreativeLead Extension',
    version: 'v1.0 · Unpacked',
    desc: 'Lightweight in-browser extractor. Works directly inside your Google Maps tab for manual, session-based lead pulls. Unpacked source — for Load Unpacked install.',
    features: [
      'Up to 100 leads per session',
      'Sorts & extracts 20 newest reviews',
      'Local JSON export — no server required',
      'Resume from where you left off',
      'EN + FR locale support',
    ],
    href: '/downloads/creativelead-extension.zip',
    label: 'Download .zip',
  }
];
