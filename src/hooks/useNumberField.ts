import { useEffect, useRef, useState, type ChangeEvent } from "react";

export interface NumberFieldOptions {
  min?: number;
  max?: number;
  /** Applied on blur, after clamping - used to wrap rotation into 0..359. */
  normalise?: (v: number) => number;
}

/**
 * A numeric input that can hold a half-typed value.
 *
 * The bug this exists to kill: the old tool clamped on every keystroke
 * (`Math.max(min || 10, v)`) and rebuilt the panel's innerHTML on every commit,
 * so typing the "1" of "1000" clamped to 10, destroyed the input node and threw
 * the caret away. Here the raw string is local state, clamping waits for blur,
 * and the raw string is only re-synced from outside while the field is
 * unfocused - so a reset or a JSON import updates the box, but typing never is.
 */
export function useNumberField(value: number, commit: (v: number) => void, opts: NumberFieldOptions = {}) {
  const { min, max, normalise } = opts;
  const [raw, setRaw] = useState(() => String(round(value)));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setRaw(String(round(value)));
  }, [value]);

  return {
    value: raw,
    onFocus: () => {
      focused.current = true;
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setRaw(next);
      const parsed = parseFloat(next);
      // Commit live so the plan tracks what you type, but unclamped - "1" on the
      // way to "1000" is a legitimate intermediate state.
      if (Number.isFinite(parsed)) commit(parsed);
    },
    onBlur: () => {
      focused.current = false;
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed)) {
        setRaw(String(round(value)));
        return;
      }
      let v = parsed;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      if (normalise) v = normalise(v);
      setRaw(String(round(v)));
      if (v !== parsed) commit(v);
    },
  };
}

const round = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
