/** 포션 병·재료·솥 임시 그래픽 (교체 가능). 색과 입자 모양은 레시피 데이터에서 온다. */
import type { PotionLook } from "../../data/recipes.ts";
import type { Ingredient } from "../../data/ingredients.ts";

const LINE = "#2b1d3a";

function Particles({ kind, color }: { kind: PotionLook["particle"]; color: string }) {
  const spots = [
    [24, 52], [36, 60], [30, 44], [20, 62], [40, 50],
  ];
  return (
    <g className="potion-particles">
      {spots.map(([x, y], i) =>
        kind === "star" ? (
          <path
            key={i}
            transform={`translate(${x} ${y}) scale(${i % 2 ? 0.8 : 1.1})`}
            d="M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2 Z"
            fill={color}
          />
        ) : (
          <circle key={i} cx={x} cy={y} r={2} fill={color} />
        ),
      )}
    </g>
  );
}

/** 품질에 따라 병의 빛을 줄인다 (만족: 그대로, 조금 아쉬움: 흐리게, 불만족: 탁하게) */
const QUALITY_FILTER: Record<string, string | undefined> = {
  great: undefined,
  okay: "saturate(0.6) brightness(0.95)",
  poor: "saturate(0.15) brightness(0.85)",
};

export function PotionBottle({ look, size = 60, label, quality }: { look: PotionLook; size?: number; label?: string; quality?: string | null }) {
  const filter = quality ? QUALITY_FILTER[quality] : undefined;
  return (
    <svg
      viewBox="0 0 60 80"
      width={size}
      height={(size * 80) / 60}
      className="potion-bottle"
      role="img"
      aria-label={label ?? "포션 병"}
      style={filter ? { filter } : undefined}
    >
      <ellipse cx="30" cy="54" rx="26" ry="24" fill={look.glow} opacity={quality === "poor" ? 0.1 : 0.35} className="potion-glow" />
      <rect x="23" y="6" width="14" height="9" rx="3" fill="#b07a4a" stroke={LINE} strokeWidth="2.5" />
      <path d="M25 15 L25 26 C 12 30, 6 40, 6 52 C 6 66, 17 76, 30 76 C 43 76, 54 66, 54 52 C 54 40, 48 30, 35 26 L35 15 Z" fill="#e8f1ff" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M8 50 C 8 66, 18 74, 30 74 C 42 74, 52 66, 52 50 Z" fill={look.liquid} />
      <Particles kind={look.particle} color="#fff7c2" />
      <path d="M14 42 C 12 48, 12 54, 14 58" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function IngredientIcon({ ingredient, size = 44 }: { ingredient: Ingredient; size?: number }) {
  if (ingredient.kind === "liquid") {
    return (
      <svg viewBox="0 0 40 48" width={size} height={(size * 48) / 40} aria-hidden="true">
        <rect x="14" y="3" width="12" height="7" rx="2" fill="#b07a4a" stroke={LINE} strokeWidth="2" />
        <path d="M15 10 L15 18 C 8 21, 6 27, 6 33 C 6 41, 12 45, 20 45 C 28 45, 34 41, 34 33 C 34 27, 32 21, 25 18 L25 10 Z" fill="#eef6ff" stroke={LINE} strokeWidth="2.5" />
        <path d="M8 31 C 8 40, 13 43, 20 43 C 27 43, 32 40, 32 31 Z" fill={ingredient.color} />
        <circle cx="16" cy="36" r="2" fill="#fff" opacity="0.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 48" width={size} height={(size * 48) / 40} aria-hidden="true">
      <path d="M8 18 C 6 30, 6 38, 10 44 L30 44 C 34 38, 34 30, 32 18 Z" fill="#d9b98a" stroke={LINE} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M6 18 L34 18 L30 10 L10 10 Z" fill="#c49a64" stroke={LINE} strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="20" cy="18" rx="12" ry="4" fill={ingredient.color} stroke={LINE} strokeWidth="1.5" />
      {[[14, 30], [22, 34], [18, 38], [26, 28]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill={ingredient.color} />
      ))}
    </svg>
  );
}

/** 두 색을 t(0~1) 비율로 섞는다 */
export function mixColor(from: string, to: string, t: number): string {
  const f = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const k = Math.max(0, Math.min(1, t));
  const c = [0, 1, 2].map((i) => Math.round(f(from, i) + (f(to, i) - f(from, i)) * k));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 솥. doneColors: 넣은 첨가물 색, stir: 젓기 진행(0~1), finishColor: 완성 색
 * 재료량과 상관없이 액체 높이는 일정하다 (아주 큰 값을 넣어도 넘치거나 깨지지 않음)
 */
export function Cauldron({
  doneColors,
  stir,
  finishColor,
  showStick,
  stickX = 0.5,
}: {
  doneColors: string[];
  stir: number;
  finishColor: string;
  showStick: boolean;
  /** 젓는 막대의 가로 위치 (0~1) */
  stickX?: number;
}) {
  const base = "#9fb4d8";
  const mixed = doneColors.length ? doneColors.reduce((acc, c) => mixColor(acc, c, 0.5), base) : base;
  const surface = stir > 0 ? mixColor(mixed, finishColor, stir) : mixed;
  const sparkleCount = Math.floor(stir * 6);
  const sx = 70 + Math.max(0, Math.min(1, stickX)) * 160;
  return (
    <svg viewBox="0 0 300 230" className={`cauldron ${stir >= 1 ? "is-finished" : ""}`} aria-hidden="true">
      <g className="cauldron-fire">
        <path d="M110 222 C 100 200, 120 190, 118 176 C 135 190, 140 205, 130 222 Z" fill="#ff9d3c" />
        <path d="M150 224 C 136 198, 160 186, 156 166 C 178 186, 182 206, 170 224 Z" fill="#ffc94a" />
        <path d="M190 222 C 182 204, 198 194, 196 180 C 212 194, 214 208, 206 222 Z" fill="#ff9d3c" />
      </g>
      <path d="M70 206 L60 226 M230 206 L240 226" stroke={LINE} strokeWidth="8" strokeLinecap="round" />
      <path d="M40 92 C 30 170, 80 214, 150 214 C 220 214, 270 170, 260 92 Z" fill="#3a3150" stroke={LINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M62 110 C 60 150, 90 184, 128 194" fill="none" stroke="#5d5178" strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="150" cy="92" rx="118" ry="30" fill="#4b4066" stroke={LINE} strokeWidth="5" />
      <ellipse cx="150" cy="94" rx="100" ry="22" fill={surface} className="cauldron-liquid" />
      {stir > 0 && (
        <ellipse cx="150" cy="94" rx={30 + stir * 60} ry={6 + stir * 12} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="3" className="cauldron-swirl" />
      )}
      {doneColors.map((c, i) => (
        <circle key={i} className="cauldron-bubble" style={{ animationDelay: `${i * 0.6}s` }} cx={120 + i * 50} cy={92} r={7} fill={c} stroke="#ffffff" strokeWidth="1.5" opacity="0.9" />
      ))}
      <g className="cauldron-sparkles" fill="#fff7c2">
        {Array.from({ length: sparkleCount }, (_, i) => (
          <path key={i} transform={`translate(${90 + i * 24} ${66 - (i % 2) * 14}) scale(${0.6 + (i % 3) * 0.2})`} d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" />
        ))}
      </g>
      {showStick && (
        <g className="stir-stick" transform={`rotate(${(stickX - 0.5) * 30} ${sx} 96)`}>
          <rect x={sx - 6} y={6} width={12} height={96} rx={6} fill="#b07a4a" stroke={LINE} strokeWidth="3" />
          <ellipse cx={sx} cy={100} rx={14} ry={7} fill="#8a5a3c" stroke={LINE} strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}

/** 계량 도구: 액체는 눈금 실린더, 가루는 저울 접시 */
export function MeasureTool({ ingredient }: { ingredient: Ingredient }) {
  if (ingredient.kind === "liquid") {
    return (
      <svg viewBox="0 0 80 120" className="measure-tool" aria-hidden="true">
        <path d="M22 10 L58 10 L58 108 C 58 112, 55 114, 52 114 L28 114 C 25 114, 22 112, 22 108 Z" fill="#eef6ff" stroke={LINE} strokeWidth="3" />
        <rect className="measure-fill" x="25" y="40" width="30" height="71" fill={ingredient.color} />
        {[30, 50, 70, 90].map((y) => (
          <path key={y} d={`M22 ${y} L32 ${y}`} stroke={LINE} strokeWidth="2" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className="measure-tool" aria-hidden="true">
      <rect x="20" y="70" width="60" height="22" rx="6" fill="#c9b6e8" stroke={LINE} strokeWidth="3" />
      <rect x="36" y="76" width="28" height="10" rx="2" fill="#2b1d3a" />
      <path d="M48 70 L48 58 L52 58 L52 70 Z" fill="#8a7aa8" stroke={LINE} strokeWidth="2" />
      <path d="M18 58 L82 58 C 80 66, 20 66, 18 58 Z" fill="#eef1f7" stroke={LINE} strokeWidth="3" />
      <path className="measure-pile" d="M32 58 C 38 40, 62 40, 68 58 Z" fill={ingredient.color} stroke={LINE} strokeWidth="2" />
    </svg>
  );
}
