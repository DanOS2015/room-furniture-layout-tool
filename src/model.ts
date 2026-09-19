export type Cat = "seat" | "table" | "store" | "bed" | "rug" | "custom";
export type Shape = "rect" | "corner" | "L";
export type ChaiseSide = "left" | "right";

export interface Pt {
  x: number;
  y: number;
}

/**
 * The minimum an object needs for the geometry helpers to place, draw and
 * collide it. Fixtures (fireplace, radiator, door swing) are footprints too,
 * which is why the collision code never asks for an `Item`.
 */
export interface Footprint {
  w: number;
  d: number;
  x: number;
  y: number;
  rot: number;
  shape?: Shape;
  /** L-shape: depth of the main body, i.e. the depth away from the chaise. */
  bodyD?: number;
  /** L-shape: width of the chaise leg. */
  chaiseW?: number;
  chaiseSide?: ChaiseSide;
  /** Corner unit: how far each rear edge runs along its wall. */
  wallRun?: number;
}

export interface Item extends Footprint {
  id: string;
  name: string;
  h: number;
  cat: Cat;
  shape: Shape;
}

export interface Room {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export interface Breast {
  w: number;
  d: number;
  x: number;
}
export interface Rad {
  len: number;
  d: number;
  x: number;
}
export interface Door {
  w: number;
  off: number;
  hinge: "start" | "end";
}

export interface Layout {
  version: number;
  room: Room;
  clearance: number;
  breast: Breast;
  rad: Rad;
  door: Door;
  items: Item[];
  sel: string | null;
}

export const SCHEMA_VERSION = 2;
// Bumped with the re-measured living room: a browser holding a v3 layout would
// otherwise keep showing the old walls, with no hint that better numbers exist.
export const STORAGE_KEY = "roomfit:livingroom:v4";

export const COLORS: Record<Cat, string> = {
  seat: "#35657f",
  table: "#8a6a3b",
  store: "#5c5470",
  bed: "#3f6b52",
  rug: "#b9c2c8",
  custom: "#35657f",
};

export type PresetSpec = Omit<Item, "id" | "x" | "y" | "rot"> & { rot?: number };

/**
 * Corner units: `w` is the front width, `d` the depth from the corner apex to
 * the front face, `wallRun` how far each rear edge lies along its wall. A true
 * 90-degree corner unit can be at most twice as wide as it is deep (the pure
 * triangle case) - see cornerOverhang() in geometry.ts.
 */
export const PRESETS: PresetSpec[] = [
  { name: "Chaise couch 277×161", w: 2770, d: 1610, h: 870, cat: "seat", shape: "L", bodyD: 1030, chaiseW: 950, chaiseSide: "left" },
  { name: "Chaise couch, small 240×155", w: 2400, d: 1550, h: 850, cat: "seat", shape: "L", bodyD: 950, chaiseW: 900, chaiseSide: "left" },
  { name: "Corner sofa 260×220", w: 2600, d: 2200, h: 850, cat: "seat", shape: "L", bodyD: 950, chaiseW: 950, chaiseSide: "left" },
  { name: "3-seat sofa", w: 2100, d: 950, h: 850, cat: "seat", shape: "rect" },
  { name: "2-seat sofa", w: 1600, d: 900, h: 850, cat: "seat", shape: "rect" },
  { name: "4-seat sofa", w: 2500, d: 980, h: 850, cat: "seat", shape: "rect" },
  { name: "Armchair", w: 850, d: 900, h: 850, cat: "seat", shape: "rect" },
  { name: "Footstool", w: 700, d: 500, h: 420, cat: "seat", shape: "rect" },
  { name: "Coffee table", w: 1100, d: 600, h: 420, cat: "table", shape: "rect" },
  { name: "Side table", w: 450, d: 450, h: 550, cat: "table", shape: "rect" },
  { name: "TV unit", w: 1400, d: 400, h: 500, cat: "store", shape: "rect" },
  { name: "TV unit, narrow", w: 1200, d: 400, h: 500, cat: "store", shape: "rect" },
  { name: "TV stand, corner 100cm", w: 1000, d: 520, h: 510, cat: "store", shape: "corner", wallRun: 650 },
  { name: "TV stand, corner 120cm", w: 1200, d: 620, h: 510, cat: "store", shape: "corner", wallRun: 780 },
  { name: "TV stand, corner 150cm", w: 1500, d: 780, h: 550, cat: "store", shape: "corner", wallRun: 980 },
  { name: "Bookcase", w: 800, d: 300, h: 1800, cat: "store", shape: "rect" },
  { name: "Sideboard", w: 1600, d: 450, h: 800, cat: "store", shape: "rect" },
  { name: "Rug 230×160", w: 2300, d: 1600, h: 10, cat: "rug", shape: "rect" },
  { name: "Rug 200×140", w: 2000, d: 1400, h: 10, cat: "rug", shape: "rect" },
];

export interface RoomPreset {
  id: string;
  name: string;
  /** Where the numbers came from, shown under the dropdown. */
  note: string;
  room: Room;
  breast: Breast;
  rad: Rad;
  door: Door;
}

/**
 * Rooms measured on site, ready to load into the editor.
 *
 * A room is over-determined: four wall lengths fix the pentagon and the fifth,
 * angled door wall falls out of them. Tape measurements never agree to the
 * millimetre, so each preset records the walls that were measured most reliably
 * and lets the least reliable one absorb the difference - see the note.
 */
export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: "living-room",
    name: "Living room",
    note:
      "Measured on site, cross-checked against the architect's plan. The radiator wall is the one derived figure: " +
      "the tape read 3445 (720 + 2045 + 680) but that would force the door wall down to 998 mm, too short for an " +
      "864 mm door. 3163 makes the door wall the 1245 mm that was measured, and sits close to the plan's 3255. " +
      "The radiator is pinned by its 720 mm gap to the window wall, so its gap to the door wall reads 398 rather " +
      "than the 680 measured into that splayed corner.",
    // Top = fireplace wall, right = the short "top" wall the door opens back onto,
    // bottom = radiator wall, left = window wall. The door wall joins right to bottom.
    room: { top: 4290, right: 2890, bottom: 3163, left: 3420 },
    breast: { w: 1385, d: 380, x: 1445 },
    rad: { len: 2045, d: 130, x: 720 },
    // 34" leaf, hinged at the top-wall end and swinging back against it: 2890 - 864
    // leaves the 2090 mm of clear wall that was measured with the door open.
    door: { w: 864, off: 0, hinge: "start" },
  },
];

