import React from "react";
import { clsx } from "clsx";

export interface SettingsSectionHeaderProps {
  title: string;
  subtitle?: string;
}

export const SettingsSectionHeader: React.FC<SettingsSectionHeaderProps> = ({
  title,
  subtitle,
}) => (
  <div>
    <h2 className="text-lg font-semibold text-[var(--ayu-editor-fg)]">{title}</h2>
    {subtitle && <p className="text-xs text-[var(--ayu-fg)] mt-0.5">{subtitle}</p>}
  </div>
);

export interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({ children, className }) => (
  <div
    className={clsx(
      "rounded-xl border border-[var(--ayu-border)] bg-[var(--ayu-sunk)]/55 overflow-hidden",
      className
    )}
  >
    {children}
  </div>
);

export interface SettingItemProps {
  category?: string;
  name: string;
  description?: string;
  children: React.ReactNode;
  note?: string;
  layout?: "stacked" | "inline";
  className?: string;
}

/**
 * Reusable setting row inside `SettingsCard` supporting aligned inline controls
 * (toggles, selects, number inputs) and full-width stacked blocks (pickers, sync cards).
 */
export const SettingItem: React.FC<SettingItemProps> = ({
  category,
  name,
  description,
  children,
  note,
  layout = "stacked",
  className,
}) => {
  if (layout === "inline") {
    return (
      <div
        className={clsx(
          "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4",
          className
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <div className="text-xs font-semibold text-[var(--ayu-editor-fg)] select-none">
            {category ? (
              <>
                <span className="text-[var(--ayu-fg)] font-normal">{category}: </span>
                <span>{name}</span>
              </>
            ) : (
              <span>{name}</span>
            )}
          </div>
          {description && (
            <p className="text-[11px] text-[var(--ayu-fg)] leading-relaxed select-none">
              {description}
            </p>
          )}
          {note && (
            <span className="inline-block text-[10px] text-[var(--ayu-fg-subtle)] italic select-none">
              {note}
            </span>
          )}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={clsx("p-4 space-y-3", className)}>
      <div className="space-y-0.5">
        <div className="text-xs font-semibold text-[var(--ayu-editor-fg)] select-none">
          {category ? (
            <>
              <span className="text-[var(--ayu-fg)] font-normal">{category}: </span>
              <span>{name}</span>
            </>
          ) : (
            <span>{name}</span>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-[var(--ayu-fg)] leading-relaxed select-none">
            {description}
          </p>
        )}
      </div>

      <div className="w-full">{children}</div>

      {note && (
        <span className="inline-block text-[10px] text-[var(--ayu-fg-subtle)] italic select-none">
          {note}
        </span>
      )}
    </div>
  );
};
