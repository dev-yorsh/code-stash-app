const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function generatePng(size) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (1 + width * 4));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0: None
    for (let x = 0; x < width; x++) {
      const cx = width / 2;
      const cy = height / 2;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);

      const cornerRadius = size * 0.22;
      const isCorner = dx > cx - cornerRadius && dy > cy - cornerRadius;
      let inBounds = true;
      if (isCorner) {
        const cdx = dx - (cx - cornerRadius);
        const cdy = dy - (cy - cornerRadius);
        if (cdx * cdx + cdy * cdy > cornerRadius * cornerRadius) {
          inBounds = false;
        }
      }

      if (!inBounds) {
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
      } else {
        // Indigo gradient
        const t = (x + y) / (width + height);
        const r = Math.round(99 + t * (129 - 99)); // #6366f1 -> #818cf8
        const g = Math.round(102 + t * (140 - 102));
        const b = Math.round(241 + t * (248 - 241));

        // Draw inner code bracket symbol
        const nx = x / width;
        const ny = y / height;
        const isBracketLeft = (nx > 0.25 && nx < 0.35 && ny > 0.35 && ny < 0.65) ||
                              (Math.abs((nx - 0.25) + (ny - 0.5)) < 0.04 && nx >= 0.25 && nx <= 0.4);
        const isSlash = Math.abs((nx - 0.5) * 2 + (ny - 0.5)) < 0.05 && ny > 0.25 && ny < 0.75;

        if (isSlash || isBracketLeft) {
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
        } else {
          rawData[offset++] = r;
          rawData[offset++] = g;
          rawData[offset++] = b;
          rawData[offset++] = 255;
        }
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createIcoFromPngs(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4); // Image count

  const directoryEntries = [];
  let currentOffset = 6 + count * 16;

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // Width: 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // Height: 0 means 256
    entry.writeUInt8(0, 2); // Color count
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // Size of image data
    entry.writeUInt32LE(currentOffset, 12); // Offset
    directoryEntries.push(entry);
    currentOffset += buffer.length;
  }

  return Buffer.concat([
    header,
    ...directoryEntries,
    ...pngBuffers.map(p => p.buffer)
  ]);
}

const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [32, 64, 128, 256, 512];
const generated = {};

for (const s of sizes) {
  const buf = generatePng(s);
  generated[s] = buf;
}

fs.writeFileSync(path.join(iconsDir, '32x32.png'), generated[32]);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), generated[128]);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), generated[256]);
fs.writeFileSync(path.join(iconsDir, 'icon.png'), generated[512]);

// Create ICO with 32, 64, 128 and 256
const icoBuf = createIcoFromPngs([
  { size: 32, buffer: generated[32] },
  { size: 64, buffer: generated[64] },
  { size: 128, buffer: generated[128] },
  { size: 256, buffer: generated[256] }
]);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuf);

// Fake icns for mac
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), generated[512]);

console.log('Icons with 256x256 layer successfully generated in src-tauri/icons/');
