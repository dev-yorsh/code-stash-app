import React, { useEffect } from "react";
import { X, Settings as SettingsIcon } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { SETTINGS_SECTIONS } from "../constants";
import { AppearanceSettings } from "./sections/AppearanceSettings";
import { EditorSettings } from "./sections/EditorSettings";
import { GeneralSettings } from "./sections/GeneralSettings";
import { AboutSettings } from "./sections/AboutSettings";
import { useTranslation } from "@/shared/i18n";

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings, activeSection, setActiveSection } = useSettings();
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSettingsOpen) {
        closeSettings();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen, closeSettings]);

  if (!isSettingsOpen) return null;

  const renderActiveSection = () => {
    switch (activeSection) {
      case "appearance":
        return <AppearanceSettings />;
      case "editor":
        return <EditorSettings />;
      case "general":
        return <GeneralSettings />;
      case "about":
        return <AboutSettings />;
      default:
        return <AppearanceSettings />;
    }
  };

  const currentSectionMeta = SETTINGS_SECTIONS.find((s) => s.id === activeSection);
  const currentSectionLabel = currentSectionMeta
    ? t.settings.sections[currentSectionMeta.id].label
    : "";

  const primarySections = SETTINGS_SECTIONS.filter((s) => s.id !== "about");
  const aboutSection = SETTINGS_SECTIONS.find((s) => s.id === "about");

  const renderNavButton = (section: (typeof SETTINGS_SECTIONS)[number]) => {
    const Icon = section.icon;
    const isActive = activeSection === section.id;
    const sectionLabel = t.settings.sections[section.id].label;

    return (
      <button
        key={section.id}
        type="button"
        onClick={() => setActiveSection(section.id)}
        className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer border-l-2 ${
          isActive
            ? "bg-[var(--ayu-lift)] text-[var(--ayu-editor-fg)] border-[var(--ayu-accent)] shadow-xs"
            : "text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]/60 border-transparent"
        }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive ? "text-[var(--ayu-accent)]" : "text-[var(--ayu-fg)]"
          }`}
        />
        <span className="truncate">{sectionLabel}</span>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={closeSettings}
    >
      <div
        className="bg-[var(--ayu-base)] border border-[var(--ayu-border)] rounded-xl shadow-2xl w-full max-w-4xl h-[600px] max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ayu-line)] bg-[var(--ayu-sunk)] select-none">
          <div className="flex items-center space-x-2.5">
            <SettingsIcon className="w-4 h-4 text-[var(--ayu-fg)]" />
            <h3 className="text-sm font-semibold text-[var(--ayu-editor-fg)]">
              {t.settings.modalTitle}
            </h3>
            {currentSectionMeta && (
              <>
                <span className="text-[var(--ayu-fg-subtle)]">/</span>
                <span className="text-xs text-[var(--ayu-fg)]">{currentSectionLabel}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={closeSettings}
            className="text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] p-1 rounded-md hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer"
            title={t.settings.closeTooltip}
            aria-label={t.settings.closeAria}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Split Body Layout: Left Sidebar + Right Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Category Navigation Sidebar */}
          <aside className="w-52 shrink-0 bg-[var(--ayu-sunk)] border-r border-[var(--ayu-line)] p-3 flex flex-col justify-between overflow-y-auto select-none">
            <nav className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)] px-2.5 py-1 block">
                {t.settings.optionsHeader}
              </span>
              {primarySections.map(renderNavButton)}

              {aboutSection && (
                <div className="pt-2 mt-2 border-t border-[var(--ayu-line)]">
                  {renderNavButton(aboutSection)}
                </div>
              )}
            </nav>

            {/* Quick Helper Note */}
            <div className="pt-3 border-t border-[var(--ayu-line)] px-2 text-[10px] text-[var(--ayu-fg-subtle)]">
              {t.settings.pressEscPrefix}{" "}
              <kbd className="bg-[var(--ayu-lift)] px-1 py-0.5 rounded text-[var(--ayu-fg)] border border-[var(--ayu-border)]">
                Esc
              </kbd>{" "}
              {t.settings.pressEscSuffix}
            </div>
          </aside>

          {/* Right Configuration Panel View */}
          <main className="flex-1 bg-[var(--ayu-base)] p-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto">{renderActiveSection()}</div>
          </main>
        </div>
      </div>
    </div>
  );
};
