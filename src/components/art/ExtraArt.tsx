/**
 * 새 재료 12종 그림 (코드로 그린 SVG, 위에서 내려다본 시점). 서랍 더미는 viewBox 180×136,
 * 집었을 때·끌 때 아이콘은 같은 그림의 가운데를 80×80 비율로 잘라 보여 준다(모양이 같아 알아보기 쉽다).
 * 제작대 PNG와 어울리게 진한 갈보라 윤곽선 + 부드러운 명암을 쓴다. 색 원·이모지로 대신하지 않는다.
 */
import { useId, type ReactElement, type ReactNode } from "react";

const LINE = "#2b1d24";

/** 서랍 바닥 그림자 */
function Shade({ cx = 90, cy = 82, rx = 76, ry = 42 }: { cx?: number; cy?: number; rx?: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" opacity={0.22} />;
}

/** 가루 더미: 위가 둥근 언덕 + 밝은 윗면 + 알갱이 */
function PowderHeap({ x, y, w, h, base, light, dark, grains = 14 }: { x: number; y: number; w: number; h: number; base: string; light: string; dark: string; grains?: number }) {
  const pts = Array.from({ length: grains }, (_, i) => {
    const t = (i * 0.61803) % 1;
    const u = (i * 0.3819 + 0.2) % 1;
    return [x - w / 2 + 8 + t * (w - 16), y - h * 0.15 + u * h * 0.55] as const;
  });
  return (
    <g>
      <path d={`M${x - w / 2} ${y + h * 0.35} C ${x - w * 0.42} ${y - h * 0.5}, ${x + w * 0.42} ${y - h * 0.5}, ${x + w / 2} ${y + h * 0.35} Z`} fill={base} stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d={`M${x - w * 0.3} ${y - h * 0.02} C ${x - w * 0.2} ${y - h * 0.32}, ${x + w * 0.15} ${y - h * 0.34}, ${x + w * 0.28} ${y - h * 0.06}`} fill="none" stroke={light} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
      <path d={`M${x + w * 0.18} ${y + h * 0.3} C ${x + w * 0.3} ${y + h * 0.12}, ${x + w * 0.4} ${y + h * 0.18}, ${x + w * 0.44} ${y + h * 0.3}`} fill="none" stroke={dark} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
      {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={i % 3 === 0 ? 1.8 : 1.2} fill={i % 2 ? light : dark} opacity={0.85} />)}
    </g>
  );
}

function Sparkle({ x, y, s = 1, fill = "#ffffff" }: { x: number; y: number; s?: number; fill?: string }) {
  return <path className="herb-spark" transform={`translate(${x} ${y}) scale(${s})`} d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z" fill={fill} />;
}

