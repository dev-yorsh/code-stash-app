const fs = require('fs');
const path = require('path');

const ASSET_ID_REGEX = /^[a-f0-9]{16,64}$/i;
const ASSET_EXT_REGEX = /^[a-z0-9]{2,8}$/i;
const INDEX_FILE_NAME = 'assets-index.json';

function isValidAssetId(id) {
  return typeof id === 'string' && ASSET_ID_REGEX.test(id.trim());
}

function sanitizeExt(ext, fallback = 'webp') {
  if (typeof ext !== 'string') return fallback;
  const clean = ext.trim().toLowerCase().replace(/^\./, '');
  return ASSET_EXT_REGEX.test(clean) ? clean : fallback;
}

function guessMimeFromExt(ext) {
  switch (sanitizeExt(ext, '')) {
    case 'webp':
      return 'image/webp';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function resolveInsideDir(dir, fileName) {
  const resolvedDir = path.resolve(dir);
  const resolvedTarget = path.resolve(resolvedDir, fileName);
  if (
    resolvedTarget !== resolvedDir &&
    !resolvedTarget.startsWith(resolvedDir + path.sep)
  ) {
    throw new Error('Ruta de recurso inválida.');
  }
  return resolvedTarget;
}

async function atomicWriteFile(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
  await fs.promises.writeFile(tempPath, data);
  await fs.promises.rename(tempPath, filePath);
}

function createAssetStorageService(getAssetsDir) {
  async function ensureDir() {
    const dir = getAssetsDir();
    await fs.promises.mkdir(dir, { recursive: true });
    return dir;
  }

  async function readIndex(dir) {
    const indexPath = resolveInsideDir(dir, INDEX_FILE_NAME);
    try {
      const raw = await fs.promises.readFile(indexPath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  async function writeIndex(dir, indexObj) {
    const indexPath = resolveInsideDir(dir, INDEX_FILE_NAME);
    await atomicWriteFile(indexPath, JSON.stringify(indexObj, null, 2));
  }

  async function findAssetFileById(dir, cleanId) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name === INDEX_FILE_NAME) continue;
      const dotIdx = entry.name.indexOf('.');
      const stem = dotIdx > 0 ? entry.name.slice(0, dotIdx) : entry.name;
      if (stem.toLowerCase() === cleanId) {
        const ext = dotIdx > 0 ? entry.name.slice(dotIdx + 1).toLowerCase() : 'webp';
        return {
          fileName: entry.name,
          ext: sanitizeExt(ext),
          filePath: resolveInsideDir(dir, entry.name),
        };
      }
    }
    return null;
  }

  async function saveAsset(payload) {
    if (!payload || !isValidAssetId(payload.id)) {
      return { success: false, error: 'Identificador de asset SHA-256 inválido.' };
    }

    const cleanId = payload.id.trim().toLowerCase();
    const cleanExt = sanitizeExt(payload.ext);
    const bytes = payload.bytes instanceof Uint8Array
      ? Buffer.from(payload.bytes.buffer, payload.bytes.byteOffset, payload.bytes.byteLength)
      : Buffer.from(payload.bytes || []);

    if (bytes.length === 0) {
      return { success: false, error: 'El asset binario está vacío.' };
    }

    const dir = await ensureDir();
    const index = await readIndex(dir);
    const fileName = `${cleanId}.${cleanExt}`;
    const filePath = resolveInsideDir(dir, fileName);

    const existing = index[cleanId];
    if (existing && fs.existsSync(filePath)) {
      return { success: true, meta: existing };
    }

    if (!fs.existsSync(filePath)) {
      await atomicWriteFile(filePath, bytes);
    }

    const meta = {
      id: cleanId,
      ext: existing?.ext || cleanExt,
      mimeType: payload.mimeType || existing?.mimeType || guessMimeFromExt(cleanExt),
      sizeBytes: bytes.length,
      width: typeof payload.width === 'number' ? payload.width : existing?.width,
      height: typeof payload.height === 'number' ? payload.height : existing?.height,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    index[cleanId] = meta;
    await writeIndex(dir, index);

    return { success: true, meta };
  }

  async function readAsset(id) {
    if (!isValidAssetId(id)) {
      return { success: false, exists: false, error: 'Identificador de asset inválido.' };
    }

    const cleanId = id.trim().toLowerCase();
    const dir = await ensureDir();
    const index = await readIndex(dir);
    const indexedMeta = index[cleanId];

    let filePath = null;
    let ext = indexedMeta?.ext ? sanitizeExt(indexedMeta.ext) : undefined;

    if (ext) {
      const candidate = resolveInsideDir(dir, `${cleanId}.${ext}`);
      if (fs.existsSync(candidate)) {
        filePath = candidate;
      }
    }

    if (!filePath) {
      const found = await findAssetFileById(dir, cleanId);
      if (found) {
        filePath = found.filePath;
        ext = found.ext;
      }
    }

    if (!filePath) {
      return { success: true, exists: false };
    }

    const buffer = await fs.promises.readFile(filePath);
    const resolvedExt = ext || 'webp';
    const meta = indexedMeta || {
      id: cleanId,
      ext: resolvedExt,
      mimeType: guessMimeFromExt(resolvedExt),
      sizeBytes: buffer.length,
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      exists: true,
      meta,
      bytes: new Uint8Array(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      ),
    };
  }

  async function listAssets() {
    const dir = await ensureDir();
    const index = await readIndex(dir);
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const assets = [];
    const seen = new Set();

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name === INDEX_FILE_NAME || entry.name.includes('.tmp-')) continue;
      const dotIdx = entry.name.indexOf('.');
      if (dotIdx <= 0) continue;
      const stem = entry.name.slice(0, dotIdx).toLowerCase();
      if (!isValidAssetId(stem)) continue;

      const ext = sanitizeExt(entry.name.slice(dotIdx + 1));
      const existing = index[stem];
      if (existing) {
        assets.push(existing);
      } else {
        const filePath = resolveInsideDir(dir, entry.name);
        const stat = await fs.promises.stat(filePath);
        assets.push({
          id: stem,
          ext,
          mimeType: guessMimeFromExt(ext),
          sizeBytes: stat.size,
          createdAt: stat.birthtime ? stat.birthtime.toISOString() : new Date().toISOString(),
        });
      }
      seen.add(stem);
    }

    // Remove stale index entries whose files no longer exist
    let dirty = false;
    for (const key of Object.keys(index)) {
      if (!seen.has(key)) {
        delete index[key];
        dirty = true;
      }
    }
    if (dirty) {
      await writeIndex(dir, index);
    }

    return { success: true, assets };
  }

  async function pruneOrphanAssets(referencedIds) {
    const keepSet = new Set(
      Array.isArray(referencedIds)
        ? referencedIds
            .filter((id) => isValidAssetId(id))
            .map((id) => id.trim().toLowerCase())
        : []
    );

    const dir = await ensureDir();
    const index = await readIndex(dir);
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    let removedCount = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name === INDEX_FILE_NAME || entry.name.includes('.tmp-')) continue;
      const dotIdx = entry.name.indexOf('.');
      const stem = (dotIdx > 0 ? entry.name.slice(0, dotIdx) : entry.name).toLowerCase();
      if (!isValidAssetId(stem)) continue;

      if (!keepSet.has(stem)) {
        const target = resolveInsideDir(dir, entry.name);
        await fs.promises.unlink(target);
        delete index[stem];
        removedCount += 1;
      }
    }

    for (const key of Object.keys(index)) {
      if (!keepSet.has(key)) {
        delete index[key];
      }
    }

    if (removedCount > 0) {
      await writeIndex(dir, index);
    }

    return { success: true, removedCount };
  }

  return {
    saveAsset,
    readAsset,
    listAssets,
    pruneOrphanAssets,
  };
}

