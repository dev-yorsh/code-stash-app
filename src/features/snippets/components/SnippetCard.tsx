import React from "react";
import { Snippet } from "@/core/types";
import { Star, Folder as FolderIcon } from "lucide-react";
import { TagGlyph } from "@/features/tags";
import { useTranslation } from "@/shared/i18n";

interface SnippetCardProps {
  snippet: Snippet;
  isSelected: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onToggleFavorite?: (id: string) => void;
  folderName?: string;
  onContextMenu?: (e: React.MouseEvent, snippet: Snippet) => void;
  onDragStart?: (e: React.DragEvent, snippet: Snippet) => void;
}

export const SnippetCard: React.FC<SnippetCardProps> = React.memo(({
  snippet,
  isSelected,
  onSelect,
  folderName,
  onContextMenu,
  onDragStart,
}) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = React.useState(false);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
      return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
    } catch {
      return "";
    }
  };

  const isVisualSelected = isSelected && !isDragging;
  const displayTitle =
    !snippet.title ||
    snippet.title === "Untitled Snippet" ||
    snippet.title === "Snippet sin título"
      ? t.snippetList.untitledSnippet
      : snippet.title;

  return (
    <div
      data-snippet-id={snippet.id}
      draggable={true}
      onDragStart={(e) => {
        onDragStart?.(e, snippet);
        requestAnimationFrame(() => setIsDragging(true));
      }}
      onDragEnd={() => setIsDragging(false)}
      onClick={(e) => onSelect(snippet.id, e)}
      onContextMenu={(e) => onContextMenu?.(e, snippet)}
      className={`group relative px-3.5 py-2.5 transition-colors cursor-pointer select-none border-b border-[var(--list-card-border)] ${
        isDragging
          ? "opacity-25 bg-transparent text-[var(--list-card-title)]"
          : isSelected
          ? "bg-[var(--list-active-bg)] text-white shadow-xs"
          : "bg-transparent hover:bg-[var(--list-card-hover-bg)] text-[var(--list-card-title)]"
      }`}
    >
      {/* Top line: Title & Favorite indicator */}
      <div className="flex items-center justify-between gap-1.5 mb-0.5">
        <h4
          className={`text-[13px] font-medium leading-tight truncate ${
            isVisualSelected ? "text-white font-semibold" : "text-[var(--list-card-title)]"
          }`}
        >
          {displayTitle}
        </h4>
        <div className="flex items-center space-x-1 shrink-0">
          {snippet.is_favorite ? (
            <Star
              className={`w-3 h-3 ${
                isVisualSelected ? "text-white fill-white" : "text-[var(--ayu-accent)] fill-[var(--ayu-accent)]"
              }`}
            />
          ) : null}
        </div>
      </div>

      {/* Middle line: Tags or Description Preview */}
      {snippet.tags && snippet.tags.length > 0 ? (
        <div className="flex items-center gap-1 my-1 flex-wrap overflow-hidden">
          {snippet.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded-sm ${
                isVisualSelected
                  ? "bg-white/20 text-white"
                  : "bg-[var(--list-tag-bg)] text-[var(--list-tag-fg)] border border-[var(--list-tag-border)]"
              }`}
            >
              <TagGlyph
                color={tag.color || "currentColor"}
                className="w-[1em] h-[1em]"
              />
              <span>{tag.name}</span>
            </span>
          ))}
          {snippet.tags.length > 3 && (
            <span
              className={`text-[10px] font-mono ${
                isVisualSelected ? "text-white/70" : "text-[var(--list-card-sub)]"
              }`}
            >
              +{snippet.tags.length - 3}
            </span>
          )}
        </div>
      ) : snippet.description ? (
        <p
          className={`text-[11px] line-clamp-1 my-0.5 leading-snug ${
            isVisualSelected ? "text-white/80" : "text-[var(--list-card-sub)]"
          }`}
        >
          {snippet.description}
        </p>
      ) : null}

      {/* Bottom line: Folder Name + Date */}
      <div
        className={`flex items-center justify-between gap-2 mt-1 text-[11px] ${
          isVisualSelected ? "text-white/75" : "text-[var(--list-card-sub)]"
        }`}
      >
        <div className="flex items-center gap-1 truncate">
          <FolderIcon className="w-3 h-3 shrink-0 opacity-75" />
          <span className="truncate">{folderName || t.sidebar.uncategorized}</span>
        </div>
        <span className="font-mono text-[10px] shrink-0 opacity-80">
          {formatDate(snippet.updated_at || snippet.created_at)}
        </span>
      </div>
    </div>
  );
});
SnippetCard.displayName = "SnippetCard";
