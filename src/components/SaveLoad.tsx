import { useRef } from "react";
import type { Layout } from "../model";
import { exportJson, importJson } from "../persist";

interface Props {
  layout: Layout;
  message: string;
  onLoaded: (l: Layout) => void;
  onError: (msg: string) => void;
  onReset: () => void;
}

export function SaveLoad({ layout, message, onLoaded, onError, onReset }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="row">
        <button className="ghost" onClick={() => exportJson(layout)}>
          Export layout (.json)
        </button>
        <button className="ghost" onClick={() => fileRef.current?.click()}>
          Import layout
        </button>
        <button className="ghost" onClick={onReset}>
          Back to measured room
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onLoaded(await importJson(file));
          } catch (err) {
            onError(`Couldn't read ${file.name} — ${(err as Error).message}.`);
          }
        }}
      />
      <p className="hint">{message}</p>
      <p className="hint">
        The layout is kept in this browser automatically. Export writes a .json file you can keep alongside your
        measurements or open on another machine.
      </p>
    </>
  );
}
