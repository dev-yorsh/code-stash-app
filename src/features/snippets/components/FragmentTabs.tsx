import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from "react";
import { SnippetFragment } from "@/core/types";
import { Plus, X } from "lucide-react";
import { useTranslation } from "@/shared/i18n";

/**
 * Reorders a list of snippet fragments by placing sourceId before or after targetId.
 */
function reorderFragments(
  list: SnippetFragment[],
  sourceId: string,
  targetId: string,
  position: "before" | "after"
): SnippetFragment[] {
  const sourceIndex = list.findIndex((item) => item.id === sourceId);
  const targetIndex = list.findIndex((item) => item.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return list;
  }

  const result = [...list];
  const [removed] = result.splice(sourceIndex, 1);

  const newTargetIndex = result.findIndex((item) => item.id === targetId);
  if (newTargetIndex === -1) return list;

  const insertIndex = position === "before" ? newTargetIndex : newTargetIndex + 1;
  result.splice(insertIndex, 0, removed);

  return result;
}

/**
 * TabPlusIcon: Icon representing adding a new tab / pestaña.
 * Displays a window frame with a top tab bar, active tab separator, and a centered plus sign.
 */
export const TabPlusIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="M2 9h20" />
    <path d="M8 4v5" />
    <path d="M12 13v4" />
    <path d="M10 15h4" />
  </svg>
);

interface FragmentTabsProps {
  fragments: SnippetFragment[];
  activeFragmentId: string;
  onSelectFragment: (id: string) => void;
  onAddFragment?: () => void;
  onRenameFragment?: (id: string, newLabel: string) => void;
  onDeleteFragment?: (id: string) => void;
  onReorderFragments?: (fragments: SnippetFragment[]) => void;
  readOnly?: boolean;
  newlyAddedId?: string | null;
  dividerHeight?: string | number;
}

