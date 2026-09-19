import { useState } from "react";
import { COLORS, type ChaiseSide, type Item, type Layout } from "../model";
import {
  bodyDepth,
  chaiseWidth,
  corners,
  cornerOverhang,
  gapToWall,
  isCorner,
  isL,
  tuckIntoCorner,
  wallNames,
  wallRunOf,
  walls,
} from "../geometry";
import { wallReport } from "../problems";
import { NumberField } from "./NumberField";

interface Props {
  layout: Layout;
  item: Item;
  onPatch: (patch: Partial<Item>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function SelectedPanel({ layout, item: it, onPatch, onDuplicate, onRemove }: Props) {
  const names = wallNames(layout.room);
  const gaps = walls(layout.room)
    .map((w) => `${names[w.i]} ${Math.round(gapToWall(it, w))}`)
    .join(" · ");
  const L = isL(it);
  const corner = isCorner(it);
  const report = it.cat === "rug" || corner ? [] : wallReport(layout, it);
  const turn = (by: number) => onPatch({ rot: ((((it.rot || 0) + by) % 360) + 360) % 360 });

  return (
    <div className="sel">
      <h2>
        <span className="swatch" style={{ background: COLORS[it.cat] ?? COLORS.custom }} />
        {it.name}
      </h2>

      <div className="row">
        <NumberField label={L ? "Overall width" : "Width"} value={it.w} onChange={(w) => onPatch({ w })} min={50} />
        <NumberField label={L ? "Depth over chaise" : "Depth"} value={it.d} onChange={(d) => onPatch({ d })} min={50} />
        <NumberField label="Height" value={it.h} onChange={(h) => onPatch({ h })} min={10} />
        <NumberField
          label="Turn (°)"
          value={Math.round(it.rot || 0)}
          step={15}
          onChange={(rot) => onPatch({ rot })}
          normalise={(v) => ((v % 360) + 360) % 360}
        />
      </div>

      {L && <ChaiseControls item={it} onPatch={onPatch} />}
      {corner && <CornerControls layout={layout} item={it} onPatch={onPatch} />}

      <div className="chips">
        <button className="chip" onClick={() => turn(-15)}>−15°</button>
        <button className="chip" onClick={() => turn(15)}>+15°</button>
        <button className="chip" onClick={() => turn(90)}>Turn 90°</button>
        {L && (
          <button className="chip" onClick={() => onPatch({ chaiseSide: it.chaiseSide === "right" ? "left" : "right" })}>
            Flip the chaise
          </button>
        )}
        <button className="chip" onClick={onDuplicate}>Duplicate</button>
        <button className="chip" style={{ color: "var(--alert)" }} onClick={onRemove}>Remove</button>
      </div>

      <div className="mono">gap to walls, mm — {gaps}</div>

      {report.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="mono" style={{ marginBottom: 2 }}>Backed against each wall</div>
          {report.map((r, i) => (
            <div className="walltest" key={i}>
              <span className={r.ok ? "good" : "bad"}>
                {r.name}: {r.ok ? `fits${r.note}` : r.why}
              </span>
              {r.ok && (
                <button
                  className="ghost"
                  onClick={() =>
                    onPatch({
                      rot: r.place.rot,
                      x: r.place.x,
                      y: r.place.y,
                      ...(r.place.chaiseSide ? { chaiseSide: r.place.chaiseSide } : {}),
                    })
                  }
                >
                  Put it here
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChaiseControls({ item: it, onPatch }: { item: Item; onPatch: (p: Partial<Item>) => void }) {
  const bD = bodyDepth(it);
  const cW = chaiseWidth(it);
  const chaiseProjection = Math.max(0, it.d - bD);
  // The stored body depth, not the render-time clamp: bodyDepth() pulls the
  // value down to `d`, so reading it back while `d` is mid-edit would feed the
  // clamp into the next calculation.
  const storedBodyD = it.bodyD ?? bD;
  return (
    <fieldset>
      <legend>Chaise</legend>
      <div className="row" style={{ marginBottom: 0 }}>
        <NumberField label="Depth without chaise" value={storedBodyD} onChange={(bodyD) => onPatch({ bodyD })} min={100} />
        <NumberField label="Chaise width" value={cW} onChange={(chaiseW) => onPatch({ chaiseW })} min={100} />
        <div className="f-wide">
          <label>Chaise on</label>
          <select value={it.chaiseSide ?? "left"} onChange={(e) => onPatch({ chaiseSide: e.target.value as ChaiseSide })}>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>
      <p className="hint">
        Main body {Math.round(it.w)} × {Math.round(bD)} mm, with the chaise adding {Math.round(cW)} mm across ×{" "}
        {Math.round(chaiseProjection)} mm deeper. Only that {Math.round(cW)} mm strip is {Math.round(it.d)} mm deep — the
        rest of the sofa is {Math.round(bD)} mm.
      </p>
      {chaiseProjection < 300 && (
        <p className="hint warn">
          A chaise projecting only {Math.round(chaiseProjection)} mm is barely a chaise — worth double-checking "depth
          over chaise". Retailer diagrams usually quote the chaise <em>seat</em> length rather than the total depth. If
          yours does, fill in the two seat numbers below and it will be worked out for you.
        </p>
      )}
      <FromDiagram bodyD={storedBodyD} openByDefault={chaiseProjection < 300} onDepth={(d) => onPatch({ d })} />
      <p className="hint">
        Left and right are as you look down on the plan, before you turn the piece. Use "Flip the chaise" to swap it
        without changing anything else.
      </p>
    </fieldset>
  );
}

/**
 * Works "depth over chaise" out from the numbers a retailer diagram actually
 * prints. Those diagrams give *seat* depths, which exclude the backrest, so the
 * chaise seat length alone is 30-40 cm short of the real footprint:
 *
 *   backrest        = body depth − main seat depth
 *   depth over chaise = chaise seat length + backrest
 *
 * The body depth is already on file as "Depth without chaise", so only the two
 * seat numbers are needed.
 */
function FromDiagram({ bodyD, openByDefault, onDepth }: { bodyD: number; openByDefault: boolean; onDepth: (d: number) => void }) {
  const [seat, setSeat] = useState("");
  const [chaiseSeat, setChaiseSeat] = useState("");

  const seatN = parseFloat(seat);
  const chaiseN = parseFloat(chaiseSeat);
  const back = Number.isFinite(seatN) ? bodyD - seatN : null;
  const total = back !== null && Number.isFinite(chaiseN) ? chaiseN + back : null;

  // Applied as you type, so there is no arithmetic and no extra button to press.
  const apply = (s: string, c: string) => {
    const sn = parseFloat(s);
    const cn = parseFloat(c);
    if (!Number.isFinite(sn) || !Number.isFinite(cn)) return;
    const t = cn + (bodyD - sn);
    if (t > 0) onDepth(Math.round(t));
  };

  return (
    <details open={openByDefault} style={{ borderTop: "none", padding: "6px 0 0" }}>
      <summary style={{ fontSize: 12.5, fontWeight: 400, color: "var(--ink-soft)" }}>
        Work "depth over chaise" out from a retailer diagram
      </summary>
      <div className="body">
        <p className="hint" style={{ margin: "0 0 8px" }}>
          Diagrams print seat depths, which leave out the backrest. Enter the two seat measurements and the depth over
          the chaise is filled in for you.
        </p>
        <div className="row" style={{ marginBottom: 0 }}>
          <div className="f">
            <label htmlFor="dgSeat">Seat depth, main sofa</label>
            <input
              id="dgSeat"
              type="number"
              step={10}
              placeholder="e.g. 580"
              value={seat}
              onChange={(e) => {
                setSeat(e.target.value);
                apply(e.target.value, chaiseSeat);
              }}
            />
          </div>
          <div className="f">
            <label htmlFor="dgChaise">Chaise seat length</label>
            <input
              id="dgChaise"
              type="number"
              step={10}
              placeholder="e.g. 1190"
              value={chaiseSeat}
              onChange={(e) => {
                setChaiseSeat(e.target.value);
                apply(seat, e.target.value);
              }}
            />
          </div>
        </div>
        {back !== null && back <= 0 ? (
          <p className="hint bad">
            The seat can't be deeper than the sofa — check "Depth without chaise" ({Math.round(bodyD)} mm) against the
            seat depth you entered.
          </p>
        ) : total !== null ? (
          <p className="hint">
            Backrest {Math.round(bodyD)} − {Math.round(seatN)} = {Math.round(back!)} mm, so depth over chaise{" "}
            {Math.round(chaiseN)} + {Math.round(back!)} = <strong>{Math.round(total)} mm</strong>. Filled in above.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function CornerControls({ layout, item: it, onPatch }: { layout: Layout; item: Item; onPatch: (p: Partial<Item>) => void }) {
  const run = wallRunOf(it);
  const overhang = cornerOverhang(it);
  const opts = corners(layout.room);
  return (
    <fieldset>
      <legend>Corner unit</legend>
      <div className="row" style={{ marginBottom: 0 }}>
        <NumberField label="Wall run (each side)" value={Math.round(run)} onChange={(wallRun) => onPatch({ wallRun })} min={100} />
        <div className="f-wide">
          <label>Tuck into</label>
          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const placed = tuckIntoCorner(it, layout.room, Number(e.target.value));
              if (placed) onPatch(placed);
            }}
          >
            <option value="">choose a corner</option>
            {opts.map((c) => (
              <option key={c.index} value={c.index}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="hint">
        Front face {Math.round(it.w)} mm wide, {Math.round(it.d)} mm from the corner, sitting {Math.round(run)} mm along
        each wall. Picking a corner drops it in with both backs 20 mm off the walls.
      </p>
      {overhang > 1 && (
        <p className="hint bad">
          At {Math.round(it.d)} mm deep the front is {Math.round(overhang)} mm too wide to fit a square corner — a true
          corner unit is at most twice as wide as it is deep, so this one needs a depth of at least{" "}
          {Math.round(it.w / 2)} mm.
        </p>
      )}
    </fieldset>
  );
}
