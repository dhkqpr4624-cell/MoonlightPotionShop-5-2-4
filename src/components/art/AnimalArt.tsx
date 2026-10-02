/**
 * 손님 그래픽 (직접 제작한 SVG, 교체 가능).
 * 종마다 머리 모양·주둥이·귀·꼬리·옷차림이 다르다. 얼굴 부품(눈·눈썹·입)만 공통으로 쓰고 위치는 종마다 정한다.
 *  - 여우 코코: 풍성한 꼬리, 뾰족한 주둥이, 작은 목도리
 *  - 토끼 보리: 긴 귀, 둥근 얼굴과 앞니, 둥근 앞치마
 *  - 고양이 나비: 줄무늬, 수염, 작은 모자와 가방끈
 *  - 늑대 달이: 긴 주둥이, 넓은 어깨, 단정한 외투
 * 표정(mood): order(기본 주문) · explain(쉽게 다시 설명) · happy(만족) · meh(조금 아쉬움) · sad(불만족, 화내지 않고 아쉬운 표정)
 * 최종 그림이 생기면 data/customers.ts 의 image 에 경로를 넣으면 이 그림 대신 쓰인다.
 */
import type { ReactNode } from "react";
import type { Species } from "../../data/customers.ts";

export type Mood = "order" | "explain" | "happy" | "meh" | "sad";

const LINE = "#2b1d3a";
const SW = 3.5;

interface Face {
  /** 왼눈·오른눈 x, 눈 y */
  lx: number;
  rx: number;
  ey: number;
  /** 입 중심 */
  mx: number;
  my: number;
  /** 눈 주변 털색 (눈 깜박임 눈꺼풀) */
  lid: string;
}

/* ------------------------------ 공통 얼굴 ------------------------------ */

function Eyes({ f, mood }: { f: Face; mood: Mood }) {
  if (mood === "happy") {
    return (
      <g fill="none" stroke={LINE} strokeWidth={4.5} strokeLinecap="round">
        <path d={`M${f.lx - 11} ${f.ey + 3} Q ${f.lx} ${f.ey - 10} ${f.lx + 11} ${f.ey + 3}`} />
        <path d={`M${f.rx - 11} ${f.ey + 3} Q ${f.rx} ${f.ey - 10} ${f.rx + 11} ${f.ey + 3}`} />
      </g>
    );
  }
  const ry = mood === "meh" ? 7 : mood === "sad" ? 9 : 11;
  const dy = mood === "meh" ? 3 : 0;
  return (
    <g>
      {[f.lx, f.rx].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={f.ey + dy} rx={8.5} ry={ry} fill={LINE} />
          <circle cx={x + 3} cy={f.ey + dy - ry / 2.4} r={3} fill="#fff" />
          <circle cx={x - 2.5} cy={f.ey + dy + ry / 2.6} r={1.4} fill="#fff" opacity="0.8" />
        </g>
      ))}
      {mood === "meh" && (
        <g stroke={LINE} strokeWidth={3} strokeLinecap="round">
          <path d={`M${f.lx - 10} ${f.ey - 3} H ${f.lx + 10}`} />
          <path d={`M${f.rx - 10} ${f.ey - 3} H ${f.rx + 10}`} />
        </g>
      )}
      {/* 눈 깜박임 */}
      <g className="npc-lids" fill={f.lid}>
        <ellipse cx={f.lx} cy={f.ey + dy} rx={10} ry={ry + 2} />
        <ellipse cx={f.rx} cy={f.ey + dy} rx={10} ry={ry + 2} />
      </g>
    </g>
  );
}

