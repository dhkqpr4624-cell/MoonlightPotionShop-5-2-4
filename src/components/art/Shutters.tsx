/**
 * 창구 덧문 (임시 그래픽, 교체 가능).
 * NightBackdrop과 같은 좌표계(1000 × 560, slice)로 겹쳐 그려 창틀에 정확히 맞는다.
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

export type ShutterMode = "open" | "closed" | "closing" | "opening";

const LINE = "#2b1d3a";
const WINDOW_PATH = "M150 560 L150 170 C 150 70, 850 70, 850 170 L850 560 Z";

function Panel({ x, image }: { x: number; image?: string }) {
  if (image) {
    return <image href={assetUrl(image)} x={x} y={60} width={350} height={500} preserveAspectRatio="none" />;
  }
  const slats = Array.from({ length: 11 }, (_, i) => 80 + i * 45);
  return (
    <g>
      <rect x={x} y={60} width={350} height={500} fill="#8a5a3c" />
      {slats.map((y) => (
        <g key={y}>
          <rect x={x + 18} y={y} width={314} height={34} rx={4} fill="#9c6a47" stroke={LINE} strokeWidth={3} />
          <path d={`M${x + 26} ${y + 8} L${x + 324} ${y + 8}`} stroke="#b88560" strokeWidth={3} strokeLinecap="round" />
        </g>
      ))}
      <rect x={x} y={60} width={350} height={500} fill="none" stroke={LINE} strokeWidth={5} />
      {/* 경첩 */}
      {[170, 430].map((y) => (
        <rect key={y} x={x === 150 ? 152 : 818} y={y} width={30} height={22} rx={4} fill="#4b4066" stroke={LINE} strokeWidth={3} />
      ))}
      {/* 손잡이 */}
      <circle cx={x === 150 ? 480 : 520} cy={330} r={10} fill="#ffcf6b" stroke={LINE} strokeWidth={3} />
    </g>
  );
}

export function Shutters({ mode }: { mode: ShutterMode }) {
  if (mode === "open") return null;
  return (
    <svg
      className={`shutters shutters--${mode}`}
      viewBox="0 0 1000 560"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-testid="shutters"
      data-mode={mode}
    >
      <defs>
        <clipPath id="shop-window">
          <path d={WINDOW_PATH} />
        </clipPath>
      </defs>
      <g clipPath="url(#shop-window)">
        <g className="shutter-l">
          <Panel x={150} image={SHOP_ART.shutterLeft} />
        </g>
        <g className="shutter-r">
          <Panel x={500} image={SHOP_ART.shutterRight} />
        </g>
      </g>
      {/* 창틀을 다시 그려 덧문이 창틀 안쪽에 있도록 */}
      <path d="M150 560 L150 170 C 150 70, 850 70, 850 170 L850 560" fill="none" stroke="#6b4a3a" strokeWidth={28} />
      <path d="M150 560 L150 170 C 150 70, 850 70, 850 170 L850 560" fill="none" stroke={LINE} strokeWidth={4} />
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
            <span className="closed-sign-sub">🌙 달빛 포션 상점</span>
          </span>
        </>
      )}
    </div>
  );
}
