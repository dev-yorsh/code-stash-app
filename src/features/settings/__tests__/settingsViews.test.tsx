import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SETTINGS_SECTIONS } from "../constants";
import { SettingsProvider, useSettings } from "../context/SettingsContext";
import { SettingsModal } from "../components/SettingsModal";
import { AboutSettings } from "../components/sections/AboutSettings";
import { GeneralSettings } from "../components/sections/GeneralSettings";
import { AppearanceSettings } from "../components/sections/AppearanceSettings";

function SettingsModalLauncher() {
  const { openSettings } = useSettings();
  return (
    <>
      <button type="button" data-testid="open-settings-trigger" onClick={() => openSettings("general")}>
        Open Settings
      </button>
      <SettingsModal />
    </>
  );
}

describe("Settings Views Reorganization & Layout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("orders SETTINGS_SECTIONS as general, appearance, editor, about and separates Acerca de in SettingsModal", async () => {
    expect(SETTINGS_SECTIONS.map((section) => section.id)).toEqual([
      "general",
      "appearance",
      "editor",
      "about",
    ]);

    render(
      <SettingsProvider>
        <SettingsModalLauncher />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByTestId("open-settings-trigger"));

    const nav = await screen.findByRole("navigation");
    const navButtons = Array.from(nav.querySelectorAll("button"));
    expect(navButtons.map((btn) => btn.textContent?.trim())).toEqual([
      "General",
      "Apariencia",
      "Editor de texto",
      "Acerca de",
    ]);

    // Acerca de resides in its own separated footer group inside the nav
    const aboutButton = screen.getByRole("button", { name: "Acerca de" });
    expect(aboutButton.parentElement?.className).toContain("border-t");
  });

  it("renders AboutSettings contact and social links in a single 3-column grid row", () => {
    render(
      <SettingsProvider>
        <AboutSettings />
      </SettingsProvider>
    );

    const grid = screen.getByTestId("about-contact-grid");
    expect(grid.className).toContain("grid-cols-3");
    expect(screen.getByRole("button", { name: /GitHub/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /LinkedIn/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Correo/i })).toBeTruthy();
  });

  it("removes Almacenamiento Local and Restablecer Configuracion from GeneralSettings and renders concise sync/backup controls", () => {
    render(
      <SettingsProvider>
        <GeneralSettings />
      </SettingsProvider>
    );

    expect(screen.queryByText(/Almacenamiento Local/i)).toBeNull();
    expect(screen.queryByText(/Restablecer Configuraci[oó]n/i)).toBeNull();
    expect(screen.queryByText(/Restablecer Valores Predeterminados/i)).toBeNull();

    expect(screen.getByTestId("backup-sync-counts")).toBeTruthy();
    expect(screen.getByTestId("export-backup-btn")).toBeTruthy();
    expect(screen.getByTestId("export-jsonl-backup-btn")).toBeTruthy();
    expect(screen.getByTestId("import-backup-btn")).toBeTruthy();
  });

  it("shows a Temas/Themes tag on Archivo de Configuracion Local in AppearanceSettings", async () => {
    render(
      <SettingsProvider>
        <GeneralSettings />
        <AppearanceSettings />
      </SettingsProvider>
    );

    const themeTag = screen.getByTestId("local-config-theme-tag");
    expect(themeTag.textContent?.trim()).toBe("Temas");
    expect(screen.getByText(/Archivo de Configuraci[oó]n Local/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Idioma"), { target: { value: "en" } });

    await waitFor(() => {
      expect(screen.getByTestId("local-config-theme-tag").textContent?.trim()).toBe("Themes");
    });
  });
});
