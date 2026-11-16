import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Snippet, Folder } from "@/core/types";
import { SnippetCard } from "./SnippetCard";
import {
  VirtualizedSnippetItems,
  type VirtualizedSnippetItemsHandle,
} from "./VirtualizedSnippetItems";
import { Code2, Plus, Copy, Trash2, RotateCcw } from "lucide-react";
import { useTranslation } from "@/shared/i18n";
import { copyPlainTextContent } from "../editor/utils/richTextClipboard";

interface SnippetListProps {
  snippets: Snippet[];
  folders?: Folder[];
  selectedSnippetId: string | null;
  selectedSnippetIds: Set<string>;
  onSelectSnippet: (id: string, e?: React.MouseEvent) => void;
  onSelectAll: () => void;
  onToggleFavorite: (id: string) => void;
  onNewSnippet: () => void;
  onDuplicateSnippet?: (snippet: Snippet) => void;
  onDeleteSnippet?: (id: string) => void;
  onBatchDeleteSnippets?: (ids: string[]) => void;
  onRestoreSnippets?: (ids: string[]) => void;
  onPermanentlyDeleteSnippets?: (ids: string[]) => void;
  onResolveSnippetDetail?: (id: string) => Promise<Snippet | null>;
  isTrashView?: boolean;
  title: string;
}

