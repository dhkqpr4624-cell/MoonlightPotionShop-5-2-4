/**
 * 포션 병·재료 용기·솥 그래픽 (직접 제작한 SVG, 교체 가능).
 * - 포션 4종은 색뿐 아니라 병 모양·마개·라벨 문양·입자로 구분한다 (data/recipes.ts 의 look).
 * - 품질은 빛·입자 양만 바꾸고 병 모양·라벨은 그대로라 종류를 알아볼 수 있다.
 * - 솥 액체 높이는 일정하다. 입력한 재료량과 무관한 화면 표현이며 계산·판정에 쓰지 않는다.
 */
import { useId, type Ref } from "react";
import type { PotionLook } from "../../data/recipes.ts";
import type { Ingredient } from "../../data/ingredients.ts";

const LINE = "#2b1d3a";

/* ------------------------------------------------------------------ */
/* 공통 문양                                                           */
/* ------------------------------------------------------------------ */

const STAR = "M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z";

function Emblem({ kind, color }: { kind: PotionLook["emblem"]; color: string }) {
  switch (kind) {
    case "star":
      return <path d="M0 -6 L1.8 -1.9 L6 -1.8 L2.8 1 L3.8 5.4 L0 3 L-3.8 5.4 L-2.8 1 L-6 -1.8 L-1.8 -1.9 Z" fill={color} />;
    case "flame":
      return <path d="M0 -7 C 4 -3, 5 1, 3 4 C 2 6, -2 6, -3 4 C -5 1, -3 -2, -1 -3 C -1 -1, 0 0, 1 -1 C 1 -3, 0 -5, 0 -7 Z" fill={color} />;
    case "leaf":
      return (
        <g>
          <path d="M-5 5 C -5 -3, 2 -7, 6 -6 C 6 0, 2 6, -5 5 Z" fill={color} />
          <path d="M-5 5 L 3 -3" stroke="#fff8ea" strokeWidth={1} />
        </g>
      );
    default:
      return <path d="M-6 3 C -8 3, -8 -1, -5 -1 C -5 -4, -1 -5, 0 -2 C 2 -4, 6 -3, 5 0 C 8 0, 8 3, 6 3 Z" fill={color} />;
  }
}

/* ------------------------------------------------------------------ */
/* 포션 병                                                             */
/* ------------------------------------------------------------------ */

const BODY: Record<PotionLook["bottle"], string> = {
  round: "M25 22 L25 32 C 12 36, 6 46, 6 57 C 6 71, 17 81, 30 81 C 43 81, 54 71, 54 57 C 54 46, 48 36, 35 32 L35 22 Z",
  tall: "M25 16 L25 28 C 16 30, 13 34, 13 40 L13 76 C 13 80, 16 82, 20 82 L40 82 C 44 82, 47 80, 47 76 L47 40 C 47 34, 44 30, 35 28 L35 16 Z",
  flask: "M25 20 L25 38 L8 74 C 6 79, 9 82, 14 82 L46 82 C 51 82, 54 79, 52 74 L35 38 L35 20 Z",
  drop: "M25 22 L25 30 C 18 40, 8 50, 8 62 C 8 74, 18 82, 30 82 C 42 82, 52 74, 52 62 C 52 50, 42 40, 35 30 L35 22 Z",
};
/** 액체 윗면 높이 */
const LEVEL: Record<PotionLook["bottle"], number> = { round: 48, tall: 46, flask: 52, drop: 52 };
/** 라벨 위치 */
const LABEL_Y: Record<PotionLook["bottle"], number> = { round: 60, tall: 60, flask: 66, drop: 64 };

function Stopper({ look }: { look: PotionLook }) {
  switch (look.emblem) {
    case "star":
      return (
        <g>
          <rect x="22" y="13" width="16" height="10" rx="3" fill="#b07a4a" stroke={LINE} strokeWidth={2.5} />
          <path transform="translate(30 8) scale(1.4)" d={STAR} fill="#ffd65a" stroke={LINE} strokeWidth={1.4} />
        </g>
      );
    case "flame":
      return (
        <g>
          <rect x="22" y="8" width="16" height="10" rx="2" fill="#b0443f" stroke={LINE} strokeWidth={2.5} />
          <path d="M22 16 q4 6 8 2 q4 4 8 -2" fill="#b0443f" stroke={LINE} strokeWidth={2} />
        </g>
      );
    case "leaf":
      return (
        <g>
          <rect x="22" y="12" width="16" height="10" rx="3" fill="#b07a4a" stroke={LINE} strokeWidth={2.5} />
          <path d="M30 12 C 30 6, 34 3, 40 4 C 39 9, 34 11, 30 12 Z" fill="#6cc46a" stroke={LINE} strokeWidth={1.6} />
        </g>
      );
    default:
      return (
        <g>
          <rect x="24" y="15" width="12" height="8" rx="2" fill="#d9c6ff" stroke={LINE} strokeWidth={2.2} />
          <circle cx="30" cy="11" r="6" fill="#e8dcff" stroke={LINE} strokeWidth={2.2} />
          <path d="M27 10 q3 -3 6 0" fill="none" stroke="#fff" strokeWidth={1.4} />
        </g>
      );
  }
}

