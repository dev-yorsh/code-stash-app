import React, { forwardRef } from "react";
import { cn } from "@/shared/lib/cn";
import { badgeVariants } from "./badge.variants";
import { BadgeProps } from "./badge.types";

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, color, dotColor, style, children, onClick, ...props }, ref) => {
    const activeDot = dotColor || color;
    const computedStyle: React.CSSProperties = {
      ...style,
      ...(color ? { color } : {}),
    };

    return (
      <span
        ref={ref}
        onClick={onClick}
        style={computedStyle}
        className={cn(
          badgeVariants({ variant, size }),
          onClick && "cursor-pointer hover:brightness-110",
          className
        )}
        {...props}
      >
        {activeDot && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: activeDot }}
            aria-hidden="true"
          />
        )}
        <span>{children}</span>
      </span>
    );
  }
);

Badge.displayName = "Badge";
