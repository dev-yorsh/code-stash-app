import { cva } from "class-variance-authority";

export const modalVariants = cva(
  "bg-[var(--ayu-panel)] border border-[var(--ayu-line)] rounded-xl shadow-2xl w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col",
  {
    variants: {
      size: {
        sm: "max-w-[385px]",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-2xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);
