import { EditorView } from "@codemirror/view";

/**
 * CodeMirror extension to reveal the scrollbar only while actively scrolling,
 * and automatically hide it once scrolling ceases.
 */
export const scrollbarAutoHideExtension = EditorView.domEventHandlers({
  scroll(_event, view) {
    const scroller = view.scrollDOM;
    if (!scroller) return;

    scroller.classList.add("cm-is-scrolling");
    const target = scroller as HTMLElement & { _scrollTimer?: ReturnType<typeof setTimeout> };

    if (target._scrollTimer) {
      clearTimeout(target._scrollTimer);
    }

    target._scrollTimer = setTimeout(() => {
      scroller.classList.remove("cm-is-scrolling");
    }, 800);
  },
});
