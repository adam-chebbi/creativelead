export const isDesktopApp = () => {
  if (typeof window === 'undefined') return false;
  
  // Detect Tauri or Electron environment variables
  const isTauri = !!(window as any).__TAURI__;
  const isElectron = !!(window as any).desktopAPI || !!(window as any).electron;
  
  return isTauri || isElectron;
};
