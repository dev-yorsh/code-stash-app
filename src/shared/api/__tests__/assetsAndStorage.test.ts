import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildAssetUri,
  extractAssetIdsFromSnippet,
  guessMimeTypeFromExt,
  hasAssetReferenceInSnippet,
  isValidAssetId,
  parseAssetUri,
  stripAssetUrisForSearch,
} from "../assets/assetReferences";
import { FallbackAssetRepository } from "../assets/fallback-asset.repository";
import { AssetUrlManager } from "../assets/assetUrlManager";
import { FallbackSnippetRepository } from "../fallback/fallback-snippet.repository";

describe("Asset References, Content-Addressed Store, LRU Manager & Safe GC", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("builds, parses, extracts and strips codestash-asset:// URIs cleanly", () => {
    const id1 = "a".repeat(64);
    const id2 = "b".repeat(64);
    const uri1 = buildAssetUri(id1, "webp");

    expect(uri1).toBe(`codestash-asset://${id1}.webp`);
    expect(parseAssetUri(uri1)).toEqual({ id: id1, ext: "webp" });
    expect(parseAssetUri("https://example.com/a.png")).toBeNull();
    expect(isValidAssetId("../etc/passwd")).toBe(false);
    expect(guessMimeTypeFromExt("webp")).toBe("image/webp");
    expect(guessMimeTypeFromExt(".svg")).toBe("image/svg+xml");

    const snippet = {
      code: `Intro\n![Foto diagrama](${uri1})`,
      fragments: [
        {
          code: `<img src="codestash-asset://${id2}.png" width="50%" />`,
        },
      ],
    };

    expect(hasAssetReferenceInSnippet(snippet)).toBe(true);
    expect(extractAssetIdsFromSnippet(snippet)).toEqual([id1, id2]);

    const cleanedSearch = stripAssetUrisForSearch(snippet.code);
    expect(cleanedSearch).toContain("Foto diagrama");
    expect(cleanedSearch).not.toContain(id1);
  });

  it("deduplicates writes, reads clones, and prunes unreferenced assets in FallbackAssetRepository", async () => {
    const repo = new FallbackAssetRepository();
    const idA = "1".repeat(64);
    const idB = "2".repeat(64);

    await repo.save({
      id: idA,
      ext: "webp",
      mimeType: "image/webp",
      bytes: new Uint8Array([1, 2, 3]),
      width: 100,
      height: 50,
    });
    // Duplicate save for same SHA-256 hash keeps original record
    await repo.save({
      id: idA,
      ext: "webp",
      mimeType: "image/webp",
      bytes: new Uint8Array([9, 9, 9]),
    });
    await repo.save({
      id: idB,
      ext: "png",
      mimeType: "image/png",
      bytes: new Uint8Array([4, 5, 6]),
    });

    const readA = await repo.read(idA);
    expect(Array.from(readA?.bytes ?? [])).toEqual([1, 2, 3]);
    expect(await repo.listMeta()).toHaveLength(2);

    const pruned = await repo.pruneOrphans([idB]);
    expect(pruned).toBe(1);
    expect(await repo.read(idA)).toBeNull();
    expect(await repo.read(idB)).not.toBeNull();
  });

  it("enforces LRU eviction with URL.revokeObjectURL and resolves URIs to base64 data URLs", async () => {
    const repo = new FallbackAssetRepository();
    const ids = ["a".repeat(64), "b".repeat(64), "c".repeat(64)];
    for (let i = 0; i < ids.length; i += 1) {
      await repo.save({
        id: ids[i],
        ext: "webp",
        mimeType: "image/webp",
        bytes: new Uint8Array([i + 1, i + 2, i + 3]),
      });
    }

    let counter = 0;
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation(() => `blob:test-${++counter}`);
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const manager = new AssetUrlManager(2);
    manager.setAssetRepository(repo);

    const u0 = await manager.resolveAssetUrl(buildAssetUri(ids[0], "webp"));
    const u1 = await manager.resolveAssetUrl(buildAssetUri(ids[1], "webp"));
    // Touch u0 so ids[1] becomes the least recently used entry
    expect(await manager.resolveAssetUrl(buildAssetUri(ids[0], "webp"))).toBe(u0);

    const u2 = await manager.resolveAssetUrl(buildAssetUri(ids[2], "webp"));
    expect(u2).toBe("blob:test-3");
    // Evicted u1 must have been revoked
    expect(revokeSpy).toHaveBeenCalledWith(u1);

    const dataMap = await manager.resolveAllUrisToDataUrlMap([
      buildAssetUri(ids[0], "webp"),
      buildAssetUri(ids[2], "webp"),
    ]);
    expect(dataMap.get(buildAssetUri(ids[0], "webp"))).toMatch(
      /^data:image\/webp;base64,/
    );

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    manager.clearCache();
  });

  it("preserves assets while snippet is in Trash and prunes ONLY when permanently deleted or shared nowhere", async () => {
    const assetRepo = new FallbackAssetRepository();
    const snippetRepo = new FallbackSnippetRepository(assetRepo);

    const sharedId = "e".repeat(64);
    const trashOnlyId = "f".repeat(64);

    await assetRepo.save({
      id: sharedId,
      ext: "webp",
      mimeType: "image/webp",
      bytes: new Uint8Array([11, 22]),
    });
    await assetRepo.save({
      id: trashOnlyId,
      ext: "webp",
      mimeType: "image/webp",
      bytes: new Uint8Array([33, 44]),
    });

    const s1 = await snippetRepo.create({
      title: "Active Owner",
      code: `![shared](codestash-asset://${sharedId}.webp)`,
      language: "plaintext",
    });
    const s2 = await snippetRepo.create({
      title: "Soon Deleted",
      code: `![shared](codestash-asset://${sharedId}.webp)\n\n![trash](codestash-asset://${trashOnlyId}.webp)`,
      language: "plaintext",
    });

    // 1. Soft delete moves to Trash -> BOTH assets must remain intact
    await snippetRepo.delete(s2.id);
    expect(await assetRepo.read(trashOnlyId)).not.toBeNull();
    expect(await assetRepo.read(sharedId)).not.toBeNull();

    // 2. Permanent delete -> trashOnlyId is pruned, sharedId stays because s1 still references it
    await snippetRepo.permanentlyDelete(s2.id);
    expect(await assetRepo.read(trashOnlyId)).toBeNull();
    expect(await assetRepo.read(sharedId)).not.toBeNull();

    // 3. Soft delete + emptyTrash removes last owner -> sharedId is now pruned
    await snippetRepo.delete(s1.id);
    await snippetRepo.emptyTrash();
    expect(await assetRepo.read(sharedId)).toBeNull();
  });
});