/** 작은 유리병(진액·수액·추출물): 둥근 몸통 + 코르크 + 액체 */
function Jar({ x, y, s = 1, liquid, glass = "#eef6f2", children }: { x: number; y: number; s?: number; liquid: string; glass?: string; children?: ReactNode }) {
  const id = useId().replace(/:/g, "");
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <defs><clipPath id={`j${id}`}><path d="M-10 -26 L-10 -18 C -24 -14, -28 -2, -28 8 C -28 22, -16 30, 0 30 C 16 30, 28 22, 28 8 C 28 -2, 24 -14, 10 -18 L10 -26 Z" /></clipPath></defs>
      <ellipse cx="0" cy="24" rx="28" ry="9" fill="#000" opacity={0.18} />
      <path d="M-10 -26 L-10 -18 C -24 -14, -28 -2, -28 8 C -28 22, -16 30, 0 30 C 16 30, 28 22, 28 8 C 28 -2, 24 -14, 10 -18 L10 -26 Z" fill={glass} opacity={0.9} />
      <g clipPath={`url(#j${id})`}>
        <rect x="-30" y="-2" width="60" height="34" fill={liquid} />
        <path d="M-30 -2 Q -15 -5 0 -2 T 30 -2 V 2 H -30 Z" fill="#fff" opacity={0.35} />
        {children}
      </g>
      <path d="M-10 -26 L-10 -18 C -24 -14, -28 -2, -28 8 C -28 22, -16 30, 0 30 C 16 30, 28 22, 28 8 C 28 -2, 24 -14, 10 -18 L10 -26 Z" fill="none" stroke={LINE} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M-19 -2 C -22 6, -21 14, -16 19" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" opacity={0.75} />
      <path d="M-11 -34 h22 l-2 9 h-18 z" fill="#b07a4a" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* 재료별 그림 (180×136 좌표)                                            */
/* ------------------------------------------------------------------ */

function OgreSinew() {
  return (
    <g>
      <Shade />
      <Jar x={70} y={70} s={1.25} liquid="#8a9a3a">
        <path d="M-20 10 C -8 4, 4 18, 20 8 M-22 20 C -6 14, 8 26, 22 18" stroke="#5a6620" strokeWidth={3} fill="none" />
      </Jar>
      {/* 꼬아 둔 힘줄 다발 */}
      <g transform="translate(128 80) rotate(-18)">
        {[-8, 0, 8].map((dy, i) => (
          <path key={i} d={`M-30 ${dy} C -18 ${dy - 8}, -6 ${dy + 8}, 6 ${dy} S 24 ${dy - 8}, 32 ${dy}`} fill="none" stroke={LINE} strokeWidth={7} strokeLinecap="round" />
        ))}
        {[-8, 0, 8].map((dy, i) => (
          <path key={`c${i}`} d={`M-30 ${dy} C -18 ${dy - 8}, -6 ${dy + 8}, 6 ${dy} S 24 ${dy - 8}, 32 ${dy}`} fill="none" stroke={i === 1 ? "#d8b48a" : "#c49a6a"} strokeWidth={4.4} strokeLinecap="round" />
        ))}
        <rect x="-4" y="-14" width="9" height="28" rx="2" fill="#7a4a2a" stroke={LINE} strokeWidth={2} />
      </g>
    </g>
  );
}

function LilyStamen() {
  return (
    <g>
      <Shade />
      {/* 은백합 꽃잎 두 장 */}
      {[[-28, 70, -30], [40, 74, 24]].map(([dx, cy, r], i) => (
        <path key={i} transform={`translate(${90 + dx} ${cy}) rotate(${r})`} d="M0 -26 C 16 -18, 18 10, 0 26 C -18 10, -16 -18, 0 -26 Z" fill="#f6f4ea" stroke={LINE} strokeWidth={2.2} />
      ))}
      <path transform="translate(62 70) rotate(-30)" d="M0 -18 V 18" stroke="#c8c6d8" strokeWidth={1.6} />
      <path transform="translate(130 74) rotate(24)" d="M0 -18 V 18" stroke="#c8c6d8" strokeWidth={1.6} />
      {/* 금빛 꽃술 묶음 */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (-70 + i * 17) * (Math.PI / 180);
        const x2 = 92 + Math.sin(a) * 44;
        const y2 = 96 - Math.cos(a) * 52;
        return (
          <g key={i}>
            <path d={`M92 100 Q ${92 + Math.sin(a) * 18} ${96 - Math.cos(a) * 30}, ${x2} ${y2}`} fill="none" stroke="#e8e2b8" strokeWidth={2.4} />
            <ellipse cx={x2} cy={y2} rx={5} ry={3.2} transform={`rotate(${-70 + i * 17} ${x2} ${y2})`} fill="#f2b632" stroke={LINE} strokeWidth={1.4} />
          </g>
        );
      })}
      <rect x="84" y="96" width="16" height="10" rx="3" fill="#b9c4d8" stroke={LINE} strokeWidth={1.8} />
      <Sparkle x={150} y={36} s={0.9} fill="#fff6c8" />
    </g>
  );
}

