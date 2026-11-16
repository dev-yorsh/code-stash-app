import { useMemo } from "react";
import { Snippet, Folder, Tag } from "@/core/types";
import { SpecialFilter } from "@/features/folders";
import { useTranslation } from "@/shared/i18n";
import { normalizeSearchText } from "@/core/utils/fragmentUtils";
import { stripAssetUrisForSearch } from "@/shared/api/assets/assetReferences";

export interface SnippetFilterParams {
  snippets: Snippet[];
  folders: Folder[];
  tags: Tag[];
  searchQuery: string;
  activeSpecialFilter: SpecialFilter;
  selectedFolderIds: ReadonlySet<string>;
  activeFolderId: string | null;
  activeTagId: string | null;
}

export interface SnippetCounts {
  all: number;
  favorites: number;
  uncategorized: number;
  trash: number;
  byFolder: Record<string, number>;
  byTag: Record<string, number>;
}

export interface UseSnippetFilterReturn {
  activeSnippets: Snippet[];
  trashedSnippets: Snippet[];
  filteredSnippets: Snippet[];
  counts: SnippetCounts;
  listTitle: string;
}

interface IndexedFragment {
  labelNorm: string;
  codeNorm: string;
  languageNorm: string;
}

interface IndexedSnippet {
  snippet: Snippet;
  index: number;
  titleNorm: string;
  descriptionNorm: string;
  codeNorm: string;
  languageNorm: string;
  folderNorm: string;
  tagsNorm: string[];
  fragmentsNorm: IndexedFragment[];
  fullSearchText: string;
}

