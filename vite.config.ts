import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/appearance-config.json",
        "**/*appearance-config.json*",
        /appearance-config\.json/,
        "**/codestash-backup.jsonl",
        "**/*codestash-backup.jsonl*",
        "**/*.jsonl",
        "**/*.jsonl.tmp",
        /codestash-backup\.jsonl/,
      ],
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "clsx",
      "tailwind-merge",
      "lucide-react",
      "@uiw/react-codemirror",
      "@codemirror/theme-one-dark",
      "@codemirror/view",
      "@codemirror/lang-javascript",
      "@codemirror/lang-python",
      "@codemirror/lang-rust",
      "@codemirror/lang-cpp",
      "@codemirror/lang-java",
      "@codemirror/lang-sql",
      "@codemirror/lang-html",
      "@codemirror/lang-css",
      "@codemirror/lang-json",
      "@codemirror/lang-markdown",
      "@codemirror/lang-yaml",
    ],
  },
});
