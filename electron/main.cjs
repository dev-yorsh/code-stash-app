const { app, BrowserWindow, ipcMain, Menu, shell, dialog, clipboard, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { setupWindowSpellChecker } = require('./spellcheck.cjs');

// Portable mode support: store user data and settings next to the portable executable
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  const portableDataDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
  app.setPath('userData', portableDataDir);
}

let mainWindow = null;

const BUILTIN_WINDOW_BACKGROUNDS = {
  'codestash-light-modern': '#F9F9F9',
  'codestash-spacegray': '#242e3a',
  'codestash-onedark': '#282c34',
  'one-dark': '#21252b',
};

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function getAppearanceConfigPath() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'appearance-config.json');
  }
  const baseDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
  return path.join(baseDir, 'appearance-config.json');
}

function readInitialAppearanceConfig() {
  try {
    const cfgPath = getAppearanceConfigPath();
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    }
  } catch (err) {
    console.warn('[AppearanceConfig Startup Read Warning]', err);
  }
  return null;
}

function resolveInitialWindowBackgroundColor(parsedCfg) {
  const themeId =
    parsedCfg && typeof parsedCfg.theme === 'string' ? parsedCfg.theme : 'codestash-onedark';
  if (BUILTIN_WINDOW_BACKGROUNDS[themeId]) {
    return BUILTIN_WINDOW_BACKGROUNDS[themeId];
  }
  if (parsedCfg && Array.isArray(parsedCfg.customThemes)) {
    const match = parsedCfg.customThemes.find((t) => t && t.id === themeId);
    const customBg = match?.colors?.editorPanelBg || match?.colors?.base;
    if (typeof customBg === 'string' && HEX_COLOR_RE.test(customBg.trim())) {
      return customBg.trim();
    }
  }
  return '#282c34';
}

