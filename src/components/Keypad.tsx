import type { InputKey } from "../lib/answerInput.ts";

const KEYS: { key: InputKey; label: string; aria?: string }[] = [
  { key: "7", label: "7" }, { key: "8", label: "8" }, { key: "9", label: "9" },
  { key: "4", label: "4" }, { key: "5", label: "5" }, { key: "6", label: "6" },
  { key: "1", label: "1" }, { key: "2", label: "2" }, { key: "3", label: "3" },
  { key: ".", label: ".", aria: "소수점" }, { key: "0", label: "0" }, { key: "backspace", label: "⌫", aria: "한 글자 지우기" },
];

export function Keypad({
  onKey,
  onSubmit,
  disabled,
}: {
  onKey: (key: InputKey) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  return (
    <div className="keypad" aria-label="숫자 키패드">
      {KEYS.map((k) => (
        <button
          key={k.key}
          type="button"
          className={`key ${k.key === "." ? "key-dot" : ""} ${k.key === "backspace" ? "key-back" : ""}`}
          aria-label={k.aria ?? k.label}
          disabled={disabled}
          onClick={() => onKey(k.key)}
        >
          {k.label}
        </button>
      ))}
      <button type="button" className="key key-clear" disabled={disabled} onClick={() => onKey("clear")}>
        전체 지우기
      </button>
      <button type="button" className="key key-submit" disabled={disabled} onClick={onSubmit} data-testid="submit">
        계량하기
      </button>
    </div>
  );
}
