import { useState } from "react";
import type { Layout } from "../model";
import { accessLines } from "../problems";
import { NumberField } from "./NumberField";

export function DoorwayCheck({ layout }: { layout: Layout }) {
  const [oW, setOW] = useState(700);
  const [oH, setOH] = useState(2000);
  const lines = accessLines(layout, oW, oH);

  return (
    <>
      <div className="row">
        <NumberField label="Narrowest opening, width" value={oW} onChange={setOW} step={2} min={1} />
        <NumberField label="Opening height" value={oH} onChange={setOH} step={2} min={1} />
      </div>
      <div className="mono">
        {lines.length === 0 ? (
          "Add a piece to check it against the opening."
        ) : (
          lines.map((l, i) => (
            <div key={i} className={`access-line ${l.cls}`}>
              {l.label}: smallest face {Math.round(l.smallest[0])}×{Math.round(l.smallest[1])} mm — {l.verdict}
            </div>
          ))
        )}
      </div>
      <p className="hint">
        Chaise sofas almost always arrive as two modules, so the sections are listed separately. Check with the retailer
        whether yours splits before trusting the whole-piece line.
      </p>
    </>
  );
}
