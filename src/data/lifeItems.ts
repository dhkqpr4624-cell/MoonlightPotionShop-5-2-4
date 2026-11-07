/**
 * 생활 소재 특별 주문.
 * "계산한 숫자를 마법 재료량으로 쓴다"는 특별 주문 규칙이다. g을 mL로 바꾸는 단위 변환이 아니다.
 *
 * form
 *  - "each":  한 개(조각)의 양 a × 개수 b  (b는 자연수)
 *  - "ratio": 전체 양 a 의 b배             (b는 소수)
 * 인수는 기본 범위(자연수 2~9, 소수 한 자리 0.2~2.5, 소수 두 자리 0.12~1.25) 안에서 고른다.
 * 예외: 꿀과자(이전 이름 초콜릿) 14.35g × 10 (기획서에서 명시적으로 허용한 특별 문제)
 */
export interface LifeItem {
  id: string;
  /** "초콜릿", "리본" */
  name: string;
  /** 단위 (g, m, cm) — 계산 결과의 숫자만 쓰고 이 단위는 버린다 */
  unit: string;
  form: "each" | "ratio";
  /** each: 세는 말("개", "조각"), ratio: 사용 안 함 */
  counter: string;
  /** each: "무게", "길이" */
  measureWord: string;
  /** 계산한 숫자를 쓸 재료 */
  targetIngredientId: "moonDew" | "starDust";
  /** 출제 가능한 (a, b) 쌍 */
  pairs: [string, string][];
  /** 원래 대사에 붙는 이유 (계산 조건과 무관). 말투별 [하오체, 합쇼체, 하게체] */
  quirk: [string, string, string];
  /** 범위 예외로 허용된 특별 문제인지 */
  rangeException?: boolean;
}

export const LIFE_ITEMS: Record<string, LifeItem> = {
  chocolate: {
    id: "chocolate", name: "꿀과자", unit: "g", form: "each", counter: "개", measureWord: "무게",
    targetIngredientId: "moonDew", pairs: [["14.35", "10"]], rangeException: true,
    quirk: ["생일 선물로 받은 꿀과자만큼 달콤한 포션이 필요하오.", "생일 선물로 받은 꿀과자만큼 달콤한 포션이 필요합니다.", "생일 선물로 받은 꿀과자만큼 달콤한 포션이 필요하네."],
  },
  pebble: {
    id: "pebble", name: "작은 돌", unit: "g", form: "each", counter: "개", measureWord: "무게",
    targetIngredientId: "moonDew",
    pairs: [["1.2", "3"], ["2.4", "2"], ["0.8", "6"], ["1.6", "4"], ["1.5", "5"]],
    quirk: ["강가의 돌로 탑을 쌓았는데, 그 탑에 행운을 담고 싶소.", "강가의 돌로 탑을 쌓았는데, 그 탑에 행운을 담고 싶습니다.", "강가의 돌로 탑을 쌓았는데, 그 탑에 행운을 담고 싶네."],
  },
  bead: {
    id: "bead", name: "유리구슬", unit: "g", form: "each", counter: "개", measureWord: "무게",
    targetIngredientId: "starDust",
    pairs: [["0.35", "4"], ["0.15", "6"], ["0.45", "3"], ["0.25", "7"], ["1.25", "2"]],
    quirk: ["유리구슬 목걸이에 어울리는 반짝이는 포션을 찾고 있소.", "유리구슬 목걸이에 어울리는 반짝이는 포션을 찾고 있습니다.", "유리구슬 목걸이에 어울리는 반짝이는 포션을 찾고 있네."],
  },
  ribbon: {
    id: "ribbon", name: "리본", unit: "m", form: "ratio", counter: "", measureWord: "길이",
    targetIngredientId: "moonDew",
    pairs: [["3", "0.4"], ["6", "0.3"], ["4", "0.25"], ["8", "0.35"], ["5", "1.2"], ["2", "0.75"]],
    quirk: ["선물 상자를 묶고 남은 리본을 버리기가 아깝소.", "선물 상자를 묶고 남은 리본을 버리기가 아깝습니다.", "선물 상자를 묶고 남은 리본을 버리기가 아깝네."],
  },
  rope: {
    id: "rope", name: "밧줄", unit: "m", form: "ratio", counter: "", measureWord: "길이",
    targetIngredientId: "starDust",
    pairs: [["2.4", "0.5"], ["1.5", "0.6"], ["1.8", "0.4"], ["0.85", "0.4"], ["1.25", "0.6"], ["0.45", "0.8"]],
    quirk: ["밧줄 타기 훈련을 백 번 마친 기념이오.", "밧줄 타기 훈련을 백 번 마친 기념입니다.", "밧줄 타기 훈련을 백 번 마친 기념일세."],
  },
  pencil: {
    id: "pencil", name: "깃펜", unit: "cm", form: "each", counter: "자루", measureWord: "길이를 모두 더한 값",
    targetIngredientId: "moonDew",
    pairs: [["1.4", "5"], ["2.5", "3"], ["0.6", "8"], ["0.75", "4"], ["0.65", "6"]],
    quirk: ["닳은 깃펜을 모아 두었는데, 그만큼 공부한 기념이오.", "닳은 깃펜을 모아 두었는데, 그만큼 공부한 기념입니다.", "닳은 깃펜을 모아 두었는데, 그만큼 공부한 기념일세."],
  },
};

export function getLifeItem(id: string): LifeItem {
  const item = LIFE_ITEMS[id];
  if (!item) throw new Error(`알 수 없는 생활 소재: ${id}`);
  return item;
}
