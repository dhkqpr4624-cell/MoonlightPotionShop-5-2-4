/**
 * 고정 레시피. '포션 1병당' 첨가물 양이며 주문마다 바꾸지 않는다.
 * 포션 = 기본 용액(자동 투입) + 마법 첨가물(학생이 계량).
 * 첨가물의 합은 병 전체 용량이 아니다.
 */
import type { LearningTypeId } from "./learningTypes.ts";

export interface RecipeAdditive {
  ingredientId: string;
  /** 1병당 양. 정확한 십진 문자열 */
  amount: string;
}

export interface PotionLook {
  liquid: string;
  glow: string;
  particle: "star" | "leaf" | "mist" | "spark";
  bottle: "round" | "tall" | "flask" | "drop";
  /** 라벨 문양 */
  emblem: "star" | "flame" | "leaf" | "cloud";
}

export interface Recipe {
  id: string;
  name: string;
  baseSolution: { name: string; amountMl: string };
  additives: RecipeAdditive[];
  look: PotionLook;
  lookText: string;
  /** 손님 반응에 쓰는 빛깔 이름 (예: "별빛") */
  glowWord: string;
  /** 여러 병 주문 1병 판매 가격(달빛 동전) */
  pricePerBottle: number;
  /** 이 레시피로 낼 수 있는 학습 유형 (데이터 검증 테스트가 실제 기본량과 맞는지 확인한다) */
  supports: { multiBottle: LearningTypeId[]; customMultiplier: LearningTypeId[] };
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
    look: { liquid: "#3d7bff", glow: "#9cc8ff", particle: "star", bottle: "round", emblem: "star" },
    lookText: "푸른 액체 속에 별 입자가 반짝여요",
    glowWord: "별빛",
    pricePerBottle: 5,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
  },
  courage: {
    id: "courage",
    name: "용기 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "moonDew", amount: "4" },
      { ingredientId: "starDust", amount: "2" },
    ],
    look: { liquid: "#e2483d", glow: "#ffb07a", particle: "spark", bottle: "tall", emblem: "flame" },
    lookText: "붉은 액체에서 작은 불꽃 방울이 톡톡 튀어요",
    glowWord: "불꽃빛",
    pricePerBottle: 5,
    supports: { multiBottle: [], customMultiplier: ["Nxd1", "Nxd2"] },
  },
  sprout: {
    id: "sprout",
    name: "새싹 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "moonDew", amount: "0.8" },
      { ingredientId: "starDust", amount: "0.4" },
    ],
    look: { liquid: "#3fae5a", glow: "#b8f2a0", particle: "leaf", bottle: "flask", emblem: "leaf" },
    lookText: "초록 액체 속에 작은 잎이 둥둥 떠 있어요",
    glowWord: "초록빛",
    pricePerBottle: 5,
    supports: { multiBottle: ["d1xN"], customMultiplier: ["d1xD"] },
  },
  mist: {
    id: "mist",
    name: "안개 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "moonDew", amount: "0.35" },
      { ingredientId: "starDust", amount: "0.15" },
    ],
    look: { liquid: "#8a5bd6", glow: "#d9c6ff", particle: "mist", bottle: "drop", emblem: "cloud" },
    lookText: "보랏빛 액체 위로 안개가 피어올라요",
    glowWord: "보랏빛",
    pricePerBottle: 5,
    supports: { multiBottle: ["d2xN"], customMultiplier: ["d2xD"] },
  },
};

/** 맞춤 배수·생활 소재·비교 주문의 정상 판매금 (주문당) */
export const SPECIAL_ORDER_PRICE = 20;

export function getRecipe(id: string): Recipe {
  const found = RECIPES[id];
  if (!found) throw new Error(`알 수 없는 레시피: ${id}`);
  return found;
}

export function additiveAmount(recipe: Recipe, ingredientId: string): string {
  const ad = recipe.additives.find((x) => x.ingredientId === ingredientId);
  if (!ad) throw new Error(`${recipe.name}에 ${ingredientId}가 없습니다.`);
  return ad.amount;
}
