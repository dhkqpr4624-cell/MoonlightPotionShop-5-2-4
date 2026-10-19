/**
 * 바람 걸음 포션 재료 그림 (코드로 그린 SVG, 위에서 내려다본 시점).
 *  - 깃털풀: 가운데 잎줄기에서 가늘고 길게 갈라진 잎 조각이 깃털처럼 퍼진 연녹색 풀. 기력초(둥근 잎·묶은 다발)와 구분된다.
 *  - 바람 정령의 파편: 가볍고 투명한 청록·하늘색 결정 조각. 면마다 밝기가 다르고, 주변에 바람 결이 흐른다.
 * 서랍 안 더미(…Pile)는 viewBox 180×136(서랍 칸 비율), 집었을 때 아이콘(…Icon)은 80×80.
 */
import { useId } from "react";

const F = {
  line: "#2f4a26",
  rachis: "#8aa65a",
  barb: "#c3ec8f",
  barbLight: "#e4fbc0",
  barbShade: "#94cf6c",
  glow: "#f4ffd8",
};

/** 깃털 잎 하나: 길이 len, 끝이 +y 방향. 잎줄기 양쪽으로 가늘게 갈라진 조각(barb)이 앞쪽으로 비스듬히 뻗는다 */
function FeatherLeaf({ x, y, len, rot, bend = 1, tone = 0 }: { x: number; y: number; len: number; rot: number; bend?: number; tone?: number }) {
  const n = 9;
  const barbs = [];
  const fill = tone === 1 ? F.barbShade : F.barb;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.7) / (n + 0.4);
    const cx = Math.sin(t * Math.PI) * 3 * bend;
    const cy = t * len;
    const w = len * (0.2 - t * 0.12); // 아래쪽 조각이 더 길다
    for (const side of [-1, 1]) {
      const tipX = cx + side * w;
      const tipY = cy + w * 0.75;
      barbs.push(
        <path
          key={`${i}${side}`}
          d={`M${cx} ${cy - 1.5} C ${cx + side * w * 0.4} ${cy - 2.5}, ${tipX - side * 1.5} ${tipY - w * 0.4}, ${tipX} ${tipY} C ${tipX - side * w * 0.45} ${tipY - w * 0.12}, ${cx + side * 1.5} ${cy + 2.4}, ${cx} ${cy + 2.2} Z`}
          fill={(i + (side > 0 ? 1 : 0)) % 3 === 0 ? F.barbLight : fill}
          stroke={F.line}
          strokeWidth={0.9}
          strokeLinejoin="round"
        />,
      );
    }
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      {barbs}
      <path d={`M0 0 Q ${4 * bend} ${len * 0.5}, 0 ${len}`} fill="none" stroke={F.line} strokeWidth={2.8} strokeLinecap="round" />
      <path d={`M0 0 Q ${4 * bend} ${len * 0.5}, 0 ${len}`} fill="none" stroke={F.rachis} strokeWidth={1.4} strokeLinecap="round" />
      {/* 끝의 보송한 깃 */}
      <path d={`M0 ${len} C 4 ${len + 4}, 3 ${len + 9}, 0 ${len + 12} C -3 ${len + 9}, -4 ${len + 4}, 0 ${len} Z`} fill={F.barbLight} stroke={F.line} strokeWidth={0.9} />
    </g>
  );
}

/** 서랍 안 깃털풀 더미: 깃털 잎들이 부채꼴로 가볍게 놓여 있다 */
export function FeatherGrassPile({ width, height, picked = false }: { width: number; height: number; picked?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="herb-pile feather-pile" viewBox="0 0 180 136" width={width} height={height} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-shade`} cx="0.5" cy="0.55" r="0.55">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={F.glow} stopOpacity="0.6" />
          <stop offset="1" stopColor={F.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="90" cy="74" rx="82" ry="50" fill={`url(#${id}-shade)`} />
      {picked && <ellipse cx="90" cy="70" rx="88" ry="60" fill={`url(#${id}-glow)`} />}
      {/* 밑동이 아래 가운데에 모이고 잎이 위로 부채처럼 퍼진다 */}
      <FeatherLeaf x={84} y={122} rot={-208} len={100} bend={-1} tone={1} />
      <FeatherLeaf x={90} y={124} rot={-152} len={98} bend={1} tone={1} />
      <FeatherLeaf x={86} y={124} rot={-236} len={84} bend={-1} />
      <FeatherLeaf x={92} y={124} rot={-124} len={86} bend={1} />
      <FeatherLeaf x={88} y={124} rot={-182} len={108} bend={1} />
      <FeatherLeaf x={88} y={124} rot={-166} len={92} bend={-1} tone={1} />
      {/* 따로 떨어진 깃 하나 */}
      <FeatherLeaf x={26} y={30} rot={-60} len={40} bend={1} />
      {/* 가볍게 떠오르는 깃털 조각 */}
      {[[132, 22], [44, 96], [150, 104]].map(([cx, cy], i) => (
        <path key={i} className="herb-spark" style={{ animationDelay: `${i * 0.6}s` }}
          d={`M${cx} ${cy} c 3 -3, 8 -3, 10 0 c -3 2, -7 2, -10 0 Z`} fill={F.glow} stroke={F.line} strokeWidth={0.6} />
      ))}
    </svg>
  );
}

/** 집었을 때·떨어질 때 쓰는 깃털풀 아이콘 */
export function FeatherGrassIcon({ size = 64 }: { size?: number }) {
  return (
    <svg className="herb-icon" viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
      <FeatherLeaf x={34} y={74} rot={-200} len={62} bend={-1} tone={1} />
      <FeatherLeaf x={42} y={74} rot={-160} len={60} bend={1} />
      <FeatherLeaf x={38} y={76} rot={-180} len={66} bend={1} />
    </svg>
  );
}

/* ---------------- 바람 정령의 파편 ---------------- */

const W = {
  line: "#174652",
  light: "#effeff",
  mid: "#8fe3ee",
  deep: "#2fa6bd",
  sky: "#9fd2ff",
  wind: "#e4fbff",
};

/** 결정 한 조각: 길쭉한 다면체를 위에서 본 모양. 세 면을 서로 다른 밝기로 칠해 입체감을 낸다 */
function Shard({ x, y, s, rot, id, tilt = 0 }: { x: number; y: number; s: number; rot: number; id: string; tilt?: number }) {
  // 꼭짓점: 위 끝(0,-1) · 오른쪽 어깨 · 아래 끝 · 왼쪽 어깨, 가운데 능선
  const k = 0.34 + tilt * 0.06;
  const top = "0 -1";
  const right = `${k} -0.18`;
  const bottom = "0.06 0.92";
  const left = `${-k * 0.86} -0.05`;
  const ridge = "0.04 -0.12";
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <polygon points={`${top} ${right} ${bottom} ${left}`} fill={`url(#${id}-body)`} stroke={W.line} strokeWidth={0.06} strokeLinejoin="round" opacity={0.95} />
      <polygon points={`${top} ${ridge} ${left}`} fill={W.light} opacity={0.75} />
      <polygon points={`${top} ${right} ${ridge}`} fill={W.mid} opacity={0.55} />
      <polygon points={`${ridge} ${right} ${bottom}`} fill={W.deep} opacity={0.38} />
      <polyline points={`${top} ${ridge} ${bottom}`} fill="none" stroke={W.light} strokeWidth={0.035} opacity={0.9} />
      <path d={`M${-k * 0.5} -0.4 L ${-k * 0.2} -0.7`} stroke="#ffffff" strokeWidth={0.06} strokeLinecap="round" opacity={0.95} />
    </g>
  );
}

