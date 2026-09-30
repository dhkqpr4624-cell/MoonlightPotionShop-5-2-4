/** 재료 데이터. 액체 첨가물은 mL, 가루 첨가물은 g 으로 통일한다. */

export type Unit = "mL" | "g";
export type IngredientKind = "liquid" | "powder";

export interface Ingredient {
  id: string;
  name: string;
  unit: Unit;
  kind: IngredientKind;
  /** 임시 그래픽 색 */
  color: string;
  description: string;
  /** 최종 그림이 생기면 public/ 아래 경로를 넣는다. 없으면 임시 그래픽 사용. */
  image?: string;
}

export const INGREDIENTS: Record<string, Ingredient> = {
  moonDew: {
    id: "moonDew",
    name: "달빛 이슬",
    unit: "mL",
    kind: "liquid",
    color: "#8fd3ff",
    description: "보름달 아래 풀잎에 맺힌 푸른 이슬",
  },
  starDust: {
    id: "starDust",
    name: "별가루",
    unit: "g",
    kind: "powder",
    color: "#ffe27a",
    description: "떨어진 별똥별에서 모은 반짝이는 가루",
  },
};

export function getIngredient(id: string): Ingredient {
  const found = INGREDIENTS[id];
  if (!found) throw new Error(`알 수 없는 재료: ${id}`);
  return found;
}
