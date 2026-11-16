import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { CustomTitlebar } from "@/core/layout/CustomTitlebar";
import { NavigationSidebar, useSidebarResize } from "@/features/navigation";
import { useFolderStore, FolderTree, FolderDeleteModal } from "@/features/folders";
import { useTagStore, TagList, TagModal } from "@/features/tags";
import {
  SnippetList,
  SnippetWorkspace,
  SnippetListPanel,
  BatchSnippetDeleteModal,
  PermanentDeleteModal,
  useSnippetStore,
  useSnippetFilter,
  useSnippetListResize,
} from "@/features/snippets";
import { SettingsModal, useSettings } from "@/features/settings";
import { CreateSnippetInput, UpdateSnippetInput, Snippet } from "@/core/types";
import { backupService } from "@/services/backupService";

function AppContent() {
  const { openSettings } = useSettings();

  // Left Sidebar width and resizing hook
  const { sidebarWidth, startResizing: startResizingSidebar } = useSidebarResize();

  // Middle Snippet List width and resizing hook
  const { listWidth, startResizing: startResizingList } = useSnippetListResize();

  // Folder domain store
  const {
    folders,
    activeFolderId,
    selectedFolderIds,
    activeSpecialFilter,
    editingFolderId,
    foldersToDelete,
    loadFolders,
    selectFolder,
    selectAllFolders,
    selectSpecial,
    setEditingFolderId,
    createFolder,
    renameFolder,
    requestDeleteFolder,
    requestDeleteFolders,
    clearFoldersToDelete,
    confirmDeleteFolders,
    moveFolder,
  } = useFolderStore();

  // Tag domain store
  const {
    tags,
    activeTagId,
    isTagModalOpen,
    loadTags,
    selectTag,
    openTagModal,
    closeTagModal,
    createTag,
    updateTag,
    deleteTag,
  } = useTagStore();

  // Snippet domain store
  const {
    snippets,
    selectedSnippetId,
    selectedSnippetIds,
    batchSnippetIdsToDelete,
    permDeleteSnippetIds,
    isCreating,
    setSnippets,
    loadSnippets,
    selectSnippet,
    selectAll: selectAllSnippets,
    clearSelection: clearSnippetSelection,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    requestBatchDelete,
    clearBatchDelete,
    confirmBatchDelete,
    restoreSnippets,
    requestPermanentDelete,
    clearPermanentDelete,
    confirmPermanentDelete,
    duplicateSnippet,
    toggleFavorite,
    softDeleteSnippets,
    updateSnippetFolder,
    hydratedDetails,
    hydrateSnippet,
  } = useSnippetStore();

  // Search (real-time synchronous filtering)
  const [searchQuery, setSearchQuery] = useState("");
  const lastSyncedSearchRef = useRef("");

  // Filtered snippets and counts computation
  const { filteredSnippets, counts, listTitle } = useSnippetFilter({
    snippets,
    folders,
    tags,
    searchQuery,
    activeSpecialFilter,
    selectedFolderIds,
    activeFolderId,
    activeTagId,
  });

  const handleSearchChange = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (q.trim()) {
        if (activeTagId !== null) {
          selectTag(null);
        }
        if (
          activeFolderId !== null ||
          selectedFolderIds.size > 0 ||
          activeSpecialFilter !== null
        ) {
          selectSpecial(null);
        }
      } else {
        if (
          activeTagId === null &&
          activeFolderId === null &&
          selectedFolderIds.size === 0 &&
          activeSpecialFilter === null
        ) {
          selectSpecial("all");
        }
      }
    },
    [
      activeTagId,
      activeFolderId,
      selectedFolderIds,
      activeSpecialFilter,
      selectTag,
      selectSpecial,
    ]
  );

  // Initial data load and backup metadata refresh (no disk write on mount)
  useEffect(() => {
    Promise.all([loadSnippets(), loadFolders(), loadTags()])
      .then(() => {
        void backupService.refreshBackupInfo();
      })
      .catch((err) => console.error("Failed to load initial data:", err));
  }, [loadSnippets, loadFolders, loadTags]);

  // Selection handlers
  const handleSelectSnippet = useCallback(
    (id: string, e?: React.MouseEvent) => {
      const isMulti = Boolean(e && (e.ctrlKey || e.metaKey));
      const isRange = Boolean(e && e.shiftKey);
      selectSnippet(id, { isMulti, isRange, visibleSnippets: filteredSnippets });
    },
    [selectSnippet, filteredSnippets]
  );

  const handleSelectAllSnippets = useCallback(() => {
    selectAllSnippets(filteredSnippets);
  }, [selectAllSnippets, filteredSnippets]);

  // Folder selection handlers
  const handleSelectFolder = useCallback(
    (id: string, e?: React.MouseEvent) => {
      const isMulti = Boolean(e && (e.ctrlKey || e.metaKey));
      selectTag(null);
      selectFolder(id, isMulti);
      setSearchQuery("");
      clearSnippetSelection();
    },
    [selectTag, selectFolder, clearSnippetSelection]
  );

  const handleSelectAllFolders = useCallback(() => {
    selectTag(null);
    selectAllFolders();
    clearSnippetSelection();
  }, [selectTag, selectAllFolders, clearSnippetSelection]);

  // Snippet CRUD handlers
  const handleNewSnippet = useCallback(async () => {
    try {
      const newSnippetInput: CreateSnippetInput = {
        title: "Untitled Snippet",
        description: "",
        code: "",
        language: "plaintext",
        folder_id: activeFolderId || null,
        tag_ids: [],
      };
      await createSnippet(newSnippetInput);
      if (activeSpecialFilter === "trash") {
        selectSpecial("all");
      }
    } catch (err) {
      console.error("Failed to create new snippet:", err);
    }
  }, [activeFolderId, activeSpecialFilter, createSnippet, selectSpecial]);

  const handleAutoSaveSnippet = useCallback(
    async (
      data: CreateSnippetInput | UpdateSnippetInput,
      existingId: string | null
    ): Promise<Snippet> => {
      if (existingId) {
        return updateSnippet(existingId, data);
      } else {
        return createSnippet(data as CreateSnippetInput);
      }
    },
    [createSnippet, updateSnippet]
  );

  const handleBatchDeleteSnippets = useCallback(
    (ids: string[]) => {
      if (ids.length <= 1) {
        if (ids.length === 1) deleteSnippet(ids[0]);
        return;
      }
      requestBatchDelete(ids);
    },
    [deleteSnippet, requestBatchDelete]
  );

  // Folder creation (delegated to useFolderStore)
  const handleCreateFolder = useCallback(
    async (parentId?: string | null) => {
      try {
        await createFolder(parentId);
        setSearchQuery("");
        clearSnippetSelection();
      } catch (err) {
        console.error("Failed to create folder:", err);
      }
    },
    [createFolder, clearSnippetSelection]
  );

  // Confirm folder(s) deletion and reload snippets
  const handleConfirmDeleteFolders = async () => {
    await confirmDeleteFolders(async () => {
      await loadSnippets();
    });
  };

  // Drag & drop snippets onto folders, uncategorized, or Basurero
  const handleDropSnippetsOnFolder = useCallback(
    async (snippetIds: string[], targetFolderId: string | null | "trash") => {
      try {
        if (targetFolderId === "trash") {
          await softDeleteSnippets(snippetIds);
        } else {
          await updateSnippetFolder(snippetIds, targetFolderId);
        }
      } catch (err) {
        console.error("Failed to drop snippets on folder:", err);
      }
    },
    [softDeleteSnippets, updateSnippetFolder]
  );

  const handleSaveTag = async (name: string, color: string) => {
    await createTag(name, color);
  };

  const handleUpdateTag = useCallback(
    async (id: string, updates: { name?: string; color?: string }) => {
      try {
        await updateTag(id, updates, (updatedTag) => {
          setSnippets(
            snippets.map((s) => ({
              ...s,
              tags: s.tags?.map((t) => (t.id === updatedTag.id ? updatedTag : t)) || [],
            }))
          );
        });
      } catch (err) {
        console.error("Failed to update tag:", err);
      }
    },
    [updateTag, snippets, setSnippets]
  );

  const handleDeleteTag = async (id: string) => {
    await deleteTag(id, (deletedId) => {
      setSnippets(
        snippets.map((s) => ({
          ...s,
          tags: s.tags?.filter((t) => t.id !== deletedId) || [],
        }))
      );
    });
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Ctrl+N -> New Snippet
      if ((e.ctrlKey || e.metaKey) && key === "n" && !e.shiftKey) {
        e.preventDefault();
        handleNewSnippet();
      }
      // Ctrl+Shift+N -> New Folder (inline)
      if ((e.ctrlKey || e.metaKey) && key === "n" && e.shiftKey) {
        e.preventDefault();
        handleCreateFolder(null);
      }
      // Ctrl+, -> Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        openSettings("appearance");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewSnippet, handleCreateFolder, openSettings]);

  // Real-time snippet selection synchronization during search
  const isSearching = Boolean(searchQuery.trim());
  const isSearchQueryChanged = lastSyncedSearchRef.current !== searchQuery;

  const effectiveSelectedSnippetId = useMemo(() => {
    if (!isSearching) {
      return selectedSnippetId;
    }
    if (filteredSnippets.length === 0) {
      return null;
    }
    if (
      isSearchQueryChanged ||
      !selectedSnippetId ||
      !filteredSnippets.some((s) => s.id === selectedSnippetId)
    ) {
      return filteredSnippets[0].id;
    }
    return selectedSnippetId;
  }, [isSearching, isSearchQueryChanged, filteredSnippets, selectedSnippetId]);

  const effectiveSelectedSnippetIds = useMemo(() => {
    if (!isSearching) {
      return selectedSnippetIds;
    }
    if (isSearchQueryChanged) {
      return effectiveSelectedSnippetId
        ? new Set<string>([effectiveSelectedSnippetId])
        : new Set<string>();
    }
    if (!effectiveSelectedSnippetId) {
      return new Set<string>();
    }
    return selectedSnippetIds.has(effectiveSelectedSnippetId)
      ? selectedSnippetIds
      : new Set<string>([effectiveSelectedSnippetId]);
  }, [isSearching, isSearchQueryChanged, effectiveSelectedSnippetId, selectedSnippetIds]);

  useEffect(() => {
    const queryChanged = lastSyncedSearchRef.current !== searchQuery;
    lastSyncedSearchRef.current = searchQuery;

    if (searchQuery.trim()) {
      const topId = filteredSnippets[0]?.id ?? null;
      const currentInFiltered =
        selectedSnippetId !== null &&
        filteredSnippets.some((s) => s.id === selectedSnippetId);

      if (queryChanged || !currentInFiltered) {
        if (topId) {
          selectSnippet(topId);
        } else if (selectedSnippetId !== null || selectedSnippetIds.size > 0) {
          clearSnippetSelection();
        }
      }
    } else if (queryChanged && !selectedSnippetId && filteredSnippets.length > 0) {
      selectSnippet(filteredSnippets[0].id);
    }
  }, [
    searchQuery,
    filteredSnippets,
    selectedSnippetId,
    selectedSnippetIds,
    selectSnippet,
    clearSnippetSelection,
  ]);

  // Active selected snippet
  const selectedSnippet = useMemo(() => {
    if (!effectiveSelectedSnippetId) return null;
    return (
      hydratedDetails[effectiveSelectedSnippetId] ||
      filteredSnippets.find((s) => s.id === effectiveSelectedSnippetId) ||
      snippets.find((s) => s.id === effectiveSelectedSnippetId) ||
      null
    );
  }, [hydratedDetails, snippets, filteredSnippets, effectiveSelectedSnippetId]);

  useEffect(() => {
    if (selectedSnippet?.id && selectedSnippet.is_summary) {
      void hydrateSnippet(selectedSnippet.id);
    }
  }, [selectedSnippet?.id, selectedSnippet?.is_summary, hydrateSnippet]);

  const selectedSnippetFolder = useMemo(() => {
    if (!selectedSnippet || !selectedSnippet.folder_id) return null;
    return folders.find((f) => f.id === selectedSnippet.folder_id) || null;
  }, [selectedSnippet, folders]);

  const handleAppContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) {
      return;
    }

    const target = e.target instanceof Element ? e.target : null;
    const isNativeInputTarget = Boolean(
      target?.closest("input, textarea, [contenteditable='true']")
    );

    if (!isNativeInputTarget) {
      e.preventDefault();
    }
  }, []);

  return (
    <div
      onContextMenu={handleAppContextMenu}
      className="flex flex-col h-full w-full bg-[var(--ayu-base)] text-[var(--ayu-editor-fg)] overflow-hidden select-none font-sans"
    >
      {/* Frameless Custom Titlebar */}
      <CustomTitlebar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />

      {/* Main 3-Column Split Application Layout */}
      <div className="flex-1 flex min-w-0 w-full overflow-hidden">
        {/* Left Sidebar: Navigation, Folders & Tags */}
        <NavigationSidebar
          width={sidebarWidth}
          onStartResizing={startResizingSidebar}
          folderTreeSlot={
            <FolderTree
              folders={folders}
              activeFolderId={activeFolderId}
              selectedFolderIds={selectedFolderIds}
              activeSpecialFilter={activeSpecialFilter}
              onSelectSpecial={(type) => {
                selectTag(null);
                selectSpecial(type);
                setSearchQuery("");
                clearSnippetSelection();
              }}
              onSelectFolder={handleSelectFolder}
              onSelectAllFolders={handleSelectAllFolders}
              onNewFolder={handleCreateFolder}
              onRenameFolder={renameFolder}
              editingFolderId={editingFolderId}
              setEditingFolderId={setEditingFolderId}
              onDeleteFolder={requestDeleteFolder}
              onDeleteFolders={requestDeleteFolders}
              onMoveFolder={moveFolder}
              onDropSnippetsOnFolder={handleDropSnippetsOnFolder}
              counts={counts}
            />
          }
          tagListSlot={
            <TagList
              tags={tags}
              activeTagId={activeTagId}
              onSelectTag={(tid) => {
                selectTag(tid);
                if (tid) {
                  selectSpecial(null);
                } else if (!activeFolderId && selectedFolderIds.size === 0 && !activeSpecialFilter) {
                  selectSpecial("all");
                }
                setSearchQuery("");
                clearSnippetSelection();
              }}
              onNewTag={openTagModal}
              onUpdateTag={handleUpdateTag}
              onDeleteTag={handleDeleteTag}
              counts={counts.byTag}
            />
          }
        />

        {/* Middle Column: Snippet List */}
        <SnippetListPanel
          width={listWidth}
          onStartResizing={startResizingList}
        >
          <SnippetList
            snippets={filteredSnippets}
            selectedSnippetId={effectiveSelectedSnippetId}
            selectedSnippetIds={effectiveSelectedSnippetIds}
            onSelectSnippet={handleSelectSnippet}
            onSelectAll={handleSelectAllSnippets}
            onToggleFavorite={toggleFavorite}
            onNewSnippet={handleNewSnippet}
            onDuplicateSnippet={duplicateSnippet}
            onResolveSnippetDetail={hydrateSnippet}
            onDeleteSnippet={deleteSnippet}
            onBatchDeleteSnippets={handleBatchDeleteSnippets}
            onRestoreSnippets={restoreSnippets}
            onPermanentlyDeleteSnippets={requestPermanentDelete}
            isTrashView={activeSpecialFilter === "trash"}
            title={listTitle}
            folders={folders}
          />
        </SnippetListPanel>

        {/* Right Column: Dynamic Live Snippet Workspace */}
        <SnippetWorkspace
          snippet={selectedSnippet}
          isCreating={isCreating}
          folder={selectedSnippetFolder}
          tags={tags}
          activeFolderId={activeFolderId}
          searchQuery={searchQuery}
          isTrashView={activeSpecialFilter === "trash"}
          onAutoSave={handleAutoSaveSnippet}
          onDelete={deleteSnippet}
          onToggleFavorite={toggleFavorite}
        />
      </div>

      {/* Tag Create Modal */}
      <TagModal
        isOpen={isTagModalOpen}
        onClose={closeTagModal}
        onSave={handleSaveTag}
      />

      {/* Folder Delete Confirmation Modal */}
      <FolderDeleteModal
        foldersToDelete={foldersToDelete}
        onClose={clearFoldersToDelete}
        onConfirm={handleConfirmDeleteFolders}
      />

      {/* Batch Snippet Delete Confirmation Modal */}
      <BatchSnippetDeleteModal
        snippetIds={batchSnippetIdsToDelete}
        onClose={clearBatchDelete}
        onConfirm={confirmBatchDelete}
      />

      {/* Permanent Delete Confirmation Modal */}
      <PermanentDeleteModal
        snippetIds={permDeleteSnippetIds}
        onClose={clearPermanentDelete}
        onConfirm={confirmPermanentDelete}
      />

      {/* Central Configuration Settings Modal */}
      <SettingsModal />
    </div>
  );
}

export function App() {
  return <AppContent />;
}

export default App;
