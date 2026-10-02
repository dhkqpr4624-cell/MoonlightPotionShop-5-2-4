/** 소리 설정: 효과음 켜기·끄기와 음량. 설정은 기기(브라우저)에 따로 저장된다 */
import { useEffect, useRef, useState } from "react";
import type { SoundSettings as Settings } from "../audio/settings.ts";
import { Icon } from "./Icon.tsx";

export function SoundSettings({ value, onChange, light = false }: { value: Settings; onChange: (next: Settings) => void; light?: boolean }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && e.target instanceof Node && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const pct = Math.round(value.volume * 100);
  return (
    <div className={`sound-settings ${light ? "is-light" : ""}`} ref={boxRef}>
      <button
        type="button"
        className="btn btn-ghost small sound-toggle"
        aria-expanded={open}
        aria-label={`소리 설정 (효과음 ${value.enabled ? `켜짐, 음량 ${pct}%` : "꺼짐"})`}
        onClick={() => setOpen((v) => !v)}
        data-testid="sound-button"
      >
        <Icon name={value.enabled ? "sound" : "mute"} size={20} />
        <span className="sound-label">소리</span>
      </button>
      {open && (
        <div className="sound-pop" role="dialog" aria-label="소리 설정" data-testid="sound-panel">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e: { currentTarget: HTMLInputElement }) => onChange({ ...value, enabled: e.currentTarget.checked })}
              data-testid="sound-enabled"
            />
            <span className="switch" aria-hidden="true" />
            효과음 {value.enabled ? "켜짐" : "꺼짐"}
          </label>
          <label className="volume-row">
            <span>음량</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={pct}
              disabled={!value.enabled}
              onChange={(e: { currentTarget: HTMLInputElement }) => onChange({ ...value, volume: Number(e.currentTarget.value) / 100 })}
              data-testid="sound-volume"
              aria-valuetext={`${pct}%`}
            />
            <output>{pct}%</output>
          </label>
        </div>
      )}
    </div>
  );
}
