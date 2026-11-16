import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { Folder } from "@/core/types";
import { useTranslation } from "@/shared/i18n";
import {
  Folder as FolderIcon,
  FolderOpen,
  Plus,
  Star,
  Layers,
  Inbox,
  Pencil,
  Trash2,
  ChevronRight,
  FolderPlus,
} from "lucide-react";

interface FolderTreeProps {
  folders: Folder[];
  activeFolderId: string | null;
  selectedFolderIds: Set<string>;
  activeSpecialFilter: "all" | "favorites" | "uncategorized" | "trash" | null;
  onSelectSpecial: (type: "all" | "favorites" | "uncategorized" | "trash") => void;
  onSelectFolder: (folderId: string, e?: React.MouseEvent) => void;
  onSelectAllFolders: () => void;
  onNewFolder: (parentId?: string | null) => void;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onDeleteFolder: (folder: Folder) => void;
  onDeleteFolders?: (folders: Folder[]) => void;
  onMoveFolder: (draggedFolderId: string, targetParentFolderId: string | null) => void;
  onDropSnippetsOnFolder: (snippetIds: string[], targetFolderId: string | null | "trash") => void;
  editingFolderId?: string | null;
  setEditingFolderId?: (id: string | null) => void;
  counts: {
    all: number;
    favorites: number;
    uncategorized: number;
    trash: number;
    byFolder: Record<string, number>;
  };
}

interface FolderInlineInputProps {
  initialName: string;
  onCommit: (newName: string) => void;
  onCancel: () => void;
}

const FolderInlineInput: React.FC<FolderInlineInputProps> = React.memo(({
  initialName,
  onCommit,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef(false);

  // Immediately focus and select text before paint
  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Safeguard across paint frames to guarantee full selection of default name
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const rafId = requestAnimationFrame(() => {
      if (document.activeElement === input) {
        input.select();
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleCommit = useCallback(() => {
    if (isCancelledRef.current) return;
    onCommit(name);
  }, [name, onCommit]);

  const handleCancel = useCallback(() => {
    isCancelledRef.current = true;
    onCancel();
  }, [onCancel]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleCommit();
      }}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 pointer-events-auto"
    >
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => {
          e.currentTarget.select();
        }}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            handleCancel();
          } else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            handleCommit();
          }
        }}
        className="w-full h-5 px-1 py-0 text-[12.5px] bg-[var(--ayu-base)] text-[var(--ayu-editor-fg)] border border-[var(--ayu-accent)] rounded outline-none select-text font-normal leading-none"
      />
    </form>
  );
});

FolderInlineInput.displayName = "FolderInlineInput";

