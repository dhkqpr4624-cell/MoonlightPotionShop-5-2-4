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
 */

export type Unit = "mL" | "g";
export type IngredientKind = "liquid" | "powder" | "herb";

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
  moonDew: {
    id: "moonDew",
    name: "달빛 이슬",
    unit: "mL",
    kind: "liquid",
    color: "#8fd3ff",
    description: "보름달 아래 풀잎에 맺힌 푸른 이슬",
    drawer: 1,
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
    drawer: 2,
    unlockCost: 0,
    legacy: true,
  },
};

export function getIngredient(id: string): Ingredient {
  const found = INGREDIENTS[id];
  if (!found) throw new Error(`알 수 없는 재료: ${id}`);
  return found;
}
