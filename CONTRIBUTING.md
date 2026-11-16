# Guía de Contribución a CodeStash

¡Gracias por tu interés en contribuir a **CodeStash**! Esta guía describe cómo preparar el entorno local, las convenciones del proyecto y las verificaciones necesarias antes de abrir un Pull Request.

---

## 1. Requisitos previos y entorno

- **Node.js** 20+ y **npm**
- **Rust y Cargo** *(opcional, solo necesario para trabajar en `src-tauri/`)*

```bash
git clone https://github.com/dev-yorsh/code-stash-app.git
cd code-stash-app
npm install
npm run dev:app
```

---

## 2. Arquitectura y convenciones del código

- **Feature-Sliced Design + Ports & Adapters**:
  - No accedas directamente a `indexedDB`, `localStorage`, IPC de Electron ni Tauri desde componentes visuales de `src/features/*`. Utiliza los contratos y repositorios definidos en [`src/shared/api/`](src/shared/api/repository.factory.ts) y sus adaptadores (`idb/`, `assets/`, `tauri/`, `fallback/`).
- **Tokens CSS y Temas**:
  - Usa variables semánticas (`--ayu-*` y tokens modulares definidos en [`src/features/settings/themes.ts`](src/features/settings/themes.ts) y [`src/index.css`](src/index.css)) para garantizar compatibilidad automática con temas oscuros, claros y personalizados.
- **Internacionalización (`i18n`)**:
  - Todo texto visible de la interfaz debe registrarse en [`src/shared/i18n/translations.ts`](src/shared/i18n/translations.ts) tanto en Español (`es`) como en Inglés (`en`).
- **Seguridad en Markdown, HTML e IPC**:
  - Cualquier extensión de previsualización o editor enriquecido debe mantener estricta sanitización (`rehype-sanitize`, `DOMPurify`, validación de URLs).
  - Cualquier canal nuevo en [`electron/preload.cjs`](electron/preload.cjs) y [`electron/main.cjs`](electron/main.cjs) debe validar entradas y mantener `sandbox: true` y `contextIsolation: true`.

---

## 3. Verificaciones obligatorias antes de enviar cambios

Antes de hacer commit o abrir un Pull Request, verifica que todas las comprobaciones pasen sin errores:

```bash
# 1. Comprobación de tipos TypeScript
npx tsc --noEmit

# 2. Suite de pruebas unitarias y de integración (Vitest)
npm test

# 3. Compilación de producción (TypeScript + Vite)
npm run build
```

---

## 4. Higiene de repositorio y privacidad

Al preparar tu rama o Pull Request:
- **No incluyas** archivos locales de datos, respaldos o configuraciones personales (`data/`, `.env*`, `appearance-config.json`, `codestash-backup.jsonl`, `release/`, `dist/`).
- **No introduzcas** rutas absolutas locales de tu sistema en documentación, scripts o pruebas.
- **No agregues** credenciales, tokens ni URLs internas privadas.

---

## 5. Flujo de Pull Request

1. Crea una rama descriptiva desde `main` / `master` (por ejemplo: `feat/nombre-corto` o `fix/descripcion`).
2. Mantén los cambios enfocados e incluye pruebas unitarias en la carpeta `__tests__` del módulo modificado.
3. Ejecuta `npx tsc --noEmit`, `npm test` y `npm run build` sobre tu estado final.
4. Abre el Pull Request detallando qué cambia, por qué y cómo se probó.
