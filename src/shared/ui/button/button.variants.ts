import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium select-none cursor-pointer focus:outline-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-fg)] border border-[var(--btn-primary-border)] shadow-xs active:opacity-90",
        secondary:
          "bg-[var(--ayu-sunk)] hover:bg-[var(--ayu-lift)] text-[var(--ayu-editor-fg)] border border-[var(--ayu-line)] hover:border-[var(--ayu-border)]",
        ghost:
          "bg-transparent hover:bg-[var(--ayu-lift)] text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)]",
        danger:
          "bg-[var(--ayu-error)]/10 hover:bg-[var(--ayu-error)]/20 text-[var(--ayu-error)] border border-[var(--ayu-error)]/20",
        outline:
          "bg-transparent hover:bg-[var(--ayu-lift)] text-[var(--ayu-fg)] border border-[var(--ayu-line)]",
      },
      size: {
        sm: "text-xs px-2.5 py-1 gap-1.5 rounded-md",
        md: "text-xs px-3.5 py-1.5 gap-2 rounded-lg",
        lg: "text-sm px-4 py-2 gap-2.5 rounded-lg",
        icon: "p-1.5 rounded-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);
