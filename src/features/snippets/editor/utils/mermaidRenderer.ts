import type { Mermaid, MermaidConfig } from "mermaid";
import type { ThemeDefinition } from "@/features/settings";

const DIAGRAM_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /^(?:flowchart|graph)\b/i, label: "Flowchart" },
  { match: /^sequenceDiagram\b/i, label: "Sequence Diagram" },
  { match: /^classDiagram(?:-v2)?\b/i, label: "Class Diagram" },
  { match: /^stateDiagram(?:-v2)?\b/i, label: "State Diagram" },
  { match: /^erDiagram\b/i, label: "ER Diagram" },
  { match: /^gantt\b/i, label: "Gantt Chart" },
  { match: /^pie\b/i, label: "Pie Chart" },
  { match: /^gitGraph\b/i, label: "Git Graph" },
  { match: /^mindmap\b/i, label: "Mindmap" },
  { match: /^timeline\b/i, label: "Timeline" },
  { match: /^journey\b/i, label: "User Journey" },
  { match: /^quadrantChart\b/i, label: "Quadrant Chart" },
  { match: /^requirementDiagram\b/i, label: "Requirement Diagram" },
  { match: /^C4(?:Context|Container|Component|Dynamic|Deployment)\b/i, label: "C4 Diagram" },
  { match: /^sankey(?:-beta)?\b/i, label: "Sankey Diagram" },
  { match: /^xychart(?:-beta)?\b/i, label: "XY Chart" },
  { match: /^block(?:-beta)?\b/i, label: "Block Diagram" },
  { match: /^packet(?:-beta)?\b/i, label: "Packet Diagram" },
  { match: /^kanban\b/i, label: "Kanban" },
  { match: /^architecture(?:-beta)?\b/i, label: "Architecture" },
  { match: /^radar(?:-beta)?\b/i, label: "Radar Chart" },
  { match: /^treemap(?:-beta)?\b/i, label: "Treemap" },
  { match: /^venn(?:-beta)?\b/i, label: "Venn Diagram" },
  { match: /^zenuml\b/i, label: "ZenUML" },
];

/**
 * Determines whether a CodeStash theme should render dark-mode diagrams.
 * Falls back to perceived luminance when custom themes omit `isDark`.
 */
export function isThemeDark(theme: ThemeDefinition): boolean {
  if (typeof theme.isDark === "boolean") {
    return theme.isDark;
  }

  const candidateHex =
    theme.colors.editorPanelBg || theme.colors.lift || theme.colors.base || "#282c34";
  const match = /^#([0-9a-f]{6})$/i.exec(candidateHex.trim());
  if (!match) return true;

  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 145;
}

/** Identifies a concise human-readable diagram kind from Mermaid source text. */
export function detectMermaidDiagramLabel(source: string): string {
  const withoutFrontmatter = source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, "");
  const lines = withoutFrontmatter.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("%%")) continue;

    for (const entry of DIAGRAM_LABELS) {
      if (entry.match.test(line)) {
        return `Mermaid · ${entry.label}`;
      }
    }
    break;
  }

  return "Mermaid";
}

export function buildMermaidConfig(theme: ThemeDefinition): MermaidConfig {
  const dark = isThemeDark(theme);
  return {
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    theme: dark ? "dark" : "default",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    themeVariables: {
      background: "transparent",
    },
  };
}

let mermaidModulePromise: Promise<Mermaid> | null = null;
let renderQueue: Promise<void> = Promise.resolve();

async function getMermaidInstance(): Promise<Mermaid> {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import("mermaid").then((mod) => mod.default);
  }
  return mermaidModulePromise;
}

export interface RenderedMermaidDiagram {
  svg: string;
  bindFunctions?: (element: Element) => void;
}

/**
 * Serializes Mermaid initialization and rendering on a single FIFO queue so
 * concurrent diagrams or rapid theme switches never corrupt global Mermaid config.
 */
export function renderMermaidDiagram(
  renderId: string,
  chartSource: string,
  theme: ThemeDefinition
): Promise<RenderedMermaidDiagram> {
  let resolveResult!: (value: RenderedMermaidDiagram) => void;
  let rejectResult!: (reason: unknown) => void;

  const taskResult = new Promise<RenderedMermaidDiagram>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  renderQueue = renderQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        const mermaid = await getMermaidInstance();
        mermaid.initialize(buildMermaidConfig(theme));
        const { svg, bindFunctions } = await mermaid.render(renderId, chartSource.trim());
        resolveResult({ svg, bindFunctions });
      } catch (error) {
        rejectResult(error);
      } finally {
        if (typeof document !== "undefined") {
          document.getElementById(`d${renderId}`)?.remove();
        }
      }
    });

  return taskResult;
}
