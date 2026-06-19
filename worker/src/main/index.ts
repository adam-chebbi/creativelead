import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { store } from './store';
import { apiClient } from './api/client';
import { ScrapingEngine } from './scraper/engine';
import { setupUpdater } from './updater';

let mainWindow: BrowserWindow | null = null;
let engine: ScrapingEngine | null = null;
let currentSessionId: string | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:     900,
    height:    680,
    minWidth:  480,
    minHeight: 500,
    backgroundColor: '#111c1c',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      // preload lives in the same dist/main/ directory as index.js
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false, // required for electron-store in preload
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production: dist/main/index.js -> ../../src/renderer/index.html
    mainWindow.loadFile(
      path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html')
    );
  }

  setupUpdater(mainWindow);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Helper: send to renderer only when window is ready
function sendToRenderer(channel: string, data?: unknown) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send(channel, data);
    });
  } else {
    mainWindow.webContents.send(channel, data);
  }
}

app.whenReady().then(async () => {
  createWindow();

  // Verify stored token after window is ready
  const token = store.get('workerToken');
  if (token) {
    try {
      await apiClient.post('/api/worker/ping');
      sendToRenderer('auth-state', { state: 'idle' });
    } catch {
      store.set('workerToken', '');
      sendToRenderer('auth-state', { state: 'connect' });
    }
  } else {
    sendToRenderer('auth-state', { state: 'connect' });
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

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('connect-worker', async (_e, token: string) => {
  store.set('workerToken', token.trim());
  try {
    await apiClient.post('/api/worker/ping');
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

ipcMain.handle('start-scraping', async (
  _e,
  config: { city: string; businessType: string; maxResults: number; scrapeReviews: boolean }
) => {
  if (engine) return { ok: false, error: 'Scraping already running' };

  try {
    const sessionRes = await apiClient.post('/api/worker/session/start', config);
    const sessionId  = sessionRes.data.sessionId as string;
    currentSessionId = sessionId;

    engine = new ScrapingEngine();

    engine.on('status',           (d) => sendToRenderer('scraping-status',   d));
    engine.on('lead-found',       (d) => sendToRenderer('lead-found',        d));
    engine.on('progress',         (d) => sendToRenderer('scraping-progress', d));
    engine.on('queue-size',       (n) => sendToRenderer('queue-size',        n));
    engine.on('captcha-detected', ()  => sendToRenderer('captcha-detected'));

    engine.on('complete', async (data) => {
      sendToRenderer('scraping-complete', data);
      await apiClient.post('/api/worker/session/end', {
        sessionId,
        leadsCollected:   data.leadsCollected,
        reviewsCollected: data.reviewsCollected,
        endReason:        'completed',
        durationSeconds:  0,
      }).catch(() => {});
      engine = null;
      currentSessionId = null;
    });

    engine.on('error', async (err) => {
      sendToRenderer('scraping-error', { message: (err as Error).message });
      await apiClient.post('/api/worker/session/end', {
        sessionId,
        leadsCollected:   0,
        reviewsCollected: 0,
        endReason:        'error',
        durationSeconds:  0,
      }).catch(() => {});
      engine = null;
      currentSessionId = null;
    });

    // Run in background — do not await
    engine.start({ ...config, sessionId }).catch(() => {});
    return { ok: true, sessionId };
  } catch (err: any) {
    return { ok: false, error: err.response?.data?.error || err.message };
  }
});

ipcMain.handle('stop-scraping', async (_e, sessionId?: string) => {
  const sid = sessionId || currentSessionId;
  if (engine) {
    await engine.stop();
    engine = null;
  }
  if (sid) {
    await apiClient.post('/api/worker/session/end', {
      sessionId:        sid,
      leadsCollected:   0,
      reviewsCollected: 0,
      endReason:        'stopped',
      durationSeconds:  0,
    }).catch(() => {});
    currentSessionId = null;
  }
  return { ok: true };
});

ipcMain.handle('resume-captcha',  () => { engine?.resume(); return { ok: true }; });
ipcMain.handle('pause-scraping',  () => { engine?.pause();  return { ok: true }; });

ipcMain.handle('watch-browser', () => {
  // Playwright opens a separate OS window — bring all non-main windows to front
  BrowserWindow.getAllWindows().forEach(w => {
    if (w !== mainWindow) { w.show(); w.focus(); }
  });
  return { ok: true };
});

ipcMain.handle('clear-token', () => {
  store.set('workerToken', '');
  engine?.stop().catch(() => {});
  engine = null;
  return { ok: true };
});

ipcMain.handle('open-dashboard', () => {
  shell.openExternal('https://app.autoreach.dev');
  return { ok: true };
});

ipcMain.handle('install-update', () => {
  // Dynamic require avoids circular import at startup
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { installUpdate } = require('./updater') as typeof import('./updater');
  installUpdate();
});
