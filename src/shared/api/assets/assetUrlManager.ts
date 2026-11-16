import type { SaveAssetInput, StoredAssetMeta } from "@/core/types";
import type { AssetRepository } from "@/shared/api/contracts";
import { parseAssetUri, isValidAssetId, guessMimeTypeFromExt } from "./assetReferences";

const DEFAULT_MAX_LRU_URLS = 150;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export class AssetUrlManager {
  private repo: AssetRepository | null = null;
  private blobUrlCache = new Map<string, string>();
  private inflightRequests = new Map<string, Promise<string | null>>();
  private maxCacheSize: number;

  constructor(maxCacheSize = DEFAULT_MAX_LRU_URLS) {
    this.maxCacheSize = maxCacheSize;
  }

  setAssetRepository(repo: AssetRepository | null): void {
    if (this.repo === repo) {
      return;
    }
    this.clearCache();
    this.repo = repo;
  }

  getAssetRepository(): AssetRepository | null {
    return this.repo;
  }

  private normalizeAssetId(uriOrId: string): string | null {
    const parsed = parseAssetUri(uriOrId);
    if (parsed) {
      return parsed.id;
    }
    const clean = uriOrId.trim().toLowerCase();
    return isValidAssetId(clean) ? clean : null;
  }

  private touchLru(id: string, url: string): void {
    if (this.blobUrlCache.has(id)) {
      this.blobUrlCache.delete(id);
    }
    this.blobUrlCache.set(id, url);

    while (this.blobUrlCache.size > this.maxCacheSize) {
      const oldestKey = this.blobUrlCache.keys().next().value;
      if (!oldestKey) break;
      const oldestUrl = this.blobUrlCache.get(oldestKey);
      this.blobUrlCache.delete(oldestKey);
      if (oldestUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(oldestUrl);
      }
    }
  }

  getCachedBlobUrl(uriOrId: string): string | null {
    const id = this.normalizeAssetId(uriOrId);
    if (!id) return null;
    const existing = this.blobUrlCache.get(id);
    if (!existing) return null;
    this.touchLru(id, existing);
    return existing;
  }

  async saveAndCacheAsset(input: SaveAssetInput): Promise<StoredAssetMeta | null> {
    if (!this.repo) return null;
    const meta = await this.repo.save(input);
    if (
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function" &&
      !this.blobUrlCache.has(meta.id)
    ) {
      const safeBuffer = new Uint8Array(input.bytes).buffer;
      const blob = new Blob([safeBuffer], { type: meta.mimeType });
      const url = URL.createObjectURL(blob);
      this.touchLru(meta.id, url);
    }
    return meta;
  }

  async resolveAssetUrl(uriOrId: string): Promise<string | null> {
    if (!uriOrId) return null;
    if (uriOrId.startsWith("data:") || uriOrId.startsWith("blob:") || uriOrId.startsWith("http")) {
      return uriOrId;
    }

    const id = this.normalizeAssetId(uriOrId);
    if (!id) return null;

    const cached = this.getCachedBlobUrl(id);
    if (cached) return cached;

    if (!this.repo) return null;

    const existingPromise = this.inflightRequests.get(id);
    if (existingPromise) {
      return existingPromise;
    }

    const loadPromise = (async () => {
      try {
        const result = await this.repo?.read(id);
        if (!result || result.bytes.length === 0) {
          return null;
        }
        const mimeType =
          result.meta.mimeType || guessMimeTypeFromExt(result.meta.ext);

        if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
          const safeBuffer = new Uint8Array(result.bytes).buffer;
          const blob = new Blob([safeBuffer], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          this.touchLru(id, blobUrl);
          return blobUrl;
        }

        return `data:${mimeType};base64,${uint8ArrayToBase64(result.bytes)}`;
      } catch (err) {
        console.error(`Error resolving asset ${id}:`, err);
        return null;
      } finally {
        this.inflightRequests.delete(id);
      }
    })();

    this.inflightRequests.set(id, loadPromise);
    return loadPromise;
  }

  async resolveAssetAsDataUrl(uriOrId: string): Promise<string | null> {
    if (!uriOrId) return null;
    if (uriOrId.startsWith("data:")) return uriOrId;

    const id = this.normalizeAssetId(uriOrId);
    if (!id || !this.repo) return null;

    try {
      const result = await this.repo.read(id);
      if (!result || result.bytes.length === 0) {
        return null;
      }
      const mimeType =
        result.meta.mimeType || guessMimeTypeFromExt(result.meta.ext);
      return `data:${mimeType};base64,${uint8ArrayToBase64(result.bytes)}`;
    } catch (err) {
      console.error(`Error converting asset ${id} to data URL:`, err);
      return null;
    }
  }

  async resolveAllUrisToDataUrlMap(uris: Iterable<string>): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const uniqueUris = Array.from(new Set(uris)).filter(Boolean);
    await Promise.all(
      uniqueUris.map(async (uri) => {
        const dataUrl = await this.resolveAssetAsDataUrl(uri);
        if (dataUrl) {
          map.set(uri, dataUrl);
          const id = this.normalizeAssetId(uri);
          if (id) {
            map.set(id, dataUrl);
          }
        }
      })
    );
    return map;
  }

  clearCache(): void {
    if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      for (const url of this.blobUrlCache.values()) {
        URL.revokeObjectURL(url);
      }
    }
    this.blobUrlCache.clear();
    this.inflightRequests.clear();
  }
}

export const assetUrlManager = new AssetUrlManager();
