import type { SaveAssetInput } from "@/core/types";
import { buildAssetUri } from "@/shared/api/assets/assetReferences";
import { assetUrlManager } from "@/shared/api/assets/assetUrlManager";
import { assetRepository } from "@/shared/api";

export const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_IMAGE_DIMENSION_PX = 1600;
export const WEBP_EXPORT_QUALITY = 0.84;

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "image/avif",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

export interface PreparedImageAsset extends SaveAssetInput {
  uri: string;
}

function resolveMimeType(blob: Blob, fileName?: string): string {
  const direct = (blob.type || "").toLowerCase().trim();
  if (SUPPORTED_IMAGE_MIME_TYPES.has(direct)) {
    return direct;
  }
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (EXTENSION_TO_MIME[ext]) {
      return EXTENSION_TO_MIME[ext];
    }
  }
  return direct;
}

export function isSupportedImageFile(file: Blob, fileName?: string): boolean {
  const name = fileName ?? (file instanceof File ? file.name : undefined);
  const mime = resolveMimeType(file, name);
  return SUPPORTED_IMAGE_MIME_TYPES.has(mime);
}

/**
 * Pure TypeScript SHA-256 fallback used only when crypto.subtle is unavailable.
 */
function sha256FallbackBytes(data: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  const bitLen = data.length * 8;
  const padLen = ((data.length + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3);
      const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  if (
    typeof crypto !== "undefined" &&
    crypto.subtle &&
    typeof crypto.subtle.digest === "function"
  ) {
    try {
      const normalized = new Uint8Array(bytes).buffer;
      const hashBuffer = await crypto.subtle.digest("SHA-256", normalized);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // Fallback below if Web Crypto rejects context
    }
  }
  return sha256FallbackBytes(bytes);
}

export function sanitizeSvgContent(rawSvg: string): string {
  return rawSvg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, "");
}

function extForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/webp":
      return "webp";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/avif":
      return "avif";
    case "image/bmp":
      return "bmp";
    default:
      return "webp";
  }
}

async function decodeImageElement(blob: Blob): Promise<{
  width: number;
  height: number;
  drawSource: CanvasImageSource;
  cleanup: () => void;
} | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        width: bitmap.width,
        height: bitmap.height,
        drawSource: bitmap,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to HTMLImageElement
    }
  }

  if (
    typeof document !== "undefined" &&
    typeof Image !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  ) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        const timeoutId = setTimeout(() => {
          reject(new Error("Image decode timeout"));
        }, 400);
        el.onload = () => {
          clearTimeout(timeoutId);
          resolve(el);
        };
        el.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error("Image decode failed"));
        };
        el.src = objectUrl;
      });
      return {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        drawSource: img,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      };
    } catch {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return null;
}

export function calculateScaledDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxSide = MAX_IMAGE_DIMENSION_PX
): { width: number; height: number; scaled: boolean } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: naturalWidth, height: naturalHeight, scaled: false };
  }
  const longest = Math.max(naturalWidth, naturalHeight);
  if (longest <= maxSide) {
    return { width: naturalWidth, height: naturalHeight, scaled: false };
  }
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
    scaled: true,
  };
}

async function optimizeRasterBlob(
  blob: Blob,
  mimeType: string
): Promise<{
  bytes: Uint8Array;
  mimeType: string;
  ext: string;
  width?: number;
  height?: number;
}> {
  const originalBuffer = await blob.arrayBuffer();
  const originalBytes = new Uint8Array(originalBuffer);

  if (typeof document === "undefined") {
    return {
      bytes: originalBytes,
      mimeType,
      ext: extForMimeType(mimeType),
    };
  }

  const decoded = await decodeImageElement(blob);
  if (!decoded || decoded.width <= 0 || decoded.height <= 0) {
    return {
      bytes: originalBytes,
      mimeType,
      ext: extForMimeType(mimeType),
    };
  }

  try {
    const { width, height, scaled } = calculateScaledDimensions(
      decoded.width,
      decoded.height
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        bytes: originalBytes,
        mimeType,
        ext: extForMimeType(mimeType),
        width: decoded.width,
        height: decoded.height,
      };
    }

    ctx.drawImage(decoded.drawSource, 0, 0, width, height);

    const webpBlob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((out) => resolve(out), "image/webp", WEBP_EXPORT_QUALITY);
      } catch {
        resolve(null);
      }
    });

    if (webpBlob && webpBlob.size > 0 && (scaled || webpBlob.size < originalBytes.byteLength)) {
      const encodedBytes = new Uint8Array(await webpBlob.arrayBuffer());
      const resolvedMime = webpBlob.type || "image/webp";
      return {
        bytes: encodedBytes,
        mimeType: resolvedMime,
        ext: extForMimeType(resolvedMime),
        width,
        height,
      };
    }

    return {
      bytes: originalBytes,
      mimeType,
      ext: extForMimeType(mimeType),
      width: decoded.width,
      height: decoded.height,
    };
  } finally {
    decoded.cleanup();
  }
}

