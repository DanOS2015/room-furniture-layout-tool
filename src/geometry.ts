import type { Footprint, Item, Pt, Room, Shape } from "./model";

/* ------------------------------------------------------------------ *
 * Room polygon
 * ------------------------------------------------------------------ */

export interface Wall {
  a: Pt;
  b: Pt;
  len: number;
  /** Unit vector along the wall, a -> b. */
  u: Pt;
  /** Unit normal pointing into the room. */
  n: Pt;
  i: number;
}

/**
 * Four wall lengths define the room; the fifth (angled, door) wall falls out of
 * them. The Math.max guards are a *drawing* clamp only - a half-typed room
 * dimension must not be able to collapse the plan. The stored value is always
 * whatever was typed.
 */
export function verts(room: Room): Pt[] {
  const top = Math.max(500, room.top);
  const left = Math.max(500, room.left);
  const bottom = Math.min(Math.max(0, room.bottom), top);
  const right = Math.min(Math.max(0, room.right), left);
  const p: Pt[] = [
    { x: 0, y: 0 },
    { x: top, y: 0 },
    { x: top, y: right },
    { x: bottom, y: left },
    { x: 0, y: left },
  ];
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    if (Math.hypot(p[i].x - q.x, p[i].y - q.y) > 1) out.push(p[i]);
  }
  return out.length >= 3 ? out : p;
}

export function wallNames(room: Room): string[] {
  return verts(room).length === 5
    ? ["Top (fireplace)", "Right", "Door wall", "Bottom (radiator)", "Left"]
    : ["Top", "Right", "Bottom", "Left"];
}

export function inPoly(p: Pt, v: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const xi = v[i].x,
      yi = v[i].y,
      xj = v[j].x,
      yj = v[j].y;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

export function walls(room: Room): Wall[] {
  const v = verts(room);
  const out: Wall[] = [];
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    let n = { x: -u.y, y: u.x };
    if (!inPoly({ x: (a.x + b.x) / 2 + n.x * 20, y: (a.y + b.y) / 2 + n.y * 20 }, v)) n = { x: u.y, y: -u.x };
    out.push({ a, b, len, u, n, i });
  }
  return out;
}

export interface Corner {
  /** Index into verts(room). */
  index: number;
  point: Pt;
  /** Interior angle in degrees. */
  angle: number;
  /** Unit bisector pointing into the room. */
  bisector: Pt;
  name: string;
}

/** Every corner of the room sharp enough to tuck a corner unit into. */
export function corners(room: Room): Corner[] {
  const v = verts(room);
  const names = wallNames(room);
  const n = v.length;
  const out: Corner[] = [];
  for (let k = 0; k < n; k++) {
    const V = v[k];
    const A = v[(k - 1 + n) % n];
    const B = v[(k + 1) % n];
    const u1 = unit({ x: A.x - V.x, y: A.y - V.y });
    const u2 = unit({ x: B.x - V.x, y: B.y - V.y });
    const angle = (Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y))) * 180) / Math.PI;
    if (angle > 170) continue;
    let bisector = unit({ x: u1.x + u2.x, y: u1.y + u2.y });
    if (!inPoly({ x: V.x + bisector.x * 20, y: V.y + bisector.y * 20 }, v)) bisector = { x: -bisector.x, y: -bisector.y };
    // Wall k runs v[k] -> v[k+1], so corner k is where wall k-1 meets wall k.
    out.push({ index: k, point: V, angle, bisector, name: `${names[(k - 1 + n) % n]} / ${names[k]}` });
  }
  return out;
}

function unit(p: Pt): Pt {
  const L = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / L, y: p.y / L };
}

/* ------------------------------------------------------------------ *
 * Item footprints
 * ------------------------------------------------------------------ */

export const shapeOf = (f: Footprint): Shape => f.shape ?? "rect";
export const isL = (f: Footprint) => shapeOf(f) === "L";
export const isCorner = (f: Footprint) => shapeOf(f) === "corner";

export function bodyDepth(f: Footprint): number {
  return Math.min(Math.max(100, f.bodyD ?? f.d), f.d);
}

export function chaiseWidth(f: Footprint): number {
  return Math.min(Math.max(100, f.chaiseW ?? f.w * 0.35), f.w);
}

/**
 * Corner units are stored by `wallRun` - the length of each rear edge, the way
 * retailers quote them. Internally the shape needs `c`, the run measured along
 * each axis: the rear edges sit at 45 degrees, so c = wallRun / sqrt(2).
 */
export function cornerCut(f: Footprint): number {
  const raw = (f.wallRun ?? Math.SQRT2 * 0.85 * Math.min(f.w / 2, f.d)) / Math.SQRT2;
  return Math.min(Math.max(50, raw), Math.max(50, Math.min(f.w / 2 - 20, f.d - 20)));
}

/** The wall run actually in force, after clamping. */
export function wallRunOf(f: Footprint): number {
  return cornerCut(f) * Math.SQRT2;
}

