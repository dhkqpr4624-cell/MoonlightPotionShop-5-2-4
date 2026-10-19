/**
 * 재료 데이터. 액체 첨가물은 mL, 가루·약초 첨가물은 g 으로 통일한다.
 *
 * 해금(unlock)
 *  - 재료는 돈으로 '사용 권한'을 한 번 사면 계속 쓸 수 있다(재고·소모품이 아님).
 *  - unlockCost가 0이면 처음부터 해금된 무료 재료다.
 *  - legacy 재료는 이전 버전 레시피(별빛·용기·새싹·안개) 전용이다. 진행 중이던 하루를 마칠 때만 쓰고,
 *    재료 해금 메뉴에 팔지 않는다.
 *
 * drawer: 제작대 위쪽 서랍 번호(data/shopArt.ts WORKBENCH_SCENE.drawers). 0이 맨 왼쪽 위.
 *   0 기력초(무료) · 1 깃털풀 · 2 바람 정령의 파편 · 3·4 이전 버전 재료(진행 중이던 이전 주문을 마칠 때만 놓임) · 5 비어 있음
 *
 * 해금 가격 근거 (실제 출제기로 하루 주문 2,000개씩 계산한 평균 정상 판매금)
 *   1일차(①② 소개) 약 132, 2일차 이후 약 110 / 모두 오답(60%)이면 약 79, 약 66
 *   → 깃털풀 70 + 바람 정령의 파편 110 = 180: 모두 정답이면 1~2일, 모두 오답이어도 3일이면 둘 다 살 수 있다.
 */

export type Unit = "mL" | "g";
export type IngredientKind = "liquid" | "powder" | "herb" | "crystal";

export interface Ingredient {
  id: string;
  name: string;
  unit: Unit;
  kind: IngredientKind;
  /** 액체에 섞일 때의 색 */
  color: string;
  description: string;
  /** 제작대 서랍 번호 */
  drawer: number;
  /** 해금 비용(달빛 동전). 0이면 처음부터 해금 */
  unlockCost: number;
  /** 이전 버전 레시피 전용(구매 메뉴에 없음) */
  legacy?: boolean;
  /** 최종 그림이 생기면 public/ 아래 경로를 넣는다. 없으면 코드 그림 사용. */
  image?: string;
}

export const INGREDIENTS: Record<string, Ingredient> = {
  energyHerb: {
    id: "energyHerb",
    name: "기력초",
    unit: "g",
    kind: "herb",
    color: "#5fd39a",
    description: "달빛을 받으며 자란, 기운을 북돋는 연둣빛 약초",
    drawer: 0,
    unlockCost: 0,
  },
  featherGrass: {
    id: "featherGrass",
    name: "깃털풀",
    unit: "g",
    kind: "herb",
    color: "#b9e88a",
    description: "깃털처럼 가볍고 길게 갈라진 잎을 가진 연녹색 풀",
    drawer: 1,
    unlockCost: 70,
  },
  windShard: {
    id: "windShard",
    name: "바람 정령의 파편",
    unit: "g",
    kind: "crystal",
    color: "#7fe0e6",
    description: "바람 정령이 지나간 자리에 남은, 가볍고 투명한 청록빛 결정",
    drawer: 2,
    unlockCost: 110,
  },
  moonDew: {
    id: "moonDew",
    name: "달빛 이슬",
    unit: "mL",
    kind: "liquid",
    color: "#8fd3ff",
    description: "보름달 아래 풀잎에 맺힌 푸른 이슬",
    drawer: 3,
    unlockCost: 0,
    legacy: true,
  },
  starDust: {
    id: "starDust",
    name: "별가루",
    unit: "g",
    kind: "powder",
    color: "#ffe27a",
    description: "떨어진 별똥별에서 모은 반짝이는 가루",
    drawer: 4,
    unlockCost: 0,
    legacy: true,
  },
};

export function getIngredient(id: string): Ingredient {
  const found = INGREDIENTS[id];
  if (!found) throw new Error(`알 수 없는 재료: ${id}`);
  return found;
}
