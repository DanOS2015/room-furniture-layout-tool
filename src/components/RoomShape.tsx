import type { Layout, Room, RoomPreset } from "../model";
import { wallNames, walls } from "../geometry";
import { NumberField } from "./NumberField";
import { RoomPresets } from "./RoomPresets";

interface Props {
  layout: Layout;
  onRoom: (patch: Partial<Room>) => void;
  onClearance: (v: number) => void;
  onPreset: (preset: RoomPreset) => void;
}

export function RoomShape({ layout, onRoom, onClearance, onPreset }: Props) {
  const names = wallNames(layout.room);
  const derived = walls(layout.room)
    .map((w) => `${names[w.i]} ${Math.round(w.len)} mm`)
    .join(" · ");

  return (
    <>
      <RoomPresets layout={layout} onLoad={onPreset} />
      <p className="hint" style={{ margin: "0 0 10px" }}>
        Four wall lengths define the room. The fifth wall, the angled one with the door, is worked out from them.
        The top wall carries the fireplace, the bottom wall the radiator, and the angled wall joins the right wall
        to the bottom one.
      </p>
      <div className="row">
        <NumberField label="Top wall" value={layout.room.top} onChange={(top) => onRoom({ top })} min={500} />
        <NumberField label="Right wall" value={layout.room.right} onChange={(right) => onRoom({ right })} min={0} />
        <NumberField label="Bottom wall" value={layout.room.bottom} onChange={(bottom) => onRoom({ bottom })} min={0} />
        <NumberField label="Left wall" value={layout.room.left} onChange={(left) => onRoom({ left })} min={500} />
      </div>
      <div className="row">
        <NumberField label="Walkway to keep clear" value={layout.clearance} onChange={onClearance} step={50} min={0} />
      </div>
      <div className="mono">{derived}</div>
    </>
  );
}
