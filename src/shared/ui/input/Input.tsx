import { forwardRef } from "react";
import { cn } from "@/shared/lib/cn";
import { inputVariants } from "./input.variants";
import { InputProps } from "./input.types";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      helperText,
      variant = "bottomLine",
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={cn("flex flex-col space-y-1 w-full", containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[var(--ayu-fg)]">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <span className="absolute left-2.5 text-[var(--ayu-fg-subtle)] pointer-events-none flex items-center">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              inputVariants({ variant, hasError: Boolean(error) }),
              leftIcon && "pl-8",
              rightIcon && "pr-8",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-2.5 text-[var(--ayu-fg-subtle)] flex items-center">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <span className="text-[11px] text-[var(--ayu-error)] pt-0.5">{error}</span>}
        {helperText && !error && (
          <span className="text-[11px] text-[var(--ayu-fg-subtle)] pt-0.5">{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
