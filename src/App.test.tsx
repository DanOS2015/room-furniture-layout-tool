// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { STORAGE_KEY } from "./model";

// Without vitest globals, RTL does not register its own auto-cleanup, and every
// render would stack another copy of the app in the document.
afterEach(cleanup);

// jsdom has no SVG geometry engine; the plan only needs these to not throw.
beforeEach(() => {
  localStorage.clear();
  const proto = SVGSVGElement.prototype as unknown as Record<string, unknown>;
  proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) });
  proto.getScreenCTM = () => ({ inverse: () => ({}) });
});

const widthBox = () => within(document.querySelector(".sel")!).getByLabelText<HTMLInputElement>("Overall width");

describe("the selected-piece panel", () => {
  it("shows the measured couch on first load", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Chaise couch/ })).toBeTruthy();
    expect(widthBox().value).toBe("2770");
  });

  // The headline bug: the old tool clamped on every keystroke and rebuilt the
  // panel's innerHTML, so typing the "1" of "1000" snapped the box to 10 and
  // threw the caret away.
  it("lets a four-digit number be typed a character at a time", async () => {
    const user = userEvent.setup();
    render(<App />);
    const box = widthBox();
    await user.clear(box);
    await user.type(box, "1000");
    expect(widthBox().value).toBe("1000");
  });

  it("does not snap to the minimum part-way through typing", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.clear(widthBox());
    for (const [typed, expected] of [["2", "2"], ["5", "25"], ["0", "250"], ["0", "2500"]]) {
      await user.type(widthBox(), typed);
      expect(widthBox().value).toBe(expected);
    }
  });

  it("clamps only once the field is left", async () => {
    const user = userEvent.setup();
    render(<App />);
    const box = widthBox();
    await user.clear(box);
    await user.type(box, "1");
    expect(widthBox().value).toBe("1");
    await user.tab();
    expect(widthBox().value).toBe("50");
  });

  it("keeps 'Flip the chaise' but offers no shape converters", () => {
    render(<App />);
    const panel = within(document.querySelector(".sel")!);
    expect(panel.getByRole("button", { name: "Flip the chaise" })).toBeTruthy();
    expect(panel.queryByRole("button", { name: /Make this a corner unit/ })).toBeNull();
    expect(panel.queryByRole("button", { name: /Make this an L-shape/ })).toBeNull();
  });
});

describe("the walkway halo", () => {
  // Bug 3 at the render level: the halo is a stroke of width 2 x clearance with
  // round joins, which is the exact offset of the outline by a disc - so it is
  // the same 750 mm on every side. The old radial fudge drew +703 mm at the
  // sides and +261 mm front-to-back on this very sofa.
  it("is drawn as an even ring of exactly twice the walkway", () => {
    render(<App />);
    const haloes = [...document.querySelectorAll("path")].filter(
      (p) => Number(p.getAttribute("stroke-width")) > 100,
    );
    expect(haloes).toHaveLength(1);
    expect(haloes[0].getAttribute("stroke-width")).toBe("1500");
    expect(haloes[0].getAttribute("stroke-linejoin")).toBe("round");
  });
});

describe("chaise dimensions", () => {
  const depthBox = () => within(document.querySelector(".sel")!).getByLabelText<HTMLInputElement>("Depth over chaise");

  it("says nothing when the chaise projects a sensible amount", () => {
    render(<App />);
    // Seed couch: 1610 over the chaise on a 1030 body, so it projects 580 mm.
    expect(document.querySelector(".sel")!.textContent).toContain("580 mm deeper");
    expect(document.querySelector(".sel")!.textContent).not.toContain("barely a chaise");
  });

  // Entering the chaise *seat* length (as printed on most retailer diagrams)
  // instead of the total depth leaves a near-solid rectangle, which is what
  // made the sofa look far chunkier than its numbers.
  it("warns when the chaise is too shallow to be one", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.clear(depthBox());
    await user.type(depthBox(), "1100");
    expect(document.querySelector(".sel")!.textContent).toContain("barely a chaise");
  });

  // The real sofa that prompted this: 235 x 93 overall, 58 cm main seat,
  // 119 cm chaise seat. The chaise seat alone (1190) is 350 mm short.
  it("works the depth out from the two seat numbers on a diagram", async () => {
    const user = userEvent.setup();
    render(<App />);
    const panel = () => within(document.querySelector(".sel")!);

    await user.clear(panel().getByLabelText("Depth without chaise"));
    await user.type(panel().getByLabelText("Depth without chaise"), "930");
    await user.type(panel().getByLabelText("Seat depth, main sofa"), "580");
    await user.type(panel().getByLabelText("Chaise seat length"), "1190");

    expect(panel().getByLabelText<HTMLInputElement>("Depth over chaise").value).toBe("1540");
    expect(document.querySelector(".sel")!.textContent).toContain("610 mm deeper");
    expect(document.querySelector(".sel")!.textContent).not.toContain("barely a chaise");
  });
});

