import type { SaveAssetInput, StoredAssetMeta } from "@/core/types";
import type { AssetRepository, ReadAssetResult } from "@/shared/api/contracts";
import { isValidAssetId, sanitizeAssetExt, guessMimeTypeFromExt } from "./assetReferences";

interface InMemoryAssetEntry {
  meta: StoredAssetMeta;
  bytes: Uint8Array;
}

export class FallbackAssetRepository implements AssetRepository {
  private store = new Map<string, InMemoryAssetEntry>();

  async save(input: SaveAssetInput): Promise<StoredAssetMeta> {
    const cleanId = input.id.trim().toLowerCase();
    if (!isValidAssetId(cleanId)) {
      throw new Error("Identificador de asset inválido.");
    }

    const existing = this.store.get(cleanId);
    if (existing) {
      return existing.meta;
    }

    const cleanExt = sanitizeAssetExt(input.ext);
    const bytesCopy = new Uint8Array(input.bytes);
    const meta: StoredAssetMeta = {
      id: cleanId,
      ext: cleanExt,
      mimeType: input.mimeType || guessMimeTypeFromExt(cleanExt),
      sizeBytes: bytesCopy.byteLength,
      width: input.width,
      height: input.height,
      createdAt: new Date().toISOString(),
    };

    this.store.set(cleanId, { meta, bytes: bytesCopy });
    return meta;
  }

  async read(id: string): Promise<ReadAssetResult | null> {
    const cleanId = id.trim().toLowerCase();
    const found = this.store.get(cleanId);
    if (!found) {
      return null;
    }
    return {
      meta: found.meta,
      bytes: new Uint8Array(found.bytes),
    };
  }

  async listMeta(): Promise<StoredAssetMeta[]> {
    return Array.from(this.store.values()).map((entry) => entry.meta);
  }

  async pruneOrphans(referencedIds: string[]): Promise<number> {
    const keepSet = new Set(referencedIds.map((id) => id.trim().toLowerCase()));
    let removed = 0;
    for (const id of Array.from(this.store.keys())) {
      if (!keepSet.has(id)) {
        this.store.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  clearForTests(): void {
    this.store.clear();
  }
}
