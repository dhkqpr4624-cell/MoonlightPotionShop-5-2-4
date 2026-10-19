/**
 * 기력초 그림 (코드로 그린 SVG). 서랍 안 더미와, 집었을 때 따라다니는 작은 다발.
 * 위에서 내려다본 시점: 줄기가 눕혀진 약초 가지 여러 개가 겹쳐 쌓인 모습.
 * 잎은 손으로 잡은 곡선(잎맥 포함)이고, 단순한 원이나 이모지가 아니다.
 */
import { useId } from "react";

const C = {
  line: "#22392a",
  stem: "#6b7d3c",
  leaf: "#58ad6a",
  leafLight: "#a9d98d",
  leafDark: "#2f7347",
  leafMid: "#73bf72",
  bud: "#d6ec7c",
  glow: "#eaffb0",
};

/** 잎 하나 (길이 1 기준, 끝이 +y 방향). 바깥 곡선은 좌우가 살짝 다르다 */
const LEAF = "M0 0 C 0.34 0.16, 0.42 0.52, 0.06 1 C -0.36 0.6, -0.34 0.2, 0 0 Z";
const VEIN = "M0 0.04 C 0.04 0.34, 0.05 0.62, 0.05 0.92";

function Leaf({ x, y, len, rot, tone = 0 }: { x: number; y: number; len: number; rot: number; tone?: number }) {
  const fill = tone === 0 ? C.leaf : tone === 1 ? C.leafDark : C.leafMid;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${len})`}>
      <path d={LEAF} fill={fill} stroke={C.line} strokeWidth={0.05} strokeLinejoin="round" />
      <path d="M0.02 0.08 C 0.18 0.24, 0.22 0.5, 0.06 0.86" fill="none" stroke={C.leafLight} strokeWidth={0.07} strokeLinecap="round" opacity={0.75} />
      <path d={VEIN} fill="none" stroke={C.leafDark} strokeWidth={0.035} strokeLinecap="round" opacity={0.8} />
    </g>
  );
}

/** 약초 가지 하나: 휘어진 줄기 + 어긋나게 붙은 잎 + 끝의 연두 꽃눈 */
function Sprig({ x, y, rot, len, flip = 1, tone = 0 }: { x: number; y: number; rot: number; len: number; flip?: number; tone?: number }) {
  const n = 7;
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.6) / n;
    const side = i % 2 === 0 ? 1 : -1;
    leaves.push(
      <Leaf key={i} x={0} y={t * len} len={len * (0.25 - t * 0.09)} rot={side * flip * (62 - t * 22) - 180} tone={(i + tone) % 3} />,
    );
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0 0 C ${4 * flip} ${len * 0.35}, ${-3 * flip} ${len * 0.7}, ${2 * flip} ${len}`} fill="none" stroke={C.line} strokeWidth={4.4} strokeLinecap="round" />
      <path d={`M0 0 C ${4 * flip} ${len * 0.35}, ${-3 * flip} ${len * 0.7}, ${2 * flip} ${len}`} fill="none" stroke={C.stem} strokeWidth={2.4} strokeLinecap="round" />
      {leaves}
      <g transform={`translate(${2 * flip} ${len})`}>
        <path d="M0 0 C 5 2, 6 9, 0 13 C -6 9, -5 2, 0 0 Z" fill={C.bud} stroke={C.line} strokeWidth={1.4} />
        <path d="M-1 3 C 1 6, 1 8, 0 10" fill="none" stroke="#a9c94a" strokeWidth={1.2} strokeLinecap="round" />
      </g>
    </g>
  );
}

/** 서랍 안 기력초 더미 (캔버스 좌표 w×h 상자 안에 그린다) */
export function EnergyHerbPile({ width, height, picked = false }: { width: number; height: number; picked?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="herb-pile" viewBox="0 0 180 136" width={width} height={height} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-shade`} cx="0.5" cy="0.55" r="0.55">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={C.glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={C.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="90" cy="76" rx="84" ry="52" fill={`url(#${id}-shade)`} />
      {picked && <ellipse cx="90" cy="70" rx="88" ry="60" fill={`url(#${id}-glow)`} />}
      {/* 줄기 쪽을 왼쪽에서 묶은 다발이 서랍 바닥에 누워 있고, 잎은 오른쪽으로 퍼진다 */}
      <Sprig x={30} y={78} rot={-58} len={128} flip={1} tone={1} />
      <Sprig x={30} y={74} rot={-118} len={118} flip={-1} tone={1} />
      <Sprig x={32} y={72} rot={-70} len={140} flip={-1} tone={2} />
      <Sprig x={32} y={70} rot={-104} len={132} flip={1} tone={0} />
      <Sprig x={34} y={70} rot={-84} len={146} flip={1} tone={2} />
      <Sprig x={30} y={68} rot={-94} len={124} flip={-1} tone={0} />
      {/* 흩어진 가지 */}
      <Sprig x={150} y={20} rot={18} len={46} flip={-1} tone={1} />
      <Sprig x={58} y={122} rot={-150} len={44} flip={1} tone={2} />
      {/* 묶은 끈 */}
      <path d="M22 62 C 30 58, 40 60, 44 66 C 40 76, 30 80, 22 76 C 18 72, 18 66, 22 62 Z" fill="#c9995a" stroke={C.line} strokeWidth={1.6} />
      <path d="M24 66 C 30 64, 36 65, 40 69" fill="none" stroke="#8a6436" strokeWidth={1.4} />
      <path d="M24 72 C 30 70, 36 71, 40 74" fill="none" stroke="#8a6436" strokeWidth={1.4} />
      {/* 기운을 내는 작은 반짝임 */}
      {[[86, 40], [148, 60], [110, 100], [160, 92], [126, 30]].map(([cx, cy], i) => (
        <path key={i} className="herb-spark" style={{ animationDelay: `${i * 0.5}s` }}
          d={`M${cx} ${cy - 4} L${cx + 1.2} ${cy - 1.2} L${cx + 4} ${cy} L${cx + 1.2} ${cy + 1.2} L${cx} ${cy + 4} L${cx - 1.2} ${cy + 1.2} L${cx - 4} ${cy} L${cx - 1.2} ${cy - 1.2} Z`}
          fill={C.glow} />
      ))}
    </svg>
  );
}

/** 집었을 때·떨어질 때 쓰는 작은 기력초 다발 */
export function EnergyHerbIcon({ size = 64 }: { size?: number }) {
  return (
    <svg className="herb-icon" viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
      <Sprig x={22} y={10} rot={-28} len={62} flip={1} />
      <Sprig x={56} y={8} rot={24} len={60} flip={-1} tone={1} />
      <Sprig x={40} y={6} rot={-4} len={66} flip={1} tone={2} />
      <path d="M33 18 C 38 14, 46 14, 49 19 C 45 24, 37 24, 33 21 Z" fill="#c9995a" stroke={C.line} strokeWidth={1.4} />
    </svg>
  );
}

/** 솥에 떨어지는 잎 조각 하나 (캔버스 좌표) */
export function FallingLeaf({ x, y, len, rot, delay }: { x: number; y: number; len: number; rot: number; delay: number }) {
  return (
    <g className="falling-leaf" style={{ animationDelay: `${delay}s` }}>
      <Leaf x={x} y={y} len={len} rot={rot} />
    </g>
  );
}