function createWindow() {
  const initialConfig = readInitialAppearanceConfig();
  const initialBackgroundColor = resolveInitialWindowBackgroundColor(initialConfig);

  const win = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    center: true,
    frame: false,
    title: 'CodeStash',
    icon: path.join(__dirname, '../src-tauri/icons/icon.ico'),
    backgroundColor: initialBackgroundColor,
    show: false, // Prevents blank/black screen flash; only shows after initial DOM paint
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  // Reveal window smoothly as soon as the first paint is ready
  win.once('ready-to-show', () => {
    win.show();
  });

  // Fallback safety timeout in case ready-to-show is delayed
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
    }
  }, 3500);

  // Security: prevent rogue navigations away from local application origins
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const isLocal = isDev
      ? navigationUrl.startsWith('http://localhost:1420')
      : navigationUrl.startsWith('file://');
    if (!isLocal) {
      event.preventDefault();
      try {
        const parsed = new URL(navigationUrl);
        if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
          shell.openExternal(navigationUrl);
        }
      } catch (e) {
        console.error('[will-navigate] Invalid URL rejected:', navigationUrl, e);
      }
    }
  });

  // Security: prevent renderer from opening arbitrary secondary windows; open safely in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch (e) {
      console.error('[setWindowOpenHandler] Invalid URL rejected:', url, e);
    }
    return { action: 'deny' };
  });

  // Modern console-message event handler without deprecation warnings
  win.webContents.on('console-message', (event, ...args) => {
    const message = (event && typeof event === 'object' && 'message' in event) ? event.message : args[1];
    const sourceId = (event && typeof event === 'object' && 'sourceId' in event) ? event.sourceId : args[3];
    const line = (event && typeof event === 'object' && 'lineNumber' in event) ? event.lineNumber : args[2];
    console.log(`[Web Console] ${message || ''} (${sourceId || ''}:${line || ''})`);
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Web Load Error] Code: ${errorCode}, Description: ${errorDescription}`);
  });

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    // Clear Chromium cache in dev mode so modified files/exports are never stale
    win.webContents.session.clearCache();
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:1420').catch(() => {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  ipcMain.handle('window-minimize', () => {
    win.minimize();
  });

  ipcMain.handle('window-toggle-maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return win.isMaximized();
  });

  ipcMain.handle('window-close', () => {
    win.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return win.isMaximized();
  });

  ipcMain.handle('window-set-background-color', (_event, color) => {
    try {
      if (!win.isDestroyed() && typeof color === 'string' && HEX_COLOR_RE.test(color.trim())) {
        win.setBackgroundColor(color.trim());
        return { success: true };
      }
      return { success: false, error: 'Invalid background hex color' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- Appearance Configuration File, SpellCheck & Theme IPC ---
  const getConfigPath = getAppearanceConfigPath;
  const initialLanguage = initialConfig?.language === 'en' ? 'en' : 'es';

  const { applySpellCheckConfig, ignoreWord, addWordToDictionary } = setupWindowSpellChecker(win, {
    Menu,
    initialLanguage,
  });

  ipcMain.removeHandler('spellcheck-set-config');
  ipcMain.handle('spellcheck-set-config', (_event, config) => {
    return applySpellCheckConfig(config || {});
  });

  ipcMain.removeHandler('spellcheck-ignore-word');
  ipcMain.handle('spellcheck-ignore-word', (_event, word) => {
    return ignoreWord(word);
  });

  ipcMain.removeHandler('spellcheck-add-word');
  ipcMain.handle('spellcheck-add-word', (_event, word) => {
    return addWordToDictionary(word);
  });

  const ALLOWED_EDIT_COMMANDS = new Set(['cut', 'copy', 'paste', 'selectAll']);
  ipcMain.removeHandler('editor-edit-command');
  ipcMain.handle('editor-edit-command', (_event, command) => {
    if (!ALLOWED_EDIT_COMMANDS.has(command) || win.isDestroyed()) {
      return { success: false, error: 'Invalid command' };
    }
    win.webContents[command]();
    return { success: true };
  });

  ipcMain.removeHandler('clipboard-write-rich');
  ipcMain.handle('clipboard-write-rich', (_event, payload) => {
    try {
      const text = typeof payload?.text === 'string' ? payload.text : '';
      const html = typeof payload?.html === 'string' ? payload.html : '';
      if (html) {
        clipboard.write({ text, html });
      } else {
        clipboard.writeText(text);
      }
      return { success: true };
    } catch (err) {
      console.error('[Clipboard Write Rich Error]', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.removeHandler('clipboard-write-image');
  ipcMain.handle('clipboard-write-image', (_event, payload) => {
    try {
      const rawBytes = payload?.bytes;
      const dataUrl = typeof payload?.dataUrl === 'string' ? payload.dataUrl : '';
      let image = null;
      if (
        rawBytes &&
        (rawBytes instanceof Uint8Array || Buffer.isBuffer(rawBytes) || Array.isArray(rawBytes))
      ) {
        const buffer = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes);
        if (buffer.length > 0) {
          image = nativeImage.createFromBuffer(buffer);
        }
      } else if (dataUrl.startsWith('data:image/')) {
        image = nativeImage.createFromDataURL(dataUrl);
      }
      if (!image || image.isEmpty()) {
        return { success: false, error: 'Empty or unsupported image data' };
      }
      clipboard.writeImage(image);
      return { success: true };
    } catch (err) {
      console.error('[Clipboard Write Image Error]', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('appearance-config-get-path', () => {
    return getConfigPath();
  });

  ipcMain.handle('appearance-config-read', () => {
    try {
      const cfgPath = getConfigPath();
      if (!fs.existsSync(cfgPath)) {
        return { success: true, exists: false, path: cfgPath };
      }
      const raw = fs.readFileSync(cfgPath, 'utf8');
      const data = JSON.parse(raw);
      return { success: true, exists: true, data, path: cfgPath };
    } catch (err) {
      console.error('[AppearanceConfig Read Error]', err);
      return { success: false, error: err.message, path: getConfigPath() };
    }
  });

  ipcMain.handle('appearance-config-write', (event, configData) => {
    try {
      const cfgPath = getConfigPath();
      fs.writeFileSync(cfgPath, JSON.stringify(configData, null, 2), 'utf8');
      return { success: true, path: cfgPath };
    } catch (err) {
      console.error('[AppearanceConfig Write Error]', err);
      return { success: false, error: err.message, path: getConfigPath() };
    }
  });

  ipcMain.handle('appearance-config-open', () => {
    try {
      const cfgPath = getConfigPath();
      if (fs.existsSync(cfgPath)) {
        shell.showItemInFolder(cfgPath);
      } else {
        const baseDir = path.dirname(cfgPath);
        shell.openPath(baseDir);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('appearance-config-choose-file', async () => {
    try {
      const result = await dialog.showOpenDialog(win, {
        title: 'Seleccionar archivo de Tema JSON',
        buttonLabel: 'Importar Tema',
        filters: [
          { name: 'Archivos JSON', extensions: ['json'] },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const selectedPath = result.filePaths[0];
      const content = fs.readFileSync(selectedPath, 'utf8');
      return { canceled: false, filePath: selectedPath, content };
    } catch (err) {
      return { canceled: true, error: err.message };
    }
  });

  ipcMain.handle('open-external-url', async (event, url) => {
    try {
      if (typeof url !== 'string' || !url.trim()) {
        return { success: false, error: 'URL must be a non-empty string' };
      }
      const parsed = new URL(url);
      if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
        await shell.openExternal(url);
        return { success: true };
      }
      return { success: false, error: `Protocol ${parsed.protocol} is not allowed` };
    } catch (err) {
      console.error('[Open External URL Error]', err);
      return { success: false, error: err.message };
    }
  });

  // --- Backup & CRUD Auto-Synchronization IPC (NDJSON / JSONL) ---
  const getAutoBackupPath = () => {
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'codestash-backup.jsonl');
    }
    const baseDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
    return path.join(baseDir, 'codestash-backup.jsonl');
  };

  ipcMain.handle('backup-get-info', () => {
    try {
      const backupPath = getAutoBackupPath();
      if (!fs.existsSync(backupPath)) {
        return { success: true, exists: false, path: backupPath };
      }
      const stat = fs.statSync(backupPath);
      return {
        success: true,
        exists: true,
        path: backupPath,
        updatedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    } catch (err) {
      return { success: false, exists: false, path: getAutoBackupPath(), error: err.message };
    }
  });

  ipcMain.handle('backup-read-auto', () => {
    try {
      const backupPath = getAutoBackupPath();
      if (!fs.existsSync(backupPath)) {
        return { success: true, exists: false, path: backupPath };
      }
      const content = fs.readFileSync(backupPath, 'utf8');
      const stat = fs.statSync(backupPath);
      return {
        success: true,
        exists: true,
        path: backupPath,
        content,
        updatedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    } catch (err) {
      return { success: false, exists: false, path: getAutoBackupPath(), error: err.message };
    }
  });

  ipcMain.handle('backup-sync-write', (event, jsonlContent) => {
    try {
      const backupPath = getAutoBackupPath();
      const tmpPath = `${backupPath}.tmp`;
      fs.writeFileSync(tmpPath, jsonlContent, 'utf8');
      fs.renameSync(tmpPath, backupPath);
      const stat = fs.statSync(backupPath);
      return {
        success: true,
        path: backupPath,
        updatedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    } catch (err) {
      console.error('[Backup Sync Write Error]', err);
      return { success: false, path: getAutoBackupPath(), error: err.message };
    }
  });

  ipcMain.handle('backup-open-location', () => {
    try {
      const backupPath = getAutoBackupPath();
      if (fs.existsSync(backupPath)) {
        shell.showItemInFolder(backupPath);
      } else {
        shell.openPath(path.dirname(backupPath));
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backup-export-file', async (event, { content, defaultFileName }) => {
    try {
      const result = await dialog.showSaveDialog(win, {
        title: 'Exportar Copia de Seguridad CodeStash',
        defaultPath: defaultFileName || 'codestash-backup.jsonl',
        buttonLabel: 'Exportar',
        filters: [
          { name: 'CodeStash NDJSON Backup (.jsonl)', extensions: ['jsonl'] },
          { name: 'Archivo JSON (.json)', extensions: ['json'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      fs.writeFileSync(result.filePath, content, 'utf8');
      return { canceled: false, success: true, filePath: result.filePath };
    } catch (err) {
      return { canceled: false, success: false, error: err.message };
    }
  });

  ipcMain.handle('backup-choose-import-file', async () => {
    try {
      const result = await dialog.showOpenDialog(win, {
        title: 'Importar Copia de Seguridad CodeStash',
        buttonLabel: 'Seleccionar Copia',
        filters: [
          { name: 'Copias de Seguridad CodeStash (.jsonl, .json)', extensions: ['jsonl', 'json'] },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const selectedPath = result.filePaths[0];
      const content = fs.readFileSync(selectedPath, 'utf8');
      const fileName = path.basename(selectedPath);
      return { canceled: false, filePath: selectedPath, fileName, content };
    } catch (err) {
      return { canceled: false, error: err.message };
    }
  });
}

const { registerAssetAndBackupHandlers } = require('./assetStorage.cjs');

app.whenReady().then(() => {
  registerAssetAndBackupHandlers({
    ipcMain,
    dialog,
    app,
    BrowserWindow,
    getMainWindow: () => mainWindow,
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
