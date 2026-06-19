import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { store } from './store';
import log from 'electron-log';

export function setupUpdater(win: BrowserWindow) {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', { version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('update-progress', { percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update-ready');
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
    // Fail silently — do not show error to user
  });

  // Check after 5s startup delay
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => { /* silent fail */ });
  }, 5000);
}

export function installUpdate() {
  autoUpdater.quitAndInstall();
}
