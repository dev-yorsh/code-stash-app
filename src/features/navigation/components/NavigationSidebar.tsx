import React, { ReactNode } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { useSettings } from "@/features/settings";
import { useTranslation } from "@/shared/i18n";

export interface NavigationSidebarProps {
  width: number;
  onStartResizing: (e: React.MouseEvent) => void;
  folderTreeSlot: ReactNode;
  tagListSlot: ReactNode;
  version?: string;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = React.memo(({
  width,
  onStartResizing,
  folderTreeSlot,
  tagListSlot,
  version = "v0.1.0",
}) => {
  const { openSettings } = useSettings();
  const { t } = useTranslation();

  return (
    <>
      <aside
        style={{ width: `${width}px` }}
        className="shrink-0 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col justify-between overflow-hidden"
      >
        {/* Top: Folders & Navigation (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {folderTreeSlot}
        </div>

        {/* Bottom Footer Section: Tags & Configuración */}
        <div className="shrink-0 border-t border-[var(--sidebar-footer-border)] bg-[var(--sidebar-footer-bg)] flex flex-col">
          <div className="p-2.5 pb-2 max-h-44 overflow-y-auto">
            {tagListSlot}
          </div>

          {/* Settings button in bottom left footer */}
          <div className="pt-2 pb-2.5 border-t border-[var(--sidebar-footer-border)] px-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => openSettings("appearance")}
              className="flex items-center space-x-2 px-2 py-1.5 rounded-md text-xs font-medium text-[var(--sidebar-fg)] hover:text-[var(--sidebar-active-fg)] hover:bg-[var(--sidebar-hover-bg)] transition-colors cursor-pointer group"
              title={t.sidebar.settingsTooltip}
              aria-label={t.sidebar.settingsAria}
            >
              <SettingsIcon className="w-3.5 h-3.5 text-[var(--sidebar-fg)] group-hover:text-[var(--sidebar-active-fg)] group-hover:rotate-45 transition-all duration-200" />
              <span>{t.sidebar.settings}</span>
            </button>
            <span className="text-[10px] text-[var(--sidebar-fg-subtle)] font-mono pr-1 select-none">
              {version}
            </span>
          </div>
        </div>
      </aside>

      {/* Resizer divider handle (zero layout width so columns align flush) */}
      <div
        onMouseDown={onStartResizing}
        className="w-0 cursor-col-resize shrink-0 z-10 relative group"
        title={t.sidebar.resizeFoldersTooltip}
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5 group-hover:bg-[var(--resizer-hover-bg,var(--ayu-border))]/60 group-active:bg-[var(--resizer-active-bg,var(--ayu-fg-subtle))]/50 transition-colors" />
      </div>
    </>
  );
});
NavigationSidebar.displayName = "NavigationSidebar";
