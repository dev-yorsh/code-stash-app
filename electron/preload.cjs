const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  setWindowBackgroundColor: (color) => ipcRenderer.invoke('window-set-background-color', color),
  getAppearanceConfigPath: () => ipcRenderer.invoke('appearance-config-get-path'),
  readAppearanceConfig: () => ipcRenderer.invoke('appearance-config-read'),
  writeAppearanceConfig: (config) => ipcRenderer.invoke('appearance-config-write', config),
  openAppearanceConfigFile: () => ipcRenderer.invoke('appearance-config-open'),
  chooseThemeFile: () => ipcRenderer.invoke('appearance-config-choose-file'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  setSpellCheckConfig: (config) => ipcRenderer.invoke('spellcheck-set-config', config),
  isWordMisspelled: (word) => {
    try {
      return Boolean(word && webFrame?.isWordMisspelled?.(word));
    } catch {
      return false;
    }
  },
  getWordSuggestions: (word) => {
    try {
      return word && webFrame?.getWordSuggestions ? webFrame.getWordSuggestions(word) : [];
    } catch {
      return [];
    }
  },
  ignoreSpellCheckWord: (word) => ipcRenderer.invoke('spellcheck-ignore-word', word),
  addWordToDictionary: (word) => ipcRenderer.invoke('spellcheck-add-word', word),
  onSpellCheckConfigChanged: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('spellcheck-config-changed', handler);
    return () => ipcRenderer.removeListener('spellcheck-config-changed', handler);
  },
  executeEditCommand: (command) => ipcRenderer.invoke('editor-edit-command', command),
  writeRichClipboard: (payload) => ipcRenderer.invoke('clipboard-write-rich', payload),
  writeImageClipboard: (payload) => ipcRenderer.invoke('clipboard-write-image', payload),
  getBackupInfo: () => ipcRenderer.invoke('backup-get-info'),
  readAutoBackup: () => ipcRenderer.invoke('backup-read-auto'),
  writeAutoBackup: (content) => ipcRenderer.invoke('backup-sync-write', content),
  openBackupLocation: () => ipcRenderer.invoke('backup-open-location'),
  exportBackupFile: (payload) => ipcRenderer.invoke('backup-export-file', payload),
  chooseBackupImportFile: () => ipcRenderer.invoke('backup-choose-import-file'),
  exportBinaryBackupFile: (payload) => ipcRenderer.invoke('backup-export-binary-file', payload),
  chooseBinaryBackupImportFile: () => ipcRenderer.invoke('backup-choose-binary-import-file'),
  saveAsset: (payload) => ipcRenderer.invoke('asset-save', payload),
  readAsset: (id) => ipcRenderer.invoke('asset-read', id),
  listAssets: () => ipcRenderer.invoke('asset-list'),
  pruneOrphanAssets: (referencedIds) => ipcRenderer.invoke('asset-prune', referencedIds),
});
