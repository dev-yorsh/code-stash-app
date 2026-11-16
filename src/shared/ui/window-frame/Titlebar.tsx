import React, { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface TitlebarProps {
  brandSlot?: ReactNode;
  centerSlot?: ReactNode;
  actionsSlot?: ReactNode;
  controlsSlot?: ReactNode;
  className?: string;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  brandSlot,
  centerSlot,
  actionsSlot,
  controlsSlot,
  className,
}) => {
  return (
    <header
      data-tauri-drag-region
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      className={cn(
        "h-10 w-full flex items-center justify-between px-3 bg-[var(--titlebar-bg)] border-b border-[var(--titlebar-border)] select-none z-50 shrink-0",
        className
      )}
    >
      <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} className="flex items-center">
        {brandSlot}
      </div>

      <div data-tauri-drag-region className="flex-1 flex justify-center">
        {centerSlot}
      </div>

      <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} className="flex items-center space-x-2">
        {actionsSlot}
        {controlsSlot}
      </div>
    </header>
  );
};
