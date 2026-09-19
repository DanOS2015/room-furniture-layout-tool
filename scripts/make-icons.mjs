/**
 * Generates the PWA icons into public/icons/.
 *
 * Run once with `npm run icons`; the PNGs are committed, so this only needs
 * re-running if the room or the palette changes.
 *
 * The glyph is the measured room's own five-sided outline - the same geometry
 * the app draws - so the icon can't drift away from what the tool actually is.
 *
 * Written against node:zlib alone rather than pulling in sharp (~10 MB of native
 * binary) to rasterise an SVG. The output is flat two-colour, so there is no
 * alpha to composite and no palette to build: supersample, average down to solid
 * RGB, deflate, wrap in IHDR/IDAT/IEND.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PAPER = [0xe9, 0xee, 0xf1]; // --paper
const INK = [0x15, 0x24, 0x2f]; // --ink
const SS = 4; // supersampling factor per axis

// ---------------------------------------------------------------- PNG writing

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgb: Uint8Array of size*size*3, row-major. */
function png(rgb, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // 10..12: compression, filter, interlace - all 0

  // Each scanline is prefixed with filter type 0 (None).
  const stride = size * 3;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- geometry

/**
 * The measured room, as five points. Kept as literals rather than imported from
 * src/model.ts because this is a plain .mjs script with no TypeScript loader -
 * these are the measured walls from the README, and the derived angled wall.
 */
const ROOM = { top: 4290, right: 2890, bottom: 3163, left: 3420 };

/** Mirrors verts() in src/geometry.ts: four walls, with the door wall derived. */
function verts({ top, right, bottom, left }) {
  return [
    { x: 0, y: 0 },
    { x: top, y: 0 },
    { x: top, y: right },
    { x: bottom, y: left },
    { x: 0, y: left },
  ];
}

/** Distance from (x,y) to the polygon's edges - used to stroke the walls. */
function edgeDist(poly, x, y) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return best;
}

/**
 * @param size   pixel size of the square icon
 * @param inset  fraction of the icon the glyph is allowed to fill (0.8 for a
 *               normal icon, less for maskable so it survives a circular crop)
 */
function render(size, inset) {
  const poly = verts(ROOM);
  const W = Math.max(...poly.map((p) => p.x));
  const D = Math.max(...poly.map((p) => p.y));

  // Fit the room into the inset box, centred, preserving aspect.
  const box = size * inset;
  const scale = Math.min(box / W, box / D);
  const ox = (size - W * scale) / 2;
  const oy = (size - D * scale) / 2;
  const stroke = size * 0.055; // wall thickness, in device pixels

  const out = new Uint8Array(size * size * 3);
  const n = SS * SS;

  // A filled room reads as a featureless slab at 192px, so only the walls are
  // inked and the floor stays paper - the outline is what makes it legible.
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let wall = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // Sample centre, mapped back into room millimetres.
          const x = (px + (sx + 0.5) / SS - ox) / scale;
          const y = (py + (sy + 0.5) / SS - oy) / scale;
          if (edgeDist(poly, x, y) * scale <= stroke / 2) wall++;
        }
      }
      const a = wall / n;
      const i = (py * size + px) * 3;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(PAPER[c] * (1 - a) + INK[c] * a);
    }
  }
  return out;
}

// ----------------------------------------------------------------------- main

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, inset: 0.78 },
  { file: "icon-512.png", size: 512, inset: 0.78 },
  // Maskable icons are cropped to a circle inscribed in the middle 80%, so the
  // glyph has to sit well inside that.
  { file: "icon-512-maskable.png", size: 512, inset: 0.54 },
  { file: "apple-touch-icon-180.png", size: 180, inset: 0.78 },
];

for (const t of targets) {
  const buf = png(render(t.size, t.inset), t.size);
  writeFileSync(path.join(outDir, t.file), buf);
  console.log(`${t.file.padEnd(26)} ${t.size}x${t.size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
