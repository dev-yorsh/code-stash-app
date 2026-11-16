import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SpellcheckTarget, clampFloatingCoords } from "../utils/spellcheckHelpers";
import { SpellingMenuSection } from "./SpellingMenuSection";

export interface SpellcheckQuickPopoverProps {
  target: SpellcheckTarget;
  position: { x: number; y: number };
  spellcheckEnabled: boolean;
  onIgnoreWord: (word: string) => void;
  onToggleSpellcheck: (nextEnabled: boolean) => void;
  onClose: () => void;
}

function preventBlur(e: React.MouseEvent) {
  e.preventDefault();
}

/**
 * Non-focus-stealing "Ortografía" action card displayed when the user clicks
 * or selects a misspelled word highlighted in Plain Text mode.
 */
export const SpellcheckQuickPopover: React.FC<SpellcheckQuickPopoverProps> = ({
  target,
  position,
  spellcheckEnabled,
  onIgnoreWord,
  onToggleSpellcheck,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number }>(() =>
    clampFloatingCoords(position.x, position.y, 224, 150)
  );

  useLayoutEffect(() => {
    const el = popoverRef.current;
    const width = el?.offsetWidth || 224;
    const height = el?.offsetHeight || 150;
    setCoords(clampFloatingCoords(position.x, position.y, width, height));
  }, [position.x, position.y, target.word]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      data-testid="spellcheck-quick-popover"
      style={{ left: `${coords.left}px`, top: `${coords.top}px` }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 w-[224px] rounded-xl border border-[var(--ayu-border)] bg-[var(--menu-bg)] shadow-2xl p-1.5 select-none animate-toolbar-popover"
    >
      <SpellingMenuSection
        misspelledWord={target.word}
        spellcheckEnabled={spellcheckEnabled}
        onMouseDown={preventBlur}
        onIgnoreWord={(word) => {
          onIgnoreWord(word);
          onClose();
        }}
        onToggleSpellcheck={(next) => {
          onToggleSpellcheck(next);
          onClose();
        }}
      />
    </div>
  );
};
