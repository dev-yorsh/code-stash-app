import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ThemeDefinition } from "@/features/settings";
import {
  detectMermaidDiagramLabel,
  renderMermaidDiagram,
} from "../utils/mermaidRenderer";
import { DiagramCardFrame } from "./DiagramCardFrame";

export interface MermaidDiagramProps {
  chart: string;
  activeTheme: ThemeDefinition;
}

/**
 * Renders any Mermaid diagram type (flowchart, sequence, class, state, ER, gantt,
 * pie, mindmap, timeline, gitGraph, C4, architecture, kanban, etc.) asynchronously
 * via a serialized renderer queue synchronized with the active CodeStash theme.
 */
export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  activeTheme,
}) => {
  const baseId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const renderSeqRef = useRef(0);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const bindFnRef = useRef<((element: Element) => void) | undefined>(undefined);

  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const diagramLabel = useMemo(() => detectMermaidDiagramLabel(chart), [chart]);

  useEffect(() => {
    let cancelled = false;
    const seq = ++renderSeqRef.current;
    const renderId = `codestash-mmd-${baseId}-${seq}`;

    setIsLoading(true);
    setErrorMessage(null);

    void renderMermaidDiagram(renderId, chart, activeTheme)
      .then((result) => {
        if (cancelled) return;
        bindFnRef.current = result.bindFunctions;
        setSvgMarkup(result.svg);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        bindFnRef.current = undefined;
        setSvgMarkup(null);
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [baseId, chart, activeTheme]);

  useEffect(() => {
    if (svgMarkup && svgHostRef.current && bindFnRef.current) {
      try {
        bindFnRef.current(svgHostRef.current);
      } catch {
        // Non-fatal if interactive Mermaid binding fails in limited environments
      }
    }
  }, [svgMarkup]);

  return (
    <DiagramCardFrame
      testId="mermaid-diagram-card"
      label={diagramLabel}
      sourceCode={chart}
      svgMarkup={svgMarkup}
      errorMessage={errorMessage}
      isLoading={isLoading}
      svgContainerRef={svgHostRef}
    />
  );
};
