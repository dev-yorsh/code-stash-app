import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clampFloatingCoords } from "../utils/spellcheckHelpers";

export interface EditorFloatingMenuItemProps {
  testId?: string;
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
}

export const EditorFloatingMenuItem: React.FC<EditorFloatingMenuItemProps> = ({
  testId,
  icon,
  label,
  onClick,
}) => (
  <button
    type="button"
    role="menuitem"
    data-testid={testId}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[12.5px] text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] transition-colors cursor-pointer"
  >
    {icon && <span className="shrink-0 text-[var(--ayu-fg)]">{icon}</span>}
    <span className="truncate">{label}</span>
  </button>
);

export const EditorFloatingMenuDivider: React.FC = () => (
  <div className="my-1 border-t border-[var(--ayu-border)]/70" />
);

export interface EditorFloatingMenuProps {
  testId: string;
  anchor: { x: number; y: number };
  onClose: () => void;
  onEscape?: () => void;
  children: React.ReactNode;
}

/**
 * Lightweight, theme-adaptive floating context menu shared by code editing and
 * Markdown preview panels to replace native browser/Electron menus consistently.
 */
export const EditorFloatingMenu: React.FC<EditorFloatingMenuProps> = ({
  testId,
  anchor,
  onClose,
  onEscape,
  children,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>(() =>
    clampFloatingCoords(anchor.x, anchor.y, 210, 220)
  );

  useLayoutEffect(() => {
    const el = menuRef.current;
    const width = el?.offsetWidth || 210;
    const height = el?.offsetHeight || 220;
    setPosition(clampFloatingCoords(anchor.x, anchor.y, width, height));
  }, [anchor.x, anchor.y, children]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        onEscape?.();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, onEscape]);

  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid={testId}
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="fixed z-50 w-[216px] rounded-xl border border-[var(--ayu-border)] bg-[var(--menu-bg)] shadow-2xl p-1.5 text-[12.5px] text-[var(--ayu-editor-fg)] select-none animate-toolbar-popover"
    >
      {children}
    </div>
  );
};