function Particles({ look, count, level }: { look: PotionLook; count: number; level: number }) {
  const spots: [number, number][] = [[22, level + 10], [37, level + 18], [30, level + 6], [19, level + 22], [41, level + 8]];
  return (
    <g className="potion-particles">
      {spots.slice(0, count).map(([x, y], i) => {
        if (look.particle === "star") return <path key={i} transform={`translate(${x} ${y}) scale(${i % 2 ? 0.6 : 0.8})`} d={STAR} fill="#fff7c2" />;
        if (look.particle === "leaf") return <path key={i} transform={`translate(${x} ${y}) rotate(${i * 40})`} d="M-3 2 C -3 -2, 1 -4, 4 -3 C 4 0, 1 3, -3 2 Z" fill="#d9ffbf" />;
        if (look.particle === "mist") return <ellipse key={i} cx={x} cy={y - 2} rx={5} ry={2.4} fill="#ffffff" opacity="0.55" />;
        return <circle key={i} cx={x} cy={y} r={1.8 + (i % 2)} fill="#ffe08a" />;
      })}
    </g>
  );
}

export function PotionBottle({
  look,
  size = 60,
  label,
  quality,
}: {
  look: PotionLook;
  size?: number;
  label?: string;
  quality?: string | null;
}) {
  const id = useId().replace(/:/g, "");
  const body = BODY[look.bottle];
  const level = LEVEL[look.bottle];
  const ly = LABEL_Y[look.bottle];
  const glow = quality === "poor" ? 0.08 : quality === "okay" ? 0.22 : 0.42;
  const count = quality === "poor" ? 1 : quality === "okay" ? 3 : 5;
  return (
    <svg
      viewBox="0 0 60 88"
      width={size}
      height={(size * 88) / 60}
      className={`potion-bottle quality-${quality ?? "none"}`}
      role="img"
      aria-label={label ?? "포션 병"}
    >
      <defs>
        <clipPath id={`b${id}`}><path d={body} /></clipPath>
      </defs>
      <ellipse cx="30" cy="60" rx="28" ry="26" fill={look.glow} opacity={glow} className="potion-glow" />
      <path d={body} fill="#eaf2ff" opacity="0.92" />
      <g clipPath={`url(#b${id})`}>
        <rect x="0" y={level} width="60" height="40" fill={look.liquid} />
        <rect x="0" y={level} width="60" height="3" fill="#ffffff" opacity="0.35" />
        {quality === "poor" && <rect x="0" y={level} width="60" height="40" fill="#ffffff" opacity="0.28" />}
        <Particles look={look} count={count} level={level} />
      </g>
      <path d={body} fill="none" stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
      {/* 라벨 */}
      <rect x="17" y={ly - 6} width="26" height="13" rx="3" fill="#fff4dc" stroke={LINE} strokeWidth={1.8} />
      <g transform={`translate(30 ${ly + 0.5})`}>
        <Emblem kind={look.emblem} color={look.liquid} />
      </g>
      <path d={look.bottle === "tall" ? "M18 36 V 70" : "M15 46 C 12 52, 12 60, 15 66"} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" opacity="0.75" />
      <Stopper look={look} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 재료 용기                                                           */
/* ------------------------------------------------------------------ */

function MoonDewFlask({ size }: { size: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 80 100" width={size} height={(size * 100) / 80} aria-hidden="true" className="ingredient-art">
      <defs>
        <linearGradient id={`d${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8f1ff" />
          <stop offset="1" stopColor="#5fb6ea" />
        </linearGradient>
        <clipPath id={`c${id}`}><path d="M32 22 V 40 C 16 44, 8 56, 8 68 C 8 84, 22 94, 40 94 C 58 94, 72 84, 72 68 C 72 56, 64 44, 48 40 V 22 Z" /></clipPath>
      </defs>
      <ellipse cx="40" cy="72" rx="34" ry="26" fill="#9cd8ff" opacity="0.25" />
      <path d="M32 22 V 40 C 16 44, 8 56, 8 68 C 8 84, 22 94, 40 94 C 58 94, 72 84, 72 68 C 72 56, 64 44, 48 40 V 22 Z" fill="#f2f8ff" opacity="0.9" />
      <g clipPath={`url(#c${id})`}>
        <rect x="0" y="58" width="80" height="40" fill={`url(#d${id})`} />
        <path d="M0 58 Q 20 54 40 58 T 80 58 V 62 H 0 Z" fill="#ffffff" opacity="0.5" />
        <circle cx="30" cy="76" r="2.5" fill="#fff" opacity="0.8" />
        <circle cx="50" cy="70" r="1.8" fill="#fff" opacity="0.8" />
        <path transform="translate(46 82) scale(0.7)" d={STAR} fill="#ffffff" />
      </g>
      <path d="M32 22 V 40 C 16 44, 8 56, 8 68 C 8 84, 22 94, 40 94 C 58 94, 72 84, 72 68 C 72 56, 64 44, 48 40 V 22 Z" fill="none" stroke={LINE} strokeWidth={3.2} strokeLinejoin="round" />
      {/* 유리에 맺힌 물방울 */}
      <path d="M20 54 q-2 4 0 6 q2 -2 0 -6 z M60 50 q-2 4 0 6 q2 -2 0 -6 z" fill="#ffffff" stroke="#9cc8e8" strokeWidth={1} />
      <path d="M18 64 C 15 72, 17 80, 22 84" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity="0.8" />
      {/* 코르크 */}
      <path d="M30 10 h20 l-2 13 h-16 z" fill="#c08a5a" stroke={LINE} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M33 14 h14" stroke="#8a5a3c" strokeWidth={2} />
      {/* 꼬리표 */}
      <path d="M48 28 L 62 36" stroke={LINE} strokeWidth={1.6} />
      <rect x="58" y="32" width="18" height="12" rx="2" fill="#fff4dc" stroke={LINE} strokeWidth={1.8} transform="rotate(14 67 38)" />
      <text x="67" y="42" fontSize="8" fontWeight="800" textAnchor="middle" fill={LINE} transform="rotate(14 67 38)">mL</text>
      <path transform="translate(14 32) scale(0.9)" d={STAR} fill="#fff7c2" className="twinkle" />
    </svg>
  );
}

function StarDustJar({ size }: { size: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 80 100" width={size} height={(size * 100) / 80} aria-hidden="true" className="ingredient-art">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0a8" />
          <stop offset="1" stopColor="#e3a92e" />
        </linearGradient>
        <clipPath id={`j${id}`}><rect x="14" y="34" width="52" height="58" rx="10" /></clipPath>
      </defs>
      <ellipse cx="40" cy="70" rx="34" ry="26" fill="#ffd65a" opacity="0.2" />
      <rect x="14" y="34" width="52" height="58" rx="10" fill="#f6f2ff" opacity="0.9" />
      <g clipPath={`url(#j${id})`}>
        <path d="M10 60 C 24 52, 40 58, 50 54 C 58 51, 66 54, 70 56 V 96 H 10 Z" fill={`url(#g${id})`} />
        <g fill="#fffbe0">
          <path transform="translate(28 72) scale(0.9)" d={STAR} />
          <path transform="translate(48 80) scale(0.7)" d={STAR} />
          <path transform="translate(38 64) scale(0.6)" d={STAR} />
          <circle cx="22" cy="84" r="1.4" /><circle cx="56" cy="66" r="1.4" />
        </g>
      </g>
      <rect x="14" y="34" width="52" height="58" rx="10" fill="none" stroke={LINE} strokeWidth={3.2} />
      <path d="M21 44 V 80" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity="0.75" />
      {/* 황동 뚜껑 */}
      <rect x="10" y="22" width="60" height="14" rx="4" fill="#d8a640" stroke={LINE} strokeWidth={3} />
      <path d="M16 26 v6 M24 26 v6 M32 26 v6 M40 26 v6 M48 26 v6 M56 26 v6 M64 26 v6" stroke="#9c6f24" strokeWidth={1.6} />
      <rect x="32" y="14" width="16" height="9" rx="3" fill="#f0c869" stroke={LINE} strokeWidth={2.4} />
      {/* 라벨 */}
      <rect x="24" y="44" width="32" height="14" rx="3" fill="#fff4dc" stroke={LINE} strokeWidth={1.8} />
      <path transform="translate(32 51) scale(0.8)" d={STAR} fill="#e3a92e" />
      <text x="45" y="55" fontSize="9" fontWeight="800" textAnchor="middle" fill={LINE}>g</text>
    </svg>
  );
}

/** 재료 용기 그림 (선반·계량 패널·끌기에 같이 쓴다) */
export function IngredientArt({ ingredient, size = 64 }: { ingredient: Ingredient; size?: number }) {
  return ingredient.id === "starDust" ? <StarDustJar size={size} /> : <MoonDewFlask size={size} />;
}

/** 이전 이름 호환 */
export function IngredientIcon({ ingredient, size = 44 }: { ingredient: Ingredient; size?: number }) {
  return <IngredientArt ingredient={ingredient} size={size} />;
}

/* ------------------------------------------------------------------ */
/* 솥                                                                  */
/* ------------------------------------------------------------------ */

/** 두 색을 t(0~1) 비율로 섞는다 */
export function mixColor(from: string, to: string, t: number): string {
  const f = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const k = Math.max(0, Math.min(1, t));
  const c = [0, 1, 2].map((i) => Math.round(f(from, i) + (f(to, i) - f(from, i)) * k));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** 솥 액체 중심과 반지름 (젓기 좌표 계산에 쓴다) */
export const LIQUID = { cx: 150, cy: 100, rx: 98, ry: 22 } as const;
export const CAULDRON_VIEWBOX = { x: 0, y: -60, w: 300, h: 310 } as const;

export function Cauldron({
  doneColors,
  stir,
  finishColor,
  showStick,
  stickRef,
  swirlRef,
  burst,
}: {
  doneColors: string[];
  /** 젓기 진행 0~1 */
  stir: number;
  finishColor: string;
  showStick: boolean;
  /** 막대 위치·기울기를 화면 렌더 없이 직접 바꾸려고 쓰는 ref */
  stickRef?: Ref<SVGGElement>;
  swirlRef?: Ref<SVGGElement>;
  /** 완성 순간의 짧은 빛 (한 번) */
  burst?: boolean;
}) {
  const base = "#8fa5cf";
  const mixed = doneColors.length ? doneColors.reduce((acc, c) => mixColor(acc, c, 0.5), base) : base;
  const surface = stir > 0 ? mixColor(mixed, finishColor, stir) : mixed;
  const sparkleCount = Math.min(6, Math.floor(stir * 6));
  const { cx, cy, rx, ry } = LIQUID;
  const v = CAULDRON_VIEWBOX;
  return (
    <svg viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} className={`cauldron ${stir >= 1 ? "is-finished" : ""}`} aria-hidden="true">
      <defs>
        <linearGradient id="potIron" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a2340" />
          <stop offset="0.35" stopColor="#4a4068" />
          <stop offset="1" stopColor="#221c36" />
        </linearGradient>
        <linearGradient id="potBrass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d27a" />
          <stop offset="1" stopColor="#a87a2a" />
        </linearGradient>
        <radialGradient id="fireGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 불 */}
      <ellipse cx="150" cy="228" rx="110" ry="26" fill="url(#fireGlow)" />
      <g className="cauldron-fire">
        <path d="M112 236 C 100 214, 120 202, 118 186 C 136 202, 142 218, 132 236 Z" fill="#ff8a3c" />
        <path d="M150 238 C 134 210, 160 196, 156 174 C 180 196, 184 218, 172 238 Z" fill="#ffc94a" />
        <path d="M188 236 C 180 216, 196 206, 194 190 C 212 206, 214 222, 206 236 Z" fill="#ff8a3c" />
      </g>
      <g stroke={LINE} strokeWidth={3}>
        <rect x="96" y="232" width="116" height="12" rx="6" fill="#6b4430" transform="rotate(-6 154 238)" />
        <rect x="92" y="234" width="116" height="12" rx="6" fill="#8a5a3c" transform="rotate(7 150 240)" />
      </g>
      {/* 다리 */}
      <path d="M78 196 L64 238 M222 196 L236 238 M150 214 L150 240" stroke={LINE} strokeWidth={11} strokeLinecap="round" />
      <path d="M78 196 L64 238 M222 196 L236 238 M150 214 L150 240" stroke="#3a3150" strokeWidth={6} strokeLinecap="round" />
      {/* 솥 몸통 */}
      <path d="M36 96 C 28 172, 80 220, 150 220 C 220 220, 272 172, 264 96 Z" fill="url(#potIron)" stroke={LINE} strokeWidth={5} strokeLinejoin="round" />
      <path d="M44 140 C 70 152, 230 152, 256 140" fill="none" stroke="url(#potBrass)" strokeWidth={9} />
      <path d="M44 140 C 70 152, 230 152, 256 140" fill="none" stroke={LINE} strokeWidth={2} opacity="0.5" />
      <g fill="url(#potBrass)" stroke={LINE} strokeWidth={1.5}>
        <circle cx="80" cy="148" r="4" /><circle cx="150" cy="152" r="4" /><circle cx="220" cy="148" r="4" />
      </g>
      <path d="M58 114 C 58 156, 90 190, 128 200" fill="none" stroke="#6a5f8e" strokeWidth={8} strokeLinecap="round" opacity="0.7" />
      {/* 손잡이 고리 */}
      <path d="M30 104 c -16 2, -18 26, 0 26" fill="none" stroke={LINE} strokeWidth={7} />
      <path d="M270 104 c 16 2, 18 26, 0 26" fill="none" stroke={LINE} strokeWidth={7} />
      {/* 테두리 */}
      <ellipse cx="150" cy="96" rx="120" ry="31" fill="url(#potBrass)" stroke={LINE} strokeWidth={5} />
      <ellipse cx="150" cy="98" rx="104" ry="24" fill="#2a2340" />
      {/* 액체 */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={surface} className="cauldron-liquid" />
      <ellipse cx={cx} cy={cy - 6} rx={rx * 0.7} ry={ry * 0.4} fill="#ffffff" opacity="0.18" />
      {/* 소용돌이: 젓는 방향을 따라 돈다 */}
      <g transform={`translate(${cx} ${cy}) scale(1 ${ry / rx})`}>
        <g ref={swirlRef} className="cauldron-swirl" opacity={stir > 0 || showStick ? 0.55 : 0}>
          <path d="M-70 0 A70 70 0 0 1 0 -70" fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" />
          <path d="M70 0 A70 70 0 0 1 0 70" fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" />
          <path d="M-36 0 A36 36 0 0 1 0 -36" fill="none" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" opacity="0.7" />
          <path d="M36 0 A36 36 0 0 1 0 36" fill="none" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" opacity="0.7" />
        </g>
      </g>
      {doneColors.map((c, i) => (
        <circle key={i} className="cauldron-bubble" style={{ animationDelay: `${i * 0.7}s` }} cx={118 + i * 60} cy={98} r={6} fill={c} stroke="#ffffff" strokeWidth={1.5} opacity="0.9" />
      ))}
      <g className="cauldron-sparkles" fill="#fff7c2">
        {Array.from({ length: sparkleCount }, (_, i) => (
          <path key={i} transform={`translate(${86 + i * 26} ${66 - (i % 2) * 16}) scale(${1.2 + (i % 3) * 0.3})`} d={STAR} />
        ))}
      </g>
      {burst && <circle className="cauldron-burst" cx={cx} cy={cy - 10} r={60} fill="none" stroke="#fff3c4" strokeWidth={6} />}
      {/* 젓는 막대: 끝이 액체 표면에 닿아 있다. 위치는 stickRef로 직접 바꾼다 */}
      {showStick && (
        <g ref={stickRef} className="stir-stick" transform={`translate(${cx} ${cy})`}>
          <ellipse className="stir-ripple" cx="0" cy="0" rx="18" ry="5" fill="none" stroke="#ffffff" strokeWidth={2.5} opacity="0.7" />
          <g className="stir-stick-body">
            <rect x="-26" y="-150" width="52" height="150" fill="transparent" />
            <rect x="-7" y="-138" width="14" height="138" rx="7" fill="#b07a4a" stroke={LINE} strokeWidth={3} />
            <rect x="-6" y="-18" width="12" height="18" rx="5" fill="#6b4430" />
            <path d="M-3 -126 V -30" stroke="#d6a174" strokeWidth={3} strokeLinecap="round" opacity="0.8" />
            <rect x="-9" y="-112" width="18" height="8" rx="3" fill="url(#potBrass)" stroke={LINE} strokeWidth={2} />
            <circle cx="0" cy="-142" r="10" fill="#8a5a3c" stroke={LINE} strokeWidth={3} />
          </g>
        </g>
      )}
    </svg>
  );
}