function LifeSap() {
  return (
    <g>
      <Shade />
      {/* 나무껍질 조각 + 흘러내린 수액 */}
      <path d="M100 52 C 128 44, 160 56, 164 78 C 166 96, 140 110, 112 106 C 96 102, 90 80, 100 52 Z" fill="#8a5a34" stroke={LINE} strokeWidth={2.2} />
      <path d="M108 62 C 124 58, 146 64, 154 76 M106 78 C 124 76, 142 82, 152 92" stroke="#5e3a20" strokeWidth={2.4} fill="none" />
      <path d="M126 66 C 126 78, 130 86, 128 96 C 126 102, 120 102, 120 96 C 120 88, 122 78, 126 66 Z" fill="#f0a63a" stroke={LINE} strokeWidth={1.6} />
      <Jar x={62} y={68} s={1.15} liquid="#e8a640" glass="#fff6e6">
        <circle cx="-8" cy="12" r="3" fill="#fff" opacity={0.6} />
        <circle cx="10" cy="20" r="2" fill="#fff" opacity={0.6} />
      </Jar>
      <path d="M44 36 C 40 28, 46 20, 56 22 C 56 30, 50 36, 44 36 Z" fill="#7ccf6a" stroke={LINE} strokeWidth={1.6} />
    </g>
  );
}

function SapphireDust() {
  return (
    <g>
      <Shade />
      <PowderHeap x={84} y={84} w={120} h={60} base="#3d6fe0" light="#a8c6ff" dark="#1d3a8a" grains={18} />
      {/* 깎은 사파이어 한 알 */}
      <g transform="translate(140 52)">
        <path d="M-18 -4 L-10 -16 L10 -16 L18 -4 L0 18 Z" fill="#2f5fd8" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />
        <path d="M-18 -4 H 18 M-10 -16 L-4 -4 L0 18 L4 -4 L10 -16" fill="none" stroke="#a8c6ff" strokeWidth={1.4} />
        <path d="M-10 -16 L-4 -4 L-18 -4 Z" fill="#7aa2ff" opacity={0.8} />
      </g>
      <Sparkle x={60} y={58} s={0.9} />
      <Sparkle x={104} y={66} s={0.7} />
      <Sparkle x={128} y={92} s={0.8} />
    </g>
  );
}

function SageWalnut() {
  return (
    <g>
      <Shade />
      <PowderHeap x={78} y={86} w={110} h={54} base="#9a6a3c" light="#d6b08a" dark="#5e3a20" grains={16} />
      {/* 호두 껍질 반쪽 두 개 */}
      {[[132, 62, -12], [150, 92, 20]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse rx="20" ry="15" fill="#7a4e2a" stroke={LINE} strokeWidth={2.2} />
          <ellipse rx="14" ry="10" fill="#c8a06a" />
          <path d="M-12 -2 C -6 -8, 0 4, 6 -4 S 12 2, 12 2 M-10 5 C -4 1, 2 9, 8 4" stroke="#7a4e2a" strokeWidth={1.8} fill="none" />
        </g>
      ))}
      {/* 현자의 잎 */}
      <path d="M40 40 C 46 26, 62 22, 70 28 C 64 40, 50 44, 40 40 Z" fill="#8cae5a" stroke={LINE} strokeWidth={1.6} />
    </g>
  );
}

function CoralPowder() {
  return (
    <g>
      <Shade />
      <PowderHeap x={80} y={86} w={118} h={56} base="#ff8f9e" light="#ffd3da" dark="#c4566a" grains={16} />
      {/* 산호 가지 조각 */}
      <g transform="translate(138 66)" fill="none" strokeLinecap="round">
        <path d="M0 26 V 4 M0 12 L-12 -2 M0 4 L10 -12 M-12 -2 L-16 -14 M10 -12 L16 -20 M10 -12 L4 -22" stroke={LINE} strokeWidth={8} />
        <path d="M0 26 V 4 M0 12 L-12 -2 M0 4 L10 -12 M-12 -2 L-16 -14 M10 -12 L16 -20 M10 -12 L4 -22" stroke="#ff6f86" strokeWidth={5} />
      </g>
      <circle cx="48" cy="46" r="5" fill="#fff" stroke="#c4566a" strokeWidth={1.4} />
      <circle cx="58" cy="40" r="3" fill="#fff" stroke="#c4566a" strokeWidth={1.2} />
    </g>
  );
}

