import React from "react";
import logoSvg from "@/assets/logo.svg";
import { openExternalUrl } from "@/core/utils/openExternalUrl";
import { useWindowControls } from "@/shared/hooks/useWindowControls";
import { Titlebar, WindowControls, WindowSearchbar } from "@/shared/ui/window-frame";
import { useTranslation } from "@/shared/i18n";

export interface CustomTitlebarProps {
  onSearchClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const CustomTitlebar: React.FC<CustomTitlebarProps> = React.memo(({
  onSearchClick,
  searchQuery = "",
  onSearchChange,
}) => {
  const { isMaximized, handleMinimize, handleToggleMaximize, handleClose } =
    useWindowControls();
  const { t } = useTranslation();

  const brandSlot = (
    <button
      type="button"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      onClick={() => openExternalUrl("https://github.com/dev-yorsh/code-stash-app")}
      title={t.titlebar.visitGithub}
      className="flex items-center space-x-2 px-1.5 py-0.5 -ml-1 rounded hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer group focus:outline-none"
    >
      <img
        src={logoSvg}
        className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110"
        alt="CodeStash Logo"
      />
      <span className="text-[12px] font-semibold tracking-tight text-[var(--titlebar-fg)] group-hover:text-[var(--ayu-accent)] transition-colors">
        Code<span className="text-[var(--ayu-accent)]">Stash</span>
      </span>
    </button>
  );

  const centerSlot = (
    <WindowSearchbar
      value={searchQuery}
      onChange={(q) => onSearchChange?.(q)}
      onClick={onSearchClick}
      placeholder={t.titlebar.searchPlaceholder}
      shortcutBadge="Ctrl K"
    />
  );

  const controlsSlot = (
    <WindowControls
      isMaximized={isMaximized}
      onMinimize={handleMinimize}
      onToggleMaximize={handleToggleMaximize}
      onClose={handleClose}
    />
  );

  return (
    <Titlebar
      brandSlot={brandSlot}
      centerSlot={centerSlot}
      controlsSlot={controlsSlot}
    />
  );
});
CustomTitlebar.displayName = "CustomTitlebar";