describe("plan labels", () => {
  it("stay the right way up on a turned piece", () => {
    render(<App />);
    // The seed couch sits at 270 degrees.
    const label = [...document.querySelectorAll("g[data-id] > g")].find((g) =>
      g.textContent?.startsWith("Chaise couch"),
    );
    expect(label!.getAttribute("transform")).toMatch(/^rotate\(-270 /);
  });
});

describe("corner units", () => {
  it("drops a corner preset straight into a free corner without clashing", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Preset"), [
      screen.getByRole("option", { name: /TV stand, corner 120cm/ }),
    ]);
    await user.click(screen.getByRole("button", { name: "Add preset" }));

    const panel = within(document.querySelector(".sel")!);
    expect(panel.getByRole("heading", { name: /TV stand, corner 120cm/ })).toBeTruthy();
    // Both back edges land on their walls, so two gaps read ~20 mm.
    const gaps = panel.getByText(/gap to walls/).textContent!;
    expect(gaps.match(/\b(19|20|21)\b/g)!.length).toBeGreaterThanOrEqual(2);
    expect(document.querySelector(".status")!.textContent).not.toContain("goes through a wall");
  });
});

describe("the page as a whole", () => {
  it("reports the couch as fitting rather than going through a wall", () => {
    render(<App />);
    expect(document.querySelector(".status")!.textContent).toContain("Everything fits");
  });

  it("has no 'Layouts to try' section", () => {
    render(<App />);
    expect(screen.queryByText(/Layouts to try/)).toBeNull();
  });

  it("persists to localStorage rather than window.storage", async () => {
    render(<App />);
    expect((window as unknown as { storage?: unknown }).storage).toBeUndefined();
    await new Promise((r) => setTimeout(r, 900));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.items[0].name).toBe("Chaise couch");
  });
});

describe("the saved-room dropdown", () => {
  const roomBox = () => screen.getByLabelText<HTMLSelectElement>("Room");
  // The room-shape panel, as opposed to the selected-piece panel above it.
  const shapePanel = () => within(screen.getByText(/Four wall lengths define the room/).closest("div")!);
  const wallBox = (name: string) => shapePanel().getByLabelText<HTMLInputElement>(name);

  it("opens on the living room as measured", () => {
    render(<App />);
    expect(roomBox().value).toBe("living-room");
    expect(screen.getByRole("option", { name: "Living room" })).toBeTruthy();
    expect(shapePanel().getByText(/Door wall/).textContent).toContain("Door wall 1245 mm");
  });

  it("falls back to 'Custom room' once a wall is edited, then loads back", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.clear(wallBox("Top wall"));
    await user.type(wallBox("Top wall"), "3000");
    await user.tab();
    expect(roomBox().value).toBe("");

    await user.selectOptions(roomBox(), [screen.getByRole("option", { name: "Living room" })]);
    expect(wallBox("Top wall").value).toBe("4290");
    expect(roomBox().value).toBe("living-room");
  });

  it("puts the fixtures back too, and leaves the furniture alone", async () => {
    const user = userEvent.setup();
    render(<App />);
    const radLen = () => screen.getByLabelText<HTMLInputElement>("Radiator length");

    await user.clear(radLen());
    await user.type(radLen(), "900");
    await user.tab();
    expect(roomBox().value).toBe("");

    await user.selectOptions(roomBox(), [screen.getByRole("option", { name: "Living room" })]);
    expect(radLen().value).toBe("2045");
    // The couch on the plan is the user's, not the preset's.
    expect(screen.getByRole("heading", { name: /Chaise couch/ })).toBeTruthy();
  });
});
