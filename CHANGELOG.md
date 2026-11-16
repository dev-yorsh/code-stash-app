# Registro de Cambios (Changelog)

Todos los cambios relevantes de **CodeStash** se documentan en este archivo siguiendo un formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

---

## [0.1.0] - Lanzamiento Inicial

### Añadido
- **Gestión completa de snippets y organización**:
  - Layout de 3 columnas redimensionables (navegación lateral, lista de snippets y espacio de trabajo).
  - Carpetas anidadas con drag & drop, selección múltiple, renombrado inline (`F2`) y conteos en tiempo real.
  - Etiquetas personalizadas con color e icono, filtro de Favoritos, Sin carpeta y Papelera con restauración o eliminación definitiva.
  - Snippets multi-fragmento con pestañas reordenables y renombrables.
- **Editor dual, Markdown y diagramas**:
  - Editor de código con **CodeMirror 6** para 14 modos de lenguaje y detección ponderada automática al pegar.
  - Previsualización **Markdown** responsiva con soporte GFM, matemáticas **KaTeX**, alertas GitHub, resaltado de bloques de código con copia, diagramas **SVG** sanitizados y **diagramas Mermaid** adaptados al tema activo.
  - Editor de notas enriquecidas con **Tiptap v3** (`Plain Text`) con encabezados, tablas redimensionables, listas de tareas interactivas, resaltado/colores de texto, corrector ortográfico bilingüe (`ES`/`EN`) e imágenes redimensionables almacenadas como activos locales.
- **Almacenamiento, respaldos y portabilidad**:
  - Capa hexagonal (**Ports & Adapters**) con IndexedDB + almacenamiento binario de activos en Electron (y soporte alternativo Tauri v2 + SQLite).
  - Respaldo automático local (`codestash-backup.jsonl`) y exportación/importación manual en formatos **`.zip`** (con imágenes incluidas) y **`.jsonl`**.
  - Soporte de modo portable para Windows junto a instalador **NSIS**.
- **Temas, i18n y configuración**:
  - Temas integrados: `CodeStash - OneDark` *(predeterminado)*, `CodeStash - Spacegray`, `One Dark` y `CodeStash - Light Modern`, además de personalización por `appearance-config.json`.
  - Internacionalización completa en **Español** e **Inglés**.
  - Modal de Configuración organizado en `General`, `Apariencia`, `Editor de texto` y `Acerca de`.
- **Pruebas automatizadas**:
  - Cobertura de pruebas unitarias y de UI con **Vitest** y **Testing Library**.
