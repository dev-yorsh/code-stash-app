import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSnippetFilter } from "../useSnippetFilter";
import { Snippet, Folder, Tag } from "@/core/types";

describe("useSnippetFilter (Custom Hook)", () => {
  const folders: Folder[] = [
    { id: "f-1", name: "Backend", created_at: "2026-01-01" },
    { id: "f-2", name: "Frontend", created_at: "2026-01-01" },
  ];

  const tags: Tag[] = [
    { id: "t-1", name: "Rust", color: "#f74c00" },
    { id: "t-2", name: "React", color: "#61dafb" },
  ];

  const snippets: Snippet[] = [
    {
      id: "s-1",
      title: "Rust Actix Server",
      description: "High speed web server",
      code: "fn main() {}",
      language: "rust",
      folder_id: "f-1",
      tags: [tags[0]],
      is_favorite: true,
      is_deleted: false,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
    {
      id: "s-2",
      title: "React Hook",
      description: "Custom useDebounce hook",
      code: "export function useDebounce() {}",
      language: "typescript",
      folder_id: "f-2",
      tags: [tags[1]],
      is_favorite: false,
      is_deleted: false,
      created_at: "2026-01-02",
      updated_at: "2026-01-02",
    },
    {
      id: "s-3",
      title: "Uncategorized Utility",
      description: "String helper",
      code: "function capitalize() {}",
      language: "javascript",
      folder_id: null,
      tags: [],
      is_favorite: false,
      is_deleted: false,
      created_at: "2026-01-03",
      updated_at: "2026-01-03",
    },
    {
      id: "s-4",
      title: "Deleted Snippet",
      description: "Deprecated script",
      code: "rm -rf",
      language: "bash",
      folder_id: "f-1",
      tags: [],
      is_favorite: false,
      is_deleted: true,
      deleted_at: "2026-01-04",
      created_at: "2026-01-04",
      updated_at: "2026-01-04",
    },
  ];

  it("splits active and trashed snippets", () => {
    const { result } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );

    expect(result.current.activeSnippets).toHaveLength(3);
    expect(result.current.trashedSnippets).toHaveLength(1);
    expect(result.current.filteredSnippets).toHaveLength(3);
  });

  it("filters by search query across multiple fields", () => {
    // Search in description
    const { result: resDesc } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "actix",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resDesc.current.filteredSnippets).toHaveLength(1);
    expect(resDesc.current.filteredSnippets[0].id).toBe("s-1");

    // Search by folder name match
    const { result: resFolder } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "frontend",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resFolder.current.filteredSnippets).toHaveLength(1);
    expect(resFolder.current.filteredSnippets[0].id).toBe("s-2");
  });

  it("filters by special categories (favorites, uncategorized, trash)", () => {
    // Favorites
    const { result: resFav } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "",
        activeSpecialFilter: "favorites",
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resFav.current.filteredSnippets).toHaveLength(1);
    expect(resFav.current.filteredSnippets[0].id).toBe("s-1");

    // Uncategorized
    const { result: resUncat } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "",
        activeSpecialFilter: "uncategorized",
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resUncat.current.filteredSnippets).toHaveLength(1);
    expect(resUncat.current.filteredSnippets[0].id).toBe("s-3");

    // Trash
    const { result: resTrash } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "",
        activeSpecialFilter: "trash",
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resTrash.current.filteredSnippets).toHaveLength(1);
    expect(resTrash.current.filteredSnippets[0].id).toBe("s-4");
  });

  it("filters by folder and tags", () => {
    // Single folder
    const { result: resFolder } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: "f-1",
        activeTagId: null,
      })
    );
    expect(resFolder.current.filteredSnippets).toHaveLength(1);
    expect(resFolder.current.filteredSnippets[0].id).toBe("s-1");

    // Tag filter (even when positioned in another folder f-1, selecting tag t-2 returns snippet s-2 from f-2)
    const { result: resTag } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(["f-1"]),
        activeFolderId: "f-1",
        activeTagId: "t-2",
      })
    );
    expect(resTag.current.filteredSnippets).toHaveLength(1);
    expect(resTag.current.filteredSnippets[0].id).toBe("s-2");
    expect(resTag.current.listTitle).toBe("#React");
  });

  it("calculates accurate reactive counts", () => {
    const { result } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );

    expect(result.current.counts.all).toBe(3);
    expect(result.current.counts.favorites).toBe(1);
    expect(result.current.counts.uncategorized).toBe(1);
    expect(result.current.counts.trash).toBe(1);
    expect(result.current.counts.byFolder["f-1"]).toBe(1);
    expect(result.current.counts.byFolder["f-2"]).toBe(1);
    expect(result.current.counts.byTag["t-1"]).toBe(1);
  });

  it("computes proper list titles", () => {
    const { result: resSearch } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "rust",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resSearch.current.listTitle).toBe('Búsqueda: "rust"');

    const { result: resTrash } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "",
        activeSpecialFilter: "trash",
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resTrash.current.listTitle).toBe("Basurero");

    const { result: resFav } = renderHook(() =>
      useSnippetFilter({
        snippets,
        folders,
        tags,
        searchQuery: "",
        activeSpecialFilter: "favorites",
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resFav.current.listTitle).toBe("Favoritos");
  });

  it("performs global search across fragments, nested folders, and ignores active folder/tag selection when searching", () => {
    const nestedFolders: Folder[] = [
      ...folders,
      { id: "f-sub", name: "Microservicios", parent_id: "f-1", created_at: "2026-01-01" },
    ];

    const multiFragSnippets: Snippet[] = [
      ...snippets,
      {
        id: "s-5",
        title: "Docker Compose Stack",
        description: "Configuración de contenedores",
        code: "version: '3.8'",
        language: "yaml",
        folder_id: "f-sub",
        tags: [],
        is_favorite: false,
        is_deleted: false,
        created_at: "2026-01-05",
        updated_at: "2026-01-05",
        fragments: [
          {
            id: "frag-1",
            label: "docker-compose.yml",
            code: "version: '3.8'",
            language: "yaml",
          },
          {
            id: "frag-2",
            label: "nginx.conf",
            code: "proxy_pass http://localhost:8080;",
            language: "nginx",
          },
        ],
      },
    ];

    // 1. Search by secondary fragment code even while another folder ("f-2") and tag ("t-2") are passed
    const { result: resFragCode } = renderHook(() =>
      useSnippetFilter({
        snippets: multiFragSnippets,
        folders: nestedFolders,
        tags,
        searchQuery: "proxy_pass",
        activeSpecialFilter: "favorites",
        selectedFolderIds: new Set(["f-2"]),
        activeFolderId: "f-2",
        activeTagId: "t-2",
      })
    );
    expect(resFragCode.current.filteredSnippets).toHaveLength(1);
    expect(resFragCode.current.filteredSnippets[0].id).toBe("s-5");

    // 2. Search by secondary fragment label ("nginx.conf")
    const { result: resFragLabel } = renderHook(() =>
      useSnippetFilter({
        snippets: multiFragSnippets,
        folders: nestedFolders,
        tags,
        searchQuery: "nginx.conf",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resFragLabel.current.filteredSnippets).toHaveLength(1);
    expect(resFragLabel.current.filteredSnippets[0].id).toBe("s-5");

    // 3. Accent-insensitive + parent folder + multi-token search ("backend configuracion")
    const { result: resMultiToken } = renderHook(() =>
      useSnippetFilter({
        snippets: multiFragSnippets,
        folders: nestedFolders,
        tags,
        searchQuery: "backend configuracion",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resMultiToken.current.filteredSnippets).toHaveLength(1);
    expect(resMultiToken.current.filteredSnippets[0].id).toBe("s-5");
  });

  it("ignores codestash-asset:// SHA hashes during search while matching alt text and summary search_text", () => {
    const assetHash = "deadbeef".repeat(8);
    const mixedSnippets = [
      {
        id: "s-img",
        title: "Diagrama de Red",
        description: "",
        code: `![Topología Firewall](codestash-asset://${assetHash}.webp)`,
        language: "plaintext",
        folder_id: null,
        is_favorite: false,
        tags: [],
        created_at: "2026-11-15",
        updated_at: "2026-11-15",
      },
      {
        id: "s-summary-only",
        title: "Resumen sin cuerpo",
        description: "",
        code: "",
        language: "plaintext",
        folder_id: null,
        is_favorite: false,
        tags: [],
        is_summary: true,
        search_text: "resumen sin cuerpo kubernetes ingress",
        created_at: "2026-11-15",
        updated_at: "2026-11-15",
      },
    ];

    // Searching by SHA-256 hex fragment must NOT match the internal asset hash URI
    const { result: resHash } = renderHook(() =>
      useSnippetFilter({
        snippets: mixedSnippets,
        folders,
        tags,
        searchQuery: "deadbeef",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resHash.current.filteredSnippets).toHaveLength(0);

    // Searching by human image alt text matches
    const { result: resAlt } = renderHook(() =>
      useSnippetFilter({
        snippets: mixedSnippets,
        folders,
        tags,
        searchQuery: "topologia",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resAlt.current.filteredSnippets.map((s) => s.id)).toEqual(["s-img"]);

    // Searching body keywords against a lazy summary snippet matches search_text
    const { result: resSummary } = renderHook(() =>
      useSnippetFilter({
        snippets: mixedSnippets,
        folders,
        tags,
        searchQuery: "kubernetes ingress",
        activeSpecialFilter: null,
        selectedFolderIds: new Set(),
        activeFolderId: null,
        activeTagId: null,
      })
    );
    expect(resSummary.current.filteredSnippets.map((s) => s.id)).toEqual(["s-summary-only"]);
  });
});
