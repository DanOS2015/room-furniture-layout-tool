import type { Item, Layout } from "./model";
import {
  backedOn,
  bodyDepth,
  chaiseWidth,
  gapToWall,
  hit,
  insideRoom,
  isCorner,
  isL,
  minDist,
  wallNames,
  walls,
} from "./geometry";
import { doorZone, fixtures } from "./fixtures";

export interface Problems {
  byId: Record<string, true>;
  errors: string[];
  warns: string[];
}

export function computeProblems(s: Layout): Problems {
  const byId: Record<string, true> = {};
  const errors: string[] = [];
  const warns: string[] = [];
  const fx = fixtures(s);
  const dz = doorZone(s);

  for (const it of s.items) {
    if (!insideRoom(it, s.room)) {
      byId[it.id] = true;
      errors.push(`${it.name} goes through a wall`);
    }
    if (it.cat === "rug") continue;
    for (const f of fx) {
      if (!hit(it, f)) continue;
      if (f.id === "breast") {
        byId[it.id] = true;
        errors.push(`${it.name} clashes with the fireplace`);
      } else {
        warns.push(`${it.name} sits over the radiator`);
      }
    }
    if (hit(it, dz)) warns.push(`${it.name} is in the door's swing`);
    if (isCorner(it) && it.w > 2 * it.d) {
      warns.push(`${it.name} is wider than twice its depth, so its front corners cannot sit inside a square corner`);
    }
  }

  for (let i = 0; i < s.items.length; i++)
    for (let j = i + 1; j < s.items.length; j++) {
      const A = s.items[i];
      const B = s.items[j];
      if (A.cat === "rug" || B.cat === "rug") continue;
      if (hit(A, B)) {
        byId[A.id] = byId[B.id] = true;
        errors.push(`${A.name} overlaps ${B.name}`);
      }
    }

  const sel = s.items.find((i) => i.id === s.sel);
  if (sel && sel.cat !== "rug" && s.clearance > 0) {
    for (const it of s.items) {
      if (it.id === sel.id || it.cat === "rug") continue;
      const gap = minDist(sel, it);
      if (gap > 0 && gap < s.clearance) warns.push(`Only ${Math.round(gap)} mm between ${sel.name} and ${it.name}`);
    }
    const names = wallNames(s.room);
    for (const w of walls(s.room)) {
      const g = Math.round(gapToWall(sel, w));
      if (g > 2 && g < s.clearance) warns.push(`Only ${g} mm between ${sel.name} and the ${names[w.i].toLowerCase()} wall`);
    }
  }

  return { byId, errors: [...new Set(errors)], warns: [...new Set(warns)] };
}

/* ------------------------------------------------------------------ *
 * "Backed against each wall" report
 * ------------------------------------------------------------------ */

export interface WallTest {
  name: string;
  ok: boolean;
  why?: string;
  place: Item;
  note: string;
}

function whyNot(s: Layout, candidate: Item, original: Item, wallLen: number): string | null {
  if (original.w > wallLen + 1) return `wall is only ${Math.round(wallLen)} mm long`;
  if (!insideRoom(candidate, s.room)) return "the room's corners get in the way";
  for (const f of fixtures(s)) if (f.id !== "rad" && hit(candidate, f)) return `hits the ${f.name.toLowerCase()}`;
  for (const o of s.items) if (o.id !== original.id && o.cat !== "rug" && hit(candidate, o)) return `hits the ${o.name.toLowerCase()}`;
  if (hit(candidate, doorZone(s))) return "blocks the door";
  return null;
}

export function wallReport(s: Layout, it: Item): WallTest[] {
  const names = wallNames(s.room);
  return walls(s.room).map((w) => {
    const sides: (("left" | "right") | undefined)[] = isL(it) ? ["left", "right"] : [undefined];
    let best: { ok: boolean; why?: string; place: Item; side?: "left" | "right" } | null = null;
    for (const side of sides) {
      const place = backedOn(it, w, side);
      const why = whyNot(s, place, it, w.len);
      if (!why) {
        best = { ok: true, place, side };
        break;
      }
      if (!best) best = { ok: false, why, place, side };
    }
    const b = best!;
    const note = b.ok && b.side ? ` (chaise ${b.side === "left" ? "at the start" : "at the end"} of the wall)` : "";
    return { name: names[w.i], ok: b.ok, why: b.why, place: b.place, note };
  });
}

/* ------------------------------------------------------------------ *
 * Getting it in the door
 * ------------------------------------------------------------------ */

export interface AccessLine {
  label: string;
  cls: "good" | "warn" | "bad";
  smallest: [number, number];
  verdict: string;
}

function line(label: string, w: number, d: number, h: number, oW: number, oH: number): AccessLine {
  const s = [w, d, h].sort((a, b) => a - b);
  const ok = s[0] <= oW && s[1] <= oH;
  const tight = ok && oW - s[0] < 30;
  return {
    label,
    cls: !ok ? "bad" : tight ? "warn" : "good",
    smallest: [s[0], s[1]],
    verdict: !ok ? "will not go through" : tight ? "goes through with almost nothing spare" : "goes through",
  };
}

export function accessLines(s: Layout, oW: number, oH: number): AccessLine[] {
  const out: AccessLine[] = [];
  for (const it of s.items) {
    if (it.cat === "rug") continue;
    if (!isL(it)) {
      out.push(line(it.name, it.w, it.d, it.h, oW, oH));
      continue;
    }
    const bD = bodyDepth(it);
    const cW = chaiseWidth(it);
    const cd = it.d - bD;
    out.push(line(`${it.name}, in one piece`, it.w, it.d, it.h, oW, oH));
    out.push(line(`${it.name}, main section`, it.w, bD, it.h, oW, oH));
    out.push(line(`${it.name}, chaise section`, cW, cd > 0 ? cd : it.d, it.h, oW, oH));
  }
  return out;
}
