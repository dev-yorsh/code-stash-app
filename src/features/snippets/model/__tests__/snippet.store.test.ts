import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSnippetStore } from "../snippet.store";
import { SnippetRepository } from "@/shared/api/contracts/snippet.repository";
import { Snippet, CreateSnippetInput } from "@/core/types";
import { useFormattingBarSessionStore } from "../../editor/model/formattingBarSession.store";

describe("useSnippetStore (Domain Store)", () => {
  let mockSnippets: Snippet[];
  let mockRepo: SnippetRepository;

  beforeEach(() => {
    mockSnippets = [
      {
        id: "s-1",
        title: "Snippet 1",
        code: "const a = 1;",
        language: "typescript",
        folder_id: "f-1",
        tags: [],
        is_favorite: false,
        is_deleted: false,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      {
        id: "s-2",
        title: "Snippet 2",
        code: "const b = 2;",
        language: "javascript",
        folder_id: "f-1",
        tags: [],
        is_favorite: true,
        is_deleted: false,
        created_at: "2026-01-02",
        updated_at: "2026-01-02",
      },
      {
        id: "s-3",
        title: "Snippet 3 (Trash)",
        code: "const c = 3;",
        language: "python",
        folder_id: null,
        tags: [],
        is_favorite: false,
        is_deleted: true,
        created_at: "2026-01-03",
        updated_at: "2026-01-03",
      },
    ];

    mockRepo = {
      getAll: vi.fn().mockImplementation(async () => [...mockSnippets]),
      getFiltered: vi.fn().mockImplementation(async () => [...mockSnippets]),
      getById: vi.fn().mockImplementation(async (id: string) => mockSnippets.find((s) => s.id === id) || null),
      create: vi.fn().mockImplementation(async (input: CreateSnippetInput) => {
        const created: Snippet = {
          id: `s-${Date.now()}`,
          title: input.title,
          description: input.description,
          code: input.code,
          language: input.language,
          folder_id: input.folder_id,
          tags: [],
          is_favorite: input.is_favorite || false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockSnippets.unshift(created);
        return created;
      }),
      update: vi.fn().mockImplementation(async (id, input) => {
        const found = mockSnippets.find((s) => s.id === id);
        if (!found) throw new Error("Not found");
        Object.assign(found, input);
        return { ...found };
      }),
      delete: vi.fn().mockImplementation(async (id) => {
        const found = mockSnippets.find((s) => s.id === id);
        if (found) found.is_deleted = true;
      }),
      deleteMany: vi.fn().mockImplementation(async (ids) => {
        for (const s of mockSnippets) {
          if (ids.includes(s.id)) s.is_deleted = true;
        }
      }),
      restore: vi.fn().mockImplementation(async (id) => {
        const found = mockSnippets.find((s) => s.id === id);
        if (found) {
          found.is_deleted = false;
          found.folder_id = null;
        }
      }),
      restoreMany: vi.fn().mockImplementation(async (ids) => {
        for (const s of mockSnippets) {
          if (ids.includes(s.id)) {
            s.is_deleted = false;
            s.folder_id = null;
          }
        }
      }),
      permanentlyDelete: vi.fn().mockImplementation(async (id) => {
        mockSnippets = mockSnippets.filter((s) => s.id !== id);
      }),
      permanentlyDeleteMany: vi.fn().mockImplementation(async (ids) => {
        mockSnippets = mockSnippets.filter((s) => !ids.includes(s.id));
      }),
      emptyTrash: vi.fn().mockImplementation(async () => {
        mockSnippets = mockSnippets.filter((s) => !s.is_deleted);
      }),
      toggleFavorite: vi.fn().mockImplementation(async (id) => {
        const found = mockSnippets.find((s) => s.id === id);
        if (found) found.is_favorite = !found.is_favorite;
        return found ? found.is_favorite : false;
      }),
      searchAll: vi.fn().mockImplementation(async () => ({
        snippets: [],
        folders: [],
        tags: [],
      })),
    };
  });

  it("loads snippets from repository and auto-selects first active snippet", async () => {
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();

    expect(useStore.getState().snippets).toHaveLength(3);
    expect(useStore.getState().selectedSnippetId).toBe("s-1");
    expect(useStore.getState().selectedSnippetIds.has("s-1")).toBe(true);
  });

  it("handles single selection, multi selection toggle, and range selection", async () => {
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();

    // Single selection
    useStore.getState().selectSnippet("s-2");
    expect(useStore.getState().selectedSnippetId).toBe("s-2");
    expect(useStore.getState().selectedSnippetIds.size).toBe(1);
    expect(useStore.getState().selectedSnippetIds.has("s-2")).toBe(true);

    // Multi-select toggle (Ctrl+Click)
    useStore.getState().selectSnippet("s-1", { isMulti: true });
    expect(useStore.getState().selectedSnippetIds.size).toBe(2);
    expect(useStore.getState().selectedSnippetIds.has("s-1")).toBe(true);
    expect(useStore.getState().selectedSnippetIds.has("s-2")).toBe(true);

    // Range selection (Shift+Click)
    const visible = useStore.getState().snippets;
    useStore.getState().selectSnippet("s-1"); // reset to s-1
    useStore.getState().selectSnippet("s-3", { isRange: true, visibleSnippets: visible });
    expect(useStore.getState().selectedSnippetIds.size).toBe(3);
  });

  it("handles selectAll and clearSelection", async () => {
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();

    useStore.getState().selectAll(useStore.getState().snippets);
    expect(useStore.getState().selectedSnippetIds.size).toBe(3);

    useStore.getState().clearSelection();
    expect(useStore.getState().selectedSnippetIds.size).toBe(0);
    expect(useStore.getState().selectedSnippetId).toBeNull();
  });

  it("creates a new snippet and selects it, arming pending toolbar reveal only for empty snippets", async () => {
    useFormattingBarSessionStore.getState().resetSession();
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();

    const createdCode = await useStore.getState().createSnippet({
      title: "New Code",
      code: "console.log('hi');",
      language: "typescript",
    });

    expect(createdCode.title).toBe("New Code");
    expect(useStore.getState().snippets[0].id).toBe(createdCode.id);
    expect(useStore.getState().selectedSnippetId).toBe(createdCode.id);
    expect(
      useFormattingBarSessionStore.getState().pendingRevealSnippetIds[createdCode.id]
    ).toBeUndefined();

    const createdEmpty = await useStore.getState().createSnippet({
      title: "Untitled Snippet",
      code: "",
      language: "plaintext",
    });

    expect(
      useFormattingBarSessionStore.getState().pendingRevealSnippetIds[createdEmpty.id]
    ).toBe(true);
  });

  it("updates snippet via updateSnippet", async () => {
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();

    await useStore.getState().updateSnippet("s-1", { title: "Updated Snippet 1" });
    const target = useStore.getState().snippets.find((s) => s.id === "s-1");
    expect(target?.title).toBe("Updated Snippet 1");
  });

  it("handles soft delete of a single snippet", async () => {
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();
    useStore.getState().selectSnippet("s-1");

    await useStore.getState().deleteSnippet("s-1");
    const target = useStore.getState().snippets.find((s) => s.id === "s-1");
    expect(target?.is_deleted).toBe(true);
    expect(useStore.getState().selectedSnippetId).toBeNull();
    expect(useStore.getState().selectedSnippetIds.has("s-1")).toBe(false);
  });

  it("handles batch delete request and confirmation", async () => {
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();

    useStore.getState().requestBatchDelete(["s-1", "s-2"]);
    expect(useStore.getState().batchSnippetIdsToDelete).toEqual(["s-1", "s-2"]);

    await useStore.getState().confirmBatchDelete();
    expect(useStore.getState().batchSnippetIdsToDelete).toBeNull();
    const s1 = useStore.getState().snippets.find((s) => s.id === "s-1");
    const s2 = useStore.getState().snippets.find((s) => s.id === "s-2");
    expect(s1?.is_deleted).toBe(true);
    expect(s2?.is_deleted).toBe(true);
  });

  it("restores snippets from trash to uncategorized", async () => {
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();

    await useStore.getState().restoreSnippets(["s-3"]);
    const s3 = useStore.getState().snippets.find((s) => s.id === "s-3");
    expect(s3?.is_deleted).toBe(false);
    expect(s3?.folder_id).toBeNull();
  });

  it("handles permanent delete", async () => {
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();

    useStore.getState().requestPermanentDelete(["s-3"]);
    expect(useStore.getState().permDeleteSnippetIds).toEqual(["s-3"]);

    await useStore.getState().confirmPermanentDelete();
    expect(useStore.getState().permDeleteSnippetIds).toBeNull();
    expect(useStore.getState().snippets.find((s) => s.id === "s-3")).toBeUndefined();
  });

  it("duplicates a snippet and toggles favorite", async () => {
    const useStore = createSnippetStore(mockRepo);
    await useStore.getState().loadSnippets();

    const target = useStore.getState().snippets[0];
    const duplicated = await useStore.getState().duplicateSnippet(target);
    expect(duplicated.title).toBe("Snippet 1 (Copy)");

    const isFav = await useStore.getState().toggleFavorite("s-1");
    expect(isFav).toBe(true);
    const s1 = useStore.getState().snippets.find((s) => s.id === "s-1");
    expect(s1?.is_favorite).toBe(true);
  });

  it("loads lightweight summaries lazily, hydrates on selection, caps LRU cache at 40, and hydrates before duplicate", async () => {
    const manyFullSnippets: Snippet[] = Array.from({ length: 45 }, (_, idx) => ({
      id: `lazy-${idx}`,
      title: `Lazy Note ${idx}`,
      code: `Full body content for #${idx}`,
      language: "plaintext",
      folder_id: "f-1",
      tags: [],
      is_favorite: false,
      is_deleted: false,
      created_at: "2026-11-15T00:00:00Z",
      updated_at: "2026-11-15T00:00:00Z",
    }));

    const lazyRepo: SnippetRepository = {
      ...mockRepo,
      getAll: vi.fn().mockResolvedValue(manyFullSnippets),
      getSummaries: vi.fn().mockResolvedValue(
        manyFullSnippets.map((s) => ({
          ...s,
          code: "",
          fragments: [],
          is_summary: true,
          search_text: `${s.title} ${s.code}`.toLowerCase(),
        }))
      ),
      getById: vi.fn().mockImplementation(async (id: string) =>
        manyFullSnippets.find((s) => s.id === id) ?? null
      ),
      create: vi.fn().mockImplementation(async (input: CreateSnippetInput) => ({
        id: `dup-${Date.now()}`,
        title: input.title,
        description: input.description,
        code: input.code,
        language: input.language,
        folder_id: input.folder_id,
        tags: [],
        is_favorite: Boolean(input.is_favorite),
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
    };

    const useStore = createSnippetStore(lazyRepo);
    await useStore.getState().loadSnippets();

    expect(lazyRepo.getSummaries).toHaveBeenCalledTimes(1);
    expect(useStore.getState().snippets).toHaveLength(45);
    // Non-selected snippets stay lightweight summaries until selected
    expect(useStore.getState().snippets[10].is_summary).toBe(true);
    expect(useStore.getState().snippets[10].code).toBe("");

    // Select & hydrate another snippet lazily
    useStore.getState().selectSnippet("lazy-10");
    await useStore.getState().hydrateSnippet("lazy-10");
    expect(useStore.getState().hydratedDetails["lazy-10"]?.code).toBe(
      "Full body content for #10"
    );

    // Duplicate a summary snippet must hydrate its full body before cloning
    const unhydratedSummary = useStore.getState().snippets[25];
    expect(unhydratedSummary.is_summary).toBe(true);
    const cloned = await useStore.getState().duplicateSnippet(unhydratedSummary);
    expect(cloned.code).toBe("Full body content for #25");

    // Hydrate all 45 items and confirm 40-slot LRU cache cap evicts oldest
    for (let i = 0; i < 45; i += 1) {
      await useStore.getState().hydrateSnippet(`lazy-${i}`);
    }
    expect(useStore.getState().hydratedOrder.length).toBeLessThanOrEqual(40);
    expect(Object.keys(useStore.getState().hydratedDetails).length).toBeLessThanOrEqual(40);
  });
});
