import { SnippetRepository } from "./contracts/snippet.repository";
import { FolderRepository } from "./contracts/folder.repository";
import { TagRepository } from "./contracts/tag.repository";
import { AppWindowPort } from "./contracts/app-window.port";

import { TauriSnippetRepository } from "./tauri/tauri-snippet.repository";
import { TauriFolderRepository } from "./tauri/tauri-folder.repository";
import { TauriTagRepository } from "./tauri/tauri-tag.repository";
import { TauriWindowAdapter } from "./tauri/tauri-window.adapter";

import { FallbackSnippetRepository } from "./fallback/fallback-snippet.repository";
import { FallbackFolderRepository } from "./fallback/fallback-folder.repository";
import { FallbackTagRepository } from "./fallback/fallback-tag.repository";
import { FallbackWindowAdapter } from "./fallback/fallback-window.adapter";

import type { AssetRepository } from "./contracts";
import { TauriAssetRepository } from "./tauri/tauri-asset.repository";
import { FallbackAssetRepository } from "./assets/fallback-asset.repository";
import { ElectronAssetRepository } from "./assets/electron-asset.repository";
import { IndexedDbAssetRepository } from "./assets/indexeddb-asset.repository";
import { assetUrlManager } from "./assets/assetUrlManager";
import { IndexedDbSnippetRepository } from "./idb/idb-snippet.repository";
import { IndexedDbFolderRepository } from "./idb/idb-folder.repository";
import { IndexedDbTagRepository } from "./idb/idb-tag.repository";

export const isTauriEnvironment = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

export const isElectronEnvironment = (): boolean => {
  return typeof window !== "undefined" && "electronAPI" in window;
};

export const isIndexedDbAvailable = (): boolean => {
  return typeof indexedDB !== "undefined";
};

export interface RepositoryBundle {
  snippetRepository: SnippetRepository;
  folderRepository: FolderRepository;
  tagRepository: TagRepository;
  assetRepository: AssetRepository;
  appWindow: AppWindowPort;
}

export function createRepositories(): RepositoryBundle {
  if (isTauriEnvironment()) {
    const assetRepository = new TauriAssetRepository();
    assetUrlManager.setAssetRepository(assetRepository);
    return {
      snippetRepository: new TauriSnippetRepository(),
      folderRepository: new TauriFolderRepository(),
      tagRepository: new TauriTagRepository(),
      assetRepository,
      appWindow: new TauriWindowAdapter(),
    };
  }

  if (isIndexedDbAvailable()) {
    const assetRepository: AssetRepository =
      isElectronEnvironment() && window.electronAPI?.saveAsset
        ? new ElectronAssetRepository()
        : new IndexedDbAssetRepository();
    assetUrlManager.setAssetRepository(assetRepository);

    return {
      snippetRepository: new IndexedDbSnippetRepository(assetRepository),
      folderRepository: new IndexedDbFolderRepository(),
      tagRepository: new IndexedDbTagRepository(),
      assetRepository,
      appWindow: new FallbackWindowAdapter(),
    };
  }

  const assetRepository = new FallbackAssetRepository();
  assetUrlManager.setAssetRepository(assetRepository);

  return {
    snippetRepository: new FallbackSnippetRepository(assetRepository),
    folderRepository: new FallbackFolderRepository(),
    tagRepository: new FallbackTagRepository(),
    assetRepository,
    appWindow: new FallbackWindowAdapter(),
  };
}

export const {
  snippetRepository,
  folderRepository,
  tagRepository,
  assetRepository,
  appWindow,
} = createRepositories();
