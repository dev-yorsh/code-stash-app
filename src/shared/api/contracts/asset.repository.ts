import type { SaveAssetInput, StoredAssetMeta } from "@/core/types";

export interface ReadAssetResult {
  meta: StoredAssetMeta;
  bytes: Uint8Array;
}

export interface AssetRepository {
  save(input: SaveAssetInput): Promise<StoredAssetMeta>;
  read(id: string): Promise<ReadAssetResult | null>;
  listMeta(): Promise<StoredAssetMeta[]>;
  pruneOrphans(referencedIds: string[]): Promise<number>;
}
