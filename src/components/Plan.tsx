import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Layout } from "../model";
import { gapToWall, insideRoom, polyPath, verts, walls } from "../geometry";
import { doorGeom, fixtures } from "../fixtures";
import type { Problems } from "../problems";
import { ItemHalo, PlanItem } from "./PlanItem";

/** How close a dragged piece has to get before it snaps flat against a wall. */
const SNAP_DIST = 80;

interface Props {
  layout: Layout;
  problems: Problems;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragEnd: () => void;
}

export function Plan({ layout, problems, onSelect, onMove, onDragEnd }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const v = verts(layout.room);
  const W = Math.max(...v.map((p) => p.x));
  const D = Math.max(...v.map((p) => p.y));
  const pad = Math.max(W, D) * 0.12 + 250;
  const U = Math.max(W, D) / 34;
  const roomPath = polyPath(v);
  const ws = walls(layout.room);
  const dg = doorGeom(layout);
  const area = Math.abs(v.reduce((s, p, i) => { const q = v[(i + 1) % v.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2 / 1e6;

  const gridX: number[] = [];
  for (let x = 500; x < W; x += 500) gridX.push(x);
  const gridY: number[] = [];
  for (let y = 500; y < D; y += 500) gridY.push(y);

  // Wall segments, with a gap left where the door opening is.
  const wallSegs = ws.flatMap((w) => {
    let segs: [number, number][] = [[0, w.len]];
    if (w.i === dg.wall.i) {
      const s = Math.hypot(dg.s.x - w.a.x, dg.s.y - w.a.y);
      segs = ([[0, s], [s + dg.width, w.len]] as [number, number][]).filter(([a, b]) => b - a > 1);
    }
    return segs.map(([s, e], k) => ({
      key: `${w.i}-${k}`,
      x1: w.a.x + w.u.x * s, y1: w.a.y + w.u.y * s,
      x2: w.a.x + w.u.x * e, y2: w.a.y + w.u.y * e,
    }));
  });

  const cross =
    (dg.open.x - dg.hinge.x) * (dg.other.y - dg.hinge.y) - (dg.open.y - dg.hinge.y) * (dg.other.x - dg.hinge.x);

  const toMm = (e: ReactPointerEvent) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM()!.inverse());
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    const target = e.target as Element;
    const g = target.closest ? target.closest("g[data-id]") : null;
    if (!g) {
      onSelect(null);
      return;
    }
    const id = (g as SVGGElement).dataset.id!;
    const it = layout.items.find((i) => i.id === id);
    if (!it) return;
    const p = toMm(e);
    drag.current = { id, dx: it.x - p.x, dy: it.y - p.y };
    try {
      svgRef.current!.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture is a nicety, not a requirement */
    }
    onSelect(id);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const dr = drag.current;
    if (!dr) return;
    e.preventDefault();
    const it = layout.items.find((i) => i.id === dr.id);
    if (!it) return;
    const p = toMm(e);
    let x = p.x + dr.dx;
    let y = p.y + dr.dy;

    // Snap to the single nearest wall. The old version looped over every wall
    // applying 0.9 of the gap each time, so it crept without ever arriving and
    // double-applied near a corner.
    const moved = { ...it, x, y };
    let best: { nx: number; ny: number; g: number } | null = null;
    for (const w of ws) {
      const g = gapToWall(moved, w);
      if (g < SNAP_DIST && (!best || g < best.g)) best = { nx: w.n.x, ny: w.n.y, g };
    }
    if (best && best.g > 1) {
      const step = best.g - 1;
      const cand = { ...moved, x: x - best.nx * step, y: y - best.ny * step };
      if (insideRoom(cand, layout.room)) {
        x = cand.x;
        y = cand.y;
      }
    }
    onMove(dr.id, x, y);
  };

  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    onDragEnd();
  };

  const ordered = [...layout.items].sort((a, b) => (a.cat === "rug" ? 0 : 1) - (b.cat === "rug" ? 0 : 1));
  const selected = layout.items.find((i) => i.id === layout.sel);
  const halo = selected && layout.clearance > 0 && selected.cat !== "rug" ? selected : null;

  return (
    <>
      <div className="sheet">
        <svg
          ref={svgRef}
          className="plan"
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`${-pad} ${-pad} ${W + pad * 2} ${D + pad * 2}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <defs>
            <clipPath id="roomclip">
              <path d={roomPath} />
            </clipPath>
          </defs>

          <path d={roomPath} fill="#fff" />

          <g clipPath="url(#roomclip)">
            {gridX.map((x) => (
              <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={D} stroke={x % 1000 ? "var(--grid)" : "var(--grid-strong)"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {gridY.map((y) => (
              <line key={`gy${y}`} x1={0} y1={y} x2={W} y2={y} stroke={y % 1000 ? "var(--grid)" : "var(--grid-strong)"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          <g>
            {wallSegs.map((s) => (
              <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#15242f" strokeWidth={6} vectorEffect="non-scaling-stroke" />
            ))}
            <path
              d={`M ${dg.hinge.x} ${dg.hinge.y} L ${dg.open.x} ${dg.open.y} A ${dg.width} ${dg.width} 0 0 ${cross > 0 ? 1 : 0} ${dg.other.x} ${dg.other.y}`}
              fill="none"
              stroke="#8aa0ad"
              strokeWidth={1.5}
              strokeDasharray={`${U * 0.3} ${U * 0.3}`}
              vectorEffect="non-scaling-stroke"
            />
          </g>

          {fixtures(layout).map((f) => (
            <g key={f.id} transform={`translate(${f.x} ${f.y})`}>
              <rect x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} fill="#c9d4db" stroke="#7a8b96" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={U * 0.5} fill="#4a5c68" fontFamily="IBM Plex Sans, sans-serif" style={{ pointerEvents: "none" }}>
                {f.name}
              </text>
            </g>
          ))}

          {halo && (
            <g clipPath="url(#roomclip)">
              <ItemHalo item={halo} clearance={layout.clearance} />
            </g>
          )}

          {ordered.map((it) => (
            <PlanItem key={it.id} item={it} selected={layout.sel === it.id} bad={!!problems.byId[it.id]} U={U} />
          ))}

          <g stroke="#8aa0ad" strokeWidth={1} vectorEffect="non-scaling-stroke">
            <line x1={0} y1={-U * 1.4} x2={W} y2={-U * 1.4} />
            <line x1={-U * 1.4} y1={0} x2={-U * 1.4} y2={D} />
          </g>
          <text x={W / 2} y={-U * 1.4 - U * 0.5} textAnchor="middle" fontSize={U * 0.55} fill="#5a6d7a" fontFamily="IBM Plex Mono, monospace">
            {Math.round(layout.room.top)} mm
          </text>
          <text
            x={-U * 1.4 - U * 0.5}
            y={D / 2}
            textAnchor="middle"
            fontSize={U * 0.55}
            fill="#5a6d7a"
            fontFamily="IBM Plex Mono, monospace"
            transform={`rotate(-90 ${-U * 1.4 - U * 0.5} ${D / 2})`}
          >
            {Math.round(layout.room.left)} mm
          </text>
        </svg>

        <div className="scalebar">
          <span>grid 500 mm</span>
          <span>{area.toFixed(2)} m² floor</span>
        </div>
      </div>
    </>
  );
}
