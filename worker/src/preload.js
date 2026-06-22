"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('desktopAPI', {
    // Auth
    connectWorker: (token) => electron_1.ipcRenderer.invoke('connect-worker', token),
    clearToken: () => electron_1.ipcRenderer.invoke('clear-token'),
    getConfig: () => electron_1.ipcRenderer.invoke('get-config'),
    // Scraping
    startScrape: (config) => electron_1.ipcRenderer.invoke('start-scraping', config),
    stopScraping: (sessionId) => electron_1.ipcRenderer.invoke('stop-scraping', sessionId),
    pauseScraping: () => electron_1.ipcRenderer.invoke('pause-scraping'),
    resumeCaptcha: () => electron_1.ipcRenderer.invoke('resume-captcha'),
    // Browser
    watchBrowser: () => electron_1.ipcRenderer.invoke('watch-browser'),
    openDashboard: () => electron_1.ipcRenderer.invoke('open-dashboard'),
    // Updates
    installUpdate: () => electron_1.ipcRenderer.invoke('install-update'),
    // Event listeners (renderer ← main)
    onAuthState: (cb) => electron_1.ipcRenderer.on('auth-state', (_e, d) => cb(d)),
    onStatus: (cb) => electron_1.ipcRenderer.on('scraping-status', (_e, d) => cb(d)),
    onLeadFound: (cb) => electron_1.ipcRenderer.on('lead-found', (_e, d) => cb(d)),
    onProgress: (cb) => electron_1.ipcRenderer.on('scraping-progress', (_e, d) => cb(d)),
    onQueueSize: (cb) => electron_1.ipcRenderer.on('queue-size', (_e, n) => cb(n)),
    onCaptcha: (cb) => electron_1.ipcRenderer.on('captcha-detected', () => cb()),
    onComplete: (cb) => electron_1.ipcRenderer.on('scraping-complete', (_e, d) => cb(d)),
    onError: (cb) => electron_1.ipcRenderer.on('scraping-error', (_e, d) => cb(d)),
    onUpdateAvailable: (cb) => electron_1.ipcRenderer.on('update-available', (_e, d) => cb(d)),
    onUpdateProgress: (cb) => electron_1.ipcRenderer.on('update-progress', (_e, d) => cb(d)),
    onUpdateReady: (cb) => electron_1.ipcRenderer.on('update-ready', () => cb()),
});
//# sourceMappingURL=preload.js.map