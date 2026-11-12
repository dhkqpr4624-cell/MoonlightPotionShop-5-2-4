/**
 * 장면 안쪽 가장자리에 놓는 작은 상태 UI (화면 전체 너비의 상단 띠를 대신한다).
 *  왼쪽 위: 처음 화면 · 가운데 위: "밤 2일차 · 손님 4/5" · 오른쪽 위: 음소거 · 소지금 · 상점
 * 창구·마감 화면은 장면 그림 안 위쪽 가장자리(그림 위 여백이 넉넉하면 여백)에, 제작대는 기존 제작대 머리줄 안에 놓는다.
 * 반투명한 어두운 나무 바탕 + 황동 테두리. 버튼은 최소 40px.
 */
import { fmtMoney } from "../lib/money.ts";
import type { CSSProperties } from "react";
import type { SceneLayout } from "./art/ShopScene.tsx";
import type { SoundSettings } from "../audio/settings.ts";
import { Icon } from "./Icon.tsx";

export interface HudProps {
  dayLabel: string;
  money: number;
  sound: SoundSettings;
  onSound: (next: SoundSettings) => void;
  onHome: () => void;
  onShop: () => void;
  /** 처음 화면·상점을 막는 동안 (덧문 연출, 계량·끌기·젓기 중 등) */
  homeDisabled?: boolean;
  shopDisabled?: boolean;
}

export function HudLeft({ onHome, homeDisabled }: Pick<HudProps, "onHome" | "homeDisabled">) {
  return (
    <button type="button" className="hud-btn hud-home" onClick={onHome} disabled={homeDisabled} aria-label="처음 화면으로" data-testid="hud-home">
      <Icon name="home" size={18} /> <span className="hud-text">처음 화면</span>
    </button>
  );
}

export function HudCenter({ dayLabel }: Pick<HudProps, "dayLabel">) {
  return (
    <div className="hud-chip hud-day" data-testid="day-badge">
      {dayLabel}
    </div>
  );
}

export function HudSound({ sound, onSound }: Pick<HudProps, "sound" | "onSound">) {
  return (
    <button
      type="button"
      className="hud-btn hud-mute"
      aria-pressed={!sound.enabled}
      aria-label={sound.enabled ? "효과음 끄기 (음소거)" : "효과음 켜기"}
      onClick={() => onSound({ ...sound, enabled: !sound.enabled })}
      data-testid="sound-button"
      data-sfx="none"
    >
      <Icon name={sound.enabled ? "sound" : "mute"} size={18} />
    </button>
  );
}

export function HudMoney({ money }: Pick<HudProps, "money">) {
  return (
    <div className="hud-chip hud-money" data-testid="money" aria-label={`달빛 동전 ${fmtMoney(money)}개`}>
      <Icon name="coin" size={20} />
      <span data-testid="money-value" className={money < 0 ? "is-negative" : undefined}>{fmtMoney(money)}</span>
    </div>
  );
}

export function HudRight({ money, sound, onSound, onShop, shopDisabled }: Pick<HudProps, "money" | "sound" | "onSound" | "onShop" | "shopDisabled">) {
  return (
    <div className="hud-right">
      <HudSound sound={sound} onSound={onSound} />
      <HudMoney money={money} />
      <button type="button" className="hud-btn hud-shop" onClick={onShop} disabled={shopDisabled} data-testid="open-shop">
        <Icon name="bag" size={18} /> <span className="hud-text">상점</span>
      </button>
    </div>
  );
}

/** 창구·마감 화면: 장면 그림 상자(좌표) 안쪽 위 가장자리에 세 묶음을 띄운다 */
export function SceneHud({ box, ...p }: HudProps & { box: { left: number; top: number; width: number; height: number } }) {
  const style: CSSProperties = { left: box.left, top: box.top, width: box.width };
  return (
    <div className="scene-hud" style={style} data-testid="scene-hud">
      <div className="hud-slot hud-slot-left"><HudLeft onHome={p.onHome} homeDisabled={p.homeDisabled} /></div>
      <div className="hud-slot hud-slot-center"><HudCenter dayLabel={p.dayLabel} /></div>
      <div className="hud-slot hud-slot-right">
        <HudRight money={p.money} sound={p.sound} onSound={p.onSound} onShop={p.onShop} shopDisabled={p.shopDisabled} />
      </div>
    </div>
  );
}

/** 장면 안 상태 UI 높이(px) */
export const HUD_H = 46;

/** 상태 UI 자리: 그림 위 여백이 넉넉하면 여백에, 아니면 그림 안쪽 위 가장자리에 (그림은 그대로 전부 보인다) */
export function hudPlacement(layout: SceneLayout, sceneWidth: number) {
  const inMargin = layout.sceneTop >= HUD_H + 6;
  const top = inMargin ? layout.sceneTop - HUD_H - 2 : Math.max(0, layout.sceneTop) + 6;
  return {
    inMargin,
    bottom: top + HUD_H,
    box: { left: Math.max(0, layout.sceneLeft) + 6, top, width: Math.min(layout.width, sceneWidth * layout.s) - 12, height: HUD_H },
  };
}

