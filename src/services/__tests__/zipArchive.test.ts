import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createZipArchive, isZipMagicBytes, readZipArchive } from "../zipArchive";
import { serializeBackupToZipBundle, parseZipBackupBytes } from "../backupBundle";
import {
  backupService,
  parseBackupContent,
  serializeBackupToJsonl,
} from "../backupService";
import { assetRepository } from "@/shared/api";
import { Folder, Snippet, Tag } from "@/core/types";

describe("zipArchive & Scalable Backups v2 (.codestash.zip)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.electronAPI;
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates and reads standard PKZIP archives with UTF-8 filenames (STORE)", async () => {
    const encoder = new TextEncoder();
    const zipBytes = await createZipArchive([
      {
        name: "manifest.json",
        data: encoder.encode('{"schema_version":2}'),
        compress: false,
      },
      {
        name: "notas/árbol-sintáctico.txt",
        data: encoder.encode("Contenido UTF-8 con tilde y ñ"),
        compress: false,
      },
      {
        name: "assets/0123456789abcdef0123456789abcdef.webp",
        data: new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]),
        compress: false,
      },
    ]);

    expect(isZipMagicBytes(zipBytes)).toBe(true);
    expect(isZipMagicBytes(encoder.encode('{"record_type":"metadata"}'))).toBe(false);

    const parsed = await readZipArchive(zipBytes);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].name).toBe("manifest.json");
    expect(parsed[1].name).toBe("notas/árbol-sintáctico.txt");
    expect(new TextDecoder().decode(parsed[1].data)).toBe("Contenido UTF-8 con tilde y ñ");
    expect(Array.from(parsed[2].data)).toEqual([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]);
  });

  it("compresses and decompresses large DEFLATE entries (>=128B) without stream backpressure deadlock", async () => {
    const encoder = new TextEncoder();
    const largeText = Array.from({ length: 400 }, (_, i) =>
      `{"record_type":"snippet","id":"s-${i}","title":"Snippet ${i}","code":"console.log(${i})"}`
    ).join("\n");

    const zipBytes = await createZipArchive([
      {
        name: "data.jsonl",
        data: encoder.encode(largeText),
        compress: true,
      },
    ]);

    expect(zipBytes.byteLength).toBeLessThan(encoder.encode(largeText).byteLength);
    const parsed = await readZipArchive(zipBytes);
    expect(parsed).toHaveLength(1);
    expect(new TextDecoder().decode(parsed[0].data)).toBe(largeText);
  });

  it("rejects corrupted ZIP archives when CRC-32 checksum mismatches", async () => {
    const encoder = new TextEncoder();
    const zipBytes = await createZipArchive([
      {
        name: "data.jsonl",
        data: encoder.encode("valid payload bytes"),
        compress: false,
      },
    ]);

    // Flip one byte inside the stored file payload ("valid payload bytes" starts after 30 + 10 bytes)
    const corrupted = new Uint8Array(zipBytes);
    corrupted[42] ^= 0xff;

    await expect(readZipArchive(corrupted)).rejects.toThrow(/CRC-32/i);
  });

  it("rejects zip-slip traversal paths in entry names", async () => {
    const encoder = new TextEncoder();
    await expect(
      createZipArchive([
        {
          name: "../outside/evil.txt",
          data: encoder.encode("nope"),
          compress: false,
        },
      ])
    ).rejects.toThrow(/ZIP/i);
  });

  it("round-trips a full .codestash.zip bundle with deduplicated referenced images", async () => {
    const assetA = "a".repeat(64);
    const assetUnused = "b".repeat(64);
    const bytesA = new Uint8Array([10, 20, 30, 40, 50]);
    const bytesUnused = new Uint8Array([99, 98, 97]);

    const folders: Folder[] = [
      { id: "f-notes", name: "Arquitectura", icon: "folder", parent_id: null, created_at: "2026-11-15T00:00:00Z" },
    ];
    const tags: Tag[] = [{ id: "t-img", name: "diagrama", color: "#56b6c2" }];
    const snippets: Snippet[] = [
      {
        id: "s-note-1",
        title: "Nota con Imagen",
        description: "Con diagrama adjunto",
        code: `Mira esto:\n\n![Arquitectura](codestash-asset://${assetA}.webp)`,
        language: "plaintext",
        folder_id: "f-notes",
        is_favorite: true,
        tags,
        has_images: true,
        created_at: "2026-11-15T00:00:00Z",
        updated_at: "2026-11-15T00:00:00Z",
      },
    ];

    const assetMap = new Map([
      [
        assetA,
        {
          meta: {
            id: assetA,
            ext: "webp",
            mimeType: "image/webp",
            sizeBytes: bytesA.byteLength,
            width: 800,
            height: 600,
            createdAt: "2026-11-15T00:00:00Z",
          },
          bytes: bytesA,
        },
      ],
      [
        assetUnused,
        {
          meta: {
            id: assetUnused,
            ext: "png",
            mimeType: "image/png",
            sizeBytes: bytesUnused.byteLength,
            createdAt: "2026-11-15T00:00:00Z",
          },
          bytes: bytesUnused,
        },
      ],
    ]);

    const jsonlContent = serializeBackupToJsonl({ folders, tags, snippets });
    const { zipBytes, counts } = await serializeBackupToZipBundle({
      folders,
      tags,
      snippets,
      jsonlContent,
      readAsset: async (id) => assetMap.get(id) ?? null,
    });

    expect(counts).toEqual({ folders: 1, tags: 1, snippets: 1, assets: 1 });

    const { bundle } = await parseZipBackupBytes(zipBytes, parseBackupContent);
    expect(bundle.format).toBe("codestash-zip");
    expect(bundle.counts).toEqual({ folders: 1, tags: 1, snippets: 1, assets: 1 });
    expect(bundle.snippets[0].code).toContain(`codestash-asset://${assetA}.webp`);
    expect(bundle.assets?.has(assetA)).toBe(true);
    expect(bundle.assets?.has(assetUnused)).toBe(false);
    expect(Array.from(bundle.assets?.get(assetA)?.bytes ?? [])).toEqual(Array.from(bytesA));
  });

  it("exports, selects, imports and prunes obsolete assets via backupService with ZIP bundle", async () => {
    const assetKeep = "c".repeat(64);
    const assetOld = "d".repeat(64);
    const keepBytes = new Uint8Array([1, 3, 5, 7, 9]);

    await assetRepository.save({
      id: assetOld,
      ext: "png",
      mimeType: "image/png",
      bytes: new Uint8Array([9, 8, 7]),
    });

    const folder: Folder = {
      id: "f-zip",
      name: "ZipFolder",
      icon: "folder",
      parent_id: null,
      created_at: "2026-11-15T00:00:00Z",
    };
    const snippet: Snippet = {
      id: "s-zip-1",
      title: "Imagen ZIP",
      code: `![pic](codestash-asset://${assetKeep}.webp)`,
      language: "plaintext",
      folder_id: "f-zip",
      is_favorite: false,
      tags: [],
      created_at: "2026-11-15T00:00:00Z",
      updated_at: "2026-11-15T00:00:00Z",
    };

    const jsonl = serializeBackupToJsonl({
      folders: [folder],
      tags: [],
      snippets: [snippet],
    });
    const { zipBytes } = await serializeBackupToZipBundle({
      folders: [folder],
      tags: [],
      snippets: [snippet],
      jsonlContent: jsonl,
      readAsset: async (id) =>
        id === assetKeep
          ? {
              meta: {
                id: assetKeep,
                ext: "webp",
                mimeType: "image/webp",
                sizeBytes: keepBytes.byteLength,
                createdAt: "2026-11-15T00:00:00Z",
              },
              bytes: keepBytes,
            }
          : null,
    });

    const chooseBinaryMock = vi.fn().mockResolvedValue({
      canceled: false,
      fileName: "migrated.codestash.zip",
      filePath: "C:/Backups/migrated.codestash.zip",
      bytes: zipBytes,
    });
    const exportBinaryMock = vi.fn().mockResolvedValue({
      canceled: false,
      success: true,
      filePath: "C:/Backups/exported.codestash.zip",
    });

    window.electronAPI = {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(),
      getAppearanceConfigPath: vi.fn(),
      readAppearanceConfig: vi.fn(),
      writeAppearanceConfig: vi.fn(),
      openAppearanceConfigFile: vi.fn(),
      chooseThemeFile: vi.fn(),
      openExternalUrl: vi.fn(),
      chooseBinaryBackupImportFile: chooseBinaryMock,
      exportBinaryBackupFile: exportBinaryMock,
      writeAutoBackup: vi.fn().mockResolvedValue({ success: true, path: "C:/CodeStash/b.jsonl" }),
    };

    // 1. Select & parse .codestash.zip import
    const selected = await backupService.selectBackupFileForImport();
    expect(selected.canceled).toBe(false);
    expect(selected.pending?.bundle.format).toBe("codestash-zip");
    expect(selected.pending?.bundle.counts.assets).toBe(1);

    // 2. Apply import restores keep asset & prunes assetOld
    await backupService.applyBackupImport(selected.pending!);
    const restoredAsset = await assetRepository.read(assetKeep);
    const prunedAsset = await assetRepository.read(assetOld);
    expect(Array.from(restoredAsset?.bytes ?? [])).toEqual(Array.from(keepBytes));
    expect(prunedAsset).toBeNull();

    // 3. Default export writes portable binary .codestash.zip
    const exported = await backupService.exportBackupFile();
    expect(exported.success).toBe(true);
    expect(exportBinaryMock).toHaveBeenCalledTimes(1);
    const exportedArg = exportBinaryMock.mock.calls[0][0];
    expect(exportedArg.defaultFileName).toMatch(/\.codestash\.zip$/);
    expect(isZipMagicBytes(exportedArg.bytes)).toBe(true);
  });

  it("propagates IPC errors from selectBackupFileForImport instead of treating them as silent cancel", async () => {
    window.electronAPI = {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(),
      getAppearanceConfigPath: vi.fn(),
      readAppearanceConfig: vi.fn(),
      writeAppearanceConfig: vi.fn(),
      openAppearanceConfigFile: vi.fn(),
      chooseThemeFile: vi.fn(),
      openExternalUrl: vi.fn(),
      chooseBinaryBackupImportFile: vi.fn().mockResolvedValue({
        canceled: false,
        error: "Permission denied reading backup file",
      }),
    };

    const resBinary = await backupService.selectBackupFileForImport();
    expect(resBinary.canceled).toBe(false);
    expect(resBinary.error).toBe("Permission denied reading backup file");

    window.electronAPI = {
      ...window.electronAPI,
      chooseBinaryBackupImportFile: undefined,
      chooseBackupImportFile: vi.fn().mockResolvedValue({
        canceled: true,
        error: "Disk I/O read failure",
      }),
    };

    const resLegacy = await backupService.selectBackupFileForImport();
    expect(resLegacy.canceled).toBe(false);
    expect(resLegacy.error).toBe("Disk I/O read failure");
  });

  it("debounces multiple scheduleAutoBackupSync calls into one write", async () => {
    vi.useFakeTimers();
    const writeAutoBackupMock = vi.fn().mockResolvedValue({
      success: true,
      path: "C:/CodeStash/codestash-backup.jsonl",
      sizeBytes: 512,
    });

    window.electronAPI = {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(),
      getAppearanceConfigPath: vi.fn(),
      readAppearanceConfig: vi.fn(),
      writeAppearanceConfig: vi.fn(),
      openAppearanceConfigFile: vi.fn(),
      chooseThemeFile: vi.fn(),
      openExternalUrl: vi.fn(),
      writeAutoBackup: writeAutoBackupMock,
    };

    window.localStorage.setItem(
      "codestash_snippets",
      JSON.stringify([
        {
          id: "s-debounced",
          title: "Debounced Note",
          code: "hello",
          language: "plaintext",
          is_favorite: false,
          tags: [],
          created_at: "2026-11-15T00:00:00Z",
          updated_at: "2026-11-15T00:00:00Z",
        },
      ])
    );

    backupService.scheduleAutoBackupSync(500);
    backupService.scheduleAutoBackupSync(500);
    backupService.scheduleAutoBackupSync(500);

    expect(writeAutoBackupMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(520);
    expect(writeAutoBackupMock).toHaveBeenCalledTimes(1);
  });
});
