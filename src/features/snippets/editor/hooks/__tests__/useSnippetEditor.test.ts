import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSnippetEditor } from "../useSnippetEditor";
import { Snippet, CreateSnippetInput, UpdateSnippetInput } from "@/core/types";

describe("useSnippetEditor (Custom Hook)", () => {
  let mockSnippet: Snippet;
  let mockAutoSave: Mock<(data: CreateSnippetInput | UpdateSnippetInput, existingId: string | null) => Promise<Snippet>>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSnippet = {
      id: "s-test-1",
      title: "Initial Title",
      description: "Initial description",
      code: "const x = 42;",
      language: "typescript",
      folder_id: "f-1",
      tags: [{ id: "t-1", name: "TS", color: "#3178c6" }],
      is_favorite: false,
      is_deleted: false,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      fragments: [
        {
          id: "frag-1",
          label: "main.ts",
          code: "const x = 42;",
          language: "typescript",
        },
      ],
    };

    mockAutoSave = vi.fn().mockImplementation(async (input: CreateSnippetInput) => ({
      ...mockSnippet,
      ...input,
      id: mockSnippet.id,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes state from an existing snippet", () => {
    const { result } = renderHook(() =>
      useSnippetEditor({
        snippet: mockSnippet,
        activeFolderId: "f-1",
        onAutoSave: mockAutoSave,
      })
    );

    expect(result.current.currentId).toBe("s-test-1");
    expect(result.current.title).toBe("Initial Title");
    expect(result.current.description).toBe("Initial description");
    expect(result.current.code).toBe("const x = 42;");
    expect(result.current.language).toBe("typescript");
    expect(result.current.isManualLanguage).toBe(true);
    expect(result.current.selectedTagIds).toEqual(["t-1"]);
    expect(result.current.fragments).toHaveLength(1);
    expect(result.current.activeFragmentId).toBe("frag-1");
  });

  it("initializes with default values when snippet is null (new draft mode)", () => {
    const { result } = renderHook(() =>
      useSnippetEditor({
        snippet: null,
        activeFolderId: null,
        onAutoSave: mockAutoSave,
      })
    );

    expect(result.current.currentId).toBeNull();
    expect(result.current.title).toBe("Untitled Snippet");
    expect(result.current.code).toBe("");
    expect(result.current.language).toBe("plaintext");
    expect(result.current.fragments).toHaveLength(1);
  });

  it("handles title changes and debounced autosave", async () => {
    const { result } = renderHook(() =>
      useSnippetEditor({
        snippet: mockSnippet,
        activeFolderId: "f-1",
        onAutoSave: mockAutoSave,
      })
    );

    act(() => {
      result.current.handleTitleChange("Brand New Title");
    });
    expect(result.current.title).toBe("Brand New Title");
    expect(mockAutoSave).not.toHaveBeenCalled();

    // Fast-forward 400ms debounce
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mockAutoSave).toHaveBeenCalledTimes(1);
    expect(mockAutoSave.mock.calls[0][0].title).toBe("Brand New Title");
  });

  it("falls back to 'Untitled Snippet' on title blur if empty", async () => {
    const { result } = renderHook(() =>
      useSnippetEditor({
        snippet: mockSnippet,
        activeFolderId: "f-1",
        onAutoSave: mockAutoSave,
      })
    );

    act(() => {
      result.current.handleTitleChange("   ");
    });
    await act(async () => {
      result.current.handleTitleBlur();
    });

    expect(result.current.title).toBe("Untitled Snippet");
    expect(mockAutoSave).toHaveBeenCalled();
  });

  it("handles description changes and tag toggling", async () => {
    const { result } = renderHook(() =>
      useSnippetEditor({
        snippet: mockSnippet,
        activeFolderId: "f-1",
        onAutoSave: mockAutoSave,
      })
    );

    act(() => {
      result.current.handleDescriptionChange("New notes");
      result.current.toggleTag("t-2");
    });

    expect(result.current.description).toBe("New notes");
    expect(result.current.selectedTagIds).toEqual(["t-1", "t-2"]);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(mockAutoSave).toHaveBeenCalled();
  });

  it("handles code changes and updates active fragment", async () => {
    const { result } = renderHook(() =>
      useSnippetEditor({
        snippet: mockSnippet,
        activeFolderId: "f-1",
        onAutoSave: mockAutoSave,
      })
    );

    act(() => {
      result.current.handleCodeChange("console.log('updated');");
    });

    expect(result.current.code).toBe("console.log('updated');");
    expect(result.current.fragments[0].code).toBe("console.log('updated');");

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(mockAutoSave).toHaveBeenCalled();
  });

  it("manages multi-file fragment lifecycle (add, switch, rename, delete)", async () => {
    const { result } = renderHook(() =>
      useSnippetEditor({
        snippet: mockSnippet,
        activeFolderId: "f-1",
        onAutoSave: mockAutoSave,
      })
    );

    // 1. Add fragment
    await act(async () => {
      result.current.handleAddFragment();
    });
    expect(result.current.fragments).toHaveLength(2);
    const secondFragId = result.current.activeFragmentId;
    expect(secondFragId).not.toBe("frag-1");
    expect(result.current.code).toBe("");

    // 2. Type in second fragment
    act(() => {
      result.current.handleCodeChange("const y = 99;");
    });
    expect(result.current.code).toBe("const y = 99;");

    // 3. Switch back to first fragment
    await act(async () => {
      result.current.handleSelectFragment("frag-1");
    });
    expect(result.current.activeFragmentId).toBe("frag-1");
    expect(result.current.code).toBe("const x = 42;");

    // Check that second fragment retained its code
    const frag2 = result.current.fragments.find((f) => f.id === secondFragId);
    expect(frag2?.code).toBe("const y = 99;");

    // 4. Rename fragment
    act(() => {
      result.current.handleRenameFragment("frag-1", "index.ts");
    });
    expect(result.current.fragments[0].label).toBe("index.ts");

    // 5. Delete second fragment
    await act(async () => {
      result.current.handleDeleteFragment(secondFragId);
    });
    expect(result.current.fragments).toHaveLength(1);
    expect(result.current.activeFragmentId).toBe("frag-1");
  });

  it("handles explicit language override and reset to auto-detect", async () => {
    const { result } = renderHook(() =>
      useSnippetEditor({
        snippet: mockSnippet,
        activeFolderId: "f-1",
        onAutoSave: mockAutoSave,
      })
    );

    act(() => {
      result.current.selectLanguageExplicitly("python");
    });
    expect(result.current.language).toBe("python");
    expect(result.current.isManualLanguage).toBe(true);

    act(() => {
      result.current.resetToAutoDetect();
    });
    expect(result.current.isManualLanguage).toBe(false);
  });

  it("handles clipboard copying with timeout feedback", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    const { result } = renderHook(() =>
      useSnippetEditor({
        snippet: mockSnippet,
        activeFolderId: "f-1",
        onAutoSave: mockAutoSave,
      })
    );

    act(() => {
      result.current.handleCopy();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("const x = 42;");
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(result.current.copied).toBe(false);
  });

  it("automatically selects the matching fragment in real time when searchQuery changes", () => {
    const multiFragSnippet: Snippet = {
      ...mockSnippet,
      fragments: [
        {
          id: "frag-1",
          label: "index.html",
          code: "<div class='app'>Hello</div>",
          language: "html",
        },
        {
          id: "frag-2",
          label: "styles.css",
          code: ".app { background: #1e1e2e; }",
          language: "css",
        },
      ],
    };

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) =>
        useSnippetEditor({
          snippet: multiFragSnippet,
          activeFolderId: "f-1",
          searchQuery: query,
          onAutoSave: mockAutoSave,
        }),
      { initialProps: { query: "" } }
    );

    expect(result.current.activeFragmentId).toBe("frag-1");

    // Searching for CSS content automatically switches to frag-2
    rerender({ query: "background: #1e1e2e" });
    expect(result.current.activeFragmentId).toBe("frag-2");
    expect(result.current.code).toBe(".app { background: #1e1e2e; }");

    // Searching for snippet title (not specific to frag-2) resets fragment selection back to frag-1
    rerender({ query: "Initial Title" });
    expect(result.current.activeFragmentId).toBe("frag-1");
    expect(result.current.code).toBe("<div class='app'>Hello</div>");
  });
});