export const FolderTree: React.FC<FolderTreeProps> = React.memo(({
  folders,
  activeFolderId,
  selectedFolderIds,
  activeSpecialFilter,
  onSelectSpecial,
  onSelectFolder,
  onSelectAllFolders,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteFolders,
  onMoveFolder,
  onDropSnippetsOnFolder,
  editingFolderId,
  setEditingFolderId,
  counts,
}) => {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folder: Folder;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());

  // Inline rename state
  const [internalEditingFolderId, setInternalEditingFolderId] = useState<string | null>(null);

  const activeEditingId = editingFolderId !== undefined ? editingFolderId : internalEditingFolderId;

  const containerRef = useRef<HTMLDivElement>(null);
  const isMouseInsideRef = useRef(false);

  // Build folder map & child lookup
  const { folderMap, childMap, rootFolders } = useMemo(() => {
    const fMap = new Map<string, Folder>();
    const cMap = new Map<string, Folder[]>();

    for (let i = 0; i < folders.length; i++) {
      const f = folders[i];
      fMap.set(f.id, f);
      if (f.parent_id) {
        const arr = cMap.get(f.parent_id) || [];
        arr.push(f);
        cMap.set(f.parent_id, arr);
      }
    }

    // Root folders have no parent_id or parent doesn't exist
    const roots = folders.filter((f) => !f.parent_id || !fMap.has(f.parent_id));
    return { folderMap: fMap, childMap: cMap, rootFolders: roots };
  }, [folders]);

  // Start inline editing
  const startEditing = useCallback(
    (folder: Folder) => {
      setInternalEditingFolderId(folder.id);
      setEditingFolderId?.(folder.id);
    },
    [setEditingFolderId]
  );

  const cancelEditing = useCallback(() => {
    setInternalEditingFolderId(null);
    setEditingFolderId?.(null);
  }, [setEditingFolderId]);

  const commitRename = useCallback(
    async (folderId: string, newName: string) => {
      const targetFolder = folderMap.get(folderId);
      const trimmed = newName.trim();
      const finalName = trimmed || targetFolder?.name || t.sidebar.untitledFolder;
      cancelEditing();
      if (targetFolder && targetFolder.name !== finalName) {
        await onRenameFolder(folderId, finalName);
      }
    },
    [folderMap, cancelEditing, onRenameFolder, t.sidebar.untitledFolder]
  );

  // Automatically expand parent and all ancestors if folder being edited is a subfolder
  useEffect(() => {
    if (activeEditingId) {
      const folder = folderMap.get(activeEditingId);
      if (folder?.parent_id) {
        setCollapsedFolderIds((prev) => {
          let hasChanges = false;
          const next = new Set(prev);
          let curr: Folder | undefined = folder;
          while (curr && curr.parent_id) {
            if (next.has(curr.parent_id)) {
              next.delete(curr.parent_id);
              hasChanges = true;
            }
            curr = folderMap.get(curr.parent_id);
          }
          return hasChanges ? next : prev;
        });
      }
    }
  }, [activeEditingId, folderMap]);

  // Helper to ensure parent folder is expanded when requesting a new folder
  const handleCreateNewFolder = useCallback(
    (parentId?: string | null) => {
      if (parentId) {
        setCollapsedFolderIds((prev) => {
          if (!prev.has(parentId)) return prev;
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
      onNewFolder(parentId);
    },
    [onNewFolder]
  );

  // Ordered list of visible navigable items in the sidebar (special filters + expanded folders)
  const visibleNavItems = useMemo(() => {
    type NavItem =
      | { kind: "special"; id: "all" | "favorites" | "uncategorized" | "trash"; domKey: string }
      | { kind: "folder"; id: string; folder: Folder; domKey: string };

    const items: NavItem[] = [
      { kind: "special", id: "all", domKey: "special:all" },
      { kind: "special", id: "favorites", domKey: "special:favorites" },
      { kind: "special", id: "uncategorized", domKey: "special:uncategorized" },
      { kind: "special", id: "trash", domKey: "special:trash" },
    ];

    const walk = (folderList: Folder[]) => {
      for (const f of folderList) {
        items.push({ kind: "folder", id: f.id, folder: f, domKey: `folder:${f.id}` });
        if (!collapsedFolderIds.has(f.id)) {
          const children = childMap.get(f.id);
          if (children && children.length > 0) {
            walk(children);
          }
        }
      }
    };

    walk(rootFolders);
    return items;
  }, [rootFolders, childMap, collapsedFolderIds]);

  const scrollSidebarItemIntoView = useCallback((domKey: string) => {
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(
        `[data-sidebar-nav-id="${domKey}"]`
      );
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }, []);

  // Keyboard navigation & native OS shortcuts for FolderTree
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingText =
        Boolean(activeEditingId) ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.closest(".cm-content")) ||
        target?.getAttribute("contenteditable") === "true";

      if (isEditingText) return;

      const isFocusInsideSidebar = Boolean(
        containerRef.current &&
          document.activeElement &&
          containerRef.current.contains(document.activeElement)
      );
      const isSidebarActive = isMouseInsideRef.current || isFocusInsideSidebar;

      // F2 to rename currently selected folder anywhere when not editing text
      if (e.key === "F2" && activeFolderId && activeSpecialFilter === null) {
        const folder = folderMap.get(activeFolderId);
        if (folder) {
          e.preventDefault();
          startEditing(folder);
          return;
        }
      }

      if (!isSidebarActive) return;

      // Ctrl+A / Cmd+A -> Select all folders
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        e.stopPropagation();
        onSelectAllFolders();
        return;
      }

      // Enter -> Rename active folder (macOS Finder / keyboard convention)
      if (e.key === "Enter" && activeFolderId && activeSpecialFilter === null) {
        const folder = folderMap.get(activeFolderId);
        if (folder) {
          e.preventDefault();
          startEditing(folder);
          return;
        }
      }

      // Delete or Backspace (or Cmd+Backspace) -> Delete selected folder(s)
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        activeSpecialFilter === null &&
        (selectedFolderIds.size > 0 || activeFolderId)
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (selectedFolderIds.size > 1 && onDeleteFolders) {
          const selFolders = folders.filter((f) => selectedFolderIds.has(f.id));
          if (selFolders.length > 0) {
            onDeleteFolders(selFolders);
          }
        } else if (activeFolderId) {
          const folder = folderMap.get(activeFolderId);
          if (folder) {
            onDeleteFolder(folder);
          }
        }
        return;
      }

      // Escape -> Collapse multi-selection to single active folder
      if (e.key === "Escape" && selectedFolderIds.size > 1 && activeFolderId) {
        e.preventDefault();
        onSelectFolder(activeFolderId);
        return;
      }

      // ArrowRight -> Expand collapsed folder or select first child
      if (e.key === "ArrowRight" && activeFolderId && activeSpecialFilter === null) {
        const children = childMap.get(activeFolderId) || [];
        if (children.length > 0) {
          e.preventDefault();
          if (collapsedFolderIds.has(activeFolderId)) {
            setCollapsedFolderIds((prev) => {
              const next = new Set(prev);
              next.delete(activeFolderId);
              return next;
            });
          } else {
            const firstChild = children[0];
            onSelectFolder(firstChild.id);
            scrollSidebarItemIntoView(`folder:${firstChild.id}`);
          }
        }
        return;
      }

      // ArrowLeft -> Collapse expanded folder or select parent folder
      if (e.key === "ArrowLeft" && activeFolderId && activeSpecialFilter === null) {
        const folder = folderMap.get(activeFolderId);
        const children = childMap.get(activeFolderId) || [];
        if (children.length > 0 && !collapsedFolderIds.has(activeFolderId)) {
          e.preventDefault();
          setCollapsedFolderIds((prev) => {
            const next = new Set(prev);
            next.add(activeFolderId);
            return next;
          });
          return;
        }
        if (folder?.parent_id && folderMap.has(folder.parent_id)) {
          e.preventDefault();
          onSelectFolder(folder.parent_id);
          scrollSidebarItemIntoView(`folder:${folder.parent_id}`);
        }
        return;
      }

      // ArrowDown / ArrowUp / Home / End -> Navigate through sidebar items
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Home" ||
        e.key === "End"
      ) {
        if (visibleNavItems.length === 0) return;
        e.preventDefault();
        e.stopPropagation();

        const currentIndex = visibleNavItems.findIndex((item) =>
          item.kind === "special"
            ? activeSpecialFilter === item.id
            : activeSpecialFilter === null && activeFolderId === item.id
        );

        let nextIndex = 0;
        if (e.key === "Home") {
          nextIndex = 0;
        } else if (e.key === "End") {
          nextIndex = visibleNavItems.length - 1;
        } else if (e.key === "ArrowDown") {
          nextIndex =
            currentIndex === -1
              ? 0
              : Math.min(visibleNavItems.length - 1, currentIndex + 1);
        } else if (e.key === "ArrowUp") {
          nextIndex =
            currentIndex === -1 ? 0 : Math.max(0, currentIndex - 1);
        }

        const nextItem = visibleNavItems[nextIndex];
        if (!nextItem) return;

        if (nextItem.kind === "special") {
          onSelectSpecial(nextItem.id);
        } else {
          const isExtendFolderSelection =
            e.shiftKey &&
            activeSpecialFilter === null &&
            activeFolderId !== null &&
            nextItem.id !== activeFolderId;

          if (isExtendFolderSelection) {
            onSelectFolder(nextItem.id, { ctrlKey: true } as unknown as React.MouseEvent);
          } else {
            onSelectFolder(nextItem.id);
          }
        }
        scrollSidebarItemIntoView(nextItem.domKey);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeEditingId,
    activeFolderId,
    activeSpecialFilter,
    selectedFolderIds,
    folders,
    folderMap,
    childMap,
    collapsedFolderIds,
    visibleNavItems,
    onSelectAllFolders,
    onSelectFolder,
    onSelectSpecial,
    onDeleteFolder,
    onDeleteFolders,
    startEditing,
    scrollSidebarItemIntoView,
  ]);

  // Close context menu on pointerdown outside or on escape
  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  // Global dragend/drop cleanup to guarantee target is reset when user releases mouse
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      if (dragOverTargetRef.current !== null) {
        dragOverTargetRef.current = null;
        setDragOverTarget(null);
      }
    };
    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("drop", handleGlobalDragEnd);
    return () => {
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("drop", handleGlobalDragEnd);
    };
  }, []);

  // Context menu trigger on secondary click (right-click)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, folder: Folder) => {
      e.preventDefault();
      e.stopPropagation();

      // If clicked folder is not part of multi-selection, select it exclusively
      if (!selectedFolderIds.has(folder.id)) {
        onSelectFolder(folder.id);
      }

      const menuWidth = 160;
      const menuHeight = 110;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);

      setContextMenu({ x, y, folder });
    },
    [selectedFolderIds, onSelectFolder]
  );

  // Check if candidate is descendant of ancestorId to prevent circular nesting
  const isDescendant = useCallback(
    (ancestorId: string, candidateId: string | null): boolean => {
      if (!candidateId) return false;
      let curr = folderMap.get(candidateId);
      while (curr && curr.parent_id) {
        if (curr.parent_id === ancestorId) return true;
        curr = folderMap.get(curr.parent_id);
      }
      return false;
    },
    [folderMap]
  );

  const toggleCollapse = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Ultra-responsive Drag Over & Leave handlers with 0ms delay and zero redundant renders
  const dragOverTargetRef = useRef<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTargetRef.current !== targetId) {
      dragOverTargetRef.current = targetId;
      setDragOverTarget(targetId);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Ignore dragleave events if we are still within the element's subtree
    if (e.currentTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    if (dragOverTargetRef.current === targetId) {
      dragOverTargetRef.current = null;
      setDragOverTarget(null);
    }
  }, []);

  // Drop on Folder
  const handleDropOnFolder = (e: React.DragEvent, targetFolder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverTargetRef.current = null;
    setDragOverTarget(null);

    // 1. Snippets drop
    const snippetData = e.dataTransfer.getData("application/codestash-snippets");
    if (snippetData) {
      try {
        const ids: string[] = JSON.parse(snippetData);
        if (ids.length > 0) {
          onDropSnippetsOnFolder(ids, targetFolder.id);
        }
      } catch (err) {
        console.error("Failed to parse dragged snippet IDs:", err);
      }
      return;
    }

    // 2. Multiple folders drop
    const foldersData = e.dataTransfer.getData("application/codestash-folders");
    if (foldersData) {
      try {
        const ids: string[] = JSON.parse(foldersData);
        ids.forEach((fId) => {
          if (fId !== targetFolder.id && !isDescendant(fId, targetFolder.id)) {
            onMoveFolder(fId, targetFolder.id);
          }
        });
      } catch (err) {
        console.error("Failed to parse dragged folder IDs:", err);
      }
      return;
    }

    // 3. Single folder drop
    const folderData = e.dataTransfer.getData("application/codestash-folder");
    if (folderData) {
      if (folderData === targetFolder.id) return;
      if (isDescendant(folderData, targetFolder.id)) return;
      onMoveFolder(folderData, targetFolder.id);
    }
  };

  // Drop on Root / Header
  const handleDropOnRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverTargetRef.current = null;
    setDragOverTarget(null);

    const foldersData = e.dataTransfer.getData("application/codestash-folders");
    if (foldersData) {
      try {
        const ids: string[] = JSON.parse(foldersData);
        ids.forEach((fId) => onMoveFolder(fId, null));
      } catch { }
      return;
    }

    const folderData = e.dataTransfer.getData("application/codestash-folder");
    if (folderData) {
      onMoveFolder(folderData, null);
    }
  };

  // Drop on Uncategorized
  const handleDropOnUncategorized = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverTargetRef.current = null;
    setDragOverTarget(null);

    const snippetData = e.dataTransfer.getData("application/codestash-snippets");
    if (snippetData) {
      try {
        const ids: string[] = JSON.parse(snippetData);
        if (ids.length > 0) {
          onDropSnippetsOnFolder(ids, null);
        }
      } catch (err) {
        console.error("Failed to parse dragged snippet IDs:", err);
      }
    }
  };

  // Drop on Basurero
  const handleDropOnTrash = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverTargetRef.current = null;
    setDragOverTarget(null);

    const snippetData = e.dataTransfer.getData("application/codestash-snippets");
    if (snippetData) {
      try {
        const ids: string[] = JSON.parse(snippetData);
        if (ids.length > 0) {
          onDropSnippetsOnFolder(ids, "trash");
        }
      } catch (err) {
        console.error("Failed to parse dragged snippet IDs:", err);
      }
    }
  };

  const isFolderSelected = (folderId: string) => {
    return activeSpecialFilter === null && (selectedFolderIds.has(folderId) || activeFolderId === folderId);
  };

  // Recursive folder renderer
  const renderFolderItem = (folder: Folder, level: number = 0) => {
    const isSelected = isFolderSelected(folder.id);
    const count = counts.byFolder[folder.id] || 0;
    const isDragOver = dragOverTarget === `folder-${folder.id}`;
    const children = childMap.get(folder.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedFolderIds.has(folder.id);
    const isEditingThisFolder = activeEditingId === folder.id;

    return (
      <div key={folder.id} className="relative select-none">
        <div
          draggable={!isEditingThisFolder}
          onDragStart={(e) => {
            if (isEditingThisFolder) {
              e.preventDefault();
              return;
            }
            const idsToDrag = selectedFolderIds.has(folder.id)
              ? Array.from(selectedFolderIds)
              : [folder.id];
            e.dataTransfer.setData("application/codestash-folders", JSON.stringify(idsToDrag));
            e.dataTransfer.setData("application/codestash-folder", folder.id);
            e.dataTransfer.effectAllowed = "move";

            // Semi-transparent drag preview (barely visible)
            const target = e.currentTarget as HTMLElement;
            if (target && e.dataTransfer) {
              const rect = target.getBoundingClientRect();
              const ghost = target.cloneNode(true) as HTMLElement;
              ghost.style.position = "fixed";
              ghost.style.top = "-9999px";
              ghost.style.left = "-9999px";
              ghost.style.width = `${rect.width || 200}px`;
              ghost.style.opacity = "0.20";
              ghost.style.pointerEvents = "none";
              ghost.style.zIndex = "-9999";
              document.body.appendChild(ghost);
              const offsetX = e.clientX ? e.clientX - rect.left : 20;
              const offsetY = e.clientY ? e.clientY - rect.top : 14;
              e.dataTransfer.setDragImage(ghost, Math.max(5, offsetX), Math.max(5, offsetY));
              setTimeout(() => {
                ghost.remove();
              }, 0);
            }
          }}
          onDragEnter={(e) => handleDragOver(e, `folder-${folder.id}`)}
          onDragOver={(e) => handleDragOver(e, `folder-${folder.id}`)}
          onDragLeave={(e) => handleDragLeave(e, `folder-${folder.id}`)}
          onDrop={(e) => handleDropOnFolder(e, folder)}
          onContextMenu={(e) => handleContextMenu(e, folder)}
          className="relative group rounded-md"
        >
          <button
            data-sidebar-nav-id={`folder:${folder.id}`}
            onClick={(e) => {
              if (isEditingThisFolder) return;
              onSelectFolder(folder.id, e);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEditing(folder);
            }}
            style={{ paddingLeft: `${8 + level * 14}px` }}
            className={`w-full h-7 flex items-center justify-between pr-2.5 rounded-md text-[13px] cursor-pointer transition-colors duration-150 ${isDragOver
              ? "bg-[var(--list-active-bg)] text-white font-medium ring-1 ring-[var(--list-active-bg)] shadow-xs"
              : isSelected
                ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)] font-medium shadow-xs"
                : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)]"
              }`}
          >
            <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0 mr-1.5 pointer-events-none">
              {hasChildren ? (
                <span
                  onClick={(e) => toggleCollapse(folder.id, e)}
                  className={`p-0.5 -ml-1 transition-transform rounded cursor-pointer pointer-events-auto ${isDragOver
                    ? "text-white"
                    : "text-[var(--sidebar-fg-subtle)]"
                    }`}
                >
                  <ChevronRight
                    className={`w-3 h-3 transition-transform duration-150 ${!isCollapsed ? "rotate-90" : ""
                      }`}
                  />
                </span>
              ) : (
                <span className="w-2.5 shrink-0" />
              )}

              {isDragOver ? (
                <FolderOpen className="w-3.5 h-3.5 text-white shrink-0" />
              ) : isSelected ? (
                <FolderOpen className="w-3.5 h-3.5 text-[var(--sidebar-active-icon)] shrink-0" />
              ) : (
                <FolderIcon className="w-3.5 h-3.5 text-[var(--sidebar-fg-subtle)] shrink-0" />
              )}

              {isEditingThisFolder ? (
                <FolderInlineInput
                  initialName={folder.name}
                  onCommit={(newName) => commitRename(folder.id, newName)}
                  onCancel={cancelEditing}
                />
              ) : (
                <span className={`truncate ${isDragOver ? "text-white font-medium" : ""}`}>
                  {folder.name}
                </span>
              )}
            </div>

            {!isEditingThisFolder && (
              <div className="flex items-center space-x-1 shrink-0 pointer-events-none">
                <span
                  className={`text-[11px] font-mono ${isDragOver ? "text-white/80" : "text-[var(--sidebar-fg-subtle)]"
                    }`}
                >
                  {count}
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Subfolders */}
        {hasChildren && !isCollapsed && (
          <div className="space-y-0.5 mt-0.5">
            {children.map((child) => renderFolderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onMouseEnter={() => {
        isMouseInsideRef.current = true;
      }}
      onMouseLeave={() => {
        isMouseInsideRef.current = false;
      }}
      onDragLeave={(e) => {
        if (!containerRef.current || !containerRef.current.contains(e.relatedTarget as Node)) {
          if (dragOverTargetRef.current !== null) {
            dragOverTargetRef.current = null;
            setDragOverTarget(null);
          }
        }
      }}
      className="flex flex-col space-y-3 outline-none"
    >
      {/* Primary Navigation / Quick Filters */}
      <div className="space-y-0.5">
        <button
          data-sidebar-nav-id="special:all"
          onClick={() => onSelectSpecial("all")}
          className={`w-full h-7 flex items-center justify-between px-2.5 rounded-md text-[13px] cursor-pointer transition-colors duration-150 ${activeSpecialFilter === "all"
            ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)] font-medium"
            : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)]"
            }`}
        >
          <div className="flex items-center space-x-2">
            <Layers
              className={`w-3.5 h-3.5 ${activeSpecialFilter === "all" ? "text-[var(--sidebar-active-icon)]" : "text-[var(--sidebar-fg-subtle)]"
                }`}
            />
            <span>{t.sidebar.allSnippets}</span>
          </div>
          <span className="text-[11px] font-mono text-[var(--sidebar-fg-subtle)]">{counts.all}</span>
        </button>

        <button
          data-sidebar-nav-id="special:favorites"
          onClick={() => onSelectSpecial("favorites")}
          className={`w-full h-7 flex items-center justify-between px-2.5 rounded-md text-[13px] cursor-pointer transition-colors duration-150 ${activeSpecialFilter === "favorites"
            ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)] font-medium"
            : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)]"
            }`}
        >
          <div className="flex items-center space-x-2">
            <Star
              className={`w-3.5 h-3.5 ${activeSpecialFilter === "favorites"
                ? "fill-[var(--sidebar-active-icon)] text-[var(--sidebar-active-icon)]"
                : "text-[var(--sidebar-fg-subtle)]"
                }`}
            />
            <span>{t.sidebar.favorites}</span>
          </div>
          <span className="text-[11px] font-mono text-[var(--sidebar-fg-subtle)]">{counts.favorites}</span>
        </button>

        {/* Uncategorized (Drop Target for moving snippets to uncategorized) */}
        <button
          data-sidebar-nav-id="special:uncategorized"
          onClick={() => onSelectSpecial("uncategorized")}
          onDragEnter={(e) => handleDragOver(e, "uncategorized")}
          onDragOver={(e) => handleDragOver(e, "uncategorized")}
          onDragLeave={(e) => handleDragLeave(e, "uncategorized")}
          onDrop={handleDropOnUncategorized}
          className={`w-full h-7 flex items-center justify-between px-2.5 rounded-md text-[13px] cursor-pointer transition-colors duration-150 ${dragOverTarget === "uncategorized"
            ? "bg-[var(--list-active-bg)] text-white ring-1 ring-[var(--list-active-bg)] font-medium shadow-xs"
            : activeSpecialFilter === "uncategorized"
              ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)] font-medium"
              : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)]"
            }`}
        >
          <div className="flex items-center space-x-2 pointer-events-none">
            <Inbox
              className={`w-3.5 h-3.5 ${dragOverTarget === "uncategorized"
                ? "text-white"
                : activeSpecialFilter === "uncategorized"
                  ? "text-[var(--sidebar-active-icon)]"
                  : "text-[var(--sidebar-fg-subtle)]"
                }`}
            />
            <span>{t.sidebar.uncategorized}</span>
          </div>
          <span
            className={`text-[11px] font-mono pointer-events-none ${dragOverTarget === "uncategorized" ? "text-white/80" : "text-[var(--sidebar-fg-subtle)]"
              }`}
          >
            {counts.uncategorized}
          </span>
        </button>

        {/* Basurero (Positioned strictly right below Uncategorized per user requirement 2b) */}
        <button
          data-sidebar-nav-id="special:trash"
          onClick={() => onSelectSpecial("trash")}
          onDragEnter={(e) => handleDragOver(e, "trash")}
          onDragOver={(e) => handleDragOver(e, "trash")}
          onDragLeave={(e) => handleDragLeave(e, "trash")}
          onDrop={handleDropOnTrash}
          className={`w-full h-7 flex items-center justify-between px-2.5 rounded-md text-[13px] cursor-pointer transition-colors duration-150 ${dragOverTarget === "trash"
            ? "bg-[var(--ayu-error)]/20 ring-1 ring-[var(--ayu-error)] font-medium"
            : activeSpecialFilter === "trash"
              ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)] font-medium"
              : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)]"
            }`}
        >
          <div className="flex items-center space-x-2 pointer-events-none">
            <Trash2
              className={`w-3.5 h-3.5 ${activeSpecialFilter === "trash"
                ? "text-[var(--ayu-error)]"
                : "text-[var(--sidebar-fg-subtle)]"
                }`}
            />
            <span>{t.sidebar.trash}</span>
          </div>
          <span className="text-[11px] font-mono pointer-events-none text-[var(--sidebar-fg-subtle)]">{counts.trash}</span>
        </button>
      </div>

      {/* Folders Section */}
      <div className="space-y-0.5 pt-1">
        <div
          onDragEnter={(e) => handleDragOver(e, "folders-root")}
          onDragOver={(e) => handleDragOver(e, "folders-root")}
          onDragLeave={(e) => handleDragLeave(e, "folders-root")}
          onDrop={handleDropOnRoot}
          className={`flex items-center justify-between px-2.5 py-1 rounded cursor-pointer ${dragOverTarget === "folders-root"
            ? "bg-[var(--list-active-bg)]/20 ring-1 ring-[var(--list-active-bg)]"
            : ""
            }`}
        >
          <div className="flex items-center space-x-1.5 pointer-events-none">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--sidebar-fg-subtle)]">
              {t.sidebar.foldersHeader}
            </span>
          </div>
          <button
            onClick={() => handleCreateNewFolder(null)}
            className="text-[var(--sidebar-fg-subtle)] hover:text-[var(--sidebar-active-fg)] p-0.5 rounded hover:bg-[var(--sidebar-hover-bg)] transition-colors cursor-pointer"
            title={t.sidebar.createRootFolder}
            aria-label={t.sidebar.createRootFolder}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-0.5">
          {rootFolders.length === 0 ? (
            <div className="px-2.5 py-1 text-[11px] text-[var(--sidebar-fg-subtle)] italic">
              {t.sidebar.noFolders}
            </div>
          ) : (
            rootFolders.map((folder) => renderFolderItem(folder, 0))
          )}
        </div>
      </div>

      {/* Floating Context Menu on Secondary Click (Right-Click) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[155px] py-1 bg-[var(--menu-bg)] border border-[var(--ayu-border)] rounded-md shadow-xl text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {selectedFolderIds.size > 1 && selectedFolderIds.has(contextMenu.folder.id) ? (
            <button
              type="button"
              onClick={() => {
                const selFolders = folders.filter((f) => selectedFolderIds.has(f.id));
                if (onDeleteFolders) {
                  onDeleteFolders(selFolders);
                } else {
                  onDeleteFolder(contextMenu.folder);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/15 transition-colors cursor-pointer text-left font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.common.deleteAll}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  const targetParentId = contextMenu.folder.id;
                  setContextMenu(null);
                  handleCreateNewFolder(targetParentId);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] transition-colors cursor-pointer text-left"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[var(--ayu-accent)]" />
                <span>{t.sidebar.newFolder}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const f = contextMenu.folder;
                  setContextMenu(null);
                  startEditing(f);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] transition-colors cursor-pointer text-left"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t.common.rename}</span>
              </button>
              <div className="h-px bg-[var(--ayu-line)] my-1" />
              <button
                type="button"
                onClick={() => {
                  const f = contextMenu.folder;
                  setContextMenu(null);
                  onDeleteFolder(f);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/15 transition-colors cursor-pointer text-left font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.common.delete}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});
FolderTree.displayName = "FolderTree";
