import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SnippetHeader } from "../SnippetHeader";

describe("SnippetHeader (Presentational Slice)", () => {
  const mockTags = [
    { id: "t-1", name: "Rust", color: "#f74c00" },
    { id: "t-2", name: "React", color: "#61dafb" },
  ];

  it("renders snippet title and triggers change, blur, and Enter (onTitleSubmit) handlers", () => {
    const handleTitleChange = vi.fn();
    const handleTitleBlur = vi.fn();
    const handleTitleSubmit = vi.fn();

    render(
      <SnippetHeader
        title="My Cool Snippet"
        description=""
        tags={mockTags}
        selectedTagIds={[]}
        isCopied={false}
        canDelete={true}
        hasCode={true}
        onTitleChange={handleTitleChange}
        onTitleBlur={handleTitleBlur}
        onTitleSubmit={handleTitleSubmit}
        onDescriptionChange={vi.fn()}
        onToggleTag={vi.fn()}
        onAddFragment={vi.fn()}
        onCopy={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Snippet sin título") as HTMLInputElement;
    expect(input.value).toBe("My Cool Snippet");

    fireEvent.change(input, { target: { value: "New Title" } });
    expect(handleTitleChange).toHaveBeenCalledWith("New Title");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(handleTitleBlur).toHaveBeenCalledTimes(1);
    expect(handleTitleSubmit).toHaveBeenCalledTimes(1);

    fireEvent.blur(input);
    expect(handleTitleBlur).toHaveBeenCalledTimes(2);
  });

  it("triggers onCopy and onAddFragment callbacks", () => {
    const handleCopy = vi.fn();
    const handleAddFrag = vi.fn();

    render(
      <SnippetHeader
        title="Title"
        description=""
        tags={mockTags}
        selectedTagIds={[]}
        isCopied={false}
        canDelete={true}
        hasCode={true}
        onTitleChange={vi.fn()}
        onTitleBlur={vi.fn()}
        onDescriptionChange={vi.fn()}
        onToggleTag={vi.fn()}
        onAddFragment={handleAddFrag}
        onCopy={handleCopy}
      />
    );

    const copyBtn = screen.getByTitle("Copiar código");
    fireEvent.click(copyBtn);
    expect(handleCopy).toHaveBeenCalledTimes(1);

    const addFragBtn = screen.getByTitle("Añadir pestaña de fragmento");
    fireEvent.click(addFragBtn);
    expect(handleAddFrag).toHaveBeenCalledTimes(1);
  });

  it("opens notes popover and allows editing description", () => {
    const handleDescChange = vi.fn();

    render(
      <SnippetHeader
        title="Title"
        description="Original note"
        tags={mockTags}
        selectedTagIds={[]}
        isCopied={false}
        canDelete={true}
        hasCode={true}
        onTitleChange={vi.fn()}
        onTitleBlur={vi.fn()}
        onDescriptionChange={handleDescChange}
        onToggleTag={vi.fn()}
        onAddFragment={vi.fn()}
        onCopy={vi.fn()}
      />
    );

    const descBtn = screen.getByTitle("Notas / Descripción");
    fireEvent.click(descBtn);

    const textarea = screen.getByPlaceholderText("Añade notas o una descripción para este snippet...") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Original note");

    fireEvent.change(textarea, { target: { value: "Updated note" } });
    expect(handleDescChange).toHaveBeenCalledWith("Updated note");
  });

  it("opens tags popover and toggles tags", () => {
    const handleToggleTag = vi.fn();

    render(
      <SnippetHeader
        title="Title"
        description=""
        tags={mockTags}
        selectedTagIds={["t-1"]}
        isCopied={false}
        canDelete={true}
        hasCode={true}
        onTitleChange={vi.fn()}
        onTitleBlur={vi.fn()}
        onDescriptionChange={vi.fn()}
        onToggleTag={handleToggleTag}
        onAddFragment={vi.fn()}
        onCopy={vi.fn()}
      />
    );

    const tagsBtn = screen.getByTitle("Etiquetas");
    fireEvent.click(tagsBtn);

    expect(screen.getByText("1 seleccionadas")).toBeInTheDocument();

    const reactTagBtn = screen.getByText("React");
    fireEvent.click(reactTagBtn);
    expect(handleToggleTag).toHaveBeenCalledWith("t-2");
  });

  it("opens copy format selector in plain text mode with formatted and Markdown options", () => {
    const handleCopyRichText = vi.fn();

    render(
      <SnippetHeader
        title="Nota"
        description=""
        tags={mockTags}
        selectedTagIds={[]}
        isCopied={false}
        canDelete={true}
        hasCode={true}
        isPlainText={true}
        onTitleChange={vi.fn()}
        onTitleBlur={vi.fn()}
        onDescriptionChange={vi.fn()}
        onToggleTag={vi.fn()}
        onAddFragment={vi.fn()}
        onCopy={vi.fn()}
        onCopyRichText={handleCopyRichText}
      />
    );

    const copyTrigger = screen.getByTestId("copy-options-trigger");
    fireEvent.click(copyTrigger);

    expect(screen.getByTestId("copy-format-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("copy-with-formatting-btn"));
    expect(handleCopyRichText).toHaveBeenNthCalledWith(1, "formatted");

    fireEvent.click(copyTrigger);
    fireEvent.click(screen.getByTestId("copy-as-markdown-btn"));
    expect(handleCopyRichText).toHaveBeenNthCalledWith(2, "markdown");
  });

  it("renders icon-only formatting bar toggle button while plain text has content and reflects open/minimized states", () => {
    const handleToggleFormattingBar = vi.fn();

    const { rerender } = render(
      <SnippetHeader
        title="Nota"
        description=""
        tags={mockTags}
        selectedTagIds={[]}
        isCopied={false}
        canDelete={true}
        hasCode={true}
        isPlainText={true}
        showFormattingBarToggle={true}
        isFormattingBarOpen={true}
        onTitleChange={vi.fn()}
        onTitleBlur={vi.fn()}
        onDescriptionChange={vi.fn()}
        onToggleTag={vi.fn()}
        onAddFragment={vi.fn()}
        onCopy={vi.fn()}
        onToggleFormattingBar={handleToggleFormattingBar}
      />
    );

    const toggleBtn = screen.getByTestId("toggle-formatting-bar-btn");
    expect(toggleBtn.textContent?.trim()).toBe("");
    expect(toggleBtn.querySelector("svg")).not.toBeNull();
    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggleBtn);
    expect(handleToggleFormattingBar).toHaveBeenCalledTimes(1);

    rerender(
      <SnippetHeader
        title="Nota"
        description=""
        tags={mockTags}
        selectedTagIds={[]}
        isCopied={false}
        canDelete={true}
        hasCode={true}
        isPlainText={true}
        showFormattingBarToggle={true}
        isFormattingBarOpen={false}
        onTitleChange={vi.fn()}
        onTitleBlur={vi.fn()}
        onDescriptionChange={vi.fn()}
        onToggleTag={vi.fn()}
        onAddFragment={vi.fn()}
        onCopy={vi.fn()}
        onToggleFormattingBar={handleToggleFormattingBar}
      />
    );

    expect(screen.getByTestId("toggle-formatting-bar-btn")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    fireEvent.click(screen.getByTestId("toggle-formatting-bar-btn"));
    expect(handleToggleFormattingBar).toHaveBeenCalledTimes(2);
  });
});