export const SnippetList: React.FC<SnippetListProps> = React.memo(({
  snippets,
  folders = [],
  selectedSnippetId,
  selectedSnippetIds,
  onSelectSnippet,
  onSelectAll,
  onToggleFavorite,
  onNewSnippet,
  onDuplicateSnippet,
  onDeleteSnippet,
  onBatchDeleteSnippets,
  onRestoreSnippets,
  onPermanentlyDeleteSnippets,
  onResolveSnippetDetail,
  isTrashView = false,
  title,
}) => {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    snippet: Snippet;
  } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualListRef = useRef<VirtualizedSnippetItemsHandle>(null);

  const folderMap = useMemo(() => {
    return new Map(folders.map((f) => [f.id, f.name]));
  }, [folders]);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const isMouseInsideRef = useRef(false);

  const scrollSnippetIntoView = useCallback((snippetId: string) => {
    requestAnimationFrame(() => {
      if (virtualListRef.current) {
        virtualListRef.current.scrollToSnippet(snippetId);
        return;
      }
      const el = listContainerRef.current?.querySelector<HTMLElement>(
        `[data-snippet-id="${snippetId}"]`
      );
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }, []);

  // Keyboard navigation & native OS shortcuts for SnippetList
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      // Ctrl+A / Cmd+A when mouse is hovering snippet list
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && isMouseInsideRef.current) {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onSelectAll();
        return;
      }

      const target = (e.target as HTMLElement | null) || (document.activeElement as HTMLElement | null);
      const isEditingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.closest(".cm-content")) ||
        Boolean(target?.closest(".monaco-editor")) ||
        target?.getAttribute("contenteditable") === "true";

      if (isEditingText) return;

      const isFocusInsideList = Boolean(
        listContainerRef.current &&
          document.activeElement &&
          listContainerRef.current.contains(document.activeElement)
      );
      const isFocusInsideSidebar = Boolean(target?.closest("aside"));

      if (!isMouseInsideRef.current && !isFocusInsideList && isFocusInsideSidebar) {
        return;
      }

      // Ctrl+A / Cmd+A -> Select all visible snippets
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        if (snippets.length > 0) {
          e.preventDefault();
          onSelectAll();
        }
        return;
      }

      // Ctrl+D / Cmd+D -> Duplicate active snippet
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && !isTrashView) {
        const active = snippets.find((s) => s.id === selectedSnippetId);
        if (active && onDuplicateSnippet) {
          e.preventDefault();
          onDuplicateSnippet(active);
        }
        return;
      }

      // Ctrl+C / Cmd+C -> Copy active snippet code when no DOM text is selected
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !e.shiftKey) {
        const domSelection = window.getSelection()?.toString() || "";
        if (!domSelection && selectedSnippetId) {
          const active = snippets.find((s) => s.id === selectedSnippetId);
          if (active) {
            e.preventDefault();
            void (async () => {
              const resolved = active.is_summary && onResolveSnippetDetail
                ? (await onResolveSnippetDetail(active.id)) ?? active
                : active;
              if (!resolved.code) return;
              if (!resolved.language || resolved.language === "plaintext") {
                await copyPlainTextContent({ code: resolved.code }, "markdown").catch(() => {});
              } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(resolved.code).catch(() => {});
              }
            })();
          }
        }
        return;
      }

      // Escape -> Collapse multi-selection to single active snippet
      if (e.key === "Escape" && selectedSnippetIds.size > 1 && selectedSnippetId) {
        e.preventDefault();
        onSelectSnippet(selectedSnippetId);
        return;
      }

      // Delete or Backspace (or Cmd+Backspace) -> Delete selected snippet(s)
      if (e.key === "Delete" || e.key === "Backspace") {
        const ids =
          selectedSnippetIds.size > 0
            ? Array.from(selectedSnippetIds)
            : selectedSnippetId
              ? [selectedSnippetId]
              : [];

        if (ids.length > 0) {
          e.preventDefault();
          if (isTrashView) {
            onPermanentlyDeleteSnippets?.(ids);
          } else if (ids.length > 1) {
            onBatchDeleteSnippets?.(ids);
          } else {
            onDeleteSnippet?.(ids[0]);
          }
        }
        return;
      }

      // ArrowDown / ArrowUp / Home / End / PageDown / PageUp -> Navigate snippets
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "PageDown" ||
        e.key === "PageUp"
      ) {
        if (snippets.length === 0) return;
        e.preventDefault();

        const currentIndex = snippets.findIndex((s) => s.id === selectedSnippetId);
        let nextIndex = 0;

        if (e.key === "Home") {
          nextIndex = 0;
        } else if (e.key === "End") {
          nextIndex = snippets.length - 1;
        } else if (e.key === "ArrowDown") {
          nextIndex =
            currentIndex === -1 ? 0 : Math.min(snippets.length - 1, currentIndex + 1);
        } else if (e.key === "ArrowUp") {
          nextIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - 1);
        } else if (e.key === "PageDown") {
          nextIndex =
            currentIndex === -1 ? 0 : Math.min(snippets.length - 1, currentIndex + 5);
        } else if (e.key === "PageUp") {
          nextIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - 5);
        }

        const nextSnippet = snippets[nextIndex];
        if (!nextSnippet) return;

        if (e.shiftKey && selectedSnippetId) {
          onSelectSnippet(nextSnippet.id, { shiftKey: true } as unknown as React.MouseEvent);
        } else {
          onSelectSnippet(nextSnippet.id);
        }
        scrollSnippetIntoView(nextSnippet.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    snippets,
    selectedSnippetId,
    selectedSnippetIds,
    isTrashView,
    onSelectAll,
    onSelectSnippet,
    onDuplicateSnippet,
    onDeleteSnippet,
    onBatchDeleteSnippets,
    onPermanentlyDeleteSnippets,
    onResolveSnippetDetail,
    scrollSnippetIntoView,
  ]);

  // Context menu trigger on right click
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, snippet: Snippet) => {
      e.preventDefault();
      e.stopPropagation();

      // If clicked item is not part of multi-selection, select it exclusively
      if (!selectedSnippetIds.has(snippet.id)) {
        onSelectSnippet(snippet.id);
      }

      const menuWidth = 200;
      const menuHeight = 110;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);

      setContextMenu({ x, y, snippet });
    },
    [selectedSnippetIds, onSelectSnippet]
  );

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

  // Drag start for snippets (single or multi-item)
  const handleDragStart = useCallback(
    (e: React.DragEvent, snippet: Snippet) => {
      const idsToDrag = selectedSnippetIds.has(snippet.id)
        ? Array.from(selectedSnippetIds)
        : [snippet.id];

      if (!selectedSnippetIds.has(snippet.id)) {
        onSelectSnippet(snippet.id);
      }

      e.dataTransfer.setData("application/codestash-snippets", JSON.stringify(idsToDrag));
      e.dataTransfer.effectAllowed = "move";

      // Semi-transparent drag image (barely visible to easily read folders underneath)
      const target =
        (e.currentTarget as HTMLElement) ||
        ((e.target as HTMLElement)?.closest?.("[draggable='true']") as HTMLElement) ||
        (e.target as HTMLElement);

      if (target && e.dataTransfer) {
        const rect = target.getBoundingClientRect();
        const ghost = target.cloneNode(true) as HTMLElement;
        ghost.style.position = "fixed";
        ghost.style.top = "-9999px";
        ghost.style.left = "-9999px";
        ghost.style.width = `${rect.width || 260}px`;
        ghost.style.opacity = "0.20"; // Apenas visible
        ghost.style.pointerEvents = "none";
        ghost.style.zIndex = "-9999";

        // Remove any selected highlight (celeste background and white text) from the ghost preview
        ghost.classList.remove("bg-[var(--list-active-bg)]", "text-white", "shadow-xs");
        ghost.style.backgroundColor = "transparent";
        ghost.style.color = "var(--ayu-editor-fg)";

        // Strip white-text and white-badge classes from ghost's children
        ghost.querySelectorAll(".text-white, .text-white\\/80, .text-white\\/75, .text-white\\/70").forEach((el) => {
          el.classList.remove("text-white", "text-white/80", "text-white/75", "text-white/70", "font-semibold");
          (el as HTMLElement).style.color = "inherit";
        });
        ghost.querySelectorAll(".bg-white\\/20").forEach((el) => {
          el.classList.remove("bg-white/20");
          (el as HTMLElement).style.backgroundColor = "var(--ayu-sunk)";
          (el as HTMLElement).style.color = "var(--ayu-fg)";
        });
        ghost.querySelectorAll(".fill-white").forEach((el) => {
          el.classList.remove("fill-white");
          (el as HTMLElement).style.fill = "var(--ayu-accent)";
          (el as HTMLElement).style.color = "var(--ayu-accent)";
        });

        if (idsToDrag.length > 1) {
          const badge = document.createElement("span");
          badge.textContent = `${idsToDrag.length} snippets`;
          badge.style.position = "absolute";
          badge.style.top = "6px";
          badge.style.right = "8px";
          badge.style.background = "var(--list-active-bg)";
          badge.style.color = "white";
          badge.style.fontSize = "10px";
          badge.style.padding = "2px 6px";
          badge.style.borderRadius = "9999px";
          badge.style.fontWeight = "bold";
          ghost.appendChild(badge);
        }

        document.body.appendChild(ghost);
        const offsetX = e.clientX ? e.clientX - rect.left : 20;
        const offsetY = e.clientY ? e.clientY - rect.top : 15;
        e.dataTransfer.setDragImage(
          ghost,
          Math.max(10, Math.min(offsetX, (rect.width || 260) - 10)),
          Math.max(10, Math.min(offsetY, (rect.height || 60) - 10))
        );

        setTimeout(() => {
          ghost.remove();
        }, 0);
      }
    },
    [selectedSnippetIds, onSelectSnippet]
  );

  const selectedCount = selectedSnippetIds.size;
  const isMultiSelected = selectedCount > 1;

  return (
    <div
      ref={listContainerRef}
      tabIndex={-1}
      onMouseEnter={() => {
        isMouseInsideRef.current = true;
      }}
      onMouseLeave={() => {
        isMouseInsideRef.current = false;
      }}
      className="flex flex-col h-full bg-[var(--list-panel-bg)] border-r border-[var(--list-panel-border)] select-none relative outline-none"
    >
      {/* Sleek Minimalist Header */}
      <div className="h-9 px-3.5 flex items-center justify-between border-b border-[var(--list-header-border)] bg-[var(--list-header-bg)] shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-[12px] font-semibold text-[var(--list-card-title)] truncate max-w-[150px]">
            {title}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--list-tag-bg)] text-[var(--list-tag-fg)] border border-[var(--list-tag-border)] shrink-0">
            {snippets.length}
          </span>
        </div>

        {!isTrashView && (
          <button
            onClick={onNewSnippet}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--list-card-sub)] hover:text-[var(--list-card-title)] hover:bg-[var(--list-card-hover-bg)] transition-colors cursor-pointer"
            title={t.snippetList.newSnippetTooltip}
            aria-label={t.snippetList.newSnippetAria}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Snippet Items List */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {snippets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[var(--ayu-sunk)] border border-[var(--ayu-line)] flex items-center justify-center text-[var(--ayu-fg-subtle)]">
              {isTrashView ? <Trash2 className="w-5 h-5 text-[var(--ayu-fg-subtle)]" /> : <Code2 className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--ayu-editor-fg)]">
                {isTrashView ? t.snippetList.trashEmptyTitle : t.snippetList.noSnippetsTitle}
              </p>
              <p className="text-[11px] text-[var(--ayu-fg-subtle)] mt-0.5">
                {isTrashView
                  ? t.snippetList.trashEmptySubtitle
                  : t.snippetList.noSnippetsSubtitle}
              </p>
            </div>
            {!isTrashView && (
              <button
                onClick={onNewSnippet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-fg)] border border-[var(--btn-primary-border)] transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.snippetList.createSnippetButton}</span>
              </button>
            )}
          </div>
        ) : (
          <VirtualizedSnippetItems
            ref={virtualListRef}
            snippets={snippets}
            scrollContainerRef={scrollContainerRef}
            renderItem={(snippet) => {
              const isSelected = selectedSnippetIds.has(snippet.id) || selectedSnippetId === snippet.id;
              return (
                <SnippetCard
                  snippet={snippet}
                  folderName={snippet.folder_id ? folderMap.get(snippet.folder_id) : undefined}
                  isSelected={isSelected}
                  onSelect={(id, e) => onSelectSnippet(id, e)}
                  onToggleFavorite={onToggleFavorite}
                  onContextMenu={handleContextMenu}
                  onDragStart={handleDragStart}
                />
              );
            }}
          />
        )}
      </div>

      {/* Floating Context Menu on Right Click */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[190px] py-1 bg-[var(--menu-bg)] border border-[var(--ayu-border)] rounded-md shadow-xl text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {isTrashView ? (
            // Basurero Context Menu Options
            <>
              <button
                type="button"
                onClick={() => {
                  const ids = selectedSnippetIds.has(contextMenu.snippet.id)
                    ? Array.from(selectedSnippetIds)
                    : [contextMenu.snippet.id];
                  onRestoreSnippets?.(ids);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] transition-colors cursor-pointer text-left font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[var(--ayu-success)]" />
                <span>{t.snippetList.restoreToUncategorized}</span>
              </button>
              <div className="h-px bg-[var(--ayu-line)] my-1" />
              <button
                type="button"
                onClick={() => {
                  const ids = selectedSnippetIds.has(contextMenu.snippet.id)
                    ? Array.from(selectedSnippetIds)
                    : [contextMenu.snippet.id];
                  onPermanentlyDeleteSnippets?.(ids);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/15 transition-colors cursor-pointer text-left font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.snippetList.deletePermanently}</span>
              </button>
            </>
          ) : isMultiSelected ? (
            // Multi-selected Context Menu
            <button
              type="button"
              onClick={() => {
                const ids = Array.from(selectedSnippetIds);
                onBatchDeleteSnippets?.(ids);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/15 transition-colors cursor-pointer text-left font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.common.deleteAll}</span>
            </button>
          ) : (
            // Single Snippet Context Menu
            <>
              <button
                type="button"
                onClick={() => {
                  onDuplicateSnippet?.(contextMenu.snippet);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] transition-colors cursor-pointer text-left font-medium"
              >
                <Copy className="w-3.5 h-3.5 text-[var(--ayu-accent)]" />
                <span>{t.common.duplicate}</span>
              </button>
              <div className="h-px bg-[var(--ayu-line)] my-1" />
              <button
                type="button"
                onClick={() => {
                  onDeleteSnippet?.(contextMenu.snippet.id);
                  setContextMenu(null);
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
SnippetList.displayName = "SnippetList";
