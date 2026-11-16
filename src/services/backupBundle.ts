import type { Folder, Snippet, Tag } from "@/core/types";
import type { ReadAssetResult } from "@/shared/api/contracts";
import {
  extractAssetIdsFromSnippets,
  guessMimeTypeFromExt,
  isValidAssetId,
  sanitizeAssetExt,
} from "@/shared/api/assets/assetReferences";
import { createZipArchive, readZipArchive, ZipEntryInput } from "./zipArchive";

export interface BackupCounts {
  folders: number;
  tags: number;
  snippets: number;
  assets?: number;
}

export interface BackupAssetBinary {
  id: string;
  ext: string;
  mimeType: string;
  bytes: Uint8Array;
  width?: number;
  height?: number;
}

export interface ParsedBackupBundle {
  format: "codestash-zip" | "jsonl" | "json";
  schemaVersion: number;
  exportedAt: string;
  folders: Folder[];
  tags: Tag[];
  snippets: Snippet[];
  assets?: Map<string, BackupAssetBinary>;
  counts: BackupCounts;
}

export interface PendingBackupImport {
  fileName: string;
  filePath?: string;
  rawContent: string;
  bundle: ParsedBackupBundle;
}

interface ManifestAssetEntry {
  id: string;
  ext: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  path?: string;
}

export interface BackupZipManifest {
  schema_version: number;
  format: "codestash-zip";
  app: "CodeStash";
  exported_at: string;
  counts: BackupCounts;
  assets: ManifestAssetEntry[];
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: false });
const ZIP_ASSET_ENTRY_REGEX = /^assets\/([a-f0-9]{16,64})(?:\.([a-z0-9]{2,8}))?$/i;

export async function serializeBackupToZipBundle(options: {
  folders: Folder[];
  tags: Tag[];
  snippets: Snippet[];
  exportedAt?: string;
  jsonlContent: string;
  readAsset: (id: string) => Promise<ReadAssetResult | null>;
}): Promise<{
  zipBytes: Uint8Array;
  counts: BackupCounts;
}> {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const referencedAssetIds = extractAssetIdsFromSnippets(options.snippets);

  const assetEntries: ZipEntryInput[] = [];
  const manifestAssets: ManifestAssetEntry[] = [];

  for (const rawId of referencedAssetIds) {
    const cleanId = rawId.trim().toLowerCase();
    if (!isValidAssetId(cleanId)) {
      continue;
    }

    const result = await options.readAsset(cleanId);
    if (!result || result.bytes.length === 0) {
      continue;
    }

    const ext = sanitizeAssetExt(result.meta.ext);
    const entryPath = `assets/${cleanId}.${ext}`;
    manifestAssets.push({
      id: cleanId,
      ext,
      mimeType: result.meta.mimeType || guessMimeTypeFromExt(ext),
      sizeBytes: result.bytes.byteLength,
      width: result.meta.width,
      height: result.meta.height,
      path: entryPath,
    });

    assetEntries.push({
      name: entryPath,
      data: result.bytes,
      compress: ext === "svg",
    });
  }

  const counts: BackupCounts = {
    folders: options.folders.length,
    tags: options.tags.length,
    snippets: options.snippets.length,
    assets: manifestAssets.length,
  };

  const manifest: BackupZipManifest = {
    schema_version: 2,
    format: "codestash-zip",
    app: "CodeStash",
    exported_at: exportedAt,
    counts,
    assets: manifestAssets,
  };

  const entries: ZipEntryInput[] = [
    {
      name: "manifest.json",
      data: textEncoder.encode(JSON.stringify(manifest, null, 2)),
      compress: true,
    },
    {
      name: "data.jsonl",
      data: textEncoder.encode(options.jsonlContent),
      compress: true,
    },
    ...assetEntries,
  ];

  const zipBytes = await createZipArchive(entries);
  return { zipBytes, counts };
}

function parseManifestAssetIndex(
  rawManifestBytes: Uint8Array | undefined
): Map<string, ManifestAssetEntry> {
  const map = new Map<string, ManifestAssetEntry>();
  if (!rawManifestBytes) return map;

  try {
    const parsed = JSON.parse(textDecoder.decode(rawManifestBytes)) as Partial<BackupZipManifest>;
    if (!Array.isArray(parsed.assets)) return map;

    for (const item of parsed.assets) {
      if (item && typeof item.id === "string") {
        map.set(item.id.toLowerCase(), item);
      }
    }
  } catch {
    // Manifest metadata is optional enrichment; catalog remains authoritative
  }
  return map;
}

export async function parseZipBackupBytes(
  zipBytes: Uint8Array,
  parseTextBackup: (rawContent: string) => ParsedBackupBundle
): Promise<{
  rawContent: string;
  bundle: ParsedBackupBundle;
}> {
  const entries = await readZipArchive(zipBytes);
  const entryMap = new Map<string, Uint8Array>();

  for (const entry of entries) {
    entryMap.set(entry.name.toLowerCase(), entry.data);
  }

  const catalogBytes =
    entryMap.get("data.jsonl") ??
    entries.find(
      (entry) =>
        !entry.name.startsWith("assets/") &&
        entry.name.toLowerCase() !== "manifest.json" &&
        /\.(jsonl|ndjson|json)$/i.test(entry.name)
    )?.data;

  if (!catalogBytes) {
    throw new Error("El archivo ZIP no contiene un catálogo data.jsonl válido.");
  }

  const rawContent = textDecoder.decode(catalogBytes);
  const parsedCatalog = parseTextBackup(rawContent);
  const manifestAssets = parseManifestAssetIndex(entryMap.get("manifest.json"));
  const assets = new Map<string, BackupAssetBinary>();

  for (const entry of entries) {
    const match = ZIP_ASSET_ENTRY_REGEX.exec(entry.name);
    if (!match) continue;

    const id = match[1].toLowerCase();
    if (!isValidAssetId(id) || assets.has(id)) continue;

    const meta = manifestAssets.get(id);
    const ext = sanitizeAssetExt(match[2] || meta?.ext || "webp");
    const mimeType = meta?.mimeType || guessMimeTypeFromExt(ext);

    assets.set(id, {
      id,
      ext,
      mimeType,
      bytes: entry.data,
      width: meta?.width,
      height: meta?.height,
    });
  }

  return {
    rawContent,
    bundle: {
      ...parsedCatalog,
      format: "codestash-zip",
      schemaVersion: Math.max(parsedCatalog.schemaVersion, 2),
      assets,
      counts: {
        ...parsedCatalog.counts,
        assets: assets.size,
      },
    },
  };
}