/**
 * How far the front corners of a corner unit overhang the wall lines when it is
 * tucked in. Zero for a valid unit; positive means the front is too wide for
 * the depth (a true 90-degree corner unit can be at most 2x as wide as deep).
 */
export function cornerOverhang(f: Footprint): number {
  return Math.max(0, (f.w / 2 - f.d) / Math.SQRT2);
}

/** A closed polygon as [x, y] pairs. */
export type Poly = number[][];

/** Convex pieces the footprint is made of, in the item's own coordinates. */
export function localPolys(f: Footprint): Poly[] {
  const W = f.w;
  const D = f.d;
  if (isL(f)) {
    const bD = bodyDepth(f);
    const cW = chaiseWidth(f);
    const cd = D - bD;
    const out: Poly[] = [
      [
        [-W / 2, -D / 2],
        [W / 2, -D / 2],
        [W / 2, -D / 2 + bD],
        [-W / 2, -D / 2 + bD],
      ],
    ];
    if (cd > 1) {
      const cx = f.chaiseSide === "right" ? W / 2 - cW / 2 : -W / 2 + cW / 2;
      out.push([
        [cx - cW / 2, -D / 2 + bD],
        [cx + cW / 2, -D / 2 + bD],
        [cx + cW / 2, D / 2],
        [cx - cW / 2, D / 2],
      ]);
    }
    return out;
  }
  if (isCorner(f)) {
    const c = cornerCut(f);
    // Flat front, and two rear edges meeting at a right angle at the apex.
    return [
      [
        [-W / 2, D / 2],
        [W / 2, D / 2],
        [c, -D / 2 + c],
        [0, -D / 2],
        [-c, -D / 2 + c],
      ],
    ];
  }
  return [
    [
      [-W / 2, -D / 2],
      [W / 2, -D / 2],
      [W / 2, D / 2],
      [-W / 2, D / 2],
    ],
  ];
}

/** The single outline of the whole piece - no internal seams. */
export function localOutline(f: Footprint): Poly {
  const W = f.w;
  const D = f.d;
  if (isL(f)) {
    const bD = bodyDepth(f);
    const cW = chaiseWidth(f);
    if (D - bD < 1)
      return [
        [-W / 2, -D / 2],
        [W / 2, -D / 2],
        [W / 2, D / 2],
        [-W / 2, D / 2],
      ];
    return f.chaiseSide === "right"
      ? [
          [-W / 2, -D / 2],
          [W / 2, -D / 2],
          [W / 2, D / 2],
          [W / 2 - cW, D / 2],
          [W / 2 - cW, -D / 2 + bD],
          [-W / 2, -D / 2 + bD],
        ]
      : [
          [-W / 2, -D / 2],
          [W / 2, -D / 2],
          [W / 2, -D / 2 + bD],
          [-W / 2 + cW, -D / 2 + bD],
          [-W / 2 + cW, D / 2],
          [-W / 2, D / 2],
        ];
  }
  return localPolys(f)[0];
}

/** Footprint pieces in room coordinates. */
export function bodyPolys(f: Footprint): Pt[][] {
  const r = ((f.rot || 0) * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return localPolys(f).map((P) => P.map(([x, y]) => ({ x: f.x + x * c - y * s, y: f.y + x * s + y * c })));
}

export const polyPath = (P: Poly | Pt[]): string =>
  "M " + P.map((p) => (Array.isArray(p) ? `${p[0]} ${p[1]}` : `${p.x} ${p.y}`)).join(" L ") + " Z";

/* ------------------------------------------------------------------ *
 * Collision and distance
 * ------------------------------------------------------------------ */

function proj(P: Pt[], ax: Pt): [number, number] {
  let mn = Infinity;
  let mx = -Infinity;
  for (const p of P) {
    const d = p.x * ax.x + p.y * ax.y;
    if (d < mn) mn = d;
    if (d > mx) mx = d;
  }
  return [mn, mx];
}

/** Separating-axis overlap test for two convex polygons. */
export function satPoly(A: Pt[], B: Pt[]): boolean {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const b = P[(i + 1) % P.length];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const L = Math.hypot(vx, vy) || 1;
      const ax = { x: -vy / L, y: vx / L };
      const [a1, a2] = proj(A, ax);
      const [b1, b2] = proj(B, ax);
      if (a2 <= b1 + 0.5 || b2 <= a1 + 0.5) return false;
    }
  }
  return true;
}

export function hit(A: Footprint, B: Footprint): boolean {
  for (const a of bodyPolys(A)) for (const b of bodyPolys(B)) if (satPoly(a, b)) return true;
  return false;
}

export function distPtSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = dx * dx + dy * dy;
  let t = L ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function polyDist(P: Pt[], Q: Pt[]): number {
  let m = Infinity;
  for (const p of P) for (let i = 0; i < Q.length; i++) m = Math.min(m, distPtSeg(p, Q[i], Q[(i + 1) % Q.length]));
  for (const q of Q) for (let i = 0; i < P.length; i++) m = Math.min(m, distPtSeg(q, P[i], P[(i + 1) % P.length]));
  return m;
}

