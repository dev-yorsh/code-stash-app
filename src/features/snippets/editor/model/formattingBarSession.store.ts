import { create } from "zustand";

export interface FormattingBarSessionState {
  /**
   * Session-only visibility flag for the Plain Text formatting capsule.
   * Persists in memory across snippet/folder switches until app close,
   * automatically resetting to visible when inserting plain text in a new
   * snippet or creating a new fragment while hidden.
   */
  isFormattingBarHidden: boolean;
  /** Newly created empty snippet IDs awaiting first plain-text insertion to reveal tools. */
  pendingRevealSnippetIds: Record<string, true>;
  hideFormattingBar: () => void;
  showFormattingBar: () => void;
  toggleFormattingBar: () => void;
  markNewSnippetPendingReveal: (snippetId: string) => void;
  consumePendingRevealSnippet: (snippetId: string) => boolean;
  resetSession: () => void;
}

export const useFormattingBarSessionStore = create<FormattingBarSessionState>((set, get) => ({
  isFormattingBarHidden: false,
  pendingRevealSnippetIds: {},
  hideFormattingBar: () => set({ isFormattingBarHidden: true }),
  showFormattingBar: () => set({ isFormattingBarHidden: false }),
  toggleFormattingBar: () =>
    set((state) => ({ isFormattingBarHidden: !state.isFormattingBarHidden })),
  markNewSnippetPendingReveal: (snippetId) =>
    set((state) => ({
      pendingRevealSnippetIds: {
        ...state.pendingRevealSnippetIds,
        [snippetId]: true,
      },
    })),
  consumePendingRevealSnippet: (snippetId) => {
    if (!get().pendingRevealSnippetIds[snippetId]) {
      return false;
    }
    set((state) => {
      const nextPending = { ...state.pendingRevealSnippetIds };
      delete nextPending[snippetId];
      return {
        isFormattingBarHidden: false,
        pendingRevealSnippetIds: nextPending,
      };
    });
    return true;
  },
  resetSession: () => set({ isFormattingBarHidden: false, pendingRevealSnippetIds: {} }),
}));
