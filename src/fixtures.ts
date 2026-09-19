import type { Footprint, Layout, Pt, Room } from "./model";
import { walls, type Wall } from "./geometry";

export interface Fixture extends Footprint {
  id: string;
  name: string;
}

export function breastRect(s: Layout): Fixture | null {
  const b = s.breast;
  if (!b || !b.w || !b.d) return null;
  return { id: "breast", name: "Fireplace", rot: 0, shape: "rect", w: b.w, d: b.d, x: b.x + b.w / 2, y: b.d / 2 };
}

export function radRect(s: Layout): Fixture | null {
  const r = s.rad;
  if (!r || !r.len || !r.d) return null;
  return {
    id: "rad",
    name: "Radiator",
    rot: 0,
    shape: "rect",
    w: r.len,
    d: r.d,
    x: r.x + r.len / 2,
    y: Math.max(500, s.room.left) - r.d / 2,
  };
}

export function fixtures(s: Layout): Fixture[] {
  return [breastRect(s), radRect(s)].filter((f): f is Fixture => f !== null);
}

/** The angled wall carries the door on a five-sided room; the right wall otherwise. */
export function doorWall(room: Room): Wall {
  const w = walls(room);
  return w.length === 5 ? w[2] : w[1];
}

export interface DoorGeom {
  wall: Wall;
  width: number;
  s: Pt;
  e: Pt;
  hinge: Pt;
  other: Pt;
  open: Pt;
}

export function doorGeom(s: Layout): DoorGeom {
  const w = doorWall(s.room);
  const d = s.door;
  const width = Math.min(Math.max(1, d.w), w.len);
  const off = Math.min(Math.max(0, d.off), w.len - width);
  const start = { x: w.a.x + w.u.x * off, y: w.a.y + w.u.y * off };
  const end = { x: w.a.x + w.u.x * (off + width), y: w.a.y + w.u.y * (off + width) };
  const hinge = d.hinge === "start" ? start : end;
  const other = d.hinge === "start" ? end : start;
  return { wall: w, width, s: start, e: end, hinge, other, open: { x: hinge.x + w.n.x * width, y: hinge.y + w.n.y * width } };
}

/** The quarter of floor the door leaf sweeps, as a square footprint. */
export function doorZone(s: Layout): Fixture {
  const g = doorGeom(s);
  return {
    id: "door",
    name: "Door swing",
    shape: "rect",
    rot: (Math.atan2(g.other.y - g.hinge.y, g.other.x - g.hinge.x) * 180) / Math.PI,
    w: g.width,
    d: g.width,
    x: g.hinge.x + (g.other.x - g.hinge.x + (g.open.x - g.hinge.x)) / 2,
    y: g.hinge.y + (g.other.y - g.hinge.y + (g.open.y - g.hinge.y)) / 2,
  };
}
