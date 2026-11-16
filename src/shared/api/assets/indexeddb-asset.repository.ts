import type { SaveAssetInput, StoredAssetMeta } from "@/core/types";
import type { AssetRepository, ReadAssetResult } from "@/shared/api/contracts";
import {
  IDB_STORES,
  idbRequest,
  runIdbTransaction,
} from "@/shared/api/idb/codestashIndexedDb";
import {
  guessMimeTypeFromExt,
  isValidAssetId,
  sanitizeAssetExt,
} from "./assetReferences";

interface StoredBlobRecord {
  id: string;
  buffer: ArrayBuffer;
}

export class IndexedDbAssetRepository implements AssetRepository {
  async save(input: SaveAssetInput): Promise<StoredAssetMeta> {
    const cleanId = input.id.trim().toLowerCase();
    if (!isValidAssetId(cleanId)) {
      throw new Error("Identificador de asset SHA-256 inválido.");
    }

    const cleanExt = sanitizeAssetExt(input.ext);
    const copy = new Uint8Array(input.bytes);
    const meta: StoredAssetMeta = {
      id: cleanId,
      ext: cleanExt,
      mimeType: input.mimeType || guessMimeTypeFromExt(cleanExt),
      sizeBytes: copy.byteLength,
      width: input.width,
      height: input.height,
      createdAt: new Date().toISOString(),
    };

    return runIdbTransaction(
      [IDB_STORES.assetsMeta, IDB_STORES.assetsBlobs],
      "readwrite",
      async (tx) => {
        const metaStore = tx.objectStore(IDB_STORES.assetsMeta);
        const blobStore = tx.objectStore(IDB_STORES.assetsBlobs);
        const existingMeta = await idbRequest<StoredAssetMeta | undefined>(
          metaStore.get(cleanId)
        );
        if (existingMeta) {
          const existingBlob = await idbRequest<StoredBlobRecord | undefined>(
            blobStore.get(cleanId)
          );
          if (existingBlob) {
            return existingMeta;
          }
        }

        metaStore.put(meta);
        blobStore.put({ id: cleanId, buffer: copy.buffer } satisfies StoredBlobRecord);
        return meta;
      }
    );
  }

  async read(id: string): Promise<ReadAssetResult | null> {
    const cleanId = id.trim().toLowerCase();
    if (!isValidAssetId(cleanId)) {
      return null;
    }

    return runIdbTransaction(
      [IDB_STORES.assetsMeta, IDB_STORES.assetsBlobs],
      "readonly",
      async (tx) => {
        const meta = await idbRequest<StoredAssetMeta | undefined>(
          tx.objectStore(IDB_STORES.assetsMeta).get(cleanId)
        );
        const blobRecord = await idbRequest<StoredBlobRecord | undefined>(
          tx.objectStore(IDB_STORES.assetsBlobs).get(cleanId)
        );
        if (!meta || !blobRecord?.buffer) {
          return null;
        }
        return {
          meta,
          bytes: new Uint8Array(blobRecord.buffer),
        };
      }
    );
  }

  async listMeta(): Promise<StoredAssetMeta[]> {
    return runIdbTransaction(IDB_STORES.assetsMeta, "readonly", (tx) =>
      idbRequest<StoredAssetMeta[]>(tx.objectStore(IDB_STORES.assetsMeta).getAll())
    );
  }

  async pruneOrphans(referencedIds: string[]): Promise<number> {
    const keepSet = new Set(
      referencedIds
        .filter((id) => isValidAssetId(id))
        .map((id) => id.trim().toLowerCase())
    );

    return runIdbTransaction(
      [IDB_STORES.assetsMeta, IDB_STORES.assetsBlobs],
      "readwrite",
      async (tx) => {
        const metaStore = tx.objectStore(IDB_STORES.assetsMeta);
        const blobStore = tx.objectStore(IDB_STORES.assetsBlobs);
        const allMetas = await idbRequest<StoredAssetMeta[]>(metaStore.getAll());
        let removed = 0;

        for (const meta of allMetas) {
          if (!keepSet.has(meta.id)) {
            metaStore.delete(meta.id);
            blobStore.delete(meta.id);
            removed += 1;
          }
        }
        return removed;
      }
    );
  }
}
