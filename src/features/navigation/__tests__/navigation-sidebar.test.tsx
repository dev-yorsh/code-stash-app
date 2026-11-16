import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavigationSidebar } from "../components/NavigationSidebar";

// Mock useSettings
vi.mock("@/features/settings", () => ({
  useSettings: () => ({
    openSettings: vi.fn(),
  }),
}));

describe("NavigationSidebar component", () => {
  it("renders folderTreeSlot, tagListSlot, and version correctly", () => {
    const onStartResize = vi.fn();

    render(
      <NavigationSidebar
        width={250}
        onStartResizing={onStartResize}
        folderTreeSlot={<div data-testid="folder-slot">Folder Tree</div>}
        tagListSlot={<div data-testid="tag-slot">Tag List</div>}
        version="v0.1.0"
      />
    );

    expect(screen.getByTestId("folder-slot")).toBeInTheDocument();
    expect(screen.getByTestId("tag-slot")).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Configuración")).toBeInTheDocument();
  });

  it("handles mouse down on resizer handle", () => {
    const onStartResize = vi.fn();

    render(
      <NavigationSidebar
        width={250}
        onStartResizing={onStartResize}
        folderTreeSlot={<div>Folders</div>}
        tagListSlot={<div>Tags</div>}
      />
    );

    const resizer = screen.getByTitle("Arrastra para redimensionar panel de carpetas");
    fireEvent.mouseDown(resizer);
    expect(onStartResize).toHaveBeenCalledTimes(1);
  });
});
