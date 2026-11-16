import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MarkdownPreviewPanel } from "../MarkdownPreviewPanel";
import { CODESTASH_ONEDARK_THEME, CODESTASH_LIGHT_MODERN_THEME } from "@/features/settings";
import { openExternalUrl } from "@/core/utils/openExternalUrl";
import * as mermaidRenderer from "../../utils/mermaidRenderer";

vi.mock("@/core/utils/openExternalUrl", () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}));

describe("MarkdownPreviewPanel (GFM, Security, Alerts & Diagrams)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders GFM headings, tables, checklists, GitHub alerts, math, code blocks, and safe links", () => {
    const mdDoc = `
# Documentación Principal

Texto con **negrita**, ~~tachado~~, enlace [CodeStash Docs](https://codestash.dev) y [XSS](javascript:alert(1)).

> [!NOTE]
> Este aviso importante no debe mostrar el prefijo crudo.

- [x] Tarea completada
- [ ] Tarea pendiente

| Columna A | Columna B |
| :--- | :--- |
| Valor 1<br>Línea 2 | $E = mc^2$ |

\`\`\`typescript
const version: number = 2;
\`\`\`

<script>window.__xss = true;</script>
<img src="x" onerror="window.__xssImg = true" alt="seguro" />
`;

    render(<MarkdownPreviewPanel code={mdDoc} activeTheme={CODESTASH_ONEDARK_THEME} />);

    const panel = screen.getByTestId("markdown-preview-panel");
    expect(panel.querySelector("h1")?.textContent).toBe("Documentación Principal");
    expect(panel.querySelector("table")).not.toBeNull();
    expect(panel.querySelector("table br")).not.toBeNull();
    expect(panel.querySelector(".katex")).not.toBeNull();
    expect(panel.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);

    // GitHub Alert badge & stripped [!NOTE] marker
    expect(panel).toHaveTextContent("Note");
    expect(panel).toHaveTextContent("Este aviso importante no debe mostrar el prefijo crudo.");
    expect(panel.textContent).not.toContain("[!NOTE]");

    // Malicious XSS payloads must be stripped cleanly
    expect(panel.querySelector("script")).toBeNull();
    expect(panel.querySelector("img")).toBeNull();
    const unsafeLink = Array.from(panel.querySelectorAll("a")).find(
      (a) => a.textContent === "XSS"
    );
    expect(unsafeLink?.getAttribute("href") || "").toBe("");

    // Safe external link routes through openExternalUrl
    const docsLink = screen.getByRole("link", { name: "CodeStash Docs" });
    fireEvent.click(docsLink);
    expect(openExternalUrl).toHaveBeenCalledWith("https://codestash.dev");
  });

  it("renders Mermaid diagrams with zoom controls, source toggle, copy, and error fallback", async () => {
    const renderSpy = vi
      .spyOn(mermaidRenderer, "renderMermaidDiagram")
      .mockImplementation(async (_id, chart) => {
        if (chart.includes("INVALID_SYNTAX")) {
          throw new Error("Parse error on line 2");
        }
        return {
          svg: `<svg data-testid="mock-mermaid-svg" viewBox="0 0 200 80"><text>OK</text></svg>`,
        };
      });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const mdWithDiagrams = `
\`\`\`mermaid
flowchart TD
  A[Inicio] --> B[Fin]
\`\`\`

\`\`\`mermaid
sequenceDiagram
  INVALID_SYNTAX
\`\`\`

\`\`\`svg
<svg viewBox="0 0 24 24"><script>alert(1)</script><circle cx="12" cy="12" r="10" onclick="hack()" /></svg>
\`\`\`
`;

    render(<MarkdownPreviewPanel code={mdWithDiagrams} activeTheme={CODESTASH_LIGHT_MODERN_THEME} />);

    // Both Mermaid cards render cleanly: one valid SVG and one graceful error box
    const cards = await screen.findAllByTestId("mermaid-diagram-card");
    expect(cards).toHaveLength(2);

    await waitFor(() => {
      expect(screen.getByTestId("mock-mermaid-svg")).toBeInTheDocument();
      expect(screen.getByText("Parse error on line 2")).toBeInTheDocument();
    });

    expect(renderSpy).toHaveBeenCalled();
    expect(cards[0]).toHaveTextContent("Mermaid · Flowchart");
    expect(cards[1]).toHaveTextContent("Mermaid · Sequence Diagram");

    // Zoom controls update diagram zoom state cleanly
    const zoomTarget = cards[0].querySelector(".codestash-diagram-svg")!;
    expect(zoomTarget).toHaveAttribute("data-zoom", "1");
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Acercar diagrama" }));
    expect(zoomTarget).toHaveAttribute("data-zoom", "1.25");
    expect(cards[0]).toHaveTextContent("125%");
    fireEvent.click(within(cards[0]).getByTitle("Restablecer zoom (100%)"));
    expect(zoomTarget).toHaveAttribute("data-zoom", "1");

    // Toggle source view on Mermaid card shows raw diagram source cleanly
    const sourceToggleButtons = screen.getAllByTitle("Ver código");
    fireEvent.click(sourceToggleButtons[0]);
    expect(cards[0]).toHaveTextContent("A[Inicio] --> B[Fin]");

    // Sanitized SVG diagram block renders circle cleanly with script & onclick stripped
    const svgCard = screen.getByTestId("svg-diagram-card");
    expect(svgCard.querySelector("circle")).not.toBeNull();
    expect(svgCard.querySelector("script")).toBeNull();
    expect(svgCard.querySelector("circle")?.getAttribute("onclick")).toBeNull();
  });

  it("renders full-width responsive table containers and a custom context menu without Ortografía, Preview, or Inspect Element", () => {
    const mdDoc = `
| Col 1 | Col 2 |
| --- | --- |
| A | B |
`;
    render(<MarkdownPreviewPanel code={mdDoc} activeTheme={CODESTASH_ONEDARK_THEME} />);

    const panel = screen.getByTestId("markdown-preview-panel");
    const tableWrapper = panel.querySelector("table")?.parentElement;
    expect(tableWrapper?.className).toContain("w-full");

    const ctxEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 120,
    });
    fireEvent(panel, ctxEvent);
    expect(ctxEvent.defaultPrevented).toBe(true);

    const previewMenu = screen.getByTestId("markdown-preview-context-menu");
    expect(previewMenu).toBeInTheDocument();
    expect(previewMenu).toHaveTextContent("Seleccionar todo");
    expect(previewMenu).not.toHaveTextContent(/previsualizar/i);
    expect(previewMenu).not.toHaveTextContent(/ortograf/i);
    expect(previewMenu).not.toHaveTextContent(/inspeccionar/i);
  });
});
