import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagList } from "../TagList";
import { Tag } from "@/core/types";

describe("TagList Component", () => {
  const sampleTags: Tag[] = [
    { id: "tag-1", name: "typescript", color: "#3178c6" },
    { id: "tag-2", name: "rust", color: "#ffa659" },
  ];

  it("renders tag names and counts", () => {
    render(
      <TagList
        tags={sampleTags}
        activeTagId={null}
        onSelectTag={vi.fn()}
        onNewTag={vi.fn()}
        onDeleteTag={vi.fn()}
        counts={{ "tag-1": 5, "tag-2": 2 }}
      />
    );

    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("rust")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("opens context menu with options on secondary click (right-click)", () => {
    const onSelectTag = vi.fn();
    render(
      <TagList
        tags={sampleTags}
        activeTagId={null}
        onSelectTag={onSelectTag}
        onNewTag={vi.fn()}
        onDeleteTag={vi.fn()}
        counts={{}}
      />
    );

    const tagPill = screen.getByText("typescript");
    fireEvent.contextMenu(tagPill);

    expect(onSelectTag).toHaveBeenCalledWith("tag-1");
    expect(screen.getByText("Renombrar")).toBeInTheDocument();
    expect(screen.getByText("Cambiar color")).toBeInTheDocument();
    expect(screen.getByText("Eliminar")).toBeInTheDocument();
    expect(screen.getByDisplayValue("typescript")).toBeInTheDocument();
  });

  it("auto-saves renamed tag on Enter or exit", async () => {
    const onUpdateTag = vi.fn().mockResolvedValue(undefined);
    render(
      <TagList
        tags={sampleTags}
        activeTagId={null}
        onSelectTag={vi.fn()}
        onNewTag={vi.fn()}
        onUpdateTag={onUpdateTag}
        onDeleteTag={vi.fn()}
        counts={{}}
      />
    );

    const tagPill = screen.getByText("typescript");
    fireEvent.contextMenu(tagPill);

    const input = screen.getByDisplayValue("typescript");
    fireEvent.change(input, { target: { value: "ts-lang" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdateTag).toHaveBeenCalledWith("tag-1", { name: "ts-lang" });
  });

  it("auto-saves color change when clicking outside or pressing Escape", async () => {
    const onUpdateTag = vi.fn().mockResolvedValue(undefined);
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <TagList
          tags={sampleTags}
          activeTagId={null}
          onSelectTag={vi.fn()}
          onNewTag={vi.fn()}
          onUpdateTag={onUpdateTag}
          onDeleteTag={vi.fn()}
          counts={{}}
        />
      </div>
    );

    const tagPill = screen.getByText("typescript");
    fireEvent.contextMenu(tagPill);

    // Pick first color (#ef3b42)
    const colorBtn = screen.getByTitle("#ef3b42");
    fireEvent.click(colorBtn);

    // Click outside to exit menu
    fireEvent.pointerDown(screen.getByTestId("outside"));

    expect(onUpdateTag).toHaveBeenCalledWith("tag-1", { color: "#ef3b42" });
  });

  it("deletes tag when clicking Eliminar in context menu", () => {
    const onDeleteTag = vi.fn();
    render(
      <TagList
        tags={sampleTags}
        activeTagId={null}
        onSelectTag={vi.fn()}
        onNewTag={vi.fn()}
        onDeleteTag={onDeleteTag}
        counts={{}}
      />
    );

    const tagPill = screen.getByText("rust");
    fireEvent.contextMenu(tagPill);

    const deleteBtn = screen.getByText("Eliminar");
    fireEvent.click(deleteBtn);

    expect(onDeleteTag).toHaveBeenCalledWith("tag-2");
  });

  it("does not render direct delete button on tag pill", () => {
    render(
      <TagList
        tags={sampleTags}
        activeTagId={null}
        onSelectTag={vi.fn()}
        onNewTag={vi.fn()}
        onDeleteTag={vi.fn()}
        counts={{}}
      />
    );

    expect(screen.queryByLabelText(/Delete tag/i)).toBeNull();
  });
});
