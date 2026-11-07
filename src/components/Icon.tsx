import type { ReactElement } from "react";

/** 화면 아이콘 (직접 제작한 SVG, 24×24). 이모지 대신 쓴다. currentColor를 따른다 */
export type IconName =
  | "coin" | "moon" | "book" | "memo" | "bulb" | "save" | "records" | "sound" | "mute"
  | "check" | "close" | "arrow" | "back" | "potion" | "home" | "settings" | "hand" | "lock" | "unlock" | "bag" | "glasses" | "cauldron" | "eye";

const P: Record<IconName, ReactElement> = {
  coin: (
    <g>
      <circle cx="12" cy="12" r="9" fill="#f0c869" stroke="#2b1d3a" strokeWidth="2" />
      <path d="M13.5 7 A5 5 0 1 0 13.5 17 A3.8 3.8 0 1 1 13.5 7 Z" fill="#2b1d3a" />
    </g>
  ),
  moon: <path d="M15 3 A9 9 0 1 0 21 15 A7 7 0 1 1 15 3 Z" fill="currentColor" />,
  book: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M3 5 C 6 4, 9 4, 12 6 C 15 4, 18 4, 21 5 V 19 C 18 18, 15 18, 12 20 C 9 18, 6 18, 3 19 Z" />
      <path d="M12 6 V 20" />
    </g>
  ),
  memo: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M6 3 H 15 L 19 7 V 21 H 6 Z" />
      <path d="M9 10 H 16 M9 14 H 16 M9 18 H 13" />
    </g>
  ),
  bulb: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14 C 5 11, 6 4, 12 4 C 18 4, 19 11, 16 14 C 15 15, 15 16, 15 17 H 9 C 9 16, 9 15, 8 14 Z" />
      <path d="M9.5 20 H 14.5" />
    </g>
  ),
  save: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M4 4 H 17 L 20 7 V 20 H 4 Z" />
      <path d="M8 4 V 9 H 15 V 4 M7 20 V 14 H 17 V 20" />
    </g>
  ),
  records: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 20 V 12 M10 20 V 6 M15 20 V 10 M20 20 V 4" />
    </g>
  ),
  sound: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9 H 8 L 13 5 V 19 L 8 15 H 4 Z" fill="currentColor" />
      <path d="M16 9 C 17.5 10.5, 17.5 13.5, 16 15 M18.5 6.5 C 21.5 9.5, 21.5 14.5, 18.5 17.5" />
    </g>
  ),
  mute: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9 H 8 L 13 5 V 19 L 8 15 H 4 Z" fill="currentColor" />
      <path d="M16 9 L 21 15 M21 9 L 16 15" />
    </g>
  ),
  check: <path d="M4 12 L 10 18 L 20 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />,
  close: <path d="M6 6 L 18 18 M18 6 L 6 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />,
  arrow: <path d="M4 12 H 19 M13 6 L 19 12 L 13 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />,
  back: <path d="M20 12 H 5 M11 6 L 5 12 L 11 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />,
  potion: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M10 3 H 14 V 8 C 18 9, 20 12, 20 15 C 20 19, 16 21, 12 21 C 8 21, 4 19, 4 15 C 4 12, 6 9, 10 8 Z" />
      <path d="M5 14 H 19 C 19 18, 15 20, 12 20 C 9 20, 5 18, 5 14 Z" fill="currentColor" opacity="0.6" />
    </g>
  ),
  home: <path d="M4 11 L 12 4 L 20 11 V 20 H 4 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  settings: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7 H 20 M4 17 H 20" />
      <circle cx="9" cy="7" r="2.5" fill="currentColor" />
      <circle cx="15" cy="17" r="2.5" fill="currentColor" />
    </g>
  ),
  bag: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M5 8 H19 L18 20 H6 Z" fill="currentColor" fillOpacity="0.18" />
      <path d="M9 8 V6.5 a3 3 0 0 1 6 0 V8" strokeLinecap="round" />
      <path d="M10 13 h4" strokeLinecap="round" />
    </g>
  ),
  glasses: (
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="7" cy="14" r="4" /><circle cx="17" cy="14" r="4" />
      <path d="M11 14 q1 -1.5 2 0 M3 13 L2 9 M21 13 L22 9" strokeLinecap="round" />
    </g>
  ),
  cauldron: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M4 10 H20 C 20 16, 17 20, 12 20 C 7 20, 4 16, 4 10 Z" fill="currentColor" fillOpacity="0.18" />
      <path d="M3 10 H21 M7 20 L6 22 M17 20 L18 22 M12 3 C 10 5, 14 6, 12 8" strokeLinecap="round" />
    </g>
  ),
  eye: (
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12 C 6 5, 18 5, 22 12 C 18 19, 6 19, 2 12 Z" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </g>
  ),
  lock: (
    <g>
      <path d="M7.5 10.5 V 7.5 a4.5 4.5 0 0 1 9 0 V 10.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" fill="currentColor" />
      <circle cx="12" cy="15" r="1.7" fill="#2b1d3a" />
      <path d="M12 15.5 V 18" stroke="#2b1d3a" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  ),
  unlock: (
    <g>
      <path d="M7.5 10.5 V 7.5 a4.5 4.5 0 0 1 8.6 -1.8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" fill="currentColor" />
      <circle cx="12" cy="15" r="1.7" fill="#2b1d3a" />
    </g>
  ),
  hand: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 12 V 5 a1.6 1.6 0 0 1 3.2 0 V 11 M11.2 10 V 4 a1.6 1.6 0 0 1 3.2 0 V 11 M14.4 10 V 6 a1.6 1.6 0 0 1 3.2 0 V 14 C 17.6 18, 15 21, 12 21 C 9 21, 7 19, 5 15 L 4 12.5 a1.6 1.6 0 0 1 2.8 -1.5 L 8 13" />
    </g>
  ),
};

export function Icon({ name, size = 22, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`icon ${className ?? ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