function MermaidScale() {
  const id = useId().replace(/:/g, "");
  const scales: [number, number, number][] = [[56, 76, -20], [84, 64, 10], [112, 78, 30], [76, 96, -6], [104, 100, 18], [132, 98, 40], [62, 52, -30], [126, 54, 22]];
  return (
    <g>
      <defs>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6fffb" />
          <stop offset="0.45" stopColor="#7fe3d6" />
          <stop offset="1" stopColor="#8a8ae8" />
        </linearGradient>
      </defs>
      <Shade />
      {scales.map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M0 -20 C 16 -16, 20 4, 0 20 C -20 4, -16 -16, 0 -20 Z" fill={`url(#m${id})`} stroke={LINE} strokeWidth={2} opacity={0.95} />
          <path d="M0 -14 C 8 -10, 10 2, 0 12" fill="none" stroke="#ffffff" strokeWidth={1.6} opacity={0.8} />
          <path d="M-6 -6 C -4 -2, -4 4, -6 8" fill="none" stroke="#5a7ad8" strokeWidth={1.2} opacity={0.6} />
        </g>
      ))}
      <Sparkle x={150} y={78} s={0.9} />
      <Sparkle x={40} y={92} s={0.7} />
    </g>
  );
}

function DragonScale() {
  return (
    <g>
      <Shade />
      <PowderHeap x={80} y={88} w={116} h={56} base="#d8402c" light="#ff9a6a" dark="#7a1a14" grains={16} />
      {/* 붉은 비늘 조각 */}
      {[[136, 58, 20], [152, 90, -14], [44, 50, -30]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${i === 2 ? 0.7 : 1})`}>
          <path d="M0 -16 L14 -4 L10 14 L-10 14 L-14 -4 Z" fill="#b82a1e" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />
          <path d="M0 -10 L8 -2 L6 10 M0 -10 L-8 -2 L-6 10" fill="none" stroke="#ff8a5a" strokeWidth={1.6} />
        </g>
      ))}
      <path d="M100 52 C 96 44, 104 38, 100 30" fill="none" stroke="#ffb07a" strokeWidth={2} opacity={0.7} strokeLinecap="round" />
    </g>
  );
}

function SulfurStone() {
  const rocks: [number, number, number, number][] = [[70, 80, 1.2, -10], [116, 72, 1, 18], [96, 100, 0.85, 40], [140, 98, 0.7, -20], [48, 102, 0.6, 30]];
  return (
    <g>
      <Shade />
      {rocks.map(([x, y, s, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
          <path d="M-22 6 L-16 -14 L2 -22 L20 -12 L24 6 L8 20 L-12 18 Z" fill="#e8c53a" stroke={LINE} strokeWidth={2.4} strokeLinejoin="round" />
          <path d="M-16 -14 L-2 -4 L2 -22 M-2 -4 L20 -12 M-2 -4 L8 20 M-2 -4 L-22 6" fill="none" stroke="#a8861a" strokeWidth={1.6} />
          <path d="M-14 -10 L-4 -6 L0 -18 Z" fill="#fff6a8" opacity={0.85} />
        </g>
      ))}
      {/* 피어오르는 김 */}
      <path className="wind-curl" d="M84 50 C 78 40, 92 34, 86 22 M112 46 C 106 36, 120 30, 114 18" fill="none" stroke="#fff2c8" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

function NightBloom() {
  const flowers: [number, number, number][] = [[64, 70, 1.05], [116, 64, 0.95], [92, 98, 0.85]];
  return (
    <g>
      <Shade />
      <path d="M64 70 C 76 94, 88 104, 92 98 M116 64 C 110 86, 100 98, 92 98 M92 98 C 92 112, 96 118, 100 122" fill="none" stroke="#2c4a2a" strokeWidth={3} />
      <path d="M118 104 C 128 92, 146 92, 152 100 C 142 110, 128 110, 118 104 Z" fill="#3a5a34" stroke={LINE} strokeWidth={1.6} />
      {flowers.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          {[0, 60, 120, 180, 240, 300].map((r) => (
            <path key={r} transform={`rotate(${r})`} d="M0 0 C 8 -6, 10 -20, 0 -26 C -10 -20, -8 -6, 0 0 Z" fill="#2a1838" stroke={LINE} strokeWidth={1.8} />
          ))}
          {[30, 150, 270].map((r) => (
            <path key={`h${r}`} transform={`rotate(${r})`} d="M0 -6 C 3 -10, 3 -16, 0 -20" fill="none" stroke="#8a5ad0" strokeWidth={1.6} />
          ))}
          <circle r="5" fill="#c9b0ff" stroke={LINE} strokeWidth={1.4} />
          <circle r="2" fill="#fff" />
        </g>
      ))}
      <Sparkle x={148} y={40} s={0.8} fill="#e6dcff" />
    </g>
  );
}

function ChameleonTail() {
  const id = useId().replace(/:/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`c${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7ac47a" />
          <stop offset="0.5" stopColor="#e8c24a" />
          <stop offset="1" stopColor="#e86a8a" />
        </linearGradient>
      </defs>
      <Shade />
      {/* 돌돌 만 꼬리 모양 무늬의 받침 */}
      <path d="M118 104 C 150 104, 162 80, 150 64 C 140 52, 120 58, 124 72 C 128 82, 142 78, 140 70" fill="none" stroke={LINE} strokeWidth={9} strokeLinecap="round" />
      <path d="M118 104 C 150 104, 162 80, 150 64 C 140 52, 120 58, 124 72 C 128 82, 142 78, 140 70" fill="none" stroke={`url(#c${id})`} strokeWidth={6} strokeLinecap="round" />
      <Jar x={70} y={72} s={1.2} liquid={`url(#c${id})`}>
        <circle cx="-6" cy="12" r="4" fill="#fff" opacity={0.45} />
        <circle cx="12" cy="6" r="2.4" fill="#fff" opacity={0.45} />
      </Jar>
    </g>
  );
}

function ShadowDust() {
  return (
    <g>
      <Shade />
      <PowderHeap x={90} y={88} w={120} h={58} base="#4a3a66" light="#9a86c8" dark="#1e1430" grains={18} />
      {/* 피어오르는 그림자 기운 */}
      <path className="wind-curl" d="M60 60 C 50 46, 66 36, 58 22 M96 56 C 88 40, 106 32, 98 16 M128 62 C 122 48, 136 40, 130 28" fill="none" stroke="#6a5a9a" strokeWidth={4} strokeLinecap="round" opacity={0.75} />
      <Sparkle x={72} y={76} s={0.6} fill="#d8ccff" />
      <Sparkle x={112} y={82} s={0.7} fill="#d8ccff" />
    </g>
  );
}

const ART: Record<string, () => ReactElement> = {
  ogreSinew: OgreSinew,
  lilyStamen: LilyStamen,
  lifeSap: LifeSap,
  sapphireDust: SapphireDust,
  sageWalnut: SageWalnut,
  coralPowder: CoralPowder,
  mermaidScale: MermaidScale,
  dragonScale: DragonScale,
  sulfurStone: SulfurStone,
  nightBloom: NightBloom,
  chameleonTail: ChameleonTail,
  shadowDust: ShadowDust,
};

export function hasExtraArt(id: string): boolean {
  return id in ART;
}

/** 서랍 안 재료 더미 */
export function ExtraPile({ id, width, height, picked = false }: { id: string; width: number; height: number; picked?: boolean }) {
  const Draw = ART[id];
  return (
    <svg className={`herb-pile extra-pile pile-${id}`} viewBox="0 0 180 136" width={width} height={height} aria-hidden="true">
      {picked && <ellipse cx="90" cy="70" rx="88" ry="60" fill="#fff6c8" opacity={0.35} />}
      {Draw && <Draw />}
    </svg>
  );
}

/** 집었을 때·끌 때 아이콘 (같은 그림의 가운데) */
export function ExtraIcon({ id, size = 64 }: { id: string; size?: number }) {
  const Draw = ART[id];
  return (
    <svg className={`herb-icon extra-icon icon-${id}`} viewBox="22 14 136 120" width={size} height={size} aria-hidden="true">
      {Draw && <Draw />}
    </svg>
  );
}
