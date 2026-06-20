import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopAPI', {
  // Auth
  connectWorker:  (token: string)  => ipcRenderer.invoke('connect-worker', token),
  clearToken:     ()               => ipcRenderer.invoke('clear-token'),
  getConfig:      ()               => ipcRenderer.invoke('get-config'),

  // Scraping
  startScrape:    (config: object) => ipcRenderer.invoke('start-scraping', config),
  stopScraping:   (sessionId?: string) => ipcRenderer.invoke('stop-scraping', sessionId),
  pauseScraping:  ()               => ipcRenderer.invoke('pause-scraping'),
  resumeCaptcha:  ()               => ipcRenderer.invoke('resume-captcha'),

  // Browser
  watchBrowser:   ()               => ipcRenderer.invoke('watch-browser'),
  openDashboard:  ()               => ipcRenderer.invoke('open-dashboard'),

  // Updates
  installUpdate:  ()               => ipcRenderer.invoke('install-update'),

  // Event listeners (renderer ← main)
  onAuthState:       (cb: (data: any) => void) => ipcRenderer.on('auth-state',        (_e, d) => cb(d)),
  onStatus:          (cb: (data: any) => void) => ipcRenderer.on('scraping-status',   (_e, d) => cb(d)),
  onLeadFound:       (cb: (data: any) => void) => ipcRenderer.on('lead-found',        (_e, d) => cb(d)),
  onProgress:        (cb: (data: any) => void) => ipcRenderer.on('scraping-progress', (_e, d) => cb(d)),
  onQueueSize:       (cb: (n: number) => void) => ipcRenderer.on('queue-size',        (_e, n) => cb(n)),
  onCaptcha:         (cb: () => void)          => ipcRenderer.on('captcha-detected',  () => cb()),
  onComplete:        (cb: (data: any) => void) => ipcRenderer.on('scraping-complete', (_e, d) => cb(d)),
  onError:           (cb: (data: any) => void) => ipcRenderer.on('scraping-error',    (_e, d) => cb(d)),
  onUpdateAvailable: (cb: (data: any) => void) => ipcRenderer.on('update-available',  (_e, d) => cb(d)),
  onUpdateProgress:  (cb: (data: any) => void) => ipcRenderer.on('update-progress',   (_e, d) => cb(d)),
  onUpdateReady:     (cb: () => void)          => ipcRenderer.on('update-ready',      () => cb()),
});
