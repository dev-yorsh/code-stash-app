import type { Editor } from "@tiptap/core";
import {
  guessMimeTypeFromExt,
  parseAssetUri,
} from "@/shared/api/assets/assetReferences";
import { assetUrlManager } from "@/shared/api/assets/assetUrlManager";
import {
  extractImageFilesFromDataTransfer,
  isSupportedImageFile,
  processAndStoreImageFile,
} from "./imageProcessing";

export async function insertImageFilesIntoEditor(
  editor: Editor | null | undefined,
  files: ReadonlyArray<Blob>,
  insertAtPos?: number
): Promise<number> {
  if (!editor || editor.isDestroyed || !editor.isEditable || files.length === 0) {
    return 0;
  }

  let insertedCount = 0;

  for (const file of files) {
    if (!isSupportedImageFile(file)) {
      continue;
    }

    try {
      const { uri, alt } = await processAndStoreImageFile(file);
      if (editor.isDestroyed) break;

      const chain = editor.chain().focus();
      if (typeof insertAtPos === "number" && insertedCount === 0) {
        chain.setTextSelection(insertAtPos);
      }

      chain
        .insertContent([
          {
            type: "image",
            attrs: {
              src: uri,
              alt,
              width: null,
              align: "left",
            },
          },
          { type: "paragraph" },
        ])
        .run();

      insertedCount += 1;
    } catch (err) {
      console.error("Failed inserting image into editor:", err);
    }
  }

  return insertedCount;
}

export async function insertImagesFromDataTransfer(
  editor: Editor | null | undefined,
  dataTransfer: DataTransfer | null | undefined,
  insertAtPos?: number
): Promise<boolean> {
  const files = extractImageFilesFromDataTransfer(dataTransfer);
  if (files.length === 0) {
    return false;
  }
  await insertImageFilesIntoEditor(editor, files, insertAtPos);
  return true;
}

export function openImageFilePickerForEditor(
  editor: Editor | null | undefined
): void {
  if (!editor || editor.isDestroyed || !editor.isEditable || typeof document === "undefined") {
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp,image/avif";
  input.multiple = true;
  input.style.display = "none";

  const cleanup = () => {
    input.remove();
  };

  input.addEventListener("change", () => {
    const selected = input.files ? Array.from(input.files) : [];
    cleanup();
    if (selected.length > 0) {
      void insertImageFilesIntoEditor(editor, selected);
    }
  });

  input.addEventListener("cancel", cleanup);

  document.body.appendChild(input);
  input.click();
}

function decodeBase64DataUrl(
  dataUrl: string
): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    const binary = atob(match[2].replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, mimeType: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

async function resolveImageBinary(
  src: string,
  resolvedSrc?: string | null
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const parsed = parseAssetUri(src);
  if (parsed) {
    const repo = assetUrlManager.getAssetRepository();
    const stored = repo ? await repo.read(parsed.id) : null;
    if (stored && stored.bytes.length > 0) {
      return {
        bytes: new Uint8Array(stored.bytes),
        mimeType: stored.meta.mimeType || guessMimeTypeFromExt(stored.meta.ext),
      };
    }
  }

  const candidate = resolvedSrc || src;
  if (candidate.startsWith("data:image/")) {
    const decoded = decodeBase64DataUrl(candidate);
    if (decoded) return decoded;
  }

  if (
    typeof fetch === "function" &&
    (candidate.startsWith("blob:") ||
      candidate.startsWith("data:") ||
      candidate.startsWith("http://") ||
      candidate.startsWith("https://"))
  ) {
    try {
      const response = await fetch(candidate);
      if (response.ok) {
        const blob = await response.blob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.length > 0) {
          return { bytes, mimeType: blob.type || "image/png" };
        }
      }
    } catch {
      // Remote fetch can be blocked by CORS or unavailable in tests; fall through gracefully
    }
  }

  return null;
}

async function rasterizeUrlToPngBytes(
  sourceUrl: string,
  useAnonymousCors: boolean
): Promise<Uint8Array | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return null;
  }

  const probeCanvas = document.createElement("canvas");
  if (!probeCanvas.getContext("2d")) {
    return null;
  }

  return new Promise<Uint8Array | null>((resolve) => {
    const img = new Image();
    if (useAnonymousCors) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(null);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          void blob
            .arrayBuffer()
            .then((buf) => resolve(new Uint8Array(buf)))
            .catch(() => resolve(null));
        }, "image/png");
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = sourceUrl;
  });
}

/**
 * Copies the targeted image onto the system clipboard as PNG (with fallback
 * for native Electron clipboard IPC and Web Clipboard API).
 */
export async function copyImageToClipboard(
  src: string,
  resolvedSrc?: string | null
): Promise<boolean> {
  const raw = await resolveImageBinary(src, resolvedSrc);
  let pngBytes: Uint8Array | null = null;

  if (raw && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const objectUrl = URL.createObjectURL(
      new Blob([new Uint8Array(raw.bytes).buffer], { type: raw.mimeType })
    );
    try {
      pngBytes = await rasterizeUrlToPngBytes(objectUrl, false);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } else if (resolvedSrc || src) {
    const targetUrl = resolvedSrc || src;
    const isRemote = targetUrl.startsWith("http://") || targetUrl.startsWith("https://");
    pngBytes = await rasterizeUrlToPngBytes(targetUrl, isRemote);
  }

  const electronBytes =
    pngBytes ??
    (raw && (raw.mimeType === "image/png" || raw.mimeType === "image/jpeg")
      ? raw.bytes
      : null);

  if (window.electronAPI?.writeImageClipboard && electronBytes) {
    try {
      const res = await window.electronAPI.writeImageClipboard({ bytes: electronBytes });
      if (res?.success) return true;
    } catch {
      // Fall back to Web Clipboard API below
    }
  }

  const webPngBytes = pngBytes ?? (raw?.mimeType === "image/png" ? raw.bytes : null);
  if (
    webPngBytes &&
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === "function" &&
    typeof ClipboardItem !== "undefined"
  ) {
    try {
      const pngBlob = new Blob([new Uint8Array(webPngBytes).buffer], {
        type: "image/png",
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Inserts a duplicate copy of the image node at `pos` immediately after it
 * and moves the editor selection to the newly created duplicate image.
 */
export function duplicateImageNodeAt(
  editor: Editor | null | undefined,
  pos: number
): boolean {
  if (!editor || editor.isDestroyed || !editor.isEditable || typeof pos !== "number") {
    return false;
  }

  const targetNode = editor.state.doc.nodeAt(pos);
  if (!targetNode || targetNode.type.name !== "image") {
    return false;
  }

  const insertPos = pos + targetNode.nodeSize;
  const attrs = {
    src: typeof targetNode.attrs.src === "string" ? targetNode.attrs.src : "",
    alt: typeof targetNode.attrs.alt === "string" ? targetNode.attrs.alt : null,
    title: typeof targetNode.attrs.title === "string" ? targetNode.attrs.title : null,
    width: typeof targetNode.attrs.width === "string" ? targetNode.attrs.width : null,
    align:
      targetNode.attrs.align === "center" || targetNode.attrs.align === "right"
        ? targetNode.attrs.align
        : "left",
  };

  return editor
    .chain()
    .focus()
    .insertContentAt(insertPos, {
      type: targetNode.type.name,
      attrs,
    })
    .setNodeSelection(insertPos)
    .run();
}
