import { describe, expect, it } from "vitest";
import { LIVING_ROOM, MEASURED, type Footprint } from "./model";
import { cornerOverhang, gapToWall, insideRoom, localPolys, minDist, tuckIntoCorner, wallRunOf, walls } from "./geometry";
import { doorGeom, fixtures } from "./fixtures";

const rect = (w: number, d: number, x: number, y: number, rot = 0): Footprint => ({ w, d, x, y, rot, shape: "rect" });

describe("minDist", () => {
  // The regression test for the old expandPoly() bug: it inflated a long thin
  // rectangle by ~+703 mm sideways and only +261 mm front-to-back for the same
  // 750 mm walkway. The true clearance has to be 750 on both axes.
  const sofa = rect(2770, 1030, 0, 0);

  it("measures the same gap along the long axis as the short one", () => {
    const front = rect(1100, 600, 0, 1030 / 2 + 750 + 600 / 2);
    const side = rect(600, 1100, 2770 / 2 + 750 + 600 / 2, 0);
    expect(minDist(sofa, front)).toBeCloseTo(750, 6);
    expect(minDist(sofa, side)).toBeCloseTo(750, 6);
  });

  it("returns 0 for overlapping pieces", () => {
    expect(minDist(sofa, rect(500, 500, 0, 0))).toBe(0);
  });

  it("handles rotation", () => {
    const turned = rect(2770, 1030, 0, 0, 90);
    expect(minDist(turned, rect(600, 600, 1030 / 2 + 400 + 300, 0))).toBeCloseTo(400, 6);
  });
});

describe("insideRoom", () => {
  it("accepts the measured couch and rejects it once pushed through a wall", () => {
    const couch = MEASURED.items[0];
    expect(insideRoom(couch, MEASURED.room)).toBe(true);
    expect(insideRoom({ ...couch, x: -500 }, MEASURED.room)).toBe(false);
  });
});

describe("corner units", () => {
  const unit: Footprint = { w: 1200, d: 620, x: 0, y: 0, rot: 0, shape: "corner", wallRun: 780 };

  it("keeps the stated wall run when it is within bounds", () => {
    expect(wallRunOf(unit)).toBeCloseTo(780, 6);
  });

  it("sits 20 mm off both walls when tucked into a corner", () => {
    const placed = tuckIntoCorner(unit, MEASURED.room, 1);
    expect(placed).not.toBeNull();
    const sat = { ...unit, ...placed! };
    const ws = walls(MEASURED.room);
    // Corner 1 is where wall 0 (top) meets wall 1 (right).
    expect(gapToWall(sat, ws[0])).toBeCloseTo(20, 1);
    expect(gapToWall(sat, ws[1])).toBeCloseTo(20, 1);
  });

  it("flags a front that is too wide for its depth to fit a square corner", () => {
    expect(cornerOverhang(unit)).toBe(0);
    expect(cornerOverhang({ ...unit, d: 400 })).toBeGreaterThan(0);
  });
});

describe("L-shapes", () => {
  const couch: Footprint = { w: 2770, d: 1610, x: 0, y: 0, rot: 0, shape: "L", bodyD: 1030, chaiseW: 950, chaiseSide: "left" };

  it("is a body plus a chaise leg, not a solid block", () => {
    const [body, chaise] = localPolys(couch);
    expect(area(body)).toBeCloseTo(2770 * 1030, 6);
    expect(area(chaise)).toBeCloseTo(950 * (1610 - 1030), 6);
    // Nothing like the 2770 x 1610 bounding box it gets labelled with.
    expect(area(body) + area(chaise)).toBeLessThan(2770 * 1610);
  });

  it("mirrors the chaise when flipped", () => {
    const left = localPolys(couch)[1];
    const right = localPolys({ ...couch, chaiseSide: "right" })[1];
    expect(centroidX(right)).toBeCloseTo(-centroidX(left), 6);
  });
});

const area = (P: number[][]) =>
  Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

const centroidX = (P: number[][]) => P.reduce((s, p) => s + p[0], 0) / P.length;

describe("the measured living room", () => {
  const w = walls(MEASURED.room);

  it("is a five-sided room whose angled wall matches the tape", () => {
    expect(w).toHaveLength(5);
    // Walls 0..4: fireplace, right, door, radiator, window.
    expect(w.map((x) => Math.round(x.len))).toEqual([4290, 2890, 1245, 3163, 3420]);
  });

  it("leaves the fireplace the gaps that were measured either side of it", () => {
    const { room, breast } = LIVING_ROOM;
    expect(breast.x).toBe(1445); // to the window wall
    expect(room.top - breast.x - breast.w).toBe(1460); // to the right wall
  });

  it("sets the radiator off the window wall by the measured 720", () => {
    const { rad } = LIVING_ROOM;
    expect(rad.x).toBe(720);
    expect(rad.len + rad.d).toBe(2045 + 130);
  });

  it("fits the 864 mm door leaf on the angled wall with room for a frame", () => {
    const g = doorGeom(MEASURED);
    expect(g.width).toBe(864);
    expect(g.wall.len - g.width).toBeGreaterThan(300);
  });

  it("keeps the fireplace, radiator, door swing and couch inside the walls", () => {
    for (const f of [...fixtures(MEASURED), MEASURED.items[0]]) {
      expect(insideRoom(f, MEASURED.room)).toBe(true);
    }
  });
});
