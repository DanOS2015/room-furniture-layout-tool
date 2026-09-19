import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  measuredLayout,
  nid,
  presetState,
  type Breast,
  type Door,
  type Item,
  type Layout,
  type PresetSpec,
  type Rad,
  type Room,
  type RoomPreset,
} from "./model";
import { corners, hit, insideRoom, isL, tuckIntoCorner, verts } from "./geometry";
import { doorZone, fixtures } from "./fixtures";
import { computeProblems } from "./problems";
import { loadLocal, saveLocal } from "./persist";
import { Plan } from "./components/Plan";
import { Section } from "./components/Section";
import { StatusPanel } from "./components/StatusPanel";
import { SelectedPanel } from "./components/SelectedPanel";
import { AddFurniture } from "./components/AddFurniture";
import { RoomShape } from "./components/RoomShape";
import { FixturesPanel } from "./components/FixturesPanel";
import { DoorwayCheck } from "./components/DoorwayCheck";
import { SaveLoad } from "./components/SaveLoad";

type Action =
  | { type: "replace"; layout: Layout }
  | { type: "select"; id: string | null }
  | { type: "clearance"; value: number }
  | { type: "room"; patch: Partial<Room> }
  | { type: "roomPreset"; preset: RoomPreset }
  | { type: "breast"; patch: Partial<Breast> }
  | { type: "rad"; patch: Partial<Rad> }
  | { type: "door"; patch: Partial<Door> }
  | { type: "item"; id: string; patch: Partial<Item> }
  | { type: "add"; item: Item }
  | { type: "remove"; id: string };

function reducer(s: Layout, a: Action): Layout {
  switch (a.type) {
    case "replace":
      return a.layout;
    case "select":
      return { ...s, sel: a.id };
    case "clearance":
      return { ...s, clearance: a.value };
    case "room":
      return { ...s, room: { ...s.room, ...a.patch } };
    // Loading a saved room swaps the walls and fixtures only - the furniture
    // stays put, so the same pieces can be tried against another room.
    case "roomPreset":
      return { ...s, ...presetState(a.preset) };
    case "breast":
      return { ...s, breast: { ...s.breast, ...a.patch } };
    case "rad":
      return { ...s, rad: { ...s.rad, ...a.patch } };
    case "door":
      return { ...s, door: { ...s.door, ...a.patch } };
    case "item":
      return { ...s, items: s.items.map((it) => (it.id === a.id ? { ...it, ...a.patch } : it)) };
    case "add":
      return { ...s, items: [...s.items, a.item], sel: a.item.id };
    case "remove":
      return { ...s, items: s.items.filter((it) => it.id !== a.id), sel: s.sel === a.id ? null : s.sel };
  }
}

/** Drop a new piece somewhere sensible: corners go in a corner, the rest mid-room. */
function place(spec: PresetSpec, layout: Layout): Item {
  const v = verts(layout.room);
  const W = Math.max(...v.map((p) => p.x));
  const D = Math.max(...v.map((p) => p.y));
  const item: Item = { rot: 0, ...spec, id: nid(), x: W / 2, y: D / 2 };

  if (item.shape === "corner") {
    const blockers = [...layout.items, ...fixtures(layout), doorZone(layout)];
    const tried: Item[] = [];
    for (const c of corners(layout.room)) {
      const placed = tuckIntoCorner(item, layout.room, c.index);
      if (!placed) continue;
      const cand = { ...item, ...placed };
      if (!insideRoom(cand, layout.room)) continue;
      tried.push(cand);
      if (!blockers.some((b) => hit(cand, b))) return cand;
    }
    if (tried.length) return tried[0];
  }

  let tries = 0;
  while (!insideRoom(item, layout.room) && tries < 60) {
    item.x = W * 0.25 + Math.random() * W * 0.5;
    item.y = D * 0.25 + Math.random() * D * 0.5;
    tries++;
  }
  return item;
}

