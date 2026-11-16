import React, { useState, useRef, useEffect, useCallback } from "react";
import { Tag } from "@/core/types";
import { Plus, Pencil, Palette, Trash2 } from "lucide-react";
import { PRESET_TAG_COLORS } from "../constants";
import { TagGlyph } from "./TagGlyph";
import { useTranslation } from "@/shared/i18n";

export interface TagListProps {
  tags: Tag[];
  activeTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onNewTag: () => void;
  onUpdateTag?: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteTag: (tagId: string) => void;
  counts: Record<string, number>;
}

interface TagContextMenuState {
  x: number;
  y: number;
  tag: Tag;
  draftName: string;
  draftColor: string;
}

export const TagList: React.FC<TagListProps> = React.memo(({
  tags,
  activeTagId,
  onSelectTag,
  onNewTag,
  onUpdateTag,
  onDeleteTag,
  counts,
}) => {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<TagContextMenuState | null>(null);
  const contextMenuRefState = useRef<TagContextMenuState | null>(null);
  const menuDomRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Auto-save changes on exiting menu
  const flushPendingSave = useCallback(() => {
    const state = contextMenuRefState.current;
    if (!state) return;

    const { tag, draftName, draftColor } = state;
    const trimmed = draftName.trim();
    const nameChanged = trimmed.length > 0 && trimmed !== tag.name;
    const colorChanged = draftColor !== (tag.color || "");

    if ((nameChanged || colorChanged) && onUpdateTag) {
      onUpdateTag(tag.id, {
        ...(nameChanged ? { name: trimmed } : {}),
        ...(colorChanged ? { color: draftColor } : {}),
      });
    }

    contextMenuRefState.current = null;
    setContextMenu(null);
  }, [onUpdateTag]);

  // Close context menu and auto-save on pointerdown outside or Escape/Enter
  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (menuDomRef.current && !menuDomRef.current.contains(e.target as Node)) {
        flushPendingSave();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        flushPendingSave();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu, flushPendingSave]);

  // Focus and select rename input text when context menu opens
  useEffect(() => {
    if (contextMenu && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [contextMenu?.tag.id]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tag: Tag) => {
      e.preventDefault();
      e.stopPropagation();

      // Flush previous pending save if another menu was open
      flushPendingSave();

      // Select the tag on secondary click per requirements
      onSelectTag(tag.id);

      const menuWidth = 216;
      const menuHeight = 220;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);

      const initialColor = tag.color || PRESET_TAG_COLORS[4];
      const newState: TagContextMenuState = {
        x,
        y,
        tag,
        draftName: tag.name,
        draftColor: initialColor,
      };

      contextMenuRefState.current = newState;
      setContextMenu(newState);
    },
    [flushPendingSave, onSelectTag]
  );

  const handleDraftNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContextMenu((prev) => {
      if (!prev) return null;
      const next = { ...prev, draftName: val };
      contextMenuRefState.current = next;
      return next;
    });
  };

  const handleDraftColorSelect = (color: string) => {
    setContextMenu((prev) => {
      if (!prev) return null;
      const next = { ...prev, draftColor: color };
      contextMenuRefState.current = next;
      return next;
    });
  };

  const handleDeleteFromMenu = useCallback(() => {
    if (!contextMenu) return;
    const tagId = contextMenu.tag.id;
    // Discard draft update on delete
    contextMenuRefState.current = null;
    setContextMenu(null);
    onDeleteTag(tagId);
  }, [contextMenu, onDeleteTag]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2.5 py-1">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--sidebar-fg-subtle)]">
          {t.sidebar.tagsHeader}
        </span>
        <button
          onClick={onNewTag}
          className="text-[var(--sidebar-fg-subtle)] hover:text-[var(--sidebar-active-fg)] p-0.5 rounded hover:bg-[var(--sidebar-hover-bg)] transition-colors cursor-pointer"
          title={t.sidebar.createTag}
          aria-label={t.sidebar.createTag}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 px-2">
        {tags.length === 0 ? (
          <div className="py-1 text-[11px] text-[var(--ayu-fg-subtle)] italic">
            {t.sidebar.noTags}
          </div>
        ) : (
          tags.map((tag) => {
            const isActive = activeTagId === tag.id;
            const count = counts[tag.id] || 0;

            return (
              <span
                key={tag.id}
                onClick={() => onSelectTag(isActive ? null : tag.id)}
                onContextMenu={(e) => handleContextMenu(e, tag)}
                className={`group inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer select-none ${isActive
                  ? "bg-[var(--sidebar-tag-active-bg)] text-[var(--sidebar-tag-active-fg)] border-[var(--sidebar-tag-active-border)] font-medium"
                  : "bg-[var(--sidebar-tag-bg)] text-[var(--sidebar-tag-fg)] border-[var(--sidebar-tag-border)] hover:bg-[var(--sidebar-tag-hover-bg)] hover:border-[var(--sidebar-tag-hover-border)] hover:text-[var(--sidebar-tag-hover-fg)]"
                  }`}
              >
                <TagGlyph
                  color={tag.color || "var(--sidebar-tag-fg)"}
                  className="w-[1em] h-[1em]"
                />
                <span>{tag.name}</span>
                <span className="text-[10px] text-[var(--ayu-fg-subtle)]">{count}</span>
              </span>
            );
          })
        )}
      </div>

      {/* Floating Context Menu on Secondary Click */}
      {contextMenu && (
        <div
          ref={menuDomRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-52 p-2 bg-[var(--menu-bg)] border border-[var(--ayu-border)] rounded-md shadow-xl text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Renombrar */}
          <div className="space-y-1 mb-2.5">
            <label
              htmlFor="tag-rename-input"
              className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--ayu-fg-subtle)] px-0.5"
            >
              <Pencil className="w-3 h-3 text-[var(--ayu-accent)]" />
              <span>{t.common.rename}</span>
            </label>
            <input
              id="tag-rename-input"
              ref={renameInputRef}
              type="text"
              value={contextMenu.draftName}
              onChange={handleDraftNameChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  flushPendingSave();
                }
              }}
              placeholder={t.sidebar.tagRenamePlaceholder}
              className="w-full h-6 px-2 text-[12px] bg-[var(--ayu-editor-bg)] text-[var(--ayu-editor-fg)] border border-[var(--ayu-border)] rounded focus:border-[var(--ayu-accent)] outline-none transition-colors"
            />
          </div>

          {/* Cambiar color */}
          <div className="space-y-1.5 mb-2.5">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--ayu-fg-subtle)]">
                <Palette className="w-3 h-3 text-[var(--ayu-accent)]" />
                <span>{t.sidebar.changeColor}</span>
              </div>
              <TagGlyph color={contextMenu.draftColor} className="w-3.5 h-3.5" />
            </div>
            <div className="grid grid-cols-5 gap-1.5 px-0.5 pt-0.5">
              {PRESET_TAG_COLORS.map((c) => {
                const isSelected =
                  contextMenu.draftColor.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleDraftColorSelect(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? "ring-2 ring-white scale-110 shadow-sm"
                        : "opacity-70 hover:opacity-100 hover:scale-105"
                    }`}
                    title={c}
                    aria-label={t.sidebar.selectColorAria(c)}
                  />
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[var(--ayu-line)] my-1.5" />

          {/* Eliminar */}
          <button
            type="button"
            onClick={handleDeleteFromMenu}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/10 rounded transition-colors cursor-pointer text-left font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.common.delete}</span>
          </button>
        </div>
      )}
    </div>
  );
});

TagList.displayName = "TagList";