function registerAssetAndBackupHandlers({
  ipcMain,
  dialog,
  app,
  BrowserWindow,
  getMainWindow,
}) {
  function getAssetsDir() {
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data', 'assets');
    }
    const baseDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
    return path.join(baseDir, 'data', 'assets');
  }

  function resolveParentWindow(event) {
    try {
      const fromSender =
        event?.sender && BrowserWindow?.fromWebContents
          ? BrowserWindow.fromWebContents(event.sender)
          : null;
      if (fromSender && !fromSender.isDestroyed()) {
        return fromSender;
      }
    } catch {
      // Fallback below
    }
    try {
      const explicit = typeof getMainWindow === 'function' ? getMainWindow() : null;
      if (explicit && !explicit.isDestroyed()) {
        return explicit;
      }
    } catch {
      // Fallback below
    }
    try {
      const focused = BrowserWindow?.getFocusedWindow?.();
      if (focused && !focused.isDestroyed()) {
        return focused;
      }
      const all = BrowserWindow?.getAllWindows?.();
      if (Array.isArray(all) && all.length > 0 && !all[0].isDestroyed()) {
        return all[0];
      }
    } catch {
      // Final fallback without parent window
    }
    return undefined;
  }

  const service = createAssetStorageService(getAssetsDir);

  const registerHandle = (channel, handler) => {
    if (typeof ipcMain.removeHandler === 'function') {
      ipcMain.removeHandler(channel);
    }
    ipcMain.handle(channel, handler);
  };

  registerHandle('asset-save', async (_event, payload) => {
    try {
      return await service.saveAsset(payload);
    } catch (err) {
      return { success: false, error: err?.message || 'Error al guardar recurso.' };
    }
  });

  registerHandle('asset-read', async (_event, id) => {
    try {
      return await service.readAsset(id);
    } catch (err) {
      return { success: false, exists: false, error: err?.message || 'Error al leer recurso.' };
    }
  });

  registerHandle('asset-list', async () => {
    try {
      return await service.listAssets();
    } catch (err) {
      return { success: false, assets: [], error: err?.message || 'Error al listar recursos.' };
    }
  });

  registerHandle('asset-prune', async (_event, referencedIds) => {
    try {
      return await service.pruneOrphanAssets(referencedIds);
    } catch (err) {
      return { success: false, removedCount: 0, error: err?.message || 'Error al limpiar recursos.' };
    }
  });

  registerHandle('backup-export-binary-file', async (event, payload) => {
    try {
      const { bytes, defaultFileName } = payload || {};
      const win = resolveParentWindow(event);
      const saveOptions = {
        title: 'Exportar copia de seguridad portable',
        defaultPath: defaultFileName || 'codestash-backup.codestash.zip',
        buttonLabel: 'Exportar',
        filters: [
          { name: 'CodeStash Bundle (.codestash.zip)', extensions: ['zip'] },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
      };
      const result = win
        ? await dialog.showSaveDialog(win, saveOptions)
        : await dialog.showSaveDialog(saveOptions);

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      const buffer = bytes instanceof Uint8Array
        ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : ArrayBuffer.isView(bytes)
          ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
          : Buffer.from(bytes || []);
      await atomicWriteFile(result.filePath, buffer);
      return { canceled: false, success: true, filePath: result.filePath };
    } catch (err) {
      console.error('[Backup Export Binary Error]', err);
      return { canceled: false, success: false, error: err?.message || 'Error al exportar.' };
    }
  });

  registerHandle('backup-choose-binary-import-file', async (event) => {
    try {
      const win = resolveParentWindow(event);
      const openOptions = {
        title: 'Importar copia de seguridad de CodeStash',
        buttonLabel: 'Seleccionar Copia',
        properties: ['openFile'],
        filters: [
          {
            name: 'Copias de Seguridad CodeStash (.zip, .jsonl, .json)',
            extensions: ['zip', 'jsonl', 'ndjson', 'json'],
          },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
      };
      const result = win
        ? await dialog.showOpenDialog(win, openOptions)
        : await dialog.showOpenDialog(openOptions);

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const filePath = result.filePaths[0];
      const buffer = await fs.promises.readFile(filePath);
      const isZipMagic = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
      const extLower = path.extname(filePath).toLowerCase();

      return {
        canceled: false,
        filePath,
        fileName: path.basename(filePath),
        bytes: new Uint8Array(
          buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        ),
        textContent: !isZipMagic && extLower !== '.zip' ? buffer.toString('utf8') : undefined,
      };
    } catch (err) {
      console.error('[Backup Choose Binary Import Error]', err);
      return { canceled: false, error: err?.message || 'Error al leer archivo.' };
    }
  });
}

module.exports = {
  createAssetStorageService,
  registerAssetAndBackupHandlers,
};
