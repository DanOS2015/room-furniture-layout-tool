import type { Breast, Door, Layout, Rad } from "../model";
import { NumberField } from "./NumberField";

interface Props {
  layout: Layout;
  onBreast: (p: Partial<Breast>) => void;
  onRad: (p: Partial<Rad>) => void;
  onDoor: (p: Partial<Door>) => void;
}

export function FixturesPanel({ layout, onBreast, onRad, onDoor }: Props) {
  return (
    <>
      <div className="row">
        <NumberField label="Fireplace width" value={layout.breast.w} onChange={(w) => onBreast({ w })} min={0} />
        <NumberField label="How far it sticks out" value={layout.breast.d} onChange={(d) => onBreast({ d })} min={0} />
        <NumberField label="Gap to left wall" value={layout.breast.x} onChange={(x) => onBreast({ x })} min={0} />
      </div>
      <div className="row">
        <NumberField label="Radiator length" value={layout.rad.len} onChange={(len) => onRad({ len })} min={0} />
        <NumberField label="Radiator depth" value={layout.rad.d} onChange={(d) => onRad({ d })} step={5} min={0} />
        <NumberField label="Gap to left wall" value={layout.rad.x} onChange={(x) => onRad({ x })} min={0} />
      </div>
      <div className="row">
        <NumberField label="Door leaf width" value={layout.door.w} onChange={(w) => onDoor({ w })} step={2} min={300} />
        <NumberField label="Set in from right wall" value={layout.door.off} onChange={(off) => onDoor({ off })} min={0} />
        <div className="f-wide">
          <label htmlFor="doorHinge">Hinged at</label>
          <select id="doorHinge" value={layout.door.hinge} onChange={(e) => onDoor({ hinge: e.target.value as Door["hinge"] })}>
            <option value="start">Right-wall end</option>
            <option value="end">Bottom-wall end</option>
          </select>
        </div>
      </div>
    </>
  );
}
