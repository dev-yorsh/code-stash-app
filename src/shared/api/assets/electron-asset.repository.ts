import type { SaveAssetInput, StoredAssetMeta } from "@/core/types";
import type { AssetRepository, ReadAssetResult } from "@/shared/api/contracts";

export class ElectronAssetRepository implements AssetRepository {
  async save(input: SaveAssetInput): Promise<StoredAssetMeta> {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api?.saveAsset) {
      throw new Error("Electron asset API unavailable.");
    }

    const result = await api.saveAsset({
      id: input.id,
      ext: input.ext,
      mimeType: input.mimeType,
      bytes: input.bytes,
      width: input.width,
      height: input.height,
    });

    if (!result.success || !result.meta) {
      throw new Error(result.error || "No se pudo guardar la imagen en disco.");
    }

    return result.meta;
  }

  async read(id: string): Promise<ReadAssetResult | null> {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api?.readAsset) {
      return null;
    }

    const result = await api.readAsset(id);
    if (!result.success || !result.exists || !result.meta || !result.bytes) {
      return null;
    }

    return {
      meta: result.meta,
      bytes:
        result.bytes instanceof Uint8Array
          ? result.bytes
          : new Uint8Array(result.bytes),
    };
  }

  async listMeta(): Promise<StoredAssetMeta[]> {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api?.listAssets) {
      return [];
    }

    const result = await api.listAssets();
    if (!result.success || !Array.isArray(result.assets)) {
      return [];
    }
    return result.assets;
  }

  async pruneOrphans(referencedIds: string[]): Promise<number> {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api?.pruneOrphanAssets) {
      return 0;
    }

    const result = await api.pruneOrphanAssets(referencedIds);
    return result.success ? result.removedCount : 0;
  }
}
