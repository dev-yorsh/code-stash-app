import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateScaledDimensions,
  computeSha256Hex,
  dataUrlToBlob,
  extractImageFilesFromDataTransfer,
  MAX_IMAGE_INPUT_BYTES,
  prepareImageAsset,
  sanitizeSvgContent,
} from "../imageProcessing";
import { CODESTASH_ASSET_SCHEME } from "@/shared/api/assets/assetReferences";

describe("imageProcessing (Plain Text Image Optimization, Sanitization & Hashing)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("sanitizes malicious SVG markup against script, foreignObject, on* handlers and javascript: URIs", () => {
    const dirtySvg = [
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
      "<script>fetch('https://evil.test')</script>",
      '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(2)"/></body></foreignObject>',
      '<a href="javascript:alert(3)"><circle cx="10" cy="10" r="8" onclick="evil()" fill="#ff0000"/></a>',
      "</svg>",
    ].join("");

    const clean = sanitizeSvgContent(dirtySvg);

    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<foreignObject/i);
    expect(clean).not.toMatch(/\son(?:load|error|click)\s*=/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).toContain('<circle cx="10" cy="10" r="8"');
    expect(clean).toContain("</svg>");
  });

  it("scales dimensions proportionally only when exceeding max side", () => {
    expect(calculateScaledDimensions(1200, 800, 1600)).toEqual({
      width: 1200,
      height: 800,
      scaled: false,
    });

    expect(calculateScaledDimensions(3200, 1600, 1600)).toEqual({
      width: 1600,
      height: 800,
      scaled: true,
    });

    expect(calculateScaledDimensions(1000, 2000, 1600)).toEqual({
      width: 800,
      height: 1600,
      scaled: true,
    });
  });

  it("produces deterministic lowercase 64-char SHA-256 hashes for identical bytes", async () => {
    const bytesA = new Uint8Array([1, 2, 3, 4, 5]);
    const bytesB = new Uint8Array([1, 2, 3, 4, 5]);
    const bytesC = new Uint8Array([5, 4, 3, 2, 1]);

    const hashA = await computeSha256Hex(bytesA);
    const hashB = await computeSha256Hex(bytesB);
    const hashC = await computeSha256Hex(bytesC);

    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });

  it("prepares SVG and GIF assets with content-addressed URIs and enforces 20MB limit & MIME allowlist", async () => {
    // 1. SVG sanitization + deterministic deduplicated hash
    const svgBlob = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>'],
      { type: "image/svg+xml" }
    );
    const svgPrepared = await prepareImageAsset(svgBlob, "diagram.svg");
    expect(svgPrepared.ext).toBe("svg");
    expect(svgPrepared.mimeType).toBe("image/svg+xml");
    expect(svgPrepared.uri).toBe(`${CODESTASH_ASSET_SCHEME}${svgPrepared.id}.svg`);
    expect(new TextDecoder().decode(svgPrepared.bytes)).not.toContain("<script");

    // 2. GIF pass-through preserves binary bytes intact
    const gifHeader = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const gifBlob = new Blob([gifHeader], { type: "image/gif" });
    const gifPrepared = await prepareImageAsset(gifBlob, "anim.gif");
    expect(gifPrepared.ext).toBe("gif");
    expect(gifPrepared.mimeType).toBe("image/gif");
    expect(Array.from(gifPrepared.bytes)).toEqual(Array.from(gifHeader));

    // 3. Reject unsupported file types
    const pdfBlob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    await expect(prepareImageAsset(pdfBlob, "doc.pdf")).rejects.toThrow();

    // 4. Reject oversized blobs (> 20 MB)
    const fakeLargeBlob = {
      size: MAX_IMAGE_INPUT_BYTES + 1,
      type: "image/png",
    } as unknown as Blob;
    await expect(prepareImageAsset(fakeLargeBlob, "huge.png")).rejects.toThrow(/20 MB/);
  });

  it("decodes valid base64 image data URLs and ignores non-image URLs", () => {
    // 1x1 transparent PNG base64
    const pngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const blob = dataUrlToBlob(pngDataUrl);
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe("image/png");
    expect(blob?.size).toBeGreaterThan(20);

    expect(dataUrlToBlob("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
  });

  it("extracts supported image files cleanly without duplicates from DataTransfer", () => {
    const imgFile = new File([new Uint8Array([1, 2, 3])], "shot.png", {
      type: "image/png",
      lastModified: 1000,
    });
    const textFile = new File(["hello"], "notes.txt", {
      type: "text/plain",
      lastModified: 1000,
    });

    const mockTransfer = {
      files: {
        length: 2,
        item: (idx: number) => (idx === 0 ? imgFile : textFile),
      },
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => imgFile,
        },
      ],
    } as unknown as DataTransfer;

    const extracted = extractImageFilesFromDataTransfer(mockTransfer);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].name).toBe("shot.png");
  });
});
