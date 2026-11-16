import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFolderStore } from "../folder.store";
import { FolderRepository } from "@/shared/api/contracts/folder.repository";
import { Folder } from "@/core/types";

describe("useFolderStore (Domain Store)", () => {
  let mockFolders: Folder[];
  let mockRepo: FolderRepository;

  beforeEach(() => {
    mockFolders = [
      { id: "f-1", name: "Backend", created_at: "2026-01-01" },
      { id: "f-2", name: "Frontend", created_at: "2026-01-02" },
    ];

    mockRepo = {
      getAll: vi.fn().mockImplementation(async () => [...mockFolders]),
      create: vi.fn().mockImplementation(async (name, icon, parentId) => {
        const created: Folder = {
          id: `f-${Date.now()}`,
          name,
          icon: icon || "folder",
          parent_id: parentId || null,
          created_at: new Date().toISOString(),
        };
        mockFolders.push(created);
        return created;
      }),
      update: vi.fn().mockImplementation(async (id, input) => {
        const found = mockFolders.find((f) => f.id === id);
        if (!found) throw new Error("Not found");
        if (typeof input === "string") {
          found.name = input;
        } else {
          if (input.name !== undefined) found.name = input.name;
          if (input.parent_id !== undefined) found.parent_id = input.parent_id;
        }
        return found;
      }),
      delete: vi.fn().mockImplementation(async (id) => {
        mockFolders = mockFolders.filter((f) => f.id !== id);
      }),
    };
  });

  it("loads folders from repository into state", async () => {
    const useStore = createFolderStore(mockRepo);
    await useStore.getState().loadFolders();

    expect(useStore.getState().folders).toHaveLength(2);
    expect(useStore.getState().folders[0].name).toBe("Backend");
  });

  it("creates a new folder and sets it as active", async () => {
    const useStore = createFolderStore(mockRepo);
    await useStore.getState().loadFolders();

    const created = await useStore.getState().createFolder(null);

    expect(created.name).toBe("Carpeta sin título");
    expect(useStore.getState().folders).toHaveLength(3);
    expect(useStore.getState().activeFolderId).toBe(created.id);
    expect(useStore.getState().selectedFolderIds.has(created.id)).toBe(true);
  });

  it("renames an existing folder", async () => {
    const useStore = createFolderStore(mockRepo);
    await useStore.getState().loadFolders();

    await useStore.getState().renameFolder("f-1", "Golang Backend");

    const folder = useStore.getState().folders.find((f) => f.id === "f-1");
    expect(folder?.name).toBe("Golang Backend");
  });

  it("handles single selection and multiSelection toggle", async () => {
    const useStore = createFolderStore(mockRepo);
    await useStore.getState().loadFolders();

    // Single selection
    useStore.getState().selectFolder("f-1", false);
    expect(useStore.getState().activeFolderId).toBe("f-1");
    expect(useStore.getState().selectedFolderIds.size).toBe(1);

    // Multi-selection: add second folder
    useStore.getState().selectFolder("f-2", true);
    expect(useStore.getState().selectedFolderIds.size).toBe(2);
    expect(useStore.getState().selectedFolderIds.has("f-1")).toBe(true);
    expect(useStore.getState().selectedFolderIds.has("f-2")).toBe(true);

    // Multi-selection: toggle remove first folder
    useStore.getState().selectFolder("f-1", true);
    expect(useStore.getState().selectedFolderIds.size).toBe(1);
    expect(useStore.getState().selectedFolderIds.has("f-1")).toBe(false);
  });

  it("selects special category and clears folder selection", async () => {
    const useStore = createFolderStore(mockRepo);
    await useStore.getState().loadFolders();
    useStore.getState().selectFolder("f-1");

    useStore.getState().selectSpecial("favorites");
    expect(useStore.getState().activeSpecialFilter).toBe("favorites");
    expect(useStore.getState().activeFolderId).toBeNull();
    expect(useStore.getState().selectedFolderIds.size).toBe(0);
  });

  it("confirms folder deletion and calls onDeleted callback", async () => {
    const useStore = createFolderStore(mockRepo);
    await useStore.getState().loadFolders();

    const target = useStore.getState().folders[0];
    useStore.getState().requestDeleteFolder(target);
    expect(useStore.getState().foldersToDelete).toEqual([target]);

    const onDeleted = vi.fn().mockResolvedValue(undefined);
    await useStore.getState().confirmDeleteFolders(onDeleted);

    expect(mockRepo.delete).toHaveBeenCalledWith(target.id);
    expect(useStore.getState().folders).toHaveLength(1);
    expect(useStore.getState().foldersToDelete).toBeNull();
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });
});
