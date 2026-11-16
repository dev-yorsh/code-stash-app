import React from "react";

export interface TagGlyphProps {
  color?: string | null;
  className?: string;
}

/**
 * Solid tag icon matching the diagonal rounded tag silhouette with top-right punch hole.
 * Automatically adapts to container/font size (`w-[1em] h-[1em]` by default) and renders
 * the user-selected color with enhanced crispness.
 */
export const TagGlyph: React.FC<TagGlyphProps> = React.memo(({
  color,
  className = "w-[1em] h-[1em]",
}) => {
  const resolvedColor = color || "currentColor";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      style={{
        color: resolvedColor,
        filter: "saturate(1.3) contrast(1.08) drop-shadow(0 0.5px 0.5px rgba(0, 0, 0, 0.22))",
      }}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.15 2.5C12.22 2.5 11.33 2.87 10.67 3.53L3.13 11.07C1.76 12.44 1.76 14.66 3.13 16.03L7.97 20.87C9.34 22.24 11.56 22.24 12.93 20.87L20.47 13.33C21.13 12.67 21.5 11.78 21.5 10.85V5.6C21.5 3.89 20.11 2.5 18.4 2.5H13.15ZM18.1 7.65C19.07 7.65 19.85 6.87 19.85 5.9C19.85 4.93 19.07 4.15 18.1 4.15C17.13 4.15 16.35 4.93 16.35 5.9C16.35 6.87 17.13 7.65 18.1 7.65Z"
      />
    </svg>
  );
});

TagGlyph.displayName = "TagGlyph";