function ShardDefs({ id }: { id: string }) {
  return (
    <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={W.light} stopOpacity="0.95" />
      <stop offset="0.45" stopColor={W.mid} stopOpacity="0.88" />
      <stop offset="1" stopColor={W.deep} stopOpacity="0.85" />
    </linearGradient>
  );
}

/** 서랍 안 바람 정령의 파편 더미: 투명한 결정 조각들과 그 위를 감도는 바람 결 */
export function WindShardPile({ width, height, picked = false }: { width: number; height: number; picked?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="herb-pile shard-pile" viewBox="0 0 180 136" width={width} height={height} aria-hidden="true">
      <defs>
        <ShardDefs id={id} />
        <radialGradient id={`${id}-shade`} cx="0.5" cy="0.58" r="0.55">
          <stop offset="0" stopColor="#001820" stopOpacity="0.3" />
          <stop offset="1" stopColor="#001820" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={W.wind} stopOpacity="0.7" />
          <stop offset="1" stopColor={W.wind} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="90" cy="80" rx="78" ry="44" fill={`url(#${id}-shade)`} />
      <ellipse cx="90" cy="76" rx="70" ry="40" fill={`url(#${id}-glow)`} opacity={picked ? 1 : 0.45} />
      {/* 바람 결 (뒤) */}
      <path className="wind-curl" d="M18 70 C 40 40, 86 34, 108 52 C 122 64, 112 82, 98 76 C 88 72, 92 60, 104 62" fill="none" stroke={W.wind} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <Shard x={58} y={74} s={42} rot={-26} id={id} />
      <Shard x={108} y={66} s={50} rot={16} id={id} tilt={1} />
      <Shard x={146} y={92} s={30} rot={62} id={id} />
      <Shard x={86} y={106} s={28} rot={-84} id={id} tilt={1} />
      <Shard x={30} y={104} s={20} rot={40} id={id} />
      <Shard x={154} y={44} s={18} rot={-20} id={id} tilt={1} />
      <Shard x={122} y={116} s={15} rot={110} id={id} />
      {/* 바람 결 (앞) */}
      <path className="wind-curl" style={{ animationDelay: "0.8s" }} d="M70 122 C 96 126, 140 118, 160 96 C 168 86, 160 74, 150 80" fill="none" stroke={W.wind} strokeWidth={2.4} strokeLinecap="round" opacity={0.65} />
      <path d="M24 44 C 34 38, 46 38, 54 44" fill="none" stroke={W.wind} strokeWidth={2} strokeLinecap="round" opacity={0.55} />
      {[[30, 60], [158, 40], [120, 30], [56, 120]].map(([cx, cy], i) => (
        <path key={i} className="herb-spark" style={{ animationDelay: `${i * 0.45}s` }}
          d={`M${cx} ${cy - 4} L${cx + 1.2} ${cy - 1.2} L${cx + 4} ${cy} L${cx + 1.2} ${cy + 1.2} L${cx} ${cy + 4} L${cx - 1.2} ${cy + 1.2} L${cx - 4} ${cy} L${cx - 1.2} ${cy - 1.2} Z`}
          fill="#ffffff" />
      ))}
    </svg>
  );
}

/** 집었을 때·떨어질 때 쓰는 바람 정령의 파편 아이콘 */
export function WindShardIcon({ size = 64 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="herb-icon shard-icon" viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
      <defs>
        <ShardDefs id={id} />
      </defs>
      <path d="M8 56 C 18 40, 44 36, 56 46 C 64 54, 56 64, 48 60" fill="none" stroke="#9fe9f2" strokeWidth={3} strokeLinecap="round" />
      <Shard x={34} y={40} s={28} rot={-16} id={id} tilt={1} />
      <Shard x={56} y={50} s={17} rot={34} id={id} />
      <Shard x={18} y={58} s={11} rot={-50} id={id} />
    </svg>
  );
}
