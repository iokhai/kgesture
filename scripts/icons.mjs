import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

// Rasterize the project's own vector mark. No image libraries or copied artwork.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
function icon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let alpha = 0, white = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const px = (x + (sx + .5) / 4) / size, py = (y + (sy + .5) / 4) / size;
        const qx = Math.max(Math.abs(px - .5) - .28, 0), qy = Math.max(Math.abs(py - .5) - .28, 0);
        if (Math.hypot(qx, qy) > .2) continue;
        alpha++;
        if (Math.min(segmentDistance(px, py, .29, .71, .70, .30), segmentDistance(px, py, .44, .28, .72, .28), segmentDistance(px, py, .72, .28, .72, .56)) < .045) white++;
      }
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      const blend = alpha ? white / alpha : 0;
      raw[offset] = Math.round(113 + 142 * blend); raw[offset + 1] = Math.round(98 + 157 * blend);
      raw[offset + 2] = Math.round(232 + 23 * blend); raw[offset + 3] = Math.round(alpha / 16 * 255);
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
export async function writeIcons(directory) {
  await mkdir(directory, { recursive: true });
  await Promise.all([16, 32, 48, 128].map(size => writeFile(`${directory}/${size}.png`, icon(size))));
}
