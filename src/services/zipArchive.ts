export interface ZipEntryInput {
  name: string;
  data: Uint8Array;
  compress?: boolean;
}

export interface ZipEntryOutput {
  name: string;
  data: Uint8Array;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: false });

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function normalizeZipEntryName(rawName: string): string {
  const cleaned = rawName.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !cleaned ||
    cleaned.includes("\0") ||
    cleaned.split("/").some((seg) => seg === "..")
  ) {
    throw new Error(`Nombre de entrada ZIP inválido: ${rawName}`);
  }
  return cleaned;
}

function getDosDateTime(date = new Date()): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  return { dosTime, dosDate };
}

const STREAM_TIMEOUT_MS = 8000;

async function runTransformWithoutDeadlock(
  data: Uint8Array,
  streamFactory: () => {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<BufferSource>;
  }
): Promise<Uint8Array> {
  const payload = new Uint8Array(data);
  const stream = streamFactory();
  // IMPORTANT: Begin consuming readable BEFORE writing/closing writable so Chromium WebStreams
  // never deadlock on internal TransformStream backpressure.
  const readPromise = new Response(stream.readable).arrayBuffer();
  const writer = stream.writable.getWriter();

  const workPromise = (async () => {
    await writer.write(payload);
    await writer.close();
    const buffer = await readPromise;
    return new Uint8Array(buffer);
  })();
  workPromise.catch(() => {});

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      workPromise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Stream transform timed out."));
        }, STREAM_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

async function tryDeflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined" || data.byteLength < 128) {
    return null;
  }
  try {
    const compressed = await runTransformWithoutDeadlock(
      data,
      () => new CompressionStream("deflate-raw")
    );
    return compressed.byteLength < data.byteLength ? compressed : null;
  } catch {
    return null;
  }
}

async function inflateRawBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "Este entorno no soporta descompresión DEFLATE; exporta sin compresión o usa una versión compatible."
    );
  }
  return runTransformWithoutDeadlock(
    data,
    () => new DecompressionStream("deflate-raw")
  );
}

export function isZipMagicBytes(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05)
  );
}

export async function createZipArchive(
  entries: ReadonlyArray<ZipEntryInput>
): Promise<Uint8Array> {
  const { dosTime, dosDate } = getDosDateTime();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const safeName = normalizeZipEntryName(entry.name);
    const nameBytes = textEncoder.encode(safeName);
    const rawBytes = entry.data;
    const crc = computeCrc32(rawBytes);

    const compressed = entry.compress ? await tryDeflateRaw(rawBytes) : null;
    const method = compressed ? 8 : 0;
    const payload = compressed ?? rawBytes;

    // Local File Header (30 bytes + filename)
    const lfh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, method, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, payload.byteLength, true);
    lv.setUint32(22, rawBytes.byteLength, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lfh.set(nameBytes, 30);

    localParts.push(lfh, payload);

    // Central Directory Header (46 bytes + filename)
    const cdh = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 filename flag
    cv.setUint16(10, method, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, payload.byteLength, true);
    cv.setUint32(24, rawBytes.byteLength, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, localOffset, true);
    cdh.set(nameBytes, 46);

    centralParts.push(cdh);
    localOffset += lfh.byteLength + payload.byteLength;
  }

  let cdSize = 0;
  for (const part of centralParts) {
    cdSize += part.byteLength;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, localOffset, true);
  ev.setUint16(20, 0, true);

  const totalLength = localOffset + cdSize + eocd.byteLength;
  const output = new Uint8Array(totalLength);
  let cursor = 0;

  for (const part of localParts) {
    output.set(part, cursor);
    cursor += part.byteLength;
  }
  for (const part of centralParts) {
    output.set(part, cursor);
    cursor += part.byteLength;
  }
  output.set(eocd, cursor);

  return output;
}

export async function readZipArchive(zipBytes: Uint8Array): Promise<ZipEntryOutput[]> {
  if (zipBytes.byteLength < 22) {
    throw new Error("Archivo ZIP inválido o truncado.");
  }

  const view = new DataView(
    zipBytes.buffer,
    zipBytes.byteOffset,
    zipBytes.byteLength
  );

  // Locate End of Central Directory (0x06054b50) backwards
  const minOffset = Math.max(0, zipBytes.byteLength - 65557);
  let eocdOffset = -1;
  for (let i = zipBytes.byteLength - 22; i >= minOffset; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("El archivo no contiene una cabecera ZIP válida.");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const entries: ZipEntryOutput[] = [];
  let ptr = cdOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (ptr + 46 > zipBytes.byteLength || view.getUint32(ptr, true) !== 0x02014b50) {
      throw new Error("Entrada de directorio central ZIP corrupta.");
    }

    const method = view.getUint16(ptr + 10, true);
    const expectedCrc = view.getUint32(ptr + 16, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const uncompressedSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const rawName = textDecoder.decode(
      zipBytes.subarray(ptr + 46, ptr + 46 + nameLen)
    );
    ptr += 46 + nameLen + extraLen + commentLen;

    // Skip directory entries
    if (rawName.endsWith("/")) {
      continue;
    }

    const safeName = normalizeZipEntryName(rawName);
    if (
      localHeaderOffset + 30 > zipBytes.byteLength ||
      view.getUint32(localHeaderOffset, true) !== 0x04034b50
    ) {
      throw new Error(`Cabecera local ZIP inválida para ${safeName}.`);
    }

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zipBytes.byteLength) {
      throw new Error(`Datos truncados para ${safeName} en el archivo ZIP.`);
    }

    const compressedData = zipBytes.subarray(dataStart, dataEnd);
    let rawData: Uint8Array;
    if (method === 0) {
      rawData = new Uint8Array(compressedData);
    } else if (method === 8) {
      rawData = await inflateRawBytes(compressedData);
    } else {
      throw new Error(`Método de compresión ZIP (${method}) no soportado.`);
    }

    if (rawData.byteLength !== uncompressedSize || computeCrc32(rawData) !== expectedCrc) {
      throw new Error(`Checksum CRC-32 inválido para ${safeName}.`);
    }

    entries.push({ name: safeName, data: rawData });
  }

  return entries;
}
