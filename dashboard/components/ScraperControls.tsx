'use client';

import React, { useState, useEffect } from 'react';
import { isDesktopApp } from '../lib/env';

export default function ScraperControls() {
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    setIsDesktop(isDesktopApp());
  }, []);

  const handleStartScraping = () => {
    if (isDesktop) {
      // Dispatch event to local Desktop Shell (Tauri or Electron)
      if ((window as any).__TAURI__) {
         // Tauri invoke pattern here
         console.log('Invoking Tauri local scraper...');
      } else if ((window as any).desktopAPI) {
         (window as any).desktopAPI.startScrape();
      }
    } else {
      // In a real app this might open a modal with download links
      alert('Local scraping requires the Desktop App. Please download it to continue.');
    }
  };

  return (
    <div className="p-6 border rounded-lg shadow-sm bg-card text-card-foreground">
      <h3 className="text-lg font-bold mb-2">Scraping Engine</h3>
      {isDesktop ? (
        <p className="text-sm text-green-600 mb-4 dark:text-green-400">
          Desktop Environment Detected: Ready to leverage local resources.
        </p>
      ) : (
        <p className="text-sm text-amber-600 mb-4 dark:text-amber-400">
          Web Environment Detected: Scraping features require the Desktop App.
        </p>
      )}
      
      <button 
        onClick={handleStartScraping}
        className={`px-4 py-2 rounded-md font-semibold text-white transition-colors ${
          isDesktop 
            ? 'bg-blue-600 hover:bg-blue-700' 
            : 'bg-slate-700 hover:bg-slate-800'
        }`}
      >
        {isDesktop ? 'Start Local Scraping' : 'Download Desktop App to Scrape'}
      </button>
    </div>
  );
}
