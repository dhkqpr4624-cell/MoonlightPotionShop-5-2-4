/**
 * 여우 수인 '코코' 임시 그래픽 (교체 가능).
 * 최종 그림이 생기면 data/customers.ts 의 image 에 경로를 넣으면 이 그림 대신 사용된다.
 */
export type Mood = "neutral" | "happy" | "curious";

const LINE = "#2b1d3a";

export function FoxArt({ mood = "neutral" }: { mood?: Mood }) {
  return (
    <svg viewBox="0 0 240 260" className="fox-art" role="img" aria-label={`여우 손님 코코 (${mood === "happy" ? "기쁜 표정" : mood === "curious" ? "궁금한 표정" : "기본 표정"})`}>
      {/* 꼬리 */}
      <g className="fox-tail">
        <path d="M170 225 C 225 215, 240 150, 215 118 C 205 150, 190 170, 160 190 Z" fill="#f28c38" stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
        <path d="M215 118 C 222 135, 220 150, 212 160 C 205 150, 204 135, 215 118 Z" fill="#fff4e0" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      </g>
      {/* 몸 */}
      <path d="M50 262 C 50 205, 80 180, 120 180 C 160 180, 190 205, 190 262 Z" fill="#f28c38" stroke={LINE} strokeWidth="4" />
      <path d="M92 262 C 92 225, 104 200, 120 200 C 136 200, 148 225, 148 262 Z" fill="#fff4e0" stroke={LINE} strokeWidth="3" />
      {/* 스카프 */}
      <path d="M78 182 C 100 198, 140 198, 162 182 L 166 196 C 140 214, 100 214, 74 196 Z" fill="#3fb6a8" stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
      <path d="M138 204 L 150 236 L 132 230 Z" fill="#3fb6a8" stroke={LINE} strokeWidth="3.5" strokeLinejoin="round" />
      {/* 귀 */}
      <path d="M62 86 L 58 18 L 110 58 Z" fill="#f28c38" stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
      <path d="M68 72 L 66 36 L 94 58 Z" fill="#7a3b2e" />
      <path d="M178 86 L 182 18 L 130 58 Z" fill="#f28c38" stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
      <path d="M172 72 L 174 36 L 146 58 Z" fill="#7a3b2e" />
      {/* 머리 */}
      <ellipse cx="120" cy="112" rx="72" ry="62" fill="#f28c38" stroke={LINE} strokeWidth="4" />
      {/* 볼 털과 주둥이 (외곽선 없이 밝은 면으로) */}
      <path d="M56 128 C 66 160, 96 170, 120 170 C 144 170, 174 160, 184 128 C 166 138, 150 124, 120 124 C 90 124, 74 138, 56 128 Z" fill="#fff4e0" />
      <ellipse cx="120" cy="112" rx="72" ry="62" fill="none" stroke={LINE} strokeWidth="4" />
      {/* 볼 */}
      <ellipse cx="78" cy="132" rx="11" ry="7" fill="#ff9aa8" opacity="0.8" />
      <ellipse cx="162" cy="132" rx="11" ry="7" fill="#ff9aa8" opacity="0.8" />
      {/* 눈 */}
      {mood === "happy" ? (
        <g fill="none" stroke={LINE} strokeWidth="5" strokeLinecap="round">
          <path d="M84 108 Q 96 94 108 108" />
          <path d="M132 108 Q 144 94 156 108" />
        </g>
      ) : (
        <g>
          <ellipse cx="96" cy="106" rx="9" ry={mood === "curious" ? 12 : 11} fill={LINE} />
          <ellipse cx="144" cy="106" rx="9" ry={mood === "curious" ? 12 : 11} fill={LINE} />
          <circle cx="99" cy="101" r="3.2" fill="#fff" />
          <circle cx="147" cy="101" r="3.2" fill="#fff" />
          {mood === "curious" && (
            <path d="M132 84 Q 146 76 158 86" fill="none" stroke={LINE} strokeWidth="4" strokeLinecap="round" />
          )}
        </g>
      )}
      {/* 코와 입 */}
      <ellipse cx="120" cy="128" rx="8" ry="6" fill={LINE} />
      {mood === "happy" ? (
        <path d="M106 138 Q 120 158 134 138 Z" fill="#c2455a" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      ) : mood === "curious" ? (
        <ellipse cx="120" cy="143" rx="5" ry="6" fill="#c2455a" stroke={LINE} strokeWidth="3" />
      ) : (
        <path d="M108 138 Q 114 145 120 138 Q 126 145 132 138" fill="none" stroke={LINE} strokeWidth="3.5" strokeLinecap="round" />
      )}
    </svg>
  );
}
