/**
 * 학습 유형 정의와 범위 설정.
 * 3단계에서 교사 설정 화면이 이 값을 켜고 끄며, 범위(병 수·배수 목록)를 조정한다.
 * 1단계에서는 ①② (여러 병 주문)만 실제로 출제한다.
 */
import { decimalPlaces, isNaturalNumber } from "../lib/decimal.ts";

export type LearningTypeId =
  | "d1xN" // ① 소수 한 자리 × 자연수
  | "d2xN" // ② 소수 두 자리 × 자연수
  | "Nxd1" // ③ 자연수 × 소수 한 자리
  | "Nxd2" // ④ 자연수 × 소수 두 자리
  | "d1xD" // ⑤ 소수 한 자리 × 소수
  | "d2xD" // ⑥ 소수 두 자리 × 소수
  | "shift"; // ⑦ 곱의 소수점 위치 변화

export type OrderKind = "multiBottle" | "customMultiplier" | "pointShift";

export interface LearningTypeConfig {
  id: LearningTypeId;
  number: string;
  label: string;
  orderKind: OrderKind;
  /** 곱해지는 수(레시피 기본량)의 소수 자릿수. 0 = 자연수 */
  multiplicandPlaces: 0 | 1 | 2;
  /** 여러 병 주문: 병 수 범위 (자연수) */
  bottleRange?: { min: number; max: number };
  /** 맞춤 배수 주문: 허용 배수 목록 (정확한 십진 문자열) */
  multipliers?: string[];
  /** 1단계에서 구현되었는지 */
  implemented: boolean;
}

export const LEARNING_TYPES: Record<LearningTypeId, LearningTypeConfig> = {
  d1xN: {
    id: "d1xN", number: "①", label: "소수 한 자리 × 자연수",
    orderKind: "multiBottle", multiplicandPlaces: 1,
    bottleRange: { min: 2, max: 9 }, implemented: true,
  },
  d2xN: {
    id: "d2xN", number: "②", label: "소수 두 자리 × 자연수",
    orderKind: "multiBottle", multiplicandPlaces: 2,
    bottleRange: { min: 2, max: 9 }, implemented: true,
  },
  Nxd1: {
    id: "Nxd1", number: "③", label: "자연수 × 소수 한 자리",
    orderKind: "customMultiplier", multiplicandPlaces: 0,
    multipliers: ["0.2", "0.3", "0.4", "0.5", "0.6", "0.8", "1.2", "1.5"], implemented: false,
  },
  Nxd2: {
    id: "Nxd2", number: "④", label: "자연수 × 소수 두 자리",
    orderKind: "customMultiplier", multiplicandPlaces: 0,
    multipliers: ["0.25", "0.75", "0.05", "0.15", "1.25"], implemented: false,
  },
  d1xD: {
    id: "d1xD", number: "⑤", label: "소수 한 자리 × 소수",
    orderKind: "customMultiplier", multiplicandPlaces: 1,
    multipliers: ["0.2", "0.4", "0.5", "0.6", "0.8", "1.5"], implemented: false,
  },
  d2xD: {
    id: "d2xD", number: "⑥", label: "소수 두 자리 × 소수",
    orderKind: "customMultiplier", multiplicandPlaces: 2,
    multipliers: ["0.2", "0.4", "0.5", "0.6", "1.2"], implemented: false,
  },
  shift: {
    id: "shift", number: "⑦", label: "곱의 소수점 위치 변화",
    orderKind: "pointShift", multiplicandPlaces: 1, implemented: false,
  },
};

/**
 * 곱셈식(기본량 a × 곱하는 수 b)이 어떤 학습 유형인지 판정.
 * ⑦은 주문 형식(pointShift)으로 정해지므로 여기서는 판정하지 않는다.
 */
export function classifyProduct(a: string, b: string): LearningTypeId | null {
  const pa = decimalPlaces(a);
  const bNatural = isNaturalNumber(b);
  const pb = decimalPlaces(b);
  if (bNatural) {
    if (pa === 1) return "d1xN";
    if (pa === 2) return "d2xN";
    return null; // 자연수 × 자연수는 범위 밖
  }
  if (pa === 0) return pb === 1 ? "Nxd1" : pb === 2 ? "Nxd2" : null;
  if (pa === 1) return "d1xD";
  if (pa === 2) return "d2xD";
  return null;
}