function Brows({ f, mood }: { f: Face; mood: Mood }) {
  const y = f.ey - 22;
  const p =
    mood === "sad"
      ? [`M${f.lx - 11} ${y + 2} L ${f.lx + 9} ${y - 6}`, `M${f.rx + 11} ${y + 2} L ${f.rx - 9} ${y - 6}`]
      : mood === "explain"
        ? [`M${f.lx - 11} ${y - 2} Q ${f.lx} ${y - 10} ${f.lx + 10} ${y - 3}`, `M${f.rx - 10} ${y - 3} Q ${f.rx} ${y - 10} ${f.rx + 11} ${y - 2}`]
        : mood === "meh"
          ? [`M${f.lx - 10} ${y + 2} H ${f.lx + 10}`, `M${f.rx - 10} ${y - 2} Q ${f.rx} ${y - 6} ${f.rx + 10} ${y - 1}`]
          : [`M${f.lx - 9} ${y} Q ${f.lx} ${y - 5} ${f.lx + 9} ${y}`, `M${f.rx - 9} ${y} Q ${f.rx} ${y - 5} ${f.rx + 9} ${y}`];
  return (
    <g fill="none" stroke={LINE} strokeWidth={3} strokeLinecap="round" opacity="0.85">
      {p.map((d) => <path key={d} d={d} />)}
    </g>
  );
}