export async function prepareImageAsset(
  file: Blob,
  fileName?: string
): Promise<PreparedImageAsset> {
  const resolvedName = fileName ?? (file instanceof File ? file.name : undefined);
  if (file.size > MAX_IMAGE_INPUT_BYTES) {
    throw new Error("La imagen excede el tamaño máximo permitido (20 MB).");
  }

  const mimeType = resolveMimeType(file, resolvedName);
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Formato de imagen no soportado.");
  }

  let finalBytes: Uint8Array;
  let finalMime = mimeType;
  let finalExt = extForMimeType(mimeType);
  let width: number | undefined;
  let height: number | undefined;

  if (mimeType === "image/svg+xml") {
    const rawText = await file.text();
    const cleanSvg = sanitizeSvgContent(rawText);
    finalBytes = new TextEncoder().encode(cleanSvg);
    finalMime = "image/svg+xml";
    finalExt = "svg";
  } else if (mimeType === "image/gif") {
    finalBytes = new Uint8Array(await file.arrayBuffer());
    finalMime = "image/gif";
    finalExt = "gif";
    const decoded = await decodeImageElement(file);
    if (decoded) {
      width = decoded.width;
      height = decoded.height;
      decoded.cleanup();
    }
  } else {
    const optimized = await optimizeRasterBlob(file, mimeType);
    finalBytes = optimized.bytes;
    finalMime = optimized.mimeType;
    finalExt = optimized.ext;
    width = optimized.width;
    height = optimized.height;
  }

  if (finalBytes.byteLength === 0) {
    throw new Error("La imagen está vacía o corrupta.");
  }

  const id = await computeSha256Hex(finalBytes);
  return {
    id,
    ext: finalExt,
    mimeType: finalMime,
    bytes: finalBytes,
    width,
    height,
    uri: buildAssetUri(id, finalExt),
  };
}

export async function processAndStoreImageFile(
  file: Blob,
  fileName?: string
): Promise<{ uri: string; alt: string; width?: number; height?: number }> {
  if (!assetUrlManager.getAssetRepository()) {
    assetUrlManager.setAssetRepository(assetRepository);
  }

  const prepared = await prepareImageAsset(file, fileName);
  await assetUrlManager.saveAndCacheAsset({
    id: prepared.id,
    ext: prepared.ext,
    mimeType: prepared.mimeType,
    bytes: prepared.bytes,
    width: prepared.width,
    height: prepared.height,
  });

  const rawName =
    fileName ?? (file instanceof File ? file.name : "");
  const cleanAlt = rawName.replace(/\.[^.]+$/, "").trim() || "imagen";

  return {
    uri: prepared.uri,
    alt: cleanAlt,
    width: prepared.width,
    height: prepared.height,
  };
}

export function extractImageFilesFromDataTransfer(
  dataTransfer: DataTransfer | null | undefined
): File[] {
  if (!dataTransfer) return [];
  const results: File[] = [];
  const seenKeys = new Set<string>();

  const pushIfImage = (file: File | null | undefined) => {
    if (!file || !isSupportedImageFile(file, file.name)) return;
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    results.push(file);
  };

  if (dataTransfer.files) {
    for (let i = 0; i < dataTransfer.files.length; i += 1) {
      pushIfImage(dataTransfer.files.item(i));
    }
  }

  if (dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i += 1) {
      const item = dataTransfer.items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        pushIfImage(item.getAsFile());
      }
    }
  }

  return results;
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(
    dataUrl.trim()
  );
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