export default function App() {
  const [layout, dispatch] = useReducer(reducer, undefined, () => loadLocal() ?? measuredLayout());
  const [message, setMessage] = useState("Saves automatically as you work.");
  const [error, setError] = useState<string | null>(null);
  const restored = useRef(loadLocal() !== null);

  useEffect(() => {
    if (restored.current) setMessage("Picked up where you left off.");
  }, []);

  // Autosave, debounced, matching the feel of the original.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        saveLocal(layout);
        setMessage("Saved " + new Date().toLocaleTimeString());
      } catch {
        setMessage("Couldn't save to this browser — the layout still works until you close the tab.");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [layout]);

  const problems = useMemo(() => computeProblems(layout), [layout]);
  const selected = layout.items.find((i) => i.id === layout.sel) ?? null;

  const patchItem = useCallback((id: string, patch: Partial<Item>) => dispatch({ type: "item", id, patch }), []);

  // Keyboard nudging, rotation and chaise flip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const it = layout.items.find((i) => i.id === layout.sel);
      if (!it) return;
      const tag = document.activeElement?.tagName ?? "";
      if (/input|select|textarea/i.test(tag)) return;
      const s = e.shiftKey ? 100 : 10;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-s, 0],
        ArrowRight: [s, 0],
        ArrowUp: [0, -s],
        ArrowDown: [0, s],
      };
      if (moves[e.key]) {
        e.preventDefault();
        patchItem(it.id, { x: it.x + moves[e.key][0], y: it.y + moves[e.key][1] });
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "r") patchItem(it.id, { rot: ((it.rot || 0) + 90) % 360 });
      if (k === "f" && isL(it)) patchItem(it.id, { chaiseSide: it.chaiseSide === "right" ? "left" : "right" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [layout, patchItem]);

  return (
    <div className="wrap">
      <header>
        <h1>Fit check — living room</h1>
        <p>
          Plan is drawn to scale and always fills the width, so changing a wall length shows up in the numbers and in
          how big the furniture looks, not in the size of the outline.
        </p>
      </header>

      <Plan
        layout={layout}
        problems={problems}
        onSelect={(id) => dispatch({ type: "select", id })}
        onMove={(id, x, y) => patchItem(id, { x, y })}
        onDragEnd={() => {}}
      />

      {error && <div className="err">{error}</div>}

      <StatusPanel problems={problems} empty={layout.items.length === 0} />

      {selected ? (
        <SelectedPanel
          key={selected.id}
          layout={layout}
          item={selected}
          onPatch={(patch) => patchItem(selected.id, patch)}
          onDuplicate={() => dispatch({ type: "add", item: { ...selected, id: nid(), x: selected.x + 300, y: selected.y + 300 } })}
          onRemove={() => dispatch({ type: "remove", id: selected.id })}
        />
      ) : (
        <div className="sel">
          <p className="empty">Tap a piece on the plan to move, turn or resize it.</p>
        </div>
      )}

      <Section title="Add furniture" defaultOpen>
        <AddFurniture
          layout={layout}
          onAdd={(spec) => dispatch({ type: "add", item: place(spec, layout) })}
          onSelect={(id) => dispatch({ type: "select", id })}
        />
      </Section>

      <Section title="Room shape">
        <RoomShape
          layout={layout}
          onRoom={(patch) => dispatch({ type: "room", patch })}
          onClearance={(value) => dispatch({ type: "clearance", value })}
          onPreset={(preset) => {
            dispatch({ type: "roomPreset", preset });
            setMessage(`Loaded ${preset.name}.`);
          }}
        />
      </Section>

      <Section title="Fireplace, radiator and door">
        <FixturesPanel
          layout={layout}
          onBreast={(patch) => dispatch({ type: "breast", patch })}
          onRad={(patch) => dispatch({ type: "rad", patch })}
          onDoor={(patch) => dispatch({ type: "door", patch })}
        />
      </Section>

      <Section title="Getting it in the door">
        <DoorwayCheck layout={layout} />
      </Section>

      <Section title="Saving">
        <SaveLoad
          layout={layout}
          message={message}
          onLoaded={(l) => {
            setError(null);
            dispatch({ type: "replace", layout: l });
            setMessage("Layout imported.");
          }}
          onError={setError}
          onReset={() => {
            setError(null);
            dispatch({ type: "replace", layout: measuredLayout() });
            setMessage("Back to the room and couch as measured.");
          }}
        />
      </Section>
    </div>
  );
}
