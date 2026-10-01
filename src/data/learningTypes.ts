/**
 * 학습 유형 정의, 인수 범위, 자동 소개 단계.
 * 학생이나 교사가 고르는 설정은 없다. 영업을 하루 마칠 때마다 다음 단계 유형이 자동으로 소개된다.
 */
import { compare, decimalPlaces, isNaturalNumber, parseDecimal } from "../lib/decimal.ts";

export type LearningTypeId =
  | "d1xN" // ① 소수 한 자리 × 자연수
  | "d2xN" // ② 소수 두 자리 × 자연수
  | "Nxd1" // ③ 자연수 × 소수 한 자리
  | "Nxd2" // ④ 자연수 × 소수 두 자리
  | "d1xD" // ⑤ 소수 한 자리 × 소수 한 자리
  | "d2xD" // ⑥ 소수 두 자리 × 소수 한 자리
  | "shift"; // ⑦ 한 인수가 10배·1/10배일 때 곱의 변화

export const LEARNING_TYPE_IDS: LearningTypeId[] = ["d1xN", "d2xN", "Nxd1", "Nxd2", "d1xD", "d2xD", "shift"];

export interface LearningTypeInfo {
  id: LearningTypeId;
  number: string;
  label: string;
  /** 처음 소개할 때 보여 주는 짧은 설명 */
  intro: string;
  /** 소개 예시 */
  example: string;
}

export const LEARNING_TYPES: Record<LearningTypeId, LearningTypeInfo> = {
  d1xN: {
    id: "d1xN", number: "①", label: "소수 한 자리 × 자연수",
    intro: "1병에 필요한 양(소수 한 자리)을 병 수만큼 곱해요.",
    example: "0.6 × 3 → 6 × 3 = 18, 0.6은 6의 1/10이니까 1.8",
  },
  d2xN: {
    id: "d2xN", number: "②", label: "소수 두 자리 × 자연수",
    intro: "소수 두 자리 수를 병 수만큼 곱해요. 0.01이 몇 개인지 생각하면 쉬워요.",
    example: "0.25 × 3 → 25 × 3 = 75, 0.01이 75개니까 0.75",
  },
  Nxd1: {
    id: "Nxd1", number: "③", label: "자연수 × 소수 한 자리",
    intro: "기본량(자연수)의 ○배를 구해요. 1보다 작은 배수면 기본량보다 적어져요.",
    example: "4 × 0.3 → 4 × 3 = 12, 0.3은 3의 1/10이니까 1.2",
  },
  Nxd2: {
    id: "Nxd2", number: "④", label: "자연수 × 소수 두 자리",
    intro: "기본량(자연수)의 소수 두 자리 배를 구해요.",
    example: "2 × 0.25 → 2 × 25 = 50, 0.25는 25의 1/100이니까 0.5",
  },
  d1xD: {
    id: "d1xD", number: "⑤", label: "소수 한 자리 × 소수 한 자리",
    intro: "소수끼리 곱해요. 소수점 아래 자릿수를 더한 만큼 곱의 소수점 아래 자리가 생겨요.",
    example: "0.6 × 0.4 → 6 × 4 = 24, 1 + 1 = 2자리니까 0.24",
  },
  d2xD: {
    id: "d2xD", number: "⑥", label: "소수 두 자리 × 소수 한 자리",
    intro: "소수 두 자리 수와 소수 한 자리 수를 곱해요. 곱은 소수 세 자리까지 생길 수 있어요.",
    example: "0.25 × 0.4 → 25 × 4 = 100, 2 + 1 = 3자리니까 0.100 = 0.1",
  },
  shift: {
    id: "shift", number: "⑦", label: "곱의 소수점 위치 변화",
    intro: "곱하는 수 하나가 10배나 1/10배가 되면 곱도 똑같이 10배나 1/10배가 돼요.",
    example: "2.4 × 3 = 7.2 → 0.24 × 3은 2.4가 1/10배 되었으니 곱도 1/10배인 0.72",
  },
};

/** 자동 소개 단계. 영업을 하루 마칠 때마다 한 단계씩 (정답률·힌트와 무관) */
export const INTRO_STAGES: LearningTypeId[][] = [
  ["d1xN", "d2xN"],
  ["Nxd1", "Nxd2"],
  ["d1xD", "d2xD"],
  ["shift"],
];
export const MAX_INTRO_STAGE = INTRO_STAGES.length - 1;

export function introducedTypes(stage: number): LearningTypeId[] {
  return INTRO_STAGES.slice(0, Math.max(0, Math.min(stage, MAX_INTRO_STAGE)) + 1).flat();
}

/** 기본 인수 범위 (생활 소재 특별 예시와 비교 문제의 10배·1/10배 변환은 예외) */
export const RANGES = {
  natural: { min: "2", max: "9" },
  d1: { min: "0.2", max: "2.5" },
  d2: { min: "0.12", max: "1.25" },
} as const;

export type FactorKind = "natural" | "d1" | "d2";

export function factorKind(text: string): FactorKind | null {
  if (isNaturalNumber(text)) return "natural";
  const p = decimalPlaces(text);
  return p === 1 ? "d1" : p === 2 ? "d2" : null;
}

export function inRange(text: string): boolean {
  const k = factorKind(text);
  if (!k) return false;
  const v = parseDecimal(text);
  return compare(v, parseDecimal(RANGES[k].min)) >= 0 && compare(v, parseDecimal(RANGES[k].max)) <= 0;
}

/**
 * 곱셈식(곱해지는 수 a × 곱하는 수 b)의 학습 유형. ⑦은 비교 주문에서 정한다.
 * 이 게임의 문제 범위에 없는 모양(자연수 × 자연수, 소수 × 소수 두 자리)은 null.
 */
export function classifyProduct(a: string, b: string): LearningTypeId | null {
  const ka = factorKind(a);
  const kb = factorKind(b);
  if (!ka || !kb) return null;
  if (kb === "natural") return ka === "d1" ? "d1xN" : ka === "d2" ? "d2xN" : null;
  if (ka === "natural") return kb === "d1" ? "Nxd1" : "Nxd2";
  if (kb !== "d1") return null;
  return ka === "d1" ? "d1xD" : "d2xD";
}

export function typeLabel(id: LearningTypeId): string {
  return `${LEARNING_TYPES[id].number} ${LEARNING_TYPES[id].label}`;
}