export const FragmentTabs: React.FC<FragmentTabsProps> = ({
  fragments,
  activeFragmentId,
  onSelectFragment,
  onAddFragment,
  onRenameFragment,
  onDeleteFragment,
  onReorderFragments,
  readOnly = false,
  newlyAddedId,
  dividerHeight,
}) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const newTabRef = useRef<HTMLDivElement>(null);
  const [internalNewId, setInternalNewId] = useState<string | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const prevCountRef = useRef(fragments.length);

  const effectiveDividerHeight = useMemo(() => {
    if (dividerHeight !== undefined) {
      return typeof dividerHeight === "number" ? `${dividerHeight}%` : dividerHeight;
    }
    return "var(--fragments-divider-height, 50%)";
  }, [dividerHeight]);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<{
    fragmentId: string;
    startIndex: number;
    startX: number;
    tabWidth: number;
    isDragging: boolean;
    currentDx: number;
    targetIndex: number;
    isSnapping: boolean;
  } | null>(null);
  const tabElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const wasDraggingRef = useRef(false);

  // Check whether tabs exceed visible container width
  const checkOverflow = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 1;
    setIsOverflowing(overflowing);
    if (!overflowing) {
      el.scrollLeft = 0;
    }
  }, []);

  useLayoutEffect(() => {
    checkOverflow();
  }, [fragments, checkOverflow]);

  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      checkOverflow();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkOverflow]);

  // Support mouse wheel horizontal scrolling when tabs overflow
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isOverflowing) return;
    const el = tabsContainerRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    if (fragments.length > prevCountRef.current) {
      const added = fragments[fragments.length - 1];
      if (added) {
        setInternalNewId(added.id);
        const timer = setTimeout(() => setInternalNewId(null), 400);
        return () => clearTimeout(timer);
      }
    }
    prevCountRef.current = fragments.length;
  }, [fragments.length]);

  const effectiveNewId = newlyAddedId || internalNewId;

  // Scroll to reveal new tab ONLY when tabs actually overflow available width
  useEffect(() => {
    if (effectiveNewId && isOverflowing && tabsContainerRef.current) {
      tabsContainerRef.current.scrollTo({
        left: tabsContainerRef.current.scrollWidth,
        behavior: "smooth",
      });
    }
  }, [effectiveNewId, isOverflowing]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (fragment: SnippetFragment) => {
    if (readOnly || !onRenameFragment) return;
    setEditingId(fragment.id);
    setEditingLabel(fragment.label);
  };

  const commitEditing = (id: string) => {
    if (!editingId) return;
    const trimmed = editingLabel.trim();
    if (trimmed && onRenameFragment) {
      onRenameFragment(id, trimmed);
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  // Fluid pointer-based horizontal drag with 51% threshold
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    fragmentId: string,
    index: number
  ) => {
    if (readOnly || editingId !== null || e.button !== 0) {
      return;
    }

    // Immediately activate the interacted fragment so previous tab loses highlight
    if (fragmentId !== activeFragmentId) {
      onSelectFragment(fragmentId);
    }

    if (fragments.length <= 1) {
      return;
    }

    const el = tabElementsRef.current.get(fragmentId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tabWidth = rect.width;

    dragRef.current = {
      fragmentId,
      startIndex: index,
      startX: e.clientX,
      tabWidth,
      isDragging: false,
      currentDx: 0,
      targetIndex: index,
      isSnapping: false,
    };

    const handleGlobalPointerMove = (moveEv: PointerEvent) => {
      if (!dragRef.current || dragRef.current.isSnapping) return;

      const rawDx = moveEv.clientX - dragRef.current.startX;

      // Start drag threshold
      if (!dragRef.current.isDragging) {
        if (Math.abs(rawDx) > 3) {
          dragRef.current.isDragging = true;
          wasDraggingRef.current = true;
          setDraggingId(dragRef.current.fragmentId);
        } else {
          return;
        }
      }

      // Constrain strictly horizontal movement within container limits
      const W = dragRef.current.tabWidth;
      const sourceIdx = dragRef.current.startIndex;
      const minDx = -sourceIdx * W;
      const maxDx = (fragments.length - 1 - sourceIdx) * W;
      // Clamped strictly horizontal offset (translateY is locked to 0)
      const clampedDx = Math.max(minDx - 15, Math.min(maxDx + 15, rawDx));
      dragRef.current.currentDx = clampedDx;

      const dragEl = tabElementsRef.current.get(dragRef.current.fragmentId);
      if (dragEl) {
        dragEl.style.transform = `translate3d(${clampedDx}px, 0px, 0px)`;
        dragEl.style.transition = "none";
      }

      // 51% Threshold calculation:
      // <= 50% returns to initial slot; >= 51% swaps slot
      let targetSlot = sourceIdx;
      if (clampedDx > 0) {
        const steps = Math.floor((clampedDx + 0.49 * W) / W);
        targetSlot = Math.min(fragments.length - 1, sourceIdx + steps);
      } else if (clampedDx < 0) {
        const steps = Math.floor((Math.abs(clampedDx) + 0.49 * W) / W);
        targetSlot = Math.max(0, sourceIdx - steps);
      }
      dragRef.current.targetIndex = targetSlot;

      // Displace adjacent tabs fluidly while dragging
      fragments.forEach((frag, i) => {
        if (frag.id === dragRef.current?.fragmentId) return;
        const otherEl = tabElementsRef.current.get(frag.id);
        if (!otherEl) return;
        otherEl.style.transition = "transform 200ms cubic-bezier(0.2, 0, 0, 1)";
        if (sourceIdx < targetSlot && i > sourceIdx && i <= targetSlot) {
          otherEl.style.transform = `translate3d(-${W}px, 0px, 0px)`;
        } else if (sourceIdx > targetSlot && i < sourceIdx && i >= targetSlot) {
          otherEl.style.transform = `translate3d(${W}px, 0px, 0px)`;
        } else {
          otherEl.style.transform = "translate3d(0px, 0px, 0px)";
        }
      });

      // Auto-scroll when dragging near container edges
      if (isOverflowing && tabsContainerRef.current) {
        const cRect = tabsContainerRef.current.getBoundingClientRect();
        if (moveEv.clientX < cRect.left + 40) {
          tabsContainerRef.current.scrollLeft -= 6;
        } else if (moveEv.clientX > cRect.right - 40) {
          tabsContainerRef.current.scrollLeft += 6;
        }
      }
    };

    const handleGlobalPointerUp = () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);

      if (!dragRef.current) return;

      if (!dragRef.current.isDragging) {
        const clickedId = dragRef.current.fragmentId;
        dragRef.current = null;
        onSelectFragment(clickedId);
        return;
      }

      const { fragmentId: draggedFragId, startIndex, targetIndex, tabWidth: W, currentDx } =
        dragRef.current;
      const dragPct = Math.abs(currentDx) / W;
      const shouldSwap = dragPct >= 0.51 && targetIndex !== startIndex;
      const dragEl = tabElementsRef.current.get(draggedFragId);
      dragRef.current.isSnapping = true;

      if (shouldSwap) {
        // Animate dragged tab smoothly into the target slot
        const targetOffset = (targetIndex - startIndex) * W;
        if (dragEl) {
          dragEl.style.transition = "transform 180ms cubic-bezier(0.2, 0.9, 0.3, 1)";
          dragEl.style.transform = `translate3d(${targetOffset}px, 0px, 0px)`;
        }

        setTimeout(() => {
          tabElementsRef.current.forEach((el) => {
            el.style.transform = "";
            el.style.transition = "";
          });

          if (onReorderFragments) {
            const targetFrag = fragments[targetIndex];
            const nextFragments = targetFrag
              ? reorderFragments(
                  fragments,
                  draggedFragId,
                  targetFrag.id,
                  targetIndex > startIndex ? "after" : "before"
                )
              : fragments;
            onReorderFragments(nextFragments);
          }

          setDraggingId(null);
          dragRef.current = null;
          setTimeout(() => {
            wasDraggingRef.current = false;
          }, 50);
        }, 180);
      } else {
        // Offset is <= 50%: Snap back to initial position with a fluid animation
        if (dragEl) {
          dragEl.style.transition = "transform 220ms cubic-bezier(0.25, 1, 0.5, 1)";
          dragEl.style.transform = "translate3d(0px, 0px, 0px)";
        }

        // Neighbor tabs also glide back smoothly to 0
        fragments.forEach((frag) => {
          if (frag.id === draggedFragId) return;
          const otherEl = tabElementsRef.current.get(frag.id);
          if (otherEl) {
            otherEl.style.transition = "transform 220ms cubic-bezier(0.25, 1, 0.5, 1)";
            otherEl.style.transform = "translate3d(0px, 0px, 0px)";
          }
        });

        setTimeout(() => {
          tabElementsRef.current.forEach((el) => {
            el.style.transform = "";
            el.style.transition = "";
          });
          setDraggingId(null);
          dragRef.current = null;
          setTimeout(() => {
            wasDraggingRef.current = false;
          }, 50);
        }, 220);
      }
    };

    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
  };

  // Clean up any remaining transforms on unmount
  useEffect(() => {
    return () => {
      dragRef.current = null;
      tabElementsRef.current.clear();
    };
  }, []);

  return (
    <div className="w-full flex items-stretch h-8 bg-[var(--fragments-bar-bg)] border-b border-[var(--fragments-bar-border)] select-none shrink-0 overflow-hidden relative">
      {/* Dynamic responsive tabs taking full available width */}
      <div
        ref={tabsContainerRef}
        onWheel={handleWheel}
        className={`flex-1 flex items-stretch min-w-0 ${
          isOverflowing ? "overflow-x-auto fragments-scroll-container" : "overflow-x-hidden"
        }`}
      >
        {fragments.map((fragment, index) => {
          const isActive = fragment.id === activeFragmentId;
          const isEditing = editingId === fragment.id;
          const isNew = fragment.id === effectiveNewId;
          const isDraggingThis = draggingId === fragment.id;
          const isLastTab = index === fragments.length - 1;
          const hasAddButton = !readOnly && Boolean(onAddFragment);
          const showDivider = !isDraggingThis && (!isLastTab || hasAddButton);

          return (
            <div
              key={fragment.id}
              ref={(el) => {
                if (el) {
                  tabElementsRef.current.set(fragment.id, el);
                  if (isNew) {
                    (newTabRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                  }
                } else {
                  tabElementsRef.current.delete(fragment.id);
                }
              }}
              onPointerDown={(e) => handlePointerDown(e, fragment.id, index)}
              onClick={() => {
                if (wasDraggingRef.current) return;
                onSelectFragment(fragment.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startEditing(fragment);
              }}
              className={`flex-1 min-w-[80px] h-full flex items-center justify-center px-3 text-[12px] relative group select-none overflow-hidden will-change-transform ${
                !readOnly && !isEditing
                  ? "cursor-grab active:cursor-grabbing"
                  : "cursor-pointer"
              } ${
                isDraggingThis
                  ? "z-50 shadow-[0_4px_16px_rgba(0,0,0,0.55),0_0_0_1px_var(--ayu-accent)/40] cursor-grabbing"
                  : ""
              } ${
                isNew ? "animate-fragment-tab-slide-left z-10" : ""
              } ${
                isActive
                  ? "bg-[var(--fragment-tab-active-bg)] text-[var(--fragment-tab-active-fg)] font-semibold shadow-xs before:content-[''] before:absolute before:top-0 before:inset-x-0 before:h-[2px] before:bg-[var(--fragment-tab-active-line)]"
                  : "bg-[var(--fragment-tab-inactive-bg)] text-[var(--fragment-tab-inactive-fg)] hover:text-[var(--fragment-tab-hover-fg)] hover:bg-[var(--fragment-tab-hover-bg)]"
              }`}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onBlur={() => commitEditing(fragment.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEditing(fragment.id);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEditing();
                    }
                  }}
                  className="w-full text-center bg-transparent border-0 border-b border-[var(--ayu-border)] outline-none text-[12px] font-medium text-[var(--ayu-editor-fg)] py-0 px-1"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                <div
                  className={`flex items-center truncate max-w-full justify-center pointer-events-none ${
                    isNew ? "animate-fragment-content-slide-left" : ""
                  }`}
                  title={
                    !readOnly
                      ? t.editor.fragmentTabTooltip(fragment.label)
                      : fragment.label
                  }
                >
                  <span className="truncate">{fragment.label}</span>
                </div>
              )}

              {/* Close tab button */}
              {!readOnly && onDeleteFragment && fragments.length > 1 && !isEditing && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFragment(fragment.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-[var(--ayu-fg-subtle)] hover:text-[var(--ayu-error)] hover:bg-[var(--ayu-line)] cursor-pointer"
                  title={t.editor.closeFragmentTooltip(fragment.label)}
                  aria-label={t.editor.closeFragmentTooltip(fragment.label)}
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Centered partial vertical divider (50% default, configurable) */}
              {showDivider && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-[var(--fragments-divider-width,1px)] bg-[var(--fragments-divider-color,var(--fragments-bar-border))] pointer-events-none"
                  style={{ height: effectiveDividerHeight }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Add new fragment tab button pinned at far right */}
      {!readOnly && onAddFragment && (
        <button
          type="button"
          onClick={onAddFragment}
          className="shrink-0 w-8 h-full flex items-center justify-center text-[var(--fragment-tab-inactive-fg)] hover:text-[var(--fragment-tab-hover-fg)] hover:bg-[var(--fragment-tab-hover-bg)] transition-colors cursor-pointer"
          title={t.editor.addFragmentShortTooltip}
          aria-label={t.editor.addFragmentShortTooltip}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

