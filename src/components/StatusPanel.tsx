import type { Problems } from "../problems";

export function StatusPanel({ problems, empty }: { problems: Problems; empty: boolean }) {
  if (empty) {
    return (
      <div className="status">
        <span className="empty">Nothing in the room yet.</span>
      </div>
    );
  }
  const { errors, warns } = problems;
  const all: [string, string][] = [
    ...errors.map((e) => ["bad", e] as [string, string]),
    ...warns.map((w) => ["warn", w] as [string, string]),
  ];
  return (
    <div className="status">
      {errors.length ? (
        <span className="bad">
          {errors.length} problem{errors.length > 1 ? "s" : ""}.
        </span>
      ) : (
        <span className="good">Everything fits, nothing clashes.</span>
      )}
      {all.length > 0 && (
        <ul>
          {all.map(([cls, text], i) => (
            <li key={i} className={cls}>
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
