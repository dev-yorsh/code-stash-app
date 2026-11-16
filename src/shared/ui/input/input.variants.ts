import { cva } from "class-variance-authority";

export const inputVariants = cva(
  "w-full text-xs text-[var(--ayu-editor-fg)] placeholder-[var(--ayu-fg-subtle)] focus:outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        bottomLine:
          "bg-transparent border-0 border-b border-[var(--ayu-border)] rounded-none px-0 py-1.5 focus:border-[var(--ayu-accent)]",
        outlined:
          "bg-[var(--ayu-bg)] border border-[var(--ayu-line)] rounded-lg px-3 py-1.5 focus:border-[var(--ayu-accent)] focus:ring-1 focus:ring-[var(--ayu-accent)]",
        filled:
          "bg-[var(--ayu-sunk)] border border-transparent rounded-lg px-3 py-1.5 focus:border-[var(--ayu-accent)]",
      },
      hasError: {
        true: "border-[var(--ayu-error)] focus:border-[var(--ayu-error)]",
      },
    },
    defaultVariants: {
      variant: "bottomLine",
      hasError: false,
    },
  }
);
