import { matchingPreset, ROOM_PRESETS, type RoomPreset, type RoomState } from "../model";

interface Props {
  layout: RoomState;
  onLoad: (preset: RoomPreset) => void;
}

/**
 * Saved rooms. Picking one loads its walls, fireplace, radiator and door into
 * the editor; the furniture already on the plan is left where it is, so you can
 * try the same pieces in another room.
 */
export function RoomPresets({ layout, onLoad }: Props) {
  const current = matchingPreset(layout);

  return (
    <>
      <div className="row">
        <div className="f-wide">
          <label htmlFor="roomPreset">Room</label>
          <select
            id="roomPreset"
            value={current?.id ?? ""}
            onChange={(e) => {
              const p = ROOM_PRESETS.find((r) => r.id === e.target.value);
              if (p) onLoad(p);
            }}
          >
            {!current && <option value="">Custom room (edited)</option>}
            {ROOM_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="hint" style={{ margin: "0 0 10px" }}>
        {current ? current.note : "Edited by hand. Pick a saved room to put its walls and fixtures back."}
      </p>
    </>
  );
}
