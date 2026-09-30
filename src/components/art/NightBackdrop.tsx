/** 창구 배경: 밤하늘, 달, 별, 창틀, 등불 (임시 그래픽) */
const LINE = "#2b1d3a";

const STARS: [number, number, number][] = [
  [80, 60, 3], [180, 120, 2], [260, 40, 2.5], [420, 90, 2], [520, 50, 3],
  [640, 130, 2], [720, 70, 2.5], [860, 110, 2], [940, 50, 3], [340, 160, 1.8],
  [600, 180, 1.6], [120, 190, 1.8], [800, 190, 1.6],
];

export function NightBackdrop() {
  return (
    <svg className="night-backdrop" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141a45" />
          <stop offset="1" stopColor="#2c2f78" />
        </linearGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="560" fill="#241a3a" />
      {/* 창 너머 밤하늘 */}
      <path d="M150 560 L150 170 C 150 70, 850 70, 850 170 L850 560 Z" fill="url(#sky)" />
      <circle cx="720" cy="150" r="46" fill="#fff3c4" />
      <circle cx="740" cy="138" r="40" fill="#23286a" opacity="0.9" />
      {STARS.map(([x, y, r], i) => (
        <circle key={i} className="twinkle" style={{ animationDelay: `${(i % 5) * 0.5}s` }} cx={x} cy={y + 60} r={r} fill="#fff7d6" />
      ))}
      <path d="M150 460 C 260 420, 330 440, 420 410 C 520 380, 600 430, 700 400 C 780 380, 830 420, 850 410 L850 560 L150 560 Z" fill="#1a1f4d" />
      {/* 창틀 */}
      <path d="M150 560 L150 170 C 150 70, 850 70, 850 170 L850 560" fill="none" stroke="#6b4a3a" strokeWidth="28" />
      <path d="M150 560 L150 170 C 150 70, 850 70, 850 170 L850 560" fill="none" stroke={LINE} strokeWidth="4" />
      {/* 등불 */}
      {[70, 930].map((x) => (
        <g key={x}>
          <circle cx={x} cy={230} r={90} fill="url(#lamp)" className="lamp-glow" />
          <path d={`M${x} 110 L${x} 190`} stroke={LINE} strokeWidth="4" />
          <path d={`M${x - 22} 195 L${x + 22} 195 L${x + 16} 255 L${x - 16} 255 Z`} fill="#ffcf6b" stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
          <path d={`M${x - 26} 190 L${x + 26} 190 L${x + 20} 200 L${x - 20} 200 Z`} fill="#6b4a3a" stroke={LINE} strokeWidth="3" />
        </g>
      ))}
    </svg>
  );
}
