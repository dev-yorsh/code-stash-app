import { invoke } from "@tauri-apps/api/core";
import type { SaveAssetInput, StoredAssetMeta } from "@/core/types";
import type { AssetRepository, ReadAssetResult } from "@/shared/api/contracts";

interface TauriReadAssetPayload {
  meta: StoredAssetMeta;
  bytes: number[];
}

export class TauriAssetRepository implements AssetRepository {
  async save(input: SaveAssetInput): Promise<StoredAssetMeta> {
    return invoke<StoredAssetMeta>("save_asset", {
      id: input.id,
      ext: input.ext,
      mimeType: input.mimeType,
      bytes: Array.from(input.bytes),
      width: input.width ?? null,
      height: input.height ?? null,
    });
  }

  async read(id: string): Promise<ReadAssetResult | null> {
    const res = await invoke<TauriReadAssetPayload | null>("read_asset", { id });
    if (!res) {
      return null;
    }
    return {
      meta: res.meta,
      bytes: new Uint8Array(res.bytes),
    };
  }

  async listMeta(): Promise<StoredAssetMeta[]> {
    return invoke<StoredAssetMeta[]>("list_assets");
  }

  async pruneOrphans(referencedIds: string[]): Promise<number> {
    return invoke<number>("prune_orphan_assets", { referencedIds });
  }
}
