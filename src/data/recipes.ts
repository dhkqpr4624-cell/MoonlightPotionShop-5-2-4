/**
 * 고정 레시피. '포션 1병당' 첨가물 양이며 주문마다 바꾸지 않는다.
 * 포션 = 기본 용액(자동 투입) + 마법 첨가물(학생이 계량).
 * 첨가물의 합은 병 전체 용량이 아니다.
 *
 * 레시피 해금: 레시피를 따로 사지 않는다. 필요한 재료(첨가물 재료 ID 전부)를 모두 해금하면 쓸 수 있다
 * (game/unlocks.ts). legacy 레시피는 이전 버전 주문을 마칠 때만 쓰고 새 주문에는 나오지 않는다.
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
  /** 짧은 소개 (레시피북에 표시) */
  summary: string;
  /** 이전 버전 레시피(새 주문에 나오지 않음, 저장 호환용) */
  legacy?: boolean;
}

export const RECIPES: Record<string, Recipe> = {
  energy: {
    id: "energy",
    name: "기력 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [{ ingredientId: "energyHerb", amount: "0.6" }],
    look: { liquid: "#3fc79a", glow: "#c9f7da", particle: "leaf", bottle: "round", emblem: "leaf" },
    lookText: "연둣빛 액체 속에서 작은 잎 조각이 반짝여요",
    glowWord: "연둣빛",
    pricePerBottle: 5,
    supports: { multiBottle: ["d1xN"], customMultiplier: ["d1xD"] },
    summary: "지친 몸에 기운을 북돋아 주는 포션이에요. 기력초 한 가지만 계량하면 돼요.",
  },
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
    legacy: true,
    summary: "이전 버전 레시피예요. 진행 중이던 영업을 마칠 때만 써요.",
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
    legacy: true,
    summary: "이전 버전 레시피예요. 진행 중이던 영업을 마칠 때만 써요.",
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
    legacy: true,
    summary: "이전 버전 레시피예요. 진행 중이던 영업을 마칠 때만 써요.",
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
    legacy: true,
    summary: "이전 버전 레시피예요. 진행 중이던 영업을 마칠 때만 써요.",
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
