import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { modalVariants } from "./modal.variants";
import { ModalProps } from "./modal.types";

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className,
  closeOnOverlayClick = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={cn(modalVariants({ size }), className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            className={cn(
              "flex items-center justify-between border-b border-[var(--ayu-line)] shrink-0",
              size === "sm" ? "px-5 py-3" : "px-5 py-3.5"
            )}
          >
            <h3 className="text-sm font-semibold text-[var(--ayu-editor-fg)] truncate pr-2">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] p-1 rounded-md hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className={size === "sm" ? "px-5 py-3.5" : "p-5"}>{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--ayu-line)] bg-[var(--ayu-bg)]/40 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