export function useSnippetFilter({
  snippets,
  folders,
  tags,
  searchQuery,
  activeSpecialFilter,
  selectedFolderIds,
  activeFolderId,
  activeTagId,
}: SnippetFilterParams): UseSnippetFilterReturn {
  const { t } = useTranslation();

  const { activeSnippets, trashedSnippets } = useMemo(() => {
    const active: Snippet[] = [];
    const trashed: Snippet[] = [];
    for (let i = 0; i < snippets.length; i++) {
      if (snippets[i].is_deleted) trashed.push(snippets[i]);
      else active.push(snippets[i]);
    }
    return { activeSnippets: active, trashedSnippets: trashed };
  }, [snippets]);

  // Precompute normalized folder names including parent folder hierarchy
  const folderSearchMap = useMemo(() => {
    const rawMap = new Map<string, Folder>();
    for (let i = 0; i < folders.length; i++) {
      rawMap.set(folders[i].id, folders[i]);
    }

    const pathMap = new Map<string, string>();
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      const parts: string[] = [];
      let curr: Folder | undefined = folder;
      const visited = new Set<string>();
      while (curr && !visited.has(curr.id)) {
        visited.add(curr.id);
        parts.push(normalizeSearchText(curr.name));
        curr = curr.parent_id ? rawMap.get(curr.parent_id) : undefined;
      }
      pathMap.set(folder.id, parts.join(" "));
    }
    return pathMap;
  }, [folders]);

  // Pre-index all active snippets so keystroke filtering performs zero per-item normalization allocations
  const indexedActiveSnippets = useMemo<IndexedSnippet[]>(() => {
    const tagById = new Map<string, string>();
    for (let i = 0; i < tags.length; i++) {
      tagById.set(tags[i].id, normalizeSearchText(tags[i].name));
    }

    const result: IndexedSnippet[] = new Array(activeSnippets.length);
    for (let i = 0; i < activeSnippets.length; i++) {
      const s = activeSnippets[i];
      const titleNorm = normalizeSearchText(s.title);
      const descriptionNorm = normalizeSearchText(s.description);
      const codeNorm = normalizeSearchText(stripAssetUrisForSearch(s.code));
      const languageNorm = normalizeSearchText(s.language);
      const folderNorm = s.folder_id ? folderSearchMap.get(s.folder_id) || "" : "";

      const tagsNorm: string[] = [];
      if (s.tags) {
        for (let j = 0; j < s.tags.length; j++) {
          const tObj = s.tags[j];
          const tName = tagById.get(tObj.id) || normalizeSearchText(tObj.name);
          if (tName) tagsNorm.push(tName);
        }
      }

      const fragmentsNorm: IndexedFragment[] = [];
      const fragmentSearchParts: string[] = [];
      if (s.fragments && s.fragments.length > 0) {
        for (let f = 0; f < s.fragments.length; f++) {
          const frag = s.fragments[f];
          const labelNorm = normalizeSearchText(frag.label);
          const fragCodeNorm = normalizeSearchText(stripAssetUrisForSearch(frag.code));
          const fragLangNorm = normalizeSearchText(frag.language);
          fragmentsNorm.push({
            labelNorm,
            codeNorm: fragCodeNorm,
            languageNorm: fragLangNorm,
          });
          fragmentSearchParts.push(labelNorm, fragLangNorm, fragCodeNorm);
        }
      }

      const summarySearchNorm = s.search_text
        ? normalizeSearchText(s.search_text)
        : "";

      const fullSearchText = [
        titleNorm,
        descriptionNorm,
        folderNorm,
        tagsNorm.join(" "),
        languageNorm,
        codeNorm,
        fragmentSearchParts.join(" "),
        summarySearchNorm,
      ].join(" ");

      result[i] = {
        snippet: s,
        index: i,
        titleNorm,
        descriptionNorm,
        codeNorm,
        languageNorm,
        folderNorm,
        tagsNorm,
        fragmentsNorm,
        fullSearchText,
      };
    }
    return result;
  }, [activeSnippets, folderSearchMap, tags]);

  const filteredSnippets = useMemo(() => {
    const trimmedQuery = searchQuery.trim();

    // Global real-time search across all folders, snippets, fragments, tags, and content
    if (trimmedQuery) {
      const q = normalizeSearchText(trimmedQuery);
      const tokens = q.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return activeSnippets;

      const scored: { snippet: Snippet; score: number; index: number }[] = [];

      for (let i = 0; i < indexedActiveSnippets.length; i++) {
        const item = indexedActiveSnippets[i];

        let matchesAllTokens = true;
        for (let t = 0; t < tokens.length; t++) {
          if (!item.fullSearchText.includes(tokens[t])) {
            matchesAllTokens = false;
            break;
          }
        }
        if (!matchesAllTokens) continue;

        let score = 0;

        if (item.titleNorm === q) score += 1000;
        else if (item.titleNorm.startsWith(q)) score += 600;
        else if (item.titleNorm.includes(q)) score += 400;

        for (let f = 0; f < item.fragmentsNorm.length; f++) {
          const frag = item.fragmentsNorm[f];
          if (frag.labelNorm === q) score += 350;
          else if (frag.labelNorm.startsWith(q)) score += 260;
          else if (frag.labelNorm.includes(q)) score += 220;

          if (frag.codeNorm.includes(q)) score += 100;
          if (frag.languageNorm === q || frag.languageNorm.includes(q)) score += 80;
        }

        if (item.folderNorm === q) score += 300;
        else if (item.folderNorm.includes(q)) score += 200;

        for (let tg = 0; tg < item.tagsNorm.length; tg++) {
          if (item.tagsNorm[tg] === q) score += 280;
          else if (item.tagsNorm[tg].includes(q)) score += 180;
        }

        if (item.descriptionNorm.includes(q)) score += 150;
        if (item.languageNorm === q || item.languageNorm.includes(q)) score += 120;
        if (item.codeNorm.includes(q)) score += 100;

        if (tokens.length > 1) {
          for (let t = 0; t < tokens.length; t++) {
            const tok = tokens[t];
            if (item.titleNorm.includes(tok)) score += 50;
            if (item.folderNorm.includes(tok)) score += 35;
            if (item.descriptionNorm.includes(tok)) score += 25;
            if (item.codeNorm.includes(tok)) score += 15;
            for (let tg = 0; tg < item.tagsNorm.length; tg++) {
              if (item.tagsNorm[tg].includes(tok)) score += 35;
            }
            for (let f = 0; f < item.fragmentsNorm.length; f++) {
              const frag = item.fragmentsNorm[f];
              if (frag.labelNorm.includes(tok)) score += 40;
              if (frag.codeNorm.includes(tok)) score += 15;
            }
          }
        }

        scored.push({ snippet: item.snippet, score, index: item.index });
      }

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      });

      const finalResult: Snippet[] = new Array(scored.length);
      for (let i = 0; i < scored.length; i++) {
        finalResult[i] = scored[i].snippet;
      }
      return finalResult;
    }

    // Standard non-search filtering (tags, special filters, folders)
    if (activeTagId !== null) {
      return activeSnippets.filter((s) => s.tags?.some((t) => t.id === activeTagId));
    }

    if (activeSpecialFilter === "trash") {
      return trashedSnippets;
    }

    let baseList = activeSnippets;

    if (activeSpecialFilter === "favorites") {
      baseList = baseList.filter((s) => s.is_favorite);
    } else if (activeSpecialFilter === "uncategorized") {
      baseList = baseList.filter((s) => !s.folder_id);
    } else if (activeSpecialFilter === null) {
      if (selectedFolderIds.size > 0) {
        baseList = baseList.filter((s) => s.folder_id && selectedFolderIds.has(s.folder_id));
      } else if (activeFolderId) {
        baseList = baseList.filter((s) => s.folder_id === activeFolderId);
      }
    }

    return baseList;
  }, [
    activeSnippets,
    trashedSnippets,
    indexedActiveSnippets,
    searchQuery,
    activeSpecialFilter,
    selectedFolderIds,
    activeFolderId,
    activeTagId,
  ]);

  const counts: SnippetCounts = useMemo(() => {
    let favorites = 0;
    let uncategorized = 0;
    const byFolder: Record<string, number> = {};
    const byTag: Record<string, number> = {};

    for (let i = 0; i < folders.length; i++) {
      byFolder[folders[i].id] = 0;
    }
    for (let i = 0; i < tags.length; i++) {
      byTag[tags[i].id] = 0;
    }

    for (let i = 0; i < activeSnippets.length; i++) {
      const s = activeSnippets[i];
      if (s.is_favorite) favorites++;
      if (!s.folder_id) {
        uncategorized++;
      } else if (byFolder[s.folder_id] !== undefined) {
        byFolder[s.folder_id]++;
      }
      if (s.tags) {
        for (let j = 0; j < s.tags.length; j++) {
          const tid = s.tags[j].id;
          if (byTag[tid] !== undefined) {
            byTag[tid]++;
          }
        }
      }
    }

    return {
      all: activeSnippets.length,
      favorites,
      uncategorized,
      trash: trashedSnippets.length,
      byFolder,
      byTag,
    };
  }, [activeSnippets, trashedSnippets, folders, tags]);

  const listTitle = useMemo(() => {
    if (searchQuery.trim()) return t.snippetList.searchTitle(searchQuery);
    if (activeTagId) {
      const tagObj = tags.find((tag) => tag.id === activeTagId);
      return tagObj ? `#${tagObj.name}` : t.snippetList.tagFallback;
    }
    if (activeSpecialFilter === "trash") return t.sidebar.trash;
    if (activeSpecialFilter === "all") return t.sidebar.allSnippets;
    if (activeSpecialFilter === "favorites") return t.sidebar.favorites;
    if (activeSpecialFilter === "uncategorized") return t.sidebar.uncategorized;
    if (selectedFolderIds.size > 1) {
      return t.snippetList.foldersTitle;
    } else if (selectedFolderIds.size === 1) {
      const folderId = Array.from(selectedFolderIds)[0];
      const f = folders.find((fol) => fol.id === folderId);
      return f ? f.name : t.snippetList.folderFallback;
    } else if (activeFolderId) {
      const f = folders.find((fol) => fol.id === activeFolderId);
      return f ? f.name : t.snippetList.folderFallback;
    }
    return t.snippetList.snippetsTitle;
  }, [
    searchQuery,
    activeTagId,
    tags,
    activeSpecialFilter,
    selectedFolderIds,
    activeFolderId,
    folders,
    t,
  ]);

  return {
    activeSnippets,
    trashedSnippets,
    filteredSnippets,
    counts,
    listTitle,
  };
}
