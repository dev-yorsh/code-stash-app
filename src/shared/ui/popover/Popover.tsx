import React, { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";
import { PopoverProps, PopoverPlacement } from "./popover.types";

const placementClasses: Record<PopoverPlacement, string> = {
  "bottom-start": "top-full left-0 mt-1.5",
  "bottom-end": "top-full right-0 mt-1.5",
  "top-start": "bottom-full left-0 mb-1.5",
  "top-end": "bottom-full right-0 mb-1.5",
};

export const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  trigger,
  children,
  placement = "bottom-end",
  className,
  closeOnEscape = true,
  closeOnClickOutside = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        closeOnClickOutside &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, closeOnClickOutside, closeOnEscape]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {trigger}
      {isOpen && (
        <div
          role="dialog"
          className={cn(
            "absolute z-50 rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-100",
            "bg-[var(--ayu-panel)] border border-[var(--ayu-line)]",
            placementClasses[placement],
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
};