/**
 * True shortest distance between two footprints, 0 if they overlap.
 *
 * This replaces the old expandPoly()/hitGrown() pair, which faked an offset by
 * pushing each corner radially away from the centroid. On a 2770x1030 sofa that
 * turned a 750 mm walkway into +703 mm at the sides and +261 mm front-to-back.
 */
export function minDist(A: Footprint, B: Footprint): number {
  if (hit(A, B)) return 0;
  let m = Infinity;
  for (const a of bodyPolys(A)) for (const b of bodyPolys(B)) m = Math.min(m, polyDist(a, b));
  return m;
}

/**
 * Do two segments properly cross?
 *
 * The parallel test is on the *angle* between them, not the raw cross product.
 * At room scale a raw area threshold is uselessly tight: an edge lying flat on
 * a wall gives a cross product of ~1e-9, which sailed past a 1e-9 cutoff and
 * counted a flush sofa as breaking through the wall.
 */
function segHit(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const r = { x: p2.x - p1.x, y: p2.y - p1.y };
  const q = { x: p4.x - p3.x, y: p4.y - p3.y };
  const lr = Math.hypot(r.x, r.y);
  const lq = Math.hypot(q.x, q.y);
  if (!lr || !lq) return false;
  const cross = r.x * q.y - r.y * q.x;
  if (Math.abs(cross) / (lr * lq) < 1e-6) return false;
  const t = ((p3.x - p1.x) * q.y - (p3.y - p1.y) * q.x) / cross;
  const u = ((p3.x - p1.x) * r.y - (p3.y - p1.y) * r.x) / cross;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

/**
 * Half a millimetre of slack on the room boundary.
 *
 * A piece pushed flat against a wall has vertices *on* the wall line, where
 * ray-casting is a coin toss - rotating the measured couch by 270 degrees lands
 * its back corner at x = -2.3e-13, which counted as outside the room and
 * reported a phantom "goes through a wall". Anything genuinely poking out does
 * so by millimetres, far above this.
 */
const BOUNDARY_EPS = 0.5;

function inRoomPoint(p: Pt, v: Pt[]): boolean {
  if (inPoly(p, v)) return true;
  for (let i = 0; i < v.length; i++) if (distPtSeg(p, v[i], v[(i + 1) % v.length]) <= BOUNDARY_EPS) return true;
  return false;
}

export function insideRoom(f: Footprint, room: Room): boolean {
  const v = verts(room);
  for (const P of bodyPolys(f)) {
    for (const p of P) if (!inRoomPoint(p, v)) return false;
    for (let i = 0; i < P.length; i++)
      for (let j = 0; j < v.length; j++)
        if (segHit(P[i], P[(i + 1) % P.length], v[j], v[(j + 1) % v.length])) return false;
  }
  return true;
}

export function gapToWall(f: Footprint, w: Wall): number {
  let m = Infinity;
  for (const P of bodyPolys(f)) for (const p of P) m = Math.min(m, distPtSeg(p, w.a, w.b));
  return m;
}

/* ------------------------------------------------------------------ *
 * Placement helpers
 * ------------------------------------------------------------------ */

/**
 * Sit a corner unit in a room corner with both rear edges `gap` mm off their
 * wall. Works for any corner including the angled door wall, unlike the old
 * hardcoded top-right / top-left version.
 */
export function tuckIntoCorner(f: Footprint, room: Room, cornerIndex: number, gap = 20): Pick<Item, "rot" | "x" | "y"> | null {
  const c = corners(room).find((k) => k.index === cornerIndex);
  if (!c) return null;
  const b = c.bisector;
  const half = (c.angle / 2) * (Math.PI / 180);
  // Along the bisector, distance travelled maps to perpendicular wall clearance
  // by sin(half-angle).
  const t = gap / Math.max(Math.sin(half), 0.2);
  // SVG rotate(r) sends local +y to (-sin r, cos r); we want that to be the
  // inward bisector, so the apex points out into the corner.
  const rot = (Math.atan2(-b.x, b.y) * 180) / Math.PI;
  const reach = t + f.d / 2;
  return {
    rot: ((rot % 360) + 360) % 360,
    x: c.point.x + b.x * reach,
    y: c.point.y + b.y * reach,
  };
}

/** Turn and slide a piece so its back sits flat against the middle of a wall. */
export function backedOn<T extends Footprint>(f: T, w: Wall, side?: "left" | "right"): T {
  const ang = (Math.atan2(w.u.y, w.u.x) * 180) / Math.PI;
  const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
  const t: T = {
    ...f,
    rot: ((ang % 360) + 360) % 360,
    x: mid.x + (w.n.x * f.d) / 2,
    y: mid.y + (w.n.y * f.d) / 2,
  };
  if (side) t.chaiseSide = side;
  return t;
}