export const LIVING_ROOM = ROOM_PRESETS[0];

/** Everything a preset sets; the furniture on top of it is the user's own. */
export type RoomState = Pick<Layout, "room" | "breast" | "rad" | "door">;

export const presetState = (p: RoomPreset): RoomState => ({
  room: { ...p.room },
  breast: { ...p.breast },
  rad: { ...p.rad },
  door: { ...p.door },
});

/**
 * The preset the current layout is still sitting on, if any, so the dropdown can
 * show "Living room" until a wall is nudged and then fall back to "Custom room".
 * Compared field by field rather than by JSON, which would also compare key order.
 */
export function matchingPreset(s: RoomState): RoomPreset | null {
  const same = <T extends object>(a: T, b: T) => (Object.keys(a) as (keyof T)[]).every((k) => a[k] === b[k]);
  return (
    ROOM_PRESETS.find(
      (p) => same(p.room, s.room) && same(p.breast, s.breast) && same(p.rad, s.rad) && same(p.door, s.door),
    ) ?? null
  );
}

/** The room as actually measured, and the starting point for "Back to measured room". */
export const MEASURED: Layout = {
  version: SCHEMA_VERSION,
  room: { ...LIVING_ROOM.room },
  clearance: 750,
  breast: { ...LIVING_ROOM.breast },
  rad: { ...LIVING_ROOM.rad },
  door: { ...LIVING_ROOM.door },
  items: [
    {
      id: "seed",
      name: "Chaise couch",
      w: 2770,
      d: 1610,
      h: 870,
      cat: "seat",
      shape: "L",
      bodyD: 1030,
      chaiseW: 950,
      chaiseSide: "left",
      rot: 270,
      // Backed onto the window wall, in the 2910 mm clear run between the
      // fireplace breast and the radiator.
      x: 805,
      y: 1765,
    },
  ],
  sel: "seed",
};

export const measuredLayout = (): Layout => JSON.parse(JSON.stringify(MEASURED)) as Layout;

let uid = 1;
export const nid = (prefix = "i") => prefix + uid++ + Math.random().toString(36).slice(2, 5);
