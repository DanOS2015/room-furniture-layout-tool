import { COLORS, type Item } from "../model";
import { bodyDepth, chaiseWidth, isCorner, isL, localOutline, polyPath } from "../geometry";

interface Props {
  item: Item;
  selected: boolean;
  bad: boolean;
  /** Plan unit - one 34th of the room's longest side, used to size labels. */
  U: number;
}

/**
 * The walkway ring around the selected piece.
 *
 * A stroke of width 2*pad with round joins IS the exact offset of the outline
 * by a disc of radius pad, so the walkway shows as a true, even ring on every
 * side - no offset maths, and no seam on an L-shape because localOutline() is a
 * single closed path. Drawn by Plan in its own room-clipped layer, since floor
 * clearance outside the room means nothing.
 */
export function ItemHalo({ item: it, clearance }: { item: Item; clearance: number }) {
  return (
    <path
      transform={`translate(${it.x} ${it.y}) rotate(${it.rot || 0})`}
      d={polyPath(localOutline(it))}
      fill="#e8b84b"
      fillOpacity={0.13}
      stroke="#e8b84b"
      strokeOpacity={0.13}
      strokeWidth={clearance * 2}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export function PlanItem({ item: it, selected, bad, U }: Props) {
  const outline = polyPath(localOutline(it));
  const ly = isL(it) ? -it.d / 2 + bodyDepth(it) / 2 : isCorner(it) ? it.d * 0.12 : 0;

  return (
    <g transform={`translate(${it.x} ${it.y}) rotate(${it.rot || 0})`} data-id={it.id} style={{ cursor: "grab" }}>
      <path
        d={outline}
        fill={COLORS[it.cat] ?? COLORS.custom}
        opacity={it.cat === "rug" ? 0.3 : 0.82}
        stroke={bad ? "var(--alert)" : selected ? "#15242f" : "rgba(21,36,47,.5)"}
        strokeWidth={selected || bad ? 2.5 : 1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {it.cat === "seat" && <SeatLines item={it} />}
      {/* Turned back by the piece's own rotation about the label anchor, so a
          sofa at 180 degrees is still labelled the right way up. */}
      <g transform={`rotate(${-(it.rot || 0)} 0 ${ly})`} style={{ pointerEvents: "none" }}>
        <text
          x={0}
          y={ly - U * 0.3}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={U * 0.55}
          fill="#fff"
          fontFamily="IBM Plex Sans, sans-serif"
          fontWeight={500}
        >
          {it.name}
        </text>
        <text
          x={0}
          y={ly + U * 0.42}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={U * 0.44}
          fill="#fff"
          opacity={0.85}
          fontFamily="IBM Plex Mono, monospace"
        >
          {Math.round(it.w)}×{Math.round(it.d)}
        </text>
      </g>
    </g>
  );
}

/** White lines marking the front edge of the seat(s). */
function SeatLines({ item: it }: { item: Item }) {
  const W = it.w;
  const D = it.d;
  const common = { stroke: "#fff", opacity: 0.85, strokeWidth: 3, vectorEffect: "non-scaling-stroke" as const };
  if (!isL(it)) return <line x1={-W / 2} y1={D / 2} x2={W / 2} y2={D / 2} {...common} />;

  const bD = bodyDepth(it);
  const cW = chaiseWidth(it);
  const y = -D / 2 + bD;
  const right = it.chaiseSide === "right";
  return (
    <>
      <line x1={right ? -W / 2 : -W / 2 + cW} y1={y} x2={right ? W / 2 - cW : W / 2} y2={y} {...common} />
      <line x1={right ? W / 2 - cW : -W / 2} y1={D / 2} x2={right ? W / 2 : -W / 2 + cW} y2={D / 2} {...common} />
    </>
  );
}
