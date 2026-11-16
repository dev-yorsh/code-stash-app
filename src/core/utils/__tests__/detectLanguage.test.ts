import { describe, it, expect } from "vitest";
import { detectLanguage } from "../detectLanguage";

describe("detectLanguage (Multi-Signal Weighted Classifier)", () => {
  it("detects TypeScript and TSX components (without misclassifying JSX as HTML)", () => {
    const tsxCode = `
      import React, { useState } from "react";
      interface ButtonProps {
        label: string;
      }
      export const ActionButton: React.FC<ButtonProps> = ({ label }) => {
        const [count, setCount] = useState<number>(0);
        return (
          <div className="p-4">
            <button onClick={() => setCount(count + 1)}>{label}</button>
          </div>
        );
      };
    `;
    expect(detectLanguage(tsxCode)).toBe("typescript");
  });

  it("detects JavaScript and JSX components (without misclassifying JSX as HTML)", () => {
    const jsxCode = `
      import { useState } from "react";
      export default function Counter() {
        const [count, setCount] = useState(0);
        return <div className="box"><button onClick={() => setCount(count + 1)}>{count}</button></div>;
      }
    `;
    expect(detectLanguage(jsxCode)).toBe("javascript");
  });

  it("detects pure HTML documents and markup", () => {
    const htmlCode = `
      <!DOCTYPE html>
      <html lang="en">
        <head><title>Test</title></head>
        <body><div class="container"><p>Hello World</p></div></body>
      </html>
    `;
    expect(detectLanguage(htmlCode)).toBe("html");
  });

  it("detects Rust code", () => {
    const rustCode = `
      use std::collections::HashMap;
      pub fn count_words(text: &str) -> HashMap<String, usize> {
          let mut map = HashMap::new();
          println!("Counting words...");
          map
      }
    `;
    expect(detectLanguage(rustCode)).toBe("rust");
  });

  it("detects Python code including multiline imports and functions", () => {
    const pyCode = `
import os
import sys

def main():
    print(os.getcwd())
    if __name__ == "__main__":
        return True
    `;
    expect(detectLanguage(pyCode)).toBe("python");
  });

  it("detects SQL queries including single DDL/DML statements", () => {
    expect(
      detectLanguage("CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255) NOT NULL);")
    ).toBe("sql");
    expect(
      detectLanguage("SELECT u.id, u.name FROM users u WHERE u.active = 1 ORDER BY u.created_at DESC;")
    ).toBe("sql");
  });

  it("detects JSON and trailing-comma JSON", () => {
    expect(detectLanguage('{"name": "codestash", "version": "1.0.0"}')).toBe("json");
    expect(detectLanguage('{\n  "name": "codestash",\n  "private": true,\n}')).toBe("json");
  });

  it("detects CSS and modern CSS variables", () => {
    const cssCode = `
      :root {
        --primary-bg: #282c34;
      }
      .card {
        display: flex;
        padding: 12px;
        background-color: var(--primary-bg);
      }
    `;
    expect(detectLanguage(cssCode)).toBe("css");
  });

  it("detects C and C++ code", () => {
    const cppCode = `
      #include <iostream>
      #include <vector>
      int main() {
          std::vector<int> nums = {1, 2, 3};
          std::cout << nums.size() << std::endl;
          return 0;
      }
    `;
    expect(detectLanguage(cppCode)).toBe("cpp");
  });

  it("detects Java code", () => {
    const javaCode = `
      package com.codestash.app;
      import java.util.List;
      public class Main {
          public static void main(String[] args) {
              System.out.println("Hello");
          }
      }
    `;
    expect(detectLanguage(javaCode)).toBe("java");
  });

  it("detects Shell / Bash scripts without false positives on JS comments", () => {
    const shCode = `
      #!/usr/bin/env bash
      if [ -f "./package.json" ]; then
        npm run build
        docker compose up -d
      fi
    `;
    expect(detectLanguage(shCode)).toBe("shell");
  });

  it("detects YAML configurations", () => {
    const yamlCode = `
version: "3.9"
services:
  api:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    `;
    expect(detectLanguage(yamlCode)).toBe("yaml");
  });

  it("detects Markdown documents", () => {
    const mdCode = `
# Project Documentation

- [x] Setup repository
- [ ] Run tests

Check out [CodeStash](https://example.com) for more details.
    `;
    expect(detectLanguage(mdCode)).toBe("markdown");
  });

  it("detects Markdown with embedded code blocks, Mermaid diagrams, and YAML frontmatter", () => {
    const mdWithCodeAndMermaid = `
# Arquitectura del Sistema

\`\`\`typescript
interface User {
  id: string;
}
export const fetchUser = async (id: string) => console.log(id);
\`\`\`

\`\`\`mermaid
sequenceDiagram
  User->>API: SELECT * FROM sessions WHERE id = 1
  API-->>User: { "ok": true }
\`\`\`
    `;
    expect(detectLanguage(mdWithCodeAndMermaid)).toBe("markdown");

    const standaloneMermaidMarkdown = [
      "```mermaid",
      "flowchart TD",
      "  A[Inicio] --> B[Fin]",
      "```",
    ].join("\r\n");
    expect(detectLanguage(standaloneMermaidMarkdown)).toBe("markdown");

    const mdWithFrontmatter = `---
title: Release Notes
tags:
  - release
---

## Cambios principales

- Soporte de diagramas con **Mermaid**
`;
    expect(detectLanguage(mdWithFrontmatter)).toBe("markdown");
  });

  it("returns plaintext for empty or plain prose text", () => {
    expect(detectLanguage("")).toBe("plaintext");
    expect(detectLanguage("Just a simple shopping list of apples and bananas")).toBe("plaintext");
  });
});
