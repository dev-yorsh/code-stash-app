import { describe, it, expect } from "vitest";
import type { Element } from "hast";
import {
  extractFencedCodeMeta,
  extractHastText,
  markdownSanitizeSchema,
  safeMarkdownUrlTransform,
} from "../markdownSanitizeSchema";
import {
  buildMermaidConfig,
  detectMermaidDiagramLabel,
  isThemeDark,
} from "../mermaidRenderer";
import {
  CODESTASH_LIGHT_MODERN_THEME,
  CODESTASH_ONEDARK_THEME,
  ThemeDefinition,
} from "@/features/settings";

describe("markdownSanitizeSchema & safeMarkdownUrlTransform", () => {
  it("allows safe web/asset/data image URIs and blocks dangerous protocols", () => {
    expect(safeMarkdownUrlTransform("https://example.com/a.png", "src")).toBe(
      "https://example.com/a.png"
    );
    expect(
      safeMarkdownUrlTransform("codestash-asset://abcdef0123456789.webp", "src")
    ).toBe("codestash-asset://abcdef0123456789.webp");
    expect(
      safeMarkdownUrlTransform("data:image/png;base64,iVBORw0KGgo=", "src")
    ).toBe("data:image/png;base64,iVBORw0KGgo=");

    expect(safeMarkdownUrlTransform("javascript:alert(1)", "src")).toBe("");
    expect(safeMarkdownUrlTransform("data:text/html,<script>1</script>", "src")).toBe("");

    expect(safeMarkdownUrlTransform("https://docs.example.com", "href")).toBe(
      "https://docs.example.com"
    );
    expect(safeMarkdownUrlTransform("#arquitectura", "href")).toBe("#arquitectura");
    expect(safeMarkdownUrlTransform("mailto:dev@example.com", "href")).toBe(
      "mailto:dev@example.com"
    );
    expect(safeMarkdownUrlTransform("javascript:void(0)", "href")).toBe("");
    expect(safeMarkdownUrlTransform("vbscript:msgbox(1)", "href")).toBe("");
  });

  it("extracts language id and raw text cleanly from HAST <pre><code> elements", () => {
    const preNode: Element = {
      type: "element",
      tagName: "pre",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "code",
          properties: { className: ["language-mermaid"] },
          children: [{ type: "text", value: "flowchart TD\n  A --> B\n" }],
        },
      ],
    };

    expect(extractHastText(preNode)).toBe("flowchart TD\n  A --> B\n");
    expect(extractFencedCodeMeta(preNode)).toEqual({
      language: "mermaid",
      rawCode: "flowchart TD\n  A --> B",
    });
    expect(markdownSanitizeSchema.protocols?.src).toContain("codestash-asset");
  });
});

describe("mermaidRenderer utilities", () => {
  it("identifies all major Mermaid diagram types including after directives and frontmatter", () => {
    const samples: Array<[string, string]> = [
      ["flowchart TD\n A-->B", "Mermaid · Flowchart"],
      ["graph LR\n A-->B", "Mermaid · Flowchart"],
      ["sequenceDiagram\n Alice->>Bob: Hi", "Mermaid · Sequence Diagram"],
      ["classDiagram\n class Animal", "Mermaid · Class Diagram"],
      ["stateDiagram-v2\n [*] --> Idle", "Mermaid · State Diagram"],
      ["erDiagram\n USER ||--o{ POST : writes", "Mermaid · ER Diagram"],
      ["gantt\n title Roadmap", "Mermaid · Gantt Chart"],
      ["pie title Market\n \"A\" : 60", "Mermaid · Pie Chart"],
      ["gitGraph\n commit", "Mermaid · Git Graph"],
      ["mindmap\n root((Idea))", "Mermaid · Mindmap"],
      ["timeline\n title History", "Mermaid · Timeline"],
      ["journey\n title Onboarding", "Mermaid · User Journey"],
      ["quadrantChart\n title Priority", "Mermaid · Quadrant Chart"],
      ["requirementDiagram\n requirement r1 {}", "Mermaid · Requirement Diagram"],
      ["C4Context\n title System", "Mermaid · C4 Diagram"],
      ["sankey-beta\n A,B,10", "Mermaid · Sankey Diagram"],
      ["xychart-beta\n title Sales", "Mermaid · XY Chart"],
      ["block-beta\n columns 2", "Mermaid · Block Diagram"],
      ["packet-beta\n 0-15: Header", "Mermaid · Packet Diagram"],
      ["kanban\n Todo", "Mermaid · Kanban"],
      ["architecture-beta\n service api", "Mermaid · Architecture"],
      ["radar-beta\n title Skills", "Mermaid · Radar Chart"],
      ["treemap-beta\n \"Root\"", "Mermaid · Treemap"],
      ["venn-beta\n set A", "Mermaid · Venn Diagram"],
    ];

    for (const [source, expected] of samples) {
      expect(detectMermaidDiagramLabel(source)).toBe(expected);
    }

    const withHeader = `---
title: Architecture
---
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
  User->>API: Request`;
    expect(detectMermaidDiagramLabel(withHeader)).toBe("Mermaid · Sequence Diagram");
  });

  it("maps dark and light CodeStash themes cleanly to Mermaid config", () => {
    expect(isThemeDark(CODESTASH_ONEDARK_THEME)).toBe(true);
    expect(buildMermaidConfig(CODESTASH_ONEDARK_THEME).theme).toBe("dark");

    expect(isThemeDark(CODESTASH_LIGHT_MODERN_THEME)).toBe(false);
    expect(buildMermaidConfig(CODESTASH_LIGHT_MODERN_THEME).theme).toBe("default");

    const customLightWithoutFlag: ThemeDefinition = {
      id: "custom-light",
      name: "Custom Light",
      colors: {
        ...CODESTASH_LIGHT_MODERN_THEME.colors,
        base: "#fafafa",
        lift: "#ffffff",
      },
    };
    delete customLightWithoutFlag.isDark;
    expect(isThemeDark(customLightWithoutFlag)).toBe(false);
  });
});
