import { describe, it, expect, beforeEach } from "vitest";
import { FallbackSnippetRepository } from "../fallback/fallback-snippet.repository";
import { FallbackFolderRepository } from "../fallback/fallback-folder.repository";
import { FallbackTagRepository } from "../fallback/fallback-tag.repository";
import { createRepositories } from "../repository.factory";

describe("Repository Layer (Fallback Adapters)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("FallbackFolderRepository", () => {
    it("creates, retrieves, and updates folders", async () => {
      const repo = new FallbackFolderRepository();
      const initial = await repo.getAll();
      expect(initial.length).toBeGreaterThanOrEqual(1);

      const created = await repo.create("Frontend Architecture", "folder-tree");
      expect(created.name).toBe("Frontend Architecture");

      const updated = await repo.update(created.id, "Frontend & Design System");
      expect(updated.name).toBe("Frontend & Design System");

      await repo.delete(created.id);
      const afterDelete = await repo.getAll();
      expect(afterDelete.find((f) => f.id === created.id)).toBeUndefined();
    });
  });

  describe("FallbackTagRepository", () => {
    it("creates and retrieves tags", async () => {
      const repo = new FallbackTagRepository();
      const tag = await repo.create("react", "#61dafb");
      expect(tag.name).toBe("react");

      const all = await repo.getAll();
      expect(all.some((t) => t.name === "react")).toBe(true);

      const updated = await repo.update(tag.id, { name: "reactjs", color: "#5ccfe6" });
      expect(updated.name).toBe("reactjs");
      expect(updated.color).toBe("#5ccfe6");

      await repo.delete(tag.id);
      const after = await repo.getAll();
      expect(after.some((t) => t.id === tag.id)).toBe(false);
    });
  });

  describe("FallbackSnippetRepository", () => {
    it("manages snippet CRUD lifecycle", async () => {
      const repo = new FallbackSnippetRepository();

      const created = await repo.create({
        title: "Test Hook",
        code: "const useCounter = () => useState(0);",
        language: "typescript",
        description: "Simple counter hook",
      });

      expect(created.title).toBe("Test Hook");
      expect(created.code).toBe("const useCounter = () => useState(0);");

      const found = await repo.getById(created.id);
      expect(found).not.toBeNull();
      expect(found?.title).toBe("Test Hook");

      const updated = await repo.update(created.id, {
        title: "Updated Hook Title",
      });
      expect(updated.title).toBe("Updated Hook Title");

      // Soft delete
      await repo.delete(created.id);
      const activeSnippets = await repo.getFiltered({ is_deleted: false });
      expect(activeSnippets.some((s) => s.id === created.id)).toBe(false);

      const trashedSnippets = await repo.getFiltered({ is_deleted: true });
      expect(trashedSnippets.some((s) => s.id === created.id)).toBe(true);

      // Restore
      await repo.restore(created.id);
      const restored = await repo.getById(created.id);
      expect(restored?.is_deleted).toBe(false);

      // Toggle favorite
      const isFav = await repo.toggleFavorite(created.id);
      expect(typeof isFav).toBe("boolean");

      // Permanent delete
      await repo.permanentlyDelete(created.id);
      const permanentlyDeleted = await repo.getById(created.id);
      expect(permanentlyDeleted).toBeNull();
    });
  });

  describe("createRepositories factory", () => {
    it("returns all required repository contracts", () => {
      const bundle = createRepositories();
      expect(bundle.snippetRepository).toBeDefined();
      expect(bundle.folderRepository).toBeDefined();
      expect(bundle.tagRepository).toBeDefined();
      expect(bundle.appWindow).toBeDefined();
    });
  });
});
