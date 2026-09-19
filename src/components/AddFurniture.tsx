import { useState } from "react";
import { PRESETS, type ChaiseSide, type Item, type Layout, type PresetSpec, type Shape } from "../model";
import { isL } from "../geometry";
import { NumberField } from "./NumberField";

interface Props {
  layout: Layout;
  onAdd: (spec: Omit<Item, "id" | "x" | "y" | "rot"> & { rot?: number }) => void;
  onSelect: (id: string) => void;
}

export function AddFurniture({ layout, onAdd, onSelect }: Props) {
  const [preset, setPreset] = useState(0);
  const [name, setName] = useState("");
  const [shape, setShape] = useState<Shape>("rect");
  const [w, setW] = useState(2100);
  const [d, setD] = useState(950);
  const [h, setH] = useState(850);
  const [bodyD, setBodyD] = useState(1030);
  const [chaiseW, setChaiseW] = useState(950);
  const [chaiseSide, setChaiseSide] = useState<ChaiseSide>("left");
  const [wallRun, setWallRun] = useState(650);

  const addCustom = () => {
    const spec: PresetSpec = {
      name: name.trim() || "Custom piece",
      w,
      d,
      h,
      cat: "custom",
      shape,
      ...(shape === "L" ? { bodyD, chaiseW, chaiseSide } : {}),
      ...(shape === "corner" ? { wallRun } : {}),
    };
    onAdd(spec);
  };

  return (
    <>
      <div className="row">
        <div className="f-wide">
          <label htmlFor="preset">Preset</label>
          <select id="preset" value={preset} onChange={(e) => setPreset(Number(e.target.value))}>
            {PRESETS.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name} — {p.w}×{p.d}
              </option>
            ))}
          </select>
        </div>
        <button aria-label="Add preset" onClick={() => onAdd({ ...PRESETS[preset] })}>Add</button>
      </div>

      <fieldset>
        <legend>Custom piece</legend>
        <div className="row">
          <div className="f-wide">
            <label htmlFor="cName">Name</label>
            <input id="cName" type="text" placeholder="e.g. the couch" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="f-wide">
            <label htmlFor="cShape">Shape</label>
            <select id="cShape" value={shape} onChange={(e) => setShape(e.target.value as Shape)}>
              <option value="rect">Rectangle</option>
              <option value="corner">Corner unit</option>
              <option value="L">L-shape / chaise</option>
            </select>
          </div>
        </div>
        <div className="row">
          <NumberField label={shape === "L" ? "Overall width" : shape === "corner" ? "Front width" : "Width"} value={w} onChange={setW} min={50} />
          <NumberField label={shape === "L" ? "Depth over chaise" : shape === "corner" ? "Depth from corner" : "Depth"} value={d} onChange={setD} min={50} />
          <NumberField label="Height" value={h} onChange={setH} min={10} />
          {shape === "rect" && <button aria-label="Add custom piece" onClick={addCustom}>Add</button>}
        </div>

        {shape === "L" && (
          <div className="row">
            <NumberField label="Depth without chaise" value={bodyD} onChange={setBodyD} min={100} />
            <NumberField label="Chaise width" value={chaiseW} onChange={setChaiseW} min={100} />
            <div className="f-wide">
              <label htmlFor="cSide">Chaise on</label>
              <select id="cSide" value={chaiseSide} onChange={(e) => setChaiseSide(e.target.value as ChaiseSide)}>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
            <button aria-label="Add custom piece" onClick={addCustom}>Add</button>
          </div>
        )}

        {shape === "corner" && (
          <div className="row">
            <NumberField label="Wall run (each side)" value={wallRun} onChange={setWallRun} min={100} />
            <button aria-label="Add custom piece" onClick={addCustom}>Add</button>
          </div>
        )}

        <p className="hint">
          {shape === "rect" && "Width runs left–right before you turn it. Height is only used for the doorway check."}
          {shape === "L" &&
            "Overall width is the whole sofa; depth over chaise is measured at the deepest point, over the chaise leg only."}
          {shape === "corner" &&
            "Front width is the face the screen sits on; depth is from the corner apex to that face; wall run is how far each back edge lies along its wall. Corner pieces drop into a corner automatically when added."}
        </p>
      </fieldset>

      <div className="list">
        {layout.items.length === 0 ? (
          <div style={{ border: 0 }}>
            <span className="mono">No pieces yet</span>
          </div>
        ) : (
          layout.items.map((it) => (
            <div key={it.id}>
              <span>
                {it.name}
                {isL(it) ? " (L)" : it.shape === "corner" ? " (corner)" : ""}
              </span>
              <span className="mono">
                {Math.round(it.w)}×{Math.round(it.d)}×{Math.round(it.h)}
              </span>
              <button className="ghost" onClick={() => onSelect(it.id)}>
                Select
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
