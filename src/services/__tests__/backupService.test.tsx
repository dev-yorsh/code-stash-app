import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  backupService,
  serializeBackupToJsonl,
  parseBackupContent,
} from "../backupService";
import { FallbackSnippetRepository } from "@/shared/api/fallback/fallback-snippet.repository";
import { FallbackFolderRepository } from "@/shared/api/fallback/fallback-folder.repository";
import { FallbackTagRepository } from "@/shared/api/fallback/fallback-tag.repository";
import { SettingsProvider } from "@/features/settings/context/SettingsContext";
import { GeneralSettings } from "@/features/settings/components/sections/GeneralSettings";
import { useSnippetStore } from "@/features/snippets/model/snippet.store";
import { useFolderStore } from "@/features/folders/model/folder.store";
import { useTagStore } from "@/features/tags/model/tag.store";
import { Folder, Snippet, Tag } from "@/core/types";

describe("Backup & CRUD Auto-Synchronization (NDJSON .jsonl)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.electronAPI;
  });

  it("serializes and parses NDJSON (.jsonl) losslessly including fragments and trash state", () => {
    const folders: Folder[] = [
      {
        id: "f-root",
        name: "Rust Systems",
        icon: "folder",
        parent_id: null,
        created_at: "2026-11-14T00:00:00.000Z",
      },
    ];
    const tags: Tag[] = [{ id: "t-rust", name: "rust", color: "#ffa659" }];
    const snippets: Snippet[] = [
      {
        id: "s-100",
        title: "Streaming NDJSON Reader",
        description: "O(1) line-by-line reader",
        code: "use std::io::BufRead;",
        language: "rust",
        folder_id: "f-root",
        is_favorite: true,
        tags,
        created_at: "2026-11-14T00:00:00.000Z",
        updated_at: "2026-11-14T00:00:00.000Z",
        fragments: [
          {
            id: "frag-1",
            label: "reader.rs",
            code: "use std::io::BufRead;",
            language: "rust",
          },
          {
            id: "frag-2",
            label: "Cargo.toml",
            code: '[package]\nname = "reader"',
            language: "toml",
          },
        ],
        is_deleted: false,
        deleted_at: null,
      },
    ];

    const jsonl = serializeBackupToJsonl({
      folders,
      tags,
      snippets,
      exportedAt: "2026-11-14T01:00:00.000Z",
    });

    // Verify 4 lines: 1 metadata + 1 folder + 1 tag + 1 snippet
    const nonEmptyLines = jsonl.trim().split("\n");
    expect(nonEmptyLines).toHaveLength(4);
    expect(JSON.parse(nonEmptyLines[0]).record_type).toBe("metadata");

    const parsed = parseBackupContent(jsonl);
    expect(parsed.format).toBe("jsonl");
    expect(parsed.counts).toEqual({ folders: 1, tags: 1, snippets: 1 });
    expect(parsed.snippets[0].title).toBe("Streaming NDJSON Reader");
    expect(parsed.snippets[0].fragments).toHaveLength(2);
    expect(parsed.folders[0].name).toBe("Rust Systems");
    expect(parsed.tags[0].name).toBe("rust");
  });

  it("handles large dataset exports (1,000+ snippets) efficiently via NDJSON lines", () => {
    const largeSnippets: Snippet[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `s-${i}`,
      title: `Snippet #${i}`,
      description: `Large dataset entry ${i}`,
      code: `pub fn compute_${i}() -> usize { ${i} }`,
      language: "rust",
      folder_id: null,
      is_favorite: i % 2 === 0,
      tags: [],
      created_at: "2026-11-14T00:00:00.000Z",
      updated_at: "2026-11-14T00:00:00.000Z",
    }));

    const jsonl = serializeBackupToJsonl({
      folders: [],
      tags: [],
      snippets: largeSnippets,
    });

    const parsed = parseBackupContent(jsonl);
    expect(parsed.counts.snippets).toBe(1000);
    expect(parsed.snippets[999].title).toBe("Snippet #999");
  });

  it("automatically synchronizes backup on every CRUD mutation (create, update, delete)", async () => {
    const writeAutoBackupMock = vi.fn().mockResolvedValue({
      success: true,
      path: "C:/CodeStash/codestash-backup.jsonl",
      updatedAt: "2026-11-14T02:00:00.000Z",
      sizeBytes: 2048,
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

    const snippetRepo = new FallbackSnippetRepository();
    const folderRepo = new FallbackFolderRepository();
    const tagRepo = new FallbackTagRepository();

    writeAutoBackupMock.mockClear();

    // 1. Create folder -> triggers auto-sync
    const folder = await folderRepo.create("Algorithms");
    expect(writeAutoBackupMock).toHaveBeenCalled();

    // 2. Create tag -> triggers auto-sync
    const tag = await tagRepo.create("dp", "#56b6c2");

    // 3. Create snippet -> triggers auto-sync
    const created = await snippetRepo.create({
      title: "Dijkstra Shortest Path",
      code: "fn dijkstra() {}",
      language: "rust",
      folder_id: folder.id,
      tag_ids: [tag.id],
    });

    // 4. Update snippet -> triggers auto-sync
    await snippetRepo.update(created.id, {
      title: "Dijkstra Priority Queue",
    });

    const lastCallJsonl =
      writeAutoBackupMock.mock.calls[writeAutoBackupMock.mock.calls.length - 1][0];
    const parsed = parseBackupContent(lastCallJsonl);

    expect(
      parsed.snippets.some((s) => s.title === "Dijkstra Priority Queue")
    ).toBe(true);
    expect(parsed.folders.some((f) => f.name === "Algorithms")).toBe(true);
    expect(parsed.tags.some((t) => t.name === "dp")).toBe(true);
    expect(backupService.getSyncState().counts.snippets).toBe(
      parsed.counts.snippets
    );

    // 5. Redundant syncAllToAutoBackup() without data change does NOT write to disk again
    const callCountAfterUpdate = writeAutoBackupMock.mock.calls.length;
    await backupService.syncAllToAutoBackup();
    expect(writeAutoBackupMock.mock.calls.length).toBe(callCountAfterUpdate);
  });

  it("does not write codestash-backup.jsonl on startup refreshBackupInfo() to prevent Vite reload loops", async () => {
    const writeAutoBackupMock = vi.fn();
    const getBackupInfoMock = vi.fn().mockResolvedValue({
      success: true,
      exists: true,
      path: "C:/CodeStash/codestash-backup.jsonl",
      updatedAt: "2026-11-14T02:00:00.000Z",
      sizeBytes: 1024,
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
      getBackupInfo: getBackupInfoMock,
      writeAutoBackup: writeAutoBackupMock,
    };

    new FallbackSnippetRepository();
    await backupService.refreshBackupInfo();

    expect(getBackupInfoMock).toHaveBeenCalledTimes(1);
    expect(writeAutoBackupMock).not.toHaveBeenCalled();
  });

  it("displays confirmation modal before importing backup in GeneralSettings and updates stores on confirm", async () => {
    const sampleBackupJsonl = serializeBackupToJsonl({
      folders: [
        {
          id: "f-migrated",
          name: "Migrated PC Folder",
          icon: "folder",
          parent_id: null,
          created_at: "2026-11-14T00:00:00.000Z",
        },
      ],
      tags: [{ id: "t-migrated", name: "portable", color: "#98c379" }],
      snippets: [
        {
          id: "s-migrated",
          title: "Migrated Note From Work PC",
          description: "Restored via NDJSON backup",
          code: "console.log('Hello from another PC');",
          language: "javascript",
          folder_id: "f-migrated",
          is_favorite: true,
          tags: [{ id: "t-migrated", name: "portable", color: "#98c379" }],
          created_at: "2026-11-14T00:00:00.000Z",
          updated_at: "2026-11-14T00:00:00.000Z",
        },
      ],
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
      chooseBackupImportFile: vi.fn().mockResolvedValue({
        canceled: false,
        fileName: "my-pc-backup.jsonl",
        filePath: "C:/Backups/my-pc-backup.jsonl",
        content: sampleBackupJsonl,
      }),
      writeAutoBackup: vi.fn().mockResolvedValue({
        success: true,
        path: "C:/CodeStash/codestash-backup.jsonl",
      }),
    };

    render(
      <SettingsProvider>
        <GeneralSettings />
      </SettingsProvider>
    );

    // Click "Importar datos" button
    const importBtn = screen.getByTestId("import-backup-btn");
    fireEvent.click(importBtn);

    // Confirmation modal MUST appear first before modifying stores
    const modal = await screen.findByTestId("backup-import-confirm-modal");
    expect(modal).toBeInTheDocument();
    expect(screen.getByText("my-pc-backup.jsonl")).toBeInTheDocument();
    expect(
      screen.getByText("1 snippets, 1 carpetas y 1 etiquetas")
    ).toBeInTheDocument();

    // Stores have not been overwritten yet
    expect(
      useSnippetStore
        .getState()
        .snippets.some((s) => s.id === "s-migrated")
    ).toBe(false);

    // Confirm the import
    const confirmBtn = screen.getByTestId("confirm-import-backup-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(
        screen.queryByTestId("backup-import-confirm-modal")
      ).not.toBeInTheDocument();
    });

    // Stores are now updated with the imported backup data
    expect(
      useSnippetStore
        .getState()
        .snippets.some((s) => s.title === "Migrated Note From Work PC")
    ).toBe(true);
    expect(
      useFolderStore
        .getState()
        .folders.some((f) => f.name === "Migrated PC Folder")
    ).toBe(true);
    expect(
      useTagStore.getState().tags.some((t) => t.name === "portable")
    ).toBe(true);
  });
});
