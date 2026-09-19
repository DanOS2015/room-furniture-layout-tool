import { useId } from "react";
import { useNumberField, type NumberFieldOptions } from "../hooks/useNumberField";

interface Props extends NumberFieldOptions {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  className?: string;
}

export function NumberField({ label, value, onChange, step = 10, className = "f", min, max, normalise }: Props) {
  const id = useId();
  const field = useNumberField(value, onChange, { min, max, normalise });
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      {/* inputMode gets the compact number pad on Android rather than the full keyboard. */}
      <input id={id} type="number" inputMode="numeric" step={step} {...field} />
    </div>
  );
}
