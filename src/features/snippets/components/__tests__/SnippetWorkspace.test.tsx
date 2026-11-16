import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SnippetWorkspace } from "../SnippetWorkspace";
import { Snippet } from "@/core/types";

// Mock SnippetEditor to isolate SnippetWorkspace tests
vi.mock("../SnippetEditor", () => ({
  SnippetEditor: ({ snippet }: { snippet?: Snippet | null }) => (
    <div data-testid="mock-snippet-editor">
      Editor for: {snippet?.title || "new-draft"}
    </div>
  ),
}));

describe("SnippetWorkspace (Columna Derecha / Workspace)", () => {
  it("renders empty state message when no snippet is selected and not creating", () => {
    render(
      <SnippetWorkspace
        snippet={null}
        isCreating={false}
        tags={[]}
        onAutoSave={vi.fn()}
      />
    );

    expect(screen.getByText("Ningún snippet seleccionado")).toBeInTheDocument();
    expect(screen.getByText("Haz clic en + para crear un nuevo snippet")).toBeInTheDocument();
  });

  it("renders trash-specific empty state message when in trash view without selection", () => {
    render(
      <SnippetWorkspace
        snippet={null}
        isCreating={false}
        isTrashView={true}
        tags={[]}
        onAutoSave={vi.fn()}
      />
    );

    expect(screen.getByText("Basurero seleccionado")).toBeInTheDocument();
    expect(
      screen.getByText("Selecciona un snippet de la lista para previsualizarlo o restaurarlo.")
    ).toBeInTheDocument();
  });

  it("renders SnippetEditor when a snippet is provided", () => {
    const mockSnippet: Snippet = {
      id: "s-1",
      title: "My React Hook",
      code: "const x = 1;",
      language: "typescript",
      is_favorite: false,
      tags: [],
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };

    render(
      <SnippetWorkspace
        snippet={mockSnippet}
        isCreating={false}
        tags={[]}
        onAutoSave={vi.fn()}
      />
    );

    expect(screen.getByTestId("mock-snippet-editor")).toBeInTheDocument();
    expect(screen.getByText("Editor for: My React Hook")).toBeInTheDocument();
  });

  it("renders SnippetEditor in draft mode when isCreating is true", () => {
    render(
      <SnippetWorkspace
        snippet={null}
        isCreating={true}
        tags={[]}
        onAutoSave={vi.fn()}
      />
    );

    expect(screen.getByTestId("mock-snippet-editor")).toBeInTheDocument();
    expect(screen.getByText("Editor for: new-draft")).toBeInTheDocument();
  });
});
