import React, { useMemo } from "react";
import DOMPurify from "dompurify";
import { useTranslation } from "@/shared/i18n";
import { DiagramCardFrame } from "./DiagramCardFrame";

export interface SvgDiagramBlockProps {
  svg: string;
}

/**
 * Renders fenced ```svg diagrams securely via DOMPurify's SVG profile
 * with zoom, source inspection, and copy actions.
 */
export const SvgDiagramBlock: React.FC<SvgDiagramBlockProps> = ({ svg }) => {
  const { t } = useTranslation();

  const { sanitizedSvg, errorMessage } = useMemo(() => {
    const cleaned = DOMPurify.sanitize(svg.trim(), {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["script", "foreignObject"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover"],
    }).trim();

    if (!cleaned || !/<svg[\s>]/i.test(cleaned)) {
      return {
        sanitizedSvg: null,
        errorMessage: t.editor.markdown.emptySvgError,
      };
    }

    return {
      sanitizedSvg: cleaned,
      errorMessage: null,
    };
  }, [svg, t.editor.markdown.emptySvgError]);

  return (
    <DiagramCardFrame
      testId="svg-diagram-card"
      label="SVG Diagram"
      sourceCode={svg}
      svgMarkup={sanitizedSvg}
      errorMessage={errorMessage}
    />
  );
};
