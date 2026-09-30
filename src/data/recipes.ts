/**
 * 고정 레시피. '포션 1병당' 첨가물 양이며, 주문마다 바꾸지 않는다.
 * 포션 = 기본 용액(자동 투입) + 마법 첨가물(학생이 계량).
 * 첨가물의 합은 병 전체 용량이 아니다. 병 용량은 기본 용액 기준으로 따로 표시한다.
 */

export interface RecipeAdditive {
  ingredientId: string;
  /** 1병당 양. 정확한 십진 문자열 */
  amount: string;
}

export interface PotionLook {
  liquid: string;
  glow: string;
  particle: "star" | "leaf" | "mist" | "spark" | "bubble";
  bottle: "round" | "tall" | "flask";
}

export interface Recipe {
  id: string;
  name: string;
  /** 자동 투입되는 기본 용액 (1병당) */
  baseSolution: { name: string; amountMl: string };
  additives: RecipeAdditive[];
  look: PotionLook;
  lookText: string;
  /** 1병 판매 가격(달빛 동전) */
  pricePerBottle: number;
}

export const RECIPES: Record<string, Recipe> = {
  starlight: {
    id: "starlight",
    name: "별빛 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "moonDew", amount: "0.6" },
      { ingredientId: "starDust", amount: "0.25" },
    ],
    look: { liquid: "#3d7bff", glow: "#9cc8ff", particle: "star", bottle: "round" },
    lookText: "푸른 액체 속에 별 입자가 반짝여요",
    pricePerBottle: 5,
  },
};

export function getRecipe(id: string): Recipe {
  const found = RECIPES[id];
  if (!found) throw new Error(`알 수 없는 레시피: ${id}`);
  return found;
}
