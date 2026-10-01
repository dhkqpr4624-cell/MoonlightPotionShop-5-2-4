/**
 * 손님 임시 그래픽 (교체 가능). 같은 틀에 종류별 색·귀 모양만 바꿔 그린다.
 * 최종 그림이 생기면 data/customers.ts 의 image 에 경로를 넣으면 이 그림 대신 쓰인다.
 */
import type { Species } from "../../data/customers.ts";

export type Mood = "neutral" | "happy" | "curious" | "meh" | "sad";

const LINE = "#2b1d3a";

interface Palette {
  fur: string;
  light: string;
  inner: string;
  scarf: string;
  tail: "fox" | "round" | "thin" | "bushy";
}

const PALETTES: Record<Species, Palette> = {
  fox: { fur: "#f28c38", light: "#fff4e0", inner: "#7a3b2e", scarf: "#3fb6a8", tail: "fox" },
  rabbit: { fur: "#efe6dc", light: "#ffffff", inner: "#f4a7b9", scarf: "#e8a13a", tail: "round" },
  cat: { fur: "#8e8aa3", light: "#e9e6f2", inner: "#f4a7b9", scarf: "#d24b6c", tail: "thin" },
  wolf: { fur: "#6f7f9a", light: "#dfe6f0", inner: "#3b4458", scarf: "#f2c94c", tail: "bushy" },
};

function Ears({ species, p }: { species: Species; p: Palette }) {
  if (species === "rabbit") {
    return (
      <g>
        <ellipse cx="92" cy="40" rx="16" ry="46" fill={p.fur} stroke={LINE} strokeWidth="4" transform="rotate(-10 92 40)" />
        <ellipse cx="92" cy="44" rx="7" ry="32" fill={p.inner} transform="rotate(-10 92 44)" />
        <ellipse cx="148" cy="40" rx="16" ry="46" fill={p.fur} stroke={LINE} strokeWidth="4" transform="rotate(10 148 40)" />
        <ellipse cx="148" cy="44" rx="7" ry="32" fill={p.inner} transform="rotate(10 148 44)" />
      </g>
    );
  }
  const tall = species === "fox" || species === "wolf";
  const top = tall ? 18 : 40;
  return (
    <g>
      <path d={`M62 86 L 58 ${top} L 110 58 Z`} fill={p.fur} stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
      <path d={`M68 72 L 66 ${top + 18} L 94 58 Z`} fill={p.inner} />
      <path d={`M178 86 L 182 ${top} L 130 58 Z`} fill={p.fur} stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
      <path d={`M172 72 L 174 ${top + 18} L 146 58 Z`} fill={p.inner} />
    </g>
  );
}

function Tail({ p }: { p: Palette }) {
  if (p.tail === "round") return <circle cx="196" cy="214" r="18" fill={p.light} stroke={LINE} strokeWidth="4" />;
  if (p.tail === "thin") {
    return <path d="M168 230 C 210 228, 228 190, 214 150" fill="none" stroke={LINE} strokeWidth="14" strokeLinecap="round" />;
  }
  return (
    <g>
      <path d="M170 225 C 225 215, 240 150, 215 118 C 205 150, 190 170, 160 190 Z" fill={p.fur} stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
      <path d="M215 118 C 222 135, 220 150, 212 160 C 205 150, 204 135, 215 118 Z" fill={p.light} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
    </g>
  );
}

export function AnimalArt({ species, mood = "neutral", label }: { species: Species; mood?: Mood; label?: string }) {
  const p = PALETTES[species];
  return (
    <svg viewBox="0 0 240 260" className="animal-art" role="img" aria-label={label ?? "손님"}>
      <g className="animal-tail">
        <Tail p={p} />
      </g>
      {/* 몸 */}
      <path d="M50 262 C 50 205, 80 180, 120 180 C 160 180, 190 205, 190 262 Z" fill={p.fur} stroke={LINE} strokeWidth="4" />
      <path d="M92 262 C 92 225, 104 200, 120 200 C 136 200, 148 225, 148 262 Z" fill={p.light} stroke={LINE} strokeWidth="3" />
      <path d="M78 182 C 100 198, 140 198, 162 182 L 166 196 C 140 214, 100 214, 74 196 Z" fill={p.scarf} stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
      <path d="M138 204 L 150 236 L 132 230 Z" fill={p.scarf} stroke={LINE} strokeWidth="3.5" strokeLinejoin="round" />
      <Ears species={species} p={p} />
      {/* 머리 */}
      <ellipse cx="120" cy="112" rx="72" ry="62" fill={p.fur} />
      <path d="M56 128 C 66 160, 96 170, 120 170 C 144 170, 174 160, 184 128 C 166 138, 150 124, 120 124 C 90 124, 74 138, 56 128 Z" fill={p.light} />
      <ellipse cx="120" cy="112" rx="72" ry="62" fill="none" stroke={LINE} strokeWidth="4" />
      {species === "cat" && (
        <g stroke={LINE} strokeWidth="2.5" strokeLinecap="round">
          <path d="M60 128 L 34 122 M60 136 L 34 140 M180 128 L 206 122 M180 136 L 206 140" />
        </g>
      )}
      <ellipse cx="78" cy="132" rx="11" ry="7" fill="#ff9aa8" opacity="0.75" />
      <ellipse cx="162" cy="132" rx="11" ry="7" fill="#ff9aa8" opacity="0.75" />
      {/* 눈 */}
      {mood === "happy" ? (
        <g fill="none" stroke={LINE} strokeWidth="5" strokeLinecap="round">
          <path d="M84 108 Q 96 94 108 108" />
          <path d="M132 108 Q 144 94 156 108" />
        </g>
      ) : (
        <g>
          <ellipse cx="96" cy="106" rx="9" ry={mood === "curious" ? 12 : mood === "meh" ? 7 : 11} fill={LINE} />
          <ellipse cx="144" cy="106" rx="9" ry={mood === "curious" ? 12 : mood === "meh" ? 7 : 11} fill={LINE} />
          <circle cx="99" cy="101" r="3.2" fill="#fff" />
          <circle cx="147" cy="101" r="3.2" fill="#fff" />
          {mood === "curious" && <path d="M132 84 Q 146 76 158 86" fill="none" stroke={LINE} strokeWidth="4" strokeLinecap="round" />}
          {mood === "sad" && (
            <g fill="none" stroke={LINE} strokeWidth="4" strokeLinecap="round">
              <path d="M82 88 L 106 94" />
              <path d="M158 88 L 134 94" />
            </g>
          )}
        </g>
      )}
      <ellipse cx="120" cy="128" rx="8" ry="6" fill={LINE} />
      {mood === "happy" ? (
        <path d="M106 138 Q 120 158 134 138 Z" fill="#c2455a" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      ) : mood === "curious" ? (
        <ellipse cx="120" cy="143" rx="5" ry="6" fill="#c2455a" stroke={LINE} strokeWidth="3" />
      ) : mood === "meh" ? (
        <path d="M108 142 L 132 142" fill="none" stroke={LINE} strokeWidth="3.5" strokeLinecap="round" />
      ) : mood === "sad" ? (
        <path d="M108 146 Q 120 136 132 146" fill="none" stroke={LINE} strokeWidth="3.5" strokeLinecap="round" />
      ) : (
        <path d="M108 138 Q 114 145 120 138 Q 126 145 132 138" fill="none" stroke={LINE} strokeWidth="3.5" strokeLinecap="round" />
      )}
    </svg>
  );
}
