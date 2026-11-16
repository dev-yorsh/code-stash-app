# Política de Seguridad y Privacidad

## Compromiso *Offline-First*

**CodeStash** está diseñado para almacenar código fuente, comandos, notas técnicas e imágenes **100% de forma local** en el dispositivo del usuario. La aplicación no requiere cuentas de usuario ni envía datos de tus snippets o configuraciones a servidores externos.

---

## Controles de seguridad implementados

- **Aislamiento del proceso Renderer (Electron)**:
  - `nodeIntegration: false`, `contextIsolation: true` y `sandbox: true` en [`electron/main.cjs`](electron/main.cjs).
  - Exposición estrictamente controlada de operaciones mediante `contextBridge` en [`electron/preload.cjs`](electron/preload.cjs).
  - Bloqueo de navegaciones no locales (`will-navigate`) y creación de ventanas emergentes (`setWindowOpenHandler`), permitiendo únicamente la apertura externa segura de esquemas `http:`, `https:` y `mailto:`.
- **Sanitización contra XSS en Markdown, SVG y Diagramas**:
  - La previsualización Markdown aplica `rehypeSafeLineBreaks` (eliminando HTML arbitrario) y `rehypeSanitize` (`markdownSanitizeSchema`) en [`src/features/snippets/editor/utils/markdownSanitizeSchema.ts`](src/features/snippets/editor/utils/markdownSanitizeSchema.ts), además de filtrar URLs permitidas (`safeMarkdownUrlTransform`).
  - Los diagramas `svg` se sanitizan mediante `DOMPurify` prohibiendo `<script>`, `<foreignObject>` y manejadores `on*` en [`src/features/snippets/editor/components/SvgDiagramBlock.tsx`](src/features/snippets/editor/components/SvgDiagramBlock.tsx).
  - Mermaid se ejecuta con `securityLevel: "strict"` en [`src/features/snippets/editor/utils/mermaidRenderer.ts`](src/features/snippets/editor/utils/mermaidRenderer.ts).
- **Validación de rutas en almacenamiento de activos**:
  - [`electron/assetStorage.cjs`](electron/assetStorage.cjs) valida identificadores hexadecimales, extensiones permitidas y verifica mediante `resolveInsideDir` que ninguna lectura o escritura escape del directorio de activos.
- **Content Security Policy (Tauri v2)**:
  - Configurada en [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) restringiendo `default-src` y `script-src` a `'self'`.

---

## Cómo reportar una vulnerabilidad

Si detectas una vulnerabilidad de seguridad (por ejemplo: omisión de sanitización XSS en Markdown/SVG, *path traversal* en respaldos/activos o exposición indebida en IPC):

1. **No publiques los detalles técnicos ni un PoC en un Issue público.**
2. Reporta el hallazgo de forma privada mediante **GitHub Security Advisories** en la pestaña **Security → Advisories → Report a vulnerability** del repositorio en GitHub.
3. Incluye una descripción del vector afectado, los pasos mínimos para reproducirlo y el impacto estimado (sin adjuntar datos personales ni secretos reales).
