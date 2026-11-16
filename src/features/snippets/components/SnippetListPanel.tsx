import React, { ReactNode } from "react";
import { useTranslation } from "@/shared/i18n";

export interface SnippetListPanelProps {
  width: number;
  onStartResizing: (e: React.MouseEvent) => void;
  children: ReactNode;
}

export const SnippetListPanel: React.FC<SnippetListPanelProps> = React.memo(({
  width,
  onStartResizing,
  children,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <section
        style={{ width: `${width}px` }}
        className="shrink-0 h-full overflow-hidden"
      >
        {children}
      </section>

      {/* Resizer: Snippet List / Workspace (zero layout width so workspace/footer flush left) */}
      <div
        onMouseDown={onStartResizing}
        className="w-0 cursor-col-resize shrink-0 z-10 relative group"
        title={t.snippetList.resizeListTooltip}
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5 group-hover:bg-[var(--ayu-border)]/60 group-active:bg-[var(--ayu-fg-subtle)]/50 transition-colors" />
      </div>
    </>
  );
});
SnippetListPanel.displayName = "SnippetListPanel";
