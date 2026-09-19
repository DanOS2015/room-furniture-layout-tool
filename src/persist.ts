import { measuredLayout, nid, SCHEMA_VERSION, STORAGE_KEY, type Item, type Layout } from "./model";

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/**
 * Coerce anything that claims to be a layout into a usable one, falling back to
 * the measured room field by field. Throws only on input that is not a layout
 * at all, so a hand-edited or truncated file gives a readable message instead of
 * a blank screen.
 */
export function parseLayout(raw: unknown): Layout {
  if (!raw || typeof raw !== "object") throw new Error("that file does not contain a layout");
  const v = raw as Record<string, any>;
  if (!v.room || typeof v.room !== "object") throw new Error("no room dimensions in that file");

  const base = measuredLayout();
  const room = {
    top: num(v.room.top, base.room.top),
    right: num(v.room.right, base.room.right),
    bottom: num(v.room.bottom, base.room.bottom),
    left: num(v.room.left, base.room.left),
  };
  if (room.top <= 0 || room.left <= 0) throw new Error("the room dimensions in that file are not usable");

  const rawItems = Array.isArray(v.items) ? v.items : [];
  const items: Item[] = rawItems
    .filter((it: any) => it && typeof it === "object")
    .map((it: any) => ({
      id: typeof it.id === "string" && it.id ? it.id : nid(),
      name: typeof it.name === "string" && it.name ? it.name : "Piece",
      w: num(it.w, 1000),
      d: num(it.d, 500),
      h: num(it.h, 800),
      x: num(it.x, room.top / 2),
      y: num(it.y, room.left / 2),
      rot: num(it.rot, 0),
      cat: ["seat", "table", "store", "bed", "rug", "custom"].includes(it.cat) ? it.cat : "custom",
      shape: ["rect", "corner", "L"].includes(it.shape) ? it.shape : "rect",
      ...(it.bodyD !== undefined ? { bodyD: num(it.bodyD, 0) } : {}),
      ...(it.chaiseW !== undefined ? { chaiseW: num(it.chaiseW, 0) } : {}),
      ...(it.chaiseSide === "right" || it.chaiseSide === "left" ? { chaiseSide: it.chaiseSide } : {}),
      ...(it.wallRun !== undefined ? { wallRun: num(it.wallRun, 0) } : {}),
    }));

  const sel = typeof v.sel === "string" && items.some((i) => i.id === v.sel) ? v.sel : null;

  return {
    version: SCHEMA_VERSION,
    room,
    clearance: Math.max(0, num(v.clearance, base.clearance)),
    breast: {
      w: num(v.breast?.w, base.breast.w),
      d: num(v.breast?.d, base.breast.d),
      x: num(v.breast?.x, base.breast.x),
    },
    rad: {
      len: num(v.rad?.len, base.rad.len),
      d: num(v.rad?.d, base.rad.d),
      x: num(v.rad?.x, base.rad.x),
    },
    door: {
      w: num(v.door?.w, base.door.w),
      off: num(v.door?.off, base.door.off),
      hinge: v.door?.hinge === "end" ? "end" : "start",
    },
    items,
    sel,
  };
}

export function loadLocal(): Layout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocal(s: Layout): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function exportJson(s: Layout, filename = "living-room-layout.json"): void {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importJson(file: File): Promise<Layout> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("that file is not valid JSON");
  }
  return parseLayout(raw);
}
