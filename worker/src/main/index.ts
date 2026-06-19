import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { store } from './store';
import { apiClient } from './api/client';
import { ScrapingEngine } from './scraper/engine';
import { setupUpdater } from './updater';

let mainWindow: BrowserWindow | null = null;
let engine: ScrapingEngine | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  900,
    height: 680,
    minWidth:  480,
    minHeight: 500,
    backgroundColor: '#111c1c',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload:          path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));
  }

  setupUpdater(mainWindow);
}

app.whenReady().then(async () => {
  createWindow();

  // On startup: verify stored token
  const token = store.get('workerToken');
  if (token) {
    try {
      await apiClient.post('/api/worker/ping');
      mainWindow?.webContents.send('auth-state', { state: 'idle', token });
    } catch {
      store.set('workerToken', '');
      mainWindow?.webContents.send('auth-state', { state: 'connect' });
    }
  } else {
    mainWindow?.webContents.send('auth-state', { state: 'connect' });
  }

  // Heartbeat every 30s
  setInterval(async () => {
    if (store.get('workerToken')) {
      try { await apiClient.post('/api/worker/ping'); } catch { /* ignore */ }
    }
  }, 30_000);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── IPC Handlers ─────────────────────────────────────────────────────────────────

ipcMain.handle('connect-worker', async (_e, token: string) => {
  store.set('workerToken', token);
  try {
    const res = await apiClient.post('/api/worker/ping');
    return { ok: true };
  } catch (err: any) {
    store.set('workerToken', '');
    return { ok: false, error: err.response?.data?.error || err.message };
  }
});

ipcMain.handle('get-config', async () => {
  try {
    const res = await apiClient.get('/api/worker/config');
    return { ok: true, data: res.data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('start-scraping', async (_e, config: { city: string; businessType: string; maxResults: number; scrapeReviews: boolean }) => {
  if (engine) return { ok: false, error: 'Already running' };

  try {
    // Create session
    const sessionRes = await apiClient.post('/api/worker/session/start', config);
    const sessionId = sessionRes.data.sessionId;

    engine = new ScrapingEngine();

    engine.on('status',    (data) => mainWindow?.webContents.send('scraping-status', data));
    engine.on('lead-found',(data) => mainWindow?.webContents.send('lead-found', data));
    engine.on('progress',  (data) => mainWindow?.webContents.send('scraping-progress', data));
    engine.on('queue-size',(n)    => mainWindow?.webContents.send('queue-size', n));
    engine.on('captcha-detected', () => mainWindow?.webContents.send('captcha-detected'));
    engine.on('complete',  async (data) => {
      mainWindow?.webContents.send('scraping-complete', data);
      await apiClient.post('/api/worker/session/end', {
        sessionId, leadsCollected: data.leadsCollected,
        reviewsCollected: data.reviewsCollected, endReason: 'completed', durationSeconds: 0,
      }).catch(() => {});
      engine = null;
    });
    engine.on('error', async (err) => {
      mainWindow?.webContents.send('scraping-error', { message: (err as Error).message });
      await apiClient.post('/api/worker/session/end', {
        sessionId, leadsCollected: 0, reviewsCollected: 0, endReason: 'error', durationSeconds: 0,
      }).catch(() => {});
      engine = null;
    });

    // Start in background
    engine.start({ ...config, sessionId }).catch(() => {});
    return { ok: true, sessionId };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('stop-scraping', async (_e, sessionId?: string) => {
  if (engine) {
    await engine.stop();
    engine = null;
    if (sessionId) {
      await apiClient.post('/api/worker/session/end', {
        sessionId, leadsCollected: 0, reviewsCollected: 0, endReason: 'stopped', durationSeconds: 0,
      }).catch(() => {});
    }
  }
  return { ok: true };
});

ipcMain.handle('resume-captcha', () => { engine?.resume(); return { ok: true }; });
ipcMain.handle('pause-scraping', () => { engine?.pause(); return { ok: true }; });

ipcMain.handle('watch-browser', async () => {
  // Bring the Playwright browser window to front
  // The browser window is managed by Playwright — we focus all non-main windows
  const wins = BrowserWindow.getAllWindows();
  wins.forEach(w => { if (w !== mainWindow) { w.show(); w.focus(); } });
  return { ok: true };
});

ipcMain.handle('clear-token', () => {
  store.set('workerToken', '');
  return { ok: true };
});

ipcMain.handle('open-dashboard', () => {
  shell.openExternal('https://app.autoreach.dev');
  return { ok: true };
});

ipcMain.handle('install-update', () => {
  const { installUpdate } = require('./updater');
  installUpdate();
});
