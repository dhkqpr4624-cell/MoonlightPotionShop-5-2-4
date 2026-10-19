/**
 * 창구 덧문 (Phase 4 그래픽 그대로).
 * 덧문 두 짝은 원래 좌표(x150~850, y60~560)에 그대로 그리고, 보이는 범위(viewBox)만
 * 새 창구 PNG의 창 개구부 상자(data/shopArt.ts COUNTER_SCENE.opening)에 맞춘다.
 * 아치 PNG가 덧문 앞에 겹쳐 창틀 역할을 하므로, 예전의 아치 모양 잘라내기와 창틀 다시 그리기는 쓰지 않는다.
 *
 * mode
 *  - "open"    : 열림(그리지 않음)
 *  - "closed"  : 닫힘(정지)
 *  - "closing" : 열림 → 닫힘 애니메이션
 *  - "opening" : 닫힘 → 열림 애니메이션
 * 열림·닫힘의 '최종 상태'는 저장된 영업 상태(day.status)가 정하고,
 * closing/opening은 이번 화면에서 방금 버튼을 눌렀을 때만 쓰는 연출이다.
 */
import { SHOP_ART } from "../../data/shopArt.ts";
import { assetUrl } from "../../lib/assets.ts";
import { Icon } from "../Icon.tsx";

export type ShutterMode = "open" | "closed" | "closing" | "opening";

const LINE = "#2b1d3a";
/** 덧문 두 짝이 함께 차지하는 범위 (Panel 좌표) */
const PANELS_VIEWBOX = "150 60 700 500";

function Panel({ x, image }: { x: number; image?: string }) {
  if (image) {
    return <image href={assetUrl(image)} x={x} y={60} width={350} height={500} preserveAspectRatio="none" />;
  }
  const left = x === 150;
  const planks = Array.from({ length: 7 }, (_, i) => x + i * 50);
  return (
    <g>
      {/* 세로 판자 */}
      {planks.map((px, i) => (
        <g key={px}>
          <rect x={px} y={60} width={50} height={500} fill={i % 2 ? "#7a4e35" : "#875a3d"} />
          <path d={`M${px + 12} 90 v 440`} stroke="#9c6a47" strokeWidth={3} opacity="0.6" />
          <path d={`M${px} 60 v 500`} stroke={LINE} strokeWidth={2.5} />
        </g>
      ))}
      {/* Z자 보강목 */}
      <g stroke={LINE} strokeWidth={3} strokeLinejoin="round">
        <rect x={x + 6} y={200} width={338} height={28} fill="#6b4430" />
        <rect x={x + 6} y={430} width={338} height={28} fill="#6b4430" />
        <path d={left ? `M${x + 20} 430 L${x + 320} 228 L${x + 334} 244 L${x + 36} 446 Z` : `M${x + 330} 430 L${x + 30} 228 L${x + 16} 244 L${x + 314} 446 Z`} fill="#7a4e35" />
      </g>
      {/* 달·별 구멍 */}
      {left ? (
        <path d={`M${x + 175} 300 A30 30 0 1 0 ${x + 199} 350 A24 24 0 1 1 ${x + 175} 300 Z`} fill="#1a1440" stroke={LINE} strokeWidth={3} />
      ) : (
        <path transform={`translate(${x + 175} 330) scale(3.2)`} d="M0 -9 L2.6 -2.8 L9 -2.6 L4 1.6 L5.6 8 L0 4.4 L-5.6 8 L-4 1.6 L-9 -2.6 L-2.6 -2.8 Z" fill="#1a1440" stroke={LINE} strokeWidth={1} />
      )}
      {/* 황동 경첩·손잡이 */}
      <g fill="#d8a640" stroke={LINE} strokeWidth={3}>
        {[214, 444].map((y) => (
          <path key={y} d={left ? `M${x - 4} ${y - 10} h70 l10 10 l-10 10 h-70 z` : `M${x + 354} ${y - 10} h-70 l-10 10 l10 10 h70 z`} />
        ))}
        <circle cx={left ? x + 334 : x + 16} cy={330} r={11} />
      </g>
      <rect x={x} y={60} width={350} height={500} fill="none" stroke={LINE} strokeWidth={5} />
    </g>
  );
}

export function Shutters({ mode }: { mode: ShutterMode }) {
  if (mode === "open") return null;
  return (
    <svg
      className={`shutters shutters--${mode}`}
      viewBox={PANELS_VIEWBOX}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-testid="shutters"
      data-mode={mode}
    >
      <g className="shutter-l">
        <Panel x={150} image={SHOP_ART.shutterLeft} />
      </g>
      <g className="shutter-r">
        <Panel x={500} image={SHOP_ART.shutterRight} />
      </g>
    </svg>
  );
}

export function ClosedSign({ animate }: { animate: boolean }) {
  return (
    <div className={`closed-sign ${animate ? "is-dropping" : ""}`} data-testid="closed-sign" role="img" aria-label="오늘 영업 종료">
      {SHOP_ART.closedSign ? (
        <img src={assetUrl(SHOP_ART.closedSign)} alt="" />
      ) : (
        <>
          <span className="closed-sign-strings" aria-hidden="true" />
          <span className="closed-sign-board">
            <span className="closed-sign-main">오늘 영업 종료</span>
            <span className="closed-sign-sub"><Icon name="moon" size={14} /> 달빛 포션 상점</span>
          </span>
        </>
      )}
    </div>
  );
}
