import type { Snippet } from "@/core/types";
import type { AssetRepository, SnippetRepository } from "@/shared/api/contracts";
import { extractAssetIdsFromSnippets } from "./assetReferences";

export async function pruneOrphanAssetsForSnippets(
  remainingSnippets: ReadonlyArray<Snippet>,
  assetRepo: AssetRepository | null | undefined
): Promise<number> {
  if (!assetRepo) return 0;
  try {
    const referencedIds = extractAssetIdsFromSnippets(remainingSnippets);
    return await assetRepo.pruneOrphans(referencedIds);
  } catch (err) {
    console.error("Failed pruning orphan assets:", err);
    return 0;
  }
}

export async function pruneOrphanAssetsFromRepositories(
  snippetRepo: SnippetRepository,
  assetRepo: AssetRepository | null | undefined
): Promise<number> {
  if (!assetRepo) return 0;
  try {
    const allSnippets = await snippetRepo.getAll();
    return await pruneOrphanAssetsForSnippets(allSnippets, assetRepo);
  } catch (err) {
    console.error("Failed collecting snippets for asset GC:", err);
    return 0;
  }
}
