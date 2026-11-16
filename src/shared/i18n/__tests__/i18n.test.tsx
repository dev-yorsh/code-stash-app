import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DEFAULT_SETTINGS } from "@/features/settings/constants";
import { SettingsProvider, useSettings } from "@/features/settings/context/SettingsContext";
import { GeneralSettings } from "@/features/settings/components/sections/GeneralSettings";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { getTranslations, useTranslation } from "../index";

function LanguageConsumerProbe() {
  const { language, t } = useTranslation();
  return (
    <div>
      <span data-testid="active-lang">{language}</span>
      <span data-testid="sidebar-all-snippets">{t.sidebar.allSnippets}</span>
      <span data-testid="workspace-empty">{t.workspace.noSnippetSelectedTitle}</span>
    </div>
  );
}

function OpenSettingsTrigger() {
  const { openSettings } = useSettings();
  return (
    <button type="button" onClick={() => openSettings("general")} data-testid="open-settings-btn">
      Open
    </button>
  );
}

describe("Multi-language Support (i18n - Español & English)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to Spanish ('es') in DEFAULT_SETTINGS", () => {
    expect(DEFAULT_SETTINGS.language).toBe("es");
    const es = getTranslations("es");
    const en = getTranslations("en");

    expect(es.settings.general.languageName).toBe("Idioma");
    expect(en.settings.general.languageName).toBe("Language");
    expect(es.sidebar.allSnippets).toBe("Todos los snippets");
    expect(en.sidebar.allSnippets).toBe("All Snippets");
  });

  it("renders Spanish by default and switches to English when selected in GeneralSettings", () => {
    render(
      <SettingsProvider>
        <GeneralSettings />
        <LanguageConsumerProbe />
      </SettingsProvider>
    );

    // Default is Spanish ("es")
    expect(screen.getByTestId("active-lang").textContent).toBe("es");
    expect(screen.getByText("Idioma")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-all-snippets").textContent).toBe("Todos los snippets");
    expect(screen.getByTestId("workspace-empty").textContent).toBe("Ningún snippet seleccionado");

    // Select English ("en") via the GeneralSettings dropdown
    const select = screen.getByLabelText("Idioma") as HTMLSelectElement;
    expect(select.value).toBe("es");

    fireEvent.change(select, { target: { value: "en" } });

    // Entire UI updates to English
    expect(screen.getByTestId("active-lang").textContent).toBe("en");
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-all-snippets").textContent).toBe("All Snippets");
    expect(screen.getByTestId("workspace-empty").textContent).toBe("No snippet selected");
    expect(document.documentElement.lang).toBe("en");
  });

  it("localizes SettingsModal navigation sections in both Spanish and English", () => {
    render(
      <SettingsProvider>
        <OpenSettingsTrigger />
        <SettingsModal />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByTestId("open-settings-btn"));

    // Spanish default
    expect(screen.getByText("Configuración")).toBeInTheDocument();
    expect(screen.getByText("Apariencia")).toBeInTheDocument();
    expect(screen.getByText("Acerca de")).toBeInTheDocument();

    // Switch to English inside General tab (active by default)
    const select = screen.getByLabelText("Idioma") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "en" } });

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
  });
});