function Mouth({ f, mood, teeth }: { f: Face; mood: Mood; teeth?: boolean }) {
  const { mx: x, my: y } = f;
  switch (mood) {
    case "happy":
      return (
        <g>
          <path d={`M${x - 14} ${y - 2} Q ${x} ${y + 20} ${x + 14} ${y - 2} Z`} fill="#b8405a" stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M${x - 7} ${y + 8} Q ${x} ${y + 4} ${x + 7} ${y + 8} Q ${x} ${y + 14} ${x - 7} ${y + 8} Z`} fill="#f08aa0" />
          {teeth && <rect x={x - 5} y={y - 2} width={10} height={6} fill="#fff" stroke={LINE} strokeWidth={1.5} />}
        </g>
      );
    case "explain":
      return (
        <g>
          <path d={`M${x - 10} ${y} Q ${x} ${y + 13} ${x + 10} ${y} Z`} fill="#b8405a" stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
          {teeth && <rect x={x - 5} y={y} width={10} height={5} fill="#fff" stroke={LINE} strokeWidth={1.5} />}
        </g>
      );
    case "meh":
      return <path d={`M${x - 10} ${y + 4} Q ${x - 4} ${y} ${x} ${y + 3} Q ${x + 5} ${y + 6} ${x + 10} ${y + 2}`} fill="none" stroke={LINE} strokeWidth={3} strokeLinecap="round" />;
    case "sad":
      return <path d={`M${x - 9} ${y + 7} Q ${x} ${y - 2} ${x + 9} ${y + 7}`} fill="none" stroke={LINE} strokeWidth={3} strokeLinecap="round" />;
    default:
      return (
        <g>
          <path d={`M${x - 10} ${y} Q ${x - 5} ${y + 7} ${x} ${y} Q ${x + 5} ${y + 7} ${x + 10} ${y}`} fill="none" stroke={LINE} strokeWidth={3} strokeLinecap="round" />
          {teeth && <rect x={x - 4.5} y={y + 1} width={9} height={6} rx={1} fill="#fff" stroke={LINE} strokeWidth={1.5} />}
        </g>
      );
  }
}

function Cheeks({ f, color = "#ff8fa3" }: { f: Face; color?: string }) {
  return (
    <g fill={color} opacity="0.55">
      <ellipse cx={f.lx - 14} cy={f.ey + 22} rx={10} ry={6} />
      <ellipse cx={f.rx + 14} cy={f.ey + 22} rx={10} ry={6} />
    </g>
  );
}

function Sparkles({ show }: { show: boolean }) {
  if (!show) return null;
  const star = "M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z";
  return (
    <g className="npc-sparkles" fill="#ffe27a" stroke={LINE} strokeWidth={1.5}>
      <path transform="translate(40 70)" d={star} />
      <path transform="translate(206 84) scale(0.8)" d={star} />
      <path transform="translate(196 40) scale(0.6)" d={star} />
    </g>
  );
}

/* ------------------------------ 종별 ------------------------------ */

interface SpeciesParts {
  tail: ReactNode;
  body: ReactNode;
  earsBack: (mood: Mood) => ReactNode;
  head: ReactNode;
  front?: ReactNode;
  face: Face;
  teeth?: boolean;
  extraFace?: ReactNode;
}

function fox(): SpeciesParts {
  const fur = "#f08a3a";
  const cream = "#fff1dc";
  const dark = "#6e3423";
  return {
    tail: (
      <g className="npc-tail" style={{ transformOrigin: "170px 250px" }}>
        <path d="M168 262 C 232 258, 248 176, 220 128 C 214 168, 194 196, 156 214 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M220 128 C 230 150, 228 166, 216 180 C 206 166, 206 146, 220 128 Z" fill={cream} stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
      </g>
    ),
    body: (
      <g>
        <path d="M54 290 C 54 226, 84 196, 120 196 C 156 196, 186 226, 186 290 Z" fill={fur} stroke={LINE} strokeWidth={SW} />
        <path d="M94 290 C 94 246, 104 220, 120 220 C 136 220, 146 246, 146 290 Z" fill={cream} />
        {/* 목도리 */}
        <path d="M76 196 C 100 214, 140 214, 164 196 L 168 214 C 140 232, 100 232, 72 214 Z" fill="#2fa59a" stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M84 204 l4 12 M100 210 l3 12 M118 212 l1 12 M136 210 l-2 12 M152 204 l-3 12" stroke="#1f7a72" strokeWidth={2.5} />
        <path d="M140 220 L 152 258 L 132 252 Z" fill="#2fa59a" stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
        <path d="M134 252 l4 8 M142 254 l3 8" stroke="#1f7a72" strokeWidth={2} />
      </g>
    ),
    earsBack: (mood) => {
      const droop = mood === "sad" ? 14 : 0;
      return (
        <g>
          <g transform={`rotate(${-droop} 76 70)`}>
            <path d="M62 86 L 56 14 L 112 56 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
            <path d="M68 74 L 62 32 L 98 58 Z" fill={dark} />
          </g>
          <g transform={`rotate(${droop} 164 70)`}>
            <path d="M178 86 L 184 14 L 128 56 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
            <path d="M172 74 L 178 32 L 142 58 Z" fill={dark} />
          </g>
        </g>
      );
    },
    head: (
      <g>
        {/* 넓은 볼털이 양옆으로 뻗은 여우 얼굴 */}
        <path d="M120 46 C 166 46, 190 78, 192 108 L 206 138 L 180 136 C 168 162, 146 174, 120 174 C 94 174, 72 162, 60 136 L 34 138 L 48 108 C 50 78, 74 46, 120 46 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M60 128 C 76 150, 96 160, 120 162 C 144 160, 164 150, 180 128 C 162 132, 146 122, 120 124 C 94 122, 78 132, 60 128 Z" fill={cream} />
        <path d="M120 124 C 108 136, 106 146, 120 158 C 134 146, 132 136, 120 124 Z" fill={cream} />
      </g>
    ),
    extraFace: <path d="M111 128 Q 120 122 129 128 Q 126 138 120 139 Q 114 138 111 128 Z" fill={LINE} />,
    face: { lx: 96, rx: 144, ey: 106, mx: 120, my: 146, lid: fur },
  };
}

function rabbit(): SpeciesParts {
  const fur = "#ece5dc";
  const shade = "#d6ccc0";
  const pink = "#f4a7b9";
  return {
    tail: <circle cx="194" cy="250" r="20" fill="#fffaf3" stroke={LINE} strokeWidth={SW} />,
    body: (
      <g>
        <path d="M58 290 C 58 230, 86 198, 120 198 C 154 198, 182 230, 182 290 Z" fill={fur} stroke={LINE} strokeWidth={SW} />
        {/* 둥근 앞치마 */}
        <path d="M80 214 C 96 206, 144 206, 160 214 L 162 290 L 78 290 Z" fill="#7fb4d8" stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M80 214 C 70 206, 72 196, 84 196 M160 214 C 170 206, 168 196, 156 196" fill="none" stroke={LINE} strokeWidth={3} strokeLinecap="round" />
        <path d="M100 240 h40 v22 q0 8 -8 8 h-24 q-8 0 -8 -8 z" fill="#a9d0ea" stroke={LINE} strokeWidth={3} />
        {/* 주머니 속 당근 */}
        <path d="M128 240 l6 -16 l5 2 l-4 14 z" fill="#f08a3a" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
        <path d="M134 224 l-3 -7 M136 225 l3 -7" stroke="#4f9a4a" strokeWidth={3} strokeLinecap="round" />
      </g>
    ),
    earsBack: (mood) => {
      const droop = mood === "sad" ? 22 : mood === "meh" ? 8 : 0;
      return (
        <g>
          <g transform={`rotate(${-6 - droop} 92 62)`}>
            <path d="M80 62 C 66 6, 74 -40, 92 -44 C 110 -40, 114 6, 104 62 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
            <path d="M86 50 C 80 6, 84 -26, 92 -30 C 100 -26, 102 6, 98 50 Z" fill={pink} />
          </g>
          <g transform={`rotate(${8 + droop} 148 62)`}>
            {/* 오른쪽 귀는 끝이 살짝 접혔다 */}
            <path d="M136 62 C 128 10, 134 -20, 148 -24 C 162 -20, 168 10, 160 62 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
            <path d="M142 50 C 138 14, 142 -6, 148 -8 C 154 -6, 158 14, 154 50 Z" fill={pink} />
            <path d="M138 -2 C 150 -16, 164 -12, 170 2 C 160 -2, 150 -2, 138 -2 Z" fill={shade} stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
          </g>
        </g>
      );
    },
    head: (
      <g>
        <path d="M120 54 C 170 54, 188 92, 186 122 C 184 156, 156 176, 120 176 C 84 176, 56 156, 54 122 C 52 92, 70 54, 120 54 Z" fill={fur} stroke={LINE} strokeWidth={SW} />
        <ellipse cx="120" cy="146" rx="28" ry="20" fill="#fffaf3" />
        <path d="M78 66 q8 -8 18 -6" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity="0.7" />
      </g>
    ),
    extraFace: (
      <g>
        <path d="M113 134 Q 120 129 127 134 Q 124 141 120 141 Q 116 141 113 134 Z" fill="#e0708a" stroke={LINE} strokeWidth={2} />
        <path d="M120 141 V 146" stroke={LINE} strokeWidth={2.5} />
        <g stroke={LINE} strokeWidth={1.8} strokeLinecap="round" opacity="0.6">
          <path d="M92 144 L 70 140 M92 150 L 72 154 M148 144 L 170 140 M148 150 L 168 154" />
        </g>
      </g>
    ),
    teeth: true,
    face: { lx: 98, rx: 142, ey: 112, mx: 120, my: 150, lid: fur },
  };
}

function cat(): SpeciesParts {
  const fur = "#8b8fb5";
  const light = "#eceaf6";
  const stripe = "#5d6190";
  return {
    tail: (
      <g className="npc-tail" style={{ transformOrigin: "176px 260px" }}>
        <path d="M172 266 C 222 262, 236 210, 214 172 C 206 158, 196 164, 202 176 C 216 204, 206 236, 166 244" fill="none" stroke={LINE} strokeWidth={20} strokeLinecap="round" />
        <path d="M172 266 C 222 262, 236 210, 214 172 C 206 158, 196 164, 202 176 C 216 204, 206 236, 166 244" fill="none" stroke={fur} strokeWidth={13} strokeLinecap="round" />
        <path d="M222 200 l-12 4 M222 222 l-12 0 M212 244 l-10 -6" stroke={stripe} strokeWidth={4} strokeLinecap="round" />
      </g>
    ),
    body: (
      <g>
        <path d="M62 290 C 62 230, 88 200, 120 200 C 152 200, 178 230, 178 290 Z" fill={fur} stroke={LINE} strokeWidth={SW} />
        <path d="M100 290 C 100 246, 108 224, 120 224 C 132 224, 140 246, 140 290 Z" fill={light} />
        {/* 가방끈과 작은 가방 */}
        <path d="M74 216 L 170 286" stroke="#7a3b56" strokeWidth={9} strokeLinecap="round" />
        <path d="M74 216 L 170 286" stroke={LINE} strokeWidth={13} strokeLinecap="round" opacity="0.25" />
        <rect x="150" y="256" width="38" height="30" rx="6" fill="#a94d73" stroke={LINE} strokeWidth={SW} />
        <path d="M150 266 h38" stroke={LINE} strokeWidth={2.5} />
        <circle cx="169" cy="270" r="3.5" fill="#f0c869" stroke={LINE} strokeWidth={1.5} />
        <path d="M86 204 Q 120 222 154 204" fill="none" stroke="#f0c869" strokeWidth={5} strokeLinecap="round" />
        <circle cx="120" cy="216" r="6" fill="#f0c869" stroke={LINE} strokeWidth={2} />
      </g>
    ),
    earsBack: (mood) => {
      const droop = mood === "sad" ? 18 : 0;
      return (
        <g>
          <g transform={`rotate(${-droop} 74 84)`}>
            <path d="M60 96 L 64 36 L 106 68 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
            <path d="M68 86 L 70 52 L 94 70 Z" fill="#f4a7b9" />
          </g>
          <g transform={`rotate(${droop} 166 84)`}>
            <path d="M180 96 L 176 36 L 134 68 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
            <path d="M172 86 L 170 52 L 146 70 Z" fill="#f4a7b9" />
          </g>
        </g>
      );
    },
    head: (
      <g>
        <path d="M120 58 C 172 58, 192 90, 190 124 C 188 160, 158 178, 120 178 C 82 178, 52 160, 50 124 C 48 90, 68 58, 120 58 Z" fill={fur} stroke={LINE} strokeWidth={SW} />
        <path d="M108 62 l3 16 M120 60 v18 M132 62 l-3 16" stroke={stripe} strokeWidth={4} strokeLinecap="round" />
        <path d="M52 112 l14 4 M51 124 l15 1 M188 112 l-14 4 M189 124 l-15 1" stroke={stripe} strokeWidth={3.5} strokeLinecap="round" />
        <path d="M86 156 C 92 136, 148 136, 154 156 C 146 172, 94 172, 86 156 Z" fill={light} />
      </g>
    ),
    front: (
      // 작은 모자 (머리 위에 비스듬히)
      <g transform="rotate(-10 120 54)">
        <ellipse cx="128" cy="62" rx="40" ry="9" fill="#4b3a7a" stroke={LINE} strokeWidth={SW} />
        <path d="M104 60 C 104 36, 152 36, 152 60 Z" fill="#5d4a96" stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M105 54 C 120 58, 138 58, 151 54" fill="none" stroke="#f0c869" strokeWidth={5} />
        <path d="M150 50 C 166 30, 176 34, 170 48 Z" fill="#7fd0e0" stroke={LINE} strokeWidth={2.5} />
      </g>
    ),
    extraFace: (
      <g>
        <path d="M113 134 L 127 134 L 120 142 Z" fill="#e0708a" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
        <g stroke={LINE} strokeWidth={2} strokeLinecap="round" opacity="0.75">
          <path d="M88 140 L 58 134 M88 147 L 58 150 M152 140 L 182 134 M152 147 L 182 150" />
        </g>
      </g>
    ),
    face: { lx: 97, rx: 143, ey: 114, mx: 120, my: 149, lid: fur },
  };
}

function wolf(): SpeciesParts {
  const fur = "#6f7d99";
  const light = "#dfe5ee";
  return {
    tail: (
      <g className="npc-tail" style={{ transformOrigin: "180px 256px" }}>
        <path d="M176 262 C 236 262, 244 196, 224 160 C 212 192, 196 208, 168 220 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M224 160 C 230 176, 228 190, 220 200 C 214 188, 214 172, 224 160 Z" fill={light} />
      </g>
    ),
    body: (
      <g>
        {/* 넓은 어깨와 외투 */}
        <path d="M30 290 C 32 232, 70 200, 120 200 C 170 200, 208 232, 210 290 Z" fill="#2f3a5a" stroke={LINE} strokeWidth={SW} />
        <path d="M120 206 L 92 290 L 148 290 Z" fill={light} />
        <path d="M90 206 L 120 248 L 104 290 L 80 290 L 72 222 Z" fill="#3c4a72" stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
        <path d="M150 206 L 120 248 L 136 290 L 160 290 L 168 222 Z" fill="#3c4a72" stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
        <g fill="#f0c869" stroke={LINE} strokeWidth={2}>
          <circle cx="106" cy="266" r="5" /><circle cx="134" cy="266" r="5" />
        </g>
        <path d="M150 238 h20 v8 h-20 z" fill="#f0c869" stroke={LINE} strokeWidth={2} />
      </g>
    ),
    earsBack: (mood) => {
      const droop = mood === "sad" ? 16 : 0;
      return (
        <g>
          <g transform={`rotate(${-droop} 72 74)`}>
            <path d="M56 92 L 60 26 L 108 64 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
            <path d="M64 82 L 66 44 L 94 66 Z" fill="#3b4458" />
          </g>
          <g transform={`rotate(${droop} 168 74)`}>
            <path d="M184 92 L 180 26 L 132 64 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
            <path d="M176 82 L 174 44 L 146 66 Z" fill="#3b4458" />
          </g>
        </g>
      );
    },
    head: (
      <g>
        {/* 각진 볼털 */}
        <path d="M120 52 C 168 52, 190 82, 192 112 L 204 126 L 186 132 L 196 146 L 172 148 C 160 170, 142 180, 120 180 C 98 180, 80 170, 68 148 L 44 146 L 54 132 L 36 126 L 48 112 C 50 82, 72 52, 120 52 Z" fill={fur} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
        {/* 긴 주둥이 */}
        <path d="M94 128 C 94 118, 146 118, 146 128 C 148 152, 136 170, 120 170 C 104 170, 92 152, 94 128 Z" fill={light} stroke={LINE} strokeWidth={3} />
        <path d="M100 60 q20 -6 40 0" fill="none" stroke="#8d9ab4" strokeWidth={5} strokeLinecap="round" />
      </g>
    ),
    extraFace: <path d="M108 126 Q 120 118 132 126 Q 128 138 120 139 Q 112 138 108 126 Z" fill={LINE} />,
    face: { lx: 94, rx: 146, ey: 104, mx: 120, my: 152, lid: fur },
  };
}

const BUILDERS: Record<Species, () => SpeciesParts> = { fox, rabbit, cat, wolf };

export function AnimalArt({ species, mood = "order", label }: { species: Species; mood?: Mood; label?: string }) {
  const s = BUILDERS[species]();
  const tilt = mood === "explain" ? -5 : mood === "meh" ? 3 : mood === "sad" ? 0 : 0;
  const dip = mood === "sad" ? 6 : 0;
  return (
    <svg viewBox="0 -50 240 340" className={`animal-art species-${species} mood-${mood}`} role="img" aria-label={label ?? "손님"} data-mood={mood}>
      <g className="npc-breathe">
        {s.tail}
        {s.body}
        <g transform={`translate(0 ${dip}) rotate(${tilt} 120 140)`}>
          {s.earsBack(mood)}
          {s.head}
          <Cheeks f={s.face} />
          <Brows f={s.face} mood={mood} />
          <Eyes f={s.face} mood={mood} />
          {s.extraFace}
          <Mouth f={s.face} mood={mood} teeth={s.teeth} />
          {s.front}
        </g>
        <Sparkles show={mood === "happy"} />
      </g>
    </svg>
  );
}
