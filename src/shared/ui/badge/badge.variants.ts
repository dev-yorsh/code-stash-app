import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 select-none transition-colors font-mono font-medium",
  {
    variants: {
      variant: {
        solid: "border border-[var(--tag-badge-border)] bg-[var(--tag-badge-bg)] text-[var(--tag-badge-fg)]",
        subtle: "border border-[var(--tag-badge-border)]/50 bg-[var(--tag-badge-bg)]/60 text-[var(--tag-badge-fg)]",
        outline: "border border-[var(--tag-badge-border)] bg-transparent text-[var(--tag-badge-fg)]",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5 rounded",
        md: "text-xs px-2.5 py-1 rounded-md",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "sm",
    },
  }
);
