import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTagStore } from "../tag.store";
import { TagRepository } from "@/shared/api/contracts/tag.repository";
import { Tag } from "@/core/types";

describe("useTagStore (Domain Store)", () => {
  let mockTags: Tag[];
  let mockRepo: TagRepository;

  beforeEach(() => {
    mockTags = [
      { id: "t-1", name: "rust", color: "#ffa659" },
      { id: "t-2", name: "react", color: "#61dafb" },
    ];

    mockRepo = {
      getAll: vi.fn().mockImplementation(async () => [...mockTags]),
      create: vi.fn().mockImplementation(async (name, color) => {
        const created: Tag = {
          id: `t-${Date.now()}`,
          name,
          color: color || "#ffcc66",
        };
        mockTags.push(created);
        return created;
      }),
      update: vi.fn().mockImplementation(async (id, updates) => {
        const idx = mockTags.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error("Tag not found");
        const updated: Tag = {
          ...mockTags[idx],
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.color ? { color: updates.color } : {}),
        };
        mockTags[idx] = updated;
        return updated;
      }),
      delete: vi.fn().mockImplementation(async (id) => {
        mockTags = mockTags.filter((t) => t.id !== id);
      }),
    };
  });

  it("loads tags from repository into state", async () => {
    const useStore = createTagStore(mockRepo);
    await useStore.getState().loadTags();

    expect(useStore.getState().tags).toHaveLength(2);
    expect(useStore.getState().tags[0].name).toBe("rust");
  });

  it("selects and toggles active tag", async () => {
    const useStore = createTagStore(mockRepo);
    useStore.getState().selectTag("t-1");
    expect(useStore.getState().activeTagId).toBe("t-1");

    useStore.getState().selectTag(null);
    expect(useStore.getState().activeTagId).toBeNull();
  });

  it("opens and closes tag modal", () => {
    const useStore = createTagStore(mockRepo);
    expect(useStore.getState().isTagModalOpen).toBe(false);

    useStore.getState().openTagModal();
    expect(useStore.getState().isTagModalOpen).toBe(true);

    useStore.getState().closeTagModal();
    expect(useStore.getState().isTagModalOpen).toBe(false);
  });

  it("creates a new tag and closes modal", async () => {
    const useStore = createTagStore(mockRepo);
    await useStore.getState().loadTags();

    useStore.getState().openTagModal();
    const created = await useStore.getState().createTag("typescript", "#3178c6");

    expect(created.name).toBe("typescript");
    expect(useStore.getState().tags).toHaveLength(3);
    expect(useStore.getState().isTagModalOpen).toBe(false);
  });

  it("deletes a tag and invokes onDeleted callback", async () => {
    const useStore = createTagStore(mockRepo);
    await useStore.getState().loadTags();
    useStore.getState().selectTag("t-1");

    const onDeleted = vi.fn();
    await useStore.getState().deleteTag("t-1", onDeleted);

    expect(mockRepo.delete).toHaveBeenCalledWith("t-1");
    expect(useStore.getState().tags).toHaveLength(1);
    expect(useStore.getState().activeTagId).toBeNull();
    expect(onDeleted).toHaveBeenCalledWith("t-1");
  });

  it("updates a tag name and color, invoking onUpdated callback", async () => {
    const useStore = createTagStore(mockRepo);
    await useStore.getState().loadTags();

    const onUpdated = vi.fn();
    const updated = await useStore.getState().updateTag(
      "t-1",
      { name: "rust-lang", color: "#f28779" },
      onUpdated
    );

    expect(updated.name).toBe("rust-lang");
    expect(updated.color).toBe("#f28779");
    expect(useStore.getState().tags.find((t) => t.id === "t-1")?.name).toBe("rust-lang");
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });
});
